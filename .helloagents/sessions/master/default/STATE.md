# 恢复快照

## 主线目标
重排 Python RPG 的第一关提示区域，采用 B 方案“编辑器优先 + 底部提示抽屉”，让玩家保留完整命令契约提示又不牺牲代码编辑空间。

## 正在做什么
已完成 A/B/C 布局线框比较，用户选择 B；正在确认抽屉展开时的固定高度与内部滚动约束，尚未修改生产 UI。

## 关键上下文
用户指出完整提示区严重干扰编辑框。B 方案：编辑器顶部只保留紧凑任务条；完整提示收进默认折叠的 API 抽屉，按命令外层字段、`movePath`、`action`、本关规则分组；错误反馈继续留在底部反馈区。`movePath` 必须是 `[{"x": 1, "y": 0}]` 坐标对象数组，不是 `[[1, 0]]`。

## 下一步
确认抽屉展开高度与滚动行为后，写入 UI 设计 spec，再进入实现计划。

## 阻塞项
等待用户确认“固定最大高度 + 抽屉内部滚动”的交互约束。

## 方案
`docs/superpowers/plans/2026-08-13-python-rpg-command-contract-help.md`

## 已标记技能
using-superpowers, brainstorming, writing-plans, test-driven-development, hello-ui, verification-before-completion, qa-review, requesting-code-review, receiving-code-review
