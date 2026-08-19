# Task 3 实现报告

## 状态

DONE

## 修改文件

- `rpg/src/game/content/python/world-chapter-05.ts`
- `rpg/src/game/content/python/world-chapter-05.test.ts`
- `rpg/src/game/content/python/world-chapter-01.ts`
- `rpg/src/game/content/python/python-marsh-05.ts`
- `rpg/src/game/content/levels.test.ts`

## 完成内容

- 新增第五章「裂隙节点」及 `rift-nodes` 地点，旅行要求 `lock_yard_cleared`。
- 注册 `entry-stone-a/b/c`，仅接受动态正确目标 `entry-stone-b`，并按任务链进入 `rift_guardians`。
- 遭遇克隆 `python-marsh-05`，只替换 battleId 并注入第五章已解锁能力，不改战场数值或敌方行为。
- 战斗测试包含固定旧位置策略失败，以及通过 `pick_entry`、`go_interact`、`attack_target` 职责分离的动态策略；动态策略完成 node-a、node-b、hunter、guard 并在 14 回合内胜利。
- `STARTER_CODE_05` 提供三个辅助函数、`choose_world_action`、`choose_turn`，只使用公开 world 字段，无 `pass`，每行不超过 60 字符。

## TDD 红绿证据

- RED：第五章尚未汇总时，`world-chapter-05.test.ts` 的 3 个测试全部失败；旅行未连接，遭遇未注册。
- GREEN：`npm test -- src/game/content/python/world-chapter-05.test.ts src/game/content/levels.test.ts src/game/world/settle-encounter.test.ts` 通过，3 个文件共 19 个测试通过。

## 额外验证

- `npm run typecheck`：通过。
- `git diff --check`：通过；仅有仓库既有的 LF/CRLF 提示。

## Starter 复审修复

- `choose_world_action` 现在用 `pick_entry(world)` 计算入口，并直接构造 `inspect` 命令。
- `go_interact` 与 `attack_target` 改为战斗 action 辅助函数；`choose_turn` 对 node-a/node-b/hunter/guard 分别调用它们。
- 两个战斗辅助函数仅在当前位置正交相邻时返回 interact/attack；路线尚未编写时返回 `wait`，不会输出必然被校验拒绝的命令。
- 固定失败策略先完成 node-a/node-b，再等待 hunter 回到其旧坐标；测试确认节点已完成后因 scout 被敌人击败而失败，避免首回合任意非法命令通过。
- RED：新增职责契约后，`levels.test.ts` 因旧 starter 未直接构造入口 inspect 而失败。
- GREEN：第五章、levels、settle 定向测试 19/19 通过，`npm run typecheck` 与 `git diff --check` 通过。

## 提交

- `cabe2d0 feat: add rift nodes world chapter`
- `6247d54 fix: align rift nodes starter helpers`

## 未解决疑点

- 无功能疑点。
- 工作区其他代理的状态、方案文档和玩家文件改动未纳入本任务提交。
