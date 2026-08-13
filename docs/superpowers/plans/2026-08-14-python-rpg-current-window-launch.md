# Python RPG Current-Window Launch Implementation Plan

**Goal:** 让 Python RPG 能安装到当前 VS Code，并在当前窗口中打开左右编辑器组。

**Architecture:** 使用 VSIX 作为本地安装载体。安装任务先构建扩展，再生成 VSIX，并通过 VS Code CLI 覆盖安装；运行命令仍由已安装的扩展在当前窗口执行。

**Tech Stack:** VS Code Extension API、`@vscode/vsce`、VS Code CLI、npm。

## Global Constraints

- F5 仅用于需要单独 Extension Development Host 的调试。
- 日常运行必须从当前 VS Code 窗口调用 `Python RPG: 打开游戏`。
- 不改变扩展的游戏、存档或本地 Python Runner 行为。
- 配置修改免写单元测试，以 VSIX 打包和 VS Code CLI 安装作为验证。

### Task 1: 本地安装入口

**Files:**
- Modify: `rpg/package.json`
- Create: `rpg/.vscodeignore`
- Modify: `.vscode/tasks.json`
- Modify: `.vscode/launch.json`
- Modify: `rpg/README.md`

- [x] 添加 `@vscode/vsce` 开发依赖和 `package:vsix`、`install:local` 脚本；安装脚本先构建，随后生成 `python-rpg.vsix` 并以 `code --install-extension ... --force` 覆盖安装。
- [x] 添加 `.vscodeignore`，排除依赖、测试、源码中的 TypeScript 模块与构建配置，同时保留 `dist/` 和 Python 运行时源码。
- [x] 新增 VS Code 任务“安装 Python RPG 到当前 VS Code”，以 `npm run install:local` 作为执行入口。
- [x] 将 F5 配置重命名为“调试 Python RPG 扩展（新窗口）”。
- [x] 更新 README：先运行本地安装任务，再重载当前窗口，点击活动栏 `Python RPG` 图标中的“打开游戏”；明确 F5 会打开独立开发宿主。
- [x] 运行 `npm run package:vsix`，确认生成 VSIX；运行 `code --install-extension` 验证覆盖安装；运行 `npm run typecheck` 确认配置和打包改动未影响 TypeScript。

### Task 2: 可点击的游戏入口

**Files:**
- Create: `rpg/src/vscode/game-launcher-model.ts`
- Create: `rpg/src/vscode/game-launcher.ts`
- Create: `rpg/src/vscode/game-launcher-model.test.ts`
- Create: `rpg/media/python-rpg.svg`
- Modify: `rpg/src/vscode/extension.ts`
- Modify: `rpg/package.json`
- Modify: `rpg/README.md`

- [x] 先写模型测试，断言唯一入口为“打开游戏”，并调用既有 `pythonRpg.open` 命令。
- [x] 添加活动栏容器 `Python RPG` 和其中的树视图；用户点击活动栏图标后可点击“打开游戏”。
- [x] 在扩展激活时注册只读树数据提供器，以 VS Code 原生播放图标呈现入口，不增加游戏状态或新命令。
- [x] 更新 README，首选使用活动栏图标打开游戏，命令面板作为备用入口。
- [x] 运行该模型测试、类型检查、VSIX 打包与本地覆盖安装。
