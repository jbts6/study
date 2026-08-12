# Python RPG 阶段 4 六关战役实施计划

> **执行代理要求：** 使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐任务实施；每个任务按复选框跟踪，并严格遵守测试先行。

**目标：** 在现有单屏 Python RPG 上交付 `python-marsh-01` 至 `python-marsh-06` 六关固定战役，并完成能力解锁、V2 存档、刷新恢复、任务结算与最终浏览器主流程。

**架构：** `AppController` 继续作为唯一应用快照源。战役内容由固定顺序的类型化 `LevelDefinition` 目录提供；关卡规则与敌方行为是控制器调用的纯函数；奖励能力由当前关卡位置和终局即时推导并在创建关卡时注入 `scout`。战斗内核保持现有胜负顺序，终局断言只在内核胜利后由战役层补查。

**技术栈：** TypeScript 7、Vitest、Vite、CodeMirror、Playwright、本地 Python Runner。

## 全局约束

- 采用信任本地代码模型；不修改本地 Runner 的执行边界，不建设对抗恶意代码的隔离。
- 玩家始终只控制 `scout`；不增加队友、技能树、关卡选择、通用 DSL、行为树、寻路系统或第二个战役状态源。
- 仅使用现有 `damage`、`heal`、`defenseBonus`、冷却和 `Objective.key` 语义。
- 敌方移动仅为一格曼哈顿贪心；距离相同时按 `y`、再按 `x` 升序，不增加完整寻路。
- V2 存档只保存 `version`、`currentLevelId`、`battleState`、`codeDraft`；V1 不迁移。
- 参考解法只存在于测试，不进入生产构建。
- 测试覆盖正常主流程和一个关键失败路径；前三关完成后运行阶段性定向验证，六关完成后才运行一次全量浏览器主流程。
- 任务串行实施。只读勘察可并行；实现代理不得同时修改同一文件。
- 轻量明确任务优先 `luna_worker`，失败后使用 `dsf_worker`，再失败使用 `terra_fallback_worker`；跨多文件状态流使用 `terra_worker`。

---

### Task 1：内容契约、能力目录与玩家世界视图

**执行：** `luna_worker`；完成后由新的 `luna_worker` 做规格符合性与代码质量双审。

**文件：**
- 新建：`rpg/src/game/content/types.ts`
- 新建：`rpg/src/game/content/ability-catalog.ts`
- 新建：`rpg/src/game/content/ability-catalog.test.ts`
- 修改：`rpg/src/game/combat/types.ts`
- 修改：`rpg/src/game/world/project-world-view.ts`
- 修改：`rpg/src/game/world/project-world-view.test.ts`

**接口：**
- 产出 `LevelId`、`LevelDefinition`、`EnemyBehaviorSpec`、`LevelReward`、`AbilityId`。
- 产出 `ABILITY_CATALOG` 与 `injectUnlockedAbilities(levelId, battleState): BattleState`。
- `WorldUnit.skills` 增加 `remainingCooldown`，不暴露敌方技能或 `hazardDamage`。

- [x] 写失败测试：五项能力字段完全匹配规格；按关卡顺序只向 `scout` 注入此前奖励，且不重复注入。
- [x] 写失败测试：友方技能投影包含 `remainingCooldown`，敌方隐藏属性仍不公开。
- [x] 运行 `npm test -- src/game/content/ability-catalog.test.ts src/game/world/project-world-view.test.ts`，确认因契约/字段缺失而失败。
- [x] 最小实现类型、只读能力目录、能力注入与世界视图投影。
- [x] 重跑同一命令，确认通过；再运行 `npm exec tsc -- --noEmit`。
- [x] 提交：`feat: add campaign content contracts and abilities`。

**完成标准：** 五项能力只有一个生产来源；进入任意关卡时 `scout.skills` 恰好包含基础技能与此前已获能力；世界视图只增加规定的冷却字段。

### Task 2：关卡指令规则与三类确定性敌方行为

**执行：** `luna_worker`；依赖任务 1；完成后由新的 `luna_worker` 双审。

**文件：**
- 新建：`rpg/src/game/campaign/validate-level-command.ts`
- 新建：`rpg/src/game/campaign/validate-level-command.test.ts`
- 新建：`rpg/src/game/campaign/enemy-command.ts`
- 新建：`rpg/src/game/campaign/enemy-command.test.ts`

**接口：**
- 产出 `validateLevelCommand(level, state, command): CommandValidation`。
- 产出 `enemyCommand(level, state): TurnCommand`。
- 基础语法与战斗合法性仍由 `resolveTurn`/现有 validator 负责；本任务只处理关卡用途与职责。

- [x] 写失败测试：`scout` 只能交互非关键目标；`corrupt` 角色只能交互该关唯一关键目标；拒绝时状态不变并返回具体原因。
- [x] 写失败测试：`corrupt`、`hunt-player`、`guard` 分别按规格生成一条完整指令。
- [x] 写失败测试：移动前已满足动作条件时不移动；贪心候选按距离、`y`、`x` 决定；无合法格时 `guard`。
- [x] 运行 `npm test -- src/game/campaign/validate-level-command.test.ts src/game/campaign/enemy-command.test.ts`，确认函数缺失导致预期失败。
- [x] 最小实现两个纯函数，不修改战斗内核胜负顺序。
- [x] 重跑定向测试与 `npm exec tsc -- --noEmit`。
- [x] 提交：`feat: add campaign command rules and enemy roles`。

**完成标准：** 所有关卡交互权限在调用 `resolveTurn` 前拒绝；三类敌人只执行固定职责且结果确定。

### Task 3：前三关垂直切片、V2 存档与战役控制器

**执行：** `terra_worker`；依赖任务 1、2；完成后由 `terra_worker` 双审。

**文件：**
- 新建：`rpg/src/game/content/python-marsh-02.ts`
- 新建：`rpg/src/game/content/python-marsh-03.ts`
- 新建：`rpg/src/game/content/levels.ts`
- 新建：`rpg/src/game/content/levels.test.ts`
- 修改：`rpg/src/game/content/python-marsh-01.ts`
- 修改：`rpg/src/app/save-store.ts`
- 修改：`rpg/src/app/save-store.test.ts`
- 修改：`rpg/src/app/app-controller.ts`
- 修改：`rpg/src/app/app-controller.test.ts`
- 修改：`rpg/src/main.ts`

**接口：**
- `LEVEL_ORDER` 固定保存六个 ID 的顺序；本任务先注册前三关，缺少的后三关在任务 4 补齐。
- `getLevel(levelId)`、`getNextLevelId(levelId)`、`validateLevels(levels)` 提供唯一内容访问入口。
- 存档升级为 `SaveDataV2`；校验 `battleState.battleId === currentLevelId`。
- `AppController` 新增 `retryLevel()`、`advanceLevel()`；所有玩家/敌方指令先经过关卡校验。

- [x] 写失败的数据测试：前三关必填字段、重复 ID、单位/目标/能力引用；第一关到第三关的脚手架递减。
- [x] 写失败的存档测试：V2 正常读取、刷新恢复；V1/未知版本/战斗 ID 不匹配进入恢复页。
- [x] 写失败的控制器测试：非法关卡指令不推进；胜利即时派生奖励；刷新仍停在结算；点击下一关才切换脚手架；重试保留当前代码。
- [x] 写关键失败测试：敌人全灭但非关键目标未完成时不发奖、不允许进入下一关，并显示具体失败原因。
- [x] 运行 `npm test -- src/game/content/levels.test.ts src/app/save-store.test.ts src/app/app-controller.test.ts`，确认因 V2/战役接口缺失而失败。
- [x] 最小实现前三关数据、内容校验、V2 存档与控制器状态流；不创建独立结算状态。
- [x] 运行上述定向测试；再运行 `npm run build` 作为前三关阶段性构建。
- [x] 提交：`feat: deliver first three campaign levels`。

**完成标准：** 前三关形成编写、运行、反馈、胜利/任务失败、奖励、刷新恢复、重试和下一关的完整状态流；生产构建通过。

### Task 4：后三关内容与六关参考解法

**执行：** `luna_worker`；依赖任务 3；完成后由新的 `luna_worker` 双审。

**文件：**
- 新建：`rpg/src/game/content/python-marsh-04.ts`
- 新建：`rpg/src/game/content/python-marsh-05.ts`
- 新建：`rpg/src/game/content/python-marsh-06.ts`
- 修改：`rpg/src/game/content/levels.ts`
- 修改：`rpg/src/game/content/levels.test.ts`
- 新建：`rpg/src/game/content/reference-solutions.test.ts`

**接口：**
- 完成 `LEVEL_ORDER = python-marsh-01 ... python-marsh-06` 的六关目录。
- 参考解法测试通过与控制器相同的 `projectWorldView → 指令解析 → validateLevelCommand → resolveTurn → enemyCommand` 流程，不复制战斗逻辑。

- [x] 扩展失败的数据测试到六关：必填字段、重复 ID、实际单位/目标/能力引用和固定奖励顺序。最终整体审查确认现有关键失败路径足够，不再为每关重复参数化同类缺失字段。
- [x] 写六份参数化参考解法测试，每关断言最终内核胜利且终局断言通过。
- [x] 运行 `npm test -- src/game/content/levels.test.ts src/game/content/reference-solutions.test.ts`，确认后三关缺失或不能通关。
- [x] 最小实现后三关地图、单位、目标、脚手架、提示、职责和奖励；调整数值仅以参考解法可达且教学负担符合规格为准。
- [x] 重跑上述测试与 `npm exec tsc -- --noEmit`。
- [x] 提交：`feat: complete six-level campaign content`。

**完成标准：** 六关均由各自参考解法在最大回合数内通关；奖励顺序为 `ward → pierce → renew → fracture → aegis`，第六关只标记战役完成。

### Task 5：单屏任务区、冷却状态与结算面板

**执行：** `terra_worker`；依赖任务 3、4；完成后由 `luna_worker` 做规格审查、`terra_worker` 做代码与视觉质量审查。

**文件：**
- 修改：`rpg/src/app/app-view.ts`
- 修改：`rpg/src/styles/game.css`
- 修改：`rpg/src/styles/layout.css`
- 修改：`rpg/src/styles/responsive.css`
- 修改：`rpg/src/app/app-controller.test.ts`

**接口：**
- 任务区从当前 `LevelDefinition` 与 `scout.skills` 呈现目标/失败约束、能力冷却、API 速查和可折叠提示。
- 底部反馈区根据当前关卡、战斗阶段和终局断言即时呈现成功/失败/战役完成结算。
- 按钮只调用 `controller.retryLevel()`、`controller.advanceLevel()`、现有 `resetSave()`。

- [x] 在控制器测试补充失败断言：三种结算模型及其允许操作，不新增独立结算存档字段。
- [x] 修改单屏结构：任务区、技能冷却、`details` 概念提示、底部结算动作；保留现有战场和编辑器。
- [x] 终态禁用编辑器与运行；普通 Python/指令错误仍留在反馈区且不进入任务失败结算。
- [x] 更新样式 token 和布局，保证现有桌面/窄屏不重叠、键盘焦点可见、结算内容可滚动；不新建页面或卡片嵌套。
- [x] 运行 `npm test -- src/app/app-controller.test.ts` 与 `npm run build`。
- [x] 启动本地开发服务后，用浏览器检查第一关进行中、任务失败、普通胜利和第六关完成四种关键状态的桌面/移动截图及控制台错误。
- [x] 提交：`feat: add campaign briefing and settlement UI`；审查修复提交：`fix: enforce campaign settlement constraints`。

**完成标准：** 单屏完整显示任务与能力状态；前五关胜利、任务失败、第六关完成各有正确按钮；刷新后呈现同一结算，不产生额外 UI 状态源。

### Task 6：六关浏览器主流程与最终质量闭环

**执行：** `terra_worker`；依赖全部前置任务；完成后由高能力 reviewer 做整体审查。

**文件：**
- 修改：`rpg/e2e/app-shell.spec.ts`

若 E2E 暴露生产缺陷，暂停本任务，按缺陷所属责任边界回到任务 1 至 5 的对应文件补失败测试和修复，再重新执行本任务。

**接口：**
- Playwright 使用测试内参考代码逐关通关；不得把参考解法导入生产 bundle。

- [x] 扩展唯一浏览器主流程：第一关开始，逐关运行参考代码，断言奖励能力、前五关结算和下一关按钮。
- [x] 在至少一个前五关胜利结算和第六关完成后刷新，断言结算、战斗与代码恢复且不重复注入能力。
- [x] 断言第六关仅显示重置存档，不发放新能力。
- [x] 运行 `npm run test:e2e -- e2e/app-shell.spec.ts`；修复真实集成问题后重跑。
- [x] 阶段性完成后运行一次 `npm test` 与 `npm run build`，不增加额外测试矩阵。
- [x] 检查生产构建不含参考解法、远程执行路径、未使用内容框架或本机绝对路径。
- [x] 提交：`test: verify complete six-level campaign`；全量回归夹具解耦提交：`test: decouple combat fixture from campaign content`；最终审查修复提交：`fix: address campaign final review`、`refactor: extract battle feedback formatting`。

**完成标准：** 六关浏览器主流程、刷新恢复、能力解锁与最终结算全部通过；定向测试、全量 Vitest 和生产构建无错误。

## 实施与审查纪律

- 每个实现任务开始前记录基准提交；实现代理必须测试先行、提交、自审并写简短报告。
- 主代理基于该任务的基准提交生成完整 diff 包；审查代理分别给出规格符合性和代码质量结论。
- Critical/Important 问题由同一实现代理修复并重审；Minor 记录到最终整体审查。
- 只有任务审查干净后才能开始下一任务；前三关任务完成时执行阶段性构建，六关全部完成时才执行全量与 Playwright。
- 最终整体审查通过后执行 `verification-before-completion`、HelloAGENTS `qa-review` 和 `finishing-a-development-branch`。
