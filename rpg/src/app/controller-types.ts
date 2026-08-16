import type { BattleEvent, BattleState } from "../game/combat/types";
import type { CampaignWorldView, GameState } from "../game/world/campaign-types";
import type { LevelId } from "../game/content/types";
import type { CampaignDefinition } from "../programs/types";
import type { RunnerDiagnostic } from "../runners/protocol/types";
import type { AppFeedback } from "./app-feedback";
import type { AppSnapshot } from "./app-controller";
import type { RunnerDisplayState } from "./runner-client";

export type WorldExplorationSnapshot = Readonly<{
  mode: "exploration";
  gameState: GameState;
  worldView: CampaignWorldView;
  codeDraft: string;
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  diagnostics: readonly RunnerDiagnostic[];
  activeRunId?: string;
}>;

export type WorldBattleSnapshot = Readonly<{
  mode: "battle";
  gameState: GameState;
  battleState: BattleState;
  battleLevelId: LevelId;
  battleLog: readonly BattleEvent[];
  codeDraft: string;
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  diagnostics: readonly RunnerDiagnostic[];
  activeRunId?: string;
}>;

export type WorldRecoverySnapshot = Readonly<{
  mode: "world_recovery";
  reason: "legacy_v2" | "corrupt";
  message: string;
  legacyLevelId?: LevelId;
  legacyCodeDraft?: string;
}>;

export type ControllerSnapshot = AppSnapshot | WorldExplorationSnapshot | WorldBattleSnapshot | WorldRecoverySnapshot;

export interface GameController {
  readonly campaign: CampaignDefinition;
  start(): Promise<void>;
  setCode(code: string): void;
  runCode(code: string): Promise<void>;
  interrupt(): Promise<void>;
  resetSave(confirmation: string): void;
  retryLevel(): void;
  advanceLevel(): void;
  subscribe(listener: (snapshot: ControllerSnapshot) => void): () => void;
  getSnapshot(): ControllerSnapshot;
}
