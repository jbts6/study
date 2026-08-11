# Python RPG Local Runner Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让阶段 1/2 符合个人本地游戏前提：正常 Python 可用、错误可读、每次运行使用独立子进程、协议只校验真实 JSON 输入。

**Architecture:** 保留 `WebSocket -> PythonRunnerAdapter -> Python` 边界，但把常驻 daemon 改为每次请求启动一个子进程。每个子进程只读取一个 JSON 请求并输出一个 JSON 结果，因此不再需要 generation、restart barrier 或跨请求模块恢复。模块白名单、loopback、超时、中断和输出/轨迹上限继续保留。

**Tech Stack:** TypeScript 7、Vitest 4、本机 CPython 3.12+、Node `child_process`、`ws`。

## Global Constraints

- 个人、本地、单人游戏是最高前提；不得新增公网、多用户或对抗恶意代码的措施。
- 玩家获得标准 Python builtins；仅用 `__import__` 包装器保留模块白名单。
- 玩家异常返回类型、消息和玩家文件位置，不隐藏本地错误文本。
- 每次 `run()` 创建一个 Python 子进程；完成、失败、超时或中断后该进程退出。
- 只保留正常执行、关键失败、超时、中断、并发拒绝和释放测试。

---

### Task 1: 固化项目前提

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/superpowers/plans/2026-08-11-python-rpg-local-simplification.md`

**Interfaces:** 不改运行时接口；为后续任务建立强制裁剪标准。

- [ ] 写入“个人游戏、仅本地运行”的最高工程前提。
- [ ] 删除常驻进程专属的文案，保留 loopback 与模块白名单边界。
- [ ] Run: `git diff --check`
- [ ] Commit: `docs: define local game engineering scope`

### Task 2: 恢复正常 Python 与可读错误

**Files:**
- Modify: `rpg/src/runners/python/runtime/execute.py`
- Modify: `rpg/src/runners/python/runtime/execute.test.ts`

**Interfaces:** `execute_request(request) -> RunResult` 保持不变；诊断继续使用 `RunnerDiagnostic`。

- [ ] 先把 builtins 测试改成使用 `isinstance`、`iter`、`next` 和 `type`，确认当前实现返回 `runtime_error`。
- [ ] 把异常测试改成断言语法错误消息、`ValueError` 文本和玩家文件位置可见，确认当前实现失败。
- [ ] 用标准 `builtins` 字典构建玩家全局，仅覆盖 `__import__`。
- [ ] 在 `execute_request` 中返回异常类型、`str(error)` 和最后一个玩家 traceback 位置；`MODULE_NOT_ALLOWED` 保持独立错误码。
- [ ] Run: `npm --prefix rpg test -- src/runners/python/runtime/execute.test.ts`
- [ ] Commit: `fix: restore local python feedback`

### Task 3: 精简真实 JSON 请求校验

**Files:**
- Modify: `rpg/src/runners/protocol/validate-request.ts`
- Modify: `rpg/src/runners/protocol/validate-request.test.ts`

**Interfaces:** `validateRunRequest(input): RequestValidationResult` 保持不变。

- [ ] 删除 Proxy、访问器、共享图、循环图、非 JSON 容器和递归冻结测试。
- [ ] 保留一个有效请求测试，以及版本、标识符、源码预算、入口点、模块白名单、limits 和 `worldView` 的关键失败测试。
- [ ] 删除递归快照和 `deepFreeze`；校验通过后返回 JSON 请求对象，不建立对抗调用方篡改的边界。
- [ ] Run: `npm --prefix rpg test -- src/runners/protocol/validate-request.test.ts`
- [ ] Commit: `refactor: simplify local runner validation`

### Task 4: 每次运行使用独立 Python 子进程

**Files:**
- Create: `rpg/src/runners/local/python-process.ts`
- Create: `rpg/src/runners/python/runtime/run_once.py`
- Modify: `rpg/src/runners/local/adapter.ts`
- Modify: `rpg/src/runners/local/node-server.ts`
- Modify: `rpg/src/runners/local/test-support.ts`
- Modify: `rpg/src/runners/protocol/types.ts`
- Modify: focused Runner tests
- Delete: `rpg/src/runners/local/channel.ts`
- Delete: `rpg/src/runners/local/channel.test.ts`
- Delete: `rpg/src/runners/local/python-bridge.ts`
- Delete: `rpg/src/runners/local/python-bridge.test.ts`
- Delete: `rpg/src/runners/python/runtime/daemon.py`

**Interfaces:**
- `LocalPythonProcess` exposes `result: Promise<RunResult>`, `interrupt(): void`, `kill(): Promise<void>`.
- `PythonRunnerAdapter` keeps `run`、`interrupt`、`dispose`、`state` and `onStateChange`.
- `RunnerState` removes `restarting`; states are `loading | ready | running | interrupting | unavailable`.

- [ ] 先重写 Adapter 测试，只保留成功、并发拒绝、启动失败、硬超时、正常中断、中断宽限超时和 dispose。
- [ ] 新增一次性进程集成测试：一个请求产生一个结果，连续请求使用不同 PID，超时后下一次仍成功。
- [ ] 实现 `run_once.py`：读取一个请求、调用 `execute_request`、输出一个结果后退出。
- [ ] 实现 `PythonRunProcess`：spawn、写入请求并关闭 stdin、解析唯一结果；终止信号后等待 exit。
- [ ] 简化 Adapter：每次 `run` 启动一个进程；超时/中断/dispose 在同一 active 对象上结束，不保留 generation 或 restart barrier。
- [ ] 删除 `execute.py` 的跨请求 `sys.modules`、`sys.path`、`sys.meta_path` 和 cwd 恢复；保留临时目录清理。
- [ ] 删除只验证常驻进程代际、重启屏障和跨请求模块恢复的测试。
- [ ] Run: `npm --prefix rpg test -- src/runners`
- [ ] Run: `npm --prefix rpg run build`
- [ ] Commit: `refactor: run python in one process per request`

## Done Criteria

- 普通 Python builtins 可用，错误信息包含异常类型、消息和玩家源码位置。
- `socket`、`ssl`、`http`、`subprocess` 仍被模块白名单拒绝。
- 每次运行有独立 Python PID；超时、中断和 dispose 后没有残留进程。
- Runner 不再包含 daemon、generation、restart barrier 或不可达 JavaScript 对象防护。
- 阶段 1 战斗内核不改；阶段 2 focused tests 与生产构建通过。
