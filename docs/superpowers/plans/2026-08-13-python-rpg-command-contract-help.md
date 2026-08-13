# Python RPG 第一关命令契约提示实施计划

> **For agentic workers:** 按任务逐步实现并在每步后验证。

**目标：** 让第一关玩家明确知道回合命令每个字段的合法位置、Python 类型、可复制格式和错误修正方式。

**架构：** 继续使用现有 `LevelDefinition.apiHints` 和第一关 `starterCode` 作为教学内容源；由战斗命令校验器返回带字段路径、合法形状和示例的错误信息，现有反馈区直接展示这些信息。移动规则不变。

**技术栈：** TypeScript、原生 DOM、Vitest、Vite。

## 任务

### Task 1：先固定命令格式契约

**文件：**
- 修改：`rpg/src/game/content/levels.test.ts`
- 修改：`rpg/src/game/combat/validate-turn-command.test.ts`
- 修改：`rpg/src/app/app-controller.test.ts`

- [ ] 为第一关 API 提示、编辑器模板、页面展示和 `movePath` 错误信息写失败测试。
- [ ] 运行定向 Vitest，确认测试因缺少新说明而失败。

### Task 2：补充第一关教学内容

**文件：**
- 修改：`rpg/src/game/content/python-marsh-01.ts`

- [ ] 在 starter code 中给出完整顶层命令模板。
- [ ] 逐项说明 `actorId`、`expectedRevision`、`movePath`、`action` 的位置和合法 Python 形状。
- [ ] 明确 `movePath` 是 `[{"x": 1, "y": 0}]` 对象数组，不是 `[[1, 0]]`，并说明逐格相邻、最多 2 步、可省略或写空数组。

### Task 3：让错误反馈可直接修复

**文件：**
- 修改：`rpg/src/game/combat/validate-turn-command.ts`

- [ ] 为顶层字段、动作类型、目标形状和移动路径返回字段级合法格式与示例。
- [ ] 为路径不相邻、超出移动力、越界/阻挡、版本号不匹配和行动者不匹配补充当前状态与修正方向。
- [ ] 保持错误代码和 JSON 路径稳定，避免破坏现有反馈逻辑。

### Task 4：回归验证

- [ ] 运行相关 Vitest。
- [ ] 运行 `npm run build`。
- [ ] 检查界面展示的速查内容和错误消息未出现未转义的 HTML 或无意义黑盒字段。
