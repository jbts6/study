# Python RPG 战役内容 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付六个可加载、可校验、可运行、可保存、可重试且可验证重放的 Python 战役遭遇，并完成两名队友的最小成长闭环和多回合浏览器验收。

**Architecture:** `content/` 只保存版本化 JSON/Python 文本，`decodeCampaignCatalog` 是 Node 与浏览器加载器共享的唯一运行时 schema 边界。内容适配器把关卡 DTO 装配成 combat 计划定义的 `BattleState`，并通过真实 `projectWorldView(state)`、`RunRequest` 与 `resolveTurn` 运行。现有 `AppController` 是唯一交互协调器，注入的 `CampaignLifecyclePort` 负责 accepted turn 的重放、奖励、保存与重试。目标型关卡先通过 content gate，再进入真实 reducer；它们不含敌人，因此现有“无敌人即胜利”规则会真实产生 `phase: "won"`。

**Tech Stack:** 已由前三份计划创建的 Vite 8.2.1、TypeScript 7.0.2、Vitest 4.1.10、Playwright 1.62.1、Pyodide Runner、Web Crypto 与 combat replay API。

## Global Constraints

- 前置提交固定为 `5af955b`；先执行 combat，再执行 runner、app-shell，最后执行本计划。
- 六关 ID/标题固定为：`python-marsh-01/雾径信标`、`python-marsh-02/护甲分流`、`python-marsh-03/节点清册`、`python-marsh-04/默认修复程式`、`python-marsh-05/威胁序列`、`python-marsh-06/递归炉心`。
- `contentVersion` 固定为 `python-slice-1`。不修改 `python/` 课程，不创建 Go/Rust 内容。
- 战斗类型只从 `src/game/combat/types.ts` 导入；`projectWorldView` 只从 `src/game/world/project-world-view.ts` 导入并只接收 `BattleState`。
- `BattleState` 必须精确使用 combat 计划公开的 `turnOrder`、`maxRounds`、数值 RNG、`board.hazardCells`、`unit.cell` 和双方 team 字面量；不得引入任何旧 DTO 字段别名。
- 重放只调用 `createReplay(metadata, initialState)`、`recordAcceptedTurn(replay, before, acceptedResolution)`、`verifyReplay(replay)`；三者均 `await`。`ReplayRecord` 精确为 app-shell 计划的 `{ replayId, questId, createdAt, document }`。
- Runner 只使用 `RunRequest`/`RunResult` 的完整协议字段；任何 fixture 都要填写 `protocolVersion/runId/attemptId/trace/diagnostics/streams/metrics` 和全部八个 limits。
- `node-loader.ts` 可以导入 `node:fs/promises`；`browser-loader.ts`、共享 decoder 和生产浏览器依赖图不得静态导入任何 `node:` 模块。
- 所有 `json` 代码块必须是严格合法 JSON：无注释、无尾随逗号、无 `undefined`。所有内容引用、相对路径、资产、许可快照与摘要均由 checker 实际验证。
- 每个 Task 遵循 TDD，使用独立验证命令并独立提交。命令使用 `npm --prefix rpg ...`，不依赖 shell 命令连接符。

---

## 固定内容与应用接口

以下接口由本计划产出；已有 `BattleState`、`WorldView`、`CommandResolution`、`Replay`、`ReplayRecord`、`SavePayload`、`SaveStore`、`RunRequest`、`RunResult` 不得复制或改名。

```ts
// rpg/src/content/types.ts
import type { BattleState, Cell, MainAction, ReplayMetadata, TurnCommand, WorldView } from "../game/combat/types";
import type { ExecutionLimits, RunRequest } from "../runners/protocol/types";

export const CONTENT_VERSION = "python-slice-1" as const;
export const QUEST_IDS = ["python-marsh-01", "python-marsh-02", "python-marsh-03", "python-marsh-04", "python-marsh-05", "python-marsh-06"] as const;
export type QuestId = (typeof QUEST_IDS)[number];
export type ScenarioName = "initial" | "alternate" | "late-round";
export type Capability = "variables-booleans" | "if-branches" | "loops-collections" | "functions-defaults" | "comprehensions-sorting" | "campaign-synthesis";

export interface ContentWorld {
  id: string;
  board: BattleState["board"];
  units: BattleState["units"];
  objectives: BattleState["objectives"];
  maxRounds: number;
  assetIds: readonly string[];
}
export interface ScenarioPatch {
  hazardCells?: readonly Cell[];
  unitHp?: Readonly<Record<string, number>>;
  unitCells?: Readonly<Record<string, Cell>>;
  objectiveDurability?: Readonly<Record<string, number>>;
  round?: number;
}
export interface HiddenAssertion {
  id: string;
  scenario: ScenarioName;
  patch: ScenarioPatch;
  expected: Omit<TurnCommand, "expectedRevision">;
  expectedOutcome: BattleState["phase"];
}
export interface QuestContent {
  schemaVersion: 1;
  id: QuestId;
  contentVersion: typeof CONTENT_VERSION;
  order: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  capabilityTags: readonly Capability[];
  worldId: string;
  visibleWorldFields: readonly string[];
  allowedModules: readonly string[];
  executionLimits: ExecutionLimits;
  starterPath: string;
  solutionPath: string;
  hiddenAssertions: readonly HiddenAssertion[];
  rewardId: string;
}
export interface CampaignReward { id: string; questId: QuestId; companionUnlock?: "mara" | "bo"; equipmentId: string; skillIds: readonly string[]; }
export interface CampaignManifest { schemaVersion: 1; contentVersion: typeof CONTENT_VERSION; questOrder: readonly QuestId[]; rewards: readonly CampaignReward[]; }
export interface AssetReference { id: string; publicUrl: string; diskPath: string; }
export interface CampaignContent {
  version: typeof CONTENT_VERSION;
  manifest: CampaignManifest;
  worlds: readonly ContentWorld[];
  assets: readonly AssetReference[];
  quests: readonly QuestContent[];
  questById: Readonly<Record<QuestId, QuestContent>>;
  textByPath: Readonly<Record<string, string>>;
}
export interface QuestScenario { state: BattleState; worldView: WorldView; assertion: HiddenAssertion; }
export interface BuildRunRequestInput { questId: QuestId; source: string; worldView: WorldView; runId: string; attemptId: string; }
export interface CampaignAppContentPort {
  questIds(): readonly string[];
  initialBattleFor(questId: string): BattleState;
  worldViewFor(state: BattleState): WorldView;
  replayMetadataFor(questId: string, initialState: BattleState): ReplayMetadata;
  readContentText(path: string): string;
  buildRunRequest(input: BuildRunRequestInput): RunRequest;
  gateCommand(questId: string, state: BattleState, input: unknown): ContentGateResult;
}
export type ContentGateResult = { ok: true; input: unknown } | { ok: false; code: "CONTENT_GATE_REJECTED" | "HIDDEN_ASSERTION_FAILED"; message: string };
export type ReadContentText = (path: string) => string;
export type ActionExpectation = { actorId: string; movePath?: readonly Cell[]; action: MainAction };
```

### Task 1: 共享严格 decoder、双加载器与合法 BattleState 装配

**Files:**
- Create: `rpg/src/content/types.ts`
- Create: `rpg/src/content/decode-campaign.ts`
- Create: `rpg/src/content/node-loader.ts`
- Create: `rpg/src/content/browser-loader.ts`
- Create: `rpg/src/content/assemble-battle-state.ts`
- Create: `rpg/src/content/decode-campaign.test.ts`
- Create: `rpg/src/content/assemble-battle-state.test.ts`

**Interfaces:**
- Produces `decodeCampaignCatalog(catalog)`, `loadCampaignContentForNode(root)`, `loadCampaignContentForBrowser()`, `assembleBattleState(content, questId, assertion)`, `createQuestScenario(content, questId, scenario)`。
- Consumes exact combat `BattleState` and `projectWorldView(state)`；两个 loader 必须调用同一个 decoder。

- [ ] **Step 1: 写失败测试，锁定共享 decoder、严格字段和浏览器依赖边界。**

```ts
// rpg/src/content/decode-campaign.test.ts
import { describe, expect, it } from "vitest";
import { decodeCampaignCatalog } from "./decode-campaign";

const minimalCatalog = (): Record<string, string> => ({
  "shared/campaign.json": JSON.stringify({ schemaVersion: 1, contentVersion: "python-slice-1", questOrder: ["python-marsh-01"], rewards: [{ id: "reward-01", questId: "python-marsh-01", equipmentId: "lens", skillIds: [] }] }),
  "shared/worlds.json": JSON.stringify({ schemaVersion: 1, worlds: [{ id: "world-01", board: { width: 3, height: 2, blockedCells: [], hazardCells: [], coverCells: [], hazardDamage: 1 }, units: [{ id: "scout", team: "allies", visibility: "revealed", cell: { x: 0, y: 0 }, hp: 8, maxHp: 8, attack: 3, defense: 0, move: 3, initiative: 9, disabled: false, skills: [], statuses: [] }], objectives: [], maxRounds: 4, assetIds: ["floor"] }] }),
  "shared/assets.json": JSON.stringify({ schemaVersion: 1, assets: [{ id: "floor", publicUrl: "/assets/tiny-swords/floor.png", diskPath: "tiny-swords/floor.png" }] }),
  "python/python-marsh-01/quest.json": JSON.stringify({ schemaVersion: 1, id: "python-marsh-01", contentVersion: "python-slice-1", order: 1, title: "雾径信标", capabilityTags: ["variables-booleans"], worldId: "world-01", visibleWorldFields: ["revision"], allowedModules: [], executionLimits: { timeoutMs: 2000, interruptGraceMs: 100, maxFiles: 1, maxFileBytes: 65536, maxSourceBytes: 65536, maxOutputBytes: 16384, maxTraceEvents: 1000, maxValueDepth: 4 }, starterPath: "python/python-marsh-01/starter.py", solutionPath: "python/python-marsh-01/solution.py", hiddenAssertions: [{ id: "initial", scenario: "initial", patch: {}, expected: { actorId: "scout", action: { type: "wait" } }, expectedOutcome: "won" }], rewardId: "reward-01" }),
  "python/python-marsh-01/starter.py": "def choose_turn(world):\n    return {'actorId': world['activeUnitId'], 'expectedRevision': world['revision'], 'action': {'type': 'wait'}}\n",
  "python/python-marsh-01/solution.py": "def choose_turn(world):\n    return {'actorId': world['activeUnitId'], 'expectedRevision': world['revision'], 'action': {'type': 'wait'}}\n",
});

describe("decodeCampaignCatalog", () => {
  it("returns a deeply frozen catalog and exact six-id mode can be enforced by checker", () => {
    const content = decodeCampaignCatalog(minimalCatalog());
    expect(content.quests[0]?.title).toBe("雾径信标");
    expect(Object.isFrozen(content.quests[0]?.executionLimits)).toBe(true);
    expect(content.textByPath["python/python-marsh-01/starter.py"]).toContain("choose_turn");
  });
  it.each([
    ["unknown field", (value: any) => { value.extra = true; }, "CONTENT_UNKNOWN_FIELD"],
    ["bad nested cell", (value: any) => { value.worldId = 7; }, "CONTENT_TYPE_MISMATCH"],
    ["missing referenced text", (_value: any, catalog: Record<string, string>) => { delete catalog["python/python-marsh-01/starter.py"]; }, "CONTENT_FILE_MISSING"],
  ])("rejects %s", (_name, mutate, code) => {
    const catalog = minimalCatalog(); const quest = JSON.parse(catalog["python/python-marsh-01/quest.json"]!); mutate(quest, catalog); catalog["python/python-marsh-01/quest.json"] = JSON.stringify(quest);
    expect(() => decodeCampaignCatalog(catalog)).toThrow(code);
  });
});
```

- [ ] **Step 2: 运行测试并确认 decoder 不存在。**

Run: `npm --prefix rpg run test -- src/content/decode-campaign.test.ts`

Expected: FAIL，`decode-campaign.ts` 尚不存在。

- [ ] **Step 3: 实现完整共享 runtime decoder。**

`decode-campaign.ts` 必须用以下完整字段集合逐层解码；任何对象都先 `exact`，不得 `as QuestContent` 后跳过嵌套校验：

```ts
// rpg/src/content/decode-campaign.ts
import { CONTENT_VERSION, QUEST_IDS, type AssetReference, type CampaignContent, type CampaignManifest, type CampaignReward, type ContentWorld, type HiddenAssertion, type QuestContent, type QuestId, type ScenarioPatch } from "./types";
import type { BattleState, Cell, MainAction, Skill, Status } from "../game/combat/types";
import type { ExecutionLimits } from "../runners/protocol/types";

type Dict = Record<string, unknown>;
const fail = (code: string, path: string): never => { throw new Error(`${code}:${path}`); };
const object = (value: unknown, path: string): Dict => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Dict : fail("CONTENT_TYPE_MISMATCH", path);
const exact = (value: unknown, keys: readonly string[], path: string): Dict => { const record = object(value, path); for (const key of Object.keys(record)) if (!keys.includes(key)) fail("CONTENT_UNKNOWN_FIELD", `${path}.${key}`); for (const key of keys) if (!(key in record)) fail("CONTENT_FIELD_MISSING", `${path}.${key}`); return record; };
const string = (value: unknown, path: string): string => typeof value === "string" && value.length > 0 ? value : fail("CONTENT_TYPE_MISMATCH", path);
const integer = (value: unknown, path: string, min = 0): number => Number.isSafeInteger(value) && (value as number) >= min ? value as number : fail("CONTENT_TYPE_MISMATCH", path);
const boolean = (value: unknown, path: string): boolean => typeof value === "boolean" ? value : fail("CONTENT_TYPE_MISMATCH", path);
const array = <T>(value: unknown, path: string, decode: (item: unknown, path: string) => T): T[] => Array.isArray(value) ? value.map((item, index) => decode(item, `${path}[${index}]`)) : fail("CONTENT_TYPE_MISMATCH", path);
const enumeration = <T extends string>(value: unknown, values: readonly T[], path: string): T => typeof value === "string" && values.includes(value as T) ? value as T : fail("CONTENT_ENUM_INVALID", path);
const enumerationNumber = <T extends number>(value: unknown, values: readonly T[], path: string): T => typeof value === "number" && values.includes(value as T) ? value as T : fail("CONTENT_ENUM_INVALID", path);
const optional = <T>(record: Dict, key: string, path: string, decode: (value: unknown, path: string) => T): T | undefined => key in record ? decode(record[key], `${path}.${key}`) : undefined;
const cell = (value: unknown, path: string): Cell => { const r = exact(value, ["x", "y"], path); return { x: integer(r.x, `${path}.x`), y: integer(r.y, `${path}.y`) }; };
const stringArray = (value: unknown, path: string): string[] => array(value, path, string);
const numberRecord = (value: unknown, path: string): Record<string, number> => Object.fromEntries(Object.entries(object(value, path)).map(([key, item]) => [key, integer(item, `${path}.${key}`)]));
const cellRecord = (value: unknown, path: string): Record<string, Cell> => Object.fromEntries(Object.entries(object(value, path)).map(([key, item]) => [key, cell(item, `${path}.${key}`)]));

function status(value: unknown, path: string): Status { const r = exact(value, ["id", "remainingTurns", "defenseBonus"], path); return { id: string(r.id, `${path}.id`), remainingTurns: integer(r.remainingTurns, `${path}.remainingTurns`), defenseBonus: integer(r.defenseBonus, `${path}.defenseBonus`) }; }
function skill(value: unknown, path: string): Skill { const r = object(value, path); const keys = ["id", "range", "power", "cooldown", "remainingCooldown", "target", "kind", ...(r.effect === undefined ? [] : ["effect"])]; exact(value, keys, path); const effect = r.effect === undefined ? undefined : (() => { const e = object(r.effect, `${path}.effect`); const ek = ["statusId", "duration", "defenseBonus", ...(e.chancePermille === undefined ? [] : ["chancePermille"])]; exact(e, ek, `${path}.effect`); return { statusId: string(e.statusId, `${path}.effect.statusId`), duration: integer(e.duration, `${path}.effect.duration`, 1), defenseBonus: integer(e.defenseBonus, `${path}.effect.defenseBonus`), ...(e.chancePermille === undefined ? {} : { chancePermille: integer(e.chancePermille, `${path}.effect.chancePermille`) }) }; })(); return { id: string(r.id, `${path}.id`), range: integer(r.range, `${path}.range`), power: integer(r.power, `${path}.power`), cooldown: integer(r.cooldown, `${path}.cooldown`), remainingCooldown: integer(r.remainingCooldown, `${path}.remainingCooldown`), target: enumeration(r.target, ["unit", "cell"] as const, `${path}.target`), kind: enumeration(r.kind, ["damage", "heal"] as const, `${path}.kind`), ...(effect ? { effect } : {}) }; }
function unit(value: unknown, path: string): BattleState["units"][number] { const r = exact(value, ["id", "team", "visibility", "cell", "hp", "maxHp", "attack", "defense", "move", "initiative", "disabled", "skills", "statuses"], path); return { id: string(r.id, `${path}.id`), team: enumeration(r.team, ["allies", "enemies"] as const, `${path}.team`), visibility: enumeration(r.visibility, ["revealed", "hidden"] as const, `${path}.visibility`), cell: cell(r.cell, `${path}.cell`), hp: integer(r.hp, `${path}.hp`), maxHp: integer(r.maxHp, `${path}.maxHp`, 1), attack: integer(r.attack, `${path}.attack`), defense: integer(r.defense, `${path}.defense`), move: integer(r.move, `${path}.move`), initiative: integer(r.initiative, `${path}.initiative`), disabled: boolean(r.disabled, `${path}.disabled`), skills: array(r.skills, `${path}.skills`, skill), statuses: array(r.statuses, `${path}.statuses`, status) }; }
function objective(value: unknown, path: string): BattleState["objectives"][number] { const r = exact(value, ["id", "cell", "durability", "completed", "key"], path); return { id: string(r.id, `${path}.id`), cell: cell(r.cell, `${path}.cell`), durability: integer(r.durability, `${path}.durability`), completed: boolean(r.completed, `${path}.completed`), key: boolean(r.key, `${path}.key`) }; }
function board(value: unknown, path: string): BattleState["board"] { const r = exact(value, ["width", "height", "blockedCells", "hazardCells", "coverCells", "hazardDamage"], path); return { width: integer(r.width, `${path}.width`, 1), height: integer(r.height, `${path}.height`, 1), blockedCells: array(r.blockedCells, `${path}.blockedCells`, cell), hazardCells: array(r.hazardCells, `${path}.hazardCells`, cell), coverCells: array(r.coverCells, `${path}.coverCells`, cell), hazardDamage: integer(r.hazardDamage, `${path}.hazardDamage`) }; }
function mainAction(value: unknown, path: string): MainAction { const r = object(value, path); const type = enumeration(r.type, ["attack", "cast", "interact", "guard", "wait"] as const, `${path}.type`); if (type === "attack" || type === "interact") { exact(r, ["type", "targetId"], path); return { type, targetId: string(r.targetId, `${path}.targetId`) }; } if (type === "guard" || type === "wait") { exact(r, ["type"], path); return { type }; } const keys = ["type", "skillId", ...(r.targetId === undefined ? [] : ["targetId"]), ...(r.targetCell === undefined ? [] : ["targetCell"])]; exact(r, keys, path); const targetId = optional(r, "targetId", path, string); const targetCell = optional(r, "targetCell", path, cell); if ((targetId === undefined) === (targetCell === undefined)) fail("CONTENT_TARGET_SHAPE", path); return { type: "cast", skillId: string(r.skillId, `${path}.skillId`), ...(targetId ? { targetId } : { targetCell: targetCell! }) }; }
function patch(value: unknown, path: string): ScenarioPatch { const r = object(value, path); const keys = Object.keys(r); for (const key of keys) if (!["hazardCells", "unitHp", "unitCells", "objectiveDurability", "round"].includes(key)) fail("CONTENT_UNKNOWN_FIELD", `${path}.${key}`); return { ...(r.hazardCells === undefined ? {} : { hazardCells: array(r.hazardCells, `${path}.hazardCells`, cell) }), ...(r.unitHp === undefined ? {} : { unitHp: numberRecord(r.unitHp, `${path}.unitHp`) }), ...(r.unitCells === undefined ? {} : { unitCells: cellRecord(r.unitCells, `${path}.unitCells`) }), ...(r.objectiveDurability === undefined ? {} : { objectiveDurability: numberRecord(r.objectiveDurability, `${path}.objectiveDurability`) }), ...(r.round === undefined ? {} : { round: integer(r.round, `${path}.round`, 1) }) }; }
function assertion(value: unknown, path: string): HiddenAssertion { const r = exact(value, ["id", "scenario", "patch", "expected", "expectedOutcome"], path); const expected = object(r.expected, `${path}.expected`); exact(expected, ["actorId", ...(expected.movePath === undefined ? [] : ["movePath"]), "action"], `${path}.expected`); return { id: string(r.id, `${path}.id`), scenario: enumeration(r.scenario, ["initial", "alternate", "late-round"] as const, `${path}.scenario`), patch: patch(r.patch, `${path}.patch`), expected: { actorId: string(expected.actorId, `${path}.expected.actorId`), ...(expected.movePath === undefined ? {} : { movePath: array(expected.movePath, `${path}.expected.movePath`, cell) }), action: mainAction(expected.action, `${path}.expected.action`) }, expectedOutcome: enumeration(r.expectedOutcome, ["in_progress", "won", "lost"] as const, `${path}.expectedOutcome`) }; }
function limits(value: unknown, path: string): ExecutionLimits { const r = exact(value, ["timeoutMs", "interruptGraceMs", "maxFiles", "maxFileBytes", "maxSourceBytes", "maxOutputBytes", "maxTraceEvents", "maxValueDepth"], path); return { timeoutMs: integer(r.timeoutMs, `${path}.timeoutMs`, 1), interruptGraceMs: integer(r.interruptGraceMs, `${path}.interruptGraceMs`, 1), maxFiles: integer(r.maxFiles, `${path}.maxFiles`, 1), maxFileBytes: integer(r.maxFileBytes, `${path}.maxFileBytes`, 1), maxSourceBytes: integer(r.maxSourceBytes, `${path}.maxSourceBytes`, 1), maxOutputBytes: integer(r.maxOutputBytes, `${path}.maxOutputBytes`, 1), maxTraceEvents: integer(r.maxTraceEvents, `${path}.maxTraceEvents`, 1), maxValueDepth: integer(r.maxValueDepth, `${path}.maxValueDepth`, 1) }; }
function quest(value: unknown, path: string): QuestContent { const r = exact(value, ["schemaVersion", "id", "contentVersion", "order", "title", "capabilityTags", "worldId", "visibleWorldFields", "allowedModules", "executionLimits", "starterPath", "solutionPath", "hiddenAssertions", "rewardId"], path); if (r.schemaVersion !== 1 || r.contentVersion !== CONTENT_VERSION) fail("CONTENT_VERSION_INVALID", path); return { schemaVersion: 1, id: enumeration(r.id, QUEST_IDS, `${path}.id`), contentVersion: CONTENT_VERSION, order: enumerationNumber(r.order, [1, 2, 3, 4, 5, 6] as const, `${path}.order`), title: string(r.title, `${path}.title`), capabilityTags: array(r.capabilityTags, `${path}.capabilityTags`, (item, itemPath) => enumeration(item, ["variables-booleans", "if-branches", "loops-collections", "functions-defaults", "comprehensions-sorting", "campaign-synthesis"] as const, itemPath)), worldId: string(r.worldId, `${path}.worldId`), visibleWorldFields: stringArray(r.visibleWorldFields, `${path}.visibleWorldFields`), allowedModules: stringArray(r.allowedModules, `${path}.allowedModules`), executionLimits: limits(r.executionLimits, `${path}.executionLimits`), starterPath: string(r.starterPath, `${path}.starterPath`), solutionPath: string(r.solutionPath, `${path}.solutionPath`), hiddenAssertions: array(r.hiddenAssertions, `${path}.hiddenAssertions`, assertion), rewardId: string(r.rewardId, `${path}.rewardId`) }; }
function parse(catalog: Record<string, string>, path: string): unknown { const text = catalog[path]; if (text === undefined) fail("CONTENT_FILE_MISSING", path); try { return JSON.parse(text); } catch { return fail("CONTENT_JSON_INVALID", path); } }

export function decodeCampaignCatalog(catalog: Record<string, string>): CampaignContent {
  const manifestRaw = exact(parse(catalog, "shared/campaign.json"), ["schemaVersion", "contentVersion", "questOrder", "rewards"], "shared/campaign.json");
  if (manifestRaw.schemaVersion !== 1 || manifestRaw.contentVersion !== CONTENT_VERSION) fail("CONTENT_VERSION_INVALID", "shared/campaign.json");
  const questOrder = array(manifestRaw.questOrder, "shared/campaign.json.questOrder", (item, path) => enumeration(item, QUEST_IDS, path));
  const rewards = array(manifestRaw.rewards, "shared/campaign.json.rewards", (value, path): CampaignReward => { const r = object(value, path); const keys = ["id", "questId", ...(r.companionUnlock === undefined ? [] : ["companionUnlock"]), "equipmentId", "skillIds"]; exact(r, keys, path); return { id: string(r.id, `${path}.id`), questId: enumeration(r.questId, QUEST_IDS, `${path}.questId`), ...(r.companionUnlock === undefined ? {} : { companionUnlock: enumeration(r.companionUnlock, ["mara", "bo"] as const, `${path}.companionUnlock`) }), equipmentId: string(r.equipmentId, `${path}.equipmentId`), skillIds: stringArray(r.skillIds, `${path}.skillIds`) }; });
  const worldsRaw = exact(parse(catalog, "shared/worlds.json"), ["schemaVersion", "worlds"], "shared/worlds.json"); if (worldsRaw.schemaVersion !== 1) fail("CONTENT_VERSION_INVALID", "shared/worlds.json");
  const worlds = array(worldsRaw.worlds, "shared/worlds.json.worlds", (value, path): ContentWorld => { const r = exact(value, ["id", "board", "units", "objectives", "maxRounds", "assetIds"], path); return { id: string(r.id, `${path}.id`), board: board(r.board, `${path}.board`), units: array(r.units, `${path}.units`, unit), objectives: array(r.objectives, `${path}.objectives`, objective), maxRounds: integer(r.maxRounds, `${path}.maxRounds`, 1), assetIds: stringArray(r.assetIds, `${path}.assetIds`) }; });
  const assetsRaw = exact(parse(catalog, "shared/assets.json"), ["schemaVersion", "assets"], "shared/assets.json"); if (assetsRaw.schemaVersion !== 1) fail("CONTENT_VERSION_INVALID", "shared/assets.json");
  const assets = array(assetsRaw.assets, "shared/assets.json.assets", (value, path): AssetReference => { const r = exact(value, ["id", "publicUrl", "diskPath"], path); return { id: string(r.id, `${path}.id`), publicUrl: string(r.publicUrl, `${path}.publicUrl`), diskPath: string(r.diskPath, `${path}.diskPath`) }; });
  const quests = questOrder.map((id) => quest(parse(catalog, `python/${id}/quest.json`), `python/${id}/quest.json`));
  for (const item of quests) for (const path of [item.starterPath, item.solutionPath]) if (catalog[path] === undefined) fail("CONTENT_FILE_MISSING", path);
  const questById = Object.fromEntries(quests.map((item) => [item.id, item])) as Record<QuestId, QuestContent>;
  const manifest: CampaignManifest = { schemaVersion: 1, contentVersion: CONTENT_VERSION, questOrder, rewards };
  return deepFreeze({ version: CONTENT_VERSION, manifest, worlds, assets, quests, questById, textByPath: { ...catalog } });
}
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }
```

- [ ] **Step 4: 实现两个薄 loader；Node 读取固定目录，浏览器只消费 Vite raw catalog。**

```ts
// rpg/src/content/node-loader.ts
import { readFile } from "node:fs/promises";
import { decodeCampaignCatalog } from "./decode-campaign";
import { QUEST_IDS } from "./types";
export async function loadCampaignContentForNode(root: URL) {
  const safeTextPath = (path: string) => /^python\/python-marsh-0[1-6]\/[a-z-]+\.py$/.test(path) && !path.includes("..") && !path.includes("\\") && !path.startsWith("/");
  const read = async (path: string) => { try { return await readFile(new URL(path, root), "utf8"); } catch { throw new Error(`CONTENT_FILE_MISSING:${path}`); } };
  const catalog: Record<string, string> = {};
  for (const path of ["shared/campaign.json", "shared/worlds.json", "shared/assets.json"]) catalog[path] = await read(path);
  for (const id of QUEST_IDS) {
    const questPath = `python/${id}/quest.json`; catalog[questPath] = await read(questPath);
    const raw = JSON.parse(catalog[questPath]) as Record<string, unknown>;
    for (const key of ["starterPath", "solutionPath"] as const) { const path = raw[key]; if (typeof path !== "string") throw new Error(`CONTENT_TYPE_MISMATCH:${questPath}.${key}`); if (!safeTextPath(path)) throw new Error(`CONTENT_PATH_UNSAFE:${path}`); catalog[path] = await read(path); }
  }
  return decodeCampaignCatalog(catalog);
}
```

```ts
// rpg/src/content/browser-loader.ts
import { decodeCampaignCatalog } from "./decode-campaign";
const modules = import.meta.glob("../../content/**/*.{json,py}", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
export function loadCampaignContentForBrowser() {
  const prefix = "../../content/";
  return decodeCampaignCatalog(Object.fromEntries(Object.entries(modules).map(([path, text]) => [path.slice(path.indexOf(prefix) + prefix.length), text])));
}
```

- [ ] **Step 5: 写装配失败测试并实现精确 BattleState。**

测试必须断言：`rngState` 是无符号整数、`turnOrder` 按 initiative/id 排序、`maxRounds` 存在、只出现 `hazardCells`、`projectWorldView(state)` 不泄漏 RNG；未知 patch 引用失败。

```ts
// rpg/src/content/assemble-battle-state.ts
import { projectWorldView } from "../game/world/project-world-view";
import type { BattleState } from "../game/combat/types";
import type { CampaignContent, HiddenAssertion, QuestId, QuestScenario, ScenarioName } from "./types";
const seedFor = (questId: string): number => [...new TextEncoder().encode(questId)].reduce((state, byte) => Math.imul(state ^ byte, 16777619) >>> 0, 2166136261) || 1;
export function assembleBattleState(content: CampaignContent, questId: QuestId, assertion: HiddenAssertion): BattleState {
  const quest = content.questById[questId]; const world = content.worlds.find((item) => item.id === quest.worldId); if (!world) throw new Error(`WORLD_NOT_FOUND:${quest.worldId}`);
  const unitIds = new Set(world.units.map((unit) => unit.id)); const objectiveIds = new Set(world.objectives.map((item) => item.id));
  for (const id of Object.keys(assertion.patch.unitHp ?? {})) if (!unitIds.has(id)) throw new Error(`PATCH_UNIT_UNKNOWN:${id}`);
  for (const id of Object.keys(assertion.patch.unitCells ?? {})) if (!unitIds.has(id)) throw new Error(`PATCH_UNIT_UNKNOWN:${id}`);
  for (const id of Object.keys(assertion.patch.objectiveDurability ?? {})) if (!objectiveIds.has(id)) throw new Error(`PATCH_OBJECTIVE_UNKNOWN:${id}`);
  const units = world.units.map((unit) => { const hp = assertion.patch.unitHp?.[unit.id] ?? unit.hp; return { ...structuredClone(unit), hp, cell: assertion.patch.unitCells?.[unit.id] ?? unit.cell, disabled: hp === 0 }; });
  const objectives = world.objectives.map((item) => { const durability = assertion.patch.objectiveDurability?.[item.id] ?? item.durability; return { ...structuredClone(item), durability, completed: durability === 0 }; });
  const turnOrder = [...units].sort((left, right) => right.initiative - left.initiative || left.id.localeCompare(right.id)).map((unit) => unit.id);
  const actorIndex = turnOrder.indexOf(assertion.expected.actorId); if (actorIndex < 0) throw new Error(`ASSERTION_ACTOR_UNKNOWN:${assertion.expected.actorId}`);
  return { battleId: quest.id, contentVersion: quest.contentVersion, revision: 0, round: assertion.patch.round ?? 1, turnIndex: actorIndex, turnOrder, phase: "in_progress", units, board: { ...structuredClone(world.board), hazardCells: assertion.patch.hazardCells ?? world.board.hazardCells }, objectives, rngState: seedFor(quest.id), maxRounds: world.maxRounds, failureConditions: { keyObjectiveDestroyed: false } };
}
export function createQuestScenario(content: CampaignContent, questId: QuestId, scenario: ScenarioName): QuestScenario {
  const assertion = content.questById[questId].hiddenAssertions.find((item) => item.scenario === scenario); if (!assertion) throw new Error(`SCENARIO_NOT_FOUND:${questId}:${scenario}`);
  const state = assembleBattleState(content, questId, assertion); return { state, worldView: projectWorldView(state), assertion };
}
```

Run: `npm --prefix rpg run test -- src/content/decode-campaign.test.ts src/content/assemble-battle-state.test.ts`

Run: `npm --prefix rpg run build`

Expected: PASS；浏览器依赖图无 `node:` 模块，所有状态字段与 combat 契约一致。

- [ ] **Step 6: 提交共享内容边界。**

```bash
git add rpg/src/content/types.ts rpg/src/content/decode-campaign.ts rpg/src/content/node-loader.ts rpg/src/content/browser-loader.ts rpg/src/content/assemble-battle-state.ts rpg/src/content/decode-campaign.test.ts rpg/src/content/assemble-battle-state.test.ts
git commit -m "feat: add strict campaign content boundary"
```

### Task 2: 严格 JSON、幂等奖励与全引用/路径/许可检查器

**Files:**
- Create: `rpg/content/shared/campaign.json`
- Create: `rpg/content/shared/worlds.json`
- Create: `rpg/content/shared/assets.json`
- Create: `rpg/src/game/progression/progression.ts`
- Create: `rpg/src/game/progression/progression.test.ts`
- Create: `rpg/tools/content-check/index.ts`
- Create: `rpg/tools/content-check/index.test.ts`
- Create: `rpg/ASSET-LICENSES.json`
- Create: `rpg/ASSET-LICENSES.md`
- Modify: `rpg/package.json`
- Modify: `rpg/package-lock.json`

**Interfaces:**
- Produces `applyQuestReward(progress, reward)` and `checkContent({ contentRoot, assetsRoot, ledgerUrl, writeHashes })`。
- Checker 验证 manifest、quest/world/reward、starter/solution、scenario patch、资产引用、public URL、磁盘路径、许可快照、许可文件引用及 SHA-256；不得只验证数量。

- [ ] **Step 1: 写幂等奖励和 checker 失败测试。**

```ts
// rpg/src/game/progression/progression.test.ts
import { expect, it } from "vitest";
import { applyQuestReward } from "./progression";
const progress = { completedQuestIds: [], unlockedSkillIds: [], equipmentIds: [] };
const reward = { id: "reward-02", questId: "python-marsh-02", companionUnlock: "mara" as const, equipmentId: "signal-lens", skillIds: ["pinpoint-shot"] };
it("applies a reward exactly once", () => {
  const once = applyQuestReward(progress, reward); const twice = applyQuestReward(once, reward);
  expect(twice).toEqual(once); expect(once).toEqual({ completedQuestIds: ["python-marsh-02"], unlockedSkillIds: ["companion:mara", "pinpoint-shot"], equipmentIds: ["signal-lens"] });
});
```

```ts
// rpg/tools/content-check/index.test.ts
it.each(["QUEST_ORDER_INVALID", "WORLD_REFERENCE_MISSING", "REWARD_REFERENCE_MISSING", "TEXT_PATH_UNSAFE", "TEXT_FILE_MISSING", "PATCH_REFERENCE_MISSING", "ASSET_REFERENCE_MISSING", "ASSET_PATH_UNSAFE", "ASSET_FILE_MISSING", "ASSET_LICENSE_MISSING", "ASSET_LICENSE_SNAPSHOT_MISSING", "ASSET_HASH_MISMATCH"])("reports %s with an executable fixture", async (code) => {
  const report = await checkContent(fixtureOptions(code));
  expect(report.errors.map((item) => item.code)).toContain(code);
});
```

- [ ] **Step 2: 写入严格合法的 shared JSON。**

```json
{"schemaVersion":1,"contentVersion":"python-slice-1","questOrder":["python-marsh-01","python-marsh-02","python-marsh-03","python-marsh-04","python-marsh-05","python-marsh-06"],"rewards":[{"id":"reward-01","questId":"python-marsh-01","equipmentId":"signal-lens","skillIds":["route-sense"]},{"id":"reward-02","questId":"python-marsh-02","companionUnlock":"mara","equipmentId":"splitter-plate","skillIds":["pinpoint-shot"]},{"id":"reward-03","questId":"python-marsh-03","equipmentId":"node-ledger","skillIds":["node-index"]},{"id":"reward-04","questId":"python-marsh-04","companionUnlock":"bo","equipmentId":"repair-kit","skillIds":["field-repair"]},{"id":"reward-05","questId":"python-marsh-05","equipmentId":"threat-rune","skillIds":["threat-sort"]},{"id":"reward-06","questId":"python-marsh-06","equipmentId":"core-key","skillIds":["recursive-break"]}]}
```

```json
{"schemaVersion":1,"assets":[{"id":"floor","publicUrl":"/assets/tiny-swords/floor.png","diskPath":"tiny-swords/floor.png"},{"id":"allies","publicUrl":"/assets/tiny-swords/allies.png","diskPath":"tiny-swords/allies.png"},{"id":"enemy","publicUrl":"/assets/tiny-swords/enemy.png","diskPath":"tiny-swords/enemy.png"},{"id":"objective","publicUrl":"/assets/tiny-swords/objective.png","diskPath":"tiny-swords/objective.png"}]}
```

`worlds.json` 使用以下完整、合法数据。01/03/04 无 `enemies`；它们通过真实 reducer 的“无敌人”规则获胜。其余关卡至少有一个敌人。

```json
{"schemaVersion":1,"worlds":[{"id":"world-01","board":{"width":4,"height":3,"blockedCells":[],"hazardCells":[{"x":1,"y":1}],"coverCells":[],"hazardDamage":1},"units":[{"id":"scout","team":"allies","visibility":"revealed","cell":{"x":0,"y":0},"hp":8,"maxHp":8,"attack":3,"defense":0,"move":4,"initiative":9,"disabled":false,"skills":[],"statuses":[]}],"objectives":[{"id":"beacon","cell":{"x":2,"y":0},"durability":1,"completed":false,"key":false}],"maxRounds":4,"assetIds":["floor","allies","objective"]},{"id":"world-02","board":{"width":4,"height":3,"blockedCells":[],"hazardCells":[],"coverCells":[],"hazardDamage":1},"units":[{"id":"rulewright","team":"allies","visibility":"revealed","cell":{"x":1,"y":1},"hp":10,"maxHp":10,"attack":4,"defense":1,"move":2,"initiative":9,"disabled":false,"skills":[],"statuses":[]},{"id":"golem-light","team":"enemies","visibility":"revealed","cell":{"x":2,"y":1},"hp":3,"maxHp":6,"attack":2,"defense":0,"move":1,"initiative":4,"disabled":false,"skills":[],"statuses":[]},{"id":"golem-heavy","team":"enemies","visibility":"revealed","cell":{"x":1,"y":2},"hp":6,"maxHp":6,"attack":3,"defense":0,"move":1,"initiative":3,"disabled":false,"skills":[],"statuses":[]}],"objectives":[],"maxRounds":5,"assetIds":["floor","allies","enemy"]},{"id":"world-03","board":{"width":4,"height":3,"blockedCells":[],"hazardCells":[],"coverCells":[],"hazardDamage":1},"units":[{"id":"rulewright","team":"allies","visibility":"revealed","cell":{"x":0,"y":0},"hp":10,"maxHp":10,"attack":4,"defense":1,"move":2,"initiative":9,"disabled":false,"skills":[],"statuses":[]}],"objectives":[{"id":"node-a","cell":{"x":1,"y":0},"durability":1,"completed":false,"key":false},{"id":"node-b","cell":{"x":0,"y":1},"durability":2,"completed":false,"key":false}],"maxRounds":5,"assetIds":["floor","allies","objective"]},{"id":"world-04","board":{"width":4,"height":3,"blockedCells":[],"hazardCells":[],"coverCells":[],"hazardDamage":1},"units":[{"id":"bo","team":"allies","visibility":"revealed","cell":{"x":0,"y":0},"hp":11,"maxHp":11,"attack":2,"defense":2,"move":2,"initiative":9,"disabled":false,"skills":[],"statuses":[]}],"objectives":[{"id":"core","cell":{"x":1,"y":0},"durability":1,"completed":false,"key":false},{"id":"relay","cell":{"x":0,"y":1},"durability":2,"completed":false,"key":false}],"maxRounds":5,"assetIds":["floor","allies","objective"]},{"id":"world-05","board":{"width":4,"height":3,"blockedCells":[],"hazardCells":[],"coverCells":[],"hazardDamage":1},"units":[{"id":"mara","team":"allies","visibility":"revealed","cell":{"x":0,"y":0},"hp":9,"maxHp":9,"attack":3,"defense":1,"move":2,"initiative":9,"disabled":false,"skills":[],"statuses":[]},{"id":"swarm-a","team":"enemies","visibility":"revealed","cell":{"x":1,"y":0},"hp":4,"maxHp":6,"attack":2,"defense":0,"move":1,"initiative":5,"disabled":false,"skills":[],"statuses":[]},{"id":"swarm-b","team":"enemies","visibility":"revealed","cell":{"x":0,"y":1},"hp":5,"maxHp":6,"attack":2,"defense":0,"move":1,"initiative":4,"disabled":false,"skills":[],"statuses":[]}],"objectives":[],"maxRounds":8,"assetIds":["floor","allies","enemy"]},{"id":"world-06","board":{"width":4,"height":3,"blockedCells":[],"hazardCells":[{"x":2,"y":1}],"coverCells":[],"hazardDamage":1},"units":[{"id":"rulewright","team":"allies","visibility":"revealed","cell":{"x":0,"y":0},"hp":10,"maxHp":10,"attack":4,"defense":1,"move":2,"initiative":9,"disabled":false,"skills":[],"statuses":[]},{"id":"recursive-core","team":"enemies","visibility":"revealed","cell":{"x":1,"y":0},"hp":4,"maxHp":4,"attack":4,"defense":0,"move":1,"initiative":4,"disabled":false,"skills":[],"statuses":[]}],"objectives":[],"maxRounds":6,"assetIds":["floor","allies","enemy"]}]}
```

- [ ] **Step 3: 实现幂等奖励和全边 checker。**

```ts
// rpg/src/game/progression/progression.ts
import type { CampaignProgress } from "../save/types";
import type { CampaignReward } from "../../content/types";
const appendUnique = (values: readonly string[], additions: readonly string[]) => [...values, ...additions.filter((value) => !values.includes(value))];
export function applyQuestReward(progress: CampaignProgress, reward: CampaignReward): CampaignProgress {
  if (progress.completedQuestIds.includes(reward.questId)) return structuredClone(progress);
  const companion = reward.companionUnlock ? [`companion:${reward.companionUnlock}`] : [];
  return { completedQuestIds: appendUnique(progress.completedQuestIds, [reward.questId]), unlockedSkillIds: appendUnique(progress.unlockedSkillIds, [...companion, ...reward.skillIds]), equipmentIds: appendUnique(progress.equipmentIds, [reward.equipmentId]) };
}
```

`checkContent` 的实现顺序必须固定，以便错误稳定：

1. 调用 `loadCampaignContentForNode`，decoder 错误转换为 `CONTENT_SCHEMA_INVALID`，不吞异常。
2. `questOrder` 必须精确等于 `QUEST_IDS`，所有 quest/world/reward/asset ID 唯一；每关 `order`、固定标题、`worldId`、`rewardId` 双向引用一致。
3. `starterPath/solutionPath` 必须匹配 `^python/python-marsh-0[1-6]/[a-z-]+\.py$`，拒绝反斜杠、绝对路径、`..`，并通过 `readFile` 验证存在。
4. hidden assertion 的 actor/unit/objective/patch 引用全部存在；expected actor 是场景 active actor；移动格在 board 内；目标型 assertion 的 world 不含 enemies，expected outcome 必须为 `won`。
5. `visibleWorldFields` 只能来自 `WorldView` 白名单；`allowedModules` 只能为 `math`；limits 全部为正安全整数。
6. world 的每个 `assetId` 必须命中 `assets.json`；资产 `publicUrl` 必须等于 `/assets/${diskPath}`；`diskPath` 使用同一安全相对路径规则并位于 `assetsRoot`。
7. `ledgerUrl` 显式传入；生产命令传 `new URL("../ASSET-LICENSES.json", contentRoot)`。来源条目必须先存在且 package/source/downloaded/licenseSnapshot/modifications 非空；许可快照和资产文件存在。
8. 初始 ledger 的 `files` 必须为空；`write-hashes` 只可在来源与许可已验证后根据真实 `assets.json` 和磁盘文件生成 file 条目与 SHA-256，不得创建来源条目；`check` 模式要求每个采用文件恰好命中一个条目并比较摘要。

```ts
// rpg/tools/content-check/index.ts
import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadCampaignContentForNode } from "../../src/content/node-loader";
import { QUEST_IDS } from "../../src/content/types";
export interface CheckOptions { contentRoot: URL; assetsRoot: URL; ledgerUrl: URL; writeHashes: boolean; }
export interface CheckError { code: string; path: string; message: string; }
export interface CheckReport { ok: boolean; errors: readonly CheckError[]; writtenHashes: readonly string[]; }
type Ledger = { schemaVersion: 1; assets: Array<{ id: string; package: string; version: string; source: string; downloaded: string; licenseSnapshot: string; modifications: string; files: Array<{ diskPath: string; sha256: string }> }> };
const SAFE_TEXT = /^python\/python-marsh-0[1-6]\/[a-z-]+\.py$/;
const SAFE_ASSET = /^[a-z0-9][a-z0-9._/-]*$/;
const TITLES = ["雾径信标", "护甲分流", "节点清册", "默认修复程式", "威胁序列", "递归炉心"] as const;
const WORLD_FIELDS = new Set(["revision", "round", "activeUnitId", "board", "board.width", "board.height", "board.blockedCells", "board.hazardCells", "board.coverCells", "units", "units.id", "units.team", "units.cell", "units.hp", "units.maxHp", "units.disabled", "objectives", "objectives.id", "objectives.cell", "objectives.durability", "objectives.completed"]);
export function safeRelative(path: string, pattern: RegExp): boolean { return pattern.test(path) && !path.includes("..") && !path.includes("\\") && !path.startsWith("/") && !path.includes("\0"); }
const exists = async (url: URL) => { try { await access(url); return true; } catch { return false; } };
const digest = async (url: URL) => `sha256:${createHash("sha256").update(await readFile(url)).digest("hex")}`;
const duplicates = (values: readonly string[]) => values.filter((value, index) => values.indexOf(value) !== index);
export async function checkContent(options: CheckOptions): Promise<CheckReport> {
  const errors: CheckError[] = []; const writtenHashes: string[] = []; const add = (code: string, path: string, message: string) => errors.push({ code, path, message });
  let content; try { content = await loadCampaignContentForNode(options.contentRoot); } catch (cause) { const message = cause instanceof Error ? cause.message : String(cause); const [prefix, path = "content"] = message.split(":", 2); const code = prefix === "CONTENT_FILE_MISSING" ? "TEXT_FILE_MISSING" : prefix === "CONTENT_PATH_UNSAFE" ? "TEXT_PATH_UNSAFE" : "CONTENT_SCHEMA_INVALID"; add(code, path, message); return { ok: false, errors, writtenHashes }; }
  if (JSON.stringify(content.manifest.questOrder) !== JSON.stringify(QUEST_IDS)) add("QUEST_ORDER_INVALID", "shared/campaign.json.questOrder", "quest order must match the six fixed ids");
  for (const [name, ids] of [["quest", content.quests.map((item) => item.id)], ["world", content.worlds.map((item) => item.id)], ["reward", content.manifest.rewards.map((item) => item.id)], ["asset", content.assets.map((item) => item.id)]] as const) for (const id of duplicates(ids)) add("DUPLICATE_ID", `${name}.${id}`, "id must be unique");
  const worlds = new Map(content.worlds.map((item) => [item.id, item])); const rewards = new Map(content.manifest.rewards.map((item) => [item.id, item])); const assets = new Map(content.assets.map((item) => [item.id, item]));
  for (const [index, quest] of content.quests.entries()) {
    const world = worlds.get(quest.worldId); const reward = rewards.get(quest.rewardId);
    if (quest.order !== index + 1 || quest.title !== TITLES[index]) add("QUEST_ORDER_INVALID", quest.id, "order/title mismatch");
    if (!world) add("WORLD_REFERENCE_MISSING", quest.id, quest.worldId); if (!reward || reward.questId !== quest.id) add("REWARD_REFERENCE_MISSING", quest.id, quest.rewardId);
    for (const path of [quest.starterPath, quest.solutionPath]) { if (!safeRelative(path, SAFE_TEXT)) add("TEXT_PATH_UNSAFE", quest.id, path); else if (!(await exists(new URL(path, options.contentRoot)))) add("TEXT_FILE_MISSING", quest.id, path); }
    for (const field of quest.visibleWorldFields) if (!WORLD_FIELDS.has(field)) add("WORLD_FIELD_FORBIDDEN", quest.id, field);
    for (const module of quest.allowedModules) if (module !== "math") add("MODULE_FORBIDDEN", quest.id, module);
    if (!world) continue; const unitIds = new Set(world.units.map((item) => item.id)); const objectiveIds = new Set(world.objectives.map((item) => item.id));
    for (const assertion of quest.hiddenAssertions) {
      if (!unitIds.has(assertion.expected.actorId)) add("PATCH_REFERENCE_MISSING", `${quest.id}.${assertion.id}`, assertion.expected.actorId);
      for (const id of [...Object.keys(assertion.patch.unitHp ?? {}), ...Object.keys(assertion.patch.unitCells ?? {})]) if (!unitIds.has(id)) add("PATCH_REFERENCE_MISSING", `${quest.id}.${assertion.id}`, id);
      for (const id of Object.keys(assertion.patch.objectiveDurability ?? {})) if (!objectiveIds.has(id)) add("PATCH_REFERENCE_MISSING", `${quest.id}.${assertion.id}`, id);
      const targetId = assertion.expected.action.type === "attack" || assertion.expected.action.type === "interact" ? assertion.expected.action.targetId : undefined; if (targetId && !unitIds.has(targetId) && !objectiveIds.has(targetId)) add("PATCH_REFERENCE_MISSING", `${quest.id}.${assertion.id}`, targetId);
      for (const step of assertion.expected.movePath ?? []) if (step.x < 0 || step.y < 0 || step.x >= world.board.width || step.y >= world.board.height) add("PATCH_CELL_OUT_OF_BOUNDS", `${quest.id}.${assertion.id}`, JSON.stringify(step));
      if (assertion.expected.action.type === "interact" || assertion.expected.movePath?.length) { if (world.units.some((item) => item.team === "enemies") || assertion.expectedOutcome !== "won") add("TARGET_SCENARIO_NOT_TERMINAL", `${quest.id}.${assertion.id}`, "target scenarios require no enemies and won outcome"); }
    }
    for (const assetId of world.assetIds) if (!assets.has(assetId)) add("ASSET_REFERENCE_MISSING", world.id, assetId);
  }
  let ledger: Ledger; try { ledger = JSON.parse(await readFile(options.ledgerUrl, "utf8")) as Ledger; } catch { add("ASSET_LICENSE_MISSING", options.ledgerUrl.pathname, "ledger is missing or invalid"); return { ok: false, errors, writtenHashes }; }
  const files = ledger.assets.flatMap((entry) => entry.files.map((file) => ({ entry, file })));
  for (const asset of content.assets) {
    if (!safeRelative(asset.diskPath, SAFE_ASSET) || asset.publicUrl !== `/assets/${asset.diskPath}`) { add("ASSET_PATH_UNSAFE", asset.id, asset.diskPath); continue; }
    const disk = new URL(asset.diskPath, options.assetsRoot); if (!(await exists(disk))) { add("ASSET_FILE_MISSING", asset.id, asset.diskPath); continue; }
    const source = ledger.assets.find((entry) => entry.id === "tiny-swords"); if (!source || ![source.package, source.version, source.source, source.downloaded, source.modifications].every(Boolean)) { add("ASSET_LICENSE_MISSING", asset.id, asset.diskPath); continue; }
    if (!safeRelative(source.licenseSnapshot, SAFE_ASSET) || !(await exists(new URL(source.licenseSnapshot, options.assetsRoot)))) { add("ASSET_LICENSE_SNAPSHOT_MISSING", asset.id, source.licenseSnapshot); continue; }
    const actual = await digest(disk); const matches = files.filter((item) => item.file.diskPath === asset.diskPath);
    if (options.writeHashes) { if (matches.length === 0) source.files.push({ diskPath: asset.diskPath, sha256: actual }); else if (matches.length === 1) matches[0]!.file.sha256 = actual; else add("ASSET_LICENSE_DUPLICATE", asset.id, asset.diskPath); if (matches.length <= 1) writtenHashes.push(asset.diskPath); }
    else if (matches.length !== 1) add("ASSET_LICENSE_MISSING", asset.id, asset.diskPath); else if (matches[0]!.file.sha256 !== actual) add("ASSET_HASH_MISMATCH", asset.id, actual);
  }
  if (options.writeHashes && errors.length === 0) await writeFile(options.ledgerUrl, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  return { ok: errors.length === 0, errors, writtenHashes };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkContent({ contentRoot: new URL("../../content/", import.meta.url), assetsRoot: new URL("../../public/assets/", import.meta.url), ledgerUrl: new URL("../../ASSET-LICENSES.json", import.meta.url), writeHashes: process.argv.includes("--write-hashes") });
  if (!report.ok) for (const item of report.errors) console.error(`${item.code} ${item.path}: ${item.message}`);
  process.exitCode = report.ok ? 0 : 1;
}
```

```json
{"schemaVersion":1,"assets":[{"id":"tiny-swords","package":"Tiny Swords","version":"download-2026-08-10","source":"https://pixelfrog-assets.itch.io/tiny-swords","downloaded":"2026-08-10","licenseSnapshot":"tiny-swords/LICENSE-snapshot.txt","modifications":"从原图集裁出项目实际使用的 64px 图块，不改变许可。","files":[]}]}
```

`ASSET-LICENSES.md` 只展示 JSON 账本摘要，不作为 checker 输入。`package.json` 增加以下 scripts，并把已核验版本 `tsx: 4.23.11` 精确加入 `devDependencies`，随后由 npm 更新 lockfile：

```json
{"scripts":{"content:check":"tsx tools/content-check/index.ts --check","content:hash":"tsx tools/content-check/index.ts --write-hashes"},"devDependencies":{"tsx":"4.23.11"}}
```

Run: `npm --prefix rpg run test -- src/game/progression/progression.test.ts tools/content-check/index.test.ts`

Run: `npm --prefix rpg run content:check`

Expected: 测试 PASS；真实资产落盘前 `content:check` 明确以 `ASSET_FILE_MISSING` 失败，不伪造通过。

- [ ] **Step 4: 提交内容、成长与检查器。**

```bash
git add rpg/content/shared rpg/src/game/progression rpg/tools/content-check rpg/ASSET-LICENSES.json rpg/ASSET-LICENSES.md rpg/package.json rpg/package-lock.json
git commit -m "feat: validate campaign content and rewards"
```

### Task 3: 六关 Python 内容与 gate/combat/replay 契约验收

**Files:**
- Create: `rpg/content/python/python-marsh-01/quest.json`
- Create: `rpg/content/python/python-marsh-01/starter.py`
- Create: `rpg/content/python/python-marsh-01/solution.py`
- Create: `rpg/content/python/python-marsh-02/{quest.json,starter.py,solution.py}`
- Create: `rpg/content/python/python-marsh-03/{quest.json,starter.py,solution.py}`
- Create: `rpg/content/python/python-marsh-04/{quest.json,starter.py,solution.py}`
- Create: `rpg/content/python/python-marsh-05/{quest.json,starter.py,solution.py}`
- Create: `rpg/content/python/python-marsh-06/{quest.json,starter.py,solution.py}`
- Create: `rpg/content/python/content.test.ts`
- Create: `rpg/src/content/content-gate.ts`
- Create: `rpg/src/content/content-gate.test.ts`

**Interfaces:**
- Produces production `gateQuestCommand(quest, state, input, scenario)`；Node 测试只验证显式命令夹具的 gate/combat/replay 生命周期，不伪装成执行 Python solution。
- Gate 在 `resolveTurn` 前执行；失败时 reducer/replay 均不得调用。通过后调用真实 `resolveTurn`，只把 accepted resolution 传给 `recordAcceptedTurn`。

- [ ] **Step 1: 写 gate 与真实执行失败测试。**

```ts
// rpg/content/python/content.test.ts
import { expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { loadCampaignContentForNode } from "../../src/content/node-loader";
import { createQuestScenario } from "../../src/content/assemble-battle-state";
import { gateQuestCommand } from "../../src/content/content-gate";
import { resolveTurn } from "../../src/game/combat/resolve-turn";
import { createReplay, recordAcceptedTurn, verifyReplay } from "../../src/game/replay/replay";
import { QUEST_IDS } from "../../src/content/types";
it("rejects a hidden mismatch before resolveTurn", async () => {
  const content = await loadCampaignContentForNode(new URL("../", import.meta.url)); const quest = content.questById["python-marsh-01"]; const initial = createQuestScenario(content, quest.id, "initial"); const resolve = vi.fn(resolveTurn);
  const gate = gateQuestCommand(quest, initial.state, { actorId: "scout", expectedRevision: 0, action: { type: "guard" } }, "initial");
  expect(gate).toMatchObject({ ok: false, code: "HIDDEN_ASSERTION_FAILED" }); expect(resolve).not.toHaveBeenCalled();
});
it("exercises every hidden assertion through the real gate, reducer, and replay lifecycle", async () => { const content = await loadCampaignContentForNode(new URL("../", import.meta.url)); for (const id of QUEST_IDS) for (const assertion of content.questById[id].hiddenAssertions) { const quest = content.questById[id]; const initial = createQuestScenario(content, id, assertion.scenario); const candidate = { ...assertion.expected, expectedRevision: initial.state.revision }; const gate = gateQuestCommand(quest, initial.state, candidate, assertion.scenario); expect(gate.ok, `${id}:${assertion.id}`).toBe(true); if (!gate.ok) continue; const resolution = resolveTurn(initial.state, gate.input); expect(resolution).toMatchObject({ accepted: true, state: { phase: assertion.expectedOutcome } }); if (!resolution.accepted) continue; let replay = await createReplay({ engineVersion: "0.1.0", contentVersion: quest.contentVersion, runnerProtocolVersion: 1, questId: id, battleId: initial.state.battleId, seed: String(initial.state.rngState) }, initial.state); replay = await recordAcceptedTurn(replay, initial.state, resolution); expect(await verifyReplay(replay)).toMatchObject({ verified: true }); } });
it("parses all twelve Python files with the installed interpreter", async () => { const content = await loadCampaignContentForNode(new URL("../", import.meta.url)); for (const quest of content.quests) for (const path of [quest.starterPath, quest.solutionPath]) { const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8"); const parsed = spawnSync("python", ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], { input: source, encoding: "utf8" }); expect(parsed.status, `${path}: ${parsed.stderr}`).toBe(0); } });
```

- [ ] **Step 2: 写六个严格 quest.json。**

每份 limits 完整，且路径与目录一致。以下六个对象分别写入对应 `quest.json`：

```json
{"schemaVersion":1,"id":"python-marsh-01","contentVersion":"python-slice-1","order":1,"title":"雾径信标","capabilityTags":["variables-booleans"],"worldId":"world-01","visibleWorldFields":["revision","activeUnitId","board","board.hazardCells","units","units.id","units.cell","objectives","objectives.id","objectives.cell"],"allowedModules":[],"executionLimits":{"timeoutMs":2000,"interruptGraceMs":100,"maxFiles":1,"maxFileBytes":65536,"maxSourceBytes":65536,"maxOutputBytes":16384,"maxTraceEvents":1000,"maxValueDepth":4},"starterPath":"python/python-marsh-01/starter.py","solutionPath":"python/python-marsh-01/solution.py","hiddenAssertions":[{"id":"north","scenario":"initial","patch":{"hazardCells":[{"x":1,"y":1}]},"expected":{"actorId":"scout","movePath":[{"x":1,"y":0},{"x":2,"y":0}],"action":{"type":"wait"}},"expectedOutcome":"won"},{"id":"south","scenario":"alternate","patch":{"hazardCells":[{"x":1,"y":0}]},"expected":{"actorId":"scout","movePath":[{"x":0,"y":1},{"x":1,"y":1},{"x":2,"y":1},{"x":2,"y":0}],"action":{"type":"wait"}},"expectedOutcome":"won"}],"rewardId":"reward-01"}
```

```json
{"schemaVersion":1,"id":"python-marsh-02","contentVersion":"python-slice-1","order":2,"title":"护甲分流","capabilityTags":["if-branches"],"worldId":"world-02","visibleWorldFields":["revision","activeUnitId","units","units.id","units.team","units.hp","units.cell"],"allowedModules":[],"executionLimits":{"timeoutMs":2000,"interruptGraceMs":100,"maxFiles":1,"maxFileBytes":65536,"maxSourceBytes":65536,"maxOutputBytes":16384,"maxTraceEvents":1000,"maxValueDepth":4},"starterPath":"python/python-marsh-02/starter.py","solutionPath":"python/python-marsh-02/solution.py","hiddenAssertions":[{"id":"light","scenario":"initial","patch":{"unitHp":{"golem-light":3,"golem-heavy":6}},"expected":{"actorId":"rulewright","action":{"type":"attack","targetId":"golem-light"}},"expectedOutcome":"in_progress"},{"id":"heavy","scenario":"alternate","patch":{"unitHp":{"golem-light":6,"golem-heavy":3}},"expected":{"actorId":"rulewright","action":{"type":"attack","targetId":"golem-heavy"}},"expectedOutcome":"in_progress"}],"rewardId":"reward-02"}
```

```json
{"schemaVersion":1,"id":"python-marsh-03","contentVersion":"python-slice-1","order":3,"title":"节点清册","capabilityTags":["loops-collections"],"worldId":"world-03","visibleWorldFields":["revision","activeUnitId","objectives","objectives.id","objectives.cell","objectives.durability"],"allowedModules":[],"executionLimits":{"timeoutMs":2000,"interruptGraceMs":100,"maxFiles":1,"maxFileBytes":65536,"maxSourceBytes":65536,"maxOutputBytes":16384,"maxTraceEvents":1000,"maxValueDepth":4},"starterPath":"python/python-marsh-03/starter.py","solutionPath":"python/python-marsh-03/solution.py","hiddenAssertions":[{"id":"node-a","scenario":"initial","patch":{"objectiveDurability":{"node-a":1,"node-b":2}},"expected":{"actorId":"rulewright","action":{"type":"interact","targetId":"node-a"}},"expectedOutcome":"won"},{"id":"node-b","scenario":"late-round","patch":{"objectiveDurability":{"node-a":0,"node-b":1},"round":3},"expected":{"actorId":"rulewright","action":{"type":"interact","targetId":"node-b"}},"expectedOutcome":"won"}],"rewardId":"reward-03"}
```

```json
{"schemaVersion":1,"id":"python-marsh-04","contentVersion":"python-slice-1","order":4,"title":"默认修复程式","capabilityTags":["functions-defaults"],"worldId":"world-04","visibleWorldFields":["revision","activeUnitId","objectives","objectives.id","objectives.cell","objectives.durability"],"allowedModules":[],"executionLimits":{"timeoutMs":2000,"interruptGraceMs":100,"maxFiles":1,"maxFileBytes":65536,"maxSourceBytes":65536,"maxOutputBytes":16384,"maxTraceEvents":1000,"maxValueDepth":4},"starterPath":"python/python-marsh-04/starter.py","solutionPath":"python/python-marsh-04/solution.py","hiddenAssertions":[{"id":"core","scenario":"initial","patch":{"objectiveDurability":{"core":1,"relay":2}},"expected":{"actorId":"bo","action":{"type":"interact","targetId":"core"}},"expectedOutcome":"won"},{"id":"relay","scenario":"alternate","patch":{"objectiveDurability":{"core":2,"relay":1}},"expected":{"actorId":"bo","action":{"type":"interact","targetId":"relay"}},"expectedOutcome":"won"}],"rewardId":"reward-04"}
```

```json
{"schemaVersion":1,"id":"python-marsh-05","contentVersion":"python-slice-1","order":5,"title":"威胁序列","capabilityTags":["comprehensions-sorting"],"worldId":"world-05","visibleWorldFields":["revision","activeUnitId","units","units.id","units.team","units.hp","units.cell","units.disabled"],"allowedModules":[],"executionLimits":{"timeoutMs":2000,"interruptGraceMs":100,"maxFiles":1,"maxFileBytes":65536,"maxSourceBytes":65536,"maxOutputBytes":16384,"maxTraceEvents":1000,"maxValueDepth":4},"starterPath":"python/python-marsh-05/starter.py","solutionPath":"python/python-marsh-05/solution.py","hiddenAssertions":[{"id":"swarm-b","scenario":"initial","patch":{"unitHp":{"swarm-a":4,"swarm-b":5}},"expected":{"actorId":"mara","action":{"type":"attack","targetId":"swarm-b"}},"expectedOutcome":"in_progress"},{"id":"swarm-a","scenario":"alternate","patch":{"unitHp":{"swarm-a":6,"swarm-b":2}},"expected":{"actorId":"mara","action":{"type":"attack","targetId":"swarm-a"}},"expectedOutcome":"in_progress"}],"rewardId":"reward-05"}
```

```json
{"schemaVersion":1,"id":"python-marsh-06","contentVersion":"python-slice-1","order":6,"title":"递归炉心","capabilityTags":["campaign-synthesis"],"worldId":"world-06","visibleWorldFields":["revision","round","activeUnitId","board","board.hazardCells","units","units.id","units.team","units.hp","units.cell"],"allowedModules":[],"executionLimits":{"timeoutMs":2500,"interruptGraceMs":100,"maxFiles":1,"maxFileBytes":65536,"maxSourceBytes":65536,"maxOutputBytes":16384,"maxTraceEvents":1500,"maxValueDepth":4},"starterPath":"python/python-marsh-06/starter.py","solutionPath":"python/python-marsh-06/solution.py","hiddenAssertions":[{"id":"core","scenario":"initial","patch":{},"expected":{"actorId":"rulewright","action":{"type":"attack","targetId":"recursive-core"}},"expectedOutcome":"won"},{"id":"late-core","scenario":"late-round","patch":{"round":4},"expected":{"actorId":"rulewright","action":{"type":"attack","targetId":"recursive-core"}},"expectedOutcome":"won"}],"rewardId":"reward-06"}
```

- [ ] **Step 3: 写完整 starter/solution；Node 不替代 Python 运行时。**

以下十二份 Python 文件逐份写入，均可独立解析和调用；不得用模板说明替代文件内容。

```python
# rpg/content/python/python-marsh-01/starter.py
def choose_turn(world):
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "wait"}}
```

```python
# rpg/content/python/python-marsh-01/solution.py
def choose_turn(world):
    hazards = {(cell["x"], cell["y"]) for cell in world["board"]["hazardCells"]}
    path = [{"x": 0, "y": 1}, {"x": 1, "y": 1}, {"x": 2, "y": 1}, {"x": 2, "y": 0}] if (1, 0) in hazards else [{"x": 1, "y": 0}, {"x": 2, "y": 0}]
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "movePath": path, "action": {"type": "wait"}}
```

```python
# rpg/content/python/python-marsh-02/starter.py
def choose_turn(world):
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "wait"}}
```

```python
# rpg/content/python/python-marsh-02/solution.py
def choose_turn(world):
    actor = next(unit for unit in world["units"] if unit["id"] == world["activeUnitId"])
    if actor["team"] == "enemies":
        return {"actorId": actor["id"], "expectedRevision": world["revision"], "action": {"type": "wait"}}
    enemies = {unit["id"]: unit for unit in world["units"] if unit["team"] == "enemies" and unit["hp"] > 0}
    target = sorted(enemies.values(), key=lambda unit: (unit["hp"], unit["id"]))[0]["id"]
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "attack", "targetId": target}}
```

```python
# rpg/content/python/python-marsh-03/starter.py
def choose_turn(world):
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "wait"}}
```

```python
# rpg/content/python/python-marsh-03/solution.py
def choose_turn(world):
    remaining = [item for item in world["objectives"] if item["durability"] > 0]
    target = sorted(remaining, key=lambda item: (item["durability"], item["id"]))[0]
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "interact", "targetId": target["id"]}}
```

```python
# rpg/content/python/python-marsh-04/starter.py
def choose_turn(world):
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "wait"}}
```

```python
# rpg/content/python/python-marsh-04/solution.py
def pick_target(items, minimum=1):
    eligible = [item for item in items if item["durability"] >= minimum]
    return sorted(eligible, key=lambda item: (item["durability"], item["id"]))[0]

def choose_turn(world):
    target = pick_target(world["objectives"])
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "interact", "targetId": target["id"]}}
```

```python
# rpg/content/python/python-marsh-05/starter.py
def choose_turn(world):
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "wait"}}
```

```python
# rpg/content/python/python-marsh-05/solution.py
def choose_turn(world):
    actor = next(unit for unit in world["units"] if unit["id"] == world["activeUnitId"])
    if actor["team"] == "enemies":
        return {"actorId": actor["id"], "expectedRevision": world["revision"], "action": {"type": "wait"}}
    enemies = [unit for unit in world["units"] if unit["team"] == "enemies" and not unit["disabled"]]
    target = sorted(enemies, key=lambda unit: (-unit["hp"], unit["id"]))[0]
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "attack", "targetId": target["id"]}}
```

```python
# rpg/content/python/python-marsh-06/starter.py
def choose_turn(world):
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "wait"}}
```

```python
# rpg/content/python/python-marsh-06/solution.py
def choose_turn(world):
    target = next(unit for unit in world["units"] if unit["id"] == "recursive-core")
    return {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": {"type": "attack", "targetId": target["id"]}}
```

```ts
// rpg/src/content/content-gate.ts
import type { BattleState } from "../game/combat/types";
import type { ContentGateResult, QuestContent, ScenarioName } from "./types";
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
export function gateQuestCommand(quest: QuestContent, state: BattleState, input: unknown, scenario: ScenarioName): ContentGateResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, code: "CONTENT_GATE_REJECTED", message: "候选命令必须是对象。" };
  const command = input as Record<string, unknown>; const action = command.action as Record<string, unknown> | undefined; const actorId = state.turnOrder[state.turnIndex];
  if (command.actorId !== actorId || command.expectedRevision !== state.revision || !action || typeof action.type !== "string") return { ok: false, code: "CONTENT_GATE_REJECTED", message: "候选命令与当前行动者或版本不一致。" };
  const actor = state.units.find((unit) => unit.id === actorId); if (!actor) return { ok: false, code: "CONTENT_GATE_REJECTED", message: "当前行动者不存在。" };
  if (actor.team === "enemies") return action.type === "wait" && canonical(command) === canonical({ actorId, expectedRevision: state.revision, action: { type: "wait" } }) ? { ok: true, input } : { ok: false, code: "CONTENT_GATE_REJECTED", message: "敌方确定性回合只能等待。" };
  if (state.revision === 0) { const assertion = quest.hiddenAssertions.find((item) => item.scenario === scenario); if (!assertion) return { ok: false, code: "CONTENT_GATE_REJECTED", message: `缺少 ${scenario} 内容断言。` }; const expected = { ...assertion.expected, expectedRevision: state.revision }; return canonical(input) === canonical(expected) ? { ok: true, input } : { ok: false, code: "HIDDEN_ASSERTION_FAILED", message: `断言 ${assertion.id} 的命令不匹配。` }; }
  const allowed = new Set(quest.hiddenAssertions.map((item) => item.expected.action.type)); return allowed.has(action.type as never) ? { ok: true, input } : { ok: false, code: "CONTENT_GATE_REJECTED", message: `动作 ${action.type} 不属于本关契约。` };
}
```

Run: `npm --prefix rpg run test -- content/python/content.test.ts`

Run: `npm --prefix rpg run content:check`

Expected: 每个 hidden assertion 被逐条执行；01/03/04/06 由真实 reducer 得到 `won`；所有 replay `verified: true`。Node 测试只证明内容契约生命周期，不声称运行了 `solution.py`。

- [ ] **Step 4: 提交六关和跨层验收。**

```bash
git add rpg/content/python rpg/src/content/content-gate.ts rpg/src/content/content-gate.test.ts
git commit -m "feat: add six executable Python RPG quests"
```

### Task 4: AppContentPort、buildRunRequest 与 readContentText 完整适配

**Files:**
- Create: `rpg/src/content/app-content-adapter.ts`
- Create: `rpg/src/content/app-content-adapter.test.ts`
- Modify: `rpg/src/app/app-model.ts`
- Modify: `rpg/src/app/app-controller.ts`
- Modify: `rpg/src/app/app-controller.test.ts`
- Modify: `rpg/src/content/bootstrap-app-content.ts`

**Interfaces:**
- Extends the existing structural `AppContentPort` with `readContentText(path)`、`buildRunRequest(input)` and `gateCommand(questId, state, input)`，不改变原四个方法。
- `AppController.makeRunRequest` 只委托 `content.buildRunRequest`；新关卡无草稿时使用 `content.readContentText(quest.starterPath)`。

- [ ] **Step 1: 写 adapter 和 AppController 委托失败测试。**

```ts
it("builds the exact runner request from quest limits and raw source", async () => {
  const decoded = await loadCampaignContentForNode(new URL("../../content/", import.meta.url)); const port = createCampaignAppContent(decoded); const state = port.initialBattleFor("python-marsh-01");
  const request = port.buildRunRequest({ questId: "python-marsh-01", source: port.readContentText("python/python-marsh-01/starter.py"), worldView: port.worldViewFor(state), runId: "run-1", attemptId: "attempt-1" });
  expect(request).toEqual(expect.objectContaining({ protocolVersion: 1, runId: "run-1", attemptId: "attempt-1", questId: "python-marsh-01", language: "python", entrypoint: { file: "main.py", callable: "choose_turn" }, allowedModules: [], limits: expect.objectContaining({ maxValueDepth: 4 }) }));
});
it("AppController delegates request creation instead of rebuilding protocol fields", async () => { const content = fakeContent(); const controller = createController({ content }); await controller.runCode(); expect(content.buildRunRequest).toHaveBeenCalledOnce(); });
it.each(["manual", "runner"] as const)("gates %s candidates before resolveTurn", async (source) => { const content = fakeContent({ gate: { ok: false, code: "HIDDEN_ASSERTION_FAILED", message: "wrong" } }); const resolveTurn = vi.fn(); const controller = createController({ content, resolveTurn }); if (source === "manual") await controller.submitManual(manualInput); else await controller.runCode(); expect(content.gateCommand).toHaveBeenCalledOnce(); expect(resolveTurn).not.toHaveBeenCalled(); });
```

- [ ] **Step 2: 实现完整适配器。**

```ts
// rpg/src/content/app-content-adapter.ts
import { projectWorldView } from "../game/world/project-world-view";
import { createQuestScenario } from "./assemble-battle-state";
import { gateQuestCommand } from "./content-gate";
import type { CampaignAppContentPort, CampaignContent, QuestId, ScenarioName } from "./types";
export function createCampaignAppContent(content: CampaignContent, scenarioByQuest: Partial<Record<QuestId, ScenarioName>> = {}): CampaignAppContentPort {
  const quest = (id: string) => { const value = content.questById[id as QuestId]; if (!value) throw new Error(`UNKNOWN_QUEST:${id}`); return value; };
  const scenario = (id: string) => scenarioByQuest[quest(id).id] ?? "initial";
  return {
    questIds: () => content.manifest.questOrder,
    initialBattleFor: (id) => createQuestScenario(content, quest(id).id, scenario(id)).state,
    worldViewFor: projectWorldView,
    replayMetadataFor: (id, state) => ({ engineVersion: "0.1.0", contentVersion: state.contentVersion, runnerProtocolVersion: 1, questId: quest(id).id, battleId: state.battleId, seed: String(state.rngState) }),
    readContentText: (path) => { const value = content.textByPath[path]; if (value === undefined) throw new Error(`CONTENT_FILE_MISSING:${path}`); return value; },
    buildRunRequest: ({ questId, source, worldView, runId, attemptId }) => { const item = quest(questId); return { protocolVersion: 1, runId, attemptId, questId, language: "python", files: { "main.py": source }, entrypoint: { file: "main.py", callable: "choose_turn" }, worldView, allowedModules: item.allowedModules, limits: item.executionLimits }; },
    gateCommand: (id, state, input) => gateQuestCommand(quest(id), state, input, scenario(id)),
  };
}
```

在 `app-model.ts` 将 `AppContentPort` 增加两个方法，签名直接引用 `CampaignAppContentPort` 对应成员；在 `app-controller.ts` 用以下实现替换硬编码请求：

```ts
private makeRunRequest(world: WorldView, token: number): RunRequest {
  return this.dependencies.content.buildRunRequest({ questId: this.questId as QuestId, source: this.snapshotValue.save.drafts[this.questId] ?? this.dependencies.content.readContentText(`python/${this.questId}/starter.py`), worldView: world, runId: crypto.randomUUID(), attemptId: `${this.questId}:${token}` });
}

async submitManual(input: ManualTurnInput): Promise<void> { await this.submitInput(this.commandFromManual(input), "manual"); }
private async submitInput(input: unknown, source: "manual" | "runner"): Promise<void> {
  const gate = this.dependencies.content.gateCommand(this.questId, this.snapshotValue.battle, input);
  if (!gate.ok) { this.patch({ result: { kind: "command_rejected", code: gate.code, fieldPath: "content", message: gate.message, action: source === "manual" ? "manual" : "edit" } }); return; }
  const before = this.snapshotValue.battle; const resolution = this.dependencies.resolveTurn(before, gate.input);
  if (!resolution.accepted) { const error = resolution.errors[0] ?? { code: "INVALID_COMMAND", path: "", message: "命令被拒绝。" }; this.patch({ result: { kind: "command_rejected", code: error.code, fieldPath: error.path, message: error.message, action: source === "manual" ? "manual" : "edit" } }); return; }
  this.patch({ battle: resolution.state, world: this.dependencies.content.worldViewFor(resolution.state), pendingEventBatch: { batchId: crypto.randomUUID(), events: resolution.events } });
  await this.persistAcceptedState(source, before, resolution);
}
// runCode 中必须写成：if (result.executionStatus === "completed") await this.submitInput(result.returnValue, "runner");
```

同步更新 app-shell 计划中的 `fakeContent()` 和 `createBootstrapAppContent()`，两者必须返回可读取 starter 的完整方法；不得使用空函数或类型断言绕过。

Run: `npm --prefix rpg run test -- src/content/app-content-adapter.test.ts src/app/app-controller.test.ts`

Run: `npm --prefix rpg run build`

Expected: 请求完整通过 `validateRunRequest`；所有 app fixture 编译且测试 PASS。

- [ ] **Step 3: 提交内容端口适配。**

```bash
git add rpg/src/content/app-content-adapter.ts rpg/src/content/app-content-adapter.test.ts rpg/src/app/app-model.ts rpg/src/app/app-controller.ts rpg/src/app/app-controller.test.ts rpg/src/content/bootstrap-app-content.ts
git commit -m "feat: adapt campaign content to app runner requests"
```

### Task 5: 将 lifecycle 接入 AppController 的 accepted 持久化链与 UI 恢复动作

**Files:**
- Create: `rpg/src/content/campaign-lifecycle.ts`
- Create: `rpg/src/content/campaign-lifecycle.test.ts`
- Modify: `rpg/src/app/app-model.ts`
- Modify: `rpg/src/app/app-controller.ts`
- Modify: `rpg/src/app/app-controller.test.ts`
- Modify: `rpg/src/app/bootstrap.ts`
- Modify: `rpg/src/ui/app-view.ts`

**Interfaces:**
- Adds structural `CampaignLifecyclePort.persistAccepted(input)`、`retrySave()`、`retryBattle(questId)` to `app-model.ts` and `ControllerDependencies.lifecycle`。
- `AppController.submitInput` 在 gate 与 `resolveTurn` 接受后 `await lifecycle.persistAccepted`；lifecycle 真实创建/追加/验证 replay，校验 replay outcome 与 accepted state phase，再幂等奖励并 `SaveStore.save`。
- `retryBattle` 是 replay 重置事务：删除同一 quest 的 `${questId}:latest`，以新 `initialState` 调用 `createReplay`，同步替换 lifecycle 内存 replay 和 `SavePayload.replays` 后才调用 `SaveStore.save`；后续 accepted turn 只能追加到这份新 replay。
- `ControllerDependencies`/`BootstrapDependencies` 显式携带同一个 `initialQuestId`；`AppController.retryBattle(questId?)` and `retrySave()` are public and wired to `restart`/`retry` recovery buttons。

- [ ] **Step 1: 写集成失败测试，证明 lifecycle 不是未接线的旁路。**

```ts
const reset = { questId: "python-marsh-01" as const, battle: initialBattle, world: initialWorld };
const fakeLifecycle = (result: LifecycleResult = { ok: true, save: initialSave, replayVerified: true }): CampaignLifecyclePort => ({ persistAccepted: vi.fn().mockResolvedValue(result), retrySave: vi.fn().mockResolvedValue(result), retryBattle: vi.fn().mockResolvedValue({ ok: true, save: initialSave, replayVerified: true, reset }) });
it("awaits lifecycle after recordAcceptedTurn and publishes its saved payload", async () => { const lifecycle = fakeLifecycle({ ok: true, save: rewardedSave, replayVerified: true }); const controller = createController({ lifecycle, resolveTurn: acceptedResolver }); await controller.submitManual(manualInput); expect(lifecycle.persistAccepted).toHaveBeenCalledWith(expect.objectContaining({ questId: "python-marsh-01", before: initialBattle, resolution: expect.objectContaining({ accepted: true }), currentSave: initialSave })); expect(controller.snapshot().save).toEqual(rewardedSave); });
it("does not publish rewards when replay verification fails", async () => { const lifecycle = fakeLifecycle({ ok: false, code: "REPLAY_MISMATCH", message: "stateHash", retryable: false }); const controller = createController({ lifecycle, resolveTurn: acceptedResolver }); await controller.runCode(); expect(controller.snapshot().save).toEqual(initialSave); expect(saves.save).not.toHaveBeenCalled(); });
it("wires retry save and retry battle through public controller methods", async () => { const lifecycle = fakeLifecycle(); const controller = createController({ lifecycle }); await controller.retrySave(); await controller.retryBattle("python-marsh-01"); expect(lifecycle.retrySave).toHaveBeenCalledOnce(); expect(lifecycle.retryBattle).toHaveBeenCalledWith({ questId: "python-marsh-01", currentSave: initialSave }); expect(controller.snapshot()).toMatchObject({ questId: "python-marsh-01", battle: { revision: 0 } }); });
```

```ts
// rpg/src/content/campaign-lifecycle.test.ts
import { expect, it, vi } from "vitest";
import { resolveTurn } from "../game/combat/resolve-turn";
import { createReplay, verifyReplay } from "../game/replay/replay";
import { loadCampaignContentForNode } from "./node-loader";
import { createCampaignAppContent } from "./app-content-adapter";
import { createCampaignLifecycle } from "./campaign-lifecycle";
import { applyQuestReward } from "../game/progression/progression";
it("replaces a failed replay on retry and appends the next accepted turn to the replacement", async () => { const content = await loadCampaignContentForNode(new URL("../../content/", import.meta.url)); const port = createCampaignAppContent(content); const questId = "python-marsh-06"; const oldInitial = port.initialBattleFor(questId); const validOld = await createReplay(port.replayMetadataFor(questId, oldInitial), oldInitial); const failedOld = { ...validOld, finalStateHash: "sha256:tampered" }; expect((await verifyReplay(failedOld)).verified).toBe(false); const initialSave = { campaign: { completedQuestIds: [], unlockedSkillIds: [], equipmentIds: [] }, drafts: {}, preferences: { reducedMotion: false }, replays: [{ replayId: `${questId}:latest`, questId, createdAt: "2026-08-09T00:00:00.000Z", document: failedOld }] }; const saves = { load: vi.fn(), save: vi.fn().mockResolvedValue({ ok: true, revision: 2, prunedReplayIds: [] }), exportText: vi.fn(), importText: vi.fn() }; const lifecycle = createCampaignLifecycle({ content, port, saves, now: () => "2026-08-10T00:00:00.000Z" }); const resetResult = await lifecycle.retryBattle({ questId, currentSave: initialSave }); expect(resetResult.ok).toBe(true); if (!resetResult.ok || !resetResult.reset) return; const resetRecord = resetResult.save.replays.find((item) => item.replayId === `${questId}:latest`)!; expect(resetRecord).toMatchObject({ questId, createdAt: "2026-08-10T00:00:00.000Z", document: { steps: [] } }); expect(await verifyReplay(resetRecord.document)).toMatchObject({ verified: true }); const resolution = resolveTurn(resetResult.reset.battle, { actorId: "rulewright", expectedRevision: 0, action: { type: "attack", targetId: "recursive-core" } }); if (!resolution.accepted) throw new Error(resolution.errors[0]?.message); const accepted = await lifecycle.persistAccepted({ questId, before: resetResult.reset.battle, resolution, currentSave: resetResult.save }); expect(accepted.ok).toBe(true); if (!accepted.ok) return; const latest = accepted.save.replays.find((item) => item.replayId === `${questId}:latest`)!; expect(latest.document.steps).toHaveLength(1); expect(await verifyReplay(latest.document)).toMatchObject({ verified: true }); const reward = content.manifest.rewards.find((item) => item.questId === questId)!; expect(applyQuestReward(accepted.save.campaign, reward)).toEqual(accepted.save.campaign); });
```

- [ ] **Step 2: 实现完整 lifecycle；它只保留失败候选 payload，不保留战斗副本。**

```ts
// rpg/src/app/app-model.ts 增量
export interface BattleReset { questId: QuestId; battle: BattleState; world: WorldView; }
export type LifecycleSuccess = { ok: true; save: SavePayload; replayVerified: true; reset?: BattleReset };
export type LifecycleFailure = { ok: false; code: "REPLAY_MISMATCH" | "REPLAY_OUTCOME_MISMATCH" | "SAVE_RETRY_REQUIRED" | "SAVE_FAILED"; message: string; retryable: boolean };
export type LifecycleResult = LifecycleSuccess | LifecycleFailure;
export type RetryBattleResult = LifecycleFailure | (LifecycleSuccess & { reset: BattleReset });
export interface PersistAcceptedInput { questId: QuestId; before: BattleState; resolution: Extract<CommandResolution, { accepted: true }>; currentSave: SavePayload; }
export interface CampaignLifecyclePort { persistAccepted(input: PersistAcceptedInput): Promise<LifecycleResult>; retrySave(): Promise<LifecycleResult | undefined>; retryBattle(input: { questId: QuestId; currentSave: SavePayload }): Promise<RetryBattleResult>; }
export interface ControllerDependencies { initialQuestId: QuestId; initialBattle: BattleState; initialWorld: WorldView; initialSave: SavePayload; runner: RunnerPort; saves: SaveStore; content: AppContentPort; lifecycle: CampaignLifecyclePort; resolveTurn: typeof resolveTurn; }
// AppController 公共接口增加 retrySave(): Promise<void> 与 retryBattle(questId?: string): Promise<void>。
```

```ts
// rpg/src/content/campaign-lifecycle.ts
import type { BattleState, Replay } from "../game/combat/types";
import { createReplay, recordAcceptedTurn, verifyReplay } from "../game/replay/replay";
import type { ReplayRecord, SavePayload, SaveStore } from "../game/save/types";
import { applyQuestReward } from "../game/progression/progression";
import type { BattleReset, CampaignLifecyclePort, LifecycleResult, PersistAcceptedInput, RetryBattleResult } from "../app/app-model";
import type { CampaignAppContentPort, CampaignContent, QuestId } from "./types";
export function createCampaignLifecycle(deps: { content: CampaignContent; port: CampaignAppContentPort; saves: SaveStore; now: () => string }): CampaignLifecyclePort {
  let pending: { save: SavePayload; reset?: BattleReset } | undefined;
  const activeReplays = new Map<QuestId, Replay>();
  const idFor = (questId: QuestId) => `${questId}:latest`;
  const rewardFor = (questId: QuestId) => { const reward = deps.content.manifest.rewards.find((item) => item.questId === questId); if (!reward) throw new Error(`REWARD_NOT_FOUND:${questId}`); return reward; };
  const recordFor = (questId: QuestId, document: Replay): ReplayRecord => ({ replayId: idFor(questId), questId, createdAt: deps.now(), document });
  const withRecord = (save: SavePayload, record: ReplayRecord): SavePayload => ({ ...structuredClone(save), replays: [...save.replays.filter((item) => item.replayId !== record.replayId), record] });
  async function replayFor(save: SavePayload, questId: QuestId, before: BattleState): Promise<Replay> { const replay = activeReplays.get(questId) ?? save.replays.find((item) => item.replayId === idFor(questId))?.document ?? await createReplay(deps.port.replayMetadataFor(questId, before), before); activeReplays.set(questId, replay); return replay; }
  async function write(save: SavePayload): Promise<LifecycleResult> { const result = await deps.saves.save(save); if (!result.ok) { pending = { save }; return { ok: false, code: "SAVE_FAILED", message: result.message, retryable: true }; } return { ok: true, save, replayVerified: true }; }
  async function writeReset(save: SavePayload, reset: BattleReset): Promise<RetryBattleResult> { const result = await deps.saves.save(save); if (!result.ok) { pending = { save, reset }; return { ok: false, code: "SAVE_FAILED", message: result.message, retryable: true }; } return { ok: true, save, replayVerified: true, reset }; }
  async function persistAccepted(input: PersistAcceptedInput): Promise<LifecycleResult> {
    if (pending) return { ok: false, code: "SAVE_RETRY_REQUIRED", message: "先重试上一次保存。", retryable: true };
    let replay = await replayFor(input.currentSave, input.questId, input.before); replay = await recordAcceptedTurn(replay, input.before, input.resolution); const verification = await verifyReplay(replay);
    if (!verification.verified) return { ok: false, code: "REPLAY_MISMATCH", message: verification.mismatch.field, retryable: false };
    if (replay.outcome !== input.resolution.state.phase) return { ok: false, code: "REPLAY_OUTCOME_MISMATCH", message: `${replay.outcome}:${input.resolution.state.phase}`, retryable: false };
    activeReplays.set(input.questId, replay); const record = recordFor(input.questId, replay);
    const campaign = input.resolution.state.phase === "won" ? applyQuestReward(input.currentSave.campaign, rewardFor(input.questId)) : structuredClone(input.currentSave.campaign);
    return write({ ...withRecord(input.currentSave, record), campaign });
  }
  async function retrySave(): Promise<LifecycleResult | undefined> { if (!pending) return undefined; const candidate = pending; const result = await deps.saves.save(candidate.save); if (!result.ok) return { ok: false, code: "SAVE_FAILED", message: result.message, retryable: true }; pending = undefined; return { ok: true, save: candidate.save, replayVerified: true, ...(candidate.reset ? { reset: candidate.reset } : {}) }; }
  async function retryBattle({ questId, currentSave }: { questId: QuestId; currentSave: SavePayload }) { if (pending) return { ok: false, code: "SAVE_RETRY_REQUIRED" as const, message: "先重试上一次保存。", retryable: true }; const battle = deps.port.initialBattleFor(questId); const replay = await createReplay(deps.port.replayMetadataFor(questId, battle), battle); const verification = await verifyReplay(replay); if (!verification.verified) return { ok: false, code: "REPLAY_MISMATCH" as const, message: verification.mismatch.field, retryable: false }; activeReplays.set(questId, replay); const candidate = withRecord(currentSave, recordFor(questId, replay)); const reset: BattleReset = { questId, battle, world: deps.port.worldViewFor(battle) }; return writeReset(candidate, reset); }
  return { persistAccepted, retrySave, retryBattle };
}
```

- [ ] **Step 3: 改造 AppController 的异步持久化和公开恢复方法。**

```ts
// rpg/src/app/app-controller.ts；替换旧 persistAcceptedState，删除直接 SaveStore/replay 写入路径
private async persistAcceptedState(_source: "manual" | "runner", before: BattleState, resolution: Extract<CommandResolution, { accepted: true }>): Promise<void> {
  const result = await this.dependencies.lifecycle.persistAccepted({ questId: this.questId as QuestId, before, resolution, currentSave: this.snapshotValue.save });
  if (!result.ok) { this.patch({ result: { kind: result.retryable ? "save_failure" : "save_notice", message: result.message, action: result.retryable ? "retry" : "continue" } }); return; }
  this.replaceSave(result.save); await this.refreshReplay(result.save.replays); this.patch({ result: resolution.state.phase === "won" ? { kind: "battle_outcome", outcome: "won", message: "战斗胜利。", action: "replay" } : resolution.state.phase === "lost" ? { kind: "battle_outcome", outcome: "lost", message: "战斗失败。", action: "restart" } : { kind: "empty" } });
}
private async applyLifecycleSuccess(result: LifecycleSuccess): Promise<void> { this.replaceSave(result.save); await this.refreshReplay(result.save.replays); if (result.reset) { this.questId = result.reset.questId; this.patch({ questId: result.reset.questId, battle: result.reset.battle, world: result.reset.world, diagnostics: [], trace: [], pendingEventBatch: undefined, result: { kind: "empty" } }); } }
async retrySave(): Promise<void> { const result = await this.dependencies.lifecycle.retrySave(); if (!result) return; if (result.ok) { await this.applyLifecycleSuccess(result); this.patch({ result: { kind: "save_notice", message: "保存重试成功。", action: "continue" } }); } else this.patch({ result: { kind: "save_failure", message: result.message, action: "retry" } }); }
async retryBattle(questId: string = this.questId): Promise<void> { const result = await this.dependencies.lifecycle.retryBattle({ questId: questId as QuestId, currentSave: this.snapshotValue.save }); if (!result.ok) { this.patch({ result: { kind: "save_failure", message: result.message, action: "retry" } }); return; } await this.applyLifecycleSuccess(result); }
```

```ts
// rpg/src/app/app-controller.ts；替换旧的 completedQuestIds.at(-1) 推导
export function createAppController(dependencies: ControllerDependencies): AppController {
  const questId = dependencies.initialQuestId;
  const controller = new Controller(dependencies, { questId, battle: dependencies.initialBattle, world: dependencies.initialWorld, save: structuredClone(dependencies.initialSave), preferences: dependencies.initialSave.preferences, runnerStatus: "ready", diagnostics: [], trace: [], replay: { verification: "checking", steps: [], currentIndex: 0 }, result: { kind: "empty" } });
  void controller.refreshReplay(dependencies.initialSave.replays);
  return controller;
}
```

```ts
// rpg/src/app/bootstrap.ts；完整生产装配增量
export interface BootstrapDependencies { runner: RunnerPort; saves: SaveStore; storage: SaveStorage; initialQuestId: QuestId; initialBattle: BattleState; initialWorld: WorldView; content: AppContentPort; lifecycle: CampaignLifecyclePort; resolveTurn: typeof resolveTurn; }
export async function createProductionDependencies(campaign: CampaignContent, content: CampaignAppContentPort, runner: RunnerPort, storage: SaveStorage = localStorage, saveOverride?: SaveStore): Promise<BootstrapDependencies> {
  const now = () => new Date().toISOString(); const saves = saveOverride ?? createSaveStore({ storage, digest: browserDigest, now, questIds: new Set(content.questIds()) }); const loaded = await saves.load();
  const initialQuestId = content.questIds().find((id) => !loaded.payload.campaign.completedQuestIds.includes(id)) ?? content.questIds().at(-1); if (!initialQuestId) throw new Error("CAMPAIGN_EMPTY");
  const initialBattle = content.initialBattleFor(initialQuestId); const lifecycle = createCampaignLifecycle({ content: campaign, port: content, saves, now });
  return { runner, saves, storage, initialQuestId, initialBattle, initialWorld: content.worldViewFor(initialBattle), content, lifecycle, resolveTurn };
}
// bootstrapRpgApp 传给 createAppController 的对象必须显式包含 initialQuestId: dependencies.initialQuestId。
```

```ts
// rpg/src/app/bootstrap.test.ts；使用真实 content/gate/reducer/lifecycle
import { expect, it, vi } from "vitest";
import { createAppController } from "./app-controller";
import { createProductionDependencies } from "./bootstrap";
import { resolveTurn } from "../game/combat/resolve-turn";
import type { SavePayload, SaveStorage, SaveStore } from "../game/save/types";
import type { RunnerPort } from "./app-model";
import { createCampaignAppContent } from "../content/app-content-adapter";
import { loadCampaignContentForNode } from "../content/node-loader";
it("starts the first incomplete quest with aligned battle, gate, and replay", async () => { const campaign = await loadCampaignContentForNode(new URL("../../content/", import.meta.url)); const content = createCampaignAppContent(campaign); const saved: SavePayload = { campaign: { completedQuestIds: ["python-marsh-01", "python-marsh-02"], unlockedSkillIds: [], equipmentIds: [] }, drafts: {}, preferences: { reducedMotion: false }, replays: [] }; let written: SavePayload = saved; const saves: SaveStore = { load: async () => ({ kind: "loaded", payload: structuredClone(saved), revision: 1 }), save: async (next) => { written = structuredClone(next); return { ok: true, revision: 2, prunedReplayIds: [] }; }, exportText: async () => ({ ok: true, text: "" }), importText: async () => ({ kind: "loaded", payload: structuredClone(saved), revision: 1 }) }; const runner: RunnerPort = { run: async () => { throw new Error("UNUSED"); }, interrupt: async () => undefined }; const memory = new Map<string, string>(); const storage: SaveStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: (key) => { memory.delete(key); } }; const dependencies = await createProductionDependencies(campaign, content, runner, storage, saves); expect(dependencies.initialQuestId).toBe("python-marsh-03"); expect(dependencies.initialBattle).toEqual(content.initialBattleFor("python-marsh-03")); const gate = vi.spyOn(content, "gateCommand"); const controller = createAppController({ initialQuestId: dependencies.initialQuestId, initialBattle: dependencies.initialBattle, initialWorld: dependencies.initialWorld, initialSave: saved, runner, saves, content, lifecycle: dependencies.lifecycle, resolveTurn }); expect(controller.snapshot()).toMatchObject({ questId: "python-marsh-03", battle: dependencies.initialBattle, world: dependencies.initialWorld }); await controller.submitManual({ actorId: "rulewright", action: { type: "interact", targetId: "node-a" } }); expect(gate).toHaveBeenCalledWith("python-marsh-03", dependencies.initialBattle, expect.any(Object)); expect(written.replays).toEqual([expect.objectContaining({ replayId: "python-marsh-03:latest", questId: "python-marsh-03", document: expect.objectContaining({ metadata: expect.objectContaining({ questId: "python-marsh-03" }) }) })]); });
```

```ts
// rpg/src/ui/app-view.ts；追加到 renderRecovery 的 button handler
if (action === "retry") button.addEventListener("click", () => { if (snapshot.result.kind === "save_failure") void controller.retrySave(); else void controller.runCode(); });
if (action === "restart") button.addEventListener("click", () => void controller.retryBattle());
```

在所有 `fakeContent()` 增加真实 `gateCommand` fake，在所有 Controller/Bootstrap fixture 增加 `initialQuestId` 和 `CampaignLifecyclePort` fake；不得用类型断言省略新增字段。

Run: `npm --prefix rpg run test -- src/content/campaign-lifecycle.test.ts src/app/app-controller.test.ts src/app/bootstrap.test.ts`

Run: `npm --prefix rpg run build`

Expected: manual/runner gate、async submitInput、replay verification、phase check、奖励、SaveStore 和两个 UI recovery 动作均通过同一 AppController 链。

- [ ] **Step 4: 提交已接线 lifecycle。**

```bash
git add rpg/src/content/campaign-lifecycle.ts rpg/src/content/campaign-lifecycle.test.ts rpg/src/app/app-model.ts rpg/src/app/app-controller.ts rpg/src/app/app-controller.test.ts rpg/src/app/bootstrap.ts rpg/src/ui/app-view.ts
git commit -m "feat: integrate campaign lifecycle into app flow"
```

### Task 6: 真实资产与 window 注入的多回合 Playwright 验收

**Files:**
- Create: `rpg/public/assets/tiny-swords/LICENSE-snapshot.txt`
- Create: `rpg/public/assets/tiny-swords/floor.png`
- Create: `rpg/public/assets/tiny-swords/allies.png`
- Create: `rpg/public/assets/tiny-swords/enemy.png`
- Create: `rpg/public/assets/tiny-swords/objective.png`
- Modify: `rpg/ASSET-LICENSES.json`
- Modify: `rpg/src/main.ts`
- Create: `rpg/e2e/campaign.spec.ts`

**Interfaces:**
- 正常 Playwright 用例只向 `window.__RPG_TEST_DEPENDENCIES__` 放入可观察 `saves`，runner 必须由生产 `new PythonRunnerAdapter()` 创建；只有 unavailable 用例注入 failing runner。`main.ts` 必须用真实 `loadCampaignContentForBrowser -> decodeCampaignCatalog -> createCampaignAppContent` 构造 content，再补入真实 `resolveTurn` 与 lifecycle，测试不得手写关卡/content/world DTO 或候选 command。
- 生产路径使用 `loadCampaignContentForBrowser()`、`createCampaignAppContent()`、`PythonRunnerAdapter()`；不存在测试注入时也必须正常启动。

- [ ] **Step 1: 下载实际采用的 Tiny Swords 文件并写许可快照。**

使用 agent-reach 已核验的原始来源下载实际文件，只保留项目采用的四个 64px PNG 和许可快照。执行 `content:hash` 将真实 SHA-256 写入现有 ledger 条目，随后 `content:check` 必须通过。禁止用占位图片或手写摘要。

Run: `npm --prefix rpg run content:hash`

Run: `npm --prefix rpg run content:check`

Expected: 四个磁盘文件、四个 ledger 文件条目和一个许可快照全部通过。

- [ ] **Step 2: 写真实 Pyodide 多回合 E2E；仅 unavailable 注入 failing runner。**

```ts
// rpg/e2e/campaign.spec.ts
import { expect, test, type Page } from "@playwright/test";
async function install(page: Page, unavailable = false) { await page.addInitScript(({ unavailable }) => {
  const payload = { campaign: { completedQuestIds: [], unlockedSkillIds: [], equipmentIds: [] }, drafts: {}, preferences: { reducedMotion: true }, replays: [] }; let saved = structuredClone(payload);
  const saves = { load: async () => ({ kind: "loaded", payload: structuredClone(saved), revision: 1 }), save: async (next: any) => { saved = structuredClone(next); (window as any).__RPG_TEST_SAVED__ = saved; return { ok: true, revision: 2, prunedReplayIds: [] }; }, exportText: async () => ({ ok: true, text: JSON.stringify(saved) }), importText: async () => ({ kind: "loaded", payload: structuredClone(saved), revision: 1 }) };
  const seed: any = { saves };
  if (unavailable) seed.runner = { run: async (request: any) => ({ protocolVersion: 1, runId: request.runId, attemptId: request.attemptId, executionStatus: "runner_error", trace: [], diagnostics: [{ code: "RUNNER_UNAVAILABLE", severity: "error", message: "Worker unavailable", recoveryAction: "Use manual turn" }], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 1, traceEvents: 0 } }), interrupt: async () => undefined };
  (window as any).__RPG_TEST_DEPENDENCIES__ = seed;
}, { unavailable }); }

test("executes all real solution.py files through production Pyodide and persists verified progression", async ({ page }) => { await install(page); await page.goto("/"); const ids = await page.evaluate(() => (window as any).__RPG_TEST_HANDLE__.questIds); expect(ids).toEqual(["python-marsh-01", "python-marsh-02", "python-marsh-03", "python-marsh-04", "python-marsh-05", "python-marsh-06"]); for (const id of ids) { await page.evaluate(async (questId) => { const handle = (window as any).__RPG_TEST_HANDLE__; await handle.controller.retryBattle(questId); const path = handle.campaign.questById[questId].solutionPath; handle.controller.setDraft(handle.content.readContentText(path)); }, id); let phase = "in_progress"; for (let turn = 0; turn < 20 && phase === "in_progress"; turn += 1) phase = await page.evaluate(async () => { const controller = (window as any).__RPG_TEST_HANDLE__.controller; await controller.runCode(); return controller.snapshot().battle.phase; }); expect(phase, `${id} did not win with its real solution.py`).toBe("won"); await expect(page.getByText("战斗胜利。")).toBeVisible(); } const saved = await page.evaluate(() => (window as any).__RPG_TEST_SAVED__); expect(saved.campaign.completedQuestIds).toEqual(ids); expect(saved.replays.map((item: any) => item.questId).sort()).toEqual([...ids].sort()); await expect(page.locator("[data-replay]")).toContainText("已验证"); });
test("surfaces an injected runner unavailable without replacing real content", async ({ page }) => { await install(page, true); await page.goto("/"); await page.evaluate(async () => (window as any).__RPG_TEST_HANDLE__.controller.runCode()); await expect(page.locator("[data-run-state]")).toContainText("不可用"); await expect(page.locator("[data-diagnostics]")).toContainText("Worker unavailable"); });
```

正常用例中不存在 `runner` seed，也不得增加按 `questId` 生成 command 的测试 helper；候选命令只能来自生产 `PythonRunnerAdapter` 执行真实 browser loader 所载入的 `solution.py`。因此任一 `solution.py` 语法或行为被破坏时，真实 Pyodide 用例必须失败。

`main.ts` 把测试 seed 扩展成完整依赖；content 和 lifecycle 只能在加载真实 catalog 后构造：

```ts
// rpg/src/main.ts 的最终启动边界
import type { AppController } from "./app/app-model";
import type { BootstrapDependencies } from "./app/bootstrap";
import type { CampaignAppContentPort, CampaignContent } from "./content/types";
declare global { interface Window { __RPG_TEST_DEPENDENCIES__?: Partial<Pick<BootstrapDependencies, "runner" | "saves">>; __RPG_TEST_HANDLE__?: { controller: AppController; campaign: CampaignContent; content: CampaignAppContentPort; questIds: readonly string[] } } }
async function main(): Promise<void> {
  const root = requireAppRoot(document); const campaign = loadCampaignContentForBrowser(); const content = createCampaignAppContent(campaign); const injected = window.__RPG_TEST_DEPENDENCIES__;
  const runner = injected?.runner ?? new PythonRunnerAdapter(); const dependencies = await createProductionDependencies(campaign, content, runner, localStorage, injected?.saves); const controller = await bootstrapRpgApp(root, dependencies);
  if (injected) window.__RPG_TEST_HANDLE__ = { controller, campaign, content, questIds: content.questIds() };
}
void main().catch((error) => renderFatalError(requireAppRoot(document), error));
```

再增加 1280x720、1440x900 和 390x844 三个视口断言；桌面可编辑运行，小屏只读但可查看战场/诊断/重放/导出；所有视口断言无横向溢出和文字覆盖。

Run: `npm --prefix rpg run test -- src/content src/game/progression tools/content-check`

Run: `npm --prefix rpg run build`

Run: `npm --prefix rpg exec playwright test e2e/campaign.spec.ts`

Run: `npm --prefix rpg run content:check`

Run: `git diff --check`

Expected: 六关 schema/hidden gate/replay、内容端口、战役事务、真实资产和生产 Pyodide 多回合浏览器链路全部 PASS；正常用例破坏任一 `solution.py` 后必定 FAIL。

- [ ] **Step 3: 提交资产和最终 E2E。**

```bash
git add rpg/public/assets/tiny-swords rpg/ASSET-LICENSES.json rpg/src/main.ts rpg/e2e/campaign.spec.ts
git commit -m "test: verify complete Python RPG campaign"
```

## 完成标准

- 六份 quest JSON 和三份 shared JSON 均可由 `JSON.parse` 读取，并通过共享 runtime decoder。
- Node/browser loader 产生相同的关卡 ID、DTO 和文本；浏览器 bundle 无 `node:` 导入。
- 每条 hidden assertion 在 `resolveTurn` 前实际执行；目标型关卡无敌人并由真实 reducer 产生 `won`。
- Checker 验证全部引用、路径、磁盘文件、许可快照与摘要；没有手写未知哈希。
- AppContentPort 的 `readContentText/buildRunRequest` 生成完整合法 `RunRequest`。
- AppController 的 accepted 流程注入 lifecycle，后者创建/追加/验证重放、写精确 ReplayRecord、幂等奖励并支持 `retryBattle/retrySave`。
- Playwright 正常用例仅注入 SaveStore，使用生产 `PythonRunnerAdapter`、真实 browser content/gate/resolveTurn 执行六份 `solution.py` 并完成 verified replay；仅 unavailable 用例注入 failing runner。
