

这份文件回答两个问题：

1. 哪些 GitHub 项目值得用；
2. 什么时候打开它们，打开后具体做什么。

本地课程的正文在 course.md，执行安排在 roadmap.md，完整项目在 project-tutorial.md。这里的链接是练习和查阅入口，不是把学习任务交给外部仓库。

## 资源选择总览

| 资源 | 角色 | 适合阶段 | 建议用法 |
| --- | --- | --- | --- |
| sunface/rust-course | 中文主线参考 | 全阶段 | 概念卡住时对照术语和解释 |
| rust-lang/rustlings | 编译练习 | 第 1 至 6 阶段 | 每学完一个主题做对应小题 |
| mainmatter/100-exercises-to-learn-rust | 小题课程 | 第 2 至 6 阶段 | 用来补足重复练习，不跳过本地项目 |
| rust-lang/book | 官方概念参考 | 全阶段 | 对所有权、trait 和测试做权威查阅 |
| rust-lang/rust-by-example | 可运行示例 | 第 1 至 7 阶段 | 只查一个语法点，立即改写到自己的项目 |
| rust-lang/async-book | 异步概念参考 | 第 5 阶段 | 先学 Future 和执行模型，再看 Tokio 代码 |
| tokio-rs/mini-redis | 异步工程参考 | 第 5 至 6 阶段 | 同步项目稳定后观察服务组织方式 |
| rust-unofficial/too-many-lists | 数据结构补充 | 第 3 至 4 阶段 | 专门练所有权、借用和递归结构 |
| google/comprehensive-rust | 课堂式补充 | 有教师或想系统复习时 | 选专题听课，不与主线并行通读 |

# 主线课程参考

## sunface/rust-course

地址：https://github.com/sunface/rust-course

定位：中文、覆盖面较完整的 Rust 学习资料，适合作为术语和概念的第二解释。

本地对应：

- course.md 第 0 至 3 章：工具链、基础语法、集合和类型建模；
- course.md 第 4 至 7 章：所有权、借用、错误处理和 trait；
- project-tutorial.md：把概念变成业务代码。

使用方法：

1. 先读本地章节并完成一个练习。
2. 只有遇到概念卡点时，再查同一主题。
3. 关闭仓库页面，回到本地项目重写例子。
4. 将差异记录到 notes/mistakes.md，而不是复制段落。

不要这样用：

- 不要同时把它和本地课程当两套主线从头通读；
- 不要因为仓库章节更多就跳过本地项目；
- 不要把仓库中的答案直接粘进自己的测试。

## Google Comprehensive Rust

地址：https://github.com/google/comprehensive-rust

定位：课堂式、适合连续授课或需要系统讲义的补充课程。

本地对应：

- 第 1 阶段：基础语法复习；
- 第 3 阶段：所有权和错误处理；
- 第 4 阶段：trait、泛型和并发；
- 第 5 阶段：异步专题。

使用方法：

- 每周只选一个专题；
- 先看本地 roadmap 的验收标准，再选讲义内容；
- 看完后把一个示例改成 Task Board 的业务规则；
- 如果没有教师或学习小组，不必从头到尾同步完成全部课件。

# 编译练习

## Rustlings

地址：https://github.com/rust-lang/rustlings

定位：官方社区常用的编译器练习集合，适合把“我理解了”变成“我能修好”。

本地对应：

- 第 0 至 1 章：变量、函数、控制流；
- 第 2 至 3 章：结构体、枚举、集合；
- 第 4 至 6 章：所有权、借用、Result；
- 第 7 章：trait 和迭代器。

使用方法：

1. 每完成 course.md 一章，选择同主题练习。
2. 先读错误信息，至少自己尝试 10 分钟。
3. 修好后解释为什么编译器接受了新版本。
4. 将一个练习改写为 Task Board 的测试。

建议完成范围：

- 初学：variables、functions、structs、enums；
- 核心：move_semantics、primitive_types、vecs、strings；
- 进阶：error_handling、generics、traits、iterators；
- 并发：threads、smart_pointers、arc、mutex。

验收标准：不是练习数量，而是能说出每次修改改变了什么所有权或类型关系。

## 100 Exercises to Learn Rust

地址：https://github.com/mainmatter/100-exercises-to-learn-rust

定位：按小题递进的完整练习路线，适合在本地课程之外增加重复量。

本地对应：

- 第 1 至 2 阶段：类型、集合和数据建模；
- 第 3 阶段：所有权、借用和 Result；
- 第 4 阶段：trait、迭代器和泛型；
- 第 5 阶段：工程和异步前置。

使用方法：

- 每周选 5 到 10 题，不要一次追求全部完成；
- 将做错的题目记录在 mistakes.md；
- 每五题写一个不看答案的综合小函数；
- 如果某题只是重复本地已经熟悉的内容，可以跳过并记录理由。

这套资源的价值是重复和渐进，不是替代 Task Board。

# 官方参考

## The Rust Programming Language

地址：https://github.com/rust-lang/book

定位：官方系统教材，适合确认语言规则和术语。

优先查阅：

- 第 4 章附近：所有权；
- 第 6 章附近：枚举和模式匹配；
- 第 9 章附近：错误处理；
- 第 10 章附近：泛型、trait 和生命周期；
- 第 11 章附近：测试；
- 第 16 章附近：并发；
- 第 17 章附近：异步概念。

使用方法：

1. 先用 course.md 建立问题；
2. 在官方书中查规则；
3. 回到项目写一个最小复现；
4. 将规则翻译成自己的函数签名。

不要把阅读章节数当作进度。每读一节，至少留下一个能编译的例子或测试。

## Rust by Example

地址：https://github.com/rust-lang/rust-by-example

定位：用短小、可运行的例子解释语法，适合快速查一个点。

适合查：

- 格式化输出；
- 基本类型和控制流；
- struct、enum、match；
- trait、泛型和闭包；
- 迭代器；
- 错误处理。

使用方法：

- 只打开与当前报错相关的一个主题；
- 把示例中的变量名和业务改成自己的；
- 先在 examples/ 中运行，再合并到项目；
- 如果示例和本地工具链行为不同，以当前编译器错误和官方文档为准。

地址：https://github.com/rust-lang/rust-by-example

## Async Book

地址：https://github.com/rust-lang/async-book

定位：异步 Rust 的概念参考，适合解释 Future、执行器、Pin 和任务模型。

使用前提：

- 已完成 course.md 第 4 至 8 章；
- 能写同步 Result 和 channel；
- 已经有一个同步 TaskBook；
- 知道自己为什么需要并发 I/O。

本地对应：

- course.md 第 9 章；
- roadmap.md 阶段 5；
- project-tutorial.md 第 7 步。

使用方法：

1. 先理解 Future 是惰性值；
2. 再理解 runtime 如何轮询和调度；
3. 最后用 Tokio 实现项目中的一个消息循环；
4. 保留同步实现作为对照，不要机械把所有函数变成 async。

# 专题和工程项目

## Tokio mini-redis

地址：https://github.com/tokio-rs/mini-redis

定位：Tokio 生态的学习型项目，用于观察异步服务、连接处理、共享状态和消息组织。

阅读时重点看：

- 项目如何拆分模块；
- 连接任务如何退出；
- 状态如何在任务之间共享；
- 错误如何从底层传到入口；
- 测试如何构造协议和状态。

本地对应：

- project-tutorial.md 第 4 步：命令和执行边界；
- project-tutorial.md 第 7 步：Tokio worker；
- course.md 第 8 至 10 章：并发、异步和工程化。

使用限制：

- 不要在还没完成同步 TaskBook 时直接模仿完整服务；
- 不要把它当作初学者的第一份代码；
- 只挑一个模块，画出输入、状态、输出和退出路径。

## Too Many Lists

地址：https://github.com/rust-unofficial/too-many-lists

定位：用链表等数据结构练习所有权、借用、Box、Rc、RefCell 和迭代器。

本地对应：

- course.md 第 4 至 7 章；
- roadmap.md 阶段 3 至 4。

使用方法：

- 每次只看一种数据结构实现；
- 先自己写一个最小节点类型；
- 把编译器错误分类为移动、借用、生命周期或共享可变性；
- 将经验写入 TaskBook 的设计复盘，而不是把链表代码带进业务项目。

这套资源更适合补语义细节，不是 Task Board 的必做主线。

# 资源切换规则

## 什么时候查外部资料

满足任一条件再打开 GitHub：

- 本地章节的概念解释读了两遍仍不清楚；
- 练习错误无法缩小到最小复现；
- 想比较标准库、线程和异步的工程组织；
- 需要更多同主题练习；
- 需要确认当前仓库的用法或目录。

## 什么时候不查

以下情况先继续本地项目：

- 只是想找更漂亮的示例；
- 还没运行自己的代码；
- 还没读编译器第一条错误；
- 只是觉得当前章节慢；
- 想用依赖替代基础类型设计。

## 一次只选一个外部资源

推荐选择顺序：

1. 课程概念卡住：rust-lang/book 或 rust-by-example；
2. 需要编译练习：rustlings；
3. 需要更多递进小题：100-exercises-to-learn-rust；
4. 需要中文第二解释：sunface/rust-course；
5. 需要异步概念：async-book；
6. 需要异步工程参考：mini-redis；
7. 需要所有权和数据结构补课：too-many-lists；
8. 需要课堂式系统复习：comprehensive-rust。

不要同时打开三套主教材，否则会把“阅读进度”误认为“编码能力”。

# 推荐使用顺序

## 前两周

- 本地 course.md 第 0 至 3 章；
- Rust by Example 查语法；
- Rustlings 做对应小题；
- 输出一个内存 TaskBook。

## 第三至六周

- 本地 course.md 第 4 至 6 章；
- Rust Book 查所有权、Result 和测试；
- 100 Exercises 每周补题；
- 输出自定义错误和测试集合。

## 第七至八周

- 本地 course.md 第 7 至 8 章；
- Too Many Lists 选一个数据结构专题；
- Rustlings 做 trait、迭代器和线程；
- 输出 worker 和退出协议。

## 第九至十周

- 本地 course.md 第 9 至 10 章；
- Async Book 查 Future 和 runtime；
- mini-redis 只读一个模块的工程组织；
- 输出 Tokio channel 扩展。

## 最后两周

- 完成 project-tutorial.md；
- 只查解决当前卡点的资源；
- 运行 roadmap.md 的最终验收命令；
- 将外部资料中的收获写成自己的设计决定。

# 资源健康检查

外部仓库会更新、重命名或改变任务。每次使用前检查：

- 链接是否仍可访问；
- README 是否说明当前支持的 Rust 版本；
- 练习是否仍与本地工具链兼容；
- 仓库是否已经归档；
- 代码是否只是示范而非推荐的生产做法。

如果某个仓库暂时不可用，不改变本地课程路线。course.md、roadmap.md 和 project-tutorial.md 共同构成离线主线，GitHub 只承担补充作用。
