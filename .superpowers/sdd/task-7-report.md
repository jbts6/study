# Task 7 报告：Python 世界战役控制器

## RED

先添加探索成功、程序错误、旧版恢复和战斗请求切换测试，再运行：

`cd rpg && npm test -- src/app/world-campaign-controller.test.ts`

按预期失败：`./world-campaign-controller` 模块不存在。

## GREEN

- 新增 `GameController`、探索/战斗/恢复快照联合契约。
- `AppController` 实现共享控制器接口，保留原有 Go 战斗流程。
- 增加显式 feedback layer：程序错误为 `program`，世界/战斗验证错误和探索接受为 `task`，战斗回合与终态结算为 `strategy`，idle 为 `task`。
- 新增 `WorldCampaignController`：加载 V3、创建初始世界、返回 V2/损坏存档恢复快照，按探索/战斗阶段构造 Runner 请求。
- 探索只归约一个 `WorldCommand`；拒绝时保持世界状态不变。
- 战斗复用 `resolveTurn`、`enemyCommand`、`validateLevelCommand`，终态先 `settleEncounter` 再保存。
- 保存范围限定为接受的世界/战斗操作、终态结算、显式重置和代码草稿变更；世界快照下 `retryLevel`/`advanceLevel` 为空操作。

## 验证

- `cd rpg && npm test -- src/app/world-campaign-controller.test.ts src/app/app-feedback.test.ts`：通过，2 个测试文件、9/9 测试通过。
- `cd rpg && npm run typecheck`：通过，退出码 0。
- `git diff --check`：通过。

## 提交

- 提交信息：`feat: orchestrate Python world campaign flow`
- 提交哈希：`5cafe91`（回填报告后提交哈希将更新）。

## 遗留顾虑

- 按 brief 未运行全量测试、E2E 或 `npm run install:local`。
- `AppFeedback.layer` 保持可选以兼容现有 Webview 测试中的旧反馈字面量；控制器和所有反馈生产函数均显式写入对应层。
