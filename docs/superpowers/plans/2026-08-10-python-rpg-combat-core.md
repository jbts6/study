# 确定性 RPG 战斗内核与重放 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** 在新的 \`rpg/\` 应用中完成严格确定性的战斗内核、受限 \`WorldView\` 与不运行 Python 的 JCS 哈希重放。

**Architecture:** \`BattleState\` 是唯一可变事实来源。未知 JSON 先经 \`validateTurnCommand\` 完整接受或拒绝，\`reduceBattle\` 只归约已验证命令；\`resolveTurn\` 是公共原子入口。Replay 从初始状态重放已接受命令，并在随机状态、事件哈希或状态哈希的首个偏差停止。

**Tech Stack:** Vite 8.2.1、TypeScript 7.0.2（严格模式）、Vitest 4.1.10、jsdom 30.0.1、@playwright/test 1.62.1、canonicalize 3.0.0、Web Crypto SHA-256。

## Global Constraints

- 仅创建 \`rpg/\`；不修改 \`python/\`。
- \`package.json\` 与 \`package-lock.json\` 必须精确固定 vite 8.2.1、typescript 7.0.2、vitest 4.1.10、jsdom 30.0.1、@playwright/test 1.62.1、canonicalize 3.0.0，不使用范围版本。
- 所有规则数值与随机状态均为有限整数；哈希输入仅为整数、布尔、字符串、数组及键排序对象。
- 一条 \`TurnCommand\` 只能含可选移动和一个主动作；移动永远先于动作，任何校验失败均不得修改 state/revision/rng/事件或消耗回合。
- 先手为 initiative 降序、id 升序。掩体规则固定为：**目标位于 \`coverCells\` 时，目标防御加 1**；伤害为 \`max(1, attacker.attack + power - target.defense - coverBonus)\`。
- 随机性仅来自 xorshift32；技能 effect 含 chancePermille 时恰好消费一次 rng。
- 事件协议版本为 1，命令内 seq 从 1 开始；UI 只能消费事件。
- WorldView 不得泄露 rngState、enemy skills/cooldowns、hidden 单位、failureConditions 或引擎对象。
- Replay 不得导入、执行或解释 Python；哈希为 RFC 8785 规范化 JSON 的 SHA-256，字符串以 \`sha256:\` 开头。

---

## 文件结构与固定 Interfaces

| 路径 | 职责 |
| --- | --- |
| \`rpg/src/game/combat/types.ts\` | 全部战斗、投影与结果类型。 |
| \`rpg/src/game/combat/validate-turn-command.ts\` | 未知 JSON 的无副作用校验。 |
| \`rpg/src/game/combat/reduce-battle.ts\` | 已验证命令的纯归约和事件。 |
| \`rpg/src/game/combat/resolve-turn.ts\` | 公共原子入口。 |
| \`rpg/src/game/world/project-world-view.ts\` | 显式字段白名单与冻结。 |
| \`rpg/src/game/replay/canonical-hash.ts\` | JCS SHA-256。 |
| \`rpg/src/game/replay/replay.ts\` | Replay 创建、记录和验证。 |
| \`rpg/src/game/testing/fixture.ts\` | 确定性战斗夹具。 |

\`\`\`ts
// rpg/src/game/combat/types.ts
export type Cell = Readonly<{ x: number; y: number }>;
export type Team = "allies" | "enemies";
export type BattlePhase = "in_progress" | "won" | "lost";
export type Status = Readonly<{ id: string; remainingTurns: number; defenseBonus: number }>;
export type SkillEffect = Readonly<{ statusId: string; duration: number; defenseBonus: number; chancePermille?: number }>;
export type Skill = Readonly<{ id: string; range: number; power: number; cooldown: number; remainingCooldown: number; target: "unit" | "cell"; kind: "damage" | "heal"; effect?: SkillEffect }>;
export type BattleUnit = Readonly<{ id: string; team: Team; visibility: "revealed" | "hidden"; cell: Cell; hp: number; maxHp: number; attack: number; defense: number; move: number; initiative: number; disabled: boolean; skills: readonly Skill[]; statuses: readonly Status[] }>;
export type Objective = Readonly<{ id: string; cell: Cell; durability: number; completed: boolean; key: boolean }>;
export type BattleBoard = Readonly<{ width: number; height: number; blockedCells: readonly Cell[]; hazardCells: readonly Cell[]; coverCells: readonly Cell[]; hazardDamage: number }>;
export type BattleState = Readonly<{ battleId: string; contentVersion: string; revision: number; round: number; turnIndex: number; turnOrder: readonly string[]; phase: BattlePhase; units: readonly BattleUnit[]; board: BattleBoard; objectives: readonly Objective[]; rngState: number; maxRounds: number; failureConditions: Readonly<{ keyObjectiveDestroyed: boolean }> }>;
export type MainAction =
  | Readonly<{ type: "attack"; targetId: string }>
  | Readonly<{ type: "cast"; skillId: string; targetId?: string; targetCell?: Cell }>
  | Readonly<{ type: "interact"; targetId: string }>
  | Readonly<{ type: "guard" }>
  | Readonly<{ type: "wait" }>;
export type TurnCommand = Readonly<{ actorId: string; expectedRevision: number; movePath?: readonly Cell[]; action: MainAction }>;
export type BattleErrorCode = "INVALID_COMMAND"|"UNKNOWN_FIELD"|"EXPECTED_REVISION_MISMATCH"|"BATTLE_COMPLETE"|"NOT_ACTIVE_ACTOR"|"ACTOR_DISABLED"|"INVALID_MOVE_PATH"|"MOVE_TOO_FAR"|"MOVE_BLOCKED"|"INVALID_TARGET"|"TARGET_OUT_OF_RANGE"|"SKILL_NOT_FOUND"|"SKILL_ON_COOLDOWN"|"SKILL_TARGET_SHAPE"|"INTERACTION_INVALID";
export type CommandError = Readonly<{ code: BattleErrorCode; path: string; message: string }>;
export type CommandValidation = Readonly<{ accepted: true; command: TurnCommand }>|Readonly<{ accepted: false; errors: readonly CommandError[] }>;
export type BattleEventPayload = Readonly<Record<string, string|number|boolean|Cell>>;
export type BattleEvent = Readonly<{ protocolVersion: 1; seq: number; stateRevision: number; type: "moved"|"interacted"|"damaged"|"healed"|"status_added"|"status_removed"|"cooldown_changed"|"objective_progressed"|"unit_disabled"|"turn_advanced"|"battle_finished"; payload: BattleEventPayload }>;
export type ReducedBattle = Readonly<{ state: BattleState; events: readonly BattleEvent[] }>;
export type CommandResolution = Readonly<{ accepted: true; command: TurnCommand; state: BattleState; events: readonly BattleEvent[] }>|Readonly<{ accepted: false; errors: readonly CommandError[]; state: BattleState }>;
export type WorldUnit = Readonly<{ id: string; team: Team; cell: Cell; hp: number; maxHp: number; disabled: boolean; statuses: readonly Status[]; move?: number; attack?: number; defense?: number; skills?: readonly Readonly<Pick<Skill,"id"|"range"|"power"|"target"|"kind">>[] }>;
export type WorldView = Readonly<{ battleId: string; contentVersion: string; revision: number; round: number; activeUnitId: string; board: Readonly<Pick<BattleBoard,"width"|"height"|"blockedCells"|"hazardCells"|"coverCells">>; objectives: readonly Readonly<Pick<Objective,"id"|"cell"|"durability"|"completed">>[]; units: readonly WorldUnit[] }>;
export function xorshift32(state: number): Readonly<{ value: number; nextState: number }> { let value=state>>>0; value^=value<<13; value^=value>>>17; value^=value<<5; value>>>=0; return { value, nextState:value }; }
\`\`\`

\`\`\`ts
// 固定公共签名
export function validateTurnCommand(state: Readonly<BattleState>, input: unknown): CommandValidation;
export function reduceBattle(state: Readonly<BattleState>, command: TurnCommand): ReducedBattle;
export function resolveTurn(state: Readonly<BattleState>, input: unknown): CommandResolution;
export function projectWorldView(state: Readonly<BattleState>): WorldView;
export function canonicalSha256(value: unknown): Promise<string>;
export type ReplayMetadata = Readonly<{ engineVersion: string; contentVersion: string; runnerProtocolVersion: 1; questId: string; battleId: string; seed: string }>;
export type ReplayStep = Readonly<{ seq: number; round: number; turnIndex: number; stateRevision: number; actorId: string; command: TurnCommand; rngBefore: number; rngAfter: number; events: readonly BattleEvent[]; eventsHash: string; stateHash: string }>;
export type Replay = Readonly<{ replayVersion: 1; metadata: ReplayMetadata; initialState: BattleState; initialStateHash: string; steps: readonly ReplayStep[]; outcome: BattlePhase; finalStateHash: string }>;
export type ReplayMismatch = Readonly<{ step: number; field: "replayVersion"|"engineVersion"|"contentVersion"|"runnerProtocolVersion"|"initialStateHash"|"command"|"rngBefore"|"rngAfter"|"eventsHash"|"stateHash"|"outcome"|"finalStateHash"; expected: string|number|BattlePhase; actual: string|number|BattlePhase; engineVersion: string; contentVersion: string; runnerProtocolVersion: number }>;
export type ReplayVerification = Readonly<{ verified: true; finalStateHash: string }>|Readonly<{ verified: false; mismatch: ReplayMismatch }>;
export function createReplay(metadata: ReplayMetadata, initialState: BattleState): Promise<Replay>;
export function recordAcceptedTurn(replay: Replay, before: BattleState, resolution: Extract<CommandResolution,{accepted:true}>): Promise<Replay>;
export function verifyReplay(replay: Replay): Promise<ReplayVerification>;
\`\`\`

### Task 1: 创建严格工程、类型和固定夹具

**Files:**
- Create: \`rpg/package.json\`, \`rpg/package-lock.json\`, \`rpg/tsconfig.json\`, \`rpg/vite.config.ts\`, \`rpg/index.html\`, \`rpg/src/main.ts\`
- Create: \`rpg/src/game/combat/types.ts\`, \`rpg/src/game/combat/types.test.ts\`, \`rpg/src/game/testing/fixture.ts\`

**Interfaces:** 产出本计划全部固定类型、\`xorshift32\`、\`createFixtureState(): BattleState\` 和 \`fixtureCommands: readonly TurnCommand[]\`。

- [ ] **Step 1: 写失败测试**
\`\`\`ts
import { describe, expect, it } from "vitest";
import { createFixtureState } from "../testing/fixture";
import { xorshift32 } from "./types";
describe("types", () => {
  it("uses stable unsigned rng and fixture skills", () => {
    const state=createFixtureState();
    expect(xorshift32(2463534242)).toEqual({value:723471715,nextState:723471715});
    expect(state.units.find((unit)=>unit.id==="scout")?.skills.map((skill)=>skill.id)).toEqual(["spark","mend"]);
    expect(Number.isInteger(state.rngState)).toBe(true);
  });
});
\`\`\`

- [ ] **Step 2: 确认失败**
Run: \`npm --prefix rpg test -- src/game/combat/types.test.ts\`
Expected: FAIL，类型和 fixture 模块不存在。

- [ ] **Step 3: 写工程、类型和 fixture**
\`\`\`json
{"name":"python-rpg","private":true,"version":"0.1.0","type":"module","scripts":{"dev":"vite","build":"tsc --noEmit && vite build","test":"vitest run"},"dependencies":{"canonicalize":"3.0.0"},"devDependencies":{"@playwright/test":"1.62.1","jsdom":"30.0.1","typescript":"7.0.2","vite":"8.2.1","vitest":"4.1.10"}}
\`\`\`
\`\`\`json
{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","strict":true,"noUnusedLocals":true,"noUnusedParameters":true,"noFallthroughCasesInSwitch":true,"noEmit":true,"lib":["ES2022","DOM","DOM.Iterable"],"types":["vitest/globals"]},"include":["src","vite.config.ts"]}
\`\`\`
\`\`\`ts
import { defineConfig } from "vitest/config";
export default defineConfig({server:{host:"127.0.0.1",port:5174},test:{environment:"jsdom",exclude:["e2e/**","node_modules/**"],globals:true}});
\`\`\`
分别写入 package、tsconfig、vite 配置；index.html 为 \`<div id="app"></div><script type="module" src="/src/main.ts"></script>\`，main.ts 为 \`export {};\`；types.ts 使用前述完整声明。fixture.ts 使用如下完整数据：
\`\`\`ts
export const fixtureCommands: readonly TurnCommand[] = [
  {actorId:"scout",expectedRevision:0,movePath:[{x:1,y:0}],action:{type:"attack",targetId:"golem"}},
  {actorId:"golem",expectedRevision:1,action:{type:"wait"}},
  {actorId:"scout",expectedRevision:2,action:{type:"cast",skillId:"spark",targetId:"golem"}},
  {actorId:"golem",expectedRevision:3,action:{type:"wait"}},
  {actorId:"scout",expectedRevision:4,action:{type:"attack",targetId:"golem"}},
];
export function createFixtureState(): BattleState { return {
  battleId:"core-fixture",contentVersion:"python-slice-1",revision:0,round:1,turnIndex:0,turnOrder:["scout","golem"],phase:"in_progress",rngState:2463534242,maxRounds:4,
  board:{width:3,height:2,blockedCells:[],hazardCells:[{x:2,y:1}],coverCells:[{x:2,y:0}],hazardDamage:2},
  objectives:[{id:"relay",cell:{x:0,y:1},durability:2,completed:false,key:true}],failureConditions:{keyObjectiveDestroyed:false},
  units:[
    {id:"scout",team:"allies",visibility:"revealed",cell:{x:0,y:0},hp:10,maxHp:10,attack:4,defense:0,move:2,initiative:9,disabled:false,statuses:[],skills:[
      {id:"spark",range:2,power:2,cooldown:1,remainingCooldown:0,target:"unit",kind:"damage"},
      {id:"mend",range:1,power:3,cooldown:1,remainingCooldown:0,target:"unit",kind:"heal"}]},
    {id:"golem",team:"enemies",visibility:"revealed",cell:{x:2,y:0},hp:8,maxHp:8,attack:2,defense:1,move:1,initiative:4,disabled:false,statuses:[],skills:[{id:"smash",range:1,power:1,cooldown:2,remainingCooldown:1,target:"unit",kind:"damage"}]},
    {id:"lurker",team:"enemies",visibility:"hidden",cell:{x:2,y:1},hp:5,maxHp:5,attack:3,defense:0,move:1,initiative:1,disabled:true,statuses:[],skills:[{id:"ambush",range:1,power:3,cooldown:1,remainingCooldown:0,target:"unit",kind:"damage"}]}
  ]};}
\`\`\`
执行 \`npm --prefix rpg install --package-lock-only\` 生成锁文件。

- [ ] **Step 4: 验证**
Run: \`npm --prefix rpg run build\`
Expected: PASS。
Run: \`npm --prefix rpg test -- src/game/combat/types.test.ts\`
Expected: PASS。

- [ ] **Step 5: 提交**
\`\`\`bash
git add rpg/package.json rpg/package-lock.json rpg/tsconfig.json rpg/vite.config.ts rpg/index.html rpg/src/main.ts rpg/src/game/combat/types.ts rpg/src/game/combat/types.test.ts rpg/src/game/testing/fixture.ts
git commit -m "feat: scaffold deterministic rpg combat core"
\`\`\`

### Task 2: 严格且原子的命令校验

**Files:**
- Create: \`rpg/src/game/combat/validate-turn-command.ts\`, \`rpg/src/game/combat/validate-turn-command.test.ts\`

**Interfaces:** 产出 \`validateTurnCommand(state: Readonly<BattleState>, input: unknown): CommandValidation\`。

- [ ] **Step 1: 写失败测试**
\`\`\`ts
import { describe, expect, it } from "vitest";
import { createFixtureState } from "../testing/fixture";
import { validateTurnCommand } from "./validate-turn-command";
describe("validation", () => {
  it("accepts omitted and empty move paths", () => {
    expect(validateTurnCommand(createFixtureState(),{actorId:"scout",expectedRevision:0,action:{type:"wait"}})).toMatchObject({accepted:true});
    expect(validateTurnCommand(createFixtureState(),{actorId:"scout",expectedRevision:0,movePath:[],action:{type:"wait"}})).toMatchObject({accepted:true});
  });
  it("returns stable code and path for a cast target shape", () => {
    expect(validateTurnCommand(createFixtureState(),{actorId:"scout",expectedRevision:0,action:{type:"cast",skillId:"spark",targetId:"golem",targetCell:{x:2,y:0}}})).toEqual({accepted:false,errors:[expect.objectContaining({code:"SKILL_TARGET_SHAPE",path:"$.action"})]});
  });
  it("rejects missing, noninteger, unknown and invalid move with legal attack", () => {
    const state=createFixtureState();
    for (const input of [{expectedRevision:0,action:{type:"wait"}},{actorId:"scout",expectedRevision:0,movePath:[{x:1.5,y:0}],action:{type:"wait"}},{actorId:"scout",expectedRevision:0,action:{type:"wait"},extra:true},{actorId:"scout",expectedRevision:0,movePath:[{x:1,y:1}],action:{type:"attack",targetId:"golem"}}]) {
      expect(validateTurnCommand(state,input)).toMatchObject({accepted:false});
    }
  });
});
\`\`\`

- [ ] **Step 2: 确认失败**
Run: \`npm --prefix rpg test -- src/game/combat/validate-turn-command.test.ts\`
Expected: FAIL，校验器不存在。

- [ ] **Step 3: 写精确解析和校验**
\`\`\`ts
function hasExactKeys(value:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[]):boolean {
  const allowed=new Set([...required,...optional]);
  return required.every((key)=>Object.hasOwn(value,key)) && Object.keys(value).every((key)=>allowed.has(key));
}
function readMovePath(value:Record<string,unknown>):readonly Cell[]|CommandValidation {
  if (!Object.hasOwn(value,"movePath")) return [];
  if (!Array.isArray(value.movePath) || !value.movePath.every(isIntegerCell)) return rejected("INVALID_MOVE_PATH","$.movePath","移动路径必须是整数坐标数组");
  return value.movePath.map((cell)=>({x:cell.x,y:cell.y}));
}
\`\`\`
\`hasExactKeys(input,[\"actorId\",\"expectedRevision\",\"action\"],[\"movePath\"])\` 允许 movePath 缺省，出现时必须是数组，\`undefined\` 不是合法值。action 精确键分别为 attack: type/targetId，cast: type/skillId/targetId 或 type/skillId/targetCell，interact: type/targetId，guard/wait: type。校验依次检查 battle phase、revision、当前 actor、disabled、路径、移动终点动作距离、冷却和目标。任何错误返回新 \`CommandError\`，不调用归约器。

- [ ] **Step 4: 验证**
Run: \`npm --prefix rpg run build\`
Expected: PASS。
Run: \`npm --prefix rpg test -- src/game/combat/validate-turn-command.test.ts\`
Expected: PASS。

- [ ] **Step 5: 提交**
\`\`\`bash
git add rpg/src/game/combat/validate-turn-command.ts rpg/src/game/combat/validate-turn-command.test.ts
git commit -m "feat: validate atomic combat turn commands"
\`\`\`

### Task 3: 归约规则、事件和公共入口

**Files:**
- Create: \`rpg/src/game/combat/reduce-battle.ts\`, \`rpg/src/game/combat/resolve-turn.ts\`, \`rpg/src/game/combat/reduce-battle.test.ts\`

**Interfaces:** 产出 \`reduceBattle(state, command): ReducedBattle\` 与 \`resolveTurn(state, input): CommandResolution\`。

- [ ] **Step 1: 写失败测试**
\`\`\`ts
import { describe,expect,it } from "vitest";
import { createFixtureState } from "../testing/fixture";
import { reduceBattle } from "./reduce-battle";
import { resolveTurn } from "./resolve-turn";
import type { BattleEvent, BattleState, TurnCommand } from "./types";
describe("reducer",()=> {
  it("uses target cover and exact attack events",()=>{const r=reduceBattle(createFixtureState(),{actorId:"scout",expectedRevision:0,movePath:[{x:1,y:0}],action:{type:"attack",targetId:"golem"}});expect(r.events).toMatchObject([{type:"moved",payload:{actorId:"scout",from:{x:0,y:0},to:{x:1,y:0}}},{type:"damaged",payload:{sourceId:"scout",targetId:"golem",amount:2,hpAfter:6,coverBonus:1}},{type:"turn_advanced",payload:{round:1,turnIndex:1,activeUnitId:"golem"}}]);});
  it("rejects an invalid move atomically",()=>{const s=createFixtureState(),r=resolveTurn(s,{actorId:"scout",expectedRevision:0,movePath:[{x:1,y:1}],action:{type:"attack",targetId:"golem"}});expect(r).toEqual(expect.objectContaining({accepted:false,state:s}));expect(s).toMatchObject({revision:0,rngState:2463534242});});
  it("sorts two statuses and removes guard before the next accepted action",()=>{const s={...createFixtureState(),units:createFixtureState().units.map((u)=>u.id==="scout"?{...u,statuses:[{id:"zeta",remainingTurns:1,defenseBonus:1},{id:"alpha",remainingTurns:1,defenseBonus:1}]}:u)},r=reduceBattle(s,{actorId:"scout",expectedRevision:0,action:{type:"wait"}});expect(r.events.slice(0,2).map((e)=>e.payload.statusId)).toEqual(["alpha","zeta"]);const guarded=reduceBattle(createFixtureState(),{actorId:"scout",expectedRevision:0,action:{type:"guard"}}).state,again={...guarded,revision:2,turnIndex:0,round:2};expect(reduceBattle(again,{actorId:"scout",expectedRevision:2,action:{type:"wait"}}).events[0]).toMatchObject({type:"status_removed",payload:{statusId:"guarded"}});});
  it.each<Array<{name:string;state:(s:BattleState)=>BattleState;command:TurnCommand;type:BattleEvent["type"];payload:Record<string,unknown>}>>([{name:"hazard",state:(s:BattleState)=>({...s,units:s.units.map((u)=>u.id==="scout"?{...u,cell:{x:2,y:1}}:u)}),command:{actorId:"scout",expectedRevision:0,action:{type:"wait"}},type:"damaged",payload:{sourceId:"hazard",targetId:"scout",amount:2,hpAfter:8,coverBonus:0}},{name:"heal",state:(s:BattleState)=>({...s,units:s.units.map((u)=>u.id==="scout"?{...u,hp:5}:u)}),command:{actorId:"scout",expectedRevision:0,action:{type:"cast",skillId:"mend",targetId:"scout"}},type:"healed",payload:{sourceId:"scout",targetId:"scout",amount:3,hpAfter:8}},{name:"interact",state:(s:BattleState)=>s,command:{actorId:"scout",expectedRevision:0,action:{type:"interact",targetId:"relay"}},type:"objective_progressed",payload:{targetId:"relay",durabilityAfter:1,completed:false}}])("emits $name",({state,command,type,payload})=>{const r=reduceBattle(state(createFixtureState()),command);expect(r.events).toContainEqual(expect.objectContaining({type,payload:expect.objectContaining(payload)}));});
  it("consumes rng once and sorts effect status ids",()=>{const s={...createFixtureState(),units:createFixtureState().units.map((u)=>u.id==="scout"?{...u,skills:[{...u.skills[0]!,effect:{statusId:"zeta",duration:1,defenseBonus:0,chancePermille:1000}},{...u.skills[0]!,id:"alpha",effect:{statusId:"alpha",duration:1,defenseBonus:0,chancePermille:1000}}]}:u)};const first=reduceBattle(s,{actorId:"scout",expectedRevision:0,action:{type:"cast",skillId:"alpha",targetId:"golem"}});expect(first.state.rngState).toBe(723471715);expect(first.state.units.find((u)=>u.id==="golem")?.statuses.map((x)=>x.id)).toEqual(["alpha"]);});
  it("decrements cooldown and emits battle_finished with won",()=>{const s=createFixtureState(),hit=reduceBattle(s,{actorId:"scout",expectedRevision:0,action:{type:"cast",skillId:"spark",targetId:"golem"}}).state,again={...hit,revision:2,turnIndex:0,round:2};const cooled=reduceBattle(again,{actorId:"scout",expectedRevision:2,action:{type:"wait"}});expect(cooled.events).toContainEqual(expect.objectContaining({type:"cooldown_changed",payload:{unitId:"scout",skillId:"spark",remainingCooldown:0}}));const winning={...createFixtureState(),units:createFixtureState().units.map((u)=>u.id==="golem"?{...u,hp:2}:u)};expect(reduceBattle(winning,{actorId:"scout",expectedRevision:0,action:{type:"attack",targetId:"golem"}}).events).toContainEqual(expect.objectContaining({type:"battle_finished",payload:{outcome:"won"}}));});
});
\`\`\`

- [ ] **Step 2: 确认失败**
Run: \`npm --prefix rpg test -- src/game/combat/reduce-battle.test.ts\`
Expected: FAIL，归约器不存在。

- [ ] **Step 3: 写完整规则迁移**

以复制出的 units/objectives/rngState 创建状态，禁止改变输入。完整事件顺序固定为：行动者在其**下一次已接受命令开始时**按 status.id 字典序发出 status_removed；随后 moved；attack/cast 的 damaged 或 healed；interact 的 interacted 与 objective_progressed；guard 的 status_added；行动者位于 hazard 的 damaged；cooldown_changed；unit_disabled；battle_finished；turn_advanced。guard 的 status_removed 因而必定先于该命令的 move/action，hazard 仍在本回合 action 后。payload 固定如下：

\`\`\`ts
const moved={actorId:actor.id,from:oldCell,to:newCell};
const damaged={sourceId:actor.id,targetId:target.id,amount,hpAfter,coverBonus};
const healed={sourceId:actor.id,targetId:target.id,amount,hpAfter};
const interacted={actorId:actor.id,targetId:objective.id,durabilityAfter};
const objectiveProgressed={targetId:objective.id,durabilityAfter,completed:durabilityAfter===0};
const statusAdded={unitId:actor.id,statusId:"guarded",remainingTurns:1,defenseBonus:2};
const statusRemoved={unitId:actor.id,statusId:status.id};
const cooldownChanged={unitId:actor.id,skillId:skill.id,remainingCooldown};
const turnAdvanced={round:nextRound,turnIndex:nextTurnIndex,activeUnitId:nextActorId};
const battleFinished={outcome:phase};
\`\`\`

目标位于 coverCells 时 \`coverBonus=1\`。attack 的 power=0；spark 对 golem 的伤害 \`max(1,4+2-1-1)=4\`；mend 以 \`min(maxHp,hp+power)\` 治疗。guard 添加 guarded(1,2)，在该单位的下一次已接受回合开始前移除。interact 仅相邻目标，durability 减 1。hazard 在主动作后造成 board.hazardDamage。每个效果按 status.id 排序；effect 有 chancePermille 时调用一次 xorshift32。cast 设置 cooldown，非刚施放技能在其拥有者后续回合结束时 remainingCooldown 减一。结算后无敌人获胜；无友军、关键目标 durability 为 0 且 keyObjectiveDestroyed 为 true、或 nextRound>maxRounds 则失败。

\`\`\`ts
export function resolveTurn(state:Readonly<BattleState>,input:unknown):CommandResolution {
  const validation=validateTurnCommand(state,input);
  if(!validation.accepted)return {accepted:false,errors:validation.errors,state};
  const reduced=reduceBattle(state,validation.command);
  return {accepted:true,command:validation.command,state:reduced.state,events:reduced.events};
}
\`\`\`

- [ ] **Step 4: 验证**
Run: \`npm --prefix rpg run build\`
Expected: PASS。
Run: \`npm --prefix rpg test -- src/game/combat/reduce-battle.test.ts\`
Expected: PASS，包含 guard/interact/heal/hazard/cooldown/status/outcome/rng 的表格断言。

- [ ] **Step 5: 提交**
\`\`\`bash
git add rpg/src/game/combat/reduce-battle.ts rpg/src/game/combat/reduce-battle.test.ts rpg/src/game/combat/resolve-turn.ts
git commit -m "feat: reduce deterministic combat turns"
\`\`\`

### Task 4: WorldView 白名单

**Files:**
- Create: \`rpg/src/game/world/project-world-view.ts\`, \`rpg/src/game/world/project-world-view.test.ts\`

**Interfaces:** 产出 \`projectWorldView(state: Readonly<BattleState>): WorldView\`。

- [ ] **Step 1: 写失败测试**
\`\`\`ts
import { describe,expect,it } from "vitest";import { createFixtureState } from "../testing/fixture";import { projectWorldView } from "./project-world-view";
describe("world",()=>it("is frozen, JSON-safe and filters hidden enemy fields",()=>{const s=createFixtureState(),v=projectWorldView(s),json=JSON.stringify(v),scout=v.units.find((u)=>u.id==="scout"),golem=v.units.find((u)=>u.id==="golem");expect(Object.isFrozen(v)).toBe(true);expect(()=>JSON.parse(json)).not.toThrow();expect(v.units.map((u)=>u.id)).toEqual(["scout","golem"]);expect(scout).toMatchObject({move:2,attack:4,defense:0,skills:[{id:"spark",range:2,power:2,target:"unit",kind:"damage"}]});expect(golem).toEqual({id:"golem",team:"enemies",cell:{x:2,y:0},hp:8,maxHp:8,disabled:false,statuses:[]});expect(json).not.toContain("lurker");expect(json).not.toContain("smash");expect(json).not.toContain("remainingCooldown");expect(json).not.toContain("rngState");expect(json).not.toContain("failureConditions");expect(scout?.cell).not.toBe(s.units[0]?.cell);}));
\`\`\`

- [ ] **Step 2: 确认失败**
Run: \`npm --prefix rpg test -- src/game/world/project-world-view.test.ts\`
Expected: FAIL，投影模块不存在。

- [ ] **Step 3: 写显式投影**
\`\`\`ts
import type { BattleState, BattleUnit, Cell, WorldUnit, WorldView } from "../combat/types";
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);for(const nested of Object.values(value as Record<string,unknown>))deepFreeze(nested);}return value;}
const copyCell=(cell:Cell):Cell=>({x:cell.x,y:cell.y});
function projectUnit(unit:BattleUnit):WorldUnit{return unit.team==="allies"?{id:unit.id,team:unit.team,cell:copyCell(unit.cell),hp:unit.hp,maxHp:unit.maxHp,disabled:unit.disabled,statuses:unit.statuses.map((status)=>({...status})),move:unit.move,attack:unit.attack,defense:unit.defense,skills:unit.skills.map(({id,range,power,target,kind})=>({id,range,power,target,kind}))}:{id:unit.id,team:unit.team,cell:copyCell(unit.cell),hp:unit.hp,maxHp:unit.maxHp,disabled:unit.disabled,statuses:unit.statuses.map((status)=>({...status}))};}
export function projectWorldView(state:Readonly<BattleState>):WorldView {
  const activeUnitId=state.turnOrder[state.turnIndex]!;
  return deepFreeze({battleId:state.battleId,contentVersion:state.contentVersion,revision:state.revision,round:state.round,activeUnitId,
    board:{width:state.board.width,height:state.board.height,blockedCells:state.board.blockedCells.map(copyCell),hazardCells:state.board.hazardCells.map(copyCell),coverCells:state.board.coverCells.map(copyCell)},
    objectives:state.objectives.map(({id,cell,durability,completed})=>({id,cell:copyCell(cell),durability,completed})),
    units:state.units.filter((unit)=>unit.team==="allies"||unit.visibility==="revealed").map(projectUnit)}); }
\`\`\`
\`projectUnit\` 对 allies 映射 id/team/cell/hp/maxHp/disabled/statuses/move/attack/defense/技能 id-range-power-target-kind；对 enemies 仅映射 id/team/cell/hp/maxHp/disabled/statuses，绝不映射 visibility、skills 或 remainingCooldown。hidden enemies 在 map 前过滤。

- [ ] **Step 4: 验证**
Run: \`npm --prefix rpg run build\`
Expected: PASS。
Run: \`npm --prefix rpg test -- src/game/world/project-world-view.test.ts\`
Expected: PASS。

- [ ] **Step 5: 提交**
\`\`\`bash
git add rpg/src/game/world/project-world-view.ts rpg/src/game/world/project-world-view.test.ts
git commit -m "feat: project restricted combat world view"
\`\`\`

### Task 5: JCS 哈希与 Replay

**Files:**
- Create: \`rpg/src/game/replay/canonical-hash.ts\`, \`rpg/src/game/replay/canonical-hash.test.ts\`, \`rpg/src/game/replay/replay.ts\`, \`rpg/src/game/replay/replay.test.ts\`

**Interfaces:** 产出固定 ReplayMetadata、ReplayStep、Replay、ReplayVerification 和三个 public 函数。

- [ ] **Step 1: 写失败测试**
\`\`\`ts
import { describe,expect,it } from "vitest";
import { canonicalSha256 } from "./canonical-hash";
import { createReplay,recordAcceptedTurn,verifyReplay } from "./replay";
import { createFixtureState,fixtureCommands } from "../testing/fixture";
import { resolveTurn } from "../combat/resolve-turn";
describe("replay",()=> {
  it("uses JCS independent of object key order",async()=>expect(await canonicalSha256({b:2,a:1})).toBe(await canonicalSha256({a:1,b:2})));
  it("detects version, first-step and middle-step deviations",async()=>{let state=createFixtureState(),replay=await createReplay({engineVersion:"0.1.0",contentVersion:"python-slice-1",runnerProtocolVersion:1,questId:"core-fixture",battleId:"core-fixture",seed:"2463534242"},state);for(const command of fixtureCommands){const r=resolveTurn(state,command);if(!r.accepted)throw new Error("fixture rejected");replay=await recordAcceptedTurn(replay,state,r);state=r.state;}
    await expect(verifyReplay({...replay,replayVersion:2 as 1})).resolves.toMatchObject({verified:false,mismatch:{field:"replayVersion",step:0}});
    await expect(verifyReplay({...replay,metadata:{...replay.metadata,engineVersion:"0.2.0"}})).resolves.toMatchObject({verified:false,mismatch:{field:"engineVersion",step:0}});
    await expect(verifyReplay({...replay,metadata:{...replay.metadata,contentVersion:"python-slice-2"}})).resolves.toMatchObject({verified:false,mismatch:{field:"contentVersion",step:0}});
    await expect(verifyReplay({...replay,metadata:{...replay.metadata,runnerProtocolVersion:2 as 1}})).resolves.toMatchObject({verified:false,mismatch:{field:"runnerProtocolVersion",step:0}});
    await expect(verifyReplay({...replay,initialStateHash:"sha256:initial"})).resolves.toMatchObject({verified:false,mismatch:{field:"initialStateHash",step:0,expected:"sha256:initial"}});
    await expect(verifyReplay({...replay,steps:[{...replay.steps[0]!,rngAfter:7},...replay.steps.slice(1)]})).resolves.toMatchObject({verified:false,mismatch:{field:"rngAfter",step:1,expected:7}});
    await expect(verifyReplay({...replay,steps:[{...replay.steps[0]!,stateHash:"sha256:first"},...replay.steps.slice(1)]})).resolves.toMatchObject({verified:false,mismatch:{field:"stateHash",step:1,expected:"sha256:first"}});
    await expect(verifyReplay({...replay,steps:[...replay.steps.slice(0,2),{...replay.steps[2]!,eventsHash:"sha256:middle"},...replay.steps.slice(3)]})).resolves.toMatchObject({verified:false,mismatch:{field:"eventsHash",step:3,expected:"sha256:middle"}});
    await expect(verifyReplay({...replay,outcome:"lost"})).resolves.toMatchObject({verified:false,mismatch:{field:"outcome",step:5,expected:"lost"}});
    await expect(verifyReplay({...replay,finalStateHash:"sha256:final"})).resolves.toMatchObject({verified:false,mismatch:{field:"finalStateHash",step:5,expected:"sha256:final"}});
  });
});
\`\`\`

- [ ] **Step 2: 确认失败**
Run: \`npm --prefix rpg test -- src/game/replay/canonical-hash.test.ts src/game/replay/replay.test.ts\`
Expected: FAIL，哈希与 replay 模块不存在。

- [ ] **Step 3: 写完整哈希和 replay 核心**
**`rpg/src/game/replay/canonical-hash.ts`**
\`\`\`ts
import canonicalize from "canonicalize";
export async function canonicalSha256(value:unknown):Promise<string>{const text=canonicalize(value);if(text===undefined)throw new TypeError("无法规范化哈希输入");const digest=await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return "sha256:"+[...new Uint8Array(digest)].map((b)=>b.toString(16).padStart(2,"0")).join("");}
\`\`\`

**`rpg/src/game/replay/replay.ts`**
\`\`\`ts
import { canonicalSha256 } from "./canonical-hash";
import type { BattleState, CommandResolution, Replay, ReplayMetadata, ReplayMismatch, ReplayStep, ReplayVerification } from "../combat/types";
import { resolveTurn } from "../combat/resolve-turn";
const ENGINE_VERSION="0.1.0", CONTENT_VERSION="python-slice-1", RUNNER_PROTOCOL_VERSION=1;
function mismatch(step:number,field:ReplayMismatch["field"],expected:ReplayMismatch["expected"],actual:ReplayMismatch["actual"],replay:Replay):ReplayVerification{return {verified:false,mismatch:{step,field,expected,actual,engineVersion:replay.metadata.engineVersion,contentVersion:replay.metadata.contentVersion,runnerProtocolVersion:replay.metadata.runnerProtocolVersion}};}
async function finalMismatch(replay:Replay,state:BattleState):Promise<ReplayVerification>{if(state.phase!==replay.outcome)return mismatch(replay.steps.length,"outcome",replay.outcome,state.phase,replay);return mismatch(replay.steps.length,"finalStateHash",replay.finalStateHash,await canonicalSha256(state),replay);}
export async function createReplay(metadata:ReplayMetadata,initialState:BattleState):Promise<Replay>{const initialStateHash=await canonicalSha256(initialState);return {replayVersion:1,metadata,initialState,initialStateHash,steps:[],outcome:initialState.phase,finalStateHash:initialStateHash};}
export async function recordAcceptedTurn(replay:Replay,before:BattleState,resolution:Extract<CommandResolution,{accepted:true}>):Promise<Replay>{const step:ReplayStep={seq:replay.steps.length+1,round:before.round,turnIndex:before.turnIndex,stateRevision:before.revision,actorId:resolution.command.actorId,command:resolution.command,rngBefore:before.rngState,rngAfter:resolution.state.rngState,events:resolution.events,eventsHash:await canonicalSha256(resolution.events),stateHash:await canonicalSha256(resolution.state)};return {...replay,steps:[...replay.steps,step],outcome:resolution.state.phase,finalStateHash:step.stateHash};}
export async function verifyReplay(replay:Replay):Promise<ReplayVerification>{if(replay.replayVersion!==1)return mismatch(0,"replayVersion",1,replay.replayVersion,replay);if(replay.metadata.engineVersion!==ENGINE_VERSION)return mismatch(0,"engineVersion",ENGINE_VERSION,replay.metadata.engineVersion,replay);if(replay.metadata.contentVersion!==CONTENT_VERSION)return mismatch(0,"contentVersion",CONTENT_VERSION,replay.metadata.contentVersion,replay);if(replay.metadata.runnerProtocolVersion!==RUNNER_PROTOCOL_VERSION)return mismatch(0,"runnerProtocolVersion",RUNNER_PROTOCOL_VERSION,replay.metadata.runnerProtocolVersion,replay);const initial=await canonicalSha256(replay.initialState);if(initial!==replay.initialStateHash)return mismatch(0,"initialStateHash",replay.initialStateHash,initial,replay);let state=replay.initialState;for(const step of replay.steps){const actualStep=step.seq;const result=resolveTurn(state,step.command);if(!result.accepted)return mismatch(actualStep,"command","accepted","rejected",replay);const checks:[ReplayMismatch["field"],string|number,string|number][]=[["rngBefore",step.rngBefore,state.rngState],["rngAfter",step.rngAfter,result.state.rngState],["eventsHash",step.eventsHash,await canonicalSha256(result.events)],["stateHash",step.stateHash,await canonicalSha256(result.state)]];for(const [field,expected,actual] of checks)if(expected!==actual)return mismatch(actualStep,field,expected,actual,replay);state=result.state;}return state.phase===replay.outcome&&await canonicalSha256(state)===replay.finalStateHash?{verified:true,finalStateHash:replay.finalStateHash}:await finalMismatch(replay,state);}
\`\`\`
\`mismatch\` 与 \`finalMismatch\` 只构造 \`ReplayVerification\`，包含 metadata 的 engineVersion/contentVersion。该模块只导入 combat types、resolveTurn 和 canonical hash。

- [ ] **Step 4: 验证**
Run: \`npm --prefix rpg run build\`
Expected: PASS。
Run: \`npm --prefix rpg test -- src/game/replay/canonical-hash.test.ts src/game/replay/replay.test.ts\`
Expected: PASS，含完整重放、版本不兼容、首步及中段偏差。

- [ ] **Step 5: 提交**
\`\`\`bash
git add rpg/src/game/replay/canonical-hash.ts rpg/src/game/replay/canonical-hash.test.ts rpg/src/game/replay/replay.ts rpg/src/game/replay/replay.test.ts
git commit -m "feat: record and verify canonical combat replays"
\`\`\`

### Task 6: 固定五步无界面端到端验收

**Files:**
- Create: \`rpg/src/game/combat/combat-core.e2e.test.ts\`

**Interfaces:** 必须经 \`projectWorldView\`、\`resolveTurn\`、\`createReplay\`、\`recordAcceptedTurn\`、\`verifyReplay\` 完成验收。

- [ ] **Step 1: 写失败验收**
\`\`\`ts
import { describe,expect,it } from "vitest";
import { createFixtureState,fixtureCommands } from "../testing/fixture";
import { projectWorldView } from "../world/project-world-view";
import { createReplay,recordAcceptedTurn,verifyReplay } from "../replay/replay";
import { resolveTurn } from "./resolve-turn";
describe("core fixture",()=>it("replays five fixed commands identically without Python",async()=>{const run=async()=>{let state=createFixtureState(),replay=await createReplay({engineVersion:"0.1.0",contentVersion:"python-slice-1",runnerProtocolVersion:1,questId:"core-fixture",battleId:"core-fixture",seed:"2463534242"},state);const expected=[{revision:1,types:["moved","damaged","turn_advanced"],hp:6},{revision:2,types:["turn_advanced"],hp:6},{revision:3,types:["damaged","cooldown_changed","turn_advanced"],hp:2},{revision:4,types:["turn_advanced"],hp:2},{revision:5,types:["damaged","cooldown_changed","unit_disabled","battle_finished","turn_advanced"],hp:0}];for(const [index,command] of fixtureCommands.entries()){const view=projectWorldView(state),json=JSON.stringify(view);expect(Object.isFrozen(view)).toBe(true);expect(()=>JSON.parse(json)).not.toThrow();expect(json).not.toContain("rngState");expect(json).not.toContain("remainingCooldown");expect(json).not.toContain("lurker");expect(command.expectedRevision).toBe(view.revision);const result=resolveTurn(state,command);expect(result.accepted).toBe(true);if(!result.accepted)throw new Error("fixture command rejected");expect(result.state.revision).toBe(expected[index]!.revision);expect(result.events.map((e)=>e.type)).toEqual(expected[index]!.types);expect(result.state.units.find((u)=>u.id==="golem")?.hp).toBe(expected[index]!.hp);for(const [eventIndex,event] of result.events.entries()){expect(event.seq).toBe(eventIndex+1);expect(event.stateRevision).toBe(state.revision+1);}replay=await recordAcceptedTurn(replay,state,result);const step=replay.steps.at(-1)!;expect(step.seq).toBe(index+1);expect(step.stateRevision).toBe(index);expect(step.rngBefore).toBe(2463534242);expect(step.rngAfter).toBe(2463534242);expect(step.eventsHash).toMatch(/^sha256:[0-9a-f]{64}$/);expect(step.stateHash).toMatch(/^sha256:[0-9a-f]{64}$/);state=result.state;}return {state,replay,verification:await verifyReplay(replay)};};const a=await run(),b=await run();expect(a.state.phase).toBe("won");expect(a.verification).toMatchObject({verified:true});expect(a.replay.steps).toHaveLength(5);for(const [index,step] of a.replay.steps.entries()){const same=b.replay.steps[index]!;expect({seq:step.seq,stateRevision:step.stateRevision,rngBefore:step.rngBefore,rngAfter:step.rngAfter,eventsHash:step.eventsHash,stateHash:step.stateHash}).toEqual({seq:same.seq,stateRevision:same.stateRevision,rngBefore:same.rngBefore,rngAfter:same.rngAfter,eventsHash:same.eventsHash,stateHash:same.stateHash});}expect(a.replay.finalStateHash).toBe(b.replay.finalStateHash);}));
\`\`\`

- [ ] **Step 2: 确认失败**
Run: \`npm --prefix rpg test -- src/game/combat/combat-core.e2e.test.ts\`
Expected: FAIL，五步事件顺序和最终胜利尚未齐备。

- [ ] **Step 3: 固定夹具期待**

五步命令和初始数值已经在 Task 1 固定，不得在此任务修改数值。每步 rng 均为 2463534242（fixture 无 chancePermille effect）；每步 eventsHash 与 stateHash 由 recordAcceptedTurn 的 \`canonicalSha256\` 写入，端到端测试必须断言两次运行的五个 \`rngBefore/rngAfter/eventsHash/stateHash\` 完全相等。step 1 为 move 0,0→1,0、伤害 2、golem hp 6；step 3 为 spark 伤害 4、golem hp 2、spark cooldown 1；step 5 普攻伤害 2、golem hp 0、spark cooldown 0、phase won。最终事件 stateRevision 全为该步输入 revision+1，seq 连续从 1。

- [ ] **Step 4: 完整验证**
Run: \`npm --prefix rpg run build\`
Expected: PASS。
Run: \`npm --prefix rpg test\`
Expected: PASS，固定 fixture 两次得到同一五步重放与最终状态哈希。

- [ ] **Step 5: 提交**
\`\`\`bash
git add rpg/src/game/testing/fixture.ts rpg/src/game/combat/combat-core.e2e.test.ts
git commit -m "test: prove deterministic combat replay fixture"
\`\`\`

## 实施后自审

- [ ] Run: \`git diff --check -- docs/superpowers/plans/2026-08-10-python-rpg-combat-core.md\`。Expected: 无空白错误。
- [ ] Run: \`Select-String -Path "docs/superpowers/plans/2026-08-10-python-rpg-combat-core.md" -Pattern "T[O]DO|T[B]D|implement\s+later|similar\s+to|appropriate\s+error\s+handling"\`。Expected: 无匹配。
- [ ] 用 TypeScript AST 或文本精确比较 Interfaces 章节与各 Task 的四个战斗入口、三个 replay 入口签名。Expected: 无缺失或不同参数顺序。
- [ ] Run: \`git diff --name-only -- docs/superpowers/plans/2026-08-10-python-rpg-combat-core.md\`。Expected: 仅本计划文件。
