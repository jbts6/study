# Python 30 天本地课程设计

## 目标

把本地 `python/` 课程入口替换为以 `Asabeneh/30-Days-Of-Python` 为主线的 30 天 Python 学习课程，同时保留现有页面的浏览器内 Python 代码运行、章节导航和本地进度能力。

课程内容面向当前使用者的中文学习场景：优先使用上游 `Chinese/` 目录中的中文章节；没有中文章节时使用英文原文或本地编写的第一天导入内容。课程页面显示上游来源和原文链接，方便核对更新。

## 非目标

- 不修改仓库中的 Go、Rust 或其他课程资料。
- 不实现账号、云端进度、课程后台或在线提交系统。
- 不把 Asabeneh 仓库未声明许可证的内容当作本项目可再发布的开源内容。
- 不把 `requests`、数据库、命令行等需要本地环境的示例伪装成浏览器内一定可运行的代码。
- 不引入重量级前端框架或构建系统；课程仍可通过静态文件和一个简单的本地 HTTP 服务运行。

## 课程范围

课程包含 30 个按天排列的章节：

1. 第 1 天使用本地导入桥接内容，并链接到上游 `01_Day_Introduction/helloworld.py`。
2. 第 2-30 天优先加载上游 `Chinese/` 目录的对应 Markdown 文件。
3. 中文目录中存在普通文件和 `_cn` 文件时优先选择 `_cn` 文件。
4. 中文目录没有对应文件时回退到英文日课 Markdown 文件。
5. 每个章节显示标题、Markdown 正文、可运行的 Python 代码块、上游文件路径和 GitHub 原文链接。

保留现有 19 课页面的完整副本到 `python/basics-course/legacy/index.html`，新入口不再依赖旧的内嵌课程数据。

## 上游同步策略

`python/basics-course/sync-course.mjs` 负责以下流程：

1. 在固定的 `python/upstream/30-Days-Of-Python` 目录执行浅克隆；目录存在时只执行 `git pull --ff-only`。
2. 从本地上游仓库读取中文/英文章节，生成 `python/basics-course/generated/lessons.js`。
3. 生成文件和上游仓库均加入 `python/.gitignore`，不进入父仓库提交。
4. 生成文件包含章节 ID、天数、标题、正文、源文件路径、GitHub 原文链接和生成时间。
5. 同步失败时保留已有生成文件，并在命令行打印明确错误；页面启动时如果没有生成文件，显示可执行的同步命令。

页面不在运行时直接读取 GitHub 内容，避免课程打开时依赖远程 API；同步完成后页面只读取本地生成数据。页面仍保留每课的 GitHub 原文链接。

## 用户流程

1. 用户打开 `python/basics-course/index.html`，看到 30 天课程导航。
2. 默认选中第 1 天，主内容显示学习材料和第一个 Python 示例。
3. 用户在代码编辑区域修改代码并点击运行。
4. 页面加载 Pyodide 后执行代码，自动尝试加载代码所需的 Pyodide 包。
5. 页面显示标准输出或完整的 Python 异常信息；网络、文件系统和本地包限制以中文提示说明。
6. 用户点击“标记完成”保存当前天的进度，下一天可以继续学习。
7. 刷新页面后恢复已完成章节和当前章节。

## 界面设计

### 桌面布局

- 顶部栏显示课程名称、Python 运行时状态、完成进度和上游来源入口。
- 左侧栏显示 30 天章节、当前项、完成状态和补充练习链接。
- 主区域显示章节 Markdown 内容和可运行代码块。
- 每个 Python 代码块使用稳定高度的编辑区和输出区，不因为输出长度改变页面主要结构。

### 移动布局

- 侧栏折叠为可打开的课程目录。
- 章节内容和代码块纵向排列。
- 代码区支持横向滚动，运行按钮保持可见且触控目标不小于 40px。

### 必须覆盖的状态

- 生成课程数据不存在。
- Markdown 渲染器加载失败。
- Pyodide 加载中、加载成功和加载失败。
- 代码运行中、运行成功、无输出和 Python 异常。
- 章节完成/未完成、进度保存失败和存储损坏。
- 上一课/下一课边界和移动端侧栏展开/关闭。

## 技术架构

```text
Asabeneh GitHub 仓库
    -> sync-course.mjs
本地 upstream/ + 生成的 lessons.js
    -> basics-course/index.html
课程渲染器 + marked + DOMPurify
    -> Python 代码块编辑器
Pyodide 运行时 + loadPackagesFromImports
    -> 输出/异常状态 + localStorage 进度
```

文件职责固定如下：

- `python/basics-course/index.html`：静态页面骨架和固定 CDN 依赖。
- `python/basics-course/styles.css`：页面 token、布局、代码块和状态样式。
- `python/basics-course/app.js`：课程加载、导航、Markdown 渲染和 DOM 事件编排。
- `python/basics-course/store.js`：进度读写和当前章节状态。
- `python/basics-course/runner.js`：Pyodide 初始化、代码执行和输出截断。
- `python/basics-course/sync-course.mjs`：上游同步、中文优先选择和生成数据。
- `python/basics-course/sync-course.test.mjs`：同步选择和生成数据的无网络单元测试。
- `python/README.md`：同步、启动、验证和个人上游使用说明。

Markdown 使用固定版本的 `marked` 渲染，HTML 使用固定版本的 `DOMPurify` 清理；课程数据来自本地上游仓库，不接受用户输入作为 Markdown。

## 本地进度

使用新的 `py-course-progress-v2` 存储键，结构为：

```json
{
  "currentDay": 1,
  "completed": [1, 2],
  "drafts": {"1:0": "print('Hello')"}
}
```

损坏或无法解析的存储值回退为空进度，不阻塞课程页面。

## 测试策略

- Node 单元测试覆盖中文文件选择、英文回退、第一天桥接、30 天排序、生成文件结构和路径安全。
- `node --check` 检查同步脚本、页面脚本和运行器语法。
- 本地 HTTP 服务验收课程数据加载、30 天导航、Markdown 渲染、代码运行、进度保存和错误状态。
- 桌面视口使用 1440x900，移动视口使用 390x844，检查无横向溢出、代码区无重叠、侧栏可用。
- 运行不依赖 Docker；Pyodide 需要网络访问 CDN，无法加载时页面仍显示可读错误。

## 验收标准

- `node basics-course/sync-course.mjs` 能在本地上游目录存在或不存在时完成同步和生成。
- 生成课程数据包含 30 天，中文章节优先，且每课带 GitHub 原文链接。
- 用户打开新入口能看到第 1 天并切换到第 30 天。
- Python 代码块可以编辑并运行，输出、无输出和异常状态可区分。
- 标记完成后进度条和章节状态更新，刷新页面后仍保留。
- 旧课程副本存在于 `python/basics-course/legacy/index.html`。
- 当前任务不改动 `go/`、`rust/` 及用户其他未提交文件。
