import type { BattleState } from "../combat/types";
import type { LevelDefinition } from "./types";

export const STARTER_CODE_02 = `def choose_turn(world):
    # 用 if 根据生命、位置或危险格选择行动。
    if world["activeUnitId"] == "scout":
        return {"actorId": "scout", "expectedRevision": world["revision"], "action": {"type": "guard"}}
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "wait"}}
`;

function createPythonMarsh02(): BattleState {
  return {
    battleId: "python-marsh-02", contentVersion: "python-campaign-4", revision: 0, round: 1, turnIndex: 0,
    turnOrder: ["scout", "corruptor"], phase: "in_progress", rngState: 2_463_534_242, maxRounds: 8,
    board: { width: 4, height: 3, blockedCells: [], hazardCells: [{ x: 1, y: 0 }, { x: 2, y: 0 }], coverCells: [{ x: 0, y: 1 }], hazardDamage: 2 },
    objectives: [{ id: "relay", cell: { x: 0, y: 2 }, durability: 2, completed: false, key: true }],
    failureConditions: { keyObjectiveDestroyed: true },
    units: [
      { id: "scout", team: "allies", visibility: "revealed", cell: { x: 0, y: 0 }, hp: 8, maxHp: 10, attack: 4, defense: 0, move: 2, initiative: 9, disabled: false, statuses: [], skills: [{ id: "spark", range: 2, power: 2, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" }, { id: "mend", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "heal" }] },
      { id: "corruptor", team: "enemies", visibility: "revealed", cell: { x: 3, y: 2 }, hp: 8, maxHp: 8, attack: 2, defense: 1, move: 1, initiative: 4, disabled: false, statuses: [], skills: [] },
    ],
  };
}

export const PYTHON_MARSH_02: LevelDefinition = {
  id: "python-marsh-02", title: "毒沼岔路", briefing: ["中继器不能被毁。", "用条件分支在危险、攻击、自疗和防御间取舍。"], starterCode: STARTER_CODE_02,
  apiHints: ["world[\"units\"] 可读取单位状态。", "world[\"board\"][\"hazardCells\"] 标出危险格。"], initialBattle: createPythonMarsh02(), enemyBehaviors: { corruptor: { type: "corrupt" } }, reward: { type: "ability", abilityId: "pierce" },
};
