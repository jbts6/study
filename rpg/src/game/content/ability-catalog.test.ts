import { describe, expect, it } from "vitest";
import type { LevelId } from "./types";
import { createFixtureState } from "../testing/fixture";
import { ABILITY_CATALOG, injectUnlockedAbilities } from "./ability-catalog";

describe("ABILITY_CATALOG", () => {
  it("defines the five campaign rewards with the specified skill fields", () => {
    expect(ABILITY_CATALOG).toEqual({
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
    });
  });

  it("injects only previously earned abilities into scout in campaign order", () => {
    const expectedSkillsByLevel: Readonly<Record<string, readonly string[]>> = {
      "python-marsh-01": ["spark", "mend"],
      "python-marsh-02": ["spark", "mend", "ward"],
      "python-marsh-03": ["spark", "mend", "ward", "pierce"],
      "python-marsh-04": ["spark", "mend", "ward", "pierce", "renew"],
      "python-marsh-05": ["spark", "mend", "ward", "pierce", "renew", "fracture"],
      "python-marsh-06": ["spark", "mend", "ward", "pierce", "renew", "fracture", "aegis"],
      "go-marsh-01": ["spark", "mend"],
      "go-marsh-02": ["spark", "mend", "ward"],
      "go-marsh-03": ["spark", "mend", "ward", "pierce"],
    };

    for (const [levelId, expectedSkillIds] of Object.entries(expectedSkillsByLevel)) {
      const state = injectUnlockedAbilities(levelId as LevelId, createFixtureState());
      expect(state.units.find((unit) => unit.id === "scout")?.skills.map((skill) => skill.id)).toEqual(expectedSkillIds);
      expect(state.units.find((unit) => unit.id === "golem")?.skills.map((skill) => skill.id)).toEqual(["smash"]);
    }
  });

  it("does not mutate or duplicate already injected abilities", () => {
    const initial = createFixtureState();
    const injected = injectUnlockedAbilities("python-marsh-05", initial);
    const repeated = injectUnlockedAbilities("python-marsh-05", injected);

    expect(initial.units.find((unit) => unit.id === "scout")?.skills.map((skill) => skill.id)).toEqual(["spark", "mend"]);
    expect(repeated.units.find((unit) => unit.id === "scout")?.skills.map((skill) => skill.id)).toEqual([
      "spark",
      "mend",
      "ward",
      "pierce",
      "renew",
      "fracture",
    ]);
    expect(repeated.units.find((unit) => unit.id === "scout")?.skills.filter((skill) => skill.id === "ward")).toHaveLength(1);
  });
});
