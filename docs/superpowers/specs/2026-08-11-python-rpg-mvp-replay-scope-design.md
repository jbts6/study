# Python RPG MVP 重放范围收敛设计

## 结论

战斗重放有产品价值，但不属于当前六关本地单人 MVP。现有 Replay/JCS 哈希实现未接入游戏主流程，却提前引入了哈希、版本校验、快照复制和额外依赖。本次从 MVP 代码中删除该实现，并在 Roadmap 中明确列为 MVP 完成后的增强项。

## 目标

- 当前战斗内核只保留实际主流程需要的状态、命令、归约和 WorldView。
- 保留一条端到端战斗测试，直接证明固定输入能够得到正确最终状态。
- 删除当前没有调用方的重放代码、类型、测试和依赖。
- 将重放移到 MVP 后，避免当前阶段承担跨版本兼容和防篡改设计。
- 删除已经完成或已失效的 RPG 详细实施计划，保留一个当前 Roadmap 和一份本地 Runner 简化实施记录。

## 当前 MVP 变更

### 战斗代码

删除以下实现：

- `rpg/src/game/replay/canonical-hash.ts`
- `rpg/src/game/replay/canonical-hash.test.ts`
- `rpg/src/game/replay/replay.ts`
- `rpg/src/game/replay/replay.test.ts`
- `rpg/src/game/combat/types.ts` 中仅供 Replay 使用的类型
- `rpg/package.json` 与 `rpg/package-lock.json` 中的 `canonicalize` 依赖

`combat-core.e2e.test.ts` 继续运行同一段固定战斗流程，但不再创建或校验 Replay。测试直接断言战斗结束、胜方、最终单位状态和关键事件结果。

当前没有生产代码调用 Replay，也没有公开 API 或持久化存档依赖这些类型，因此不需要迁移层、兼容读取器或废弃周期。

### 文档收敛

删除以下过时详细计划：

- `2026-08-10-python-rpg-app-shell.md`
- `2026-08-10-python-rpg-combat-core.md`
- `2026-08-10-python-rpg-python-runner.md`
- `2026-08-11-python-rpg-stage2-runner-remediation.md`

保留并更新：

- `2026-08-10-python-rpg-roadmap.md`：当前唯一产品路线图。
- `2026-08-11-python-rpg-local-simplification.md`：最近一次 Runner 简化的实施记录。
- `README.md`：只把 `docs/superpowers/plans/` 描述为当前路线图与近期实施记录，不再暗示其中保存全部历史阶段计划。

## MVP 后重放方向

Roadmap 在 MVP 交付门槛之后增加“后续增强”章节。战斗重放按以下顺序重新评估：

1. 先记录玩家回合指令和必要战斗事件，用于本机复盘。
2. 只有出现跨版本回放、分享、比赛复现或存档验证需求时，才增加确定性哈希和版本兼容。
3. 新实现以届时的真实游戏状态和存档格式为输入，不兼容当前未上线的 Replay 数据结构。

## 非目标

- 本次不实现新的行动日志或重放界面。
- 本次不保留隐藏开关、空壳接口或兼容类型。
- 本次不为未来重放预留 `canonicalize`、加密哈希或版本迁移代码。
- 本次不删除与 RPG 无关的 Go、Rust、Python 学习计划或规格文档。

## 验收标准

- `rpg/src/game/replay/` 不再存在，生产源码没有 Replay/JCS 引用。
- `canonicalize` 不再出现在包清单和锁文件中。
- 战斗端到端测试直接验证最终状态并通过。
- Roadmap 将重放列为 MVP 后增强，而不是阶段 1 完成项或 MVP 交付门槛。
- 四份过时详细计划已删除，README 的文档入口描述与实际文件一致。
- `npm --prefix rpg test -- src/game` 通过。
- `npm --prefix rpg run build` 通过。
