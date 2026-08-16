# 探索命令文档补齐 — 设计

日期：2026-08-16
分支：`feat/world-command-docs`（基于 `feat/player-fileset-reset`）

## 问题

玩家在第一章任务链推进到 `travel_to_relay` 时卡住：starter 代码只展示了
`talk` 一种命令示例，`travel`/`use` 等其余命令格式的字段名（`locationId`、
`itemId`）没有任何可发现途径；世界命令校验器报错只说"指令包含未知字段"，
不给出正确格式。战斗侧已有两套成熟做法（`choose_turn` 注释菜谱 +
`validate-turn-command.ts` 报错内嵌格式示例），探索侧没有对齐。

真实玩家复现：`travel` 命令误填 `targetId`（沿用 talk/inspect/collect 的惯
性），校验失败且报错无纠正信息。

## 方案（已确认：补齐文档，字典形式不变）

### 改动 1：starter 注释菜谱

`rpg/src/game/content/python/python-marsh-01.ts` 的 `STARTER_CODE` 中，
`choose_world_action` 注释补全 6 种命令格式（talk / inspect / collect /
travel / use / prepareBattle），标注 travel 用 `locationId` 而非 `targetId`，
并提示可交互 id 从 `world["npcs"]`、`world["objects"]`、
`world["availableTravel"]` 读取。

### 改动 2：校验报错带格式示例

`rpg/src/game/world/validate-world-command.ts` 复用战斗侧
`validate-turn-command.ts` 的报错模式：

- 字段不符：给出该 type 的正确格式示例。
- type 不合法：列出全部支持的 type。
- TRAVEL_LOCKED / INVALID_TARGET：附带当前地点实际可用的 id 列表。

### 改动 3：界面帮助行

`rpg/src/app/render-world-app.ts` 的"world 字段"帮助组加一行命令 type
清单。

## 交付与送达

- 测试：更新 `validate-world-command.test.ts` 受影响断言；新增关键失败
  用例（travel 误用 targetId → 报错包含 locationId 格式示例）。
- 玩家文件送达：本分支叠在 `feat/player-fileset-reset` 上，版本号保持 2；
  迁移重置机制会把新 starter 发给存量玩家。
- 按仓库规约在 `rpg/` 运行 `npm run install:local` 并重载窗口。

## 非目标

- 不改命令协议（字典形式、字段白名单、`expectedRevision` 机制）。
- 不做 Python 函数 API 或界面动态模板。
- 不改战斗侧任何内容。
