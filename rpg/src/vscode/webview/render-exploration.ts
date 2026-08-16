import type { AppFeedback } from "../../app/app-controller";
import type { ExplorationViewSnapshot, ThemePreference } from "../messages";
import { element, textElement } from "./render-elements";

const THEME_OPTIONS = [["system", "跟随"], ["light", "浅色"], ["dark", "深色"]] as const;

export function renderExploration(root: HTMLElement, snapshot: ExplorationViewSnapshot): void {
  root.className = "game-view exploration-view";
  root.dataset.theme = snapshot.theme;
  root.replaceChildren(
    renderHeader(snapshot),
    renderCurrentTask(snapshot),
    renderWorld(snapshot),
    renderFeedback(snapshot),
    renderActions(snapshot),
  );
}

function renderHeader(snapshot: ExplorationViewSnapshot): HTMLElement {
  const header = element("header", "game-header exploration-header");
  const identity = element("div", "game-identity");
  identity.append(
    textElement("p", "game-kicker", `${snapshot.campaignTitle} · ${snapshot.chapterId}`),
    textElement("h1", "", snapshot.location.name),
  );
  const status = element("dl", "game-status exploration-status");
  status.append(
    statusItem("天气", snapshot.location.weather ?? "稳定"),
    statusItem("脚本", snapshot.playerFileName),
    statusItem("Runner", runnerLabel(snapshot)),
  );
  header.append(identity, status, renderThemeSwitch(snapshot.theme));
  return header;
}

function renderThemeSwitch(theme: ThemePreference): HTMLElement {
  const themes = element("div", "theme-switch");
  themes.setAttribute("aria-label", "颜色主题");
  for (const [value, label] of THEME_OPTIONS) {
    const button = commandButton("setTheme", label);
    button.dataset.theme = value;
    button.setAttribute("aria-pressed", String(theme === value));
    themes.append(button);
  }
  return themes;
}

function renderCurrentTask(snapshot: ExplorationViewSnapshot): HTMLElement {
  const active = snapshot.quests.find((quest) => quest.status === "active") ?? snapshot.quests[0];
  const task = element("section", "mission-strip exploration-task");
  const heading = element("div", "mission-heading");
  heading.append(
    textElement("h2", "", active?.id ?? "当前无活跃任务"),
    textElement("p", "mission-failure quest-status", active?.status ?? "idle"),
  );
  task.append(
    heading,
    textElement("p", "mission-concept", active === undefined ? "等待新的战役目标。" : `当前步骤：${active.stepId}`),
  );
  return task;
}

function renderWorld(snapshot: ExplorationViewSnapshot): HTMLElement {
  const stage = element("section", "exploration-stage");
  const field = element("section", "exploration-field");
  const heading = element("div", "zone-heading");
  heading.append(
    textElement("div", "zone-index", "WORLD / 现场"),
    textElement("h2", "", "可交互目标"),
    textElement("p", "zone-meta", snapshot.location.id),
  );
  const targets = element("div", "world-targets");
  targets.append(renderNpcGroup(snapshot), renderObjectGroup(snapshot));
  field.append(heading, targets);

  const intel = element("aside", "exploration-intel");
  intel.setAttribute("aria-label", "战役情报");
  intel.append(renderInventory(snapshot), renderTravel(snapshot), renderQuests(snapshot));
  stage.append(field, intel);
  return stage;
}

function renderNpcGroup(snapshot: ExplorationViewSnapshot): HTMLElement {
  const rows = snapshot.npcs.map((npc) => worldRow(
    npc.name,
    npc.id,
    npc.role,
    npc.mood,
    "npc",
  ));
  return renderWorldGroup("现场人物", "NPC", rows, "此处没有可交谈人物。");
}

function renderObjectGroup(snapshot: ExplorationViewSnapshot): HTMLElement {
  const rows = snapshot.objects.map((object) => worldRow(
    object.id,
    object.type,
    object.requiredItems.length === 0 ? "无需物资" : `需要 ${object.requiredItems.join("、")}`,
    object.status,
    "object",
  ));
  return renderWorldGroup("设施与物资", "OBJECT", rows, "此处没有可检查目标。");
}

function renderWorldGroup(
  title: string,
  code: string,
  rows: readonly HTMLElement[],
  emptyText: string,
): HTMLElement {
  const group = element("section", "world-group");
  const heading = element("div", "world-group-heading");
  heading.append(textElement("h3", "", title), textElement("span", "group-code", code));
  const list = element("ul", "world-list");
  if (rows.length === 0) list.append(textElement("li", "world-empty", emptyText));
  else list.append(...rows);
  group.append(heading, list);
  return group;
}

function worldRow(
  label: string,
  id: string,
  detail: string,
  state: string,
  kind: "npc" | "object",
): HTMLElement {
  const row = element("li", `world-row world-row-${kind}`);
  const identity = element("div", "world-row-identity");
  identity.append(textElement("strong", "world-row-label", label), textElement("code", "world-row-id", id));
  const metadata = element("div", "world-row-meta");
  metadata.append(textElement("span", "world-row-detail", detail), textElement("span", "world-row-state", state));
  row.append(identity, metadata);
  return row;
}

function renderInventory(snapshot: ExplorationViewSnapshot): HTMLElement {
  const rows = snapshot.inventory.map((item) => compactRow(item.id, `× ${item.amount}`));
  return renderIntelSection("随身物资", "INVENTORY", rows, "物资栏为空");
}

function renderTravel(snapshot: ExplorationViewSnapshot): HTMLElement {
  const rows = snapshot.availableTravel.map((locationId) => compactRow(locationId, "locationId"));
  return renderIntelSection("可前往地点", "TRAVEL", rows, "当前没有可前往地点");
}

function renderQuests(snapshot: ExplorationViewSnapshot): HTMLElement {
  const rows = snapshot.quests.map((quest) => compactRow(
    quest.id,
    quest.stepId,
    `quest-${quest.status}`,
    quest.status,
  ));
  return renderIntelSection("任务进度", "QUEST", rows, "暂无任务记录");
}

function renderIntelSection(
  title: string,
  code: string,
  rows: readonly HTMLElement[],
  emptyText: string,
): HTMLElement {
  const section = element("section", "intel-section");
  const heading = element("div", "intel-heading");
  heading.append(textElement("h2", "", title), textElement("span", "group-code", code));
  const list = element("ul", "intel-list");
  if (rows.length === 0) list.append(textElement("li", "world-empty", emptyText));
  else list.append(...rows);
  section.append(heading, list);
  return section;
}

function compactRow(label: string, detail: string, className = "", state?: string): HTMLElement {
  const row = element("li", `intel-row ${className}`.trim());
  const copy = element("div", "intel-copy");
  copy.append(textElement("code", "intel-id", label), textElement("span", "intel-detail", detail));
  row.append(copy);
  if (state !== undefined) row.append(textElement("span", "intel-state", state));
  return row;
}

function renderFeedback(snapshot: ExplorationViewSnapshot): HTMLElement {
  const feedback = snapshot.feedback;
  const panel = element("section", `feedback-panel feedback-${feedback.kind} feedback-layer-${feedback.layer}`);
  panel.dataset.feedbackLayer = feedback.layer;
  panel.setAttribute("aria-live", "polite");
  const heading = element("div", "feedback-heading");
  heading.append(
    textElement("h2", "", feedbackLayerTitle(feedback.layer)),
    textElement("p", "feedback-context", feedback.title || runnerLabel(snapshot)),
  );
  panel.append(heading);
  const messages = feedback.messages.length > 0
    ? feedback.messages
    : [`等待运行 ${snapshot.playerFileName}。插件会读取编辑器中的最新内容。`];
  const list = element("ul", "feedback-messages");
  for (const message of messages) list.append(textElement("li", "", message));
  panel.append(list);
  if (feedback.stdout) panel.append(textElement("pre", "feedback-output", feedback.stdout));
  if (feedback.stderr) panel.append(textElement("pre", "feedback-error", feedback.stderr));
  return panel;
}

function renderActions(snapshot: ExplorationViewSnapshot): HTMLElement {
  const actions = element("footer", "action-bar exploration-actions");
  const running = snapshot.runnerState === "running" || snapshot.activeRunId !== undefined;
  if (running) {
    actions.append(commandButton("interruptRun", "中断运行"));
  } else {
    const run = commandButton("runTurn", "运行 Python");
    run.disabled = snapshot.runnerState !== "ready";
    run.title = run.disabled ? runnerLabel(snapshot) : `运行 ${snapshot.playerFileName}`;
    actions.append(run);
  }
  const chapters = element("div", "chapter-switch");
  chapters.setAttribute("aria-label", "章节切换");
  for (const [index, chapter] of snapshot.chapters.entries()) {
    const button = commandButton("switchChapter", `第${index + 1}章`);
    button.dataset.chapterId = chapter.id;
    button.title = chapter.title;
    button.disabled = chapter.id === snapshot.chapterId || running;
    chapters.append(button);
  }
  actions.append(chapters);
  actions.append(
    textElement("span", "action-context", `代码来源：${snapshot.playerFileName}`),
    textElement("span", "keyboard-hint", "Ctrl+Enter"),
  );
  return actions;
}

function feedbackLayerTitle(layer: AppFeedback["layer"]): string {
  if (layer === "program") return "程序反馈";
  if (layer === "strategy") return "策略反馈";
  return "任务反馈";
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

function runnerLabel(snapshot: ExplorationViewSnapshot): string {
  if (snapshot.activeRunId !== undefined || snapshot.runnerState === "running") return "运行中";
  if (snapshot.runnerState === "ready") return "可运行";
  if (snapshot.runnerState === "unavailable") return "不可用";
  return "连接中";
}
