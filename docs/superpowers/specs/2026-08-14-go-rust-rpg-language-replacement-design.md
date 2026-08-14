# Go 与 Rust RPG 独立战役设计

## 目标

在现有 Python 战役之外，新增 Go 与 Rust 学习战役，同时保留已经完成的回合制战斗、六关流程、存档、VS Code 双栏体验和本地运行方式。

这不是把 TypeScript 游戏内核重写成 Go 或 Rust。Go 与 Rust 是玩家代码的语言；游戏宿主、战斗规则、Webview 和 VS Code 扩展继续使用当前 TypeScript 实现。

## 已确认的边界

- 本项目是单人本地学习游戏，采用信任本地代码模型。运行玩家自行编辑的 Python、Go/Rust 代码，不建设恶意代码隔离或容器平台。
- 继续处理编译错误、运行时错误、超时、中断、未安装工具链和损坏存档；不为极端进程竞态或跨版本迁移设计额外状态机。
- 保留 `WorldView -> 玩家函数 -> TurnCommand -> validateLevelCommand -> resolveTurn` 的游戏数据流。
- `TurnCommand` 仍是 JSON 对象。语言适配器负责把语言原生结构编码为 JSON 后返回给 Node/TypeScript，不让 Go/Rust 类型穿透游戏协议。
- 不尝试保留 Python 的逐行局部变量追踪。编译型语言的调试信息应以编译诊断、panic 回溯和结构化的 `println!/fmt.Println` 输出为主。

## 现状与拆分点

当前 Python 专属耦合集中在：

| 层 | 当前耦合 | 演进目标 |
| --- | --- | --- |
| 关卡内容 | `python-marsh-*` ID、Python 模板与 Python 文案 | 三套独立战役的关卡 ID、模板、教学文本与递进；仅复用语言无关的战斗骨架 |
| 请求协议 | `language: "python"`、`allowedModules` | `language: "python" | "go" | "rust"`；仅 Python 请求保留模块白名单 |
| 应用控制器 | 固定 `main.py` / `choose_turn` / `math` | 从关卡语言配置取得项目文件、入口约定与工具链 |
| 工作区 | `python-rpg/<level>.py` | 语言独立目录与每关一个可读源码文件 |
| 本地运行器 | CPython 探测、`execute.py`、解释器追踪 | Go/Rust 工具链探测 + 临时项目编译和执行 |
| 编辑器 | CodeMirror Python 支持 | 根据战役加载 Go 或 Rust 语法支持 |

`src/game/combat/`、`src/game/campaign/`、`src/game/world/`、存档的战斗状态、战役推进和绝大部分 Webview 均不因语言替换而变化。

## 推荐架构

先引入一层很小的“语言战役描述”，不要马上泛化为插件注册框架。每个语言战役独立维护关卡数量、教学内容与源码模板，不能假设三者始终同关数或同进度。

```text
LevelDefinition
  ├─ 战斗定义、奖励、引导目标                 继续复用
  └─ PlayerProgramDefinition
       ├─ language: python | go | rust
       ├─ workspaceDirectory: "python-rpg" | "go-rpg" | "rust-rpg"
       ├─ sourceFileName(levelId): string
       ├─ starterFiles(level): Record<string, string>
       └─ runConvention: 固定的项目入口约定

AppController
  └─ 按 PlayerProgramDefinition 创建 RunRequest

RunnerClient
  └─ LanguageRunner (PythonRunner | GoRunner | RustRunner)
       └─ 临时项目 -> 编译 -> 执行 -> 单行 JSON RunResult
```

`RunRequest` 保持顶层相关性字段、`worldView`、限制和 `files`；把 `language` 扩展为 `"python" | "go" | "rust"`。`allowedModules` 继续作为仅 Python 的适配器字段，不进入 Go/Rust 的通用协议。编译型语言的入口不再表达“可调用函数名”，改为固定项目约定：每个临时项目均由宿主生成 `main`，它读取 stdin 的 `WorldView` JSON，调用玩家导出的策略函数，向 stdout 写出一行 `TurnCommand` JSON。

这让宿主能始终控制 stdin/stdout 协议，玩家只需实现强类型策略函数。

## 统一玩家 API

两个语言共享语义，字段名与现有 `WorldView`、`TurnCommand` JSON 完全一致。公共 SDK 只负责 JSON DTO，不能把战斗解析复制到各语言中。

### Go

玩家工作区中每关只保存一个 `.go` 文件，固定为 `package main`，且不得自行实现 `main`；执行器在扩展管理的构建目录生成同包 API 和包装器。玩家实现 `ChooseTurn`：

```go
package main

func ChooseTurn(world World) TurnCommand {
    return TurnCommand{
        ActorID: world.ActiveUnitID,
        ExpectedRevision: world.Revision,
        Action: Action{Type: "wait"},
    }
}
```

宿主生成的 `runner_main.go` 负责 `json.NewDecoder(os.Stdin)`、调用 `ChooseTurn`、把最终命令 JSON 写入 `RPG_RESULT_PATH`。同包 API 定义 `World`、坐标、单位、技能与扁平的 `TurnCommand`/`Action` 结构体，字段使用 JSON tag 保持 `actorId`、`expectedRevision`、`movePath`、`action`。保持扁平结构，继续让 TypeScript 规则层反馈非法字段组合，不为六关教学引入 Go 接口体系。

玩家 API 不返回 `error`：回合策略是纯同步选择；程序级失败由编译错误、panic 和超时统一报告。这样第一关不会被 Go 的错误处理噪音淹没。

### Rust

每个关卡在玩家工作区中保存一个 `.rs` 文件，扩展维护固定 Cargo workspace 和稳定 shim 模块来引用当前关卡源码。玩家编辑：

```rust
use rpg_sdk::{TurnCommand, TurnResult, World};

pub fn choose_turn(world: &World) -> TurnResult {
    Ok(TurnCommand::wait(world))
}
```

稳定 `rpg_turn_runner` 从 stdin 解码 `WorldView`，调用 `player::choose_turn(&world)`，把最终 JSON 写入 `RPG_RESULT_PATH`。`rpg_sdk` 是工作区内 path crate，使用 `serde`/`serde_json` 定义 DTO、带标签的 `Action` 枚举与命令构造器。

`TurnResult` 是 `Result<TurnCommand, String>`。正常策略使用 `Ok(...)`；`Err` 只表示玩家明确放弃本回合并给出解释，运行器将其映射为 `PLAYER_DECISION_ERROR`。它不替代 panic 诊断，也不应把错误处理扩展成六关基础循环的主题。

## 编译与运行

运行器维护扩展管理的稳定构建工作区。Node 在每次运行前同步编辑器内未保存的关卡源码，先构建、再启动已构建产物；Node 通过参数数组调用子进程，绝不拼接 shell 命令。最终命令走独立结果文件，因此玩家日志仍可保留在 stdout/stderr。

| 项目 | Go | Rust |
| --- | --- | --- |
| 工具链探测 | `go version`，要求一个明确的稳定下限 | `cargo --version` 与 `rustc --version`，要求一个明确的 stable 下限 |
| 编译执行 | `go build -o <cache>/strategy.exe .`，再启动产物 | `cargo build --locked --bin rpg-turn-runner`，再启动 `target` 产物 |
| 输入输出 | stdin 输入世界 JSON；宿主将最终命令写入结果文件；玩家日志保留为输出流 | 同左 |
| 错误分类 | `compile_error`、`runtime_error`、`timeout`、`interrupted`、`runner_error` | 同左 |
| 取消 | 对整个子进程树发送中断，宽限期后终止 | 同左 |

编译型语言不能沿用 Python 的单段 5 秒运行预算。构建与策略运行必须有独立计时与状态：Go 首次构建 15 秒、缓存命中后的策略运行 5 秒；Rust 首次构建 30 至 60 秒、热构建 8 至 12 秒、策略运行 2 至 5 秒。界面明确显示“首次编译”，而不是错误报告回合超时。

Go 采用最小内容寻址缓存：键由玩家源码、Go API 版本、`go version` 和目标平台组成，产物放在扩展 `globalStorageUri`，不在玩家工作区留下二进制或 `go.mod`。未命中时生成最小模块和固定包装器并执行 `go build`；命中时直接运行已构建二进制。Rust 使用固定 Cargo workspace 及其 `target/` 增量缓存，工作区的 `Cargo.toml`、`Cargo.lock`、SDK crate 和二进制入口都由扩展维护。两者都不做后台预编译、预热任务或跨工具链共享缓存。

Go 的模块依赖固定为项目内 `rpg/sdk`，`GONOSUMDB`、联网拉取、第三方模块均不进入设计。Rust 的依赖固定在工作区 `Cargo.lock` 中，玩家关卡不能自行修改 `Cargo.toml`；首版仅使用 `serde`、`serde_json`（SDK 内部）。这是可重复运行的教学约束，不是对抗性隔离。

## 诊断与教学反馈

删除 `TraceEvent`、`maxTraceEvents`、`maxValueDepth` 和 Python 局部变量快照后，`RunResult` 保留：执行状态、诊断、stdout/stderr（限长）和耗时。

新增或统一以下诊断规则：

- 编译失败：从 Go/Rust 编译器输出中提取玩家文件的行列、保留原始中文解释和恢复动作；临时目录绝对路径替换为工作区相对路径。
- 运行失败：报告 panic/异常摘要、玩家源码中的首个可定位帧和重新运行指引。
- JSON 协议失败：宿主输出非法命令时定位为 `INVALID_TURN_RESULT`，提示使用 SDK 的 `TurnCommand`/构造器，不显示完整内部模板。
- 标准输出：玩家调试输出写 stderr；宿主专用 stdout 只写最终 JSON。这避免日志污染命令协议。
- UI：沿用现有诊断面板与战斗反馈，不再展示逐行局部变量；模板和关卡引导使用“编译器会指出源码行”的措辞。

## 关卡与存档迁移

交付为三个独立战役，不在同一存档里混编语言。目录、关卡数、教学文本、模板和进度彼此独立，允许随各自教学需要演进：

- Go 战役使用独立的 `go-marsh-*` 关卡 ID 与工作区目录 `go-rpg/`。
- Rust 战役使用独立的 `rust-marsh-*` 关卡 ID 与工作区目录 `rust-rpg/`。
- `python-marsh-01` 至 `python-marsh-06` 保持可玩，工作区目录 `python-rpg/`；Python 战役不删除，也不降级为仅维护模式。

原因是：源文件语法、学习目标和玩家已有文件都不同；把同一关 ID 从 `.py` 原地换成 `.go`/`.rs` 会破坏存档和复盘。三套战役可以复用地图与战斗数值骨架，但每种语言各自决定使用哪些关卡、模板、解释和逐关概念递进。不要把旧 `.py` 静默重命名或转换。

## 分阶段实施顺序

### 阶段 0：语言战役底座

1. 将 `RunRequest`、请求校验、`AppController.createRunRequest` 和 `LevelDefinition` 改为读取 `PlayerProgramDefinition`，同时保留 Python 适配器的 `allowedModules` 与现有入口约定。
2. 将 VS Code 工作区路径、扩展名和 CodeMirror 语法模式改为关卡语言配置。
3. 保持 Python 适配器工作，用它回归六关。此阶段没有 Go/Rust 编译器调用。

验收：Python 六关的现有源码文件不被覆盖；运行、诊断、存档恢复、重置和 VS Code 打开关卡行为不变。

### 阶段 1：Go 垂直切片

1. 提供项目内 Go SDK 和临时项目生成器。
2. 实现 Go 探测、进程管理、编译错误映射和 JSON 命令回传。
3. 仅制作 `go-marsh-01`，使等待、攻击、非法命令、编译错误、未安装 Go、超时和中断可验证。
4. Go 第一关验收后，按 Go 自己的教学节奏扩展后续关卡、模板和引导；不预设关卡总数。

验收：Go 玩家可在 VS Code 左侧编辑一关源码、右侧运行一个回合；游戏内核只接受 JSON 指令；失败信息定位到玩家源文件。

### 阶段 2：Rust 垂直切片

1. 在 Go 第一关稳定后，在相同协议和诊断模型下加入 Rust SDK、Cargo 临时项目和工具链探测。
2. 先制作 `rust-marsh-01`，确认借用、枚举和 serde DTO 的模板不会遮蔽回合策略本身。
3. 再按 Rust 自己的教学节奏扩展后续关卡，逐步引入结构体/枚举、集合遍历、模式匹配与所有权相关的最小概念；不预设关卡总数。

验收：Rust 的编译/运行失败不影响 Go 或 Python；同一张地图产生的合法命令在三种语言下得到相同战斗结算。

### 阶段 3：收敛

1. 逐语言审阅关卡提示与命令示例，避免把 Python 字典表述遗留到 Go/Rust。
2. 只保留每个运行器的正常路径和一个关键失败路径测试；不要为工具链内部实现补测试矩阵。
3. 更新 README、扩展设置、工具链缺失提示和本机安装包。

## 关键风险与止损

| 风险 | 处理 |
| --- | --- |
| 编译耗时破坏回合节奏 | 先测量；若第一关冷启动超出可接受交互时间，再做内容寻址缓存，不预先复杂化 |
| SDK 过大，教学被 DTO 淹没 | 只公开世界读取字段、命令结构和五个动作构造器；不暴露游戏规则实现 |
| Rust 模板过早引入生命周期/trait | 策略函数只借用 `&WorldView`，SDK 返回拥有的 `TurnCommand`，首版不需要泛型或 trait 教学 |
| 诊断混入临时路径和宿主源码 | 运行器在返回 `RunResult` 前过滤临时路径，只显示 `strategy.go`/`src/strategy.rs` 与行列 |
| 多语言复制六份战斗数据后漂移 | 地图、敌人和奖励仍由一份语言无关关卡骨架生成；仅模板与文本按语言分离 |
| 三套战役互相牵制 | 只共享底层战斗、宿主和协议能力；Python、Go、Rust 的关卡、教学、模板、目录和进度独立维护，新增语言功能不得破坏 Python 的现有体验 |

## 明确不做

- 不重写战斗内核或把宿主迁移到 Go/Rust。
- 不做 Docker、沙箱、远程执行、网络服务暴露或恶意代码防护。
- 不允许玩家添加第三方 Go module 或 Cargo crate。
- 不做 Python、Go、Rust 之间的源码转换，也不迁移已有玩家代码。
- 不做逐行变量追踪、调试器协议或跨运行持久编译缓存的第一版实现。

## 推荐决策

先完成阶段 0 和 Go 第一关。Go 的单文件/显式结构体模型更适合作为编译型语言在当前 RPG 中的首个证明点；Rust 在复用协议、错误模型和 VS Code 路径配置后，风险会集中在教学模板而不是运行器架构。Go 第一关通过验收后，才进入 Rust 垂直切片。

## 已确认决策

- Python、Go、Rust 三者均保留为独立战役。除游戏内核、语言战役描述、运行请求和 VS Code 宿主能力外，关卡定义、教学内容、源码模板、工作区和玩家进度都按语言分离；每种语言可独立调整关卡数量与教学顺序。
- 当前只实施 Go 第一关垂直切片。它是语言战役底座、Go 运行器、诊断和 VS Code 体验的第一个证明点；Go 第一关通过验收前，不启动 Rust 实现。
- Rust 的首次构建耗时暂按 30 至 60 秒呈现为“首次编译”。实际 Rust 垂直切片启动时测量该体验，再决定是否调整缓存策略；该测量不阻塞 Go 第一关。
