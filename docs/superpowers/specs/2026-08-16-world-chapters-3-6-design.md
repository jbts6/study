# 世界战役第三至六章 — 设计

日期：2026-08-16
分支：`feat/world-chapters-3-6`（叠在 `feat/chapter-switch` 上）
总纲：`docs/superpowers/specs/2026-08-16-world-chapters-design.md`

## 通用结构（零新工程，全部复用第二章模板）

每章交付三件套：内容文件（`world-chapter-0N.ts`，按 `world-chapter-02.ts`
模板）、starter 重写（调度器 + 本章概念骨架 + print 提示，每行 ≤60 字符）、
推演测试（静态策略必败 / 概念策略必胜，引擎实测，败方证据与胜方回合数写
进测试注释）。

- 新地点从锈沼营地直连；`travelRequirements` 挂上一章完成旗标；travel 到
  章节起点自动切章（机制已就位）。
- 任务链节奏：数据热身步（`targetFromState`，错目标拒绝并告知正确目标）→
  `enterBattle` → 胜利回营 `returnLocationId` → `reportStep`（talk toma，
  设下一章解锁旗标）。
- 遭遇 = `marsh-0N` 战场 + 最少必要覆写 + `injectUnlockedAbilities`；新增
  敌人行为走遭遇级 `enemyBehaviors` 覆写。
- 数值原则：先用原战场推演，不过再加压。

## 章节

### 第三章 勘测印记（for 遍历选目标）

- 章节 `python-marsh-03` / 任务 `survey_ridge` / 地点 `survey-ridge` /
  遭遇 `survey_pack`。
- 解锁：`venom_fork_cleared`（第二章报告旗标）。
- 热身：三根勘测桩（stake-north/east/west），status 静态（一根
  `charged` 两根 `drained`），正确目标 = charged 桩。玩家用
  `print(world["objects"])` 发现 + for/if 按 status 筛选；starter 骨架给
  出遍历写法。
- 战斗覆写：marsh-03 战场 + `hunter-c`（5 血，atk 2，move 1，hunt-player，
  出生 (3,1)），`turnOrder` 加hunter-c，`maxRounds` 按推演调（基线 12）。
- 强制点：固定目标死后必报错（INVALID_TARGET）；胜法 = 遍历 units 选血量
  最低的活敌（for + 比较）+ 先激活 scout-mark 再杀最后敌人（引擎次序目
  标已强制）。
- 奖励 `renew` → 第四章起双治疗。

### 第四章 双重封锁（and/or 组合条件）

- 章节 `python-marsh-04` / 任务 `lock_yard` / 地点 `lock-yard` / 遭遇
  `lockdown_pair`。解锁：`survey_ridge_cleared`。
- 热身：两道闸门（gate-a/gate-b），正确目标 = `copper_wire ≥ 1`
  **and** `venom_fork_cleared` 为真 → gate-a，否则 gate-b（玩家写 and）。
- 战斗：marsh-04 原生组合决策（护 relay + 激活 seal + corruptor/guard +
  危险格），先按原数值推演：单条件策略必败（只追敌不看血 → 被 guard 换
  死；只看血不管场面 → relay 被毁 / seal 超时）；胜法每个决策点都是组合
  条件。不过再调 relay 耐久或敌方数值。
- scout 注入 ward + pierce + renew。

### 第五章 裂隙节点（辅助函数）

- 章节 `python-marsh-05` / 任务 `rift_nodes` / 地点 `rift-nodes` / 遭遇
  `rift_guardians`。解锁：`lock_yard_cleared`。
- 热身：三块入口石，正确目标按 status 计算；starter 调度器示范两段式
  （先 `pick_entry(world)` 算目标、再定动作），函数边界自然浮现。
- 战斗：marsh-05 原生多阶段（node-a → node-b → hunter → guard）。**函数
  拆分不做机械强制**（无法检测代码结构），强制点在策略层：硬编码次序在
  敌人位移后 movePath 落空；starter 骨架给 `def attack_target(world,
  unit_id)`、`def go_interact(world, node_id)` 式辅助函数，拆函数是明摆
  着的甜点。
- scout 注入 + fracture。

### 第六章 沼心封印（综合）

- 章节 `python-marsh-06` / 任务 `marsh_heart` / 地点 `marsh-heart` / 遭遇
  `marsh_heart_final`。解锁：`rift_nodes_cleared`。
- 热身：综合（遍历对象表 + 组合条件选征兆石 omen-a/omen-b）。
- 战斗：marsh-06 原样（三敌 + final-seal + 18 回合 + 危险格），全技能。
  胜法综合全部概念；`victory.campaignComplete = true`（无 reportStep，
  任务直接完成，settlementFeedback 已有战役终局文案）。
- scout 注入 + aegis。

## 能力节奏

`LEVEL_UNLOCKS` 现成：三章 ward+pierce；四章 +renew；五章 +fracture；
六章 +aegis——工具箱随章节长大。

## 旗标链

`venom_fork_cleared`（二章已设）→ 解锁三章；三章报告设
`survey_ridge_cleared` → 四章；四章设 `lock_yard_cleared` → 五章；五章设
`rift_nodes_cleared` → 六章；六章 campaignComplete 终局。

## 测试与交付

- 每章：链测试 2 条（travel 切章 + 热身正确/错误目标）+ 推演 2 条（必
  败策略 / 必胜策略）+ starter 断言更新（`levels.test.ts` 脚手架检查随新
  starter 调整；`reference-solutions.test.ts` 跑战术战场不受覆写影响）。
- 章节按钮自动扩展（`levelOrder` 驱动，已就位）。
- 单分支四任务，每章独立可验收；最后统一 `npm run install:local`。

## 非目标

- 不改任何机制（探索/战斗/渲染）。
- 不做代码结构检测。
- 不新增探索命令类型；热身步复用现有 inspect/collect。
