# Rust 六阶段学习路线图

> 面向有前端开发经验的中文读者，从稳定版工具链和可验证练习开始，逐步进入异步综合项目。路线按阶段完成，不按固定天数排期；上游仓库内容、版本和命令以各自当前 README 为准。

## 使用方式

每个阶段按“主线阅读 -> 练习验证 -> 整理产出 -> 运行检查”的顺序推进。阶段未满足完成标准时，先缩小到一个可复现的编译或测试问题，再回到对应主线；不要用读完章节或投入时长替代可验证结果。

统一使用 stable Rust。环境准备和本地项目可先用以下基础命令确认工具链可用：

```text
rustup toolchain install stable
rustup default stable
rustc --version
cargo --version
cargo new rust-roadmap-check
cd rust-roadmap-check
cargo +stable check
```

上游练习、课程和项目的安装、启动、检查命令只按仓库当前 README 提供的入口执行，不在本路线图中固化可能过期的脚本参数。

## 阶段导航

| 阶段 | 主题 | 阶段闸门 |
|---|---|---|
| 阶段 1 | 工具链与 Rust 工作流 | 能创建、检查并解释一个 stable Cargo 项目 |
| 阶段 2 | 基础语法和标准库 | 基础练习通过，能处理集合和显式错误 |
| 阶段 3 | 所有权与泛型抽象 | 能用借用、生命周期、trait 和泛型完成可编译抽象 |
| 阶段 4 | 工程化习惯 | 项目具备模块、测试、文档和格式化检查 |
| 阶段 5 | 异步 Rust | 能区分运行时、任务、共享状态和阻塞操作 |
| 阶段 6 | 异步综合项目 | 能从 mini-redis 的模块边界迁移一个个人项目功能切片 |

## 阶段 1：工具链与 Rust 工作流

### 阶段目标

安装并使用 stable Rust，理解 `rustup`、`rustc`、Cargo 的职责边界，能创建 Cargo 项目、阅读项目结构，并用检查命令反馈编译问题。

### 主线入口

- [sunface/rust-course](https://github.com/sunface/rust-course)：从环境和 Rust 基本工作流入口开始阅读。
- [rust-lang/book](https://github.com/rust-lang/book)：遇到工具链或 Cargo 概念分歧时查阅官方解释。

### 练习入口

- [rust-lang/rustlings](https://github.com/rust-lang/rustlings)：按仓库当前 README 完成安装和第一组练习，使用编译反馈定位错误。
- 自建一个最小 Cargo 二进制项目，重复执行 `cargo +stable check`，观察 `Cargo.toml`、`src/main.rs` 和构建目录的关系。

### 建议产出

- 一份工具链检查记录，包含 stable 版本、Cargo 版本和项目创建结果。
- 一个能通过 `cargo +stable check` 的最小项目，以及对 Cargo 项目结构的简短说明。

### 完成标准

- `rustc --version` 和 `cargo --version` 可运行，且当前项目使用 stable 工具链。
- 能从零创建 Cargo 项目并通过 `cargo +stable check`。
- 能说明 `rustup`、`rustc` 和 Cargo 的用途，并能根据编译输出定位入口文件或依赖配置。

### 卡点处理

先确认 `rustup show` 和版本输出，再区分工具链安装问题、项目目录问题和源码编译问题；只保留一个最小失败案例，修复后重新运行 `cargo +stable check`。

## 阶段 2：基础语法和标准库

### 阶段目标

掌握变量与可变性、基本类型、函数、控制流、结构体、枚举、模式匹配、字符串、集合，以及 `Option` 和 `Result` 等显式错误处理方式。

### 主线入口

- [sunface/rust-course](https://github.com/sunface/rust-course)：作为中文概念主线，按基础语法和标准库主题顺序阅读。
- [rust-lang/book](https://github.com/rust-lang/book) 与 [rust-lang/rust-by-example](https://github.com/rust-lang/rust-by-example)：分别用于概念核对和可运行示例查阅。

### 练习入口

- [rust-lang/rustlings](https://github.com/rust-lang/rustlings)：与主线并行，优先完成类型、函数、控制流、集合和错误处理相关练习。
- 使用自己的 Cargo 小项目把一个输入处理流程改成显式的 `Option`/`Result` 返回，不复制上游答案。

### 建议产出

- 一组通过编译的基础练习记录，标注每次错误属于类型、借用前置概念、匹配或错误处理哪一类。
- 一个能读取输入、处理集合并返回错误的命令行小程序或等价库函数，附少量输入和错误案例。

### 完成标准

- Rustlings 基础主题练习能按当前上游入口运行并通过。
- 能用 `match` 或组合方法显式处理 `Option` 和 `Result`，不以隐式异常或空值作为主要错误路径。
- 小项目通过 `cargo +stable check`，并能解释字符串、集合和错误类型的选择。

### 卡点处理

先把失败代码缩减为单个函数和一个输入，再用 `rustc`/Cargo 的第一条相关错误定位类型；字符串或集合困惑时先画出拥有值、借用值和返回值的关系，再回到中文主线和官方示例核对。

## 阶段 3：所有权与泛型抽象

### 阶段目标

建立所有权、移动、借用和生命周期的模型，并把它们应用到 trait、泛型、迭代器或闭包等抽象中，理解编译器如何约束引用安全代码。

### 主线入口

- [sunface/rust-course](https://github.com/sunface/rust-course)：沿所有权、借用、生命周期、trait 和泛型主线推进。
- [rust-lang/book](https://github.com/rust-lang/book)：作为所有权、生命周期、trait 和泛型的权威概念基准。

### 练习入口

- [rust-lang/rustlings](https://github.com/rust-lang/rustlings)：继续完成所有权、借用、生命周期和泛型相关的小步练习。
- [mainmatter/100-exercises-to-learn-rust](https://github.com/mainmatter/100-exercises-to-learn-rust)：掌握基础后按顺序完成对应练习，记录编译错误类型；solutions 只用于完成后的复盘。
- [rust-unofficial/too-many-lists](https://github.com/rust-unofficial/too-many-lists)：作为可选专题，选读链表实现中与 `Box`、`Rc` 和借用有关的章节。

### 建议产出

- 一份所有权卡点复盘，至少包含一次移动、一次共享借用、一次可变借用和一次生命周期约束的最小示例。
- 一个使用 trait 和泛型处理两种以上输入类型的可测试函数或小模块。
- 100 Exercises 的阶段练习记录，以及 Too Many Lists 选读章节的概念对照笔记（如适用）。

### 完成标准

- Rustlings 的所有权和抽象相关练习能通过；100 Exercises 当前对应主题的练习能按上游入口完成并复盘。
- 能解释借用规则、生命周期约束和 trait bound 如何共同影响函数签名，并能修复至少一类相关编译错误。
- 泛型/trait 小模块通过 `cargo +stable check`，且至少有一个行为验证或测试案例。

### 卡点处理

遇到借用检查器错误时先判断冲突发生在移动、借用范围还是返回引用，再缩小函数签名和变量作用域；生命周期标注无法判断时优先参考官方 Book 的模型，不通过复制答案绕过编译器。

## 阶段 4：工程化习惯

### 阶段目标

把已掌握的语言能力组织成可维护项目：理解模块与包边界，使用 Cargo 管理构建和依赖，编写测试与文档，并形成格式化、Clippy 和错误复盘习惯。

### 主线入口

- [sunface/rust-course](https://github.com/sunface/rust-course)：阅读模块、Cargo、测试和工程实践相关内容。
- [rust-lang/book](https://github.com/rust-lang/book)：核对模块系统、测试和文档注释的官方规则。

### 练习入口

- 在前一阶段的小项目中拆分模块、补充单元测试和文档注释。
- 使用 stable 工具链运行 `cargo +stable test`、`cargo +stable fmt --check`、`cargo +stable clippy --all-targets -- -D warnings` 和 `cargo +stable doc --no-deps`，按上游或项目实际配置调整检查范围。

### 建议产出

- 一个按模块组织的 Cargo 项目，包含公开 API 的文档注释、正常路径和错误路径测试。
- 一份工程检查记录，记录 `check`、测试、格式化、Clippy 和文档命令的结果。
- 一份错误复盘，说明一个失败的设计或编译问题、定位过程和最终改动。

### 完成标准

- 项目能通过 `cargo +stable test`，核心行为有自动化测试覆盖。
- `cargo +stable fmt --check`、`cargo +stable clippy --all-targets -- -D warnings` 和 `cargo +stable doc --no-deps` 在当前项目配置下通过，或对不适用项留下明确原因。
- 能说明模块、包、依赖和测试的边界，并能从一次失败输出复盘出可重复的修复步骤。

### 卡点处理

先运行最小相关命令再扩大范围：模块问题看路径和可见性，测试问题看失败用例，Clippy 问题区分真实缺陷与项目约定；不把警告简单关闭，必须在产出中记录处理理由。

## 阶段 5：异步 Rust

### 阶段目标

理解 `async`/`await`、Future、运行时、任务、共享状态和阻塞操作之间的关系，能在同步 Rust 基础上写出可测试的异步代码。

### 主线入口

1. [rust-lang/async-book](https://github.com/rust-lang/async-book)：先阅读异步基础、运行时、任务和并发模型。
2. [tokio-rs/mini-redis](https://github.com/tokio-rs/mini-redis)：完成 Async Book 对应概念后，再阅读 Tokio 学习项目的入口和模块边界。

### 练习入口

- 在独立 Cargo 项目中练习一个异步任务、一个共享状态场景和一个明确的阻塞操作隔离场景。
- 运行并检查 `mini-redis` 时只使用仓库当前 README 提供的入口，把 TCP、帧解析、共享状态、并发连接、测试和优雅退出列为阅读检查项。

### 建议产出

- 一张异步执行模型图，标出运行时、任务、Future、共享状态和阻塞操作的边界。
- 一个带测试的最小异步示例，并记录同步原语与异步场景的选择理由。
- 一份 Async Book 到 mini-redis 的概念映射表。

### 完成标准

- 能先完成 Async Book 对应章节，再解释 mini-redis 中运行时、任务、共享状态和网络处理的关系。
- 最小异步示例能通过当前项目的 `cargo +stable check` 和测试命令。
- 能指出阻塞操作的风险，并说明为什么不能把同步 `std::sync::Mutex` 的使用方式不加区分地套入异步代码。

### 卡点处理

先确认问题属于 Future 未执行、运行时未配置、任务生命周期、共享状态竞争还是阻塞操作，再回到 Async Book 的对应章节；不要先复制 mini-redis 实现，必须用最小示例复现并保留检查结果。

## 阶段 6：异步综合项目

### 阶段目标

通过阅读和运行 `mini-redis` 理解一个异步网络项目的模块边界、错误处理、并发连接、共享状态、测试和优雅退出，并把工程取舍迁移到个人项目。

### 主线入口

- [tokio-rs/mini-redis](https://github.com/tokio-rs/mini-redis)：按仓库当前结构阅读和运行，重点关注模块职责和边界，不复制实现。
- [rust-lang/async-book](https://github.com/rust-lang/async-book)：遇到异步模型或运行时概念分歧时回查。

### 练习入口

- 以个人项目为目标，先画出与 mini-redis 对应的模块边界，再实现一个范围明确的功能切片。
- 为该功能切片补充至少一个可重复的成功路径测试和一个错误路径测试，按项目实际入口运行检查。

### 建议产出

- 一份 mini-redis 模块边界阅读记录，说明 TCP、帧解析、共享状态、并发连接、测试和优雅退出分别由哪些职责承载。
- 一份个人项目功能切片设计，包含输入输出、错误处理、并发或阻塞风险、模块归属和后续拆分点。
- 一个不复制 mini-redis 实现、但能运行并通过测试的个人项目功能切片。

### 完成标准

- 能按 mini-redis 当前仓库入口完成运行或检查，并用自己的话解释主要模块之间的调用关系。
- 个人项目功能切片能在 stable Rust 下运行，至少包含成功和失败行为的可重复测试。
- 产出中明确哪些设计借鉴了项目边界，哪些实现必须保持个人项目自身语义，并记录一次测试或错误复盘结果。

### 卡点处理

先把综合项目拆成可单独检查的模块或测试用例：网络问题与业务状态分离，异步调度问题回查阶段 5，类型或借用问题回查阶段 3；连续失败时保留最小复现和命令输出，再决定调整边界还是修复实现。

## 统一卡点处理规则

1. **先复现**：保留最小代码、输入、工具链版本和第一条相关错误，不用猜测代替运行。
2. **再定位**：先查当前上游 README 和项目入口，再回到中文主线或官方 Book/Async Book 核对概念。
3. **再验证**：每次改动后运行与问题直接相关的 `cargo +stable check`、测试或上游检查命令，并记录结果。
4. **再升级**：同一问题仍无法解释时，缩小模块边界或回退到前一阶段的可验证产出；不以跳过错误、复制答案或固定日期结束阶段。
