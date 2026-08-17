# 本地编程学习工坊

这是一个面向个人、本机运行的编程学习仓库。当前学习主线按 Python、Go、Rust 依次推进；奥术工业幻想 Python RPG 保留为可选的项目化练习，不再限定全部课程形态。

## 多语言学习工坊

- [`learning/`](learning/)：三门语言的学习顺序、阶段、来源和启动入口。
- [`python/interactive-course/`](python/interactive-course/)：当前可运行的 Python 基础与自动化课程。
- [`go/interactive-course/`](go/interactive-course/)：现有 Go 工程与并发课程。
- [`rust/interactive-course/`](rust/interactive-course/)：现有 Rust 系统建模课程。
- [`rpg/`](rpg/)：使用 Python 完成六关战术任务的可选综合练习。

启动当前 Python 课程：

```bash
cd python/interactive-course
npm start
```

然后打开 <http://127.0.0.1:8010>。课程要求 Node.js `24.15.0` 和 CPython `3.12+`；详细说明见 [`python/README.md`](python/README.md)。

## 奥术工业幻想 Python RPG

这是一个单人、本机运行的回合制战术 RPG 学习项目。玩家编写 Python 代码来施法、读取战场状态并返回回合指令；项目位于 [`rpg/`](rpg/)。

## 核心前提

本项目以“个人游戏、仅本地运行”为最高工程前提：

- 只为六关主线流程和能够实际复现的玩家问题开发功能。
- 玩家运行的是自己编写的本地 Python 代码；Runner 是本地代码执行器，不是对抗恶意代码的安全沙箱。
- 优先保证常用 Python 写法可用、错误信息可读、失败后能重新运行。
- 只处理常见本机故障，例如 Python 缺失、代码超时、进程退出和请求格式错误。
- 不为公网部署、多用户、恶意输入、长期兼容或想象中的未来扩展增加机制。
- 测试以主流程和一个关键失败路径为主；能够通过简化实现消除的问题，不用更多防御代码和测试矩阵覆盖。

需要保留的真实边界只有：Runner 仅监听回环地址、不接收外部不可信代码、不把玩家代码发送到远端，并继续通过模块白名单阻止 `socket`、`ssl`、`http`、`subprocess` 等模块。

## 当前阶段

阶段 1 已建立战斗核心和应用外壳。阶段 2 已建立本地 Python Runner。当前主入口已演进为 VS Code 插件：左侧编辑关卡 Python 文件，右侧显示战场，运行结果直接反馈到游戏面板与 VS Code 诊断。

1. 恢复标准 Python 内建函数，并直接显示语法错误和运行时异常的位置与消息。
2. 每次运行启动一个独立 Python 子进程；运行结束即退出，不再维护 daemon、generation 或 restart barrier。
3. Runner 请求只校验真实 JSON 数据、路径、入口函数、限制值和模块白名单，不再防御 JavaScript Proxy、访问器或对象冻结绕过。

当前 Runner 链路如下：

```text
本机 WebSocket
  -> PythonRunnerAdapter
  -> 单次 Python 子进程
  -> execute_request
  -> JSON 运行结果
```

进程隔离自然清除每次运行产生的 Python 模块、工作目录和解释器状态；Adapter 只负责当前运行的超时、中断、终止和结果回传。

VS Code 插件不经过上述 WebSocket 服务，而是由扩展宿主直接调用 `PythonRunnerAdapter` 和单次 Python 子进程。网页链路仅保留为开发预览。

## VS Code 插件运行

在仓库根目录安装依赖后按 `F5`，选择“运行 Python RPG 扩展”。在 Extension Development Host 中打开一个工作区文件夹，再从命令面板运行“Python RPG: 打开游戏”。

```bash
npm ci --prefix rpg
```

插件会创建缺失的 `python-rpg/python-marsh-01.py` 至 `python-marsh-06.py`，但不会覆盖已有代码。`Ctrl+Enter` 始终运行当前关卡绑定文档的最新内容，包括未保存修改。

运行真实 VS Code 扩展宿主集成测试：

```bash
cd rpg
npm run test:extension
```

## 网页开发预览

要求：Node.js `24.15.0`、CPython `3.12+`。

```bash
cd rpg
npm ci
```

启动本地 Runner，默认只监听 `127.0.0.1:5175`：

```bash
npm run runner
```

另开终端启动前端开发服务器：

```bash
cd rpg
npm run dev
```

常用验证命令：

```bash
cd rpg
npm test -- src/runners
npm run build
```

## 目录

- `learning/`：Python、Go、Rust 的公共学习目录。
- `python/interactive-course/`：独立的本地 Python 交互课程。
- `go/interactive-course/`：现有 Go 交互课程。
- `rust/interactive-course/`：现有 Rust 交互课程。
- `rpg/src/game/`：战斗规则、状态和测试夹具。
- `rpg/src/runners/local/`：本地 WebSocket 服务、Python 检测、运行适配器和单次进程管理。
- `rpg/src/runners/python/runtime/`：玩家文件加载、模块白名单、执行、追踪和结果序列化。
- `rpg/src/runners/protocol/`：Runner 请求与结果类型、基础 JSON 校验。
- `docs/superpowers/plans/`：当前 Roadmap 与近期实施记录。

当前简化方案见 [`docs/superpowers/plans/2026-08-11-python-rpg-local-simplification.md`](docs/superpowers/plans/2026-08-11-python-rpg-local-simplification.md)。更具体的工程取舍以 [`AGENTS.md`](AGENTS.md) 为准。
