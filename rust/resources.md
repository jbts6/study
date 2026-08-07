# Rust GitHub 上游资源索引

> 检索快照日期：2026-08-07
>
> 本索引只维护课程编排、资源角色、使用阶段和上游链接，不复制仓库正文、练习题或答案。课程入口由 `course.md`、`roadmap.md` 和 `project-tutorial.md` 按各自职责引用；上游仓库的最新内容、版本和完整说明以 GitHub 页面为准。

## 主线课程

| 资源 | 角色 | 适用阶段 | 使用方式 | 注意事项 |
|------|------|----------|----------|----------|
| [sunface/rust-course](https://github.com/sunface/rust-course) | 中文主线教程 | 从基础语法到所有权、并发和工程基础 | 按课程顺序阅读概念，结合本地练习记录卡点和产出 | 作为中文自学第一入口；以仓库当前章节为准，不在本地复制教程内容 |

## 必做练习

| 资源 | 角色 | 适用阶段 | 使用方式 | 注意事项 |
|------|------|----------|----------|----------|
| [rust-lang/rustlings](https://github.com/rust-lang/rustlings) | 官方小步练习和编译反馈 | 学习主线的全程，重点是基础语法、所有权和错误处理 | 与主线并行，逐题修改代码并以编译通过作为完成信号 | 练习版本可能随 Rust 工具链更新；优先使用仓库当前推荐的运行方式，不抄答案 |
| [mainmatter/100-exercises-to-learn-rust](https://github.com/mainmatter/100-exercises-to-learn-rust) | 循序渐进的连续练习课程 | 掌握基础后，用于补齐所有权、trait、泛型和错误处理 | 按顺序完成练习，记录编译错误类型；需要复盘时再参考独立的 solutions 分支 | 不把 solutions 当作首次完成路径；以仓库当前目录和分支说明为准 |

## 官方参考

| 资源 | 角色 | 适用阶段 | 使用方式 | 注意事项 |
|------|------|----------|----------|----------|
| [rust-lang/book](https://github.com/rust-lang/book) | Rust 官方概念和标准库参考 | 遇到核心概念分歧时，贯穿基础到进阶 | 查阅所有权、生命周期、trait、泛型、并发等章节，作为概念基准 | 只作权威参考，不替代主线练习；不同版本的章节和示例可能变化 |
| [rust-lang/rust-by-example](https://github.com/rust-lang/rust-by-example) | 官方可运行示例和语法索引 | 需要把抽象概念快速映射到代码时 | 按主题运行示例，再回到主线或练习验证理解 | 示例适合查阅和实验，不应被当作完整课程或答案库 |

## 专题与项目

| 资源 | 角色 | 适用阶段 | 使用方式 | 注意事项 |
|------|------|----------|----------|----------|
| [rust-lang/async-book](https://github.com/rust-lang/async-book) | async/await、运行时和并发模型专题 | 完成同步 Rust 基础后进入异步专题 | 先读异步基础、运行时和并发模型，再把概念映射到项目检查清单 | 上游仍可能更新；放在进阶专题，不作为基础主线的前置依赖 |
| [tokio-rs/mini-redis](https://github.com/tokio-rs/mini-redis) | Tokio 学习型综合项目 | 异步基础之后的网络和工程实践阶段 | 跟随项目理解 TCP、帧解析、共享状态、并发连接、测试和优雅退出，再拆分到个人项目 | 重点学习架构和工程取舍，不复制实现；依赖和 API 以仓库当前版本为准 |
| [rust-unofficial/too-many-lists](https://github.com/rust-unofficial/too-many-lists) | 用数据结构练习所有权和借用的可选专题 | 所有权基础之后、需要专项补强时 | 通过逐步实现链表观察所有权、借用、`Box` 和 `Rc` 的差异 | 维护节奏较慢，仅作专题补充；若内容与官方参考冲突，以官方资料和可验证代码为准 |

## 备选课程

| 资源 | 角色 | 适用阶段 | 使用方式 | 注意事项 |
|------|------|----------|----------|----------|
| [google/comprehensive-rust](https://github.com/google/comprehensive-rust) | 系统课程备选和课堂材料 | 已有 Rust 基础，或需要按课时组织教学时 | 选取与当前阶段匹配的讲义和练习，作为主线卡点的另一种解释 | 课堂导向明显，不作为中文自学主线；材料主要为英语，需评估英语阅读门槛和课堂配套环境 |

## 选择规则

- **上游迁移**：仓库更名、迁移组织或官方入口变化时，更新本文件中的链接、角色和适用阶段，并同步检查 `course.md`、`roadmap.md` 与 `project-tutorial.md` 的引用；不在本地保留复制内容。
- **归档处理**：仓库被归档或明确停止维护时，保留历史链接供已开始的学习者复盘，同时在注意事项中标注状态；新阶段不再把它作为唯一入口，并优先寻找同角色的活跃上游。
- **重复内容**：同一概念由多个仓库覆盖时，保留一个主线解释和一个验证入口，其他资源只承担查阅、对照或专题补强，避免在本地课程重复编写上游教材。
- **维护时间变化**：定期以检索快照更新维护风险和版本提示；内容或工具链发生不兼容时，以当前上游说明和可重复验证的命令为准，必要时调整课程顺序，而不是固守旧章节编号。
- **链接稳定性**：优先使用仓库根路径的 GitHub 链接，不把易变的 issue、commit 或分支页面作为唯一课程入口；具体章节链接应由引用它的课程文件按需维护。

## 推荐使用顺序

1. **主线阅读**：从 [sunface/rust-course](https://github.com/sunface/rust-course) 开始，按 `course.md` 和 `roadmap.md` 的阶段完成概念学习。
2. **并行练习**：学习每个概念后优先完成 [rust-lang/rustlings](https://github.com/rust-lang/rustlings)；需要更长练习链时接着完成 [mainmatter/100-exercises-to-learn-rust](https://github.com/mainmatter/100-exercises-to-learn-rust)。
3. **官方查阅**：遇到概念分歧或需要可运行示例时，分别查 [rust-lang/book](https://github.com/rust-lang/book) 和 [rust-lang/rust-by-example](https://github.com/rust-lang/rust-by-example)，再回到练习验证。
4. **异步项目**：完成同步 Rust 基础后阅读 [rust-lang/async-book](https://github.com/rust-lang/async-book)，再跟随 [tokio-rs/mini-redis](https://github.com/tokio-rs/mini-redis) 进行异步网络项目实践。
5. **按需补强**：所有权或数据结构卡住时查阅 [rust-unofficial/too-many-lists](https://github.com/rust-unofficial/too-many-lists)；需要课堂式完整课程时再评估 [google/comprehensive-rust](https://github.com/google/comprehensive-rust)，同时确认英语门槛和课堂导向是否适合当前场景。
