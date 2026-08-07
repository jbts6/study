# Go Interactive Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Each task uses TDD and is reviewed before the next task starts.

**Goal:** 在现有 Go 中文课程资料之上，新增一个可运行的“Go 起步”交互式课程站：用户在浏览器编辑 Go 代码，服务端通过一次性隔离 Docker 容器执行隐藏测试，并把编译诊断、测试结果、标准输出和提示反馈到页面。

**Architecture:** 在 `go/interactive-course/` 建立独立项目，不改写现有 `go/course.md`、`go/course-v2-sample.md` 和项目教程。Go 标准库 HTTP 服务负责课程目录、请求校验和 Docker 执行器；课程元数据与每节隐藏测试通过 Go embed 随服务端发布。前端使用 Vite + TypeScript + CodeMirror 的无框架 DOM 应用，开发服务器把 `/api` 代理到 Go 服务。浏览器进度和草稿只保存到 `localStorage`。

**Tech Stack:** Go 1.25.1、Go 标准库 `net/http`/`os/exec`/`embed`、Docker CLI、TypeScript、Vite、CodeMirror 6、Vitest、Playwright。

## Global Constraints

- 现有 `go/`、`python/`、`rust/` 和 `.workbuddy/` 内容属于用户已有资料，除新增 `go/interactive-course/` 外不得删除、覆盖或重排；任何需要引用的旧课程内容只作为本地内容来源。
- 所有新增用户可见课程文案、页面文案和错误提示使用中文；代码示例和 Go 标识符按 Go 语法保留英文。
- 第一版只实现课程 `go-start` 的四节课：输出与第一个 Go 程序、变量与基础类型、`if`/`for` 控制流、函数与返回值。每节必须有目标、讲解、示例代码、初始代码、练习目标、提示、服务端隐藏测试和测试标签。
- 服务端公开课程 DTO 不包含隐藏测试源码、宿主机临时路径、容器命令、环境变量或其他内部诊断；客户端只能提交 `lessonId` 和 `code`。
- `/api/execute` 的 `status` 只能是 `passed`、`compile_error`、`test_failed`、`timeout`、`runner_unavailable`、`invalid_request`。
- 用户代码大小限制为 64 KiB；输出合计限制为 32 KiB；单次执行超时为 3 秒。超出限制必须返回可读结果，不能把原始内部错误直接暴露给浏览器。
- Docker 执行必须固定使用 `golang:1.25.1-bookworm` 构建的项目 runner 镜像，并使用 `--network=none`、非 root 用户、`--read-only`、`--tmpfs /tmp`、CPU/内存/进程数限制、`--cap-drop=ALL` 和 `no-new-privileges`。Docker 不可用时只返回 `runner_unavailable`，严禁调用宿主机 `go` 执行用户代码。
- 容器内只允许标准库和课程提交内容；设置 `GOPROXY=off`、`GOSUMDB=off`、`GOTOOLCHAIN=local`，不安装第三方模块。
- 每个任务先写行为测试得到 RED，再写实现得到 GREEN；任务完成前运行该任务的聚焦测试和完整测试。每个任务形成独立提交，提交信息使用 `feat(go-course): ...` 或 `test(go-course): ...`。
- 后端源文件、前端源文件和测试文件保持单一职责；新增普通源文件目标不超过 300 行，函数目标不超过 40 行，超过时按计划职责拆分。

## Repository Layout

完成后的新增目录固定为：

```text
go/interactive-course/
├── .gitignore
├── README.md
├── go.mod
├── cmd/server/main.go
├── internal/course/
│   ├── model.go
│   ├── catalog.go
│   ├── catalog_test.go
│   └── content/
│       ├── course.json
│       └── lessons/go-start-0{1,2,3,4}/
│           ├── starter.go
│           ├── example.go
│           └── hidden_test.go
├── internal/runner/
│   ├── runner.go
│   ├── docker.go
│   ├── output.go
│   ├── parse.go
│   ├── runner_test.go
│   ├── docker_test.go
│   └── integration_test.go
├── internal/api/
│   ├── handler.go
│   └── handler_test.go
├── runner/Dockerfile
└── web/
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    ├── src/{model,api,store,editor,render,main}.ts
    ├── src/{api,store,render}.test.ts
    ├── src/styles.css
    ├── playwright.config.ts
    └── e2e/course.spec.ts
```

---

## Task 1: 课程目录与四节 Go 内容

**Files:** `go/interactive-course/go.mod`、`internal/course/model.go`、`internal/course/catalog.go`、`internal/course/catalog_test.go`、`internal/course/content/course.json`、四节课的 `starter.go`/`example.go`/`hidden_test.go`。

**Purpose:** 建立服务端唯一可信的课程目录，并验证公共课程数据和隐藏测试之间的一一对应关系。

### Step 1: RED

先创建 `go.mod` 和 `catalog_test.go`，测试以下行为：

- `LoadCatalog` 能得到课程 ID `go-start`、标题“Go 起步”和严格四节、严格顺序的 lesson ID `go-start-01` 到 `go-start-04`。
- 每节都有非空标题、目标、讲解、示例代码、初始代码、练习目标、提示和至少一个公开测试标签。
- 每节有独立隐藏测试源码；测试源码不能出现在 `PublicCourse()` 的序列化 JSON 中。
- lesson ID 重复、缺少关联文件或空字段会使加载失败，而不是静默跳过。

运行 `go test ./internal/course`; 预期因类型、加载器和内容文件尚未实现而失败。

### Step 2: GREEN

- `model.go` 定义内部 `Course`、`Lesson`、`TestDefinition` 和不含隐藏测试的 `PublicCourse`/`PublicLesson` DTO。
- `catalog.go` 使用 `//go:embed content/course.json content/lessons/*` 读取结构化元数据与 lesson 文件；提供 `LoadCatalog() (*Catalog, error)`、`Catalog.PublicCourse()` 和 `Catalog.Lesson(id)`。
- `course.json` 只存可公开的中文文案和测试标签，隐藏测试源码放在对应 lesson 目录，由 catalog 绑定读取。
- 四节练习契约固定如下：
  - `go-start-01` 要求 `main` 输出 `Hello, Go!`，隐藏测试捕获程序输出并检查换行。
  - `go-start-02` 要求 `formatProfile(name string, age int) string` 返回稳定的英文示例描述，测试字符串与整数变量、零值提示对应的行为。
  - `go-start-03` 要求 `classify(score int) string` 正确处理 `100`、`60`、`59` 三个分支边界，并由 `main` 输出一个示例。
  - `go-start-04` 要求 `sum(numbers []int) int` 使用可验证的函数返回结果，覆盖空切片、单元素和多元素输入，并由 `main` 输出一个示例。
- 隐藏测试只作为服务端执行输入，不在公共 DTO 中暴露；测试标签可以公开，用于结果列表展示。

运行 `gofmt -w` 后执行 `go test ./internal/course`; 预期全部通过。

### Step 3: Self-review and commit

检查四节课内容是否承接现有 `go/course.md` 的入门顺序和 `go/course-v2-sample.md` 的“概念、为什么、最小示例、练习”节奏，但不复制 GitHub 仓库文本。运行 `go test ./...`，提交：

```text
feat(go-course): add embedded starter course catalog
```

---

## Task 2: 受限 Docker 执行器与结果解析

**Files:** `internal/runner/runner.go`、`internal/runner/docker.go`、`internal/runner/output.go`、`internal/runner/parse.go`、`runner/Dockerfile`、`internal/runner/runner_test.go`、`internal/runner/docker_test.go`、`internal/runner/integration_test.go`。

**Purpose:** 在不执行宿主机用户代码的前提下，把提交代码、课程隐藏测试和资源限制封装为结构化结果。

### Step 1: RED

先写测试并运行 `go test ./internal/runner`，覆盖：

- 空代码、超过 64 KiB、包含 NUL 字节的提交被拒绝。
- Docker 命令参数包含固定镜像、`--network=none`、`--read-only`、非 root、`--tmpfs`、`--cpus=0.5`、`--memory=128m`、`--pids-limit=64`、`--cap-drop=ALL`、`no-new-privileges` 和独立 `/workspace` 挂载，且没有主机 `go run` 或 `go test` 回退路径。
- `go test -json` 的通过、编译错误、测试失败、`GO_COURSE_STDOUT:` 标记、输出截断和未知事件能被解析为稳定结果。
- `context.DeadlineExceeded` 映射为 `timeout`，找不到 Docker 或 Docker daemon 无法连接映射为 `runner_unavailable`。

### Step 2: GREEN

- `runner.go` 定义 `Status` 常量、`Request`、`Result`、`Diagnostic`、`TestResult`、`Limits` 和 `Runner` 接口；`ValidateCode` 只做请求级代码校验。
- `DockerRunner` 每次执行创建临时目录，写入 `main.go`、最小 `go.mod`、服务端 `hidden_test.go` 和测试 harness；执行结束后用 `defer` 清理临时目录。
- runner 镜像以 `golang:1.25.1-bookworm` 为固定基础，创建 UID 10001 的非 root `runner` 用户，设置本地工具链与离线模块环境。容器命令固定使用下列安全参数：

```text
docker run --rm --network=none --read-only --user 10001:10001
  --cpus=0.5 --memory=128m --pids-limit=64 --cap-drop=ALL
  --security-opt=no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,size=16m
  --mount type=bind,source=<temporary-dir>,target=/workspace
  --workdir /workspace <fixed-image> go test -json -v -count=1 ./...
```

- 用户代码只能写入临时目录的 `main.go`；隐藏测试和 harness 由服务端写入，不能使用客户端路径。
- `output.go` 对 stdout/stderr 统一做 32 KiB 截断并记录截断状态；不会把宿主机路径、环境变量或 Docker 原始错误全文返回。
- `parse.go` 解析 `go test -json`，提取测试通过/失败、诊断行号/列号、失败消息和 harness 标准输出；编译失败优先映射为 `compile_error`，测试断言失败映射为 `test_failed`。
- `integration_test.go` 只在 Docker daemon 可用时运行真实正确代码、编译错误、测试失败和超时场景；不可用时明确 `t.Skip`，并由单元测试保证不可用映射。

### Step 3: Self-review and commit

人工检查 `DockerRunner` 中不存在任何宿主机 Go 执行调用，所有 `exec.Command` 都是 Docker CLI；运行 `gofmt -w` 和 `go test ./...`，提交：

```text
feat(go-course): add isolated docker runner
```

---

## Task 3: Go HTTP API

**Files:** `internal/api/handler.go`、`internal/api/handler_test.go`。

**Purpose:** 对浏览器提供稳定、无隐藏测试泄露的课程与执行接口。

### Step 1: RED

用 fake runner 写 `httptest` 测试并运行 `go test ./internal/api`，覆盖：

- `GET /api/course` 返回四节课程，响应中没有隐藏测试源码。
- `POST /api/execute` 只接受 JSON `lessonId` 和 `code`；未知字段、空 ID、未知 lesson、空代码、超过 64 KiB、错误 JSON 和错误方法返回 HTTP 400 及 `invalid_request`。
- 有效请求把服务端课程隐藏测试传给 runner，不能使用客户端传入测试路径；fake runner 返回的每个状态都按 API 契约输出。
- `runner_unavailable` 返回 HTTP 503，`timeout`/编译错误/测试失败返回可被页面消费的结构化 JSON。

### Step 2: GREEN

- handler 通过依赖注入接收 `course.Catalog` 和 `runner.Runner`；不要在 handler 中直接创建 Docker runner。
- 使用 `http.MaxBytesReader`、`json.Decoder.DisallowUnknownFields` 和方法白名单做请求边界校验；所有响应设置 `Content-Type: application/json; charset=utf-8`。
- `GET /api/course` 只调用 `PublicCourse()`；`POST /api/execute` 根据 lesson ID 从 catalog 获取隐藏测试，再构造 runner 请求。
- 统一错误响应结构，错误信息使用中文，避免返回临时目录、Docker 命令、环境变量和原始内部路径。

### Step 3: Self-review and commit

运行 `gofmt -w`、`go test ./...`，检查响应状态和 JSON 字段与设计文档一致，提交：

```text
feat(go-course): expose course and execution api
```

---

## Task 4: TypeScript/Vite/CodeMirror 前端

**Files:** `web/package.json`、`web/package-lock.json`、`web/tsconfig.json`、`web/vite.config.ts`、`web/index.html`、`web/src/model.ts`、`web/src/api.ts`、`web/src/store.ts`、`web/src/editor.ts`、`web/src/render.ts`、`web/src/main.ts`、`web/src/styles.css`、`web/src/api.test.ts`、`web/src/store.test.ts`、`web/src/render.test.ts`。

**Purpose:** 提供桌面三栏、移动纵向布局和完整运行状态的课程体验。

### Step 1: RED

先建立 Vite/Vitest 配置与纯逻辑测试，运行 `npm test -- --run`，预期在实现状态管理和 API 映射前失败。测试至少验证：

- 第一节默认选中，只有当前节或前一节完成后下一节解锁。
- 草稿、已完成 lesson ID 和选中 lesson 刷新后从 `localStorage` 恢复；重置只恢复当前节 starter code。
- API 正确把 `passed`、`compile_error`、`test_failed`、`timeout`、`runner_unavailable` 和 `invalid_request` 映射为前端联合类型。
- 渲染通过/失败/运行中/不可用状态时，结果区、诊断行号、测试列表和禁用按钮有稳定的可访问文本和 `aria` 状态。

### Step 2: GREEN

- `model.ts` 与后端 DTO 对齐，使用显式联合类型，不用 `any` 吞掉 API 错误。
- `api.ts` 实现 `fetchCourse()` 和 `executeLesson()`；非 2xx 仍尝试解析结构化响应，无法解析时给出中文服务错误。
- `store.ts` 封装进度/草稿持久化、解锁判断、选中 lesson、运行状态和 reset 行为；存储损坏时回到空状态而不是让页面崩溃。
- `editor.ts` 用 CodeMirror Go language support 创建编辑器，设置稳定的最小高度、当前文档监听和销毁方法。
- `render.ts` 按三个职责区域组织页面：左侧课程导航、中间讲解/示例/练习/编辑器、右侧运行结果。运行时右栏显示明确的加载状态，结果变化不改变编辑器高度；通过后才把下一节标记为已完成可选。
- `styles.css` 建立中性深色 token：背景、表面、正文、弱化、蓝色操作色、青色 Go 强调、橙色提示、绿色成功、红色错误；桌面使用 `260px minmax(0, 1fr) 340px`，移动端改为纵向排列，不使用大面积渐变、装饰性圆球或嵌套卡片。
- `vite.config.ts` 将 `/api` 代理到 `http://127.0.0.1:8080`；`main.ts` 启动加载、课程选择、运行、重置、通过解锁和 API 错误状态。
- 页面文案保持课程内容本身的解释性，不添加与功能无关的营销区块；按钮、焦点、键盘操作和减弱动效偏好可用。

### Step 3: Self-review and commit

运行 `npm test -- --run`、`npm run build`，检查源文件行数和移动布局，提交：

```text
feat(go-course): build interactive lesson editor
```

---

## Task 5: 服务启动、开发文档与浏览器验收

**Files:** `cmd/server/main.go`、`README.md`、`web/playwright.config.ts`、`web/e2e/course.spec.ts`、必要时补充 `internal/api`/`internal/runner` 测试。

**Purpose:** 把后端、前端和真实 Docker runner 串成可以启动、测试、验收的本地闭环。

### Step 1: RED

先写启动和浏览器验收所需的入口测试：

- `go run ./cmd/server` 能加载 embed catalog 并监听可配置地址；默认 `127.0.0.1:8080`。
- Playwright 在桌面 1440x900 和移动 390x844 视口加载课程；在 mock API 成功响应下完成第一节运行并看到通过、下一节解锁；在真实 API 返回 `runner_unavailable` 时看到服务不可用提示。
- 页面截图和 DOM 检查确认无横向溢出、编辑器/按钮/结果区无重叠，移动端运行按钮可操作。

运行对应测试，预期因 `main`、Playwright 配置和浏览器应用启动入口尚未完成而失败。

### Step 2: GREEN

- `cmd/server/main.go` 解析 `--addr` 和 `--runner-image`，加载 catalog、创建 DockerRunner、注册 API handler，并在启动失败时输出明确中文错误；不提供宿主机执行分支。
- `README.md` 写清前置条件和命令：

```text
cd go/interactive-course
docker build -t study-go-runner:1.25.1 -f runner/Dockerfile .
go run ./cmd/server --addr 127.0.0.1:8080
cd web
npm ci
npm run dev -- --host 127.0.0.1
```

文档明确说明 Docker daemon 未启动时页面仍可打开，但运行结果为“执行服务不可用”；绝不建议用宿主机 Go 替代。
- Playwright 配置启动 Vite 开发服务器，测试通过路由 mock 验证前端完整状态，再用独立 API/Go 测试验证真实后端；不把 mock 当成真实执行器证明。
- 若 Docker daemon 可用，运行 `docker build`、`go test ./...`、`npm test -- --run`、`npm run build` 和 Playwright 全套；若不可用，仍运行所有不依赖 daemon 的测试，并记录真实执行集成测试为跳过、`runner_unavailable` 为通过。

### Step 3: Self-review and commit

执行完整验证：

```text
cd go/interactive-course && gofmt -w cmd internal && go test ./...
cd web && npm test -- --run && npm run build && npx playwright test
```

检查 `git diff --check`、`git status --short`，提交：

```text
feat(go-course): wire local development and browser checks
```

---

## Final Review and Delivery

所有任务提交并逐任务审查通过后，生成从设计提交 `9ebe352` 到当前 HEAD 的 review package，派发一次完整分支审查，重点检查：API 与 UI DTO 一致、隐藏测试没有泄露、Docker 安全参数仍完整、服务不可用没有宿主机回退、四节课程可通过、移动布局无重叠、现有资料未被修改。Critical/Important 问题必须修复并重新审查，Minor 问题记录但不得掩盖真实缺陷。

最终必须提供：

- 新项目路径和启动命令。
- 每个独立提交的短 SHA 与职责。
- `go test ./...`、`npm test -- --run`、`npm run build`、Playwright 和 Docker 集成测试的真实结果；未运行或因 daemon 不可用跳过的项目明确写出。
- 明确说明当前 Docker daemon 状态，以及真实执行链路是否已在本机完成验证。
