# Rust 交互式课程设计

## 背景

`rust/course.md`、`rust/roadmap.md` 和 `rust/project-tutorial.md` 已经覆盖了 Rust 的知识主线，但学习反馈停留在阅读、手写和勾选清单。Go 课程已经具备服务端隐藏测试和浏览器解锁，Python 课程已经具备代码运行、进度和草稿保存。Rust 需要补上同一层的课程产品能力，而不是继续堆叠静态 Markdown。

## 目标

- 将 Rust 的 12 个核心章节转换为可导航、可提交和可验收的课节。
- 提交代码后由本机 `cargo test` 执行隐藏测试，并返回可读的编译、测试和运行状态。
- 浏览器端保存当前课节、已通过课节和编辑器草稿；只有通过当前课节后才能解锁下一课。
- 保留现有 Markdown 作为完整讲解和项目教程，交互课节只承载高频练习和即时反馈。
- 通过自动化测试覆盖课程元数据、请求校验、运行器状态、前端状态和关键页面布局。

## 非目标

- 本轮不执行任意远程用户代码，不把服务部署到公网。
- 本轮不实现 Docker 隔离；本地执行模式明确标记为可信环境。
- 本轮不把 Tokio、外部 crate 或网络依赖放进每个课节的默认运行链路。
- 本轮不重写现有 Rust 正文、路线图或项目教程。

## 方案

新增 `rust/interactive-course/`，使用 Node.js 内置模块提供本地 HTTP 服务，避免为课程平台引入额外运行时依赖。

### 课程数据

服务端从 `internal/course/content/course.json` 读取 12 个课节。每个课节包含 `id`、`title`、`goal`、`explanation`、`exampleCode`、`starterCode`、`exerciseGoal`、`hints`、公开测试标签和服务端隐藏测试源码。`GET /api/course` 只序列化公开字段，隐藏测试不会进入浏览器响应。

课节顺序对应现有 `rust/course.md` 的第 0 至第 11 章。练习优先选择标准库可验证的纯函数和小型领域模型；异步章节解释 Tokio 的工程边界，但首版运行练习使用无外部依赖的同步接口，避免学习者因依赖下载失败无法获得反馈。

### 执行链路

`POST /api/execute` 接收 `lessonId` 和 `code`。服务端按 `lessonId` 查找课节，校验代码非空、无 NUL 字节且不超过 64 KiB，然后在临时目录生成 Cargo lib 项目、用户 `src/lib.rs` 和服务端 `tests/lesson.rs`，执行固定的 `cargo test` 命令。

API 只返回 `passed`、`compile_error`、`test_failed`、`timeout`、`runner_unavailable` 和 `invalid_request` 六种状态，并清理临时路径。编译器输出中的本机绝对路径会被替换为相对路径；标准输出和错误输出分别限制大小；超时后终止子进程并清理目录。

### 浏览器端

页面采用原生 HTML、CSS 和 JavaScript，保持与 Python 基础课程相同的低依赖路线。左侧或窄屏顶部显示课节导航和进度，主区域显示目标、讲解、示例、编辑器、提示和运行结果。运行中、通过、编译错误、测试失败、超时和运行器不可用都有独立状态。通过当前课节后刷新导航并解锁下一课；状态和草稿通过 `localStorage` 保存，存储不可用时课程仍可阅读和运行。

## 接口契约

### `GET /api/course`

返回：

```json
{
  "id": "rust-core",
  "title": "Rust 核心训练",
  "lessons": [
    {
      "id": "rust-start-00",
      "title": "工具链与第一个 Cargo 项目",
      "goal": "...",
      "explanation": "...",
      "exampleCode": "...",
      "starterCode": "...",
      "exerciseGoal": "...",
      "hints": ["..."],
      "tests": [{"id": "greeting", "label": "返回正确问候"}]
    }
  ]
}
```

### `POST /api/execute`

请求：

```json
{"lessonId":"rust-start-00","code":"pub fn greeting(name: &str) -> String { ... }"}
```

成功或失败响应都包含 `status`、`stdout`、`stderr`、`diagnostics` 和 `tests`。服务端不会接受客户端传入的测试路径或测试源码。

## 测试策略

- 课程目录测试：12 个课节、ID 顺序唯一、公开 DTO 不包含隐藏测试。
- HTTP 测试：方法、JSON、未知课节、空代码、超限代码和隐藏测试泄露均有断言。
- 运行器测试：通过、编译错误、测试失败、超时、cargo 不可用和输出截断。
- 前端单元测试：课程加载、完成解锁、草稿恢复、运行状态和错误状态。
- 浏览器验收：桌面和移动视口均能导航课节、编辑代码、显示运行反馈并持久化进度。

## 分阶段交付

1. 课程数据、公开 API、本地运行器和服务端测试。
2. 浏览器课程页、编辑器、运行反馈、进度和草稿状态。
3. 12 个课节内容、README、启动命令和浏览器验收。

