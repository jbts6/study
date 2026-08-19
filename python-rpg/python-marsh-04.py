def choose_world_action(world):
    step = world["quests"][0]["stepId"]
    base = {"expectedRevision": world["revision"]}
    # 进入第四章已代表 venom_fork_cleared。
    has_wire = any(
        item["id"] == "copper_wire"
        and item["amount"] >= 1
        for item in world["inventory"]
    )
    if step == "pick_lock_gate":
        gate = "gate-a" if has_wire else "gate-b"
        return {**base, "type": "inspect", "targetId": gate}
    if step == "prepare_lockdown_battle":
        return {**base, "type": "prepareBattle",
                "encounterId": "lockdown_pair"}
    return {**base, "type": "talk", "targetId": "toma"}


def choose_turn(world):
    scout = next(unit for unit in world["units"]
                 if unit["id"] == "scout")
    scout_low = scout["hp"] <= 3
    seal_done = any(
        obj["id"] == "seal" and obj["completed"]
        for obj in world["objectives"]
    )
    guard_alive = any(
        unit["id"] == "guard" and not unit["disabled"]
        for unit in world["units"]
    )
    pierce_ready = any(
        skill["id"] == "pierce"
        and skill["remainingCooldown"] == 0
        for skill in scout["skills"]
    )
    example = scout_low and (not seal_done or guard_alive)
    example = example and pierce_ready
    return {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "movePath": [],
        "action": {"type": "wait"},
    }
