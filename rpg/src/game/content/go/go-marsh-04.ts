import type { BattleState } from "../../combat/types";
import type { LevelDefinition } from "../shared/types";

export const STARTER_CODE_04 = `package main

func ChooseTurn(world World) TurnCommand {
    lowHP := false
    skillReady := false
    for _, unit := range world.Units {
        if unit.ID == world.ActiveUnitID {
            lowHP = unit.HP*2 <= unit.MaxHP
            for _, skill := range unit.Skills {
                skillReady = skillReady ||
                    skill.RemainingCooldown == 0
            }
        }
    }
    if lowHP && skillReady {
        return Guard(world)
    }
    return Wait(world)
}
`;

function createGoMarsh04(): BattleState {
  return {
    battleId: "go-marsh-04",
    contentVersion: "go-campaign-1",
    revision: 0,
    round: 1,
    turnIndex: 0,
    turnOrder: ["scout", "corruptor", "guard"],
    phase: "in_progress",
    rngState: 2_463_534_242,
    maxRounds: 12,
    board: {
      width: 5,
      height: 3,
      blockedCells: [],
      hazardCells: [{ x: 2, y: 0 }],
      coverCells: [{ x: 1, y: 1 }],
      hazardDamage: 2,
    },
    objectives: [
      { id: "relay", cell: { x: 0, y: 1 }, durability: 6, completed: false, key: true },
      { id: "seal", cell: { x: 1, y: 2 }, durability: 1, completed: false, key: false },
    ],
    failureConditions: { keyObjectiveDestroyed: true },
    units: [
      {
        id: "scout", team: "allies", visibility: "revealed", cell: { x: 0, y: 0 }, hp: 8, maxHp: 10,
        attack: 4, defense: 0, move: 2, initiative: 9, disabled: false, statuses: [],
        skills: [
          { id: "spark", range: 2, power: 2, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" },
          { id: "mend", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "heal" },
        ],
      },
      {
        id: "corruptor", team: "enemies", visibility: "revealed", cell: { x: 4, y: 0 }, hp: 6, maxHp: 6,
        attack: 1, defense: 0, move: 1, initiative: 6, disabled: false, statuses: [], skills: [],
      },
      {
        id: "guard", team: "enemies", visibility: "revealed", cell: { x: 3, y: 2 }, hp: 6, maxHp: 6,
        attack: 1, defense: 3, move: 1, initiative: 4, disabled: false, statuses: [], skills: [],
      },
    ],
  };
}

export const GO_MARSH_04: LevelDefinition = {
  id: "go-marsh-04",
  title: "双重封锁",
  briefing: ["保护 relay，激活 seal 并消灭全部敌人。", "组合生命、目标和技能冷却条件。"],
  starterCode: STARTER_CODE_04,
  guidance: {
    objective: ["保护 relay，激活 seal，并在 12 回合内消灭 corruptor 和 guard。"],
    concepts: ["使用 &&、|| 和 ! 组合生命值、目标状态、敌人状态与技能冷却。"],
    worldFields: ["Skill.RemainingCooldown 表示技能还需等待的回合数。", "Objective.Completed 表示 seal 是否激活。"],
    commandExamples: ["对 guard 使用 pierce；需要恢复时对 scout 使用 renew；靠近 seal 后使用 Interact。"],
    levelRules: ["seal 完成且全部敌人失能后才获胜；危险格造成 2 点伤害。"],
    apiFocus: {
      summary: "组合 Skill.RemainingCooldown 与 Objective.Completed，按条件优先级选择技能、移动和交互。",
      steps: [
        "先判断目标完成状态和技能是否可用，再按生命值、敌人和位置安排行动。",
        "根据距离选择 Cast 或 MoveAndCast；到达 seal 后用 Interact，并保留条件分支顺序。",
      ],
      referenceIds: ["type.skill", "type.objective", "action.cast", "action.move-and-cast", "action.interact"],
      example: "示例只展示条件判断：优先处理可用技能与关键目标，不直接提供完整答案。",
    },
  },
  initialBattle: createGoMarsh04(),
  enemyBehaviors: { corruptor: { type: "corrupt" }, guard: { type: "guard" } },
  reward: { type: "ability", abilityId: "fracture" },
};
