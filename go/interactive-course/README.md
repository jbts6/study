# Go 交互式课程

这是一个面向前端开发者的 Go 入门课程原型。课程页面提供讲解、CodeMirror 编辑器和运行结果面板；提交代码后，Go 服务端把代码与服务端隐藏测试写入临时目录，并在本机执行 `go test`。本项目默认面向单人自学，Docker 执行器作为可选隔离模式保留。

现有仓库中的 `go/course.md`、`go/course-v2-sample.md` 和项目教程仍是独立的课程资料。本目录只承载交互式课程站，不覆盖原有资料。

## 前置条件

- Go `1.25.1` 或兼容的 Go 工具链。
- Node.js `24`、npm。
- Docker Desktop 仅在选择 Docker 执行模式时需要。

## 启动

在项目目录执行：

```text
cd go/interactive-course
go run ./cmd/server --addr 127.0.0.1:8080 --runner-mode local
```

需要 Docker 隔离时，先构建镜像并显式切换执行模式：

```text
cd go/interactive-course
docker build -t study-go-runner:1.25.1 -f runner/Dockerfile runner
go run ./cmd/server --addr 127.0.0.1:8080 --runner-mode docker
```

另开终端启动前端：

```text
cd go/interactive-course/web
npm ci
npm run dev -- --host 127.0.0.1
```

浏览器打开 Vite 输出的本地地址，默认是 `http://127.0.0.1:5173`。

## 课程范围

第一版包含“Go 起步”四节：

1. 第一个 Go 程序：`package main`、`func main`、`fmt.Println`。
2. 变量与基础类型：`string`、`int`、零值和字符串格式化。
3. `if` 与 `for` 控制流：条件分支和边界值。
4. 函数与返回值：参数、返回值、切片和 `for range`。

通过当前小节的服务端隐藏测试后，下一小节才会解锁。已完成状态和编辑器草稿保存在浏览器 `localStorage`，服务端不保存用户身份、历史代码或运行记录。

## 执行边界

默认的 `local` 模式面向可信的本机自学代码：每次执行使用独立临时目录和本机 Go 进程，并限制代码大小、合并输出大小和执行时间。它不是安全沙箱，不应把服务暴露给不可信用户或公网。

`docker` 模式面向不可信代码：使用固定的 `study-go-runner:1.25.1` 镜像，关闭网络、使用非 root 用户、只读根文件系统、临时可写目录、CPU/内存/进程数限制、丢弃 Linux capabilities 和 `no-new-privileges`。代码大小限制为 64 KiB，标准输出和错误输出限制为 32 KiB。

课程测试源码只由服务端按 `lessonId` 选择，不接受浏览器传入的测试路径；`GET /api/course` 的响应不包含隐藏测试源码。

## 验证

后端：

```text
cd go/interactive-course
gofmt -w cmd internal
go test ./...
```

前端：

```text
cd go/interactive-course/web
npm ci
npm test -- --run
npm run build
npx playwright install chromium
npx playwright test
```

Playwright 测试使用 mock API 验证桌面和移动端的页面状态、通过后解锁和布局；`internal/runner/integration_test.go` 在 Docker daemon 和 runner 镜像可用时验证可选的真实容器执行，否则会明确跳过。
