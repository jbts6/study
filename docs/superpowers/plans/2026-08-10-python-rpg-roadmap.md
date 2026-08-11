# Python RPG 分阶段交付总路线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按可独立验证、可独立提交的顺序完成确定性战斗内核、本地 CPython 执行器、应用外壳与六关战役内容，最终交付可离线游玩、可恢复、可重放的个人 Python RPG。

**Architecture:** 四份实施计划严格串行。战斗内核先建立唯一状态与 Replay 契约；Runner 只消费 `WorldView` 并产出候选 `TurnCommand`；应用外壳统一手动与 Python 命令入口并持久化已接受回合；战役层最后用内容适配器替换单遭遇 bootstrap 内容。任何下游计划不得复制或重定义上游公共类型。阶段 2 采用"信任本地代码"模型：玩家在本机运行自己的 Python，规避浏览器沙箱与远程代码执行的安全审查风险。

**Tech Stack:** Vite 8.2.1、TypeScript 7.0.2、Vitest 4.1.10、Playwright 1.62.1、用户本机 CPython 3.12+（仅标准库）、`ws@8.18.0`（Node 端 WebSocket 服务端）、CodeMirror 6、Web Crypto、IndexedDB/localStorage 双代存档。

## 执行原则

- 严格按 `战斗内核 -> Python Runner -> 应用外壳 -> 战役内容` 执行；四份计划共享 `rpg/`，不得并行写同一工程配置或公共接口。
- 只有战斗内核计划创建 `rpg/`、`package.json` 与基础配置；后三份计划均在既有工程上增量修改。
- 每个详细计划内的每个 `Task` 单独执行测试、审查和本地提交，不把一个阶段堆成单个大提交。
- 每个任务先由实施子代理完成，再由独立复核子代理检查需求覆盖、公共接口、测试失败路径和非预期文件改动；P0/P1 未清零不得进入下一任务。
- 所有版本精确固定并提交 lockfile，不使用 `latest`、范围版本或未验证的私有 API。
- Replay 只记录被战斗内核接受的 `TurnCommand`；Python 源码、子进程对象和 UI 动画状态都不是战斗事实。

## 阶段 1：确定性战斗内核与 Replay

详细计划：[2026-08-10-python-rpg-combat-core.md](./2026-08-10-python-rpg-combat-core.md)

- [ ] 依次完成 6 个任务：严格工程与夹具、命令校验、归约与事件、`WorldView`、JCS Replay、五步无界面验收。
- [ ] 冻结公共接口：`BattleState`、`WorldView`、`TurnCommand`、`CommandResolution`、`resolveTurn`、`projectWorldView`、`createReplay`、`recordAcceptedTurn`、`verifyReplay`。
- [ ] 验证非法命令不修改任何状态，移动总在主动作前，敌方隐藏字段不进入 `WorldView`，重放在首个哈希偏差停止。
- [ ] 完成计划内全部 Vitest、类型检查、构建和固定五步重放验收后再进入阶段 2。

**硬门：** 同一初始状态与已接受命令必须产生相同事件、状态哈希和随机状态；任何不确定性或 Replay 偏差都阻断后续阶段。

## 阶段 2：本地 CPython Runner

详细计划：[2026-08-10-python-rpg-python-runner.md](./2026-08-10-python-rpg-python-runner.md)

> **方向变更（2026-08-11）：** 原"浏览器 Pyodide Worker"方向改为"本地 CPython Runner"。原因是浏览器沙箱层（`SharedArrayBuffer` 中断、COOP/COEP、远程代码执行）反复触发安全审查，且 Pyodide WASM 体积与冷启动开销与首版本地优先边界冲突。新方向采用"信任本地代码"模型：玩家在本机运行自己的 Python，规避浏览器沙箱风险。

- [ ] 依次完成 7 个任务：工程基线与 Python 检测、协议层迁移与 `LocalRunnerChannel`、`PythonBridge` 常驻子进程与 JSON-lines、`PythonRunnerAdapter` 状态机重写、常驻进程隔离与安全轨迹、Node 守护服务 WebSocket 端点、端到端集成验收。
- [ ] 从 `feature/python-runner` 分支 cherry-pick：`runners/protocol/types.ts`、`validate-request.ts` + `.test.ts`、`runners/python/runtime/execute.py` + `.test.ts`、`fixture.ts` 的 `worldViewFixture` 导出。丢弃：`python.worker.ts`、`worker-api.ts`、`tools/runner-proof/`、`e2e/runner-proof.spec.ts`、`pyodide`/`pyodide-worker-runner`/`comsync`/`comlink` 依赖、`vite.config.ts` 的 COOP/COEP 改动。重写：`adapter.ts`（状态机概念保留，底层换 `LocalRunnerChannel`）。
- [ ] 新增依赖仅 `ws@8.18.0`（Node 端 WebSocket 服务端，精确固定，不进浏览器构建）；用户本机预装 CPython 3.12+，`detectPython()` 首次启动校验。
- [ ] 冻结 `LocalRunnerChannel`、`PythonBridge`、`PythonRunnerAdapter`、`startRunnerServer`、`detectPython` 接口；复用阶段 1 的 `WorldView` 与 `TurnCommand`，冻结 `RunRequest`、`RunResult`、`RunnerState`。
- [ ] 验证常驻进程连续运行不泄露 `sys.modules`、`tempfile`、stdout 缓冲；`SIGINT` 中断、硬超时 `kill` 重建、并发拒绝、`dispose` 清理；Node 守护服务接受 WebSocket 连接并转发请求。
- [ ] 完成计划内协议测试、Bridge 测试、Adapter 测试、隔离测试、Node 服务测试、端到端集成测试（本机有 Python 时全绿，无 Python 时跳过并标记原因）后再进入阶段 3。

**硬门：** 子进程崩溃、硬超时或致命错误后旧 Python 子进程必须 `kill`，下一次运行必须来自全新 spawn 的子进程；本地运行器不可用时游戏明确暂停代码关卡，不静默降级。

## 阶段 3：应用外壳、存档与编辑体验

详细计划：[2026-08-10-python-rpg-app-shell.md](./2026-08-10-python-rpg-app-shell.md)

> **阶段 2 方向变更的影响：** 应用外壳新增"本地运行器连接状态"UI（连接 `localhost:5175`、断开、重连、Python 不可用提示）。`RunnerPort` 抽象保持不变，但默认实现从"浏览器 Worker"改为"WebSocket 连本地 Node 守护服务"。运行器不可用时代码关卡明确暂停，不静默降级。

- [ ] 依次完成 9 个任务：工程增量、版本化存档、双代恢复、统一控制器、语义外壳、战场交互、Python 编辑器、生产启动、跨视口验收。
- [ ] 手动命令和 Runner 命令只通过阶段 1 的 `resolveTurn`；接受后以 `recordAcceptedTurn` 追加 Replay，拒绝时不推进状态或存档。
- [ ] 冻结应用边界：结构化 `RunnerPort`、`AppContentPort`、`SaveStore`、`SavePayload`、`ReplayRecord`、`AppController` 与测试依赖注入入口。
- [ ] `RunnerPort` 默认实现为 WebSocket 客户端，连阶段 2 的 Node 守护服务；连接状态（`loading/ready/running/interrupting/restarting/unavailable`）显式呈现给玩家，断开时禁用运行按钮并提示重连。
- [ ] 先用计划内的单遭遇 `createBootstrapAppContent` 保证本阶段可独立启动、游玩、保存和重放；阶段 4 再替换为正式六关内容端口。
- [ ] 验证历史存档按声明版本解码后迁移、双代恢复、校验和、损坏重放隔离、运行令牌防陈旧结果覆盖、事件批次只播放一次、运行器断线重连后状态正确恢复。
- [ ] 完成单元测试、集成测试、Playwright 桌面/移动/键盘/减弱动效验收和生产构建后再进入阶段 4。

**硬门：** 正常生产入口在没有测试覆盖对象时也必须启动；损坏存档或 Replay 必须显式进入恢复流程，不能静默丢档或伪造新状态；本地运行器不可用时代码关卡明确暂停。

## 阶段 4：六关战役、内容校验与素材账本

详细计划：[2026-08-10-python-rpg-campaign.md](./2026-08-10-python-rpg-campaign.md)

- [ ] 依次完成 6 个任务：共享严格 decoder/双加载器与 BattleState 装配、严格 JSON/奖励与全引用检查器、六关 Python 与 gate/combat/replay 验收、AppContentPort 完整适配、AppController lifecycle 与恢复动作、真实资产与多回合 Playwright 验收。
- [ ] 保持六个关卡 ID 与顺序固定：`python-marsh-01` 至 `python-marsh-06`；内容加载同时支持浏览器 `fetch` 与 Node 检查器，二者共享同一运行时 decoder。
- [ ] 隐藏断言在 `resolveTurn` 前执行；不符合关卡契约的候选命令不得进入战斗内核、Replay 或存档。
- [ ] 战役协调器只在 `phase === "won"` 且 Replay 验证通过后幂等奖励；重试从场景初始状态深拷贝，不能沿用失败回合状态。
- [ ] 内容检查器验证 schema、ID/顺序、世界/奖励引用、路径安全、素材 ID 与许可账本；任一失败均阻断构建。
- [ ] Playwright 从第一关开始逐回合执行真实 solution，验证六关解锁、奖励、草稿、重试、存档恢复、Replay 和 Runner 不可用分支。

**硬门：** 六关必须在现有战斗胜负规则下真实到达 `won`，不能由 E2E 直接改状态或绕过隐藏断言；浏览器内容不得静态导入 Node 模块。

## 总体验收

- [ ] 从全新 checkout 安装精确依赖并运行完整 typecheck、Vitest、内容检查、生产构建和 Playwright。
- [ ] 用固定种子完整通关六关，刷新页面恢复进度，导出再导入存档，并逐一验证保存的 Replay。
- [ ] 模拟语法错误、运行时错误、超时、中断、Python 子进程崩溃、Node 守护服务断线、存档损坏、Replay 篡改、离线刷新、本机 Python 不可用和小屏只读场景。
- [ ] 检查生产包不含 Python 服务端远程执行依赖、Pyodide/WASM 资源、未登记资产、调试 fixture、浮动版本或本机绝对路径；`ws` 仅出现在 Node 守护服务侧，不进浏览器构建。
- [ ] 更新项目设计/模块记录并保留每任务提交；最终提交只包含已验证的集成收尾，不压缩或改写前序任务历史。

## 止损条件

- 用户本机 Python 3.12+ 检测或 `daemon.py` 启动失败率超预期（如 Windows 路径编码、SIGINT 信号传递差异）：回退到"每请求 fork 子进程"模式，保留 `PythonRunnerAdapter` 契约和 `LocalRunnerChannel` 接口，只换 `PythonBridge` 实现。
- 战斗结果或 Replay 在重复运行中不一致：回到阶段 1 修复，删除所有依赖该错误契约的下游适配，不做兼容垫片。
- 存档迁移无法无损验证：保留原始备份并阻断写回，不提高 schemaVersion 掩盖失败。
- 内容关卡无法通过隐藏断言和战斗规则同时完成：修改内容或已公开的正式契约并重新跑上游验收，禁止 E2E 特判通关。
