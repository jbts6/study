import type { AppFeedback } from "../app/app-controller";
import type { RunnerDisplayState } from "../app/runner-client";
import type { BattleState } from "../game/combat/types";
import type { LevelDefinition } from "../game/content/types";

export type ThemePreference = "light" | "dark" | "system";

export type WebviewCommand =
  | Readonly<{ type: "ready" }>
  | Readonly<{ type: "runTurn" }>
  | Readonly<{ type: "interruptRun" }>
  | Readonly<{ type: "retryLevel" }>
  | Readonly<{ type: "advanceLevel" }>
  | Readonly<{ type: "resetCampaign" }>
  | Readonly<{ type: "setTheme"; theme: ThemePreference }>;

export type GameViewSnapshot = Readonly<{
  mode: "game";
  theme: ThemePreference;
  campaignTitle: string;
  languageLabel: "Python" | "Go";
  playerFileName: string;
  level: LevelDefinition;
  battleState: BattleState;
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  activeRunId?: string;
}>;

export type RecoveryViewSnapshot = Readonly<{
  mode: "save_recovery";
  theme: ThemePreference;
  message: string;
}>;

export type WebviewSnapshot = GameViewSnapshot | RecoveryViewSnapshot;

export type ExtensionMessage =
  | Readonly<{ type: "snapshot"; snapshot: WebviewSnapshot }>
  | Readonly<{ type: "focusDiagnostic"; file: string; line: number; column: number }>;

