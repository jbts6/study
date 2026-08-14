import type { BattleState } from "../../combat/types";
import type { LevelDefinition } from "../shared/types";

export const STARTER_CODE_02 = `package main

func ChooseTurn(world World) TurnCommand {
    for _, unit := range world.Units {
        if unit.ID == world.ActiveUnitID && unit.HP <= 4 {
            return Cast(world, "mend", unit.ID)
        }
    }
    return Guard(world)
}
`;

function createGoMarsh02(): BattleState {
  return {
    battleId: "go-marsh-02", contentVersion: "go-campaign-1", revision: 0, round: 1, turnIndex: 0,
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

export const GO_MARSH_02: LevelDefinition = {
  id: "go-marsh-02",
  title: "毒沼岔路",
  briefing: ["中继器不能被毁。", "用 Go 条件分支在危险、攻击、自疗和防御间取舍。"],
  starterCode: STARTER_CODE_02,
  guidance: {
    objective: ["保护 relay，并在 8 回合内消灭 corruptor。"],
    concepts: ["遍历 world.Units，并用 if 根据生命值和战场状态选择行动。"],
    worldFields: ["unit.HP 和 unit.MaxHP 表示生命值。", "world.Board.HazardCells 标出会造成伤害的危险格。"],
    commandExamples: ["使用 Cast(world, \"mend\", unit.ID) 自疗，或用 Guard(world) 防御。"],
    levelRules: ["危险格会造成 2 点伤害；corruptor 会持续接近 relay。"],
  },
  initialBattle: createGoMarsh02(),
  enemyBehaviors: { corruptor: { type: "corrupt" } },
  reward: { type: "ability", abilityId: "pierce" },
};
