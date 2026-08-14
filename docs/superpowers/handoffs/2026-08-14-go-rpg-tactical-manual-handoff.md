# Go RPG 战术手册交接文档

## 交接目的

记录已经确认的 Go RPG 教学与提示改造方向，供后续会话直接生成实施计划并开发。本文不代表功能已经实现。

## 当前状态

- 用户确认采用“本关重点 + 完整 SDK 参考”。
- 用户确认采用 A 方案：右侧 Webview 在“战场 / 战术手册”之间切换。
- 用户确认战术手册的信息层级和默认进入行为。
- 已完成 Go 第 1-6 关提示审查、当前 Webview 布局审查和视觉线框比较。
- 尚未修改生产代码、测试、关卡内容或扩展安装包。

## 已确认决策

- 每关首次进入时默认显示“本关重点”。
- 完成第一个合法回合后自动返回战场；失败运行不切换。
- 手册占用原战场主内容区，任务、反馈和操作栏保持可见。
- 手册提供“本关重点、回合命令、World 数据、动作函数、完整 SDK”五个入口。
- 完整 SDK 由 Go 程序定义统一提供，关卡只声明重点引用，避免六份重复文案。
- 无效指令可跳转相关 API；编译和运行时错误继续优先定位玩家代码。
- 本次只补齐 Go 第 1-6 关；Python 内容不在本次扩张范围内。

## 设计规格

主规格：`docs/superpowers/specs/2026-08-14-go-rpg-tactical-manual-design.md`

临时视觉稿位于 `.superpowers/brainstorm/17132-1786700585/content/`，最终确认的是：

- `layout-options.html` 中的 A 方案
- `manual-ia.html` 中的信息架构

`.superpowers/` 已在 `.gitignore` 中，只作为设计参考，不进入产品构建。

## 代码事实

- Go SDK：`rpg/src/runners/go/runtime/sdk.go`
- Go 程序定义：`rpg/src/programs/go/index.ts`
- 程序与战役类型：`rpg/src/programs/types.ts`
- 关卡提示类型：`rpg/src/game/content/shared/types.ts`
- Go 六关：`rpg/src/game/content/go/go-marsh-01.ts` 至 `go-marsh-06.ts`
- Webview 快照：`rpg/src/vscode/messages.ts`、`rpg/src/vscode/game-session.ts`
- Webview 渲染：`rpg/src/vscode/webview/render-game.ts`
- Webview 样式：`rpg/src/vscode/webview/styles.css`
- 当前提示由 `renderFeedback()` 把 `GuidanceDrawer` 放进反馈标题，反馈区最大高度为 `min(30vh, 250px)`。

## 实施切分

后续先使用 `writing-plans` 生成逐文件、逐测试的实施计划，再按以下独立阶段推进：

1. 定义 `ProgramReference`、`LevelApiFocus`，补充 Go 完整参考及其 SDK 一致性测试。
2. 补齐 Go 第 1-6 关重点映射，验证所有 `referenceIds` 存在。
3. 扩展 `GameViewSnapshot`，实现“战场 / 战术手册”渲染和 Webview 本地视图恢复。
4. 实现首次进入、首个合法回合自动返回战场和下一关重新展示重点。
5. 用错误 `code/path` 映射 API 条目，实现“查看相关 API”。
6. 完成响应式样式、键盘操作和浅色/深色视觉验收。

每个阶段先写失败测试，再写最小实现；每个阶段独立验证并提交。不要先批量写测试或一次性改完六关。

## 验证顺序

- 先运行新增内容模型与关卡映射的定向 Vitest。
- 再运行 Webview 渲染和关键错误跳转的定向 Vitest。
- 阶段实现完成后运行 `npm run typecheck` 和 `npm run build`。
- 视觉验收覆盖 1280x800 左右半屏浅色、深色，以及 720px 以下窄 Webview。
- 只在完整阶段结束时运行一次 `npm test` 和必要的六关 E2E。
- 因为修改会进入 VS Code 扩展和 Webview，最终验证后必须在 `rpg/` 运行 `npm run install:local`，并重载 VS Code 窗口重新打开游戏。

## 工作区注意事项

- 当前工作区在本任务开始前已有 `.helloagents/sessions/active.json`、`.helloagents/sessions/master/default/runtime.json` 修改，以及未跟踪的 `go-rpg/`；这些不属于本设计任务，不得回退或混入提交。
- 本任务只应提交设计规格和 handoff。后续实施提交也应按阶段精确暂存相关文件。
- 项目采用信任本地代码模型。`exec`、Go 子进程和本地代码执行不是本任务的安全问题。

## 接手后的第一步

1. 阅读主规格和本 handoff。
2. 使用 `writing-plans` 写出实施计划，不重新发明布局方案。
3. 从“Go 完整参考与 SDK 一致性测试”开始第一个红-绿循环。
