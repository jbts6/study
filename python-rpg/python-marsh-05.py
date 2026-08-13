# 可以把“选敌人”“选目标”“选行动”拆成辅助函数。
# 本关不提供函数骨架，请从 world 视图开始组织代码。
# API 速查：
# world["activeUnitId"] 填入 "actorId"。
# world["revision"] 填入 "expectedRevision"。
# world["units"] 提供 hunter、guard 和技能状态。
# world["objectives"] 提供 node-a、node-b。
# 返回命令可包含 "movePath": [{"x": 1, "y": 0}]。
# "action" 可写为 {"type": "guard"}。
