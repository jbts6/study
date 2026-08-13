# 遍历 world["units"]，选择优先处理的敌人。
# 敌人全部失能前，请激活 scout-mark。
# API 速查：
# world["activeUnitId"] 填入 "actorId"。
# world["revision"] 填入 "expectedRevision"。
# world["units"] 提供敌人状态。
# world["objectives"] 提供 scout-mark 的 cell 和 completed。
# 返回命令可包含 "movePath": [{"x": 1, "y": 0}]。
# "action" 可写为 {"type": "guard"}。
