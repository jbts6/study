# Python RPG 第一章世界战役垂直切片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有 Go 战役和战斗内核的前提下，把 Python 战役首章改造成可在 VS Code 中完成“探索指令 -> 关键战斗 -> 遭遇结算 -> 存档恢复”的完整世界战役垂直切片。

**Architecture:** 保留现有 `BattleState`、战斗 `WorldView`、`TurnCommand` 和 `resolveTurn`，在 `game/world` 中新增独立的 `GameState`、`CampaignWorldView` 和 `WorldCommand` 纯规则链。Python 使用新的 `WorldCampaignController`，按 `GameState.battle` 在 `choose_world_action` 与 `choose_turn` 间切换；Go 继续使用现有 `AppController` 与 V2 存档。VS Code 会话只消费统一控制器接口和联合快照，不在 Webview 中实现世界规则。

**Tech Stack:** TypeScript 7、Vitest 4、VS Code Extension API、原生 DOM Webview、现有本地 Python Runner、现有确定性战斗内核。

## Global Constraints

- 采用增量双协议：探索新增 `CampaignWorldView` / `WorldCommand`，战斗继续使用现有 `WorldView` / `TurnCommand`。
- 每次 Python 运行只处理一个当前任务并返回一个指令；失败或被拒绝的运行不得改变世界状态。
- 所有探索验证必须读取权威 `GameState + WorldCampaignContent`，不得信任回传的视图字段。
- 每条被接受的世界指令将 `GameState.revision` 递增一次；`expectedRevision` 不匹配时拒绝整个指令。
- `BattleState.revision` 与 `GameState.revision` 分开维护。
- 第一章至第五章固定使用 `allowedModules: ["math"]`；`json` 和宿主数据文件属于第六章独立变更，不在本计划实现。
- VS Code 工作区 Python 文件是代码权威源；V3 工作区存档不重复保存代码文本。
- 本地回退存档可保存 `codeDrafts`，但不得覆盖已打开的工作区文件。
- 不实现通用条件 DSL、开放世界寻路、复杂对话树、随机地图、装备系统或章节 2-6 内容。
- 测试覆盖正常路径和一个关键失败路径；每个任务只运行直接相关测试，阶段完成时才运行全量测试与构建。
- 修改 `rpg/` 中进入 VS Code 扩展或 Webview 的代码后，最终验证必须在 `rpg/` 运行 `npm run install:local`。
- 当前工作区已有无关改动；执行计划前使用 `using-git-worktrees` 创建隔离工作树，每个任务独立提交。

## File Map

| 路径 | 职责 |
|---|---|
| `rpg/src/game/world/campaign-types.ts` | 世界进度、探索视图、世界指令和错误类型 |
| `rpg/src/game/content/world/types.ts` | 地点、NPC、对象、材料来源、任务、遭遇和章节静态定义 |
| `rpg/src/game/content/python/world-chapter-01.ts` | 第一章内容注册表和初始 `GameState` |
| `rpg/src/game/world/validate-game-state.ts` | V3 存档加载时验证世界状态和遭遇身份 |
| `rpg/src/game/world/project-campaign-world-view.ts` | 从权威状态投影 Python 可读探索视图 |
| `rpg/src/game/world/validate-world-command.ts` | 精确校验世界指令和任务前置条件 |
| `rpg/src/game/world/reduce-world.ts` | 应用已验证指令并递增世界修订号 |
| `rpg/src/game/world/resolve-world-command.ts` | 原子组合验证与归约 |
| `rpg/src/game/world/settle-encounter.ts` | 把终局 `BattleState` 结算回世界状态 |
| `rpg/src/app/world-run-request.ts` | 按探索/战斗阶段构造 Python Runner 请求 |
| `rpg/src/app/world-save-store.ts` | V3 基线、本地存档和 V2 恢复结果 |
| `rpg/src/vscode/workspace-world-save-store.ts` | 不保存代码文本的 V3 工作区存档 |
| `rpg/src/app/controller-types.ts` | 现有与世界控制器共用的最小接口和快照联合类型 |
| `rpg/src/app/world-campaign-controller.ts` | Python 世界战役运行、验证、战斗和保存编排 |
| `rpg/src/vscode/messages.ts` | 探索、战斗、恢复三类 Webview 快照 |
| `rpg/src/vscode/webview/render-exploration.ts` | 探索界面渲染，不包含规则归约 |
| `rpg/src/app/render-battle-app.ts` | 浏览器回退界面的现有战斗渲染 |
| `rpg/src/app/render-world-app.ts` | 浏览器回退界面的探索与恢复渲染 |

---

### Task 1: Define World State And Chapter-One Content

**Files:**
- Create: `rpg/src/game/world/campaign-types.ts`
- Create: `rpg/src/game/content/world/types.ts`
- Create: `rpg/src/game/content/python/world-chapter-01.ts`
- Test: `rpg/src/game/content/python/world-chapter-01.test.ts`

**Interfaces:**
- Consumes: `BattleState`, `LevelId`, `CampaignId`, `PYTHON_MARSH_01.initialBattle`.
- Produces: `GameState`, `CampaignWorldView`, `WorldCommand`, `WorldCampaignContent`, `PYTHON_WORLD_CONTENT`, `createPythonWorldInitialState()`.

- [ ] **Step 1: Write the failing chapter fixture test**

```ts
import { describe, expect, it } from "vitest";
import { createPythonWorldInitialState, PYTHON_WORLD_CONTENT } from "./world-chapter-01";

describe("Python world chapter 1", () => {
  it("registers a reproducible initial state and a separately identified encounter", () => {
    expect(createPythonWorldInitialState()).toEqual({
      campaignId: "python-rpg",
      chapterId: "python-marsh-01",
      locationId: "rust-marsh-camp",
      revision: 0,
      worldFlags: {},
      inventory: [],
      quests: [{ id: "repair_relay", status: "active", stepId: "talk_to_toma" }],
      discoveredClues: [],
      battle: null,
    });

    const encounter = PYTHON_WORLD_CONTENT.encounters.marsh_guardian;
    expect(encounter?.battleLevelId).toBe("python-marsh-01");
    expect(encounter?.battleId).toBe("python-world-ch1-marsh-guardian");
    expect(encounter?.battleId).not.toBe("python-marsh-01");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing modules fail**

Run: `cd rpg && npm test -- src/game/content/python/world-chapter-01.test.ts`

Expected: FAIL because `world-chapter-01.ts` and the world types do not exist.

- [ ] **Step 3: Add the world progression and command contracts**

Create `campaign-types.ts` with these exact public shapes:

```ts
import type { CampaignId } from "../../programs/types";
import type { BattleState } from "../combat/types";

export type WorldFlagValue = boolean | number | string;
export type ItemState = Readonly<{ id: string; amount: number }>;
export type QuestState = Readonly<{
  id: string;
  status: "locked" | "active" | "completed";
  stepId: string;
}>;
export type ActiveBattle = Readonly<{ encounterId: string; state: BattleState }>;

export type GameState = Readonly<{
  campaignId: CampaignId;
  chapterId: string;
  locationId: string;
  revision: number;
  worldFlags: Readonly<Record<string, WorldFlagValue>>;
  inventory: readonly ItemState[];
  quests: readonly QuestState[];
  discoveredClues: readonly string[];
  battle: ActiveBattle | null;
}>;

export type WorldCommand =
  | Readonly<{ expectedRevision: number; type: "inspect"; targetId: string }>
  | Readonly<{ expectedRevision: number; type: "talk"; targetId: string }>
  | Readonly<{ expectedRevision: number; type: "collect"; targetId: string }>
  | Readonly<{ expectedRevision: number; type: "use"; itemId: string; targetId: string }>
  | Readonly<{ expectedRevision: number; type: "travel"; locationId: string }>
  | Readonly<{ expectedRevision: number; type: "prepareBattle"; encounterId: string }>;

export type WorldCommandErrorCode =
  | "INVALID_COMMAND"
  | "UNKNOWN_FIELD"
  | "EXPECTED_REVISION_MISMATCH"
  | "INVALID_TARGET"
  | "TASK_CONDITION_UNMET"
  | "ITEM_UNAVAILABLE"
  | "ITEM_MISSING"
  | "TRAVEL_LOCKED"
  | "BATTLE_ACTIVE";

export type WorldCommandError = Readonly<{
  code: WorldCommandErrorCode;
  path: string;
  message: string;
}>;

export type WorldCommandValidation =
  | Readonly<{ accepted: true; command: WorldCommand }>
  | Readonly<{ accepted: false; errors: readonly WorldCommandError[] }>;
```

- [ ] **Step 4: Add minimal static content types and the exact first-chapter registry**

Use data fields that directly support the six approved commands; do not add a generic expression evaluator.

```ts
export type FlagRequirements = Readonly<Record<string, WorldFlagValue>>;
export type ChapterDefinition = Readonly<{
  id: string;
  startLocationId: string;
  locationIds: readonly string[];
  encounterIds: readonly string[];
}>;
export type LocationDefinition = Readonly<{
  id: string;
  name: string;
  weather?: string;
  connectedLocationIds: readonly string[];
  npcIds: readonly string[];
  objectIds: readonly string[];
  itemSourceIds: readonly string[];
  travelRequirements?: Readonly<Record<string, FlagRequirements>>;
}>;
export type NpcDefinition = Readonly<{ id: string; name: string; role: string; mood: string }>;
export type WorldObjectDefinition = Readonly<{
  id: string;
  type: string;
  initialStatus: string;
  requiredItemId?: string;
}>;
export type ItemSourceDefinition = Readonly<{
  id: string;
  itemId: string;
  name: string;
  amount: number;
  requiredFlags: FlagRequirements;
}>;
export type EncounterDefinition = Readonly<{
  id: string;
  battleLevelId: LevelId;
  battleId: string;
  initialBattle: BattleState;
  prerequisiteFlags: FlagRequirements;
}>;
export type WorldCampaignContent = Readonly<{
  chapters: Readonly<Record<string, ChapterDefinition>>;
  locations: Readonly<Record<string, LocationDefinition>>;
  npcs: Readonly<Record<string, NpcDefinition>>;
  objects: Readonly<Record<string, WorldObjectDefinition>>;
  itemSources: Readonly<Record<string, ItemSourceDefinition>>;
  encounters: Readonly<Record<string, EncounterDefinition>>;
}>;
```

Register this fixed content in `world-chapter-01.ts`:

| ID | Definition |
|---|---|
| `python-marsh-01` | starts at `rust-marsh-camp`; contains `rust-marsh-camp`, `old_foundry` and encounter `marsh_guardian` |
| `rust-marsh-camp` | NPC `toma`; objects `scrap_pile`, `weather_station`; connected to `old_foundry` only after `safe_route_known=true` |
| `old_foundry` | object `relay`; no item source; connected back to camp |
| `toma` | engineer, worried |
| `scrap_pile` | inspectable salvage object |
| `weather_station` | inspectable sensor object |
| `relay` | machine, initial status `damaged`, requires `copper_wire` |
| `copper_wire_source` | grants 1 `copper_wire`, requires `scrap_pile_inspected=true` |
| `marsh_guardian` | requires `relay_repaired=true`; clones `PYTHON_MARSH_01.initialBattle` and overwrites `battleId` with `python-world-ch1-marsh-guardian` |

- [ ] **Step 5: Run the fixture test and typecheck**

Run: `cd rpg && npm test -- src/game/content/python/world-chapter-01.test.ts`

Expected: PASS, 1 test file passed.

Run: `cd rpg && npm run typecheck`

Expected: exit 0.

- [ ] **Step 6: Commit the domain and content contract**

```bash
git add rpg/src/game/world/campaign-types.ts rpg/src/game/content/world/types.ts rpg/src/game/content/python/world-chapter-01.ts rpg/src/game/content/python/world-chapter-01.test.ts
git commit -m "feat: define Python world campaign state"
```

---

### Task 2: Project The Exploration World View

**Files:**
- Create: `rpg/src/game/world/project-campaign-world-view.ts`
- Test: `rpg/src/game/world/project-campaign-world-view.test.ts`

**Interfaces:**
- Consumes: `GameState`, `WorldCampaignContent`.
- Produces: `projectCampaignWorldView(state, content): CampaignWorldView`.

- [ ] **Step 1: Add the failing whitelist projection test**

```ts
it("projects a frozen JSON-safe view without exposing hidden world flags", () => {
  const state = {
    ...createPythonWorldInitialState(),
    worldFlags: { talked_to_toma: true, internal_reward_seed: 42 },
    revision: 1,
  };
  const view = projectCampaignWorldView(state, PYTHON_WORLD_CONTENT);

  expect(view.revision).toBe(1);
  expect(view.location.id).toBe("rust-marsh-camp");
  expect(view.npcs.map((npc) => npc.id)).toEqual(["toma"]);
  expect(view.objects.map((object) => object.id)).toEqual(["scrap_pile", "weather_station"]);
  expect(view.availableTravel).toEqual([]);
  expect(JSON.stringify(view)).not.toContain("internal_reward_seed");
  expect(Object.isFrozen(view)).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing projector fails**

Run: `cd rpg && npm test -- src/game/world/project-campaign-world-view.test.ts`

Expected: FAIL because `projectCampaignWorldView` is not defined.

- [ ] **Step 3: Implement the exact public view**

Add `CampaignWorldView` to `campaign-types.ts`:

```ts
export type CampaignWorldView = Readonly<{
  revision: number;
  location: Readonly<{ id: string; name: string; weather?: string }>;
  npcs: readonly Readonly<{ id: string; name: string; role: string; mood: string }>[];
  objects: readonly Readonly<{
    id: string;
    type: string;
    status: string;
    requiredItems: readonly string[];
  }>[];
  inventory: readonly ItemState[];
  quests: readonly QuestState[];
  availableTravel: readonly string[];
}>;
```

Implement `projectCampaignWorldView` with these rules:

- Resolve the current location by `state.locationId`; throw for an unregistered location because this is corrupted authoritative state.
- Include only the location's registered NPCs and objects.
- Derive `relay.status` as `repaired` when `relay_repaired=true`, otherwise use `initialStatus`.
- Include an item source as a visible object only while its required flags match and its `collected:<sourceId>` flag is not true.
- Include a travel destination only when it is connected and all destination requirements match.
- Copy arrays and nested values, then recursively freeze the result using the same pattern as `project-world-view.ts`.
- Never include `worldFlags`, encounter prerequisites, reward fields, battle state or content definitions.

- [ ] **Step 4: Run the projection test**

Run: `cd rpg && npm test -- src/game/world/project-campaign-world-view.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the exploration projection**

```bash
git add rpg/src/game/world/campaign-types.ts rpg/src/game/world/project-campaign-world-view.ts rpg/src/game/world/project-campaign-world-view.test.ts
git commit -m "feat: project Python exploration world view"
```

---

### Task 3: Validate And Reduce World Commands

**Files:**
- Create: `rpg/src/game/world/validate-world-command.ts`
- Create: `rpg/src/game/world/reduce-world.ts`
- Create: `rpg/src/game/world/resolve-world-command.ts`
- Test: `rpg/src/game/world/resolve-world-command.test.ts`

**Interfaces:**
- Consumes: `GameState`, `WorldCampaignContent`, raw Runner return value.
- Produces: `resolveWorldCommand(state, content, input): WorldCommandResolution`.

- [ ] **Step 1: Write the failing normal-path and repeated-collect tests**

```ts
function apply(state: GameState, command: Omit<WorldCommand, "expectedRevision">): GameState {
  const result = resolveWorldCommand(state, PYTHON_WORLD_CONTENT, {
    ...command,
    expectedRevision: state.revision,
  });
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error("expected command acceptance");
  return result.state;
}

it("advances the repair quest through the approved exploration sequence", () => {
  let state = createPythonWorldInitialState();
  state = apply(state, { type: "talk", targetId: "toma" });
  state = apply(state, { type: "inspect", targetId: "scrap_pile" });
  state = apply(state, { type: "collect", targetId: "copper_wire_source" });
  state = apply(state, { type: "inspect", targetId: "weather_station" });
  state = apply(state, { type: "travel", locationId: "old_foundry" });
  state = apply(state, { type: "use", itemId: "copper_wire", targetId: "relay" });

  expect(state.revision).toBe(6);
  expect(state.inventory).toEqual([]);
  expect(state.worldFlags.relay_repaired).toBe(true);
  expect(state.quests[0]?.stepId).toBe("prepare_guardian_battle");
});

it("rejects collecting the same material source twice without changing state", () => {
  let state = createPythonWorldInitialState();
  state = apply(state, { type: "talk", targetId: "toma" });
  state = apply(state, { type: "inspect", targetId: "scrap_pile" });
  state = apply(state, { type: "collect", targetId: "copper_wire_source" });
  const result = resolveWorldCommand(state, PYTHON_WORLD_CONTENT, {
    expectedRevision: state.revision,
    type: "collect",
    targetId: "copper_wire_source",
  });

  expect(result).toEqual({
    accepted: false,
    errors: [{ code: "ITEM_UNAVAILABLE", path: "targetId", message: "材料来源已经收集" }],
    state,
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `cd rpg && npm test -- src/game/world/resolve-world-command.test.ts`

Expected: FAIL because the resolver modules do not exist.

- [ ] **Step 3: Implement strict shape validation**

`validateWorldCommand` must:

- Require a plain object, integer `expectedRevision`, supported `type`, exact required keys and no unknown keys.
- Return `EXPECTED_REVISION_MISMATCH` before evaluating task conditions.
- Reject every world command while `state.battle !== null` with `BATTLE_ACTIVE`, except no world commands are allowed during battle.
- Verify target membership from the current location and registered content.
- Return one deterministic error for the first rejected condition; do not build a large validation matrix.

Use exact key sets:

```ts
const COMMAND_KEYS = {
  inspect: ["expectedRevision", "type", "targetId"],
  talk: ["expectedRevision", "type", "targetId"],
  collect: ["expectedRevision", "type", "targetId"],
  use: ["expectedRevision", "type", "itemId", "targetId"],
  travel: ["expectedRevision", "type", "locationId"],
  prepareBattle: ["expectedRevision", "type", "encounterId"],
} as const;
```

- [ ] **Step 4: Implement the first-chapter effects in the reducer**

Apply these exact state changes; keep them explicit rather than introducing a rule DSL:

| Accepted command | State effect |
|---|---|
| `talk toma` at `talk_to_toma` | set `talked_to_toma=true`; quest step `inspect_scrap_pile` |
| repeated `talk toma` | accepted, no duplicate reward or quest regression |
| `inspect scrap_pile` | add clue `scrap_contains_copper`; set `scrap_pile_inspected=true`; quest step `collect_copper_wire` |
| repeated `inspect scrap_pile` | accepted, clue remains unique |
| `collect copper_wire_source` | add 1 `copper_wire`; set `collected:copper_wire_source=true`; quest step `inspect_weather` |
| `inspect weather_station` | add clue `acid_rain_safe_route`; set `safe_route_known=true`; quest step `travel_to_relay` |
| `travel old_foundry` | set `locationId=old_foundry`; quest step `repair_relay` |
| `use copper_wire -> relay` | consume exactly 1 wire; set `relay_repaired=true`; quest step `prepare_guardian_battle` |
| `prepareBattle marsh_guardian` | clone encounter battle into `state.battle`; quest step `defeat_guardian` |

Every accepted command returns a new immutable object and increments `revision` exactly once.

- [ ] **Step 5: Add the atomic resolver**

```ts
export type WorldCommandResolution =
  | Readonly<{ accepted: true; command: WorldCommand; state: GameState }>
  | Readonly<{ accepted: false; errors: readonly WorldCommandError[]; state: GameState }>;

export function resolveWorldCommand(
  state: Readonly<GameState>,
  content: WorldCampaignContent,
  input: unknown,
): WorldCommandResolution {
  const validation = validateWorldCommand(state, content, input);
  if (!validation.accepted) return { accepted: false, errors: validation.errors, state };
  return {
    accepted: true,
    command: validation.command,
    state: reduceWorld(state, content, validation.command),
  };
}
```

- [ ] **Step 6: Run the command tests and typecheck**

Run: `cd rpg && npm test -- src/game/world/resolve-world-command.test.ts`

Expected: PASS, including the repeated-collect rejection.

Run: `cd rpg && npm run typecheck`

Expected: exit 0.

- [ ] **Step 7: Commit the world command pipeline**

```bash
git add rpg/src/game/world/validate-world-command.ts rpg/src/game/world/reduce-world.ts rpg/src/game/world/resolve-world-command.ts rpg/src/game/world/resolve-world-command.test.ts
git commit -m "feat: resolve Python world commands"
```

---

### Task 4: Bridge Encounters To The Existing Combat Kernel

**Files:**
- Create: `rpg/src/game/world/settle-encounter.ts`
- Test: `rpg/src/game/world/settle-encounter.test.ts`
- Modify: `rpg/src/game/content/python/world-chapter-01.ts`

**Interfaces:**
- Consumes: terminal `GameState.battle.state`, `EncounterDefinition`.
- Produces: `encounterBattleLevel(content, encounterId)` and `settleEncounter(state, content)`.

- [ ] **Step 1: Write the failing win and retry settlement tests**

```ts
it("settles a guardian victory back into exploration", () => {
  const prepared = prepareGuardianBattle();
  const state = {
    ...prepared,
    battle: { ...prepared.battle!, state: { ...prepared.battle!.state, phase: "won" as const } },
  };
  const settled = settleEncounter(state, PYTHON_WORLD_CONTENT);

  expect(settled.battle).toBeNull();
  expect(settled.locationId).toBe("rust-marsh-camp");
  expect(settled.worldFlags.marsh_guardian_defeated).toBe(true);
  expect(settled.quests[0]?.stepId).toBe("submit_report");
});

it("resets a lost guardian battle without changing exploration progress", () => {
  const prepared = prepareGuardianBattle();
  const lost = {
    ...prepared,
    battle: { ...prepared.battle!, state: { ...prepared.battle!.state, phase: "lost" as const } },
  };
  const retried = settleEncounter(lost, PYTHON_WORLD_CONTENT);

  expect(retried.battle?.encounterId).toBe("marsh_guardian");
  expect(retried.battle?.state.phase).toBe("in_progress");
  expect(retried.battle?.state.battleId).toBe("python-world-ch1-marsh-guardian");
  expect(retried.worldFlags.marsh_guardian_defeated).toBeUndefined();
});
```

- [ ] **Step 2: Run the focused settlement test and confirm it fails**

Run: `cd rpg && npm test -- src/game/world/settle-encounter.test.ts`

Expected: FAIL because `settleEncounter` is missing.

- [ ] **Step 3: Implement encounter lookup and terminal settlement**

```ts
export function encounterBattleLevel(
  content: WorldCampaignContent,
  encounterId: string,
): LevelDefinition {
  const encounter = content.encounters[encounterId];
  if (encounter === undefined) throw new Error(`遭遇尚未注册: ${encounterId}`);
  return getLevel(encounter.battleLevelId);
}
```

`settleEncounter` must throw if there is no active battle or if its phase is still `in_progress`. On victory, clear the battle, return to `rust-marsh-camp`, set `marsh_guardian_defeated=true`, set quest step `submit_report`, and increment world revision once. On loss, clone the registered encounter's initial battle, retain all exploration fields and quest step, keep the same encounter ID, and increment world revision once.

- [ ] **Step 4: Extend `talk toma` for final report submission**

When `marsh_guardian_defeated=true` and the quest step is `submit_report`, an accepted `talk` command must set:

```ts
quests: [{ id: "repair_relay", status: "completed", stepId: "completed" }]
worldFlags: {
  ...state.worldFlags,
  chapter_01_completed: true,
  chapter_02_unlocked: true,
}
```

Repeated submission must remain accepted without duplicating rewards.

- [ ] **Step 5: Run settlement and command tests**

Run: `cd rpg && npm test -- src/game/world/settle-encounter.test.ts src/game/world/resolve-world-command.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the encounter bridge**

```bash
git add rpg/src/game/world/settle-encounter.ts rpg/src/game/world/settle-encounter.test.ts rpg/src/game/content/python/world-chapter-01.ts rpg/src/game/world/reduce-world.ts rpg/src/game/world/resolve-world-command.test.ts
git commit -m "feat: settle world campaign encounters"
```

---

### Task 5: Generalize Runner World Input And Select The Callable

**Files:**
- Modify: `rpg/src/runners/protocol/types.ts`
- Modify: `rpg/src/runners/protocol/validate-request.test.ts`
- Create: `rpg/src/app/world-run-request.ts`
- Test: `rpg/src/app/world-run-request.test.ts`

**Interfaces:**
- Consumes: `GameState`, `WorldCampaignContent`, Python `CampaignDefinition`, code draft and run limits.
- Produces: `createWorldRunRequest(input): PythonRunRequest`.

- [ ] **Step 1: Write failing tests for both callables**

```ts
it("uses choose_world_action and the campaign view during exploration", () => {
  const request = createWorldRunRequest({
    campaign: PYTHON_RPG_CAMPAIGN,
    content: PYTHON_WORLD_CONTENT,
    state: createPythonWorldInitialState(),
    codeDraft: "def choose_world_action(world):\n    return {}\n",
    runId: "run-1",
    limits: createDefaultRunLimits().python,
  });

  expect(request.entrypoint.callable).toBe("choose_world_action");
  expect(request.allowedModules).toEqual(["math"]);
  expect(request.worldView).toMatchObject({ revision: 0, location: { id: "rust-marsh-camp" } });
});

it("uses choose_turn and the existing battle view during an encounter", () => {
  const state = prepareGuardianBattle();
  const request = createWorldRunRequest({
    campaign: PYTHON_RPG_CAMPAIGN,
    content: PYTHON_WORLD_CONTENT,
    state,
    codeDraft: "def choose_turn(world):\n    return {}\n",
    runId: "run-2",
    limits: createDefaultRunLimits().python,
  });

  expect(request.entrypoint.callable).toBe("choose_turn");
  expect(request.worldView).toMatchObject({ battleId: "python-world-ch1-marsh-guardian" });
});
```

- [ ] **Step 2: Run the focused tests and confirm the combat-only type fails**

Run: `cd rpg && npm test -- src/app/world-run-request.test.ts src/runners/protocol/validate-request.test.ts`

Expected: FAIL because `BaseRunRequest.worldView` only accepts combat `WorldView` and the helper is missing.

- [ ] **Step 3: Generalize only the Runner envelope field**

In `runners/protocol/types.ts`, remove the import of combat `WorldView` and define:

```ts
export type JsonObject = { readonly [key: string]: JsonValue };

export type BaseRunRequest = Readonly<{
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly runId: string;
  readonly attemptId: string;
  readonly questId: string;
  readonly files: Readonly<Record<string, string>>;
  readonly worldView: JsonObject;
  readonly limits: ExecutionLimits;
}>;
```

Do not change `PROTOCOL_VERSION`, Runner response fields, Python runtime execution, Go requests or the module whitelist.

- [ ] **Step 4: Implement phase-aware request construction**

```ts
export function createWorldRunRequest(input: WorldRunRequestInput): PythonRunRequest {
  const battle = input.state.battle;
  const worldView = battle === null
    ? projectCampaignWorldView(input.state, input.content)
    : projectWorldView(battle.state);
  const callable = battle === null ? "choose_world_action" : "choose_turn";
  const file = input.campaign.program.runEntrypointFileName(input.state.chapterId);
  return {
    protocolVersion: 1,
    runId: input.runId,
    attemptId: `${input.runId}:1`,
    questId: input.state.quests.find((quest) => quest.status === "active")?.id ?? input.state.chapterId,
    language: "python",
    files: input.campaign.program.createRunFiles(input.state.chapterId, input.codeDraft),
    worldView,
    entrypoint: { file, callable },
    allowedModules: ["math"],
    limits: input.limits,
  };
}
```

- [ ] **Step 5: Add one protocol test with a non-combat world object**

Pass a request whose `worldView` is `{ revision: 0, location: { id: "rust-marsh-camp" } }` to `validateRunRequest` and assert `ok === true`. Keep the existing Go and combat request tests unchanged.

- [ ] **Step 6: Run the focused tests and typecheck**

Run: `cd rpg && npm test -- src/app/world-run-request.test.ts src/runners/protocol/validate-request.test.ts`

Expected: PASS.

Run: `cd rpg && npm run typecheck`

Expected: exit 0.

- [ ] **Step 7: Commit the dual-protocol Runner integration**

```bash
git add rpg/src/runners/protocol/types.ts rpg/src/runners/protocol/validate-request.test.ts rpg/src/app/world-run-request.ts rpg/src/app/world-run-request.test.ts
git commit -m "feat: route Python world and battle callables"
```

---

### Task 6: Add V3 Local And Workspace Save Stores

**Files:**
- Create: `rpg/src/app/world-save-store.ts`
- Test: `rpg/src/app/world-save-store.test.ts`
- Create: `rpg/src/vscode/workspace-world-save-store.ts`
- Test: `rpg/src/vscode/workspace-world-save-store.test.ts`
- Create: `rpg/src/game/combat/is-battle-state.ts`
- Create: `rpg/src/game/world/validate-game-state.ts`
- Modify: `rpg/src/app/save-store.ts`
- Test: `rpg/src/app/save-store.test.ts`

**Interfaces:**
- Consumes: `GameState`, legacy V2 JSON and workspace state.
- Produces: `CampaignSaveV3`, `LocalSaveDataV3`, `WorkspaceSaveDataV3`, `WorldSaveStore`, `LocalWorldSaveStore`, `WorkspaceWorldSaveStore`.

- [ ] **Step 1: Write failing V3 round-trip and V2 recovery tests**

```ts
it("round-trips V3 world state and local code drafts", () => {
  const store = new LocalWorldSaveStore(localStorage, PYTHON_WORLD_CONTENT);
  const save = {
    version: 3 as const,
    gameState: createPythonWorldInitialState(),
    codeDrafts: { "python-marsh-01": "def choose_world_action(world):\n    return {}\n" },
  };
  store.save(save);
  expect(store.load()).toEqual({ ok: true, save });
});

it("reports V2 as recoverable and exposes only its local code draft", () => {
  localStorage.setItem("python-rpg.save", JSON.stringify(createLegacyV2Save("old code")));
  expect(new LocalWorldSaveStore(localStorage, PYTHON_WORLD_CONTENT).load()).toEqual({
    ok: false,
    reason: "legacy_v2",
    message: "检测到旧版战斗存档。导出旧代码后开始新的世界战役。",
    legacyCodeDraft: "old code",
  });
});
```

For `WorkspaceWorldSaveStore`, assert a V3 save persists only `{ version, gameState }`, and a V2 value returns `reason: "legacy_v2"` without `legacyCodeDraft`.

- [ ] **Step 2: Run both save test files and confirm they fail**

Run: `cd rpg && npm test -- src/app/world-save-store.test.ts src/vscode/workspace-world-save-store.test.ts`

Expected: FAIL because the V3 stores do not exist.

- [ ] **Step 3: Define the V3 save contract and recovery result**

```ts
export type CampaignSaveV3 = Readonly<{ version: 3; gameState: GameState }>;
export type LocalSaveDataV3 = CampaignSaveV3 & Readonly<{
  codeDrafts: Readonly<Record<string, string>>;
}>;
export type WorkspaceSaveDataV3 = CampaignSaveV3;

export type WorldSaveLoadResult =
  | Readonly<{ ok: true; save: LocalSaveDataV3 | null }>
  | Readonly<{
      ok: false;
      reason: "legacy_v2" | "corrupt";
      message: string;
      legacyCodeDraft?: string;
    }>;

export interface WorldSaveStore {
  load(): WorldSaveLoadResult;
  save(value: LocalSaveDataV3): void;
  remove(): void;
}
```

- [ ] **Step 4: Implement local and workspace behavior without implicit migration**

- `LocalWorldSaveStore` reads V3 from `python-rpg.world-save`; when absent, checks legacy `python-rpg.save` only to expose its string `codeDraft`.
- `LocalWorldSaveStore.remove()` removes both keys after explicit reset.
- Move the existing structural `BattleState` guard from `save-store.ts` into `game/combat/is-battle-state.ts`; keep the V2 tests proving the extracted guard behaves identically.
- Export the existing V2 shape guard from `save-store.ts` as `isSaveDataV2` so V2 recognition is not duplicated.
- `WorkspaceWorldSaveStore` keeps the existing key `python-rpg.workspace-save`, distinguishes by `version`, and writes only `WorkspaceSaveDataV3`.
- On workspace V3 load, return `{ ...stored, codeDrafts: {} }`; the workspace file remains authoritative.
- Unknown version, missing required world fields or malformed JSON returns `reason: "corrupt"`.

Implement `validateGameState(value, content)` in `game/world/validate-game-state.ts` with these checks:

- `campaignId === "python-rpg"` and `chapterId` exists in `content.chapters`.
- `locationId` belongs to that chapter.
- `revision` and inventory amounts are non-negative integers; item and clue IDs are non-empty strings.
- Quest statuses are exactly `locked | active | completed` and quest IDs are unique.
- If `battle !== null`, the encounter exists, its `battleLevelId` resolves through `getLevel`, `isBattleState(battle.state)` is true, and `battle.state.battleId === encounter.battleId`.
- Do not require `battle.state.battleId === chapterId`.

- [ ] **Step 5: Run the save tests**

Run: `cd rpg && npm test -- src/app/world-save-store.test.ts src/vscode/workspace-world-save-store.test.ts src/app/save-store.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit V3 persistence**

```bash
git add rpg/src/game/combat/is-battle-state.ts rpg/src/game/world/validate-game-state.ts rpg/src/app/save-store.ts rpg/src/app/save-store.test.ts rpg/src/app/world-save-store.ts rpg/src/app/world-save-store.test.ts rpg/src/vscode/workspace-world-save-store.ts rpg/src/vscode/workspace-world-save-store.test.ts
git commit -m "feat: persist Python world campaign saves"
```

---

### Task 7: Implement The Python World Campaign Controller

**Files:**
- Create: `rpg/src/app/controller-types.ts`
- Create: `rpg/src/app/world-campaign-controller.ts`
- Test: `rpg/src/app/world-campaign-controller.test.ts`
- Modify: `rpg/src/app/app-controller.ts`
- Modify: `rpg/src/app/app-feedback.ts`
- Modify: `rpg/src/app/app-feedback.test.ts`

**Interfaces:**
- Consumes: Runner client, `WorldSaveStore`, `PYTHON_WORLD_CONTENT`, world resolver, encounter settlement and existing combat functions.
- Produces: `GameController`, `WorldExplorationSnapshot`, `WorldBattleSnapshot`, `WorldCampaignController`.

- [ ] **Step 1: Write failing exploration success and program-error tests**

```ts
it("runs an exploration command, saves the accepted state and publishes task feedback", async () => {
  const runner = new FakeRunnerClient({
    executionStatus: "completed",
    returnValue: { expectedRevision: 0, type: "talk", targetId: "toma" },
  });
  const saveStore = new MemoryWorldSaveStore();
  const controller = createWorldController(runner, saveStore);
  await controller.start();
  await controller.runCode("def choose_world_action(world):\n    return {}\n");

  const snapshot = controller.getSnapshot();
  expect(snapshot.mode).toBe("exploration");
  if (snapshot.mode !== "exploration") throw new Error("expected exploration snapshot");
  expect(snapshot.gameState.revision).toBe(1);
  expect(snapshot.feedback.layer).toBe("task");
  expect(saveStore.saved.at(-1)?.gameState.revision).toBe(1);
});

it("keeps world state unchanged after a syntax error", async () => {
  const runner = new FakeRunnerClient(syntaxErrorResult());
  const controller = createWorldController(runner, new MemoryWorldSaveStore());
  await controller.start();
  const before = controller.getSnapshot();
  await controller.runCode("def broken(:\n");
  const after = controller.getSnapshot();

  expect(after.mode).toBe("exploration");
  if (before.mode !== "exploration" || after.mode !== "exploration") throw new Error("expected exploration snapshots");
  expect(after.gameState).toEqual(before.gameState);
  expect(after.feedback.layer).toBe("program");
});
```

- [ ] **Step 2: Run the controller test and confirm it fails**

Run: `cd rpg && npm test -- src/app/world-campaign-controller.test.ts`

Expected: FAIL because the controller and shared types are missing.

- [ ] **Step 3: Add the common controller and snapshot contract**

```ts
export type WorldExplorationSnapshot = Readonly<{
  mode: "exploration";
  gameState: GameState;
  worldView: CampaignWorldView;
  codeDraft: string;
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  diagnostics: readonly RunnerDiagnostic[];
  activeRunId?: string;
}>;

export type WorldBattleSnapshot = Readonly<{
  mode: "battle";
  gameState: GameState;
  battleState: BattleState;
  battleLevelId: LevelId;
  codeDraft: string;
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  diagnostics: readonly RunnerDiagnostic[];
  activeRunId?: string;
}>;

export type WorldRecoverySnapshot = Readonly<{
  mode: "world_recovery";
  reason: "legacy_v2" | "corrupt";
  message: string;
  legacyCodeDraft?: string;
}>;

export type ControllerSnapshot = AppSnapshot | WorldExplorationSnapshot | WorldBattleSnapshot | WorldRecoverySnapshot;

export interface GameController {
  readonly campaign: CampaignDefinition;
  start(): Promise<void>;
  runCode(code: string): Promise<void>;
  interrupt(): Promise<void>;
  resetSave(confirmation: string): void;
  retryLevel(): void;
  advanceLevel(): void;
  subscribe(listener: (snapshot: ControllerSnapshot) => void): () => void;
  getSnapshot(): ControllerSnapshot;
}
```

Make the existing `AppController` implement `GameController` without changing its Go battle behavior.

- [ ] **Step 4: Add the explicit feedback layer**

Extend `AppFeedback` with:

```ts
layer: "program" | "task" | "strategy";
```

Map existing feedback as follows:

| Producer | Layer |
|---|---|
| `feedbackFromRunResult` | `program` |
| combat/world validation error | `task` |
| accepted exploration command | `task` |
| accepted combat turn | `strategy` |
| battle victory/loss settlement | `strategy` |
| idle feedback | `task` |

Update the focused `app-feedback.test.ts` expectations; do not add a separate case for every existing battle error code.

- [ ] **Step 5: Implement controller dispatch and persistence**

`WorldCampaignController` must:

1. Load V3 or create `createPythonWorldInitialState()` with the current chapter code draft.
2. Return a recovery snapshot for `legacy_v2` or `corrupt`; include `legacyCodeDraft` only for local V2.
3. Put `projectCampaignWorldView(...)` directly on exploration snapshots; put the active `BattleState` and `battleLevelId` directly on battle snapshots so host adapters do not need content rules.
4. Build requests with `createWorldRunRequest`.
5. On exploration completion, call `resolveWorldCommand`; rejected commands update task feedback only.
6. On battle completion, resolve the player's `TurnCommand`, run existing enemy turns with `enemyCommand` and `validateLevelCommand`, then write the new nested battle state.
7. When battle phase becomes terminal, call `settleEncounter` before saving.
8. Save only after accepted world commands, accepted combat turns, terminal settlement, explicit reset, or local code-draft updates.
9. Keep `retryLevel()` and `advanceLevel()` as no-ops for world snapshots; world progression remains Python-driven.

Extract the existing enemy-turn loop into a private method in the new controller; do not move or rewrite combat rules.

- [ ] **Step 6: Run controller and feedback tests**

Run: `cd rpg && npm test -- src/app/world-campaign-controller.test.ts src/app/app-feedback.test.ts`

Expected: PASS.

Run: `cd rpg && npm run typecheck`

Expected: exit 0.

- [ ] **Step 7: Commit the world controller**

```bash
git add rpg/src/app/controller-types.ts rpg/src/app/world-campaign-controller.ts rpg/src/app/world-campaign-controller.test.ts rpg/src/app/app-controller.ts rpg/src/app/app-feedback.ts rpg/src/app/app-feedback.test.ts
git commit -m "feat: orchestrate Python world campaign flow"
```

---

### Task 8: Route The VS Code Session Through Exploration And Battle Snapshots

**Files:**
- Modify: `rpg/src/vscode/messages.ts`
- Modify: `rpg/src/vscode/game-session.ts`
- Modify: `rpg/src/vscode/game-session.test.ts`
- Modify: `rpg/src/vscode/extension.ts`

**Interfaces:**
- Consumes: `GameController`, world controller snapshots, legacy battle snapshots.
- Produces: `ExplorationViewSnapshot`, `BattleViewSnapshot`, `RecoveryViewSnapshot` and Python/Go controller selection.

- [ ] **Step 1: Add failing session tests for restored exploration and battle routing**

Add one Python world session test that asserts:

```ts
expect(postedSnapshot).toMatchObject({
  mode: "exploration",
  chapterId: "python-marsh-01",
  playerFileName: "python-marsh-01.py",
  location: { id: "rust-marsh-camp" },
});
expect(workspace.openedLevelIds).toEqual(["python-marsh-01"]);
```

Keep one existing Go session test unchanged and assert it still publishes `mode: "battle"` with its original `battleState`.

- [ ] **Step 2: Run the session test and confirm the old single snapshot fails**

Run: `cd rpg && npm test -- src/vscode/game-session.test.ts`

Expected: FAIL because `messages.ts` only defines `mode: "game"`.

- [ ] **Step 3: Replace the Webview game snapshot with a discriminated union**

```ts
export type ExplorationViewSnapshot = Readonly<{
  mode: "exploration";
  theme: ThemePreference;
  campaignTitle: string;
  languageLabel: "Python";
  playerFileName: string;
  chapterId: string;
  location: CampaignWorldView["location"];
  npcs: CampaignWorldView["npcs"];
  objects: CampaignWorldView["objects"];
  inventory: CampaignWorldView["inventory"];
  quests: CampaignWorldView["quests"];
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  activeRunId?: string;
}>;

export type BattleViewSnapshot = Readonly<{
  mode: "battle";
  theme: ThemePreference;
  campaignTitle: string;
  languageLabel: "Python" | "Go";
  playerFileName: string;
  level: LevelDefinition;
  battleState: BattleState;
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  programReference?: ProgramReference;
  activeRunId?: string;
}>;

export type RecoveryViewSnapshot = Readonly<{
  mode: "recovery";
  theme: ThemePreference;
  reason: "legacy_v2" | "corrupt";
  message: string;
  canReset: true;
}>;

export type WebviewSnapshot = ExplorationViewSnapshot | BattleViewSnapshot | RecoveryViewSnapshot;
```

- [ ] **Step 4: Generalize `GameSession` without adding world rules**

- Change the dependency type from concrete `AppController` to `GameController`.
- For exploration, use `snapshot.gameState.chapterId` as the workspace file ID and copy `snapshot.worldView` into the message.
- For world battle, copy `snapshot.battleState` and resolve `snapshot.battleLevelId` with `getLevel` for the battle view.
- For legacy `mode: "game"`, preserve the current mapping and diagnostics behavior.
- Map both legacy `save_recovery` and new `world_recovery` controller snapshots to Webview `mode: "recovery"`.
- Keep the existing `runTurn` command name; it means “run the active Python/Go file” in both modes.
- Open a file only when its chapter/level ID changes.

- [ ] **Step 5: Select the controller and save store in the extension host**

In `createActiveGame`:

```ts
const controller: GameController = campaign.id === "python-rpg"
  ? new WorldCampaignController({
      runner,
      saveStore: new WorkspaceWorldSaveStore(workspaceState, PYTHON_WORLD_CONTENT, campaign.id),
      content: PYTHON_WORLD_CONTENT,
      runLimits: createDefaultRunLimits().python,
    }, campaign)
  : new AppController({ runner, saveStore: new WorkspaceSaveStore(workspaceState, campaign.id) }, campaign);
```

Remove the pre-controller V2 `currentLevelId` lookup from `extension.ts`; let `GameSession.start()` open the restored chapter after the controller has loaded the save. Do not change Go command registration or campaign selection.

- [ ] **Step 6: Run session and workspace-store tests**

Run: `cd rpg && npm test -- src/vscode/game-session.test.ts src/vscode/workspace-world-save-store.test.ts src/vscode/workspace-save-store.test.ts`

Expected: PASS for Python V3 and unchanged Go V2 behavior.

- [ ] **Step 7: Commit the VS Code host routing**

```bash
git add rpg/src/vscode/messages.ts rpg/src/vscode/game-session.ts rpg/src/vscode/game-session.test.ts rpg/src/vscode/extension.ts
git commit -m "feat: route VS Code Python world snapshots"
```

---

### Task 9: Render The Exploration Webview

**Files:**
- Create: `rpg/src/vscode/webview/render-exploration.ts`
- Test: `rpg/src/vscode/webview/render-exploration.test.ts`
- Modify: `rpg/src/vscode/webview/main.ts`
- Modify: `rpg/src/vscode/webview/render-game.ts`
- Modify: `rpg/src/vscode/webview/render-game.test.ts`
- Modify: `rpg/src/vscode/webview/styles.css`

**Interfaces:**
- Consumes: `ExplorationViewSnapshot`, existing `BattleViewSnapshot` renderer.
- Produces: exploration DOM with location, NPC/object lists, inventory, quest progress, three-layer feedback and contextual run controls.

- [ ] **Step 1: Write the failing exploration render test**

```ts
it("renders world information and a Python run action without a battle grid", () => {
  const root = document.createElement("main");
  renderExploration(root, explorationSnapshot());

  expect(root.querySelector("h1")?.textContent).toBe("锈沼营地");
  expect(root.textContent).toContain("托玛");
  expect(root.textContent).toContain("repair_relay");
  expect(root.textContent).toContain("copper_wire");
  expect(root.querySelector(".battle-grid")).toBeNull();
  expect(root.querySelector<HTMLButtonElement>("[data-command='runTurn']")?.textContent).toBe("运行 Python");
});
```

- [ ] **Step 2: Run the renderer test and confirm it fails**

Run: `cd rpg && npm test -- src/vscode/webview/render-exploration.test.ts`

Expected: FAIL because `renderExploration` is missing.

- [ ] **Step 3: Implement an unframed exploration layout**

Render these full-width regions in order:

1. Header: campaign title, chapter ID, location name, weather and Runner state.
2. Current task band: active quest ID and `stepId`.
3. World body: NPC list, object/material list, inventory and quests; use headings and compact rows, not nested cards.
4. Feedback panel: add `data-feedback-layer` and visible titles `程序反馈`、`任务反馈` or `策略反馈` derived from `feedback.layer`.
5. Action bar: `运行 Python` or `中断运行`, theme controls, and no direct talk/collect/travel buttons.

Use existing `element`, `textElement` and `commandButton` patterns. Add stable grid tracks and responsive stacking below 720px; do not introduce a UI library.

- [ ] **Step 4: Dispatch rendering by snapshot mode**

In `main.ts`:

```ts
if (message.snapshot.mode === "exploration") {
  previousSnapshot = undefined;
  latestSnapshot = undefined;
  manualViewState = undefined;
  renderExploration(root, message.snapshot);
  resizeObserver?.disconnect();
  return;
}
```

Update the existing recovery branch to check `message.snapshot.mode === "recovery"` instead of `save_recovery`.

Change `render-game.ts` to accept `BattleViewSnapshot`; preserve its battle/manual behavior and existing cell sizing. Update the existing battle renderer tests only for the `mode: "battle"` discriminator and feedback layer field.

- [ ] **Step 5: Run the Webview tests**

Run: `cd rpg && npm test -- src/vscode/webview/render-exploration.test.ts src/vscode/webview/render-game.test.ts src/vscode/webview/main.test.ts`

Expected: PASS.

Run: `cd rpg && npm run build:webview`

Expected: exit 0.

- [ ] **Step 6: Commit the exploration Webview**

```bash
git add rpg/src/vscode/webview/render-exploration.ts rpg/src/vscode/webview/render-exploration.test.ts rpg/src/vscode/webview/main.ts rpg/src/vscode/webview/render-game.ts rpg/src/vscode/webview/render-game.test.ts rpg/src/vscode/webview/styles.css
git commit -m "feat: render Python world exploration"
```

---

### Task 10: Complete The Chapter-One Flow And Stage Verification

**Files:**
- Modify: `rpg/src/game/content/python/python-marsh-01.ts`
- Modify: `rpg/src/game/content/python/levels.ts`
- Modify: `rpg/src/app/world-campaign-controller.test.ts`
- Modify: `rpg/src/vscode/game-session.test.ts`
- Modify: `rpg/src/main.ts`
- Modify: `rpg/src/app/app-view.ts`
- Create: `rpg/src/app/render-battle-app.ts`
- Create: `rpg/src/app/render-world-app.ts`
- Test: `rpg/src/app/app-view.test.ts`

**Interfaces:**
- Consumes: all prior world, controller, save and UI contracts.
- Produces: a real first-chapter player file containing both callables, browser fallback compatibility, one automated vertical-slice proof and installed VS Code extension.

- [ ] **Step 1: Replace the first Python starter with both approved callables**

Use a starter that demonstrates the two contracts without solving the full chapter:

```python
def choose_world_action(world):
    # 探索时返回 talk / inspect / collect / use / travel / prepareBattle 之一。
    return {
        "expectedRevision": world["revision"],
        "type": "talk",
        "targetId": "toma",
    }


def choose_turn(world):
    # 战斗时继续返回现有 TurnCommand。
    return {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "action": {"type": "wait"},
    }
```

Update first-level guidance so command examples use camelCase world fields and clearly distinguish exploration from battle. Do not rewrite chapters 2-6 in this task.

- [ ] **Step 2: Add one automated vertical-slice controller test**

Drive the controller with a fake Runner that reads each request's callable and current revision, then returns this sequence:

```text
talk toma
inspect scrap_pile
collect copper_wire_source
inspect weather_station
travel old_foundry
use copper_wire -> relay
prepareBattle marsh_guardian
attack golem until BattleState.phase becomes won
talk toma to submit_report
```

Assert at the end:

```ts
expect(snapshot.gameState.quests).toEqual([
  { id: "repair_relay", status: "completed", stepId: "completed" },
]);
expect(snapshot.gameState.worldFlags.chapter_02_unlocked).toBe(true);
expect(snapshot.gameState.battle).toBeNull();
expect(saved.gameState).toEqual(snapshot.gameState);
```

- [ ] **Step 3: Keep the browser build compatible with V3**

Switch `main.ts` to `WorldCampaignController` and `new LocalWorldSaveStore(window.localStorage, PYTHON_WORLD_CONTENT)`. Split `app-view.ts` before it exceeds 400 lines:

- Move existing battle-only DOM helpers into `rpg/src/app/render-battle-app.ts`.
- Add `rpg/src/app/render-world-app.ts` for the same exploration information hierarchy as the Webview.
- Keep `mountApp` responsible only for the editor, controller subscription and mode dispatch.
- In V2 local recovery, render the old code in a read-only `<textarea>` with a `download` button before the reset button.

Add one `app-view.test.ts` case proving a recovery snapshot exposes the legacy code and one existing battle-render case proving the extracted renderer still works.

- [ ] **Step 4: Run focused integration tests**

Run: `cd rpg && npm test -- src/app/world-campaign-controller.test.ts src/vscode/game-session.test.ts src/app/app-view.test.ts`

Expected: PASS, including the complete first-chapter sequence.

- [ ] **Step 5: Run the stage-completion verification suite**

Run: `cd rpg && npm test`

Expected: all Vitest suites pass with 0 failures.

Run: `cd rpg && npm run build`

Expected: typecheck, web build, extension build and Webview build all exit 0.

Run: `cd rpg && npm run test:extension`

Expected: VS Code extension integration suite exits 0.

- [ ] **Step 6: Package and install the extension locally**

Run: `cd rpg && npm run install:local`

Expected: `dist/python-rpg.vsix` is rebuilt and VS Code reports the extension was installed with `--force`.

- [ ] **Step 7: Perform one real VS Code acceptance flow**

1. Reload the VS Code window and open `Python 沼泽战役`.
2. Confirm `python-rpg/python-marsh-01.py` contains both callables.
3. Run one valid exploration command and confirm the quest step advances.
4. Run one invalid repeated collect and confirm task feedback appears without a revision change.
5. Continue through relay repair, enter the guardian battle and confirm the same file now invokes `choose_turn`.
6. Finish the battle, submit the report, reload the window and confirm location, quest, inventory, encounter state and source file are restored.
7. Open the Go campaign and run one legal turn to confirm the legacy battle controller remains intact.

- [ ] **Step 8: Review the final diff and commit the vertical slice**

Run: `git diff --check`

Expected: no whitespace errors.

```bash
git add rpg/src/game/content/python/python-marsh-01.ts rpg/src/game/content/python/levels.ts rpg/src/app/world-campaign-controller.test.ts rpg/src/vscode/game-session.test.ts rpg/src/main.ts rpg/src/app/app-view.ts rpg/src/app/render-battle-app.ts rpg/src/app/render-world-app.ts rpg/src/app/app-view.test.ts
git commit -m "feat: complete Python world campaign chapter one"
```

## Deferred After The Vertical Slice

- Chapters 2-3: independent content plan for conditions, loops and data variants.
- Chapter 4: independent content plan for functions and multi-step tasks.
- Chapters 5-6: independent content and Runner plan; only then extend `SAFE_ALLOWED_MODULES` to include `json` and add host-provided read-only files.
- Training commissions and learning logs: only after all six main chapters are stable.
- A reusable content editor or generalized rule DSL remains out of scope unless repeated chapter implementations prove the need.
