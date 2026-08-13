import type { BattleState } from "../combat/types";
import type { LevelDefinition } from "./types";

export const STARTER_CODE_04 = `# 下面的表达式只示范组合条件语法，不对应本关答案。
# world 会公开单位、目标、危险格和技能冷却。
# API 速查：
# world["activeUnitId"] 填入 "actorId"，world["revision"] 填入 "expectedRevision"。
# world["units"]、world["objectives"]、world["board"] 用于组合本关条件。
# 返回命令可包含 "movePath": [{"x": 1, "y": 0}] 和 "action": {"type": "guard"}。
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
    "保护 relay，激活 seal 并消灭全部敌人。",
    "根据生命、目标状态和敌人状态选择 pierce、renew 或交互。",
    "用 and、or、not 安排行动优先级。",
  ],
  starterCode: STARTER_CODE_04,
  guidance: {
    objective: ["保护 relay，激活 seal，并在 12 回合内消灭 corruptor 和 guard。"],
    concepts: [
      "使用 and、or、not 组合生命、冷却、目标完成状态和敌人状态。",
      "优先级条件应保持互斥：每个回合只返回一条命令。",
    ],
    worldFields: [
      "world[\"activeUnitId\"] 是本回合 actorId；world[\"revision\"] 是 expectedRevision。",
      "world[\"units\"] 的 disabled、hp、cell 和 statuses 可用于判断敌人及 scout 状态。",
      "world[\"objectives\"] 中 relay 是需要保护的关键目标，seal 的 completed 表示是否已激活。",
      "scout 的 skills 提供 id、range 和 remainingCooldown；world[\"board\"][\"hazardCells\"] 标出危险格。",
    ],
    commandExamples: [
      "完整外层结构：{\"actorId\": world[\"activeUnitId\"], \"expectedRevision\": world[\"revision\"], \"movePath\": [{\"x\": 1, \"y\": 0}], \"action\": {\"type\": \"guard\"}}。",
      "攻击高防 guard 可用 pierce：{\"action\": {\"type\": \"cast\", \"skillId\": \"pierce\", \"targetId\": \"guard\"}}。",
      "需要恢复时可对自己使用 renew：{\"action\": {\"type\": \"cast\", \"skillId\": \"renew\", \"targetId\": \"scout\"}}。",
      "激活封印：{\"action\": {\"type\": \"interact\", \"targetId\": \"seal\"}}。",
    ],
    levelRules: [
      "seal 必须完成，且全部敌人失能后才算完成本关。",
      "corruptor 会接近并腐化 relay；guard 防御较高；危险格造成 2 点伤害，超过 12 回合会失败。",
    ],
  },
  initialBattle: createPythonMarsh04(),
  enemyBehaviors: {
    corruptor: { type: "corrupt" },
    guard: { type: "guard" },
  },
  reward: { type: "ability", abilityId: "fracture" },
};
