# Go 后端开发完整学习资料清单

> 配合 `roadmap.md` 使用。按路线图 4 阶段组织，每份资料标注类型、费用、难度与推荐理由。
> 标注 [前端友好] 的资源对有 JS 背景的学习者更易上手。

---

## 环境与工具（开始前必装）

| 资源 | 类型 | 费用 | 说明 |
|------|------|------|------|
| Go 安装包 | 运行时 | 免费 | go.dev/dl 下载，Windows/Mac/Linux 均支持。装完终端跑 `go version` 验证 |
| VS Code + Go 插件 | 编辑器 | 免费 | 你已熟悉，装 Go 扩展即可。自动补全/调试/格式化全都有 [前端友好] |
| Go Playground | 在线运行 | 免费 | play.golang.org，官方在线运行 Go 代码。不用装环境就能跑示例 [前端友好] |
| GoLand | IDE | 付费 | JetBrains 出品，最强 Go IDE。可选，VS Code 够用 |

---

## 阶段 1 · 语法基础（Day 1-25）

### 主线资源

| 资源 | 类型 | 费用 | 难度 | 推荐理由 |
|------|------|------|------|----------|
| A Tour of Go | 交互式教程 | 免费 | 入门 | tour.go.dev，官方出品，浏览器内直接运行代码。零基础首选，过一遍建立整体认知 [前端友好] |
| Go by Example | 网站 | 免费 | 入门 | gobyexample.com，每概念一个可运行示例。查语法、看用法最方便 [前端友好] |
| 《Go 程序设计语言》 | 书 | 付费 | 中级 | Brian Kernighan（C 语言之父）著，Go 圣经。体系完整，适合精读。机械工业出版社 |

### 辅助参考

| 资源 | 类型 | 费用 | 用途 |
|------|------|------|------|
| Effective Go | 文档 | 免费 | go.dev/doc/effective_go，官方风格指南，写地道 Go 必读 |
| Go 官方包文档 | 文档 | 免费 | go.dev/pkg，标准库速查，最权威 |
| 李文周 Go 教程 | 视频 | 免费 | B站搜索"李文周 Go"，中文讲解，适合视频学习者 |

### 阶段 1 前端类比速查

| Go 概念 | 前端对应 | 关键差异 |
|---------|---------|---------|
| var / const | let / const | Go 有编译期类型检查 |
| for | for / while | Go 只有 for，没有 while |
| slice | Array | 有 cap 容量概念，底层是数组引用 |
| map | Object / Map | 必须用 make 初始化 |
| struct | class | Go 没有 class，用 struct + 方法 |
| interface | TS interface | 隐式实现，不用声明 implements |
| error | throw / catch | 显式返回值，无 try/catch |
| 包首字母大写 | export | 大写=公开，小写=私有，没有 export 关键字 |
| go.mod | package.json | 模块声明 |
| go get | npm install | 安装依赖 |

---

## 阶段 2 · 并发与标准库（Day 27-46）

### 并发核心

| 资源 | 类型 | 费用 | 难度 | 推荐理由 |
|------|------|------|------|----------|
| Go by Example · 并发章节 | 网站 | 免费 | 中级 | gobyexample.com，goroutine/channel/select 都有可运行示例 [前端友好] |
| 《Go 程序设计语言》第 7-9 章 | 书 | 付费 | 中级 | 并发讲得最透彻，channel 语义学透这本 |
| Effective Go · 并发 | 文档 | 免费 | 中级 | 官方并发最佳实践，"通过通信共享内存"理念来源 |

### 标准库参考

| 资源 | 类型 | 费用 | 用途 |
|------|------|------|------|
| Go 标准库文档 | 文档 | 免费 | go.dev/pkg，重点看 fmt/io/strings/strconv/time/os |
| Go by Example · 标准库 | 网站 | 免费 | 文件操作/JSON/时间处理示例 |

### 阶段 2 关键认知转换

| Go 并发 | 前端异步 | 核心差异 |
|---------|---------|---------|
| goroutine | async function | 真并行（多核） vs 单线程事件循环 |
| channel | (无直接对应) | goroutine 间消息传递管道 |
| select | Promise.race | 多路复用，等待第一个就绪的 channel |
| sync.WaitGroup | Promise.all | 等待一组任务完成 |
| mutex | (无) | 互斥锁，保护共享数据 |

---

## 阶段 3 · 后端开发（Day 48-72）

### Web 框架与数据库

| 资源 | 类型 | 费用 | 难度 | 推荐理由 |
|------|------|------|------|----------|
| Gin 官方文档 | 文档 | 免费 | 中级 | gin-gonic.com，最流行的 Go Web 框架。对标 Express，迁移快 [前端友好] |
| GORM 官方文档 | 文档 | 免费 | 中级 | gorm.io，Go 最流行 ORM。对标 Sequelize/TypeORM，中文文档完善 [前端友好] |
| net/http 标准库 | 文档 | 免费 | 中级 | go.dev/pkg/net/http，原生 HTTP，理解底层再用框架 |
| 《Go Web 编程》 | 书 | 付费 | 中级 | 系统讲 Go 后端开发，含数据库/模板/部署 |

### 测试

| 资源 | 类型 | 费用 | 用途 |
|------|------|------|------|
| Go by Example · 测试 | 网站 | 免费 | testing 包基本用法 |
| Go 测试官方文档 | 文档 | 免费 | go.dev/pkg/testing，表驱动测试模式 |

### 阶段 3 前端类比

| Go 后端 | Node 后端 | 说明 |
|---------|----------|------|
| net/http | http 模块 | 原生 HTTP 服务 |
| Gin | Express | Web 框架，路由/中间件/参数绑定 |
| GORM | Sequelize/TypeORM | ORM，操作数据库 |
| middleware | Express middleware | 请求处理链，日志/鉴权/CORS |
| go test | Jest | 单元测试，`go test` 命令驱动 |
| struct tag | (装饰器) | `json:"name"` 控制 JSON 序列化字段名 |

---

## 阶段 4 · 实战项目（Day 74-80）

| 资源 | 类型 | 费用 | 用途 |
|------|------|------|------|
| Go 项目布局标准 | 文档 | 免费 | github.com/golang-standards/project-layout，工程化目录规范 |
| Awesome Go | 资源库 | 免费 | github.com/avelino/awesome-go，Go 生态资源大全 |
| Gin 示例项目 | 代码 | 免费 | github.com/gin-gonic/gin 示例目录，实战参考 |

---

## 进阶方向（路线图完成后选学）

| 方向 | 资源 | 说明 |
|------|------|------|
| 微服务 | 《Go 语言高并发与微服务实战》 | gRPC + protobuf + 服务治理 |
| 性能优化 | 《Go 语言底层原理剖析》 | GC/调度器/内存模型 |
| 云原生 | Docker + Kubernetes | Go 是云原生第一语言，k8s 就是 Go 写的 |
| 源码阅读 | Go 标准库源码 | go.dev/src，学地道 Go 写法的最佳教材 |

---

## 资源使用建议

1. **主线 + 查询**：A Tour of Go 过一遍建立认知 → Go by Example 随时查示例 → 《Go 程序设计语言》精读补深度
2. **免费优先**：Tour of Go + Go by Example + 官方文档已覆盖 80%，付费书按需补
3. **本地必装**：Go 无法在浏览器像 Python 那样运行，必须本地装环境。用 Go Playground 只适合验证小片段
4. **视频 vs 文字**：概念理解看文字（Go by Example），并发模型看视频（李文周）配画图，效率最高
5. **先官方后社区**：Gin/GORM 优先看官方文档（中文完善），社区博客作补充

---

## 资源费用汇总

| 类别 | 免费资源 | 付费资源（按需） |
|------|---------|-----------------|
| 入门 | A Tour of Go / Go by Example / Effective Go | 《Go 程序设计语言》 |
| 并发 | Go by Example 并发章节 / Effective Go | 《Go 程序设计语言》（并发章节） |
| 后端 | Gin 文档 / GORM 文档 / net/http 文档 | 《Go Web 编程》 |
| 测试 | Go by Example / 官方 testing 文档 | - |
| 视频 | 李文周 B站 | 极客时间课程 |

> 全程用免费资源（Tour of Go + Go by Example + 官方文档）完全走得通，《Go 程序设计语言》是唯一强烈推荐买的付费书。
