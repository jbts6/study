import type { BattleState, Skill } from "../combat/types";

export type LevelId =
  | "python-marsh-01"
  | "python-marsh-02"
  | "python-marsh-03"
  | "python-marsh-04"
  | "python-marsh-05"
  | "python-marsh-06";

export type AbilityId = "ward" | "pierce" | "renew" | "fracture" | "aegis";

export type EnemyBehaviorSpec =
  | Readonly<{ type: "corrupt" }>
  | Readonly<{ type: "hunt-player" }>
  | Readonly<{ type: "guard" }>;

export type LevelReward =
  | Readonly<{ type: "ability"; abilityId: AbilityId }>
  | Readonly<{ type: "campaign-complete" }>;

export type LevelGuidance = Readonly<{
  objective: readonly string[];
  concepts: readonly string[];
  worldFields: readonly string[];
  commandExamples: readonly string[];
  levelRules: readonly string[];
}>;

export type LevelDefinition = Readonly<{
  id: LevelId;
  title: string;
  briefing: readonly string[];
  starterCode: string;
  guidance: LevelGuidance;
  initialBattle: BattleState;
  enemyBehaviors: Readonly<Record<string, EnemyBehaviorSpec>>;
  reward: LevelReward;
}>;

export type AbilityCatalog = Readonly<Record<AbilityId, Skill>>;
