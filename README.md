# 奥术工业幻想 Python RPG

这是一个单人、本机运行的回合制战术 RPG 学习项目。玩家编写 Python 代码来施法、读取战场状态并返回回合指令；当前主项目位于 [`rpg/`](rpg/)。

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

阶段 1 已建立战斗核心和应用外壳。阶段 2 已建立本地 Python Runner，并按上述前提完成一轮收敛：

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

## 本地运行

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

- `rpg/src/game/`：战斗规则、状态和测试夹具。
- `rpg/src/runners/local/`：本地 WebSocket 服务、Python 检测、运行适配器和单次进程管理。
- `rpg/src/runners/python/runtime/`：玩家文件加载、模块白名单、执行、追踪和结果序列化。
- `rpg/src/runners/protocol/`：Runner 请求与结果类型、基础 JSON 校验。
- `docs/superpowers/plans/`：当前 Roadmap 与近期实施记录。

当前简化方案见 [`docs/superpowers/plans/2026-08-11-python-rpg-local-simplification.md`](docs/superpowers/plans/2026-08-11-python-rpg-local-simplification.md)。更具体的工程取舍以 [`AGENTS.md`](AGENTS.md) 为准。
