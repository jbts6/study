# Rust GitHub 课程替换实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `rust/` 目录的四份本地课程文档替换为以 GitHub 优质 Rust 学习项目为入口的中文自学路线。

**Architecture:** 本地文档只负责编排学习顺序、链接上游项目、说明完成标准和项目复盘，不复制上游教材正文。`resources.md` 是仓库索引，`roadmap.md` 是阶段路线，`course.md` 是统一入口，`project-tutorial.md` 是从练习到异步项目的实战手册。

**Tech Stack:** Markdown、Git、GitHub 仓库链接、Rust stable、Cargo、Rustlings、100 Exercises、Tokio mini-redis。

## Global Constraints

- 不把 GitHub 仓库整库复制到本地课程目录。
- 不重新编写一套与上游教材重复的 Rust 语法讲义。
- 本地课程面向中文读者和前端开发者，强调“理解概念、动手练习、完成项目”。
- 主线使用 `sunface/rust-course`，练习使用 `rust-lang/rustlings` 和 `mainmatter/100-exercises-to-learn-rust`。
- 官方参考使用 `rust-lang/book` 和 `rust-lang/rust-by-example`。
- 异步专题使用 `rust-lang/async-book`，综合项目使用 `tokio-rs/mini-redis`。
- `rust-unofficial/too-many-lists` 只作为所有权专题补充，`google/comprehensive-rust` 只作为课堂导向备选。
- 易变化的 star 和更新时间只作为 2026-08-07 的检索快照，不作为课程内容的唯一质量依据。
- 不修改 `rust/` 以外已有的 Go、Python、`.helloagents` 或其他用户未提交内容。
- 每个课程文件完成后运行 Markdown 结构和链接文本检查，再单独提交该文件。

---

### Task 1: 重建 Rust 上游资源索引

**Files:**
- Modify: `rust/resources.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-07-rust-github-course-design.md` 中的 GitHub 课程组合和仓库角色。
- Produces: 供 `course.md`、`roadmap.md`、`project-tutorial.md` 引用的稳定仓库链接、角色分类和维护注意事项。

- [ ] **Step 1: 替换资源文档的内容结构**

将旧资源说明替换为以下固定结构，并使用明确的 GitHub Markdown 链接：

1. 文档标题、检索快照日期和使用说明。
2. “主线课程”表：`sunface/rust-course`。
3. “必做练习”表：`rust-lang/rustlings`、`mainmatter/100-exercises-to-learn-rust`。
4. “官方参考”表：`rust-lang/book`、`rust-lang/rust-by-example`。
5. “专题与项目”表：`rust-lang/async-book`、`tokio-rs/mini-redis`、`rust-unofficial/too-many-lists`。
6. “备选课程”表：`google/comprehensive-rust`，明确课堂导向和英语门槛。
7. “选择规则”小节：上游迁移、归档、重复内容和维护时间变化时如何处理。
8. “推荐使用顺序”小节：主线阅读、并行练习、官方查阅、异步项目。

每个表至少包含“资源、角色、适用阶段、使用方式、注意事项”字段；不复制仓库正文或答案。

- [ ] **Step 2: 验证资源覆盖和 Markdown 差异**

Run:

```powershell
git diff --check -- rust/resources.md
```

Expected: exit code `0`，无空白错误。

Run:

```powershell
rg -n "sunface/rust-course|rust-lang/rustlings|100-exercises-to-learn-rust|rust-lang/book|rust-by-example|async-book|mini-redis|too-many-lists|comprehensive-rust" rust/resources.md
```

Expected: 9 个仓库名都能匹配，且每个仓库名出现在有效 Markdown 链接中。

- [ ] **Step 3: Commit**

```powershell
git add -- rust/resources.md
git commit -m "docs: 重建 Rust GitHub 资源索引"
```

### Task 2: 重建阶段路线图

**Files:**
- Modify: `rust/roadmap.md`

**Interfaces:**
- Consumes: `rust/resources.md` 的资源角色和 `docs/superpowers/specs/2026-08-07-rust-github-course-design.md` 的六阶段路线。
- Produces: 从环境准备到异步综合项目的阶段导航、完成标准和卡点处理规则。

- [ ] **Step 1: 替换路线图为六阶段结构**

按以下顺序重写路线图，每个阶段都必须包含“阶段目标、主线入口、练习入口、建议产出、完成标准”：

1. 工具链与 Rust 工作流：安装 stable、理解 Cargo、能创建并检查项目。
2. 基础语法和标准库：类型、函数、控制流、集合、错误处理；使用中文主线和 Rustlings。
3. 所有权与泛型抽象：所有权、借用、生命周期、trait、泛型；使用 Rustlings、100 Exercises 和 Too Many Lists 选读。
4. 工程化习惯：模块、Cargo、测试、文档、格式化、Clippy 和错误复盘。
5. 异步 Rust：async/await、运行时、任务、共享状态、阻塞操作；先读 Async Book 再看 Tokio 项目。
6. 综合项目：按 mini-redis 的模块边界阅读和运行，完成个人项目的一个可测试功能切片。

路线图不得使用固定“第几天”作为完成依据；使用“阶段完成条件”和“可验证产出”替代时间承诺。命令使用 stable Rust、Cargo 和上游仓库实际提供的入口，不写未经核验的脚本参数。

- [ ] **Step 2: 验证阶段和结果字段**

Run:

```powershell
git diff --check -- rust/roadmap.md
rg -n "阶段 1|阶段 2|阶段 3|阶段 4|阶段 5|阶段 6|阶段目标|主线入口|练习入口|完成标准|mini-redis" rust/roadmap.md
```

Expected: 两条命令均 exit code `0`；六个阶段和五类字段均有匹配；`mini-redis` 出现在第六阶段。

- [ ] **Step 3: Commit**

```powershell
git add -- rust/roadmap.md
git commit -m "docs: 重建 Rust 六阶段学习路线"
```

### Task 3: 重建主课程入口

**Files:**
- Modify: `rust/course.md`

**Interfaces:**
- Consumes: `rust/resources.md` 的链接索引和 `rust/roadmap.md` 的六阶段导航。
- Produces: 一个不再复制旧 22 课讲义、可以直接开始学习的主课程入口。

- [ ] **Step 1: 替换课程正文为 GitHub 学习主线**

按以下结构编写新课程入口：

1. 课程定位：中文主线、前端开发者、学习闭环和上游内容边界。
2. 开始前：安装 stable Rust、确认 `rustc --version`、`cargo --version`、`rustup show`，建立独立练习目录。
3. 总路线：链接到 `roadmap.md`，解释每个阶段先读什么、再练什么、最后产出什么。
4. 阶段学习卡片：六个阶段分别列出目标、主要仓库、建议顺序、最小产出和完成条件。
5. 日常学习循环：阅读 20-30 分钟、独立写练习、运行检查、记录编译器错误、回到参考资料复盘。
6. 卡点处理：按错误类型区分所有权、生命周期、trait、Cargo、异步运行时问题；明确先查哪个上游资源。
7. 验收清单：能独立创建 Cargo 项目、通过练习、写测试、解释所有权、运行异步项目、完成一个功能切片。
8. 上游变更规则：以 `resources.md` 为入口，不复制或修改上游仓库内容。

课程正文只能提供短的导航解释和学习动作，不得重新展开旧教程中的 22 课知识点，不得加入与上游仓库不同的完整答案。

- [ ] **Step 2: 验证主线顺序和旧课程移除**

Run:

```powershell
git diff --check -- rust/course.md
rg -n "sunface/rust-course|rustlings|100-exercises-to-learn-rust|rust-lang/book|rust-by-example|async-book|mini-redis|roadmap.md|project-tutorial.md" rust/course.md
```

Expected: exit code `0`；课程包含全部主线和专题入口，并链接两个本地配套文档。

Run:

```powershell
rg -n "第 1 课|第 22 课|阶段 1 · 基础语法|阶段 4 · 实战" rust/course.md
```

Expected: exit code `1`，确认旧 22 课目录没有继续作为课程主结构；命令返回 `1` 是预期结果。

- [ ] **Step 3: Commit**

```powershell
git add -- rust/course.md
git commit -m "docs: 重建 Rust GitHub 主课程入口"
```

### Task 4: 重建项目实战手册

**Files:**
- Modify: `rust/project-tutorial.md`

**Interfaces:**
- Consumes: `rust/course.md` 的阶段顺序、`rust/resources.md` 的上游链接和 `rust/roadmap.md` 的完成条件。
- Produces: 从单个练习到 Tokio mini-redis 的项目实践、阅读顺序和迁移检查清单。

- [ ] **Step 1: 替换旧 Axum 单项目教程**

将旧的单一 Axum Todo API 教程替换为以下项目路径：

1. 练习级验证：用 Rustlings 复现一个当前知识点，记录编译器错误和修复原因。
2. 连续练习：用 100 Exercises 完成一组连续练习，只有独立尝试后才查看 solutions 分支。
3. 异步预备：从 Async Book 阅读 async/await、运行时、任务、Pin/await 基础和共享状态相关章节。
4. mini-redis 阅读顺序：先运行官方示例，再按协议/帧解析、TCP server、client、共享状态、连接限制、Pub/Sub、优雅退出、异步测试顺序阅读。
5. 个人项目迁移：选择一个小型 API 或 CLI 功能，写出模块边界、错误类型、状态所有权、测试用例和运行命令。
6. 项目验收：至少有一个可运行功能、一个失败路径测试、一个并发或异步行为说明和一份错误复盘。

每个项目阶段都必须说明“阅读材料、动手动作、可观察结果、完成标准”；不复制 mini-redis 或其他上游项目的实现代码。

- [ ] **Step 2: 验证项目路径和旧教程移除**

Run:

```powershell
git diff --check -- rust/project-tutorial.md
rg -n "rustlings|100-exercises-to-learn-rust|async-book|mini-redis|TCP|共享状态|优雅退出|Pub/Sub|测试|错误复盘" rust/project-tutorial.md
```

Expected: exit code `0`；练习、异步专题、mini-redis 和验收维度都有匹配。

Run:

```powershell
rg -n "Axum|Todo API|serde_json|with_state" rust/project-tutorial.md
```

Expected: exit code `1`，确认旧的单项目实现没有继续作为手册主体；命令返回 `1` 是预期结果。

- [ ] **Step 3: Commit**

```powershell
git add -- rust/project-tutorial.md
git commit -m "docs: 重建 Rust 项目实战路径"
```

### Task 5: 全量文档验收

**Files:**
- Verify: `rust/course.md`
- Verify: `rust/roadmap.md`
- Verify: `rust/resources.md`
- Verify: `rust/project-tutorial.md`

**Interfaces:**
- Consumes: Task 1-4 的四个已提交文档。
- Produces: 覆盖设计稿验收标准的证据，不修改课程内容。

- [ ] **Step 1: 检查工作区范围**

Run:

```powershell
git status --short
```

Expected: 输出只包含本任务产生的 `rust/` 文档改动或已提交后的其他用户原有未提交文件；不得出现 `rust/` 以外本任务新建的文件。

- [ ] **Step 2: 检查四份文档的链接和结构**

Run:

```powershell
git diff --check HEAD~4..HEAD
rg -n "https://github.com/(sunface/rust-course|rust-lang/rustlings|mainmatter/100-exercises-to-learn-rust|rust-lang/book|rust-lang/rust-by-example|rust-lang/async-book|tokio-rs/mini-redis|rust-unofficial/too-many-lists|google/comprehensive-rust)" rust/course.md rust/roadmap.md rust/resources.md rust/project-tutorial.md
```

Expected: `git diff --check` exit code `0`；九个上游仓库链接至少在资源索引中出现，主课程和项目手册引用所需入口。

- [ ] **Step 3: 检查设计稿验收项**

逐项确认：

- `course.md` 不再以旧 22 课作为主线。
- `roadmap.md` 包含六阶段和每阶段完成条件。
- `resources.md` 包含中文主线、官方练习、连续练习、官方参考、异步专题和综合项目。
- `project-tutorial.md` 以练习到 mini-redis 的递进关系取代旧 Axum Todo API。
- 四份文档使用稳定上游链接，不包含整段外部教材或答案。

- [ ] **Step 4: Commit verification ledger if needed**

仅在验证命令需要记录证据且不会把用户未提交文件加入暂存区时，更新 `.superpowers/sdd/progress.md`；课程文件的四个提交已经是主要版本检查点，不再创建合并提交。
