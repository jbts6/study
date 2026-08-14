import type { LevelDefinition } from "../shared/types";
import { createMarshSlice } from "../shared/marsh-slice";

export const CURRENT_LEVEL_ID = "python-marsh-01" as const;
const MARSH_SLICE = createMarshSlice(CURRENT_LEVEL_ID, "python-slice-1");

export const STARTER_CODE = `def choose_turn(world):
    # world 包含当前行动者、战场、单位和目标。
    # 返回值必须是一个 Python 字典。
    # 顶层只能有 actorId、expectedRevision、movePath 和 action。
    # movePath 是可选字段。
    # actorId：字符串，通常直接填 world["activeUnitId"]。
    # expectedRevision：整数，直接填 world["revision"]。
    # movePath 是顶层字段，是坐标对象数组。
    # 它不是 [[1, 0]] 这样的二维数组。
    # 例如：[{"x": 1, "y": 0}, {"x": 1, "y": 1}]。
    # 每个对象代表一步，x/y 都是整数。
    # 第一步从当前格出发，后续元素填要到达的目标格。
    # 每一步必须正交相邻（上下左右一格）。
    # scout 最多走 2 步；不移动时可省略 movePath 或写 []。
    # action 是字典，type 可填 attack、cast、interact、guard、wait。
    # 攻击格式：{"type": "attack", "targetId": "golem"}
    # 施法格式：
    # {
    #     "type": "cast",
    #     "skillId": "spark",
    #     "targetId": "golem",
    # }
    # 完整施法命令中的 action：
    # {
    #     "action": {
    #         "type": "cast",
    #         "skillId": "spark",
    #         "targetId": "golem",
    #     },
    # }
    # 一条可直接运行的“移动后攻击”命令：
    # {
    #     "actorId": world["activeUnitId"],
    #     "expectedRevision": world["revision"],
    #     "movePath": [{"x": 1, "y": 0}, {"x": 1, "y": 1}],
    #     "action": {"type": "attack", "targetId": "golem"},
    # }
    return {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "action": {"type": "wait"},
    }
`;

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
  initialBattle: MARSH_SLICE.initialBattle,
  enemyBehaviors: MARSH_SLICE.enemyBehaviors,
  reward: { type: "ability", abilityId: "ward" },
};
