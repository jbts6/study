# Rust GitHub 课程替换设计

## 目标

将 `rust/` 目录从当前自写的 22 课讲义替换为一套以 GitHub 优质开源项目为入口的 Rust 自学课程索引。课程面向中文读者和前端开发者，强调“理解概念、动手练习、完成项目”三个环节，并保留本地可持续维护的学习决策和验收标准。

本地文件只维护课程编排、学习顺序、项目说明和上游链接，不复制外部仓库的教材正文或练习内容。上游仓库继续作为内容和代码的唯一来源。

## 非目标

- 不把 GitHub 仓库整库复制到本地课程目录。
- 不重新编写一套与上游教材重复的 Rust 语法讲义。
- 不在本次任务中实现在线代码执行器、课程网站、账号系统或学习进度服务。
- 不把 star 数量作为质量的唯一标准；数量只作为检索快照中的辅助信息。
- 不修改工作区中与 `rust/` 课程无关的 Go、Python、`.helloagents` 或其他用户未提交内容。

## GitHub 课程组合

检索快照日期为 2026-08-07。仓库链接和角色如下：

| 层级 | 仓库 | 角色 | 选择理由 |
|---|---|---|---|
| 中文主线 | [`sunface/rust-course`](https://github.com/sunface/rust-course) | 系统教程和中文解释 | 内容完整、中文友好，并提供在线练习入口；作为自学者的第一入口。 |
| 官方练习 | [`rust-lang/rustlings`](https://github.com/rust-lang/rustlings) | 小步练习和编译反馈 | Rust 官方项目，适合与主线并行，每个知识点都通过代码验证。 |
| 练习课程 | [`mainmatter/100-exercises-to-learn-rust`](https://github.com/mainmatter/100-exercises-to-learn-rust) | 100 个循序渐进的练习 | 形成连续的动手路径，并提供独立的 solutions 分支用于复盘。 |
| 官方参考 | [`rust-lang/book`](https://github.com/rust-lang/book) | 权威概念和标准库参考 | 作为遇到概念分歧时的基准，不重复抄录到本地。 |
| 示例参考 | [`rust-lang/rust-by-example`](https://github.com/rust-lang/rust-by-example) | 可运行示例和语法查阅 | 适合把抽象概念快速映射到可执行代码。 |
| 异步专题 | [`rust-lang/async-book`](https://github.com/rust-lang/async-book) | async/await、运行时和并发模型 | 覆盖异步 Rust，但上游当前仍在更新，放在进阶专题而非基础主线。 |
| 综合项目 | [`tokio-rs/mini-redis`](https://github.com/tokio-rs/mini-redis) | 异步网络和工程实践 | Tokio 官方学习型项目，覆盖 TCP、共享状态、并发连接、测试和优雅退出。 |
| 可选专题 | [`rust-unofficial/too-many-lists`](https://github.com/rust-unofficial/too-many-lists) | 所有权、借用和数据结构 | 通过链表实现加深所有权理解；维护节奏较慢，仅作为专题补充。 |
| 课堂替代 | [`google/comprehensive-rust`](https://github.com/google/comprehensive-rust) | 系统课程备选 | Android 团队使用的完整课程，但官方说明更适合课堂，不作为中文自学主线。 |

## 本地文件职责

### `rust/course.md`

作为唯一主入口，包含：

- 课程定位、适合人群和学习原则。
- 六个阶段的目标、主线仓库、配套练习和阶段产出。
- 每阶段的推荐顺序，明确什么内容必须完成、什么内容可跳过。
- 统一的环境准备、仓库获取、练习运行和复盘流程。
- 每阶段的完成检查，避免只读完文档却没有可验证结果。

### `rust/roadmap.md`

提供按阶段推进的路线，而不是固定日期排期：

1. 工具链与 Rust 代码工作流。
2. 基础语法、类型、函数、集合和错误处理。
3. 所有权、借用、生命周期、trait 和泛型。
4. 测试、模块、Cargo、文档和可维护代码。
5. 异步 Rust、Tokio、并发和网络基础。
6. `mini-redis` 综合项目与个人项目迁移。

每个阶段都记录入口链接、完成条件、建议输出物和卡点处理方式。

### `rust/resources.md`

维护仓库索引和选型依据，包含：

- 上游链接、在线阅读链接和本地使用方式。
- 仓库的学习角色、适用阶段、难度和维护注意事项。
- 检索快照日期；易变化的 star、更新时间等信息只作为参考。
- 主线、必做练习、官方参考、专题和备选的分类。
- 出现重复内容、仓库归档或上游迁移时的替换规则。

### `rust/project-tutorial.md`

改为项目实战手册，定义从练习到项目的递进路径：

- 用 `rustlings` 验证单个概念。
- 用 `100-exercises-to-learn-rust` 完成连续练习并记录错误类型。
- 阅读 `async-book` 的异步基础和运行时章节。
- 跟随 `mini-redis` 理解 TCP、帧解析、共享状态、并发限制、发布订阅和测试。
- 在不复制上游实现的前提下，为个人项目制定功能拆分、错误处理、测试和复盘清单。

## 学习数据流

```text
本地 course.md
    -> 选择阶段与学习顺序
上游中文主线 / 官方 Book
    -> 阅读概念
Rustlings / 100 Exercises
    -> 编译、测试、修复错误
Async Book / mini-redis
    -> 阅读工程模式并完成项目检查
roadmap.md + project-tutorial.md
    -> 记录产出、卡点和迁移到个人项目的结果
```

本地课程不保存上游练习答案，也不假设固定的仓库目录。所有命令先在临时或用户指定目录执行，避免把外部仓库文件误认为本地课程的一部分。

## 统一使用约定

- 使用稳定版 Rust 和 `rustup` 管理工具链。
- 每次学习优先运行 `cargo check` 或上游项目提供的检查命令，再运行测试。
- Rustlings 和 100 Exercises 的答案只在完成当前练习后查看。
- 遇到概念冲突时，以 `rust-lang/book` 和 Rust 官方文档为准，再参考中文解释。
- 异步代码明确区分运行时、任务、共享状态和阻塞操作；不把 `std::sync::Mutex` 的同步用法直接套到异步场景。
- 项目阶段必须留下可验证产出：通过的练习、测试结果、错误复盘或一个可运行的功能切片。

## 验收标准

替换完成后必须满足：

- `rust/course.md` 不再以原 22 课讲义作为主线，而是明确指向新的 GitHub 学习组合。
- `roadmap.md` 能从零基础一路导航到异步项目，并为每阶段提供完成条件。
- `resources.md` 至少覆盖中文主线、官方练习、连续练习、官方参考、异步专题和综合项目。
- `project-tutorial.md` 能说明从练习到 `mini-redis` 的递进关系，而不是保留原来的单一 Axum 示例。
- 每个主线仓库都带有稳定的 GitHub 链接，并注明其适用范围和维护风险。
- 文档不复制上游教材正文，不制造与上游内容不一致的代码答案。
- 本次提交只包含设计稿；后续实现按独立文件职责拆分提交，并在修改后检查链接、章节、命令和 Markdown 结构。
