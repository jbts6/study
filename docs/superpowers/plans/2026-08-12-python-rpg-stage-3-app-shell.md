# Python RPG Stage 3 App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付桌面端单屏 Python 战术 RPG 应用外壳，让玩家在本机 CodeMirror 中编写代码，经 loopback Runner 调用本机 CPython，完成、保存并恢复一个战斗遭遇。

**Architecture:** `AppController` 是唯一应用状态源，注入 `RunnerClient`、`SaveStore`、初始遭遇工厂和敌方预设指令。UI 只订阅 `AppSnapshot` 并转发编辑、运行、中断和重置操作；浏览器不执行 Python，所有运行请求只发送到 `ws://127.0.0.1:5175`。

**Tech Stack:** Node.js 24.15.0、TypeScript 7.0.2、Vite 8.2.1、Vitest 4.1.10、Playwright 1.62.1、CodeMirror 6、本机 CPython 3.12+、原生 DOM/CSS、loopback WebSocket。

## Global Constraints

- 设计契约以 `docs/superpowers/specs/2026-08-12-python-rpg-stage-3-app-shell-design.md` 为准。
- 生产代码不得导入 `src/game/testing/**`；初始遭遇必须位于生产模块，测试夹具反向复用生产遭遇。
- `AppController` 是唯一应用状态源；不得增加事件总线、第二套 reducer、状态库或 UI 框架。
- 游戏页面只由 Vite 在 `127.0.0.1:5174` 提供；Runner 只监听 `127.0.0.1:5175`。
- Python 代码不得发送到远程服务；不得使用 Pyodide、WASM、CDN、远程字体、分析服务或远程 API。
- CodeMirror 依赖固定为 `codemirror@6.0.2`、`@codemirror/state@6.7.1`、`@codemirror/lang-python@6.2.1`。
- 唯一存档键为 `python-rpg.save`，唯一支持版本为 `1`，关卡 ID 为 `python-marsh-01`。
- 任何重置执行前必须输入与 `重置存档` 完全相同的文本；普通二次点击确认不满足要求。
- 只实现桌面端，目标视口为 1280×720 及以上；不得增加窄屏和移动端断点。
- Runner UI 状态只允许：连接中、可运行、运行中、不可用。
- 玩家只控制友方；阶段 3 敌方回合固定执行 `wait`，不得建设 AI 系统。
- 运行失败、非法指令、超时和中断不得推进战斗或覆盖已保存的战斗状态。
- 测试只覆盖控制器关键行为、存档正常/损坏路径、浏览器 Runner 正常路径和一条 Playwright 主流程；不得扩展错误排列组合。
- 每个任务只运行直接相关的测试；`npm test` 和 `npm run build` 只在 Task 5 阶段收尾时执行。
- 不修改阶段 1 战斗规则和阶段 2 Runner 进程生命周期契约，除非计划审查发现无法实现的真实冲突并先回到用户确认。

---

## File Structure

### 新建文件

- `rpg/src/game/content/python-marsh-01.ts`：生产初始遭遇、关卡 ID 和 Python 脚手架。
- `rpg/src/app/save-store.ts`：V1 存档类型、必要字段解析、单键读写与删除。
- `rpg/src/app/save-store.test.ts`：正常恢复、损坏存档和必要字段检查。
- `rpg/src/app/runner-client.ts`：浏览器 WebSocket Runner 客户端和展示状态映射。
- `rpg/src/app/runner-client.test.ts`：通过真实 loopback Runner 验证一次浏览器请求。
- `rpg/src/app/app-controller.ts`：唯一应用状态、回合编排、敌方 `wait`、反馈和存档时机。
- `rpg/src/app/app-controller.test.ts`：成功、失败和文本重置关键行为。
- `rpg/src/app/code-editor.ts`：CodeMirror 创建、值同步和只读切换。
- `rpg/src/app/app-view.ts`：桌面 DOM、战场渲染、控件绑定、反馈与重置确认。
- `rpg/src/styles.css`：奥术工业控制台 token、桌面三层布局、状态和动效。
- `rpg/playwright.config.ts`：同时启动 Vite 与本地 Runner 的唯一 E2E 配置。
- `rpg/e2e/app-shell.spec.ts`：编辑、运行、刷新恢复和完成遭遇的主流程。
- `rpg/README.md`：本地启动、CPython 要求、保存位置和重置方式。

### 修改文件

- `rpg/src/game/testing/fixture.ts`：复用生产遭遇，不复制初始状态。
- `rpg/src/main.ts`：创建依赖、挂载 UI、启动控制器。
- `rpg/package.json`：增加 CodeMirror 依赖和 `test:e2e` 命令。
- `rpg/package-lock.json`：由 `npm install` 生成依赖锁定。
- `docs/superpowers/plans/2026-08-10-python-rpg-roadmap.md`：阶段完成后勾选阶段 3。

---

### Task 1: Production Encounter and Versioned Save Store

**Files:**
- Create: `rpg/src/game/content/python-marsh-01.ts`
- Create: `rpg/src/app/save-store.ts`
- Create: `rpg/src/app/save-store.test.ts`
- Modify: `rpg/src/game/testing/fixture.ts`

**Interfaces:**
- Produces: `CURRENT_LEVEL_ID`, `STARTER_CODE`, `createPythonMarsh01()`。
- Produces: `SaveDataV1`, `SaveLoadResult`, `SaveStore`, `LocalSaveStore`。
- `LocalSaveStore.load()` 返回成功存档、空存档或损坏结果，不抛出 JSON 解析异常。

- [ ] **Step 1: Write the failing save-store tests**

Create `rpg/src/app/save-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createPythonMarsh01, CURRENT_LEVEL_ID, STARTER_CODE } from "../game/content/python-marsh-01";
import { LocalSaveStore } from "./save-store";

describe("LocalSaveStore", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips the single V1 save", () => {
    const store = new LocalSaveStore(localStorage);
    const save = {
      version: 1 as const,
      currentLevelId: CURRENT_LEVEL_ID,
      battleState: createPythonMarsh01(),
      codeDraft: STARTER_CODE,
    };

    store.save(save);

    expect(store.load()).toEqual({ ok: true, save });
    expect(localStorage.length).toBe(1);
  });

  it("reports corrupted JSON instead of replacing it", () => {
    localStorage.setItem("python-rpg.save", "{broken");
    const store = new LocalSaveStore(localStorage);

    expect(store.load()).toEqual({
      ok: false,
      message: "本地存档无法读取。请输入“重置存档”后重新开始。",
    });
    expect(localStorage.getItem("python-rpg.save")).toBe("{broken");
  });

  it("rejects a V1 object with a malformed skill effect", () => {
    const battleState = createPythonMarsh01();
    localStorage.setItem("python-rpg.save", JSON.stringify({
      version: 1,
      currentLevelId: CURRENT_LEVEL_ID,
      battleState: {
        ...battleState,
        units: battleState.units.map((unit, unitIndex) => unitIndex === 0
          ? {
              ...unit,
              skills: unit.skills.map((skill, skillIndex) => skillIndex === 0
                ? { ...skill, effect: { statusId: "shock", duration: 1, defenseBonus: 0, chancePermille: 1001 } }
                : skill),
            }
          : unit),
      },
      codeDraft: STARTER_CODE,
    }));

    expect(new LocalSaveStore(localStorage).load().ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/app/save-store.test.ts
```

Expected: FAIL because `python-marsh-01.ts` and `save-store.ts` do not exist.

- [ ] **Step 3: Create the production encounter**

Create `rpg/src/game/content/python-marsh-01.ts` with the fixture state moved into production:

```ts
import type { BattleState } from "../combat/types";

export const CURRENT_LEVEL_ID = "python-marsh-01" as const;

export const STARTER_CODE = `def choose_turn(world):
    # world 包含当前行动者、战场、单位和目标。
    actor = world["activeUnitId"]
    revision = world["revision"]

    # 把 wait 替换为你的移动、攻击或施法指令。
    return {
        "actorId": actor,
        "expectedRevision": revision,
        "action": {"type": "wait"},
    }
`;

export function createPythonMarsh01(): BattleState {
  return {
    battleId: "python-marsh-01",
    contentVersion: "python-slice-1",
    revision: 0,
    round: 1,
    turnIndex: 0,
    turnOrder: ["scout", "golem"],
    phase: "in_progress",
    rngState: 2463534242,
    maxRounds: 4,
    board: {
      width: 3,
      height: 2,
      blockedCells: [],
      hazardCells: [{ x: 2, y: 1 }],
      coverCells: [{ x: 2, y: 0 }],
      hazardDamage: 2,
    },
    objectives: [{
      id: "relay",
      cell: { x: 0, y: 1 },
      durability: 2,
      completed: false,
      key: true,
    }],
    failureConditions: { keyObjectiveDestroyed: false },
    units: [
      {
        id: "scout",
        team: "allies",
        visibility: "revealed",
        cell: { x: 0, y: 0 },
        hp: 10,
        maxHp: 10,
        attack: 4,
        defense: 0,
        move: 2,
        initiative: 9,
        disabled: false,
        statuses: [],
        skills: [
          { id: "spark", range: 2, power: 2, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" },
          { id: "mend", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "heal" },
        ],
      },
      {
        id: "golem",
        team: "enemies",
        visibility: "revealed",
        cell: { x: 2, y: 0 },
        hp: 8,
        maxHp: 8,
        attack: 2,
        defense: 1,
        move: 1,
        initiative: 4,
        disabled: false,
        statuses: [],
        skills: [
          { id: "smash", range: 1, power: 1, cooldown: 2, remainingCooldown: 1, target: "unit", kind: "damage" },
        ],
      },
      {
        id: "lurker",
        team: "enemies",
        visibility: "hidden",
        cell: { x: 2, y: 1 },
        hp: 5,
        maxHp: 5,
        attack: 3,
        defense: 0,
        move: 1,
        initiative: 1,
        disabled: true,
        statuses: [],
        skills: [
          { id: "ambush", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" },
        ],
      },
    ],
  };
}
```

- [ ] **Step 4: Make the test fixture reuse production data**

Replace `createFixtureState()` in `rpg/src/game/testing/fixture.ts` with:

```ts
import { createPythonMarsh01 } from "../content/python-marsh-01";

export function createFixtureState(): BattleState {
  return createPythonMarsh01();
}
```

Keep `fixtureCommands` and `worldViewFixture` unchanged. Do not leave the old state literal in the test fixture.

- [ ] **Step 5: Implement the V1 save store**

Create `rpg/src/app/save-store.ts` with these exact public contracts:

```ts
import type { BattleState, BattleUnit, Cell, Objective, Skill, SkillEffect, Status } from "../game/combat/types";
import { CURRENT_LEVEL_ID } from "../game/content/python-marsh-01";

export const SAVE_KEY = "python-rpg.save";
export const RESET_CONFIRMATION = "重置存档";

export type SaveDataV1 = Readonly<{
  version: 1;
  currentLevelId: typeof CURRENT_LEVEL_ID;
  battleState: BattleState;
  codeDraft: string;
}>;

export type SaveLoadResult =
  | Readonly<{ ok: true; save: SaveDataV1 | null }>
  | Readonly<{ ok: false; message: string }>;

export interface SaveStore {
  load(): SaveLoadResult;
  save(value: SaveDataV1): void;
  remove(): void;
}

export class LocalSaveStore implements SaveStore {
  constructor(private readonly storage: Storage) {}

  load(): SaveLoadResult {
    const raw = this.storage.getItem(SAVE_KEY);
    if (raw === null) return { ok: true, save: null };
    try {
      const value: unknown = JSON.parse(raw);
      return isSaveDataV1(value)
        ? { ok: true, save: value }
        : corrupted();
    } catch {
      return corrupted();
    }
  }

  save(value: SaveDataV1): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(value));
  }

  remove(): void {
    this.storage.removeItem(SAVE_KEY);
  }
}
```

Implement small local predicates in the same file; do not add a schema library. The predicates must verify every field that the battle renderer and combat core immediately read:

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCell(value: unknown): value is Cell {
  return isRecord(value) && Number.isInteger(value.x) && Number.isInteger(value.y);
}

function isStatus(value: unknown): value is Status {
  return isRecord(value)
    && typeof value.id === "string"
    && Number.isInteger(value.remainingTurns)
    && isFiniteNumber(value.defenseBonus);
}

function isSkillEffect(value: unknown): value is SkillEffect {
  return isRecord(value)
    && typeof value.statusId === "string"
    && Number.isInteger(value.duration)
    && value.duration >= 1
    && isFiniteNumber(value.defenseBonus)
    && (value.chancePermille === undefined
      || (Number.isInteger(value.chancePermille)
        && value.chancePermille >= 0
        && value.chancePermille <= 1_000));
}

function isSkill(value: unknown): value is Skill {
  return isRecord(value)
    && typeof value.id === "string"
    && isFiniteNumber(value.range)
    && isFiniteNumber(value.power)
    && isFiniteNumber(value.cooldown)
    && isFiniteNumber(value.remainingCooldown)
    && (value.target === "unit" || value.target === "cell")
    && (value.kind === "damage" || value.kind === "heal")
    && (value.effect === undefined || isSkillEffect(value.effect));
}

function isUnit(value: unknown): value is BattleUnit {
  return isRecord(value)
    && typeof value.id === "string"
    && (value.team === "allies" || value.team === "enemies")
    && (value.visibility === "revealed" || value.visibility === "hidden")
    && isCell(value.cell)
    && isFiniteNumber(value.hp)
    && isFiniteNumber(value.maxHp)
    && isFiniteNumber(value.attack)
    && isFiniteNumber(value.defense)
    && isFiniteNumber(value.move)
    && isFiniteNumber(value.initiative)
    && typeof value.disabled === "boolean"
    && Array.isArray(value.skills)
    && value.skills.every(isSkill)
    && Array.isArray(value.statuses)
    && value.statuses.every(isStatus);
}

function isObjective(value: unknown): value is Objective {
  return isRecord(value)
    && typeof value.id === "string"
    && isCell(value.cell)
    && isFiniteNumber(value.durability)
    && typeof value.completed === "boolean"
    && typeof value.key === "boolean";
}
```

Add `isBattleState()` to check all top-level fields, board arrays/cells, units, objectives, `rngState`, `maxRounds`, and `failureConditions.keyObjectiveDestroyed`. Add `isSaveDataV1()` to require exactly version `1`, level `python-marsh-01`, a string code draft, and `isBattleState(value.battleState)`. Return this exact message from `corrupted()`:

```ts
function corrupted(): SaveLoadResult {
  return {
    ok: false,
    message: "本地存档无法读取。请输入“重置存档”后重新开始。",
  };
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/app/save-store.test.ts src/game/combat/combat-core.e2e.test.ts
```

Expected: 2 test files pass. The existing fixed combat still ends with `won` and revision `5`.

- [ ] **Step 7: Commit Task 1**

```bash
git add rpg/src/game/content/python-marsh-01.ts
git add rpg/src/game/testing/fixture.ts
git add rpg/src/app/save-store.ts
git add rpg/src/app/save-store.test.ts
git commit -m "feat: add stage3 encounter and local save"
```

---

### Task 2: Browser WebSocket Runner Client

**Files:**
- Create: `rpg/src/app/runner-client.ts`
- Create: `rpg/src/app/runner-client.test.ts`

**Interfaces:**
- Produces: `RunnerDisplayState`, `RunnerClient`, `WebSocketRunnerClient`。
- Consumes existing `RunRequest`, `RunResult`, and protocol `RunnerState` without modifying protocol files.

- [ ] **Step 1: Write the failing loopback client test**

Create `rpg/src/app/runner-client.test.ts`. Reuse `startRunnerServer`, `loadPythonDetection`, and `worldViewFixture`. The test must connect through the new browser client, send one real `choose_turn` request, and observe `ready → running → ready`:

```ts
import { describe, expect, it } from "vitest";
import { startRunnerServer } from "../runners/local/node-server";
import { loadPythonDetection } from "../runners/local/test-support";
import type { RunRequest } from "../runners/protocol/types";
import { worldViewFixture } from "../game/testing/fixture";
import { WebSocketRunnerClient } from "./runner-client";

const python = await loadPythonDetection();

describe.skipIf(!python)("WebSocketRunnerClient", () => {
  it("runs one request through the loopback server", async () => {
    const server = await startRunnerServer(0);
    const client = new WebSocketRunnerClient(`ws://127.0.0.1:${server.port}`);
    const states: string[] = [];
    client.onStateChange((state) => states.push(state));

    try {
      await client.connect();
      const request: RunRequest = {
        protocolVersion: 1,
        runId: "browser-client-1",
        attemptId: "browser-client-1:1",
        questId: "python-marsh-01",
        language: "python",
        files: {
          "main.py": "def choose_turn(world):\n    return {'actorId': world['activeUnitId'], 'expectedRevision': world['revision'], 'action': {'type': 'wait'}}\n",
        },
        entrypoint: { file: "main.py", callable: "choose_turn" },
        worldView: worldViewFixture,
        allowedModules: ["math"],
        limits: {
          timeoutMs: 5_000,
          interruptGraceMs: 500,
          maxFiles: 10,
          maxFileBytes: 65_536,
          maxSourceBytes: 65_536,
          maxOutputBytes: 16_384,
          maxTraceEvents: 1_000,
          maxValueDepth: 3,
        },
      };

      const result = await client.run(request);

      expect(result.executionStatus).toBe("completed");
      expect(result.returnValue).toMatchObject({ actorId: "scout" });
      expect(states).toContain("running");
      expect(states.at(-1)).toBe("ready");
    } finally {
      client.close();
      await server.close();
    }
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm test -- src/app/runner-client.test.ts
```

Expected: FAIL because `runner-client.ts` does not exist.

- [ ] **Step 3: Implement the browser client**

Create `rpg/src/app/runner-client.ts` with these contracts:

```ts
import type { RunRequest, RunResult, RunnerState } from "../runners/protocol/types";

export type RunnerDisplayState = "connecting" | "ready" | "running" | "unavailable";

export interface RunnerClient {
  readonly state: RunnerDisplayState;
  connect(): Promise<void>;
  run(request: RunRequest): Promise<RunResult>;
  interrupt(runId: string): void;
  onStateChange(listener: (state: RunnerDisplayState) => void): () => void;
  close(): void;
}
```

`WebSocketRunnerClient` must implement the following exact behavior:

```ts
type ActiveRun = Readonly<{
  runId: string;
  resolve: (result: RunResult) => void;
  reject: (error: Error) => void;
}>;

function displayState(state: RunnerState): RunnerDisplayState {
  if (state === "ready") return "ready";
  if (state === "running" || state === "interrupting") return "running";
  if (state === "unavailable") return "unavailable";
  return "connecting";
}
```

- Constructor receives only the loopback URL.
- Initial state is `connecting`.
- `connect()` creates one native `WebSocket`, resolves on `open`, sends `{ type: "subscribe_state" }`, and rejects on the first connection failure.
- Incoming `{ type: "state", state }` messages update display state through `displayState()`.
- `run()` requires an open socket and no active request, stores one `ActiveRun`, sends `{ type: "run", request }`, and resolves only for the matching `{ type: "run_result", result }`.
- `interrupt(runId)` sends `{ type: "interrupt", runId }` only when the socket is open.
- `{ type: "protocol_error" }` rejects the active run with the server message.
- Socket `close` or `error` sets `unavailable` and rejects the active run with `本地 Python Runner 不可用。启动 Runner 后刷新页面。`.
- `close()` closes the socket, rejects any active run, and sets `unavailable`.
- Do not add automatic reconnect, retry timers, multiple pending requests, generation counters, or hidden lifecycle states.

Use private `setState()` and `finishActive()` helpers so every state publication and active-run cleanup occurs in one place. Keep the file below 200 lines.

- [ ] **Step 4: Run the focused test**

```bash
npm test -- src/app/runner-client.test.ts
```

Expected: PASS when CPython 3.12+ is available; otherwise the existing `describe.skipIf` skip is explicit.

- [ ] **Step 5: Commit Task 2**

```bash
git add rpg/src/app/runner-client.ts
git add rpg/src/app/runner-client.test.ts
git commit -m "feat: add browser runner client"
```

---

### Task 3: AppController Orchestration

**Files:**
- Create: `rpg/src/app/app-controller.ts`
- Create: `rpg/src/app/app-controller.test.ts`

**Interfaces:**
- Consumes: `RunnerClient`, `SaveStore`, `createPythonMarsh01`, `projectWorldView`, `resolveTurn`。
- Produces: `AppFeedback`, `GameSnapshot`, `SaveRecoverySnapshot`, `AppSnapshot`, `AppController`。
- Later UI code may only mutate app behavior through controller public methods.

- [ ] **Step 1: Write the failing controller tests**

Create `rpg/src/app/app-controller.test.ts` with one `FakeRunner` and one `MemorySaveStore`. Cover exactly these three behaviors:

```ts
it("applies a valid player command, auto-waits the enemy, and saves revision 2", async () => {
  const runner = new FakeRunner(completed({
    actorId: "scout",
    expectedRevision: 0,
    movePath: [{ x: 1, y: 0 }],
    action: { type: "attack", targetId: "golem" },
  }));
  const saves = new MemorySaveStore(null);
  const controller = createController(runner, saves);
  await controller.start();

  await controller.runTurn();

  const snapshot = controller.getSnapshot();
  expect(snapshot.mode).toBe("game");
  if (snapshot.mode !== "game") throw new Error("expected game mode");
  expect(snapshot.battleState.revision).toBe(2);
  expect(snapshot.battleState.turnOrder[snapshot.battleState.turnIndex]).toBe("scout");
  expect(saves.saved?.battleState.revision).toBe(2);
  expect(snapshot.feedback.kind).toBe("success");
});

it("keeps battle and save unchanged when Python fails", async () => {
  const runner = new FakeRunner(failedResult("syntax_error", {
    code: "PYTHON_SYNTAX_ERROR",
    severity: "error",
    message: "SyntaxError: expected ':'",
    location: { file: "main.py", line: 3, column: 17 },
    recoveryAction: "修改代码后重新运行。",
  }));
  const saves = new MemorySaveStore(null);
  const controller = createController(runner, saves);
  await controller.start();
  const savedBefore = saves.saved;

  await controller.runTurn();

  const snapshot = controller.getSnapshot();
  if (snapshot.mode !== "game") throw new Error("expected game mode");
  expect(snapshot.battleState.revision).toBe(0);
  expect(saves.saved?.battleState.revision).toBe(savedBefore?.battleState.revision);
  expect(snapshot.feedback.kind).toBe("error");
  expect(snapshot.feedback.messages).toContain(
    "[error] PYTHON_SYNTAX_ERROR main.py:3:17 SyntaxError: expected ':'",
  );
});

it("requires the exact reset phrase before replacing a corrupt save", async () => {
  const saves = new MemorySaveStore({ ok: false, message: "损坏" });
  const runner = new FakeRunner(completed(null));
  const controller = createController(runner, saves);
  await controller.start();
  expect(controller.getSnapshot().mode).toBe("save_recovery");
  expect(runner.connectCount).toBe(0);

  controller.resetSave("重置");
  expect(controller.getSnapshot().mode).toBe("save_recovery");
  expect(saves.removeCount).toBe(0);

  controller.resetSave("重置存档");
  expect(controller.getSnapshot().mode).toBe("game");
  expect(saves.removeCount).toBe(1);
  expect(saves.saved?.version).toBe(1);
  expect(runner.connectCount).toBe(1);
});
```

The helper results must use the real `RunResult` fields. `FakeRunner.connect()` increments a public test counter before resolving. `MemorySaveStore` must implement the public `SaveStore` interface rather than exposing test-only methods to production code.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm test -- src/app/app-controller.test.ts
```

Expected: FAIL because `app-controller.ts` does not exist.

- [ ] **Step 3: Define the controller snapshot types**

Create these types in `rpg/src/app/app-controller.ts`:

```ts
export type AppFeedback = Readonly<{
  kind: "idle" | "success" | "error" | "info";
  title: string;
  messages: readonly string[];
  stdout: string;
  stderr: string;
}>;

export type GameSnapshot = Readonly<{
  mode: "game";
  currentLevelId: typeof CURRENT_LEVEL_ID;
  battleState: BattleState;
  codeDraft: string;
  runnerState: RunnerDisplayState;
  feedback: AppFeedback;
  activeRunId?: string;
}>;

export type SaveRecoverySnapshot = Readonly<{
  mode: "save_recovery";
  message: string;
}>;

export type AppSnapshot = GameSnapshot | SaveRecoverySnapshot;
```

The constructor creates a transient initial `GameSnapshot` from `createEncounter()`, `STARTER_CODE`, the current `runner.state`, and idle feedback. It does not save or connect. This gives `getSnapshot()` and the first subscription a defined value before `start()` loads storage.

Dependencies:

```ts
type AppControllerDependencies = Readonly<{
  runner: RunnerClient;
  saveStore: SaveStore;
  createEncounter: () => BattleState;
  enemyCommand: (state: Readonly<BattleState>) => TurnCommand;
  createId?: () => string;
}>;
```

- [ ] **Step 4: Implement startup, subscriptions, code saving, and reset**

`AppController` must expose exactly:

```ts
start(): Promise<void>
setCode(code: string): void
runTurn(): Promise<void>
interrupt(): Promise<void>
resetSave(confirmation: string): void
subscribe(listener: (snapshot: AppSnapshot) => void): () => void
getSnapshot(): AppSnapshot
```

Startup rules:

- `saveStore.load()` failure publishes `save_recovery` and does not connect the Runner.
- Empty storage creates and saves `{ version: 1, currentLevelId, battleState: createEncounter(), codeDraft: STARTER_CODE }`, then follows the same game/connect path as valid storage.
- Empty or valid storage publishes game mode and then awaits `runner.connect()`.
- Connection failure updates the game snapshot to `unavailable`; it does not discard the restored save.
- Runner state listener replaces only `runnerState` and republishes the same game snapshot.
- `subscribe()` immediately invokes the new listener once with the current snapshot, then publishes later changes until unsubscribe.
- `start()` performs storage loading and its first publish before awaiting Runner connection, so a corrupted save replaces the transient game snapshot before the browser can paint it.

`setCode()` only works in game mode, replaces `codeDraft`, saves the full current V1 object immediately, and publishes the new snapshot.

`resetSave()` returns without changes unless `confirmation === RESET_CONFIRMATION`. On exact match it removes the old key, creates and saves a fresh encounter with `STARTER_CODE`, publishes game mode, and starts Runner connection.

- [ ] **Step 5: Implement run request creation and result handling**

Use these exact limits:

```ts
const RUN_LIMITS = {
  timeoutMs: 5_000,
  interruptGraceMs: 500,
  maxFiles: 10,
  maxFileBytes: 65_536,
  maxSourceBytes: 65_536,
  maxOutputBytes: 16_384,
  maxTraceEvents: 1_000,
  maxValueDepth: 4,
} as const;
```

`TurnCommand` may contain `movePath: [{ x, y }]`; its scalar coordinates require depth `4` under the existing Runner serializer. Keep the lower `3` value in the Task 2 wait-only client test, but use `4` for playable AppController requests.

Build each request as:

```ts
const runId = createId();
const request: RunRequest = {
  protocolVersion: 1,
  runId,
  attemptId: `${runId}:1`,
  questId: CURRENT_LEVEL_ID,
  language: "python",
  files: { "main.py": snapshot.codeDraft },
  entrypoint: { file: "main.py", callable: "choose_turn" },
  worldView: projectWorldView(snapshot.battleState),
  allowedModules: ["math"],
  limits: RUN_LIMITS,
};
```

`runTurn()` must return immediately unless mode is game, Runner state is `ready`, battle phase is `in_progress`, and no `activeRunId` exists. It must publish `activeRunId` before awaiting `runner.run()`.

Result rules:

- Any `executionStatus !== "completed"` publishes `error` or `info` feedback using the result diagnostics and streams; battle state and save remain unchanged. `feedbackFromRunResult()` formats each diagnostic as `[severity] code file:line[:column] message` when a location exists, so syntax failures visibly include the Python line and runtime failures retain the exception type from `message`.
- A completed result is passed as `unknown` to `resolveTurn`.
- Rejected commands publish the combat errors as `error` feedback; battle state and save remain unchanged.
- Accepted player commands update the state, append their events, and then call `enemyCommand` while the active enabled unit belongs to `enemies`.
- Each enemy command must pass through `resolveTurn`; an impossible rejection throws an internal error because the preset command is owned by the application.
- Save exactly once after the player command and all automatic enemy commands succeed.
- Success feedback includes formatted event messages, stdout, and stderr.
- A caught transport exception publishes `本地 Python Runner 不可用。启动 Runner 后刷新页面。` and sets `runnerState` to `unavailable` without advancing battle.

`interrupt()` returns a Promise that resolves immediately after dispatching the current `activeRunId` to `runner.interrupt()`; it does not wait for process termination and does not mutate battle state itself. The later interrupted `RunResult` clears the active run and publishes `运行已中断，回合未推进。`.

Keep `runTurn()` below 60 lines by extracting `createRunRequest`, `resolvePlayerResult`, `advanceEnemyTurns`, `saveGame`, `feedbackFromRunResult`, and `formatBattleEvent` helpers.

- [ ] **Step 6: Run focused controller and save tests**

```bash
npm test -- src/app/app-controller.test.ts src/app/save-store.test.ts
```

Expected: both test files pass; no warnings or unhandled rejections.

- [ ] **Step 7: Commit Task 3**

```bash
git add rpg/src/app/app-controller.ts
git add rpg/src/app/app-controller.test.ts
git commit -m "feat: orchestrate playable turns"
```

---

### Task 4: Desktop App Shell and Real Playwright Flow

**Files:**
- Create: `rpg/src/app/code-editor.ts`
- Create: `rpg/src/app/app-view.ts`
- Create: `rpg/src/styles.css`
- Create: `rpg/playwright.config.ts`
- Create: `rpg/e2e/app-shell.spec.ts`
- Modify: `rpg/src/main.ts`
- Modify: `rpg/package.json`
- Modify: `rpg/package-lock.json`

**Interfaces:**
- Consumes: `AppController`, `AppSnapshot`, `LocalSaveStore`, `WebSocketRunnerClient`, `createPythonMarsh01`。
- Produces: visible desktop game shell and the only Playwright stage flow.

- [ ] **Step 1: Add the Playwright command and failing main-flow test**

Add to `rpg/package.json` scripts:

```json
"test:e2e": "playwright test"
```

Create `rpg/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: "npm run runner -- --port 5175",
      port: 5175,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174",
      port: 5174,
      reuseExistingServer: false,
    },
  ],
});
```

Create `rpg/e2e/app-shell.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const WINNING_CODE = `def choose_turn(world):
    actor = world["activeUnitId"]
    revision = world["revision"]
    if revision == 0:
        return {
            "actorId": actor,
            "expectedRevision": revision,
            "movePath": [{"x": 1, "y": 0}],
            "action": {"type": "attack", "targetId": "golem"},
        }
    if revision == 2:
        return {
            "actorId": actor,
            "expectedRevision": revision,
            "action": {"type": "cast", "skillId": "spark", "targetId": "golem"},
        }
    return {
        "actorId": actor,
        "expectedRevision": revision,
        "action": {"type": "attack", "targetId": "golem"},
    }
`;

test("runs, restores, and completes the stage 3 encounter", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByTestId("current-level-id")).toHaveText("python-marsh-01");
  await expect(page.getByTestId("runner-status")).toHaveText("可运行");

  await page.locator(".cm-content").fill(WINNING_CODE);
  await page.getByTestId("run-turn").click();
  await expect(page.getByTestId("battle-revision")).toHaveText("2");

  await page.reload();
  await expect(page.getByTestId("battle-revision")).toHaveText("2");
  await expect(page.locator(".cm-content")).toContainText("revision == 2");

  await page.getByTestId("run-turn").click();
  await expect(page.getByTestId("battle-revision")).toHaveText("4");
  await page.getByTestId("run-turn").click();

  await expect(page.getByTestId("battle-phase")).toHaveText("胜利");
  await expect(page.getByTestId("unit-golem")).toContainText("0 / 8");
});
```

- [ ] **Step 2: Run Playwright and verify RED**

If Chromium is not installed, run once:

```bash
npx playwright install chromium
```

Then run:

```bash
npm run test:e2e -- e2e/app-shell.spec.ts
```

Expected: FAIL because the current app has no heading, editor, controls, or test IDs. Do not change the test to match the empty app.

- [ ] **Step 3: Install the pinned CodeMirror dependencies**

```bash
npm install codemirror@6.0.2 @codemirror/state@6.7.1 @codemirror/lang-python@6.2.1
```

Expected: `package.json` and `package-lock.json` contain exactly these direct dependencies; no UI framework or remote asset package is added.

- [ ] **Step 4: Implement the CodeMirror adapter**

Create `rpg/src/app/code-editor.ts`:

```ts
import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { python } from "@codemirror/lang-python";

export type CodeEditorHandle = Readonly<{
  getValue(): string;
  setValue(value: string): void;
  setReadOnly(readOnly: boolean): void;
  focus(): void;
  destroy(): void;
}>;

export function mountCodeEditor(
  parent: HTMLElement,
  initialValue: string,
  onChange: (value: string) => void,
): CodeEditorHandle {
  const editable = new Compartment();
  const state = EditorState.create({
    doc: initialValue,
    extensions: [
      basicSetup,
      python(),
      editable.of(EditorView.editable.of(true)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange(update.state.doc.toString());
      }),
      EditorView.theme({
        "&": { height: "100%", backgroundColor: "transparent", color: "var(--text)" },
        ".cm-content": { fontFamily: "var(--font-code)", fontSize: "14px" },
        ".cm-gutters": { backgroundColor: "var(--surface-deep)", color: "var(--text-muted)", border: "0" },
        ".cm-cursor": { borderLeftColor: "var(--arcane)" },
        ".cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--arcane) 28%, transparent) !important" },
      }),
    ],
  });
  const view = new EditorView({ state, parent });

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (value) => {
      if (value === view.state.doc.toString()) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    },
    setReadOnly: (readOnly) => {
      view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!readOnly)) });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
```

- [ ] **Step 5: Implement the passive desktop view**

Create `rpg/src/app/app-view.ts` with one exported function:

```ts
export function mountApp(root: HTMLElement, controller: AppController): () => void
```

The function must:

- Subscribe once to controller snapshots and unsubscribe/destroy CodeMirror on cleanup.
- Render recovery mode without mounting the game shell.
- Render game mode once, then update existing DOM nodes instead of replacing the editor on every keystroke. A later `save_recovery → game` transition must create the game shell and CodeMirror instance at that time.
- Bind CodeMirror changes to `controller.setCode`.
- Bind `data-testid="run-turn"` to `controller.runTurn()`.
- Bind `data-testid="interrupt-run"` to `void controller.interrupt()`.
- Open a native `<dialog>` from the weak danger action `重置存档`.
- Keep the final reset button disabled until the input value is exactly `重置存档`; submit by click or Enter calls `controller.resetSave(input.value)`.
- Use the same exact text gate in recovery mode.

The game shell must contain these stable test IDs:

```html
<span data-testid="current-level-id"></span>
<span data-testid="runner-status"></span>
<span data-testid="battle-revision"></span>
<span data-testid="battle-phase"></span>
<div data-testid="code-editor"></div>
<button data-testid="run-turn">运行回合</button>
<button data-testid="interrupt-run">中断运行</button>
<section data-testid="feedback" aria-live="polite"></section>
```

Render every visible unit as:

```html
<article data-testid="unit-{id}" class="battle-unit">名称 · hp / maxHp</article>
```

Required state behavior:

- `connecting`: show `连接中`, editor editable, both action buttons disabled.
- `ready`: show `可运行`, editor editable, run enabled only while battle is in progress.
- `running`: show `运行中`, editor read-only, run disabled, interrupt visible and enabled.
- `unavailable`: show `不可用`, editor editable, run disabled, feedback includes `启动 Runner 后刷新页面`.
- `won`: show `胜利`; `lost`: show `失败`; both disable run.

Battle grid layout must derive columns from `battleState.board.width`; do not hard-code a 3×2 DOM. Use `data-cell="x-y"`, CSS grid, terrain classes, and unit/objective overlays. Use text labels and `aria-label`; do not use emoji as icons.

- [ ] **Step 6: Implement the desktop visual contract**

Create `rpg/src/styles.css`. Define at minimum these tokens:

```css
:root {
  color-scheme: dark;
  --background: #081018;
  --surface: #111f29;
  --surface-deep: #071115;
  --border: #304d59;
  --text: #d9e7eb;
  --text-muted: #8da3aa;
  --brass: #d2ac62;
  --arcane: #6be4df;
  --danger: #e17867;
  --success: #72d8ae;
  --font-display: Georgia, "Times New Roman", serif;
  --font-body: "Trebuchet MS", "Segoe UI", sans-serif;
  --font-code: "Cascadia Code", Consolas, monospace;
}
```

Required layout and interaction CSS:

- `html`, `body`, and `#app` use `height: 100%`; `body` has `min-width: 1180px`, `overflow: hidden`, no mobile media query, and blueprint-grid depth using local CSS gradients.
- `.app-shell` uses `height: 100dvh`, `min-height: 0`, `overflow: hidden`, and rows `auto minmax(0, 1fr) auto`.
- `.workspace` uses two columns `minmax(0, 1.05fr) minmax(0, .95fr)`, `min-height: 0`, and no document-level overflow.
- Battlefield, editor, and feedback content regions use `min-height: 0` plus their own `overflow: auto` boundaries, so 1280×720 remains one page instead of scrolling the whole document.
- `.feedback-panel` spans both columns at the bottom.
- Buttons are at least 44px high; focus uses a visible `2px` arcane outline.
- Current active unit uses a low-frequency arcane pulse; feedback success/error uses a short edge pulse.
- `@media (prefers-reduced-motion: reduce)` disables both animations.
- Do not add gradients in purple/white, default white cards, remote image URLs, emoji, mobile breakpoints, or decorative statistics.

- [ ] **Step 7: Wire the application entrypoint**

Replace `rpg/src/main.ts` with:

```ts
import "./styles.css";
import { AppController } from "./app/app-controller";
import { mountApp } from "./app/app-view";
import { LocalSaveStore } from "./app/save-store";
import { WebSocketRunnerClient } from "./app/runner-client";
import { createPythonMarsh01 } from "./game/content/python-marsh-01";
import type { BattleState, TurnCommand } from "./game/combat/types";

function enemyWait(state: Readonly<BattleState>): TurnCommand {
  const actorId = state.turnOrder[state.turnIndex];
  if (actorId === undefined) throw new Error("Enemy turn has no active actor");
  return { actorId, expectedRevision: state.revision, action: { type: "wait" } };
}

const root = document.querySelector<HTMLElement>("#app");
if (root === null) throw new Error("Missing #app root");

const controller = new AppController({
  runner: new WebSocketRunnerClient("ws://127.0.0.1:5175"),
  saveStore: new LocalSaveStore(window.localStorage),
  createEncounter: createPythonMarsh01,
  enemyCommand: enemyWait,
});

mountApp(root, controller);
void controller.start();
```

- [ ] **Step 8: Run focused unit tests and the real Playwright flow**

Run focused unit tests first:

```bash
npm test -- src/app/save-store.test.ts src/app/runner-client.test.ts src/app/app-controller.test.ts
```

Expected: all focused tests pass.

Then run the only browser flow:

```bash
npm run test:e2e -- e2e/app-shell.spec.ts
```

Expected: one Playwright test passes, including revision `2` after refresh and final `胜利` with golem `0 / 8`.

- [ ] **Step 9: Commit Task 4**

```bash
git add rpg/package.json
git add rpg/package-lock.json
git add rpg/playwright.config.ts
git add rpg/e2e/app-shell.spec.ts
git add rpg/src/app/code-editor.ts
git add rpg/src/app/app-view.ts
git add rpg/src/styles.css
git add rpg/src/main.ts
git commit -m "feat: build playable desktop shell"
```

---

### Task 5: Stage Verification and Documentation

**Files:**
- Create: `rpg/README.md`
- Modify: `docs/superpowers/plans/2026-08-10-python-rpg-roadmap.md`

**Interfaces:**
- No new runtime interface.
- Produces reproducible local start instructions and marks stage 3 complete only after fresh evidence.

- [ ] **Step 1: Write the local README**

Create `rpg/README.md` with these exact sections:

````markdown
# Python RPG

## Requirements

- Node.js 24.15.0
- CPython 3.12 or newer available as `python`, `python3`, or `py -3`

## Start

Terminal 1:

```bash
npm run runner
```

Terminal 2:

```bash
npm run dev
```

Open `http://127.0.0.1:5174`.

## Local Code Boundary

Python is edited in the local browser and sent only to `ws://127.0.0.1:5175`. The local Node Runner starts a local CPython process. Code is not sent to a remote service.

## Save and Reset

The single V1 save is stored in browser `localStorage` under `python-rpg.save`. Reset requires typing `重置存档` exactly before execution.
````

Keep the README concise. Do not document mobile support, remote deployment, Pyodide, Docker, cloud sync, or unimplemented campaign features.

- [ ] **Step 2: Run the stage-completion verification once**

Run full unit tests:

```bash
npm test
```

Expected: all Vitest files pass with zero failures.

Run production build:

```bash
npm run build
```

Expected: TypeScript and Vite exit `0`; no remote asset warning and no unused dependency error.

Run the single real browser flow:

```bash
npm run test:e2e -- e2e/app-shell.spec.ts
```

Expected: one Playwright test passes.

Run whitespace validation:

```bash
git diff --check
```

Expected: exit `0`.

- [ ] **Step 3: Perform the two manual desktop checks**

At 1440×900 and 1280×720:

1. Verify the whole document has no vertical or horizontal page overflow; battlefield, editor, and feedback scroll only inside their own bounded regions.
2. Stop the Runner, load the app, verify the editor remains usable and the page says `不可用` plus `启动 Runner 后刷新页面`.
3. Open reset, verify the final action remains disabled for `重置`, becomes available only for exact `重置存档`, and resets to revision `0` with the starter code.

Do not perform mobile, narrow-screen, multi-browser, multi-OS, signal-order, or screenshot-matrix testing.

- [ ] **Step 4: Mark only stage 3 complete in the roadmap**

In `docs/superpowers/plans/2026-08-10-python-rpg-roadmap.md`:

- Change the six stage 3 checkboxes from `[ ]` to `[x]`.
- Change the heading to `## 阶段 3：可玩的应用外壳（已完成）`.
- Do not change stage 4 or final-delivery checkboxes.

- [ ] **Step 5: Commit Task 5**

```bash
git add rpg/README.md
git add docs/superpowers/plans/2026-08-10-python-rpg-roadmap.md
git commit -m "docs: document stage3 local play flow"
```

---

## Plan Completion Gate

Before implementation starts:

- An independent review subagent must compare this plan against the approved design spec.
- The reviewer must report requirement coverage, task ordering, interface/type consistency, file ownership conflicts, unnecessary scope, missing RED/GREEN evidence, and verification excess.
- The main agent must independently inspect every finding and patch the plan where valid.
- No production code may be written until the reviewed plan has no unresolved Critical or Important finding.

## Implementation Handoff

After plan review is clean, execute with `superpowers:subagent-driven-development` in the same session. Use one fresh implementer per task, never run implementation tasks in parallel, and perform requirement compliance plus code-quality review after each task. The main agent remains responsible for focused verification, commit boundaries, stage-wide QA, and the final completion claim.
