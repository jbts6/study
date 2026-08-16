# 自动战斗 + 事件动画 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 世界战役战斗改为一次运行自动打完（每次从头模拟），全程事件日志 + 单位动画可见。

**Architecture:** 控制器层在战斗模式下循环调用 runner（重置→执行→应用→敌方结算→节奏等待），累积引擎既有 `BattleEvent` 到 `WorldBattleSnapshot.battleLog`；webview 战斗视图新增日志面板，并把棋盘单位改为键控差分定位以驱动 CSS 动画。

**Tech Stack:** TypeScript + vitest（jsdom），VS Code webview，纯 CSS 动画。

**Spec:** `docs/superpowers/specs/2026-08-16-autonomous-battle-design.md`

## Global Constraints

- 探索层（非战斗）行为完全不变：一次运行 = 一条世界命令。
- 复用引擎 `BattleEvent`（`game/combat/types.ts`），不新造事件契约、不做状态差分。
- 战斗节奏常量默认 800ms，测试注入 0。
- `battleLog` 只存在于控制器内存与快照，不进 `LocalSaveDataV3`。
- starter 注释每行 ≤60 字符（`levels.test.ts` 守护）。
- 改完 `rpg/` 后必须 `npm run install:local` 交付。
- 测试原则：每任务正常路径 + 关键失败路径，不铺用例。

---

### Task 1: 控制器自动战斗循环（重置 + 循环 + battleLog 累积 + 节奏）

**Files:**
- Modify: `rpg/src/app/world-campaign-controller.ts`
- Modify: `rpg/src/app/controller-types.ts:21-29`（`WorldBattleSnapshot` 增加 `battleLog`）
- Modify: `rpg/src/game/world/settle-encounter.ts`（导出重置辅助）
- Test: `rpg/src/app/world-campaign-controller.test.ts`

**Interfaces:**
- Produces: `WorldBattleSnapshot.battleLog: readonly BattleEvent[]`（后续任务消费）；`WorldCampaignControllerDependencies` 增加可选 `turnDelayMs?: number`（默认 800）。

- [ ] **Step 1: 写失败测试**

在 `world-campaign-controller.test.ts` 增加（复用文件内既有的 `completed` 辅助与 `requestRevision` 模式）：

```ts
describe("autonomous battle", () => {
  function battleReadyState(): GameState {
    let state = createPythonWorldInitialState();
    for (const command of [
      { type: "talk", targetId: "toma" },
      { type: "inspect", targetId: "scrap_pile" },
      { type: "collect", targetId: "copper_wire_source" },
      { type: "inspect", targetId: "weather_station" },
      { type: "travel", locationId: "old_foundry" },
      { type: "use", itemId: "copper_wire", targetId: "relay" },
      { type: "prepareBattle", encounterId: "marsh_guardian" },
    ] as const) {
      const resolved = resolveWorldCommand(state, PYTHON_WORLD_CONTENT, { ...command, expectedRevision: state.revision });
      if (!resolved.accepted) throw new Error("battle prep failed");
      state = resolved.state;
    }
    return state;
  }

  class AutoBattleRunner extends FakeRunner {
    constructor() {
      super([], false);
    }
    async run(request: RunRequest): Promise<RunResult> {
      (this as unknown as { requests: RunRequest[] }).requests.push(request);
      const revision = requestRevision(request);
      return completed({
        actorId: "scout",
        expectedRevision: revision,
        action: { type: "attack", targetId: (request as PythonRunRequest).files[(request as PythonRunRequest).entrypoint.file].includes("golem") ? "golem" : "golem" },
      });
    }
  }
```

> 实现时不需要上面这个子类——直接给 `FakeRunner` 构造一组按序消费的 `RunResult`（战斗命令以 `requestRevision(request)` 回填 revision，参考 `ChapterFlowRunner` 的写法）。测试用例：

```ts
  it("auto-plays battle turns to victory within one runCode call", async () => {
    const store = new MemoryWorldSaveStore({ ok: true, save: null });
    // 前置：直接构造 battleReadyState 的存档
    const runner = new FakeRunner(winningTurnResults(), false);
    const controller = createWorldController(runner, store, { turnDelayMs: 0 });
    await controller.start();
    await controller.runCode(getLevel("python-marsh-01").starterCode);
    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("exploration"); // 胜利结算后回探索
    expect(runner.requests.length).toBeGreaterThan(1);
  });

  it("stops the sequence on a rejected command and restarts from the initial battle on the next run", async () => {
    // 第一段队列：1 条合法 + 1 条非法（attack 已被禁用的目标）
    // 断言：runCode 后 mode === "battle"、phase === "in_progress"、feedback.kind === "error"
    // 第二段队列接胜利序列再 runCode：断言第二次序列第一条 request 的状态 revision
    // 等于遭遇初始 revision（从头模拟）
  });

  it("accumulates battle events across turns in battleLog", async () => {
    // 胜利序列跑完后，通过 subscribe 收集到的 battle 快照里
    // battleLog 含多回合的 damaged/moved 事件（seq 递增）
  });
```

> 具体结果队列在实现时按 golem(6 血, 攻 4→2 回合击杀) 与战场数值构造合法命令序列；`attack scout 自身不死` 需按 `marsh-slice.ts` 实际数值推演（敌方合计每回合 5 点输出、scout 10 血 → 纯 attack 两回合内 scout 会死，胜利队列需含 mend 或利用 movePath 风筝；若纯攻击不可胜，用 spark(2)+attack 组合并推演回合）。推演以 `resolveTurn` 实测为准，先写队列再跑测试校正。

- [ ] **Step 2: 运行确认失败**

```bash
cd rpg && npx vitest run src/app/world-campaign-controller.test.ts
```

预期：新用例 FAIL（当前一次 runCode 只执行一条命令 / 快照无 battleLog）。

- [ ] **Step 3: 实现**

`settle-encounter.ts` 增加导出（内部复用 `cloneBattle`）：

```ts
export function resetEncounterBattle(state: Readonly<GameState>, content: WorldCampaignContent): GameState {
  if (state.battle === null) return state;
  const encounter = content.encounters[state.battle.encounterId];
  if (encounter === undefined) throw new Error(`遭遇尚未注册: ${state.battle.encounterId}`);
  return { ...state, battle: { encounterId: encounter.id, state: cloneBattle(encounter.initialBattle) } };
}
```

`controller-types.ts` 的 `WorldBattleSnapshot` 增加 `battleLog: readonly BattleEvent[]`（import 自 `../game/combat/types`）。

`world-campaign-controller.ts`：

1. 依赖类型增加 `turnDelayMs?: number`；类字段 `private readonly turnDelayMs: number`（构造时 `?? 800`）、`private battleLog: BattleEvent[] = []`；模块级 `const AUTO_TURN_DELAY_MS = 800;`。
2. `runCurrent` 改造（核心）：

```ts
private async runCurrent(snapshot: ActiveWorldSnapshot): Promise<void> {
  if (!canRun(snapshot)) return;
  const runId = (this.dependencies.createId ?? createId)();
  let initialState = snapshot.gameState;
  if (snapshot.mode === "battle") {
    initialState = resetEncounterBattle(initialState, this.content);
    this.battleLog = [];
    this.replaceSnapshot(this.createWorldSnapshot(initialState, snapshot.codeDraft, snapshot.feedback));
  }
  this.replaceSnapshot({ ...this.activeWorldSnapshot(runId)!, activeRunId: runId, diagnostics: [] });
  let state = initialState;
  while (true) {
    let result: RunResult;
    try {
      result = await this.dependencies.runner.run(createWorldRunRequest({
        campaign: this.campaign, content: this.content, state, codeDraft: snapshot.codeDraft, runId, limits: this.runLimits,
      }));
    } catch { this.reportRunnerUnavailable(runId); return; }
    const outcome = this.resolveResult(result, runId);
    const current = this.activeWorldSnapshot(runId);
    if (current === undefined || outcome !== "continue") return; // 中断/停止
    state = current.gameState;
    await delay(this.turnDelayMs);
    if (this.activeWorldSnapshot(runId) === undefined) return; // 中断按钮清除了运行
  }
}
```

3. `resolveResult` 返回 `"continue" | "stopped"`：`executionStatus !== "completed"` → stopped；探索 → stopped；战斗分支里命令被拒 → stopped；`resolveBattleResult` 内每回合把 events 并入 `this.battleLog = [...this.battleLog, ...events]`（含敌方回合事件），phase 结束（结算后）→ stopped，否则 continue。
4. `createWorldSnapshot` battle 分支带 `battleLog: [...this.battleLog]`；exploration 分支不带。
5. `delay` 辅助：`const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));`
6. `clearActiveRun`/中断语义不变——中断后 `activeWorldSnapshot(runId)` 为 undefined，循环自然退出。

- [ ] **Step 4: 全量测试并修既有用例**

```bash
cd rpg && npm test
```

预期：既有用例中逐回合 `runCode` 驱动战斗的（`ChapterFlowRunner` 系列）行为变化——战斗一次 runCode 打完。按新语义修正这些用例（减少战斗段的手动 runCode 次数、断言改为结算后状态），不改 FakeRunner 语义。

- [ ] **Step 5: 提交**

```bash
git add rpg/src/app/world-campaign-controller.ts rpg/src/app/controller-types.ts rpg/src/game/world/settle-encounter.ts rpg/src/app/world-campaign-controller.test.ts
git commit -m "feat: auto-play world battles with cumulative battle log"
```

---

### Task 2: 战斗视图日志面板

**Files:**
- Modify: `rpg/src/vscode/messages.ts`（`BattleViewSnapshot` 增加 `battleLog`）
- Modify: `rpg/src/vscode/game-session.ts`（快照映射带过 battleLog；若映射集中在他处则改对应处）
- Create: `rpg/src/vscode/webview/battle-log.ts`（事件 → 文案）
- Modify: `rpg/src/vscode/webview/render-game.ts`（渲染日志面板）
- Test: `rpg/src/vscode/webview/render-game.test.ts`（新建，若不存在）

**Interfaces:**
- Consumes: `WorldBattleSnapshot.battleLog: readonly BattleEvent[]`。
- Produces: `formatBattleEvents(events: readonly BattleEvent[]): readonly string[]`。

- [ ] **Step 1: 写失败测试**（jsdom 挂载 `renderGame`，快照含两条事件，断言日志面板渲染对应文案并追加到底部）

- [ ] **Step 2: 确认失败**：`npx vitest run src/vscode/webview/render-game.test.ts`

- [ ] **Step 3: 实现**

`battle-log.ts`：

```ts
import type { BattleEvent } from "../../game/combat/types";

const unitName = (id: string): string => (id === "hazard" ? "酸沼" : id);

export function formatBattleEvents(events: readonly BattleEvent[]): readonly string[] {
  const lines: string[] = [];
  for (const event of events) {
    const p = event.payload;
    switch (event.type) {
      case "moved": lines.push(`${p.actorId} 移动到 (${(p.to as { x: number }).x}, ${(p.to as { x: number }).y})`); break;
      case "damaged": lines.push(`${unitName(String(p.sourceId))} 对 ${p.targetId} 造成 ${p.amount} 点伤害（剩余 ${p.hpAfter}）`); break;
      case "healed": lines.push(`${p.sourceId} 为 ${p.targetId} 恢复 ${p.amount} 点生命（剩余 ${p.hpAfter}）`); break;
      case "unit_disabled": lines.push(`${p.unitId} 被消灭`); break;
      case "objective_progressed": if (p.completed === true) lines.push(`目标 ${p.targetId} 已激活`); break;
      case "interacted": lines.push(`${p.actorId} 与 ${p.targetId} 交互`); break;
      case "battle_finished": lines.push(p.outcome === "won" ? "战斗胜利" : "战斗失败"); break;
      default: break; // turn_advanced/cooldown/status 类不进日志面板
    }
  }
  return lines;
}
```

`render-game.ts`：`renderGame` 在 `renderMain` 与 `renderFeedback` 之间插入 `renderBattleLog(snapshot)`（仅 battle 模式且有日志时）；面板为 `<section class="battle-log" aria-live="polite">` 内 `<ul>`，渲染后 `panel.scrollTop = panel.scrollHeight`。

`messages.ts` `BattleViewSnapshot` 增加 `battleLog: readonly BattleEvent[]`，session/extension 快照投影处带过（`game-session.ts` 的映射函数补字段）。

- [ ] **Step 4: 测试通过 + 全量**：`npm test`
- [ ] **Step 5: 提交**：`feat: render battle event log panel`

---

### Task 3: starter 注释与按钮文案

**Files:**
- Modify: `rpg/src/game/content/python/python-marsh-01.ts`（`choose_turn` 注释段、guidance 文案）
- Modify: `rpg/src/vscode/webview/render-game.ts`（按钮文案）

- [ ] **Step 1: 重写 `choose_turn` 注释**（每行 ≤60 字符；示例强调"函数会被连续调用、world 每回合变化、静态命令在目标死后报错"）：

```python
def choose_turn(world):
    # 点一次运行后，本函数会被连续调用直到战斗结束。
    # 每回合 world 都会变化，revision 也在变。
    # 静态命令在目标死亡后会报错，需要读状态做选择。
    # world["units"] 是单位列表，每个单位有：
    #   id、team、hp、disabled 和 cell（{"x": int, "y": int}）。
    # 选一个活着的敌人：
    # enemy = None
    # for unit in world["units"]:
    #     if unit["team"] == "enemies" and not unit["disabled"]:
    #         enemy = unit
    #         break
    # return {
    #     "actorId": world["activeUnitId"],
    #     "expectedRevision": world["revision"],
    #     "action": {"type": "attack", "targetId": enemy["id"]},
    # }
    return {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "action": {"type": "wait"},
    }
```

> 保留原有 movePath/action 格式说明中仍然正确的行，删除"每回合手动运行"语境的行；`levels.test.ts` 的 60 字符与正则断言必须过。

- [ ] **Step 2: 按钮文案**：`render-game.ts` 中 `commandButton("runTurn", "运行回合")` → `"运行回合（自动连续）"`。
- [ ] **Step 3: 全量测试**：`npm test`（`world-campaign-controller.test.ts:201` 等包含式断言应仍过）。
- [ ] **Step 4: 提交**：`feat: teach autonomous battle in starter comments`

---

### Task 4: 键控单位层与事件动画

**Files:**
- Modify: `rpg/src/vscode/webview/render-game.ts`（单位移入覆盖层、事件差分触发）
- Modify: `rpg/src/styles/game.css`（动画样式）
- Test: `rpg/src/vscode/webview/render-game.test.ts`

**Interfaces:**
- Consumes: `BattleViewSnapshot.battleLog`（seq 递增）、`battleState.units`、frame 的 `--cell-size`。

- [ ] **Step 1: 写失败测试**

同一 `renderGame` 挂载下先后渲染两个快照（battleLog 增量含 `moved` + `damaged`）：断言 (a) 单位 token DOM 节点身份保持（`toBe` 同一引用）且 `dataset.x` 更新；(b) 受击单位获得 `anim-hit` class、攻击者获得 `anim-lunge` class；(c) 出现浮动伤害元素 `span.damage-float`。

- [ ] **Step 2: 确认失败**

- [ ] **Step 3: 实现**

`render-game.ts`：

1. 模块级渲染状态（battleId 变化时重置）：

```ts
type BattleRenderState = {
  battleId: string;
  unitTokens: Map<string, HTMLSpanElement>;
  lastSeq: number;
};
let battleRender: BattleRenderState | undefined;
```

2. `renderCell` 不再追加单位 token（保留地形/目标/aria，aria 里的单位描述移除避免重复）；新增 `renderUnits(state, frame)`：`units-layer` 绝对定位覆盖网格，按 `unitId` 复用 token，位置用 `top/left: calc(var(--cell-size) * y + gap)` 内联样式，transition 走 CSS。禁用单位加 `token-disabled`。
3. 事件差分：`const fresh = snapshot.battleLog.filter((e) => e.seq > (battleRender?.lastSeq ?? 0))`；逐事件：
   - `moved` → token 已由位置更新滑动（无需 class）；
   - `damaged` → 攻击者 token 加 `anim-lunge`（方向由双方 cell 差的内联 `--lx/--ly` 变量给出）、受击者加 `anim-hit`、`units-layer` 追加 `span.damage-float` 定位到受击者（文本 `-${amount}`，`animationend` 后移除，jsdom 无动画则下次渲染清理）；
   - `healed` → `anim-heal` + `+N` 浮动；
   - `unit_disabled` → token 加 `anim-defeat`（保留 `token-disabled`）；
   - `objective_progressed(completed)` / `interacted` → 对应格子加 `anim-objective`（600ms 后移除 class）；
   - 更新 `lastSeq = battleLog 末条 seq`。
4. class 在下次渲染快照时统一清理（新快照重建非单位区域、单位 token 移除动画 class 再按需重加）。

`game.css` 追加（要点）：

```css
.units-layer { position: absolute; inset: 0; pointer-events: none; }
.battle-unit-token { position: absolute; transition: top .3s ease, left .3s ease; }
@keyframes lunge { 0% { transform: translate(0,0); } 50% { transform: translate(calc(var(--lx) * 40%), calc(var(--ly) * 40%)); } 100% { transform: translate(0,0); } }
.anim-lunge { animation: lunge .15s ease-out; }
@keyframes hit-flash { 0%, 100% { filter: none; } 50% { filter: brightness(1.8) sepia(1) hue-rotate(-50deg); } }
.anim-hit { animation: hit-flash .4s ease-out; }
@keyframes float-up { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-24px); } }
.damage-float { position: absolute; animation: float-up .6s ease-out forwards; font-weight: bold; }
.anim-heal .damage-float { color: #3fb950; }
@keyframes defeat { to { opacity: .35; filter: grayscale(1); } }
.anim-defeat { animation: defeat .3s forwards; }
@keyframes objective-pulse { 0%, 100% { box-shadow: none; } 50% { box-shadow: 0 0 0 4px rgba(63, 185, 80, .6); } }
.anim-objective { animation: objective-pulse .6s ease-out; }
```

- [ ] **Step 4: 测试通过 + 全量**：`npm test`
- [ ] **Step 5: 提交**：`feat: animate battle units from engine events`

---

### Task 5: 交付

- [ ] **Step 1:** `cd rpg && npm run install:local`
- [ ] **Step 2:** 提醒用户重载窗口验证：进入守卫战 → 点"运行回合（自动连续）"→ 观察重置到初始局面、逐回合动画与日志滚动、`wait` 静态命令报错停在当前局面。
