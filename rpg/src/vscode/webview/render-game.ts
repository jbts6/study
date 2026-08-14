import type { BattleState, Cell } from "../../game/combat/types";
import type { LevelGuidance } from "../../game/content/types";
import type { ProgramReference, ReferenceEntry } from "../../programs/types";
import type { GameViewSnapshot } from "../messages";
import type { ManualSectionId, ManualViewState } from "./manual-state";

const CELL_GAP = 5;
const DEFAULT_VIEW_STATE: ManualViewState = { view: "battle", sectionId: "focus" };
const VIEW_TABS = [["battle", "战场"], ["manual", "战术手册"]] as const;
const MANUAL_TABS: readonly Readonly<{ id: ManualSectionId; label: string }>[] = [
  { id: "focus", label: "本关重点" },
  { id: "turn-command", label: "回合命令" },
  { id: "world", label: "World 数据" },
  { id: "actions", label: "动作函数" },
  { id: "sdk", label: "完整 SDK" },
];

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

export function renderGame(root: HTMLElement, snapshot: GameViewSnapshot, viewState: ManualViewState = DEFAULT_VIEW_STATE): void {
  root.className = "game-view";
  root.dataset.theme = snapshot.theme;
  root.replaceChildren(
    renderHeader(snapshot),
    renderMission(snapshot),
    renderMain(snapshot, viewState),
    renderFeedback(snapshot),
    renderActions(snapshot),
  );
}

function renderMain(snapshot: GameViewSnapshot, viewState: ManualViewState): HTMLElement {
  if (snapshot.programReference !== undefined && viewState.view === "manual") return renderManual(snapshot, viewState);
  return renderBattle(snapshot, viewState);
}

function renderHeader(snapshot: GameViewSnapshot): HTMLElement {
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

function renderMission(snapshot: GameViewSnapshot): HTMLElement {
  const mission = element("section", "mission-strip");
  const heading = element("div", "mission-heading");
  heading.append(
    textElement("h2", "", snapshot.level.guidance.objective.join(" ")),
    textElement("p", "mission-failure", failureText(snapshot.battleState)),
  );
  mission.append(heading, textElement("p", "mission-concept", snapshot.level.guidance.concepts.join(" ")));
  return mission;
}

function renderBattle(snapshot: GameViewSnapshot, viewState: ManualViewState): HTMLElement {
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
  frame.append(grid, renderLegend());
  stage.append(frame);
  if (snapshot.programReference !== undefined) stage.append(renderHiddenViewPanel("manual-panel", "manual", "manual-tab"));
  return stage;
}

function renderManual(snapshot: GameViewSnapshot, viewState: ManualViewState): HTMLElement {
  const reference = snapshot.programReference;
  if (reference === undefined) return renderBattle(snapshot, viewState);
  const stage = element("section", "manual-stage");
  stage.id = "manual-panel";
  stage.dataset.view = "manual";
  stage.setAttribute("role", "tabpanel");
  stage.setAttribute("aria-labelledby", "manual-tab");
  stage.append(renderManualTabs(viewState.sectionId), renderViewTabs(viewState), renderManualPanel(snapshot, viewState.sectionId, reference));
  stage.append(renderHiddenViewPanel("battle-panel", "battle", "battle-tab"));
  return stage;
}

function renderViewTabs(viewState: ManualViewState): HTMLElement {
  const tabs = element("div", "view-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("data-view-tabs", "");
  tabs.setAttribute("aria-label", "主视图");
  for (const [id, label] of VIEW_TABS) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "view-tab";
    tab.id = `${id}-tab`;
    tab.dataset.view = id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(viewState.view === id));
    tab.setAttribute("aria-controls", id === "battle" ? "battle-panel" : "manual-panel");
    tab.tabIndex = viewState.view === id ? 0 : -1;
    tab.textContent = label;
    tabs.append(tab);
  }
  return tabs;
}

function renderManualTabs(sectionId: ManualSectionId): HTMLElement {
  const tabs = element("div", "manual-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("data-manual-tabs", "");
  tabs.setAttribute("aria-label", "手册章节");
  for (const tabInfo of MANUAL_TABS) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "manual-tab";
    tab.id = tabInfo.id;
    tab.dataset.section = tabInfo.id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(sectionId === tabInfo.id));
    tab.setAttribute("aria-controls", "manual-content");
    tab.tabIndex = sectionId === tabInfo.id ? 0 : -1;
    tab.textContent = tabInfo.label;
    tabs.append(tab);
  }
  return tabs;
}

function renderManualPanel(snapshot: GameViewSnapshot, sectionId: ManualSectionId, reference: ProgramReference): HTMLElement {
  const panel = element("article", "manual-content");
  panel.id = "manual-content";
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", sectionId);
  const heading = textElement("h2", "manual-heading", MANUAL_TABS.find((item) => item.id === sectionId)?.label ?? "战术手册");
  heading.tabIndex = -1;
  heading.dataset.manualHeading = "";
  panel.append(heading);

  if (sectionId === "focus") renderFocusSection(panel, snapshot, reference);
  else for (const entry of entriesForSection(reference, sectionId)) panel.append(renderReferenceEntry(entry));
  return panel;
}

function renderHiddenViewPanel(id: "battle-panel" | "manual-panel", view: "battle" | "manual", labelledBy: string): HTMLElement {
  const panel = element("section", "view-panel-placeholder");
  panel.id = id;
  panel.dataset.view = view;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", labelledBy);
  panel.hidden = true;
  return panel;
}

function renderFocusSection(panel: HTMLElement, snapshot: GameViewSnapshot, reference: ProgramReference): void {
  const focus = snapshot.level.guidance.apiFocus;
  if (focus === undefined) {
    panel.append(textElement("p", "manual-empty", "本关暂无战术手册内容。"));
    return;
  }
  panel.append(textElement("p", "manual-summary", focus.summary));
  panel.append(renderTextList("学习步骤", focus.steps));
  panel.append(textElement("h3", "", "示例"), textElement("pre", "manual-example", focus.example));
  const entries = new Map(entriesForSection(reference, "sdk").map((entry) => [entry.id, entry]));
  for (const referenceId of focus.referenceIds) {
    const entry = entries.get(referenceId);
    if (entry !== undefined) panel.append(renderReferenceEntry(entry));
  }
}

function entriesForSection(reference: ProgramReference, sectionId: ManualSectionId): readonly ReferenceEntry[] {
  const all = allReferenceEntries(reference);
  if (sectionId === "sdk") return all;
  if (sectionId === "turn-command") return all.filter((entry) => entry.id === "entrypoint.choose-turn" || entry.id === "type.turn-command");
  if (sectionId === "world") return all.filter((entry) => entry.id.startsWith("type.") && entry.id !== "type.turn-command");
  if (sectionId === "actions") return all.filter((entry) => entry.id.startsWith("action."));
  return [];
}

function allReferenceEntries(reference: ProgramReference): readonly ReferenceEntry[] {
  return [
    { id: "entrypoint.choose-turn", ...reference.entrypoint },
    ...reference.sections.flatMap((section) => section.entries),
  ];
}

function renderReferenceEntry(entry: ReferenceEntry): HTMLElement {
  const article = element("article", "manual-entry");
  article.id = `manual-entry-${entry.id}`;
  article.dataset.referenceId = entry.id;
  const heading = textElement("h3", "manual-entry-signature", entry.signature);
  heading.tabIndex = -1;
  article.append(heading, textElement("p", "manual-entry-description", entry.description));
  if (entry.example !== undefined) article.append(textElement("pre", "manual-entry-example", entry.example));
  return article;
}

function renderTextList(title: string, values: readonly string[]): HTMLElement {
  const section = element("section", "manual-list");
  section.append(textElement("h3", "", title));
  const list = element("ol", "");
  for (const value of values) list.append(textElement("li", "", value));
  section.append(list);
  return section;
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
  for (const unit of state.units.filter((item) => item.visibility === "revealed" && item.cell.x === x && item.cell.y === y)) {
    const token = textElement("span", `token token-${unit.team}`, unit.id);
    if (unit.disabled) token.classList.add("token-disabled");
    cell.append(token, textElement("span", "token-health", `${unit.hp} / ${unit.maxHp}`));
    labels.push(`${unit.team === "allies" ? "友方" : "敌方"} ${unit.id}，生命 ${unit.hp}/${unit.maxHp}`);
  }
  cell.setAttribute("aria-label", labels.join("；"));
  return cell;
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

function renderFeedback(snapshot: GameViewSnapshot): HTMLElement {
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

function renderGuidance(guidance: LevelGuidance, languageLabel: GameViewSnapshot["languageLabel"]): HTMLElement {
  const details = element("details", "guidance-drawer");
  details.append(textElement("summary", "", "展开本关提示"));
  for (const [title, values] of [
    ["本关目标", guidance.objective],
    [`${languageLabel} 概念`, guidance.concepts],
    ["world 字段", guidance.worldFields],
    ["命令示例", guidance.commandExamples],
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

function renderActions(snapshot: GameViewSnapshot): HTMLElement {
  const actions = element("footer", "action-bar");
  const running = snapshot.runnerState === "running" || snapshot.activeRunId !== undefined;
  if (running) {
    actions.append(commandButton("interruptRun", "中断运行"));
  } else if (snapshot.battleState.phase === "in_progress") {
    actions.append(commandButton("runTurn", "运行回合"));
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

function settlementKind(snapshot: GameViewSnapshot): "victory" | "retriable" | "locked" {
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

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  if (className) value.className = className;
  return value;
}

function textElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string): HTMLElementTagNameMap[K] {
  const value = element(tag, className);
  value.textContent = text;
  return value;
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

function runnerLabel(snapshot: GameViewSnapshot): string {
  if (snapshot.activeRunId !== undefined || snapshot.runnerState === "running") return "运行中";
  return snapshot.runnerState === "ready" ? "可运行" : snapshot.runnerState === "unavailable" ? "不可用" : "检测中";
}
