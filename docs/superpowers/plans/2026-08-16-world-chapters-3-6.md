# Python 世界战役第 3–6 章 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Python 世界战役机制上补齐第 3–6 章，使玩家能从营地依次进入四章、完成数据驱动探索、自动战斗与结算，并在第六章结束战役。

**Architecture:** 复用第二章的内容工厂模式，每章新增一个只声明章节、地点、对象和遭遇的内容文件，由 `world-chapter-01.ts` 汇总。探索继续使用现有 `WorldCommand`、任务链和自动推进；战斗继续使用现有关卡战场并注入已解锁能力。唯一机制修改是结算层拒绝“战斗 phase 为 won，但非关键目标仍未完成”的伪胜利。

**Tech Stack:** TypeScript、Vitest、现有世界战役纯规则链、现有确定性战斗内核、VS Code Extension 本地安装流程。

## Global Constraints

- 信任本地代码；不增加远程执行、沙箱或额外安全协议。
- 不增加探索命令类型、任务 DSL、通用寻路器或代码结构检测。
- 第 3–6 章分别教学 `for` 遍历、`and/or` 组合条件、辅助函数和综合策略。
- 新地点均从 `rust-marsh-camp` 直连，并用上一章完成旗标限制旅行。
- 每章任务链为“数据热身 → 备战 → 战斗 → 报告”；第六章胜利直接完成战役，不设报告步骤。
- 遭遇从对应 `python-marsh-0N` 战场克隆，再调用 `injectUnlockedAbilities`。
- starter 同时包含 `choose_world_action` 与 `choose_turn`，每行不超过 60 个字符。
- 测试只覆盖正常路径和一个关键失败路径；每个任务运行定向测试，全部章节完成后才运行阶段性全量验证。
- 不修改 Go 战役、渲染机制、控制器协议或现有战斗关卡规则。
- 不覆盖或提交工作区已有的 `python-rpg/*.py` 玩家文件改动。
- 修改进入扩展包的 `rpg/` 内容后，最终必须在 `rpg/` 运行 `npm run install:local`。

## File Map

| 路径 | 职责 |
|---|---|
| `rpg/src/game/world/settle-encounter.ts` | 结算前验证全部非关键目标已完成 |
| `rpg/src/game/world/settle-encounter.test.ts` | 守护伪胜利按失败重置的关键路径 |
| `rpg/src/game/content/python/world-chapter-03.ts` | 第三章地点、对象、任务链和增强遭遇 |
| `rpg/src/game/content/python/world-chapter-04.ts` | 第四章地点、对象、组合条件任务链和遭遇 |
| `rpg/src/game/content/python/world-chapter-05.ts` | 第五章地点、对象、两段式目标任务链和遭遇 |
| `rpg/src/game/content/python/world-chapter-06.ts` | 第六章地点、综合目标任务链和终局遭遇 |
| `rpg/src/game/content/python/world-chapter-0N.test.ts` | 各章旅行/热身链和战斗策略推演 |
| `rpg/src/game/content/python/world-chapter-01.ts` | 汇总第 3–6 章内容，扩展营地出口与旅行条件 |
| `rpg/src/game/content/python/python-marsh-03.ts` | 第三章探索调度器与遍历策略 starter |
| `rpg/src/game/content/python/python-marsh-04.ts` | 第四章探索调度器与组合条件 starter |
| `rpg/src/game/content/python/python-marsh-05.ts` | 第五章探索调度器与辅助函数 starter |
| `rpg/src/game/content/python/python-marsh-06.ts` | 第六章探索调度器与综合策略 starter |
| `rpg/src/game/content/levels.test.ts` | 六章 starter、引导、奖励与行宽契约 |

---

### Task 0: 阻止未完成次要目标的伪胜利

**Files:**
- Modify: `rpg/src/game/world/settle-encounter.test.ts`
- Modify: `rpg/src/game/world/settle-encounter.ts`

**Interfaces:**
- Consumes: `GameState.battle.state.phase`、`BattleObjective.key`、`BattleObjective.completed`。
- Produces: `settleEncounter(state, content)` 只在 phase 为 `won` 且所有非关键目标完成时执行胜利结算。

- [ ] **Step 1: 写入失败测试**

在现有 `settleEncounter` describe 中加入以下用例。它复用第一章已准备的状态，仅把终局战场替换为“phase 为 won，但仍有未完成次要目标”：

```ts
it("retries a nominal win when a required objective is incomplete", () => {
  const prepared = prepareGuardianBattle();
  const nominalWin = {
    ...prepared,
    battle: {
      ...prepared.battle!,
      state: {
        ...prepared.battle!.state,
        phase: "won" as const,
        objectives: [
          ...prepared.battle!.state.objectives,
          {
            id: "required-mark",
            cell: { x: 1, y: 1 },
            durability: 1,
            completed: false,
            key: false,
          },
        ],
      },
    },
  };

  const retried = settleEncounter(nominalWin, PYTHON_WORLD_CONTENT);

  expect(retried.battle?.state.phase).toBe("in_progress");
  expect(retried.worldFlags.marsh_guardian_defeated).toBeUndefined();
  expect(retried.quests).toEqual(nominalWin.quests);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `cd rpg && npm test -- src/game/world/settle-encounter.test.ts`

Expected: 新用例 FAIL；当前实现会清空 battle 并设置胜利旗标。

- [ ] **Step 3: 实现最小结算门禁**

在 `settle-encounter.ts` 增加一个私有谓词，并用它收紧胜利分支：

```ts
function hasIncompleteRequiredObjective(
  state: NonNullable<GameState["battle"]>["state"],
): boolean {
  return state.objectives.some(
    (objective) => !objective.key && !objective.completed,
  );
}

const wonAllObjectives = activeBattle.state.phase === "won"
  && !hasIncompleteRequiredObjective(activeBattle.state);
if (wonAllObjectives) {
  // 保留现有胜利返回对象。
}
```

phase 为 `lost` 或 `won` 但次要目标未完成时都走现有遭遇重置分支；不增加新状态码或反馈协议。

- [ ] **Step 4: 验证并提交**

Run: `cd rpg && npm test -- src/game/world/settle-encounter.test.ts`

Expected: 1 个测试文件全部通过。

Run: `cd rpg && npm run typecheck`

Expected: `tsc --noEmit` 退出码 0。

Commit:

```bash
git add rpg/src/game/world/settle-encounter.ts rpg/src/game/world/settle-encounter.test.ts
git commit -m "fix: require world battle objectives before settlement"
```

---

### Task 1: 第三章“勘测印记”

**Files:**
- Create: `rpg/src/game/content/python/world-chapter-03.ts`
- Create: `rpg/src/game/content/python/world-chapter-03.test.ts`
- Modify: `rpg/src/game/content/python/world-chapter-01.ts`
- Modify: `rpg/src/game/content/python/python-marsh-03.ts`
- Modify: `rpg/src/game/content/levels.test.ts`

**Interfaces:**
- Produces: `createSurveyRidgeContent(): Pick<WorldCampaignContent, "chapters" | "locations" | "objects" | "encounters">`。
- Produces chapter `python-marsh-03`、location `survey-ridge`、quest `survey_ridge`、encounter `survey_pack`。
- Requires flag `venom_fork_cleared`; report sets `survey_ridge_cleared`。

- [ ] **Step 1: 写入章节链失败测试**

创建 `world-chapter-03.test.ts`，用 `resolveWorldCommand` 从营地完成态执行以下断言：

```ts
const readyForChapterThree: GameState = {
  ...createPythonWorldInitialState(),
  chapterId: "python-marsh-02",
  locationId: "rust-marsh-camp",
  worldFlags: { venom_fork_cleared: true },
  quests: [{ id: "venom_fork", status: "completed", stepId: "completed" }],
};

const traveled = apply(readyForChapterThree, {
  type: "travel",
  locationId: "survey-ridge",
});
expect(traveled.chapterId).toBe("python-marsh-03");
expect(traveled.quests[0]).toEqual({
  id: "survey_ridge",
  status: "active",
  stepId: "pick_survey_stake",
});

const wrong = resolve(traveled, {
  type: "inspect",
  targetId: "stake-north",
});
expect(wrong.accepted).toBe(false);
if (!wrong.accepted) {
  expect(wrong.errors[0]?.message).toContain("stake-east");
}

const inspected = apply(traveled, {
  type: "inspect",
  targetId: "stake-east",
});
expect(inspected.quests[0]?.stepId).toBe("prepare_survey_battle");
```

测试辅助 `apply` 与 `resolve` 必须给命令补上当前 `expectedRevision`，不得绕过生产校验。

- [ ] **Step 2: 写入战斗推演失败测试**

在同一文件复用生产链 `validateLevelCommand -> resolveTurn -> enemyCommand`：

- 固定目标策略始终攻击 `hunter-a`；该目标失能后的下一条命令必须被拒，推演判为失败。
- 概念策略先移动到 `scout-mark` 相邻格并交互，再遍历全部活敌，按 `hp` 从低到高选择目标；相邻时 attack，距离不超过 2 且 spark 可用时 cast，否则 guard。
- 概念策略必须在 `maxRounds` 内 phase 为 `won`，并且 `scout-mark.completed` 为 true。

Run: `cd rpg && npm test -- src/game/content/python/world-chapter-03.test.ts`

Expected: FAIL，因为章节内容尚未注册。

- [ ] **Step 3: 实现第三章内容工厂**

`createSurveyRidgeContent` 使用以下精确数据：

| 字段 | 值 |
|---|---|
| chapter | `python-marsh-03` |
| quest | `survey_ridge` |
| start location | `survey-ridge` |
| objects | `stake-north: drained`、`stake-east: charged`、`stake-west: drained` |
| quest steps | `pick_survey_stake` → `prepare_survey_battle` → `defeat_survey_pack` → `submit_survey_report` |
| correct warm-up target | `stake-east` |
| encounter | `survey_pack` / battle id `python-world-ch3-survey-pack` |
| victory | 回 `rust-marsh-camp`，设 `survey_pack_defeated`，进入 `submit_survey_report` |
| report | talk `toma`，设 `survey_ridge_cleared`，任务完成 |

遭遇从 `getLevel("python-marsh-03").initialBattle` 克隆，`maxRounds` 设为 12，新增：

```ts
{
  id: "hunter-c",
  team: "enemies",
  visibility: "revealed",
  cell: { x: 3, y: 1 },
  hp: 5,
  maxHp: 5,
  attack: 2,
  defense: 0,
  move: 1,
  initiative: 3,
  disabled: false,
  statuses: [],
  skills: [],
}
```

`turnOrder` 为 `["scout", "hunter-a", "hunter-b", "hunter-c"]`，遭遇行为补 `"hunter-c": { type: "hunt-player" }`，最终调用 `injectUnlockedAbilities("python-marsh-03", battle)`。

- [ ] **Step 4: 汇总内容并重写 starter**

在 `world-chapter-01.ts`：

- 导入并创建第三章内容；
- 合并其 `chapters`、`locations`、`objects`、`encounters`；
- 把 `survey-ridge` 加入营地 `connectedLocationIds`；
- 增加 `"survey-ridge": { venom_fork_cleared: true }`。

`STARTER_CODE_03` 必须定义两个函数：

- `choose_world_action` 按 `stepId` 分派；在 `pick_survey_stake` 中遍历 `world["objects"]`，选择 status 为 `charged` 的对象；在 `prepare_survey_battle` 返回 `prepareBattle/survey_pack`；报告阶段返回 `talk/toma`。
- `choose_turn` 给出遍历活敌、比较 `hp`、检查 `scout-mark.completed` 的骨架，默认返回 wait；不写出完整通关答案。

更新 `levels.test.ts` 的 starter 断言，验证第 3 关同时含两个函数、`for`、`objects`、`units`、`scout-mark`，并继续满足每行 60 字符上限。

- [ ] **Step 5: 验证并提交**

Run: `cd rpg && npm test -- src/game/content/python/world-chapter-03.test.ts src/game/content/levels.test.ts src/game/world/settle-encounter.test.ts`

Expected: 定向测试全部通过。

Run: `cd rpg && npm run typecheck`

Expected: 退出码 0。

Commit:

```bash
git add rpg/src/game/content/python/world-chapter-03.ts rpg/src/game/content/python/world-chapter-03.test.ts rpg/src/game/content/python/world-chapter-01.ts rpg/src/game/content/python/python-marsh-03.ts rpg/src/game/content/levels.test.ts
git commit -m "feat: add survey ridge world chapter"
```

---

### Task 2: 第四章“双重封锁”

**Files:**
- Create: `rpg/src/game/content/python/world-chapter-04.ts`
- Create: `rpg/src/game/content/python/world-chapter-04.test.ts`
- Modify: `rpg/src/game/content/python/world-chapter-01.ts`
- Modify: `rpg/src/game/content/python/python-marsh-04.ts`
- Modify: `rpg/src/game/content/levels.test.ts`

**Interfaces:**
- Produces: `createLockYardContent(): Pick<WorldCampaignContent, "chapters" | "locations" | "objects" | "encounters">`。
- Requires `survey_ridge_cleared`; report sets `lock_yard_cleared`。

- [ ] **Step 1: 写入章节链和推演失败测试**

创建测试并覆盖四个结果：

1. 营地完成态带 `survey_ridge_cleared: true`，travel `lock-yard` 后切到 `python-marsh-04`，初始步骤为 `pick_lock_gate`。
2. `targetFromState` 在“库存含至少 1 个 `copper_wire` 且 `venom_fork_cleared` 为 true”时只接受 `gate-a`；否则只接受 `gate-b`，错误消息包含正确 ID。
3. 只追击 guard 的单条件策略必须失败。
4. 组合策略先处理 corruptor、再激活 seal、最后用 pierce/spark 处理 guard，必须在 12 回合内获胜且 seal 完成。

Run: `cd rpg && npm test -- src/game/content/python/world-chapter-04.test.ts`

Expected: FAIL，因为第四章内容尚未注册。

- [ ] **Step 2: 实现第四章内容**

使用以下精确内容：

| 字段 | 值 |
|---|---|
| chapter / quest | `python-marsh-04` / `lock_yard` |
| location | `lock-yard`，对象 `gate-a`、`gate-b` |
| object status | `gate-a: copper_lock`、`gate-b: signal_lock` |
| steps | `pick_lock_gate` → `prepare_lockdown_battle` → `defeat_lockdown_pair` → `submit_lock_report` |
| encounter | `lockdown_pair` / `python-world-ch4-lockdown-pair` |
| victory/report | 设 `lockdown_pair_defeated`；报告设 `lock_yard_cleared` |

遭遇只克隆 `python-marsh-04`，改 battleId，并调用 `injectUnlockedAbilities("python-marsh-04", battle)`；不预先修改数值。敌方行为沿用关卡定义，不增加遭遇覆写。

- [ ] **Step 3: 汇总内容并重写 starter**

营地新增 `lock-yard` 出口，旅行要求为 `survey_ridge_cleared: true`；汇总第四章四类内容。

`STARTER_CODE_04`：

- 探索函数读取 inventory 和 worldFlags，使用 `and` 选择 gate-a/gate-b，并按步骤进入 `lockdown_pair` 或回营报告。
- 战斗函数保留“不对应答案”的组合条件示例，展示生命、目标完成、敌人状态和冷却如何用 `and/or/not` 组合，默认返回 wait。
- 更新 `levels.test.ts`，验证两个入口函数、`and`、`or`、`not` 和 `gate-a`/ `gate-b`，不验证完整答案。

- [ ] **Step 4: 验证并提交**

Run: `cd rpg && npm test -- src/game/content/python/world-chapter-04.test.ts src/game/content/levels.test.ts`

Run: `cd rpg && npm run typecheck`

Expected: 全部通过。

Commit:

```bash
git add rpg/src/game/content/python/world-chapter-04.ts rpg/src/game/content/python/world-chapter-04.test.ts rpg/src/game/content/python/world-chapter-01.ts rpg/src/game/content/python/python-marsh-04.ts rpg/src/game/content/levels.test.ts
git commit -m "feat: add lock yard world chapter"
```

---

### Task 3: 第五章“裂隙节点”

**Files:**
- Create: `rpg/src/game/content/python/world-chapter-05.ts`
- Create: `rpg/src/game/content/python/world-chapter-05.test.ts`
- Modify: `rpg/src/game/content/python/world-chapter-01.ts`
- Modify: `rpg/src/game/content/python/python-marsh-05.ts`
- Modify: `rpg/src/game/content/levels.test.ts`

**Interfaces:**
- Produces: `createRiftNodesContent(): Pick<WorldCampaignContent, "chapters" | "locations" | "objects" | "encounters">`。
- Requires `lock_yard_cleared`; report sets `rift_nodes_cleared`。

- [ ] **Step 1: 写入章节链和推演失败测试**

覆盖：

- travel `rift-nodes` 切到 `python-marsh-05`；
- 三块入口石中错误 ID 被拒，`entry-stone-b` 被接受并推进到 `prepare_rift_battle`；
- 把节点次序和敌方旧位置写死的策略必须因命令拒绝或超时失败；
- 使用 `pick_entry`、`go_interact`、`attack_target` 三个职责分离的测试策略，依次完成 node-a、node-b、hunter、guard，并在 14 回合内获胜。

Run: `cd rpg && npm test -- src/game/content/python/world-chapter-05.test.ts`

Expected: FAIL，因为第五章内容尚未注册。

- [ ] **Step 2: 实现第五章内容**

| 字段 | 值 |
|---|---|
| chapter / quest | `python-marsh-05` / `rift_nodes` |
| location | `rift-nodes` |
| objects | `entry-stone-a: unstable`、`entry-stone-b: aligned`、`entry-stone-c: dormant` |
| steps | `pick_rift_entry` → `prepare_rift_battle` → `defeat_rift_guardians` → `submit_rift_report` |
| correct target | `entry-stone-b` |
| encounter | `rift_guardians` / `python-world-ch5-rift-guardians` |
| victory/report | 设 `rift_guardians_defeated`；报告设 `rift_nodes_cleared` |

遭遇从 `python-marsh-05` 克隆、改 battleId、注入第五章能力；不改变原战场数值和敌方行为。

- [ ] **Step 3: 汇总内容并重写 starter**

营地新增 `rift-nodes`，旅行要求 `lock_yard_cleared: true`。

`STARTER_CODE_05` 必须包含实际可读的函数骨架：

```py
def pick_entry(world):
    ...

def go_interact(world, target_id):
    ...

def attack_target(world, unit_id):
    ...

def choose_world_action(world):
    ...

def choose_turn(world):
    ...
```

省略位置写为教学注释和安全默认返回值，不留下 Python `pass` 或运行即报错的占位。探索函数用 `pick_entry` 计算对象 ID再构造命令；战斗函数展示按 node-a、node-b、hunter、guard 的状态调用助手，但不提供完整移动答案。

更新 `levels.test.ts` 验证三个助手、两个入口函数和 60 字符行宽。

- [ ] **Step 4: 验证并提交**

Run: `cd rpg && npm test -- src/game/content/python/world-chapter-05.test.ts src/game/content/levels.test.ts`

Run: `cd rpg && npm run typecheck`

Expected: 全部通过。

Commit:

```bash
git add rpg/src/game/content/python/world-chapter-05.ts rpg/src/game/content/python/world-chapter-05.test.ts rpg/src/game/content/python/world-chapter-01.ts rpg/src/game/content/python/python-marsh-05.ts rpg/src/game/content/levels.test.ts
git commit -m "feat: add rift nodes world chapter"
```

---

### Task 4: 第六章“沼心封印”

**Files:**
- Create: `rpg/src/game/content/python/world-chapter-06.ts`
- Create: `rpg/src/game/content/python/world-chapter-06.test.ts`
- Modify: `rpg/src/game/content/python/world-chapter-01.ts`
- Modify: `rpg/src/game/content/python/python-marsh-06.ts`
- Modify: `rpg/src/game/content/levels.test.ts`

**Interfaces:**
- Produces: `createMarshHeartContent(): Pick<WorldCampaignContent, "chapters" | "locations" | "objects" | "encounters">`。
- Requires `rift_nodes_cleared`; victory has `campaignComplete: true` and no `reportStep`。

- [ ] **Step 1: 写入章节链和终战推演失败测试**

覆盖：

- travel `marsh-heart` 切到 `python-marsh-06`；
- 综合热身读取对象 status，并结合 `rift_nodes_cleared` 选择 `omen-a`；`omen-b` 被拒且错误含正确 ID；
- 只攻击最近敌人、忽略 final-seal 和 relay 的策略必须失败；
- 综合策略依次应对 corruptor、hunter、final-seal、guard，按冷却使用 ward/renew/aegis/fracture/pierce，在 18 回合内获胜，final-seal 完成且 relay durability 大于 0；
- `settleEncounter` 后 battle 为 null、任务 completed，并保留终局胜利旗标。

Run: `cd rpg && npm test -- src/game/content/python/world-chapter-06.test.ts`

Expected: FAIL，因为第六章内容尚未注册。

- [ ] **Step 2: 实现第六章内容**

| 字段 | 值 |
|---|---|
| chapter / quest | `python-marsh-06` / `marsh_heart` |
| location | `marsh-heart` |
| objects | `omen-a: converging`、`omen-b: scattered` |
| steps | `read_marsh_omen` → `prepare_marsh_heart` → `defeat_marsh_heart` |
| correct target | 前置旗标成立时 `omen-a`，否则 `omen-b` |
| encounter | `marsh_heart_final` / `python-world-ch6-marsh-heart-final` |
| victory | 回 `rust-marsh-camp`，设 `marsh_heart_sealed: true`，`campaignComplete: true`，无 reportStep |

遭遇克隆 `python-marsh-06`、改 battleId、注入全部已解锁能力；不改变原战场数值和行为。

- [ ] **Step 3: 汇总内容并重写 starter**

营地新增 `marsh-heart`，旅行要求 `rift_nodes_cleared: true`。

`STARTER_CODE_06`：

- 探索函数遍历 objects，组合 status 与 worldFlags 选择征兆石，按步骤进入终战；
- 战斗函数把敌人筛选、目标完成、relay durability、危险格、生命值和技能冷却汇总为数据判断入口；
- 只提供全部 API 契约和组织骨架，不给出逐回合答案；
- 更新 `levels.test.ts` 验证两个入口、遍历、组合条件、全部能力名和 60 字符行宽。

- [ ] **Step 4: 验证并提交**

Run: `cd rpg && npm test -- src/game/content/python/world-chapter-06.test.ts src/game/content/levels.test.ts src/game/world/settle-encounter.test.ts`

Run: `cd rpg && npm run typecheck`

Expected: 全部通过。

Commit:

```bash
git add rpg/src/game/content/python/world-chapter-06.ts rpg/src/game/content/python/world-chapter-06.test.ts rpg/src/game/content/python/world-chapter-01.ts rpg/src/game/content/python/python-marsh-06.ts rpg/src/game/content/levels.test.ts
git commit -m "feat: complete python world campaign"
```

---

### Task 5: 阶段性验证、扩展安装与交付

**Files:**
- Verify: `rpg/src/game/content/python/world-chapter-03.test.ts`
- Verify: `rpg/src/game/content/python/world-chapter-04.test.ts`
- Verify: `rpg/src/game/content/python/world-chapter-05.test.ts`
- Verify: `rpg/src/game/content/python/world-chapter-06.test.ts`
- Verify: `rpg/src/game/content/levels.test.ts`
- Verify: `rpg/src/game/content/reference-solutions.test.ts`
- Verify: `rpg/src/game/world/settle-encounter.test.ts`

**Interfaces:**
- Consumes: Tasks 0–4 的全部提交。
- Produces: 可安装的 `rpg/dist/python-rpg.vsix` 和本机已替换的 VS Code 扩展。

- [ ] **Step 1: 运行阶段性定向回归**

Run:

```bash
cd rpg
npm test -- src/game/content/python/world-chapter-03.test.ts src/game/content/python/world-chapter-04.test.ts src/game/content/python/world-chapter-05.test.ts src/game/content/python/world-chapter-06.test.ts src/game/content/levels.test.ts src/game/content/reference-solutions.test.ts src/game/world/settle-encounter.test.ts
```

Expected: 所列测试文件全部通过。

- [ ] **Step 2: 运行阶段性全量验证**

Run: `cd rpg && npm test`

Expected: 全量 Vitest 通过。

Run: `cd rpg && npm run typecheck`

Expected: 退出码 0。

Run: `cd rpg && npm run build`

Expected: Web、扩展和 Webview 构建成功；既有 bundle 大小警告不阻断。

- [ ] **Step 3: 安装本地扩展**

Run: `cd rpg && npm run install:local`

Expected: 生成 `rpg/dist/python-rpg.vsix`，并由 `code --install-extension ... --force` 成功替换本机扩展。

- [ ] **Step 4: 检查提交边界**

Run: `git status --short`

Expected: 本任务的生产代码和测试均已提交；原有玩家文件、会话状态和报告改动仍保持原样，没有被纳入章节提交。

Run: `git diff --check`

Expected: 无空白错误。

不创建额外“验证记录”提交；最终回复列出五个任务提交、验证命令结果以及 VS Code 需要执行的窗口重载动作。
