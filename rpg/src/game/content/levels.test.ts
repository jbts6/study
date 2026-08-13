import { describe, expect, it } from "vitest";
import { getLevel, getNextLevelId, LEVEL_ORDER, validateLevels } from "./levels";

describe("campaign levels", () => {
  it("registers all six levels in their fixed campaign order", () => {
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
    expect(getLevel("python-marsh-04").reward).toEqual({ type: "ability", abilityId: "fracture" });
    expect(getLevel("python-marsh-05").reward).toEqual({ type: "ability", abilityId: "aegis" });
    expect(getLevel("python-marsh-06").reward).toEqual({ type: "campaign-complete" });
    expect(getNextLevelId("python-marsh-01")).toBe("python-marsh-02");
    expect(getNextLevelId("python-marsh-03")).toBe("python-marsh-04");
    expect(getNextLevelId("python-marsh-05")).toBe("python-marsh-06");
    expect(getNextLevelId("python-marsh-06")).toBeUndefined();
  });

  it("makes lesson scaffolding progressively less prescriptive", () => {
    const first = getLevel("python-marsh-01");
    const second = getLevel("python-marsh-02");
    const third = getLevel("python-marsh-03");
    const fourth = getLevel("python-marsh-04");
    const fifth = getLevel("python-marsh-05");
    const sixth = getLevel("python-marsh-06");

    expect(first.starterCode).toContain("def choose_turn");
    expect(first.starterCode).toContain('"movePath": [{"x": 1, "y": 0}, {"x": 1, "y": 1}]');
    expect(first.starterCode).toContain("movePath 是顶层字段");
    expect(first.starterCode).toContain("不是 [[1, 0]]");
    expect(first.starterCode).toContain('"action": {"type": "attack", "targetId": "golem"}');
    expect(first.starterCode).toContain('"action": {"type": "cast", "skillId": "spark", "targetId": "golem"}');
    expect(first.guidance.commandExamples.some((hint) => hint.includes("坐标对象数组"))).toBe(true);
    expect(first.guidance.commandExamples.some((hint) => hint.includes('不能写成 [[1, 0], [2, 0]]'))).toBe(true);
    expect(first.guidance.commandExamples.some((hint) => hint.includes('"attack"'))).toBe(true);
    expect(first.guidance.commandExamples.some((hint) => hint.includes('skillId') && hint.includes('targetId'))).toBe(true);
    expect(second.starterCode).toContain("if ");
    expect(third.starterCode).not.toContain("def choose_turn");
    expect(third.starterCode).toContain('world["units"]');
    expect(fourth.starterCode).toMatch(/example\s*=\s*\w+\s+and\s+\(\w+\s+or\s+not\s+\w+\)/);
    expect(fourth.starterCode).not.toContain("def choose_turn");
    expect(fifth.starterCode).toContain("辅助函数");
    expect(fifth.starterCode).not.toContain("def choose_turn");
    expect(sixth.starterCode).toContain("world");
    expect(sixth.starterCode).not.toMatch(/条件分支|遍历筛选|辅助函数/);
    expect(sixth.starterCode).not.toContain("def choose_turn");
    expect(sixth.guidance.worldFields.length).toBeGreaterThan(0);
  });

  it("provides structured guidance for every campaign lesson", () => {
    for (const levelId of LEVEL_ORDER) {
      const guidance = getLevel(levelId).guidance;
      for (const group of [
        guidance.objective,
        guidance.concepts,
        guidance.worldFields,
        guidance.commandExamples,
        guidance.levelRules,
      ]) {
        expect(group.length).toBeGreaterThan(0);
        expect(group.every((entry) => entry.trim().length > 0)).toBe(true);
      }
    }

    expect(getLevel("python-marsh-02").guidance.concepts.join(" ")).toContain("if");
    expect(getLevel("python-marsh-03").guidance.concepts.join(" ")).toContain("for");
    expect(getLevel("python-marsh-04").guidance.concepts.join(" ")).toContain("and、or、not");
    expect(getLevel("python-marsh-05").guidance.concepts.join(" ")).toContain("辅助函数");
    const finale = getLevel("python-marsh-06").guidance;
    expect(finale.worldFields.join(" ")).toContain('world["units"]');
    expect(finale.commandExamples.join(" ")).toContain('"action"');
    expect(finale.levelRules.join(" ")).not.toMatch(/先.*再.*最后/);
  });

  it("keeps levels three through six guidance self-contained and aligned with unlocked abilities", () => {
    for (const levelId of LEVEL_ORDER.slice(2)) {
      const level = getLevel(levelId);
      const guidance = level.guidance;
      const worldFields = guidance.worldFields.join(" ");
      const commandExamples = guidance.commandExamples.join(" ");

      expect(level.starterCode, levelId).toContain('world["activeUnitId"]');
      expect(level.starterCode, levelId).toContain('world["revision"]');
      expect(level.starterCode, levelId).toContain('"actorId"');
      expect(level.starterCode, levelId).toContain('"expectedRevision"');
      expect(level.starterCode, levelId).toContain('"movePath"');
      expect(level.starterCode, levelId).toContain('"action"');
      expect(worldFields, levelId).toContain('world["activeUnitId"]');
      expect(worldFields, levelId).toContain('world["revision"]');
      expect(worldFields, levelId).toContain('world["units"]');
      expect(worldFields, levelId).toContain('world["objectives"]');
      expect(commandExamples, levelId).toContain('"actorId"');
      expect(commandExamples, levelId).toContain('"expectedRevision"');
      expect(commandExamples, levelId).toContain('"movePath"');
      expect(commandExamples, levelId).toContain('"action"');
    }

    const third = getLevel("python-marsh-03").guidance;
    expect(third.commandExamples.join(" ")).toContain('"scout-mark"');
    expect(third.levelRules.join(" ")).toContain("未激活印记");

    const fourth = getLevel("python-marsh-04").guidance;
    expect(fourth.commandExamples.join(" ")).toContain('"movePath": [{"x": 1, "y": 0}]');
    expect(fourth.commandExamples.join(" ")).not.toContain('"movePath": [{"x": 1, "y": 1}]');
    expect(fourth.commandExamples.join(" ")).toContain('"pierce"');
    expect(fourth.commandExamples.join(" ")).toContain('"renew"');
    expect(fourth.commandExamples.join(" ")).not.toContain('"fracture"');

    const fifth = getLevel("python-marsh-05").guidance;
    expect(fifth.commandExamples.join(" ")).toContain('"node-a"');
    expect(fifth.commandExamples.join(" ")).toContain('"node-b"');
    expect(fifth.commandExamples.join(" ")).toContain('"fracture"');

    const sixth = getLevel("python-marsh-06").guidance;
    expect(sixth.commandExamples.join(" ")).toContain('"final-seal"');
    expect(sixth.commandExamples.join(" ")).toContain('"aegis"');
    expect(sixth.commandExamples.join(" ")).toContain("面对敌人攻击前");
    expect(sixth.commandExamples.join(" ")).not.toContain("进入危险区域前");
    expect(sixth.levelRules.join(" ")).toContain("危险格造成 1 点伤害");
    expect(sixth.levelRules.join(" ")).toContain("18 回合");
  });

  it("keeps every level fully referenced and rewards abilities in campaign order", () => {
    const rewards = LEVEL_ORDER.map((levelId) => getLevel(levelId).reward);
    expect(rewards).toEqual([
      { type: "ability", abilityId: "ward" },
      { type: "ability", abilityId: "pierce" },
      { type: "ability", abilityId: "renew" },
      { type: "ability", abilityId: "fracture" },
      { type: "ability", abilityId: "aegis" },
      { type: "campaign-complete" },
    ]);

    for (const levelId of LEVEL_ORDER) {
      const level = getLevel(levelId);
      expect(level.initialBattle.battleId).toBe(level.id);
      expect(level.initialBattle.turnOrder.every((unitId) => level.initialBattle.units.some((unit) => unit.id === unitId))).toBe(true);
      for (const unitId of Object.keys(level.enemyBehaviors)) {
        expect(level.initialBattle.units.find((unit) => unit.id === unitId)?.team).toBe("enemies");
      }
      const keyObjectives = level.initialBattle.objectives.filter((objective) => objective.key);
      expect(keyObjectives).toHaveLength(level.initialBattle.failureConditions.keyObjectiveDestroyed ? 1 : 0);
      expect(keyObjectives.every((objective) => objective.durability > 0 && !objective.completed)).toBe(true);
      expect(level.initialBattle.units.find((unit) => unit.id === "scout")?.team).toBe("allies");
    }
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
