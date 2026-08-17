# Task 3 实现报告

## 状态

- 已完成 Python 课程页面、本地进度存储、真实本地执行反馈和桌面端布局。
- 产品提交：`b26756c`（课程界面）、`f5806ed`（反馈状态修复）、`a7a7ad9`（诊断与恢复指引修复）。
- 各产品提交均未混入 `STATE.md` 或其他流程文件。

## 交付内容

- `web/index.html`：语义化课程目录、讲解、示例、编辑器、运行操作、独立重建证据和实时结果区。
- `web/app.js`：`createCourseApp(dependencies)` 单控制器；页面可变状态仅为 `course`、`activeLesson`、`progress`、`running`、`lastResult`。
- `web/store.js`：`createStore(storage)`；进度字段固定为 `currentLessonId`、`drafts`、`practiced`、`mastered`。
- `web/styles.css`：桌面目录 + 内容 + 双栏工作区；包含可见焦点、44px 操作目标和减弱动效。
- `server/runner.mjs`：清理 Python 诊断中的本机绝对路径；Python 不可用时显示缺失程序、检测命令、安装入口和原始错误。
- `test/store.test.mjs`：严格保留 2 个核心用例，不增加 DOM、CSS、快照、Playwright 或状态矩阵测试。

## TDD 证据

- 第一例 RED：缺少 `web/store.js`，测试以 `ERR_MODULE_NOT_FOUND` 失败；实现存储后 GREEN，1/1 通过。
- 第二例 RED：损坏 JSON 抛出 `SyntaxError`，1/2 通过；加入空进度回退后 GREEN，2/2 通过。
- 诊断修复 RED：既有错误路径用例同时捕获绝对路径泄露和缺少恢复指引；修复 Runner 后该用例 GREEN，测试数量保持不变。
- `practiced` 只在执行结果为 `passed` 时写入；`mastered` 只由用户显式勾选“我已从空白文件独立重建”写入。

## 验证

- 9 个 JavaScript 文件执行 `node --check`：9/9 通过。
- `npm test`：2 个 Node 测试文件，5/5 通过，0 失败。
- 总测试预算：3 个测试代码文件、6 个用例；其中 Node 2 文件 5 例，`hidden_test.py` 1 文件 1 例。
- `git diff --check` 与 `git diff --check 41ea3b7..HEAD`：通过。

## 浏览器验收

- 1280x800：目录、讲解、编辑器和结果区无重叠、无页面级横向溢出，编辑器和结果区均可操作。
- 正确答案显示 `passed`，刷新后保留草稿和 `practiced`。
- 显式勾选独立重建后刷新，`mastered` 和复选框状态保留。
- 错误答案显示 `test_failed` 和 unittest 失败信息；语法错误显示 `compile_error` 和真实 Python 行号。
- Tab 顺序覆盖目录、参考示例滚动区、编辑器、运行按钮和掌握复选框。
- 减弱动效下过渡和动画时长均为 `1e-05s`。
- 桌面截图：`C:/Users/fh345/AppData/Local/Temp/python-course-task3-desktop.png`。

## 自审

- 未新增依赖、第二套客户端状态机或超出任务范围的抽象。
- 移动端不在本阶段验收范围内。
- `a7a7ad9` 的定向复审已通过，无剩余阻断项。
