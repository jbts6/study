def pick_entry(world):
    for obj in world["objects"]:
        if obj["status"] == "aligned":
            return obj["id"]
    return "entry-stone-c"


def go_interact(world, target_id):
    actor = None
    for unit in world["units"]:
        if unit["id"] == world["activeUnitId"]:
            actor = unit
    for objective in world["objectives"]:
        if actor is not None:
            if objective["id"] == target_id:
                cell = actor["cell"]
                point = objective["cell"]
                distance = abs(cell["x"] - point["x"])
                distance += abs(cell["y"] - point["y"])
                if distance == 1:
                    return {"type": "interact",
                            "targetId": target_id}
    # 路线由你补充；未相邻时先安全等待。
    return {"type": "wait"}


def attack_target(world, unit_id):
    actor = None
    target = None
    for unit in world["units"]:
        if unit["id"] == world["activeUnitId"]:
            actor = unit
        if unit["id"] == unit_id and not unit["disabled"]:
            target = unit
    if actor is not None and target is not None:
        cell = actor["cell"]
        point = target["cell"]
        distance = abs(cell["x"] - point["x"])
        distance += abs(cell["y"] - point["y"])
        if distance == 1:
            return {"type": "attack", "targetId": unit_id}
    # 移动与技能选择留给你的路线策略。
    return {"type": "wait"}


def choose_world_action(world):
    step = world["quests"][0]["stepId"]
    if step == "pick_rift_entry":
        entry = pick_entry(world)
        return {"expectedRevision": world["revision"],
                "type": "inspect", "targetId": entry}
    if step == "prepare_rift_battle":
        return {"expectedRevision": world["revision"],
                "type": "prepareBattle",
                "encounterId": "rift_guardians"}
    return {"expectedRevision": world["revision"],
            "type": "talk", "targetId": "toma"}


def choose_turn(world):
    base = {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "movePath": [],
    }
    for objective in world["objectives"]:
        if objective["id"] in ("node-a", "node-b"):
            if not objective["completed"]:
                action = go_interact(world, objective["id"])
                return {**base, "action": action}
    for unit in world["units"]:
        if unit["id"] in ("hunter", "guard"):
            if not unit["disabled"]:
                action = attack_target(world, unit["id"])
                return {**base, "action": action}
    return {**base, "action": {"type": "wait"}}
