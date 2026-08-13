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
  apiHints: [
    "返回值必须是 Python 字典；顶层只允许 actorId、expectedRevision、movePath（可选）和 action。",
    "actorId：字符串，填当前行动者 ID，直接使用 world[\"activeUnitId\"]。",
    "expectedRevision：整数，直接使用 world[\"revision\"]；不要写成 \"0\"。",
    "movePath：顶层可选字段，值必须是坐标对象数组；不移动可省略或写 []。",
    "movePath 示例：[{\"x\": 1, \"y\": 0}, {\"x\": 2, \"y\": 0}]；不能写成 [[1, 0], [2, 0]]。",
    "movePath 规则：数组元素只填写每一步要到达的目标格；第一步必须与当前格正交相邻（上下左右一格），之后每一步也必须正交相邻；scout 最多 2 步。",
    "action：字典，type 合法值是 \"attack\"、\"cast\"、\"interact\"、\"guard\"、\"wait\"。",
    "攻击格式：{\"type\": \"attack\", \"targetId\": \"golem\"}；targetId 必须是坐标在战场内、可见且未禁用的敌人，并且在攻击距离内。",
    "施法格式：{\"type\": \"cast\", \"skillId\": \"spark\", \"targetId\": \"golem\"}；技能目标字段不能漏。",
    "guard 和 wait 只写 {\"type\": \"guard\"} 或 {\"type\": \"wait\"}；不要给它们添加 targetId。",
    "interact 格式是 {\"type\": \"interact\", \"targetId\": \"目标 ID\"}；本关规则：scout 不能交互关键目标 relay。",
  ],
  initialBattle: createPythonMarsh01(),
  enemyBehaviors: { golem: { type: "corrupt" } },
  reward: { type: "ability", abilityId: "ward" },
};
