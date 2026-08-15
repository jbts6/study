import type { CampaignId } from "../../programs/types";
import type { BattleState } from "../combat/types";

export type WorldFlagValue = boolean | number | string;
export type ItemState = Readonly<{ id: string; amount: number }>;
export type QuestState = Readonly<{
  id: string;
  status: "locked" | "active" | "completed";
  stepId: string;
}>;
export type ActiveBattle = Readonly<{ encounterId: string; state: BattleState }>;

export type GameState = Readonly<{
  campaignId: CampaignId;
  chapterId: string;
  locationId: string;
  revision: number;
  worldFlags: Readonly<Record<string, WorldFlagValue>>;
  inventory: readonly ItemState[];
  quests: readonly QuestState[];
  discoveredClues: readonly string[];
  battle: ActiveBattle | null;
}>;

export type CampaignWorldView = Readonly<{
  revision: number;
  location: Readonly<{ id: string; name: string; weather?: string }>;
  npcs: readonly Readonly<{ id: string; name: string; role: string; mood: string }>[];
  objects: readonly Readonly<{
    id: string;
    type: string;
    status: string;
    requiredItems: readonly string[];
  }>[];
  inventory: readonly ItemState[];
  quests: readonly QuestState[];
  availableTravel: readonly string[];
}>;

export type WorldCommand =
  | Readonly<{ expectedRevision: number; type: "inspect"; targetId: string }>
  | Readonly<{ expectedRevision: number; type: "talk"; targetId: string }>
  | Readonly<{ expectedRevision: number; type: "collect"; targetId: string }>
  | Readonly<{ expectedRevision: number; type: "use"; itemId: string; targetId: string }>
  | Readonly<{ expectedRevision: number; type: "travel"; locationId: string }>
  | Readonly<{ expectedRevision: number; type: "prepareBattle"; encounterId: string }>;

export type WorldCommandErrorCode =
  | "INVALID_COMMAND"
  | "UNKNOWN_FIELD"
  | "EXPECTED_REVISION_MISMATCH"
  | "INVALID_TARGET"
  | "TASK_CONDITION_UNMET"
  | "ITEM_UNAVAILABLE"
  | "ITEM_MISSING"
  | "TRAVEL_LOCKED"
  | "BATTLE_ACTIVE";

export type WorldCommandError = Readonly<{
  code: WorldCommandErrorCode;
  path: string;
  message: string;
}>;

export type WorldCommandValidation =
  | Readonly<{ accepted: true; command: WorldCommand }>
  | Readonly<{ accepted: false; errors: readonly WorldCommandError[] }>;
