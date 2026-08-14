import type { BattleState } from "../../combat/types";
import type { LevelDefinition } from "../shared/types";

export const STARTER_CODE_06 = `# 保护中继器、穿过危险地形、消灭敌人并激活最终封印。
# 在最大回合数内完成战役。
# API 速查：
# world["activeUnitId"] 填入 "actorId"。
# world["revision"] 填入 "expectedRevision"。
# world["units"]、world["objectives"] 和 world["board"] 提供状态。
# scout.skills 中的 remainingCooldown 表示技能是否可用。
# 返回命令可包含 "movePath": [{"x": 1, "y": 0}]。
# "action" 可写为 {"type": "guard"}。
`;

function createPythonMarsh06(): BattleState {
  return {
    battleId: "python-marsh-06",
    contentVersion: "python-campaign-4",
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
      {
        id: "relay",
        cell: { x: 0, y: 1 },
        durability: 3,
        completed: false,
        key: true,
      },
      {
        id: "final-seal",
        cell: { x: 0, y: 3 },
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
        cell: { x: 3, y: 0 },
        hp: 6,
        maxHp: 6,
        attack: 1,
        defense: 1,
        move: 1,
        initiative: 6,
        disabled: false,
        statuses: [],
        skills: [],
      },
      {
        id: "hunter",
        team: "enemies",
        visibility: "revealed",
        cell: { x: 5, y: 2 },
        hp: 5,
        maxHp: 5,
        attack: 1,
        defense: 0,
        move: 1,
        initiative: 5,
        disabled: false,
        statuses: [],
        skills: [],
      },
      {
        id: "guard",
        team: "enemies",
        visibility: "revealed",
        cell: { x: 4, y: 3 },
        hp: 4,
        maxHp: 4,
        attack: 1,
        defense: 6,
        move: 1,
        initiative: 4,
        disabled: false,
        statuses: [],
        skills: [],
      },
    ],
  };
}

export const PYTHON_MARSH_06: LevelDefinition = {
  id: "python-marsh-06",
  title: "沼心封印",
  briefing: [
    "综合使用全部已解锁能力。",
    "保护中继器、穿过危险地形、消灭三类敌人并激活最终封印。",
    "在最大回合数内完成战役。",
  ],
  starterCode: STARTER_CODE_06,
  guidance: {
    objective: ["保护 relay，消灭三类敌人并激活 final-seal，在 18 回合内完成战役。"],
    concepts: [
      "综合使用条件、遍历和辅助函数，让不同敌人、目标、生命值与冷却共享一套决策入口。",
      "把能力是否可用和目标是否完成作为数据判断，不依赖固定回合数写死行动。",
    ],
    worldFields: [
      "world[\"activeUnitId\"] 是本回合 actorId；world[\"revision\"] 是 expectedRevision。",
      "world[\"units\"] 提供三类敌人和 scout 的状态；world[\"objectives\"] 提供 relay 与 final-seal 状态。",
      "world[\"board\"] 提供 hazardCells、coverCells 和地图尺寸；scout 的 skills 提供 remainingCooldown。",
    ],
    commandExamples: [
      "完整外层结构：{\"actorId\": world[\"activeUnitId\"], \"expectedRevision\": world[\"revision\"], \"movePath\": [{\"x\": 1, \"y\": 0}], \"action\": {\"type\": \"guard\"}}。",
      "面对敌人攻击前可使用 aegis 提升防御：{\"action\": {\"type\": \"cast\", \"skillId\": \"aegis\", \"targetId\": \"scout\"}}。危险格仍会直接造成伤害。",
      "激活最终封印：{\"action\": {\"type\": \"interact\", \"targetId\": \"final-seal\"}}。",
      "对高防 guard 可使用 fracture：{\"action\": {\"type\": \"cast\", \"skillId\": \"fracture\", \"targetId\": \"guard\"}}。",
    ],
    levelRules: [
      "corruptor 会腐化 relay，hunter 会追击 scout，guard 会保护关键位置；危险格造成 1 点伤害。",
      "final-seal 必须激活，且全部敌人失能；relay 被毁、scout 失能或超过 18 回合都会失败。",
    ],
  },
  initialBattle: createPythonMarsh06(),
  enemyBehaviors: {
    corruptor: { type: "corrupt" },
    hunter: { type: "hunt-player" },
    guard: { type: "guard" },
  },
  reward: { type: "campaign-complete" },
};
