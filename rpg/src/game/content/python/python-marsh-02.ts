import type { BattleState } from "../../combat/types";
import type { LevelDefinition } from "../shared/types";

export const STARTER_CODE_02 = `def choose_world_action(world):
    # 探索会自动连续运行：按当前步骤返回一条命令。
    # 用 print(world) 能查看完整数据（输出在反馈面板）。
    step = world["quests"][0]["stepId"]
    if step == "read_waysign":
        return {
            "expectedRevision": world["revision"],
            "type": "inspect",
            "targetId": "waysign",
        }
    if step == "pick_signal_tower":
        # 第一章的铜线已用掉；库存里还有才查左塔。
        tower = "signal-tower-b"
        if world["inventory"]:
            item = world["inventory"][0]
            if item["id"] == "copper_wire":
                tower = "signal-tower-a"
        return {
            "expectedRevision": world["revision"],
            "type": "inspect",
            "targetId": tower,
        }
    if step == "prepare_venom_battle":
        return {
            "expectedRevision": world["revision"],
            "type": "prepareBattle",
            "encounterId": "venom_guardian",
        }
    return {
        "expectedRevision": world["revision"],
        "type": "talk",
        "targetId": "toma",
    }


def choose_turn(world):
    # 一次运行自动打完整场。
    # 腐化者要去毁掉 relay：先移动去 (1, 2) 堵路。
    # 沼火会追着你打；它贴脸时先反击，否则烧腐化者。
    # 参考骨架（units[0] 是你，[1] 腐化者，[2] 沼火）：
    # scout = world["units"][0]
    # wisp = world["units"][2]
    # sx = scout["cell"]["x"]
    # sy = scout["cell"]["y"]
    # wx = wisp["cell"]["x"]
    # wy = wisp["cell"]["y"]
    # near = abs(sx - wx) + abs(sy - wy) == 1
    # if (not wisp["disabled"]) and near:
    #     return {
    #         "actorId": "scout",
    #         "expectedRevision": world["revision"],
    #         "action": {
    #             "type": "attack",
    #             "targetId": "bog-wisp",
    #         },
    #     }
    # 之后：距离 2 内施放 spark（skills[0]），
    # 相邻则 attack 腐化者，否则 guard。
    return {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "action": {"type": "wait"},
    }
`;

function createPythonMarsh02(): BattleState {
  return {
    battleId: "python-marsh-02", contentVersion: "python-campaign-4", revision: 0, round: 1, turnIndex: 0,
    turnOrder: ["scout", "corruptor"], phase: "in_progress", rngState: 2_463_534_242, maxRounds: 8,
    board: { width: 4, height: 3, blockedCells: [], hazardCells: [{ x: 1, y: 0 }, { x: 2, y: 0 }], coverCells: [{ x: 0, y: 1 }], hazardDamage: 2 },
    objectives: [{ id: "relay", cell: { x: 0, y: 2 }, durability: 2, completed: false, key: true }],
    failureConditions: { keyObjectiveDestroyed: true },
    units: [
      { id: "scout", team: "allies", visibility: "revealed", cell: { x: 0, y: 0 }, hp: 8, maxHp: 10, attack: 4, defense: 0, move: 2, initiative: 9, disabled: false, statuses: [], skills: [{ id: "spark", range: 2, power: 2, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" }, { id: "mend", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "heal" }] },
      { id: "corruptor", team: "enemies", visibility: "revealed", cell: { x: 3, y: 2 }, hp: 8, maxHp: 8, attack: 2, defense: 1, move: 1, initiative: 4, disabled: false, statuses: [], skills: [] },
    ],
  };
}

export const PYTHON_MARSH_02: LevelDefinition = {
  id: "python-marsh-02", title: "毒沼岔路", briefing: ["中继器不能被毁。", "用条件分支在危险、攻击、自疗和防御间取舍。"], starterCode: STARTER_CODE_02,
  guidance: {
    objective: ["保护 relay，并在 8 回合内消灭 corruptor。"],
    concepts: ["使用 if 条件分支，根据生命、距离和危险格选择行动。"],
    worldFields: ["world[\"units\"] 提供生命、位置和阵营。", "world[\"board\"][\"hazardCells\"] 标出危险格。"],
    commandExamples: ["防御：{\"action\": {\"type\": \"guard\"}}；自疗时使用 mend 并把 targetId 设为 scout。"],
    levelRules: ["危险格会造成 2 点伤害；corruptor 会持续接近 relay。"],
  },
  initialBattle: createPythonMarsh02(), enemyBehaviors: { corruptor: { type: "corrupt" } }, reward: { type: "ability", abilityId: "pierce" },
};
