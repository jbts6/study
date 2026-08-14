import type { BattleState, BattleUnit, Skill } from "../combat/types";
import type { AbilityCatalog, AbilityId, LevelId } from "./types";

export const ABILITY_CATALOG: AbilityCatalog = {
  ward: {
    id: "ward",
    range: 0,
    power: 1,
    cooldown: 1,
    remainingCooldown: 0,
    target: "unit",
    kind: "heal",
    effect: { statusId: "ward", duration: 1, defenseBonus: 2 },
  },
  pierce: {
    id: "pierce",
    range: 1,
    power: 4,
    cooldown: 2,
    remainingCooldown: 0,
    target: "unit",
    kind: "damage",
  },
  renew: {
    id: "renew",
    range: 0,
    power: 5,
    cooldown: 2,
    remainingCooldown: 0,
    target: "unit",
    kind: "heal",
  },
  fracture: {
    id: "fracture",
    range: 1,
    power: 1,
    cooldown: 2,
    remainingCooldown: 0,
    target: "unit",
    kind: "damage",
    effect: { statusId: "fracture", duration: 2, defenseBonus: -2 },
  },
  aegis: {
    id: "aegis",
    range: 0,
    power: 3,
    cooldown: 2,
    remainingCooldown: 0,
    target: "unit",
    kind: "heal",
    effect: { statusId: "aegis", duration: 2, defenseBonus: 2 },
  },
};

const LEVEL_UNLOCKS: Readonly<Record<LevelId, readonly AbilityId[]>> = {
  "python-marsh-01": [],
  "python-marsh-02": ["ward"],
  "python-marsh-03": ["ward", "pierce"],
  "python-marsh-04": ["ward", "pierce", "renew"],
  "python-marsh-05": ["ward", "pierce", "renew", "fracture"],
  "python-marsh-06": ["ward", "pierce", "renew", "fracture", "aegis"],
  "go-marsh-01": [],
  "go-marsh-02": ["ward"],
  "go-marsh-03": ["ward", "pierce"],
  "go-marsh-04": ["ward", "pierce", "renew"],
  "go-marsh-05": ["ward", "pierce", "renew", "fracture"],
  "go-marsh-06": ["ward", "pierce", "renew", "fracture", "aegis"],
};

function copySkill(skill: Skill): Skill {
  return skill.effect === undefined ? { ...skill } : { ...skill, effect: { ...skill.effect } };
}

function injectIntoScout(unit: BattleUnit, unlockedAbilityIds: readonly AbilityId[]): BattleUnit {
  const existingIds = new Set(unit.skills.map((skill) => skill.id));
  const additions = unlockedAbilityIds
    .filter((abilityId) => !existingIds.has(abilityId))
    .map((abilityId) => copySkill(ABILITY_CATALOG[abilityId]));
  return additions.length === 0 ? unit : { ...unit, skills: [...unit.skills, ...additions] };
}

/** Adds the rewards earned before a level to scout without mutating the battle snapshot. */
export function injectUnlockedAbilities(levelId: LevelId, battleState: BattleState): BattleState {
  const unlockedAbilityIds = LEVEL_UNLOCKS[levelId] ?? [];
  const scout = battleState.units.find((unit) => unit.id === "scout" && unit.team === "allies");
  if (scout === undefined || unlockedAbilityIds.length === 0) return battleState;

  const nextScout = injectIntoScout(scout, unlockedAbilityIds);
  if (nextScout === scout) return battleState;
  return {
    ...battleState,
    units: battleState.units.map((unit) => unit.id === scout.id ? nextScout : unit),
  };
}
