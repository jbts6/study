# Go RPG 第二至第六关实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 Go RPG 第二至第六关，使玩家能在 VS Code 中从第一关连续推进到完整战役结算。

**Architecture:** 保持现有 TypeScript 战斗内核、Runner 协议和 UI 不变。先让 Go SDK 对齐已经存在的 `WorldView` 与 `TurnCommand` JSON，再按关卡逐个复制已验证的语言无关战斗数据、编写独立 Go 教学内容并接入战役内推进。每个关卡以注册测试和生产战斗管线参考解法作为独立验收点。

**Tech Stack:** TypeScript 7、Vitest 4、Go stable、本地 Go Runner、VS Code Extension API。

## Global Constraints

- 项目采用信任本地代码模型；不增加对抗恶意代码的隔离层。
- Go 关卡不得导入 `rpg/src/game/content/python/` 下的关卡文件。
- TypeScript `WorldView`、`TurnCommand`、战斗结算和存档格式保持不变。
- Go SDK 只补齐现有 JSON 字段和六关所需的单位目标动作构造器，不增加新动作。
- 战斗数据逐字段取自对应 Python 关卡，除 `battleId` 和 `contentVersion` 外不得改变平衡参数。
- 测试覆盖正常路径和一个关键失败路径；不为每关重复 Runner 生命周期测试。
- 每个任务只运行目标测试；全量测试仅在所有六关内容完成后运行。
- 修改 `rpg/` 后，最终验证通过必须运行 `npm run install:local`。

---

### Task 1: 补齐 Go SDK 世界视图与动作构造器

**Files:**

- Modify: `rpg/src/runners/go/runtime/sdk.go`
- Modify: `rpg/src/runners/go/go-project.ts`
- Create: `rpg/src/runners/go/go-project.test.ts`
- Modify: `rpg/src/runners/go/go-runner.test.ts`

**Interfaces:**

- Consumes: TypeScript `WorldView` 与 `TurnCommand` 的现有 JSON 字段。
- Produces: Go `World`、`Board`、`Objective`、`Unit`、`Status`、`Skill` DTO，以及 `Guard`、`Cast`、`MoveAndCast`、`Interact`、`MoveAndInteract`。

- [ ] **Step 1: 确认真实 Go 工具链可用**

Run: `go version`

Expected: 退出码 0。若本机没有 Go，本任务判定为阻塞，不得把条件跳过当成 RED 证据。

- [ ] **Step 2: 写完整 DTO、动作 JSON 和缓存键失败测试**

在 `go-runner.test.ts` 保留一个真实工具链综合用例。TypeScript 侧构造固定 `WorldView` 夹具，包含棋盘尺寸、阻挡/危险/掩体格、一个耐久为 2 的 `relay`、一个带生命值/阵营/状态/冷却技能的 scout 和一个敌人。Go 玩家程序必须逐项校验具体值，字段不符时 `panic`，再按 `world.Round` 返回：

```text
round 1 -> Guard
round 2 -> Cast("spark", "golem")
round 3 -> MoveAndCast([{x: 1, y: 0}], "spark", "golem")
round 4 -> Interact("relay")
round 5 -> MoveAndInteract([{x: 0, y: 1}], "relay")
```

TypeScript 测试对五次结果逐个断言完整 `action` JSON、`movePath`、`activeUnitId` 和 `revision`，并断言单位目标动作不含 `targetCell`。

在新建的 `go-project.test.ts` 为纯函数 `createGoBuildCacheKey(source, sdkVersion, goVersion, platform, arch)` 添加行为测试：相同输入键稳定，`sdkVersion` 从 `"1"` 改为 `"2"` 时键必须变化。生产项目创建流程必须调用这个函数。

- [ ] **Step 3: 运行测试确认因 SDK 字段和缓存入口缺失而失败**

Run: `cd rpg && npx vitest run src/runners/go/go-project.test.ts src/runners/go/go-runner.test.ts`

Expected: FAIL，缓存键函数尚不存在，或真实 Go 编译报告 `World` 缺少 `BattleID` / `Guard` 未定义。

- [ ] **Step 4: 用现有 JSON 标签补齐 Go SDK**

`sdk.go` 必须声明以下公共形状；字段名与 JSON 标签固定：

```go
type World struct {
    BattleID       string      `json:"battleId"`
    ContentVersion string      `json:"contentVersion"`
    ActiveUnitID   string      `json:"activeUnitId"`
    Revision       int         `json:"revision"`
    Round          int         `json:"round"`
    Board          Board       `json:"board"`
    Objectives     []Objective `json:"objectives"`
    Units          []Unit      `json:"units"`
}

type Board struct {
    Width        int    `json:"width"`
    Height       int    `json:"height"`
    BlockedCells []Cell `json:"blockedCells"`
    HazardCells  []Cell `json:"hazardCells"`
    CoverCells   []Cell `json:"coverCells"`
}

type Objective struct {
    ID         string `json:"id"`
    Cell       Cell   `json:"cell"`
    Durability int    `json:"durability"`
    Completed  bool   `json:"completed"`
}

type Status struct {
    ID             string `json:"id"`
    RemainingTurns int    `json:"remainingTurns"`
    DefenseBonus   int    `json:"defenseBonus"`
}
```

`Unit` 补齐 `Team`、`HP`、`MaxHP`、`Disabled`、`Statuses`、`Move`、`Attack`、`Defense`；`Skill` 补齐 `Power`、`RemainingCooldown`、`Target`、`Kind`。`Action` 补齐 `SkillID`，并把可选目标格声明为 ``TargetCell *Cell `json:"targetCell,omitempty"` ``，防止单位目标动作序列化出零值格子。

新增构造器都必须沿用 `world.ActiveUnitID` 与 `world.Revision`：

```go
func Guard(world World) TurnCommand
func Cast(world World, skillID string, targetID string) TurnCommand
func MoveAndCast(world World, path []Cell, skillID string, targetID string) TurnCommand
func Interact(world World, targetID string) TurnCommand
func MoveAndInteract(world World, path []Cell, targetID string) TurnCommand
```

把缓存键生成提取为上述纯函数，并把 `go-project.ts` 的 `SDK_VERSION` 从 `"1"` 提升为 `"2"`。

- [ ] **Step 5: 格式化并运行目标测试**

Run: `cd rpg && gofmt -w src/runners/go/runtime/sdk.go`

Run: `cd rpg && npx vitest run src/runners/go/go-project.test.ts src/runners/go/go-runner.test.ts`

Expected: PASS；真实 Go 用例确认具体 DTO 值和五类动作 JSON，缓存键测试确认 SDK 版本失效生效。

- [ ] **Step 6: 提交 SDK 垂直切片**

```bash
git add rpg/src/runners/go/runtime/sdk.go rpg/src/runners/go/go-project.ts rpg/src/runners/go/go-project.test.ts rpg/src/runners/go/go-runner.test.ts
git commit -m "feat: 补齐 Go 战役 SDK"
```

### Task 2: 交付 Go 第二关与首个跨关推进

**Files:**

- Create: `rpg/src/game/content/go/go-marsh-02.ts`
- Modify: `rpg/src/game/content/go/go-marsh-01.ts`
- Modify: `rpg/src/game/content/go/levels.ts`
- Modify: `rpg/src/game/content/levels.ts`
- Modify: `rpg/src/game/content/ability-catalog.ts`
- Modify: `rpg/src/game/content/ability-catalog.test.ts`
- Modify: `rpg/src/game/content/levels.test.ts`
- Modify: `rpg/src/game/content/reference-solutions.test.ts`
- Modify: `rpg/src/runners/go/go-runner.test.ts`
- Modify: `rpg/src/app/app-controller.test.ts`

**Interfaces:**

- Consumes: Task 1 的完整 Go SDK。
- Produces: `GO_MARSH_02`、`go-marsh-01 -> go-marsh-02`、Go `ward` 注入和第二关可通关证据。

- [ ] **Step 1: 写第二关完整垂直切片失败测试**

在 `levels.test.ts` 添加或改写 Go 战役断言：

```ts
expect(getCampaign("go-rpg").levelOrder).toEqual([
  "go-marsh-01",
  "go-marsh-02",
]);
expect(getLevel("go-marsh-01").reward).toEqual({
  type: "ability",
  abilityId: "ward",
});
expect(getLevel("go-marsh-02").reward).toEqual({
  type: "ability",
  abilityId: "pierce",
});
expect(getNextLevelId("go-marsh-01")).toBe("go-marsh-02");
expect(getNextLevelId("python-marsh-06")).toBeUndefined();
expect(getLevel("go-marsh-02").starterCode).toContain("if ");
```

在 `ability-catalog.test.ts` 断言 `go-marsh-02` 的 scout 技能为 `spark`、`mend`、`ward`。

在 `levels.test.ts` 增加战斗数据对齐表，规范化 `battleId` 和 `contentVersion` 后逐字段比较 Python/Go 第二关的初始战斗状态与 `enemyBehaviors`。

在 `reference-solutions.test.ts` 先把现有 Python 第二关参考策略提取为具名函数，并同时映射到 `python-marsh-02` 与尚未存在的 `go-marsh-02`；`REFERENCE_LEVEL_ORDER` 改为 `[..., ...GO_LEVEL_ORDER]`。

在 `app-controller.test.ts` 允许 `createController` 接收可选战役，并先写 Go 第一关胜利后 `advanceLevel()` 保存 `go-marsh-02` 及其起始代码的失败断言。

在 `go-runner.test.ts` 建立显式 `GO_STARTER_LEVEL_IDS` 表，先列出 `go-marsh-01`、`go-marsh-02`，用同一个真实 Go 工具链夹具逐个编译关卡起始代码；后续任务只扩展该表，不重复 Runner 生命周期测试。

- [ ] **Step 2: 运行测试确认第二关尚未注册**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/app/app-controller.test.ts src/runners/go/go-runner.test.ts`

Expected: FAIL，`go-marsh-02` 尚未注册或 Go 战役顺序仍只有第一关。

- [ ] **Step 3: 实现第二关独立内容**

从 `python/python-marsh-02.ts` 逐字段复制 `createPythonMarsh02()` 的战斗数据到 `createGoMarsh02()`，只做以下替换：

```text
battleId: "python-marsh-02" -> "go-marsh-02"
contentVersion: "python-campaign-4" -> "go-campaign-1"
```

Go 起始代码固定为可编译的条件分支骨架：

```go
package main

func ChooseTurn(world World) TurnCommand {
    for _, unit := range world.Units {
        if unit.ID == world.ActiveUnitID && unit.HP <= 4 {
            return Cast(world, "mend", unit.ID)
        }
    }
    return Guard(world)
}
```

教学文本覆盖结构体字段、`if`、危险格、治疗与防御。敌人行为保持 `{ corruptor: { type: "corrupt" } }`，奖励为 `pierce`。

- [ ] **Step 4: 按战役顺序解析下一关并注入 Go 奖励**

`levels.ts` 导入 `GO_LEVEL_ORDER`，并按两个独立顺序查找：

```ts
const LEVEL_ORDERS: readonly (readonly LevelId[])[] = [
  PYTHON_LEVEL_ORDER,
  GO_LEVEL_ORDER,
];

export function getNextLevelId(levelId: LevelId): LevelId | undefined {
  for (const order of LEVEL_ORDERS) {
    const index = order.indexOf(levelId);
    if (index >= 0) return order[index + 1];
  }
  return undefined;
}
```

把 Go 第一关奖励改为 `ward`；在 `LEVEL_UNLOCKS` 登记 `go-marsh-01: []` 和 `go-marsh-02: ["ward"]`。实现完成后，Step 1 中的数据对齐、参考策略、控制器推进和起始代码编译测试应同时转绿。

- [ ] **Step 5: 运行第二关目标测试**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/app/app-controller.test.ts src/runners/go/go-runner.test.ts`

Expected: PASS；Go 第二关参考解法在 8 回合内获胜。

- [ ] **Step 6: 提交第二关垂直切片**

```bash
git add rpg/src/game/content/go rpg/src/game/content/levels.ts rpg/src/game/content/ability-catalog.ts rpg/src/game/content/ability-catalog.test.ts rpg/src/game/content/levels.test.ts rpg/src/game/content/reference-solutions.test.ts rpg/src/app/app-controller.test.ts rpg/src/runners/go/go-runner.test.ts
git commit -m "feat: 添加 Go 沼泽第二关"
```

### Task 3: 交付 Go 第三关切片遍历教学

**Files:**

- Create: `rpg/src/game/content/go/go-marsh-03.ts`
- Modify: `rpg/src/game/content/go/levels.ts`
- Modify: `rpg/src/game/content/ability-catalog.ts`
- Modify: `rpg/src/game/content/ability-catalog.test.ts`
- Modify: `rpg/src/game/content/levels.test.ts`
- Modify: `rpg/src/game/content/reference-solutions.test.ts`
- Modify: `rpg/src/runners/go/go-runner.test.ts`

**Interfaces:**

- Consumes: 已注册的 Go 前两关与 `Interact` 构造器。
- Produces: `GO_MARSH_03`、印记目标教学、`go-marsh-02 -> go-marsh-03` 和 `renew` 奖励。

- [ ] **Step 1: 写第三关失败测试**

断言 Go 顺序追加 `go-marsh-03`，第二关下一关为第三关，第三关奖励为 `renew`，起始代码包含 `range world.Units`，教学包含 `scout-mark`。在能力测试中断言进入第三关已拥有 `ward` 和 `pierce`。

同一 RED 步骤还必须：在数据对齐表追加 Python/Go 第三关；把第三关具名参考策略映射给尚未存在的 `go-marsh-03`；把 `go-marsh-03` 加入显式起始代码编译表。参考策略断言先完成 `scout-mark` 再清除最后一个敌人。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/runners/go/go-runner.test.ts`

Expected: FAIL，第三关尚未注册。

- [ ] **Step 3: 实现第三关内容**

逐字段复制 `python/python-marsh-03.ts` 的战斗数据，只把 `battleId` 改为 `go-marsh-03`、`contentVersion` 改为 `go-campaign-1`。敌人行为、目标、回合数和奖励保持原值。

起始代码必须可编译并展示切片遍历，但不得替玩家完成印记逻辑：

```go
package main

func ChooseTurn(world World) TurnCommand {
    targetID := ""
    for _, unit := range world.Units {
        if unit.Team == "enemies" && !unit.Disabled {
            targetID = unit.ID
            break
        }
    }
    if targetID == "" {
        return Wait(world)
    }
    return Attack(world, targetID)
}
```

- [ ] **Step 4: 完成注册与能力登记**

在 `GO_LEVEL_ORDER` / `GO_LEVELS` 注册第三关，登记 `go-marsh-03: ["ward", "pierce"]`。Step 1 已写的战斗数据、参考策略和起始代码编译断言必须随实现转绿。

- [ ] **Step 5: 运行目标测试并提交**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/runners/go/go-runner.test.ts`

Expected: PASS；Go 第三关目标完成且战斗获胜。

```bash
git add rpg/src/game/content/go rpg/src/game/content/ability-catalog.ts rpg/src/game/content/ability-catalog.test.ts rpg/src/game/content/levels.test.ts rpg/src/game/content/reference-solutions.test.ts rpg/src/runners/go/go-runner.test.ts
git commit -m "feat: 添加 Go 沼泽第三关"
```

### Task 4: 交付 Go 第四关组合决策教学

**Files:**

- Create: `rpg/src/game/content/go/go-marsh-04.ts`
- Modify: `rpg/src/game/content/go/levels.ts`
- Modify: `rpg/src/game/content/ability-catalog.ts`
- Modify: `rpg/src/game/content/ability-catalog.test.ts`
- Modify: `rpg/src/game/content/levels.test.ts`
- Modify: `rpg/src/game/content/reference-solutions.test.ts`
- Modify: `rpg/src/runners/go/go-runner.test.ts`

**Interfaces:**

- Produces: `GO_MARSH_04`、组合条件与冷却教学、`fracture` 奖励。

- [ ] **Step 1: 写第四关失败测试**

断言顺序追加 `go-marsh-04`、第三关可推进、奖励为 `fracture`，教学同时出现 `RemainingCooldown`、`pierce`、`renew` 和 `&&` / `||`。断言进入第四关拥有前三个奖励能力。

同一 RED 步骤在数据对齐表追加 Python/Go 第四关，在参考解法映射追加 `go-marsh-04`，在起始代码编译表追加 `go-marsh-04`。参考策略断言完成 `seal`、保住 `relay` 并清除两名敌人。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/runners/go/go-runner.test.ts`

Expected: FAIL，第四关尚未注册。

- [ ] **Step 3: 实现第四关内容**

逐字段复制 `python/python-marsh-04.ts` 的完整战斗数据，只替换 `battleId` 与 `contentVersion`。保留 `relay`、`seal`、`corruptor`、`guard`、12 回合限制和原敌人行为。

起始代码保持可编译，只示范组合条件所需的数据读取：

```go
package main

func ChooseTurn(world World) TurnCommand {
    lowHP := false
    skillReady := false
    for _, unit := range world.Units {
        if unit.ID == world.ActiveUnitID {
            lowHP = unit.HP*2 <= unit.MaxHP
            for _, skill := range unit.Skills {
                skillReady = skillReady ||
                    skill.RemainingCooldown == 0
            }
        }
    }
    if lowHP && skillReady {
        return Guard(world)
    }
    return Wait(world)
}
```

- [ ] **Step 4: 完成注册与能力登记**

在 Go 顺序中注册第四关，登记 `go-marsh-04: ["ward", "pierce", "renew"]`。Step 1 已写的战斗数据、参考策略和起始代码编译断言必须随实现转绿。

- [ ] **Step 5: 运行目标测试并提交**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/runners/go/go-runner.test.ts`

Expected: PASS。

```bash
git add rpg/src/game/content/go rpg/src/game/content/ability-catalog.ts rpg/src/game/content/ability-catalog.test.ts rpg/src/game/content/levels.test.ts rpg/src/game/content/reference-solutions.test.ts rpg/src/runners/go/go-runner.test.ts
git commit -m "feat: 添加 Go 沼泽第四关"
```

### Task 5: 交付 Go 第五关辅助函数教学

**Files:**

- Create: `rpg/src/game/content/go/go-marsh-05.ts`
- Modify: `rpg/src/game/content/go/levels.ts`
- Modify: `rpg/src/game/content/ability-catalog.ts`
- Modify: `rpg/src/game/content/ability-catalog.test.ts`
- Modify: `rpg/src/game/content/levels.test.ts`
- Modify: `rpg/src/game/content/reference-solutions.test.ts`
- Modify: `rpg/src/runners/go/go-runner.test.ts`

**Interfaces:**

- Produces: `GO_MARSH_05`、辅助函数与阶段策略教学、`aegis` 奖励。

- [ ] **Step 1: 写第五关失败测试**

断言顺序追加 `go-marsh-05`、第四关可推进、奖励为 `aegis`，起始代码声明一个 `func` 辅助函数，教学包含 `node-a`、`node-b` 和 `fracture`。断言进入第五关拥有前四个奖励能力。

同一 RED 步骤在数据对齐表追加 Python/Go 第五关，在参考解法映射追加 `go-marsh-05`，在起始代码编译表追加 `go-marsh-05`。参考策略断言两个节点完成、`relay` 耐久大于 0、敌人全部失能。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/runners/go/go-runner.test.ts`

Expected: FAIL，第五关尚未注册。

- [ ] **Step 3: 实现第五关内容**

逐字段复制 `python/python-marsh-05.ts` 的完整战斗数据，只替换 `battleId` 与 `contentVersion`。保留两个节点的完成约束、敌人行为和 14 回合限制。

起始代码提供可复用辅助函数，不包含关卡目标顺序答案：

```go
package main

func livingEnemy(world World) string {
    for _, unit := range world.Units {
        if unit.Team == "enemies" && !unit.Disabled {
            return unit.ID
        }
    }
    return ""
}

func ChooseTurn(world World) TurnCommand {
    targetID := livingEnemy(world)
    if targetID == "" {
        return Wait(world)
    }
    return Attack(world, targetID)
}
```

- [ ] **Step 4: 完成注册与能力登记**

在 Go 顺序中注册第五关，登记 `go-marsh-05: ["ward", "pierce", "renew", "fracture"]`。Step 1 已写的战斗数据、参考策略和起始代码编译断言必须随实现转绿。

- [ ] **Step 5: 运行目标测试并提交**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/runners/go/go-runner.test.ts`

Expected: PASS。

```bash
git add rpg/src/game/content/go rpg/src/game/content/ability-catalog.ts rpg/src/game/content/ability-catalog.test.ts rpg/src/game/content/levels.test.ts rpg/src/game/content/reference-solutions.test.ts rpg/src/runners/go/go-runner.test.ts
git commit -m "feat: 添加 Go 沼泽第五关"
```

### Task 6: 交付 Go 第六关与战役结算

**Files:**

- Create: `rpg/src/game/content/go/go-marsh-06.ts`
- Modify: `rpg/src/game/content/go/levels.ts`
- Modify: `rpg/src/game/content/ability-catalog.ts`
- Modify: `rpg/src/game/content/ability-catalog.test.ts`
- Modify: `rpg/src/game/content/levels.test.ts`
- Modify: `rpg/src/game/content/reference-solutions.test.ts`
- Modify: `rpg/src/app/app-controller.test.ts`
- Modify: `rpg/src/runners/go/go-runner.test.ts`

**Interfaces:**

- Produces: 完整六关顺序、终关综合教学、战役完成奖励和不可继续推进的终局。

- [ ] **Step 1: 写六关完整性和终局失败测试**

断言 Go 战役顺序恰好为 `go-marsh-01` 至 `go-marsh-06`，第六关奖励为 `{ type: "campaign-complete" }`，`getNextLevelId("go-marsh-06")` 为 `undefined`。最终关提示必须包含完整 API 字段和能力名，但不得出现“先…再…最后”式答案步骤。

同一 RED 步骤在数据对齐表追加 Python/Go 第六关，在参考解法映射追加 `go-marsh-06`，在起始代码编译表追加 `go-marsh-06`。终关参考策略必须断言 `relay` 耐久大于 0、`final-seal.completed === true`、所有敌人失能且回合数不超过 18。

在 `app-controller.test.ts` 以 `GO_RPG_CAMPAIGN` 加载已经获胜的 `go-marsh-06` 存档，断言结算只显示战役完成操作，调用 `advanceLevel()` 不改变当前关卡或代码。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/app/app-controller.test.ts src/runners/go/go-runner.test.ts`

Expected: FAIL，第六关尚未注册。

- [ ] **Step 3: 实现第六关内容**

逐字段复制 `python/python-marsh-06.ts` 的完整战斗数据，只替换 `battleId` 与 `contentVersion`。保留三类敌人、`final-seal`、关键中继器和 18 回合限制。

起始代码只保留可编译入口和 API 速查，不提供策略骨架：

```go
package main

// World 提供 Board、Objectives 和 Units。
// 使用 Wait、Guard、Attack、Cast、Interact 及其移动版本。
// 根据目标、冷却、生命值和位置独立组织最终策略。
func ChooseTurn(world World) TurnCommand {
    return Wait(world)
}
```

- [ ] **Step 4: 完成注册与能力登记**

在 Go 顺序中注册第六关，登记 `go-marsh-06: ["ward", "pierce", "renew", "fracture", "aegis"]`。Step 1 已写的数据对齐、终关参考策略、终局控制器和起始代码编译断言必须随实现转绿。

- [ ] **Step 5: 运行目标测试并提交**

Run: `cd rpg && npx vitest run src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/app/app-controller.test.ts src/runners/go/go-runner.test.ts`

Expected: PASS；Go 六关均在生产战斗管线中获胜。

```bash
git add rpg/src/game/content/go rpg/src/game/content/ability-catalog.ts rpg/src/game/content/ability-catalog.test.ts rpg/src/game/content/levels.test.ts rpg/src/game/content/reference-solutions.test.ts rpg/src/app/app-controller.test.ts rpg/src/runners/go/go-runner.test.ts
git commit -m "feat: 完成 Go 沼泽六关战役"
```

### Task 7: 阶段性全量验证与本地扩展安装

**Files:**

- Verify: `rpg/`
- Update only if failures prove necessary: files already changed by Tasks 1-6

**Interfaces:**

- Consumes: 完整 Go 六关战役。
- Produces: 构建、测试、E2E、VSIX 和本机安装证据。

- [ ] **Step 1: 运行静态检查和目标测试**

Run: `cd rpg && npm run typecheck`

Run: `cd rpg && npx vitest run src/runners/go/go-project.test.ts src/runners/go/go-runner.test.ts src/game/content/levels.test.ts src/game/content/ability-catalog.test.ts src/game/content/reference-solutions.test.ts src/app/app-controller.test.ts`

Expected: 全部退出码 0，无新增警告。

- [ ] **Step 2: 运行阶段性全量测试与构建**

Run: `cd rpg && npm test`

Run: `cd rpg && npm run build`

Run: `cd rpg && npm run test:extension`

Run: `cd rpg && npm run test:e2e`

Expected: 全部退出码 0。只修复由本次 Go 六关变更引起的失败。

- [ ] **Step 3: 检查差异质量**

Run: `git diff --check 35320bf47892bb4a62813c1e786cf6f947056a43..HEAD`

检查 Go 关卡没有导入 Python 关卡文件，五个新文件均低于 400 行，函数均低于 60 行。

- [ ] **Step 4: 打包并安装本地扩展**

Run: `cd rpg && npm run install:local`

Expected: 生成 `rpg/dist/python-rpg.vsix`，`code --install-extension ... --force` 成功。

- [ ] **Step 5: 重载 VS Code 并确认战役入口**

重载当前 VS Code 窗口，重新打开 Go 战役。确认第一关结算后出现进入第二关的操作，第六关结算显示战役完成。

- [ ] **Step 6: 提交验证中产生的必要修复**

仅当验证步骤产生必要源码修复时执行：

```bash
git add rpg
git commit -m "fix: 闭合 Go 六关战役回归"
```
