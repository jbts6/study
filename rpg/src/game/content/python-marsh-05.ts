import type { BattleState } from "../combat/types";
import type { LevelDefinition } from "./types";

export const STARTER_CODE_05 = `# 可以把“选敌人”“选目标”“选行动”拆成辅助函数。
# 本关不提供函数骨架，请从 world 视图开始组织代码。
`;

function createPythonMarsh05(): BattleState {
  return {
    battleId: "python-marsh-05", contentVersion: "python-campaign-4", revision: 0, round: 1, turnIndex: 0,
    turnOrder: ["scout", "hunter", "guard"], phase: "in_progress", rngState: 2_463_534_242, maxRounds: 14,
    board: { width: 5, height: 3, blockedCells: [], hazardCells: [], coverCells: [{ x: 3, y: 1 }], hazardDamage: 0 },
    objectives: [
      { id: "relay", cell: { x: 0, y: 2 }, durability: 6, completed: false, key: true },
      { id: "node-a", cell: { x: 0, y: 1 }, durability: 1, completed: false, key: false },
      { id: "node-b", cell: { x: 1, y: 1 }, durability: 1, completed: false, key: false },
    ],
    failureConditions: { keyObjectiveDestroyed: true },
    units: [
      { id: "scout", team: "allies", visibility: "revealed", cell: { x: 0, y: 0 }, hp: 8, maxHp: 10, attack: 4, defense: 0, move: 2, initiative: 9, disabled: false, statuses: [], skills: [
        { id: "spark", range: 2, power: 2, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" },
        { id: "mend", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "heal" },
      ] },
      { id: "hunter", team: "enemies", visibility: "revealed", cell: { x: 4, y: 0 }, hp: 5, maxHp: 5, attack: 2, defense: 0, move: 1, initiative: 5, disabled: false, statuses: [], skills: [] },
      { id: "guard", team: "enemies", visibility: "revealed", cell: { x: 3, y: 2 }, hp: 4, maxHp: 4, attack: 1, defense: 6, move: 1, initiative: 4, disabled: false, statuses: [], skills: [] },
    ],
  };
}

export const PYTHON_MARSH_05: LevelDefinition = {
  id: "python-marsh-05", title: "裂隙节点", briefing: ["猎手会追击 scout，守卫保护节点。", "依次激活两处节点，再用 fracture 处理高防守卫。", "把选敌人、选目标、选行动拆成辅助函数。"],
  starterCode: STARTER_CODE_05,
  apiHints: ["先遍历 world[\"units\"] 找到 team 为 enemies 的单位。", "目标完成状态在 world[\"objectives\"] 中。", "fracture 会暂时降低目标防御。"],
  initialBattle: createPythonMarsh05(), enemyBehaviors: { hunter: { type: "hunt-player" }, guard: { type: "guard" } },
  reward: { type: "ability", abilityId: "aegis" },
};
