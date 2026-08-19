# 本地编程学习工坊

这是一个面向个人、本机运行的编程学习仓库。主线按 **Python -> Go -> Rust** 推进；奥术工业幻想 Python RPG 保留为选修综合项目，不再作为全部课程的外壳。

Python、Go、Rust 三套本地交互课程均已有可运行入口：Go 包含 22 节，Rust 包含 12 节。代码只由本机对应工具链执行，不会发送到远程服务。

## 先从 Python 开始

### 1. 检查环境

需要：

- Node.js 24 或更高版本
- CPython 3.12 或更高版本

在 PowerShell 中检查：

```powershell
node --version
python --version
```

### 2. 启动课程

从仓库根目录运行：

```powershell
cd python/interactive-course
npm start
```

当前课程没有第三方运行时依赖，因此首次启动也不需要执行 `npm install`。

终端显示以下地址后，保持终端窗口运行：

<http://127.0.0.1:8010>

### 3. 完成一次学习循环

1. 阅读课节目标、讲解和参考示例。
2. 在代码编辑区完成练习。
3. 点击“运行练习”。
4. 根据测试失败、语法错误或运行时错误修改代码。
5. 练习通过后，从空白文件独立重写一次。
6. 勾选“我已从空白文件独立重建”，记录掌握状态。

草稿、当前课节和学习进度保存在当前浏览器中，刷新页面后会自动恢复。

### 4. 停止课程

回到运行 `npm start` 的终端，按 `Ctrl+C`。

更完整的使用方法和故障处理见 [`python/README.md`](python/README.md)。

## 学习路线

| 阶段 | 当前状态 | 入口 |
| --- | --- | --- |
| Python 基础与自动化 | 当前主线，已提供首个可运行课节 | [`python/`](python/) |
| Go 工程与并发 | 已完成 22 节交互课程 | [`go/interactive-course/`](go/interactive-course/) |
| Rust 系统建模 | 已完成 12 节交互课程 | [`rust/interactive-course/`](rust/interactive-course/) |
| Python RPG 综合项目 | 选修，用于综合应用 Python | [`rpg/`](rpg/) |

统一的语言顺序和启动入口见 [`learning/README.md`](learning/README.md)。

## 常见启动问题

### 找不到 `python`

先安装 CPython 3.12 或更高版本，并确认 `python --version` 能运行。也可以在当前 PowerShell 窗口中指定解释器的完整路径：

```powershell
$env:PYTHON_COURSE_PYTHON_PATH = "C:\Python312\python.exe"
npm start
```

### `8010` 端口被占用

改用其他本机端口：

```powershell
$env:PORT = "8011"
npm start
```

然后打开 <http://127.0.0.1:8011>。

### 页面提示无法连接

确认启动课程的终端仍在运行，并使用终端输出的地址打开页面。服务只监听 `127.0.0.1`，不提供公网访问。

## 当前范围

- 当前 Python 垂直切片包含一个代表课节，用于验证完整学习流程。
- Python 当前只验收桌面浏览器；Go、Rust 保留现有响应式课程界面。
- 推荐按 Python、Go、Rust 的顺序学习，但三套课程入口均可独立启动。
- RPG 不再限制主线课程形态，只作为选修综合练习。

## 开发验证

按改动范围运行对应课程的核心测试，不需要执行全仓测试：

```powershell
cd python/interactive-course
npm test

cd ../../go/interactive-course
go test ./...

cd ../../rust/interactive-course
npm test
```

## 目录

- `learning/`：Python、Go、Rust 的公共学习目录。
- `python/interactive-course/`：当前可运行的 Python 本地交互课程。
- `go/interactive-course/`：现有 Go 交互课程。
- `rust/interactive-course/`：现有 Rust 交互课程。
- `rpg/`：奥术工业幻想 Python RPG 选修综合项目。
- `docs/superpowers/`：设计说明和实施记录。

RPG 的安装、VS Code 扩展和开发预览说明见 [`rpg/README.md`](rpg/README.md)。
