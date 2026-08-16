import type { BattleState } from "../../combat/types";
import type { GameState, WorldFlagValue } from "../../world/campaign-types";
import type { LevelId } from "../shared/types";

export type FlagRequirements = Readonly<Record<string, WorldFlagValue>>;

export type QuestStep = Readonly<{
  stepId: string;
  accept: Readonly<{
    type: "talk" | "inspect" | "collect" | "use" | "travel" | "prepareBattle";
    targetId?: string;
    itemId?: string;
    encounterId?: string;
    targetFromState?: (state: Readonly<GameState>) => string;
  }>;
  effects: Readonly<{
    flags?: Readonly<Record<string, WorldFlagValue>>;
    addClue?: string;
    advanceTo: string;
    enterBattle?: string;
    switchChapter?: string;
  }>;
}>;

export type ChapterVictory = Readonly<{
  returnLocationId: string;
  setFlags?: Readonly<Record<string, WorldFlagValue>>;
  reportStep?: string;
  campaignComplete?: boolean;
}>;

export type ChapterDefinition = Readonly<{
  id: string;
  questId: string;
  startLocationId: string;
  locationIds: readonly string[];
  encounterIds: readonly string[];
  questChain: readonly QuestStep[];
  victory: ChapterVictory;
}>;
export type LocationDefinition = Readonly<{
  id: string;
  name: string;
  weather?: string;
  connectedLocationIds: readonly string[];
  npcIds: readonly string[];
  objectIds: readonly string[];
  itemSourceIds: readonly string[];
  travelRequirements?: Readonly<Record<string, FlagRequirements>>;
}>;
export type NpcDefinition = Readonly<{ id: string; name: string; role: string; mood: string }>;
export type WorldObjectDefinition = Readonly<{
  id: string;
  type: string;
  initialStatus: string;
  requiredItemId?: string;
}>;
export type ItemSourceDefinition = Readonly<{
  id: string;
  itemId: string;
  name: string;
  amount: number;
  requiredFlags: FlagRequirements;
}>;
export type EncounterDefinition = Readonly<{
  id: string;
  battleLevelId: LevelId;
  battleId: string;
  initialBattle: BattleState;
  prerequisiteFlags: FlagRequirements;
}>;
export type WorldCampaignContent = Readonly<{
  chapters: Readonly<Record<string, ChapterDefinition>>;
  locations: Readonly<Record<string, LocationDefinition>>;
  npcs: Readonly<Record<string, NpcDefinition>>;
  objects: Readonly<Record<string, WorldObjectDefinition>>;
  itemSources: Readonly<Record<string, ItemSourceDefinition>>;
  encounters: Readonly<Record<string, EncounterDefinition>>;
}>;
