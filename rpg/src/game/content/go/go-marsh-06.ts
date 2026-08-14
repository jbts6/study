import type { BattleState } from "../../combat/types";
import type { LevelDefinition } from "../shared/types";

export const STARTER_CODE_06 = `package main

func ChooseTurn(world World) TurnCommand {
    // world.Units contains units and skill cooldowns.
    // world.Objectives contains relay and final-seal.
    // world.Board contains hazards, cover, and bounds.
    return Wait(world)
}
`;

function createGoMarsh06(): BattleState {
  return {
    battleId: "go-marsh-06",
    contentVersion: "go-campaign-1",
    revision: 0,
    round: 1,
    turnIndex: 0,
    turnOrder: ["scout", "corruptor", "hunter", "guard"],
    phase: "in_progress",
    rngState: 2_463_534_242,
    maxRounds: 18,
    board: {
      width: 6,
      height: 4,
      blockedCells: [],
      hazardCells: [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
      coverCells: [{ x: 3, y: 3 }, { x: 4, y: 3 }],
      hazardDamage: 1,
    },
    objectives: [
      { id: "relay", cell: { x: 0, y: 1 }, durability: 3, completed: false, key: true },
      { id: "final-seal", cell: { x: 0, y: 3 }, durability: 1, completed: false, key: false },
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
        id: "corruptor", team: "enemies", visibility: "revealed", cell: { x: 3, y: 0 }, hp: 6, maxHp: 6,
        attack: 1, defense: 1, move: 1, initiative: 6, disabled: false, statuses: [], skills: [],
      },
      {
        id: "hunter", team: "enemies", visibility: "revealed", cell: { x: 5, y: 2 }, hp: 5, maxHp: 5,
        attack: 1, defense: 0, move: 1, initiative: 5, disabled: false, statuses: [], skills: [],
      },
      {
        id: "guard", team: "enemies", visibility: "revealed", cell: { x: 4, y: 3 }, hp: 4, maxHp: 4,
        attack: 1, defense: 6, move: 1, initiative: 4, disabled: false, statuses: [], skills: [],
      },
    ],
  };
}

export const GO_MARSH_06: LevelDefinition = {
  id: "go-marsh-06",
  title: "沼心封印",
  briefing: [
    "综合使用全部已解锁能力。",
    "保护中继器、穿过危险地形、消灭三类敌人并激活最终封印。",
    "在最大回合数内完成战役。",
  ],
  starterCode: STARTER_CODE_06,
  guidance: {
    objective: ["保护 relay，消灭三类敌人并激活 final-seal，在 18 回合内完成战役。"],
    concepts: ["根据当前单位、目标、地形、生命值和技能冷却组织完整决策。"],
    worldFields: ["world.Units 提供单位状态与技能冷却；world.Objectives 提供 relay 和 final-seal。", "world.Board 提供 HazardCells、CoverCells 与地图边界。"],
    commandExamples: ["可使用 ward、pierce、renew、fracture 和 aegis；通过 Interact(world, \"final-seal\") 激活最终封印。"],
    levelRules: ["corruptor 腐化 relay，hunter 追击 scout，guard 保护关键位置；危险格造成 1 点伤害。", "final-seal 必须激活且全部敌人失能；relay 被毁、scout 失能或超过 18 回合都会失败。"],
    apiFocus: {
      summary: "提供完整 Go SDK 索引，速查 World、Board、Objective、Unit、Skill、Action 与战役约束。",
      steps: [
        "从地图、目标和单位字段读取当前状态，结合已解锁的 ward、pierce、renew、fracture、aegis。",
        "用动作签名构造本回合契约，逐项检查 relay、final-seal、危险格和回合上限。",
      ],
      referenceIds: [
        "type.world", "type.cell", "type.board", "type.objective", "type.status", "type.unit", "type.skill", "type.action", "type.turn-command",
        "action.wait", "action.attack", "action.move-and-attack", "action.guard", "action.cast", "action.move-and-cast", "action.interact", "action.move-and-interact",
      ],
      example: "按契约速查地图与目标字段和已解锁能力；本关只给索引与战役约束，不提供完整通关策略。",
    },
  },
  initialBattle: createGoMarsh06(),
  enemyBehaviors: {
    corruptor: { type: "corrupt" },
    hunter: { type: "hunt-player" },
    guard: { type: "guard" },
  },
  reward: { type: "campaign-complete" },
};
