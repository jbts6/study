import type { AppFeedback } from "../app/app-controller";
import type { RunnerDisplayState } from "../app/runner-client";
import type { BattleState } from "../game/combat/types";
import type { LevelDefinition } from "../game/content/types";
import type { CampaignWorldView } from "../game/world/campaign-types";
import type { ProgramReference } from "../programs/types";

export type ThemePreference = "light" | "dark" | "system";

export type WebviewCommand =
  | Readonly<{ type: "ready" }>
  | Readonly<{ type: "runTurn" }>
  | Readonly<{ type: "interruptRun" }>
  | Readonly<{ type: "retryLevel" }>
  | Readonly<{ type: "advanceLevel" }>
  | Readonly<{ type: "resetCampaign" }>
  | Readonly<{ type: "setTheme"; theme: ThemePreference }>;

export type ExplorationViewSnapshot = Readonly<{
  mode: "exploration";
  theme: ThemePreference;
  campaignTitle: string;
  languageLabel: "Python";
  playerFileName: string;
  chapterId: string;
  location: CampaignWorldView["location"];
  npcs: CampaignWorldView["npcs"];
  objects: CampaignWorldView["objects"];
  inventory: CampaignWorldView["inventory"];
  quests: CampaignWorldView["quests"];
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  activeRunId?: string;
}>;

export type BattleViewSnapshot = Readonly<{
  mode: "battle";
  theme: ThemePreference;
  campaignTitle: string;
  languageLabel: "Python" | "Go";
  playerFileName: string;
  level: LevelDefinition;
  battleState: BattleState;
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  programReference?: ProgramReference;
  activeRunId?: string;
}>;

export type RecoveryViewSnapshot = Readonly<{
  mode: "recovery";
  theme: ThemePreference;
  reason: "legacy_v2" | "corrupt";
  message: string;
  canReset: true;
}>;

/**
 * Legacy Webview rendering still consumes the battle-only shape until the
 * exploration renderer is introduced. The host publishes WebviewSnapshot.
 */
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
  programReference?: ProgramReference;
  activeRunId?: string;
}>;

export type WebviewSnapshot = ExplorationViewSnapshot | BattleViewSnapshot | RecoveryViewSnapshot;

export type ExtensionMessage =
  // The current Webview bundle still narrows this message to the legacy
  // battle/recovery shape; the host session supplies the discriminated union.
  | Readonly<{ type: "snapshot"; snapshot: any }>
  | Readonly<{ type: "focusDiagnostic"; file: string; line: number; column: number }>;

