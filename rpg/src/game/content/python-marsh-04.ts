import type { BattleState } from "../combat/types";
import type { LevelDefinition } from "./types";

export const STARTER_CODE_04 = `# 下面的表达式只示范组合条件语法，不对应本关答案。
# world 会公开单位、目标、危险格和技能冷却。
has_turn = world["activeUnitId"] is not None
has_board = world["board"]["width"] > 0
example = has_turn and (has_board or not has_turn)
`;

function createPythonMarsh04(): BattleState {
  return {
    battleId: "python-marsh-04",
    contentVersion: "python-campaign-4",
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
      {
        id: "relay",
        cell: { x: 0, y: 1 },
        durability: 6,
        completed: false,
        key: true,
      },
      {
        id: "seal",
        cell: { x: 1, y: 2 },
        durability: 1,
        completed: false,
        key: false,
      },
    ],
    failureConditions: { keyObjectiveDestroyed: true },
    units: [
      {
        id: "scout",
        team: "allies",
        visibility: "revealed",
        cell: { x: 0, y: 0 },
        hp: 8,
        maxHp: 10,
        attack: 4,
        defense: 0,
        move: 2,
        initiative: 9,
        disabled: false,
        statuses: [],
        skills: [
          {
            id: "spark",
            range: 2,
            power: 2,
            cooldown: 1,
            remainingCooldown: 0,
            target: "unit",
            kind: "damage",
          },
          {
            id: "mend",
            range: 1,
            power: 3,
            cooldown: 1,
            remainingCooldown: 0,
            target: "unit",
            kind: "heal",
          },
        ],
      },
      {
        id: "corruptor",
        team: "enemies",
        visibility: "revealed",
        cell: { x: 4, y: 0 },
        hp: 6,
        maxHp: 6,
        attack: 1,
        defense: 0,
        move: 1,
        initiative: 6,
        disabled: false,
        statuses: [],
        skills: [],
      },
      {
        id: "guard",
        team: "enemies",
        visibility: "revealed",
        cell: { x: 3, y: 2 },
        hp: 6,
        maxHp: 6,
        attack: 1,
        defense: 3,
        move: 1,
        initiative: 4,
        disabled: false,
        statuses: [],
        skills: [],
      },
    ],
  };
}

export const PYTHON_MARSH_04: LevelDefinition = {
  id: "python-marsh-04",
  title: "双重封锁",
  briefing: [
    "在中继器被腐化前消灭腐化者。",
    "破防并自疗后，激活封印。",
    "用 and、or、not 安排行动优先级。",
  ],
  starterCode: STARTER_CODE_04,
  guidance: {
    objective: ["保护 relay，破防并自疗后激活 seal，再消灭敌人。"],
    concepts: ["使用 and、or、not 组合多个条件并安排优先级。"],
    worldFields: ["unit[\"disabled\"] 表示单位是否失能；objective[\"completed\"] 表示目标是否完成。", "skills 中的 remainingCooldown 表示技能冷却。"],
    commandExamples: ["破防使用 fracture：{\"action\": {\"type\": \"cast\", \"skillId\": \"fracture\", \"targetId\": \"guard\"}}。"],
    levelRules: ["完成破防、自疗和 seal 交互要求后才能结束战斗。"],
  },
  initialBattle: createPythonMarsh04(),
  enemyBehaviors: {
    corruptor: { type: "corrupt" },
    guard: { type: "guard" },
  },
  reward: { type: "ability", abilityId: "fracture" },
};
