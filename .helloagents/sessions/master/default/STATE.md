# 恢复快照

## 主线目标
Python RPG 在当前 VS Code 提供可发现、可点击的游戏入口，并统一关卡 Python 排版

## 正在做什么
已完成本地安装入口、活动栏启动入口与关卡脚本 60 字符行宽整理

## 关键上下文
- F5 的 `extensionHost` 调试配置按 VS Code 机制启动独立 Extension Development Host 窗口
- `rpg/src/vscode/extension.ts` 已在同一宿主窗口中创建第一、第二编辑器组；缺少的是安装到当前 VS Code 的入口
- 使用 `@vscode/vsce` 打包 VSIX，再通过 `code --install-extension <VSIX> --force` 本地安装
- 首次打包发现 VSIX 包含依赖与测试产物；将用 `.vscodeignore` 只保留扩展运行所需文件
- 用户反馈只有 F5，无法发现命令面板入口；新增活动栏容器和可点击树视图作为首选入口
- 本地扩展已重新打包并覆盖安装；重载当前 VS Code 后，左侧活动栏显示 `Python RPG` 图标
- `python-rpg/python-marsh-01.py` 至 `06.py` 与扩展起始模板的最大行宽均不超过 60 字符

## 下一步
任务已完成

## 阻塞项
（无）

## 方案
`docs/superpowers/plans/2026-08-14-python-rpg-current-window-launch.md` 已完成
## 已标记技能
systematic-debugging、test-driven-development、verification-before-completion、qa-review
