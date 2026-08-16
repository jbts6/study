import type { LevelDefinition } from "../shared/types";
import { createMarshSlice } from "../shared/marsh-slice";
import type { BattleState } from "../../combat/types";

export const CURRENT_LEVEL_ID = "python-marsh-01" as const;
const MARSH_SLICE = createMarshSlice(CURRENT_LEVEL_ID, "python-slice-1");

// 激活潜伏者：静态攻击序列在 golem 死后必然报错，
// 迫使玩家读取 world["units"] 并用条件选择存活目标。
const GUARDIAN_BATTLE: BattleState = {
  ...MARSH_SLICE.initialBattle,
  turnOrder: ["scout", "golem", "lurker"],
  units: MARSH_SLICE.initialBattle.units.map((unit) => unit.id === "lurker"
    ? { ...unit, cell: { x: 2, y: 0 }, disabled: false, visibility: "revealed" as const }
    : unit),
};

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
    # 点一次“运行回合”后，本函数会被连续调用，
    # 直到战斗分出胜负、命令被拒或你点“中断运行”。
    # 每回合 world 都在变（血量、位置、revision），
    # 写死的命令在目标死后会报错——要读状态做选择。
    # world["units"] 是单位列表，每个单位有 id、team、
    # hp、disabled 和 cell（{"x": 整数, "y": 整数}）。
    # 选第一个活着的敌人并攻击：
    # target = None
    # for unit in world["units"]:
    #     if unit["team"] != "enemies":
    #         continue
    #     if not unit["disabled"]:
    #         target = unit
    #         break
    # return {
    #     "actorId": world["activeUnitId"],
    #     "expectedRevision": world["revision"],
    #     "action": {
    #         "type": "attack",
    #         "targetId": target["id"],
    #     },
    # }
    # 命令顶层字段：actorId、expectedRevision、
    # movePath（可选）和 action。
    # action 的 type 可填 attack、cast、interact、guard、wait。
    # 施法格式（spark 有冷却，读 remainingCooldown）：
    # "action": {
    #     "type": "cast",
    #     "skillId": "spark",
    #     "targetId": target["id"],
    # }
    # 移动路径 movePath 是坐标对象数组，每步正交相邻：
    # "movePath": [{"x": 1, "y": 0}, {"x": 1, "y": 1}]
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
      "战斗：一次运行会连续调用 choose_turn 直到分出胜负，每回合都要重新读取 world。",
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
  initialBattle: GUARDIAN_BATTLE,
  enemyBehaviors: { ...MARSH_SLICE.enemyBehaviors, lurker: { type: "hunt-player" } },
  reward: { type: "ability", abilityId: "ward" },
};
