def choose_world_action(world):
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
