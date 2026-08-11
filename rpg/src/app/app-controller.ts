import type { BattleEvent, BattleState, TurnCommand } from "../game/combat/types";
import { resolveTurn } from "../game/combat/resolve-turn";
import { CURRENT_LEVEL_ID, STARTER_CODE } from "../game/content/python-marsh-01";
import { projectWorldView } from "../game/world/project-world-view";
import type { RunRequest, RunResult, RunnerDiagnostic } from "../runners/protocol/types";
import type { RunnerClient, RunnerDisplayState } from "./runner-client";
import { RESET_CONFIRMATION } from "./save-store";
import type { SaveDataV1, SaveStore } from "./save-store";
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
  currentLevelId: typeof CURRENT_LEVEL_ID;
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
  createEncounter: () => BattleState;
  enemyCommand: (state: Readonly<BattleState>) => TurnCommand;
  createId?: () => string;
}>;

export class AppController {
  private readonly listeners = new Set<(snapshot: AppSnapshot) => void>();
  private snapshot: AppSnapshot;

  constructor(private readonly dependencies: AppControllerDependencies) {
    this.snapshot = this.createGameSnapshot(dependencies.createEncounter(), STARTER_CODE, idleFeedback());
    dependencies.runner.onStateChange((state) => this.updateRunnerState(state));
  }

  async start(): Promise<void> {
    const loaded = this.dependencies.saveStore.load();
    if (!loaded.ok) {
      this.replaceSnapshot({ mode: "save_recovery", message: loaded.message });
      return;
    }

    const save = loaded.save ?? this.createSave(this.dependencies.createEncounter(), STARTER_CODE);
    if (loaded.save === null) this.dependencies.saveStore.save(save);
    this.replaceSnapshot(this.createGameSnapshot(save.battleState, save.codeDraft, idleFeedback()));
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
    const save = this.createSave(this.dependencies.createEncounter(), STARTER_CODE);
    this.dependencies.saveStore.save(save);
    this.replaceSnapshot(this.createGameSnapshot(save.battleState, save.codeDraft, idleFeedback()));
    void this.connectRunner();
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
      questId: CURRENT_LEVEL_ID,
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

    const player = resolveTurn(snapshot.battleState, result.returnValue as unknown);
    if (!player.accepted) {
      this.replaceSnapshot({ ...snapshot, activeRunId: undefined, feedback: combatErrorFeedback(player.errors) });
      return;
    }

    const enemyTurns = this.advanceEnemyTurns(player.state);
    const events = [...player.events, ...enemyTurns.events];
    const next = {
      ...snapshot,
      activeRunId: undefined,
      battleState: enemyTurns.state,
      feedback: successFeedback(events, result),
    };
    this.saveGame(next);
    this.replaceSnapshot(next);
  }

  private advanceEnemyTurns(initialState: BattleState): Readonly<{ state: BattleState; events: readonly BattleEvent[] }> {
    let state = initialState;
    const events: BattleEvent[] = [];
    while (state.phase === "in_progress" && activeUnit(state)?.team === "enemies") {
      const resolution = resolveTurn(state, this.dependencies.enemyCommand(state));
      if (!resolution.accepted) throw new Error("应用预设的敌方指令被战斗内核拒绝。");
      state = resolution.state;
      events.push(...resolution.events);
    }
    return { state, events };
  }

  private createSave(battleState: BattleState, codeDraft: string): SaveDataV1 {
    return { version: 1, currentLevelId: CURRENT_LEVEL_ID, battleState, codeDraft };
  }

  private saveGame(snapshot: GameSnapshot): void {
    this.dependencies.saveStore.save(this.createSave(snapshot.battleState, snapshot.codeDraft));
  }

  private createGameSnapshot(battleState: BattleState, codeDraft: string, feedback: AppFeedback): GameSnapshot {
    return {
      mode: "game",
      currentLevelId: CURRENT_LEVEL_ID,
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

function successFeedback(events: readonly BattleEvent[], result: RunResult): AppFeedback {
  return {
    kind: "success",
    title: "回合已推进",
    messages: events.map(formatBattleEvent),
    stdout: result.streams.stdout,
    stderr: result.streams.stderr,
  };
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
