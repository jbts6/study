# Go 实战项目：待办管理 API（手把手教程）

> 从零开始搭一个完整的 RESTful API 服务。技术栈：Gin + GORM + SQLite。
> 每一步拆解：做什么 → 代码 → 为什么 → 前端类比 → 预期结果。
> 做完你会有一个能运行的后端服务，支持待办的增删改查。

---

## 项目目标

搭一个待办管理 API，支持：
- 创建待办（POST）
- 查询所有待办（GET）
- 查询单个待办（GET /:id）
- 更新待办（PUT）
- 删除待办（DELETE）

**前端类比**：类似用 Express + MongoDB 搭一个后端，只是换成 Go + Gin + SQLite。你以后写任何 Go 后端都是这个模式。

---

## 最终效果

```bash
# 创建待办
curl -X POST http://localhost:8080/todos -d '{"title":"学Go","done":false}' -H "Content-Type: application/json"
# 返回: {"id":1,"title":"学Go","done":false}

# 查询所有
curl http://localhost:8080/todos
# 返回: [{"id":1,"title":"学Go","done":false}]

# 更新
curl -X PUT http://localhost:8080/todos/1 -d '{"title":"学Go","done":true}' -H "Content-Type: application/json"
# 返回: {"id":1,"title":"学Go","done":true}

# 删除
curl -X DELETE http://localhost:8080/todos/1
# 返回: {"message":"已删除"}
```

---

## 环境准备

确保装了 Go（终端跑 `go version` 能出版本号）。不用装数据库——SQLite 是文件数据库，GORM 会自动创建。

---

## 第 1 步：初始化项目

**做什么**：创建项目目录，初始化 go module。

```bash
mkdir todo-api
cd todo-api
go mod init todo-api
```

**为什么**：`go mod init` 生成 `go.mod`（类似 `package.json`），声明模块名和依赖。所有 Go 项目都从这里开始。

**前端类比**：= `npm init`，生成 package.json。

**预期结果**：目录里出现 `go.mod` 文件，内容是：
```
module todo-api
go 1.21
```

---

## 第 2 步：安装依赖

**做什么**：安装 Gin（Web 框架）、GORM（ORM）、SQLite 驱动。

```bash
go get github.com/gin-gonic/gin
go get gorm.io/gorm
go get gorm.io/driver/sqlite
```

**为什么**：
- Gin：Web 框架，处理 HTTP 路由（对标 Express）
- GORM：ORM，用 Go 代码操作数据库（对标 Sequelize）
- SQLite 驱动：让 GORM 能连 SQLite（不用装 MySQL）

**前端类比**：= `npm install express sequelize sqlite3`。

**预期结果**：`go.mod` 里多了 require 段，`go.sum` 文件生成（类似 package-lock.json）。

---

## 第 3 步：定义数据模型

**做什么**：创建 `main.go`，定义 Todo 结构体。

```go
package main

import "gorm.io/gorm"

// Todo 对应数据库的 todos 表
type Todo struct {
    gorm.Model        // 内置 ID/CreatedAt/UpdatedAt/DeletedAt
    Title string `json:"title" binding:"required"`  // 标题，必填
    Done  bool   `json:"done"`                       // 是否完成
}
```

**为什么**：
- `gorm.Model` 给你免费的 ID、创建时间、更新时间、软删除——不用自己写
- `json:"title"` 控制 JSON 字段名（对标 Express 里 JSON 的 key）
- `binding:"required"` 让 Gin 自动校验：创建时 title 不能空

**前端类比**：类似 TS 的 `interface Todo { id: number; title: string; done: boolean }`，但 Go 的 struct 是实际数据结构，GORM 用它映射数据库表。

**预期结果**：文件能保存，还没法运行（main 函数还没写）。

---

## 第 4 步：连接数据库 + 自动建表

**做什么**：在 main.go 里连接 SQLite，自动建表。

```go
package main

import (
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

type Todo struct {
    gorm.Model
    Title string `json:"title" binding:"required"`
    Done  bool   `json:"done"`
}

func main() {
    // 连接 SQLite（文件不存在会自动创建）
    db, err := gorm.Open(sqlite.Open("todo.db"), &gorm.Config{})
    if err != nil {
        panic("数据库连接失败: " + err.Error())
    }

    // 自动建表（根据 Todo struct 创建 todos 表）
    db.AutoMigrate(&Todo{})

    println("数据库就绪")
}
```

**为什么**：
- `gorm.Open(sqlite.Open("todo.db"))`：打开/创建 todo.db 文件（SQLite 把整个数据库存一个文件）
- `AutoMigrate`：根据 struct 自动建表，字段对应列。改 struct 再跑会自动更新表结构

**前端类比**：= Sequelize 的 `sync()`，根据模型自动建表。不用手写 SQL CREATE TABLE。

**预期结果**：运行 `go run main.go`，输出"数据库就绪"，目录里出现 `todo.db` 文件。

---

## 第 5 步：搭建 Gin 路由框架

**做什么**：创建 Gin 应用，注册路由（先空壳，下一步填实现）。

在 main 函数里继续添加：

```go
func main() {
    db, _ := gorm.Open(sqlite.Open("todo.db"), &gorm.Config{})
    db.AutoMigrate(&Todo{})

    // 创建 Gin 应用
    r := gin.Default()

    // 注册路由（handler 还没写，先占位）
    r.GET("/todos", getTodos)
    r.GET("/todos/:id", getTodo)
    r.POST("/todos", createTodo)
    r.PUT("/todos/:id", updateTodo)
    r.DELETE("/todos/:id", deleteTodo)

    // 启动服务
    r.Run(":8080")   // 阻塞，监听 8080 端口
}
```

**为什么**：
- `gin.Default()`：创建应用，自带日志和错误恢复中间件
- 路由按 RESTful 规范：GET 查、POST 增、PUT 改、DELETE 删
- `:id` 是路径参数（对标 Express 的 `/todos/:id`）

**前端类比**：= Express 的 `app.get/post/put/delete`。Gin 的路由注册几乎和 Express 一一对应。

**预期结果**：现在运行会报错（handler 函数还没定义），下一步实现。

---

## 第 6 步：实现创建待办（POST /todos）

**做什么**：写 createTodo handler，接收 JSON 创建待办。

```go
// 注意：db 需要变成全局变量，让 handler 能访问
var db *gorm.DB

func main() {
    db, _ = gorm.Open(sqlite.Open("todo.db"), &gorm.Config{})
    db.AutoMigrate(&Todo{})
    
    r := gin.Default()
    r.POST("/todos", createTodo)
    // ... 其他路由
    r.Run(":8080")
}

// 创建待办
func createTodo(c *gin.Context) {
    var todo Todo
    // ShouldBindJSON：自动把请求 JSON 绑定到 struct，并校验 binding 标签
    if err := c.ShouldBindJSON(&todo); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})   // 校验失败返回 400
        return
    }
    
    // 存入数据库
    db.Create(&todo)
    
    // 返回创建结果（201 Created）
    c.JSON(201, todo)
}
```

**为什么**：
- `db` 设为全局变量：handler 函数需要访问数据库，Go 没有依赖注入，最简单的方式是全局变量（生产环境会用依赖注入）
- `ShouldBindJSON(&todo)`：Gin 自动把请求体的 JSON 填入 todo struct，同时校验 `binding:"required"`——title 为空会报错
- `db.Create(&todo)`：GORM 插入数据库，会自动填充 todo.ID
- `c.JSON(201, todo)`：返回 JSON，201 是创建成功的状态码

**前端类比**：`ShouldBindJSON` = Express 的 `body-parser` + 手动校验。Gin 靠 struct tag 自动校验，比 Express 省事。

**预期结果**：运行 `go run main.go`，然后另开终端：
```bash
curl -X POST http://localhost:8080/todos -d '{"title":"学Go","done":false}' -H "Content-Type: application/json"
```
返回：`{"id":1,"title":"学Go","done":false,"CreatedAt":"...","UpdatedAt":"..."}`

---

## 第 7 步：实现查询列表（GET /todos）

**做什么**：写 getTodos，返回所有待办。

```go
func getTodos(c *gin.Context) {
    var todos []Todo
    db.Find(&todos)           // 查询所有
    c.JSON(200, todos)
}
```

**为什么**：`db.Find(&todos)` 查整张表，结果填入切片。就这么简单——GORM 帮你生成 `SELECT * FROM todos`。

**前端类比**：= Sequelize 的 `Todo.findAll()`。

**预期结果**：
```bash
curl http://localhost:8080/todos
```
返回：`[{"id":1,"title":"学Go","done":false,...}]`

---

## 第 8 步：实现查询单个（GET /todos/:id）

**做什么**：根据 ID 查单个待办。

```go
func getTodo(c *gin.Context) {
    id := c.Param("id")        // 从路径取 :id 参数
    var todo Todo
    // 查询，找不到返回 404
    if err := db.First(&todo, id).Error; err != nil {
        c.JSON(404, gin.H{"error": "待办不存在"})
        return
    }
    c.JSON(200, todo)
}
```

**为什么**：
- `c.Param("id")`：取路径参数（对标 Express 的 `req.params.id`）
- `db.First(&todo, id)`：按主键查，找不到返回 error
- `.Error` 检查错误：GORM 的错误处理模式，error 非 nil 表示出错

**前端类比**：= `Todo.findByPk(id)`，不存在返回 404。

**预期结果**：
```bash
curl http://localhost:8080/todos/1    # 返回待办
curl http://localhost:8080/todos/999  # 返回 {"error":"待办不存在"}
```

---

## 第 9 步：实现更新（PUT /todos/:id）

**做什么**：根据 ID 更新待办。

```go
func updateTodo(c *gin.Context) {
    id := c.Param("id")
    var todo Todo
    // 先查是否存在
    if err := db.First(&todo, id).Error; err != nil {
        c.JSON(404, gin.H{"error": "待办不存在"})
        return
    }
    // 绑定更新数据
    if err := c.ShouldBindJSON(&todo); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    // 保存
    db.Save(&todo)
    c.JSON(200, todo)
}
```

**为什么**：先查存在（不存在 404），再绑定新数据，最后 `db.Save` 保存。`Save` 会更新所有字段。

**前端类比**：= `instance.update(req.body)`。

**预期结果**：
```bash
curl -X PUT http://localhost:8080/todos/1 -d '{"title":"学Go","done":true}' -H "Content-Type: application/json"
```
返回：`{"id":1,"title":"学Go","done":true,...}`

---

## 第 10 步：实现删除（DELETE /todos/:id）

**做什么**：根据 ID 删除待办。

```go
func deleteTodo(c *gin.Context) {
    id := c.Param("id")
    // 软删除（gorm.Model 自带，数据还在但标记为已删）
    if err := db.Delete(&Todo{}, id).Error; err != nil {
        c.JSON(404, gin.H{"error": "删除失败"})
        return
    }
    c.JSON(200, gin.H{"message": "已删除"})
}
```

**为什么**：`db.Delete` 默认软删除——数据没真删，只是标记 DeletedAt。查询时自动过滤已删除的。想真删用 `db.Unscoped().Delete()`。

**前端类比**：= `instance.destroy()`（Sequelize 的 paranoid 软删除）。

**预期结果**：
```bash
curl -X DELETE http://localhost:8080/todos/1
```
返回：`{"message":"已删除"}`

---

## 第 11 步：完整代码 + 运行测试

把所有代码拼起来，完整 `main.go`：

```go
package main

import (
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
    "github.com/gin-gonic/gin"
)

type Todo struct {
    gorm.Model
    Title string `json:"title" binding:"required"`
    Done  bool   `json:"done"`
}

var db *gorm.DB

func main() {
    db, _ = gorm.Open(sqlite.Open("todo.db"), &gorm.Config{})
    db.AutoMigrate(&Todo{})

    r := gin.Default()
    r.GET("/todos", getTodos)
    r.GET("/todos/:id", getTodo)
    r.POST("/todos", createTodo)
    r.PUT("/todos/:id", updateTodo)
    r.DELETE("/todos/:id", deleteTodo)
    r.Run(":8080")
}

func getTodos(c *gin.Context) {
    var todos []Todo
    db.Find(&todos)
    c.JSON(200, todos)
}

func getTodo(c *gin.Context) {
    var todo Todo
    if err := db.First(&todo, c.Param("id")).Error; err != nil {
        c.JSON(404, gin.H{"error": "待办不存在"})
        return
    }
    c.JSON(200, todo)
}

func createTodo(c *gin.Context) {
    var todo Todo
    if err := c.ShouldBindJSON(&todo); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    db.Create(&todo)
    c.JSON(201, todo)
}

func updateTodo(c *gin.Context) {
    var todo Todo
    if err := db.First(&todo, c.Param("id")).Error; err != nil {
        c.JSON(404, gin.H{"error": "待办不存在"})
        return
    }
    c.ShouldBindJSON(&todo)
    db.Save(&todo)
    c.JSON(200, todo)
}

func deleteTodo(c *gin.Context) {
    db.Delete(&Todo{}, c.Param("id"))
    c.JSON(200, gin.H{"message": "已删除"})
}
```

运行：
```bash
go run main.go
```

另开终端测试完整流程：
```bash
# 1. 创建 3 个待办
curl -X POST http://localhost:8080/todos -d '{"title":"学Go","done":false}' -H "Content-Type: application/json"
curl -X POST http://localhost:8080/todos -d '{"title":"学Gin","done":false}' -H "Content-Type: application/json"
curl -X POST http://localhost:8080/todos -d '{"title":"学GORM","done":false}' -H "Content-Type: application/json"

# 2. 查所有
curl http://localhost:8080/todos

# 3. 查单个
curl http://localhost:8080/todos/1

# 4. 更新（标记完成）
curl -X PUT http://localhost:8080/todos/1 -d '{"title":"学Go","done":true}' -H "Content-Type: application/json"

# 5. 删除
curl -X DELETE http://localhost:8080/todos/2

# 6. 再查所有，确认删除和更新生效
curl http://localhost:8080/todos
```

---

## 总结

你刚做了一个完整的 Go 后端 API，包含：
- **路由**：Gin 注册 5 个 RESTful 接口
- **数据库**：GORM + SQLite，自动建表
- **校验**：struct tag 自动校验必填字段
- **错误处理**：404/400 合理返回

### 这个项目的价值

改造成任何业务只需：
1. 改 `Todo` struct → 你的模型（Product/Order/User）
2. 5 个 handler 结构不变（查列表/查单个/增/改/删）
3. 加中间件（鉴权/日志/CORS）

**这就是 Go 后端的核心骨架**。你以后写的任何 Go API 服务都是这个模式的变种。

### 扩展方向

- 加鉴权中间件（JWT）
- 加分页（`?page=1&size=20`）
- 换 MySQL（改一行连接代码）
- 加 Swagger 文档
- Docker 部署
- 前端对接（你的前端背景在这里是优势）
