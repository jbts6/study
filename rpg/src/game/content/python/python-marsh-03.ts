import type { BattleState } from "../../combat/types";
import type { LevelDefinition } from "../shared/types";

export const STARTER_CODE_03 = `def choose_world_action(world):
    # 可在命令中加入 "movePath" 和 "action"。
    step = world["quests"][0]["stepId"]
    base = {
        "expectedRevision": world["revision"],
    }
    if step == "pick_survey_stake":
        for obj in world["objects"]:
            if obj["status"] == "charged":
                return {**base, "type": "inspect",
                        "targetId": obj["id"]}
    if step == "prepare_survey_battle":
        return {**base, "type": "prepareBattle",
                "encounterId": "survey_pack"}
    return {**base, "type": "talk", "targetId": "toma"}


def choose_turn(world):
    mark_done = False
    for obj in world["objectives"]:
        if obj["id"] == "scout-mark":
            mark_done = obj["completed"]
    weakest = None
    for unit in world["units"]:
        is_enemy = unit["team"] == "enemies"
        if is_enemy and not unit["disabled"]:
            is_weaker = weakest is None
            if is_weaker or unit["hp"] < weakest["hp"]:
                weakest = unit
    # 先移动并交互，再按 hp 选择目标；这里保留练习空间。
    return {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "action": {"type": "wait"},
    }
`;

function createPythonMarsh03(): BattleState {
  return {
    battleId: "python-marsh-03", contentVersion: "python-campaign-4", revision: 0, round: 1, turnIndex: 0,
    turnOrder: ["scout", "hunter-a", "hunter-b"], phase: "in_progress", rngState: 2_463_534_242, maxRounds: 10,
    board: { width: 4, height: 3, blockedCells: [], hazardCells: [], coverCells: [{ x: 1, y: 1 }], hazardDamage: 0 },
    objectives: [{ id: "scout-mark", cell: { x: 0, y: 2 }, durability: 1, completed: false, key: false }],
    failureConditions: { keyObjectiveDestroyed: false },
    units: [
      { id: "scout", team: "allies", visibility: "revealed", cell: { x: 0, y: 0 }, hp: 10, maxHp: 10, attack: 4, defense: 0, move: 2, initiative: 9, disabled: false, statuses: [], skills: [{ id: "spark", range: 2, power: 2, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" }, { id: "mend", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "heal" }] },
      { id: "hunter-a", team: "enemies", visibility: "revealed", cell: { x: 3, y: 0 }, hp: 5, maxHp: 5, attack: 2, defense: 0, move: 1, initiative: 5, disabled: false, statuses: [], skills: [] },
      { id: "hunter-b", team: "enemies", visibility: "revealed", cell: { x: 3, y: 2 }, hp: 6, maxHp: 6, attack: 2, defense: 0, move: 1, initiative: 4, disabled: false, statuses: [], skills: [] },
    ],
  };
}

export const PYTHON_MARSH_03: LevelDefinition = {
  id: "python-marsh-03", title: "勘测印记", briefing: ["激活勘测印记后再消灭最后一名敌人。", "遍历可见敌人，选择优先目标。"], starterCode: STARTER_CODE_03,
  guidance: {
    objective: ["激活 scout-mark 后，再消灭最后一名敌人。"],
    concepts: [
      "使用 for 遍历 world[\"units\"]，筛出 team 为 enemies 且 disabled 为 false 的单位。",
      "把印记是否完成也放进条件判断，避免过早消灭最后一名敌人。",
    ],
    worldFields: [
      "world[\"activeUnitId\"] 是本回合 actorId；world[\"revision\"] 是 expectedRevision。",
      "world[\"units\"] 提供 id、team、hp、cell 和 disabled，可用于筛选仍能行动的敌人。",
      "world[\"objectives\"] 中找到 id 为 scout-mark 的目标，读取 cell 和 completed。",
    ],
    commandExamples: [
      "完整外层结构：{\"actorId\": world[\"activeUnitId\"], \"expectedRevision\": world[\"revision\"], \"movePath\": [{\"x\": 0, \"y\": 1}], \"action\": {\"type\": \"guard\"}}。",
      "激活印记：{\"action\": {\"type\": \"interact\", \"targetId\": \"scout-mark\"}}。",
      "攻击筛选出的敌人：{\"action\": {\"type\": \"attack\", \"targetId\": \"hunter-a\"}}。",
    ],
    levelRules: [
      "scout 必须移动到 scout-mark 的正交相邻格才能 interact。",
      "未激活印记就消灭全部敌人会结算为任务失败；两名 hunter 都会追击 scout，最多 10 回合。",
    ],
  },
  initialBattle: createPythonMarsh03(), enemyBehaviors: { "hunter-a": { type: "hunt-player" }, "hunter-b": { type: "hunt-player" } }, reward: { type: "ability", abilityId: "renew" },
};
