import type { GameSnapshot } from "./app-controller";
import type { GameController, WorldBattleSnapshot } from "./controller-types";
import type { BattleState, BattleUnit } from "../game/combat/types";
import { getLevel } from "../game/content/levels";
import type { LevelDefinition } from "../game/content/types";

export type BattleAppSnapshot = GameSnapshot | WorldBattleSnapshot;
export type BattleSettlement = Readonly<{ kind: "failed" | "victory" | "complete"; messages: readonly string[] }>;

const UNAVAILABLE_HINT = "启动 Runner 后刷新页面";

const BATTLE_MARKUP = `
  <div class="panel-heading battle-heading">
    <div><p>蓝图战场</p><h2 id="battle-heading"></h2></div>
    <div class="battle-state"><span>遭遇 <strong data-testid="battle-phase"></strong></span><span>修订 <strong data-testid="battle-revision"></strong></span></div>
  </div>
  <section class="battle-directive" aria-labelledby="directive-heading">
    <p class="directive-kicker">先完成这些</p>
    <h3 id="directive-heading" data-testid="battle-objective-summary"></h3>
    <p class="battle-action-hint" data-testid="battle-action-hint"></p>
    <p class="battle-constraint" data-testid="battle-constraint"></p>
  </section>
  <div class="battle-legend" aria-label="战场图例">
    <span class="legend-item"><i class="legend-swatch legend-scout" aria-hidden="true"></i>主角 scout</span>
    <span class="legend-item"><i class="legend-swatch legend-enemy" aria-hidden="true"></i>敌人</span>
    <span class="legend-item"><i class="legend-swatch legend-key" aria-hidden="true"></i>关键目标</span>
    <span class="legend-item"><i class="legend-swatch legend-activate" aria-hidden="true"></i>可激活目标</span>
    <span class="legend-item"><i class="legend-swatch legend-hazard" aria-hidden="true"></i>危险格</span>
    <span class="legend-item"><i class="legend-swatch legend-blocked" aria-hidden="true"></i>阻挡格</span>
  </div>
  <div class="battlefield" role="grid" aria-label="Python 沼泽战场"></div>
`;

export function renderBattleApp(
  container: HTMLElement,
  briefing: HTMLElement,
  apiHelp: HTMLDetailsElement,
  snapshot: BattleAppSnapshot,
): BattleSettlement | undefined {
  const level = getLevel(levelId(snapshot));
  const settlement = settlementFor(snapshot, level);
  container.className = "battle-panel";
  container.setAttribute("aria-labelledby", "battle-heading");
  container.innerHTML = BATTLE_MARKUP;
  requiredElement(container, "#battle-heading").textContent = level.title;
  requiredElement(container, "[data-testid='battle-phase']").textContent = phaseLabel(snapshot.battleState.phase);
  requiredElement(container, "[data-testid='battle-revision']").textContent = String(snapshot.battleState.revision);
  renderBattlefield(requiredElement(container, ".battlefield"), snapshot.battleState);
  renderBattleDirective(requiredElement(container, ".battle-directive"), level, snapshot.battleState, settlement);
  renderBriefing(briefing, level, snapshot.battleState);
  renderApiHelp(apiHelp, level);
  return settlement;
}

export function renderBattleFeedback(
  container: HTMLElement,
  snapshot: BattleAppSnapshot,
  settlement: BattleSettlement | undefined,
  controller: GameController,
): void {
  if (settlement !== undefined) {
    renderSettlement(container, settlement, controller);
    return;
  }
  const { feedback, runnerState } = snapshot;
  const messages = runnerState === "unavailable" && !feedback.messages.includes(UNAVAILABLE_HINT)
    ? [UNAVAILABLE_HINT, ...feedback.messages]
    : feedback.messages;
  container.className = `feedback-panel feedback-${feedback.kind}`;
  container.replaceChildren();
  if (feedback.title) container.append(textElement("h2", feedback.title));
  for (const message of messages) container.append(textElement("p", message));
  if (feedback.stdout) container.append(outputElement("标准输出", feedback.stdout));
  if (feedback.stderr) container.append(outputElement("错误输出", feedback.stderr));
  if (!feedback.title && messages.length === 0) {
    container.append(textElement("p", runnerState === "connecting" ? "正在连接本地 Runner。" : "等待下一条回合指令。"));
  }
}

export function battleActiveUnitId(state: BattleState): string | undefined {
  return state.turnOrder[state.turnIndex];
}

function renderBattlefield(container: HTMLElement, state: BattleState): void {
  const activeId = battleActiveUnitId(state);
  container.replaceChildren();
  container.style.gridTemplateColumns = `repeat(${state.board.width}, minmax(0, 1fr))`;
  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) {
      const cell = document.createElement("div");
      const units = state.units.filter((unit) => unit.visibility === "revealed" && atCell(unit, x, y));
      cell.className = terrainClass(state, x, y);
      cell.dataset.cell = `${x}-${y}`;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", cellLabel(x, y, units));
      cell.innerHTML = `<span class="cell-coordinate" aria-hidden="true">${x},${y}</span>`;
      for (const objective of state.objectives.filter((item) => atCell(item, x, y))) {
        const marker = document.createElement("span");
        marker.className = `battle-objective ${objective.key ? "is-key" : "is-activate"}${objective.completed ? " is-complete" : ""}`;
        marker.textContent = `${objective.key ? "保护" : "激活"} ${objective.id} · ${objective.completed ? "完成" : `耐久 ${objective.durability}`}`;
        cell.append(marker);
      }
      for (const unit of units) cell.append(renderUnit(unit, unit.id === activeId));
      container.append(cell);
    }
  }
}

function renderUnit(unit: BattleUnit, isActive: boolean): HTMLElement {
  const element = document.createElement("article");
  element.className = `battle-unit ${unit.id === "scout" ? "is-scout" : "is-enemy"}${isActive ? " is-active" : ""}`;
  element.dataset.testid = `unit-${unit.id}`;
  element.innerHTML = `<strong>${unit.id === "scout" ? "主角" : "敌人"} ${unit.id}</strong><span>生命 ${unit.hp} / ${unit.maxHp}</span><span>攻击 ${unit.attack}</span>`;
  return element;
}

function renderBattleDirective(
  container: HTMLElement,
  level: LevelDefinition,
  state: BattleState,
  settlement: BattleSettlement | undefined,
): void {
  requiredElement(container, "[data-testid='battle-objective-summary']").textContent = level.briefing[0] ?? "完成关卡目标。";
  requiredElement(container, "[data-testid='battle-action-hint']").textContent = settlement === undefined
    ? `当前行动：${battleActiveUnitId(state) ?? "无"}。编辑 choose_turn(world)，返回一条指令后运行回合。`
    : "本场战斗已结算。你可以复盘最终战场与代码。";
  const keys = state.objectives.filter((objective) => objective.key);
  requiredElement(container, "[data-testid='battle-constraint']").textContent = keys.length === 0
    ? `失败约束：在 ${state.maxRounds} 回合内完成任务。`
    : `失败约束：保护${keys.map((objective) => objective.id).join("、")}并在 ${state.maxRounds} 回合内完成任务。`;
}

function renderBriefing(container: HTMLElement, level: LevelDefinition, state: BattleState): void {
  container.className = "mission-briefing";
  container.innerHTML = `
    <div class="mission-heading"><p>任务简报</p><h2 id="mission-heading"></h2></div>
    <p data-testid="mission-summary" class="mission-summary"></p>
    <p class="mission-constraint"></p>
    <div class="skill-readout"><h3>Scout 能力</h3><ul data-testid="scout-skills"></ul></div>
  `;
  requiredElement(container, "#mission-heading").textContent = level.title;
  requiredElement(container, "[data-testid='mission-summary']").textContent = level.briefing.join(" ");
  const keys = state.objectives.filter((objective) => objective.key);
  requiredElement(container, ".mission-constraint").textContent = `当前行动：${battleActiveUnitId(state) ?? "无"} · 回合限制：${state.maxRounds}${keys.length === 0 ? "" : ` · 保护${keys.map((item) => item.id).join("、")}`}`;
  const scout = state.units.find((unit) => unit.id === "scout");
  renderList(requiredElement(container, "[data-testid='scout-skills']"), (scout?.skills ?? []).map((skill) => (
    skill.remainingCooldown === 0 ? `${skill.id} · 可用` : `${skill.id} · 冷却 ${skill.remainingCooldown} 回合`
  )));
}

function renderApiHelp(container: HTMLDetailsElement, level: LevelDefinition): void {
  container.className = "api-help";
  if (container.dataset.helpMode !== "battle") {
    container.dataset.helpMode = "battle";
    container.open = false;
    container.innerHTML = `
      <summary>战斗 API 提示</summary>
      <div class="api-help-body" data-testid="api-hints">
        <section class="api-help-group"><h3>命令外层字段</h3><ul class="api-command-fields"></ul></section>
        <section class="api-help-group"><h3>movePath</h3><ul class="api-move-path"></ul></section>
        <section class="api-help-group"><h3>action</h3><ul class="api-action-fields"></ul></section>
        <section class="api-help-group"><h3>本关规则</h3><ul class="api-level-rules"></ul></section>
      </div>
    `;
  }
  const battleExamples = level.guidance.commandExamples.filter((entry) => !entry.startsWith("探索"));
  const movePaths = battleExamples.filter((entry) => entry.includes("movePath"));
  const actions = battleExamples.filter((entry) => !entry.includes("movePath"));
  renderList(requiredElement(container, ".api-command-fields"), level.guidance.worldFields);
  renderList(requiredElement(container, ".api-move-path"), movePaths);
  renderList(requiredElement(container, ".api-action-fields"), actions);
  renderList(
    requiredElement(container, ".api-level-rules"),
    [...level.guidance.objective, ...level.guidance.concepts, ...level.guidance.levelRules],
  );
}

function settlementFor(snapshot: BattleAppSnapshot, level: LevelDefinition): BattleSettlement | undefined {
  const state = snapshot.battleState;
  const unmet = state.phase === "won"
    ? state.objectives.filter((objective) => !objective.key && !objective.completed).map((objective) => `${objective.id} 尚未激活`)
    : [];
  const locked = "代码已锁定，运行已禁用；可查看最终战场与代码。";
  if (state.phase === "lost") return { kind: "failed", messages: ["战斗失败。重试本关以保留当前代码。", locked] };
  if (unmet.length > 0) return { kind: "failed", messages: [...unmet.map((reason) => `任务失败：${reason}`), locked] };
  if (state.phase !== "won") return undefined;
  if (level.reward.type === "campaign-complete") return { kind: "complete", messages: ["沼心封印已经稳定。最终战场与代码保留供复盘。", locked] };
  return { kind: "victory", messages: [`获得新能力：${level.reward.abilityId}`, `完成于第 ${state.round} 回合。`, locked] };
}

function renderSettlement(container: HTMLElement, settlement: BattleSettlement, controller: GameController): void {
  container.className = `feedback-panel settlement-panel settlement-${settlement.kind}`;
  const section = document.createElement("section");
  section.dataset.testid = `settlement-${settlement.kind}`;
  section.append(textElement("h2", settlement.kind === "failed" ? "任务失败" : settlement.kind === "complete" ? "战役完成" : "关卡完成"));
  for (const message of settlement.messages) section.append(textElement("p", message));
  const actions = document.createElement("div");
  actions.className = "settlement-actions";
  if (settlement.kind === "failed") actions.append(actionButton("retry-level", "重试本关", () => controller.retryLevel()));
  else if (settlement.kind === "victory") actions.append(actionButton("advance-level", "进入下一关", () => controller.advanceLevel()), actionButton("retry-level", "重试本关", () => controller.retryLevel()));
  else actions.append(actionButton("campaign-reset", "重置存档", () => container.closest(".app-shell")?.querySelector<HTMLButtonElement>(".reset-trigger")?.click()));
  section.append(actions);
  container.replaceChildren(section);
}

function renderList(container: HTMLElement, values: readonly string[]): void {
  container.replaceChildren(...values.map((value) => textElement("li", value)));
}

function actionButton(testId: string, label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.testid = testId;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function outputElement(label: string, value: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "feedback-output";
  wrapper.append(textElement("h3", label));
  const output = document.createElement("pre");
  output.textContent = value;
  wrapper.append(output);
  return wrapper;
}

function textElement(tag: "h2" | "h3" | "p" | "li", text: string): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function terrainClass(state: BattleState, x: number, y: number): string {
  const classes = ["battle-cell"];
  if (state.board.blockedCells.some((cell) => atCoordinates(cell, x, y))) classes.push("is-blocked");
  if (state.board.hazardCells.some((cell) => atCoordinates(cell, x, y))) classes.push("is-hazard");
  if (state.board.coverCells.some((cell) => atCoordinates(cell, x, y))) classes.push("is-cover");
  return classes.join(" ");
}

function atCell(item: Readonly<{ cell: Readonly<{ x: number; y: number }> }>, x: number, y: number): boolean {
  return atCoordinates(item.cell, x, y);
}

function atCoordinates(cell: Readonly<{ x: number; y: number }>, x: number, y: number): boolean {
  return cell.x === x && cell.y === y;
}

function cellLabel(x: number, y: number, units: readonly BattleUnit[]): string {
  return `坐标 ${x}, ${y}，单位：${units.length === 0 ? "空" : units.map((unit) => unit.id).join("、")}`;
}

function levelId(snapshot: BattleAppSnapshot): string {
  return snapshot.mode === "game" ? snapshot.currentLevelId : snapshot.battleLevelId;
}

function phaseLabel(phase: BattleState["phase"]): string {
  return phase === "in_progress" ? "进行中" : phase === "won" ? "胜利" : "失败";
}

function requiredElement<T extends Element = HTMLElement>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing required battle element: ${selector}`);
  return element;
}
