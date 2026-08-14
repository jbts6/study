# Go RPG 战术手册设计

## 目标

让玩家只依靠游戏内信息就能理解 Go RPG 的回合入口、`TurnCommand` 结构、`World` 数据和全部内置动作函数，并完成第 1-6 关。提示不再挤占运行反馈区，而是在游戏 Webview 中拥有独立、可查阅的“战术手册”视图。

## 问题证据

当前 `TurnCommand`、`World`、`Cell`、`Unit`、`Skill` 等类型，以及 `Wait`、`Attack`、`MoveAndAttack`、`Guard`、`Cast`、`MoveAndCast`、`Interact`、`MoveAndInteract` 等函数只在 Go SDK 源码中完整定义。关卡提示只零散点名其中一部分，玩家无法从游戏界面推导参数、返回值和组合方式。

| 关卡 | 当前教学缺口 |
| --- | --- |
| 1 | 要求返回 `TurnCommand`，但不展示结构；说“尝试移动和攻击”，但不展示 `Cell`、`Attack` 或 `MoveAndAttack`。 |
| 2 | 起始代码直接使用 `world.Units`、`Cast`、`Guard`，但不展示 `Unit`、`Skill` 字段和函数签名。 |
| 3 | 要求先激活目标再攻击，但不展示 `Objective`、`MoveAndInteract` 及移动后交互的完整示例。 |
| 4 | 使用技能冷却和目标完成状态，但只描述字段名，不展示所属类型和移动施法方式。 |
| 5 | 同时涉及节点、多个敌人和破防技能，但缺少可检索的类型与动作参考。 |
| 6 | 要求综合全部能力，却只列能力名和 `Interact`，没有完整 SDK 总览。 |

当前 VS Code Webview 把 `GuidanceDrawer` 放在运行反馈标题内。反馈区最大高度为 `min(30vh, 250px)`，展开长提示会与错误、标准输出和战斗事件争夺同一个滚动区域，无法承载完整 SDK。

## 已确认方向

采用 A 方案：在右侧游戏 Webview 的主内容区增加“战场 / 战术手册”视图切换。

- 任务条、关卡状态、运行反馈和操作栏保持原位。
- “战术手册”替换战场主内容区，不新增纵向区块，不继续扩大反馈区。
- 手册默认突出当前关卡需要的内容，同时提供完整 SDK 目录。
- 不打开独立 VS Code 文档，不替换左侧玩家代码文件。
- 不使用覆盖式抽屉，避免半屏 Webview 中代码示例过窄。

## 页面结构

右侧 Webview 保持五段结构：

1. 关卡标题与运行状态
2. 始终可见的任务目标和失败条件
3. 主内容区：`战场` 或 `战术手册`
4. 运行反馈
5. 运行、重试或进入下一关的操作栏

“战场 / 战术手册”使用可键盘操作的标签页。手册内部使用左侧目录和右侧正文：

1. 本关重点
2. 回合命令
3. `World` 数据
4. 动作函数
5. 完整 SDK

窄宽度下目录改为手册顶部的横向标签，不形成第二个窄侧栏。正文独立滚动，页面不产生横向滚动。

## 默认行为

- 每个关卡第一次打开且战场 `revision` 为 `0` 时，默认显示“战术手册”的“本关重点”。
- 玩家完成第一个合法回合后，自动切换到“战场”。编译错误、运行时错误和无效指令不会触发切换。
- 玩家手动切换后，在当前 Webview 会话内记住每关最后选择的视图和手册章节。
- Webview 重载时使用 VS Code Webview 状态恢复；没有已存状态时按 `revision` 选择默认视图。
- 进入下一关时重新显示该关“本关重点”，保证新增 API 一定可见。

## 内容模型

完整 SDK 参考属于语言程序定义，不应复制到六个关卡中。关卡只声明本关重点及其引用项。

```ts
type ProgramReference = Readonly<{
  entrypoint: Readonly<{ signature: string; description: string }>;
  sections: readonly ReferenceSection[];
}>;

type ReferenceSection = Readonly<{
  id: string;
  title: string;
  entries: readonly ReferenceEntry[];
}>;

type ReferenceEntry = Readonly<{
  id: string;
  signature: string;
  description: string;
  example?: string;
}>;

type LevelApiFocus = Readonly<{
  summary: string;
  steps: readonly string[];
  referenceIds: readonly string[];
  example: string;
}>;
```

- `PlayerProgramDefinition` 增加 `reference: ProgramReference`。
- `LevelGuidance` 保留现有目标、概念和规则字段，并增加 `apiFocus: LevelApiFocus`。
- `GameViewSnapshot` 传递程序参考和关卡重点；Webview 不读取 Go SDK 文件，也不根据文案猜测结构。
- Go SDK 参考必须逐字段对应 `rpg/src/runners/go/runtime/sdk.go`。相关测试锁定公开签名，防止文档与执行器漂移。
- Python 先继续使用现有提示内容；新视图和模型应保持语言无关，但本次只补齐 Go 第 1-6 关，不扩张 Python 内容范围。

## Go 完整参考

手册必须覆盖以下公开 API：

- 入口：`func ChooseTurn(world World) TurnCommand`
- 类型：`World`、`Cell`、`Board`、`Objective`、`Status`、`Unit`、`Skill`、`Action`、`TurnCommand`
- 动作：`Wait`、`Attack`、`MoveAndAttack`、`Guard`、`Cast`、`MoveAndCast`、`Interact`、`MoveAndInteract`

每个类型展示真实字段名与 Go 类型。每个动作展示完整签名、一句行为说明和一个最小示例。`MovePath` 必须明确为绝对坐标序列，每一步正交相邻，移动后再执行动作。

## 第 1-6 关递进映射

| 关卡 | 本关重点引用 |
| --- | --- |
| 1 | `ChooseTurn`、`World`、`TurnCommand`、`Cell`、`Wait`、`Attack`、`MoveAndAttack`；示例展示移动到 `(2, 0)` 后攻击 `golem`。 |
| 2 | `Unit`、`Skill`、`Board`、`Cast`、`MoveAndCast`、`Guard`；解释生命值、危险格、冷却与自疗目标。 |
| 3 | `Objective`、`Attack`、`Interact`、`MoveAndInteract`；解释筛选敌人、相邻交互和目标完成状态。 |
| 4 | `Skill.RemainingCooldown`、`Objective.Completed`、`Cast`、`MoveAndCast`、`Interact`；解释条件优先级，不提供完整答案。 |
| 5 | `Unit`、`Objective`、`Cast`、`Interact` 及移动组合函数；强调辅助函数职责和多个目标顺序。 |
| 6 | 完整 SDK 索引、全部已解锁能力、地图与目标字段；只提供契约速查和战役约束，不提供通关策略。 |

## 错误跳转

- Go 编译错误和运行时错误继续显示在反馈区，并沿用文件、行、列诊断；不自动切换手册。
- 无效回合指令在反馈区增加“查看相关 API”命令。触发后切换到手册并聚焦对应条目。
- `combatErrorFeedback` 根据既有错误 `code` 和 `path` 生成稳定的 `referenceIds`，不解析中文错误文案。
- `INVALID_COMMAND`、`UNKNOWN_FIELD`、`EXPECTED_REVISION_MISMATCH` 指向 `TurnCommand`。
- 移动相关错误指向 `Cell` 和移动组合函数；目标错误指向对应攻击、施法或交互条目。
- 没有明确映射的错误只打开“回合命令”，不增加复杂推断。

## 状态与无障碍

- 加载或 Runner 不可用时，手册仍可阅读，运行按钮按现有规则禁用。
- 运行中允许查阅手册；重复运行仍被锁定。
- 胜利或失败后仍可在战场与手册之间切换复盘。
- 标签页使用 `role="tablist"`、`role="tab"`、`role="tabpanel"`，支持 `Tab`、方向键、`Enter` 和 `Space`。
- 切换视图后焦点进入对应标题；错误跳转后焦点落到目标 API 标题。
- 正文与代码对比度遵循现有主题 token；不依赖颜色表达当前项或错误映射。
- 尊重 `prefers-reduced-motion`，视图切换只使用不超过 200ms 的可中断淡入。

## 测试边界

遵循项目“正常路径和一个关键失败路径”的测试原则。

- 内容测试：Go 完整参考与 SDK 公共类型、字段和函数签名一致；六关 `referenceIds` 均存在。
- Webview 渲染测试：第一关 `revision=0` 默认显示手册；一个合法回合后显示战场；手动切换可恢复。
- 关键失败路径：无效移动指令显示“查看相关 API”，触发后聚焦移动条目。
- 视觉验收：至少检查 1280x800 左右半屏的浅色、深色，以及 720px 以下窄 Webview；手册正文可滚动、无横向溢出、操作栏始终可达。
- 阶段内只运行相关单元测试、类型检查和构建；完整六关 E2E 仅在阶段性实现完成后运行一次。

## 实现边界

- 修改共享内容类型、Go 程序参考、Go 六关提示、Webview 快照、渲染与样式。
- 为视图切换和错误跳转增加最小必要的 Webview 本地状态与消息处理。
- 不修改战斗规则、Runner 执行协议、存档格式或玩家 Go 文件。
- 不为搜索、收藏、复制按钮、历史版本或未来语言建立通用文档平台。
- 不改变本地可信代码模型，不增加限制玩家正常 Go 学习体验的防护。

## 验收标准

- 玩家在第一关不查看源码或外部资料，即可看到 `TurnCommand` 结构、完整动作函数和一段可运行的移动攻击示例。
- 第 2-6 关首次进入时明确展示本关新增的数据字段、动作函数和最小示例。
- 完整 Go SDK 在任意关卡最多两次操作可达。
- 展开手册不压缩运行反馈、不替换左侧代码文件，也不导致操作栏离开视口。
- 无效指令能够跳转到相关 API；编译错误仍优先跳转玩家代码。
- 定向测试、类型检查、构建、视觉验收和 `npm run install:local` 全部通过后，才可报告实现完成。
