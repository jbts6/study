# 恢复快照

## 主线目标
增强 Python RPG 第一关命令契约提示，让玩家无需猜测字段类型、层级和 `movePath` 格式。

## 正在做什么
第一关命令契约提示增强已完成，评审意见、QA 证据和交付清单均已处理。

## 关键上下文
`movePath` 必须是顶层可选字段，值为 `[{"x": 1, "y": 0}]` 形式的坐标对象数组；不是 `[[1, 0]]`。数组元素只填写每一步要到达的目标格，第一步及后续每一步都必须正交相邻，第一关 scout 最多 2 步；无移动时可省略或写 `[]`。需要保持战斗规则和 Runner 协议不变。

## 下一步
任务已完成；保留本地提交作为版本检查点。

## 阻塞项
（无）

## 方案
`docs/superpowers/plans/2026-08-13-python-rpg-command-contract-help.md`

## 已标记技能
using-superpowers, brainstorming, writing-plans, test-driven-development, hello-ui, verification-before-completion, qa-review, requesting-code-review, receiving-code-review
