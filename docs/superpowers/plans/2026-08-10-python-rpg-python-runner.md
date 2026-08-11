# Python RPG 本地 CPython Runner 与统一执行协议 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Python 战役提供可验证的本地 CPython 执行器：游戏前端通过本地 Node 守护服务连接常驻 Python 子进程，后者接收版本化的 JSON 请求，隔离执行多文件 Python 策略，返回不含战斗语义的 JSON 结果和安全代码轨迹，并能可靠中断、超时重建及报告失败。

**Architecture:** 前端通过 WebSocket 连本地 Node 守护服务（`localhost:5175`）；Node 守护服务 spawn 一个常驻 Python 子进程，Python 子进程 `import execute` 暴露 `execute_request`；Node 通过 stdin/stdout JSON-lines 与 Python 通信；`PythonRunnerAdapter` 管理状态机和硬超时重建；`WorldView` 与 `TurnCommand` 的游戏语义始终由战斗内核承担。本计划替代原"浏览器 Pyodide Worker"方向，规避浏览器沙箱与远程代码执行的安全审查风险，改用"信任本地代码"模型。

**Tech Stack:** Node.js 24.15.0（由 fnm 和仓库根 `.node-version` 固定）、TypeScript 7.0.2、Vite 8.2.1、Vitest 4.1.10、jsdom 30.0.1、Playwright 1.62.1、用户本机 CPython 3.12+（仅标准库）、`ws@8.18.0`（Node 端 WebSocket 服务端，精确固定）。

## Global Constraints

- `rpg/package.json`、`rpg/tsconfig.json` 与 `rpg/vite.config.ts` 已由战斗计划创建；本计划只增量合并依赖和脚本，使用 `npm --prefix rpg install` 更新既有锁文件，不得删除或重建锁文件，不得降级阶段 1 已固定的 TypeScript/Vite/Vitest/jsdom/Playwright。
- 直接依赖只新增 `ws@8.18.0`（Node 端 WebSocket 服务端）；**不得引入** `pyodide`、`pyodide-worker-runner`、`comsync`、`comlink` 或任何浏览器 Worker 栈依赖。`ws` 只在 Node 守护服务侧使用，不进入浏览器构建产物。
- 不得引入 `SharedArrayBuffer`、COOP/COEP 响应头或浏览器 Worker 中断缓冲区机制；中断通过 Node `child_process` 的 `SIGINT` 与硬超时 `kill` 实现。
- 协议版本固定为 `1`，Node 守护服务与 Python 子进程之间只收发可 JSON 序列化的 stdin/stdout JSON-lines，绝不传递文件描述符、DOM、存储对象或游戏内核实例。
- `WorldView`、`TurnCommand` 必须从 `rpg/src/game/combat/types.ts` 导入；Runner 只返回 JSON 值，游戏内核负责 `TurnCommand` 解析、合法性、`CommandResolution` 和关卡结果。
- 适配器状态只能是 `loading`、`ready`、`running`、`interrupting`、`restarting`、`unavailable`。主动中断先发 `SIGINT` 并等待最多 `interruptGraceMs` 返回 `interrupted`，该等待到期才 `kill` 并重建；硬超时从 `run()` 开始计时，到达 `timeoutMs` 立即 `kill` 并重建，不等待 grace。
- 每次运行使用独立 `tempfile` 目录和新的模块命名空间，不继承变量、导入缓存、标准输出或标准错误。默认拒绝 `js`、`socket`、`ssl`、`http`、`urllib`、`subprocess`、`multiprocessing`、`ctypes`、`webbrowser` 等模块，不允许基于源码安装包。
- 所有请求都受文件数、单文件、源码总量、输出和轨迹预算约束；轨迹只记录玩家文件 `call`、`line`、`return`、`exception`，字符串 200 字符、集合 20 项、深度 3，轨迹预算耗尽必须以 `runtime_error` / `TRACE_LIMIT_REACHED` 结束。
- 本地运行器只是稳定性边界，不是对抗恶意代码的安全沙箱；玩家在本机运行自己的代码，`execute.py` 的模块白名单和 `SAFE_BUILTINS` 防的是"误操作"而非"恶意攻击"。同源前端不得暴露秘密或特权令牌。
- 用户本机必须预装 CPython 3.12+；游戏首次启动检测 `python3` / `python` 解释器路径并校验版本，检测失败时明确告知用户安装链接，不静默降级或伪装就绪。

## 复用决策（来自 `feature/python-runner` 分支盘点）

调研日期为 2026-08-11，基于 `feature/python-runner` 分支与 `master` 的差异盘点：

| 资产 | 处置 | 理由 |
|---|---|---|
| `rpg/src/runners/protocol/types.ts` | ✅ 完整 cherry-pick | 语言无关的协议契约（`RunRequest`/`RunResult`/`RunnerState`/`ExecutionStatus`/`TraceEvent`/`RunnerDiagnostic`/`ExecutionLimits`），本地运行器同样需要 |
| `rpg/src/runners/protocol/validate-request.ts` + `.test.ts` | ✅ 完整 cherry-pick | 不依赖 Python 的请求运行时校验和稳定诊断码 |
| `rpg/src/runners/python/runtime/execute.py` + `execute.test.ts` | ✅ **核心 cherry-pick** | 纯 CPython 隔离执行器（`tempfile` + `sys.modules` 快照恢复 + `sys.meta_path` 注入 `RestrictedPlayerLoader` + `guarded_import` + `sys.settrace` + `safe_value`/`json_value`），本地方案的本体；原计划借 Pyodide 跑它，本地方案直接用 CPython 跑它，才是其本来形态 |
| `rpg/src/game/testing/fixture.ts`（新增 `worldViewFixture` 导出） | ✅ cherry-pick 该改动 | Runner 协议测试所需 |
| `.gitignore` / `.node-version` / `engines.node` | ✅ cherry-pick | 工程基线 |
| `rpg/src/runners/python/python.worker.ts` | ❌ 丢弃 | 整文件是 `defaultPyodideLoader`/`initPyodide`/`pyodideExpose`/`runPythonAsync`/`toPy`，Pyodide Worker 专属 |
| `rpg/src/runners/python/worker-api.ts` | ❌ 丢弃 | `PythonWorkerApi`/`PythonWorkerClient` 围绕 Comlink + Worker + PyodideClient 设计，本地要重写为 `LocalRunnerChannel` |
| `rpg/src/runners/python/adapter.ts` | ⚠️ 丢弃实现，保留状态机概念 | 强依赖 `PyodideClient` + `SharedArrayBuffer` 中断 + Worker terminate/rebuild。`loading/ready/running/interrupting/restarting/unavailable` 状态机概念移植到子进程管理，实现重写 |
| `rpg/src/runners/python/adapter.test.ts` | ⚠️ 大部分丢弃 | 强耦合 Worker 工厂注入 + PyodideClient mock + 代际重建。少量断言（状态迁移、并发拒绝、dispose）可移植到新 adapter |
| `rpg/tools/runner-proof/` 整个目录 | ❌ 丢弃 | 浏览器 Pyodide 兼容性证明页，本地方案不需要 |
| `rpg/e2e/runner-proof.spec.ts` | ❌ 丢弃 | Playwright 在 Chromium 里验 Pyodide；改为 Node child_process 集成测试 |
| `rpg/playwright.config.ts` | ⏸️ 延后到阶段 3 | 阶段 3 应用外壳浏览器 E2E 仍需要，阶段 2 不需要 |
| `package.json` 依赖 | ❌ 丢 `pyodide`/`pyodide-worker-runner`/`comsync`/`comlink`；✅ 留 `engines.node` + 阶段 1 全部；新增 `ws@8.18.0` | 浏览器 Worker 栈整体退场 |
| `rpg/vite.config.ts` 的 COOP/COEP 改动 | ❌ 丢弃 | 为 SharedArrayBuffer 中断缓冲区设的响应头，本地不需要 |
| `rpg/tsconfig.json` 的 include 扩展 | ✅ 保留 | tools/e2e 范围扩展本身无害 |

**一句话**：`runners/protocol/*` 和 `runners/python/runtime/execute.py` 是净赚，其余 Pyodide/Worker 胶水层全部退场，`adapter` 重写。

---

## 文件结构

| 路径 | 职责 |
|---|---|
| `rpg/package.json`、`rpg/vite.config.ts`、`rpg/tsconfig.json` | 在战斗计划支架上合并 `ws` 依赖、Node 守护服务脚本和 `vite/client` 类型；不引入任何浏览器 Worker 栈。 |
| `rpg/src/runners/protocol/types.ts` | cherry-pick：协议版本、JSON 数据、请求/结果/诊断/限制和适配器公共类型。 |
| `rpg/src/runners/protocol/validate-request.ts` + `.test.ts` | cherry-pick：不依赖 Python 的请求运行时校验和稳定诊断码。 |
| `rpg/src/runners/python/runtime/execute.py` + `execute.test.ts` | cherry-pick：纯 CPython 隔离执行器，本地方案的本体。 |
| `rpg/src/runners/python/runtime/daemon.py` | **新建**：常驻 Python 进程入口，读 stdin JSON-lines、调 `execute_request`、写 stdout JSON-lines、捕获 `KeyboardInterrupt` 返回 `interrupted`。 |
| `rpg/src/runners/local/channel.ts` | **新建**：`LocalRunnerChannel` 接口，替代原 `worker-api.ts`；定义 `spawn`/`send`/`interrupt`/`kill`/`onMessage`/`onExit` 契约，不泄漏 Node `child_process` 对象。 |
| `rpg/src/runners/local/python-bridge.ts` + `.test.ts` | **新建**：`PythonBridge`，基于 `child_process.spawn` 管理常驻 Python 子进程，实现 JSON-lines 通信、`SIGINT` 中断、硬超时 `kill` 重建。 |
| `rpg/src/runners/local/adapter.ts` + `.test.ts` | **重写**：`PythonRunnerAdapter`，状态机概念保留（`loading/ready/running/interrupting/restarting/unavailable`），底层换成 `LocalRunnerChannel`；并发拒绝、`dispose`、重建逻辑。 |
| `rpg/src/runners/local/node-server.ts` + `.test.ts` | **新建**：Node 守护服务，`ws@8.18.0` 监听 `localhost:5175`，转发前端 WebSocket 请求到 `PythonRunnerAdapter`，暴露连接状态事件。 |
| `rpg/src/runners/local/python-detector.ts` + `.test.ts` | **新建**：检测用户本机 `python3`/`python` 解释器路径并校验版本 ≥ 3.12，失败时返回稳定诊断码和安装链接。 |
| `rpg/src/game/testing/fixture.ts` | cherry-pick `worldViewFixture` 导出。 |
| `rpg/e2e/local-runner.spec.ts` | **新建**：Node 集成测试，端到端验证前端 → WebSocket → Node → Python → `execute_request` → 结果回传；替代原 `runner-proof.spec.ts`。 |

## 依赖顺序

1. Task 1 的工程基线和 Python 检测必须通过并提交，才可开始 Task 2--7。
2. Task 2 依赖战斗计划已导出 `WorldView`、`TurnCommand`；cherry-pick 协议层并新增 `LocalRunnerChannel` 契约。
3. Task 3 依赖 Task 2 的 `LocalRunnerChannel`；Task 4 依赖 Task 3 的 `PythonBridge`。
4. Task 5 依赖 Task 3；验证 `execute.py` 在常驻进程模式下的隔离。
5. Task 6 依赖 Task 4；Task 7 依赖 Task 1--6 全部单元测试通过。

## 预检修正规则

以下规则基于阶段 1 基线 `master@8ef1f97` 和 `feature/python-runner` 分支盘点得出，优先于后文示例草稿；实现和审查必须按本节收敛，不得机械复制相冲突的片段。

- 工具链固定为 fnm 管理的 Node `24.15.0`、TypeScript `7.0.2`、Vite `8.2.1`、Vitest `4.1.10`、jsdom `30.0.1` 和 Playwright `1.62.1`。仓库根目录跟踪 `.node-version`，`rpg/package.json` 声明 `engines.node` 为 `24.15.0`；不得降级阶段 1 的精确依赖。
- `rpg/tsconfig.json` 必须保留既有严格选项和 `skipLibCheck`，并显式覆盖 `src`、`vite.config.ts` 和 `vite/client` 类型；新增的 `runners/local/*` 必须通过 `noUnusedLocals`。
- `LocalRunnerChannel` 只在 `runners/local/channel.ts` 定义一次，`PythonBridge` 和测试共同导入该接口；不得在 adapter 里直接引用 `child_process` 类型。
- `PythonBridge` 的硬超时必须调用 `subprocess.kill()`（先 `SIGINT` 再 `SIGKILL`），再 spawn 全新子进程；代际计数证明实际重建，不得只重置 stdin/stdout 流而绕过进程重建。
- Task 5 的隔离断言必须连续运行两组同名 `helper.py` 且值不同，并证明第二次不读取第一次遗留的 `sys.modules` 项；仅检查入口脚本全局变量不算隔离证明。`execute.py` 已有的 `sys.modules` 快照恢复 + `tempfile` + `meta_path` 重置必须覆盖此场景。
- Task 4 的请求快照若要承诺不可变，必须递归冻结或使用只读值对象；单独 `structuredClone()` 只能证明与调用方断开别名，文档不得把它描述成不可变。
- Task 4 在首次 `ensureBridge()` 的第一个异步边界前就必须登记同一个初始化 Promise，保证并发调用只创建一次子进程；`dispose()`、初始化失败和重建失败都必须让全部等待者以稳定诊断结束，不能留下悬挂 Promise。
- Task 6 的 `ws@8.18.0` 只在 Node 守护服务侧使用，浏览器构建产物不得包含 `ws`；前端通过原生 `WebSocket` 连 `localhost:5175`，不引入额外前端 WebSocket 库。
- Task 7 的端到端测试必须在真实 Node 进程中 spawn 真实 Python 子进程，不得 mock `child_process`；Python 不可用时测试跳过并标记原因，不得伪装通过。

---

### Task 1: 本地运行器工程基线与 Python 检测

**Files:**
- Modify: `rpg/package.json`（新增 `ws@8.18.0` 依赖、`runner` 和 `runner:dev` 脚本、`engines.node`）
- Modify: `rpg/tsconfig.json`（确认 `src` 覆盖 `runners/local/*`）
- Create: `rpg/src/runners/local/python-detector.ts`、`rpg/src/runners/local/python-detector.test.ts`
- Create: `rpg/src/runners/python/runtime/daemon.py`（常驻进程入口骨架，先空实现 `execute_request` 转发）

**Interfaces:**
- Produces: `detectPython(): Promise<PythonDetection>`，其中 `PythonDetection = { ok: true; path: string; version: string } | { ok: false; code: "PYTHON_NOT_FOUND" | "PYTHON_VERSION_TOO_LOW"; message: string }`。
- Produces: `daemon.py` 的 stdin/stdout JSON-lines 循环骨架，每行一个 `RunRequest` 进、一个 `RunResult` 出；`KeyboardInterrupt` 返回 `interrupted`。

- [ ] **Step 1: 写失败测试**

```ts
// rpg/src/runners/local/python-detector.test.ts
import { describe, expect, it } from "vitest";
import { detectPython } from "./python-detector";

describe("python detector", () => {
  it("finds a python interpreter at version 3.12 or higher", async () => {
    const result = await detectPython();
    if (result.ok) {
      expect(result.path).toMatch(/python/);
      const [major, minor] = result.version.split(".").map(Number);
      expect(major).toBeGreaterThanOrEqual(3);
      if (major === 3) expect(minor).toBeGreaterThanOrEqual(12);
    } else {
      expect(result.code).toMatch(/^PYTHON_NOT_FOUND$|^PYTHON_VERSION_TOO_LOW$/);
    }
  });
});
```

```py
# rpg/src/runners/python/runtime/daemon.py（骨架）
import json
import sys
import time

# execute_request 在 Task 5 接线后从 execute.py 导入；此处先占位
def execute_request(request):
    return {"protocolVersion": 1, "runId": request["runId"], "attemptId": request["attemptId"],
            "executionStatus": "completed", "returnValue": None, "returnValueTraceSeq": None,
            "trace": [], "diagnostics": [], "streams": {"stdout": "", "stderr": "", "truncated": False},
            "metrics": {"durationMs": 0, "traceEvents": 0}}

def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            started = time.perf_counter()
            result = execute_request(request)
        except KeyboardInterrupt:
            result = {"protocolVersion": 1, "runId": request.get("runId", ""), "attemptId": request.get("attemptId", ""),
                      "executionStatus": "interrupted", "returnValue": None, "returnValueTraceSeq": None,
                      "trace": [], "diagnostics": [{"code": "INTERRUPTED", "severity": "info", "message": "Python 运行已中断。", "recoveryAction": "修改代码后重新运行"}],
                      "streams": {"stdout": "", "stderr": "", "truncated": False}, "metrics": {"durationMs": 0, "traceEvents": 0}}
        sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 确认失败**
Run: `npm --prefix rpg test -- src/runners/local/python-detector.test.ts`
Expected: FAIL，检测器模块不存在。

- [ ] **Step 3: 写检测器和守护入口**

`detectPython` 依次尝试 `python3`、`python`，执行 `--version` 解析版本；低于 3.12 返回 `PYTHON_VERSION_TOO_LOW`，全部找不到返回 `PYTHON_NOT_FOUND`。`daemon.py` 按 Step 1 骨架实现 stdin 循环。

运行：`npm --prefix rpg install ws@8.18.0 --save`
运行：`npm --prefix rpg ls ws`
预期：`ws@8.18.0` 精确显示。

`package.json` 的 `scripts` 新增：
```json
"runner": "node --experimental-vm-modules src/runners/local/node-server.ts",
"runner:dev": "node --watch src/runners/local/node-server.ts"
```

- [ ] **Step 4: 验证**
Run: `npm --prefix rpg run build`
Expected: PASS（`tsc --noEmit` 通过，`ws` 不进入浏览器构建）。
Run: `npm --prefix rpg test -- src/runners/local/python-detector.test.ts`
Expected: PASS（本机有 Python 3.12+ 时 ok，否则返回稳定诊断码）。
Run: `python3 rpg/src/runners/python/runtime/daemon.py <<< '{"protocolVersion":1,"runId":"r1","attemptId":"a1","files":{},"entrypoint":{"file":"","callable":""},"worldView":{},"allowedModules":[],"limits":{"timeoutMs":1000,"interruptGraceMs":200,"maxFiles":10,"maxFileBytes":65536,"maxSourceBytes":65536,"maxOutputBytes":16384,"maxTraceEvents":1000,"maxValueDepth":3},"questId":"q","language":"python"}'`
Expected: 输出一行 JSON，`executionStatus` 为 `completed`。

- [ ] **Step 5: 提交**
```bash
git add rpg/package.json rpg/package-lock.json rpg/tsconfig.json rpg/src/runners/local/python-detector.ts rpg/src/runners/local/python-detector.test.ts rpg/src/runners/python/runtime/daemon.py
git commit -m "feat: scaffold local cpython runner baseline"
```

### Task 2: 协议层迁移与 LocalRunnerChannel 契约

**Files:**
- Cherry-pick from `feature/python-runner`: `rpg/src/runners/protocol/types.ts`、`rpg/src/runners/protocol/validate-request.ts`、`rpg/src/runners/protocol/validate-request.test.ts`
- Cherry-pick from `feature/python-runner`: `rpg/src/game/testing/fixture.ts` 的 `worldViewFixture` 导出
- Create: `rpg/src/runners/local/channel.ts`、`rpg/src/runners/local/channel.test.ts`

**Interfaces:**
- Consumes: 阶段 1 的 `WorldView`、`TurnCommand`（从 `combat/types.ts` 导入）。
- Produces: `LocalRunnerChannel` 接口。

```ts
// rpg/src/runners/local/channel.ts
import type { RunRequest, RunResult } from "../protocol/types";

export interface LocalRunnerChannel {
  readonly generation: number;
  onMessage: ((result: RunResult) => void) | undefined;
  onExit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
  send(request: RunRequest): boolean;
  interrupt(): void;
  kill(): void;
  readonly pid: number | undefined;
}

export interface LocalRunnerChannelFactory {
  create(pythonPath: string, daemonScript: string): LocalRunnerChannel;
}
```

- [ ] **Step 1: 写失败测试**

```ts
// rpg/src/runners/local/channel.test.ts
import { describe, expect, it } from "vitest";
import type { LocalRunnerChannel } from "./channel";

describe("local runner channel contract", () => {
  it("defines a generation counter and lifecycle hooks", () => {
    const stub: LocalRunnerChannel = {
      generation: 0,
      onMessage: undefined,
      onExit: undefined,
      send: () => false,
      interrupt: () => undefined,
      kill: () => undefined,
      pid: undefined,
    };
    expect(stub.generation).toBe(0);
    expect(typeof stub.send).toBe("function");
    expect(typeof stub.interrupt).toBe("function");
    expect(typeof stub.kill).toBe("function");
  });
});
```

- [ ] **Step 2: 确认失败**
Run: `npm --prefix rpg test -- src/runners/local/channel.test.ts`
Expected: FAIL，`channel.ts` 不存在。

- [ ] **Step 3: cherry-pick 协议层并写 channel 契约**

```bash
git checkout feature/python-runner -- rpg/src/runners/protocol/types.ts rpg/src/runners/protocol/validate-request.ts rpg/src/runners/protocol/validate-request.test.ts
```

`fixture.ts` 合并 `worldViewFixture` 导出（手动应用 diff，不整文件 checkout 以保留阶段 1 内容）。
`channel.ts` 按 Step 1 接口实现；`channel.test.ts` 验证契约形状。

- [ ] **Step 4: 验证**
Run: `npm --prefix rpg run build`
Expected: PASS。
Run: `npm --prefix rpg test -- src/runners/protocol/validate-request.test.ts src/runners/local/channel.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**
```bash
git add rpg/src/runners/protocol/ rpg/src/runners/local/channel.ts rpg/src/runners/local/channel.test.ts rpg/src/game/testing/fixture.ts
git commit -m "feat: migrate runner protocol and define local channel contract"
```

### Task 3: PythonBridge — 常驻子进程与 JSON-lines 通信

**Files:**
- Create: `rpg/src/runners/local/python-bridge.ts`、`rpg/src/runners/local/python-bridge.test.ts`

**Interfaces:**
- Produces: `PythonBridge`，实现 `LocalRunnerChannel`，基于 `child_process.spawn` 管理常驻 Python 子进程。

```ts
export interface PythonBridgeOptions {
  readonly pythonPath: string;
  readonly daemonScript: string;
  readonly startupTimeoutMs?: number;
}

export class PythonBridge implements LocalRunnerChannel {
  constructor(options: PythonBridgeOptions);
  get generation(): number;
  get pid(): number | undefined;
  set onMessage(handler: ((result: RunResult) => void) | undefined);
  set onExit(handler: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined);
  send(request: RunRequest): boolean;
  interrupt(): void;     // 发 SIGINT
  kill(): void;          // 发 SIGKILL，进程退出后 generation 自增
  waitReady(): Promise<void>;  // 等待 daemon.py 首行 ready 信号
}
```

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { PythonBridge } from "./python-bridge";
import { detectPython } from "./python-detector";
import path from "node:path";

describe("python bridge", () => {
  it("spawns a daemon, exchanges a request, and returns a result", async () => {
    const detection = await detectPython();
    if (!detection.ok) return; // 本机无 Python 时跳过
    const bridge = new PythonBridge({
      pythonPath: detection.path,
      daemonScript: path.join(__dirname, "../python/runtime/daemon.py"),
    });
    await bridge.waitReady();
    let received: RunResult | undefined;
    bridge.onMessage = (result) => { received = result; };
    bridge.send({ protocolVersion: 1, runId: "r1", attemptId: "a1", /* ...完整字段 */ } as RunRequest);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(received?.runId).toBe("r1");
    bridge.kill();
  }, 10000);
});
```

- [ ] **Step 2: 确认失败**
Run: `npm --prefix rpg test -- src/runners/local/python-bridge.test.ts`
Expected: FAIL，`PythonBridge` 不存在。

- [ ] **Step 3: 写 spawn 与 JSON-lines 通信**

`PythonBridge` 用 `child_process.spawn(pythonPath, [daemonScript], { stdio: ["pipe", "pipe", "pipe"] })`；stdin 写 `JSON.stringify(request) + "\n"`；stdout 按行分割 `JSON.parse`；`interrupt()` 发 `SIGINT`；`kill()` 发 `SIGKILL` 并在 `exit` 事件中 `generation++`。`waitReady()` 等 daemon.py 启动后写入的 `{"ready": true}` 首行。

- [ ] **Step 4: 验证**
Run: `npm --prefix rpg run build`
Expected: PASS。
Run: `npm --prefix rpg test -- src/runners/local/python-bridge.test.ts`
Expected: PASS（本机有 Python 时端到端通信成功，无 Python 时跳过）。

- [ ] **Step 5: 提交**
```bash
git add rpg/src/runners/local/python-bridge.ts rpg/src/runners/local/python-bridge.test.ts
git commit -m "feat: bridge local cpython via json-lines"
```

### Task 4: PythonRunnerAdapter 重写 — 状态机与硬超时重建

**Files:**
- Create: `rpg/src/runners/local/adapter.ts`、`rpg/src/runners/local/adapter.test.ts`

**Interfaces:**
- Produces: `PythonRunnerAdapter`，状态机 `loading/ready/running/interrupting/restarting/unavailable`，并发拒绝、`dispose`、硬超时 `kill` 重建。

```ts
export interface PythonRunnerAdapterDependencies {
  readonly createChannel: () => LocalRunnerChannel;
  readonly setTimeoutFn?: TimerStarter;
  readonly clearTimeoutFn?: TimerClearer;
}

export class PythonRunnerAdapter {
  constructor(dependencies: PythonRunnerAdapterDependencies);
  get state(): RunnerState;
  onStateChange(listener: (state: RunnerState) => void): () => void;
  run(request: RunRequest): Promise<RunResult>;
  interrupt(runId: string): Promise<void>;
  dispose(): void;
}
```

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it, vi } from "vitest";
import { PythonRunnerAdapter } from "./adapter";
import type { LocalRunnerChannel } from "./channel";
import type { RunRequest, RunResult } from "../protocol/types";

function stubChannel(generation: number): LocalRunnerChannel {
  return {
    generation, pid: 1000 + generation,
    onMessage: undefined, onExit: undefined,
    send: vi.fn(() => true), interrupt: vi.fn(), kill: vi.fn(),
  };
}

describe("adapter", () => {
  it("rejects concurrent runs and disposes cleanly", async () => {
    let gen = 0;
    const adapter = new PythonRunnerAdapter({ createChannel: () => stubChannel(gen++) });
    const req = { runId: "r1", /* ... */ } as unknown as RunRequest;
    const p1 = adapter.run(req);
    const r2 = await adapter.run({ ...req, runId: "r2" } as RunRequest);
    expect(r2.executionStatus).toBe("invalid_request");
    expect(r2.diagnostics[0].code).toBe("RUN_IN_PROGRESS");
    adapter.dispose();
  });

  it("rebuilds channel after hard timeout kills the process", async () => {
    // 注入会触发硬超时的 mock channel，验证 kill 后 generation 自增并 spawn 新 channel
  });
});
```

- [ ] **Step 2: 确认失败**
Run: `npm --prefix rpg test -- src/runners/local/adapter.test.ts`
Expected: FAIL，`adapter.ts` 不存在。

- [ ] **Step 3: 写状态机和重建逻辑**

`run()` 校验请求（复用 `validateRunRequest`）、检查 `disposed`/`active`、`ensureBridge()`、设 `running` 状态、`send()`、启动硬超时定时器；收到结果清除定时器并返回；`interrupt()` 发 `SIGINT`，等 `interruptGraceMs`，到期 `kill()` 并重建；硬超时直接 `kill()` 并重建。`dispose()` 清所有定时器、`kill()` 当前 channel、置 `unavailable`。

- [ ] **Step 4: 验证**
Run: `npm --prefix rpg run build`
Expected: PASS。
Run: `npm --prefix rpg test -- src/runners/local/adapter.test.ts`
Expected: PASS，覆盖并发拒绝、硬超时重建、dispose、状态迁移。

- [ ] **Step 5: 提交**
```bash
git add rpg/src/runners/local/adapter.ts rpg/src/runners/local/adapter.test.ts
git commit -m "feat: rewrite runner adapter for local subprocess"
```

### Task 5: 常驻进程隔离与安全轨迹验收

**Files:**
- Cherry-pick from `feature/python-runner`: `rpg/src/runners/python/runtime/execute.py`、`rpg/src/runners/python/runtime/execute.test.ts`
- Modify: `rpg/src/runners/python/runtime/daemon.py`（接线 `from execute import execute_request`）
- Create: `rpg/src/runners/python/runtime/isolation.test.ts`（常驻模式下连续运行的隔离断言）

**Interfaces:**
- Consumes: `execute.py` 的 `execute_request`、`PythonBridge`。
- Produces: 验证常驻进程连续运行不泄露 `sys.modules`、`tempfile`、stdout 缓冲。

- [ ] **Step 1: 写失败测试**

```ts
// rpg/src/runners/python/runtime/isolation.test.ts
import { describe, expect, it } from "vitest";
import { PythonBridge } from "../../local/python-bridge";
import { detectPython } from "../../local/python-detector";
import path from "node:path";

describe("isolation", () => {
  it("does not leak sys.modules between runs with same-named helper", async () => {
    const detection = await detectPython();
    if (!detection.ok) return;
    const bridge = new PythonBridge({
      pythonPath: detection.path,
      daemonScript: path.join(__dirname, "daemon.py"),
    });
    await bridge.waitReady();
    // 第一次写 helper.py 返回 "first"，第二次写同名 helper.py 返回 "second"
    // 第二次必须不读取第一次遗留的 sys.modules["helper"]
    // ...完整断言
    bridge.kill();
  }, 15000);
});
```

- [ ] **Step 2: 确认失败**
Run: `npm --prefix rpg test -- src/runners/python/runtime/isolation.test.ts`
Expected: FAIL，`execute.py` 未 cherry-pick、`daemon.py` 未接线。

- [ ] **Step 3: cherry-pick execute.py 并接线 daemon**

```bash
git checkout feature/python-runner -- rpg/src/runners/python/runtime/execute.py rpg/src/runners/python/runtime/execute.test.ts
```

`daemon.py` 顶部加 `from execute import execute_request`，删除占位实现。`daemon.py` 启动时写 `{"ready": true}` 首行。

- [ ] **Step 4: 验证**
Run: `npm --prefix rpg run build`
Expected: PASS。
Run: `npm --prefix rpg test -- src/runners/python/runtime/`
Expected: PASS，含 `execute.test.ts` 原有断言和 `isolation.test.ts` 常驻隔离断言。

- [ ] **Step 5: 提交**
```bash
git add rpg/src/runners/python/runtime/execute.py rpg/src/runners/python/runtime/execute.test.ts rpg/src/runners/python/runtime/daemon.py rpg/src/runners/python/runtime/isolation.test.ts
git commit -m "feat: verify resident process isolation and safe traces"
```

### Task 6: Node 守护服务 WebSocket 端点

**Files:**
- Create: `rpg/src/runners/local/node-server.ts`、`rpg/src/runners/local/node-server.test.ts`

**Interfaces:**
- Produces: `startRunnerServer(port: number): Promise<{ close: () => Promise<void> }>`，基于 `ws@8.18.0` 监听 `localhost:port`，每个 WebSocket 连接对应一个 `PythonRunnerAdapter`，转发请求/结果并暴露连接状态事件。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { startRunnerServer } from "./node-server";
import { WebSocket } from "ws";

describe("node runner server", () => {
  it("accepts a websocket connection and echoes state", async () => {
    const server = await startRunnerServer(5180);
    const ws = new WebSocket("ws://127.0.0.1:5180");
    await new Promise((resolve) => ws.on("open", resolve));
    let state: string | undefined;
    ws.on("message", (data) => { state = JSON.parse(data.toString()).state; });
    ws.send(JSON.stringify({ type: "subscribe_state" }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(state).toMatch(/^loading$|^ready$/);
    ws.close();
    await server.close();
  }, 10000);
});
```

- [ ] **Step 2: 确认失败**
Run: `npm --prefix rpg test -- src/runners/local/node-server.test.ts`
Expected: FAIL，`node-server.ts` 不存在。

- [ ] **Step 3: 写 ws 服务端**

`startRunnerServer` 用 `ws.WebSocketServer` 监听 `127.0.0.1:port`；每个连接创建一个 `PythonRunnerAdapter`（注入 `PythonBridge` 工厂）；收到的消息按 `type` 分发：`subscribe_state` 推送状态变更、`run` 调用 `adapter.run()` 并回传结果、`interrupt` 调用 `adapter.interrupt()`、`dispose` 关闭连接并释放 adapter。连接关闭时 `adapter.dispose()`。

- [ ] **Step 4: 验证**
Run: `npm --prefix rpg run build`
Expected: PASS（`ws` 只在 Node 侧，不进浏览器构建）。
Run: `npm --prefix rpg test -- src/runners/local/node-server.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**
```bash
git add rpg/src/runners/local/node-server.ts rpg/src/runners/local/node-server.test.ts
git commit -m "feat: expose local runner over websocket"
```

### Task 7: 端到端集成验收

**Files:**
- Create: `rpg/e2e/local-runner.spec.ts`

**Interfaces:**
- 必须经 `startRunnerServer` → 前端 `WebSocket` → `PythonRunnerAdapter` → `PythonBridge` → `daemon.py` → `execute_request` 完成端到端验收。

- [ ] **Step 1: 写端到端验收**

```ts
import { describe, expect, it } from "vitest";
import { startRunnerServer } from "../src/runners/local/node-server";
import { detectPython } from "../src/runners/local/python-detector";
import { WebSocket } from "ws";

describe("local runner end-to-end", () => {
  it("runs a choose_turn strategy and returns a turn command", async () => {
    const detection = await detectPython();
    if (!detection.ok) { console.warn("skipped: no python 3.12+"); return; }
    const server = await startRunnerServer(5181);
    const ws = new WebSocket("ws://127.0.0.1:5181");
    await new Promise((resolve) => ws.on("open", resolve));
    const result = await new Promise((resolve) => {
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "run_result") resolve(msg.result);
      });
      ws.send(JSON.stringify({ type: "run", request: {
        protocolVersion: 1, runId: "e2e-1", attemptId: "a1", questId: "q", language: "python",
        files: { "main.py": "def choose_turn(world):\n    return {'actorId': world['activeUnitId'], 'expectedRevision': world['revision'], 'action': {'type': 'wait'}}\n" },
        entrypoint: { file: "main.py", callable: "choose_turn" },
        worldView: { /* fixture worldView */ },
        allowedModules: ["math"],
        limits: { timeoutMs: 2000, interruptGraceMs: 200, maxFiles: 10, maxFileBytes: 65536, maxSourceBytes: 65536, maxOutputBytes: 16384, maxTraceEvents: 1000, maxValueDepth: 3 },
      }});
    });
    expect(result.executionStatus).toBe("completed");
    expect(result.returnValue.action.type).toBe("wait");
    ws.close();
    await server.close();
  }, 15000);
});
```

- [ ] **Step 2: 确认失败**
Run: `npm --prefix rpg test -- e2e/local-runner.spec.ts`
Expected: FAIL 或 skipped（Python 不可用时跳过）。

- [ ] **Step 3: 接线并修复**

确保 `node-server` 的 `run` 消息正确转发到 `adapter.run()`，结果回传为 `{ type: "run_result", result }`。`worldView` 用 `worldViewFixture`。

- [ ] **Step 4: 完整验证**
Run: `npm --prefix rpg run build`
Expected: PASS。
Run: `npm --prefix rpg test`
Expected: PASS，含 `execute.test.ts`、`isolation.test.ts`、`adapter.test.ts`、`python-bridge.test.ts`、`node-server.test.ts`、`local-runner.spec.ts`（本机有 Python 时全绿，无 Python时相关测试跳过并标记原因）。

- [ ] **Step 5: 提交**
```bash
git add rpg/e2e/local-runner.spec.ts
git commit -m "test: prove local runner end-to-end"
```

## 实施后自审

- [ ] Run: `git diff --check -- docs/superpowers/plans/2026-08-10-python-rpg-python-runner.md`。Expected: 无空白错误。
- [ ] Run: `grep -rn "pyodide\|worker-runner\|comsync\|comlink\|SharedArrayBuffer\|COOP\|COEP" rpg/src rpg/package.json`。Expected: 无匹配（确认浏览器 Worker 栈彻底退场）。
- [ ] Run: `npm --prefix rpg ls ws`。Expected: `ws@8.18.0` 精确显示，且仅在 `runners/local/node-server.ts` 被导入。
- [ ] Run: `npm --prefix rpg run build`。Expected: PASS，浏览器构建产物不含 `ws`、`child_process`、`node:` 协议导入。
- [ ] 用 TypeScript AST 或文本精确比较 `LocalRunnerChannel`、`PythonBridge`、`PythonRunnerAdapter`、`startRunnerServer`、`detectPython` 签名与各 Task 一致。Expected: 无缺失或不同参数顺序。
- [ ] Run: `git diff --name-only -- docs/superpowers/plans/2026-08-10-python-rpg-python-runner.md`。Expected: 仅本计划文件。
- [ ] 验证 `execute.py` 与 `feature/python-runner` 分支版本逐字节一致（cherry-pick 未引入改动）。Expected: `git diff feature/python-runner -- rpg/src/runners/python/runtime/execute.py` 无输出。

## 硬门

- 子进程崩溃、硬超时或致命错误后旧 Python 子进程必须 `kill`，下一次运行必须来自全新 spawn 的子进程；失败时不得继续复用可能损坏的解释器。
- 本地运行器不可用时（Python 未安装、版本过低、子进程无法启动）游戏必须明确暂停代码关卡并告知用户，不能静默降级或伪装就绪。
- `execute.py` 的 `sys.modules` 快照恢复、`tempfile` 清理和 `meta_path` 重置必须在常驻进程连续运行中保持有效；任何隔离泄露都阻断后续阶段。

## 止损条件

- 用户本机 Python 3.12+ 检测或 `daemon.py` 启动失败率超预期（如 Windows 路径编码、SIGINT 信号传递差异）：回退到"每请求 fork 子进程"模式（隔离模式 B），保留 `PythonRunnerAdapter` 契约和 `LocalRunnerChannel` 接口，只换 `PythonBridge` 实现为"每请求 spawn + 退出"。
- `execute.py` 在常驻模式下出现隔离泄露：回到 Task 5 修复 `sys.modules` 快照恢复逻辑，删除所有依赖该错误契约的下游适配，不做兼容垫片。
- `ws@8.18.0` 与 Node 24.15.0 不兼容：停止本计划，记录失败的版本组合，重新评估 Node 端 WebSocket 方案（如改用 Node 内置 `http.Server` + `WebSocket` 升级），不降级 Node 版本。
