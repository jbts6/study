import type { BattleState } from "../combat/types";
import type { LevelDefinition } from "./types";

export const CURRENT_LEVEL_ID = "python-marsh-01" as const;

export const STARTER_CODE = `def choose_turn(world):
    # world 包含当前行动者、战场、单位和目标。
    # 返回值必须是一个 Python 字典，顶层只能有 actorId、expectedRevision、movePath（可选）和 action。
    # actorId：字符串，通常直接填 world["activeUnitId"]。
    # expectedRevision：整数，必须直接填 world["revision"]，不要写成 "0"。
    # movePath 是顶层字段（可选），值必须是坐标对象数组，不是 [[1, 0]] 这样的二维数组。
    # 正确：[{"x": 1, "y": 0}, {"x": 1, "y": 1}]；每个对象代表一步，x/y 都是整数。
    # 第一步从当前格出发，数组元素只填写每一步要到达的目标格；每一步必须正交相邻（上下左右一格）。scout 最多走 2 步。不移动时可省略 movePath 或写 []。
    # action 是字典，type 可填 attack、cast、interact、guard、wait。
    # 攻击格式：{"type": "attack", "targetId": "golem"}
    # 施法格式：{"type": "cast", "skillId": "spark", "targetId": "golem"}
    # 完整施法命令中的 action：{"action": {"type": "cast", "skillId": "spark", "targetId": "golem"}}
    # 一条可直接运行的“移动后攻击”命令：
    # {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "movePath": [{"x": 1, "y": 0}, {"x": 1, "y": 1}], "action": {"type": "attack", "targetId": "golem"}}
    return {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "action": {"type": "wait"},
    }
`;

export function createPythonMarsh01(): BattleState {
  return {
    battleId: "python-marsh-01",
    contentVersion: "python-slice-1",
    revision: 0,
    round: 1,
    turnIndex: 0,
    turnOrder: ["scout", "golem"],
    phase: "in_progress",
    rngState: 2463534242,
    maxRounds: 6,
    board: {
      width: 3,
      height: 2,
      blockedCells: [],
      hazardCells: [{ x: 2, y: 1 }],
      coverCells: [{ x: 2, y: 0 }],
      hazardDamage: 2,
    },
    objectives: [{
      id: "relay",
      cell: { x: 0, y: 1 },
      durability: 2,
      completed: false,
      key: true,
    }],
    failureConditions: { keyObjectiveDestroyed: true },
    units: [
      {
        id: "scout",
        team: "allies",
        visibility: "revealed",
        cell: { x: 0, y: 0 },
        hp: 10,
        maxHp: 10,
        attack: 4,
        defense: 0,
        move: 2,
        initiative: 9,
        disabled: false,
        statuses: [],
        skills: [
          { id: "spark", range: 2, power: 2, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" },
          { id: "mend", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "heal" },
        ],
      },
      {
        id: "golem",
        team: "enemies",
        visibility: "revealed",
        cell: { x: 2, y: 1 },
        hp: 6,
        maxHp: 6,
        attack: 2,
        defense: 1,
        move: 1,
        initiative: 4,
        disabled: false,
        statuses: [],
        skills: [
          { id: "smash", range: 1, power: 1, cooldown: 2, remainingCooldown: 1, target: "unit", kind: "damage" },
        ],
      },
      {
        id: "lurker",
        team: "enemies",
        visibility: "hidden",
        cell: { x: 2, y: 1 },
        hp: 5,
        maxHp: 5,
        attack: 3,
        defense: 0,
        move: 1,
        initiative: 1,
        disabled: true,
        statuses: [],
        skills: [
          { id: "ambush", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" },
        ],
      },
    ],
  };
}

export const PYTHON_MARSH_01: LevelDefinition = {
  id: CURRENT_LEVEL_ID,
  title: "唤醒中继器",
  briefing: ["在中继器被腐化前消灭敌人。", "读取 world 字典并返回一条合法指令。"],
  starterCode: STARTER_CODE,
  guidance: {
    objective: ["在中继器 relay 被腐化前消灭 golem。"],
    concepts: ["实现 choose_turn(world)，读取字典并返回一条回合指令。"],
    worldFields: [
      "world[\"activeUnitId\"] 是当前行动者 ID，用作 actorId。",
      "world[\"revision\"] 是当前战场修订号，用作 expectedRevision。",
    ],
    commandExamples: [
      "返回值顶层只允许 actorId、expectedRevision、movePath（可选）和 action。",
      "movePath 必须是坐标对象数组，例如 [{\"x\": 1, \"y\": 0}, {\"x\": 2, \"y\": 0}]；单步不能写成 [[1, 0]]，完整路径不能写成 [[1, 0], [2, 0]]。",
      "攻击：{\"action\": {\"type\": \"attack\", \"targetId\": \"golem\"}}。",
      "施法：{\"action\": {\"type\": \"cast\", \"skillId\": \"spark\", \"targetId\": \"golem\"}}。",
    ],
    levelRules: [
      "movePath 每一步必须正交相邻，scout 最多移动 2 步。",
      "action.type 可用 attack、cast、interact、guard、wait；本关不能交互关键目标 relay。",
    ],
  },
  initialBattle: createPythonMarsh01(),
  enemyBehaviors: { golem: { type: "corrupt" } },
  reward: { type: "ability", abilityId: "ward" },
};
