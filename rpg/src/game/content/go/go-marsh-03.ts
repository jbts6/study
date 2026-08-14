import type { BattleState } from "../../combat/types";
import type { LevelDefinition } from "../shared/types";

export const STARTER_CODE_03 = `package main

func ChooseTurn(world World) TurnCommand {
    targetID := ""
    for _, unit := range world.Units {
        if unit.Team == "enemies" && !unit.Disabled {
            targetID = unit.ID
            break
        }
    }
    if targetID == "" {
        return Wait(world)
    }
    return Attack(world, targetID)
}
`;

function createGoMarsh03(): BattleState {
  return {
    battleId: "go-marsh-03", contentVersion: "go-campaign-1", revision: 0, round: 1, turnIndex: 0,
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

export const GO_MARSH_03: LevelDefinition = {
  id: "go-marsh-03",
  title: "勘测印记",
  briefing: ["激活勘测印记后再消灭最后一名敌人。", "遍历可见单位，选择优先目标。"],
  starterCode: STARTER_CODE_03,
  guidance: {
    objective: ["激活 scout-mark 后，再消灭最后一名敌人。"],
    concepts: ["使用 for 和 range 遍历 world.Units，并用 Team 与 Disabled 筛选敌人。"],
    worldFields: ["world.Units 提供单位状态。", "world.Objectives 提供 scout-mark 的 Cell 和 Completed。"],
    commandExamples: ["使用 Interact(world, \"scout-mark\") 激活印记，使用 Attack(world, targetID) 攻击。"],
    levelRules: ["scout 必须移动到印记相邻格才能交互；未激活印记就清除全部敌人会失败。"],
  },
  initialBattle: createGoMarsh03(),
  enemyBehaviors: { "hunter-a": { type: "hunt-player" }, "hunter-b": { type: "hunt-player" } },
  reward: { type: "ability", abilityId: "renew" },
};
