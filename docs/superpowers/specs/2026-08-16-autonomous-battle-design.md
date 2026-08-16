# 世界战役自动战斗 + 事件动画 — 设计

日期：2026-08-16（当日修订：加入结构化战斗事件与动画渲染）
分支：`feat/autonomous-battle`（基于 master）

## 问题与目标

游戏的交互单元是"每回合返回一个配置字典"，且玩家每回合之间可以重新编辑
代码——手写静态字典逐回合抄答案永远可行，Python 概念（if/遍历/函数）只是
starter 注释里的建议而非通关必要条件，教学能力接近零。

目标：把概念变成硬需求。战斗时一次运行自动打到结束，玩家代码成为一份
完整策略而非每回合的手柄；并且战斗过程全程可见——事件日志 + 单位动画，
"看着自己的程序打完整场仗"。

## 一、运行机制（方案 B：每次运行从头模拟）

`WorldCampaignController` 的战斗运行改为：

1. **运行开始时重置战斗**：若当前处于战斗状态，先把 `state.battle` 重置为
   `{encounterId, state: cloneBattle(encounter.initialBattle)}`（复用
   `settle-encounter.ts` 战败重置的既有语义，将其扩展到每次运行）。
2. **自动循环**：执行 Python（`choose_turn`）→ 应用命令 → 敌方回合由引擎
   结算 → 若战斗仍在进行且轮到玩家单位，等待节奏间隔后用同一份
   `codeDraft` 再次执行，直到战斗分出胜负、命令被拒、Python 运行错误或
   玩家中断。
3. **中途报错停在当前局面显示反馈**；下次运行按第 1 步从初始局面重新模
   拟——修复 bug 后整个程序重跑，进度感来自"这次比上次多推进了几回合"。
4. **中断**：整个自动序列持有同一个 `activeRunId`，现有中断按钮可停。
5. **探索层不变**：非战斗状态仍一次运行返回一条世界命令。
6. **胜负结算**：沿用 `settleEncounter` 现有逻辑（胜利回营地推任务；战败
   重置到初始局面）。
7. **节奏**：回合间隔约 800ms（常量），给动画留出演完时间。

中间局面照常持久化（现有 `replaceSnapshot` 机制不变）；重置只发生在运行
开始时。

## 二、战斗日志（复用引擎既有事件，不新造契约）

战斗内核已产出带完整归因的结构化事件（`game/combat/types.ts` 的
`BattleEvent`，protocolVersion 1）：

- `moved {actorId, from, to}`
- `damaged {sourceId, targetId, amount, hpAfter, coverBonus}`（sourceId 为
  "hazard" 时表示地形伤害）
- `healed {sourceId, targetId, amount, hpAfter}`
- `status_added / status_removed {unitId, statusId, ...}`
- `interacted / objective_progressed {actorId/targetId, durabilityAfter, completed}`
- `unit_disabled {unitId}`、`turn_advanced {round, ...}`、`battle_finished {outcome}`

玩家回合与敌方回合的事件在控制器里已汇集（`resolveBattleResult` 的
`events`）。新增：

- `WorldBattleSnapshot` 增加 `battleLog: readonly BattleEvent[]`——自动序
  列期间跨回合累积，每次运行开始清空；控制器内存态，不进世界存档。
- 战斗视图新增可滚动日志面板：事件渲染为可读文案（复用
  `battle-feedback.ts` 的格式化思路），新条目在底部、自动滚动。
- 无需状态差分：所有动画数据都来自引擎事件本身。

## 三、动画渲染（纯 CSS，无新依赖）

| 事件 | 动画 |
|---|---|
| moved | 单位元素 300ms 缓动滑到新格 |
| damaged | 攻击者（sourceId，含敌方）向目标扑击 150ms + 受击者红色闪烁 + 浮动 "-4" 伤害数字升起淡出；sourceId 为 hazard 时只演受击 |
| healed | 绿色闪烁 + "+3" 浮动 |
| status_added | 防御类状态（defenseBonus>0）护盾描边，本回合生效 |
| interacted / objective_progressed | 目标格脉冲高亮 |
| unit_disabled | 单位灰化淡出，留在场上 |

渲染器改造（`render-game.ts` 战斗棋盘）：从每次快照全量重绘改为**按
unitId 键控差分更新**——单位元素保持 DOM 身份，位置变化走 CSS
transition，事件批次触发一次性动画 class，动画结束后移除。伤害数字为附
加到受击单位的临时元素，动画结束自移除。

## 四、教学配套

- `python-marsh-01.ts` 的 `choose_turn` 注释重写：说明一次运行会连续调用
  本函数直到战斗结束、每回合 `world` 都在变、目标死后静态命令会报错；示例
  给出读 `world["units"]` + if 选存活敌人的写法。
- 战斗视图"运行回合"按钮文案改为"运行回合（自动连续）"。

第一章守卫战调整（仅 python-marsh-01，不动共享的 `marsh-slice.ts` 工厂，
go 战役不受影响）：lurker 激活——`disabled: false`、`visibility:
"revealed"`、起始格 (2,0)、加入 `turnOrder`，行为 `hunt-player`。推演结
果：静态 attack golem 在第 3 回合（golem 已死）必然 INVALID_TARGET 中断，
强制"读状态 + 条件选目标"；分支策略 4 回合获胜、scout 剩 1 血，mend 留
作容错。

## 五、测试

`world-campaign-controller.test.ts`（FakeRunner 适配多次执行）：

- 正常路径：一次 `runCode` 消费多条命令直至战斗胜利并结算。
- 关键失败路径：序列中途命令被拒 → 循环停止、反馈显示错误；再次运行从遭
  遇初始局面重新开始。
- 事件累积：自动序列的 `battleLog` 依次包含各回合引擎事件。
- 探索运行不受影响（单命令）。

渲染侧（`render-game` 相关测试）：单位元素按 id 复用（位置更新不重建节
点）、事件触发对应动画 class、日志面板追加条目。

## 六、实施顺序

一份计划、两段任务，各自独立可验收：

1. **控制器机制段**：自动循环 + 重置语义 + 事件生成 + 日志面板 + 节奏。
   完成即是可用版本（文本日志 + 棋盘逐步刷新）。
2. **渲染动画段**：键控差分渲染 + 全套事件动画。

## 非目标

- 不改 AppController（go 战役 / 浏览器六关阶梯路径）。
- 不加概念检测器；不做第二章内容；不加每关开关。
- 不改探索层任务设计。
- 日志不持久化到世界存档。
