import { describe, expect, it } from "vitest";
import { getCampaign } from "./campaigns";
import { GO_LEVEL_ORDER, validateGoApiFocus } from "./go/levels";
import { getLevel, getNextLevelId, LEVEL_ORDER, validateLevels } from "./levels";
import { GO_PROGRAM } from "../../programs/go";

const EXPECTED_GO_API_FOCUS: Readonly<Record<string, readonly string[]>> = {
  "go-marsh-01": ["entrypoint.choose-turn", "type.world", "type.turn-command", "type.cell", "action.wait", "action.attack", "action.move-and-attack"],
  "go-marsh-02": ["type.unit", "type.skill", "type.board", "action.cast", "action.move-and-cast", "action.guard"],
  "go-marsh-03": ["type.objective", "action.attack", "action.interact", "action.move-and-interact"],
  "go-marsh-04": ["type.skill", "type.objective", "action.cast", "action.move-and-cast", "action.interact"],
  "go-marsh-05": ["type.unit", "type.objective", "action.cast", "action.interact", "action.move-and-attack", "action.move-and-cast", "action.move-and-interact"],
  "go-marsh-06": ["type.world", "type.cell", "type.board", "type.objective", "type.status", "type.unit", "type.skill", "type.action", "type.turn-command", "action.wait", "action.attack", "action.move-and-attack", "action.guard", "action.cast", "action.move-and-cast", "action.interact", "action.move-and-interact"],
};

const GO_REFERENCE = GO_PROGRAM.reference;
if (GO_REFERENCE === undefined) throw new Error("GO_PROGRAM.reference 未定义");

describe("campaign levels", () => {
  it("按战役隔离关卡顺序与玩家程序约定", () => {
    const campaign = getCampaign("python-rpg");
    expect(campaign.program.workspaceDirectory).toBe("python-rpg");
    expect(campaign.levelOrder).toEqual([
      "python-marsh-01", "python-marsh-02", "python-marsh-03",
      "python-marsh-04", "python-marsh-05", "python-marsh-06",
    ]);
    expect(getNextLevelId("python-marsh-06")).toBeUndefined();
  });

  it("为 Go 六关提供完整的 API 重点并引用已登记的参考条目", () => {
    const referenceIds = new Set([
      "entrypoint.choose-turn",
      ...GO_REFERENCE.sections.flatMap((section) => section.entries.map((entry) => entry.id)),
    ]);

    for (const levelId of GO_LEVEL_ORDER) {
      const apiFocus = getLevel(levelId).guidance.apiFocus;
      expect(apiFocus, levelId).toBeDefined();
      expect(apiFocus?.summary.trim(), levelId).not.toBe("");
      expect(apiFocus?.steps.length, levelId).toBeGreaterThanOrEqual(2);
      expect(apiFocus?.example.trim(), levelId).not.toBe("");
      expect(apiFocus?.referenceIds, levelId).toEqual(EXPECTED_GO_API_FOCUS[levelId]);
      expect(apiFocus?.referenceIds.every((referenceId) => referenceIds.has(referenceId)), levelId).toBe(true);
    }

    expect(getLevel("go-marsh-01").guidance.apiFocus?.example).toContain("绝对路径到 `(2, 0)` 后攻击 `golem`");
    for (const levelId of ["go-marsh-04", "go-marsh-05", "go-marsh-06"]) {
      expect(getLevel(levelId).guidance.apiFocus?.example, levelId).not.toMatch(/先.*再.*最后|逐回合/);
    }
  });

  it("Go 第一关不复用 Python 模板或战役顺序", () => {
    const first = getLevel("go-marsh-01");
    const second = getLevel("go-marsh-02");
    expect(first.starterCode).toContain("func ChooseTurn(world World) TurnCommand");
    expect(first.starterCode).not.toContain("def choose_turn");
    expect(second.starterCode).toContain("if ");
    const third = getLevel("go-marsh-03");
    const fourth = getLevel("go-marsh-04");
    const fifth = getLevel("go-marsh-05");
    const sixth = getLevel("go-marsh-06");
    expect(getCampaign("go-rpg").levelOrder).toEqual([
      "go-marsh-01", "go-marsh-02", "go-marsh-03",
      "go-marsh-04", "go-marsh-05", "go-marsh-06",
    ]);
    expect(first.initialBattle.battleId).toBe("go-marsh-01");
    expect(first.reward).toEqual({ type: "ability", abilityId: "ward" });
    expect(second.reward).toEqual({ type: "ability", abilityId: "pierce" });
    expect(third.reward).toEqual({ type: "ability", abilityId: "renew" });
    expect(fourth.reward).toEqual({ type: "ability", abilityId: "fracture" });
    expect(fifth.reward).toEqual({ type: "ability", abilityId: "aegis" });
    expect(sixth.reward).toEqual({ type: "campaign-complete" });
    expect(third.starterCode).toContain("range world.Units");
    expect(third.guidance.objective.join(" ")).toContain("scout-mark");
    expect(fourth.starterCode).toContain("RemainingCooldown");
    expect(fourth.starterCode).toContain("&&");
    expect(fourth.starterCode).toContain("||");
    expect(fourth.guidance.commandExamples.join(" ")).toContain("pierce");
    expect(fourth.guidance.commandExamples.join(" ")).toContain("renew");
    expect(fifth.starterCode).toContain("func livingEnemy");
    expect(fifth.guidance.commandExamples.join(" ")).toContain("node-a");
    expect(fifth.guidance.commandExamples.join(" ")).toContain("node-b");
    expect(fifth.guidance.commandExamples.join(" ")).toContain("fracture");
    expect(sixth.starterCode).toContain("return Wait(world)");
    expect(sixth.guidance.worldFields.join(" ")).toContain("world.Board");
    expect(sixth.guidance.commandExamples.join(" ")).toContain("aegis");
    expect(sixth.guidance.commandExamples.join(" ")).toContain("final-seal");
    expect(sixth.guidance.levelRules.join(" ")).not.toMatch(/先.*再.*最后/);
    expect(getNextLevelId("go-marsh-01")).toBe("go-marsh-02");
    expect(getNextLevelId("go-marsh-02")).toBe("go-marsh-03");
    expect(getNextLevelId("go-marsh-03")).toBe("go-marsh-04");
    expect(getNextLevelId("go-marsh-04")).toBe("go-marsh-05");
    expect(getNextLevelId("go-marsh-05")).toBe("go-marsh-06");
    expect(getNextLevelId("go-marsh-06")).toBeUndefined();
    expect(getNextLevelId("python-marsh-06")).toBeUndefined();
  });

  it("keeps Go and Python battle data aligned apart from language metadata", () => {
    const pairs = [
      ["python-marsh-02", "go-marsh-02"],
      ["python-marsh-03", "go-marsh-03"],
      ["python-marsh-04", "go-marsh-04"],
      ["python-marsh-05", "go-marsh-05"],
      ["python-marsh-06", "go-marsh-06"],
    ] as const;
    for (const [pythonId, goId] of pairs) {
      const python = getLevel(pythonId);
      const go = getLevel(goId);
      expect({ ...go.initialBattle, battleId: "<battle>", contentVersion: "<content>" }).toEqual({
        ...python.initialBattle,
        battleId: "<battle>",
        contentVersion: "<content>",
      });
      expect(go.enemyBehaviors).toEqual(python.enemyBehaviors);
    }
  });

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
    expect(first.starterCode).toContain("movePath（可选）和 action");
    expect(first.starterCode).toContain("每步正交相邻");
    expect(first.starterCode).toContain('"type": "attack"');
    expect(first.starterCode).toContain("for unit in world[\"units\"]:");
    expect(first.starterCode).toContain('"action": {');
    expect(first.starterCode).toContain('"type": "cast"');
    expect(first.starterCode).toContain('"skillId": "spark"');
    expect(first.guidance.commandExamples.some((hint) => hint.includes("坐标对象数组"))).toBe(true);
    expect(first.guidance.commandExamples.some((hint) => hint.includes('不能写成 [[1, 0], [2, 0]]'))).toBe(true);
    expect(first.guidance.commandExamples.some((hint) => hint.includes('"attack"'))).toBe(true);
    expect(first.guidance.commandExamples.some((hint) => hint.includes('skillId') && hint.includes('targetId'))).toBe(true);
    expect(second.starterCode).toContain("if ");
    expect(third.starterCode).toContain("def choose_world_action");
    expect(third.starterCode).toContain("def choose_turn");
    expect(third.starterCode).toContain("for ");
    expect(third.starterCode).toContain('world["objects"]');
    expect(third.starterCode).toContain('world["units"]');
    expect(third.starterCode).toContain("scout-mark");
    expect(fourth.starterCode).toContain("def choose_world_action");
    expect(fourth.starterCode).toContain("def choose_turn");
    expect(fourth.starterCode).toContain(" and ");
    expect(fourth.starterCode).toContain(" or ");
    expect(fourth.starterCode).toContain("not ");
    expect(fourth.starterCode).toContain("gate-a");
    expect(fourth.starterCode).toContain("gate-b");
    expect(fourth.starterCode).not.toContain("worldFlags");
    expect(fourth.starterCode).not.toContain("pass");
    expect(fifth.starterCode).toContain("辅助函数");
    expect(fifth.starterCode).not.toContain("def choose_turn");
    expect(sixth.starterCode).toContain("world");
    expect(sixth.starterCode).not.toMatch(/条件分支|遍历筛选|辅助函数/);
    expect(sixth.starterCode).not.toContain("def choose_turn");
    expect(sixth.guidance.worldFields.length).toBeGreaterThan(0);
  });

  it("formats every starter-code line within 60 characters", () => {
    for (const levelId of LEVEL_ORDER) {
      const lines = getLevel(levelId).starterCode.split("\n");
      expect(Math.max(...lines.map((line) => [...line].length), 0), levelId).toBeLessThanOrEqual(60);
    }
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

  it("reports the level and id for dangling Go API references", () => {
    const first = getLevel("go-marsh-01");
    const apiFocus = first.guidance.apiFocus;
    if (apiFocus === undefined) throw new Error("测试夹具缺少 apiFocus");
    const danglingReference = {
      ...first,
      guidance: {
        ...first.guidance,
        apiFocus: { ...apiFocus, referenceIds: [...apiFocus.referenceIds, "missing.reference"] },
      },
    };
    const malformedFocus = {
      ...first,
      guidance: { ...first.guidance, apiFocus: { ...apiFocus, steps: [""] } },
    };

    expect(() => validateGoApiFocus([danglingReference], GO_REFERENCE)).toThrow(
      "关卡 go-marsh-01 引用不存在的 API 条目: missing.reference",
    );
    expect(() => validateLevels([malformedFocus])).toThrow("关卡 apiFocus 字段无效");
  });
});
