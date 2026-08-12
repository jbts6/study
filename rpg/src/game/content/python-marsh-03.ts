import type { BattleState } from "../combat/types";
import type { LevelDefinition } from "./types";

export const STARTER_CODE_03 = `# 遍历 world["units"]，选择优先处理的敌人。
# 敌人全部失能前，请激活 scout-mark。
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
  apiHints: ["for unit in world[\"units\"]: 可遍历单位。", "通过 unit[\"team\"]、hp 和 cell 筛选目标。"], initialBattle: createPythonMarsh03(), enemyBehaviors: { "hunter-a": { type: "hunt-player" }, "hunter-b": { type: "hunt-player" } }, reward: { type: "ability", abilityId: "renew" },
};
