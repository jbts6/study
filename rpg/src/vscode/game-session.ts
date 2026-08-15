import type { AppSnapshot, GameSnapshot } from "../app/app-controller";
import type {
  BattleViewSnapshot,
  ExplorationViewSnapshot,
  RecoveryViewSnapshot,
  ExtensionMessage,
  ThemePreference,
  WebviewCommand,
  WebviewSnapshot,
} from "./messages";
import type {
  ControllerSnapshot,
  GameController,
  WorldBattleSnapshot,
  WorldExplorationSnapshot,
} from "../app/controller-types";
import { getLevel } from "../game/content/levels";
import type { LevelDefinition, LevelId } from "../game/content/types";
import type { CampaignDefinition } from "../programs/types";
import type { RunnerDiagnostic } from "../runners/protocol/types";
import { RESET_CONFIRMATION } from "../app/save-store";

export type SessionWorkspace = Readonly<{
  ensureLevelFiles(): Promise<void>;
  readLevelCode(levelId: LevelId): Promise<string>;
  openLevel(levelId: LevelId): Promise<unknown>;
}>;

export type SessionDiagnostics = Readonly<{
  clear(): void;
  replace(levelId: LevelId, diagnostics: readonly RunnerDiagnostic[]): void;
}>;

type GameSessionDependencies = Readonly<{
  controller: GameController;
  workspace: SessionWorkspace;
  postMessage(message: ExtensionMessage): PromiseLike<boolean | void> | boolean | void;
  getTheme(): ThemePreference;
  setTheme(theme: ThemePreference): PromiseLike<void> | void;
  diagnostics: SessionDiagnostics;
}>;

export class GameSession {
  private unsubscribe?: () => void;
  private snapshot: ControllerSnapshot;
  private openedLevelId?: LevelId;

  constructor(private readonly dependencies: GameSessionDependencies) {
    this.snapshot = dependencies.controller.getSnapshot();
  }

  async start(): Promise<void> {
    await this.dependencies.workspace.ensureLevelFiles();
    await this.dependencies.controller.start();
    this.snapshot = this.dependencies.controller.getSnapshot();
    assertCampaignSnapshot(this.snapshot, this.dependencies.controller.campaign);
    let readyForDocumentChanges = false;
    this.unsubscribe = this.dependencies.controller.subscribe((snapshot) => {
      assertCampaignSnapshot(snapshot, this.dependencies.controller.campaign);
      this.snapshot = snapshot;
      if (readyForDocumentChanges) {
        void this.publish(snapshot);
        void this.openSnapshotDocument(snapshot);
      }
    });
    await this.openSnapshotDocument(this.snapshot);
    readyForDocumentChanges = true;
    await this.publish(this.snapshot);
  }

  async handle(command: WebviewCommand): Promise<void> {
    switch (command.type) {
      case "ready":
        await this.publish(this.snapshot);
        return;
      case "runTurn": {
        const levelId = snapshotDocumentId(this.snapshot);
        if (levelId === undefined) return;
        this.dependencies.diagnostics.clear();
        const code = await this.dependencies.workspace.readLevelCode(levelId);
        await this.dependencies.controller.runCode(code);
        return;
      }
      case "interruptRun":
        await this.dependencies.controller.interrupt();
        return;
      case "retryLevel":
        this.dependencies.diagnostics.clear();
        this.dependencies.controller.retryLevel();
        return;
      case "advanceLevel":
        this.dependencies.diagnostics.clear();
        this.dependencies.controller.advanceLevel();
        return;
      case "resetCampaign":
        this.dependencies.diagnostics.clear();
        this.dependencies.controller.resetSave(RESET_CONFIRMATION);
        return;
      case "setTheme":
        await this.dependencies.setTheme(command.theme);
        await this.publish(this.snapshot);
        return;
    }
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private async publish(snapshot: ControllerSnapshot): Promise<void> {
    const campaign = this.dependencies.controller.campaign;
    assertCampaignSnapshot(snapshot, campaign);
    const levelId = snapshotDocumentId(snapshot);
    if (levelId !== undefined && hasDiagnostics(snapshot) && snapshot.diagnostics.length > 0) {
      this.dependencies.diagnostics.replace(levelId, snapshot.diagnostics);
    }
    await this.dependencies.postMessage({
      type: "snapshot",
      snapshot: toViewSnapshot(
        snapshot,
        this.dependencies.getTheme(),
        campaign,
        await this.recoveryCodeDraft(snapshot),
      ),
    });
  }

  private async recoveryCodeDraft(snapshot: ControllerSnapshot): Promise<string | undefined> {
    if (snapshot.mode !== "world_recovery" || snapshot.reason !== "legacy_v2") return undefined;
    if (snapshot.legacyCodeDraft !== undefined) return snapshot.legacyCodeDraft;
    if (snapshot.legacyLevelId === undefined) return undefined;
    try {
      return await this.dependencies.workspace.readLevelCode(snapshot.legacyLevelId);
    } catch {
      return undefined;
    }
  }

  private async openSnapshotDocument(snapshot: ControllerSnapshot): Promise<void> {
    const levelId = snapshotDocumentId(snapshot);
    if (levelId === undefined || levelId === this.openedLevelId) return;
    this.openedLevelId = levelId;
    await this.dependencies.workspace.openLevel(levelId);
  }
}

function toViewSnapshot(
  snapshot: ControllerSnapshot,
  theme: ThemePreference,
  campaign: CampaignDefinition,
  legacyCodeDraft?: string,
): WebviewSnapshot {
  switch (snapshot.mode) {
    case "save_recovery":
      return recoveryViewSnapshot(theme, "corrupt", snapshot.message);
    case "world_recovery":
      return recoveryViewSnapshot(theme, snapshot.reason, snapshot.message, legacyCodeDraft);
    case "exploration":
      return explorationViewSnapshot(snapshot, theme, campaign);
    case "battle":
      return battleViewSnapshot(snapshot, theme, campaign);
    case "game":
      return gameViewSnapshot(snapshot, theme, campaign);
  }
}

function explorationViewSnapshot(
  snapshot: WorldExplorationSnapshot,
  theme: ThemePreference,
  campaign: CampaignDefinition,
): ExplorationViewSnapshot {
  return {
    mode: "exploration",
    theme,
    campaignTitle: campaign.title,
    languageLabel: "Python",
    playerFileName: campaign.program.sourceFileName(snapshot.gameState.chapterId),
    chapterId: snapshot.gameState.chapterId,
    ...snapshot.worldView,
    runnerState: snapshot.runnerState,
    feedback: snapshot.feedback,
    ...(snapshot.activeRunId === undefined ? {} : { activeRunId: snapshot.activeRunId }),
  };
}

function battleViewSnapshot(
  snapshot: WorldBattleSnapshot,
  theme: ThemePreference,
  campaign: CampaignDefinition,
): BattleViewSnapshot {
  return {
    mode: "battle",
    theme,
    campaignTitle: campaign.title,
    languageLabel: "Python",
    playerFileName: campaign.program.sourceFileName(snapshot.battleLevelId),
    level: campaignLevel(campaign, snapshot.battleLevelId),
    battleState: snapshot.battleState,
    runnerState: snapshot.runnerState,
    feedback: snapshot.feedback,
    ...(campaign.program.reference === undefined ? {} : { programReference: campaign.program.reference }),
    ...(snapshot.activeRunId === undefined ? {} : { activeRunId: snapshot.activeRunId }),
  };
}

function gameViewSnapshot(snapshot: GameSnapshot, theme: ThemePreference, campaign: CampaignDefinition): BattleViewSnapshot {
  return {
    mode: "battle",
    theme,
    campaignTitle: campaign.title,
    languageLabel: campaign.program.language === "python" ? "Python" : "Go",
    playerFileName: campaign.program.sourceFileName(snapshot.currentLevelId),
    level: campaignLevel(campaign, snapshot.currentLevelId),
    battleState: snapshot.battleState,
    runnerState: snapshot.runnerState,
    feedback: snapshot.feedback,
    ...(campaign.program.reference === undefined ? {} : { programReference: campaign.program.reference }),
    ...(snapshot.activeRunId === undefined ? {} : { activeRunId: snapshot.activeRunId }),
  };
}

function recoveryViewSnapshot(
  theme: ThemePreference,
  reason: RecoveryViewSnapshot["reason"],
  message: string,
  legacyCodeDraft?: string,
): RecoveryViewSnapshot {
  return {
    mode: "recovery",
    theme,
    reason,
    message,
    canReset: true,
    ...(legacyCodeDraft === undefined ? {} : { legacyCodeDraft }),
  };
}

function assertCampaignSnapshot(snapshot: ControllerSnapshot, campaign: CampaignDefinition): void {
  if (snapshot.mode === "game") campaignLevel(campaign, snapshot.currentLevelId);
  if (snapshot.mode === "exploration") campaignLevel(campaign, snapshot.gameState.chapterId as LevelId);
  if (snapshot.mode === "battle") campaignLevel(campaign, snapshot.battleLevelId);
}

function campaignLevel(campaign: CampaignDefinition, levelId: LevelId): LevelDefinition {
  if (!campaign.levelOrder.includes(levelId)) throw new Error(`关卡不属于当前战役: ${levelId}`);
  return getLevel(levelId);
}

function snapshotDocumentId(snapshot: ControllerSnapshot): LevelId | undefined {
  if (snapshot.mode === "game") return snapshot.currentLevelId;
  if (snapshot.mode === "exploration") return snapshot.gameState.chapterId as LevelId;
  if (snapshot.mode === "battle") return snapshot.battleLevelId;
  return undefined;
}

function hasDiagnostics(
  snapshot: ControllerSnapshot,
): snapshot is AppSnapshot & { diagnostics: readonly RunnerDiagnostic[] }
  | WorldExplorationSnapshot
  | WorldBattleSnapshot {
  return snapshot.mode === "game" || snapshot.mode === "exploration" || snapshot.mode === "battle";
}
