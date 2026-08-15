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

