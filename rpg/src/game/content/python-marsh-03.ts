import type { BattleState } from "../combat/types";
import type { LevelDefinition } from "./types";

export const STARTER_CODE_03 = `# 遍历 world["units"]，选择优先处理的敌人。
# 敌人全部失能前，请激活 scout-mark。
# API 速查：
# world["activeUnitId"] 填入 "actorId"，world["revision"] 填入 "expectedRevision"。
# world["units"] 提供敌人状态；world["objectives"] 提供 scout-mark 的 cell 和 completed。
# 返回命令可包含 "movePath": [{"x": 1, "y": 0}] 和 "action": {"type": "guard"}。
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
