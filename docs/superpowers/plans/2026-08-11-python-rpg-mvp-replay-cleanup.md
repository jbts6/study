# Python RPG MVP Replay Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从当前 MVP 删除未接入主流程的 Replay/JCS 实现与过时详细计划，并把战斗重放移动到 MVP 后 Roadmap。

**Architecture:** 战斗内核只保留状态、命令、归约和 WorldView。固定战斗端到端测试直接验证最终状态；未来重放从 MVP 后的真实游戏与存档格式重新设计，不兼容当前未上线的数据结构。

**Tech Stack:** TypeScript 7、Vitest 4、npm、Markdown

## Global Constraints

- 项目是个人、本地运行的六关单人 RPG，不为公网、多用户或恶意输入设计。
- 当前删除 13 个 Replay/JCS 专用测试，不新增替代测试文件。
- 战斗端到端测试只保留 `phase`、`revision` 和 golem `hp` 三个最终结果断言。
- 验证仅运行 `src/game/combat` 与生产构建。
- 最终 `docs/superpowers/plans/` 中的 Python RPG 文件只保留 Roadmap 和 Local Simplification。

---

### Task 1: 从 MVP 删除 Replay/JCS

**Files:**
- Modify: `rpg/src/game/combat/combat-core.e2e.test.ts`
- Modify: `rpg/src/game/combat/types.ts:27-31`
- Delete: `rpg/src/game/replay/canonical-hash.ts`
- Delete: `rpg/src/game/replay/canonical-hash.test.ts`
- Delete: `rpg/src/game/replay/replay.ts`
- Delete: `rpg/src/game/replay/replay.test.ts`
- Modify: `rpg/package.json`
- Modify: `rpg/package-lock.json`

**Interfaces:**
- Consumes: `createFixtureState(): BattleState`、`fixtureCommands`、`resolveTurn(state, command): TurnResolution`
- Produces: 不含 Replay 类型或哈希依赖的战斗内核

- [ ] **Step 1: 将端到端测试改为最终状态测试**

用以下内容替换 `combat-core.e2e.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { createFixtureState, fixtureCommands } from "../testing/fixture";
import { resolveTurn } from "./resolve-turn";

describe("core fixture", () => {
  it("finishes the fixed combat flow", () => {
    let state = createFixtureState();

    for (const command of fixtureCommands) {
      const result = resolveTurn(state, command);
      expect(result.accepted).toBe(true);
      if (!result.accepted) throw new Error("fixture command rejected");
      state = result.state;
    }

    expect(state.phase).toBe("won");
    expect(state.revision).toBe(5);
    expect(state.units.find((unit) => unit.id === "golem")?.hp).toBe(0);
  });
});
```

- [ ] **Step 2: 运行单条测试确认主流程仍通过**

Run:

```bash
npm --prefix rpg test -- src/game/combat/combat-core.e2e.test.ts
```

Expected: 1 file、1 test 通过。

- [ ] **Step 3: 删除 Replay 代码、测试和类型**

删除 `rpg/src/game/replay/` 目录，并从 `types.ts` 完整删除 `ReplayMetadata`、`ReplayStep`、`Replay`、`ReplayMismatch` 和 `ReplayVerification` 五个类型声明。它们位于当前文件第 27–31 行，没有其他生产调用方。

- [ ] **Step 4: 删除 canonicalize 依赖**

Run:

```bash
npm --prefix rpg uninstall canonicalize
```

Expected: `package.json` 和 `package-lock.json` 不再包含 `canonicalize`。

- [ ] **Step 5: 验证战斗范围和构建**

Run:

```bash
npm --prefix rpg test -- src/game/combat
npm --prefix rpg run build
```

Expected: 4 个战斗测试文件、27 个测试通过；TypeScript 与 Vite 构建通过。

- [ ] **Step 6: 提交代码收敛**

```bash
git add rpg/package.json rpg/package-lock.json rpg/src/game
git commit -m "refactor: defer combat replay until after mvp"
```

### Task 2: 收敛 Roadmap 与计划目录

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-python-rpg-roadmap.md`
- Modify: `README.md:74`
- Delete: `docs/superpowers/plans/2026-08-10-python-rpg-app-shell.md`
- Delete: `docs/superpowers/plans/2026-08-10-python-rpg-combat-core.md`
- Delete: `docs/superpowers/plans/2026-08-10-python-rpg-python-runner.md`
- Delete: `docs/superpowers/plans/2026-08-11-python-rpg-stage2-runner-remediation.md`
- Delete: `docs/superpowers/plans/2026-08-11-python-rpg-mvp-replay-cleanup.md`

**Interfaces:**
- Consumes: 已确认的 MVP 范围与 `AGENTS.md` 本地单人前提
- Produces: 一个当前 Roadmap、一个近期 Runner 简化记录、一个设计规格

- [ ] **Step 1: 从 MVP Roadmap 移除 Replay 依赖**

在 Roadmap 中执行以下文本收敛：

```text
“阶段 1 的战斗内核与 Replay 已完成” → “阶段 1 的战斗内核已完成”
“阶段 1：确定性战斗内核与 Replay” → “阶段 1：确定性战斗内核”
删除“Replay 只记录战斗内核接受的命令，并能重放正常战局”
“串联 Runner、resolveTurn、Replay 和 UI” → “串联 Runner、resolveTurn 和 UI”
“保存当前关卡、战斗状态、Replay 和代码草稿” → “保存当前关卡、战斗状态和代码草稿”
```

- [ ] **Step 2: 增加 MVP 后重放章节**

在“最终交付门槛”之后、“止损规则”之前加入：

```markdown
## MVP 后增强

- [ ] 战斗重放先记录回合指令和必要事件，用于本机复盘。
- [ ] 只有出现跨版本回放、分享、比赛复现或存档验证需求时，才增加确定性哈希和版本兼容。
- [ ] 重放基于 MVP 完成后的真实游戏状态与存档格式重新设计，不兼容当前已删除的未上线结构。
```

- [ ] **Step 3: 更新 README 文档入口**

将 README 的目录说明改为：

```markdown
- `docs/superpowers/plans/`：当前 Roadmap 与近期实施记录。
```

- [ ] **Step 4: 删除五份详细计划**

删除四份过时计划和本临时执行计划。完成后 Python RPG 计划目录只剩：

```text
2026-08-10-python-rpg-roadmap.md
2026-08-11-python-rpg-local-simplification.md
```

- [ ] **Step 5: 检查文档和残留引用**

确认：

```text
rpg/src 中没有 Replay、canonicalHash 或 canonicalize 引用
Roadmap 中 Replay 只出现在“MVP 后增强”
README 的两个本地 Markdown 链接均存在
```

- [ ] **Step 6: 提交文档收敛**

```bash
git add README.md docs/superpowers
git commit -m "docs: move combat replay beyond mvp"
```

## Done Criteria

- [ ] Replay/JCS 源码、13 个专用测试、五个 Replay 类型和 `canonicalize` 已删除。
- [ ] 战斗端到端测试仅保留三个最终结果断言。
- [ ] `npm --prefix rpg test -- src/game/combat` 显示 4 files、27 tests 通过。
- [ ] `npm --prefix rpg run build` 通过。
- [ ] Roadmap 把重放列为 MVP 后增强。
- [ ] Python RPG 计划目录只保留 Roadmap 与 Local Simplification。
