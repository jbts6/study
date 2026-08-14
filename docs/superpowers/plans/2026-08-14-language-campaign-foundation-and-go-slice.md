# 语言战役底座与 Go 第一关实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 Python 六关体验的前提下，建立可独立扩展的语言战役底座，并交付可在 VS Code 中运行的 Go 第一关。

**Architecture:** 保持一个 TypeScript 宿主工程。战斗内核、WorldView、指令 JSON、诊断展示和 VS Code 会话共享；Python、Go、Rust 的战役内容、玩家工作区、存档键、程序约定与运行器独立。此计划只创建 Rust 的类型与目录预留，不创建 Rust 关卡、SDK、工具链探测或运行器。

**Tech Stack:** TypeScript 7、Node 24、VS Code Extension API、Vitest、CodeMirror、Go stable 工具链。

## 全局约束

- 采用本地信任代码模型；玩家代码仅在本机运行，不引入 Docker、沙箱、远程执行或网络服务。
- 保持一个 `rpg/` 宿主工程；不得复制为三个扩展或三个 Webview。
- Python、Go、Rust 的关卡 ID、教学文本、模板、玩家文件、工作区目录和存档独立；关卡数量不得写死为跨语言共享的常量。
- Go 首版只实现 `go-marsh-01`；不得开始 Rust 运行器或 Rust 关卡。
- Go SDK 只包含 JSON DTO 与命令构造器；不能复制 TypeScript 战斗结算或引入第三方 Go module。
- 每个运行器只覆盖正常路径和一个关键失败路径；避免工具链内部测试矩阵。
- 修改进入 VS Code 扩展或 Webview 的 `rpg/` 代码后，最终验证必须运行 `npm run install:local`，并在普通 VS Code 窗口重载后检查游戏页面。

---

## 文件结构

| 路径 | 职责 |
| --- | --- |
| `rpg/src/game/content/shared/types.ts` | 语言无关的 `LevelDefinition`、共享战斗内容类型和校验。 |
| `rpg/src/game/content/python/` | 迁移后的 Python 六关、战役顺序与教学内容。 |
| `rpg/src/game/content/go/go-marsh-01.ts` | Go 第一关的独立模板、教学和战斗场景引用。 |
| `rpg/src/programs/types.ts` | `CampaignDefinition`、`PlayerProgramDefinition` 与源文件约定。 |
| `rpg/src/programs/python/index.ts` | Python 的 `.py`、`choose_turn` 和模块白名单约定。 |
| `rpg/src/programs/go/index.ts` | Go 的 `strategy.go`、`ChooseTurn` 和构建入口约定。 |
| `rpg/src/game/content/campaigns.ts` | 注册已实现战役，按战役查询关卡与下一关。 |
| `rpg/src/runners/protocol/types.ts` | Python 与编译型语言的可区分 `RunRequest` 联合类型。 |
| `rpg/src/runners/shared/adapter.ts` | 共享单次运行、超时、中断和状态切换；不含语言细节。 |
| `rpg/src/runners/go/` | Go 探测、临时项目生成、构建缓存、进程包装与诊断映射。 |
| `rpg/src/vscode/level-workspace.ts` | 由 `PlayerProgramDefinition` 解析玩家文件路径。 |
| `rpg/src/vscode/workspace-save-store.ts` | 以战役键隔离 VS Code workspaceState 存档。 |
| `rpg/src/vscode/extension.ts` | 根据活动战役创建对应 Runner、诊断与编辑器语言模式。 |
| `rpg/src/app/app-controller.ts` | 按当前战役创建存档和运行请求，不写死 Python。 |

## Task 1: 提取战役与玩家程序模型

**Files:**

- Create: `rpg/src/programs/types.ts`
- Create: `rpg/src/programs/python/index.ts`
- Create: `rpg/src/programs/go/index.ts`
- Create: `rpg/src/game/content/shared/types.ts`
- Create: `rpg/src/game/content/python/levels.ts`
- Modify: `rpg/src/game/content/types.ts`
- Modify: `rpg/src/game/content/levels.ts`
- Modify: `rpg/src/game/content/python-marsh-01.ts` through `python-marsh-06.ts`
- Test: `rpg/src/game/content/levels.test.ts`

**Interfaces:**

- Produces `Language = "python" | "go" | "rust"`、`CampaignId`、`CampaignDefinition` 和 `PlayerProgramDefinition`。
- Produces `PYTHON_PROGRAM` 与 `GO_PROGRAM`。Go 玩家文件名为 `<levelId>.go`；`GO_PROGRAM.createRunFiles` 将其源码映射为临时构建入口 `strategy.go`。
- Produces `getCampaign(campaignId)`、`getLevel(levelId)`、`getNextLevelId(levelId)`；后续控制器和工作区只调用这些函数。
- Python 战役的关卡 ID 和初始关仍是 `python-marsh-01`，已有源码与存档语义不变。

- [ ] **Step 1: 为战役注册编写失败测试**

```ts
it("按战役隔离关卡顺序与玩家程序约定", () => {
  const campaign = getCampaign("python-rpg");
  expect(campaign.program.workspaceDirectory).toBe("python-rpg");
  expect(campaign.levelOrder).toEqual([
    "python-marsh-01", "python-marsh-02", "python-marsh-03",
    "python-marsh-04", "python-marsh-05", "python-marsh-06",
  ]);
  expect(getNextLevelId("python-marsh-06")).toBeUndefined();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts`  
Expected: FAIL，提示 `getCampaign` 尚未导出。

- [ ] **Step 3: 写入最小战役模型并迁移 Python 内容**

```ts
// src/programs/types.ts
export type Language = "python" | "go" | "rust";
export type CampaignId = "python-rpg" | "go-rpg";

export type PlayerProgramDefinition = Readonly<{
  language: Language;
  workspaceDirectory: string;
  sourceFileName(levelId: string): string;
  runEntrypointFileName(levelId: string): string;
  editorLanguageId: string;
  createRunFiles(levelId: string, source: string): Readonly<Record<string, string>>;
}>;

export type CampaignDefinition<LevelId extends string = string> = Readonly<{
  id: CampaignId;
  title: string;
  program: PlayerProgramDefinition;
  levelOrder: readonly LevelId[];
}>;
```

```ts
// src/programs/python/index.ts
export const PYTHON_PROGRAM: PlayerProgramDefinition = {
  language: "python",
  workspaceDirectory: "python-rpg",
  sourceFileName: (levelId) => `${levelId}.py`,
  runEntrypointFileName: () => "main.py",
  editorLanguageId: "python",
  createRunFiles: (_levelId, source) => ({ "main.py": source }),
};
```

```ts
// src/programs/go/index.ts
export const GO_PROGRAM: PlayerProgramDefinition = {
  language: "go",
  workspaceDirectory: "go-rpg",
  sourceFileName: (levelId) => `${levelId}.go`,
  runEntrypointFileName: () => "strategy.go",
  editorLanguageId: "go",
  createRunFiles: (_levelId, source) => ({ "strategy.go": source }),
};
```

将六个 `python-marsh-*.ts` 移至 `content/python/`，只更新相对 import；在 `content/python/levels.ts` 导出 `PYTHON_RPG_CAMPAIGN`，且维持既有 Python 顺序。把共享的 `LevelDefinition` 与 `LevelId = string` 放入 `content/shared/types.ts`，原 `content/types.ts` 改为兼容性再导出，避免本任务外的消费者同时大范围改动。

- [ ] **Step 4: 运行定点测试确认通过**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts`  
Expected: PASS。

- [ ] **Step 5: 提交 Python 内容迁移与战役模型**

```bash
git add rpg/src/programs rpg/src/game/content
git commit -m "refactor: 提取语言战役模型"
```

## Task 2: 把协议和控制器改为语言感知但保持 Python 兼容

**Files:**

- Modify: `rpg/src/runners/protocol/types.ts`
- Modify: `rpg/src/runners/protocol/validate-request.ts`
- Modify: `rpg/src/app/app-controller.ts`
- Modify: `rpg/src/app/app-feedback.ts`
- Modify: `rpg/src/main.ts`
- Modify: `rpg/src/app/app-controller.test.ts`
- Modify: `rpg/src/app/app-feedback.test.ts`
- Modify: `rpg/src/runners/protocol/validate-request.test.ts`

**Interfaces:**

- Consumes `CampaignDefinition.program` 与 `PYTHON_PROGRAM`。
- Produces `PythonRunRequest` 与 `CompiledRunRequest` 的 `RunRequest` 联合类型。
- `AppController` 构造参数增加 `campaign: CampaignDefinition`；默认测试可显式传入 `PYTHON_RPG_CAMPAIGN`。
- 浏览器开发入口 `main.ts` 显式传入 `PYTHON_RPG_CAMPAIGN`；Go 第一关的可运行入口只在 VS Code 扩展中交付，浏览器版不提供战役选择。
- `ExecutionStatus` 新增 `"compile_error"`；`feedbackFromRunResult` 根据 `result.language` 显示对应语言名称，而非固定“Python 运行失败”。

- [ ] **Step 1: 写入协议分支与 Python 请求回归的失败测试**

```ts
it("接受 Python 的 callable 与 allowedModules 请求", () => {
  const result = validateRunRequest({
    ...validRequest,
    language: "python",
    entrypoint: { file: "main.py", callable: "choose_turn" },
    allowedModules: ["math"],
  });
  expect(result.ok).toBe(true);
});

it("拒绝 Go 请求携带 Python 模块白名单", () => {
  const result = validateRunRequest({
    ...validRequest,
    language: "go",
    files: { "strategy.go": "package main" },
    entrypoint: { file: "strategy.go" },
    allowedModules: ["math"],
  });
  expect(result).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_GO_REQUEST" }] });
});

it("控制器生成的 Go 请求可通过协议校验", async () => {
  const runner = capturingRunner(completedWaitResult);
  const controller = new AppController({
    campaign: GO_RPG_CAMPAIGN,
    runner,
    saveStore: memorySaveStore(),
    createId: () => "run-1",
  });
  await controller.start();
  await controller.runTurn();
  const request = runner.requests[0];
  expect(request).toMatchObject({
    language: "go",
    files: { "strategy.go": expect.any(String) },
    entrypoint: { file: "strategy.go" },
  });
  expect(validateRunRequest(request).ok).toBe(true);
});
```

- [ ] **Step 2: 运行协议测试确认失败**

Run: `cd rpg && npx vitest run src/runners/protocol/validate-request.test.ts`  
Expected: FAIL，当前请求类型只接受 `language: "python"`。

- [ ] **Step 3: 实现可区分请求类型和控制器请求工厂**

```ts
export type PythonRunRequest = BaseRunRequest & Readonly<{
  language: "python";
  entrypoint: Readonly<{ file: string; callable: string }>;
  allowedModules: readonly string[];
}>;

export type CompiledRunRequest = BaseRunRequest & Readonly<{
  language: "go" | "rust";
  entrypoint: Readonly<{ file: string }>;
  limits: ExecutionLimits & Readonly<{
    buildTimeoutMs: number;
    executionTimeoutMs: number;
  }>;
}>;

export type RunRequest = PythonRunRequest | CompiledRunRequest;
```

```ts
private createRunRequest(snapshot: GameSnapshot, runId: string): RunRequest {
  const program = this.campaign.program;
  const runEntrypointFile = program.runEntrypointFileName(snapshot.currentLevelId);
  const base = {
    protocolVersion: 1 as const,
    runId,
    attemptId: `${runId}:1`,
    questId: snapshot.currentLevelId,
    language: program.language,
    files: program.createRunFiles(snapshot.currentLevelId, snapshot.codeDraft),
    worldView: projectWorldView(snapshot.battleState),
    limits: this.runLimits,
  };
  return program.language === "python"
    ? { ...base, language: "python", entrypoint: { file: runEntrypointFile, callable: "choose_turn" }, allowedModules: ["math"] }
    : { ...base, entrypoint: { file: runEntrypointFile } };
}
```

将 `RUN_LIMITS` 移到控制器依赖或战役运行配置中；Python 数值维持 `5_000` 毫秒，Go 请求显式传入 `buildTimeoutMs: 15_000` 与 `executionTimeoutMs: 5_000`。在 `main.ts` 注入 `PYTHON_RPG_CAMPAIGN`；在 `app-feedback.ts` 为 `compile_error` 增加“Go 编译失败”反馈测试。

- [ ] **Step 4: 运行控制器与协议测试确认通过**

Run: `cd rpg && npx vitest run src/app/app-controller.test.ts src/runners/protocol/validate-request.test.ts`  
Expected: PASS。

- [ ] **Step 5: 提交协议与控制器改造**

```bash
git add rpg/src/runners/protocol rpg/src/app/app-controller.ts rpg/src/app/app-controller.test.ts rpg/src/app/app-feedback.ts rpg/src/app/app-feedback.test.ts rpg/src/main.ts
git commit -m "refactor: 支持语言化运行请求"
```

## Task 3: 让 VS Code 工作区、存档和诊断以战役配置工作

**Files:**

- Modify: `rpg/src/vscode/level-workspace.ts`
- Modify: `rpg/src/vscode/level-workspace.test.ts`
- Modify: `rpg/src/vscode/workspace-save-store.ts`
- Modify: `rpg/src/vscode/workspace-save-store.test.ts`
- Modify: `rpg/src/vscode/game-session.ts`
- Modify: `rpg/src/vscode/extension.ts`
- Modify: `rpg/src/app/code-editor.ts`
- Modify: `rpg/src/app/code-editor.test.ts`
- Modify: `rpg/package.json`

**Interfaces:**

- Consumes `CampaignDefinition` 和 `PlayerProgramDefinition`；本任务的 Go 路径测试直接使用 `GO_PROGRAM` 构造最小战役，不依赖 Task 5 的 `GO_RPG_CAMPAIGN` 注册。
- Produces `levelFilePath(workspaceRoot, campaign, levelId)` 与 `WorkspaceSaveStore(workspaceState, campaign.id)`。
- CodeMirror 接收 `language: "python" | "go"` 并加载对应语法扩展；浏览器入口保持传入 Python，供后续战役选择复用。
- 保留默认打开 Python 战役；Go 战役在 Task 6 注册后才出现在启动器。

- [ ] **Step 1: 为目录和存档隔离写入失败测试**

```ts
it("按战役程序约定生成玩家文件路径", () => {
  expect(levelFilePath("C:/work", {
    id: "go-rpg",
    title: "Go RPG",
    program: GO_PROGRAM,
    levelOrder: [],
  }, "go-marsh-01"))
    .toBe(join("C:/work", "go-rpg", "go-marsh-01.go"));
});

it("不会读取另一战役的 workspaceState 存档", () => {
  const state = fakeWorkspaceState({ "python-rpg.workspace-save": pythonSave });
  expect(new WorkspaceSaveStore(state, "go-rpg").load()).toEqual({ ok: true, save: null });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd rpg && npx vitest run src/vscode/level-workspace.test.ts src/vscode/workspace-save-store.test.ts`  
Expected: FAIL，现有路径固定为 `python-rpg/<level>.py`，存档键固定为 Python。

- [ ] **Step 3: 实现配置驱动的工作区、存档和诊断**

```ts
export function levelFilePath(
  workspaceRoot: string,
  campaign: CampaignDefinition,
  levelId: string,
): string {
  return join(workspaceRoot, campaign.program.workspaceDirectory, campaign.program.sourceFileName(levelId));
}

export function workspaceSaveKey(campaignId: CampaignId): string {
  return `${campaignId}.workspace-save`;
}
```

让 `DocumentWorkspace` 接收 `campaign`；让 `GameSession` 只处理控制器当前战役。扩展中以 `campaign.program.editorLanguageId` 生成快捷键条件与诊断 source，并用 `program.sourceFileName(levelId)` 比较诊断文件名。将 manifest 标题和命令从 Python 专用名称调整为 “奥术战术 RPG”，但仍保留 `pythonRpg.*` 命令 ID 作为当前扩展兼容入口，不新建第二个扩展。

```ts
export function mountCodeEditor(
  parent: HTMLElement,
  initialValue: string,
  language: "python" | "go",
  onChange: (value: string) => void,
): CodeEditorHandle {
  const languageExtension = language === "go" ? go() : python();
  // 其余编辑器配置维持现有实现。
}
```

加入 `@codemirror/lang-go`；用 jsdom 测试 Go 代码关键字得到非空语法树，Python 现有编辑器行为保持不变。Go 运行器返回的内部 `strategy.go` 诊断必须在其结果映射层改写为 `campaign.program.sourceFileName(levelId)`，扩展诊断投影只接受该外部文件名，不能依赖 `strategy.go`。

- [ ] **Step 4: 运行 VS Code 单元测试与类型检查**

Run: `cd rpg && npx vitest run src/vscode/level-workspace.test.ts src/vscode/workspace-save-store.test.ts src/vscode/game-session.test.ts src/app/code-editor.test.ts && npm run typecheck`  
Expected: PASS。

- [ ] **Step 5: 提交工作区和存档隔离**

```bash
git add rpg/src/vscode rpg/package.json
git commit -m "feat: 隔离语言战役工作区与存档"
```

## Task 4: 实现 Go 本地代码执行器与最小 SDK

**Files:**

- Create: `rpg/src/runners/go/go-detector.ts`
- Create: `rpg/src/runners/go/go-project.ts`
- Create: `rpg/src/runners/go/go-process.ts`
- Create: `rpg/src/runners/go/go-runner.ts`
- Create: `rpg/src/runners/go/runtime/sdk.go`
- Create: `rpg/src/runners/go/runtime/runner_main.go`
- Create: `rpg/src/runners/shared/adapter.ts`
- Modify: `rpg/src/runners/local/adapter.ts`
- Test: `rpg/src/runners/go/go-detector.test.ts`
- Test: `rpg/src/runners/go/go-runner.test.ts`

**Interfaces:**

- Produces `detectGo(): Promise<GoDetection>`，成功时返回 `{ ok: true, goPath, version }`。
- Produces `GoRunner`，实现 `RunnerClient` 所需的 `connect/run/interrupt/close` 行为。
- Go 运行器读取 `strategy.go`，将最终 `TurnCommand` JSON 写入 `RPG_RESULT_PATH`；玩家 stdout/stderr 保留作诊断输出。
- Go 请求使用 `buildTimeoutMs` 限制 `go build`，成功后再使用 `executionTimeoutMs` 限制策略进程。两个阶段分别报告耗时，构建时间不能被报告为策略超时。

- [ ] **Step 1: 为工具链不可用和成功执行写入失败测试**

```ts
it("找不到 go 时提供安装恢复动作", async () => {
  await expect(detectGo({ runVersion: async () => { throw new Error("ENOENT"); } }))
    .resolves.toMatchObject({ ok: false, code: "GO_NOT_FOUND" });
});

it("将 Go 编译错误映射到玩家 Go 源文件的行列", async () => {
  const result = await runGoFixture("package main\nfunc ChooseTurn(world World) TurnCommand { return }");
  expect(result).toMatchObject({
    executionStatus: "compile_error",
    diagnostics: [{ location: { file: "go-marsh-01.go", line: 2 } }],
  });
});

it("从结果文件读取 TurnCommand 并保留玩家日志", async () => {
  const result = await runGoFixture(validGoSourceWithLog);
  expect(result).toMatchObject({
    executionStatus: "completed",
    returnValue: { action: { type: "wait" } },
    streams: { stdout: "debug: choosing wait" },
  });
});
```

- [ ] **Step 2: 运行 Go 运行器测试确认失败**

Run: `cd rpg && npx vitest run src/runners/go/go-detector.test.ts src/runners/go/go-runner.test.ts`  
Expected: FAIL，Go 模块尚不存在。

- [ ] **Step 3: 写入 SDK、临时项目生成和进程包装**

```go
// sdk.go
package main

type World struct {
    ActiveUnitID string \`json:"activeUnitId"\`
    Revision     int    \`json:"revision"\`
}

type Action struct {
    Type     string \`json:"type"\`
    TargetID string \`json:"targetId,omitempty"\`
}

type TurnCommand struct {
    ActorID          string \`json:"actorId"\`
    ExpectedRevision int    \`json:"expectedRevision"\`
    Action           Action \`json:"action"\`
}

func Wait(world World) TurnCommand {
    return TurnCommand{ActorID: world.ActiveUnitID, ExpectedRevision: world.Revision, Action: Action{Type: "wait"}}
}
```

```go
// runner_main.go
func main() {
    var world World
    if err := json.NewDecoder(os.Stdin).Decode(&world); err != nil { panic(err) }
    result, err := json.Marshal(ChooseTurn(world))
    if err != nil { panic(err) }
    if err := os.WriteFile(os.Getenv("RPG_RESULT_PATH"), result, 0o600); err != nil { panic(err) }
}
```

在 `go-project.ts` 用 `mkdtemp` 创建临时构建目录，写入 `go.mod`、`strategy.go`、`sdk.go`、`runner_main.go` 和空结果文件路径；用参数数组执行 `go build -o <binary> .`，运行二进制时把 `WorldView` JSON 写入 stdin，并以 `env: { ...process.env, RPG_RESULT_PATH: resultPath }` 注入结果文件路径。进程退出后读取结果文件：不存在、空文件或 JSON 解析失败返回 `runner_error/INVALID_TURN_RESULT`；有效 JSON 作为 `RunResult.returnValue`。玩家 stdout/stderr 按 `maxOutputBytes` 截断并写入 `RunResult.streams`，宿主不从 stdout 读取命令。只缓存由 `strategy.go`、SDK 版本、`go version` 和平台构成的 hash 对应二进制，保存于 `context.globalStorageUri/go-cache/`。清理临时目录始终由该目录创建者负责。

在 `go-runner.ts` 解析编译器诊断时，把临时 `strategy.go` 路径映射为请求的 `questId + ".go"`，保证后续 VS Code 投影到 `go-rpg/go-marsh-01.go`。生成 `RunResult` 时设置 `language: "go"`、`metrics.buildDurationMs` 和 `metrics.executionDurationMs`。为 `RunResult` 增加 `language` 与两个可选阶段耗时字段，Python 结果仍使用既有 `durationMs`。

保留当前 Python 的单次适配器和 5 秒语义，避免在 Go 切片中重写已验证 Python 进程路径。只提取不依赖单时限的状态切换与中断辅助函数；Go 运行器自行顺序管理构建与执行两个子进程，错误文案由各语言运行器提供，不在共享层写 Python 文案。

- [ ] **Step 4: 运行 Go 运行器测试**

Run: `cd rpg && npx vitest run src/runners/go/go-detector.test.ts src/runners/go/go-runner.test.ts src/runners/local/adapter.test.ts`  
Expected: PASS；缺少本机 Go 时，成功路径测试使用进程替身，真实工具链验证留在 Task 6。

- [ ] **Step 5: 提交 Go 执行器**

```bash
git add rpg/src/runners/go rpg/src/runners/shared rpg/src/runners/local
git commit -m "feat: 添加 Go 本地代码执行器"
```

## Task 5: 创建 Go 第一关并注册为可选战役

**Files:**

- Create: `rpg/src/game/content/go/go-marsh-01.ts`
- Create: `rpg/src/game/content/go/levels.ts`
- Create: `rpg/src/game/content/shared/marsh-slice.ts`
- Modify: `rpg/src/game/content/python/python-marsh-01.ts`
- Modify: `rpg/src/game/content/campaigns.ts`
- Modify: `rpg/src/game/content/levels.ts`
- Modify: `rpg/src/game/content/levels.test.ts`
- Modify: `rpg/src/game/content/reference-solutions.test.ts`

**Interfaces:**

- Produces `GO_RPG_CAMPAIGN`，其 `levelOrder` 仅为 `["go-marsh-01"]`。
- Go 第一关只复用战斗场景骨架；标题、引导、代码模板与奖励独立定义。
- Go 模板导出 `ChooseTurn(world World) TurnCommand`，初始行为是 `Wait(world)`。

- [ ] **Step 1: 写入 Go 第一关独立性失败测试**

```ts
it("Go 第一关不复用 Python 模板或战役顺序", () => {
  const level = getLevel("go-marsh-01");
  expect(level.starterCode).toContain("func ChooseTurn(world World) TurnCommand");
  expect(level.starterCode).not.toContain("def choose_turn");
  expect(getCampaign("go-rpg").levelOrder).toEqual(["go-marsh-01"]);
  expect(level.initialBattle.battleId).toBe("go-marsh-01");
});
```

- [ ] **Step 2: 运行内容测试确认失败**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/reference-solutions.test.ts`  
Expected: FAIL，`go-marsh-01` 尚未注册。

- [ ] **Step 3: 实现共享场景骨架与 Go 第一关**

```go
package main

func ChooseTurn(world World) TurnCommand {
    // world.ActiveUnitID 是当前行动者，world.Revision 是当前战场修订号。
    // 使用 Wait(world) 生成一条合法等待指令。
    return Wait(world)
}
```

在 `shared/marsh-slice.ts` 提供 `createMarshSlice(levelId, contentVersion)`，只包含已有第一关的地图、单位和敌方行为数据；Python 第一关和 Go 第一关分别调用它并各自设置 `battleId`、`contentVersion`、标题、教学文本、模板和奖励。不要把 Python 引导文本放入共享文件。

- [ ] **Step 4: 运行内容测试确认通过**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/reference-solutions.test.ts`  
Expected: PASS。

- [ ] **Step 5: 提交 Go 第一关内容**

```bash
git add rpg/src/game/content
git commit -m "feat: 添加 Go 沼泽第一关"
```

## Task 6: 在 VS Code 中选择战役并完成端到端验证

**Files:**

- Modify: `rpg/src/vscode/game-launcher-model.ts`
- Modify: `rpg/src/vscode/game-launcher.ts`
- Modify: `rpg/src/vscode/extension.ts`
- Modify: `rpg/src/vscode/game-session.ts`
- Modify: `rpg/src/vscode/direct-runner-client.ts`
- Modify: `rpg/src/vscode/direct-runner-client.test.ts`
- Modify: `rpg/src/vscode/game-launcher-model.test.ts`
- Modify: `rpg/package.json`
- Test: `rpg/src/runners/go/e2e.spec.ts`

**Interfaces:**

- Produces启动器战役选择：Python 沼泽战役与 Go 沼泽战役。
- 扩展根据选中的 `CampaignDefinition` 创建对应运行器；Python 使用既有路径，Go 使用 `detectGo` 与 `GoRunner`。
- Go 诊断投影到 `go-rpg/go-marsh-01.go`，不会写入 Python 诊断集合或 Python 存档。
- `openCampaign(campaignId)` 在同一战役已打开时仅显示现有面板；切换到不同战役时先关闭旧 session、runner 与诊断集合，再创建新会话。

- [ ] **Step 1: 写入启动器与 Go 工作区的失败测试**

```ts
it("启动器仅列出已实现的 Python 和 Go 战役", () => {
  expect(campaignItems(registeredCampaigns())).toEqual([
    expect.objectContaining({ id: "python-rpg" }),
    expect.objectContaining({ id: "go-rpg" }),
  ]);
});

it("选择 Go 战役时创建 go-rpg 第一关文件", async () => {
  await sessionFor(GO_RPG_CAMPAIGN).start();
  expect(host.writes.get(join(root, "go-rpg", "go-marsh-01.go"))).toContain("func ChooseTurn");
});

it("从 Python 战役切换到 Go 战役时释放旧会话并创建 Go 会话", async () => {
  const extension = activateForTest();
  await extension.openCampaign("python-rpg");
  await extension.openCampaign("go-rpg");
  expect(extension.disposedCampaigns).toEqual(["python-rpg"]);
  expect(extension.activeCampaignId).toBe("go-rpg");
});
```

- [ ] **Step 2: 运行 VS Code 测试确认失败**

Run: `cd rpg && npx vitest run src/vscode/game-launcher-model.test.ts src/vscode/game-session.test.ts src/vscode/direct-runner-client.test.ts`  
Expected: FAIL，启动器尚未建模战役选择，直接客户端只认识 Python。

- [ ] **Step 3: 实现战役选择、Runner 工厂和诊断投影**

```ts
function createRunner(context: vscode.ExtensionContext, campaign: CampaignDefinition): RunnerClient {
  if (campaign.program.language === "python") return createPythonRunner(context);
  if (campaign.program.language === "go") return createGoRunner(context);
  throw new Error(`尚未实现的战役语言: ${campaign.program.language}`);
}
```

```ts
function diagnosticFilePath(
  workspaceRoot: string,
  campaign: CampaignDefinition,
  levelId: string,
): string {
  return levelFilePath(workspaceRoot, campaign, levelId);
}
```

```ts
const openCampaign = async (campaignId: CampaignId): Promise<ActiveGame | undefined> => {
  if (activeGame?.campaignId === campaignId) {
    activeGame.reveal();
    return activeGame;
  }
  activeGame?.dispose();
  activeGame = await createActiveGame(context, getCampaign(campaignId));
  return activeGame;
};
```

启动器点击任一已注册战役后调用 `openCampaign(campaignId)`，并创建独立 `WorkspaceSaveStore` 与 `DocumentWorkspace`。`package.json` 的 Ctrl/Cmd+Enter 条件改为 `editorLangId == python || editorLangId == go`；新增 `goRpg.goPath` 配置，说明为可选 Go stable 可执行文件路径。不要添加 Rust 配置项。

- [ ] **Step 4: 执行单元、真实 Go 和扩展验证**

Run: `cd rpg && npx vitest run src/vscode/game-launcher-model.test.ts src/vscode/game-session.test.ts src/vscode/direct-runner-client.test.ts src/runners/go/go-detector.test.ts src/runners/go/go-runner.test.ts && npm run typecheck && npm run build`  
Expected: PASS。

Run: `cd rpg && npx vitest run src/runners/go/e2e.spec.ts`  
Expected: 当 `go version` 可用时，Go 运行器可执行 `Wait(world)` 并将编译错误映射为 `go-marsh-01.go`；工具链缺失时，断言安装提示且跳过真实 Go 执行断言。

Run: `cd rpg && npm run install:local`  
Expected: 生成 `dist/python-rpg.vsix` 并以 `--force` 安装本地扩展。

在普通 VS Code 窗口执行“Developer: Reload Window”，打开 Python 与 Go 两个战役：确认 Python 六关恢复现有文件与进度，确认 Go 打开 `go-rpg/go-marsh-01.go`、执行一回合并将编译错误标注到该文件。

- [ ] **Step 5: 提交扩展接入与交付验证**

```bash
git add rpg/src/vscode rpg/package.json rpg/src/runners/go/e2e.spec.ts
git commit -m "feat: 在 VS Code 中接入 Go 战役"
```

## 最终验收

- [ ] Python 战役仍使用 `python-rpg/`、`python-rpg.workspace-save`、`main.py` 和 `choose_turn`，现有六关通过针对性回归。
- [ ] Go 战役仅含 `go-marsh-01`，使用 `go-rpg/`、`go-rpg.workspace-save`、`strategy.go` 和 `ChooseTurn`。
- [ ] Python 与 Go 的合法 JSON 指令都进入同一 `validateLevelCommand -> resolveTurn` 链路。
- [ ] Go 工具链缺失、编译错误、超时和中断均显示语言对应的诊断，不影响 Python 存档、玩家源码和运行器。
- [ ] Rust 只存在静态目录与类型边界，没有可选入口、运行器、SDK、配置、关卡或测试。
- [ ] `npm run typecheck`、计划列出的定点 Vitest 测试、Go e2e 条件验证、`npm run build` 和 `npm run install:local` 都保留实际输出作为交付证据。
