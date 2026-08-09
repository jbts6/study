# Python RPG Python Runner、统一执行协议与安全轨迹 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Python 战役提供可验证的浏览器 Worker 执行器：它接收版本化的 JSON 请求，隔离执行多文件 Python 策略，返回不含战斗语义的 JSON 结果和安全代码轨迹，并能可靠中断、超时重建及报告失败。

**Architecture:** 先用独立浏览器证明页验证固定 Pyodide 及 `pyodide-worker-runner` 的公开 API；该证明失败即停止，保留证据，由新的计划把适配器改为官方 Pyodide Worker API。证明通过后，`runners/protocol` 负责语言无关的运行时校验，`PythonRunnerAdapter` 负责生命周期和硬超时重建，Worker 只运行 Python 辅助脚本并通过 Comlink 传递结构化克隆数据。Python 辅助脚本创建每次运行独有的工作目录和模块命名空间，执行器只返回 JSON 值；`WorldView` 与 `TurnCommand` 的游戏语义始终由战斗内核承担。

**Tech Stack:** TypeScript 5.7、Vite 6、Vitest 2、Playwright 1.62、`pyodide@314.0.3`、`pyodide-worker-runner@1.4.0`、`comsync@0.0.9`、`comlink@4.4.2`、浏览器 Worker、Pyodide Python。

## Global Constraints

- `rpg/package.json`、`rpg/vite.config.ts`、`rpg/playwright.config.ts` 已由战斗计划创建；本计划只修改它们合并依赖、脚本和隔离响应头，使用 `npm --prefix rpg install` 增量更新既有锁文件，不得删除或重建锁文件。
- 直接依赖必须精确固定为 `pyodide@314.0.3`、`pyodide-worker-runner@1.4.0`、`comsync@0.0.9`、`comlink@4.4.2`；不得为了辅助库兼容性降级 Pyodide。
- 首个证明点必须在真实浏览器覆盖加载、执行、`SharedArrayBuffer` 中断、硬超时 Worker 重建、多文件导入、连续运行隔离；Task 1 失败时停止本计划全部后续任务。
- 若 Task 1 证伪兼容性，只记录版本、命令、浏览器、最小复现和脱敏错误输出；新计划改用官方 Pyodide Worker API。不得修补依赖私有实现、猴子补丁或回退 Pyodide。
- 协议版本固定为 `1`，Worker 仅接收和返回可结构化克隆的 JSON 数据，绝不接收 DOM、存储对象或游戏内核实例。
- `WorldView`、`TurnCommand` 必须从 `rpg/src/game/combat/types.ts` 导入；Runner 只返回 JSON 值，游戏内核负责 `TurnCommand` 解析、合法性、`CommandResolution` 和关卡结果。
- Worker 状态只能是 `loading`、`ready`、`running`、`interrupting`、`restarting`、`unavailable`。主动中断先调用 `client.interrupt()` 并等待最多 `interruptGraceMs` 返回 `interrupted`，该等待到期才终止并重建；硬超时从 `run()` 开始计时，到达 `timeoutMs` 立即 `terminate()` 并重建，不等待 grace。
- 每次运行使用独立目录和新的模块命名空间，不继承变量、导入缓存、标准输出或标准错误。默认拒绝 `js`、`pyodide`、`micropip`、网络、进程和浏览器存储访问，不允许基于源码安装包。
- 所有请求都受文件数、单文件、源码总量、输出和轨迹预算约束；轨迹只记录玩家文件 `call`、`line`、`return`、`exception`，字符串 200 字符、集合 20 项、深度 3，轨迹预算耗尽必须以 `runtime_error` / `TRACE_LIMIT_REACHED` 结束。
- Worker 隔离与导入白名单只是稳定性边界，不是恶意代码安全沙箱；不得在同源前端暴露秘密、特权令牌或仅靠前端保护的敏感能力。

---

## 文件结构

| 路径 | 职责 |
|---|---|
| `rpg/package.json`、`rpg/vite.config.ts`、`rpg/playwright.config.ts` | 在战斗计划支架上合并 Python 依赖、真实浏览器测试和 SharedArrayBuffer 响应头。 |
| `rpg/tools/runner-proof/` | 只在 Task 1 使用的最小兼容性证明页面、Worker 与失败证据格式；不承载正式游戏功能。 |
| `rpg/src/runners/protocol/types.ts` | 协议版本、JSON 数据、请求/结果/诊断/限制和适配器公共类型。 |
| `rpg/src/runners/protocol/validate-request.ts` | 不依赖 Python 的请求运行时校验和稳定诊断码。 |
| `rpg/src/runners/python/adapter.ts` | 面向游戏的 `PythonRunnerAdapter`、状态迁移、可恢复中断、硬超时终止和重建。 |
| `rpg/src/runners/python/worker-api.ts` | 主线程与 Worker 之间的最小 Comlink RPC 契约，不泄漏 Pyodide 对象。 |
| `rpg/src/runners/python/python.worker.ts` | 以公开 `pyodide-worker-runner` 与 `Comlink.expose` 建立 Pyodide，并暴露初始化、运行和中断接口。 |
| `rpg/src/runners/python/runtime/execute.py` | 文件写入、模块白名单、入口调用、输出捕获、JSON 转换和可控的 `sys.settrace`。 |
| `rpg/e2e/runner-proof.spec.ts` | 真实 Chromium 中的依赖证明及正式适配器的跨线程行为验收。 |

## 依赖顺序

1. Task 1 的兼容性证明必须通过并提交，才可开始 Task 2--7。
2. Task 2 依赖战斗计划已导出 `WorldView`、`TurnCommand`；它不修改 `rpg/src/game/combat/types.ts`。
3. Task 3--6 都依赖 Task 2；Task 6 依赖 Task 3--5。
4. Task 7 只在 Task 1--6 的单元测试全部通过后执行。

### Task 1: 建立真实浏览器兼容性证明硬门

**Files:**
- Modify: `rpg/package.json`
- Modify: `rpg/vite.config.ts`
- Modify: `rpg/playwright.config.ts`
- Create: `rpg/tools/runner-proof/index.html`
- Create: `rpg/tools/runner-proof/main.ts`
- Create: `rpg/tools/runner-proof/proof.worker.ts`
- Create: `rpg/e2e/runner-proof.spec.ts`
- Create on failure only: `rpg/tools/runner-proof/compatibility-failure.md`

**Interfaces:**
- Consumes: `PyodideClient` 的 Worker 工厂和 `client.call(client.workerProxy.method, ...)` 调用方式；`client.interrupt()`；Worker 端 `defaultPyodideLoader`、`initPyodide`、`pyodideExpose` 与 `Comlink.expose` 的公开导出。
- Produces: 浏览器全局 `window.runnerProof`，其 `load()`、`execute(source)`、`interrupt()`、`hardTimeout(source, timeoutMs)`、`writeAndImport(files, entryFile)`、`isolatedRun(files, entryFile)` 均返回可 JSON 序列化的证明数据；Task 2--7 的唯一前置结论是 Playwright 全绿。


- [ ] **Step 1: 在战斗计划支架上合并精确依赖和浏览器隔离配置**

在既有 `rpg/package.json` 的 `dependencies` 合并以下精确字段，在既有 `scripts` 合并 `"e2e": "playwright test"`；保留战斗计划已有字段及脚本：

```json
{
  "scripts": { "e2e": "playwright test" },
  "dependencies": {
    "comlink": "4.4.2",
    "comsync": "0.0.9",
    "pyodide": "314.0.3",
    "pyodide-worker-runner": "1.4.0"
  }
}
```

不修改 `rpg/tsconfig.json`；它由战斗计划统一维护，必须已经包含 `src`、`tools`、`e2e` 和 `vite/client` 类型。

在既有 `rpg/vite.config.ts` 的 `server` 对象合并，在既有 `rpg/playwright.config.ts` 的 `webServer` 对象替换为：

```ts
import { defineConfig } from "vitest/config";

server: {
  headers: {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  },
},
```

```ts
import { defineConfig } from "@playwright/test";

webServer: {
  command: "npm --prefix rpg run dev -- --port 5173",
  url: "http://127.0.0.1:5173",
  reuseExistingServer: true,
  timeout: 120_000,
},
```

运行：`npm --prefix rpg install pyodide@314.0.3 pyodide-worker-runner@1.4.0 comsync@0.0.9 comlink@4.4.2`

运行：`npm --prefix rpg ls pyodide pyodide-worker-runner comsync comlink`

预期：既有 `rpg/package-lock.json` 仅增量更新，四个依赖均显示精确版本。

- [ ] **Step 2: 先写会失败的真实浏览器证明测试**

在 `rpg/e2e/runner-proof.spec.ts` 写入以下六项断言；此时页面尚不存在，测试应以导航或全局对象不存在失败：

```ts
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    runnerProof: {
      load(): Promise<{ runtime: string }>;
      execute(source: string): Promise<unknown>;
      interrupt(): Promise<{ status: "interrupted" }>;
      hardTimeout(source: string, timeoutMs: number): Promise<{ status: "timeout"; rebuilt: boolean }>;
      writeAndImport(files: Record<string, string>, entryFile: string): Promise<unknown>;
      isolatedRun(files: Record<string, string>, entryFile: string): Promise<unknown>;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tools/runner-proof/");
});

test("固定依赖在真实 Worker 中加载并执行 Python", async ({ page }) => {
  await expect(page.evaluate(() => window.runnerProof.load())).resolves.toMatchObject({ runtime: "314.0.3" });
  await expect(page.evaluate(() => window.runnerProof.execute("6 * 7"))).resolves.toEqual(42);
});

test("SharedArrayBuffer 中断无限循环", async ({ page }) => {
  const capabilities = await page.evaluate(() => ({ isolated: crossOriginIsolated, shared: typeof SharedArrayBuffer === "function" }));
  expect(capabilities.isolated, "SharedArrayBuffer proof requires COOP: same-origin and COEP: require-corp response headers").toBe(true);
  expect(capabilities.shared, "SharedArrayBuffer is unavailable; verify the COOP/COEP headers in rpg/vite.config.ts").toBe(true);
  await page.evaluate(() => window.runnerProof.load());
  const pending = page.evaluate(() => window.runnerProof.execute("while True: pass"));
  await page.waitForTimeout(100);
  await expect(page.evaluate(() => window.runnerProof.interrupt())).resolves.toEqual({ status: "interrupted" });
  await expect(pending).rejects.toThrow(/KeyboardInterrupt|interrupted/i);
  await expect(page.evaluate(() => window.runnerProof.execute("40 + 2"))).resolves.toEqual(42);
});

test("硬超时终止旧 Worker 并以新 Worker 恢复", async ({ page }) => {
  await page.evaluate(() => window.runnerProof.load());
  await expect(page.evaluate(() => window.runnerProof.hardTimeout("while True: pass", 200))).resolves.toMatchObject({ status: "timeout", rebuilt: true });
  await expect(page.evaluate(() => window.runnerProof.execute("40 + 2"))).resolves.toEqual(42);
});

test("多文件导入与连续运行隔离", async ({ page }) => {
  await page.evaluate(() => window.runnerProof.load());
  await expect(page.evaluate(() => window.runnerProof.writeAndImport({ "helper.py": "VALUE = 41", "main.py": "import helper\\nRESULT = helper.VALUE + 1" }, "main.py"))).resolves.toEqual(42);
  await expect(page.evaluate(() => window.runnerProof.isolatedRun({ "main.py": "RESULT = 7" }, "main.py"))).resolves.toEqual(7);
  await expect(page.evaluate(() => window.runnerProof.isolatedRun({ "main.py": "RESULT = globals().get('secret', 'absent')" }, "main.py"))).resolves.toEqual("absent");
});
```

运行：`npm --prefix rpg run e2e -- e2e/runner-proof.spec.ts`

预期：FAIL，原因是 `/tools/runner-proof/` 和 `window.runnerProof` 尚未实现。

- [ ] **Step 3: 用公开 API 实现最小证明页面和 Worker**

在 `rpg/tools/runner-proof/index.html` 写入：

```html
<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8" /><title>Runner proof</title></head>
<body><main id="app">Runner proof</main><script type="module" src="/tools/runner-proof/main.ts"></script></body></html>
```

`proof.worker.ts` 只从包顶层导入公开 API；初始化和调用必须是下列公开边界，不能导入包内路径：

```ts
import * as Comlink from "comlink";
import { defaultPyodideLoader, initPyodide, pyodideExpose } from "pyodide-worker-runner";

const pyodide = await defaultPyodideLoader("314.0.3");
initPyodide(pyodide);

let runSerial = 0;
const api = {
  runtime: pyodideExpose(async (_extras) => ({ runtime: pyodide.version })),
  execute: pyodideExpose(async (extras, source: string) => {
    pyodide.setInterruptBuffer(extras.interruptBuffer);
    return pyodide.runPythonAsync(source);
  }),
  writeAndImport: pyodideExpose(async (extras, files: Record<string, string>, entryFile: string) => {
    pyodide.setInterruptBuffer(extras.interruptBuffer);
    const root = `/proof-${++runSerial}`;
    pyodide.FS.mkdir(root);
    for (const [name, source] of Object.entries(files)) pyodide.FS.writeFile(`${root}/${name}`, source);
    return pyodide.runPythonAsync(`import runpy, sys; sys.path.insert(0, ${JSON.stringify(root)}); runpy.run_path(${JSON.stringify(`${root}/${entryFile}`)}, run_name=${JSON.stringify(`proof_${runSerial}`)})['RESULT']`);
  }),
};
Comlink.expose(api);
```

在 `main.ts` 使用给定的公开调用形式，并由 Worker 工厂保留当前 Worker 引用，使硬超时可以显式 `terminate()` 后创建新的 `PyodideClient`：

```ts
import { PyodideClient } from "pyodide-worker-runner";

let worker: Worker | undefined;
let client: PyodideClient | undefined;

function createClient() {
  client = new PyodideClient(() => {
    worker = new Worker(new URL("./proof.worker.ts", import.meta.url), { type: "module" });
    return worker;
  });
  return client;
}

async function call<T>(method: unknown, ...args: unknown[]): Promise<T> {
  const active = client ?? createClient();
  return active.call(method as never, ...args) as Promise<T>;
}

const runnerProof = {
  load() { const active = client ?? createClient(); return active.call<{ runtime: string }>(active.workerProxy.runtime); },
  execute(source: string) { const active = client ?? createClient(); return active.call<unknown>(active.workerProxy.execute, source); },
  async interrupt() {
    client?.interrupt();
    return { status: "interrupted" as const };
  },
  async hardTimeout(source: string, timeoutMs: number) {
    const active = client ?? createClient();
    void active.call(active.workerProxy.execute, source).catch(() => undefined);
    await new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    worker?.terminate();
    createClient();
    return { status: "timeout" as const, rebuilt: true };
  },
  writeAndImport(files: Record<string, string>, entryFile: string) { const active = client ?? createClient(); return active.call<unknown>(active.workerProxy.writeAndImport, files, entryFile); },
  isolatedRun(files: Record<string, string>, entryFile: string) { const active = client ?? createClient(); return active.call<unknown>(active.workerProxy.writeAndImport, files, entryFile); },
  runRequest: async (_request: unknown): Promise<unknown> => { throw new Error("PythonRunnerAdapter proof is installed in Task 6."); },
  interruptRun: async (_runId: string): Promise<void> => { throw new Error("PythonRunnerAdapter proof is installed in Task 6."); },
};

declare global { interface Window { runnerProof: typeof runnerProof; } }
window.runnerProof = runnerProof;
```

`window.runnerProof` 是 proof 页面唯一暴露的浏览器 API。每个方法经 `client.call(client.workerProxy.method, ...)` 到真实 Worker；Playwright 只从 `page.evaluate(() => window.runnerProof...)` 触发加载、执行、中断、硬超时、多文件导入和隔离，不在 Node 测试进程构造 `PythonRunnerAdapter`。为每个 `mkdir` 先捕获已存在目录并创建新的序号目录，绝不复用路径。

- [ ] **Step 4: 在 Chromium 中运行证明并写入明确的证伪分支**

运行：`npm --prefix rpg run build`

运行：`npm --prefix rpg run e2e -- e2e/runner-proof.spec.ts`

预期：构建和六项 Playwright 断言均 PASS；测试中 `crossOriginIsolated === true`、`typeof SharedArrayBuffer === "function"`，否则中断断言必须失败而不是跳过。

若任一断言失败，停止此计划。创建 `rpg/tools/runner-proof/compatibility-failure.md`，内容必须使用以下实际字段并填入本次命令输出中的值：

```md
# Pyodide worker compatibility failure

- date: 2026-08-10
- pyodide: 314.0.3
- pyodide-worker-runner: 1.4.0
- comsync: 0.0.9
- comlink: 4.4.2
- browser: <Playwright Chromium version>
- command: npm --prefix rpg run build; npm --prefix rpg run e2e -- e2e/runner-proof.spec.ts
- failed assertion: <one test title>
- redacted output: <error with local paths and environment values removed>
- decision: stop this plan; create a new plan using the official Pyodide Worker API without changing the PythonRunnerAdapter contract
```

只有全部 PASS 才继续；失败时不提交后续任务代码。

- [ ] **Step 5: 提交兼容性证明**

```bash
git add rpg/package.json rpg/package-lock.json rpg/tsconfig.json rpg/vite.config.ts rpg/playwright.config.ts rpg/tools/runner-proof rpg/e2e/runner-proof.spec.ts
git commit -m "test: prove pyodide worker compatibility"
```

预期：提交只包含证明支架、锁文件和浏览器测试；失败证据存在时提交该证据并停止，不开始 Task 2。

### Task 2: 定义版本化协议和请求运行时校验

**Files:**
- Create: `rpg/src/runners/protocol/types.ts`
- Create: `rpg/src/runners/protocol/validate-request.ts`
- Create: `rpg/src/runners/protocol/validate-request.test.ts`

**Interfaces:**
- Consumes: `import type { TurnCommand, WorldView } from "../../game/combat/types"` 和 `import { worldViewFixture } from "../../game/combat/fixtures"`；战斗计划必须先导出完整类型及共享 fixture，fixture 至少含 `battleId`、`contentVersion`、`revision`、`round`、`activeUnitId`、`map`、`units`、`objectives`。
- Produces: `PROTOCOL_VERSION`、`JsonValue`、`ExecutionLimits`、`RunRequest`、`RunResult`、`ExecutionStatus`、`RunnerDiagnostic`、`TraceEvent`、`validateRunRequest(value): RequestValidationResult`；Task 3--7 仅使用这些导出。

- [ ] **Step 1: 写失败的协议校验测试**

在 `validate-request.test.ts` 写入完整的最小有效请求和两类拒绝断言：

```ts
import { describe, expect, it } from "vitest";
import { worldViewFixture } from "../../game/combat/fixtures";
import { validateRunRequest } from "./validate-request";

const valid = {
  protocolVersion: 1,
  runId: "run-01J8K3",
  attemptId: "python-marsh-03-attempt-2",
  questId: "python-marsh-03",
  language: "python",
  files: { "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n" },
  entrypoint: { file: "main.py", callable: "choose_turn" },
  worldView: worldViewFixture,
  allowedModules: ["math"],
  limits: { timeoutMs: 2_000, interruptGraceMs: 250, maxFiles: 8, maxFileBytes: 16_384, maxSourceBytes: 65_536, maxOutputBytes: 16_384, maxTraceEvents: 1_000, maxValueDepth: 3 },
};

describe("validateRunRequest", () => {
  it("接受版本化、多文件 Python 请求", () => {
    expect(validateRunRequest(valid)).toMatchObject({ ok: true, value: valid });
  });

  it("拒绝父目录路径、缺失入口与超过预算的源码", () => {
    expect(validateRunRequest({ ...valid, files: { "../main.py": "pass" } })).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_FILE_PATH" }] });
    expect(validateRunRequest({ ...valid, entrypoint: { file: "missing.py", callable: "choose_turn" } })).toMatchObject({ ok: false, diagnostics: [{ code: "ENTRYPOINT_FILE_MISSING" }] });
    expect(validateRunRequest({ ...valid, files: { "main.py": "x".repeat(65_537) } })).toMatchObject({ ok: false, diagnostics: [{ code: "SOURCE_LIMIT_EXCEEDED" }] });
  });
});
```

运行：`npm --prefix rpg run test -- src/runners/protocol/validate-request.test.ts`

预期：FAIL，因为模块尚不存在。

- [ ] **Step 2: 实现精确类型、稳定状态和诊断形状**

在 `types.ts` 写入以下公共定义。`returnValue` 必须保持 `JsonValue | undefined`，不得声明为 `TurnCommand`：

```ts
import type { TurnCommand, WorldView } from "../../game/combat/types";

export const PROTOCOL_VERSION = 1 as const;
export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type ExecutionStatus = "completed" | "syntax_error" | "runtime_error" | "timeout" | "interrupted" | "invalid_request" | "runner_error";
export type RunnerState = "loading" | "ready" | "running" | "interrupting" | "restarting" | "unavailable";
export type DiagnosticSeverity = "error" | "warning" | "info";

export interface ExecutionLimits { timeoutMs: number; interruptGraceMs: number; maxFiles: number; maxFileBytes: number; maxSourceBytes: number; maxOutputBytes: number; maxTraceEvents: number; maxValueDepth: number; }
export interface Entrypoint { file: string; callable: string; }
export interface RunRequest { protocolVersion: typeof PROTOCOL_VERSION; runId: string; attemptId: string; questId: string; language: "python"; files: Record<string, string>; entrypoint: Entrypoint; worldView: WorldView; allowedModules: readonly string[]; limits: ExecutionLimits; }
export interface SourceLocation { file: string; line: number; column?: number; }
export interface RunnerDiagnostic { code: string; severity: DiagnosticSeverity; message: string; location?: SourceLocation; traceSeq?: number; recoveryAction: string; }
export interface TraceEvent { seq: number; file: string; line: number; event: "call" | "line" | "return" | "exception"; function: string; depth: number; locals: Record<string, JsonValue>; }
export interface OutputStreams { stdout: string; stderr: string; truncated: boolean; }
export interface RunnerMetrics { durationMs: number; traceEvents: number; }
export interface RunResult { protocolVersion: typeof PROTOCOL_VERSION; runId: string; attemptId: string; executionStatus: ExecutionStatus; returnValue?: JsonValue; returnValueTraceSeq?: number; trace: TraceEvent[]; diagnostics: RunnerDiagnostic[]; streams: OutputStreams; metrics: RunnerMetrics; }
export interface RequestValidationSuccess { ok: true; value: RunRequest; }
export interface RequestValidationFailure { ok: false; diagnostics: readonly RunnerDiagnostic[]; }
export type RequestValidationResult = RequestValidationSuccess | RequestValidationFailure;
export type ReturnedTurnIntent = JsonValue;
export type ParsedTurnCommand = TurnCommand;
```

- [ ] **Step 3: 实现无第三方依赖的边界校验**

在 `validate-request.ts` 中，使用 `Object.prototype.hasOwnProperty.call` 和以下判定实现；每个失败都返回一条 `severity: "error"`、`recoveryAction: "修正运行请求后重新运行"` 的稳定诊断，不能抛异常：

```ts
const SAFE_PATH = /^(?!.*(?:^|\\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._/-]*\.py$/;
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function byteLength(source: string): number { return new TextEncoder().encode(source).byteLength; }

function invalid(code: string, message: string): RequestValidationFailure {
  return { ok: false, diagnostics: [{ code, severity: "error", message, recoveryAction: "修正运行请求后重新运行" }] };
}
```

按这个顺序校验：顶层对象和 `protocolVersion === 1`；非空 `runId`/`attemptId`/`questId`；`language === "python"`；非空普通对象 `files`；`maxFiles`；每个相对 `.py` 路径和单文件 UTF-8 字节数；源码总字节数；入口文件存在及入口 callable 是 Python 标识符；`allowedModules` 中每项为不带点的 Python 标识符且无重复；`limits` 中每项是安全整数且大于零，另有 `maxValueDepth`；`worldView` 是对象。拒绝未知顶层字段、`..`、绝对路径、反斜杠、NUL 和 `__pycache__` 路径。校验成功返回原值，但通过 `structuredClone` 深拷贝为不可变的传输快照。

- [ ] **Step 4: 补全校验边界并运行通过测试**

向测试再加入：未知顶层字段得到 `UNKNOWN_REQUEST_FIELD`、`allowedModules: ["math", "math"]` 得到 `DUPLICATE_ALLOWED_MODULE`、零超时得到 `INVALID_LIMIT`、绝对路径得到 `INVALID_FILE_PATH`。运行：

```bash
npm --prefix rpg run test -- src/runners/protocol/validate-request.test.ts
npm --prefix rpg run build
```

预期：Vitest 全部 PASS，构建只在战斗计划的 `WorldView`/`TurnCommand` 导出已落地后 PASS；若导出尚未合并，记录为跨计划顺序阻塞，不能伪造本地类型副本。

- [ ] **Step 5: 提交协议任务**

```bash
git add rpg/src/runners/protocol/types.ts rpg/src/runners/protocol/validate-request.ts rpg/src/runners/protocol/validate-request.test.ts
git commit -m "feat: define runner execution protocol"
```

### Task 3: 以 fake Worker 客户端完成适配器状态机与超时重建 TDD

**Files:**
- Create: `rpg/src/runners/python/worker-api.ts`
- Create: `rpg/src/runners/python/adapter.ts`
- Create: `rpg/src/runners/python/adapter.test.ts`

**Interfaces:**
- Consumes: `RunRequest`、`RunResult`、`RunnerState`、`validateRunRequest`；Task 6 的真实 Worker 必须实现 `PythonWorkerApi`。
- Produces: `PythonWorkerApi`、`PythonWorkerClient`、`PythonWorkerClientFactory`、`PythonRunnerAdapter`，其中 `run(request): Promise<RunResult>`、`interrupt(runId): Promise<void>`、`subscribe(listener): () => void`、`dispose(): void` 为公开方法。

- [ ] **Step 1: 写使用 fake adapter 客户端的失败测试**

在 `adapter.test.ts` 定义可控 fake，不创建真实 Worker：

```ts
import { describe, expect, it, vi } from "vitest";
import { worldViewFixture } from "../../game/combat/fixtures";
import type { RunRequest } from "../protocol/types";
import { PythonRunnerAdapter } from "./adapter";

const request: RunRequest = {
  protocolVersion: 1 as const,
  runId: "run-adapter-01",
  attemptId: "attempt-adapter-01",
  questId: "python-marsh-03",
  language: "python" as const,
  files: { "main.py": "def choose_turn(world): return {'action': {'type': 'wait'}}" },
  entrypoint: { file: "main.py", callable: "choose_turn" },
  worldView: worldViewFixture,
  allowedModules: [],
  limits: { timeoutMs: 2_000, interruptGraceMs: 250, maxFiles: 8, maxFileBytes: 16_384, maxSourceBytes: 65_536, maxOutputBytes: 16_384, maxTraceEvents: 1_000, maxValueDepth: 3 },
};

function fakeClient(run = vi.fn()) {
  return { workerProxy: { initialize: vi.fn().mockResolvedValue({ state: "ready" }), run, interrupt: vi.fn().mockResolvedValue(undefined) }, call: vi.fn(async (method, ...args) => (method as Function)(...args)), interrupt: vi.fn(), terminate: vi.fn() };
}

it("以 loading、ready、running、ready 转换返回 Worker 的 JSON 结果", async () => {
  const client = fakeClient(vi.fn().mockResolvedValue({ protocolVersion: 1, runId: request.runId, attemptId: request.attemptId, executionStatus: "completed", returnValue: { action: { type: "wait" } }, trace: [], diagnostics: [], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 1, traceEvents: 0 } }));
  const states: string[] = [];
  const runner = new PythonRunnerAdapter({ createClient: () => client, createWorker: vi.fn() });
  runner.subscribe(({ state }) => states.push(state));
  await expect(runner.run(request)).resolves.toMatchObject({ executionStatus: "completed" });
  expect(states).toEqual(["loading", "ready", "running", "ready"]);
});

it("主动中断先调用 client.interrupt，硬超时终止并只重建一次", async () => {
  vi.useFakeTimers();
  const never = new Promise<never>(() => undefined);
  const first = fakeClient(vi.fn().mockReturnValue(never));
  const second = fakeClient();
  const createClient = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const runner = new PythonRunnerAdapter({ createClient, createWorker: vi.fn() });
  const pending = runner.run({ ...request, limits: { ...request.limits, timeoutMs: 10 } });
  await runner.interrupt(request.runId);
  expect(first.interrupt).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(10);
  await expect(pending).resolves.toMatchObject({ executionStatus: "timeout" });
  expect(first.terminate).toHaveBeenCalledOnce();
  expect(createClient).toHaveBeenCalledTimes(2);
});

it("运行期间拒绝第二次 run，且不覆盖首个 run 的 runId、interrupt 或 timeout", async () => {
  const never = new Promise<never>(() => undefined);
  const client = fakeClient(vi.fn().mockReturnValue(never));
  const runner = new PythonRunnerAdapter({ createClient: () => client, createWorker: vi.fn() });
  const first = runner.run({ ...request, runId: "run-first" });
  await expect(runner.run({ ...request, runId: "run-second" })).resolves.toMatchObject({ executionStatus: "invalid_request", runId: "run-second", diagnostics: [{ code: "RUN_IN_PROGRESS" }] });
  await runner.interrupt("run-second");
  expect(client.interrupt).not.toHaveBeenCalled();
  await runner.interrupt("run-first");
  expect(client.interrupt).toHaveBeenCalledOnce();
  void first;
});
```

运行：`npm --prefix rpg run test -- src/runners/python/adapter.test.ts`

预期：FAIL，因为适配器及 RPC 契约尚不存在。

- [ ] **Step 2: 固化 Worker RPC 与可替换客户端接口**

在 `worker-api.ts` 写入：

```ts
import type { RunRequest, RunResult, RunnerState } from "../protocol/types";

export interface PythonWorkerApi {
  initialize(): Promise<{ state: Extract<RunnerState, "ready" | "unavailable">; runtimeVersion?: string }>;
  run(request: RunRequest): Promise<RunResult>;
  interrupt(runId: string): Promise<void>;
}
export interface PythonWorkerClient {
  readonly workerProxy: PythonWorkerApi;
  call<TResult>(method: unknown, ...args: unknown[]): Promise<TResult>;
  interrupt(): void;
  terminate(): void;
}
export interface PythonWorkerClientFactory { create(workerFactory: () => Worker): PythonWorkerClient; }
```

- [ ] **Step 3: 实现状态机、可恢复中断和不可恢复超时**

在 `adapter.ts` 实现下列行为：构造时接收 `{ createWorker, createClient, setTimeoutFn, clearTimeoutFn }`；`ensureClient()` 先发 `loading`，调用 `client.call(client.workerProxy.initialize)` 后发 `ready`；`run()` 先调用 `validateRunRequest`。校验失败返回 `invalid_request` 的完整空流/空轨迹结果，不创建 Worker。若 `activeRun` 已存在，立即返回以下结果，绝不替换 `activeRun`、计时器或 Worker：

```ts
{ protocolVersion: 1, runId: request.runId, attemptId: request.attemptId, executionStatus: "invalid_request", trace: [], diagnostics: [{ code: "RUN_IN_PROGRESS", severity: "error", message: "已有 Python 运行正在执行。", recoveryAction: "等待当前运行结束或中断后再运行" }], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 0, traceEvents: 0 } }
```

仅在没有 `activeRun` 时发 `running` 并通过 `client.call(client.workerProxy.run, request)` 调用。

硬定时器使用请求的 `timeoutMs`。定时器先发 `restarting`，执行 `client.terminate()`，丢弃该 client，调用 `ensureClient()` 创建新 Worker，最终返回以下实际结果；旧 Promise 之后的 resolve/reject 必须以运行令牌忽略：

```ts
{
  protocolVersion: 1,
  runId: request.runId,
  attemptId: request.attemptId,
  executionStatus: "timeout",
  trace: [],
  diagnostics: [{ code: "HARD_TIMEOUT", severity: "error", message: "Python 运行超过时间限制，运行器已重建。", recoveryAction: "缩短策略或修复阻塞循环后重新运行" }],
  streams: { stdout: "", stderr: "", truncated: false },
  metrics: { durationMs: request.limits.timeoutMs, traceEvents: 0 },
}
```

`interrupt(runId)` 仅当当前 `activeRun.request.runId` 相等时有效：发 `interrupting`、调用 `client.interrupt()`，并设置 `interruptGraceMs` 计时器；Worker 在 grace 内返回 `interrupted` 时清除两个计时器并发 `ready`。grace 到期时发 `restarting`、终止该 Worker、重建 client，向首个调用返回 `interrupted` / `INTERRUPT_GRACE_EXCEEDED`。硬超时计时器从 run 开始独立计时，到期直接走 Task 3 的 `HARD_TIMEOUT` 路径，不等待 grace。初始化失败转换为完整 `runner_error` 结果、发 `unavailable`，诊断不得包含绝对路径、环境变量或 Worker 内部栈。`dispose()` 必须清除计时器、调用 `terminate()` 并清空监听器。

`rpg/src/runners/python/adapter.ts` 写入以下完整实现。它只依赖 Task 2 的协议与 Task 3 的 `worker-api.ts`，游戏内核不参与：

```ts
import { PROTOCOL_VERSION, type RunRequest, type RunResult, type RunnerDiagnostic, type RunnerState } from "../protocol/types";
import { validateRunRequest } from "../protocol/validate-request";
import { PyodideClient } from "pyodide-worker-runner";
import type { PythonWorkerClient } from "./worker-api";

type Listener = (snapshot: { state: RunnerState }) => void;
type Timer = ReturnType<typeof setTimeout>;
type ActiveRun = { request: RunRequest; token: number; resolve: (result: RunResult) => void; hardTimer: Timer; graceTimer?: Timer };
export type PythonRunnerAdapterOptions = {
  createWorker: () => Worker;
  createClient: (workerFactory: () => Worker) => PythonWorkerClient;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
};
export function browserPythonRunnerOptions(): PythonRunnerAdapterOptions {
  const createWorker = () => new Worker(new URL("./python.worker.ts", import.meta.url), { type: "module" });
  return { createWorker, createClient: (workerFactory) => new PyodideClient(workerFactory) as unknown as PythonWorkerClient };
}

function result(request: RunRequest, executionStatus: RunResult["executionStatus"], diagnostics: RunnerDiagnostic[], durationMs = 0): RunResult {
  return { protocolVersion: PROTOCOL_VERSION, runId: request.runId, attemptId: request.attemptId, executionStatus, trace: [], diagnostics, streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs, traceEvents: 0 } };
}
function diagnostic(code: string, severity: RunnerDiagnostic["severity"], message: string, recoveryAction: string): RunnerDiagnostic {
  return { code, severity, message, recoveryAction };
}

export class PythonRunnerAdapter {
  private client?: PythonWorkerClient;
  private active?: ActiveRun;
  private state: RunnerState = "loading";
  private token = 0;
  private readonly listeners = new Set<Listener>();
  private readonly setTimer: typeof setTimeout;
  private readonly clearTimer: typeof clearTimeout;
  constructor(private readonly options: PythonRunnerAdapterOptions = browserPythonRunnerOptions()) {
    this.setTimer = options.setTimeoutFn ?? setTimeout;
    this.clearTimer = options.clearTimeoutFn ?? clearTimeout;
  }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); listener({ state: this.state }); return () => this.listeners.delete(listener); }
  private transition(state: RunnerState) { if (this.state === state) return; this.state = state; for (const listener of this.listeners) listener({ state }); }
  private async ensureClient(): Promise<PythonWorkerClient> {
    if (this.client) return this.client;
    this.transition("loading");
    const client = this.options.createClient(this.options.createWorker);
    try { await client.call(client.workerProxy.initialize); this.client = client; this.transition("ready"); return client; }
    catch (error) { client.terminate(); this.transition("unavailable"); throw error; }
  }
  async run(request: RunRequest): Promise<RunResult> {
    const checked = validateRunRequest(request);
    if (!checked.ok) return result(request, "invalid_request", [...checked.diagnostics]);
    if (this.active) return result(request, "invalid_request", [diagnostic("RUN_IN_PROGRESS", "error", "已有 Python 运行正在执行。", "等待当前运行结束或中断后再运行")]);
    let client: PythonWorkerClient;
    try { client = await this.ensureClient(); }
    catch { return result(request, "runner_error", [diagnostic("RUNNER_UNAVAILABLE", "error", "Python 运行器当前不可用。", "检查浏览器支持后重试，或继续使用手动回合。")]); }
    this.transition("running");
    const token = ++this.token;
    return new Promise<RunResult>((resolve) => {
      const hardTimer = this.setTimer(() => void this.finishByRebuild(token, "timeout", "HARD_TIMEOUT", "Python 运行超过时间限制，运行器已重建。", request.limits.timeoutMs), request.limits.timeoutMs);
      this.active = { request, token, resolve, hardTimer };
      void client.call<RunResult>(client.workerProxy.run, request).then((value) => this.finish(token, value)).catch(() => void this.finishFatal(token));
    });
  }
  async interrupt(runId: string): Promise<void> {
    const active = this.active;
    if (!active || active.request.runId !== runId || !this.client) return;
    this.transition("interrupting"); this.client.interrupt();
    active.graceTimer = this.setTimer(() => void this.finishByRebuild(active.token, "interrupted", "INTERRUPT_GRACE_EXCEEDED", "中断未在宽限期内完成，运行器已重建。", active.request.limits.interruptGraceMs), active.request.limits.interruptGraceMs);
  }
  private finish(token: number, value: RunResult) {
    const active = this.active; if (!active || active.token !== token) return;
    this.clearTimer(active.hardTimer); if (active.graceTimer) this.clearTimer(active.graceTimer);
    this.active = undefined; this.transition(this.client ? "ready" : "unavailable"); active.resolve(value);
  }
  private async rebuild(): Promise<void> {
    this.transition("restarting");
    this.client?.terminate();
    this.client = undefined;
    try { await this.ensureClient(); }
    catch { this.transition("unavailable"); }
  }
  private async finishFatal(token: number): Promise<void> {
    const active = this.active; if (!active || active.token !== token) return;
    this.clearTimer(active.hardTimer); if (active.graceTimer) this.clearTimer(active.graceTimer);
    this.active = undefined;
    await this.rebuild();
    active.resolve(result(active.request, "runner_error", [diagnostic("WORKER_FATAL", "error", "Python Worker 已停止并已重建。", "修改代码后重新运行")], 0));
  }
  private async finishByRebuild(token: number, status: "timeout" | "interrupted", code: string, message: string, durationMs: number) {
    const active = this.active; if (!active || active.token !== token) return;
    this.clearTimer(active.hardTimer); if (active.graceTimer) this.clearTimer(active.graceTimer);
    this.active = undefined;
    const value = result(active.request, status, [diagnostic(code, status === "interrupted" ? "info" : "error", message, "修改代码后重新运行")], durationMs);
    await this.rebuild();
    active.resolve(value);
  }
  dispose() { const active = this.active; if (active) { this.clearTimer(active.hardTimer); if (active.graceTimer) this.clearTimer(active.graceTimer); } this.active = undefined; this.client?.terminate(); this.client = undefined; this.listeners.clear(); }
}
```

- [ ] **Step 4: 扩展 fake 测试并运行通过**

在 `adapter.test.ts` 写入以下完整断言：

```ts
it("非法请求、非当前中断、初始化失败、迟到响应和 dispose 均保持边界", async () => {
  const createWorker = vi.fn();
  const client = fakeClient();
  const runner = new PythonRunnerAdapter({ createClient: () => client, createWorker });
  await expect(runner.run({ ...request, files: { "../main.py": "pass" } })).resolves.toMatchObject({ executionStatus: "invalid_request" });
  expect(createWorker).not.toHaveBeenCalled();
  const late = new Promise<any>((resolve) => setTimeout(() => resolve({ protocolVersion: 1, runId: "run-late", attemptId: request.attemptId, executionStatus: "completed", trace: [], diagnostics: [], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 1, traceEvents: 0 } }), 20));
  const first = fakeClient(vi.fn().mockReturnValue(late));
  const second = fakeClient();
  const rebuilding = new PythonRunnerAdapter({ createClient: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second), createWorker: vi.fn() });
  const pending = rebuilding.run({ ...request, runId: "run-late", limits: { ...request.limits, timeoutMs: 10 } });
  await rebuilding.interrupt("different-run");
  expect(first.interrupt).not.toHaveBeenCalled();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await expect(pending).resolves.toMatchObject({ executionStatus: "timeout", runId: "run-late" });
  await late;
  rebuilding.dispose();
  expect(first.terminate).toHaveBeenCalledOnce();
  expect(second.terminate).toHaveBeenCalledOnce();
  const unavailable = fakeClient();
  unavailable.workerProxy.initialize.mockRejectedValueOnce(new Error("worker unavailable"));
  await expect(new PythonRunnerAdapter({ createClient: () => unavailable, createWorker: vi.fn() }).run(request)).resolves.toMatchObject({ executionStatus: "runner_error", diagnostics: [{ code: "RUNNER_UNAVAILABLE" }] });
});

it("Worker fatal reject 终止旧 client、初始化新 client 后才返回 runner_error", async () => {
  const first = fakeClient(vi.fn().mockRejectedValue(new Error("fatal")));
  const second = fakeClient(vi.fn().mockResolvedValue({ protocolVersion: 1, runId: "run-after-fatal", attemptId: request.attemptId, executionStatus: "completed", trace: [], diagnostics: [], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 1, traceEvents: 0 } }));
  const createClient = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const runner = new PythonRunnerAdapter({ createClient, createWorker: vi.fn() });
  await expect(runner.run({ ...request, runId: "run-fatal" })).resolves.toMatchObject({ executionStatus: "runner_error", diagnostics: [{ code: "WORKER_FATAL" }] });
  expect(first.terminate).toHaveBeenCalledOnce();
  expect(createClient).toHaveBeenCalledTimes(2);
  await expect(runner.run({ ...request, runId: "run-after-fatal" })).resolves.toMatchObject({ executionStatus: "completed" });
  expect(second.workerProxy.run).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-after-fatal" }));
});
```

运行：

```bash
npm --prefix rpg run test -- src/runners/python/adapter.test.ts
npm --prefix rpg run build
```

预期：全部 PASS。

- [ ] **Step 5: 提交适配器任务**

```bash
git add rpg/src/runners/python/worker-api.ts rpg/src/runners/python/adapter.ts rpg/src/runners/python/adapter.test.ts
git commit -m "feat: add python runner lifecycle adapter"
```

### Task 4: 实现每次运行隔离、导入白名单与输出预算

**Files:**
- Create: `rpg/src/runners/python/runtime/execute.py`
- Create: `rpg/src/runners/python/runtime/execute.test.ts`

**Interfaces:**
- Consumes: Worker 传入的 JSON 请求字段 `files`、`entrypoint`、`worldView`、`allowedModules`、`limits`；Task 2 已保证结构正确。
- Produces: Python 函数 `execute_request(request: dict[str, object]) -> dict[str, object]`，其结果字段与 `RunResult` 一致；Task 6 在 Pyodide 中只调用此函数。

- [ ] **Step 1: 写失败的执行器集成测试**

在 `execute.test.ts` 用 npm 固定的 `pyodide@314.0.3` 直接加载 helper，而不是 mock Python。测试初始化必须为：

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide } from "pyodide";
import { worldViewFixture } from "../../../game/combat/fixtures";
import executeSource from "./execute.py?raw";

let pyodide: Awaited<ReturnType<typeof loadPyodide>>;
beforeAll(async () => {
  pyodide = await loadPyodide();
  await pyodide.runPythonAsync(executeSource);
});
async function run(request: object) {
  pyodide.globals.set("__test_request__", pyodide.toPy(request));
  const raw = await pyodide.runPythonAsync("import json; json.dumps(execute_request(__test_request__))");
  return JSON.parse(String(raw));
}
```

测试数据和断言必须包含：

```ts
const baseRequest = {
  protocolVersion: 1, runId: "run-runtime-01", attemptId: "attempt-runtime-01", questId: "python-marsh-03", language: "python",
  entrypoint: { file: "main.py", callable: "choose_turn" },
  worldView: worldViewFixture,
  allowedModules: [], limits: { timeoutMs: 2_000, interruptGraceMs: 250, maxFiles: 8, maxFileBytes: 16_384, maxSourceBytes: 65_536, maxOutputBytes: 16_384, maxTraceEvents: 1_000, maxValueDepth: 3 },
};
const files = {
  "helpers/choose.py": "def action(world):\n    return {'action': {'type': 'wait'}, 'revision': world['revision']}",
  "main.py": "from helpers.choose import action\ndef choose_turn(world):\n    print('ready')\n    return action(world)",
};
await expect(run({ ...baseRequest, files }))
  .resolves.toMatchObject({ executionStatus: "completed", returnValue: { action: { type: "wait" }, revision: 7 }, streams: { stdout: "ready\\n", stderr: "", truncated: false } });
await expect(run({ ...baseRequest, files: { "main.py": "import js" } }))
  .resolves.toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "MODULE_NOT_ALLOWED" }] });
for (const blocked of ["js", "pyodide", "micropip"]) {
  await expect(run({ ...baseRequest, files: { "helpers/blocked.py": `import ${blocked}`, "main.py": "import helpers.blocked\ndef choose_turn(world): return None" } }))
    .resolves.toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "MODULE_NOT_ALLOWED" }] });
}
await expect(run({ ...baseRequest, allowedModules: ["math"], files: { "helpers/math_helper.py": "import math\ndef value(): return math.isqrt(9)", "main.py": "from helpers.math_helper import value\ndef choose_turn(world): return value()" } }))
  .resolves.toMatchObject({ executionStatus: "completed", returnValue: 3 });
await expect(run({ ...baseRequest, files: { "main.py": "print('x' * 100)\ndef choose_turn(world): return None" }, limits: { ...baseRequest.limits, maxOutputBytes: 32 } }))
  .resolves.toMatchObject({ streams: { truncated: true } });
```

运行：`npm --prefix rpg run test -- src/runners/python/runtime/execute.test.ts`

预期：FAIL，因为 `execute_request` 尚不存在。

- [ ] **Step 2: 在 Python 中写入隔离执行与明确的禁止导入规则**

在 `execute.py` 定义这些常量和函数；所有生成的临时路径都基于 `request['runId']`、`request['attemptId']` 和 `uuid.uuid4().hex`，并在 `finally` 中删除：

```python
import contextlib
import io
import math
import os
import shutil
import sys
import tempfile
import time
import types
import uuid
from pathlib import Path
import importlib.abc
import importlib.util

BLOCKED_MODULES = frozenset({"js", "pyodide", "micropip", "socket", "ssl", "http", "urllib", "requests", "subprocess", "multiprocessing", "ctypes", "webbrowser"})
SAFE_BUILTINS = {"__build_class__": __build_class__, "abs": abs, "all": all, "any": any, "AssertionError": AssertionError, "bool": bool, "dict": dict, "enumerate": enumerate, "Exception": Exception, "filter": filter, "float": float, "int": int, "len": len, "list": list, "map": map, "max": max, "min": min, "object": object, "range": range, "reversed": reversed, "round": round, "set": set, "sorted": sorted, "str": str, "sum": sum, "tuple": tuple, "ValueError": ValueError, "zip": zip}

ORIGINAL_IMPORT = __import__

def guarded_import(allowed_modules: set[str], player_module_roots: set[str]):
    def import_module(name, globals=None, locals=None, fromlist=(), level=0):
        root = name.split(".", 1)[0]
        if level or root in BLOCKED_MODULES or root not in allowed_modules | player_module_roots:
            raise RuntimeError(f"MODULE_NOT_ALLOWED:{root}")
        return ORIGINAL_IMPORT(name, globals, locals, fromlist, level)
    return import_module

class RestrictedPlayerLoader(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def __init__(self, root: Path, guarded):
        self.root, self.guarded = root, guarded
    def find_spec(self, fullname, path=None, target=None):
        relative = Path(*fullname.split("."))
        module_file = self.root / relative.with_suffix(".py")
        package_file = self.root / relative / "__init__.py"
        if module_file.is_file():
            return importlib.util.spec_from_file_location(fullname, module_file, loader=self)
        if package_file.is_file():
            return importlib.util.spec_from_file_location(fullname, package_file, loader=self, submodule_search_locations=[str(package_file.parent)])
        return None
    def create_module(self, spec):
        return types.ModuleType(spec.name)
    def exec_module(self, module):
        path = Path(module.__spec__.origin)
        module.__dict__.update({"__file__": str(path), "__package__": module.__spec__.parent, "__builtins__": {**SAFE_BUILTINS, "__import__": self.guarded}})
        exec(compile(path.read_text("utf-8"), str(path), "exec"), module.__dict__, module.__dict__)

def clip_utf8(text: str, limit: int) -> tuple[str, bool]:
    raw = text.encode("utf-8")
    if len(raw) <= limit:
        return text, False
    suffix = "\\n...[output truncated]".encode("utf-8")
    return (raw[:max(0, limit - len(suffix))].decode("utf-8", "ignore") + suffix.decode("utf-8"), True)

def execute_request(request: dict[str, object]) -> dict[str, object]:
    started = time.perf_counter()
    previous_trace = sys.gettrace()
    previous_cwd = os.getcwd()
    modules_before = dict(sys.modules)
    try:
        return execute_isolated_request(request, started)
    except KeyboardInterrupt:
        return {
            "protocolVersion": 1,
            "runId": request["runId"],
            "attemptId": request["attemptId"],
            "executionStatus": "interrupted",
            "returnValue": None,
            "trace": [],
            "diagnostics": [{"code": "INTERRUPTED", "severity": "info", "message": "Python 运行已中断。", "recoveryAction": "修改代码后重新运行"}],
            "streams": {"stdout": "", "stderr": "", "truncated": False},
            "metrics": {"durationMs": int((time.perf_counter() - started) * 1000), "traceEvents": 0},
        }
    except SyntaxError as error:
        return syntax_error_result(request, error, started)
    except TraceLimitReached as error:
        return trace_limit_result(request, started, error.trace)
    except ReturnNotSerializable:
        return runtime_error_result(request, "RETURN_NOT_SERIALIZABLE", "入口函数必须返回 JSON 值。", started)
    except RuntimeError as error:
        code = "MODULE_NOT_ALLOWED" if str(error).startswith("MODULE_NOT_ALLOWED:") else "PYTHON_RUNTIME_ERROR"
        return runtime_error_result(request, code, "Python 运行失败。", started)
    finally:
        sys.settrace(previous_trace)
        os.chdir(previous_cwd)
        for name in tuple(sys.modules):
            if name not in modules_before:
                del sys.modules[name]
        sys.modules.update(modules_before)
```

同一 `rpg/src/runners/python/runtime/execute.py` 文件还必须定义下列三个异常结果工厂；它们不泄漏绝对路径或 Python 内部 traceback：

```python
def error_result(request: dict[str, object], status: str, code: str, message: str, started: float, location=None, trace=None) -> dict[str, object]:
    diagnostic = {"code": code, "severity": "error", "message": message, "recoveryAction": "修改代码后重新运行"}
    if location is not None: diagnostic["location"] = location
    events = [] if trace is None else trace
    return {"protocolVersion": 1, "runId": request["runId"], "attemptId": request["attemptId"], "executionStatus": status, "returnValue": None, "trace": events, "diagnostics": [diagnostic], "streams": {"stdout": "", "stderr": "", "truncated": False}, "metrics": {"durationMs": int((time.perf_counter() - started) * 1000), "traceEvents": len(events)}}

def syntax_error_result(request: dict[str, object], error: SyntaxError, started: float) -> dict[str, object]:
    return error_result(request, "syntax_error", "PYTHON_SYNTAX_ERROR", "Python 语法错误。", started, {"file": Path(error.filename).name if error.filename else request["entrypoint"]["file"], "line": error.lineno or 1, "column": error.offset or 1})

def trace_limit_result(request: dict[str, object], started: float, trace: list[dict[str, object]]) -> dict[str, object]:
    return error_result(request, "runtime_error", "TRACE_LIMIT_REACHED", "代码轨迹超过限制，运行已停止。", started, trace=trace)

def runtime_error_result(request: dict[str, object], code: str, message: str, started: float) -> dict[str, object]:
    return error_result(request, "runtime_error", code, message, started)
```

将 `files` 逐个写入唯一工作目录，创建每个父目录和 `__init__.py`。从文件首段计算 `player_module_roots`，构造 `guarded = guarded_import(set(allowedModules), player_module_roots)` 和 `loader = RestrictedPlayerLoader(root, guarded)`，在调用入口前 `sys.meta_path.insert(0, loader)`。入口也必须用 `types.ModuleType`、同一 `SAFE_BUILTINS` 与同一 `guarded` 后 `exec(compile(...))`，不得只替换入口的 builtins。调用前保存模块、`sys.path`、`sys.stdout`、`sys.stderr`、`sys.meta_path`；在 `finally` 删除工作目录模块并逐项恢复。禁止 `open`、`eval`、`exec`、`compile`、`input`、`help`、`globals`、`locals`、`vars`、`getattr`、`setattr`、`delattr`、原始 `__import__` 进入任一玩家模块。

- [ ] **Step 3: 返回固定形状的结果并补足边界测试**

`execute_request` 必须在每条路径返回完整的 `RunResult` 字段。入口返回值只可由以下函数转换；达到 `limits["maxValueDepth"]` 或遇到非 JSON 精确内建值时抛 `ReturnNotSerializable`，并映射 `runtime_error` / `RETURN_NOT_SERIALIZABLE`：

```python
class ReturnNotSerializable(Exception): pass
def json_value(value, depth, max_depth):
    kind = type(value)
    if depth >= max_depth: raise ReturnNotSerializable()
    if value is None or kind in (bool, int, str): return value
    if kind is float and math.isfinite(value): return value
    if kind in (list, tuple): return [json_value(item, depth + 1, max_depth) for item in value]
    if kind is dict and all(type(key) is str for key in value): return {key: json_value(value[key], depth + 1, max_depth) for key in value}
    raise ReturnNotSerializable()
```

`SyntaxError` 映射 `syntax_error` / `PYTHON_SYNTAX_ERROR` 且填文件、行、列；普通异常映射 `runtime_error` / `PYTHON_RUNTIME_ERROR`，但 `RuntimeError("MODULE_NOT_ALLOWED:<name>")` 映射 `MODULE_NOT_ALLOWED`。`stdout` 与 `stderr` 分别以 `clip_utf8` 截断，任一截断即 `truncated: true`；输出为空不是错误。

写入以下测试：同一 Worker 先设模块全局变量、下一次调用读不到它；`micropip`、`socket` 和未在 `allowedModules` 声明的 `math` 都得到 `MODULE_NOT_ALLOWED`；允许 `math` 时 `math.isqrt(9)` 正常；文件数、单文件及总量越界由 Task 2 在到达 Python 前拒绝。运行：

```bash
npm --prefix rpg run test -- src/runners/python/runtime/execute.test.ts
```

预期：所有用例 PASS，且 Python 运行不会安装任何包或访问浏览器对象。

- [ ] **Step 4: 提交隔离执行任务**

```bash
git add rpg/src/runners/python/runtime/execute.py rpg/src/runners/python/runtime/execute.test.ts
git commit -m "feat: isolate python runner execution"
```

### Task 5: 以安全序列化实现有限轨迹

**Files:**
- Modify: `rpg/src/runners/python/runtime/execute.py`
- Modify: `rpg/src/runners/python/runtime/execute.test.ts`

**Interfaces:**
- Consumes: `limits.maxTraceEvents` 和 Task 4 的唯一工作目录、玩家文件集合。
- Produces: `TraceEvent[]`、`returnValueTraceSeq`、稳定诊断 `TRACE_LIMIT_REACHED`；Task 6 将它们不改写地返回主线程。


- [ ] **Step 1: 写失败的安全轨迹测试**

在 `execute.test.ts` 写入以下完整用例；它覆盖递归、异常、字符串截断、恶意 `repr`、恶意容器子类和轨迹预算：

```ts
it("安全轨迹不执行 repr 或容器子类协议，并在预算处停止", async () => {
  const result = await run({ ...baseRequest, limits: { ...baseRequest.limits, maxTraceEvents: 2 }, files: { "main.py": "class Explosive:\n def __repr__(self): raise AssertionError('repr called')\nclass Trap(list):\n def __iter__(self): raise AssertionError('iter called')\ndef choose_turn(world):\n text = 'x' * 201\n trap = Trap([1, 2])\n return {'value': Explosive(), 'trap': trap}" } });
  expect(result).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "TRACE_LIMIT_REACHED" }] });
  expect(result.trace).toHaveLength(2);
  expect(JSON.stringify(result.trace)).not.toContain("repr called");
  expect(JSON.stringify(result.trace)).not.toContain("iter called");
});

it("只记录玩家文件四类事件并保留 returnValueTraceSeq", async () => {
  const result = await run({ ...baseRequest, files: { "main.py": "def recur(n):\n if n == 0: raise ValueError('bad')\n return recur(n - 1)\ndef choose_turn(world):\n try: recur(1)\n except ValueError: pass\n marker = 'x' * 201\n return {'action': {'type': 'wait'}}" } });
  expect(result.executionStatus).toBe("completed");
  expect(result.trace.every((event: { file: string; event: string }) => event.file === "main.py" ? ["call", "line", "return", "exception"].includes(event.event) : false)).toBe(true);
  expect(result.trace.some((event: { event: string }) => event.event === "exception")).toBe(true);
  expect(JSON.stringify(result.trace)).toContain("<truncated:string>");
  expect(result.trace.some((event: { seq: number; event: string; function: string }) => event.seq === result.returnValueTraceSeq ? event.event === "return" ? event.function === "choose_turn" : false : false)).toBe(true);
});
```

运行：`npm --prefix rpg run test -- src/runners/python/runtime/execute.test.ts`

预期：FAIL，因为 Task 4 尚未安装 trace hook。


- [ ] **Step 2: 写入不触发用户代码的安全序列化器与 trace hook**

在 `execute.py` 写入下列固定限制；禁止调用 `repr()`、`str()`、`dir()`、`getattr()`、`vars()` 或访问任意对象属性：

```python
TRACE_STRING_LIMIT = 200
TRACE_COLLECTION_LIMIT = 20
TRACE_DEPTH_LIMIT = 3

def safe_value(value, depth=0, seen=None):
    seen = set() if seen is None else seen
    if depth >= TRACE_DEPTH_LIMIT:
        return "<truncated:depth>"
    value_type = type(value)
    if value is None or value_type is bool or value_type is int:
        return value
    if value_type is float:
        return value if math.isfinite(value) else "<non-finite-float>"
    if value_type is str:
        return value if len(value) <= TRACE_STRING_LIMIT else value[:TRACE_STRING_LIMIT] + "<truncated:string>"
    if type(value) not in (list, tuple, dict, set, frozenset):
        return "<unserializable>"
    identity = id(value)
    if identity in seen:
        return "<circular>"
    seen.add(identity)
    if type(value) is list or type(value) is tuple:
        rendered = [safe_value(value[index], depth + 1, seen) for index in range(min(len(value), TRACE_COLLECTION_LIMIT))]
        if len(value) > TRACE_COLLECTION_LIMIT: rendered.append("<truncated:collection>")
        return rendered
    if type(value) is dict:
        rendered = {}
        for index, key in enumerate(value):
            if index == TRACE_COLLECTION_LIMIT: break
            safe_key = key if type(key) in (str, int, float, bool) else "<non-primitive-key>"
            rendered[str(safe_key)] = safe_value(value[key], depth + 1, seen)
        if len(value) > TRACE_COLLECTION_LIMIT: rendered["<truncated:collection>"] = True
        return rendered
    rendered = []
    for index, item in enumerate(value):
        if index == TRACE_COLLECTION_LIMIT: break
        rendered.append(safe_value(item, depth + 1, seen))
    if len(value) > TRACE_COLLECTION_LIMIT: rendered.append("<truncated:collection>")
    return rendered

class TraceLimitReached(Exception):
    def __init__(self, trace):
        self.trace = list(trace)

def install_player_trace(player_files: set[Path], max_events: int, trace_events: list[dict[str, object]]):
    depth_by_frame: dict[int, int] = {}
    def trace(frame, event, arg):
        file_path = Path(frame.f_code.co_filename).resolve()
        if file_path not in player_files:
            return None
        if event == "call":
            depth_by_frame[id(frame)] = len(depth_by_frame)
        if event in ("call", "line", "return", "exception"):
            if len(trace_events) >= max_events:
                raise TraceLimitReached(trace_events)
            locals_view = {name: safe_value(value) for name, value in frame.f_locals.items() if not name.startswith("_")}
            trace_events.append({"seq": len(trace_events) + 1, "file": file_path.name, "line": frame.f_lineno, "event": event, "function": frame.f_code.co_name, "depth": depth_by_frame.get(id(frame), 0), "locals": locals_view})
        if event in ("return", "exception"):
            depth_by_frame.pop(id(frame), None)
        return trace
    previous = sys.gettrace()
    sys.settrace(trace)
    return previous
```

同一文件的 `execute_isolated_request` 负责 hook 安装、入口调用、`returnValueTraceSeq` 和成功结果组装，不能把这些责任留给 Worker：

```python
def write_isolated_files(request: dict[str, object]) -> tuple[Path, list[Path], RestrictedPlayerLoader, types.ModuleType]:
    root = Path(tempfile.mkdtemp(prefix=f"rpg-{request['runId']}-{request['attemptId']}-"))
    written_files = []
    for relative, source in request["files"].items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        for parent in path.parents:
            if parent == root: break
            (parent / "__init__.py").touch(exist_ok=True)
        path.write_text(source, encoding="utf-8")
        written_files.append(path)
    roots = {Path(relative).parts[0] for relative in request["files"]}
    guarded = guarded_import(set(request["allowedModules"]), roots)
    loader = RestrictedPlayerLoader(root, guarded)
    entry_path = root / request["entrypoint"]["file"]
    module = types.ModuleType(f"player_{uuid.uuid4().hex}")
    module.__spec__ = importlib.util.spec_from_file_location(module.__name__, entry_path, loader=loader)
    return root, written_files, loader, module

def remove_isolated_files(root: Path) -> None:
    shutil.rmtree(root, ignore_errors=True)

def execute_isolated_request(request: dict[str, object], started: float) -> dict[str, object]:
    trace_events: list[dict[str, object]] = []
    old_meta_path, old_path = list(sys.meta_path), list(sys.path)
    stdout, stderr = io.StringIO(), io.StringIO()
    previous_stdout, previous_stderr = sys.stdout, sys.stderr
    previous_trace = sys.gettrace()
    root: Path | None = None
    try:
        root, written_files, loader, module = write_isolated_files(request)
        sys.meta_path.insert(0, loader)
        sys.path.insert(0, str(root))
        loader.exec_module(module)
        entry = module.__dict__[request["entrypoint"]["callable"]]
        if not callable(entry): raise RuntimeError("ENTRYPOINT_NOT_CALLABLE")
        previous_trace = install_player_trace({path.resolve() for path in written_files}, request["limits"]["maxTraceEvents"], trace_events)
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            value = entry(request["worldView"])
        return_trace_seq = next((event["seq"] for event in reversed(trace_events) if event["event"] == "return" and event["function"] == request["entrypoint"]["callable"]), None)
        stdout_text, stdout_cut = clip_utf8(stdout.getvalue(), request["limits"]["maxOutputBytes"])
        stderr_text, stderr_cut = clip_utf8(stderr.getvalue(), request["limits"]["maxOutputBytes"])
        return {
            "protocolVersion": 1, "runId": request["runId"], "attemptId": request["attemptId"], "executionStatus": "completed",
            "returnValue": json_value(value, 0, request["limits"]["maxValueDepth"]), "returnValueTraceSeq": return_trace_seq,
            "trace": trace_events, "diagnostics": [], "streams": {"stdout": stdout_text, "stderr": stderr_text, "truncated": stdout_cut or stderr_cut},
            "metrics": {"durationMs": int((time.perf_counter() - started) * 1000), "traceEvents": len(trace_events)},
        }
    finally:
        sys.settrace(previous_trace)
        sys.stdout, sys.stderr, sys.meta_path, sys.path = previous_stdout, previous_stderr, old_meta_path, old_path
        if root is not None:
            remove_isolated_files(root)
```

安装 `sys.settrace(trace)` 前先计算 `player_files = {Path(path).resolve() for path in written_files}`。hook 在 `frame.f_code.co_filename` 不属于该集合时立即 `return None`；对 `call`、`line`、`return`、`exception` 追加 `{seq, file: relative_path, line: frame.f_lineno, event, function: frame.f_code.co_name, depth, locals}`，其中 locals 只枚举不以 `_` 开头的名称并调用 `safe_value`。每次追加前比较 `len(trace) >= maxTraceEvents`，成立时抛出专用 `TraceLimitReached`；`execute_request` 捕获它，返回 `runtime_error`、`TRACE_LIMIT_REACHED`、已有轨迹和可恢复提示。返回入口值时记录当前 seq 为 `returnValueTraceSeq`。


- [ ] **Step 3: 写入循环引用、深度和内部帧断言并运行**

在同一测试文件写入：

```ts
it("轨迹序号连续，循环引用、集合上限和深度上限都被安全裁剪", async () => {
  const result = await run({ ...baseRequest, files: { "main.py": "def choose_turn(world):\n a = []; a.append(a)\n many = list(range(21))\n deep = [[[[1]]]]\n return {'a': a, 'many': many, 'deep': deep}" } });
  expect(result.executionStatus).toBe("completed");
  expect(result.trace.map((event: { seq: number }) => event.seq)).toEqual(result.trace.map((_: unknown, index: number) => index + 1));
  const traceText = JSON.stringify(result.trace);
  expect(traceText).toContain("<circular>");
  expect(traceText).toContain("<truncated:collection>");
  expect(traceText).toContain("<truncated:depth>");
  expect(traceText).not.toMatch(/<exec>|<frozen>|execute\\.py|[A-Za-z]:\\\\|\\/home\\//);
});
```

运行：

```bash
npm --prefix rpg run test -- src/runners/python/runtime/execute.test.ts
```

预期：PASS；恶意 `__repr__` 和描述符均未执行，预算不以静默丢事件方式处理。

- [ ] **Step 4: 提交安全轨迹任务**

```bash
git add rpg/src/runners/python/runtime/execute.py rpg/src/runners/python/runtime/execute.test.ts
git commit -m "feat: add bounded safe python traces"
```

### Task 6: 接入正式 Worker、Pyodide 公共生命周期和适配器

**Files:**
- Create: `rpg/src/runners/python/python.worker.ts`
- Modify: `rpg/src/runners/python/adapter.ts`
- Modify: `rpg/tools/runner-proof/main.ts`
- Modify: `rpg/e2e/runner-proof.spec.ts`

**Interfaces:**
- Consumes: `PythonWorkerApi`、`RunRequest`、`RunResult`、`execute_request`、Task 1 已证实的公开依赖 API。
- Produces: `new PythonRunnerAdapter()` 的默认 Worker 工厂，以及符合 `PythonWorkerApi` 的 `initialize/run/interrupt` 真实 RPC；界面只能订阅状态和接收 `RunResult`。

- [ ] **Step 1: 写失败的真实 Worker 行为测试**

在 `rpg/e2e/runner-proof.spec.ts` 只通过页面暴露的 `window.runnerProof` 调用真实适配器，断言以下结果：

```ts
import { expect, test } from "@playwright/test";
import { worldViewFixture } from "../src/game/combat/fixtures";

const validRequest = {
  protocolVersion: 1 as const, runId: "run-browser-01", attemptId: "attempt-browser-01", questId: "python-marsh-03", language: "python" as const,
  files: { "main.py": "def choose_turn(world):\n return {'action': {'type': 'wait'}}" }, entrypoint: { file: "main.py", callable: "choose_turn" },
  worldView: worldViewFixture, allowedModules: [],
  limits: { timeoutMs: 2_000, interruptGraceMs: 250, maxFiles: 8, maxFileBytes: 16_384, maxSourceBytes: 65_536, maxOutputBytes: 16_384, maxTraceEvents: 1_000, maxValueDepth: 3 },
};

test("正式 Worker 返回受限 JSON、硬超时与主动中断", async ({ page }) => {
  await page.goto("/tools/runner-proof/");
  await expect(page.evaluate((request) => window.runnerProof.runRequest(request), validRequest)).resolves.toMatchObject({ executionStatus: "completed", returnValue: { action: { type: "wait" } } });
  await expect(page.evaluate((request) => window.runnerProof.runRequest(request), { ...validRequest, files: { "main.py": "def choose_turn(world):\n  return {1, 2}" } })).resolves.toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "RETURN_NOT_SERIALIZABLE" }] });
  await expect(page.evaluate((request) => window.runnerProof.runRequest(request), { ...validRequest, files: { "main.py": "def choose_turn(world):\n  while True: pass" } })).resolves.toMatchObject({ executionStatus: "timeout", diagnostics: [{ code: "HARD_TIMEOUT" }] });
  const interruptedRequest = { ...validRequest, runId: "run-browser-interrupt", files: { "main.py": "def choose_turn(world):\n  while True: pass" } };
  const pending = page.evaluate((request) => window.runnerProof.runRequest(request), interruptedRequest);
  await page.waitForTimeout(100);
  await page.evaluate((runId) => window.runnerProof.interruptRun(runId), interruptedRequest.runId);
  await expect(pending).resolves.toMatchObject({ executionStatus: "interrupted", returnValue: null, diagnostics: [{ code: "INTERRUPTED", severity: "info" }], streams: { stdout: "", stderr: "", truncated: false } });
  await expect(page.evaluate((request) => window.runnerProof.runRequest(request), validRequest)).resolves.toMatchObject({ executionStatus: "completed" });
});
```

在 Task 6 修改 `main.ts`，以浏览器模块导入 `PythonRunnerAdapter` 并把以下方法并入既有 `runnerProof`：

```ts
import { PythonRunnerAdapter } from "../../src/runners/python/adapter";
import type { RunRequest, RunResult } from "../../src/runners/protocol/types";

const strategyAdapter = new PythonRunnerAdapter();
Object.assign(runnerProof, {
  runRequest: (request: RunRequest): Promise<RunResult> => strategyAdapter.run(request),
  interruptRun: (runId: string): Promise<void> => strategyAdapter.interrupt(runId),
});
```

运行：`npm --prefix rpg run e2e -- e2e/runner-proof.spec.ts`。

预期：FAIL，因为正式 Worker 尚未实现。

- [ ] **Step 2: 用公开导出建立 Worker，并只暴露协议 API**

在 `python.worker.ts` 使用下列边界。不要把 `pyodide`、`FS` 或 Python proxy 返回到主线程：

```ts
import * as Comlink from "comlink";
import { defaultPyodideLoader, initPyodide, pyodideExpose } from "pyodide-worker-runner";
import type { RunRequest, RunResult } from "../protocol/types";
import type { PythonWorkerApi } from "./worker-api";
import executeSource from "./runtime/execute.py?raw";

let runtime: Awaited<ReturnType<typeof defaultPyodideLoader>> | undefined;
let activeRunId: string | undefined;

async function initializeRuntime(): Promise<{ state: "ready"; runtimeVersion: string }> {
  if (runtime) return { state: "ready" as const, runtimeVersion: runtime.version };
  runtime = await defaultPyodideLoader("314.0.3");
  initPyodide(runtime);
  await runtime.runPythonAsync(executeSource);
  return { state: "ready" as const, runtimeVersion: runtime.version };
}
const initialize = pyodideExpose(async (_extras): Promise<{ state: "ready"; runtimeVersion: string }> => initializeRuntime());

const run = pyodideExpose(async (extras, request: RunRequest): Promise<RunResult> => {
  await initializeRuntime();
  runtime!.setInterruptBuffer(extras.interruptBuffer);
  activeRunId = request.runId;
  const value = runtime!.toPy(request);
  runtime!.globals.set("__runner_request__", value);
  try {
    return JSON.parse(String(await runtime!.runPythonAsync("import json; json.dumps(execute_request(__runner_request__))"))) as RunResult;
  } finally {
    value.destroy();
    runtime!.globals.delete("__runner_request__");
    activeRunId = undefined;
  }
});
```

Worker API 必须为 `Comlink.expose({ initialize, run, interrupt: async (runId) => { if (runId !== activeRunId) return; } } satisfies PythonWorkerApi)`。`run` 必须经 `pyodideExpose(async (extras, request) => ...)` 获取 `extras.interruptBuffer` 并调用 `runtime.setInterruptBuffer(extras.interruptBuffer)`；不得把 pyodide 实例传给 `pyodideExpose`。`client.interrupt()` 写入同一共享缓冲区，循环由 Pyodide 抛出 `KeyboardInterrupt`，Python helper 映射为 `interrupted`。任何初始化、RPC 或 Pyodide 致命错误都由 Adapter 终止该 Worker 与 `PyodideClient`，再以新 Worker 工厂重建，避免把 fatal 状态留在同一运行时。

- [ ] **Step 3: 把默认 Worker 工厂接入适配器并处理致命重载**

在 `adapter.ts` 的默认构造路径写入：

```ts
import { PyodideClient } from "pyodide-worker-runner";

const createWorker = () => new Worker(new URL("./python.worker.ts", import.meta.url), { type: "module" });
const createClient = (workerFactory: () => Worker): PythonWorkerClient => new PyodideClient(workerFactory) as unknown as PythonWorkerClient;
```

保留 Task 3 注入的 factory 以供 fake 测试。`client.call` 的致命拒绝进入 `restarting`，Adapter 立即调用当前 `client.terminate()`、清除 `activeRun`、丢弃 client，并通过 `ensureClient()` 建立新 Worker/Client；重建完成回到 `ready`，重建失败进入 `unavailable`。不要包装 `PyodideClient`，不要捕获后静默转为 `completed`，不要在主线程执行 Python。

- [ ] **Step 4: 运行 Worker、适配器和浏览器回归**

运行：

```bash
npm --prefix rpg run test -- src/runners/python/adapter.test.ts
npm --prefix rpg run build
npm --prefix rpg run e2e -- e2e/runner-proof.spec.ts
```

预期：全部 PASS。检查 Worker 返回的诊断不含 `C:\\`、`/Users/`、环境变量格式或 Pyodide 内部栈；不合法 Python 返回值只产生 `RETURN_NOT_SERIALIZABLE`。

- [ ] **Step 5: 提交正式 Worker 任务**

```bash
git add rpg/src/runners/python/python.worker.ts rpg/src/runners/python/adapter.ts rpg/e2e/runner-proof.spec.ts
git commit -m "feat: run python strategies in worker"
```

### Task 7: 固化协议、隔离和恢复的浏览器验收矩阵

**Files:**
- Modify: `rpg/e2e/runner-proof.spec.ts`
- Modify: `rpg/src/runners/protocol/validate-request.test.ts`
- Modify: `rpg/src/runners/python/adapter.test.ts`
- Modify: `rpg/src/runners/python/runtime/execute.test.ts`

**Interfaces:**
- Consumes: Task 1--6 的全部公开接口。
- Produces: 可作为发布前 runner 质量门的确定性测试集；不新增生产 API。


- [ ] **Step 1: 写入失败的协议、恢复和浏览器验收用例**

以下四段代码分别放入各自文件；每段含自身 imports、fixture 或 helper，不依赖阅读其他测试文件：

`rpg/src/runners/protocol/validate-request.test.ts`
```ts
import { expect, it } from "vitest";
import { worldViewFixture } from "../../game/combat/fixtures";
import { validateRunRequest } from "./validate-request";
const valid = { protocolVersion: 1, runId: "run-validate", attemptId: "attempt-validate", questId: "python-marsh-03", language: "python", files: { "main.py": "pass" }, entrypoint: { file: "main.py", callable: "choose_turn" }, worldView: worldViewFixture, allowedModules: [], limits: { timeoutMs: 2_000, interruptGraceMs: 250, maxFiles: 8, maxFileBytes: 16_384, maxSourceBytes: 65_536, maxOutputBytes: 16_384, maxTraceEvents: 1_000, maxValueDepth: 3 } };
it("协议拒绝零 value depth 和非法路径", () => {
  expect(validateRunRequest({ ...valid, limits: { ...valid.limits, maxValueDepth: 0 } })).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_LIMIT" }] });
  expect(validateRunRequest({ ...valid, files: { "/main.py": "pass" } })).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_FILE_PATH" }] });
});
```

`rpg/src/runners/python/runtime/execute.test.ts`
```ts
import { expect, it } from "vitest";
it("语法错误、无输出和返回深度限制具有稳定结果", async () => {
  await expect(run({ ...baseRequest, files: { "main.py": "def choose_turn(" } })).resolves.toMatchObject({ executionStatus: "syntax_error", diagnostics: [{ code: "PYTHON_SYNTAX_ERROR", location: { file: "main.py", line: 1 } }] });
  await expect(run({ ...baseRequest, files: { "main.py": "def choose_turn(world): return {'action': {'type': 'wait'}}" } })).resolves.toMatchObject({ executionStatus: "completed", streams: { stdout: "", stderr: "", truncated: false } });
  await expect(run({ ...baseRequest, limits: { ...baseRequest.limits, maxValueDepth: 2 }, files: { "main.py": "def choose_turn(world): return {'a': {'b': {'c': 1}}}" } })).resolves.toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "RETURN_NOT_SERIALIZABLE" }] });
});
```

`rpg/src/runners/python/adapter.test.ts`
```ts
import { expect, it, vi } from "vitest";
it("硬超时与单飞 runId 不覆盖当前运行", async () => {
  vi.useFakeTimers(); const never = new Promise<never>(() => undefined); const first = fakeClient(vi.fn().mockReturnValue(never)); const second = fakeClient();
  const runner = new PythonRunnerAdapter({ createWorker: vi.fn(), createClient: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second) });
  const pending = runner.run({ ...request, runId: "run-timeout", limits: { ...request.limits, timeoutMs: 10, interruptGraceMs: 50 } });
  await expect(runner.run({ ...request, runId: "run-rejected" })).resolves.toMatchObject({ executionStatus: "invalid_request", diagnostics: [{ code: "RUN_IN_PROGRESS" }] });
  await vi.advanceTimersByTimeAsync(10); await expect(pending).resolves.toMatchObject({ executionStatus: "timeout", runId: "run-timeout", diagnostics: [{ code: "HARD_TIMEOUT" }] }); expect(first.terminate).toHaveBeenCalledOnce();
});
```

`rpg/e2e/runner-proof.spec.ts`
```ts
import { expect, test } from "@playwright/test";
test("真实浏览器重建后继续可运行", async ({ page }) => {
  await page.goto("/tools/runner-proof/"); await page.evaluate(() => window.runnerProof.load());
  await expect(page.evaluate(() => window.runnerProof.hardTimeout("while True: pass", 200))).resolves.toMatchObject({ status: "timeout", rebuilt: true });
  await expect(page.evaluate(() => window.runnerProof.execute("40 + 2"))).resolves.toEqual(42);
});
```

运行：`npm --prefix rpg run test`

运行：`npm --prefix rpg run e2e -- e2e/runner-proof.spec.ts`

预期：新增用例在对应 Task 2--6 的行为尚未完整时 FAIL。


- [ ] **Step 2: 写入确定的返回值和不可用 Worker 映射**

在 `execute.py` 入口结果处理处写入：

```python
try:
    return_value = json_value(value, 0, request["limits"]["maxValueDepth"])
except ReturnNotSerializable:
    return runtime_error_result(request, "RETURN_NOT_SERIALIZABLE", "入口函数必须返回 JSON 值。", started)
```

在 `adapter.ts` 的 Worker 初始化/重建失败分支写入：

```ts
return { protocolVersion: 1, runId: request.runId, attemptId: request.attemptId, executionStatus: "runner_error", trace: [], diagnostics: [{ code: "RUNNER_UNAVAILABLE", severity: "error", message: "Python 运行器当前不可用。", recoveryAction: "检查浏览器支持后重试，或继续使用手动回合。" }], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 0, traceEvents: 0 } };
```

上述分支保留代码草稿，不生成答案或自动通过。分别运行：`npm --prefix rpg run test -- src/runners/python/runtime/execute.test.ts`、`npm --prefix rpg run test -- src/runners/python/adapter.test.ts`、`npm --prefix rpg run e2e -- e2e/runner-proof.spec.ts`。预期全部 PASS。

- [ ] **Step 3: 运行最终确定性验证**

```bash
npm --prefix rpg run test
npm --prefix rpg run build
npm --prefix rpg run e2e
git diff --check
```

预期：Vitest、TypeScript/Vite、Playwright 和空白差异检查全部 PASS。浏览器套件必须实际运行 Task 1 的六项兼容性断言和正式适配器用例，不得用 mock 替代 SharedArrayBuffer 或 Worker 重建。

- [ ] **Step 4: 提交验收矩阵**

```bash
git add rpg/e2e/runner-proof.spec.ts rpg/src/runners/protocol/validate-request.test.ts rpg/src/runners/python/adapter.test.ts rpg/src/runners/python/runtime/execute.test.ts
git commit -m "test: cover python runner safety and recovery"
```

## 实施后自审

- [ ] **协议边界：** `RunResult.returnValue` 保持 `JsonValue`，没有任何 Runner 文件把它当作 `TurnCommand` 或决定 `accepted`、`won`、`lost`。
- [ ] **兼容性证伪门：** Playwright 同时证明加载、执行、`SharedArrayBuffer` 中断、硬超时重建、多文件导入和连续运行隔离；任一失败已停止本计划并记录固定格式证据。
- [ ] **安全轨迹：** 仅玩家文件四类事件；不调用任意 `repr`、描述符或私有属性；字符串 200、集合 20、深度 3；达到条数预算返回 `TRACE_LIMIT_REACHED`。
- [ ] **隔离和恢复：** 每次调用新目录/模块命名空间；主动中断调用 `client.interrupt()`；硬超时执行 Worker 终止和重建；默认拒绝 `js`、`pyodide`、`micropip`、网络及进程模块。
- [ ] **占位符扫描：** 对本计划执行 `node -e "const p='docs/superpowers/plans/2026-08-10-python-rpg-python-runner.md'; const x=require('node:fs').readFileSync(p,'utf8'); const a=['TO'+'DO','TB'+'D','implement'+' later','fill in'+' details','适当'+'处理','类似'+' Task']; if(a.some(v=>x.includes(v))) process.exit(1)"`，预期退出码为 `0`。
- [ ] **接口一致性：** 核对 `RunRequest`、`RunResult`、`PythonWorkerApi`、`PythonWorkerClient`、`PythonRunnerAdapter` 的参数和返回类型在 Task 2--7 完全一致；核对依赖版本只出现 `314.0.3`、`1.4.0`、`0.0.9`、`4.4.2`。
