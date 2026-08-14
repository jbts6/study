# Go RPG 战术手册实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Go 沼泽第 1-6 关的 VS Code Webview 中提供可查阅的战术手册，使玩家能从本关重点逐步进入完整 Go SDK，并在无效回合指令处跳转到对应 API。

**Architecture:** 在 `PlayerProgramDefinition` 上挂载语言程序自己的 `ProgramReference`，Go 程序集中定义一次完整 SDK；每个 Go 关卡只声明 `LevelApiFocus` 引用。扩展快照把程序参考与关卡重点传给 Webview，Webview 以纯渲染函数显示“战场 / 战术手册”，用 VS Code Webview state 保存本地视图和章节；`AppFeedback` 保留结构化 API 引用 ID，错误反馈只通过稳定的 `code/path` 映射导航，不解析中文错误文案。

**Tech Stack:** TypeScript 7、Vitest 4、Go SDK、VS Code Webview API、现有 CSS token 和本地 VS Code 扩展打包流程。

## Global Constraints

- 项目采用信任本地代码模型；不增加对抗恶意代码的隔离层。
- 本次只补齐 Go 第 1-6 关；Python 保留现有提示与渲染兼容，不扩张 Python 教学内容。
- 手册替换原战场主内容区；任务条、运行反馈和操作栏保持可见，反馈区不因手册变长而扩大。
- 完整 SDK 由 Go 程序定义统一提供，关卡只声明本关重点和引用项，禁止复制六份完整 SDK 文案。
- Go 参考逐字段对应 `rpg/src/runners/go/runtime/sdk.go`；不修改战斗规则、Runner 执行协议、存档格式或玩家 Go 文件。
- 手册支持“本关重点、回合命令、World 数据、动作函数、完整 SDK”五个入口；窄 Webview 下目录改为顶部横向标签。
- 第一次进入且战场 `revision === 0` 时显示本关重点；首个合法回合使 `revision` 增加并自动回到战场；编译错误、运行时错误和无效指令不切换。
- Webview 重载使用 VS Code Webview state；进入下一关时清除上一关章节并重新显示本关重点。
- 标签页使用 `role="tablist"`、`role="tab"`、`role="tabpanel"`，支持 `Tab`、方向键、`Enter` 和 `Space`；焦点切换后落到对应标题。
- 错误跳转仅处理稳定的 `code/path`；无法映射的错误打开“回合命令”，编译和运行时错误继续由现有诊断系统定位玩家代码。
- 测试覆盖正常路径和一个关键失败路径；阶段内只运行定向测试、类型检查和构建，全量测试在阶段性完成后运行一次。
- 修改 `rpg/` 中会进入扩展或 Webview 的代码后，最终验证通过必须运行 `cd rpg && npm run install:local`，然后重载 VS Code 窗口重新打开游戏页面。

---

## 文件与职责

- `rpg/src/programs/types.ts`：声明程序参考类型，并让程序定义可携带可选参考（Python 继续使用旧内容）。
- `rpg/src/programs/go/reference.ts`：唯一的完整 Go SDK 参考数据源。
- `rpg/src/programs/go/index.ts`：把 `GO_REFERENCE` 挂到 `GO_PROGRAM`。
- `rpg/src/programs/go/reference.test.ts`：验证参考 ID、公开字段、动作签名和 SDK 源码关键 token 一致。
- `rpg/src/game/content/shared/types.ts`、`rpg/src/game/content/types.ts`：声明并导出 `LevelApiFocus`。
- `rpg/src/game/content/go/go-marsh-01.ts` 至 `go-marsh-06.ts`：填写六关 `apiFocus`，不复制完整 SDK。
- `rpg/src/game/content/go/levels.ts`、`rpg/src/game/content/levels.ts`：在 Go 关卡注册时验证引用 ID；保留 Python 旧提示的兼容校验。
- `rpg/src/game/content/levels.test.ts`：覆盖六关引用存在、重点映射和示例约束。
- `rpg/src/app/app-feedback.ts`、`rpg/src/app/app-feedback.test.ts`：保留结构化相关 API ID，并实现错误 `code/path` 到参考条目的稳定映射。
- `rpg/src/vscode/messages.ts`、`rpg/src/vscode/game-session.ts`、`rpg/src/vscode/game-session.test.ts`：将 Go 程序参考投影到 Webview 快照。
- `rpg/src/vscode/webview/manual-state.ts`、`manual-state.test.ts`：实现本地视图/章节状态的默认、恢复、关卡切换和合法回合切换规则。
- `rpg/src/vscode/webview/render-game.ts`、`render-game.test.ts`：渲染视图标签、手册目录、正文、错误导航按钮和焦点目标。
- `rpg/src/vscode/webview/main.ts`：读取/写入 Webview state，处理本地标签交互、键盘操作和错误跳转；不把本地视图状态发送给扩展宿主。
- `rpg/src/vscode/webview/styles.css`：实现半屏布局、独立正文滚动、窄宽度横向目录、焦点和浅色/深色 token 适配。

---

### Task 1: 建立程序参考模型与完整 Go SDK

**Files:**

- Modify: `rpg/src/programs/types.ts`
- Create: `rpg/src/programs/go/reference.ts`
- Modify: `rpg/src/programs/go/index.ts`
- Create: `rpg/src/programs/go/reference.test.ts`

**Interfaces:**

- Consumes: `rpg/src/runners/go/runtime/sdk.go` 的现有 Go DTO 和动作构造器。
- Produces: `ProgramReference`、`ReferenceSection`、`ReferenceEntry`，以及 `GO_PROGRAM.reference`。

- [ ] **Step 1: 写参考模型的失败测试**

在 `reference.test.ts` 先导入 `GO_PROGRAM`，声明固定的参考 ID 集合并断言以下行为：

```ts
const ids = GO_PROGRAM.reference.sections.flatMap((section) => section.entries.map((entry) => entry.id));
const referenceIds = new Set(["entrypoint.choose-turn", ...ids]);

expect(GO_PROGRAM.reference.entrypoint.signature).toBe("func ChooseTurn(world World) TurnCommand");
expect(ids).toEqual([
  "type.world", "type.cell", "type.board", "type.objective", "type.status",
  "type.unit", "type.skill", "type.action", "type.turn-command",
  "action.wait", "action.attack", "action.move-and-attack", "action.guard",
  "action.cast", "action.move-and-cast", "action.interact", "action.move-and-interact",
]);
expect(GO_PROGRAM.reference.sections.map((section) => section.id)).toEqual([
  "types", "actions",
]);
expect(referenceIds.has("entrypoint.choose-turn")).toBe(true);
```

对每个类型条目断言签名包含真实字段名和 Go 类型：`World` 的 `BattleID`、`ContentVersion`、`ActiveUnitID`、`Revision`、`Round`、`Board`、`Objectives`、`Units`；`Cell` 的 `X`、`Y`；`Board` 的 `Width`、`Height`、`BlockedCells`、`HazardCells`、`CoverCells`；`Objective` 的 `ID`、`Cell`、`Durability`、`Completed`；`Status` 的 `ID`、`RemainingTurns`、`DefenseBonus`；`Unit` 的 `ID`、`Team`、`Cell`、`HP`、`MaxHP`、`Disabled`、`Statuses`、`Move`、`Attack`、`Defense`、`Skills`；`Skill` 的 `ID`、`Range`、`Power`、`RemainingCooldown`、`Target`、`Kind`；`Action` 的 `Type`、`TargetID`、`SkillID`、`TargetCell`；`TurnCommand` 的 `ActorID`、`ExpectedRevision`、`MovePath`、`Action`。

对八个动作条目断言完整签名分别为：

```text
func Wait(world World) TurnCommand
func Attack(world World, targetID string) TurnCommand
func MoveAndAttack(world World, path []Cell, targetID string) TurnCommand
func Guard(world World) TurnCommand
func Cast(world World, skillID string, targetID string) TurnCommand
func MoveAndCast(world World, path []Cell, skillID string, targetID string) TurnCommand
func Interact(world World, targetID string) TurnCommand
func MoveAndInteract(world World, path []Cell, targetID string) TurnCommand
```

最后用 `readFileSync` 读取 `sdk.go`，逐个断言上述类型名、字段名和函数签名的首行仍存在；这会让 SDK 文案漂移时测试先失败，而不是静默展示旧文档。

- [ ] **Step 2: 运行内容测试确认失败**

Run: `cd rpg && npx vitest run src/programs/go/reference.test.ts`

Expected: FAIL，`GO_PROGRAM.reference` 和参考类型尚未定义；测试失败原因必须是缺少新模型，而不是路径或测试语法错误。

- [ ] **Step 3: 添加最小参考类型**

在 `rpg/src/programs/types.ts` 添加以下类型；`reference` 保持可选，以免为不在本次范围内的 Python 内容制造六份重复参考：

```ts
export type ReferenceEntry = Readonly<{
  id: string;
  signature: string;
  description: string;
  example?: string;
}>;

export type ReferenceSection = Readonly<{
  id: string;
  title: string;
  entries: readonly ReferenceEntry[];
}>;

export type ProgramReference = Readonly<{
  entrypoint: Readonly<{ signature: string; description: string }>;
  sections: readonly ReferenceSection[];
}>;

export type PlayerProgramDefinition = Readonly<{
  language: ImplementedLanguage;
  workspaceDirectory: string;
  sourceFileName(levelId: string): string;
  runEntrypointFileName(levelId: string): string;
  editorLanguageId: string;
  createRunFiles(levelId: string, source: string): Readonly<Record<string, string>>;
  reference?: ProgramReference;
}>;
```

- [ ] **Step 4: 编写唯一的 Go SDK 参考数据**

在 `reference.ts` 导出 `GO_REFERENCE: ProgramReference`，按 `types` 和 `actions` 两个 section 排列。类型条目的 `signature` 使用真实 Go struct 字段；动作条目使用完整函数签名。每个动作必须有一句行为说明和最小示例；移动组合示例使用绝对坐标对象序列，并明确“每一步正交相邻，移动完成后再执行动作”。`MovePath` 的说明固定为“顶层 `[]Cell` 绝对坐标序列”，不能写成相对方向或嵌套整数数组。

`entrypoint` 使用：

```ts
{
  signature: "func ChooseTurn(world World) TurnCommand",
  description: "每个回合由程序返回一条 TurnCommand；world 是当前回合的只读快照。",
}
```

`reference.ts` 不读取文件、不在运行时解析 Go 源码；源码一致性只由测试锁定。

- [ ] **Step 5: 将参考挂到 Go 程序定义**

修改 `rpg/src/programs/go/index.ts`：

```ts
import { GO_REFERENCE } from "./reference";

export const GO_PROGRAM: PlayerProgramDefinition = {
  language: "go",
  workspaceDirectory: "go-rpg",
  sourceFileName: (levelId) => `${levelId}.go`,
  runEntrypointFileName: () => "strategy.go",
  editorLanguageId: "go",
  createRunFiles: (_levelId, source) => ({ "strategy.go": source }),
  reference: GO_REFERENCE,
};
```

- [ ] **Step 6: 运行测试确认参考与 SDK 对齐**

Run: `cd rpg && npx vitest run src/programs/go/reference.test.ts`

Expected: PASS，且没有未处理的 TypeScript 诊断。若失败，优先修正参考字段/签名或测试读取路径，不修改 SDK 执行行为。

- [ ] **Step 7: 提交模型阶段**

```bash
git add rpg/src/programs/types.ts rpg/src/programs/go/index.ts rpg/src/programs/go/reference.ts rpg/src/programs/go/reference.test.ts
git commit -m "feat: add Go tactical manual reference model"
```

---

### Task 2: 为 Go 六关补齐本关重点与引用校验

**Files:**

- Modify: `rpg/src/game/content/shared/types.ts`
- Modify: `rpg/src/game/content/types.ts`
- Modify: `rpg/src/game/content/go/go-marsh-01.ts`
- Modify: `rpg/src/game/content/go/go-marsh-02.ts`
- Modify: `rpg/src/game/content/go/go-marsh-03.ts`
- Modify: `rpg/src/game/content/go/go-marsh-04.ts`
- Modify: `rpg/src/game/content/go/go-marsh-05.ts`
- Modify: `rpg/src/game/content/go/go-marsh-06.ts`
- Modify: `rpg/src/game/content/go/levels.ts`
- Modify: `rpg/src/game/content/levels.ts`
- Modify: `rpg/src/game/content/levels.test.ts`

**Interfaces:**

- Consumes: `GO_PROGRAM.reference` 的固定 ID 集合。
- Produces: `LevelGuidance.apiFocus` 和 Go 关卡注册时的引用完整性校验。

- [ ] **Step 1: 写六关引用完整性失败测试**

在 `levels.test.ts` 添加测试：对 `GO_LEVEL_ORDER` 中每关断言 `apiFocus` 存在、`summary` 非空、`steps` 至少两项、`example` 非空，并将所有 `referenceIds` 与 `GO_PROGRAM.reference.sections` 展平后的 ID 集合比较。固定映射必须是：

```ts
const expected = {
  "go-marsh-01": ["entrypoint.choose-turn", "type.world", "type.turn-command", "type.cell", "action.wait", "action.attack", "action.move-and-attack"],
  "go-marsh-02": ["type.unit", "type.skill", "type.board", "action.cast", "action.move-and-cast", "action.guard"],
  "go-marsh-03": ["type.objective", "action.attack", "action.interact", "action.move-and-interact"],
  "go-marsh-04": ["type.skill", "type.objective", "action.cast", "action.move-and-cast", "action.interact"],
  "go-marsh-05": ["type.unit", "type.objective", "action.cast", "action.interact", "action.move-and-attack", "action.move-and-cast", "action.move-and-interact"],
  "go-marsh-06": ["type.world", "type.cell", "type.board", "type.objective", "type.status", "type.unit", "type.skill", "type.action", "type.turn-command", "action.wait", "action.attack", "action.move-and-attack", "action.guard", "action.cast", "action.move-and-cast", "action.interact", "action.move-and-interact"],
} as const;
```

额外断言第一关示例包含“绝对路径到 `(2, 0)` 后攻击 `golem`”，第四至第六关示例不直接提供完整通关策略。测试 Python 关卡不要求 `apiFocus`，避免扩大本次内容范围。

- [ ] **Step 2: 运行测试确认字段和映射缺失**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts`

Expected: FAIL，`LevelGuidance.apiFocus` 和 Go 关卡引用尚不存在；已有 Python 关卡测试应继续通过。

- [ ] **Step 3: 添加 LevelApiFocus 类型**

在 `shared/types.ts` 添加：

```ts
export type LevelApiFocus = Readonly<{
  summary: string;
  steps: readonly string[];
  referenceIds: readonly string[];
  example: string;
}>;

export type LevelGuidance = Readonly<{
  objective: readonly string[];
  concepts: readonly string[];
  worldFields: readonly string[];
  commandExamples: readonly string[];
  levelRules: readonly string[];
  apiFocus?: LevelApiFocus;
}>;
```

在 `content/types.ts` 重新导出 `LevelApiFocus`。

- [ ] **Step 4: 填写六关 apiFocus**

每个 Go 关卡只添加 `apiFocus` 字段，保留原有 `objective`、`concepts`、`worldFields`、`commandExamples` 和 `levelRules`。内容按已确认规格填写：

- 第 1 关说明 `ChooseTurn`、`World`、`TurnCommand`、`Cell`、等待/攻击/移动攻击，示例展示从当前格沿绝对坐标移动到 `(2, 0)` 后攻击 `golem`。
- 第 2 关解释 `Unit`、`Skill`、`Board`、生命值、危险格、冷却、自疗目标和 `Cast` / `MoveAndCast` / `Guard`。
- 第 3 关解释按 `Objective` 筛选敌人、相邻 `Interact` 以及 `MoveAndInteract`，强调 `scout-mark` 完成状态。
- 第 4 关解释 `Skill.RemainingCooldown`、`Objective.Completed`、`Cast`、`MoveAndCast`、`Interact` 和条件优先级，不给完整答案。
- 第 5 关覆盖多个敌人、节点顺序、`Unit` / `Objective`、`Cast` / `Interact` 与所有移动组合函数，强调辅助函数职责。
- 第 6 关显示完整 SDK 索引、地图/目标字段和已解锁能力，只给契约速查与战役约束，不给通关策略。

- [ ] **Step 5: 在 Go 注册时校验引用 ID**

在 `go/levels.ts` 添加纯函数 `validateGoApiFocus(levels, reference)`：收集参考条目 ID，并加入保留入口 ID `entrypoint.choose-turn`，逐关检查 `apiFocus` 存在且每个 `referenceId` 都能找到；缺失时抛出包含关卡 ID 和引用 ID 的中文错误。`GO_LEVELS` 构造完成后立即调用该校验。`validateLevels` 只增加对 `apiFocus` 结构的通用检查，不要求 Python 关卡填写该字段。

- [ ] **Step 6: 运行关卡测试确认全部映射通过**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/programs/go/reference.test.ts`

Expected: PASS；六关引用无悬空，原有 Go/Python 战役顺序、战斗数据和奖励断言不变。

- [ ] **Step 7: 提交内容阶段**

```bash
git add rpg/src/game/content/shared/types.ts rpg/src/game/content/types.ts rpg/src/game/content/go rpg/src/game/content/levels.ts rpg/src/game/content/levels.test.ts
git commit -m "feat: add Go level API focus guidance"
```

---

### Task 3: 将参考内容和错误 API 映射接入扩展快照

**Files:**

- Modify: `rpg/src/app/app-feedback.ts`
- Modify: `rpg/src/app/app-feedback.test.ts`
- Modify: `rpg/src/vscode/messages.ts`
- Modify: `rpg/src/vscode/game-session.ts`
- Modify: `rpg/src/vscode/game-session.test.ts`

**Interfaces:**

- Consumes: `CampaignDefinition.program.reference`、`LevelGuidance.apiFocus` 和战斗错误的 `code/path`。
- Produces: `GameViewSnapshot.programReference?`、`AppFeedback.relatedReferenceIds?`，以及错误反馈中的稳定导航目标。

- [ ] **Step 1: 写错误映射和快照投影的失败测试**

在 `app-feedback.test.ts` 添加四组错误：

```ts
expect(combatErrorFeedback([{ code: "INVALID_COMMAND", path: "$.action", message: "x" }]).relatedReferenceIds)
  .toEqual(["type.turn-command"]);
expect(combatErrorFeedback([{ code: "INVALID_MOVE_PATH", path: "$.movePath", message: "x" }]).relatedReferenceIds)
  .toEqual(["type.cell", "action.move-and-attack", "action.move-and-cast", "action.move-and-interact"]);
expect(combatErrorFeedback([{ code: "SKILL_ON_COOLDOWN", path: "$.action.skillId", message: "x" }]).relatedReferenceIds)
  .toEqual(["type.skill", "action.cast", "action.move-and-cast"]);
expect(combatErrorFeedback([{ code: "INTERACTION_INVALID", path: "$.action.targetId", message: "x" }]).relatedReferenceIds)
  .toEqual(["type.objective", "action.interact", "action.move-and-interact"]);
```

在 `game-session.test.ts` 的 Go 快照用例中断言 `snapshot.programReference.entrypoint.signature` 和 `snapshot.level.guidance.apiFocus.referenceIds` 已被投影。编译错误测试断言 `relatedReferenceIds` 不存在，保证代码诊断不会显示 API 跳转。

- [ ] **Step 2: 运行定向测试确认失败**

Run: `cd rpg && npx vitest run src/app/app-feedback.test.ts src/vscode/game-session.test.ts`

Expected: FAIL，反馈类型缺少 `relatedReferenceIds`，Go 快照缺少 `programReference`。

- [ ] **Step 3: 扩展 AppFeedback 并实现稳定映射**

在 `AppFeedback` 增加可选字段：

```ts
relatedReferenceIds?: readonly string[];
```

保留所有现有构造函数的输出；只有 `combatErrorFeedback` 填充该字段。使用 `BattleErrorCode` 的显式映射表，不读取 `message`：

```ts
const ERROR_REFERENCE_MAP: Partial<Record<BattleErrorCode, readonly string[]>> = {
  INVALID_COMMAND: ["type.turn-command"],
  UNKNOWN_FIELD: ["type.turn-command"],
  EXPECTED_REVISION_MISMATCH: ["type.turn-command"],
  INVALID_MOVE_PATH: ["type.cell", "action.move-and-attack", "action.move-and-cast", "action.move-and-interact"],
  MOVE_TOO_FAR: ["type.cell", "action.move-and-attack", "action.move-and-cast", "action.move-and-interact"],
  MOVE_BLOCKED: ["type.cell", "type.board", "action.move-and-attack", "action.move-and-cast", "action.move-and-interact"],
  INVALID_TARGET: ["type.unit", "action.attack", "action.cast"],
  TARGET_OUT_OF_RANGE: ["type.unit", "action.attack", "action.cast", "action.move-and-attack", "action.move-and-cast"],
  SKILL_NOT_FOUND: ["type.skill", "action.cast", "action.move-and-cast"],
  SKILL_ON_COOLDOWN: ["type.skill", "action.cast", "action.move-and-cast"],
  SKILL_TARGET_SHAPE: ["type.skill", "action.cast", "action.move-and-cast"],
  INTERACTION_INVALID: ["type.objective", "action.interact", "action.move-and-interact"],
};
```

多个错误按输入顺序合并并去重；没有明确映射时只返回 `["type.turn-command"]`。`BATTLE_COMPLETE`、`NOT_ACTIVE_ACTOR` 和 `ACTOR_DISABLED` 也使用该回合命令兜底，不新增推断。

- [ ] **Step 4: 将 Go 参考传入 GameViewSnapshot**

在 `messages.ts` 导入 `ProgramReference`，为 `GameViewSnapshot` 增加：

```ts
programReference?: ProgramReference;
```

在 `gameViewSnapshot` 中只在 `campaign.program.reference` 已定义时展开该字段；Python 快照保持现有形状。`level.guidance.apiFocus` 随 `LevelDefinition` 一并传递，不在 Webview 重新查找关卡或读取 SDK 文件。

- [ ] **Step 5: 运行快照与反馈测试确认通过**

Run: `cd rpg && npx vitest run src/app/app-feedback.test.ts src/vscode/game-session.test.ts`

Expected: PASS；编译/运行时诊断仍只更新编辑器诊断，战斗无效指令才携带导航 ID。

- [ ] **Step 6: 提交快照阶段**

```bash
git add rpg/src/app/app-feedback.ts rpg/src/app/app-feedback.test.ts rpg/src/vscode/messages.ts rpg/src/vscode/game-session.ts rpg/src/vscode/game-session.test.ts
git commit -m "feat: expose tactical references in game snapshots"
```

---

### Task 4: 实现 Webview 本地视图状态与手册渲染

**Files:**

- Create: `rpg/src/vscode/webview/manual-state.ts`
- Create: `rpg/src/vscode/webview/manual-state.test.ts`
- Modify: `rpg/src/vscode/webview/render-game.ts`
- Modify: `rpg/src/vscode/webview/render-game.test.ts`
- Modify: `rpg/src/vscode/webview/main.ts`

**Interfaces:**

- Consumes: `GameViewSnapshot.programReference?`、`level.guidance.apiFocus?`、`feedback.relatedReferenceIds?`。
- Produces: `ManualViewState`、纯状态迁移函数、五段 Webview 结构、可键盘操作的视图/章节标签和 API 聚焦目标。

- [ ] **Step 1: 写状态迁移失败测试**

在 `manual-state.test.ts` 覆盖以下纯行为：

```ts
const first = { levelId: "go-marsh-01", revision: 0, hasReference: true } as const;
expect(resolveManualView(undefined, first, undefined)).toEqual({ view: "manual", sectionId: "focus" });
expect(resolveManualView(undefined, { ...first, revision: 2 }, undefined)).toEqual({ view: "battle", sectionId: "focus" });
expect(resolveManualView({ view: "manual", sectionId: "world" }, { ...first, revision: 0 }, undefined))
  .toEqual({ view: "manual", sectionId: "world" });
expect(resolveManualView({ view: "manual", sectionId: "world" }, { ...first, revision: 1 }, { previousRevision: 0 }))
  .toEqual({ view: "battle", sectionId: "world" });
expect(resolveManualView({ view: "manual", sectionId: "world" }, { levelId: "go-marsh-02", revision: 0, hasReference: true }, undefined))
  .toEqual({ view: "manual", sectionId: "focus" });
expect(resolveManualView({ view: "manual", sectionId: "world" }, { ...first, revision: 0, hasReference: true }, { persistedLevelId: first.levelId }))
  .toEqual({ view: "manual", sectionId: "world" });
```

再添加错误导航行为：`resolveReferenceSection("action.move-and-attack")` 返回 `actions`，未知 ID 返回 `turn-command`；`go-marsh-01` 以外的关卡切换始终回到 `focus`。

- [ ] **Step 2: 运行状态测试确认失败**

Run: `cd rpg && npx vitest run src/vscode/webview/manual-state.test.ts`

Expected: FAIL，状态模块尚不存在。

- [ ] **Step 3: 添加最小状态模型**

在 `manual-state.ts` 定义：

```ts
export type ManualSectionId = "focus" | "turn-command" | "world" | "actions" | "sdk";
export type ManualView = "battle" | "manual";
export type ManualViewState = Readonly<{ view: ManualView; sectionId: ManualSectionId }>;
export type PersistedManualState = Readonly<{ levelId: string; view: ManualView; sectionId: ManualSectionId }>;
export type ManualSnapshotInfo = Readonly<{ levelId: string; revision: number; hasReference: boolean }>;
export type ManualTransitionContext = Readonly<{ previousRevision?: number; persistedLevelId?: string }>;
```

实现 `resolveManualView(previous: ManualViewState | undefined, snapshot: ManualSnapshotInfo, context?: ManualTransitionContext)`：同关卡且 `revision` 增长时返回战场；新关卡或无持久化状态且 `revision === 0` 时返回“本关重点”；无参考的 Python 快照始终返回战场；编译/运行时/无效指令因 revision 不变而保留当前选择。实现 `sectionForReferenceId`，按 ID 前缀将 `type.*` 映射到对应章节，`action.*` 映射到 `actions`，`entrypoint.choose-turn` 映射到 `turn-command`。

- [ ] **Step 4: 运行状态测试确认通过**

Run: `cd rpg && npx vitest run src/vscode/webview/manual-state.test.ts`

Expected: PASS，所有默认、恢复、合法回合和换关行为由纯函数覆盖。

- [ ] **Step 5: 写 Renderer 的失败测试**

在 `render-game.test.ts` 增加 Go 快照夹具和以下断言：

```ts
renderGame(root, goSnapshot, { view: "manual", sectionId: "focus" });
expect(root.children).toHaveLength(5);
expect(root.querySelector("[role='tablist'][data-view-tabs]")).not.toBeNull();
expect(root.querySelector("[role='tabpanel'][data-view='manual']")).not.toBeNull();
expect(root.querySelector("[role='tab'][aria-selected='true']")?.textContent).toContain("本关重点");
expect(root.textContent).toContain("MoveAndAttack");
expect(root.textContent).toContain("func ChooseTurn(world World) TurnCommand");
expect(root.querySelector("[data-reference-id='action.move-and-attack']")).not.toBeNull();
```

再用带 `relatedReferenceIds: ["action.move-and-attack"]` 的错误反馈断言反馈区存在“查看相关 API”本地按钮，且按钮携带稳定引用 ID；编译错误反馈不出现该按钮。现有 Python 五段布局测试必须保留并改为断言没有 Go 手册入口。

- [ ] **Step 6: 运行 Renderer 测试确认失败**

Run: `cd rpg && npx vitest run src/vscode/webview/render-game.test.ts`

Expected: FAIL，当前渲染器没有 `programReference`、视图标签或手册面板。

- [ ] **Step 7: 实现五段渲染结构和手册内容**

将 `renderGame` 改为接收 `ManualViewState`，根节点仍渲染五个子节点：header、mission、主内容、feedback、actions。主内容根据 `view` 渲染现有 `battle-stage` 或新的 `manual-stage`；不要把手册塞回反馈区。

`manual-stage` 必须包含：

1. `role="tablist" data-view-tabs`，两个标签 `data-view="battle|manual"`，带 `aria-selected`、`aria-controls` 和可见焦点。
2. 手册内 `role="tablist" data-manual-tabs`，五个标签 ID 固定为 `focus`、`turn-command`、`world`、`actions`、`sdk`。
3. `role="tabpanel"` 正文；“本关重点”展示 `apiFocus.summary`、`steps`、`example` 和对应 `referenceIds`；其余章节按 `ProgramReference.sections` 展示签名、说明和示例；完整 SDK 章节合并入口、全部类型和动作，不复制数据。
4. 每个参考条目带 `id="manual-entry-<referenceId>"` 和 `data-reference-id`，供错误导航定位；标题使用 `tabindex="-1"`，聚焦后不改变文档布局。

反馈区在 `relatedReferenceIds` 非空时增加 `data-local-command="openManualReference"` 的按钮，显示“查看相关 API”；按钮不使用错误中文文案推断目标。

- [ ] **Step 8: 接入 Webview state、点击和键盘事件**

在 `main.ts` 扩展 `VsCodeApi`：

```ts
type VsCodeApi = Readonly<{
  postMessage(message: WebviewCommand): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}>;
```

维护 `previousSnapshot`、`manualViewState` 和 `persistedState`。收到快照时调用 `resolveManualView`，再调用 `renderGame`；每次本地切换都调用 `setState({ levelId, view, sectionId })`。处理：

- 视图标签点击：切换战场/手册，标题获得焦点。
- 章节标签点击：更新章节，正文标题获得焦点。
- `ArrowLeft` / `ArrowRight`（窄屏）和 `ArrowUp` / `ArrowDown`（桌面）在当前 tablist 内循环，`Enter` / `Space` 激活当前标签。
- “查看相关 API”：取第一个稳定 `relatedReferenceId`，打开手册并聚焦对应条目；无参考 ID 时打开 `turn-command`。

现有宿主命令（运行、中断、重试、进入下一关、主题）继续走 `vscode.postMessage`，本地视图命令不得加入 `WebviewCommand` 或扩展消息协议。

- [ ] **Step 9: 运行 Webview 定向测试确认通过**

Run: `cd rpg && npx vitest run src/vscode/webview/manual-state.test.ts src/vscode/webview/render-game.test.ts`

Expected: PASS；Python 旧布局不回归，Go revision 0 手册内容可见，完整 SDK 与错误按钮可定位。

- [ ] **Step 10: 提交 Webview 行为阶段**

```bash
git add rpg/src/vscode/webview/manual-state.ts rpg/src/vscode/webview/manual-state.test.ts rpg/src/vscode/webview/render-game.ts rpg/src/vscode/webview/render-game.test.ts rpg/src/vscode/webview/main.ts
git commit -m "feat: add Go tactical manual Webview"
```

---

### Task 5: 完成响应式样式、焦点状态和视觉验收

**Files:**

- Modify: `rpg/src/vscode/webview/styles.css`

**Interfaces:**

- Consumes: Task 4 的 `.manual-stage`、`.manual-nav`、`.manual-content`、`.view-tabs`、`.manual-tabs`、`.manual-entry` 和本地按钮 class。
- Produces: 桌面半屏、深浅主题和 720px 以下窄 Webview 下均可读、可滚动、无横向溢出的手册布局。

- [ ] **Step 1: 写样式验收清单并确认现有 CSS 基线**

保留 `.game-view` 的五行 grid 和 `.feedback-panel { max-height: min(30vh, 250px); overflow: auto; }`，新增样式不得改变反馈区高度。检查新选择器使用现有 `--game-bg`、`--game-surface`、`--game-muted`、`--game-accent`、`--game-border`、`--game-danger` 和编辑器字体 token。

- [ ] **Step 2: 添加手册布局样式**

桌面宽度使用两列 `minmax(150px, 0.28fr) minmax(0, 1fr)`；`.manual-content` 设置 `min-width: 0; overflow: auto;`；代码示例使用 `white-space: pre-wrap; overflow-wrap: anywhere;`。视图/章节标签提供 `aria-selected` 对应的非颜色状态（边框、字重或下划线）和 `:focus-visible`。

- [ ] **Step 3: 添加窄屏规则**

在 `@media (max-width: 720px)` 中把手册目录改为单行可滚动横向标签，正文恢复单列；`manual-stage`、正文和操作栏不得产生页面横向滚动。标签文本使用 `white-space: nowrap`，正文长签名允许换行。

- [ ] **Step 4: 添加动效与高对比兼容**

只为主内容淡入提供不超过 200ms 的可中断 transition；在 `prefers-reduced-motion: reduce` 下关闭 transition。保留现有主题 token，禁止用颜色作为唯一选中/错误提示。

- [ ] **Step 5: 运行类型检查和 Webview 测试**

Run: `cd rpg && npm run typecheck && npx vitest run src/vscode/webview/render-game.test.ts`

Expected: PASS；无未使用变量、无 CSS 导入错误，反馈区仍保持原高度限制。

- [ ] **Step 6: 进行三视口视觉验收**

按交接要求启动：

```bash
cd rpg
npm run runner
npm run dev
```

检查 `http://127.0.0.1:5174` 的 1280x800 左半屏浅色、深色，以及 720px 以下窄 Webview：第 1 关 revision 0 默认“本关重点”；正文可独立滚动；操作栏始终可达；切换到完整 SDK 后无横向溢出；方向键/Enter/Space 可操作；错误跳转后标题获得焦点。关闭开发进程后再继续构建验证。

- [ ] **Step 7: 提交视觉阶段**

```bash
git add rpg/src/vscode/webview/styles.css
git commit -m "style: make Go tactical manual responsive"
```

---

### Task 6: 阶段性回归、构建和扩展安装

**Files:**

- Verify only: all files from Tasks 1-5
- Generated output: `rpg/dist/python-rpg.vsix` (do not hand-edit or commit generated package unless repository policy requires it)

**Interfaces:**

- Consumes: 已完成的 Go 参考、六关重点、快照字段、Webview 状态和样式。
- Produces: 可安装的 VS Code 扩展，以及完整测试/构建证据。

- [ ] **Step 1: 运行阶段定向测试**

```bash
cd rpg
npx vitest run src/programs/go/reference.test.ts src/game/content/levels.test.ts src/app/app-feedback.test.ts src/vscode/game-session.test.ts src/vscode/webview/manual-state.test.ts src/vscode/webview/render-game.test.ts
```

Expected: PASS。

- [ ] **Step 2: 运行类型检查和生产构建**

```bash
cd rpg
npm run typecheck
npm run build
```

Expected: 两条命令均退出码 0；构建生成 Webview 和扩展 bundle。

- [ ] **Step 3: 运行一次全量测试和必要的战役回归**

```bash
cd rpg
npm test
npm run test:e2e
```

Expected: 全量 Vitest 和已有 E2E 通过；不新增重复的 Runner 生命周期矩阵。若 E2E 依赖本机服务，先按项目现有脚本启动服务并记录实际失败原因，不把环境缺失伪装成代码通过。

- [ ] **Step 4: 安装本地扩展并重载 VS Code**

```bash
cd rpg
npm run install:local
```

Expected: `dist/python-rpg.vsix` 打包成功，`code --install-extension ... --force` 返回成功。重载 VS Code 窗口，重新打开 Go 沼泽战役，手动检查首关默认手册、合法回合返回战场、下一关重新显示重点和错误 API 聚焦。

- [ ] **Step 5: 检查工作区并精确提交剩余变更**

```bash
git status --short
git diff --check
```

只暂存本任务文件；保留交接文档指出的 `.helloagents/sessions/active.json`、`.helloagents/sessions/master/default/runtime.json` 和未跟踪 `go-rpg/`，不得回退或混入提交。若仍有本任务未提交的源文件，使用：

```bash
git add rpg/src docs/superpowers/plans/2026-08-14-go-rpg-tactical-manual.md
git commit -m "feat: complete Go tactical manual"
```

---

## Plan Self-Review

- 规格覆盖：内容模型和 SDK 一致性对应 Task 1；六关重点和引用完整性对应 Task 2；快照和错误导航对应 Task 3；默认/恢复/合法回合切换与键盘无障碍对应 Task 4；响应式和视觉验收对应 Task 5；类型检查、构建、全量测试和 `npm run install:local` 对应 Task 6。
- 范围检查：没有修改战斗规则、Runner 协议、存档格式或 Python 关卡内容；没有加入搜索、收藏、复制、历史版本或通用文档平台。
- 类型一致性：`ProgramReference` 由程序定义提供，`GameViewSnapshot.programReference?` 与 Python 兼容；`LevelGuidance.apiFocus?` 由 Go 注册校验强制，Webview 对旧 Python 数据保留战场/旧提示回退。
- 错误边界：仅 `combatErrorFeedback` 生成相关参考 ID；编译和运行时错误保持现有诊断优先级；未映射战斗错误只打开 `type.turn-command`。
- 步骤完整性：每个修改阶段都有失败测试、最小实现、定向验证和提交命令，没有未完成或依赖后续补写的步骤。
