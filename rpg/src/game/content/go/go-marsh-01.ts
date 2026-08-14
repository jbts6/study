import type { LevelDefinition } from "../shared/types";
import { createMarshSlice } from "../shared/marsh-slice";

export const CURRENT_LEVEL_ID = "go-marsh-01" as const;
const MARSH_SLICE = createMarshSlice(CURRENT_LEVEL_ID, "go-slice-1");

export const STARTER_CODE = `package main

func ChooseTurn(world World) TurnCommand {
    // world.ActiveUnitID 是当前行动者，world.Revision 是当前战场修订号。
    // 使用 Wait(world) 生成一条合法等待指令。
    return Wait(world)
}
`;

export const GO_MARSH_01: LevelDefinition = {
  id: CURRENT_LEVEL_ID,
  title: "沼泽中的第一步",
  briefing: ["在中继器被腐化前消灭敌人。", "用 Go 的 World 视图选择一条回合指令。"],
  starterCode: STARTER_CODE,
  guidance: {
    objective: ["在中继器 relay 被腐化前消灭 golem。"],
    concepts: [
      "实现 ChooseTurn(world World) TurnCommand。",
      "先用 Wait(world) 验证回合协议。",
    ],
    worldFields: [
      "world.ActiveUnitID 是当前行动者 ID。",
      "world.Revision 是当前战场修订号。",
    ],
    commandExamples: [
      "使用 Wait(world) 返回一条合法等待指令。",
      "返回值必须是 TurnCommand，而不是手写 JSON。",
      "后续行动应使用 World 中的单位和目标信息。",
    ],
    levelRules: [
      "ChooseTurn 必须返回当前回合的一条指令。",
      "本关先验证等待，再逐步尝试移动和攻击。",
    ],
  },
  initialBattle: MARSH_SLICE.initialBattle,
  enemyBehaviors: MARSH_SLICE.enemyBehaviors,
  reward: { type: "campaign-complete" },
};
