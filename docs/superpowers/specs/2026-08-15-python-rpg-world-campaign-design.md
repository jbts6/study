# Python RPG 世界战役重构设计

## 结论

当前六关战斗切片不足以构成 Python 学习型 RPG。项目改为“剧情探索型、章节式区域、Python 作为世界交互语言”的 RPG：六个章节区域承载剧情和任务，战斗成为章节中的关键事件；Python 同时用于调查、解谜、操作机关、处理任务数据和准备战斗。

采用渐进式 RPG 化路线，保留现有本地 Python Runner、确定性战斗内核和 VS Code 编辑体验。第一阶段只实现第一章完整垂直切片，验证探索、任务、Python 交互、战斗、奖励和存档闭环，再扩展到六章。

协议采用增量双协议：探索新增独立的世界指令协议，战斗继续使用现有 `TurnCommand`、`validateTurnCommand` 和 `resolveTurn`。两套协议共用本地 Runner 的请求/响应外壳，但不共用规则类型和归约器。

## 目标

- 覆盖 Python 初学者完整基础：变量、基本类型、字符串、列表、字典、条件、循环、函数和异常处理。
- 让每个知识点在多个任务中重复出现，并逐步减少脚手架，避免玩家只背一次性答案。
- 以六个章节区域承载剧情、NPC、主线、支线、编程任务和关键战斗。
- 让 Python 使用普通数据结构和函数返回值，代码能力可迁移到游戏之外。
- 在基础教学完成后，为实用脚本和数据处理入门预留章节 5-6 的内容方向。
- 继续支持本地运行、可读错误、失败后重试和刷新恢复。

## 非目标

- 不把六关简单扩写成六张战斗地图。
- 不在第一阶段加入队伍 AI、装备系统、开放世界寻路、复杂对话树或通用脚本 DSL。
- 不让玩家直接返回任意剧情标记、任务完成标记或奖励。
- 不把 Python Runner 改造成远程服务或对抗恶意代码的安全边界；项目继续采用信任本地代码模型。
- 不建设随机地图生成器或大型内容编辑器。

## 核心流程

```text
进入地点
  -> 查看 NPC、对象、物品和任务
  -> 编写并运行 Python
  -> 返回一个候选世界指令
  -> 用权威 GameState 和内容定义验证并应用指令
  -> 更新任务、线索、物品或剧情标记
  -> 必要时触发战斗
  -> 战斗继续使用现有战斗协议
  -> 战斗结束后结算奖励并回到世界状态
  -> 达成章节条件后解锁下一章
```

每次 Python 运行只处理一个当前任务并返回一个指令。探索规则验证成功后才推进世界状态；战斗仍由现有战斗规则处理。运行错误、格式错误和非法指令都不改变世界状态。

## 状态架构

`BattleState` 继续只代表一次战斗。新增 `GameState` 作为世界进度的唯一权威源，UI 快照和 Python 视图都从它派生：

```ts
type ActiveBattle = {
  encounterId: string;
  state: BattleState;
};

type GameState = {
  campaignId: string;
  chapterId: string;
  locationId: string;
  revision: number;
  worldFlags: Record<string, boolean | number | string>;
  inventory: readonly ItemState[];
  quests: readonly QuestState[];
  discoveredClues: readonly string[];
  battle: ActiveBattle | null;
};

type ItemState = {
  id: string;
  amount: number;
};

type QuestState = {
  id: string;
  status: "locked" | "active" | "completed";
  stepId: string;
};
```

代码文本不是世界规则状态：VS Code 工作区中的 Python 文件是代码的权威源；需要本地回退存档时，代码草稿由适配器单独保存，不塞进 `GameState`。

规则层拆成以下纯模块：

```text
campaign-world-view.ts
  GameState + 内容定义 -> Python 可读的 CampaignWorldView

validate-world-command.ts
  GameState + 内容定义 + WorldCommand -> 合法或错误

reduce-world.ts
  GameState + 已验证 WorldCommand -> 新 GameState

settle-encounter.ts
  GameState + 已结束 BattleState + EncounterDefinition -> 新 GameState
```

战斗模块保留现有战斗 `WorldView` 类型；为避免与探索视图混淆，本文将其称为 `BattleWorldView`。探索和战斗不复制对方的规则；战斗结束后只通过 `settle-encounter.ts` 把结果写回世界状态。

### 内容定义与权威边界

静态内容与玩家进度分离，第一阶段只需要以下定义：

```ts
type ChapterDefinition = {
  id: string;
  startLocationId: string;
  locationIds: readonly string[];
  encounterId: string;
};

type LocationDefinition = {
  id: string;
  connectedLocationIds: readonly string[];
  npcIds: readonly string[];
  objectIds: readonly string[];
  itemSourceIds: readonly string[];
};

type EncounterDefinition = {
  id: string;
  battleId: string;
  initialBattle: BattleState;
  prerequisiteFlags: Readonly<Record<string, boolean | number | string>>;
};

type CampaignWorldView = {
  revision: number;
  location: { id: string; name: string; weather?: string };
  npcs: readonly Record<string, string>[];
  objects: readonly Record<string, unknown>[];
  inventory: readonly ItemState[];
  quests: readonly QuestState[];
  availableTravel: readonly string[];
};
```

`GameState` 只保存 ID、计数和状态；目标是否可见、地点是否相连、材料是否足够、奖励是多少，都由内容定义和规则层决定。验证器不得信任 Python 返回的 `CampaignWorldView`，必须重新读取权威 `GameState`。

## 探索 Python 交互契约

玩家读取普通字典、列表和字符串，不需要先学习游戏专用类。字段使用现有项目的 camelCase JSON 约定：

```python
world = {
    "revision": 3,
    "location": {"id": "rust-marsh-camp", "name": "锈沼营地", "weather": "acid_rain"},
    "npcs": [{"id": "toma", "name": "托玛", "role": "engineer", "mood": "worried"}],
    "objects": [{"id": "relay", "type": "machine", "status": "damaged", "requiredItems": ["copper_wire"]}],
    "inventory": [{"id": "copper_wire", "amount": 3}],
    "quests": [{"id": "repair_relay", "status": "active", "stepId": "collect_wire"}],
    "availableTravel": ["old_foundry"],
}
```

探索代码入口与战斗代码入口分开，但仍使用同一个 Runner 外壳：

```python
# 探索阶段
def choose_world_action(world):
    return {"expectedRevision": world["revision"], "type": "inspect", "targetId": "relay"}

# 战斗阶段，继续使用现有入口和 TurnCommand
def choose_turn(world):
    return {"actorId": "apprentice", "expectedRevision": 2, "action": "strike"}
```

首版世界指令：

```ts
type WorldCommand =
  | { expectedRevision: number; type: "inspect"; targetId: string }
  | { expectedRevision: number; type: "talk"; targetId: string }
  | { expectedRevision: number; type: "collect"; targetId: string }
  | { expectedRevision: number; type: "use"; itemId: string; targetId: string }
  | { expectedRevision: number; type: "travel"; locationId: string }
  | { expectedRevision: number; type: "prepareBattle"; encounterId: string };
```

命令字段、枚举值和必填键必须做精确校验；未知键可以拒绝。游戏不接受玩家直接设置任务完成、剧情标记或奖励的指令。

### 世界指令规则

| 指令 | 前置条件 | 效果与重复行为 |
|---|---|---|
| `inspect` | 目标属于当前地点且可见 | 记录线索或观察标记；重复调查不重复发放奖励 |
| `talk` | NPC 属于当前地点 | 根据当前任务状态推进对话或任务步骤；重复对话不重复发放奖励 |
| `collect` | 材料来源属于当前地点且仍可收集 | 增加指定数量并标记来源已收集；再次收集返回任务层错误 |
| `use` | 背包数量足够，目标属于当前地点且规则允许使用 | 原子地消耗 1 个物品并更新机关、任务或标记；失败时两者都不变 |
| `travel` | 目标在地点连接图中、已解锁且没有进行中的战斗 | 更新 `locationId`；地点不相连或未解锁返回任务层错误 |
| `prepareBattle` | 遭遇存在、前置标记满足且没有进行中的战斗 | 创建 `{ encounterId, state }`；不得直接传入任意 `BattleState` |

每条被接受的世界指令将 `GameState.revision` 递增一次；被拒绝的指令不改变任何世界字段。`expectedRevision` 不匹配时统一返回“状态已更新，请重新运行代码”，防止旧运行结果覆盖新状态。

## 战斗边界与遭遇身份

战斗阶段继续使用现有 `BattleWorldView`、`TurnCommand`、`validateTurnCommand` 和 `resolveTurn`，不为世界战役另建一套战斗规则。战斗的 `BattleState.revision` 与世界 `GameState.revision` 分开维护。

`prepareBattle` 只接受内容注册表中的 `EncounterDefinition`。遭遇 ID 和战斗 ID 独立，例如 `marsh_guardian` 可以映射到唯一的 `python-world-ch1-marsh-guardian`。不能再要求 `battleId === chapterId`；该等式只保留为旧 V2 存档校验规则。

当 `resolveTurn` 产出终局结果时，`settleEncounter` 根据遭遇定义原子地处理胜负：胜利发放定义内奖励、更新任务和标记、清空进行中战斗；失败保留代码草稿并按定义重新生成同一遭遇，允许玩家重试。终局战斗必须在结算完成后写入 V3 存档；普通战斗回合可以按现有策略保存中间 `BattleState`。

## Runner 与文件契约

第一阶段不新建第二套 Runner 线协议。请求/响应外壳继续使用现有 `protocolVersion` 和通用 `worldView` 字段，由宿主根据当前阶段选择 `choose_world_action` 或 `choose_turn`，再分别校验 `WorldCommand` 或 `TurnCommand`。

首章至第五章的请求固定使用 `allowedModules: ["math"]`。第六章在单独的内容变更中把白名单扩展为 `allowedModules: ["math", "json"]`，并由宿主把只读探险日志放入本次运行的临时工作目录。玩家不能通过指令选择任意宿主路径；文件写入只存在于本次运行目录，只有返回的合法指令会改变游戏状态，不提供跨运行文件持久化。

Runner 仍遵循本地代码执行模型：语法错误、运行时错误、超时和中断由程序层反馈，不转化成世界指令。

## Webview 与应用控制器契约

`AppController` 负责根据当前世界状态选择阶段、构造视图、调用 Runner、验证结果、归约状态并触发保存；Webview 不直接修改 `GameState`。UI 快照采用联合类型：

```ts
type GameViewSnapshot =
  | {
      mode: "exploration";
      location: { id: string; name: string; weather?: string };
      npcs: readonly Record<string, string>[];
      objects: readonly Record<string, unknown>[];
      inventory: readonly ItemState[];
      quests: readonly QuestState[];
      feedback: FeedbackState;
    }
  | { mode: "battle"; battle: BattleWorldView; feedback: FeedbackState }
  | { mode: "recovery"; reason: string; canReset: boolean };

type FeedbackState = {
  layer: "program" | "task" | "strategy";
  kind: "idle" | "success" | "error" | "info";
  message: string;
};
```

探索视图至少显示当前地点、可见 NPC/对象/材料、背包、任务步骤和最近反馈；战斗视图沿用现有战斗界面。运行、重试、重置和存档恢复继续走宿主消息，不增加 Webview 侧的规则实现。

## Python 学习曲线

每个主题至少经历三层：

```text
引导任务：给出数据形状和函数骨架
变式任务：改变输入和目标，减少提示
综合任务：混合前面知识，独立解决新问题
```

### 第一章：认识世界数据

变量、字符串、整数、布尔值、列表、字典、简单函数调用、`print()` 和基础调试。任务围绕 NPC 档案、物品筛选、调查报告和机关操作展开。第一章只把条件判断作为带脚手架的局部提示，不要求玩家独立掌握完整分支；完整 `if / elif / else` 任务放在第二章，循环任务放在第三章。

### 第二章：做出判断

`if / elif / else`、比较运算符、`and / or / not`、`in` 和真值判断。任务围绕天气、生命、库存、NPC 状态和路线选择展开。

### 第三章：处理一组数据

`for`、受控 `while`、计数、累计、列表构建、`break` 和 `continue`。任务围绕遍历敌人、统计材料、筛选线索和检查机关展开。

### 第四章：组织成函数

函数、参数、返回值、默认参数、局部变量和辅助函数拆分。任务要求把调查、筛选、路线和行动选择拆成可复用函数。

### 第五章：组合复杂数据

嵌套列表和字典、元组、集合去重、列表推导式、`sorted()`、`key=` 和简单数据转换。任务围绕线索索引、排序目标、去重记录和生成报告展开。

### 第六章：处理失败并完成综合任务

`try / except`、常见异常、文件读写、JSON、基础模块导入和综合脚本组织。任务要求读取探险日志、处理缺失字段、保存 JSON 报告，并综合前五章知识完成最终章节。

## 六章内容规模

每章包含：

```text
1 个据点
3 个主线任务
3-5 个支线任务
1 个编程综合任务
1 场关键战斗
1 个章节结算
```

六章区域和主线方向：

| 章节 | 区域 | Python 主线 | 关键战斗 |
|---|---|---|---|
| 1 | 锈沼营地 | 变量、字符串、列表、字典、基础判断 | 沼泽守卫 |
| 2 | 酸雨渡口 | 条件、布尔表达式、状态判断 | 腐化渡口 |
| 3 | 旧工坊 | 循环、计数、筛选、嵌套数据 | 自动工械 |
| 4 | 玻璃荒原 | 函数、参数、返回值、拆分逻辑 | 失控观测塔 |
| 5 | 记忆矿井 | 集合、排序、推导式、数据转换 | 矿井守卫群 |
| 6 | 沼心城塞 | 综合基础语法、异常处理、JSON 入门 | 沼心核心 |

目标内容量约为 18 个主线任务、18-30 个支线任务、6 个综合编程任务和 6 场关键战斗。战斗不再代表章节全部内容。

## 第一章垂直切片

首章内容注册表固定一组可复现的初始夹具，推荐通关路径如下；允许其他等价的合法 Python 解法：

```text
初始状态：rust-marsh-camp，任务 repair_relay，背包无铜线，revision = 0
  -> 与 toma 对话，取得废料堆线索
  -> 调查 scrap_pile，确认可收集材料
  -> 收集 copper_wire
  -> 调查 weather_station，获得安全路线标记
  -> 前往 old_foundry 的中继器位置
  -> 对 relay 使用 copper_wire，完成修复任务
  -> prepareBattle marsh_guardian，进入一次关键战斗
  -> 使用现有战斗协议完成战斗并结算
  -> 返回营地提交报告，解锁第二章
```

这一章必须在多个任务中重复使用变量、字符串、列表、字典和基础条件，而不是每个概念只出现一次。战斗胜负不由探索指令伪造，章节解锁只由结算后的任务和标记推导。

## 重玩与反馈

首版采用“规则稳定、输入变化”的重玩设计，不做随机地图：

- 支线任务使用不同的材料、天气、NPC 状态和目标顺序。
- 同一任务允许多种合法 Python 解法。
- 章节完成后开放训练委托，复用旧知识处理新的数据集。
- 支线结果可改变后续对话、商店库存、战斗初始条件或结算文本。
- 学习日志记录玩家实际使用过的数据字段和概念，不评分代码风格。

反馈固定为三层：

```text
程序层：语法错误、运行时错误、超时、中断
任务层：返回值格式错误、指令非法、任务条件不满足
策略层：合法操作但路线、资源或战斗决策导致失败
```

Python 错误和非法世界指令均不改变世界状态；只有合法且成功应用的指令才推进任务。三层反馈都必须能在探索和战斗的 UI 快照中被区分显示。

## 存档与恢复

V3 采用一个世界进度基线，并由不同宿主适配器承载代码来源：

```ts
type CampaignSaveV3 = {
  version: 3;
  gameState: GameState;
};

type LocalSaveDataV3 = CampaignSaveV3 & {
  codeDrafts: Readonly<Record<string, string>>;
};

type WorkspaceSaveDataV3 = CampaignSaveV3;
```

VS Code 工作区的 Python 文件是代码权威源，因此 `WorkspaceSaveDataV3` 不重复保存代码文本；刷新时先恢复工作区文件，再恢复 `GameState`。本地回退适配器可以额外保存 `codeDrafts`，但不能让草稿覆盖已打开的工作区文件。

只在世界指令成功应用、战斗回合成功归约或终局结算成功后保存；运行错误、非法指令和被拒绝的旧 `revision` 不保存。

V2 不做隐式的全量迁移：

- VS Code 读取 V2 时保留现有 Python 文件，提供“开始新世界战役”恢复路径，只重置世界进度。
- 本地回退存档读取 V2 时先提供代码草稿导出，再重置为首章初始 `GameState`。
- 版本未知、字段缺失或 JSON 损坏进入 `recovery` 快照，不尝试猜测性修复。

## 分阶段交付与验证

### 阶段一：第一章垂直切片

实现 `GameState`、内容注册表、`CampaignWorldView`、世界指令验证与归约、遭遇结算、首章内容、现有战斗接入、V3 存档、探索/战斗 UI 快照以及三层反馈。验收玩家能完成对话、调查、收集、修复、战斗、提交并刷新恢复。

### 阶段二：章节 2-3

加入条件分支、布尔表达式、循环和筛选任务，验证数据变体和旧知识复用。

### 阶段三：章节 4

加入函数和 NPC 协作任务，验证辅助函数与多步骤任务。

### 阶段四：章节 5-6

加入嵌套数据、排序、推导式、异常处理和 JSON 入门，完成综合任务与最终结局。

### 阶段五：学习复盘增强

加入训练委托、重玩数据变体和学习日志。仅在六章主线稳定后实现。

验证遵循现有项目原则：每阶段运行直接相关测试；阶段完成时运行完整单元测试、生产构建和一条真实通关流程。文档只要求能证明关键契约，不要求为每种内容变体建立重复测试矩阵。

## 第一章完成标准

1. 玩家可在 VS Code 中修改并运行 Python，探索阶段调用 `choose_world_action`，战斗阶段继续调用 `choose_turn`。
2. 玩家能从 `CampaignWorldView` 字典读取地点、NPC、物品、机关和任务步骤。
3. 玩家能用列表筛选材料，并在脚手架提示下用条件选择路线。
4. 玩家能通过合法 `WorldCommand` 完成对话、调查、收集和修复；直接伪造奖励或任务完成会被拒绝。
5. 玩家能通过 `prepareBattle` 进入现有战斗，并在终局后由遭遇定义结算奖励。
6. 玩家能提交任务并由世界规则解锁下一章。
7. V3 存档往返后能恢复地点、任务、背包、线索、进行中的遭遇和代码来源。
8. 语法错误、运行时错误、非法指令和策略失败分别落入三层反馈。
9. 至少有一组纯规则测试覆盖推荐路径和一个关键失败路径（例如重复收集或前往未解锁地点）。
10. 至少有一条控制器集成测试覆盖“探索指令 -> 战斗 -> 结算 -> 存档恢复”的闭环。
