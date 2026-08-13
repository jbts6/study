# Python RPG VS Code 插件交接文档

## 交接目的

把当前浏览器版 Python RPG 演进为以 VS Code 插件为主的本地学习体验。玩家在 VS Code 原生 Python 编辑器中编写每关代码，右侧游戏 Webview 显示任务、战场、提示、运行反馈和结算。网页版本保留为开发预览与回归入口，不再与插件保持同等产品地位。

本文只记录已经确认的产品和技术决策，不代表功能已经实现。后续实现者应先据此生成实施计划，再按测试驱动方式开发。

## 当前项目事实

- 主项目位于 `rpg/`，技术栈为 TypeScript、Vite、Vitest、Playwright、CodeMirror 6、本机 CPython 和 WebSocket Runner。
- 浏览器端由 `rpg/src/app/app-controller.ts` 持有应用快照并推进战斗。
- 浏览器通过 `rpg/src/app/runner-client.ts` 连接 `ws://127.0.0.1:5175`。
- 本地 Runner 位于 `rpg/src/runners/local/`，每次运行启动一个独立 Python 子进程。
- Python 运行协议和结果类型位于 `rpg/src/runners/protocol/`。
- 六关内容分别位于 `rpg/src/game/content/python-marsh-01.ts` 至 `python-marsh-06.ts`。
- 第一关已经补充完整命令结构和提示；第二至第六关的 `starterCode` 与 `apiHints` 仍明显简略。
- 项目采用信任本地代码模型。玩家运行自己的本地代码，不建设对抗恶意代码的安全边界。

## 已确认的产品方向

### 产品关系

- VS Code 插件成为主要游戏体验。
- 网页版本只保留为开发预览和回归入口。
- 不长期维护两套功能完全对等的产品。
- 网页旧 `localStorage` 存档不迁移到插件。

### 交付范围

- 按完整六关设计，但分阶段落地。
- 阶段一先用第一、二关证明完整链路。
- 阶段二接入第三至第六关，并统一补齐所有关卡提示。

### 玩家代码文件

- 每关使用一个独立 Python 文件。
- 默认路径为：
  - `python-rpg/python-marsh-01.py`
  - `python-rpg/python-marsh-02.py`
  - `python-rpg/python-marsh-03.py`
  - `python-rpg/python-marsh-04.py`
  - `python-rpg/python-marsh-05.py`
  - `python-rpg/python-marsh-06.py`
- 插件首次使用时创建缺失文件。
- 已存在的玩家文件不得覆盖。
- 切换关卡时，在左侧编辑器组打开对应文件，并保留前面关卡的代码供复盘。

## 已确认的 VS Code 使用方式

### 编辑器布局

- 左侧约 50%：VS Code 原生 Python 文件编辑标签。
- 右侧约 50%：游戏战场 Webview 编辑标签。
- 不使用侧边栏承载主战场。
- 不把完整网页连同 CodeMirror 原样嵌入 Webview。
- 进入下一关时只切换左侧 Python 文件；右侧游戏标签保持位置和状态。
- 重新打开工作区时恢复当前关卡及左右编辑器组。

### 运行入口

- 右侧游戏页提供“运行回合”主按钮。
- 同时注册 VS Code 命令和 `Ctrl+Enter` 快捷键。
- 运行时读取当前关卡绑定文档的最新文本，包括尚未保存的修改。
- 即使用户焦点临时位于其他文件，也只运行当前关卡对应的 Python 文件，避免误执行。

## 目标架构

采用“扩展宿主持有唯一状态，Webview 只负责显示和发出操作”的架构。

```text
左侧 Python 文档 ─┐
快捷键 / 命令 ────┼──> ExtensionController
右侧 Webview 操作 ┘          │
                             ├──> PythonExecutionService
                             ├──> 共享战斗内核
                             ├──> WorkspaceCampaignStore
                             └──> GameViewSnapshot ──> Webview
```

### ExtensionController

- 当前关卡、战斗状态、运行状态和反馈的唯一来源。
- 响应运行、中断、重试、下一关和重置战役。
- 调用共享的世界视图、指令校验、战斗内核和敌方回合逻辑。
- 向 Webview 发布不可变的完整快照。

### WorkspaceCampaignStore

- 使用 VS Code `workspaceState` 保存当前关卡和战斗状态。
- Python 代码只保存在各关 `.py` 文件中，不重复存入状态存储。
- 不使用 `globalState`，避免多个工作区共享同一战役进度。

### PythonExecutionService

- 检测本机 Python。
- 读取当前关卡对应 `TextDocument.getText()`，包括未保存内容。
- 直接复用现有单次 Python 执行器和执行协议。
- 由扩展宿主管理 Python 子进程、超时、中断和结果回传。
- 插件使用时不要求玩家另外运行 `npm run runner`，也不再绕一层本地 WebSocket。

### LevelWorkspace

- 创建缺失的逐关 Python 文件。
- 在 `ViewColumn.One` 打开当前关卡文件。
- 不覆盖玩家已有代码。
- 文件缺失时明确询问是否按脚手架重新创建。

### GameWebviewPanel

- 在 `ViewColumn.Two` 打开并尽量保持右侧位置。
- 只渲染任务、战场、提示、反馈、运行状态和结算。
- Webview 重载后发送 `ready`，扩展宿主立即重发完整快照。
- Webview 不持有权威战斗状态，也不直接读写存档或执行 Python。

## 扩展与 Webview 通信

VS Code 官方 Webview 消息 API 足以完成双向通信：

- Webview 使用 `acquireVsCodeApi().postMessage(...)` 发送意图。
- 扩展使用 `panel.webview.onDidReceiveMessage(...)` 接收意图。
- 扩展使用 `panel.webview.postMessage(...)` 发布快照。
- 扩展使用 `window.showTextDocument(...)` 管理左侧 Python 文档。
- 扩展使用 `TextDocument.getText()` 读取未保存文本。

### Webview 发给扩展

```ts
type WebviewCommand =
  | { type: "ready" }
  | { type: "runTurn" }
  | { type: "interruptRun" }
  | { type: "retryLevel" }
  | { type: "advanceLevel" }
  | { type: "resetCampaign" }
  | { type: "setTheme"; theme: "light" | "dark" | "system" };
```

### 扩展发给 Webview

```ts
type ExtensionMessage =
  | { type: "snapshot"; snapshot: GameViewSnapshot }
  | { type: "focusDiagnostic"; file: string; line: number; column: number };
```

### 单次运行数据流

```text
点击运行或按 Ctrl+Enter
  -> ExtensionController 校验当前状态
  -> 读取当前关卡 TextDocument 最新文本
  -> PythonExecutionService 执行代码
  -> 校验 Python 返回值和关卡指令
  -> 推进玩家回合与确定性敌方回合
  -> 写入 workspaceState
  -> 发布新的 GameViewSnapshot
  -> Webview 更新战场、反馈和结算
```

### 通信约束

- Webview 只传递玩家意图，不传递代码、完整战斗状态或存档。
- 每次只允许一个运行请求。
- 运行期间显示“中断运行”，并禁用重复运行。
- 采用固定 TypeScript 联合类型，不增加版本协商和复杂状态机。
- 主题偏好只影响显示，不影响战斗状态。

## UI 与主题契约

### 半屏信息层级

右侧 Webview 按以下顺序组织：

1. 关卡标题、回合、当前行动者和 Python 状态。
2. 始终可见的任务目标与失败条件。
3. 自适应战场。
4. 运行反馈和按需展开的本关提示。
5. 运行、重试或结算操作栏。

界面应优先保证战场和运行反馈可读，不把单位状态堆成常驻窄侧栏。

### 自适应方格

方格大小根据战场行数、列数和 Webview 可用区域共同计算，而不是只根据总格数。

```text
方格边长 = min(
  战场可用宽度 / 列数,
  战场可用高度 / 行数,
  最大方格尺寸
)
```

- 方格始终保持正方形。
- 小战场自动放大，大战场自动缩小。
- 当前六关应在右侧半屏内完整显示，不依赖横向滚动。
- 设置最小可读尺寸；接近下限时优先压缩图例和上下留白。
- 单位名、生命值和目标标签按方格尺寸分档调整，不做无限比例缩放。
- 不为未来超大地图建设缩放、拖拽或小地图工具。

### 浅色与深色主题

- 保留现有浅色主题，新增完整深色主题。
- 第一次打开时跟随 VS Code 当前主题。
- 游戏页提供“浅色 / 深色”切换，并允许回到 `system` 跟随模式。
- 玩家手动选择后持久化主题偏好。
- 两套主题共用同一布局和组件，只切换设计 token，不复制模板和业务逻辑。
- 深色主题不是浅色反转，应为背景、表面、正文、弱化文本、边框、强调色、危险色、战场格、单位和目标分别定义 token。
- 正文对比度至少达到 4.5:1；状态不能只靠颜色表达。

## 六关提示改造

提示继续作为共享关卡数据，由网页和插件共同消费。不要分别维护两套提示。

建议把单一的 `apiHints: string[]` 收敛为固定结构：

```ts
type LevelGuidance = Readonly<{
  objective: readonly string[];
  concepts: readonly string[];
  worldFields: readonly string[];
  commandExamples: readonly string[];
  levelRules: readonly string[];
}>;
```

### 递进策略

- 第一关：完整说明 `choose_turn`、命令顶层字段、`movePath`、五种行动和一条可运行示例。
- 第二关：说明 `units`、生命值、危险格和 `if` 条件分支，同时保留必要命令结构速查。
- 第三关：说明列表遍历、敌方筛选、优先目标和激活勘测印记。
- 第四关：说明组合条件、技能冷却、破防、自疗和目标顺序。
- 第五关：说明辅助函数拆分、节点顺序和高防敌人处理。
- 第六关：只保留完整 API 速查、战役约束和能力清单，不提供接近答案的操作步骤。

### 显示规则

- 任务目标和失败条件始终可见。
- API 与概念提示默认收起，并按固定分组展开。
- 命令错误发生时，反馈区先给出可执行修正信息，再自动展开相关提示组。
- 不提供一键写入答案或运行时参考解法。

## 错误与诊断

只覆盖项目已定义的常见本地故障：

- Python 不可用：显示检测结果和配置入口。
- 语法错误、运行时错误：在反馈区显示，并通过 VS Code `DiagnosticCollection` 标记对应代码行。
- 点击错误反馈时跳转到对应文件、行和列。
- 超时或中断：战斗不推进，允许重新运行。
- Python 返回值或战斗指令非法：显示字段级错误和对应命令示例。
- 当前关卡文件缺失：询问是否按脚手架重新创建，不覆盖其他文件。
- 存档损坏：提供明确的“重置战役”操作。
- Webview 关闭或重载：从扩展宿主当前状态恢复。

不处理恶意本地代码、极端进程竞态、跨版本迁移、多窗口共享战役、远程执行、账户或云存档。

## 分阶段交付

### 阶段一：证明插件主链路

- 建立 VS Code 扩展工程和左右 50/50 编辑器组布局。
- 接入第一、二关独立 Python 文件。
- 实现扩展宿主唯一状态源和 `workspaceState` 恢复。
- 直接调用本地 Python 子进程。
- 实现运行、中断、诊断跳转、重试和进入下一关。
- 实现自适应正方形方格。
- 实现浅色、深色和首次跟随 VS Code 的主题逻辑。
- 补齐第一、二关分组提示，并让网页使用同一份数据。

首个证明点：第二关 Python 文档存在未保存修改时按 `Ctrl+Enter`，右侧战场使用该修改推进回合；关闭并重新打开 Webview 后，战场和反馈保持一致。

### 阶段二：完成六关

- 接入第三至第六关独立文件、脚手架、提示和切关。
- 补齐全部关卡的诊断、结算与重开恢复。
- 网页端继续消费共享关卡内容和共享应用核心。
- 网页保留 CodeMirror、WebSocket Runner 和浏览器存档适配器，只用于开发预览和回归。

## 验证边界

遵循项目“正常路径加一个关键失败路径”的测试原则，不为提高数量扩充测试矩阵。

- 应用核心：验证正常推进和一个关键失败路径。
- 扩展宿主：验证未保存文本运行、Webview 消息响应和工作区存档恢复。
- Python 执行：验证成功执行，并在语法错误或超时中选择一个关键失败路径。
- Webview：验证自适应战场尺寸、主题切换和切关后的快照渲染。
- 六关内容：继续使用现有参考解法证明可通关，并验证每关提示结构完整。
- 阶段一完成时只执行定向测试和插件集成验证。
- 阶段二完成时再执行全量测试与六关端到端验证。

## 明确不做

- 插件市场发布、自动更新、遥测和账号体系。
- 远程 Runner、云存档、多人模式和跨设备同步。
- 网页旧存档迁移。
- 任意工作区布局管理。
- 通用插件平台或通用关卡 DSL。
- 超大地图缩放工具。
- 与本地单人六关主流程无关的兼容层、防护和测试矩阵。

## 预览产物

本轮头脑风暴生成了临时可视化预览，位于 `.superpowers/brainstorm/`。其中最终确认方向是：左侧 50% 作为 VS Code 编辑器占位，右侧 50% 显示游戏；游戏默认可呈现深色主题，并可切换浅色主题。这些文件只用于设计参考，不是生产代码。

## 接手后的第一步

1. 基于本文写出逐文件、逐测试的实施计划。
2. 先确定共享应用核心与 VS Code 适配器的依赖方向，避免 Webview 持有权威状态。
3. 用一个失败测试定义“读取未保存的当前关卡文档并运行”的公共接口。
4. 只完成第一、二关的端到端证明点；证明成立后再进入第三至第六关。

