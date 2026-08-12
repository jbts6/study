import type { BattleEvent, BattleState, TurnCommand } from "../game/combat/types";
import { resolveTurn } from "../game/combat/resolve-turn";
import { enemyCommand } from "../game/campaign/enemy-command";
import { validateLevelCommand } from "../game/campaign/validate-level-command";
import { injectUnlockedAbilities } from "../game/content/ability-catalog";
import { getLevel, getNextLevelId } from "../game/content/levels";
import type { LevelDefinition, LevelId } from "../game/content/types";
import { projectWorldView } from "../game/world/project-world-view";
import type { RunRequest, RunResult, RunnerDiagnostic } from "../runners/protocol/types";
import type { RunnerClient, RunnerDisplayState } from "./runner-client";
import { RESET_CONFIRMATION } from "./save-store";
import type { SaveDataV2, SaveStore } from "./save-store";
const RUN_LIMITS = {
  timeoutMs: 5_000,
  interruptGraceMs: 500,
  maxFiles: 10,
  maxFileBytes: 65_536,
  maxSourceBytes: 65_536,
  maxOutputBytes: 16_384,
  maxTraceEvents: 1_000,
  maxValueDepth: 4,
} as const;

const RUNNER_UNAVAILABLE_MESSAGE = "本地 Python Runner 不可用。启动 Runner 后刷新页面。";

export type AppFeedback = Readonly<{
  kind: "idle" | "success" | "error" | "info";
  title: string;
  messages: readonly string[];
  stdout: string;
  stderr: string;
}>;

export type GameSnapshot = Readonly<{
  mode: "game";
  currentLevelId: LevelId;
  battleState: BattleState;
  codeDraft: string;
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  activeRunId?: string;
}>;

export type SaveRecoverySnapshot = Readonly<{
  mode: "save_recovery";
  message: string;
}>;

export type AppSnapshot = GameSnapshot | SaveRecoverySnapshot;

export type AppControllerDependencies = Readonly<{
  runner: RunnerClient;
  saveStore: SaveStore;
  createId?: () => string;
}>;

export class AppController {
  private readonly listeners = new Set<(snapshot: AppSnapshot) => void>();
  private snapshot: AppSnapshot;

  constructor(private readonly dependencies: AppControllerDependencies) {
    const level = getLevel("python-marsh-01");
    this.snapshot = this.createGameSnapshot(level.id, createLevelBattle(level), level.starterCode, idleFeedback());
    dependencies.runner.onStateChange((state) => this.updateRunnerState(state));
  }

  async start(): Promise<void> {
    const loaded = this.dependencies.saveStore.load();
    if (!loaded.ok) {
      this.replaceSnapshot({ mode: "save_recovery", message: loaded.message });
      return;
    }

    const firstLevel = getLevel("python-marsh-01");
    const save = loaded.save ?? this.createSave(firstLevel.id, createLevelBattle(firstLevel), firstLevel.starterCode);
    if (loaded.save === null) this.dependencies.saveStore.save(save);
    const level = getLevel(save.currentLevelId);
    this.replaceSnapshot(this.createGameSnapshot(level.id, injectUnlockedAbilities(level.id, save.battleState), save.codeDraft, settlementFeedback(level, save.battleState)));
    await this.connectRunner();
  }

  setCode(code: string): void {
    if (this.snapshot.mode !== "game") return;
    const next = { ...this.snapshot, codeDraft: code };
    this.saveGame(next);
    this.replaceSnapshot(next);
  }

  async runTurn(): Promise<void> {
    const snapshot = this.snapshot;
    if (!this.canRun(snapshot)) return;

    const runId = (this.dependencies.createId ?? createId)();
    this.replaceSnapshot({ ...snapshot, activeRunId: runId });
    let result: RunResult;
    try {
      result = await this.dependencies.runner.run(this.createRunRequest(snapshot, runId));
    } catch {
      this.reportRunnerUnavailable(runId);
      return;
    }

    try {
      this.resolvePlayerResult(result, runId);
    } finally {
      this.clearActiveRun(runId);
    }
  }

  async interrupt(): Promise<void> {
    if (this.snapshot.mode !== "game" || this.snapshot.activeRunId === undefined) return;
    this.dependencies.runner.interrupt(this.snapshot.activeRunId);
  }

  resetSave(confirmation: string): void {
    if (confirmation !== RESET_CONFIRMATION) return;
    this.dependencies.saveStore.remove();
    const level = getLevel("python-marsh-01");
    const save = this.createSave(level.id, createLevelBattle(level), level.starterCode);
    this.dependencies.saveStore.save(save);
    this.replaceSnapshot(this.createGameSnapshot(level.id, save.battleState, save.codeDraft, idleFeedback()));
    void this.connectRunner();
  }

  retryLevel(): void {
    if (this.snapshot.mode !== "game" || !isFailedSettlement(this.snapshot)) return;
    const level = getLevel(this.snapshot.currentLevelId);
    const next = this.createGameSnapshot(level.id, createLevelBattle(level), this.snapshot.codeDraft, idleFeedback());
    this.saveGame(next);
    this.replaceSnapshot(next);
  }

  advanceLevel(): void {
    if (this.snapshot.mode !== "game" || !isSuccessfulSettlement(this.snapshot)) return;
    const nextLevelId = getNextLevelId(this.snapshot.currentLevelId);
    if (nextLevelId === undefined) return;
    let level: LevelDefinition;
    try {
      level = getLevel(nextLevelId);
    } catch {
      return;
    }
    const next = this.createGameSnapshot(level.id, createLevelBattle(level), level.starterCode, idleFeedback());
    this.saveGame(next);
    this.replaceSnapshot(next);
  }

  subscribe(listener: (snapshot: AppSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): AppSnapshot {
    return this.snapshot;
  }

  private canRun(snapshot: AppSnapshot): snapshot is GameSnapshot {
    return snapshot.mode === "game"
      && snapshot.runnerState === "ready"
      && snapshot.battleState.phase === "in_progress"
      && snapshot.activeRunId === undefined;
  }

  private createRunRequest(snapshot: GameSnapshot, runId: string): RunRequest {
    return {
      protocolVersion: 1,
      runId,
      attemptId: `${runId}:1`,
      questId: snapshot.currentLevelId,
      language: "python",
      files: { "main.py": snapshot.codeDraft },
      entrypoint: { file: "main.py", callable: "choose_turn" },
      worldView: projectWorldView(snapshot.battleState),
      allowedModules: ["math"],
      limits: RUN_LIMITS,
    };
  }

  private resolvePlayerResult(result: RunResult, runId: string): void {
    const snapshot = this.activeGameSnapshot(runId);
    if (snapshot === undefined) return;
    if (result.executionStatus !== "completed") {
      this.replaceSnapshot({ ...snapshot, activeRunId: undefined, feedback: feedbackFromRunResult(result) });
      return;
    }

    const level = getLevel(snapshot.currentLevelId);
    const levelValidation = validateCandidateForLevel(level, snapshot.battleState, result.returnValue);
    if (!levelValidation.accepted) {
      this.replaceSnapshot({ ...snapshot, activeRunId: undefined, feedback: combatErrorFeedback(levelValidation.errors) });
      return;
    }
    const player = resolveTurn(snapshot.battleState, levelValidation.command);
    if (!player.accepted) {
      this.replaceSnapshot({ ...snapshot, activeRunId: undefined, feedback: combatErrorFeedback(player.errors) });
      return;
    }

    const enemyTurns = this.advanceEnemyTurns(level, player.state);
    const events = [...player.events, ...enemyTurns.events];
    const next = {
      ...snapshot,
      activeRunId: undefined,
      battleState: enemyTurns.state,
      feedback: successFeedback(enemyTurns.state, events, result),
    };
    this.saveGame(next);
    this.replaceSnapshot(next);
  }

  private advanceEnemyTurns(level: LevelDefinition, initialState: BattleState): Readonly<{ state: BattleState; events: readonly BattleEvent[] }> {
    let state = initialState;
    const events: BattleEvent[] = [];
    while (state.phase === "in_progress") {
      const enemy = activeUnit(state);
      if (enemy?.team !== "enemies" || enemy.disabled) break;
      const command = enemyCommand(level, state);
      const validation = validateLevelCommand(level, state, command);
      if (!validation.accepted) throw new Error("应用预设的敌方指令被关卡规则拒绝。");
      const resolution = resolveTurn(state, validation.command);
      if (!resolution.accepted) throw new Error("应用预设的敌方指令被战斗内核拒绝。");
      state = resolution.state;
      events.push(...resolution.events);
    }
    return { state, events };
  }

  private createSave(currentLevelId: LevelId, battleState: BattleState, codeDraft: string): SaveDataV2 {
    return { version: 2, currentLevelId, battleState, codeDraft };
  }

  private saveGame(snapshot: GameSnapshot): void {
    this.dependencies.saveStore.save(this.createSave(snapshot.currentLevelId, snapshot.battleState, snapshot.codeDraft));
  }

  private createGameSnapshot(currentLevelId: LevelId, battleState: BattleState, codeDraft: string, feedback: AppFeedback): GameSnapshot {
    return {
      mode: "game",
      currentLevelId,
      battleState,
      codeDraft,
      runnerState: this.dependencies.runner.state,
      feedback,
    };
  }

  private async connectRunner(): Promise<void> {
    try {
      await this.dependencies.runner.connect();
      this.updateRunnerState(this.dependencies.runner.state);
    } catch {
      this.updateRunnerState("unavailable");
    }
  }

  private reportRunnerUnavailable(runId: string): void {
    const snapshot = this.activeGameSnapshot(runId);
    if (snapshot === undefined) return;
    this.replaceSnapshot({
      ...snapshot,
      activeRunId: undefined,
      runnerState: "unavailable",
      feedback: errorFeedback("Python Runner 不可用", [RUNNER_UNAVAILABLE_MESSAGE]),
    });
  }

  private clearActiveRun(runId: string): void {
    const snapshot = this.activeGameSnapshot(runId);
    if (snapshot !== undefined) this.replaceSnapshot({ ...snapshot, activeRunId: undefined });
  }

  private activeGameSnapshot(runId: string): GameSnapshot | undefined {
    return this.snapshot.mode === "game" && this.snapshot.activeRunId === runId ? this.snapshot : undefined;
  }

  private updateRunnerState(runnerState: RunnerDisplayState): void {
    if (this.snapshot.mode === "game") this.replaceSnapshot({ ...this.snapshot, runnerState });
  }

  private replaceSnapshot(snapshot: AppSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}

function activeUnit(state: BattleState) {
  return state.units.find((unit) => unit.id === state.turnOrder[state.turnIndex]);
}
function idleFeedback(): AppFeedback {
  return { kind: "idle", title: "", messages: [], stdout: "", stderr: "" };
}

function successFeedback(state: BattleState, events: readonly BattleEvent[], result: RunResult): AppFeedback {
  const settlement = settlementFeedback(getLevel(state.battleId as LevelId), state);
  if (settlement.kind !== "idle") return { ...settlement, stdout: result.streams.stdout, stderr: result.streams.stderr };
  return {
    kind: "success",
    title: "回合已推进",
    messages: events.map(formatBattleEvent),
    stdout: result.streams.stdout,
    stderr: result.streams.stderr,
  };
}

function createLevelBattle(level: LevelDefinition): BattleState {
  return injectUnlockedAbilities(level.id, structuredClone(level.initialBattle));
}

function validateCandidateForLevel(level: LevelDefinition, state: BattleState, input: unknown) {
  if (!isTurnCommand(input)) return resolveTurn(state, input);
  return validateLevelCommand(level, state, input);
}

function isTurnCommand(value: unknown): value is TurnCommand {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && "actorId" in value && "expectedRevision" in value && "action" in value
    && value.action !== null && typeof value.action === "object" && "type" in value.action;
}

function unmetObjectives(_level: LevelDefinition, state: BattleState): readonly string[] {
  if (state.phase !== "won") return [];
  return state.objectives.filter((objective) => !objective.key && !objective.completed)
    .map((objective) => objective.id === "scout-mark" ? "勘测印记尚未激活" : `${objective.id} 尚未激活`);
}

function settlementFeedback(level: LevelDefinition, state: BattleState): AppFeedback {
  if (state.phase === "lost") return errorFeedback("任务失败", ["战斗失败。重试本关以保留当前代码。"]);
  const unmet = unmetObjectives(level, state);
  if (unmet.length > 0) return errorFeedback("任务失败", unmet.map((reason) => `任务失败：${reason}`));
  if (state.phase !== "won") return idleFeedback();
  return level.reward.type === "ability"
    ? { kind: "success", title: "关卡完成", messages: [`获得新能力：${level.reward.abilityId}`], stdout: "", stderr: "" }
    : { kind: "success", title: "战役完成", messages: ["沼心封印已经稳定。"], stdout: "", stderr: "" };
}

function isSuccessfulSettlement(snapshot: GameSnapshot): boolean {
  return snapshot.battleState.phase === "won" && unmetObjectives(getLevel(snapshot.currentLevelId), snapshot.battleState).length === 0;
}

function isFailedSettlement(snapshot: GameSnapshot): boolean {
  return snapshot.battleState.phase === "lost" || (snapshot.battleState.phase === "won" && !isSuccessfulSettlement(snapshot));
}

function combatErrorFeedback(errors: readonly Readonly<{ code: string; path: string; message: string }>[]): AppFeedback {
  return errorFeedback("指令无效", errors.map((error) => `[${error.code}] ${error.path} ${error.message}`));
}

function feedbackFromRunResult(result: RunResult): AppFeedback {
  const interrupted = result.executionStatus === "interrupted";
  const messages = result.diagnostics.map(formatDiagnostic);
  if (interrupted) messages.unshift("运行已中断，回合未推进。");
  return {
    kind: interrupted ? "info" : "error",
    title: interrupted ? "运行已中断" : "Python 运行失败",
    messages,
    stdout: result.streams.stdout,
    stderr: result.streams.stderr,
  };
}

function errorFeedback(title: string, messages: readonly string[]): AppFeedback {
  return { kind: "error", title, messages, stdout: "", stderr: "" };
}

function formatDiagnostic(diagnostic: RunnerDiagnostic): string {
  const prefix = `[${diagnostic.severity}] ${diagnostic.code}`;
  if (diagnostic.location === undefined) return `${prefix} ${diagnostic.message}`;
  const { file, line, column } = diagnostic.location;
  return `${prefix} ${file}:${line}${column === undefined ? "" : `:${column}`} ${diagnostic.message}`;
}

function formatBattleEvent(event: BattleEvent): string {
  return `[${event.type}] ${JSON.stringify(event.payload)}`;
}
function createId(): string {
  return globalThis.crypto.randomUUID();
}
