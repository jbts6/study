def choose_turn(world):
    # 用 if 根据生命、位置或危险格选择行动。
    if world["activeUnitId"] == "scout":
        return {
            "actorId": "scout",
            "expectedRevision": world["revision"],
            "action": {"type": "guard"},
        }
    return {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "action": {"type": "wait"},
    }
