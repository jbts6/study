# Rust GitHub 学习主线

> 面向有前端开发经验的中文读者。本文件是学习入口和行动清单，不是 Rust 教材正文。
> 课程以 GitHub 上游内容为主线，用独立练习、编译反馈和可验证产出形成闭环。

## 课程定位

这条路线帮助熟悉 JavaScript 或 TypeScript 的开发者建立 Rust 的工作模型：先理解概念，再在自己的 Cargo 项目中写代码，最后用编译器、测试和工程检查确认结果。主线解释只负责告诉你先看什么、怎么练和何时进入下一阶段，不重新编写上游教程。

中文主线使用 [sunface/rust-course](https://github.com/sunface/rust-course)。它负责连续的概念阅读；练习、官方参考、异步专题和综合项目分别由对应上游仓库承担。上游章节、命令、版本和答案不在本地固定，遇到差异以仓库当前 README 和代码为准。

配套文档：

- [六阶段路线图](roadmap.md)：阶段目标、入口、产出和完成条件。
- [上游资源索引](resources.md)：仓库角色、使用阶段、链接和迁移规则。
- [项目教程入口](project-tutorial.md)：把阶段产出收敛成一个个人项目功能切片。

## 开始前

使用 stable Rust，并把练习放在独立目录中。课程仓库只保存导航和记录，不把练习代码直接写进课程目录。

~~~powershell
rustup toolchain install stable
rustup default stable
rustc --version
cargo --version
rustup show

mkdir rust-practice
cd rust-practice
cargo new first-check
cd first-check
cargo +stable check
~~~

确认以下结果后再进入阶段学习：

- rustc 和 Cargo 都能输出版本，且 rustup show 显示 stable 工具链可用。
- first-check 是独立 Cargo 项目，Cargo.toml 和 src/main.rs 位于预期位置。
- cargo +stable check 通过；失败时先保存第一条相关错误，不要跳过检查。

## 总路线

每个阶段都遵循“先读主线，再做练习，最后留下产出并运行检查”。详细阶段闸门见 [roadmap.md](roadmap.md)。

| 阶段 | 先读什么 | 再练什么 | 最后产出什么 |
|---|---|---|---|
| 阶段 1 | 工具链、Cargo 和最小 Rust 工作流 | 创建并检查一个 stable 项目 | 工具链记录和项目结构说明 |
| 阶段 2 | 基础语法、标准库和显式错误处理 | Rustlings 与输入处理小项目 | 通过练习记录和可处理错误的小程序 |
| 阶段 3 | 所有权、借用、生命周期、trait 和泛型 | Rustlings、100 Exercises，按需选读 Too Many Lists | 所有权复盘和可测试抽象 |
| 阶段 4 | 模块、Cargo、测试、文档和工程检查 | 为已有项目拆模块、补测试和检查 | 可维护 Cargo 项目及工程检查记录 |
| 阶段 5 | Async Book 的异步模型和运行时 | 最小异步示例与 mini-redis 概念映射 | 异步执行模型图和带测试示例 |
| 阶段 6 | mini-redis 的模块边界和工程取舍 | 实现个人项目的一个异步功能切片 | 成功/失败测试齐全的功能切片 |

不要把“读完章节”当作阶段完成信号。只有练习能运行、问题能解释、产出能复现，才进入下一阶段。

## 阶段学习卡片

### 阶段 1：工具链与 Rust 工作流

**目标**

理解 rustup、rustc 和 Cargo 的职责边界，能从零创建、检查并说明一个 stable Cargo 项目。

**主要仓库**

- [sunface/rust-course](https://github.com/sunface/rust-course)：从环境和基本工作流开始。
- [rust-lang/book](https://github.com/rust-lang/book)：遇到工具链或 Cargo 概念分歧时核对官方解释。
- [rust-lang/rustlings](https://github.com/rust-lang/rustlings)：按当前 README 安装并完成第一组小步练习。

**建议顺序**

1. 先确认 stable 工具链和版本输出。
2. 阅读中文主线的环境与工作流入口，创建自己的 Cargo 项目。
3. 用 Rustlings 的编译反馈修改练习，再回看项目文件的职责。

**最小产出**

一份工具链检查记录，以及一个通过 cargo +stable check 的最小项目。

**完成条件**

能解释 rustup、rustc、Cargo 的用途；能从零创建项目，并根据检查输出定位源码入口或依赖配置。

### 阶段 2：基础语法和标准库

**目标**

建立变量与可变性、类型、函数、控制流、结构体、枚举、字符串、集合、Option 和 Result 的基本模型。

**主要仓库**

- [sunface/rust-course](https://github.com/sunface/rust-course)：按基础语法和标准库主题阅读。
- [rust-lang/rustlings](https://github.com/rust-lang/rustlings)：并行完成类型、函数、控制流、集合和错误处理练习。
- [rust-lang/book](https://github.com/rust-lang/book)：核对概念边界。
- [rust-lang/rust-by-example](https://github.com/rust-lang/rust-by-example)：需要可运行示例时按主题查阅。

**建议顺序**

1. 以中文主线建立概念，再用 Rustlings 逐题获得编译反馈。
2. 用自己的 Cargo 项目处理输入、集合和错误，不复制上游答案。
3. 对难以解释的语法回查 Book 或 Rust By Example，随后重新运行练习。

**最小产出**

一组能通过编译的基础练习记录，以及一个能处理正常输入和错误输入的小程序或库函数。

**完成条件**

能通过当前上游入口运行基础练习；能用 match 或组合方法处理 Option 和 Result；项目通过 cargo +stable check，并能说明主要类型选择。

### 阶段 3：所有权与泛型抽象

**目标**

建立移动、所有权、共享借用、可变借用和生命周期模型，并把它们用于 trait、泛型、闭包或迭代器抽象。

**主要仓库**

- [sunface/rust-course](https://github.com/sunface/rust-course)：沿所有权、借用、生命周期、trait 和泛型推进。
- [rust-lang/book](https://github.com/rust-lang/book)：作为所有权和抽象的概念基准。
- [rust-lang/rustlings](https://github.com/rust-lang/rustlings)：继续完成所有权、借用和抽象相关练习。
- [mainmatter/100-exercises-to-learn-rust](https://github.com/mainmatter/100-exercises-to-learn-rust)：基础完成后按顺序练习，solutions 只用于复盘。
- [rust-unofficial/too-many-lists](https://github.com/rust-unofficial/too-many-lists)：需要专项补强时选读数据结构和所有权部分。

**建议顺序**

1. 先用最小例子解释一次 move、共享借用、可变借用和返回引用约束。
2. 以 Rustlings 和 100 Exercises 逐步练习，每次保留第一条相关编译错误。
3. 用 trait 和泛型写一个支持两种输入类型的函数或模块，再补一个行为验证。

**最小产出**

一份所有权卡点复盘，以及一个带测试的 trait/泛型小模块。

**完成条件**

能解释借用规则、生命周期约束和 trait bound 如何共同影响函数签名；相关练习和小模块能通过 stable 检查，且至少有一个可重复的行为验证。

### 阶段 4：工程化习惯

**目标**

把语言练习组织成可维护项目，形成模块、依赖、测试、文档、格式化和 Clippy 的日常检查习惯。

**主要仓库**

- [sunface/rust-course](https://github.com/sunface/rust-course)：阅读模块、Cargo、测试和工程实践入口。
- [rust-lang/book](https://github.com/rust-lang/book)：核对模块系统、测试和文档注释规则。

**建议顺序**

1. 从阶段 2 或阶段 3 的项目开始，先划分模块和公开边界。
2. 补正常路径、错误路径和公开 API 的测试或文档注释。
3. 按项目实际配置运行 cargo +stable test、cargo +stable fmt --check、Clippy 和文档检查，记录不适用项的原因。

**最小产出**

一个按模块组织的 Cargo 项目、一份工程检查记录和一次错误复盘。

**完成条件**

项目测试通过，格式化、Clippy 和文档检查有明确结果；能解释模块、包、依赖和测试的边界，并能复盘一次失败输出。

### 阶段 5：异步 Rust

**目标**

理解 async/await、Future、运行时、任务、共享状态和阻塞操作之间的关系。

**主要仓库**

- [rust-lang/async-book](https://github.com/rust-lang/async-book)：异步基础、运行时、任务和并发模型的第一入口。
- [tokio-rs/mini-redis](https://github.com/tokio-rs/mini-redis)：完成异步基础后阅读运行时项目的入口和模块边界。

**建议顺序**

1. 先读 Async Book，确认 Future 如何被运行时驱动。
2. 在独立 Cargo 项目中写一个异步任务、共享状态场景和阻塞操作隔离场景。
3. 再阅读 mini-redis，把运行时、任务、网络处理和测试逐项映射到自己的记录。

**最小产出**

一张异步执行模型图、一个带测试的最小异步示例，以及一份 Async Book 到 mini-redis 的概念映射表。

**完成条件**

能解释运行时、任务和共享状态的关系；最小示例能通过当前项目的检查和测试；能指出阻塞操作的风险及隔离方式。

### 阶段 6：异步综合项目

**目标**

通过阅读和运行 mini-redis，理解异步网络项目的模块边界、错误处理、并发连接、共享状态、测试和优雅退出，并迁移到个人项目。

**主要仓库**

- [tokio-rs/mini-redis](https://github.com/tokio-rs/mini-redis)：按当前仓库结构阅读和运行，重点关注职责边界。
- [rust-lang/async-book](https://github.com/rust-lang/async-book)：遇到异步模型或运行时分歧时回查。

**建议顺序**

1. 先按 mini-redis 当前入口运行或检查，画出 TCP、帧解析、共享状态和并发连接的模块关系。
2. 用 [项目教程入口](project-tutorial.md) 选择个人项目范围，先写输入、输出、错误处理和模块归属。
3. 只实现一个功能切片，并补充一个成功路径测试和一个错误路径测试。

**最小产出**

一份模块边界阅读记录、一份功能切片设计，以及一个不复制 mini-redis 实现但能运行并通过测试的个人项目切片。

**完成条件**

能用自己的话解释主要模块调用关系；个人切片在 stable Rust 下可运行并有成功/失败测试；记录一次测试或错误复盘。

## 日常学习循环

把一次学习控制在可复现的小闭环内：

1. 阅读主线或参考资料 20-30 分钟，只记录本次要验证的一个概念。
2. 关闭资料，独立写一个最小练习或修改自己的项目。
3. 运行与当前问题直接相关的检查：先用 cargo check，再按需要运行测试、格式化、Clippy 或项目 README 中的检查。
4. 记录工具链版本、最小代码、输入和编译器第一条相关错误，不只记录最后一行。
5. 回到对应上游资源复盘错误原因，修复后重新运行同一命令，并把产出归档到阶段记录。

连续失败时缩小问题范围，不用增加阅读量代替验证。一次只保留一个最小失败案例，避免多个未验证变量同时变化。

## 卡点处理

先复现，再按错误类型选择第一入口：

| 错误类型 | 先查哪个上游资源 | 处理动作 |
|---|---|---|
| 所有权、移动、借用 | [sunface/rust-course](https://github.com/sunface/rust-course)，再查 [rust-lang/book](https://github.com/rust-lang/book) | 缩小到一个函数，标出每个值的所有者和借用范围，再修复签名或作用域。 |
| 生命周期 | [rust-lang/book](https://github.com/rust-lang/book)，再回到 [sunface/rust-course](https://github.com/sunface/rust-course) | 先判断返回引用依赖哪些输入，保留最小复现，不复制标注答案。 |
| trait、泛型、迭代器 | [sunface/rust-course](https://github.com/sunface/rust-course)，再查 [rust-lang/book](https://github.com/rust-lang/book) | 先写一个具体类型版本，再逐步引入 trait bound 或泛型。 |
| Cargo、工具链、依赖 | [rust/roadmap.md](roadmap.md) 的阶段 1 和 [sunface/rust-course](https://github.com/sunface/rust-course) | 先运行 rustup show、版本命令和 cargo check，区分环境、目录、依赖和源码问题。 |
| 异步运行时、任务、阻塞操作 | [rust-lang/async-book](https://github.com/rust-lang/async-book)，再查 [tokio-rs/mini-redis](https://github.com/tokio-rs/mini-redis) | 先判断 Future 是否被运行时驱动，再检查任务生命周期、共享状态和阻塞调用隔离。 |

所有卡点都保留最小代码、命令和结果；同一问题仍无法解释时，回退到上一个已验证阶段，不以复制答案或跳过错误作为完成方式。

## 验收清单

- [ ] 能独立创建一个 stable Cargo 项目，并解释 Cargo.toml、src 和检查命令的职责。
- [ ] 能按当前上游入口完成 Rustlings 或对应练习，并保留编译反馈记录。
- [ ] 能写测试，覆盖至少一个正常路径和一个错误或边界路径。
- [ ] 能用自己的话解释所有权、移动、借用和生命周期约束，并修复一个相关编译错误。
- [ ] 能运行一个异步 Rust 项目，说明运行时、任务、共享状态和阻塞操作的边界。
- [ ] 能完成一个个人项目功能切片，包含清晰输入输出、错误处理和可重复测试。

## 上游变更规则

1. 先从 [上游资源索引](resources.md) 确认仓库角色、当前链接和使用阶段，再进入上游 README。
2. 课程入口只维护导航、学习动作和完成条件；不复制上游仓库正文、练习题、solutions 或完整答案。
3. 上游仓库改名、迁移、归档或命令变化时，以当前上游说明和可重复验证结果为准，不依赖旧章节编号。
4. 需要新增专题时先判断它是主线、练习、官方参考还是项目入口，避免同一概念在本地重复编写。
5. 个人项目实现保持自己的语义；可以借鉴上游的模块边界和工程取舍，但不复制 mini-redis 或其他仓库的实现。
