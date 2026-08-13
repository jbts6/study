# 蓝图战场目标导向 UI 实施计划

> **For agentic workers:** 按任务逐步实现并在每步后验证。

**目标：** 调整蓝图战场首屏的信息层级，让玩家先理解关卡目标，再识别棋盘上的目标并执行 Python 回合。

**架构：** 继续由 `app-view.ts` 从 `GameSnapshot` 派生所有展示内容。视图增加目标导向的标题、行动提示、图例和目标状态标记，样式通过现有 CSS token 与布局文件实现。

**技术栈：** TypeScript、原生语义 HTML、现有 CSS、Vitest、Vite。

## 任务

### Task 1: 视图语义

**文件：** 修改 `rpg/src/app/app-view.ts`。

- [ ] 在战场标题中加入任务名、目标摘要、失败约束和当前行动提示容器。
- [ ] 从当前 `LevelDefinition` 与 `BattleState.objectives` 派生目标状态，渲染关键目标保护语义和非关键目标激活进度。
- [ ] 为战场添加文字图例，为单元格和单位补充不依赖颜色的可读标签。
- [ ] 保持现有反馈、结算、按钮和控制器调用不变。

### Task 2: 样式层级

**文件：** 修改 `rpg/src/styles/game.css`、`rpg/src/styles/layout.css`、`rpg/src/styles/responsive.css`。

- [ ] 让任务目标区成为战场首屏最强信息层级，压低坐标视觉权重。
- [ ] 为图例、目标状态、单位阵营和危险/阻挡格增加边框、纹理和文字区分。
- [ ] 确保桌面与窄视口不发生重叠，目标说明和图例可以滚动，键盘焦点保持可见。

### Task 3: 定向验证

**文件：** 可按需修改 `rpg/src/app/app-controller.test.ts`，不新增独立状态测试。

- [ ] 补充首屏关键文案和图例存在性的渲染断言。
- [ ] 运行 `npm test -- src/app/app-controller.test.ts`。
- [ ] 运行 `npm run build`。
