import type { BattleEvent, BattleState, TurnCommand } from "../game/combat/types";
import { resolveTurn } from "../game/combat/resolve-turn";
import { enemyCommand } from "../game/campaign/enemy-command";
import { validateLevelCommand } from "../game/campaign/validate-level-command";
import { getLevel } from "../game/content/levels";
import { PYTHON_RPG_CAMPAIGN } from "../game/content/python/levels";
import { createPythonWorldInitialState, PYTHON_WORLD_CONTENT } from "../game/content/python/world-chapter-01";
import type { WorldCampaignContent } from "../game/content/world/types";
import type { LevelDefinition } from "../game/content/types";
import type { EnemyBehaviorSpec } from "../game/content/shared/types";
import type { CampaignDefinition } from "../programs/types";
import type { ExecutionLimits, RunResult } from "../runners/protocol/types";
import type { GameState } from "../game/world/campaign-types";
import { projectCampaignWorldView } from "../game/world/project-campaign-world-view";
import { resolveWorldCommand } from "../game/world/resolve-world-command";
import { encounterBattleLevel, resetEncounterBattle, settleEncounter } from "../game/world/settle-encounter";
import {
  combatErrorFeedback,
  errorFeedback,
  feedbackFromRunResult,
  idleFeedback,
  settlementFeedback,
  successFeedback,
  worldCommandFeedback,
  worldErrorFeedback,
  type AppFeedback,
} from "./app-feedback";
import type {
  ControllerSnapshot,
  GameController,
  WorldBattleSnapshot,
  WorldExplorationSnapshot,
} from "./controller-types";
import { createDefaultRunLimits } from "./app-controller";
import { RESET_CONFIRMATION } from "./save-store";
import type { RunnerClient, RunnerDisplayState } from "./runner-client";
import type { LocalSaveDataV3, WorldSaveStore } from "./world-save-store";
import { createWorldRunRequest } from "./world-run-request";

export type WorldCampaignControllerDependencies = Readonly<{
  runner: RunnerClient;
  saveStore: WorldSaveStore;
  content?: WorldCampaignContent;
  createId?: () => string;
  runLimits?: ExecutionLimits;
  turnDelayMs?: number;
  explorationStepLimit?: number;
}>;

const AUTO_TURN_DELAY_MS = 800;
const EXPLORATION_STEP_LIMIT = 30;

type ActiveWorldSnapshot = WorldExplorationSnapshot | WorldBattleSnapshot;

export class WorldCampaignController implements GameController {
  private readonly listeners = new Set<(snapshot: ControllerSnapshot) => void>();
  private readonly runLimits: ExecutionLimits;
  private readonly content: WorldCampaignContent;
  private readonly turnDelayMs: number;
  private readonly explorationStepLimit: number;
  private battleLog: BattleEvent[] = [];
  private codeDrafts: Record<string, string> = {};
  private snapshot: ControllerSnapshot;

  constructor(
    private readonly dependencies: WorldCampaignControllerDependencies,
    public readonly campaign: CampaignDefinition = PYTHON_RPG_CAMPAIGN,
    content: WorldCampaignContent = dependencies.content ?? PYTHON_WORLD_CONTENT,
  ) {
    this.content = content;
    this.runLimits = dependencies.runLimits ?? createDefaultRunLimits().python;
    this.turnDelayMs = dependencies.turnDelayMs ?? AUTO_TURN_DELAY_MS;
    this.explorationStepLimit = dependencies.explorationStepLimit ?? EXPLORATION_STEP_LIMIT;
    const state = createPythonWorldInitialState();
    const codeDraft = this.defaultCodeDraft(state.chapterId);
    this.snapshot = this.createWorldSnapshot(state, codeDraft, idleFeedback());
    dependencies.runner.onStateChange((state) => this.updateRunnerState(state));
  }

  async start(): Promise<void> {
    const loaded = this.dependencies.saveStore.load();
    if (!loaded.ok) {
      this.replaceSnapshot({
        mode: "world_recovery",
        reason: loaded.reason,
        message: loaded.message,
        ...(loaded.legacyLevelId === undefined ? {} : { legacyLevelId: loaded.legacyLevelId }),
        ...(loaded.legacyCodeDraft === undefined ? {} : { legacyCodeDraft: loaded.legacyCodeDraft }),
      });
      return;
    }

    this.codeDrafts = loaded.save === null ? {} : { ...loaded.save.codeDrafts };
    let state = loaded.save?.gameState ?? createPythonWorldInitialState();
    const codeDraft = this.codeDrafts[state.chapterId] ?? this.defaultCodeDraft(state.chapterId);
    this.codeDrafts[state.chapterId] = codeDraft;
    let feedback = idleFeedback();

    if (state.battle !== null && state.battle.state.phase !== "in_progress") {
      const level = encounterBattleLevel(this.content, state.battle.encounterId);
      feedback = settlementFeedback(level, state.battle.state);
      state = settleEncounter(state, this.content);
      this.saveWorld(state, codeDraft);
    }

    this.replaceSnapshot(this.createWorldSnapshot(state, codeDraft, feedback));
    await this.connectRunner();
  }

  async runCode(code: string): Promise<void> {
    this.setCode(code);
    const snapshot = this.currentWorldSnapshot();
    if (snapshot === undefined) return;
    await this.runCurrent(snapshot);
  }

  setCode(code: string): void {
    const snapshot = this.currentWorldSnapshot();
    if (snapshot === undefined || snapshot.codeDraft === code) return;
    this.saveWorld(snapshot.gameState, code);
    this.replaceSnapshot({ ...snapshot, codeDraft: code });
  }

  async interrupt(): Promise<void> {
    if (!isActiveWorldSnapshot(this.snapshot) || this.snapshot.activeRunId === undefined) return;
    this.dependencies.runner.interrupt(this.snapshot.activeRunId);
  }

  resetSave(confirmation: string): void {
    if (confirmation !== RESET_CONFIRMATION) return;
    this.dependencies.saveStore.remove();
    this.codeDrafts = {};
    const state = createPythonWorldInitialState();
    const codeDraft = this.defaultCodeDraft(state.chapterId);
    this.codeDrafts[state.chapterId] = codeDraft;
    this.saveWorld(state, codeDraft);
    this.replaceSnapshot(this.createWorldSnapshot(state, codeDraft, idleFeedback()));
    void this.connectRunner();
  }

  retryLevel(): void {}

  advanceLevel(): void {}

  subscribe(listener: (snapshot: ControllerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ControllerSnapshot {
    return this.snapshot;
  }

  private async runCurrent(snapshot: ActiveWorldSnapshot): Promise<void> {
    if (!canRun(snapshot)) return;
    const runId = (this.dependencies.createId ?? createId)();
    let base = snapshot;
    if (snapshot.mode === "battle") {
      // 每次运行都从遭遇初始局面完整模拟（方案 B）。
      const state = resetEncounterBattle(snapshot.gameState, this.content);
      this.battleLog = [];
      base = { ...snapshot, gameState: state, battleState: state.battle!.state };
    }
    const running = { ...base, activeRunId: runId, diagnostics: [] };
    this.replaceSnapshot(running);

    let state = running.gameState;
    let explorationSteps = 0;
    while (true) {
      let result: RunResult;
      try {
        result = await this.dependencies.runner.run(createWorldRunRequest({
          campaign: this.campaign,
          content: this.content,
          state,
          codeDraft: running.codeDraft,
          runId,
          limits: this.runLimits,
        }));
      } catch {
        this.reportRunnerUnavailable(runId);
        return;
      }

      const outcome = this.resolveResult(result, runId);
      const current = this.activeWorldSnapshot(runId);
      if (current === undefined || outcome !== "continue") return;
      if (current.mode === "exploration") {
        explorationSteps += 1;
        if (explorationSteps >= this.explorationStepLimit) {
          this.replaceSnapshot({
            ...current,
            activeRunId: undefined,
            feedback: {
              ...current.feedback,
              layer: "task",
              kind: "info",
              title: "探索步数达到上限",
              messages: [`一次运行最多自动执行 ${this.explorationStepLimit} 步探索。检查 choose_world_action 是否会在当前步骤上原地循环，修正后再次运行。`],
            },
          });
          return;
        }
      }
      state = current.gameState;
      if (this.turnDelayMs > 0) await delay(this.turnDelayMs);
      if (this.activeWorldSnapshot(runId) === undefined) return;
    }
  }

  private resolveResult(result: RunResult, runId: string): "continue" | "stopped" {
    const snapshot = this.activeWorldSnapshot(runId);
    if (snapshot === undefined) return "stopped";
    if (result.executionStatus !== "completed") {
      this.replaceSnapshot({
        ...snapshot,
        activeRunId: undefined,
        feedback: feedbackFromRunResult(result, "python"),
        diagnostics: result.diagnostics,
      });
      return "stopped";
    }

    if (snapshot.mode === "exploration") {
      return this.resolveExplorationResult(snapshot, result);
    }
    return this.resolveBattleResult(snapshot, result);
  }

  private resolveExplorationResult(snapshot: WorldExplorationSnapshot, result: RunResult): "continue" | "stopped" {
    const resolution = resolveWorldCommand(snapshot.gameState, this.content, result.returnValue);
    if (!resolution.accepted) {
      this.replaceSnapshot({
        ...snapshot,
        activeRunId: undefined,
        feedback: worldErrorFeedback(resolution.errors),
        diagnostics: [],
      });
      return "stopped";
    }

    const nextState = resolution.state;
    this.saveWorld(nextState, snapshot.codeDraft);
    if (nextState.battle !== null) {
      this.replaceSnapshot(this.createWorldSnapshot(nextState, snapshot.codeDraft, {
        layer: "task",
        kind: "info",
        title: "遭遇开始",
        messages: ["任务链推进到战斗遭遇。再次运行进入自动战斗，编辑 choose_turn 后点“运行回合（自动连续）”。"],
        stdout: result.streams.stdout,
        stderr: result.streams.stderr,
      }));
      return "stopped";
    }
    const feedback = worldCommandFeedback(resolution.command, result);
    if (nextState.quests[0]?.status === "completed") {
      this.replaceSnapshot(this.createWorldSnapshot(nextState, snapshot.codeDraft, {
        ...feedback,
        title: "章节完成",
        messages: [...feedback.messages, "本章任务已完成。探索新的地点开启下一章。"],
      }));
      return "stopped";
    }
    this.replaceSnapshot({
      ...this.createWorldSnapshot(nextState, snapshot.codeDraft, feedback),
      activeRunId: snapshot.activeRunId,
    });
    return "continue";
  }

  private resolveBattleResult(snapshot: WorldBattleSnapshot, result: RunResult): "continue" | "stopped" {
    const activeBattle = snapshot.gameState.battle;
    if (activeBattle === null) return "stopped";
    const level = encounterBattleLevel(this.content, activeBattle.encounterId);
    const player = resolvePlayerCommand(level, activeBattle.state, result.returnValue);
    if (!player.accepted) {
      this.replaceSnapshot({
        ...snapshot,
        activeRunId: undefined,
        feedback: combatErrorFeedback(player.errors),
        diagnostics: [],
      });
      return "stopped";
    }

    const enemyTurns = this.advanceEnemyTurns(level, this.content.encounters[activeBattle.encounterId]?.enemyBehaviors, player.state);
    const events = [...player.events, ...enemyTurns.events];
    this.battleLog = [...this.battleLog, ...events];
    const battleState = enemyTurns.state;
    const continueAutoPlay = battleState.phase === "in_progress";
    let nextState: GameState = {
      ...snapshot.gameState,
      battle: { encounterId: activeBattle.encounterId, state: battleState },
    };
    let feedback: AppFeedback = successFeedback(battleState, events, result, level);
    if (!continueAutoPlay) {
      feedback = {
        ...settlementFeedback(level, battleState),
        stdout: result.streams.stdout,
        stderr: result.streams.stderr,
      };
    }

    const turnSnapshot = this.createWorldSnapshot(nextState, snapshot.codeDraft, feedback);
    this.replaceSnapshot(continueAutoPlay && snapshot.activeRunId !== undefined
      ? { ...turnSnapshot, activeRunId: snapshot.activeRunId }
      : turnSnapshot);
    if (!continueAutoPlay) {
      nextState = settleEncounter(nextState, this.content);
    }
    this.saveWorld(nextState, snapshot.codeDraft);
    if (!continueAutoPlay) {
      this.replaceSnapshot(this.createWorldSnapshot(nextState, snapshot.codeDraft, feedback));
    }
    return continueAutoPlay ? "continue" : "stopped";
  }

  private advanceEnemyTurns(
    level: LevelDefinition,
    encounterBehaviors: Readonly<Record<string, EnemyBehaviorSpec>> | undefined,
    initialState: BattleState,
  ): Readonly<{ state: BattleState; events: readonly BattleEvent[] }> {
    let state = initialState;
    const events: BattleEvent[] = [];
    const encounterLevel = encounterBehaviors === undefined ? level : { ...level, enemyBehaviors: { ...level.enemyBehaviors, ...encounterBehaviors } };
    while (state.phase === "in_progress") {
      const enemy = activeUnit(state);
      if (enemy?.team !== "enemies" || enemy.disabled) break;
      const command = enemyCommand(encounterLevel, state);
      const validation = validateLevelCommand(encounterLevel, state, command);
      if (!validation.accepted) throw new Error("应用预设的敌方指令被关卡规则拒绝。");
      const resolution = resolveTurn(state, validation.command);
      if (!resolution.accepted) throw new Error("应用预设的敌方指令被战斗内核拒绝。");
      state = resolution.state;
      events.push(...resolution.events);
    }
    return { state, events };
  }

  private saveWorld(state: GameState, codeDraft: string): void {
    this.codeDrafts = { ...this.codeDrafts, [state.chapterId]: codeDraft };
    const value: LocalSaveDataV3 = {
      version: 3,
      gameState: state,
      codeDrafts: { ...this.codeDrafts },
    };
    this.dependencies.saveStore.save(value);
  }

  private createWorldSnapshot(state: GameState, codeDraft: string, feedback: AppFeedback): ActiveWorldSnapshot {
    if (state.battle === null) {
      return {
        mode: "exploration",
        gameState: state,
        worldView: projectCampaignWorldView(state, this.content),
        codeDraft,
        runnerState: this.dependencies.runner.state,
        feedback,
        diagnostics: [],
      };
    }
    return {
      mode: "battle",
      gameState: state,
      battleState: state.battle.state,
      battleLevelId: encounterBattleLevel(this.content, state.battle.encounterId).id,
      battleLog: [...this.battleLog],
      codeDraft,
      runnerState: this.dependencies.runner.state,
      feedback,
      diagnostics: [],
    };
  }

  private defaultCodeDraft(chapterId: string): string {
    const levelId = this.campaign.levelOrder.find((candidate) => candidate === chapterId) ?? this.campaign.levelOrder[0];
    if (levelId === undefined) throw new Error(`战役没有可用关卡: ${this.campaign.id}`);
    return getLevel(levelId).starterCode;
  }

  private currentWorldSnapshot(): ActiveWorldSnapshot | undefined {
    return isActiveWorldSnapshot(this.snapshot) ? this.snapshot : undefined;
  }

  private activeWorldSnapshot(runId: string): ActiveWorldSnapshot | undefined {
    return isActiveWorldSnapshot(this.snapshot) && this.snapshot.activeRunId === runId ? this.snapshot : undefined;
  }

  private reportRunnerUnavailable(runId: string): void {
    const snapshot = this.activeWorldSnapshot(runId);
    if (snapshot === undefined) return;
    this.replaceSnapshot({
      ...snapshot,
      activeRunId: undefined,
      runnerState: "unavailable",
      feedback: errorFeedback("Python Runner 不可用", ["本地 Python Runner 不可用。启动 Runner 后刷新页面。"], "program"),
      diagnostics: [],
    });
  }

  private async connectRunner(): Promise<void> {
    try {
      await this.dependencies.runner.connect();
      this.updateRunnerState(this.dependencies.runner.state);
    } catch (error) {
      if (!isActiveWorldSnapshot(this.snapshot)) return;
      this.replaceSnapshot({
        ...this.snapshot,
        runnerState: "unavailable",
        feedback: errorFeedback("Python Runner 不可用", [error instanceof Error ? error.message : "本地 Python Runner 不可用。"], "program"),
        diagnostics: [],
      });
    }
  }

  private updateRunnerState(runnerState: RunnerDisplayState): void {
    if (isActiveWorldSnapshot(this.snapshot)) this.replaceSnapshot({ ...this.snapshot, runnerState });
  }

  private replaceSnapshot(snapshot: ControllerSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}

function resolvePlayerCommand(
  level: LevelDefinition,
  state: BattleState,
  input: unknown,
) {
  if (!isTurnCommand(input)) return resolveTurn(state, input);
  const levelValidation = validateLevelCommand(level, state, input);
  if (!levelValidation.accepted) return { accepted: false as const, errors: levelValidation.errors, state };
  return resolveTurn(state, levelValidation.command);
}

function isTurnCommand(value: unknown): value is TurnCommand {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && "actorId" in value && "expectedRevision" in value && "action" in value
    && value.action !== null && typeof value.action === "object" && "type" in value.action;
}

function activeUnit(state: BattleState) {
  return state.units.find((unit) => unit.id === state.turnOrder[state.turnIndex]);
}

function isActiveWorldSnapshot(snapshot: ControllerSnapshot): snapshot is ActiveWorldSnapshot {
  return snapshot.mode === "exploration" || snapshot.mode === "battle";
}

function canRun(snapshot: ActiveWorldSnapshot): boolean {
  return snapshot.runnerState === "ready"
    && snapshot.activeRunId === undefined
    && (snapshot.mode === "exploration" || snapshot.battleState.phase === "in_progress");
}

function createId(): string {
  return globalThis.crypto.randomUUID();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
