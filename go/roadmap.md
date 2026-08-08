# Go 后端开发学习路线图

> 面向前端开发者，零基础转 Go 后端/全栈方向。配合 `resources.md` 使用。

---

## 学习者画像

| 属性 | 值 |
|---|---|
| 当前水平 | 零基础（有前端编程经验：JS/异步/JSON/调试思维） |
| 学习目标 | 掌握 Go 后端开发，能独立编写生产级 API 服务 |
| 目标技能 | Go 后端 / 全栈 |
| 时间周期 | 80 天（约 12 周，含 3 个缓冲日） |
| 每日投入 | 约 2 小时（每周 15 小时） |
| 推荐节奏 | 紧凑 |

> ⚠️ 每周时间沿用你 Python 的 15 小时。若同时学 Python，建议先完成 Python 阶段 1 再启动 Go，避免语法体系混淆。

---

## 成功标准

完成本路线图后，应能：

- 用 Gin 框架独立编写一个 RESTful API 服务（路由/参数绑定/中间件）
- 理解并使用 goroutine/channel 处理并发任务（非事件循环思维）
- 用 GORM 操作数据库实现完整 CRUD（建表/查询/事务）
- 编写单元测试，并部署一个可运行的后端项目

---

## 阶段计划

| 阶段 | 时间 | 主题 | 里程碑（可验证产出物） |
|---|---|---|---|
| 1 语法基础 | Day 1-25 | 变量/切片/map/struct/指针/方法/接口/error/包模块 | 用 Go 写一个命令行小工具（如待办管理） |
| | 缓冲 | 复习/整理 | |
| 2 并发与标准库 | Day 27-46 | goroutine/channel/select/标准库/文件os | 写一个并发抓取/处理任务，用 channel 通信 |
| | 缓冲 | 复习/整理 | |
| 3 后端开发 | Day 48-72 | net/http/JSON/Gin/GORM/中间件/测试 | 用 Gin + GORM 写一个带数据库的 CRUD API |
| 4 实战项目 | Day 74-80 | 综合 RESTful API 项目 | 可部署的完整后端服务（含测试） |

---

## 每周计划

| 周次 | 主题 | 时长 | 风险 |
|---|---|---|---|
| 1 | 环境搭建 + 变量/类型/常量 + 控制流(if/for/switch) | 15h | go mod 不熟，环境配置卡点 |
| 2 | 函数(多返回值) + 切片 slice + 映射 map | 15h | slice 的 cap 概念前端没有 |
| 3 | 结构体 struct + 方法(值/指针接收者) | 15h | 指针接收者 vs 值接收者易混 |
| 4 | 指针深入 + 接口 interface | 15h | **指针和接口是最大门槛** |
| 5 | 接口实战 + 错误处理 + 包与模块 | 15h | error 无处不在，需适应显式处理 |
| 6 | 阶段1收尾 + 命令行项目 | 15h | 综合运用，查漏补缺 |
| 7 | goroutine 并发入门 | 15h | **真并行思维转换，最难一周** |
| 8 | channel + select 多路复用 | 15h | channel 通信模式需练手 |
| 9 | 标准库(fmt/io/strings/json) + 文件 os | 15h | 量大但不难，多查文档 |
| 10 | net/http + JSON 处理 + Gin 框架 | 15h | 前端有 HTTP 基础，迁移快 |
| 11 | database/sql + GORM + 中间件 + 测试 | 15h | ORM 概念前端可能陌生 |
| 12 | 综合 RESTful API 项目 | 15h | 串联所有技能，部署收尾 |

---

## 推荐学习栈

| 用途 | 资源 |
|---|---|
| 交互式入门 | A Tour of Go（tour.go.dev，官方，免费，浏览器内运行） |
| 示例驱动 | Go by Example（gobyexample.com，免费，每概念一个示例） |
| 系统学习 | 《Go 程序设计语言》（The Go Programming Language，Kernighan 著） |
| 进阶实践 | 《Go 语言实战》（Go in Action） |
| 官方规范 | Effective Go（go.dev/doc/effective_go，免费） |
| Web 框架 | Gin 官方文档（gin-gonic.com） |
| ORM | GORM 官方文档（gorm.io） |
| 中文视频 | 李文周 B站 Go 教程（搜索"李文周 Go"） |
| 系统课程 | 极客时间《Go 语言从入门到实战》 |

---

## 常见卡点（带前端类比）

- **指针难理解** → 前端没有"内存地址"概念。把指针想象成"变量的门牌号"，`&` 取地址，`*` 取值。JS 里对象是引用传递，Go 的指针让你显式控制这件事
- **接口隐式实现** → TS 的 interface 要 `implements` 声明，Go 只要方法签名匹配就自动实现（鸭子类型）。先写 struct，再写接口
- **error 无处不在** → 没有 try/catch，每个函数返回 `error`，必须 `if err != nil`。看似啰嗦但强制处理错误，比 JS 的"忘了 catch"更安全
- **goroutine vs async** → JS 的 async 是单线程事件循环，goroutine 是真·多核并行。不要用 Promise 思维套，要理解"两个函数同时在跑"
- **slice 的 cap** → slice 底层是数组引用，`append` 可能触发扩容。理解 `len`（当前长度）和 `cap`（底层数组容量）的区别
- **大写=导出** → Go 用首字母大小写控制可见性，大写=public，小写=private。没有 `export` 关键字，这是最反直觉的约定
- **go mod 对标 npm** → `go.mod` = `package.json`，`go.sum` = `package-lock.json`，`go get` = `npm install`

---

## 动态调整说明

- 若同时学 Python → 先完成 Python 阶段 1（15 天）再启动 Go，避免两个语法体系（缩进 vs 花括号）混淆
- 若每周时间降至 8 小时以下 → 周期延长至 16 周，阶段 2（并发）天数不动，这是最难的部分不能压缩
- 若已有 Node/Express 后端经验 → 阶段 3 可加速至 2 周，重点投入阶段 2 并发（Node 单线程，Go 并发是全新领域）
- 若目标是微服务架构 → 阶段 4 增加 gRPC + protobuf + 服务注册发现内容
- 若觉得 Tour of Go 太浅 → 直接上《Go 程序设计语言》前 5 章，再回 Go by Example 补示例
