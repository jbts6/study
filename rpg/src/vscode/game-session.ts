import type { AppController, AppSnapshot, GameSnapshot } from "../app/app-controller";
import { getLevel } from "../game/content/levels";
import type { LevelId } from "../game/content/types";
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
    this.unsubscribe = this.dependencies.controller.subscribe((snapshot) => {
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
    if (snapshot.mode === "game" && snapshot.diagnostics.length > 0) {
      this.dependencies.diagnostics.replace(snapshot.currentLevelId, snapshot.diagnostics);
    }
    await this.dependencies.postMessage({ type: "snapshot", snapshot: toViewSnapshot(snapshot, this.dependencies.getTheme()) });
  }
}

function toViewSnapshot(snapshot: AppSnapshot, theme: ThemePreference): WebviewSnapshot {
  if (snapshot.mode === "save_recovery") return { ...snapshot, theme };
  return gameViewSnapshot(snapshot, theme);
}

function gameViewSnapshot(snapshot: GameSnapshot, theme: ThemePreference): WebviewSnapshot {
  return {
    mode: "game",
    theme,
    level: getLevel(snapshot.currentLevelId),
    battleState: snapshot.battleState,
    runnerState: snapshot.runnerState,
    feedback: snapshot.feedback,
    ...(snapshot.activeRunId === undefined ? {} : { activeRunId: snapshot.activeRunId }),
  };
}
