# 章节自由切换按钮 — 设计（精简版）

日期：2026-08-16
分支：`feat/chapter-switch`

## 需求

探索视图加章节切换按钮，任意章节自由跳转（含未解锁），方便重玩与测试。

## 实现

1. **命令链**（照 `resetCampaign` 模式）：`WebviewCommand` 增加
   `Readonly<{ type: "switchChapter"; chapterId: string }>`；
   `extension.ts` 与 `webview/main.ts` 两处守卫更新；`GameSession` 新
   case 清诊断后调 `controller.switchChapter(chapterId)`。
2. **控制器** `switchChapter(chapterId)`：未知章节直接返回（按钮只会
   发合法 id，不设错误反馈）；否则重置 `chapterId`、任务链为该章首步、
   `locationId` 为该章起点、清战斗与 `battleLog`，草稿取该章存稿或
   starter，存档并发布快照（反馈标题"已切换章节"）。
3. **UI**：`ExplorationViewSnapshot` 增加
   `chapters: readonly Readonly<{ id: string; title: string }>[]`，
   在 `game-session.ts` 从 `campaign.levelOrder` + 关卡标题推导（控制器
   无改动）。`render-exploration.ts` 操作栏渲染"第 N 章"按钮组（序号取
   levelOrder 下标），当前章禁用；点击带 `chapterId`。

## 测试与交付

- 控制器 `switchChapter` 重置语义（切到第二章后 chapterId / 任务链 /
  地点 / 草稿正确），1 条正常路径用例。
- 探索视图渲染按钮且当前章禁用，1 条用例。
- `npm run install:local` 交付。

## 非目标

战斗视图不加切换；不做确认弹窗；不做未解锁章节遮蔽。
