# Python RPG VS Code Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 交付以 VS Code 原生 Python 编辑器为代码入口、右侧 Webview 为游戏界面的六关 Python RPG 插件，并让网页继续复用同一关卡内容。

**Architecture:** 保留现有 `AppController` 作为共享应用核心，通过 `RunnerClient` 与 `SaveStore` 接口注入平台适配器。VS Code 扩展宿主持有权威状态、读取逐关 `TextDocument`、直接管理单次 Python 子进程并向纯显示 Webview 发布完整快照；网页继续使用 WebSocket、CodeMirror 与 `localStorage` 适配器。

**Tech Stack:** Node.js 24.15.0、TypeScript 7、VS Code Extension API、esbuild、Vitest、原生 Webview HTML/CSS/JavaScript、现有 CPython 3.12+ Runner。

## Global Constraints

- 信任玩家本地代码，不建设对抗恶意代码的沙箱。
- Runner 与 Webview 仅在本机运行，不发送玩家代码到远端。
- 每关代码保存在 `python-rpg/python-marsh-01.py` 至 `python-marsh-06.py`，不得覆盖已有文件。
- 左侧为 Python 文档，右侧为游戏 Webview；运行读取未保存文本。
- 扩展宿主持有唯一状态，Webview 只传递意图并渲染完整快照。
- 浅色和深色共用布局与组件；首次跟随 VS Code，玩家选择后持久化。
- 方格边长同时受可用宽度、可用高度、列数和行数约束，始终保持正方形。
- 测试只覆盖正常路径与一个关键失败路径；阶段完成前不运行全量测试。
- 文件不超过 400 行，函数不超过 60 行；按功能职责拆分。

---

### Task 1: Shared Level Guidance

**Files:**
- Modify: `rpg/src/game/content/types.ts`
- Modify: `rpg/src/game/content/python-marsh-01.ts`
- Modify: `rpg/src/game/content/python-marsh-02.ts`
- Modify: `rpg/src/game/content/python-marsh-03.ts`
- Modify: `rpg/src/game/content/python-marsh-04.ts`
- Modify: `rpg/src/game/content/python-marsh-05.ts`
- Modify: `rpg/src/game/content/python-marsh-06.ts`
- Modify: `rpg/src/game/content/levels.ts`
- Modify: `rpg/src/game/content/levels.test.ts`
- Modify: `rpg/src/app/app-view.ts`

**Interfaces:**
- Produces: `LevelGuidance` with `objective`, `concepts`, `worldFields`, `commandExamples`, `levelRules`; `LevelDefinition.guidance`.
- Consumes: existing `LevelDefinition`, starter code, briefing and current hint rendering.

- [x] **Step 1: Write the failing guidance contract test**

Add a test that loops over `LEVEL_ORDER`, asserts every guidance group is an array with at least one non-empty entry, checks second through sixth level-specific concepts, and confirms the sixth level contains API reference without solution-like steps.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run src/game/content/levels.test.ts`

Expected: TypeScript/test failure because `guidance` does not exist.

- [x] **Step 3: Add the typed guidance and six level payloads**

Define:

```ts
export type LevelGuidance = Readonly<{
  objective: readonly string[];
  concepts: readonly string[];
  worldFields: readonly string[];
  commandExamples: readonly string[];
  levelRules: readonly string[];
}>;
```

Populate all six levels according to the handoff progression. Keep `apiHints` temporarily as a compatibility projection only if the web renderer still needs it within this task; remove duplicate runtime content once `app-view` consumes `guidance`.

- [x] **Step 4: Render the fixed groups in the browser preview**

Update `renderApiHelp` to fill the existing four groups from `guidance`, merging objective/concepts into level rules where the current browser markup has four groups. Do not create a second copy of hints.

- [x] **Step 5: Verify GREEN**

Run: `npm test -- --run src/game/content/levels.test.ts src/app/app-controller.test.ts`

Expected: both files pass.

- [x] **Step 6: Commit**

```bash
git add rpg/src/game/content rpg/src/app/app-view.ts
git commit -m "feat: structure guidance for all RPG levels"
```

### Task 2: VS Code Platform Adapters and Direct Runner

**Files:**
- Create: `rpg/src/vscode/platform-types.ts`
- Create: `rpg/src/vscode/level-workspace.ts`
- Create: `rpg/src/vscode/level-workspace.test.ts`
- Create: `rpg/src/vscode/workspace-save-store.ts`
- Create: `rpg/src/vscode/workspace-save-store.test.ts`
- Create: `rpg/src/vscode/direct-runner-client.ts`
- Create: `rpg/src/vscode/direct-runner-client.test.ts`
- Modify: `rpg/src/app/save-store.ts`
- Modify: `rpg/src/app/app-controller.ts`

**Interfaces:**
- Produces: `DocumentWorkspace.ensureLevelFiles()`, `readLevelCode(levelId)`, `openLevel(levelId)`; `WorkspaceSaveStore`; `DirectRunnerClient` implementing `RunnerClient`.
- Consumes: abstract document/file/state ports, `PythonRunProcess`, `detectPython`, `RunRequest`, existing `SaveStore` and `RunnerClient`.

- [x] **Step 1: Write a failing test for unsaved document reads**

Use an in-memory platform port where disk contains starter code but the open document returns changed text. Assert `readLevelCode("python-marsh-02")` returns the open document text and `ensureLevelFiles()` does not overwrite existing files.

- [x] **Step 2: Verify RED**

Run: `npm test -- --run src/vscode/level-workspace.test.ts`

Expected: module/API missing.

- [x] **Step 3: Implement `DocumentWorkspace`**

Map each `LevelId` to `python-rpg/<id>.py`. Read an open document first, then disk. Create only missing files from `getLevel(levelId).starterCode`.

- [x] **Step 4: Write and pass workspace save-store tests**

Test normal `workspaceState` load/save/remove and one corrupted-state result. Reuse exported save validation instead of duplicating the battle schema.

- [x] **Step 5: Write a failing direct-runner lifecycle test**

Inject Python detection and process creation. Assert `connect()` reaches ready, `run()` transitions ready → running → ready, and `interrupt(runId)` reaches the current process only.

- [x] **Step 6: Implement `DirectRunnerClient`**

Detect Python once, create `PythonRunProcess` per request, preserve existing timeout/interruption behavior through the adapter, and expose the existing `RunnerClient` interface. Do not introduce WebSocket or daemon state.

- [x] **Step 7: Allow external code injection before a run**

Add an `AppController.runCode(code: string)` public method that calls `setCode(code)` and then `runTurn()`. Preserve `runTurn()` for the browser button. Verify the request contains the injected unsaved code.

- [x] **Step 8: Verify GREEN**

Run: `npm test -- --run src/vscode/level-workspace.test.ts src/vscode/workspace-save-store.test.ts src/vscode/direct-runner-client.test.ts src/app/app-controller.test.ts`

Expected: all focused tests pass.

- [x] **Step 9: Commit**

```bash
git add rpg/src/vscode rpg/src/app/app-controller.ts rpg/src/app/app-controller.test.ts rpg/src/app/save-store.ts
git commit -m "feat: add VS Code workspace and runner adapters"
```

### Task 3: Extension Host, Messages, and Diagnostics

**Files:**
- Create: `rpg/src/vscode/messages.ts`
- Create: `rpg/src/vscode/game-session.ts`
- Create: `rpg/src/vscode/game-session.test.ts`
- Create: `rpg/src/vscode/extension.ts`
- Create: `rpg/tsconfig.extension.json`
- Create: `rpg/esbuild.extension.mjs`
- Modify: `rpg/package.json`
- Modify: `rpg/package-lock.json`

**Interfaces:**
- Produces: `WebviewCommand`, `ExtensionMessage`, `GameViewSnapshot`, `GameSession.handle(command)`, VS Code activation entry `dist/extension.cjs`.
- Consumes: `AppController`, `DocumentWorkspace`, `WorkspaceSaveStore`, `DirectRunnerClient`, thin VS Code platform adapter.

- [x] **Step 1: Write a failing session proof test**

Arrange the controller on level two, provide an unsaved code string through `DocumentWorkspace`, issue `{ type: "runTurn" }`, and assert the runner request receives that exact string and the published snapshot revision advances. Also issue `{ type: "ready" }` after clearing captured messages and assert one complete snapshot is republished.

- [x] **Step 2: Verify RED**

Run: `npm test -- --run src/vscode/game-session.test.ts`

Expected: session and message contracts missing.

- [x] **Step 3: Implement message contracts and `GameSession`**

Handle only `ready`, `runTurn`, `interruptRun`, `retryLevel`, `advanceLevel`, `resetCampaign`, and `setTheme`. Subscribe once to `AppController`; publish full snapshots, never state deltas.

- [x] **Step 4: Add diagnostic projection**

Project `RunnerDiagnostic.location` onto the current level document through a narrow diagnostics port. Clear old diagnostics before each run; keep feedback in the Webview snapshot.

- [x] **Step 5: Add the VS Code activation adapter**

Register `pythonRpg.open` and `pythonRpg.runTurn`, wire `Ctrl+Enter`, create the Webview in `ViewColumn.Two`, open the current level in `ViewColumn.One`, and instantiate the session. Keep direct `vscode` imports in `extension.ts` only.

- [x] **Step 6: Add extension packaging configuration**

Declare `main`, `engines.vscode`, `activationEvents`, commands, keybindings and an `extension:build` script. Bundle extension-host code as CommonJS using esbuild while keeping Webview assets external.

- [x] **Step 7: Verify GREEN**

Run: `npm test -- --run src/vscode/game-session.test.ts`

Run: `npm run extension:build`

Expected: focused tests pass and `dist/extension.cjs` is generated.

- [x] **Step 8: Commit**

```bash
git add rpg/src/vscode rpg/package.json rpg/package-lock.json rpg/tsconfig.extension.json rpg/esbuild.extension.mjs
git commit -m "feat: wire the Python RPG VS Code extension host"
```

### Task 4: Half-Screen Webview, Adaptive Grid, and Themes

**Files:**
- Create: `rpg/src/vscode/webview/render-game.ts`
- Create: `rpg/src/vscode/webview/render-game.test.ts`
- Create: `rpg/src/vscode/webview/main.ts`
- Create: `rpg/src/vscode/webview/styles.css`
- Create: `rpg/esbuild.webview.mjs`
- Modify: `rpg/src/vscode/extension.ts`
- Modify: `rpg/package.json`

**Interfaces:**
- Produces: `renderGame(snapshot)`, `calculateCellSize(containerWidth, containerHeight, columns, rows)`, bundled `dist/webview.js` and `dist/webview.css`.
- Consumes: `GameViewSnapshot`, VS Code message bridge, CSP nonce and Webview resource URIs.

- [x] **Step 1: Write failing adaptive-grid tests**

Assert `calculateCellSize(600, 450, 4, 3)` returns a larger value than the 6×4 case, both fit within width and height, and the result never exceeds the configured maximum or drops below the readable minimum for all six current boards.

- [x] **Step 2: Verify RED**

Run: `npm test -- --run src/vscode/webview/render-game.test.ts`

Expected: renderer/API missing.

- [x] **Step 3: Implement the semantic renderer**

Render the confirmed five sections with real level data. Use buttons and `details/summary`; include grid, cell and unit labels; render loading, idle, running, error, success and settlement states.

- [x] **Step 4: Implement tokenized light/dark/system themes**

Use one component tree and CSS custom properties. Default to `system`; map VS Code body classes and stored player selection. Persist selection through `{ type: "setTheme" }`.

- [x] **Step 5: Implement adaptive square cells**

Use `ResizeObserver` to calculate a CSS `--cell-size` from available battlefield content size, board columns and rows. Keep the complete board centered without horizontal scrolling.

- [x] **Step 6: Bundle and connect assets**

Add `webview:build` and include it in `extension:build`. Generate CSP-safe HTML in `extension.ts`; no inline event handlers or remote assets.

- [x] **Step 7: Verify GREEN**

Run: `npm test -- --run src/vscode/webview/render-game.test.ts src/vscode/game-session.test.ts`

Run: `npm run extension:build`

Expected: tests and both bundles pass.

- [x] **Step 8: Commit**

```bash
git add rpg/src/vscode/webview rpg/src/vscode/extension.ts rpg/esbuild.webview.mjs rpg/package.json rpg/package-lock.json
git commit -m "feat: add the adaptive RPG game Webview"
```

### Task 5: Six-Level Completion and Delivery Verification

**Files:**
- Modify: `rpg/src/vscode/game-session.test.ts`
- Modify: `rpg/src/vscode/webview/render-game.test.ts`
- Modify: `rpg/src/game/content/reference-solutions.test.ts`
- Modify: `rpg/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all prior task interfaces.
- Produces: documented development launch flow and complete six-level acceptance evidence.

- [x] **Step 1: Add focused campaign transition coverage**

Verify the session opens the next level file after a successful settlement and all six files are created without overwriting an existing player file.

- [x] **Step 2: Verify all level guidance and reference solutions**

Run: `npm test -- --run src/game/content/levels.test.ts src/game/content/reference-solutions.test.ts`

Expected: all six levels remain solvable and guidance contracts pass.

- [x] **Step 3: Document launch and debugging**

Document `npm install`, `npm run extension:build`, opening `rpg/` in Extension Development Host, `Python RPG: Open Game`, `Ctrl+Enter`, Python 3.12+, workspace files and the browser preview role.

- [x] **Step 4: Run stage-complete verification**

Run: `npm test -- --run`

Run: `npm run build`

Run: `npm run extension:build`

Expected: zero failures and clean build output.

- [x] **Step 5: Perform visual validation**

Launch the Extension Development Host and capture/check 1280×800 half-screen views for light and dark themes, plus 4×3 and 6×4 boards. Confirm no horizontal overflow, readable labels, visible focus, correct actions and theme persistence.

Evidence: VS Code 1.133 Extension Development Host at 1280x800 was checked with equal 616px editor groups for dark 4x3 and light 6x4 scenarios. Both views had no horizontal overflow, no exposed Webview host background, readable labels, visible controls, and the expected theme-specific presentation.

- [x] **Step 6: Commit**

```bash
git add rpg README.md
git commit -m "docs: complete the VS Code RPG workflow"
```
