# Python RPG App Shell, Save, Battlefield, And Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 Python RPG 的原生 TypeScript 应用外壳，使版本化本地存档、单一战斗命令入口、战场事件播放、Python 编辑与逐步回放在桌面端形成可访问且可验收的工作流。

**Architecture:** `AppController` 是唯一的界面流程协调者：它持有当前 `BattleState` 引用、Runner 生命周期和非战斗的视图状态，但从不复制或直接改写战斗事实。手动操作产生的 `TurnCommand` 与 Runner 的 `unknown returnValue` 都交给战斗计划提供的运行时严格入口 `resolveTurn`；UI 只渲染 `WorldView`、`BattleEvent`、`CommandResolution`、`RunResult` 和本地 UI 状态。`SaveStore` 以校验过的版本化信封写入双代记录，重放仅保存关卡初始快照和已接受命令日志，绝不保存活跃战斗的中间状态。

**Tech Stack:** 原生 TypeScript、Vite、Vitest + jsdom、Playwright、`codemirror@6.0.2`、`@codemirror/lang-python@6.2.1`、`@codemirror/state@6.7.1`、`@codemirror/view@6.43.8`、`@codemirror/theme-one-dark@6.1.3`、`lucide@1.31.0`。

## Global Constraints

- 新应用位于 `rpg/`；使用原生 TypeScript + Vite，禁止引入 React、Vue 或任何组件框架。
- 每个新增源文件只承担一项职责；生产文件不超过 300 行，超过 240 行时先按职责拆分。
- 战斗公共类型固定从 `rpg/src/game/combat/types.ts` 导入：`BattleState`、`WorldView`、`TurnCommand`、`BattleEvent`、`CommandResolution`；严格归约器固定从 `rpg/src/game/combat/resolve-turn.ts` 导入，签名为 `resolveTurn(state: BattleState, input: unknown): CommandResolution`。本计划不得实现、镜像或绕过其运行时解析和规则。
- Runner 公共类型固定从 `rpg/src/runners/protocol/types.ts` 导入：`RunRequest`、`RunResult`、`Diagnostic`、`TraceEvent`；真实适配器固定为 `rpg/src/runners/python/adapter.ts` 的 `PythonRunnerAdapter`。生产启动只能实例化真实适配器，测试通过依赖注入传入 fake runner。
- `SaveStore` 的当前存档信封含 `schemaVersion`、严格递增的 `revision`、`savedAt` 与 `sha256:` 校验和；最多保留 5 个完整重放，序列化结果超过 3 MiB 时只先删除最旧重放，不能删除进度或代码草稿。
- 存档写入顺序是：向非活动代写入、读回并校验、切换活动指针、保留原活动代；读取顺序是活动代、上一代、用户明确选取的导入文本、全新存档，并始终返回可见恢复原因。
- 存档只包含战役进度、装备/解锁、按关卡的代码草稿、界面偏好和重放；不得出现 `activeBattle`、`battleState`、当前单位、未结算事件或其他战斗中间态字段。
- 手动和自动回合都只生成一个包含 `actorId`、`expectedRevision`、可选 `movePath` 与必需 `action` 的 `TurnCommand`；可选移动路径永远先于主动作，不能拆分为两个命令。
- 动画只顺序消费 `BattleEvent`，不得以 DOM、路径预览或动画计时器推导、修改或补全战斗状态。
- 主验收视口为 1280x720 与 1440x900；小于 960px 时仅支持战场、轨迹、诊断和存档导出只读查看，隐藏代码编辑、运行、手动命令、导入与新建存档入口。
- 所有可操作控件键盘可达并显示焦点环，触控目标至少 44x44 CSS px；尊重 `prefers-reduced-motion: reduce`，其中事件播放立即完成。
- 视觉使用克制的奥术工业幻想：煤黑岩面、铁灰表面、铜绿强调和琥珀语义强调；不用默认紫色、不用渐变球、不用卡片套卡片。图标使用 Lucide，并通过 `aria-label` 与可见悬浮提示说明图标按钮。
- 必须覆盖加载、就绪、运行、中断中、重启中、不可用、空状态、诊断错误、命令拒绝、存档写入失败、损坏重放和恢复后的状态；不得把 Runner 成功或关卡通过伪造为生产默认值。
- 每个任务遵循测试先行：先写失败测试并观察失败，再实施最小代码；任务末尾执行列出的确定性检查、`git diff --check`，并创建独立提交。

---

## File Structure

| 文件 | 单一职责 |
| --- | --- |
| `rpg/package.json` | 固定浏览器应用、测试和验收命令及依赖版本。 |
| `rpg/vite.config.ts` | Vite 与 jsdom Vitest 配置。 |
| `rpg/playwright.config.ts` | 本机 Vite 浏览器验收服务器与项目设置。 |
| `rpg/src/game/save/types.ts` | 可持久化数据、信封、恢复结果与存储端口类型。 |
| `rpg/src/game/save/canonical-json.ts` | 稳定 JSON 编码、UTF-8 字节计数和 SHA-256 字符串封装。 |
| `rpg/src/game/save/migrations.ts` | 从一个存档版本到下一个版本的显式迁移链。 |
| `rpg/src/game/save/save-store.ts` | 双代事务写入、读取回退、容量回收、导入与导出。 |
| `rpg/src/app/app-model.ts` | 非战斗 UI 状态、手动命令输入和控制器依赖类型。 |
| `rpg/src/app/app-controller.ts` | Runner、存档、战斗归约和 UI 通知的唯一流程协调。 |
| `rpg/src/app/bootstrap.ts` | 生产依赖装配和只在显式测试注入时替换 Runner。 |
| `rpg/src/ui/components/app-shell.ts` | 稳定语义 HTML 骨架、元素引用和可访问状态区域。 |
| `rpg/src/ui/components/status-strip.ts` | 应用/Runner/存档状态的文案和语义色显示。 |
| `rpg/src/ui/components/battlefield.ts` | 只读网格、单位、路径预览和基于事件的视觉播放。 |
| `rpg/src/ui/components/command-panel.ts` | 手动路径和主动作选择，并把原子输入交给控制器。 |
| `rpg/src/ui/components/diagnostics-panel.ts` | 运行诊断、命令拒绝和恢复操作说明。 |
| `rpg/src/ui/components/replay-panel.ts` | 轨迹选择、逐步播放、重放校验/损坏状态。 |
| `rpg/src/ui/editor/python-editor.ts` | CodeMirror Python 编辑器、诊断和轨迹高亮适配。 |
| `rpg/src/ui/app-view.ts` | 将控制器快照分发给各视图，不持有第二份战斗状态。 |
| `rpg/src/ui/styles/tokens.css` | 色彩、排版、间距、焦点和动效 token。 |
| `rpg/src/ui/styles/layout.css` | 双栏/三栏桌面布局与小屏只读降级。 |
| `rpg/src/ui/styles/components.css` | 网格、单位、编辑器、轨迹和状态的组件样式。 |
| `rpg/src/main.ts` | 查找 `#app` 并启动应用。 |
| `rpg/e2e/app-shell.spec.ts` | 桌面、小屏、键盘、错误与存档回退的浏览器验收。 |

### Task 1: 接入既有 Vite 工程与确定性测试环境

**Files:**
- Modify: `rpg/package.json`
- Modify: `rpg/tsconfig.json`
- Modify: `rpg/vite.config.ts`
- Modify: `rpg/playwright.config.ts`
- Modify: `rpg/index.html`
- Create: `rpg/src/test/setup.ts`
- Create: `rpg/src/main.test.ts`

**Interfaces:**
- Produces `npm run dev`, `npm run build`, `npm run test`, `npm run test:run`, `npm run e2e` and `npm run check` for later tasks.
- Produces `window.matchMedia` and `crypto.subtle` test shims only in jsdom; production code continues to use browser platform APIs.

- [ ] **Step 1: 写入失败的启动测试，要求应用根节点不存在时抛出中文错误，而非静默忽略。**

```ts
// rpg/src/main.test.ts
import { describe, expect, it } from "vitest";
import { requireAppRoot } from "./main";

describe("application entry", () => {
  it("rejects a document without #app", () => {
    expect(() => requireAppRoot(document)).toThrow("页面缺少 RPG 应用容器");
  });
});
```

- [ ] **Step 2: 运行测试，确认在入口模块尚未创建前失败。**

Run: `npm --prefix rpg run test:run -- src/main.test.ts`

Expected: FAIL，错误指出找不到 `src/main`。

- [ ] **Step 3: 在战斗计划已创建的工程上以增量方式补充 UI 依赖、测试配置和最小入口实现；不得覆盖既有脚本、端口、别名、Vitest 配置或 HTML 元数据。**

```json
// rpg/package.json：仅把下列键合并进现有 dependencies，保留全部已有键和值
"dependencies": {
  "@codemirror/lang-python": "6.2.1",
  "@codemirror/state": "6.7.1",
  "@codemirror/theme-one-dark": "6.1.3",
  "@codemirror/view": "6.43.8",
  "codemirror": "6.0.2",
  "lucide": "1.31.0"
}
```

```ts
// rpg/vite.config.ts：向已有 test 配置合并，不替换其余 defineConfig 字段
test: { environment: "jsdom", setupFiles: ["src/test/setup.ts"], exclude: ["e2e/**", "node_modules/**"] }

// rpg/src/main.ts
export function requireAppRoot(documentRef: Document): HTMLElement {
  const root = documentRef.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("页面缺少 RPG 应用容器");
  return root;
}
```

```html
<!-- rpg/index.html：保留已有 head；若尚无则在 body 添加以下节点和模块入口 -->
<div id="app"></div><script type="module" src="/src/main.ts"></script>
```

```ts
// rpg/src/test/setup.ts
import { vi } from "vitest";

Object.defineProperty(window, "matchMedia", { value: vi.fn().mockImplementation((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
```

- [ ] **Step 4: 添加严格 TypeScript 与 Playwright 配置，使验收服务不会复用错误端口。**

```json
// rpg/tsconfig.json：向 compilerOptions.types 追加 "vitest/globals"，并确保 include 包含 "src"；不改动战斗计划已有编译选项
```

```ts
// rpg/playwright.config.ts：仅新增/合并 testDir: "./e2e"、reporter: "line" 与现有 webServer 对应的 baseURL；复用战斗计划已固定的主机和端口
```

- [ ] **Step 5: 安装锁定依赖并验证空工程。**

Run: `npm --prefix rpg install --save-exact codemirror@6.0.2 @codemirror/lang-python@6.2.1 @codemirror/state@6.7.1 @codemirror/view@6.43.8 @codemirror/theme-one-dark@6.1.3 lucide@1.31.0`

Run: `npm view lucide@latest version && npm view lucide@1.31.0 version`

Expected: 2026-08-10 npm registry 复验证据为 `latest=1.31.0` 且精确版本查询同为 `1.31.0`；`package-lock.json` 精确记录 UI 依赖版本，不删除战斗计划已有依赖。

Run: `npm --prefix rpg run test:run -- src/main.test.ts`

Expected: 测试通过。

Run: `npm --prefix rpg run build`

Expected: Vite 生成 `dist/`，类型检查无错误。

Run: `git diff --check`

Expected: 无空白错误。

- [ ] **Step 6: 提交独立工程基础。**

```bash
git add rpg/package.json rpg/package-lock.json rpg/tsconfig.json rpg/vite.config.ts rpg/playwright.config.ts rpg/index.html rpg/src/test/setup.ts rpg/src/main.ts rpg/src/main.test.ts
git commit -m "chore: add RPG UI test dependencies"
```

### Task 2: 版本化存档信封与内容完整性

**Files:**
- Create: `rpg/src/game/save/types.ts`
- Create: `rpg/src/game/save/canonical-json.ts`
- Create: `rpg/src/game/save/save-store.ts`
- Create: `rpg/src/game/save/save-store.test.ts`

**Interfaces:**
- Produces `SavePayload`, `SaveEnvelope`, `SaveStore`, `SaveLoadResult`, `SaveFailure`, `SaveStorage` and `SaveDigest` from `rpg/src/game/save/types.ts`.
- Produces `createSaveStore(options: SaveStoreOptions): SaveStore`, `canonicalJson(value: JsonValue): string`, `utf8Bytes(value: string): number` and `sha256Prefixed(value: string, subtle: SubtleCrypto): Promise<string>`.
- `SaveStore` exposes `load(recoveryImportText?: string): Promise<SaveLoadResult>`, `save(payload: SavePayload): Promise<SaveWriteResult>`, `exportText(): Promise<SaveExportResult>` and `importText(text: string): Promise<SaveLoadResult>`；导出只返回最后验证通过的 generation，不能据空 payload 生成伪新档。

- [ ] **Step 1: 写入失败测试，锁定信封字段、稳定校验、禁止战斗中间态以及不依赖真实 Web Crypto 的可注入摘要器。**

```ts
// rpg/src/game/save/save-store.test.ts
import { describe, expect, it } from "vitest";
import { createSaveStore } from "./save-store";

const digest = { sha256: async (text: string) => `sha256:${text.length.toString(16)}` };
const memory = new Map<string, string>();
const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) };

it("writes a checksummed schema envelope without live battle data", async () => {
  const store = createSaveStore({ storage, digest, now: () => "2026-08-10T00:00:00.000Z", questIds: new Set(["python-marsh-01"]) });
  const result = await store.save({ campaign: { completedQuestIds: [], unlockedSkillIds: [], equipmentIds: [] }, drafts: { "python-marsh-01": "def choose_turn(world):\n return {}" }, preferences: { reducedMotion: false }, replays: [] });
  expect(result.ok).toBe(true);
  const exportedResult = await store.exportText();
  expect(exportedResult.ok).toBe(true);
  if (!exportedResult.ok) throw new Error(exportedResult.message);
  const exported = JSON.parse(exportedResult.text) as { schemaVersion: number; revision: number; checksum: string; payload: Record<string, unknown> };
  expect(exported).toMatchObject({ schemaVersion: 1, revision: 1, checksum: "sha256:" });
  expect(exported.payload).not.toHaveProperty("battleState");
  expect(exported.payload).not.toHaveProperty("activeBattle");
});
```

- [ ] **Step 2: 运行存档测试，确认在模块不存在时失败。**

Run: `npm --prefix rpg run test:run -- src/game/save/save-store.test.ts`

Expected: FAIL，错误指出 `./save-store` 尚不存在。

- [ ] **Step 3: 实现精确的数据边界和规范化校验内容。**

```ts
// rpg/src/game/save/types.ts
import type { Replay } from "../combat/types";
export interface CampaignProgress { completedQuestIds: string[]; unlockedSkillIds: string[]; equipmentIds: string[]; }
export interface SavePreferences { reducedMotion: boolean; }
export interface ReplayRecord { replayId: string; questId: string; createdAt: string; document: Replay; }
export interface SavePayload { campaign: CampaignProgress; drafts: Record<string, string>; preferences: SavePreferences; replays: ReplayRecord[]; }
export interface SaveEnvelope { schemaVersion: number; revision: number; savedAt: string; checksum: `sha256:${string}`; payload: SavePayload; }
export interface MigrationEnvelope { schemaVersion: number; revision: number; savedAt: string; checksum: `sha256:${string}`; payload: unknown; }
export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }
export interface SaveDigest { sha256(text: string): Promise<`sha256:${string}`>; }
export type SaveFailure = "STORAGE_UNAVAILABLE" | "CHECKSUM_MISMATCH" | "INVALID_ENVELOPE" | "SAVE_LIMIT_EXCEEDED" | "WRITE_GENERATION_FAILED" | "WRITE_POINTER_FAILED";
export type SaveRecoveryCode = "ACTIVE_POINTER_MISSING" | "ACTIVE_POINTER_INVALID" | "ACTIVE_GENERATION_INVALID" | "PREVIOUS_GENERATION_INVALID" | "RECOVERED_PREVIOUS_GENERATION" | "IMPORTED_RECOVERY" | "MIGRATED" | SaveFailure;
export type SaveLoadResult = { kind: "loaded" | "recovered" | "fresh"; payload: SavePayload; revision: number; notice?: { code: SaveRecoveryCode; message: string; action: "export" | "import" | "continue" } };
export type SaveWriteResult = { ok: true; revision: number; prunedReplayIds: string[] } | { ok: false; code: SaveFailure; message: string };
export type SaveExportResult = { ok: true; text: string } | { ok: false; code: SaveFailure; message: string };
export interface SaveStore { load(recoveryImportText?: string): Promise<SaveLoadResult>; save(payload: SavePayload): Promise<SaveWriteResult>; exportText(): Promise<SaveExportResult>; importText(text: string): Promise<SaveLoadResult>; }
export interface SaveStoreOptions { storage: SaveStorage; digest: SaveDigest; now: () => string; questIds: ReadonlySet<string>; migrations?: readonly import("./migrations").SaveMigration[]; currentSchemaVersion?: number; namespace?: string; }
```

```ts
// rpg/src/game/save/canonical-json.ts
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}
export function utf8Bytes(value: string): number { return new TextEncoder().encode(value).byteLength; }
export async function sha256Prefixed(value: string, subtle: SubtleCrypto): Promise<`sha256:${string}`> {
  const bytes = new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return `sha256:${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
```

```ts
// rpg/src/game/save/save-store.ts
import { canonicalJson, utf8Bytes, type JsonValue } from "./canonical-json";
import { migrateEnvelope, type SaveMigration } from "./migrations";
import type { CampaignProgress, MigrationEnvelope, ReplayRecord, SaveDigest, SaveEnvelope, SaveExportResult, SaveLoadResult, SavePayload, SavePreferences, SaveRecoveryCode, SaveStore, SaveStoreOptions, SaveWriteResult } from "./types";
import type { Replay } from "../combat/types";

const CURRENT_SCHEMA_VERSION = 1;
const emptyPayload = (): SavePayload => ({ campaign: { completedQuestIds: [], unlockedSkillIds: [], equipmentIds: [] }, drafts: {}, preferences: { reducedMotion: false }, replays: [] });
// 校验和在迁移前覆盖历史 payload 的原始 JSON；当前 SaveEnvelope 是该公共结构的可赋值子集。
const checksumInput = (envelope: Omit<MigrationEnvelope, "checksum">): JsonValue => envelope as unknown as JsonValue;

function decodeReplay(value: unknown): Replay {
  if (!value || typeof value !== "object") throw new Error("INVALID_ENVELOPE");
  const record = value as Record<string, unknown>, metadata = record.metadata as Record<string, unknown> | undefined;
  if (record.replayVersion !== 1 || !metadata || typeof metadata.engineVersion !== "string" || typeof metadata.contentVersion !== "string" || metadata.runnerProtocolVersion !== 1 || typeof metadata.questId !== "string" || typeof metadata.battleId !== "string" || typeof metadata.seed !== "string" || !record.initialState || !Array.isArray(record.steps) || typeof record.initialStateHash !== "string" || typeof record.finalStateHash !== "string" || !["in_progress", "won", "lost"].includes(String(record.outcome))) throw new Error("INVALID_ENVELOPE");
  return value as Replay;
}
function decodePayload(value: unknown): SavePayload {
  if (!value || typeof value !== "object") throw new Error("INVALID_ENVELOPE"); const payload = value as Record<string, unknown>;
  if (!payload.campaign || typeof payload.campaign !== "object" || !payload.drafts || typeof payload.drafts !== "object" || !payload.preferences || typeof payload.preferences !== "object" || !Array.isArray(payload.replays)) throw new Error("INVALID_ENVELOPE");
  const replays = payload.replays.map((item): ReplayRecord => { if (!item || typeof item !== "object") throw new Error("INVALID_ENVELOPE"); const record = item as Record<string, unknown>; if (typeof record.replayId !== "string" || typeof record.questId !== "string" || typeof record.createdAt !== "string") throw new Error("INVALID_ENVELOPE"); return { replayId: record.replayId, questId: record.questId, createdAt: record.createdAt, document: decodeReplay(record.document) }; });
  return { campaign: payload.campaign as CampaignProgress, drafts: payload.drafts as Record<string, string>, preferences: payload.preferences as SavePreferences, replays };
}
type RawEnvelope = MigrationEnvelope;
function decodeCommonEnvelope(value: unknown): RawEnvelope {
  if (!value || typeof value !== "object") throw new Error("INVALID_ENVELOPE");
  const record = value as Record<string, unknown>;
  if (!Number.isInteger(record.schemaVersion) || !Number.isInteger(record.revision) || typeof record.savedAt !== "string" || typeof record.checksum !== "string" || !record.checksum.startsWith("sha256:")) throw new Error("INVALID_ENVELOPE");
  return { schemaVersion: record.schemaVersion as number, revision: record.revision as number, savedAt: record.savedAt, checksum: record.checksum as `sha256:${string}`, payload: record.payload };
}

function assertPersistable(payload: SavePayload, questIds: ReadonlySet<string>): void {
  if (Object.hasOwn(payload as object, "battleState") || Object.hasOwn(payload as object, "activeBattle")) throw new Error("INVALID_ENVELOPE");
  for (const [questId, source] of Object.entries(payload.drafts)) if (!questIds.has(questId) || utf8Bytes(source) > 65_536) throw new Error("INVALID_ENVELOPE");
}
```

- [ ] **Step 4: 实现最小的信封创建、导出和完整性校验；读取尚未存在的存档时返回显式新存档结果。**

```ts
// rpg/src/game/save/save-store.ts
async function envelopeFor(payload: SavePayload, revision: number, now: () => string, digest: SaveDigest): Promise<SaveEnvelope> {
  const unsigned = { schemaVersion: CURRENT_SCHEMA_VERSION, revision, savedAt: now(), payload };
  return { ...unsigned, checksum: await digest.sha256(canonicalJson(checksumInput(unsigned))) };
}

async function verifyCurrentEnvelope(value: unknown, digest: SaveDigest, questIds: ReadonlySet<string>): Promise<SaveEnvelope> {
  const raw = decodeCommonEnvelope(value); if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new Error("INVALID_ENVELOPE");
  const envelope: SaveEnvelope = { ...raw, payload: decodePayload(raw.payload) };
  assertPersistable(envelope.payload, questIds);
  const { checksum, ...unsigned } = envelope;
  if (await digest.sha256(canonicalJson(checksumInput(unsigned))) !== checksum) throw new Error("CHECKSUM_MISMATCH");
  return envelope;
}

interface HistoricalPayloadCodec { validate(payload: unknown): void; decode(payload: unknown): unknown; }
const historicalCodecs: ReadonlyMap<number, HistoricalPayloadCodec> = new Map([
  [0, { validate: (payload) => { if (!payload || typeof payload !== "object" || !(payload as Record<string, unknown>).campaign || typeof (payload as Record<string, unknown>).drafts !== "object") throw new Error("INVALID_ENVELOPE"); }, decode: (payload) => payload }],
  [1, { validate: (payload) => { if (!payload || typeof payload !== "object" || !(payload as Record<string, unknown>).campaign || typeof (payload as Record<string, unknown>).drafts !== "object" || !(payload as Record<string, unknown>).preferences || !Array.isArray((payload as Record<string, unknown>).replays)) throw new Error("INVALID_ENVELOPE"); }, decode: (payload) => payload }],
]);
function historicalCodecFor(value: RawEnvelope): HistoricalPayloadCodec {
  if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 0 || !Number.isInteger(value.revision) || value.revision < 0) throw new Error("INVALID_ENVELOPE");
  const codec = historicalCodecs.get(value.schemaVersion); if (!codec) throw new Error("INVALID_ENVELOPE"); codec.validate(value.payload); return codec;
}
async function verifyDeclaredEnvelope(value: unknown, digest: SaveDigest): Promise<RawEnvelope> {
  const envelope = decodeCommonEnvelope(value); historicalCodecFor(envelope);
  const { checksum, ...unsigned } = envelope;
  if (await digest.sha256(canonicalJson(checksumInput(unsigned))) !== checksum) throw new Error("CHECKSUM_MISMATCH");
  return envelope;
}
function migrateDeclaredEnvelope(raw: RawEnvelope, migrations: readonly SaveMigration[], currentSchemaVersion: number): SaveEnvelope {
  const legacy = { ...raw, payload: historicalCodecFor(raw).decode(raw.payload) };
  const migrated = migrateEnvelope(legacy, migrations, currentSchemaVersion);
  return { ...migrated, payload: decodePayload(migrated.payload) };
}
```

- [ ] **Step 5: 运行完整性测试与类型检查。**

Run: `npm --prefix rpg run test:run -- src/game/save/save-store.test.ts`

Run: `npm --prefix rpg run build`

Run: `git diff --check`

Expected: 信封校验测试通过，未引入 `BattleState` 存档类型。

- [ ] **Step 6: 提交独立的存档格式与校验模块。**

```bash
git add rpg/src/game/save/types.ts rpg/src/game/save/canonical-json.ts rpg/src/game/save/save-store.ts rpg/src/game/save/save-store.test.ts
git commit -m "feat: add versioned RPG save envelope"
```

### Task 3: 双代存档恢复、迁移、导入与重放保留

**Files:**
- Create: `rpg/src/game/save/migrations.ts`
- Modify: `rpg/src/game/save/save-store.ts`
- Modify: `rpg/src/game/save/save-store.test.ts`

**Interfaces:**
- Consumes `SaveEnvelope`, `SavePayload`, `SaveStorage` and `SaveDigest` from `rpg/src/game/save/types.ts`.
- Produces `SaveMigration { fromVersion: number; migrate(envelope: MigrationEnvelope): MigrationEnvelope }`, `migrateEnvelope(envelope, migrations, currentVersion): MigrationEnvelope` and deterministic storage keys `rpg:save:generation:a`, `rpg:save:generation:b`, `rpg:save:active`.
- `load` 的固定尝试顺序为：有效活动指针指向的代、另一代、用户明确提供的导入文本、全新存档。指针缺失或无效时按 `a` 后 `b` 检查；每次失败追加稳定原因，最终通知保留首个原因和可见恢复动作。
- 成功 `save` 只写一个非活动代，读回并验签后才写活动指针；代写入失败返回 `WRITE_GENERATION_FAILED`，指针写入失败返回 `WRITE_POINTER_FAILED`，两者都保留旧活动代且不合并为同一错误。

- [ ] **Step 1: 增加失败测试，覆盖读回校验后才切指针、活动代损坏时上一代回退、逐版本迁移、3 MiB 回收、五个重放上限、导入验证和保留原始导入备份。**

```ts
it("uses the other generation when the active generation is corrupt", async () => {
  const store = createSaveStore({ storage, digest, now: () => "2026-08-10T00:00:00.000Z", questIds: new Set(["python-marsh-01"]) });
  await store.save(payloadWithReplay("one"));
  await store.save(payloadWithReplay("two"));
  storage.setItem("rpg:save:generation:b", "{broken");
  await expect(store.load()).resolves.toMatchObject({ kind: "recovered", notice: { code: "INVALID_ENVELOPE" } });
});

it("tries a then b when the pointer is missing, and reports the stable reason", async () => {
  storage.removeItem("rpg:save:active");
  await expect(store.load()).resolves.toMatchObject({ kind: "recovered", notice: { code: "ACTIVE_POINTER_MISSING", action: "continue" } });
});

it("does not switch the pointer if the inactive generation cannot be read back", async () => {
  const brokenStorage = readBackRejectingStorage();
  const failed = await createSaveStore({ storage: brokenStorage, digest, now, questIds }).save(payloadWithReplay("one"));
  expect(failed).toMatchObject({ ok: false, code: "WRITE_GENERATION_FAILED" });
  expect(brokenStorage.getItem("rpg:save:active")).toBeNull();
});

it("prunes only the oldest replays before refusing an oversized save", async () => {
  const result = await store.save(payloadWithSixLargeReplays());
  expect(result).toMatchObject({ ok: true, prunedReplayIds: ["replay-1"] });
  await expect(store.save(payloadWithOversizedDraft())).resolves.toMatchObject({ ok: false, code: "SAVE_LIMIT_EXCEEDED" });
});

it("validates an old envelope with its own schema before migrating and recomputes the current checksum", async () => {
  const legacy = signedLegacyEnvelope({ schemaVersion: 0, revision: 4, payload: legacyPayload });
  const store = createSaveStore({ storage, digest, now, questIds, currentSchemaVersion: 1, migrations: [{ fromVersion: 0, migrate: migrateV0ToV1 }] });
  const loaded = await store.importText(JSON.stringify(legacy));
  expect(loaded).toMatchObject({ kind: "recovered", notice: { code: "MIGRATED" } });
  const exported = await store.exportText(); if (!exported.ok) throw new Error(exported.message);
  expect(JSON.parse(exported.text)).toMatchObject({ schemaVersion: 1, checksum: expect.stringMatching(/^sha256:/) });
});
```

- [ ] **Step 2: 运行扩展测试，确认双代、迁移和容量断言在实施前失败。**

Run: `npm --prefix rpg run test:run -- src/game/save/save-store.test.ts`

Expected: FAIL，断言表明当前实现尚未维护双代键、迁移链和重放回收。

- [ ] **Step 3: 实现逐版本迁移，拒绝跳过版本或循环迁移。**

```ts
// rpg/src/game/save/migrations.ts
import type { SaveEnvelope } from "./types";

import type { MigrationEnvelope } from "./types";
export interface SaveMigration { fromVersion: number; migrate(envelope: MigrationEnvelope): MigrationEnvelope; }
export function migrateEnvelope(envelope: MigrationEnvelope, migrations: readonly SaveMigration[], currentVersion: number): MigrationEnvelope {
  let current = envelope;
  while (current.schemaVersion < currentVersion) {
    const migration = migrations.find((item) => item.fromVersion === current.schemaVersion);
    if (!migration) throw new Error("INVALID_ENVELOPE");
    const next = migration.migrate(current);
    if (next.schemaVersion !== current.schemaVersion + 1) throw new Error("INVALID_ENVELOPE");
    current = next;
  }
  if (current.schemaVersion !== currentVersion) throw new Error("INVALID_ENVELOPE");
  return current;
}
```

- [ ] **Step 4: 将 `SaveStore` 改为双代事务和容量回收实现，并使所有恢复理由可供 UI 显示。容量检查必须针对实际将写入的完整信封 JSON。**

```ts
// rpg/src/game/save/save-store.ts
export function createSaveStore(options: SaveStoreOptions): SaveStore {
  const { storage, digest, now, questIds, migrations = [], currentSchemaVersion = CURRENT_SCHEMA_VERSION, namespace = "rpg:save" } = options;
  const key = { active: `${namespace}:active`, a: `${namespace}:generation:a`, b: `${namespace}:generation:b`, importedBackup: `${namespace}:import-backup` } as const;
  const keyFor = (slot: "a" | "b") => slot === "a" ? key.a : key.b;
  const reasons: SaveRecoveryCode[] = [];
  const inactiveSlot = (active: "a" | "b" | null): "a" | "b" => active === "a" ? "b" : "a";

async function writeGeneration(slot: "a" | "b", envelope: SaveEnvelope): Promise<void> {
  const storageKey = keyFor(slot);
  storage.setItem(storageKey, JSON.stringify(envelope));
  const readBack = storage.getItem(storageKey);
  await verifyEnvelope(readBack ? JSON.parse(readBack) : null, digest, questIds);
}

async function save(payload: SavePayload): Promise<SaveWriteResult> {
  reasons.length = 0;
  const active = readActiveSlot();
  if (reasons.includes("STORAGE_UNAVAILABLE")) return { ok: false, code: "STORAGE_UNAVAILABLE", message: "无法读取活动存档指针，未写入新存档。" };
  const revisionRead = currentRevision();
  if (!revisionRead.ok) return revisionRead.result;
  const compacted = await compactReplays(payload, revisionRead.revision);
  if (!compacted) return { ok: false, code: "SAVE_LIMIT_EXCEEDED", message: "进度与草稿已超过 3 MiB，无法继续保存。" };
  const envelope = await envelopeFor(compacted.payload, revisionRead.revision + 1, now, digest);
  try { await writeGeneration(inactiveSlot(active), envelope); }
  catch (error) { return { ok: false, code: "WRITE_GENERATION_FAILED", message: `新存档未通过读回校验：${messageOf(error)}` }; }
  try { storage.setItem(key.active, inactiveSlot(active)); }
  catch (error) { return { ok: false, code: "WRITE_POINTER_FAILED", message: `活动指针未更新，仍可恢复上一代：${messageOf(error)}` }; }
  return { ok: true, revision: envelope.revision, prunedReplayIds: compacted.prunedReplayIds };
}
```

```ts
// rpg/src/game/save/save-store.ts
async function compactReplays(payload: SavePayload, existingRevision: number): Promise<{ payload: SavePayload; prunedReplayIds: string[] } | null> {
  const replays = [...payload.replays].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const prunedReplayIds: string[] = [];
  while (replays.length > 5 || utf8Bytes(JSON.stringify(await envelopeFor({ ...payload, replays }, existingRevision + 1, now, digest))) > 3 * 1024 * 1024) {
    const removed = replays.shift();
    if (!removed) return null;
    prunedReplayIds.push(removed.replayId);
  }
  const serialized = JSON.stringify(await envelopeFor({ ...payload, replays }, existingRevision + 1, now, digest));
  return utf8Bytes(serialized) <= 3 * 1024 * 1024 ? { payload: { ...payload, replays }, prunedReplayIds } : null;
}
```

- [ ] **Step 5: 实现导入、导出及读取优先级。导入严格按“解析 JSON、校验旧信封和旧校验和、写原始备份、逐版本迁移、用当前版本重新生成校验和、双代保存”的顺序执行。用户没有明确提供导入文本时绝不虚构导入来源。**

```ts
// rpg/src/game/save/save-store.ts
type Slot = "a" | "b";
interface StoredCandidate { slot: Slot; reason: SaveRecoveryCode; isActive: boolean; }
const messageOf = (error: unknown): string => error instanceof Error ? error.message : "存储 API 返回未知错误。";

function readActiveSlot(): Slot | null {
  try { const value = storage.getItem(key.active); if (value === "a" || value === "b") return value; reasons.push(value === null ? "ACTIVE_POINTER_MISSING" : "ACTIVE_POINTER_INVALID"); return null; }
  catch { reasons.push("STORAGE_UNAVAILABLE"); return null; }
}
function readStoredCandidatesInOrder(): StoredCandidate[] {
  const active = readActiveSlot();
  return active ? [{ slot: active, isActive: true, reason: "ACTIVE_GENERATION_INVALID" }, { slot: inactiveSlot(active), isActive: false, reason: "PREVIOUS_GENERATION_INVALID" }] : [{ slot: "a", isActive: false, reason: "ACTIVE_GENERATION_INVALID" }, { slot: "b", isActive: false, reason: "PREVIOUS_GENERATION_INVALID" }];
}
function currentRevision(): { ok: true; revision: number } | { ok: false; result: SaveWriteResult } {
  try {
    const revisions = (["a", "b"] as const).flatMap((slot) => { const raw = storage.getItem(keyFor(slot)); if (!raw) return []; try { return [decodeCommonEnvelope(JSON.parse(raw)).revision]; } catch { return []; } });
    return { ok: true, revision: revisions.reduce((max, revision) => Math.max(max, revision), 0) };
  } catch (error) { return { ok: false, result: { ok: false, code: "STORAGE_UNAVAILABLE", message: `无法读取存档修订号：${messageOf(error)}` } }; }
}
async function tryRead(candidate: StoredCandidate): Promise<SaveEnvelope | undefined> {
  try { const raw = storage.getItem(keyFor(candidate.slot)); const declared = await verifyDeclaredEnvelope(raw ? JSON.parse(raw) : null, digest); const migrated = migrateDeclaredEnvelope(declared, migrations, currentSchemaVersion); assertPersistable(migrated.payload, questIds); return migrated.schemaVersion === declared.schemaVersion ? migrated : await envelopeFor(migrated.payload, migrated.revision, now, digest); }
  catch (error) { reasons.push(error instanceof Error && error.message === "CHECKSUM_MISMATCH" ? "CHECKSUM_MISMATCH" : candidate.reason); return undefined; }
}
function toLoadResult(envelope: SaveEnvelope, kind: "loaded" | "recovered"): SaveLoadResult {
  const recovered = kind === "recovered" || reasons.length > 0;
  return { kind: recovered ? "recovered" : "loaded", payload: envelope.payload, revision: envelope.revision, ...(recovered ? { notice: { code: reasons[0] ?? "RECOVERED_PREVIOUS_GENERATION", message: "已从已验证的存档副本恢复。", action: "continue" } } : {}) };
}
async function load(recoveryImportText?: string): Promise<SaveLoadResult> {
  reasons.length = 0;
  for (const candidate of readStoredCandidatesInOrder()) { const verified = await tryRead(candidate); if (verified) return toLoadResult(verified, candidate.isActive && reasons.length === 0 ? "loaded" : "recovered"); }
  if (recoveryImportText !== undefined) return importText(recoveryImportText);
  return { kind: "fresh", payload: emptyPayload(), revision: 0, notice: { code: reasons[0] ?? "INVALID_ENVELOPE", message: "没有可恢复的本地存档，已创建新存档。", action: "import" } };
}
async function importText(text: string): Promise<SaveLoadResult> {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { kind: "fresh", payload: emptyPayload(), revision: 0, notice: { code: "INVALID_ENVELOPE", message: "导入文件不是有效 JSON。", action: "import" } }; }
  let imported: RawEnvelope;
  try { imported = await verifyDeclaredEnvelope(parsed, digest); } catch (error) { return { kind: "fresh", payload: emptyPayload(), revision: 0, notice: { code: error instanceof Error && error.message === "CHECKSUM_MISMATCH" ? "CHECKSUM_MISMATCH" : "INVALID_ENVELOPE", message: "导入文件未通过声明版本的结构或校验和验证。", action: "import" } }; }
  try { storage.setItem(key.importedBackup, text); } catch { return { kind: "fresh", payload: emptyPayload(), revision: 0, notice: { code: "STORAGE_UNAVAILABLE", message: "无法保留导入备份，因此未替换本地存档。", action: "export" } }; }
  const migrated = migrateDeclaredEnvelope(imported, migrations, currentSchemaVersion);
  try { assertPersistable(migrated.payload, questIds); } catch { return { kind: "fresh", payload: emptyPayload(), revision: 0, notice: { code: "INVALID_ENVELOPE", message: "迁移后的存档不符合当前进度、关卡或源码限制。", action: "import" } }; }
  const saved = await save(migrated.payload);
  if (!saved.ok) return { kind: "fresh", payload: emptyPayload(), revision: 0, notice: { code: saved.code, message: saved.message, action: "export" } };
  return { kind: "recovered", payload: migrated.payload, revision: saved.revision, notice: { code: imported.schemaVersion === currentSchemaVersion ? "IMPORTED_RECOVERY" : "MIGRATED", message: "已导入、备份并验证存档。", action: "continue" } };
}
async function exportText(): Promise<SaveExportResult> {
  const candidates = readStoredCandidatesInOrder();
  for (const candidate of candidates) {
    const envelope = await tryRead(candidate);
    if (envelope) return { ok: true, text: JSON.stringify(envelope) };
  }
  return { ok: false, code: reasons[0] === "CHECKSUM_MISMATCH" ? "CHECKSUM_MISMATCH" : "INVALID_ENVELOPE", message: "没有可导出的已验证存档；请先从本地恢复或导入。" };
}
return { load, save, exportText, importText };
}
```

- [ ] **Step 6: 执行存档完整回归。**

Run: `npm --prefix rpg run test:run -- src/game/save/save-store.test.ts`

Run: `npm --prefix rpg run build`

Run: `git diff --check`

Expected: 双代读回、损坏回退、逐版本迁移、导入备份、5 个重放上限和 3 MiB 策略全部通过。

- [ ] **Step 7: 提交独立的可恢复存档行为。**

```bash
git add rpg/src/game/save/migrations.ts rpg/src/game/save/save-store.ts rpg/src/game/save/save-store.test.ts
git commit -m "feat: recover and migrate RPG saves"
```

### Task 4: 应用控制器与统一回合流程

**Files:**
- Create: `rpg/src/app/app-model.ts`
- Create: `rpg/src/app/app-controller.ts`
- Create: `rpg/src/app/app-controller.test.ts`

**Interfaces:**
- Consumes `BattleState`, `WorldView`, `TurnCommand`, `BattleEvent`, `CommandResolution` from `rpg/src/game/combat/types.ts` and `resolveTurn(state: BattleState, input: unknown): CommandResolution` from `rpg/src/game/combat/resolve-turn.ts`; consumes `RunRequest`, `RunResult`, `Diagnostic`, `TraceEvent` from `rpg/src/runners/protocol/types.ts` and `PythonRunnerAdapter` from `rpg/src/runners/python/adapter.ts`.
- Consumes combat replay API from `rpg/src/game/replay/replay.ts`: `createReplay(metadata, initialState)`, `recordAcceptedTurn(replay, before, acceptedResolution)` and `verifyReplay(replay)`. 重放只由战斗 API 创建、追加和验证；它从不运行历史 Python。
- Produces `AppController`, `AppSnapshot`, `AppContentPort`, structural `RunnerPort`, `ManualTurnInput`, `RunnerUiStatus` and `createAppController(dependencies: { initialBattle: BattleState; initialWorld: WorldView; initialSave: SavePayload; runner: RunnerPort; saves: SaveStore; content: AppContentPort; resolveTurn: typeof resolveTurn }): AppController`.
- `AppController.submitManual(input: ManualTurnInput): Promise<void>` and `AppController.runCode(): Promise<void>` both call the same private `submitInput(input: unknown, source: "manual" | "runner")`; only battle内核接受的 `CommandResolution` replaces the held `BattleState` reference.

- [ ] **Step 1: 写入失败测试，要求手动移动后攻击和 Runner 返回的移动后攻击生成等价命令、拒绝命令不改变状态、Runner 完成不等于战斗胜利。**

```ts
// rpg/src/app/app-controller.test.ts
it("sends manual and runner commands through the same resolver", async () => {
  const resolveTurn = vi.fn().mockReturnValue({ accepted: true, command: commandWithPath, state: nextBattle, events: [movedEvent, attackEvent] });
  const controller = createAppController({ initialBattle, initialWorld, initialSave, runner: fakeRunner(commandWithPath), resolveTurn, saves: fakeSaves(), content: fakeContent() });
  await controller.submitManual({ actorId: "scout", movePath: [{ x: 2, y: 1 }], action: { type: "attack", targetId: "golem" } });
  await controller.runCode();
  expect(resolveTurn.mock.calls.map(([, command]) => command)).toEqual([commandWithPath, commandWithPath]);
  expect(controller.snapshot().battle).toBe(nextBattle);
});

it("keeps battle identity on a rejected command even when Python completed", async () => {
  const controller = createAppController({ initialBattle, initialWorld, initialSave, runner: fakeRunner({ ...commandWithPath, expectedRevision: 0 }), resolveTurn: () => ({ accepted: false, errors: [{ code: "EXPECTED_REVISION_MISMATCH", path: "expectedRevision", message: "战场已变化。" }], state: initialBattle }), saves: fakeSaves(), content: fakeContent() });
  await controller.runCode();
  expect(controller.snapshot().battle).toBe(initialBattle);
  expect(controller.snapshot().result).toMatchObject({ kind: "command_rejected", code: "EXPECTED_REVISION_MISMATCH" });
});

it.each([["won", "replay"], ["lost", "restart"]] as const)("publishes %s battle outcome with the recovery action %s", async (outcome, action) => {
  const controller = createAppController({ initialBattle, initialWorld, initialSave, runner: fakeRunner(commandWithPath), saves: fakeSaves(), content: fakeContent(), resolveTurn: () => acceptedResolution({ ...nextBattle, phase: outcome }) });
  await controller.runCode();
  expect(controller.snapshot().result).toMatchObject({ kind: "battle_outcome", outcome, action });
});

it("applies imported preferences immediately and exposes its recovery notice", async () => {
  const controller = createAppController({ initialBattle, initialWorld, initialSave, runner: fakeRunner(commandWithPath), saves: importedSaves({ reducedMotion: true }), resolveTurn: acceptedResolver, content: fakeContent() });
  await controller.importSave(validImportText);
  expect(controller.snapshot()).toMatchObject({ preferences: { reducedMotion: true }, result: { kind: "save_notice", action: "continue" } });
});

it.each(["syntax_error", "runtime_error", "timeout", "interrupted", "runner_error"] as const)("maps Runner result %s without reporting success", async (executionStatus) => {
  const controller = createAppController({ initialBattle, initialWorld, initialSave, runner: fakeRunner({ executionStatus, diagnostics: [], trace: [] }), saves: fakeSaves(), resolveTurn: acceptedResolver, content: fakeContent() });
  await controller.runCode();
  expect(controller.snapshot().result).toMatchObject({ kind: "runner", result: { executionStatus } });
  if (executionStatus === "timeout") expect(controller.snapshot()).toMatchObject({ runnerStatus: "restarting", restartReason: "代码执行超过本关时限。" });
});

it("invalidates a delayed run result after interrupt so it cannot resolve a turn", async () => {
  const deferred = deferredResult<RunResult>(); const resolveTurn = vi.fn(acceptedResolver);
  const interrupt = vi.fn(async (_runId: string) => undefined);
  const controller = createAppController({ initialBattle, initialWorld, initialSave, runner: { run: () => deferred.promise, interrupt }, saves: fakeSaves(), content: fakeContent(), resolveTurn });
  void controller.runCode(); await controller.interrupt(); deferred.resolve(completedRun(commandWithPath)); await flushPromises();
  expect(interrupt).toHaveBeenCalledWith(expect.any(String)); expect(resolveTurn).not.toHaveBeenCalled(); expect(controller.snapshot().battle).toBe(initialBattle);
});

it("publishes each accepted event batch once and clears only its matching acknowledgement", async () => {
  const controller = createAppController({ initialBattle, initialWorld, initialSave, runner: fakeRunner(commandWithPath), saves: fakeSaves(), content: fakeContent(), resolveTurn: acceptedResolver });
  await controller.runCode(); const batch = controller.snapshot().pendingEventBatch; if (!batch) throw new Error("缺少事件批次");
  controller.ackEventBatch("different"); expect(controller.snapshot().pendingEventBatch?.batchId).toBe(batch.batchId);
  controller.ackEventBatch(batch.batchId); expect(controller.snapshot().pendingEventBatch).toBeUndefined();
});

it("synchronously publishes the initial snapshot to every new subscriber", () => {
  const controller = createAppController({ initialBattle, initialWorld, initialSave, runner: fakeRunner(commandWithPath), saves: fakeSaves(), content: fakeContent(), resolveTurn: acceptedResolver });
  const listener = vi.fn(); controller.subscribe(listener);
  expect(listener).toHaveBeenCalledTimes(1); expect(listener.mock.calls[0]?.[0]).toMatchObject({ battle: initialBattle, world: initialWorld });
});
```

- [ ] **Step 2: 运行控制器测试，确认在控制器尚不存在时失败。**

Run: `npm --prefix rpg run test:run -- src/app/app-controller.test.ts`

Expected: FAIL，错误指出 `createAppController` 未导出。

- [ ] **Step 3: 定义视图状态，明确它不存放任何可变战斗副本。**

```ts
// rpg/src/app/app-model.ts
import type { BattleEvent, BattleState, CommandResolution, Replay, ReplayMetadata, ReplayVerification, TurnCommand, WorldView } from "../game/combat/types";
import { resolveTurn } from "../game/combat/resolve-turn";
import { createReplay, recordAcceptedTurn, verifyReplay } from "../game/replay/replay";
import type { Diagnostic, RunRequest, RunResult, TraceEvent } from "../runners/protocol/types";
import type { SaveExportResult, SavePayload, SavePreferences, SaveStore } from "../game/save/types";

export type RunnerUiStatus = "loading" | "ready" | "running" | "interrupting" | "restarting" | "unavailable";
export interface RunnerPort { run(request: RunRequest): Promise<RunResult>; interrupt(runId: string): Promise<void>; }
export interface ManualTurnInput { actorId: string; movePath?: TurnCommand["movePath"]; action: TurnCommand["action"]; }
export type AppResult = { kind: "empty" } | { kind: "runner"; result: RunResult } | { kind: "command_rejected"; code: string; fieldPath: string; message: string; action: "edit" | "manual" } | { kind: "save_failure"; message: string; action: "export" | "retry" } | { kind: "save_notice"; message: string; action: "continue" | "import" | "export" } | { kind: "battle_outcome"; outcome: "won" | "lost"; message: string; action: "replay" | "restart" };
export interface ReplayPresentation { verification: "checking" | "verified" | "corrupt" | "incompatible"; reason?: string; steps: readonly { events: readonly BattleEvent[] }[]; currentIndex: number; }
export interface AppContentPort { initialBattleFor(questId: string): BattleState; worldViewFor(state: BattleState): WorldView; questIds(): readonly string[]; replayMetadataFor(questId: string, initialState: BattleState): ReplayMetadata; }
export interface ControllerDependencies { initialBattle: BattleState; initialWorld: WorldView; initialSave: SavePayload; runner: RunnerPort; saves: SaveStore; content: AppContentPort; resolveTurn: typeof resolveTurn; }
export interface BattleEventBatch { batchId: string; events: readonly BattleEvent[]; }
export interface AppSnapshot { questId: string; battle: BattleState; world: WorldView; save: SavePayload; preferences: SavePreferences; runnerStatus: RunnerUiStatus; restartReason?: string; result: AppResult; diagnostics: readonly Diagnostic[]; trace: readonly TraceEvent[]; replay: ReplayPresentation; pendingEventBatch?: BattleEventBatch; selectedTraceSeq?: number; }
export interface AppController { snapshot(): AppSnapshot; subscribe(listener: (snapshot: AppSnapshot) => void): () => void; submitManual(input: ManualTurnInput): Promise<void>; runCode(): Promise<void>; interrupt(): Promise<void>; setDraft(code: string): void; setPreferences(next: SavePreferences): void; selectTrace(seq: number): void; selectReplayStep(index: number): void; ackEventBatch(batchId: string): void; exportSave(): Promise<SaveExportResult>; importSave(text: string): Promise<void>; }
```

- [ ] **Step 4: 实施同一命令入口、状态转换和 Runner 生命周期。控制器只能替换接受结果中的 `state`，绝不展开或编辑其字段。**

```ts
// rpg/src/app/app-controller.ts
export function createAppController(dependencies: ControllerDependencies): AppController {
  const questId = dependencies.initialSave.campaign.completedQuestIds.at(-1) ?? dependencies.content.questIds()[0];
  const controller = new Controller(dependencies, { questId, battle: dependencies.initialBattle, world: dependencies.initialWorld, save: structuredClone(dependencies.initialSave), preferences: dependencies.initialSave.preferences, runnerStatus: "ready", diagnostics: [], trace: [], replay: { verification: "checking", steps: [], currentIndex: 0 }, result: { kind: "empty" } });
  void controller.refreshReplay(dependencies.initialSave.replays);
  return controller;
}
// Controller.subscribe 在注册期间同步调用 listener(structuredClone(snapshotValue))，随后每次 patch 后再发送不可变快照；AppView 因而不需要额外首次 render 调用。
subscribe(listener: (snapshot: AppSnapshot) => void): () => void { this.listeners.add(listener); listener(structuredClone(this.snapshotValue)); return () => this.listeners.delete(listener); }
private commandFromManual(input: ManualTurnInput): TurnCommand {
  return { actorId: input.actorId, expectedRevision: this.snapshotValue.world.revision, ...(input.movePath?.length ? { movePath: input.movePath } : {}), action: input.action };
}

async submitManual(input: ManualTurnInput): Promise<void> { this.submitInput(this.commandFromManual(input), "manual"); }

private submitInput(input: unknown, source: "manual" | "runner"): void {
  const before = this.snapshotValue.battle;
  const resolution: CommandResolution = this.dependencies.resolveTurn(this.snapshotValue.battle, input);
  if (!resolution.accepted) {
    const error = resolution.errors[0] ?? { code: "INVALID_COMMAND", path: "", message: "命令被拒绝。" };
    this.patch({ result: { kind: "command_rejected", code: error.code, fieldPath: error.path, message: error.message, action: "edit" } });
    return;
  }
  this.patch({ battle: resolution.state, world: resolution.world, pendingEventBatch: { batchId: crypto.randomUUID(), events: resolution.events }, result: resolution.state.phase === "won" ? { kind: "battle_outcome", outcome: "won", message: "战斗胜利。", action: "replay" } : resolution.state.phase === "lost" ? { kind: "battle_outcome", outcome: "lost", message: "战斗失败，可从初始快照重试。", action: "restart" } : { kind: "empty" } });
  void this.persistAcceptedState(source, before, resolution);
}

private activeRunId: string | undefined;
async runCode(): Promise<void> {
  const token = ++this.runToken;
  this.patch({ runnerStatus: "running", result: { kind: "empty" } });
  const request = this.makeRunRequest(this.snapshotValue.world, token); this.activeRunId = request.runId;
  const result = await this.dependencies.runner.run(request);
  if (token !== this.runToken) return;
  this.activeRunId = undefined;
  this.patch({ runnerStatus: statusAfter(result), restartReason: result.executionStatus === "timeout" ? "代码执行超过本关时限。" : result.executionStatus === "runner_error" ? "Worker 启动或重建失败。" : undefined, diagnostics: result.diagnostics, trace: result.trace, result: { kind: "runner", result } });
  if (result.executionStatus === "completed") this.submitInput(result.returnValue, "runner");
}

private makeRunRequest(world: WorldView, token: number): RunRequest { return { protocolVersion: 1, runId: crypto.randomUUID(), attemptId: `${this.questId}:${token}`, questId: this.questId, language: "python", files: { "main.py": this.snapshotValue.save.drafts[this.questId] ?? "" }, entrypoint: { file: "main.py", callable: "choose_turn" }, worldView: world, allowedModules: this.allowedModules, limits: this.limits }; }
function statusAfter(result: RunResult): RunnerUiStatus { return result.executionStatus === "runner_error" ? "unavailable" : result.executionStatus === "timeout" ? "restarting" : "ready"; }
function interruptedResult(): RunResult { return { protocolVersion: 1, runId: "interrupted", attemptId: "interrupted", executionStatus: "interrupted", diagnostics: [], trace: [], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 0, traceEvents: 0 } }; }
```

- [ ] **Step 5: 实施中断和持久化失败路径。`interrupt()` 只调用 Runner 适配器；保存失败保留内存中的非战斗资料并显示恢复动作。**

```ts
// rpg/src/app/app-controller.ts
async interrupt(): Promise<void> {
  if (this.snapshotValue.runnerStatus !== "running") return;
  const runId = this.activeRunId; if (!runId) throw new Error("MISSING_ACTIVE_RUN_ID"); ++this.runToken; this.activeRunId = undefined;
  this.patch({ runnerStatus: "interrupting" });
  await this.dependencies.runner.interrupt(runId);
  this.patch({ runnerStatus: "ready", result: { kind: "runner", result: interruptedResult() } });
}

private async persistAcceptedState(_source: "manual" | "runner", before: BattleState, resolution: Extract<CommandResolution, { accepted: true }>): Promise<void> {
  await this.appendAcceptedReplayStep(before, resolution);
  const result = await this.dependencies.saves.save(this.toSavePayload());
  if (!result.ok) this.patch({ result: { kind: "save_failure", message: result.message, action: result.code === "SAVE_LIMIT_EXCEEDED" ? "export" : "retry" } });
}

setPreferences(next: SavePreferences): void { this.replaceSave({ ...this.snapshotValue.save, preferences: next }); void this.persistCurrentSave(); }
private loadBattle(questId: string): { battle: BattleState; world: WorldView } { if (!this.dependencies.content.questIds().includes(questId)) throw new Error("UNKNOWN_QUEST"); const battle = this.dependencies.content.initialBattleFor(questId); return { battle, world: this.dependencies.content.worldViewFor(battle) }; }
async importSave(text: string): Promise<void> { const loaded = await this.dependencies.saves.importText(text); if (loaded.kind === "fresh") { this.patch({ result: { kind: "save_notice", message: loaded.notice?.message ?? "导入失败，当前存档未改变。", action: loaded.notice?.action ?? "import" } }); return; } const questId = loaded.payload.campaign.completedQuestIds.at(-1) ?? this.dependencies.content.questIds()[0]; const next = this.loadBattle(questId); this.replaceSave(loaded.payload); this.patch({ questId, battle: next.battle, world: next.world, diagnostics: [], trace: [], replay: { verification: "checking", steps: [], currentIndex: 0 }, pendingEventBatch: undefined, result: { kind: "save_notice", message: loaded.notice?.message ?? "已导入存档。", action: loaded.notice?.action ?? "continue" } }); void this.refreshReplay(loaded.payload.replays); }
ackEventBatch(batchId: string): void { if (this.snapshotValue.pendingEventBatch?.batchId === batchId) this.patch({ pendingEventBatch: undefined }); }
selectReplayStep(index: number): void { const replay = this.snapshotValue.replay; if (replay.verification === "verified" && index >= 0 && index < replay.steps.length) this.patch({ replay: { ...replay, currentIndex: index } }); }
private replaceSave(save: SavePayload): void { this.patch({ save, preferences: save.preferences }); }
private async persistCurrentSave(): Promise<void> { const write = await this.dependencies.saves.save(this.toSavePayload()); if (!write.ok) this.patch({ result: { kind: "save_failure", message: write.message, action: "retry" } }); }
private toSavePayload(): SavePayload { return structuredClone(this.snapshotValue.save); }
private async appendAcceptedReplayStep(before: BattleState, resolution: Extract<CommandResolution, { accepted: true }>): Promise<void> {
  const replayId = `${this.questId}:latest`; const existing = this.snapshotValue.save.replays.find((item) => item.replayId === replayId);
  const base = existing ? structuredClone(existing.document) : await createReplay(this.dependencies.content.replayMetadataFor(this.questId, before), before);
  const replay = await recordAcceptedTurn(base, before, resolution);
  const save = { ...this.snapshotValue.save, replays: [...this.snapshotValue.save.replays.filter((item) => item.replayId !== replayId), { replayId, questId: this.questId, createdAt: new Date().toISOString(), document: replay }] };
  this.replaceSave(save); void this.refreshReplay(save.replays);
}
private replayVerificationToken = 0;
private async refreshReplay(replays: readonly SavePayload["replays"][number][]): Promise<void> {
  const token = ++this.replayVerificationToken; const newest = [...replays].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (!newest) { this.patch({ replay: { verification: "verified", steps: [], currentIndex: 0 } }); return; }
  try { const verification = await verifyReplay(newest.document); if (token === this.replayVerificationToken) this.patch({ replay: replayFor(newest.document, verification) }); }
  catch (error) { if (token === this.replayVerificationToken) this.patch({ replay: { verification: "corrupt", reason: error instanceof Error ? error.message : "重放验证失败。", steps: [], currentIndex: 0 } }); }
}
function replayFor(replay: Replay, verification: ReplayVerification): ReplayPresentation { if (verification.verified) return { verification: "verified", steps: replay.steps.map((step) => ({ events: step.events })), currentIndex: 0 }; const field = verification.mismatch.field; return { verification: field === "engineVersion" || field === "contentVersion" || field === "runnerProtocolVersion" ? "incompatible" : "corrupt", reason: `第 ${verification.mismatch.step} 步 ${field} 不匹配。`, steps: [], currentIndex: 0 }; }
```

- [ ] **Step 6: 执行控制器验证。**

Run: `npm --prefix rpg run test:run -- src/app/app-controller.test.ts`

Run: `npm --prefix rpg run build`

Run: `git diff --check`

Expected: 同一 `TurnCommand` 路径、可选移动、命令拒绝、运行完成与胜利分离、中断和保存失败测试通过。

- [ ] **Step 7: 提交应用流程协调。**

```bash
git add rpg/src/app/app-model.ts rpg/src/app/app-controller.ts rpg/src/app/app-controller.test.ts
git commit -m "feat: coordinate RPG turns in app controller"
```

### Task 5: 语义应用外壳、状态与视觉 Token

**Files:**
- Create: `rpg/src/ui/components/app-shell.ts`
- Create: `rpg/src/ui/components/status-strip.ts`
- Create: `rpg/src/ui/components/app-shell.test.ts`
- Create: `rpg/src/ui/styles/tokens.css`
- Create: `rpg/src/ui/styles/layout.css`
- Create: `rpg/src/ui/styles/components.css`

**Interfaces:**
- Consumes `AppSnapshot` and `RunnerUiStatus` from `rpg/src/app/app-model.ts`.
- Produces `AppShellElements`, `createAppShell(root)`, `renderStatusStrip(element, snapshot)` and stable DOM hooks: `data-battlefield`, `data-command-panel`, `data-editor-host`, `data-diagnostics`, `data-replay`, `data-run-state`, `data-save-notice`.
- Icon-only button contract is `button[aria-label][data-tooltip] > svg[aria-hidden="true"]`; text commands retain visible labels.

- [ ] **Step 1: 写入失败 DOM 测试，锁定语义区域、图标提示、状态直播区和键盘焦点目标。**

```ts
// rpg/src/ui/components/app-shell.test.ts
it("creates one labeled shell with battle, editor, diagnostics and replay regions", () => {
  const root = document.createElement("div");
  const shell = createAppShell(root);
  expect(root.querySelector("main[aria-label='战术战场']")).not.toBeNull();
  expect(root.querySelector("section[aria-label='Python 编辑器']")).not.toBeNull();
  expect(root.querySelector("aside[aria-label='代码轨迹与诊断']")).not.toBeNull();
  expect(shell.interruptButton).toMatchObject({ ariaLabel: "中断运行" });
  expect(root.querySelector("[data-run-state]")?.getAttribute("aria-live")).toBe("polite");
});
```

- [ ] **Step 2: 运行 shell 测试，确认在组件模块不存在时失败。**

Run: `npm --prefix rpg run test:run -- src/ui/components/app-shell.test.ts`

Expected: FAIL，错误指出 `./app-shell` 尚不存在。

- [ ] **Step 3: 使用 Lucide 创建稳定的应用 HTML 骨架，避免把页面区域包装成装饰性卡片。**

```ts
// rpg/src/ui/components/app-shell.ts
import { Download, OctagonX, Play, Save, Upload, type IconNode } from "lucide";

export interface AppShellElements { root: HTMLElement; runState: HTMLElement; battlefield: HTMLElement; commandPanel: HTMLElement; editorHost: HTMLElement; diagnostics: HTMLElement; replay: HTMLElement; saveNotice: HTMLElement; recovery: HTMLElement; exportButton: HTMLButtonElement; importButton: HTMLButtonElement; importFile: HTMLInputElement; saveButton: HTMLButtonElement; runButton: HTMLButtonElement; interruptButton: HTMLButtonElement; }
function required<T extends HTMLElement>(root: ParentNode, selector: string): T { const node = root.querySelector<T>(selector); if (!node) throw new Error(`缺少应用元素 ${selector}`); return node; }
export function placeIcon(root: ParentNode, selector: string, icon: IconNode): void { const button = required<HTMLButtonElement>(root, selector); const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("aria-hidden", "true"); svg.innerHTML = icon.map(([tag, attributes]) => `<${tag} ${Object.entries(attributes).map(([name, value]) => `${name}="${String(value)}"`).join(" ")}></${tag}>`).join(""); button.replaceChildren(svg); }
export function collectElements(root: HTMLElement): AppShellElements { return { root, runState: required(root, "[data-run-state]"), battlefield: required(root, "[data-battlefield]"), commandPanel: required(root, "[data-command-panel]"), editorHost: required(root, "[data-editor-host]"), diagnostics: required(root, "[data-diagnostics]"), replay: required(root, "[data-replay]"), saveNotice: required(root, "[data-save-notice]"), recovery: required(root, "[data-recovery]"), exportButton: required(root, "[data-export]"), importButton: required(root, "[data-import]"), importFile: required(root, "[data-import-file]"), saveButton: required(root, "[data-save]"), runButton: required(root, "[data-run]"), interruptButton: required(root, "[data-interrupt]") }; }

export function createAppShell(root: HTMLElement): AppShellElements {
  root.innerHTML = `<div class="rpg-shell">
    <header class="app-header"><a class="brand" href="#battlefield" aria-label="规则炉心战场">规则炉心</a><div data-run-state class="run-state" aria-live="polite"></div><div class="header-actions"><button type="button" data-export aria-label="导出存档" data-tooltip="导出存档"></button><button type="button" data-import aria-label="导入存档" data-tooltip="导入存档"></button><button type="button" data-save aria-label="保存草稿" data-tooltip="保存草稿"></button></div></header>
    <main class="battle-workspace" aria-label="战术战场"><section id="battlefield" class="battle-stage" aria-label="战场" data-battlefield></section><section class="command-region" aria-label="当前回合命令" data-command-panel></section></main>
    <section class="code-workspace" aria-label="Python 编辑器"><header class="panel-header"><span>main.py</span><div><button type="button" data-run>运行</button><button type="button" data-interrupt aria-label="中断运行" data-tooltip="中断运行"></button></div></header><div data-editor-host></div></section>
    <aside class="inspect-workspace" aria-label="代码轨迹与诊断"><section data-diagnostics></section><section data-replay></section></aside>
    <input data-import-file type="file" accept="application/json,.json" hidden><div data-save-notice class="save-notice" role="status" aria-live="polite"></div><div data-recovery class="recovery-actions" aria-live="polite"></div></div>`;
  placeIcon(root, "[data-export]", Download); placeIcon(root, "[data-import]", Upload); placeIcon(root, "[data-save]", Save); placeIcon(root, "[data-interrupt]", OctagonX); placeIcon(root, "[data-run]", Play);
  return collectElements(root);
}
```

- [ ] **Step 4: 定义非紫色 token、桌面尺寸和无动画降级。**

```css
/* rpg/src/ui/styles/tokens.css */
:root { --bg: #151817; --surface: #202522; --surface-raised: #2a302b; --text: #f0eadb; --muted: #a9afa4; --accent: #78a892; --accent-strong: #a8d2b6; --amber: #d8a34f; --danger: #d16d62; --success: #88b986; --border: #4a5149; --font-display: Georgia, "Noto Serif SC", serif; --font-body: "Segoe UI", "Noto Sans SC", sans-serif; --space-1: 0.5rem; --space-2: 0.75rem; --space-3: 1rem; --space-4: 1.5rem; --focus: 0 0 0 3px #d8a34f; }
* { box-sizing: border-box; } body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font-body); letter-spacing: 0; } button:focus-visible, a:focus-visible { outline: none; box-shadow: var(--focus); } button { min-width: 44px; min-height: 44px; } [data-tooltip] { position: relative; } [data-tooltip]:hover::after, [data-tooltip]:focus-visible::after { content: attr(data-tooltip); position: absolute; z-index: 2; top: calc(100% + 4px); right: 0; white-space: nowrap; background: #050706; color: var(--text); padding: 0.35rem 0.5rem; border: 1px solid var(--border); }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }
```

```css
/* rpg/src/ui/styles/layout.css */
.rpg-shell { min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(22rem, 0.85fr); grid-template-rows: auto minmax(22rem, 1fr) minmax(15rem, 0.7fr); gap: 1px; background: var(--border); } .app-header { grid-column: 1 / -1; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); background: var(--surface); } .battle-workspace { background: var(--bg); min-width: 0; } .code-workspace, .inspect-workspace { background: var(--surface); min-width: 0; } .inspect-workspace { grid-row: 2 / span 2; } @media (max-width: 959px) { .rpg-shell { display: block; background: var(--bg); } .code-workspace, .command-region, [data-import], [data-save], [data-run], [data-interrupt] { display: none; } .battle-workspace, .inspect-workspace { display: block; min-height: 18rem; padding: var(--space-2); } }
```

- [ ] **Step 5: 渲染所有 Runner、战斗、导入恢复和存档状态，空状态不伪造成功。诊断状态必须给出返回编辑、重试、手动行动、导出或导入中的一个恢复动作。**

```ts
// rpg/src/ui/components/status-strip.ts
const labels: Record<RunnerUiStatus, string> = { loading: "正在加载 Python 运行器", ready: "Python 运行器就绪", running: "正在执行本回合策略", interrupting: "正在中断运行", restarting: "正在重建运行器", unavailable: "Python 运行器不可用，仍可手动行动" };
const executionMessages: Record<RunResult["executionStatus"], { message: string; action: "edit" | "retry" | "manual" }> = { completed: { message: "代码已返回，正在校验回合命令。", action: "edit" }, syntax_error: { message: "Python 语法错误，请返回编辑器修正。", action: "edit" }, runtime_error: { message: "运行时错误，请查看诊断并返回编辑器。", action: "edit" }, timeout: { message: "执行超时，运行器已重建。", action: "retry" }, interrupted: { message: "执行已中断，可继续编辑或再次运行。", action: "edit" }, invalid_request: { message: "运行请求无效，请重试当前关卡。", action: "retry" }, runner_error: { message: "运行器不可用，可使用手动行动。", action: "manual" } };
export function renderStatusStrip(target: HTMLElement, snapshot: AppSnapshot): void {
  const result = snapshot.result.kind === "runner" ? executionMessages[snapshot.result.result.executionStatus] : undefined;
  target.textContent = snapshot.restartReason ? `正在重建运行器：${snapshot.restartReason}` : result?.message ?? labels[snapshot.runnerStatus];
  target.dataset.status = snapshot.runnerStatus;
}
```

- [ ] **Step 6: 验证 shell、响应式 CSS 和类型检查。**

Run: `npm --prefix rpg run test:run -- src/ui/components/app-shell.test.ts`

Run: `npm --prefix rpg run build`

Run: `git diff --check`

Expected: 所有稳定 DOM 钩子、Lucide 图标提示、焦点样式和小屏只读隐藏规则存在。

- [ ] **Step 7: 提交外壳与视觉基础。**

```bash
git add rpg/src/ui/components/app-shell.ts rpg/src/ui/components/status-strip.ts rpg/src/ui/components/app-shell.test.ts rpg/src/ui/styles/tokens.css rpg/src/ui/styles/layout.css rpg/src/ui/styles/components.css
git commit -m "feat: add RPG application shell"
```

### Task 6: 战场投影、路径预览、事件动画与手动命令

**Files:**
- Create: `rpg/src/ui/components/battlefield.ts`
- Create: `rpg/src/ui/components/battlefield.test.ts`
- Create: `rpg/src/ui/components/command-panel.ts`
- Create: `rpg/src/ui/components/command-panel.test.ts`
- Modify: `rpg/src/ui/styles/components.css`

**Interfaces:**
- Consumes immutable `WorldView`, `TurnCommand`, `BattleEvent` and `MainAction` from `rpg/src/game/combat/types.ts`, plus `AppController.submitManual`.
- 使用 combat 已有的 `WorldUnit.skills: ReadonlyArray<{ id: string; target: "unit" | "cell" }>`；手动施法只读此字段选择 `skillId` 与目标形式，不另造单位视图类型、目标类型字段或预选技能字段。
- Produces `BattlefieldView.render(world, preview?)`, `BattlefieldView.onCellSelect(listener)`, `BattlefieldView.play(events, reducedMotion): Promise<void>`, `createBattlefieldView(host)` and `createCommandPanel(host, submit, preview)`.
- Command panel emits exactly `ManualTurnInput`; it never invokes `resolveTurn`, advances a unit, mutates a world projection, or submits separate move/action messages.

- [ ] **Step 1: 写入失败测试，锁定网格单元、单位语义标签、预览路径和基于事件的数据属性；测试同时断言提交的一次调用含移动与主动作。**

```ts
// rpg/src/ui/components/battlefield.test.ts
it("renders a projection and animates only supplied move events", async () => {
  const view = createBattlefieldView(host);
  view.render(worldView, commandWithPath);
  expect(host.querySelector('[data-cell="2,1"].is-preview')).not.toBeNull();
  await view.play([{ protocolVersion: 1, seq: 1, stateRevision: 3, type: "moved", payload: { unitId: "scout", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } } }], false);
  expect(host.querySelector('[data-unit-id="scout"]')?.getAttribute("data-last-event")).toBe("moved");
});

// rpg/src/ui/components/command-panel.test.ts
it("clicks a grid path then a target and atomically submits move-before-attack", () => {
  const submit = vi.fn(); const field = createBattlefieldView(battleHost); const panel = createCommandPanel(commandHost, submit, (input) => field.render(worldView, previewFrom(input, worldView.revision)));
  field.render(worldView); panel.setContext(worldView); field.onCellSelect(panel.selectCell);
  battleHost.querySelector<HTMLButtonElement>('[data-cell="2,1"]')!.click();
  commandHost.querySelector<HTMLButtonElement>('[data-action="attack"]')!.click();
  battleHost.querySelector<HTMLButtonElement>('[data-cell="3,1"]')!.click();
  commandHost.querySelector<HTMLButtonElement>("[data-confirm]")!.click();
  expect(submit).toHaveBeenCalledWith({ actorId: "scout", movePath: [{ x: 2, y: 1 }], action: { type: "attack", targetId: "golem" } });
  expect(submit).toHaveBeenCalledTimes(1);
});

it("binds cast, interact, guard and wait buttons through the same confirm DOM path", () => {
  const submit = vi.fn(); const field = createBattlefieldView(battleHost); const panel = createCommandPanel(commandHost, submit, () => undefined);
  field.render(worldView); panel.setContext(worldView); field.onCellSelect(panel.selectCell);
  commandHost.querySelector<HTMLButtonElement>('[data-action="cast"]')!.click(); battleHost.querySelector<HTMLButtonElement>('[data-cell="3,1"]')!.click(); commandHost.querySelector<HTMLButtonElement>("[data-confirm]")!.click();
  commandHost.querySelector<HTMLButtonElement>('[data-action="interact"]')!.click(); battleHost.querySelector<HTMLButtonElement>('[data-cell="2,2"]')!.click(); commandHost.querySelector<HTMLButtonElement>("[data-confirm]")!.click();
  commandHost.querySelector<HTMLButtonElement>('[data-action="guard"]')!.click(); commandHost.querySelector<HTMLButtonElement>("[data-confirm]")!.click(); commandHost.querySelector<HTMLButtonElement>('[data-action="wait"]')!.click(); commandHost.querySelector<HTMLButtonElement>("[data-confirm]")!.click();
  expect(submit.mock.calls.map(([input]) => input.action.type)).toEqual(["cast", "interact", "guard", "wait"]);
});

it("requires a visible skill selection and uses its public target", () => {
  const submit = vi.fn(); const field = createBattlefieldView(battleHost); const panel = createCommandPanel(commandHost, submit, () => undefined);
  field.render(worldView); panel.setContext(worldView); field.onCellSelect(panel.selectCell);
  commandHost.querySelector<HTMLButtonElement>('[data-action="cast"]')!.click(); expect(commandHost.querySelector('[data-skill][aria-label="技能"]')).not.toBeNull();
  commandHost.querySelector<HTMLSelectElement>("[data-skill]")!.value = "arc-bolt"; commandHost.querySelector<HTMLSelectElement>("[data-skill]")!.dispatchEvent(new Event("change")); battleHost.querySelector<HTMLButtonElement>('[data-cell="3,1"]')!.click(); commandHost.querySelector<HTMLButtonElement>("[data-confirm]")!.click();
  expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ action: { type: "cast", skillId: "arc-bolt", targetId: "golem" } }));
});
```

- [ ] **Step 2: 运行视图测试，确认模块未实现时失败。**

Run: `npm --prefix rpg run test:run -- src/ui/components/battlefield.test.ts src/ui/components/command-panel.test.ts`

Expected: FAIL，错误指出两个组件模块不存在。

- [ ] **Step 3: 实施只读战场渲染和事件顺序播放器。**

```ts
// rpg/src/ui/components/battlefield.ts
export interface Cell { x: number; y: number; }
const escape = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
function cells(world: WorldView, preview?: TurnCommand): string { const previewKeys = new Set((preview?.movePath ?? []).map((cell) => `${cell.x},${cell.y}`)); return Array.from({ length: world.board.width * world.board.height }, (_, index) => ({ x: index % world.board.width, y: Math.floor(index / world.board.width) })).map((cell) => { const unit = world.units.find((item) => item.cell.x === cell.x && item.cell.y === cell.y); return `<button type="button" role="gridcell" class="battle-cell${previewKeys.has(`${cell.x},${cell.y}`) ? " is-preview" : ""}" data-cell="${cell.x},${cell.y}" aria-label="格子 ${cell.x},${cell.y}">${unit ? `<span class="battle-unit" data-unit-id="${escape(unit.id)}" style="grid-column-start:${cell.x + 1};grid-row-start:${cell.y + 1}">${escape(unit.id)}</span>` : ""}</button>`; }).join(""); }
const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
export interface BattlefieldView { render(world: WorldView, preview?: TurnCommand): void; onCellSelect(listener: (cell: Cell) => void): void; play(events: readonly BattleEvent[], reducedMotion: boolean): Promise<void>; }
export function createBattlefieldView(host: HTMLElement): BattlefieldView {
  const unit = (id: string) => host.querySelector<HTMLElement>(`[data-unit-id="${CSS.escape(id)}"]`);
  let selectCell: (cell: Cell) => void = () => undefined;
  host.addEventListener("click", (event) => { const cell = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-cell]"); if (!cell?.dataset.cell) return; const [x, y] = cell.dataset.cell.split(",").map(Number); selectCell({ x, y }); });
  return {
    render(world, preview) {
      host.innerHTML = `<div class="battle-grid" role="grid" aria-label="${escape(world.battleId)} 战场" style="--columns:${world.board.width}">${cells(world, preview)}</div>`;
    },
    async play(events, reducedMotion) {
      for (const event of events) { applyVisualEvent(event, unit); if (!reducedMotion) await nextFrame(); }
    },
    onCellSelect: (listener) => { selectCell = listener; },
  };
}
function applyVisualEvent(event: BattleEvent, findUnit: (id: string) => HTMLElement | null): void {
  if (event.type !== "moved") return;
  const payload = event.payload as { unitId: string; to: { x: number; y: number } };
  const element = findUnit(payload.unitId); if (!element) return;
  element.style.gridColumnStart = String(payload.to.x + 1); element.style.gridRowStart = String(payload.to.y + 1); element.dataset.lastEvent = event.type;
}
```

- [ ] **Step 4: 实施手动控制面板。实际格子点击先累积路径，再根据当前动作模式选择目标；攻击、施法、交互、防御和待命均有绑定。所有选择只暂存 UI 输入，确认按钮才调用一次回调。**

```ts
// rpg/src/ui/components/command-panel.ts
export interface CommandPanel { setContext(world: WorldView): void; selectCell(cell: Cell): void; confirm(): void; }
export function createCommandPanel(host: HTMLElement, submit: (input: ManualTurnInput) => void, preview: (input: ManualTurnInput) => void): CommandPanel {
  let world: WorldView | undefined; let movePath: Cell[] = []; let mode: "path" | "attack" | "cast" | "interact" | "guard" | "wait" = "path"; let selectedSkill: { id: string; target: "unit" | "cell" } | undefined; let action: MainAction | undefined;
  const confirmButton = (): HTMLButtonElement => host.querySelector<HTMLButtonElement>("[data-confirm]")!;
  const refresh = (): void => { if (!world) return; const input = action ? { actorId: world.activeUnitId, ...(movePath.length ? { movePath } : {}), action } : undefined; if (input) preview(input); confirmButton().disabled = !input; };
  const chooseMode = (next: typeof mode): void => { mode = next; action = undefined; if (next === "cast") renderSkills(); if (next === "guard" || next === "wait") { action = { type: next }; refresh(); } };
  const renderSkills = (): void => { const actor = world?.units.find((unit) => unit.id === world.activeUnitId); const select = host.querySelector<HTMLSelectElement>("[data-skill]")!; select.replaceChildren(...(actor?.skills ?? []).map((skill) => new Option(skill.id, skill.id))); selectedSkill = actor?.skills[0]; select.disabled = !selectedSkill; };
  const selectCell = (cell: Cell): void => { if (!world) return; if (mode === "path") { movePath = [...movePath, cell]; refresh(); return; } const unit = world.units.find((item) => item.cell.x === cell.x && item.cell.y === cell.y); const objective = world.objectives.find((item) => item.cell.x === cell.x && item.cell.y === cell.y); if (mode === "attack" && unit) action = { type: "attack", targetId: unit.id }; if (mode === "cast" && selectedSkill) action = selectedSkill.target === "unit" && unit ? { type: "cast", skillId: selectedSkill.id, targetId: unit.id } : selectedSkill.target === "cell" ? { type: "cast", skillId: selectedSkill.id, targetCell: cell } : undefined; if (mode === "interact" && objective) action = { type: "interact", targetId: objective.id }; refresh(); };
  const confirm = (): void => { if (world && action) submit({ actorId: world.activeUnitId, ...(movePath.length ? { movePath } : {}), action }); };
  host.innerHTML = `<div class="command-toolbar"><button type="button" data-action="path">移动路径</button><button type="button" data-action="attack">攻击</button><button type="button" data-action="cast">施法</button><label>技能<select data-skill aria-label="技能" disabled></select></label><button type="button" data-action="interact">交互</button><button type="button" data-action="guard">防御</button><button type="button" data-action="wait">待命</button><button type="button" data-confirm disabled>确认回合</button></div>`;
  host.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => button.addEventListener("click", () => chooseMode(button.dataset.action as typeof mode)));
  host.querySelector<HTMLSelectElement>("[data-skill]")!.addEventListener("change", (event) => { const actor = world?.units.find((unit) => unit.id === world.activeUnitId); selectedSkill = actor?.skills.find((skill) => skill.id === (event.target as HTMLSelectElement).value); action = undefined; refresh(); });
  confirmButton().addEventListener("click", confirm);
  return { setContext: (next) => { world = next; movePath = []; action = undefined; selectedSkill = undefined; mode = "path"; refresh(); }, selectCell, confirm };
}
```

- [ ] **Step 5: 添加网格、预览和事件视觉反馈样式。**

```css
/* rpg/src/ui/styles/components.css */
.battle-grid { display: grid; grid-template-columns: repeat(var(--columns), minmax(2.5rem, 1fr)); gap: 1px; min-height: 100%; background: #0b0e0c; } .battle-cell { position: relative; aspect-ratio: 1; background: #30362f; border: 1px solid #485047; } .battle-cell.is-preview { outline: 2px dashed var(--amber); outline-offset: -4px; } .battle-unit { display: grid; place-items: center; width: 78%; height: 78%; margin: 11%; border-radius: 2px; background: var(--accent); color: #07110b; transition: grid-row 120ms linear, grid-column 120ms linear; } .battle-unit[data-last-event="moved"] { box-shadow: 0 0 0 2px var(--amber); } .command-toolbar { display: flex; flex-wrap: wrap; gap: var(--space-1); padding: var(--space-2); border-top: 1px solid var(--border); }
```

- [ ] **Step 6: 验证战场与手动命令行为。**

Run: `npm --prefix rpg run test:run -- src/ui/components/battlefield.test.ts src/ui/components/command-panel.test.ts`

Run: `npm --prefix rpg run build`

Run: `git diff --check`

Expected: 路径预览不改变输入 `WorldView`，动画只处理提供的事件，移动加主动作只产生一次提交。

- [ ] **Step 7: 提交战场与手动操作。**

```bash
git add rpg/src/ui/components/battlefield.ts rpg/src/ui/components/battlefield.test.ts rpg/src/ui/components/command-panel.ts rpg/src/ui/components/command-panel.test.ts rpg/src/ui/styles/components.css
git commit -m "feat: render RPG battlefield commands"
```

### Task 7: Python 编辑器、诊断、轨迹与回放控制

**Files:**
- Create: `rpg/src/ui/editor/python-editor.ts`
- Create: `rpg/src/ui/editor/python-editor.test.ts`
- Create: `rpg/src/ui/components/diagnostics-panel.ts`
- Create: `rpg/src/ui/components/replay-panel.ts`
- Create: `rpg/src/ui/components/replay-panel.test.ts`
- Modify: `rpg/src/ui/styles/components.css`

**Interfaces:**
- Consumes `Diagnostic`, `RunResult` and `TraceEvent` from `rpg/src/runners/protocol/types.ts`, `BattleEvent` from `rpg/src/game/combat/types.ts`, `placeIcon` from `rpg/src/ui/components/app-shell.ts`, and `AppController.setDraft`, `selectTrace`, `runCode`, `interrupt`.
- Produces `PythonEditor { getCode(): string; setCode(code: string): void; setDiagnostics(diagnostics: readonly Diagnostic[]): void; focusLine(line: number): void; destroy(): void }` and `createPythonEditor(host, initialCode, onChange)`.
- Produces `renderDiagnostics(host, snapshot)`, `ReplayPanel.render(trace, replay)` and `ReplayPanel.step(): void`; corrupt or unverifiable replay is read-only and never reenacts Python.

- [ ] **Step 1: 写入失败测试，锁定 Python 扩展、草稿回调、诊断定位、选择轨迹和损坏重放的禁用播放状态。**

```ts
// rpg/src/ui/editor/python-editor.test.ts
it("reports edits and focuses the diagnostic line", () => {
  const changes = vi.fn(); const editor = createPythonEditor(host, "def choose_turn(world):\n    return {}", changes);
  editor.setDiagnostics([{ code: "PY_SYNTAX", severity: "error", message: "缺少冒号", location: { file: "main.py", line: 1, column: 22 } }]);
  editor.focusLine(1);
  expect(host.querySelector(".cm-editor")).not.toBeNull();
  expect(host.querySelector(".cm-diagnostic")).not.toBeNull();
});

// rpg/src/ui/components/replay-panel.test.ts
it("marks a hash-divergent replay as readonly and disables step playback", () => {
  renderReplay(host, { verification: "corrupt", reason: "第 3 步状态哈希不一致", steps: [] });
  expect(host.textContent).toContain("未验证重放");
  expect(host.querySelector<HTMLButtonElement>("[data-replay-step]")?.disabled).toBe(true);
});
```

- [ ] **Step 2: 运行编辑与回放测试，确认在模块尚不存在时失败。**

Run: `npm --prefix rpg run test:run -- src/ui/editor/python-editor.test.ts src/ui/components/replay-panel.test.ts`

Expected: FAIL，错误指出编辑器和回放模块不存在。

- [ ] **Step 3: 用指定版本的 CodeMirror Python 扩展实施编辑器，使用 `textContent` 和编辑器 API 而不是 HTML 注入源码或诊断。**

```ts
// rpg/src/ui/editor/python-editor.ts
import { basicSetup } from "codemirror";
import { python } from "@codemirror/lang-python";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { Decoration, EditorView } from "@codemirror/view";
import type { Diagnostic } from "../../runners/protocol/types";

const diagnosticMark = Decoration.mark({ class: "cm-diagnostic cm-diagnosticRange" });
const setDiagnostics = StateEffect.define<readonly Diagnostic[]>();
const diagnosticField = StateField.define({
  create: () => Decoration.none,
  update: (marks, transaction) => { const effect = transaction.effects.find((item) => item.is(setDiagnostics)); if (!effect) return marks.map(transaction.changes); return Decoration.set(effect.value.flatMap((diagnostic) => { const line = diagnostic.location?.file === "main.py" ? diagnostic.location.line : undefined; return line ? [diagnosticMark.range(transaction.state.doc.line(Math.min(line, transaction.state.doc.lines)).from)] : []; })); },
  provide: (field) => EditorView.decorations.from(field),
});
function applyDiagnostics(view: EditorView, diagnostics: readonly Diagnostic[]): void {
  view.dispatch({ effects: setDiagnostics.of(diagnostics) });
}
function focusLine(view: EditorView, line: number): void { const target = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines)); view.dispatch({ selection: { anchor: target.from }, scrollIntoView: true }); view.focus(); }

export function createPythonEditor(host: HTMLElement, initialCode: string, onChange: (code: string) => void): PythonEditor {
  const update = EditorView.updateListener.of((change) => { if (change.docChanged) onChange(change.state.doc.toString()); });
  const view = new EditorView({ parent: host, state: EditorState.create({ doc: initialCode, extensions: [basicSetup, python(), oneDark, diagnosticField, update] }) });
  return { getCode: () => view.state.doc.toString(), setCode: (code) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } }), setDiagnostics: (items) => applyDiagnostics(view, items), focusLine: (line) => focusLine(view, line), destroy: () => view.destroy() };
}
```

- [ ] **Step 4: 渲染稳定诊断和可追溯的代码轨迹。诊断点击必须选择其 `TraceEvent.seq` 并调用 `editor.focusLine`。**

```ts
// rpg/src/ui/components/diagnostics-panel.ts
export function renderDiagnostics(host: HTMLElement, snapshot: AppSnapshot, onTrace: (seq: number) => void): void {
  const entries = snapshot.diagnostics;
  host.replaceChildren();
  if (entries.length === 0) { host.textContent = snapshot.result.kind === "empty" ? "尚无运行诊断。" : "运行未返回可定位诊断。"; return; }
  const list = document.createElement("ol");
  for (const diagnostic of entries) { const button = document.createElement("button"); button.type = "button"; button.textContent = `${diagnostic.code}：${diagnostic.message}`; if (diagnostic.traceSeq === undefined) button.disabled = true; else button.addEventListener("click", () => onTrace(diagnostic.traceSeq)); list.append(document.createElement("li")).append(button); }
  host.append(list);
}
```

- [ ] **Step 5: 实施逐步回放面板。它只消费已经保存的事件，不调用 Runner 或 `resolveTurn`。**

```ts
// rpg/src/ui/components/replay-panel.ts
import { StepForward } from "lucide";
import { placeIcon } from "./app-shell";
import type { ReplayPresentation } from "../../app/app-model";
export type ReplayViewModel = ReplayPresentation;
export function renderReplay(host: HTMLElement, replay: ReplayViewModel, onStep: (index: number) => void): void {
  host.innerHTML = "";
  const heading = document.createElement("h2"); heading.textContent = replay.verification === "verified" ? "回放轨迹" : "未验证重放";
  const detail = document.createElement("p"); detail.textContent = replay.reason ?? "选择一步以查看对应代码与战场事件。";
  const step = document.createElement("button"); step.type = "button"; step.dataset.replayStep = ""; step.setAttribute("aria-label", "下一步"); step.dataset.tooltip = "下一步"; step.disabled = replay.verification !== "verified" || replay.steps.length === 0; step.addEventListener("click", () => onStep(Math.min(replay.currentIndex + 1, replay.steps.length - 1)));
  host.append(heading, detail, step); placeIcon(host, "[data-replay-step]", StepForward);
}
```

- [ ] **Step 6: 补充轨迹/编辑器状态样式并验证模块。**

```css
/* rpg/src/ui/styles/components.css */
.cm-editor { min-height: 16rem; border-top: 1px solid var(--border); } .diagnostic-list button { width: 100%; text-align: left; } .trace-row[aria-current="step"] { border-left: 3px solid var(--amber); } .replay-warning { color: var(--danger); } [data-replay-step]:disabled { cursor: not-allowed; opacity: 0.55; }
```

Run: `npm --prefix rpg run test:run -- src/ui/editor/python-editor.test.ts src/ui/components/replay-panel.test.ts`

Run: `npm --prefix rpg run build`

Run: `git diff --check`

Expected: 编辑可读取与修改草稿，诊断可定位，损坏重放没有播放按钮的可用路径。

- [ ] **Step 7: 提交编辑、诊断和回放控件。**

```bash
git add rpg/src/ui/editor/python-editor.ts rpg/src/ui/editor/python-editor.test.ts rpg/src/ui/components/diagnostics-panel.ts rpg/src/ui/components/replay-panel.ts rpg/src/ui/components/replay-panel.test.ts rpg/src/ui/styles/components.css
git commit -m "feat: add Python editor and replay controls"
```

### Task 8: 生产启动与应用视图集成

**Files:**
- Create: `rpg/src/app/bootstrap.ts`
- Create: `rpg/src/ui/app-view.ts`
- Create: `rpg/src/app/bootstrap.test.ts`
- Create: `rpg/src/content/bootstrap-app-content.ts`
- Modify: `rpg/src/runners/python/adapter.ts`
- Modify: `rpg/src/main.ts`
- Modify: `rpg/src/ui/components/app-shell.ts`
- Modify: `rpg/src/ui/components/status-strip.ts`

**Interfaces:**
- Consumes `createAppController`, `createSaveStore`, `PythonRunnerAdapter`, battle public contracts and all Task 5–7 views.
- `rpg/src/app/app-model.ts` 定义本计划自己的注入端口 `AppContentPort { initialBattleFor(questId: string): BattleState; worldViewFor(state: BattleState): WorldView; questIds(): readonly string[]; replayMetadataFor(questId: string, initialState: BattleState): ReplayMetadata }`；本 Task 创建单遭遇 `createBootstrapAppContent()` 实现，生产默认使用它；战役后续以正式六关内容替换工厂注入。它只从关卡初始内容创建新战斗、观察投影与该初始战斗的重放元数据，绝不从存档读取或恢复战斗中间态。
- `rpg/src/app/bootstrap.ts` 定义并导出 `BootstrapDependencies { runner: RunnerPort; saves: SaveStore; storage: SaveStorage; initialBattle: BattleState; initialWorld: WorldView; content: AppContentPort; resolveTurn: typeof resolveTurn }`、`browserDigest: SaveDigest`、`bootstrapRpgApp(root, dependencies: BootstrapDependencies): Promise<AppController>`；页面生产组合必须显式提供真实 `PythonRunnerAdapter` 和 `AppContentPort`，单元/e2e 测试才替换其中端口。不要在本计划猜测 `PythonRunnerAdapter` 的构造参数；战役入口按 Runner 计划最终公开构造签名创建实例后传入。
- `AppView` consumes snapshots by subscription and does not expose a mutable `BattleState`; it calls `BattlefieldView.play(snapshot.pendingEventBatch.events, snapshot.preferences.reducedMotion)` once, then `ackEventBatch(batchId)` clears that exact batch. It only calls `CommandPanel.setContext` when `WorldView.revision` 或 `activeUnitId` 改变。

- [ ] **Step 1: 写入失败集成测试，要求默认启动构造真实 `PythonRunnerAdapter`，而测试覆盖项才能替换 Runner；同时验证状态映射与存档失败消息。**

```ts
// rpg/src/app/bootstrap.test.ts
function fakeContent(): AppContentPort { return { questIds: () => ["python-marsh-01"], initialBattleFor: () => initialBattle, worldViewFor: () => initialWorld, replayMetadataFor: (questId, state) => ({ engineVersion: "0.1.0", contentVersion: state.contentVersion, runnerProtocolVersion: 1, questId, battleId: state.battleId, seed: String(state.rngState) }) }; }
function testDependencies(overrides: Partial<BootstrapDependencies> = {}): BootstrapDependencies { return { runner: fakeRunner(commandWithPath), saves: fakeSaves(), storage: memoryStorage(), initialBattle, initialWorld, content: fakeContent(), resolveTurn: acceptedResolver, ...overrides }; }
it("uses an injected fake runner only when a test explicitly supplies one", async () => {
  const fake = fakeRunner(commandWithPath);
  const app = await bootstrapRpgApp(host, testDependencies({ runner: fake }));
  await app.runCode();
  expect(fake.run).toHaveBeenCalledOnce();
  expect(host.querySelector("[data-run-state]")?.textContent).toContain("Python 运行器就绪");
});

it("renders a storage error while preserving the in-memory battle projection", async () => {
  const app = await bootstrapRpgApp(host, testDependencies({ saves: failingSaves() }));
  await app.runCode();
  expect(host.querySelector("[data-save-notice]")?.textContent).toContain("上一份已验证存档仍可使用");
  expect(host.querySelector("[data-battlefield]")?.textContent).toContain("scout");
});
```

- [ ] **Step 2: 运行集成测试，确认启动与视图模块缺失时失败。**

Run: `npm --prefix rpg run test:run -- src/app/bootstrap.test.ts`

Expected: FAIL，错误指出 `bootstrapRpgApp` 未导出。

- [ ] **Step 3: 装配生产依赖，禁止创建任何默认“成功” Runner 结果。**

```ts
// rpg/src/content/bootstrap-app-content.ts
import type { AppContentPort } from "../app/app-model";
import type { BattleState } from "../game/combat/types";
import { projectWorldView } from "../game/world/project-world-view";
const QUEST_ID = "bootstrap-encounter";
const template: BattleState = { battleId: QUEST_ID, contentVersion: "bootstrap-1", revision: 0, round: 1, turnIndex: 0, turnOrder: ["scout", "golem"], phase: "in_progress", units: [{ id: "scout", team: "allies", visibility: "revealed", cell: { x: 0, y: 0 }, hp: 10, maxHp: 10, attack: 4, defense: 0, move: 2, initiative: 2, disabled: false, skills: [{ id: "spark", range: 2, power: 2, cooldown: 0, remainingCooldown: 0, target: "unit", kind: "damage" }], statuses: [] }, { id: "golem", team: "enemies", visibility: "revealed", cell: { x: 2, y: 0 }, hp: 8, maxHp: 8, attack: 3, defense: 0, move: 1, initiative: 1, disabled: false, skills: [], statuses: [] }], board: { width: 4, height: 3, blockedCells: [], hazardCells: [], coverCells: [], hazardDamage: 0 }, objectives: [], rngState: 2463534242, maxRounds: 8, failureConditions: { keyObjectiveDestroyed: false } };
export function createBootstrapAppContent(): AppContentPort { return { questIds: () => [QUEST_ID], initialBattleFor: (questId) => { if (questId !== QUEST_ID) throw new Error("UNKNOWN_QUEST"); return structuredClone(template); }, worldViewFor: projectWorldView, replayMetadataFor: (questId, state) => ({ engineVersion: "0.1.0", contentVersion: state.contentVersion, runnerProtocolVersion: 1, questId, battleId: state.battleId, seed: String(state.rngState) }) }; }

// rpg/src/app/bootstrap.ts
import { sha256Prefixed } from "../game/save/canonical-json";
import { createSaveStore } from "../game/save/save-store";
import type { SaveDigest, SaveStorage, SaveStore } from "../game/save/types";
export interface BootstrapDependencies { runner: RunnerPort; saves: SaveStore; storage: SaveStorage; initialBattle: BattleState; initialWorld: WorldView; content: AppContentPort; resolveTurn: typeof resolveTurn; }
export const browserDigest: SaveDigest = { sha256: (text) => sha256Prefixed(text, crypto.subtle) };
export async function createProductionDependencies(content: AppContentPort, runner: RunnerPort, storage: SaveStorage = localStorage): Promise<BootstrapDependencies> { const saves = createSaveStore({ storage, digest: browserDigest, now: () => new Date().toISOString(), questIds: new Set(content.questIds()) }); const loaded = await saves.load(); const questId = loaded.payload.campaign.completedQuestIds.at(-1) ?? content.questIds()[0]; const initialBattle = content.initialBattleFor(questId); return { runner, saves, storage, initialBattle, initialWorld: content.worldViewFor(initialBattle), content, resolveTurn }; }
export async function bootstrapRpgApp(root: HTMLElement, dependencies: BootstrapDependencies): Promise<AppController> {
  const shell = createAppShell(root);
  const loaded = await dependencies.saves.load();
  const controller = createAppController({ initialBattle: dependencies.initialBattle, initialWorld: dependencies.initialWorld, initialSave: loaded.payload, runner: dependencies.runner, saves: dependencies.saves, content: dependencies.content, resolveTurn: dependencies.resolveTurn });
  createAppView(shell, controller, loaded.payload);
  return controller;
}
```

- [ ] **Step 4: 以单向订阅连接状态、编辑器、按钮、存档导入导出和事件播放。**

```ts
// rpg/src/ui/app-view.ts
export function downloadText(name: string, text: string): void { const url = URL.createObjectURL(new Blob([text], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
export function toReplayView(snapshot: AppSnapshot): ReplayViewModel { return snapshot.replay; }
export function renderRecovery(shell: AppShellElements, snapshot: AppSnapshot, editor: PythonEditor): void {
  shell.saveNotice.textContent = snapshot.result.kind === "save_failure" || snapshot.result.kind === "save_notice" ? snapshot.result.message : "";
  shell.recovery.replaceChildren(); const action = snapshot.result.kind === "command_rejected" || snapshot.result.kind === "save_failure" || snapshot.result.kind === "save_notice" || snapshot.result.kind === "battle_outcome" ? snapshot.result.action : snapshot.result.kind === "runner" ? ({ syntax_error: "edit", runtime_error: "edit", timeout: "retry", interrupted: "edit", invalid_request: "retry", runner_error: "manual", completed: undefined } as const)[snapshot.result.result.executionStatus] : undefined;
  if (!action) return; const button = document.createElement("button"); button.type = "button"; button.dataset.recovery = action; button.textContent = ({ edit: "返回编辑", manual: "手动行动", retry: "重试保存", export: "导出存档", import: "导入存档", continue: "继续", replay: "查看回放", restart: "重新开始" } as const)[action]; if (action === "edit") button.addEventListener("click", () => editor.focusLine(snapshot.diagnostics[0]?.location?.line ?? 1)); if (action === "export") button.addEventListener("click", () => shell.exportButton.click()); if (action === "import") button.addEventListener("click", () => shell.importButton.click()); shell.recovery.append(button);
}
export function createAppView(shell: AppShellElements, controller: AppController, saved: SavePayload): void {
  const editor = createPythonEditor(shell.editorHost, saved.drafts[saved.campaign.completedQuestIds.at(-1) ?? "python-marsh-01"] ?? "", (code) => controller.setDraft(code));
  const field = createBattlefieldView(shell.battlefield);
  const panel = createCommandPanel(shell.commandPanel, (input) => void controller.submitManual(input), (input) => field.render(controller.snapshot().world, { ...input, expectedRevision: controller.snapshot().world.revision }));
  field.onCellSelect(panel.selectCell);
  shell.runButton.addEventListener("click", () => void controller.runCode());
  shell.interruptButton.addEventListener("click", () => void controller.interrupt());
  shell.exportButton.addEventListener("click", async () => { const exported = await controller.exportSave(); if (exported.ok) downloadText("python-rpg-save.json", exported.text); });
  shell.importButton.addEventListener("click", () => shell.importFile.click());
  shell.importFile.addEventListener("change", async () => { const file = shell.importFile.files?.[0]; if (file) await controller.importSave(await file.text()); shell.importFile.value = ""; });
  let contextKey = ""; let draft = editor.getCode(); let playingBatchId: string | undefined;
  controller.subscribe((snapshot) => { const nextContextKey = `${snapshot.world.revision}:${snapshot.world.activeUnitId}`; if (nextContextKey !== contextKey) { contextKey = nextContextKey; field.render(snapshot.world); panel.setContext(snapshot.world); } const nextDraft = snapshot.save.drafts[snapshot.questId] ?? ""; if (nextDraft !== draft) { draft = nextDraft; editor.setCode(nextDraft); } renderStatusStrip(shell.runState, snapshot); editor.setDiagnostics(snapshot.diagnostics); renderDiagnostics(shell.diagnostics, snapshot, (seq) => controller.selectTrace(seq)); renderReplay(shell.replay, toReplayView(snapshot), (index) => { const replayStep = snapshot.replay.steps[index]; if (replayStep) void field.play(replayStep.events, snapshot.preferences.reducedMotion); controller.selectReplayStep(index); }); renderRecovery(shell, snapshot, editor); const batch = snapshot.pendingEventBatch; if (batch && playingBatchId !== batch.batchId) { playingBatchId = batch.batchId; void field.play(batch.events, snapshot.preferences.reducedMotion).then(() => { if (playingBatchId === batch.batchId) { playingBatchId = undefined; controller.ackEventBatch(batch.batchId); } }); } });
  window.addEventListener("beforeunload", () => editor.destroy(), { once: true });
}
```

- [ ] **Step 5: 在真实入口中启动，保留加载与致命错误状态，且不吞掉不可用原因。**

```ts
// rpg/src/main.ts：战役入口把实现了 AppContentPort 的内容对象传给本函数；main 不导入未定义的 content bootstrap。
import "./ui/styles/tokens.css";
import "./ui/styles/layout.css";
import "./ui/styles/components.css";
import { bootstrapRpgApp } from "./app/bootstrap";

export function requireAppRoot(documentRef: Document): HTMLElement { const root = documentRef.querySelector<HTMLElement>("#app"); if (!root) throw new Error("页面缺少 RPG 应用容器"); return root; }
export function renderFatalError(root: HTMLElement, error: unknown): void { root.replaceChildren(); const section = document.createElement("section"); section.className = "fatal-state"; section.setAttribute("role", "alert"); const heading = document.createElement("h1"); heading.textContent = "应用无法启动"; const detail = document.createElement("p"); detail.textContent = error instanceof Error ? error.message : "初始化失败。"; section.append(heading, detail); root.append(section); }
export async function startRpgApp(root: HTMLElement, content: AppContentPort, runner: RunnerPort): Promise<AppController> { root.innerHTML = `<div class="loading-state" role="status">正在装配规则炉心。</div>`; try { return await bootstrapRpgApp(root, await createProductionDependencies(content, runner)); } catch (error) { renderFatalError(root, error); throw error; } }
```

- [ ] **Step 6: 执行集成验证。**

Run: `npm --prefix rpg run test:run -- src/app/bootstrap.test.ts src/app/app-controller.test.ts`

Run: `npm --prefix rpg run build`

Run: `git diff --check`

Expected: 生产装配没有成功伪造，显式 fake runner 可验证自动回合，Runner/存档状态可以到达 UI。

- [ ] **Step 7: 提交可启动的应用集成。**

```bash
git add rpg/src/app/bootstrap.ts rpg/src/app/bootstrap.test.ts rpg/src/ui/app-view.ts rpg/src/main.ts rpg/src/ui/components/app-shell.ts rpg/src/ui/components/status-strip.ts
git commit -m "feat: boot integrated Python RPG app"
```

### Task 9: 视口、键盘、错误与小屏只读浏览器验收

**Files:**
- Create: `rpg/e2e/app-shell.spec.ts`
- Modify: `rpg/src/app/bootstrap.ts`
- Modify: `rpg/src/main.ts`

**Interfaces:**
- Consumes the explicit test seam `window.__RPG_TEST_DEPENDENCIES__?: BootstrapDependencies` only when Playwright installs it before `main.ts` evaluates; no production fallback result exists when the property is absent.生产战役入口仍以 `startRpgApp(root, content, runner)` 装配同一视图。
- Produces browser evidence for 1280x720, 1440x900, <960px read-only view, keyboard run/interruption/replay, Runner unavailable, command rejection, save write failure and corrupt replay UI.

- [ ] **Step 1: 写入失败的 Playwright 验收。Fake runner 只作为页面测试的显式依赖注入，不可在应用中作为默认成功结果。**

```ts
// rpg/e2e/app-shell.spec.ts
import { expect, test, type Page } from "@playwright/test";
declare global { interface Window { __RPG_TEST_DEPENDENCIES__?: Record<string, unknown>; } }

type Scenario = "accepted" | "rejected" | "save_failure" | "corrupt_replay" | "unavailable" | "running";
async function installScenario(page: Page, scenario: Scenario): Promise<void> {
  await page.addInitScript((kind) => {
    const initialBattle = { battleId: "python-marsh-01", contentVersion: "python-slice-1", revision: 0, round: 1, turnIndex: 0, turnOrder: ["scout", "golem"], phase: "in_progress", units: [{ id: "scout", team: "allies", visibility: "revealed", cell: { x: 1, y: 1 }, hp: 10, maxHp: 10, attack: 4, defense: 0, move: 2, initiative: 2, disabled: false, skills: [{ id: "arc-bolt", range: 2, power: 2, cooldown: 0, remainingCooldown: 0, target: "unit", kind: "damage" }], statuses: [] }, { id: "golem", team: "enemies", visibility: "revealed", cell: { x: 3, y: 1 }, hp: 8, maxHp: 8, attack: 3, defense: 0, move: 1, initiative: 1, disabled: false, skills: [], statuses: [] }], board: { width: 4, height: 3, blockedCells: [], hazardCells: [], coverCells: [], hazardDamage: 0 }, objectives: [], rngState: 2463534242, maxRounds: 5, failureConditions: { keyObjectiveDestroyed: false } };
    const initialWorld = { battleId: "python-marsh-01", contentVersion: "python-slice-1", revision: 0, round: 1, activeUnitId: "scout", board: { width: 4, height: 3, blockedCells: [], hazardCells: [], coverCells: [] }, units: [{ id: "scout", team: "allies", cell: { x: 1, y: 1 }, hp: 10, maxHp: 10, disabled: false, statuses: [], move: 2, attack: 4, defense: 0, skills: [{ id: "arc-bolt", range: 2, power: 2, target: "unit", kind: "damage" }] }, { id: "golem", team: "enemies", cell: { x: 3, y: 1 }, hp: 8, maxHp: 8, disabled: false, statuses: [] }], objectives: [] };
    const corruptDocument = { replayVersion: 1, metadata: { engineVersion: "0.1.0", contentVersion: "python-slice-1", runnerProtocolVersion: 1, questId: "python-marsh-01", battleId: "python-marsh-01", seed: "2463534242" }, initialState: initialBattle, initialStateHash: "sha256:wrong", steps: [], outcome: "in_progress", finalStateHash: "sha256:wrong" };
    const payload = { campaign: { completedQuestIds: [], unlockedSkillIds: [], equipmentIds: [] }, drafts: { "python-marsh-01": "def choose_turn(world):\n    return {'actorId': 'scout', 'expectedRevision': world['revision'], 'action': {'type': 'wait'}}" }, preferences: { reducedMotion: false }, replays: kind === "corrupt_replay" ? [{ replayId: "broken", questId: "python-marsh-01", createdAt: "2026-08-10T00:00:00.000Z", document: corruptDocument }] : [] };
    const completed = { executionStatus: "completed", returnValue: { actorId: "scout", expectedRevision: 0, action: { type: "wait" } }, diagnostics: [], trace: [] };
    let runCount = 0; let releaseInterrupted: ((result: object) => void) | undefined;
    const runner = kind === "running" ? { run: () => ++runCount === 1 ? new Promise((resolve) => { releaseInterrupted = resolve; }) : Promise.resolve(completed), interrupt: async (_runId) => releaseInterrupted?.({ executionStatus: "interrupted", diagnostics: [], trace: [] }) } : { run: async () => kind === "unavailable" ? { executionStatus: "runner_error", diagnostics: [{ code: "RUNNER_UNAVAILABLE", severity: "error", message: "Worker 无法启动。" }], trace: [] } : completed, interrupt: async (_runId) => undefined };
    const saves = { load: async () => ({ kind: "loaded", payload, revision: 1 }), save: async () => kind === "save_failure" ? { ok: false, code: "WRITE_POINTER_FAILED", message: "活动指针未更新，仍可恢复上一代。" } : { ok: true, revision: 2, prunedReplayIds: [] }, exportText: async () => ({ ok: true, text: JSON.stringify({ schemaVersion: 1, payload }) }), importText: async () => ({ kind: "recovered", payload, revision: 2, notice: { code: "IMPORTED_RECOVERY", message: "已导入并验证存档。", action: "continue" } }) };
    const resolveTurn = (_state, input) => kind === "rejected" ? { accepted: false, errors: [{ code: "EXPECTED_REVISION_MISMATCH", path: "expectedRevision", message: "战场已变化。" }], state: initialBattle } : { accepted: true, command: input, state: initialBattle, events: [{ protocolVersion: 1, seq: 1, stateRevision: 1, type: "moved", payload: { unitId: "scout", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } } }] };
    window.__RPG_TEST_DEPENDENCIES__ = { runner, saves, storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }, initialBattle, initialWorld, resolveTurn, content: { questIds: () => ["python-marsh-01"], initialBattleFor: () => initialBattle, worldViewFor: () => initialWorld, replayMetadataFor: (questId, state) => ({ engineVersion: "0.1.0", contentVersion: state.contentVersion, runnerProtocolVersion: 1, questId, battleId: state.battleId, seed: String(state.rngState) }) } };
  }, scenario);
}

test("1280x720 displays battlefield, editor, trace and one atomic automatic command", async ({ page }) => {
  await installScenario(page, "accepted");
  await page.setViewportSize({ width: 1280, height: 720 }); await page.goto("/");
  await expect(page.locator("[data-battlefield]")).toBeVisible(); await expect(page.locator(".cm-editor")).toBeVisible();
  await page.getByRole("button", { name: "运行" }).click();
  await expect(page.locator("[data-run-state]")).toContainText("就绪");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

test("small screen hides code controls while retaining read-only battle, trace and export", async ({ page }) => {
  await installScenario(page, "accepted"); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await expect(page.locator("[data-battlefield]")).toBeVisible(); await expect(page.locator("[data-replay]")).toBeVisible();
  await expect(page.getByRole("button", { name: "导出存档" })).toBeVisible();
  await expect(page.locator(".cm-editor")).toHaveCount(0); await expect(page.getByRole("button", { name: "运行" })).toHaveCount(0);
});
```

- [ ] **Step 2: 首次运行浏览器验收，确认测试会在测试注入入口和 UI 尚未完成时失败。**

Run: `npm --prefix rpg run e2e -- app-shell.spec.ts`

Expected: FAIL，缺少 `__RPG_TEST_DEPENDENCIES__` 的显式消费或所需 DOM 钩子。

- [ ] **Step 3: 只为显式测试全局对象接入覆盖项；生产路径保持真实适配器。**

```ts
// rpg/src/main.ts
import "./ui/styles/tokens.css";
import "./ui/styles/layout.css";
import "./ui/styles/components.css";
import { bootstrapRpgApp, createProductionDependencies, type BootstrapDependencies } from "./app/bootstrap";
import type { AppContentPort, AppController, RunnerPort } from "./app/app-model";
import { createBootstrapAppContent } from "./content/bootstrap-app-content";
import { PythonRunnerAdapter } from "./runners/python/adapter";
declare global { interface Window { __RPG_TEST_DEPENDENCIES__?: BootstrapDependencies; } }
export function requireAppRoot(documentRef: Document): HTMLElement { const root = documentRef.querySelector<HTMLElement>("#app"); if (!root) throw new Error("页面缺少 RPG 应用容器"); return root; }
export function renderFatalError(root: HTMLElement, error: unknown): void { root.replaceChildren(); const section = document.createElement("section"); section.className = "fatal-state"; section.setAttribute("role", "alert"); const heading = document.createElement("h1"); heading.textContent = "应用无法启动"; const detail = document.createElement("p"); detail.textContent = error instanceof Error ? error.message : "初始化失败。"; section.append(heading, detail); root.append(section); }
const root = requireAppRoot(document); const content: AppContentPort = createBootstrapAppContent(); const runner: RunnerPort = new PythonRunnerAdapter();
async function start(): Promise<AppController> { const dependencies: BootstrapDependencies = window.__RPG_TEST_DEPENDENCIES__ ?? await createProductionDependencies(content, runner); return bootstrapRpgApp(root, dependencies); }
void start().catch((error) => renderFatalError(root, error));
```

- [ ] **Step 4: 完成其余浏览器情形，包括 1440x900、可见焦点和错误恢复。**

```ts
// rpg/e2e/app-shell.spec.ts
test("keyboard edits, runs, interrupts, steps replay, then returns to the editor at 1440x900", async ({ page }) => {
  await installScenario(page, "running"); await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/");
  await page.locator(".cm-content").focus(); await page.keyboard.type("# keyboard edit"); await expect(page.locator(".cm-content")).toContainText("keyboard edit");
  await page.getByRole("button", { name: "运行" }).focus(); await page.keyboard.press("Enter"); await expect(page.locator("[data-run-state]")).toContainText("执行");
  await page.getByRole("button", { name: "中断运行" }).focus(); await page.keyboard.press("Enter"); await expect(page.locator("[data-run-state]")).toContainText("就绪");
  await page.getByRole("button", { name: "运行" }).focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("button", { name: "下一步" })).toBeEnabled();
  await page.getByRole("button", { name: "下一步" }).focus(); await page.keyboard.press("Enter"); await page.locator(".cm-content").focus(); await expect(page.locator(":focus")).toHaveClass(/cm-content/);
});

test("shows a return-to-editor action for a resolver rejection", async ({ page }) => {
  await installScenario(page, "rejected"); await page.goto("/"); await page.getByRole("button", { name: "运行" }).click();
  await expect(page.getByRole("button", { name: "返回编辑" })).toBeVisible(); await expect(page.getByText("EXPECTED_REVISION_MISMATCH")).toBeVisible();
});

test("shows export recovery action when the injected SaveStore rejects pointer persistence", async ({ page }) => {
  await installScenario(page, "save_failure"); await page.goto("/"); await page.getByRole("button", { name: "运行" }).click();
  await expect(page.getByRole("button", { name: "导出存档" })).toBeVisible(); await expect(page.locator("[data-save-notice]")).toContainText("活动指针未更新");
});

test("shows corrupt replay from injected stored replay data as read-only", async ({ page }) => {
  await installScenario(page, "corrupt_replay"); await page.goto("/");
  await expect(page.locator("[data-replay]")).toContainText("未验证重放");
  await expect(page.getByRole("button", { name: "下一步" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "导出存档" })).toBeVisible();
});
```

- [ ] **Step 5: 在浏览器验收中加入减弱动效和无横向溢出的断言。**

```ts
// rpg/e2e/app-shell.spec.ts
test("reduced motion settles BattleEvent playback immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await installScenario(page, "accepted"); await page.goto("/");
  await page.getByRole("button", { name: "运行" }).click();
  await expect(page.locator('[data-unit-id="scout"]')).toHaveAttribute("data-last-event", "moved");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
```

- [ ] **Step 6: 执行所有浏览器验收和静态检查。**

Run: `npm --prefix rpg run e2e`

Run: `npm --prefix rpg run check`

Run: `git diff --check`

Expected: 1280x720、1440x900、小屏只读、键盘、错误、保存失败、损坏回放与减弱动效全部通过；生产未注入 fake runner。

- [ ] **Step 7: 提交浏览器验收与受限测试注入。**

```bash
git add rpg/e2e/app-shell.spec.ts rpg/src/app/bootstrap.ts rpg/src/main.ts
git commit -m "test: cover RPG app shell acceptance"
```

## Final Review

- [ ] Run: `npm --prefix rpg run test:run`

Expected: 所有 Vitest DOM、控制器和存档测试通过。

- [ ] Run: `npm --prefix rpg run build`

- [ ] Run: `npm --prefix rpg run e2e`

Expected: 类型检查、生产构建和 Playwright 桌面/小屏验收通过。

- [ ] Run: `git diff --check`

- [ ] Run: `git status --short`

Expected: 无空白错误；仅本计划实施产生的 `rpg/` 文件和任务提交相关变更被暂存或提交。

- [ ] 检查存档导出 JSON：包含 `schemaVersion`、`revision`、`savedAt`、`checksum` 与允许的 payload 字段；确认不出现 `activeBattle`、`battleState`、未结算回合或事件队列。

- [ ] 检查 `AppController`：手动与 Runner 路径都仅向 `resolveTurn` 提交一个 `TurnCommand`，其中 `movePath` 在 `action` 前；`CommandResolution.accepted === false` 时保持原 `BattleState` 引用。

- [ ] 检查 UI：动画入口只接收 `BattleEvent[]`；小屏没有代码编辑、运行、手动命令或导入；所有图标按钮有 `aria-label` 与 `data-tooltip`；焦点环、44px 控件和减弱动效存在。

- [ ] 自审计划文本：未包含待补内容标记、未引用未定义的本计划内部接口、所有生产改动都有对应测试命令、九个任务均有独立验证与提交命令。
