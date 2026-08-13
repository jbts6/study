# 下面的表达式只示范组合条件语法，不对应本关答案。
# world 会公开单位、目标、危险格和技能冷却。
# API 速查：
# world["activeUnitId"] 填入 "actorId"。
# world["revision"] 填入 "expectedRevision"。
# world["units"]、world["objectives"]、world["board"] 可组合判断。
# 返回命令可包含 "movePath": [{"x": 1, "y": 0}]。
# "action" 可写为 {"type": "guard"}。
has_turn = world["activeUnitId"] is not None
has_board = world["board"]["width"] > 0
example = has_turn and (has_board or not has_turn)
