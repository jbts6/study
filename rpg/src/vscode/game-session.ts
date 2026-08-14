import type { AppController, AppSnapshot, GameSnapshot } from "../app/app-controller";
import { getLevel } from "../game/content/levels";
import type { LevelDefinition, LevelId } from "../game/content/types";
import type { CampaignDefinition } from "../programs/types";
import type { RunnerDiagnostic } from "../runners/protocol/types";
import { RESET_CONFIRMATION } from "../app/save-store";
import type { ExtensionMessage, ThemePreference, WebviewCommand, WebviewSnapshot } from "./messages";

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
  controller: AppController;
  workspace: SessionWorkspace;
  postMessage(message: ExtensionMessage): PromiseLike<boolean | void> | boolean | void;
  getTheme(): ThemePreference;
  setTheme(theme: ThemePreference): PromiseLike<void> | void;
  diagnostics: SessionDiagnostics;
}>;

export class GameSession {
  private unsubscribe?: () => void;
  private snapshot: AppSnapshot;
  private openedLevelId?: LevelId;

  constructor(private readonly dependencies: GameSessionDependencies) {
    this.snapshot = dependencies.controller.getSnapshot();
  }

  async start(): Promise<void> {
    await this.dependencies.workspace.ensureLevelFiles();
    await this.dependencies.controller.start();
    this.snapshot = this.dependencies.controller.getSnapshot();
    assertCampaignSnapshot(this.snapshot, this.dependencies.controller.campaign);
    this.unsubscribe = this.dependencies.controller.subscribe((snapshot) => {
      assertCampaignSnapshot(snapshot, this.dependencies.controller.campaign);
      this.snapshot = snapshot;
      void this.publish(snapshot);
      if (snapshot.mode === "game" && snapshot.currentLevelId !== this.openedLevelId) {
        this.openedLevelId = snapshot.currentLevelId;
        void this.dependencies.workspace.openLevel(snapshot.currentLevelId);
      }
    });
  }

  async handle(command: WebviewCommand): Promise<void> {
    switch (command.type) {
      case "ready":
        await this.publish(this.snapshot);
        return;
      case "runTurn": {
        if (this.snapshot.mode !== "game") return;
        this.dependencies.diagnostics.clear();
        const code = await this.dependencies.workspace.readLevelCode(this.snapshot.currentLevelId);
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

  private async publish(snapshot: AppSnapshot): Promise<void> {
    const campaign = this.dependencies.controller.campaign;
    assertCampaignSnapshot(snapshot, campaign);
    if (snapshot.mode === "game" && snapshot.diagnostics.length > 0) {
      this.dependencies.diagnostics.replace(snapshot.currentLevelId, snapshot.diagnostics);
    }
    await this.dependencies.postMessage({
      type: "snapshot",
      snapshot: toViewSnapshot(snapshot, this.dependencies.getTheme(), campaign),
    });
  }
}

function toViewSnapshot(snapshot: AppSnapshot, theme: ThemePreference, campaign: CampaignDefinition): WebviewSnapshot {
  if (snapshot.mode === "save_recovery") return { ...snapshot, theme };
  return gameViewSnapshot(snapshot, theme, campaign);
}

function gameViewSnapshot(snapshot: GameSnapshot, theme: ThemePreference, campaign: CampaignDefinition): WebviewSnapshot {
  return {
    mode: "game",
    theme,
    campaignTitle: campaign.title,
    languageLabel: campaign.program.language === "python" ? "Python" : "Go",
    playerFileName: campaign.program.sourceFileName(snapshot.currentLevelId),
    level: campaignLevel(campaign, snapshot.currentLevelId),
    battleState: snapshot.battleState,
    runnerState: snapshot.runnerState,
    feedback: snapshot.feedback,
    ...(snapshot.activeRunId === undefined ? {} : { activeRunId: snapshot.activeRunId }),
  };
}

function assertCampaignSnapshot(snapshot: AppSnapshot, campaign: CampaignDefinition): void {
  if (snapshot.mode === "game") campaignLevel(campaign, snapshot.currentLevelId);
}

function campaignLevel(campaign: CampaignDefinition, levelId: LevelId): LevelDefinition {
  if (!campaign.levelOrder.includes(levelId)) throw new Error(`关卡不属于当前战役: ${levelId}`);
  return getLevel(levelId);
}
