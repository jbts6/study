# 世界战役第二章 + 探索自动推进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 探索层自动推进（调度器模式）+ 数据驱动章节地基 + 第二章（毒沼岔路）完整落地。

**Architecture:** `resolveWorldCommand` 分层变三段：结构校验（现有）→ 链校验（新 `validate-quest-step`）→ 数据驱动 reduce（重写 `reduce-world`）；胜利结算从章节 `victory` 声明读取；控制器探索模式套自动循环（复用战斗循环基建）；第二章为新增内容文件数据。

**Tech Stack:** TypeScript + vitest，VS Code 扩展。

**Spec:** `docs/superpowers/specs/2026-08-16-world-chapters-design.md`

## Global Constraints

- 第一章全链迁移到数据驱动后行为不变（现有 `resolve-world-command.test.ts`、`world-campaign-controller.test.ts` 全部保持绿）。
- 探索步数上限常量 `EXPLORATION_STEP_LIMIT = 30`；节奏复用 `turnDelayMs`。
- 世界遭遇允许覆写单位数值强制概念（lurker 先例），须有引擎推演测试证明"静态命令必败、条件分支可胜"。
- starter 每行 ≤60 字符（`levels.test.ts` 守护）。
- 改完 `rpg/` 后 `npm run install:local`。
- 第三到六章不实现（设计文档留档）。

---

### Task 1: 数据驱动章节链（类型 + 链校验 + reduce 重写 + 第一章迁移 + 胜利结算泛化）

**Files:**
- Modify: `rpg/src/game/content/world/types.ts`（`QuestStep`、`ChapterDefinition` 扩展）
- Create: `rpg/src/game/world/validate-quest-step.ts`
- Modify: `rpg/src/game/world/resolve-world-command.ts`（插入链校验）
- Modify: `rpg/src/game/world/reduce-world.ts`（数据驱动重写）
- Modify: `rpg/src/game/world/settle-encounter.ts`（胜利读章节声明）
- Modify: `rpg/src/game/content/python/world-chapter-01.ts`（第一章链数据化）
- Test: `rpg/src/game/world/resolve-world-command.test.ts`

**Interfaces:**
- Produces: `validateQuestStep(state, content, command): Readonly<{ ok: true; step: QuestStep }> | Readonly<{ ok: false; error: WorldCommandError }>`；`QuestStep`/`ChapterDefinition` 新字段（见规格二节，含 `targetFromState`、`consumeItem`、`prepareBattle` accept）。

- [ ] **Step 1: 写失败测试**

```ts
it("rejects a command that does not match the current quest step", () => {
  const state = createPythonWorldInitialState(); // 当前步骤 talk_to_toma
  const result = resolveWorldCommand(state, PYTHON_WORLD_CONTENT, {
    expectedRevision: state.revision, type: "inspect", targetId: "scrap_pile",
  });
  expect(result.accepted).toBe(false);
  if (!result.accepted) {
    expect(result.errors[0]?.message).toContain("当前步骤是 talk_to_toma");
  }
});

it("rejects a wrong target for the current step with a teaching error", () => {
  // 推进到 inspect_scrap_pile 后 inspect weather_station（在营地、结构合法，
  // 但不是当前步骤目标）
  // 断言 accepted false 且 message 含 "scrap_pile"
});
```

- [ ] **Step 2: 确认失败**：`npx vitest run src/game/world/resolve-world-command.test.ts`（新用例 FAIL：当前无链校验，错目标/错步骤仍被接受或不推进）。

- [ ] **Step 3: 实现**

`types.ts` 按规格二节扩展（`questChain`、`victory`、`QuestStep` 全字段）。

`validate-quest-step.ts`：

```ts
export function validateQuestStep(
  state: Readonly<GameState>,
  content: WorldCampaignContent,
  command: WorldCommand,
): Readonly<{ ok: true; step: QuestStep }> | Readonly<{ ok: false; error: WorldCommandError }> {
  const chapter = content.chapters[state.chapterId];
  const quest = state.quests[0];
  if (chapter === undefined || quest === undefined || quest.status === "completed") {
    return { ok: false, error: { code: "TASK_CONDITION_UNMET", path: "type", message: "当前没有进行中的任务" } };
  }
  const step = chapter.questChain.find((candidate) => candidate.stepId === quest.stepId);
  if (step === undefined) return { ok: false, error: { code: "TASK_CONDITION_UNMET", path: "type", message: `未知任务步骤: ${quest.stepId}` } };
  const accept = step.accept;
  if (command.type !== accept.type) {
    return { ok: false, error: { code: "TASK_CONDITION_UNMET", path: "type", message: `当前步骤是 ${step.stepId}，需要 ${accept.type} 指令` } };
  }
  const expectedTarget = accept.targetFromState !== undefined ? accept.targetFromState(state) : accept.targetId;
  if (expectedTarget !== undefined) {
    const actual = "targetId" in command ? command.targetId
      : "locationId" in command ? command.locationId
      : "encounterId" in command ? command.encounterId : undefined;
    if (actual !== expectedTarget) {
      return { ok: false, error: { code: "TASK_CONDITION_UNMET", path: "targetId", message: `当前步骤是 ${step.stepId}，目标应该是 ${expectedTarget}，收到 ${actual ?? "无"}` } };
    }
  }
  if (accept.itemId !== undefined && command.type === "use" && command.itemId !== accept.itemId) {
    return { ok: false, error: { code: "TASK_CONDITION_UNMET", path: "itemId", message: `当前步骤需要使用 ${accept.itemId}` } };
  }
  return { ok: true, step };
}
```

`resolve-world-command.ts`：结构校验通过后调 `validateQuestStep`，失败则 `{ accepted: false, errors: [error], state }`。

`reduce-world.ts` 重写为效果应用器：匹配 `validateQuestStep` 已保证；应用 `effects`（flags 合并、addClue、addItem/removeItem、advanceTo（`"completed"` 时置 quest 完成）、enterBattle（从 encounter 建 battle）、switchChapter（`chapterId` 切换 + quests 重置为新章链首步 `{ id, status: "active", stepId: 首步 }`）、travel 更新 locationId、use 消耗、collect 沿用 itemSources 定义加物并记 `collected:` 旗标）。第一章九步链（talk→inspect→collect→inspect→travel→use→prepareBattle→胜利结算→report talk）全部数据化进 `world-chapter-01.ts`；`settle-encounter.ts` 胜利分支改读 `chapter.victory`（returnLocationId/setFlags；`advanceTo` 语义：胜利后任务推到 `victory` 声明的 `reportStep`——第一章为 `submit_report`；第六章 `campaignComplete` 时任务直接完成）。

> 实现时以现有 reduce-world 各分支的精确行为为基准逐一映射（旗标名、clue 名、消耗数量），迁移后跑全量测试核对。

- [ ] **Step 4: 全量测试**：`npm test` 全绿（第一章行为回归靠既有 8 个链用例 + 控制器全章用例）。
- [ ] **Step 5: 提交**：`feat: drive world quests from chapter data`

---

### Task 2: 探索自动推进（控制器循环 + 步数上限 + 遭遇检查点）

**Files:**
- Modify: `rpg/src/app/world-campaign-controller.ts`
- Test: `rpg/src/app/world-campaign-controller.test.ts`

**Interfaces:**
- Consumes: Task 1 的链校验拒绝（结构合法但步骤不符 → accepted false）。
- Produces: 探索模式一次 `runCode` 连续消费多条命令；`resolveResult` 返回 `"continue" | "stopped"` 扩展到探索分支。

- [ ] **Step 1: 写失败测试**

```ts
it("auto-walks exploration steps until the encounter checkpoint", async () => {
  // FakeRunner 队列：talk → inspect → collect → inspect → travel → use → prepareBattle（7 条）
  // 一次 runCode 后：runner.requests 全部消费、快照 mode === "battle"、
  // feedback 提到"遭遇"
});

it("stops the exploration walk on a rejected command and resumes from the same step", async () => {
  // 队列：talk → inspect(错误目标) → 停；补正确队列再 runCode 从 inspect_scrap_pile 继续
  // 断言第二次首条 request 的 worldView revision 接续（不回退）
});

it("stops the exploration walk at the step limit", async () => {
  // 无限 talk 的队列 + 探索步上限注入为 3 → 停止并提示步数上限
});
```

- [ ] **Step 2: 确认失败**（当前探索一次只执行一条命令）。

- [ ] **Step 3: 实现**

`runCurrent` 循环对探索模式同样生效：`resolveExplorationResult` 返回值——
命令被拒 → `"stopped"`；接受且应用后 `state.battle !== null`（enterBattle 已建战斗）→ 替换快照后返回 `"stopped"`，feedback 追加"遭遇开始，再次运行进入自动战斗"；接受且战斗仍为 null → `"continue"`。步数计数在循环内递增，超过 `explorationStepLimit`（依赖注入，默认 `EXPLORATION_STEP_LIMIT = 30`）→ 停止并设 feedback 提示步数上限。节奏沿用 `turnDelayMs`。

- [ ] **Step 4: 全量测试**（既有控制器用例中逐条 runCode 驱动探索的需按新语义合并——一次 runCode 可连走多步，调整调用次数与断言，不改语义结论）。
- [ ] **Step 5: 提交**：`feat: auto-walk exploration with dispatcher runs`

---

### Task 3: 第二章内容（毒沼岔路）+ 数值强制推演

**Files:**
- Modify: `rpg/src/game/content/python/world-chapter-01.ts`（venom-fork 地点/对象/遭遇/章节定义；文件过大时拆 `world-chapter-02.ts` 并在内容聚合处合并）
- Modify: `rpg/src/game/content/python/python-marsh-02.ts`（starter 重写：调度器 + if 战斗示例 + print 提示）
- Test: `rpg/src/app/world-campaign-controller.test.ts`（第二章链与切换）；引擎推演测试（临时或保留为内容测试）

**Interfaces:**
- Consumes: Task 1/2 全部机制。
- Produces: 章节 `python-marsh-02`、地点 `venom-fork`、遭遇 `venom_guardian`。

- [ ] **Step 1: 数值推演（先于内容定稿）**

用引擎管线（`validateLevelCommand` + `resolveTurn` + `enemyCommand`，参考 Task 0 lurker 的调试测试写法）模拟 marsh-02 战斗：
1. 静态命令（固定 attack corruptor）打完整场 → **必须失败**；
2. 条件分支策略（血量 ≤ 阈值 → mend；位于危险格 → 移动/guard；否则攻击）→ 必须胜利。
若静态可胜，按预选方案加压（调低 relay 耐久 / 提高危险格伤害 / 覆写 corruptor 数值），直至两条同时满足。推演结论（数值与回合数）写进测试注释。

- [ ] **Step 2: 写失败测试**

```ts
it("unlocks and enters chapter two through the venom fork chain", async () => {
  // 第一章全流程完成后（复用 ChapterFlowRunner 打完整章），
  // travel venom-fork → switchChapter 生效：chapterId === "python-marsh-02"、
  // 新 starter 草稿（codeDraft 含 "venom" 相关调度注释）
});

it("resolves the conditional signal tower step from inventory state", async () => {
  // 第一章结算后玩家铜线库存为 0（use 消耗）→ 正确目标是 signal-tower-b；
  // inspect signal-tower-a 被拒（教学错误含 signal-tower-b），inspect b 推进
});

it("enforces conditional survival in the venom guardian battle", async () => {
  // 引擎推演：静态 attack corruptor 序列 → 战斗 lost；
  // 分支策略序列（低血 mend + 危险格位移 + 攻击）→ 战斗 won
});
```

- [ ] **Step 3: 确认失败 → 实现内容**

- 地点 `venom-fork`（连 rust-marsh-camp；`travelRequirements` 挂 `chapter_02_unlocked`）；对象 `waysign`、`signal-tower-a`、`signal-tower-b`。
- 章节 `python-marsh-02` 链：`inspect waysign`（addClue 补给说明）→ 数据步 `inspect`（`targetFromState`: 库存 copper_wire ≥1 → a 否则 b；正确塔 addClue 战斗情报）→ `enterBattle: venom_guardian`。
- 遭遇 `venom_guardian`：`initialBattle` 取 marsh-02 战场 + Step 1 推演的覆写；`injectUnlockedAbilities("python-marsh-02", ...)`。
- `victory`: `returnLocationId: "rust-marsh-camp"`，`setFlags: { venom_fork_cleared: true }`，`reportStep` 提交步（talk toma 收尾，获得 pierce 的叙事）。
- starter（`python-marsh-02.ts`）：`choose_world_action` 调度器示例（stepId 分支 + 读库存选塔）+ `choose_turn` if 取舍示例（血量/mend、危险格/移动）+ `print(world["objects"])` 实验提示；每行 ≤60 字符。

- [ ] **Step 4: 全量测试 + typecheck**
- [ ] **Step 5: 提交**：`feat: add venom fork chapter with conditional enforcement`

---

### Task 4: 交付

- [ ] **Step 1:** `cd rpg && npm run install:local`
- [ ] **Step 2:** 提醒用户重载窗口：第一章重玩即新体验（自动走链）；完成后 travel venom-fork 进第二章。
