# Task 8 报告：VS Code Python 世界快照路由

## RED

先新增 Python 世界探索、世界战斗和恢复路由测试，并将 Go 战斗快照断言切换到新的 `mode: "battle"`。

运行：

`cd rpg && npm test -- src/vscode/game-session.test.ts`

按预期失败：旧 `GameSession` 将世界快照按 V2 游戏快照读取，探索/战斗发布结果为 `undefined`，并抛出 `关卡不属于当前战役: undefined`；旧恢复快照仍为 `mode: "save_recovery"`，Go 快照仍无法匹配 `mode: "battle"`。

## GREEN

- 将 VS Code 快照契约扩展为探索、战斗、恢复判别联合。
- 将 `GameSession` 控制器依赖泛化为 `GameController`，按探索章节 ID、世界战斗关卡 ID 和 legacy 关卡 ID 打开/读取工作区文件，并只在 ID 变化时打开文件。
- 探索快照复制世界视图字段；世界战斗快照复制 `battleState` 并通过 `battleLevelId` 调用 `getLevel`；legacy 战斗保留等级、程序引用和 diagnostics 映射。
- 将 legacy `save_recovery` 与 `world_recovery` 统一映射为可重置的 `mode: "recovery"`。
- 在扩展宿主中为 Python 选择 `WorldCampaignController` + `WorkspaceWorldSaveStore` + `PYTHON_WORLD_CONTENT`，Go 保持 `AppController` + `WorkspaceSaveStore`；移除控制器启动前的 V2 存档关卡查询。

## 验证

- `[√]` RED：`cd rpg && npm test -- src/vscode/game-session.test.ts`，新增路由测试按预期失败。
- `[√]` GREEN：`cd rpg && npm test -- src/vscode/game-session.test.ts src/vscode/workspace-world-save-store.test.ts src/vscode/workspace-save-store.test.ts`，3 个测试文件、16/16 通过。
- `[√]` 类型检查：`cd rpg && npm run typecheck`，退出码 0。
- `[√]` 差异检查：`git diff --check`，退出码 0。

## 提交

- 提交信息：`feat: route VS Code Python world snapshots`
- 提交哈希：`2dedd8e`

## 遗留顾虑

- 按 brief 未运行全量测试、E2E 或 `npm run install:local`。
- 现有 Webview 渲染器仍消费 legacy `GameViewSnapshot`；消息类型保留兼容入口，后续 Webview 探索渲染任务可直接消费新的 `WebviewSnapshot` 联合。
