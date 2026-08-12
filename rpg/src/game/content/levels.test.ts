import { describe, expect, it } from "vitest";
import { getLevel, getNextLevelId, LEVEL_ORDER, validateLevels } from "./levels";

describe("campaign levels", () => {
  it("registers the first three levels in their fixed campaign order", () => {
    expect(LEVEL_ORDER).toEqual([
      "python-marsh-01",
      "python-marsh-02",
      "python-marsh-03",
      "python-marsh-04",
      "python-marsh-05",
      "python-marsh-06",
    ]);
    expect(getLevel("python-marsh-01").reward).toEqual({ type: "ability", abilityId: "ward" });
    expect(getLevel("python-marsh-02").reward).toEqual({ type: "ability", abilityId: "pierce" });
    expect(getLevel("python-marsh-03").reward).toEqual({ type: "ability", abilityId: "renew" });
    expect(getNextLevelId("python-marsh-01")).toBe("python-marsh-02");
    expect(getNextLevelId("python-marsh-03")).toBe("python-marsh-04");
  });

  it("makes lesson scaffolding progressively less prescriptive", () => {
    const first = getLevel("python-marsh-01");
    const second = getLevel("python-marsh-02");
    const third = getLevel("python-marsh-03");

    expect(first.starterCode).toContain("def choose_turn");
    expect(second.starterCode).toContain("if ");
    expect(third.starterCode).not.toContain("def choose_turn");
    expect(third.starterCode).toContain('world["units"]');
  });

  it("rejects duplicate ids and invalid unit, objective, and ability references", () => {
    const first = getLevel("python-marsh-01");
    const missingUnit = {
      ...first,
      enemyBehaviors: { missing: { type: "corrupt" as const } },
    };
    const missingTarget = {
      ...first,
      initialBattle: { ...first.initialBattle, objectives: [] },
    };
    const missingAbility = {
      ...first,
      reward: { type: "ability" as const, abilityId: "missing" as never },
    };

    expect(() => validateLevels([first, first])).toThrow("关卡 ID 重复");
    expect(() => validateLevels([missingUnit])).toThrow("引用不存在的单位");
    expect(() => validateLevels([missingTarget])).toThrow("引用不存在的目标");
    expect(() => validateLevels([missingAbility])).toThrow("引用不存在的能力");
  });
});
