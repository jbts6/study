# Python RPG 第一关命令提示抽屉实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended). Steps use checkbox syntax for tracking.

**Goal:** 将第一关右侧区域改为 B 方案“编辑器优先 + API 提示抽屉”，保留完整字段教学，同时增加代码编辑空间。

**Architecture:** 保留 AppController 作为唯一状态源，不新增全局 UI 状态。提示内容继续来自 LevelDefinition；app-view.ts 负责任务条、代码编辑器和原生 details 抽屉，CSS 负责固定行、最大高度和内部滚动。命令协议、战斗校验、Runner、存档和反馈数据结构不变。

**Tech Stack:** TypeScript、原生 DOM、CSS、CodeMirror 6、Vitest、Vite、Playwright。

## Global Constraints

- 设计契约以 docs/superpowers/specs/2026-08-13-python-rpg-command-help-layout-design.md 为准。
- 默认只显示紧凑任务条和一行 API 提示摘要；完整提示通过抽屉展开。
- 抽屉正文高度：桌面端不超过 min(32dvh, 280px)，移动端不超过 min(40dvh, 320px)；超出内容只在抽屉内部滚动。
- 编辑器内部顺序固定为：标题、任务条、代码编辑区、API 提示抽屉、运行操作栏。
- 错误反馈继续位于页面底部，不迁移到 API 抽屉，不修改错误代码和路径。
- 第一关提示保留真实字段、类型、层级、正确示例、错误示例和修复方向；movePath 同时展示 [{"x": 1, "y": 0}] 与 [[1, 0]]。
- 不增加依赖，不修改 BattleState、命令校验、Runner、存档和战斗规则。

## File Map

- Modify: rpg/src/app/app-view.ts — 编辑器 DOM、任务条、分组提示渲染。
- Modify: rpg/src/styles/layout.css — 编辑器轨道、抽屉滚动边界、操作栏布局。
- Modify: rpg/src/styles/game.css — 任务条、summary、分组提示、示例和焦点状态。
- Modify: rpg/src/styles/responsive.css — 窄屏顺序、抽屉高度、无横向溢出。
- Modify: rpg/src/app/app-controller.test.ts — 默认收起、展开内容、DOM 顺序和反馈位置。
- Reference: docs/superpowers/specs/2026-08-13-python-rpg-command-help-layout-design.md。

---

### Task 1: 锁定编辑器优先的 DOM 契约

Files: rpg/src/app/app-view.ts, rpg/src/app/app-controller.test.ts

- [ ] 先写失败测试：真实挂载第一关，断言 editor-panel 直接子节点顺序为 panel-heading、mission-briefing、code-editor、api-help、action-row；断言 api-help.open 为 false；断言 api-move-path 包含“坐标对象数组”和 [[1, 0]]。
- [ ] 运行 npm test -- --run src/app/app-controller.test.ts，确认因现有长简报结构和缺少抽屉而失败。
- [ ] 将编辑器结构调整为：标题、紧凑 mission-briefing、code-editor、原生 details.api-help、action-row。
- [ ] 抽屉内部提供四个稳定列表：api-command-fields、api-move-path、api-action-fields、api-level-rules。
- [ ] 再运行同一条定向测试，确认 DOM 契约和现有结算/反馈测试通过。
- [ ] 提交：git add rpg/src/app/app-view.ts rpg/src/app/app-controller.test.ts；git commit -m "feat: make command help collapsible"。

### Task 2: 渲染紧凑任务条和分组提示

Files: rpg/src/app/app-view.ts, rpg/src/app/app-controller.test.ts

- [ ] 将现有 renderBriefing 拆成 renderMissionStrip(container, level, state) 和 renderApiHelp(container, level)；不改 AppController 接口。
- [ ] 任务条只显示关卡目标、当前行动单位和回合限制，不再把完整目标、能力冷却和全部 API 文本堆在代码区上方。
- [ ] 第一关 apiHints 按四组展示：命令外层字段、movePath、action、本关规则；不改提示原文。movePath 组必须包含正确坐标对象数组、二维数组反例、正交相邻和最多 2 步。
- [ ] 其他关卡没有第一关专属契约时，保留现有 apiHints 顺序放入抽屉，不编造新的字段规则。
- [ ] 测试四组列表均有内容，api-move-path 包含正确/错误格式和“正交相邻”，反馈节点位于抽屉之外。
- [ ] 运行 npm test -- --run src/app/app-controller.test.ts src/game/content/levels.test.ts。
- [ ] 提交：git add rpg/src/app/app-view.ts rpg/src/app/app-controller.test.ts；git commit -m "feat: group first-level command help"。

### Task 3: 实现桌面编辑器优先布局

Files: rpg/src/styles/layout.css, rpg/src/styles/game.css

- [ ] 将 editor-panel 改为 grid-template-rows: auto auto minmax(0, 1fr) auto auto，使代码区成为唯一弹性轨道。
- [ ] 为 api-help、api-help-body 建立独立滚动边界：正文 max-block-size 为 min(32dvh, 280px)，overflow 为 auto；折叠时 summary 只占一行。
- [ ] 为任务条、summary、分组标题、代码示例和 summary:focus-visible 添加样式；只复用现有 tokens，不引入新主题、渐变或组件库。
- [ ] 长字段允许换行，禁止页面横向溢出；运行操作栏保持可见、可聚焦。
- [ ] 在 1280×720 和 1440×900 浏览器视口检查：默认任务条与 summary 约占编辑器可视高度 15% 以内；展开正文不超过上限；运行按钮仍可见。
- [ ] 提交：git add rpg/src/styles/layout.css rpg/src/styles/game.css；git commit -m "style: prioritize editor over command help"。

### Task 4: 实现移动端顺序和键盘交互

Files: rpg/src/styles/responsive.css, rpg/src/app/app-controller.test.ts

- [ ] 在现有 max-width: 1180px media block 中保持战场、编辑器、反馈区纵向顺序；编辑器轨道使用 auto auto minmax(300px, auto) auto auto。
- [ ] 移动端代码区最小高度为 300px，抽屉正文 max-block-size 为 min(40dvh, 320px)，字段示例可换行且无横向滚动。
- [ ] jsdom 测试断言抽屉初始关闭；触发 summary click 后打开；api-move-path 有完整内容；run-turn 仍在编辑器面板内；feedback 仍在抽屉外。
- [ ] 检查 Tab 可到达 summary，Enter/Space 使用原生 details 行为展开/收起；不增加自定义焦点管理。
- [ ] 运行 npm test -- --run src/app/app-controller.test.ts。
- [ ] 提交：git add rpg/src/styles/responsive.css rpg/src/app/app-controller.test.ts；git commit -m "feat: make command help responsive"。

### Task 5: 完整回归和视觉验收

Files: rpg/src/app/app-view.ts, rpg/src/styles/layout.css, rpg/src/styles/game.css, rpg/src/styles/responsive.css, rpg/src/app/app-controller.test.ts

- [ ] 运行定向测试：npm test -- --run src/app/app-controller.test.ts src/game/content/levels.test.ts。
- [ ] 运行生产构建：npm run build；已有 bundle-size warning 可保留，但不得有构建错误。
- [ ] 运行全量测试：npm test -- --run；战斗、Runner、存档和战役流程不得回归。
- [ ] 浏览器截图验收四种状态：桌面默认收起、桌面展开、命令错误反馈、窄屏纵向布局。确认默认代码区明显大于旧布局；展开时四组提示和 movePath 正反例可读且只在抽屉内部滚动；错误反馈在底部；窄屏无横向溢出。
- [ ] 运行 git diff --check 和 git status --short，确认无空白错误且只剩计划内实现文件。
- [ ] 最终提交：git add rpg/src/app/app-view.ts rpg/src/app/app-controller.test.ts rpg/src/styles/layout.css rpg/src/styles/game.css rpg/src/styles/responsive.css；git commit -m "feat: add editor-first command help drawer"。
