# Go RPG 第二至第六关设计

**状态：** 已确认  
**日期：** 2026-08-14

## 摘要

在现有 Go 第一关垂直切片之上补齐第二至第六关，使 `go-rpg` 成为可从第一关连续推进到战役结算的本地六关战役。

五个新关卡复用对应 Python 关卡已经验证的战斗目标、地图布局、敌人行为、回合限制和奖励节奏，但分别提供独立的 Go 关卡定义、教学文本、起始代码和参考策略。Go 内容不得导入 Python 关卡文件，以便两种语言的教学内容以后独立演进。

## 目标

- 注册 `go-marsh-02` 至 `go-marsh-06`。
- Go 第一关胜利后可以依次推进到第六关。
- Go 第六关胜利后显示战役完成，不进入其他语言战役。
- 教学从基础条件判断递进到切片遍历、组合决策、函数拆分和综合策略。
- 每关有结构化提示、可运行起始代码和可通关的参考策略。
- Go SDK 对齐现有 `WorldView` 和 `TurnCommand` JSON 协议，使玩家能够读取六关所需字段并构造六关实际需要的单位目标动作。
- 保持现有本地 Go 执行器、工作区、存档格式和 Webview 界面不变。

## 非目标

- 不新增或修改 Python 六关玩法。
- 不开发 Rust 战役。
- 不修改 TypeScript `WorldView`、`TurnCommand` 或战斗结算协议；Go SDK 只补齐六关所需的现有 JSON 字段和单位目标动作构造器。
- 不新增 UI 页面、控件或视觉样式。
- 不为恶意本地代码建立安全隔离；项目继续采用信任本地代码模型。
- 不增加多人、联网、遥测、跨版本存档迁移或其他六关主流程之外的能力。

## 设计决策

### 1. 战斗内容对齐，教学内容独立

每个 Go 关卡复制对应 Python 关卡的语言无关战斗参数，并把 `battleId` 改为 Go 关卡 ID。Go 文件不导入 Python 关卡定义，也不复用 Python 起始代码或教学文本。

这样可以复用现有战斗平衡和参考解法结构，同时保持语言战役目录边界清晰。战斗内容以后需要分化时，可以只修改对应语言的关卡文件。

### 2. 按所属战役解析下一关

当前 `getNextLevelId()` 只读取 Python 关卡顺序。新增 Go 后，它必须在每个已注册战役的 `levelOrder` 中查找当前关卡，并只返回同一战役的下一关。

必须保持以下结果：

- `python-marsh-06` 的下一关是 `undefined`。
- `go-marsh-01` 的下一关是 `go-marsh-02`。
- `go-marsh-06` 的下一关是 `undefined`。
- 未注册关卡不产生跨战役跳转。

`AppController.advanceLevel()` 继续使用现有公共接口，不增加语言分支。

### 3. 保持现有奖励节奏

Go 战役沿用 Python 战役的能力奖励顺序：

| 关卡 | 奖励 |
|---|---|
| 第一关 | `ward` |
| 第二关 | `pierce` |
| 第三关 | `renew` |
| 第四关 | `fracture` |
| 第五关 | `aegis` |
| 第六关 | `campaign-complete` |

每关的起始战斗通过现有能力注入流程获得此前关卡已经解锁的能力。关卡文件不手工复制存档状态。

现有 `LEVEL_UNLOCKS` 只登记 Python 关卡。实现时必须为 `go-marsh-01` 至 `go-marsh-06` 登记同一奖励序列，并在 `ability-catalog.test.ts` 验证 Go 每关获得的既有能力集合。这里不重构奖励系统，也不从关卡注册表动态推导能力。

### 4. Go SDK 对齐现有战斗协议

当前 Runner 已把完整 `WorldView` JSON 写入 Go 进程标准输入，但 `sdk.go` 只声明了单位 ID、位置和技能范围，并且只提供等待、攻击和移动攻击三个构造器。第二至第六关需要的字段已经存在于 JSON 中，不需要修改 TypeScript 协议。

Go SDK 补齐以下只读 DTO：

- `World`：战斗 ID、内容版本、回合、棋盘、目标和单位。
- `Board`：尺寸、阻挡格、危险格和掩体格。
- `Objective`：ID、位置、耐久和完成状态。
- `Unit`：阵营、生命值、禁用状态、属性、状态和技能。
- `Skill`：威力、剩余冷却、目标类型和效果类型。
- `Status`：持续回合和防御加成。

Go SDK 补齐以下六关实际需要的动作构造器：

- `Guard(world)`
- `Cast(world, skillID, targetID)`
- `MoveAndCast(world, path, skillID, targetID)`
- `Interact(world, targetID)`
- `MoveAndInteract(world, path, targetID)`

现有 `Wait`、`Attack` 和 `MoveAndAttack` 保持兼容。`Action` 补齐现有 JSON 的技能和目标格字段；`TargetCell` 必须声明为 `*Cell` 并使用 `omitempty`，避免单位目标动作序列化出零值目标格。六关能力均为单位目标，因此本次不新增格子目标施法构造器。

修改 SDK 后必须提升 `go-project.ts` 中的 `SDK_VERSION`，确保已经缓存的第一关策略二进制不会继续绑定旧 DTO。

## 关卡设计

### 第二关：毒沼岔路

**战斗目标：** 保护 `relay`，并在 8 回合内消灭 `corruptor`。

**Go 教学重点：**

- 读取 `World` 和单位结构体字段。
- 使用 `if` 组合生命值、距离和危险格判断。
- 在攻击、移动、自疗和防御之间选择一个回合指令。

起始代码提供完整 `ChooseTurn` 函数和最小条件分支骨架。提示保留必要的命令构造器速查，不直接给出完整答案。

### 第三关：勘测印记

**战斗目标：** 激活 `scout-mark` 后，再消灭最后一名敌人。

**Go 教学重点：**

- 使用 `for _, unit := range world.Units` 遍历切片，并通过 `unit.Team == "enemies"` 筛选敌人。
- 根据生命值、距离或单位 ID 选择优先目标。
- 在清敌前检查并完成关键目标。

起始代码提供遍历位置和目标变量，但不写出完整筛选规则。

### 第四关：双重封锁

**战斗目标：** 保护 `relay`，激活 `seal`，并在 12 回合内消灭 `corruptor` 和 `guard`。

**Go 教学重点：**

- 组合多个布尔条件。
- 检查技能冷却和目标护甲。
- 在 `pierce`、`renew`、普通攻击和防御之间排序。

提示说明决策因素和能力用途，不给出固定的整段决策树。

### 第五关：裂隙节点

**战斗目标：** 保护 `relay`，激活 `node-a` 与 `node-b`，并在 14 回合内消灭 `hunter` 和 `guard`。

**Go 教学重点：**

- 把目标查找、技能可用性和战斗选择拆成辅助函数。
- 按节点与敌人状态组织阶段化策略。
- 让 `ChooseTurn` 只负责组合清晰的小决策。

起始代码提供辅助函数签名示例，不提供关卡专用参考实现。

### 第六关：沼心封印

**战斗目标：** 保护 `relay`，消灭三类敌人并激活 `final-seal`，在 18 回合内完成战役。

**Go 教学重点：**

- 综合使用结构体字段、切片遍历、辅助函数和能力优先级。
- 独立组织完整战术程序。

最终关只保留 `World` 字段、命令构造器、能力和关卡约束速查。不得提供接近答案的操作步骤或预制决策树。

## 文件结构

新增文件：

- `rpg/src/game/content/go/go-marsh-02.ts`
- `rpg/src/game/content/go/go-marsh-03.ts`
- `rpg/src/game/content/go/go-marsh-04.ts`
- `rpg/src/game/content/go/go-marsh-05.ts`
- `rpg/src/game/content/go/go-marsh-06.ts`

修改文件：

- `rpg/src/game/content/go/levels.ts`：注册 Go 六关、固定顺序和奖励。
- `rpg/src/game/content/levels.ts`：按所属战役解析下一关。
- `rpg/src/game/content/ability-catalog.ts`：登记 Go 六关进入关卡前已经获得的能力。
- `rpg/src/game/content/ability-catalog.test.ts`：覆盖 Go 能力注入顺序。
- `rpg/src/runners/go/runtime/sdk.go`：对齐现有世界视图 DTO 和动作构造器。
- `rpg/src/runners/go/go-project.ts`：提升 SDK 缓存版本。
- `rpg/src/runners/go/go-runner.test.ts`：覆盖完整世界字段解码和新增动作构造器。
- `rpg/src/runners/go/go-project.test.ts`：覆盖 SDK 版本变化导致的构建缓存键变化。
- `rpg/src/game/content/levels.test.ts`：覆盖注册、顺序、教学递进和战役隔离。
- `rpg/src/game/content/reference-solutions.test.ts`：覆盖 Go 六关可通关性。
- `rpg/src/app/app-controller.test.ts`：覆盖 Go 第一关推进和终关结算。

实现阶段可在不改变 TypeScript 公共接口的前提下提取关卡文件内部的小型构造函数。不得建立跨语言关卡继承层或通用关卡 DSL。

## 数据流

1. VS Code 扩展以 `go-rpg` 创建独立工作区和存档。
2. 控制器从 `GO_RPG_CAMPAIGN.levelOrder[0]` 启动 `go-marsh-01`。
3. 玩家编辑当前关卡对应的 `.go` 文件并运行 `ChooseTurn(world World)`。
4. Go 本地执行器返回现有 JSON `TurnCommand`。
5. 战斗内核应用指令、敌人行为和目标状态。
6. 胜利结算调用 `getNextLevelId(currentLevelId)`。
7. 若同一战役存在下一关，则建立下一关存档和起始代码；否则显示战役完成。

## 错误处理

本功能不引入新的运行时错误类别。继续使用现有处理：

- Go 语法或编译错误映射回玩家关卡文件和行列。
- 运行时错误、超时和中断显示现有 Runner 诊断。
- 不符合关卡规则的指令在推进战斗前被拒绝。
- 目标未完成时不能领取奖励或进入下一关。
- 存档损坏沿用当前重置流程。

关卡注册校验必须拒绝重复 ID、无效单位引用、无效目标引用和未注册能力。

## 验证策略

遵循垂直切片的红—绿—重构循环，并减少重复测试：

1. 在 `levels.test.ts` 中验证 Go 六关顺序、奖励、模板契约和关键教学递进。
2. 在 `ability-catalog.test.ts` 验证 Go 第二至第六关按顺序获得此前奖励。
3. 在 `levels.test.ts` 中规范化 `battleId` 和 `contentVersion` 后，逐字段比较 Go/Python 第二至第六关的战斗状态和敌人行为。
4. 在 `reference-solutions.test.ts` 中复用现有战斗模拟器，证明 Go 六关都有可完成策略。
5. 在 `app-controller.test.ts` 中验证一个关键推进路径和终关不再推进。
6. 在 `go-runner.test.ts` 增加一个代表性真实工具链用例，同时用表驱动方式编译当前 Go 战役所有起始代码；不为五关重复 Runner 生命周期测试。
7. 在 `go-project.test.ts` 验证 SDK 版本变化会产生新的构建缓存键。
8. 阶段完成后运行目标测试、TypeScript 构建和扩展测试；最终阶段才运行项目全量测试与 E2E。
9. 所有验证通过后，在 `rpg/` 执行 `npm run install:local`，替换本机已安装扩展。

## 完成定义

- Go 战役注册六个且仅六个关卡，顺序固定。
- 五个新增关卡拥有独立 Go 教学内容和合法战斗引用。
- Go SDK 可以读取生命值、阵营、棋盘、目标、冷却和状态，并能构造六关所需的守卫、单位目标施法和交互指令；测试断言具体解码值和输出 JSON。
- SDK 缓存版本已经提升，旧编译产物不会掩盖 SDK 变化。
- Go 第二至第六关依次获得 `ward`、`pierce`、`renew`、`fracture` 和 `aegis`，且不会重复注入。
- `go-marsh-01` 可推进至 `go-marsh-02`，`go-marsh-06` 不再推进。
- Go 六关参考策略均以 `won` 结束；第六关保持 `relay` 耐久大于 0、`final-seal` 已完成、全部敌人失能。
- Python 六关顺序、奖励、模板和结算保持不变。
- 目标测试、构建、扩展测试和最终 E2E 通过。
- `npm run install:local` 成功完成，生成并安装最新 VSIX。
