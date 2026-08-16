import type { AppFeedback } from "../app/app-controller";
import type { RunnerDisplayState } from "../app/runner-client";
import type { BattleEvent, BattleState } from "../game/combat/types";
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
  | Readonly<{ type: "switchChapter"; chapterId: string }>
  | Readonly<{ type: "setTheme"; theme: ThemePreference }>;

export type ChapterOption = Readonly<{ id: string; title: string }>;

export type ExplorationViewSnapshot = Readonly<{
  mode: "exploration";
  theme: ThemePreference;
  campaignTitle: string;
  languageLabel: "Python";
  playerFileName: string;
  chapterId: string;
  chapters: readonly ChapterOption[];
  location: CampaignWorldView["location"];
  npcs: CampaignWorldView["npcs"];
  objects: CampaignWorldView["objects"];
  inventory: CampaignWorldView["inventory"];
  quests: CampaignWorldView["quests"];
  availableTravel: CampaignWorldView["availableTravel"];
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
  battleLog: readonly BattleEvent[];
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
  legacyCodeDraft?: string;
  canReset: true;
}>;

export type WebviewSnapshot = ExplorationViewSnapshot | BattleViewSnapshot | RecoveryViewSnapshot;

export type ExtensionMessage =
  | Readonly<{ type: "snapshot"; snapshot: WebviewSnapshot }>
  | Readonly<{ type: "focusDiagnostic"; file: string; line: number; column: number }>;

