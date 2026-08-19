def choose_world_action(world):
    # 可在命令中加入 "movePath" 和 "action"。
    step = world["quests"][0]["stepId"]
    base = {
        "expectedRevision": world["revision"],
    }
    if step == "pick_survey_stake":
        for obj in world["objects"]:
            if obj["status"] == "charged":
                return {**base, "type": "inspect",
                        "targetId": obj["id"]}
    if step == "prepare_survey_battle":
        return {**base, "type": "prepareBattle",
                "encounterId": "survey_pack"}
    return {**base, "type": "talk", "targetId": "toma"}


def choose_turn(world):
    mark_done = False
    for obj in world["objectives"]:
        if obj["id"] == "scout-mark":
            mark_done = obj["completed"]
    weakest = None
    for unit in world["units"]:
        is_enemy = unit["team"] == "enemies"
        if is_enemy and not unit["disabled"]:
            is_weaker = weakest is None
            if is_weaker or unit["hp"] < weakest["hp"]:
                weakest = unit
    # 先移动并交互，再按 hp 选择目标；这里保留练习空间。
    return {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "action": {"type": "wait"},
    }
