# Task 4 实现报告

状态：DONE

提交：`08a2f1c feat: complete six-level campaign content`

改动文件：
- `rpg/src/game/content/python-marsh-04.ts`
- `rpg/src/game/content/python-marsh-05.ts`
- `rpg/src/game/content/python-marsh-06.ts`
- `rpg/src/game/content/levels.ts`
- `rpg/src/game/content/levels.test.ts`
- `rpg/src/game/content/reference-solutions.test.ts`

验证证据：
- RED：后三关未注册，定向测试失败。
- GREEN：任务 4 两个定向测试文件共 `10/10` 通过。
- TypeScript：`npm exec tsc -- --noEmit` 通过。

自审结论：六关顺序、奖励 `ward -> pierce -> renew -> fracture -> aegis`、第六关 `campaign-complete`、参考解法生产流程均符合要求。

残余风险：未运行全量测试和 E2E，按计划由后续 Task 6 执行。`.helloagents/sessions/active.json` 为上级流程已有未提交变更，未触碰。

## 双审修复要求

以下发现经主代理复核后接受：

1. 删除 `reference-solutions.test.ts` 的通用 BFS / 动态寻路辅助，改为不形成通用寻路系统的固定或单步移动策略，并保持六关参考解法通过生产战斗流水线。
2. 第四关加入非答案式复合条件示例；测试应验证示例结构，而不只检查 `and/or/not` 三个单词。
3. 第六关脚手架只保留任务说明和 API 速查，不点名条件分支、遍历筛选或辅助函数等解法结构。
4. 删除或替换 `levels.test.ts` 中由同一目标数组构造集合再回查的恒真断言，改为验证真实的目标/行为契约；不要新增计划外的通用 schema。
5. 将后三关内容对象从单行压缩格式展开为可审查格式，不改变数值或行为。

明确不实施：不增加重复单位 ID 校验。设计只要求重复关卡 ID，以及单位、目标和能力的实际引用。

修复后运行：

- `npm test -- src/game/content/levels.test.ts src/game/content/reference-solutions.test.ts`
- `npm exec tsc -- --noEmit`

提交信息：`fix: address campaign content review`

将修复内容、命令、通过数量、提交哈希和自审结论追加到本报告。

## 双审修复结果

状态：DONE

改动摘要：
- 参考解法移除通用 BFS、`neighbors`、`isOpen` 和动态路径搜索，改为固定单步移动/动作策略；六关仍通过 `projectWorldView -> 指令序列化边界 -> validateLevelCommand -> resolveTurn -> enemyCommand`。
- 第四关脚手架加入不对应答案的 `and`、`or`、`not` 复合条件示例，并由测试验证表达式结构。
- 第六关脚手架收敛为任务说明与 API 速查，移除条件分支、遍历筛选和辅助函数等解法提示。
- `levels.test.ts` 改为验证回合参与者、敌方行为引用、关键目标契约和 scout 队伍归属，删除目标数组构造集合后回查的恒真断言。
- 第四至第六关内容对象展开为多行可审查格式，数值、单位、目标、职责和奖励保持不变。

验证：
- `npm test -- src/game/content/levels.test.ts src/game/content/reference-solutions.test.ts`：2 个测试文件、10/10 测试通过。
- `npm exec tsc -- --noEmit`：通过。
- `git diff --check`：通过；差异仅包含 brief 允许的 5 个产品/测试文件与本报告。

自审结论：未增加重复单位 ID 校验，未修改 `levels.ts`、战斗内核、控制器、UI、计划或会话状态文件；未残留 BFS、动态寻路或诊断输出。`.helloagents/sessions/active.json` 的既有改动未触碰。

提交：待提交，提交信息为 `fix: address campaign content review`。

疑虑：未运行全量测试和 E2E，按 brief 仅执行两条定向验证命令。

---

# Task 4 补充报告：桥接世界遭遇结算

## RED

先添加胜利结算、失败重试和终态拒绝测试，再运行 `cd rpg && npm test -- src/game/world/settle-encounter.test.ts`。测试按预期失败：`./settle-encounter` 模块不存在。

补充最终报告提交测试后运行 `cd rpg && npm test -- src/game/world/resolve-world-command.test.ts`，按预期失败：提交后任务仍为 `active/submit_report`，未设置章节完成和解锁标志。

## GREEN

新增 `settleEncounter` 与 `encounterBattleLevel`：无活动战斗或战斗仍在进行时抛错；胜利清空战斗、回到 `rust-marsh-camp`、设置 `marsh_guardian_defeated`、推进到 `submit_report` 并递增一次 revision；失败从注册遭遇的初始战斗深拷贝，保留探索状态与任务、维持 encounter ID 并递增一次 revision。

扩展 `talk toma` 的报告提交：守卫已击败且任务处于 `submit_report` 时完成任务并设置 `chapter_01_completed`、`chapter_02_unlocked`；重复提交仍接受且不重复改变奖励状态。

## 验证

- `cd rpg && npm test -- src/game/world/settle-encounter.test.ts`：通过，3 tests。
- `cd rpg && npm test -- src/game/world/settle-encounter.test.ts src/game/world/resolve-world-command.test.ts`：通过，7 tests。
- `cd rpg && npm run typecheck`：通过，退出码 0。

## 文件清单

- `rpg/src/game/world/settle-encounter.ts`
- `rpg/src/game/world/settle-encounter.test.ts`
- `rpg/src/game/world/reduce-world.ts`
- `rpg/src/game/world/resolve-world-command.test.ts`

## 提交与遗留顾虑

- 基线：`8a7dd96`。
- 实现提交：`47c3d3a`（`feat: settle world campaign encounters`；本补充报告追加后提交哈希随 Git 历史更新）。
- 未修改通用世界指令 DSL 或协议；未运行全量测试或 `npm run install:local`（按 brief 要求）。

## 本会话 Task 4（Webview）

状态：DONE_WITH_CONCERNS

改动文件：
- `rpg/src/vscode/webview/manual-state.ts`
  - 新增 `ManualViewState`、持久化状态和纯迁移函数。
  - 覆盖 Go revision 0 默认重点、同 revision 恢复、合法 revision 增长回战场、换关重点重置、Python 无参考回战场。
  - 增加稳定参考 ID 到 `turn-command` / `world` / `actions` 的章节映射。
- `rpg/src/vscode/webview/manual-state.test.ts`
  - 新增 8 项状态与引用映射测试。
- `rpg/src/vscode/webview/render-game.ts`
  - 保留根节点五段结构；Go 主内容支持战场/战术手册切换。
  - 增加五章节手册、完整 Go SDK、`manual-entry-<referenceId>` 稳定定位和标题焦点目标。
  - 反馈区根据 `relatedReferenceIds` 增加本地“查看相关 API”按钮；未改宿主命令协议。
- `rpg/src/vscode/webview/render-game.test.ts`
  - 增加 Go 手册、SDK、稳定引用和错误按钮测试；保留 Python 五段布局回归。
- `rpg/src/vscode/webview/main.ts`
  - 接入 Webview `getState` / `setState`。
  - 接入快照状态迁移、视图/章节点击、窄屏/桌面方向键、Enter/Space 激活、错误 API 聚焦。

提交：`ff47349 feat: add Go tactical manual Webview`

TDD 红绿证据：
- RED 1：`cd rpg && npx vitest run src/vscode/webview/manual-state.test.ts`；失败，`./manual-state` 模块不存在，测试套件 0 项执行。
- GREEN 1：同一命令；通过，1 个测试文件、8 项测试全部通过。
- RED 2：`cd rpg && npx vitest run src/vscode/webview/render-game.test.ts`；失败，Go 手册视图标签和本地 API 按钮不存在，11 项中 2 项失败，其余 Python/旧渲染测试通过。
- GREEN 2：同一命令；通过，1 个测试文件、11 项测试全部通过。

额外验证：
- `cd rpg && npx vitest run src/vscode/webview/manual-state.test.ts src/vscode/webview/render-game.test.ts`：通过，2 个测试文件、19 项测试全部通过。
- `cd rpg && npm run typecheck`：通过，`tsc --noEmit` 退出码 0。
- `cd rpg && npm run build`：通过，Web、扩展和 Webview bundle 均生成；Vite 保留既有大 chunk 警告。
- `cd rpg && npm run install:local`：通过，VSIX 打包并成功安装本机扩展；`vsce` 报缺少 repository/license 元数据警告，Node 报既有 `url.parse` 弃用警告。
- `git diff --check`：通过，任务文件无空白错误。

未解决疑点 / concerns：
- `ManualViewState` 的公开契约不含 `levelId`，因此无 `persistedLevelId` 且传入未标注来源的旧状态时，纯函数只能按简报固定的 `go-marsh-01` 首关约定识别后续关卡；主入口实际通过持久化 `levelId` 判定换关。
- 本任务简报未要求新增 `main.ts` 专用测试；交互 wiring 已通过类型检查、Webview 构建和状态/渲染契约验证，但未做独立 DOM 事件自动化覆盖。
- 已安装扩展，但未在当前代理会话中重载 VS Code 窗口并重新打开游戏页面做人工视觉验收；Task 5 仍需完成样式与视口检查。

## Task 4 审查修复（主代理）

审查发现已定位并修复：

- Python 快照没有 `programReference` 时不再显示“查看相关 API”按钮。
- 战场/手册视图的 tab 始终拥有对应 panel，panel 使用稳定的 `aria-labelledby`；手册章节 panel 关联当前章节 tab。
- `main.ts` 的 DOM 事件测试覆盖窄屏/桌面方向键、Enter/Space 激活、状态持久化、标题/引用焦点和回合命令协议。
- `manual-state.ts` 改用显式 `previousLevelId`/`persistedLevelId` 上下文，不再使用隐藏 Symbol 或首关硬编码推断换关。
- 渲染测试区分战场视图与手册视图，验证五章节只在手册视图出现，并验证视图 panel 关联。

验证：

- `cd rpg && npx vitest run src/vscode/webview/manual-state.test.ts src/vscode/webview/render-game.test.ts src/vscode/webview/main.test.ts`：3 个测试文件、25/25 通过。
- `cd rpg && npm run typecheck`：通过。
- `cd rpg && npm run build`：通过。
- `git diff --check`：通过。

## Sol 复审收口

- 为每个手册章节增加当前 tab `tabIndex === 0`、其余 tab `tabIndex === -1` 的 roving-tabindex 断言。
- 按职责拆分渲染模块：`render-game.ts` 保留战场/反馈/操作栏（255 行），新增 `render-manual.ts`（146 行）负责视图标签、手册章节和 SDK 条目，新增 `render-elements.ts`（12 行）共享 DOM 工具；没有改变外部渲染接口。

验证：

- `cd rpg && npx vitest run src/vscode/webview/manual-state.test.ts src/vscode/webview/render-game.test.ts src/vscode/webview/main.test.ts`：3 个测试文件、25/25 通过。
- `cd rpg && npm run typecheck`：通过。
- `cd rpg && npm run build`：通过。
- `git diff --check`：通过。

修复提交：待主代理完成 Sol 复审后提交。

## Sol 复审补测

Sol 复审指出主视图方向键和逐章节/完整 SDK 的渲染断言不足，已补充：

- `main.test.ts` 增加主视图 tablist 在窄屏方向键循环断言。
- `render-game.test.ts` 逐一验证 `focus`、`turn-command`、`world`、`actions`、`sdk` 的选中 tab、`aria-controls` 与 panel `aria-labelledby`。
- `render-game.test.ts` 在 `sdk` 章节遍历 Go 参考 ID，验证入口、全部类型和动作条目均渲染。

补测验证：

- `cd rpg && npx vitest run src/vscode/webview/manual-state.test.ts src/vscode/webview/render-game.test.ts src/vscode/webview/main.test.ts`：3 个测试文件、25/25 通过。
- `cd rpg && npm run typecheck`：通过。
- `cd rpg && npm run build`：通过。
- `git diff --check`：通过。
