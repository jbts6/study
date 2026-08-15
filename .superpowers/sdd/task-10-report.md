# Task 10 报告：Python 第一章世界战役闭环

## 交付内容

- Starter 同时提供 `choose_world_action(world)` 与 `choose_turn(world)`，保留原有战斗教学字段和 60 字符以内的代码行。
- 控制器纵向测试覆盖交谈、调查、收集、天气调查、旅行、使用物资、进入战斗、两次攻击、提交报告，并断言任务完成、章节解锁、战斗清理和存档一致。
- 浏览器入口切换到 `WorldCampaignController` 与 `LocalWorldSaveStore`；战斗渲染、探索渲染、V2 只读代码恢复分别承担独立职责。
- VS Code 宿主等待首次源码文档打开后再把 Webview 放到 `ViewColumn.Two`；世界运行诊断使用章节 ID 映射回 `python-marsh-01.py`。
- 新增暗色奥术工业探索面板，现场行列尺寸加大，四周留白收紧，720px 右栏宽度下改为纵向堆叠避免内容重叠。
- 复审修复旧版工作区存档恢复：按 `legacyLevelId` 读取源码并提供只读备份与下载；探索面板展示 `availableTravel`；编辑器草稿同步到控制器并跨 Runner 状态更新保持；战斗帮助过滤探索命令示例。

## 验证

- `[√]` 聚焦集成：8 个测试文件、46/46 通过。
- `[√]` 全量测试：46 个测试文件、261/261 通过，退出码 0。
- `[√]` 构建：`npm run build` 通过类型检查、Web、扩展和 Webview 构建；仅保留既有 Vite chunk 体积提示。
- `[√]` 扩展集成：`npm run test:extension` 退出码 0；VS Code 右侧 Webview 分组与 Python 语法诊断均通过。
- `[√]` 本地安装：`npm run install:local` 成功打包 39 文件 VSIX 并强制安装，已验证 `local.python-rpg@0.1.0`。
- `[√]` 视觉检查：Playwright 截图检查 720x900 右栏视口，探索层级、较大现场行列和反馈区无重叠。
- `[√]` 差异检查：`git diff --check` 退出码 0；仅有 Git 的换行转换提示。

## 已知限制

- VS Code 内完整人工流程（重载后逐步完成探索、战斗、存档恢复及 Go 合法回合）需要安装后由宿主窗口执行；自动化已覆盖右侧分组、源码编辑和错误诊断。
- 构建仍输出 Vite 单 chunk 体积提示，不影响产物或测试。
