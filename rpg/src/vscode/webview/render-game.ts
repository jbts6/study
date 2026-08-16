import type { BattleState, Cell } from "../../game/combat/types";
import type { LevelGuidance } from "../../game/content/types";
import type { BattleViewSnapshot } from "../messages";
import type { ManualViewState } from "./manual-state";
import { renderHiddenViewPanel, renderManual, renderViewTabs } from "./render-manual";
import { element, textElement } from "./render-elements";
import { formatBattleEvents } from "./battle-log";

const CELL_GAP = 5;
const DEFAULT_VIEW_STATE: ManualViewState = { view: "battle", sectionId: "focus" };

export function calculateCellSize(
  width: number,
  height: number,
  columns: number,
  rows: number,
): number {
  const horizontalGaps = Math.max(0, columns - 1) * CELL_GAP;
  const verticalGaps = Math.max(0, rows - 1) * CELL_GAP;
  const widthFit = (width - horizontalGaps) / columns;
  const heightFit = (height - verticalGaps) / rows;
  return Math.max(1, Math.min(Math.floor(widthFit), Math.floor(heightFit)));
}

type BattleRenderState = {
  battleId: string;
  unitTokens: Map<string, HTMLSpanElement>;
  appliedEvents: number;
};
let battleRender: BattleRenderState | undefined;

function battleRenderFor(state: BattleState): BattleRenderState {
  if (battleRender?.battleId !== state.battleId) {
    battleRender = { battleId: state.battleId, unitTokens: new Map(), appliedEvents: 0 };
  }
  return battleRender;
}

export function renderGame(root: HTMLElement, snapshot: BattleViewSnapshot, viewState: ManualViewState = DEFAULT_VIEW_STATE): void {
  root.className = "game-view";
  root.dataset.theme = snapshot.theme;
  root.replaceChildren(
    renderHeader(snapshot),
    renderMission(snapshot),
    renderMain(snapshot, viewState),
    renderBattleLog(snapshot),
    renderFeedback(snapshot),
    renderActions(snapshot),
  );
}

function renderBattleLog(snapshot: BattleViewSnapshot): HTMLElement {
  const panel = element("section", "battle-log");
  panel.setAttribute("aria-label", "战斗日志");
  panel.append(textElement("h2", "", "战斗日志"));
  const list = element("ul", "battle-log-list");
  const lines = formatBattleEvents(snapshot.battleLog);
  if (lines.length === 0) {
    list.append(textElement("li", "battle-log-empty", "尚未开始自动战斗。点“运行回合”后，这里会逐条显示每个回合发生的事件。"));
  } else {
    for (const line of lines) list.append(textElement("li", "", line));
  }
  panel.append(list);
  panel.scrollTop = panel.scrollHeight;
  return panel;
}

function renderMain(snapshot: BattleViewSnapshot, viewState: ManualViewState): HTMLElement {
  if (snapshot.programReference !== undefined && viewState.view === "manual") return renderManual(snapshot, viewState);
  return renderBattle(snapshot, viewState);
}

function renderHeader(snapshot: BattleViewSnapshot): HTMLElement {
  const header = element("header", "game-header");
  const identity = element("div", "game-identity");
  identity.append(
    textElement("p", "game-kicker", `${snapshot.campaignTitle} · ${snapshot.level.id}`),
    textElement("h1", "", snapshot.level.title),
  );
  const status = element("dl", "game-status");
  status.append(
    statusItem("回合", `${snapshot.battleState.round} / ${snapshot.battleState.maxRounds}`),
    statusItem("行动者", activeUnitId(snapshot.battleState) ?? "无"),
    statusItem(snapshot.languageLabel, runnerLabel(snapshot)),
  );
  const themes = element("div", "theme-switch");
  themes.setAttribute("aria-label", "颜色主题");
  for (const [value, label] of [["system", "跟随"], ["light", "浅色"], ["dark", "深色"]] as const) {
    const button = commandButton("setTheme", label);
    button.dataset.theme = value;
    button.setAttribute("aria-pressed", String(snapshot.theme === value));
    themes.append(button);
  }
  header.append(identity, status, themes);
  return header;
}

function renderMission(snapshot: BattleViewSnapshot): HTMLElement {
  const mission = element("section", "mission-strip");
  const heading = element("div", "mission-heading");
  heading.append(
    textElement("h2", "", snapshot.level.guidance.objective.join(" ")),
    textElement("p", "mission-failure", failureText(snapshot.battleState)),
  );
  mission.append(heading, textElement("p", "mission-concept", snapshot.level.guidance.concepts.join(" ")));
  return mission;
}

function renderBattle(snapshot: BattleViewSnapshot, viewState: ManualViewState): HTMLElement {
  const state = snapshot.battleState;
  const stage = element("section", "battle-stage");
  if (snapshot.programReference !== undefined) {
    stage.id = "battle-panel";
    stage.dataset.view = "battle";
    stage.setAttribute("role", "tabpanel");
    stage.setAttribute("aria-labelledby", "battle-tab");
    stage.append(renderViewTabs(viewState));
  }
  const frame = element("div", "battle-frame");
  frame.dataset.columns = String(state.board.width);
  frame.dataset.rows = String(state.board.height);
  const turnLine = textElement("p", "turn-line", `当前指令将作用于 ${activeUnitId(state) ?? "无"} · 修订 ${state.revision}`);
  turnLine.tabIndex = -1;
  frame.append(turnLine);
  const grid = element("div", "battle-grid");
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", `${state.battleId} 战场`);
  grid.setAttribute("aria-rowcount", String(state.board.height));
  grid.setAttribute("aria-colcount", String(state.board.width));
  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) grid.append(renderCell(state, x, y));
  }
  const unitsLayer = element("div", "units-layer");
  grid.append(unitsLayer);
  renderUnits(state, unitsLayer);
  applyBattleEvents(snapshot, unitsLayer);
  frame.append(grid, renderLegend());
  stage.append(frame);
  if (snapshot.programReference !== undefined) stage.append(renderHiddenViewPanel("manual-panel", "manual", "manual-tab"));
  return stage;
}

function renderCell(state: BattleState, x: number, y: number): HTMLElement {
  const cell = element("div", "battle-cell");
  cell.setAttribute("role", "gridcell");
  cell.dataset.x = String(x);
  cell.dataset.y = String(y);
  if (hasCell(state.board.hazardCells, x, y)) cell.classList.add("cell-hazard");
  if (hasCell(state.board.coverCells, x, y)) cell.classList.add("cell-cover");
  if (hasCell(state.board.blockedCells, x, y)) cell.classList.add("cell-blocked");
  const labels = [`格位 ${x},${y}`];
  for (const objective of state.objectives.filter((item) => item.cell.x === x && item.cell.y === y)) {
    const token = textElement("span", objective.key ? "token token-key" : "token token-objective", objective.id);
    cell.append(token);
    labels.push(`目标 ${objective.id}，耐久 ${objective.durability}`);
  }
  cell.setAttribute("aria-label", labels.join("；"));
  return cell;
}

function renderUnits(state: BattleState, layer: HTMLElement): void {
  const render = battleRenderFor(state);
  for (const unit of state.units.filter((item) => item.visibility === "revealed")) {
    let token = render.unitTokens.get(unit.id);
    if (token === undefined) {
      token = element("span", "battle-unit-token");
      token.dataset.unitId = unit.id;
      token.append(
        textElement("span", `token token-${unit.team}`, unit.id),
        textElement("span", "token-health", `${unit.hp} / ${unit.maxHp}`),
      );
      render.unitTokens.set(unit.id, token);
    }
    layer.append(token);
    token.classList.toggle("token-disabled", unit.disabled);
    token.style.left = `calc((var(--cell-size) + 5px) * ${unit.cell.x})`;
    token.style.top = `calc((var(--cell-size) + 5px) * ${unit.cell.y})`;
    token.setAttribute("aria-label", `${unit.team === "allies" ? "友方" : "敌方"} ${unit.id}，生命 ${unit.hp}/${unit.maxHp}${unit.disabled ? "，已阵亡" : ""}`);
    token.querySelector(".token-health")!.textContent = `${unit.hp} / ${unit.maxHp}`;
    token.querySelector(".token")!.classList.toggle("token-disabled", unit.disabled);
  }
}

function applyBattleEvents(snapshot: BattleViewSnapshot, layer: HTMLElement): void {
  const render = battleRenderFor(snapshot.battleState);
  const log = snapshot.battleLog;
  const fresh = log.length >= render.appliedEvents ? log.slice(render.appliedEvents) : log;
  render.appliedEvents = log.length;
  for (const token of render.unitTokens.values()) {
    token.classList.remove("anim-hit", "anim-lunge", "anim-heal", "anim-defeat");
  }
  const cellAt = (x: number, y: number) => layer.parentElement?.querySelector<HTMLElement>(`.battle-cell[data-x='${x}'][data-y='${y}']`);
  const unitCell = (id: string) => snapshot.battleState.units.find((unit) => unit.id === id)?.cell;
  for (const event of fresh) {
    const payload = event.payload;
    if (event.type === "damaged" || event.type === "healed") {
      const target = render.unitTokens.get(String(payload.targetId));
      if (target !== undefined) {
        target.classList.add(event.type === "damaged" ? "anim-hit" : "anim-heal");
        const float = textElement("span", `damage-float ${event.type === "healed" ? "float-heal" : ""}`, `${event.type === "damaged" ? "-" : "+"}${payload.amount}`);
        float.style.left = target.style.left;
        float.style.top = target.style.top;
        layer.append(float);
      }
      if (event.type === "damaged" && payload.sourceId !== "hazard") {
        const actor = render.unitTokens.get(String(payload.sourceId));
        const from = unitCell(String(payload.sourceId));
        const to = unitCell(String(payload.targetId));
        if (actor !== undefined && from !== undefined && to !== undefined) {
          const span = Math.abs(to.x - from.x) + Math.abs(to.y - from.y) || 1;
          actor.style.setProperty("--lx", String((to.x - from.x) / span));
          actor.style.setProperty("--ly", String((to.y - from.y) / span));
          actor.classList.add("anim-lunge");
        }
      }
    } else if (event.type === "unit_disabled") {
      render.unitTokens.get(String(payload.unitId))?.classList.add("anim-defeat");
    } else if (event.type === "objective_progressed" || event.type === "interacted") {
      const cell = unitCell(String(payload.targetId)) ?? (event.type === "interacted" ? unitCell(String(payload.targetId)) : undefined);
      const objective = snapshot.battleState.objectives.find((item) => item.id === payload.targetId);
      const target = objective !== undefined ? cellAt(objective.cell.x, objective.cell.y) : cell !== undefined ? cellAt(cell.x, cell.y) : undefined;
      target?.classList.add("anim-objective");
    }
  }
}

function renderLegend(): HTMLElement {
  const legend = element("div", "battle-legend");
  for (const [className, label] of [
    ["legend-allies", "scout"],
    ["legend-enemies", "敌人"],
    ["legend-key", "关键目标"],
    ["legend-hazard", "危险格"],
    ["legend-cover", "掩体"],
  ]) {
    const item = element("span", "legend-item");
    item.append(element("i", className), document.createTextNode(label));
    legend.append(item);
  }
  return legend;
}

function renderFeedback(snapshot: BattleViewSnapshot): HTMLElement {
  const panel = element("section", `feedback-panel feedback-${snapshot.feedback.kind}`);
  panel.setAttribute("aria-live", "polite");
  const heading = element("div", "feedback-heading");
  heading.append(
    textElement("h2", "", snapshot.feedback.title || "运行反馈"),
    renderGuidance(snapshot.level.guidance, snapshot.languageLabel),
  );
  panel.append(heading);
  const messages = snapshot.feedback.messages.length > 0
    ? snapshot.feedback.messages
    : [`等待运行 ${snapshot.playerFileName}。插件会读取编辑器中的最新内容。`];
  const list = element("ul", "feedback-messages");
  for (const message of messages) list.append(textElement("li", "", message));
  panel.append(list);
  const relatedReferenceId = snapshot.feedback.relatedReferenceIds?.[0];
  if (snapshot.programReference !== undefined && relatedReferenceId !== undefined) {
    const referenceButton = document.createElement("button");
    referenceButton.type = "button";
    referenceButton.className = "feedback-reference-button";
    referenceButton.dataset.localCommand = "openManualReference";
    referenceButton.dataset.referenceId = relatedReferenceId;
    referenceButton.textContent = "查看相关 API";
    panel.append(referenceButton);
  }
  if (snapshot.feedback.stdout) panel.append(textElement("pre", "feedback-output", snapshot.feedback.stdout));
  if (snapshot.feedback.stderr) panel.append(textElement("pre", "feedback-error", snapshot.feedback.stderr));
  return panel;
}

function renderGuidance(guidance: LevelGuidance, languageLabel: BattleViewSnapshot["languageLabel"]): HTMLElement {
  const details = element("details", "guidance-drawer");
  details.append(textElement("summary", "", "展开本关提示"));
  const battleExamples = guidance.commandExamples.filter((entry) => !entry.startsWith("探索"));
  for (const [title, values] of [
    ["本关目标", guidance.objective],
    [`${languageLabel} 概念`, guidance.concepts],
    ["world 字段", guidance.worldFields],
    ["命令示例", battleExamples],
    ["本关规则", guidance.levelRules],
  ] as const) {
    const section = element("section", "guidance-group");
    section.append(textElement("h3", "", title));
    const list = element("ul", "");
    for (const value of values) list.append(textElement("li", "", value));
    section.append(list);
    details.append(section);
  }
  return details;
}

function renderActions(snapshot: BattleViewSnapshot): HTMLElement {
  const actions = element("footer", "action-bar");
  const running = snapshot.runnerState === "running" || snapshot.activeRunId !== undefined;
  if (running) {
    actions.append(commandButton("interruptRun", "中断运行"));
  } else if (snapshot.battleState.phase === "in_progress") {
    actions.append(commandButton("runTurn", "运行回合（自动连续）"));
  } else {
    const kind = settlementKind(snapshot);
    if (kind === "victory") {
      actions.append(commandButton("advanceLevel", "进入下一关"), commandButton("retryLevel", "重试本关"));
    } else if (kind === "retriable") {
      actions.append(commandButton("retryLevel", "重试本关"));
    }
  }
  actions.append(textElement("span", "keyboard-hint", "Ctrl+Enter"));
  return actions;
}

function settlementKind(snapshot: BattleViewSnapshot): "victory" | "retriable" | "locked" {
  const unmet = snapshot.battleState.objectives.filter((objective) => !objective.key && !objective.completed).length;
  if (snapshot.battleState.phase === "lost") return "retriable";
  if (snapshot.battleState.phase !== "won") return "locked";
  if (unmet > 0) return "retriable";
  return snapshot.level.reward.type === "ability" ? "victory" : "locked";
}

function statusItem(label: string, value: string): HTMLElement {
  const item = element("div", "status-item");
  item.append(textElement("dt", "", label), textElement("dd", "", value));
  return item;
}

function commandButton(command: string, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.command = command;
  button.textContent = label;
  return button;
}

function activeUnitId(state: BattleState): string | undefined {
  return state.turnOrder[state.turnIndex];
}

function hasCell(cells: readonly Cell[], x: number, y: number): boolean {
  return cells.some((cell) => cell.x === x && cell.y === y);
}

function failureText(state: BattleState): string {
  const key = state.objectives.find((objective) => objective.key);
  return key === undefined ? `限制：${state.maxRounds} 回合` : `失败：${key.id} 耐久归零`;
}

function runnerLabel(snapshot: BattleViewSnapshot): string {
  if (snapshot.activeRunId !== undefined || snapshot.runnerState === "running") return "运行中";
  return snapshot.runnerState === "ready" ? "可运行" : snapshot.runnerState === "unavailable" ? "不可用" : "检测中";
}
