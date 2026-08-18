# Go 后端开发完整教程

> 面向前端开发者的 Go 自学教程。22 课覆盖从语法到后端实战。
> 每课拆成多个知识点小节，每节只讲一个点，配最小代码示例和前端类比。
> 离线可学，无需上网搜索。配合 `roadmap.md`（时间排期）和 `resources.md`（补充资源）使用。

---

## 目录

**阶段 1 · 语法基础**（第 1-10 课）
**阶段 2 · 并发与标准库**（第 11-15 课）
**阶段 3 · 后端开发**（第 16-21 课）
**阶段 4 · 实战**（第 22 课）

---

# 阶段 1 · 语法基础

## 第 1 课 · 环境与基础语法

> 你有 JS 基础，这课主要学 Go 的"不一样"——语法相似但细节不同。

---

### 知识点 1：go 命令与模块管理

Go 用 `cargo`... 不对，Go 用 **`go` 命令**本身管理项目，不用单独的包管理器。`go mod` 就是 Go 的 `package.json`。

```bash
go mod init myproject    # 初始化项目（生成 go.mod）
go run main.go           # 运行（类似 node main.js）
go build                 # 编译成可执行文件
go get github.com/xxx    # 安装依赖（类似 npm install）
```

**前端类比**：`go.mod` = `package.json`，`go.sum` = `package-lock.json`，`go get` = `npm install`。Go 的好处是编译成单一可执行文件，不用带 node_modules。

---

### 知识点 2：第一个程序

每个 Go 程序的入口是 `package main` 里的 `func main()`。

```go
package main          // 声明包，main 是可执行程序的入口包

import "fmt"          // 导入标准库，fmt 负责格式化输出

func main() {         // 主函数，程序从这里开始
    fmt.Println("Hello, Go!")   // 输出: Hello, Go!
}
```

**前端类比**：`package main` 类似你的入口 HTML/JS 文件，`func main()` 是程序入口，对标浏览器的 `main()` 或 Node 的顶层代码。`fmt.Println` = `console.log`。

---

### 知识点 3：变量声明——var 和 :=

Go 声明变量有两种方式，这是和 JS 最大的语法差异之一。

```go
// 方式1：var 显式声明（类型写在变量名后面！）
var name string = "Go"      // 完整写法
var age = 25                // 类型推断，省略类型

// 方式2：:= 短变量声明（最常用！）
city := "北京"              // 自动推断类型，最简洁
count := 100

fmt.Println(name, age, city, count)
```

**关键区别**：
- `:=` 只能在函数内部用，且必须是新变量
- `var` 可以在任何地方用，包括包级别
- Go 的类型写在变量名**后面**（`var x int`），和 TS/JS 相反（`let x: int`）

**前端类比**：`:=` 类似 JS 的 `let`（最常用），`var name string` 类似 TS 的 `let name: string`，只是类型位置反过来。

---

### 知识点 4：基本类型

Go 是**静态类型**——变量声明后类型就定了，不能改。这是和 JS（动态类型）最大的区别。

```go
var i int = 42           // 整数
var f float64 = 3.14     // 浮点
var s string = "hello"   // 字符串
var b bool = true        // 布尔（小写 true/false，和 JS 一致）

// 类型推断
n := 42         // 推断为 int
pi := 3.14      // 推断为 float64
```

注意：Go 的 bool 是 `true`/`false`（小写），和 JS 一致，但和 Python 的 `True`/`False` 不同。

**前端类比**：JS 的 `let x = 42`，x 可以随时变成字符串 `x = "hi"`。Go 不行——`int` 变量不能赋字符串，编译就报错。这是"静态类型"的含义：编译期就把类型定死，减少运行时错误。

---

### 知识点 5：常量 const

```go
const Pi = 3.14159
const AppName = "我的应用"
const MaxRetries = 3
```

常量用 `const`，和 JS 一样。但 Go 的 const 可以不标类型（无类型常量），使用时自动适配。

---

### 知识点 6：多变量赋值与交换

```go
// 同时声明多个
a, b := 10, 20

// 交换值——一行搞定，不用临时变量
a, b = b, a
fmt.Println(a, b)   // 输出: 20 10
```

**前端类比**：JS 交换要用临时变量或解构 `[a, b] = [b, a]`。Go 直接 `a, b = b, a`，更简洁。

---

### 小结

| 知识点 | 要点 |
|---|---|
| go mod | Go 的 package.json |
| package main | 可执行程序入口 |
| := | 最常用的变量声明（类似 JS let） |
| 静态类型 | 声明后类型不可变（和 JS 最大区别） |
| const | 常量，和 JS 一致 |
| a, b = b, a | 一行交换变量 |

**练习**：用 `:=` 声明你的名字（字符串）、年龄（整数）、是否开发者（布尔），用 `fmt.Printf` 格式化输出。

---

## 第 2 课 · 控制流与函数

> Go 刻意简化了控制流：只有 `for` 没有 `while`，`if` 不加括号。函数能多返回值——这是 JS 做不到的。

---

### 知识点 1：if——条件不加括号

```go
age := 20
if age >= 18 {           // 注意：不加括号！
    fmt.Println("成年")
} else if age >= 13 {
    fmt.Println("青少年")
} else {
    fmt.Println("儿童")
}
```

两个规则：
1. **条件不加括号**：`if age >= 18`，不是 `if (age >= 18)`
2. **花括号必须有**：不能省略，且左花括号必须在同一行

还有一个 JS 没有的特性——`if` 可以带初始化语句：

```go
if age := getAge(); age >= 18 {   // 先初始化 age，再判断
    fmt.Println("成年")
}
// age 在这里已经超出作用域，不能用了
```

---

### 知识点 2：for——唯一的循环关键字

Go **只有 `for`，没有 `while`**。但 `for` 有三种用法，覆盖所有循环场景。

```go
// 用法1：经典 for（类似 JS 的 for）
for i := 0; i < 5; i++ {
    fmt.Print(i, " ")   // 输出: 0 1 2 3 4
}

// 用法2：当 while 用（省略初始化和递增）
n := 5
for n > 0 {
    fmt.Print(n, " ")   // 输出: 5 4 3 2 1
    n--
}

// 用法3：for range 遍历（类似 JS 的 for...of）
fruits := []string{"apple", "banana", "cherry"}
for index, value := range fruits {
    fmt.Printf("%d: %s\n", index, value)
}
```

**前端类比**：Go 的 `for i := 0; i < n; i++` = JS 的 `for(let i=0; i<n; i++)`；`for range` = JS 的 `for...of` 或 `forEach`。

---

### 知识点 3：switch——默认不穿透

```go
day := "Mon"
switch day {
case "Sat", "Sun":           // 多值匹配
    fmt.Println("周末")
default:
    fmt.Println("工作日")   // 输出: 工作日
}
```

**关键差异**：Go 的 switch **默认不穿透**（不用写 break，匹配后自动停止）。这和 JS 相反——JS 的 switch 不写 break 会继续往下执行。

```go
// Go：不用写 break，自动停
switch x {
case 1:
    fmt.Println("一")   // 执行完就停，不会穿透到 case 2
case 2:
    fmt.Println("二")
}

// 想穿透才要显式写 fallthrough
switch x {
case 1:
    fallthrough         // 强制穿透到下一个
case 2:
    fmt.Println("一或二")
}
```

---

### 知识点 4：函数定义

```go
// 基本函数——参数和返回值都要标类型
func add(a int, b int) int {
    return a + b
}

// 相同类型参数可简写
func multiply(a, b int) int {
    return a * b
}

result := add(3, 4)   // 7
```

**前端类比**：`func add(a int, b int) int` 类似 TS 的 `function add(a: int, b: int): int`，只是类型位置和返回值写法不同。

---

### 知识点 5：多返回值（Go 特色）

Go 函数能返回多个值——这是 JS 做不到的（JS 只能返回数组/对象再解构）。最常见用途：返回结果 + 错误。

```go
// 返回两个值
func divmod(a, b int) (int, int) {
    return a / b, a % b
}

q, r := divmod(17, 5)
fmt.Println(q, r)   // 输出: 3 2

// 经典用法：返回值 + error
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, fmt.Errorf("除零错误")
    }
    return a / b, nil   // nil 表示无错误
}

result, err := divide(10, 3)
if err != nil {
    fmt.Println("错误:", err)
} else {
    fmt.Printf("%.2f\n", result)   // 输出: 3.33
}
```

**前端类比**：JS 要返回多个值得用数组 `[a, b]` 或对象 `{result, err}`，调用方解构。Go 直接 `return a, b`，调用方 `a, b := fn()`，更原生。错误处理也是这个模式——每个可能出错的函数返回 `(result, error)`，调用方必须检查。

---

### 知识点 6：defer——延迟执行

`defer` 让函数在**当前函数返回时**才执行，常用于资源清理（关文件、解锁）。

```go
func readFile() {
    f, _ := os.Open("data.txt")
    defer f.Close()        // 函数返回时自动关闭，不会忘
    // ... 读文件操作
}
```

**前端类比**：类似 `try...finally` 里的 finally，但写法更简洁——紧跟在打开资源后面写 defer，不用放到最后。多个 defer 按 LIFO 顺序执行（后写的先执行）。

---

### 小结

| 知识点 | 要点 |
|---|---|
| if | 不加括号，条件必须 bool，可带初始化 |
| for | 唯一循环关键字，三种用法 |
| switch | 默认不穿透（和 JS 相反） |
| 函数 | 参数返回值标类型 |
| 多返回值 | Go 特色，常用 (result, error) |
| defer | 延迟到函数返回时执行，资源清理 |

**练习**：写一个函数 `minMax(nums []int) (int, int)`，返回切片的最小值和最大值（多返回值）。

---

## 第 3 课 · 切片 slice

> 切片是 Go 最常用的数据结构，对标 JS 的 Array。但有个 JS 没有的概念：容量 cap。

---

### 知识点 1：切片是什么？

切片是**可变长度的序列**，底层是对数组的引用。你可以理解为"比 JS 数组多了个容量属性"。

```go
// 最简单的创建方式
nums := []int{10, 20, 30}
fmt.Println(nums)   // 输出: [10 20 30]
```

注意 `[]int` 前面的 `[]` 表示切片，和数组 `[3]int` 不同（数组长度固定）。

**前端类比**：切片 ≈ JS 的 Array，用法几乎一样。但你不需要关心底层，99% 情况用切片不用数组。

---

### 知识点 2：创建切片的几种方式

```go
// 方式1：字面量
a := []int{1, 2, 3}

// 方式2：make（指定长度）
b := make([]int, 3)       // 长度3，值都是0
fmt.Println(b)            // 输出: [0 0 0]

// 方式3：make（指定长度和容量）
c := make([]int, 3, 5)    // 长度3，容量5
```

---

### 知识点 3：索引和切片操作

```go
nums := []int{10, 20, 30, 40, 50}

// 索引访问
fmt.Println(nums[0])          // 10（第一个）
fmt.Println(nums[len(nums)-1]) // 50（最后一个）

// 切片操作 [start:end]，end 不包含
fmt.Println(nums[1:4])        // [20 30 40]
fmt.Println(nums[:2])         // [10 20]（省略 start）
fmt.Println(nums[3:])         // [40 50]（省略 end）
```

**前端类比**：`nums[1:4]` = JS 的 `nums.slice(1, 4)`，但 Go 的语法更简洁，直接写在索引里。

---

### 知识点 4：append 追加

```go
nums := []int{1, 2, 3}
nums = append(nums, 4)        // 追加一个
nums = append(nums, 5, 6)     // 追加多个
fmt.Println(nums)             // [1 2 3 4 5 6]
```

注意：`append` 返回新切片，必须用 `nums = append(...)` 接住。不像 JS 的 `arr.push()` 直接改原数组。

**前端类比**：`append(nums, x)` = `arr.push(x)`，但 Go 要重新赋值 `nums = append(...)`，因为容量不够时会分配新底层数组。

---

### 知识点 5：len 和 cap 的区别

这是 JS 数组没有的概念，但理解了就不难。

- `len`：当前有多少个元素（长度）
- `cap`：底层数组能容纳多少元素（容量）

```go
s := make([]int, 3, 5)
fmt.Println(len(s), cap(s))   // 输出: 3 5

s = append(s, 1, 2)           // 还在 cap 内
fmt.Println(len(s), cap(s))   // 输出: 5 5

s = append(s, 3)              // 超出 cap，触发扩容（cap 翻倍）
fmt.Println(len(s), cap(s))   // 输出: 6 12
```

**理解要点**：cap 是"预留空间"。append 时如果 len < cap，直接用预留空间；如果 len >= cap，分配新数组（容量翻倍），把旧数据复制过去。这是为了减少频繁分配内存的开销。日常编码你大多时候不用关心 cap，知道有这回事就行。

---

### 知识点 6：遍历

```go
fruits := []string{"apple", "banana", "cherry"}

// for range 遍历
for index, value := range fruits {
    fmt.Printf("%d: %s\n", index, value)
}

// 只要值，不要索引——用 _ 忽略
for _, value := range fruits {
    fmt.Println(value)
}
```

**前端类比**：`for index, value := range` = JS 的 `arr.forEach((value, index) => {})`，只是参数顺序反了（Go 是 index 在前）。

---

### 小结

| 知识点 | 要点 |
|---|---|
| 切片是什么 | 可变长度序列，对标 JS Array |
| 创建 | 字面量 / make |
| 切片操作 | s[start:end]，end 不包含 |
| append | 追加元素，返回新切片 |
| len / cap | 长度 / 容量，cap 是预留空间 |
| range 遍历 | index, value := range |

**练习**：写一个函数，接收整数切片，返回所有偶数组成的新切片。

---

## 第 4 课 · 映射 map

> map 是键值对集合，对标 JS 的 Object / Map。有个坑必须知道：必须用 make 初始化。

---

### 知识点 1：map 是什么？

map 是**键值对的集合**，类似 JS 的 Object。但 Go 的 map 类型要声明键和值的类型。

```go
// 声明 map 类型：map[键类型]值类型
var scores map[string]int   // 键是 string，值是 int
```

---

### 知识点 2：创建 map（必须 make！）

```go
// 方式1：make 创建（最常用）
scores := make(map[string]int)
scores["张三"] = 90
scores["李四"] = 85

// 方式2：字面量初始化
user := map[string]string{
    "name":  "Go",
    "email": "go@dev.com",
}
```

**最大的坑**：`var m map[string]int` 声明后是 nil map，**直接写入会 panic**！必须用 make 初始化：

```go
var bad map[string]int
// bad["x"] = 1   // panic！nil map 不能写

good := make(map[string]int)
good["x"] = 1      // 正常
```

**前端类比**：JS 的 `let obj = {}` 直接能用。Go 的 `var m map[string]int` 是 nil，必须 `make` 后才能写。这是类型安全的代价。

---

### 知识点 3：增删改查

```go
scores := make(map[string]int)

// 增/改
scores["张三"] = 90      // 新增
scores["张三"] = 95      // 修改（键存在就是改）

// 查
fmt.Println(scores["张三"])   // 95

// 删
delete(scores, "李四")       // delete 函数
```

---

### 知识点 4：读取返回"是否存在"

这是和 JS 不同的地方——Go 的 map 读取能告诉你"这个键存不存在"。

```go
scores := map[string]int{"张三": 90}

// 读取返回两个值：值 + 是否存在
score, exists := scores["赵六"]
if exists {
    fmt.Println("赵六:", score)
} else {
    fmt.Println("赵六不存在")   // 输出这个
}

// 不关心是否存在，直接读
fmt.Println(scores["不存在"])   // 输出: 0（零值，不报错）
```

**前端类比**：JS 里 `obj["key"]` 不存在返回 `undefined`。Go 返回零值（int 是 0，string 是 ""），但你可以用第二个返回值判断是否真的存在——因为 0 可能是真实值也可能是"不存在"。

---

### 知识点 5：遍历

```go
scores := map[string]int{"张三": 90, "李四": 85, "王五": 95}

for name, score := range scores {
    fmt.Printf("%s: %d\n", name, score)
}
```

注意：map 遍历的**顺序是随机的**（Go 故意打乱，防止依赖顺序）。如果要排序，先取 keys 排序再遍历。

---

### 小结

| 知识点 | 要点 |
|---|---|
| map 是什么 | 键值对集合，对标 Object |
| 创建 | 必须 make，nil map 写入会 panic |
| 增删改查 | m[k]=v / delete(m,k) |
| 读取返回 | 值 + 是否存在（ok 模式） |
| 遍历 | range，顺序随机 |

**练习**：创建 map 存储商品名和价格，计算所有商品的平均价格。

---

## 第 5 课 · 结构体 struct

> Go **没有 class 关键字**，用 struct 定义自定义类型。配合方法（下几课学）实现面向对象。

---

### 知识点 1：struct 是什么？

struct 是**字段的集合**，类似 JS 的对象。但 Go 的 struct 要先定义类型，再创建实例。

```go
// 定义结构体类型
type User struct {
    Name  string
    Age   int
    Email string
}
```

**前端类比**：类似 TS 的 `interface User { Name: string; Age: number }`，但 Go 的 struct 是实际的数据结构，不只是类型约束。

---

### 知识点 2：创建实例

```go
// 按字段名初始化（推荐，清晰）
u1 := User{
    Name:  "张三",
    Age:   25,
    Email: "zhang@x.com",
}
fmt.Println(u1)   // 输出: {张三 25 zhang@x.com}

// 按顺序初始化（不推荐，字段多了易错）
u2 := User{"李四", 30, "li@x.com"}
```

---

### 知识点 3：字段访问和修改

```go
u := User{Name: "张三", Age: 25}

// 访问
fmt.Println(u.Name)   // 张三

// 修改（实例必须是 mut... 不对，Go 没有 mut，变量本身决定可变性）
u.Age = 26            // 直接改
fmt.Println(u.Age)    // 26
```

Go 的可变性和 Rust 不同——Go 里 `var u` 就可变，`const u` 或函数参数（值传递）就不可变。没有 `mut` 关键字。

---

### 知识点 4：匿名嵌套（组合替代继承）

Go 没有继承，用**匿名嵌套**实现组合——把一个 struct 嵌到另一个里，字段会被"提升"。

```go
type Address struct {
    City string
}

type Employee struct {
    User       // 匿名嵌套 User
    Address    // 匿名嵌套 Address
    Salary float64
}

emp := Employee{
    User:    User{Name: "赵六", Age: 35, Email: "zhao@x.com"},
    Address: Address{City: "北京"},
    Salary:  20000,
}

// 直接访问嵌套字段（提升）
fmt.Println(emp.Name)    // 赵六（不用写 emp.User.Name）
fmt.Println(emp.City)    // 北京
```

**前端类比**：类似 JS 的 `Object.assign` 或展开运算符 `{...user, ...address, salary}`，把字段合并。但 Go 是结构化的嵌套，不是运行时合并。

---

### 知识点 5：结构体指针

创建结构体时常用 `&` 取指针，这在方法（第 7 课）里很重要。

```go
u := &User{Name: "Tom", Age: 20}   // & 返回指针
u.Age = 21                          // Go 自动解引用，不用写 (*u).Age
fmt.Println(u.Name, u.Age)          // Tom 21
```

**理解要点**：`&User{...}` 返回指向结构体的指针。Go 会自动解引用，所以 `u.Age` 和 `(*u).Age` 等效。这在第 6 课（指针）会详细讲。

---

### 小结

| 知识点 | 要点 |
|---|---|
| struct 是什么 | 字段集合，Go 没有 class |
| 创建 | 按字段名初始化 |
| 字段访问 | u.Name，直接点 |
| 匿名嵌套 | 组合替代继承，字段提升 |
| 结构体指针 | &User{} 常用，自动解引用 |

**练习**：定义 `Rectangle` struct（Width, Height 字段），创建实例并打印信息。

---

## 第 6 课 · 指针

> 这是前端完全没有的概念，也是 Go 学习的第一个门槛。别急，一个点一个点掰开讲。

---

### 知识点 1：什么是指针？

先记住一句话：**指针就是变量的内存地址。**

打个比方。变量像一个信箱，里面装着数据。信箱有个门牌号（地址）。指针就是那个门牌号——它不存数据本身，但通过门牌号能找到数据。

```
变量 x = 42
门牌号: 0xc0000b2000
指针 p 存的就是这个门牌号
```

为什么要搞这么复杂？因为有时候你想"告诉别人数据在哪"，而不是"把数据复制一份给别人"。就像你给朋友发定位，而不是把整栋房子搬过去。

**前端类比**：JS 里 `let x = 42`，x 直接就是 42，你没法拿到 x 的"地址"。Go 多了一种能力：除了值，还能拿到值的地址。

---

### 知识点 2：两个符号 & 和 *

就两个符号，记住就够：

- `&变量` → 拿到这个变量的地址（取地址）
- `*指针` → 拿到这个地址里的值（取值）

```go
x := 42
p := &x           // p 存的是 x 的地址
fmt.Println(p)    // 0xc0000b2000（地址，每次运行不同）
fmt.Println(*p)   // 42（通过地址把值取出来）
```

`&` 和 `*` 是一对反向操作：`&` 从值拿地址，`*` 从地址拿值。就像门牌号——`&` 是"查你家的门牌号"，`*` 是"按门牌号找到你家"。

---

### 知识点 3：为什么需要指针？（核心）

这是指针最重要的用途。看一个对比，你就懂了。

**不用指针——改不了原变量：**

```go
func increment(n int) {
    n++  // 改的是复制品，不是原件
}

x := 10
increment(x)
fmt.Println(x)   // 还是 10！没变
```

为什么没变？因为 Go 默认是**值传递**——函数收到的是 x 的复制品，改复制品不影响原件。就像你把文件复印一份给同事，同事在复印件上改字，你的原件不变。

**用指针——能改原变量：**

```go
func incrementPtr(n *int) {   // 参数是指针（地址）
    *n++   // 通过地址改原件
}

x := 10
incrementPtr(&x)   // 传 x 的地址
fmt.Println(x)     // 11！变了
```

传指针就是传地址，函数通过地址直接改原件。就像你把家里钥匙给同事，同事能直接进你家改东西。

**前端类比**：JS 里对象是引用传递（改对象属性会影响原对象），但基本类型是值传递。Go 里**所有类型默认值传递**，要改原变量必须显式传指针。这是前端转 Go 最需要适应的点——JS 自动帮你"传引用"，Go 要你手动写 `&`。

---

### 知识点 4：指针和结构体（最常用）

指针用得最多的场景是结构体。好消息：Go 会自动帮你解引用，不用写 `(*p).field`，直接 `p.field` 就行。

```go
type User struct {
    Name string
    Age  int
}

u := &User{Name: "Tom", Age: 20}   // & 直接返回指针
u.Age = 21     // 自动解引用，不用写 (*u).Age
fmt.Println(u.Name, u.Age)   // Tom 21
```

`&User{...}` 是创建结构体指针的最常见写法，你会在 Go 代码里到处看到它。

---

### 知识点 5：nil 指针（坑）

指针可以不指向任何东西，这时它是 `nil`（空指针）。用之前必须检查，否则程序崩溃（panic）。

```go
var p *int      // 声明了但没赋值，p 是 nil
// *p = 10      // panic！空指针没有指向任何地址

if p == nil {
    p = new(int)   // new 分配内存，返回指向零值的指针
}
*p = 10
fmt.Println(*p)    // 10
```

**前端类比**：JS 里 `null` 访问属性会报 `Cannot read property of null`。Go 的 nil 指针解引用会 panic，道理一样。

---

### 小结

| 知识点 | 要点 |
|---|---|
| 什么是指针 | 变量的内存地址（门牌号） |
| & 和 * | & 取地址，* 取值，互为反向 |
| 传值 vs 传指针 | 传值改不了原件，传指针能改 |
| 结构体指针 | 自动解引用，u.field 直接用 |
| nil 指针 | 用前检查，否则 panic |

**核心心法**：Go 所有类型默认值传递。要改原变量，加 `&` 传地址。

**练习**：写一个 `swap(a, b *int)` 函数，通过指针交换两个变量的值。

---

## 第 7 课 · 方法

> 方法是绑定到 struct 的函数。Go 没有 class，但 struct + 方法能达到 class 的效果。

---

### 知识点 1：方法是什么？

方法是"属于某个类型的函数"。写法和普通函数几乎一样，只是多了一个**接收者（receiver）**参数。

```go
type Rectangle struct {
    Width, Height float64
}

// (r Rectangle) 是接收者，表示这个方法属于 Rectangle
func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

// 调用
rect := Rectangle{Width: 4, Height: 5}
fmt.Println(rect.Area())   // 输出: 20
```

**前端类比**：`func (r Rectangle) Area()` 类似 JS 的 `class Rectangle { area() { return this.width * this.height } }`。Go 用接收者代替 this，且接收者类型明确写出。

---

### 知识点 2：值接收者

接收者有两种。先看**值接收者**——复制一份 struct，不改原件。

```go
func (r Rectangle) Perimeter() float64 {
    return 2 * (r.Width + r.Height)
}

rect := Rectangle{Width: 4, Height: 5}
fmt.Println(rect.Perimeter())   // 18
```

值接收者像 JS 的纯函数——不改原对象，只读取计算。

---

### 知识点 3：指针接收者

**指针接收者**能修改原 struct。用 `*Rectangle` 而不是 `Rectangle`。

```go
func (r *Rectangle) Scale(factor float64) {
    r.Width *= factor    // 能改原对象
    r.Height *= factor
}

rect := Rectangle{Width: 4, Height: 5}
rect.Scale(2)    // 指针接收者，改原件
fmt.Println(rect.Width, rect.Height)   // 8 10
```

注意：调用时 `rect.Scale(2)` 不用写 `(&rect).Scale(2)`，Go 自动取地址。

---

### 知识点 4：什么时候用指针接收者？

规则很简单：
- **要修改原对象** → 用指针接收者 `*T`
- **只读不改** → 用值接收者 `T`
- **struct 较大** → 用指针接收者（避免复制开销）

**最佳实践**：一个类型的方法**最好统一用一种**（通常统一用指针接收者），避免混用混乱。

---

### 知识点 5：关联函数（类似静态方法）

不带接收者的函数叫**关联函数**，类似 JS 的静态方法。最常见用途：构造函数。

```go
type Rectangle struct {
    Width, Height float64
}

// 关联函数——没有接收者，用 类型名.函数名 调用
func NewSquare(size float64) *Rectangle {
    return &Rectangle{Width: size, Height: size}
}

// 调用
sq := NewSquare(10)   // Rectangle.NewSquare() 不对，直接 NewSquare()
fmt.Println(sq.Area())
```

**前端类比**：`NewSquare()` 类似 JS 的 `static` 方法或工厂函数。Go 没有构造函数关键字，约定用 `NewXxx` 命名。

---

### 小结

| 知识点 | 要点 |
|---|---|
| 方法 | 绑定到 struct 的函数，有接收者 |
| 值接收者 `(r T)` | 复制一份，不改原件 |
| 指针接收者 `(r *T)` | 能改原件，大 struct 省复制 |
| 选择规则 | 要改/大对象用指针，只读用值 |
| 关联函数 | 无接收者，类似静态方法 |

**练习**：给 `Rectangle` 添加 `IsSquare() bool` 方法（值接收者），判断是否正方形。

---

## 第 8 课 · 接口 interface

> 接口是 Go 实现多态的方式。和 TS/Java 最大区别：**隐式实现**——不用声明 implements。

---

### 知识点 1：接口是什么？

接口是**一组方法签名的集合**。定义"能做什么"，不关心"是谁做的"。

```go
type Shape interface {
    Area() float64
    Perimeter() float64
}
```

这表示：任何有 `Area()` 和 `Perimeter()` 方法的类型，都算 Shape。

---

### 知识点 2：隐式实现（鸭子类型）

Go 的接口是**隐式实现**——只要类型有了接口要求的所有方法，就自动满足接口，**不用写 implements**。

```go
type Rectangle struct {
    Width, Height float64
}
func (r Rectangle) Area() float64      { return r.Width * r.Height }
func (r Rectangle) Perimeter() float64 { return 2 * (r.Width + r.Height) }
// Rectangle 自动满足 Shape 接口！不用声明

type Circle struct {
    Radius float64
}
func (c Circle) Area() float64      { return 3.14159 * c.Radius * c.Radius }
func (c Circle) Perimeter() float64 { return 2 * 3.14159 * c.Radius }
// Circle 也自动满足 Shape
```

**前端类比**：TS 的 interface 要 `class Foo implements Bar` 显式声明。Go 不用——只要方法签名匹配就自动满足。这叫"鸭子类型"：走起来像鸭子、叫起来像鸭子，那它就是鸭子。

---

### 知识点 3：接口作参数（多态）

接口最大的用途：函数参数用接口类型，就能接收任何满足接口的类型。

```go
// 参数是 Shape 接口——Rectangle 和 Circle 都能传
func printInfo(s Shape) {
    fmt.Printf("面积: %.2f, 周长: %.2f\n", s.Area(), s.Perimeter())
}

r := Rectangle{Width: 4, Height: 5}
c := Circle{Radius: 3}
printInfo(r)   // 都能传
printInfo(c)
```

还能用接口切片存不同类型：

```go
shapes := []Shape{r, c}   // Rectangle 和 Circle 都能放
for _, s := range shapes {
    fmt.Println(s.Area())
}
```

---

### 知识点 4：空接口 interface{}

空接口 `interface{}` 没有任何方法，所以**所有类型都满足**——类似 JS 的 `any`。

```go
func describe(v interface{}) {
    fmt.Printf("类型: %T, 值: %v\n", v, v)
}
describe(42)        // int
describe("hello")   // string
describe([]int{1,2}) // []int
```

Go 1.18+ 可以用 `any` 代替 `interface{}`，更简洁。

---

### 知识点 5：类型断言

从接口取出具体类型，用类型断言。

```go
var i interface{} = "Go"

// 方式1：直接断言（失败会 panic）
s := i.(string)
fmt.Println(s)   // Go

// 方式2：安全断言（返回是否成功）
s, ok := i.(string)
if ok {
    fmt.Println("是字符串:", s)
}

n, ok := i.(int)
if !ok {
    fmt.Println("不是 int")   // 输出这个
}
```

**前端类比**：`i.(string)` 类似 TS 的 `i as string`。Go 多了安全版本 `s, ok := i.(string)`，不会 panic。

---

### 小结

| 知识点 | 要点 |
|---|---|
| 接口是什么 | 一组方法签名，定义"能做什么" |
| 隐式实现 | 不用 implements，方法匹配就满足 |
| 接口作参数 | 多态，接收任何满足接口的类型 |
| 空接口 | interface{} / any，所有类型满足 |
| 类型断言 | i.(T)，安全版返回 ok |

**练习**：定义 `Speaker` 接口（有 `Speak() string` 方法），让 `Dog` 和 `Cat` struct 实现它。

---

## 第 9 课 · 错误处理

> Go **没有 try/catch**。错误是普通返回值，必须显式检查。看起来啰嗦，但强制你处理每个错误。

---

### 知识点 1：Go 没有 try/catch

JS 里你习惯这样：
```js
try {
    doSomething()
} catch (e) {
    console.log(e)
}
```

Go 里没有这个。错误是函数的**返回值**，你必须检查。这是 Go 最"啰嗦"但也最安全的设计。

---

### 知识点 2：error 类型和 nil

Go 的错误就是一个 `error` 类型的值。`nil` 表示无错误，非 `nil` 表示有错误。

```go
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("除零错误")   // 创建错误
    }
    return a / b, nil   // nil = 无错误
}
```

**前端类比**：`error` 类似 JS 的 `Error` 对象。`errors.New("msg")` = `new Error("msg")`。`nil` = `null`。

---

### 知识点 3：if err != nil 模式

这是 Go 代码里出现最多的模式——每个可能出错的调用都要检查。

```go
result, err := divide(10, 3)
if err != nil {
    fmt.Println("错误:", err)
    return   // 出错就返回
}
fmt.Println("结果:", result)   // 没错才继续
```

你会写无数次 `if err != nil`。觉得烦是正常的，但这正是 Go 的安全来源——错误不会被意外吞掉（JS 的 try/catch 容易漏 catch）。

---

### 知识点 4：fmt.Errorf 包装错误

错误往上传递时，用 `fmt.Errorf` 加上下文，方便排查。

```go
func processConfig() error {
    _, err := os.ReadFile("config.txt")
    if err != nil {
        return fmt.Errorf("读取配置失败: %w", err)   // %w 包装原错误
    }
    return nil
}

// 调用方
err := processConfig()
if err != nil {
    fmt.Println(err)   // 读取配置失败: open config.txt: no such file
}
```

`%w` 包装原错误，保留错误链。`%v` 只是把错误转成字符串（丢失链）。

---

### 知识点 5：panic（少用）

`panic` 类似 JS 的 `throw`，会中断程序。但 Go 里**普通错误不用 panic**——用 error 返回值。panic 只用于严重错误（不该发生的情况）。

```go
// 不要这样写（普通错误）
func bad() {
    panic("文件不存在")   // 程序崩溃
}

// 应该这样（返回 error）
func good() error {
    return errors.New("文件不存在")
}
```

---

### 小结

| 知识点 | 要点 |
|---|---|
| 没有 try/catch | 错误是返回值 |
| error + nil | nil=无错，非 nil=有错 |
| if err != nil | 最常用模式，必须检查 |
| fmt.Errorf + %w | 包装错误加上下文 |
| panic | 严重错误才用，普通错误用 error |

**练习**：写一个 `parseAge(s string) (int, error)`，空字符串返回 error，正常返回数字。提示：用 `strconv.Atoi`。

---

## 第 10 课 · 包与模块

> Go 用包组织代码，用模块管理依赖。最反直觉的约定：**首字母大小写控制可见性**。

---

### 知识点 1：package 和 import

每个 Go 文件开头声明 `package`。导入用 `import`。

```go
package main

import (
    "fmt"                    // 标准库
    "strings"                // 标准库
    "myproject/mathutil"     // 自定义包
)
```

**前端类比**：`package` 类似 JS 模块的归属，`import` 和 JS 的 import 一样。

---

### 知识点 2：可见性——大小写（最反直觉的约定）

Go 用**首字母大小写**控制可见性：
- **大写开头** = 公开（其他包能访问），类似 `export`
- **小写开头** = 私有（只有本包能访问），类似不 export

```go
package mathutil

func Add(a, b int) int {   // 大写 = 公开
    return a + b
}

func helper() {             // 小写 = 私有
    // 外部包不能调用
}
```

**前端类比**：JS 用 `export` 关键字导出。Go 没有 export——大写就是公开，小写就是私有。这最反直觉，但写习惯了反而简洁。struct 的字段也一样：`Name` 公开，`name` 私有。

---

### 知识点 3：go mod 管理依赖

```bash
go mod init myproject          # 初始化，生成 go.mod
go get github.com/gin-gonic/gin   # 安装依赖
go mod tidy                    # 清理依赖
```

`go.mod` 文件内容：
```
module myproject
go 1.21
require github.com/gin-gonic/gin v1.9.1
```

**前端类比**：`go.mod` = `package.json`，`require` 段 = `dependencies`，`go get` = `npm install`。

---

### 知识点 4：自定义包

把代码组织到不同目录，每个目录是一个包。

```
myproject/
├── go.mod
├── main.go         (package main)
└── mathutil/
    └── mathutil.go (package mathutil)
```

```go
// mathutil/mathutil.go
package mathutil

func Add(a, b int) int { return a + b }   // 大写公开

// main.go
package main
import "myproject/mathutil"

func main() {
    fmt.Println(mathutil.Add(2, 3))   // 5
}
```

---

### 小结

| 知识点 | 要点 |
|---|---|
| package | 代码归属，每个文件声明 |
| import | 导入包 |
| 大写 = 公开 | 类似 export |
| 小写 = 私有 | 默认私有 |
| go mod | 依赖管理，对标 npm |

**练习**：创建 `geometry` 包，导出 `RectangleArea(w, h float64) float64`，在 main 包调用。

---

# 阶段 2 · 并发与标准库

## 第 11 课 · goroutine

> Go 最大的特色。前端是单线程事件循环，goroutine 是**真并行**——两个函数同时在跑。

---

### 知识点 1：goroutine 是什么？

goroutine 是 Go 的**轻量级线程**。一个 goroutine 只占约 2KB 内存，你可以开几十万个。而操作系统的线程通常占几 MB。

**前端类比**：JS 的 async/Promise 是"单线程并发"——一个时刻只有一个任务在跑，只是快速切换。goroutine 是"真并行"——多核 CPU 上，两个 goroutine 真的同时在不同核上执行。这是本质区别。

---

### 知识点 2：go 关键字启动

在函数调用前加 `go` 关键字，就启动了一个 goroutine。

```go
func sayHello(name string) {
    for i := 0; i < 3; i++ {
        fmt.Printf("%s: %d\n", name, i)
        time.Sleep(100 * time.Millisecond)
    }
}

func main() {
    go sayHello("协程A")    // 启动 goroutine，不阻塞
    go sayHello("协程B")    // 又一个
    sayHello("主函数")      // 普通调用，阻塞
}
```

`go sayHello("协程A")` 立即返回，函数在后台跑。主函数继续往下执行。

---

### 知识点 3：主函数不等子 goroutine

这是新手最常踩的坑——main 函数结束，所有 goroutine 被杀死，不管有没有跑完。

```go
func main() {
    go func() {
        time.Sleep(100 * time.Millisecond)
        fmt.Println("子协程完成")   // 可能不会输出！
    }()
    fmt.Println("主函数结束")       // main 结束，子协程被杀
}
```

**解决方法**：用 `time.Sleep` 等待（简陋），或用 `sync.WaitGroup`（正式），或用 channel（下课学）。

---

### 知识点 4：闭包捕获陷阱

启动 goroutine 时如果用到循环变量，要小心闭包捕获。

```go
// 错误写法——所有 goroutine 打印 5
for i := 0; i < 5; i++ {
    go func() {
        fmt.Println(i)   // 捕获的是 i 的引用，循环结束时都是 5
    }()
}

// 正确写法——把 i 作为参数传入
for i := 0; i < 5; i++ {
    go func(n int) {
        fmt.Println(n)   // 每次传入当时的 i 值
    }(i)
}
```

**前端类比**：JS 的 `var` 有同样问题（闭包捕获引用），`let` 解决了。Go 没有这个语法糖，必须手动传参。

---

### 知识点 5：WaitGroup 等待

正式的等待方式用 `sync.WaitGroup`。

```go
var wg sync.WaitGroup

for i := 0; i < 3; i++ {
    wg.Add(1)    // 计数器+1
    go func(n int) {
        defer wg.Done()   // 完成后计数器-1
        fmt.Println("任务", n)
    }(i)
}
wg.Wait()   // 阻塞直到计数器归零
fmt.Println("全部完成")
```

---

### 小结

| 知识点 | 要点 |
|---|---|
| goroutine | 轻量级线程，约 2KB |
| go 关键字 | 启动 goroutine |
| 主函数不等 | main 结束就全杀 |
| 闭包陷阱 | 循环变量要传参 |
| WaitGroup | 正式等待方式 |

**练习**：启动 3 个 goroutine 分别打印 "A"、"B"、"C" 各 5 次，用 WaitGroup 等待完成。

---

## 第 12 课 · channel

> goroutine 之间怎么通信？Go 的哲学："别用共享内存通信，用通信共享内存。"channel 就是通信管道。

---

### 知识点 1：channel 是什么？

channel 是 goroutine 之间传递数据的**管道**。发送 `ch <- v`，接收 `v := <-ch`。

**前端类比**：JS 没有直接对应物。最接近的是事件循环 + 消息队列，但 channel 是显式的、类型安全的。

---

### 知识点 2：创建和收发

```go
// 创建无缓冲 channel
ch := make(chan string)

// goroutine 发送
go func() {
    ch <- "hello"   // 发送（没人接收会阻塞）
}()

// 主函数接收
msg := <-ch         // 接收（没数据会阻塞）
fmt.Println(msg)    // hello
```

无缓冲 channel 是**同步的**——发送方必须等接收方就绪，否则阻塞。就像面对面交接，必须两人都在。

---

### 知识点 3：缓冲 channel

带缓冲的 channel 发送时只要缓冲区没满就不阻塞。

```go
ch := make(chan int, 3)   // 缓冲区大小 3

ch <- 1    // 不阻塞
ch <- 2    // 不阻塞
ch <- 3    // 不阻塞
// ch <- 4  // 阻塞！缓冲区满了

fmt.Println(<-ch)   // 1
fmt.Println(<-ch)   // 2
```

**理解要点**：无缓冲 = 同步（面对面交接），有缓冲 = 异步（放快递柜，满了才等）。

---

### 知识点 4：关闭 channel

发送方用完后关闭 channel，接收方能知道"没有更多数据了"。

```go
jobs := make(chan int, 5)

go func() {
    for i := 1; i <= 5; i++ {
        jobs <- i
    }
    close(jobs)   // 关闭，表示发完了
}()

// 遍历直到关闭
for job := range jobs {
    fmt.Println("处理:", job)
}
```

---

### 知识点 5：检测是否关闭

接收时可以用第二个返回值判断 channel 是否已关闭。

```go
ch := make(chan int, 1)
ch <- 42
close(ch)

v, ok := <-ch
fmt.Println(v, ok)   // 42 true

v, ok = <-ch
fmt.Println(v, ok)   // 0 false（已关闭且无数据）
```

---

### 小结

| 知识点 | 要点 |
|---|---|
| channel | goroutine 间的通信管道 |
| 无缓冲 | 同步，发送等接收 |
| 有缓冲 | 异步，缓冲满才阻塞 |
| close | 关闭表示发完 |
| v, ok | 检测是否关闭 |

**练习**：启动一个 goroutine 计算 1 到 100 的和，通过 channel 把结果传回主函数打印。

---

## 第 13 课 · select

> select 让 goroutine 同时等多个 channel，哪个先就绪处理哪个。类似 `Promise.race`。

---

### 知识点 1：select 是什么？

当有多个 channel 要同时监听时，用 `select`。它就像一个多路开关——哪个 channel 先有数据，就走哪个分支。

```go
select {
case msg := <-ch1:
    fmt.Println("ch1:", msg)
case msg := <-ch2:
    fmt.Println("ch2:", msg)
}
```

**前端类比**：`Promise.race([p1, p2])`——哪个先完成处理哪个。但 select 是阻塞的，会等到有一个就绪。

---

### 知识点 2：超时控制

select 最常见的用途——防止永远阻塞。用 `time.After` 设超时。

```go
slowCh := make(chan string)
go func() {
    time.Sleep(2 * time.Second)
    slowCh <- "太慢了"
}()

select {
case msg := <-slowCh:
    fmt.Println(msg)
case <-time.After(200 * time.Millisecond):
    fmt.Println("超时了")   // 200ms 超时，输出这个
}
```

**前端类比**：类似 `Promise.race([fetch(), timeoutPromise])`，防止请求卡死。

---

### 知识点 3：非阻塞接收（default）

加 `default` 分支，没有数据时不阻塞，直接走 default。

```go
emptyCh := make(chan int, 1)
select {
case v := <-emptyCh:
    fmt.Println("收到:", v)
default:
    fmt.Println("无数据，不阻塞")   // 输出这个
}
```

---

### 小结

| 知识点 | 要点 |
|---|---|
| select | 多路复用，等第一个就绪 |
| 超时 | time.After 防卡死 |
| default | 非阻塞，无数据走 default |

**练习**：启动两个 goroutine 分别睡 100ms 和 200ms 后发消息，用 select 打印先到的。

---

## 第 14 课 · 标准库

> Go 标准库非常强大，不用装第三方包就能干很多事。对标 Node.js 内置模块。

---

### 知识点 1：strings——字符串操作

```go
import "strings"

s := "Hello, World"
strings.ToUpper(s)            // HELLO, WORLD
strings.Contains(s, "World")  // true
strings.Replace(s, "World", "Go", 1)  // Hello, Go
strings.Split("a,b,c", ",")   // [a b c]
strings.Join([]string{"x","y"}, "-")  // x-y
strings.TrimSpace("  hi  ")   // hi
```

**前端类比**：和 JS 的字符串方法几乎一一对应。`Contains` = `includes`，`Split` = `split`，`Join` = `join`。

---

### 知识点 2：strconv——类型转换

Go 不会自动转换类型（不像 JS 的隐式转换），必须显式用 `strconv`。

```go
import "strconv"

n, _ := strconv.Atoi("42")    // 字符串转整数，返回 (int, error)
fmt.Println(n + 8)            // 50

s := strconv.Itoa(100)        // 整数转字符串
fmt.Println("数字:", s)

f, _ := strconv.ParseFloat("3.14", 64)
fmt.Println(f * 2)            // 6.28
```

**前端类比**：`Atoi` = `parseInt`，`Itoa` = `String()`。但 Go 返回 error，必须处理。

---

### 知识点 3：time——时间处理

```go
import "time"

now := time.Now()
fmt.Println(now.Format("2006-01-02 15:04:05"))   // 2024-08-07 08:00:00

// 时间计算
future := now.Add(24 * time.Hour)    // 加一天
fmt.Println(future.Format("2006-01-02"))

// 计时
start := time.Now()
time.Sleep(50 * time.Millisecond)
fmt.Println(time.Since(start))   // 约 50ms
```

**坑**：Go 的时间格式化用 `"2006-01-02 15:04:05"`（Go 诞生时间），不是 `"YYYY-MM-DD"`。这是 Go 最被吐槽的设计，记住就行。

---

### 知识点 4：fmt 格式化动词

```go
fmt.Printf("整数: %d\n", 42)
fmt.Printf("字符串: %s\n", "hi")
fmt.Printf("浮点: %.2f\n", 3.14159)   // 3.14
fmt.Printf("类型: %T\n", 42)          // int
fmt.Printf("结构体: %+v\n", User{Name:"Tom"})  // {Name:Tom}
```

---

### 小结

| 包 | 用途 | JS 对应 |
|---|---|---|
| strings | 字符串操作 | String 方法 |
| strconv | 类型转换 | parseInt/String |
| time | 时间 | Date |
| fmt | 格式化 | console.log |

**练习**：把字符串 "2024-01-15" 解析成 time.Time，加 30 天，格式化输出。

---

## 第 15 课 · 文件与 os

> 文件操作对标 Node.js 的 fs 模块。Go 用 `defer` 确保资源关闭。

---

### 知识点 1：写文件

```go
f, err := os.Create("test.txt")
if err != nil {
    fmt.Println("创建失败:", err)
    return
}
defer f.Close()              // 函数返回时自动关闭

f.WriteString("第一行\n")
f.WriteString("第二行\n")
```

**前端类比**：`os.Create` = `fs.writeFileSync`（创建并打开）。`defer f.Close()` = `try{...}finally{f.close()}`，但更简洁。

---

### 知识点 2：读文件

```go
// 一次读完（简单）
content, err := os.ReadFile("test.txt")
if err != nil {
    fmt.Println("读取失败:", err)
    return
}
fmt.Println(string(content))

// 逐行读（大文件用）
file, _ := os.Open("test.txt")
defer file.Close()

scanner := bufio.NewScanner(file)
for scanner.Scan() {
    fmt.Println(scanner.Text())   // 每行
}
```

---

### 知识点 3：判断文件是否存在

```go
if _, err := os.Stat("不存在.txt"); os.IsNotExist(err) {
    fmt.Println("文件不存在")
}
```

---

### 知识点 4：环境信息

```go
fmt.Println(os.Getwd())        // 当前目录
fmt.Println(os.Getenv("HOME")) // 环境变量
fmt.Println(os.Args)           // 命令行参数
```

**前端类比**：`os.Getenv` = `process.env`，`os.Args` = `process.argv`。

---

### 小结

| 知识点 | 要点 |
|---|---|
| 写文件 | os.Create + defer Close |
| 读文件 | os.ReadFile（一次）/ bufio.Scanner（逐行） |
| 判断存在 | os.Stat + IsNotExist |
| 环境信息 | Getwd / Getenv / Args |

**练习**：创建 todos.txt 写入 3 条待办，再读取逐行打印。

---

## 第 16 课 · net/http

> Go 标准库自带 HTTP 服务器，不用装框架就能写后端。对标 Node.js 的 http 模块。

---

### 知识点 1：注册路由

```go
http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello, World!")   // w 写响应，r 是请求
})

http.HandleFunc("/api/user", func(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "用户接口")
})

http.ListenAndServe(":8080", nil)   // 启动，阻塞
```

**前端类比**：`HandleFunc(path, fn)` = Express 的 `app.get(path, fn)`。`w` = `res`，`r` = `req`。

---

### 知识点 2：读取查询参数

```go
http.HandleFunc("/api/user", func(w http.ResponseWriter, r *http.Request) {
    name := r.URL.Query().Get("name")   // /api/user?name=Tom
    if name == "" {
        name = "匿名"
    }
    fmt.Fprintf(w, "你好, %s", name)
})
```

**前端类比**：`r.URL.Query().Get("name")` = `req.query.name`。

---

### 知识点 3：返回 JSON

```go
http.HandleFunc("/api/json", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    fmt.Fprintf(w, `{"message": "hello", "code": 200}`)
})
```

---

### 知识点 4：Go HTTP 是多 goroutine 的

每个请求自动开一个 goroutine 处理——天生并发。Node.js 是单线程事件循环，Go 是真并行，高并发场景性能差距大。

---

### 小结

| 知识点 | 要点 |
|---|---|
| 路由 | HandleFunc(path, fn) |
| 响应 | w http.ResponseWriter |
| 请求 | r *http.Request |
| 查询参数 | r.URL.Query().Get() |
| 启动 | ListenAndServe(":8080", nil) |

**练习**：写一个 `/api/time` 接口，返回当前时间 JSON。

---

## 第 17 课 · JSON 处理

> Go 用 encoding/json 处理 JSON。核心是 struct tag——控制 JSON 字段名。

---

### 知识点 1：struct tag

```go
type User struct {
    Name  string `json:"name"`            // JSON 字段名为 name
    Age   int    `json:"age"`
    Email string `json:"email,omitempty"`  // omitempty: 空值不输出
}
```

反引号里的 `json:"name"` 是 struct tag，控制 JSON 序列化时的字段名。`omitempty` 表示空值时省略该字段。

---

### 知识点 2：Marshal（序列化）

结构体转 JSON 字符串。

```go
u := User{Name: "张三", Age: 25, Email: "z@x.com"}
data, _ := json.Marshal(u)
fmt.Println(string(data))
// {"name":"张三","age":25,"email":"z@x.com"}

// 空值省略
u2 := User{Name: "李四", Age: 30}   // Email 为空
data2, _ := json.Marshal(u2)
fmt.Println(string(data2))
// {"name":"李四","age":30}   ← email 省略了
```

**前端类比**：`json.Marshal(u)` = `JSON.stringify(u)`。但 Go 靠 struct tag 控制字段名，JS 靠对象本身的 key。

---

### 知识点 3：Unmarshal（反序列化）

JSON 字符串转结构体。注意传指针。

```go
jsonStr := `{"name":"王五","age":28,"email":"w@x.com"}`
var u User
err := json.Unmarshal([]byte(jsonStr), &u)   // 注意 &u 传指针
if err != nil {
    fmt.Println("解析失败:", err)
}
fmt.Printf("%+v\n", u)   // {Name:王五 Age:28 Email:w@x.com}
```

**前端类比**：`json.Unmarshal(data, &u)` = `JSON.parse(str)`。但 Go 必须有目标类型（struct），JS 返回动态对象。

---

### 知识点 4：格式化输出

```go
pretty, _ := json.MarshalIndent(u, "", "  ")
fmt.Println(string(pretty))
// {
//   "name": "张三",
//   "age": 25,
//   "email": "z@x.com"
// }
```

---

### 小结

| 知识点 | 要点 |
|---|---|
| struct tag | `json:"name"` 控制字段名 |
| Marshal | 结构体 → JSON |
| Unmarshal | JSON → 结构体（传指针） |
| omitempty | 空值省略 |

**练习**：定义 Product struct（Name, Price, InStock），tag 让 JSON 全小写，InStock 为 false 时不输出。

---

# 阶段 3 · 后端开发

## 第 18 课 · Gin 框架

> Gin 是 Go 最流行的 Web 框架，对标 Express。开发效率比原生 net/http 高很多。

---

### 知识点 1：Gin 是什么？

Gin 提供路由、参数绑定、中间件、JSON 渲染。前端用 Express 的话，迁移到 Gin 非常快。

```bash
go get github.com/gin-gonic/gin   # 安装
```

```go
r := gin.Default()            // 创建应用（含日志和恢复中间件）
r.GET("/ping", func(c *gin.Context) {
    c.JSON(200, gin.H{"message": "pong"})   // gin.H = map 快速构造 JSON
})
r.Run(":8080")                // 启动
```

**前端类比**：`gin.Default()` = `express()`，`r.GET(path, fn)` = `app.get(path, fn)`，`c.JSON(code, obj)` = `res.json(obj)`。

---

### 知识点 2：路径参数和查询参数

```go
// 路径参数 /users/123
r.GET("/users/:id", func(c *gin.Context) {
    id := c.Param("id")
    c.JSON(200, gin.H{"id": id})
})

// 查询参数 /search?q=go&page=2
r.GET("/search", func(c *gin.Context) {
    q := c.Query("q")
    page := c.DefaultQuery("page", "1")   // 带默认值
    c.JSON(200, gin.H{"q": q, "page": page})
})
```

**前端类比**：`c.Param("id")` = `req.params.id`，`c.Query("q")` = `req.query.q`。

---

### 知识点 3：POST + JSON 自动绑定

Gin 最强功能——自动把请求 JSON 绑定到 struct 并校验。

```go
type User struct {
    Name string `json:"name" binding:"required"`   // required 必填
    Age  int    `json:"age"`
}

r.POST("/users", func(c *gin.Context) {
    var u User
    if err := c.ShouldBindJSON(&u); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})   // 自动校验 + 报错
        return
    }
    c.JSON(201, gin.H{"created": u})
})
```

**前端类比**：`ShouldBindJSON` = Express 的 body-parser + 手动校验。Gin 靠 `binding:"required"` tag 自动校验，比 Express 省事。

---

### 知识点 4：路由分组

```go
api := r.Group("/api/v1")
{
    api.GET("/users", listUsers)
    api.POST("/users", createUser)
}
```

类似 Express 的 `express.Router()`，把相关路由分组，便于加统一中间件。

---

### 小结

| 知识点 | 要点 |
|---|---|
| Gin | 对标 Express |
| Param/Query | 路径参数/查询参数 |
| ShouldBindJSON | 自动绑定 + 校验 |
| gin.H | 快速构造 JSON |
| Group | 路由分组 |

**练习**：用 Gin 写 `/api/echo` POST 接口，接收 `{"msg":"xxx"}`，返回 `{"echo":"xxx"}`。

---

## 第 19 课 · database/sql + GORM

> GORM 是 Go 最流行的 ORM，对标 Sequelize/TypeORM。前端转后端建议直接学 GORM。

---

### 知识点 1：GORM 是什么？

GORM 把数据库表映射成 struct，用 Go 代码操作数据库，不用手写 SQL。

```bash
go get gorm.io/gorm gorm.io/driver/sqlite
```

```go
type Product struct {
    gorm.Model          // 内置 ID/CreatedAt/UpdatedAt/DeletedAt（软删除）
    Name  string
    Price float64
}

db, _ := gorm.Open(sqlite.Open("shop.db"), &gorm.Config{})
db.AutoMigrate(&Product{})   // 自动建表
```

**前端类比**：`gorm.Model` 类似 Sequelize 的默认字段（id/createdAt）。`AutoMigrate` = `sync()` 自动建表。

---

### 知识点 2：增 Create

```go
db.Create(&Product{Name: "键盘", Price: 199})   // 插入一条

db.Create(&[]Product{                            // 批量插入
    {Name: "耳机", Price: 159},
    {Name: "摄像头", Price: 299},
})
```

---

### 知识点 3：查 Read

```go
var p Product
db.First(&p, 1)                    // 按主键查
fmt.Println(p.Name)

var products []Product
db.Find(&products)                 // 查全部

db.Where("price > ?", 100).Find(&products)   // 条件查询
db.Where("name LIKE ?", "%鼠%").Find(&products)  // 模糊查询
```

**前端类比**：`db.First(&p, 1)` = `Model.findByPk(1)`，`db.Where(...).Find()` = `Model.findAll({where})`。

---

### 知识点 4：改 Update 和删 Delete

```go
// 改
db.First(&p, 1)
db.Model(&p).Update("Price", 219)           // 改单字段
db.Model(&p).Updates(Product{Price: 229, Stock: 8})  // 改多字段

// 删
db.Delete(&p, 1)   // 软删除（gorm.Model 自带）
```

---

### 小结

| 知识点 | 要点 |
|---|---|
| GORM | 对标 Sequelize |
| gorm.Model | 内置 ID/时间戳/软删除 |
| Create | 插入 |
| First/Find/Where | 查询 |
| Update/Delete | 改/删 |

**练习**：定义 User 模型（Name, Email, Age），用 GORM 实现增删改查，查询年龄大于 18 的用户。

---

## 第 20 课 · 中间件

> 中间件是请求处理链上的"关卡"，对标 Express middleware。用途：日志、鉴权、CORS。

---

### 知识点 1：中间件是什么？

中间件在路由处理前后执行，能修改请求/响应或终止请求。前端用过 Express middleware 的话，Gin 中间件逻辑完全一致。

```go
func Logger() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()   // 放行到下一个中间件/路由
        fmt.Printf("%s %v\n", c.Request.URL.Path, time.Since(start))
    }
}

r.Use(Logger())   // 全局中间件
```

---

### 知识点 2：c.Next 和 c.Abort

- `c.Next()`：放行，执行后续处理
- `c.Abort()`：终止，不再执行后续

```go
func Auth() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(401, gin.H{"error": "未授权"})
            c.Abort()   // 终止，不调 Next
            return
        }
        c.Set("userID", 42)   // 往上下文存数据
        c.Next()
    }
}
```

---

### 知识点 3：路由组中间件

只对特定路由组生效的中间件。

```go
auth := r.Group("/api", Auth())   // 组级中间件
{
    auth.GET("/profile", func(c *gin.Context) {
        uid, _ := c.Get("userID")
        c.JSON(200, gin.H{"userID": uid})
    })
}
```

**前端类比**：`r.Group("/api", Auth())` = `router.use(auth)`，对一组路由生效。

---

### 小结

| 知识点 | 要点 |
|---|---|
| 中间件 | 请求处理链，对标 Express middleware |
| c.Next | 放行 |
| c.Abort | 终止（鉴权失败用） |
| c.Set/Get | 上下文传值 |
| Group | 路由组中间件 |

**练习**：写一个限流中间件，记录每个 IP 请求次数，超过 10 次/分钟返回 429。

---

## 第 21 课 · 测试 testing

> Go 内置 testing 包，不用装 Jest。命令 `go test` 驱动。推荐**表驱动测试**。

---

### 知识点 1：测试文件和函数

测试文件命名 `_test.go`，测试函数命名 `TestXxx`。

```go
// math.go
func Add(a, b int) int { return a + b }

// math_test.go
func TestAdd(t *testing.T) {
    got := Add(2, 3)
    if got != 5 {
        t.Errorf("Add(2,3) = %d, want 5", got)
    }
}
```

**前端类比**：`func TestAdd(t *testing.T)` = Jest 的 `test("add", () => {...})`。Go 没有 `expect/assert`，用 `if + t.Errorf` 手动判断。

---

### 知识点 2：表驱动测试（Go 推荐）

把测试用例组织成表，循环执行——加用例只需加一行数据。

```go
func TestIsPrime(t *testing.T) {
    tests := []struct {
        name  string
        input int
        want  bool
    }{
        {"小于2", 1, false},
        {"2是质数", 2, true},
        {"4不是", 4, false},
        {"17是质数", 17, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := IsPrime(tt.input); got != tt.want {
                t.Errorf("IsPrime(%d) = %v, want %v", tt.input, got, tt.want)
            }
        })
    }
}
```

**前端类比**：类似 Jest 的 `it.each`，数据驱动测试。Go 鼓励这种模式。

---

### 知识点 3：运行测试

```bash
go test ./...           # 运行所有测试
go test -v ./...        # 详细输出
go test -run TestAdd    # 只跑指定测试
go test -cover          # 覆盖率
```

---

### 小结

| 知识点 | 要点 |
|---|---|
| 测试文件 | _test.go 后缀 |
| 测试函数 | TestXxx(t *testing.T) |
| 断言 | if + t.Errorf（无 expect） |
| 表驱动 | 数据驱动，Go 推荐 |
| 运行 | go test |

**练习**：为 Add 函数写表驱动测试，覆盖正数、负数、零。

---

# 阶段 4 · 实战

## 第 22 课 · 综合项目

> 串联所有技能，做一个完整的用户管理 RESTful API。改造成任何业务骨架完全一样。

---

### 项目结构

这个项目串联：Gin 路由 + GORM 数据库 + JSON 绑定 + 错误处理。它是 Go 后端服务的**最小可用模板**。

```go
package main

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
    "gorm.io/driver/sqlite"
)

type User struct {
    gorm.Model
    Name  string `json:"name" binding:"required"`
    Email string `json:"email" binding:"required,email"`
    Age   int    `json:"age"`
}

var db *gorm.DB

func main() {
    db, _ = gorm.Open(sqlite.Open("users.db"), &gorm.Config{})
    db.AutoMigrate(&User{})

    r := gin.Default()
    r.GET("/users", listUsers)
    r.GET("/users/:id", getUser)
    r.POST("/users", createUser)
    r.PUT("/users/:id", updateUser)
    r.DELETE("/users/:id", deleteUser)
    r.Run(":8080")
}

func listUsers(c *gin.Context) {
    var users []User
    db.Find(&users)
    c.JSON(http.StatusOK, users)
}

func getUser(c *gin.Context) {
    var u User
    if err := db.First(&u, c.Param("id")).Error; err != nil {
        c.JSON(404, gin.H{"error": "用户不存在"})
        return
    }
    c.JSON(200, u)
}

func createUser(c *gin.Context) {
    var u User
    if err := c.ShouldBindJSON(&u); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    db.Create(&u)
    c.JSON(201, u)
}

func updateUser(c *gin.Context) {
    var u User
    if err := db.First(&u, c.Param("id")).Error; err != nil {
        c.JSON(404, gin.H{"error": "用户不存在"})
        return
    }
    c.ShouldBindJSON(&u)
    db.Save(&u)
    c.JSON(200, u)
}

func deleteUser(c *gin.Context) {
    db.Delete(&User{}, c.Param("id"))
    c.JSON(200, gin.H{"msg": "已删除"})
}
```

### 为什么这个项目重要

改造成任何业务只需：
1. 改 `User` struct → 你的业务模型（Product/Order/Article）
2. 五个 handler 结构不变（查列表/查单个/增/改/删）
3. 加中间件（鉴权/日志/CORS）

这就是 Go 后端的核心骨架，你以后写的任何 API 服务都是这个模式的变种。

### 扩展方向

- 加鉴权中间件（JWT）
- 加分页（`?page=1&size=20`）
- 换 MySQL/PostgreSQL（改一行连接代码）
- Docker 容器化部署

---

## 学完之后

22 课过完，你具备了用 Go 独立开发后端 API 服务的能力。下一步：扩展综合项目成完整产品，或学微服务（gRPC）、Docker 部署。遇到问题对照 `resources.md` 查证。祝学习顺利。
