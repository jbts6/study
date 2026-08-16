import type { LevelDefinition } from "../shared/types";
import { createMarshSlice } from "../shared/marsh-slice";

export const CURRENT_LEVEL_ID = "python-marsh-01" as const;
const MARSH_SLICE = createMarshSlice(CURRENT_LEVEL_ID, "python-slice-1");

export const STARTER_CODE = `def choose_world_action(world):
    # 探索阶段读取 location、npcs、objects 和 inventory。
    # quests 给出任务；revision 必须原样回传到 expectedRevision。
    # 命令是字典，type 决定其余字段，六种命令格式：
    # 交谈：{"type": "talk", "targetId": "toma"}
    # 调查：{"type": "inspect", "targetId": "weather_station"}
    # 收集：{"type": "collect",
    #        "targetId": "copper_wire_source"}
    # 移动：{"type": "travel",
    #        "locationId": "old_foundry"}
    # <- travel 用 locationId，不是 targetId。
    # 使用：{"type": "use", "itemId": "copper_wire",
    #        "targetId": "relay"}
    # 备战：{"type": "prepareBattle",
    #        "encounterId": "marsh_guardian"}
    # 可用 id 看 world["npcs"]、world["objects"]、
    # world["availableTravel"]。
    return {
        "expectedRevision": world["revision"],
        "type": "talk",
        "targetId": "toma",
    }


def choose_turn(world):
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
    concepts: ["同一文件用 choose_world_action(world) 处理探索，用 choose_turn(world) 处理战斗。"],
    worldFields: [
      "探索：location、npcs、objects、inventory、quests、availableTravel 和 revision。",
      "战斗：activeUnitId、board、units、objectives 和 revision。",
      "两个阶段都把 world[\"revision\"] 原样写入 expectedRevision。",
    ],
    commandExamples: [
      "探索：{\"expectedRevision\": world[\"revision\"], \"type\": \"talk\", \"targetId\": \"toma\"}。",
      "探索旅行：{\"expectedRevision\": world[\"revision\"], \"type\": \"travel\", \"locationId\": \"old_foundry\"}。",
      "探索进入战斗：{\"expectedRevision\": world[\"revision\"], \"type\": \"prepareBattle\", \"encounterId\": \"marsh_guardian\"}。",
      "返回值顶层只允许 actorId、expectedRevision、movePath（可选）和 action。",
      "movePath 必须是坐标对象数组，例如 [{\"x\": 1, \"y\": 0}, {\"x\": 2, \"y\": 0}]；单步不能写成 [[1, 0]]，完整路径不能写成 [[1, 0], [2, 0]]。",
      "攻击：{\"action\": {\"type\": \"attack\", \"targetId\": \"golem\"}}。",
      "施法：{\"action\": {\"type\": \"cast\", \"skillId\": \"spark\", \"targetId\": \"golem\"}}。",
    ],
    levelRules: [
      "探索命令只从 choose_world_action 返回，不要在页面上直接操作世界目标。",
      "战斗命令只从 choose_turn 返回；movePath 每一步必须正交相邻，scout 最多移动 2 步。",
      "战斗 action.type 可用 attack、cast、interact、guard、wait；本关不能交互关键目标 relay。",
    ],
  },
  initialBattle: MARSH_SLICE.initialBattle,
  enemyBehaviors: MARSH_SLICE.enemyBehaviors,
  reward: { type: "ability", abilityId: "ward" },
};
