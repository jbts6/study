import type { WorldExplorationSnapshot } from "./controller-types";
import type { AppFeedback } from "./app-feedback";

const WORLD_HELP = [
  "talk / inspect / collect：使用 targetId。",
  "use：使用 itemId 和 targetId。",
  "travel：使用 locationId。",
  "prepareBattle：使用 encounterId。",
  "每条命令都必须带当前 world[\"revision\"] 作为 expectedRevision。",
] as const;

export function renderWorldApp(
  container: HTMLElement,
  briefing: HTMLElement,
  apiHelp: HTMLDetailsElement,
  snapshot: WorldExplorationSnapshot,
): void {
  container.className = "battle-panel world-panel";
  container.removeAttribute("aria-labelledby");
  container.replaceChildren(renderWorldView(snapshot));
  renderWorldBriefing(briefing, snapshot);
  renderWorldHelp(apiHelp);
}

export function renderWorldFeedback(container: HTMLElement, snapshot: WorldExplorationSnapshot): void {
  const { feedback, runnerState } = snapshot;
  container.className = `feedback-panel feedback-${feedback.kind} feedback-layer-${feedback.layer}`;
  container.dataset.feedbackLayer = feedback.layer;
  container.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "world-feedback-heading";
  heading.append(
    textElement("h2", feedbackLayerTitle(feedback.layer)),
    textElement("p", feedback.title || runnerLabel(runnerState)),
  );
  container.append(heading);
  const messages = feedback.messages.length > 0
    ? feedback.messages
    : [`等待运行当前 Python 文件。控制器会调用 choose_world_action(world)。`];
  for (const message of messages) container.append(textElement("p", message));
  if (feedback.stdout) container.append(outputElement("标准输出", feedback.stdout));
  if (feedback.stderr) container.append(outputElement("错误输出", feedback.stderr));
}

function renderWorldView(snapshot: WorldExplorationSnapshot): HTMLElement {
  const view = document.createElement("div");
  view.className = "world-app-view";
  const header = document.createElement("header");
  header.className = "world-app-header";
  const identity = document.createElement("div");
  identity.append(
    textElement("p", `${snapshot.gameState.chapterId} · ${snapshot.worldView.location.id}`),
    textElement("h2", snapshot.worldView.location.name),
  );
  const weather = document.createElement("dl");
  weather.className = "world-app-status";
  weather.append(statusItem("天气", snapshot.worldView.location.weather ?? "稳定"), statusItem("修订", String(snapshot.worldView.revision)));
  header.append(identity, weather);

  const activeQuest = snapshot.worldView.quests.find((quest) => quest.status === "active") ?? snapshot.worldView.quests[0];
  const task = document.createElement("section");
  task.className = "world-task-band";
  task.append(
    textElement("p", "当前任务"),
    textElement("h3", activeQuest?.id ?? "暂无活跃任务"),
    textElement("code", activeQuest?.stepId ?? "idle"),
  );

  const body = document.createElement("div");
  body.className = "world-app-body";
  const field = document.createElement("section");
  field.className = "world-field";
  field.append(sectionHeading("现场目标", "WORLD"));
  const groups = document.createElement("div");
  groups.className = "world-app-groups";
  groups.append(
    worldGroup("现场人物", snapshot.worldView.npcs.map((npc) => worldRow(npc.name, npc.id, npc.role, npc.mood))),
    worldGroup("设施与物资", snapshot.worldView.objects.map((object) => worldRow(
      object.id,
      object.type,
      object.requiredItems.length === 0 ? "无需物资" : `需要 ${object.requiredItems.join("、")}`,
      object.status,
    ))),
  );
  field.append(groups);

  const intel = document.createElement("aside");
  intel.className = "world-intel";
  intel.setAttribute("aria-label", "战役情报");
  intel.append(
    intelSection("随身物资", snapshot.worldView.inventory.map((item) => intelRow(item.id, `× ${item.amount}`))),
    intelSection("可前往地点", snapshot.worldView.availableTravel.map((locationId) => intelRow(locationId, "locationId"))),
    intelSection("任务进度", snapshot.worldView.quests.map((quest) => intelRow(quest.id, quest.stepId, quest.status))),
  );
  body.append(field, intel);
  view.append(header, task, body);
  return view;
}

function renderWorldBriefing(container: HTMLElement, snapshot: WorldExplorationSnapshot): void {
  const activeQuest = snapshot.worldView.quests.find((quest) => quest.status === "active") ?? snapshot.worldView.quests[0];
  container.className = "mission-briefing world-briefing";
  container.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "mission-heading";
  heading.append(textElement("p", "探索程序"), textElement("h2", activeQuest?.id ?? snapshot.gameState.chapterId));
  container.append(
    heading,
    textElement("p", `当前位置：${snapshot.worldView.location.name}。当前步骤：${activeQuest?.stepId ?? "idle"}。`),
    textElement("p", "编辑 choose_world_action(world)，返回一条世界命令后运行探索。"),
  );
}

function renderWorldHelp(container: HTMLDetailsElement): void {
  container.className = "api-help";
  if (container.dataset.helpMode === "world") return;
  container.dataset.helpMode = "world";
  container.open = false;
  container.innerHTML = `<summary>探索 API 提示</summary><div class="api-help-body" data-testid="api-hints"></div>`;
  const body = requiredElement(container, ".api-help-body");
  body.append(helpGroup("world 字段", ["location、npcs、objects、inventory、quests、availableTravel、revision"]));
  body.append(helpGroup("世界命令", WORLD_HELP));
}

function worldGroup(title: string, rows: readonly HTMLElement[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "world-app-group";
  section.append(textElement("h3", title));
  const list = document.createElement("ul");
  list.className = "world-app-list";
  list.append(...(rows.length === 0 ? [textElement("li", "当前没有目标")] : rows));
  section.append(list);
  return section;
}

function worldRow(label: string, id: string, detail: string, state: string): HTMLElement {
  const row = document.createElement("li");
  row.className = "world-app-row";
  const identity = document.createElement("div");
  identity.append(textElement("strong", label), textElement("code", id));
  const metadata = document.createElement("div");
  metadata.append(textElement("span", detail), textElement("b", state));
  row.append(identity, metadata);
  return row;
}

function intelSection(title: string, rows: readonly HTMLElement[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "world-intel-section";
  section.append(textElement("h3", title));
  const list = document.createElement("ul");
  list.append(...(rows.length === 0 ? [textElement("li", "暂无记录")] : rows));
  section.append(list);
  return section;
}

function intelRow(label: string, detail: string, state?: string): HTMLElement {
  const row = document.createElement("li");
  row.className = `world-intel-row${state === undefined ? "" : ` quest-${state}`}`;
  row.append(textElement("code", label), textElement("span", detail));
  if (state !== undefined) row.append(textElement("b", state));
  return row;
}

function sectionHeading(title: string, code: string): HTMLElement {
  const heading = document.createElement("div");
  heading.className = "world-section-heading";
  heading.append(textElement("h3", title), textElement("code", code));
  return heading;
}

function statusItem(label: string, value: string): HTMLElement {
  const item = document.createElement("div");
  item.append(textElement("dt", label), textElement("dd", value));
  return item;
}

function helpGroup(title: string, values: readonly string[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "api-help-group";
  section.append(textElement("h3", title));
  const list = document.createElement("ul");
  for (const value of values) list.append(textElement("li", value));
  section.append(list);
  return section;
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

function feedbackLayerTitle(layer: AppFeedback["layer"]): string {
  return layer === "program" ? "程序反馈" : layer === "strategy" ? "策略反馈" : "任务反馈";
}

function runnerLabel(state: WorldExplorationSnapshot["runnerState"]): string {
  return state === "ready" ? "可运行" : state === "running" ? "运行中" : state === "unavailable" ? "不可用" : "连接中";
}

function textElement<K extends keyof HTMLElementTagNameMap>(tag: K, text: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function requiredElement<T extends Element = HTMLElement>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing required world element: ${selector}`);
  return element;
}
