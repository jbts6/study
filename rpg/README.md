# Python RPG

## Requirements

- Node.js 24.15.0
- CPython 3.12 or newer available as `python`, `python3`, or `py -3`

## VS Code 插件（主入口）

1. 在 VS Code 中打开仓库根目录。
2. 执行 `npm ci --prefix rpg` 安装依赖。
3. 运行任务“安装 Python RPG 到当前 VS Code”。它会构建并覆盖安装本地扩展。
4. 执行“Developer: Reload Window”重载当前窗口。
5. 点击左侧活动栏的 `Python RPG` 图标，再点击“打开游戏”。

插件会在左侧编辑器组打开 `python-rpg/python-marsh-01.py`，在右侧编辑器组打开游戏战场。游戏推进后会切换到下一关对应的 Python 文件。修改代码后可点击“运行回合”，或按 `Ctrl+Enter`；无需保存，插件会读取编辑器内的最新文本。

`F5` 的“调试 Python RPG 扩展（新窗口）”仅用于开发调试；VS Code 会为它启动独立的 Extension Development Host 窗口。日常游玩请使用左侧 `Python RPG` 图标；命令面板中的“Python RPG: 打开游戏”可作为备用入口。

战役进度保存在 VS Code 的工作区状态中，Python 源码只保存在工作区文件。插件直接启动本机 CPython 子进程，不经过 WebSocket，也不会把代码发送到远端。

可选设置 `pythonRpg.pythonPath` 指定 Python 3.12+ 可执行文件；留空时自动检测 `python3` 或 `python`。

真实扩展宿主集成测试使用隔离的临时工作区与 VS Code 用户数据目录：

```bash
npm run test:extension
```

该测试会启动真实 VS Code，执行 `pythonRpg.open`，并验证六个关卡文件、左侧 Python 标签与右侧游戏 Webview 标签。首次运行会下载官方 VS Code 测试运行时。

## 网页开发预览

Terminal 1:

```bash
npm run runner
```

Terminal 2:

```bash
npm run dev
```

Open `http://127.0.0.1:5174`.

## 本地代码边界

网页开发预览中的 Python 只发送到 `ws://127.0.0.1:5175`，本地 Node Runner 再启动本机 CPython；代码不会发送到远端。VS Code 插件不使用该 WebSocket 链路。

## 存档与重置

网页开发预览的存档保存在浏览器 `localStorage` 的 `python-rpg.save` 下；VS Code 插件使用工作区状态。重置操作只清除战役进度，不删除关卡 Python 文件。
