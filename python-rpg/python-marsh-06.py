# 保护中继器、穿过危险地形、消灭敌人并激活最终封印。
# 在最大回合数内完成战役。
# API 速查：
# world["activeUnitId"] 填入 "actorId"。
# world["revision"] 填入 "expectedRevision"。
# world["units"]、world["objectives"] 和 world["board"] 提供状态。
# scout.skills 中的 remainingCooldown 表示技能是否可用。
# 返回命令可包含 "movePath": [{"x": 1, "y": 0}]。
# "action" 可写为 {"type": "guard"}。
