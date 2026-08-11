# Python RPG 阶段 2 本地 Runner 修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复阶段 2 本地 CPython Runner 的模块策略、跨请求隔离、进程生命周期、可执行入口和 WebSocket 边界，使真实启动命令与阶段验收同时通过。

**Architecture:** 保留“浏览器原生 WebSocket -> Node 守护服务 -> 常驻 CPython daemon -> `execute_request`”主链路。模块许可收敛为应用维护的最小集合；每次请求重新导入许可模块，避免共享模块对象。Adapter 以 Channel 身份和代际管理 ready、运行、终止、重建，所有异步回调必须校验归属。

**Tech Stack:** Node.js 24.15.0、TypeScript 7.0.2、Vitest 4.1.10、Vite 8.2.1、`ws` 8.18.0、CPython 3.12+。

## Global Constraints

- 项目采用信任本地代码模型。本文处理工作目录隔离、进程隔离和防误操作模块许可，不把本地执行器描述为安全沙箱。
- 服务仅监听 `127.0.0.1`，不得改为 `0.0.0.0`、局域网地址或公网地址。
- 不引入 Pyodide、Worker、Comlink、SharedArrayBuffer、COOP/COEP 或远程代码服务。
- 直接依赖保持 `canonicalize@3.0.0` 与 `ws@8.18.0`；优先使用 Node 24 原生 TypeScript type stripping，不新增 TypeScript 运行器依赖。
- 第一版可许可标准库只保留 `math`。新增模块必须先证明其依赖闭包、全局状态和导入行为可恢复。
- 阶段 1 战斗内核、`WorldView`、`TurnCommand`、重放与哈希协议不在本次修改范围。
- 每个任务独立提交。提交信息沿用仓库 Conventional Commits 风格。
- 不自动推送远端，不重写已有提交，不提交现有 `.helloagents/sessions/**` 工作区改动。

---

## Baseline And Evidence

- **Planned at:** commit `3ee0d73`, 2026-08-11。
- **Review scope:** `0294f89` 的协议/执行器迁移，以及 `46f00db..3ee0d73` 的本地 Runner 任务 1--7。
- **Current green baseline:** `npm --prefix rpg test` 为 15 个测试文件、83 个测试通过；`npm --prefix rpg run build` 通过。
- **Known red baseline:** `npm --prefix rpg run runner` 以 `ERR_MODULE_NOT_FOUND` 退出。
- **Confirmed probes:** 动态导入可加载阻止模块；许可模块属性跨请求泄漏；超时后的新请求复用旧 Channel；Windows `SIGINT` 直接结束 Python 进程。

## Target File Structure

| Path | Responsibility |
|---|---|
| `rpg/src/runners/python/runtime/execute.py` | Python 文件执行、许可模块策略、每请求全局状态恢复 |
| `rpg/src/runners/python/runtime/execute.test.ts` | 真实 CPython 执行器契约测试 |
| `rpg/src/runners/python/runtime/isolation.test.ts` | 常驻进程连续请求隔离测试 |
| `rpg/src/runners/python/runtime/daemon.py` | JSON-lines 请求循环与中断结果关联 |
| `rpg/src/runners/local/channel.ts` | 可等待 ready、可观测退出的 Channel 契约 |
| `rpg/src/runners/local/python-bridge.ts` | Python 子进程、JSON-lines、ready、写入与退出错误 |
| `rpg/src/runners/local/adapter.ts` | 单请求状态机、代际关联、超时和重建 |
| `rpg/src/runners/local/python-detector.ts` | 选择满足 3.12+ 的解释器候选 |
| `rpg/src/runners/local/node-server.ts` | 本地 WebSocket 路由、来源校验和资源关闭 |
| `rpg/src/runners/local/runner-cli.ts` | 可执行命令入口、端口解析和退出信号 |
| `rpg/src/runners/local/runner-cli.test.ts` | 命令级启动冒烟测试 |
| `rpg/src/runners/local/test-support.ts` | Runner 集成测试共享的 Python 检测、等待与清理辅助函数 |
| `rpg/package.json` | Runner 启动脚本和验证脚本 |
| `rpg/tsconfig.json` | Node 原生 `.ts` 导入所需 TypeScript 选项 |

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Node version | `node --version` | `v24.15.0` |
| Python version | `python --version` | `Python 3.12.x` 或更高 |
| Full tests | `npm --prefix rpg test` | exit 0，所有非条件测试通过 |
| Runner tests | `npm --prefix rpg test -- src/runners` | exit 0 |
| Build | `npm --prefix rpg run build` | exit 0，`tsc --noEmit` 与 Vite 均通过 |
| CLI smoke | `npm --prefix rpg test -- src/runners/local/runner-cli.test.ts` | exit 0，服务启动后被测试清理 |
| Diff hygiene | `git diff --check` | exit 0，无输出 |

## Scope

**In scope:** 上表列出的 Runner、协议校验、测试、`package.json` 和 `tsconfig.json`。

**Out of scope:**

- 阶段 3 应用外壳和浏览器 UI。
- 战斗规则、关卡内容、回放格式和持久化。
- 对抗恶意本地代码的隔离边界。
- 新的标准库许可项、第三方 Python 包和源码安装能力。
- 公网服务、远程执行、账户、权限和多用户能力。

## Git Workflow

- 建议分支：`fix/stage2-runner-remediation`。
- 每个 Task 对应一个独立提交；一个 Task 的测试和实现放在同一提交。
- 漂移检查：执行每个 Task 前运行 `git diff --stat 3ee0d73..HEAD -- <该 Task 的 in-scope paths>`。
- 若当前代码已变化，先对照本文的 Current state 和接口目标；关键接口不一致时触发 STOP 条件。

---

### Task 1: 恢复真实 CPython 执行器测试基线

**Files:**

- Create: `rpg/src/runners/python/runtime/execute.test.ts`
- Create: `rpg/src/runners/local/test-support.ts`
- Modify: `rpg/src/runners/python/runtime/isolation.test.ts`
- Modify: `rpg/src/runners/local/python-bridge.test.ts`
- Modify: `rpg/src/runners/local/node-server.test.ts`
- Modify: `rpg/src/runners/local/e2e.spec.ts`

**Interfaces:**

- Produces: `requireDetectedPython(): Promise<{ path: string; version: string }>`。
- Produces: `withPythonBridge<T>(callback): Promise<T>`，始终清理真实 Python 进程。
- Produces: `sendAndWait(bridge, request, timeoutMs): Promise<RunResult>`，按 `runId` 与 `attemptId` 关联结果。

**Current state:** 远端 `origin/feature/python-runner` 含 Pyodide 版 `execute.test.ts`，覆盖执行结果、模块策略、输出截断、轨迹预算和全局恢复；当前分支未迁移该文件。四个真实 Python 测试在检测失败时直接 `return`，Vitest 会把它们计为通过。

- [ ] **Step 1: 写共享测试辅助函数**

在 `test-support.ts` 中集中实现 Python 检测、事件驱动结果等待和 `try/finally` 清理。禁止固定 `500ms` 或 `1000ms` 睡眠。

```ts
export async function requireDetectedPython(): Promise<{ path: string; version: string }> {
  const detection = await detectPython();
  if (!detection.ok) {
    throw new Error(`Runner integration requires CPython 3.12+: ${detection.code}`);
  }
  return detection;
}

export function sendAndWait(
  bridge: PythonBridge,
  request: RunRequest,
  timeoutMs = 5_000,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${request.runId}`)), timeoutMs);
    bridge.onMessage = (result) => {
      if (result.runId !== request.runId || result.attemptId !== request.attemptId) return;
      clearTimeout(timer);
      resolve(result);
    };
    if (!bridge.send(request)) {
      clearTimeout(timer);
      reject(new Error("python bridge rejected request"));
    }
  });
}
```

- [ ] **Step 2: 恢复执行器测试用例**

从 `origin/feature/python-runner:rpg/src/runners/python/runtime/execute.test.ts` 迁移下列契约，删除 `loadPyodide`、`toPy`、`runPythonAsync` 与 `?raw`：

1. 多文件执行和 stdout 捕获。
2. 入口模块与玩家模块不跨请求保留。
3. cwd、`sys.path`、`sys.meta_path`、`sys.modules` 恢复。
4. 默认模块拒绝和显式 `math` 许可。
5. `SAFE_BUILTINS` 同时作用于入口和玩家模块。
6. 语法错误、运行错误、私有异常文本隐藏。
7. UTF-8 stdout/stderr 独立截断。
8. 非 JSON 返回值和深度限制。
9. 轨迹事件上限、序号、类型、文件过滤和 `returnValueTraceSeq`。
10. 轨迹快照不调用玩家对象的 `repr`、描述符或容器子类协议。

所有请求经真实 `PythonBridge -> daemon.py -> execute_request` 执行。

- [ ] **Step 3: 把环境缺失改成显式状态**

开发机测试使用 Vitest 条件 skip，并在测试标题或 skip 原因中包含 `CPython 3.12+`。阶段验收命令先运行 `python --version`，缺少兼容解释器时验收失败。不得使用普通 `return` 伪装通过。

- [ ] **Step 4: 运行定向测试**

Run: `npm --prefix rpg test -- src/runners/python/runtime/execute.test.ts src/runners/python/runtime/isolation.test.ts src/runners/local/python-bridge.test.ts`

Expected: PASS；报告中 Python 环境依赖测试显示真实执行或明确 `skipped`，不显示未执行的普通 PASS。

- [ ] **Step 5: 提交**

```bash
git add "rpg/src/runners/python/runtime/execute.test.ts" "rpg/src/runners/python/runtime/isolation.test.ts" "rpg/src/runners/local/test-support.ts" "rpg/src/runners/local/python-bridge.test.ts" "rpg/src/runners/local/node-server.test.ts" "rpg/src/runners/local/e2e.spec.ts"
git commit -m "test: restore local python runner contract coverage"
```

---

### Task 2: 收紧模块许可并隔离许可模块状态

**Files:**

- Modify: `rpg/src/runners/protocol/validate-request.ts`
- Modify: `rpg/src/runners/protocol/validate-request.test.ts`
- Modify: `rpg/src/runners/python/runtime/execute.py`
- Modify: `rpg/src/runners/python/runtime/execute.test.ts`
- Modify: `rpg/src/runners/python/runtime/isolation.test.ts`

**Interfaces:**

- Produces: TypeScript 与 Python 一致的首版许可集合 `{ "math" }`。
- Produces: 不受 `importlib` 等旁路影响的阻止模块门禁。
- Produces: 每次请求独立的许可模块对象。

**Current state:** `guarded_import()` 只替换玩家内建 `__import__`；`allowedModules` 接受任意裸标识符；`sys.modules` 仅浅拷贝并恢复映射。动态导入探针可加载 `socket`，双请求探针可观察前一请求写入 `math` 的属性。

- [ ] **Step 1: 写失败测试**

新增以下测试并确认当前实现失败：

```ts
it("rejects unsupported allowed module names", () => {
  const result = validateRunRequest({ ...baseRequest, allowedModules: ["importlib"] });
  expect(result).toMatchObject({ ok: false, diagnostic: { code: "UNSUPPORTED_ALLOWED_MODULE" } });
});

it("blocks dynamic loading of a prohibited root", async () => {
  // 请求只能声明首版许可集合；动态导入路径必须返回 MODULE_NOT_ALLOWED。
});

it("does not retain allowed-module attributes across requests", async () => {
  // 第一次修改 math 模块属性，第二次必须观察不到该属性。
});
```

Run: `npm --prefix rpg test -- src/runners/protocol/validate-request.test.ts src/runners/python/runtime/execute.test.ts src/runners/python/runtime/isolation.test.ts`

Expected: FAIL，至少出现 `UNSUPPORTED_ALLOWED_MODULE` 未实现、动态导入完成或模块属性泄漏。

- [ ] **Step 2: 在两端定义最小许可集合**

TypeScript 校验器拒绝 `math` 以外的请求模块，并返回稳定诊断码 `UNSUPPORTED_ALLOWED_MODULE`。Python 端再次执行同样的许可交集，避免绕过 Node 直接写 daemon stdin 时扩大权限。

```py
SAFE_ALLOWED_MODULES = frozenset({"math"})

def _validated_allowed_modules(request):
    requested = set(request.get("allowedModules", []))
    unsupported = requested - SAFE_ALLOWED_MODULES
    if unsupported:
        raise RuntimeError("MODULE_NOT_ALLOWED:" + sorted(unsupported)[0])
    return requested
```

- [ ] **Step 3: 为许可模块创建每请求对象**

在记录 `previous_modules` 后、加载玩家入口前，从 `sys.modules` 删除每个许可根及其子模块；请求结束时沿用现有 `_restore_modules()` 恢复原模块映射。执行器自身继续持有启动期 `math` 引用，轨迹和 JSON 转换不读取玩家导入的模块对象。

```py
def _evict_allowed_modules(allowed_modules):
    for name in tuple(sys.modules):
        root = name.split(".", 1)[0]
        if root in allowed_modules:
            del sys.modules[name]
```

- [ ] **Step 4: 运行定向测试**

Run: `npm --prefix rpg test -- src/runners/protocol/validate-request.test.ts src/runners/python/runtime/execute.test.ts src/runners/python/runtime/isolation.test.ts`

Expected: PASS；动态导入返回 `MODULE_NOT_ALLOWED`；第二次请求观察不到第一次写入的许可模块属性。

- [ ] **Step 5: 提交**

```bash
git add "rpg/src/runners/protocol/validate-request.ts" "rpg/src/runners/protocol/validate-request.test.ts" "rpg/src/runners/python/runtime/execute.py" "rpg/src/runners/python/runtime/execute.test.ts" "rpg/src/runners/python/runtime/isolation.test.ts"
git commit -m "fix: enforce local runner module policy"
```

---

### Task 3: 建立可失败的 Bridge readiness 与写入协议

**Files:**

- Modify: `rpg/src/runners/local/channel.ts`
- Modify: `rpg/src/runners/local/python-bridge.ts`
- Modify: `rpg/src/runners/local/python-bridge.test.ts`
- Modify: `rpg/src/runners/local/adapter.ts`
- Modify: `rpg/src/runners/local/adapter.test.ts`
- Modify: `rpg/src/runners/local/test-support.ts`

**Interfaces:**

- `waitReady(): Promise<void>` 进入 `LocalRunnerChannel` 公共契约。
- `send(request: RunRequest): Promise<void>` 在 stdin 写入失败时 reject。
- `kill(): Promise<void>` 幂等等待该代进程退出。
- `PythonRunnerAdapter.dispose(): Promise<void>` 幂等等待当前 Channel 释放。

**Current state:** ready Promise 只有 resolver；ChildProcess 与 stdin 未监听 `error`；成功后启动超时计时器仍保留；Adapter 忽略布尔 `send()` 结果。

- [ ] **Step 1: 写 Bridge 失败测试**

覆盖以下确定性场景：缺失可执行文件立即 reject；daemon 在 ready 前退出；stdin 写入失败；多次 `waitReady()` 共享同一 Promise；多次 `kill()` 只结算一次。

Run: `npm --prefix rpg test -- src/runners/local/python-bridge.test.ts`

Expected: FAIL，当前实现出现 timeout、未处理 error 或错误结算次数。

- [ ] **Step 2: 修改 Channel 契约**

```ts
export interface LocalRunnerChannel {
  readonly generation: number;
  readonly pid: number | undefined;
  onMessage: ((result: RunResult) => void) | undefined;
  onExit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
  waitReady(): Promise<void>;
  send(request: RunRequest): Promise<void>;
  interrupt(): void;
  kill(): Promise<void>;
}
```

- [ ] **Step 3: 实现每代进程的单次结算**

`PythonBridge` 为每个子进程保存 ready resolve/reject、exit Promise 和 startup timer。`error`、ready 前 `exit`、startup timeout、stdin callback error 分别产生明确 Error；所有路径清理 timer 和监听器。stderr 最多保留 4096 UTF-8 字节用于本地启动诊断，不把玩家输出或系统路径回传给前端。

- [ ] **Step 4: 让 Adapter 等待 ready 和 send**

`run()` 在设置 `running` 和启动执行超时前等待 Channel ready；ready/send 失败映射为 `runner_error` 与稳定码 `RUNNER_START_FAILED` 或 `RUNNER_SEND_FAILED`。初始化等待期间 `dispose()` 必须结算调用方，并返回一个等待 Channel 退出的幂等 Promise。同步把 `test-support.ts` 的发送逻辑改为 `await bridge.send(request)`。

- [ ] **Step 5: 运行定向测试和构建**

Run: `npm --prefix rpg test -- src/runners/local/channel.test.ts src/runners/local/python-bridge.test.ts src/runners/local/adapter.test.ts`

Expected: PASS。

Run: `npm --prefix rpg run build`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add "rpg/src/runners/local/channel.ts" "rpg/src/runners/local/python-bridge.ts" "rpg/src/runners/local/python-bridge.test.ts" "rpg/src/runners/local/adapter.ts" "rpg/src/runners/local/adapter.test.ts" "rpg/src/runners/local/test-support.ts"
git commit -m "fix: close python bridge failure paths"
```

---

### Task 4: 用 Channel 身份和代际收敛 Adapter 重建状态机

**Files:**

- Modify: `rpg/src/runners/local/adapter.ts`
- Modify: `rpg/src/runners/local/adapter.test.ts`

**Interfaces:**

- Active run 保存 `runId`、`attemptId`、Channel 对象与 generation。
- `restarting` 期间的新请求等待 restart barrier 后创建全新 Channel。
- 旧 Channel 的 message/exit 不得修改新 Channel 或新请求。

**Current state:** timeout 先清空 active 并返回，再异步 kill；下一次 run 复用旧 Channel；任何结果都会结算当前 active；测试 MockChannel 的 kill 同步触发 exit，掩盖真实窗口。

- [ ] **Step 1: 把 MockChannel 退出改为显式事件**

`kill()` 只记录调用；测试通过 `emitExit()` 控制退出时机。新增迟到 message、迟到 exit、错误 runId、错误 attemptId、旧 generation 五个用例。

- [ ] **Step 2: 复现超时后立即重试**

测试顺序固定为：运行 r1 -> 触发硬超时 -> 收到 timeout -> 立即运行 r2 -> 旧 Channel 发 r1 结果 -> 旧 Channel exit -> 新 Channel ready -> 新 Channel 返回 r2。断言 r2 从未写入旧 Channel，且只由 r2 结果结算。

Run: `npm --prefix rpg test -- src/runners/local/adapter.test.ts`

Expected: FAIL，当前实现把 r2 写入旧 Channel或由 r1 结果结算。

- [ ] **Step 3: 引入 restart barrier**

在 kill 前同步把旧 Channel 从当前 lease 分离，并登记等待旧进程退出的 barrier。timeout 结果可立即返回；后续 `run()` 必须等待 barrier，再创建并等待新 Channel ready。

```ts
interface ChannelLease {
  readonly channel: LocalRunnerChannel;
  readonly generation: number;
}

interface ActiveRun {
  readonly request: RunRequest;
  readonly lease: ChannelLease;
  readonly resolve: (result: RunResult) => void;
  readonly hardTimer: TimerHandle;
  graceTimer?: TimerHandle;
}
```

- [ ] **Step 4: 校验所有异步回调归属**

`handleMessage(lease, result)` 仅在 lease、generation、runId、attemptId 全匹配时结算。`handleExit(lease, ...)` 只清理同一 lease；旧代 exit 只完成自己的 barrier。

- [ ] **Step 5: 验证**

Run: `npm --prefix rpg test -- src/runners/local/adapter.test.ts src/runners/local/python-bridge.test.ts`

Expected: PASS；异步 exit 测试不使用固定睡眠。

- [ ] **Step 6: 提交**

```bash
git add "rpg/src/runners/local/adapter.ts" "rpg/src/runners/local/adapter.test.ts"
git commit -m "fix: serialize runner process generations"
```

---

### Task 5: 统一 POSIX 与 Windows 的中断结果

**Files:**

- Modify: `rpg/src/runners/local/adapter.ts`
- Modify: `rpg/src/runners/local/adapter.test.ts`
- Modify: `rpg/src/runners/python/runtime/daemon.py`
- Modify: `rpg/src/runners/python/runtime/execute.py`
- Modify: `rpg/src/runners/python/runtime/isolation.test.ts`

**Interfaces:**

- POSIX：Python 捕获 `KeyboardInterrupt` 时返回真实 `interrupted` 结果，可继续复用进程。
- Windows：Node `SIGINT` 导致进程退出时，Adapter 将“正在中断的预期退出”结算为 `interrupted`，完成 restart barrier，下一次运行使用新进程。
- grace 到期仍未有结果或退出时，升级为硬终止并返回 `RUNNER_INTERRUPT_TIMEOUT`。

**Current state:** Windows Node 24 的 `child.kill("SIGINT")` 直接结束 Python；`handleExit()` 统一返回 `RUNNER_PROCESS_EXITED`。daemon 的 `request` 在 try 内赋值，中断若落在解析或响应边界，可能丢失请求关联。

- [ ] **Step 1: 写平台无关 Adapter 测试**

新增“interrupt 后收到 `interrupted` message”“interrupt 后收到预期 SIGINT exit”“grace timeout 后 SIGKILL”“中断完成后下一次 run 使用新代际”四个用例。

- [ ] **Step 2: 写真实进程集成测试**

玩家代码执行可被轨迹捕获的长循环。调用 `adapter.interrupt(runId)` 后，run Promise 必须返回 `executionStatus: "interrupted"`；随后第二个短请求必须完成。Windows 断言 generation 增加，POSIX 允许 daemon 继续存活。

Run: `npm --prefix rpg test -- src/runners/python/runtime/isolation.test.ts`

Expected: FAIL，Windows 当前返回进程退出错误。

- [ ] **Step 3: 区分预期中断退出**

Adapter 在 active run 上记录 interrupt intent。若同一 lease 在 `interrupting` 状态因 `SIGINT` 退出，生成稳定 `interrupted` 结果而非 `RUNNER_PROCESS_EXITED`，然后完成重建。其他退出仍按 runner error 处理。

- [ ] **Step 4: 收紧 daemon 请求上下文**

每轮先初始化 `request = None`；JSON 解析、执行和响应写入置于明确的异常边界。只有存在有效 `runId`/`attemptId` 时才合成中断结果。响应写入期间中断导致 daemon 退出，由 Adapter 的预期退出路径结算。

- [ ] **Step 5: 验证**

Run: `npm --prefix rpg test -- src/runners/local/adapter.test.ts src/runners/python/runtime/isolation.test.ts`

Expected: PASS；当前 Windows 与 POSIX 环境均返回协议级 `interrupted`。

- [ ] **Step 6: 提交**

```bash
git add "rpg/src/runners/local/adapter.ts" "rpg/src/runners/local/adapter.test.ts" "rpg/src/runners/python/runtime/daemon.py" "rpg/src/runners/python/runtime/execute.py" "rpg/src/runners/python/runtime/isolation.test.ts"
git commit -m "fix: normalize local runner interruption"
```

---

### Task 6: 正确选择 CPython 解释器

**Files:**

- Modify: `rpg/src/runners/local/python-detector.ts`
- Modify: `rpg/src/runners/local/python-detector.test.ts`

**Interfaces:**

- `detectPython()` 检查全部候选并选择第一个满足 3.12+ 的解释器。
- 只有全部候选失败后才返回 `PYTHON_NOT_FOUND` 或 `PYTHON_VERSION_TOO_LOW`。
- 错误结果包含 Python 官方下载地址文本 `https://www.python.org/downloads/`。

- [ ] **Step 1: 注入探测函数并写失败测试**

将候选执行抽为可测试依赖，覆盖：旧 `python3` + 新 `python`、两个旧版本、候选不存在、版本文本无效、主版本高于 3。

Run: `npm --prefix rpg test -- src/runners/local/python-detector.test.ts`

Expected: FAIL，“旧 python3 + 新 python”当前错误返回低版本。

- [ ] **Step 2: 收集全部候选结果后决策**

优先返回首个兼容候选；若至少找到一个低版本，返回其中版本最高者用于诊断；否则返回未找到。每个 `execFile` 探测设置 2000ms 超时，避免异常解释器长期占用启动流程。

- [ ] **Step 3: 验证并提交**

Run: `npm --prefix rpg test -- src/runners/local/python-detector.test.ts`

Expected: PASS。

```bash
git add "rpg/src/runners/local/python-detector.ts" "rpg/src/runners/local/python-detector.test.ts"
git commit -m "fix: select a compatible local python"
```

---

### Task 7: 提供可执行的 Runner CLI

**Files:**

- Create: `rpg/src/runners/local/runner-cli.ts`
- Create: `rpg/src/runners/local/runner-cli.test.ts`
- Modify: `rpg/src/runners/local/node-server.ts`
- Modify: `rpg/src/runners/local/adapter.ts`
- Modify: `rpg/src/runners/local/python-bridge.ts`
- Modify: `rpg/tsconfig.json`
- Modify: `rpg/package.json`

**Interfaces:**

- `npm --prefix rpg run runner -- --port 5175` 启动服务。
- `--port 0` 允许测试使用系统分配端口。
- ready 后 stdout 输出单行 `{"type":"runner_ready","port":<number>}`。
- `SIGINT`/`SIGTERM` 触发幂等关闭并以 0 退出。

**Current state:** Node 直接执行 `node-server.ts` 时，运行时无扩展导入导致 `ERR_MODULE_NOT_FOUND`；该文件也没有调用 `startRunnerServer()`。

- [ ] **Step 1: 写命令级失败测试**

测试 spawn `npm --prefix rpg run runner -- --port 0`，等待 `runner_ready`，连接 WebSocket，发送 `subscribe_state`，随后发送终止信号并等待 exit 0。测试总超时 10 秒，`finally` 强制清理子进程。

Run: `npm --prefix rpg test -- src/runners/local/runner-cli.test.ts`

Expected: FAIL，当前命令返回 `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 2: 让 Node 运行时导入显式 `.ts`**

本地 Runner 的运行时相对导入统一写 `.ts` 扩展；`tsconfig.json` 开启与 `noEmit` 兼容的 `allowImportingTsExtensions`。测试文件可继续采用项目既有导入风格。

- [ ] **Step 3: 创建 CLI 入口**

`runner-cli.ts` 只负责参数、启动、ready 输出和信号关闭，不承载 WebSocket 消息逻辑。默认端口 5175；端口必须是 0--65535 的十进制整数，非法参数以非零状态退出并输出一行诊断。

- [ ] **Step 4: 更新脚本**

```json
{
  "runner": "node --experimental-strip-types src/runners/local/runner-cli.ts",
  "runner:dev": "node --watch --experimental-strip-types src/runners/local/runner-cli.ts"
}
```

- [ ] **Step 5: 验证**

Run: `npm --prefix rpg test -- src/runners/local/runner-cli.test.ts`

Expected: PASS。

Run: `npm --prefix rpg run build`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add "rpg/src/runners/local/runner-cli.ts" "rpg/src/runners/local/runner-cli.test.ts" "rpg/src/runners/local/node-server.ts" "rpg/src/runners/local/adapter.ts" "rpg/src/runners/local/python-bridge.ts" "rpg/tsconfig.json" "rpg/package.json"
git commit -m "fix: add an executable local runner entrypoint"
```

---

### Task 8: 收紧 WebSocket 来源并实现幂等关闭

**Files:**

- Modify: `rpg/src/runners/local/node-server.ts`
- Modify: `rpg/src/runners/local/node-server.test.ts`
- Modify: `rpg/src/runners/local/e2e.spec.ts`

**Interfaces:**

- 有 Origin 的浏览器连接只允许 `http:`/`https:` 且 hostname 精确为 `localhost`、`127.0.0.1` 或 IPv6 loopback。
- 缺少 Origin 的原生本地客户端继续允许。
- `dispose` 消息幂等释放 Adapter 并关闭 socket。
- `ServerHandle.close()` 主动释放全部 Adapter 和客户端，重复调用共享同一 close Promise。

- [ ] **Step 1: 写来源校验失败测试**

表驱动覆盖合法 loopback、`https://localhost.attacker.example`、`https://attacker.example/?next=localhost`、畸形 Origin、`null` Origin 和无 Origin 原生客户端。

Run: `npm --prefix rpg test -- src/runners/local/node-server.test.ts`

Expected: FAIL，相似域名当前通过连接检查。

- [ ] **Step 2: 用 URL 精确解析来源**

来源判断提取为纯函数。hostname 使用精确集合匹配，不使用 `includes`、`endsWith` 或正则子串。IPv6 loopback 同时覆盖 URL 标准化后的形式。

- [ ] **Step 3: 写关闭与 dispose 失败测试**

覆盖：客户端保持连接时调用 server close；运行中关闭；`dispose` 消息；两次 close；多连接；客户端异常断开。所有测试使用 `finally` 清理。

- [ ] **Step 4: 跟踪连接资源**

服务端维护 `Map<WebSocket, PythonRunnerAdapter>`。关闭时停止接入，逐一 await `adapter.dispose()`，先发送 1001 close，500ms 后仍未关闭的连接调用 `terminate()`，最后等待 `wss.close()`。socket close 回调与显式 dispose 共用幂等清理函数。

- [ ] **Step 5: 实现协议 dispose**

消息分发加入 `dispose` 分支；释放 Adapter 后关闭连接。未知或畸形消息返回稳定 `protocol_error` envelope，不再静默吞掉所有异常。

- [ ] **Step 6: 验证并提交**

Run: `npm --prefix rpg test -- src/runners/local/node-server.test.ts src/runners/local/e2e.spec.ts src/runners/local/runner-cli.test.ts`

Expected: PASS，无开放句柄警告。

```bash
git add "rpg/src/runners/local/node-server.ts" "rpg/src/runners/local/node-server.test.ts" "rpg/src/runners/local/e2e.spec.ts"
git commit -m "fix: harden local runner websocket lifecycle"
```

---

### Task 9: 阶段 2 完整质量闭环

**Files:**

- Modify only if verification exposes a defect in Task 1--8 in-scope files.

- [ ] **Step 1: 确认运行时版本**

Run: `node --version`

Expected: `v24.15.0`。

Run: `python --version`

Expected: 3.12 或更高。

- [ ] **Step 2: 运行 Runner 定向测试**

Run: `npm --prefix rpg test -- src/runners`

Expected: PASS；真实 Python、隔离、Bridge、Adapter、WebSocket、CLI 和 E2E 均有执行记录。

- [ ] **Step 3: 运行完整测试**

Run: `npm --prefix rpg test`

Expected: PASS；测试数量不少于当前 83 个，新增回归测试全部计入。

- [ ] **Step 4: 运行构建**

Run: `npm --prefix rpg run build`

Expected: PASS；浏览器构建产物不包含 `ws` 或 Node 子进程代码。

- [ ] **Step 5: 运行真实 CLI 冒烟**

Run: `npm --prefix rpg test -- src/runners/local/runner-cli.test.ts`

Expected: PASS；子进程正常关闭，无端口和 Python 进程残留。

- [ ] **Step 6: 检查差异范围**

Run: `git diff --check 3ee0d73..HEAD`

Expected: exit 0，无输出。

Run: `git status --short`

Expected: 只出现本计划列明的源码、测试和文档；现有 `.helloagents/sessions/**` 改动保持独立。

---

## Test Plan

| Risk | Required regression evidence |
|---|---|
| 动态导入旁路 | 非许可动态导入返回 `MODULE_NOT_ALLOWED` |
| 许可模块状态泄漏 | 连续请求使用不同模块对象，第二次无前次属性 |
| 超时重建竞态 | 异步 exit 窗口内的新请求不写旧 Channel |
| 迟到结果错配 | runId、attemptId、generation 任一不符均不结算 active |
| spawn/stdio 失败 | ENOENT、ready 前退出、stdin 失败立即产生 runner error |
| Windows 中断 | run 返回 `interrupted`，后续 run 来自可用新代际 |
| Python 候选遮蔽 | 旧 `python3` 不遮蔽新 `python` |
| CLI 入口 | `npm run runner -- --port 0` 真实监听并可关闭 |
| Origin 相似域名 | 精确 loopback 通过，相似外部域名拒绝 |
| 服务关闭 | 活跃连接存在时 close 在有限时间内结算并释放 Python |
| 环境门禁 | 缺少 Python 时显示 skip 或阶段门禁失败，不显示普通 PASS |

## Done Criteria

- [ ] 动态导入探针返回 `MODULE_NOT_ALLOWED`。
- [ ] 许可模块连续请求探针不再观察到前次属性。
- [ ] Adapter 异步退出测试证明新请求不复用旧 Channel。
- [ ] Windows 与 POSIX 的中断测试都返回 `interrupted`。
- [ ] `npm --prefix rpg run runner -- --port 0` 由命令级测试证明可启动。
- [ ] 相似域名 Origin 测试全部被拒绝。
- [ ] 服务 close/dispose 测试无开放句柄和残留子进程。
- [ ] `execute.test.ts` 已恢复为真实 CPython 测试，不含 Pyodide。
- [ ] `npm --prefix rpg test`、`npm --prefix rpg run build`、`git diff --check` 全部 exit 0。
- [ ] 每个 Task 有独立 Conventional Commit。
- [ ] 未提交 `.helloagents/sessions/**` 既有改动，未推送远端。

## STOP Conditions

遇到以下任一条件时停止当前 Task 并报告证据：

- in-scope 文件相对 `3ee0d73` 已发生未在本文反映的接口重构。
- Node 24 原生 TypeScript 在所有运行时相对导入显式 `.ts` 后仍不能启动 CLI。
- `math` 重新导入会破坏执行器自身的轨迹或 JSON 转换引用。
- Windows 预期 SIGINT exit 与异常进程退出无法通过当前状态和 lease 唯一区分。
- 幂等 close 需要修改 `ws`、Node 或 Python 的固定版本。
- 单个验证步骤经两次针对性修复仍失败。
- 修复需要触碰 Out of scope 文件或改变公开战斗协议。

## Maintenance Notes

- 扩大 Python 许可模块前，先为候选模块建立依赖闭包和可变全局状态测试；不得只把名称加入集合。
- 修改 Channel 接口时，重点审查 error、exit、close、timeout、dispose 之间的单次结算。
- 新增 WebSocket 消息类型时，必须同时更新运行时 envelope 校验和关闭路径测试。
- CLI 的 ready 输出是测试与未来应用外壳的机器契约；保持单行 JSON，不混入普通日志。
- 阶段 3 接入前重新运行本计划 Task 9，阶段 2 的真实 CLI 命令是唯一可接受的 Runner 启动基线。
