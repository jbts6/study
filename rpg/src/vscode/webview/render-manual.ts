import type { ProgramReference, ReferenceEntry } from "../../programs/types";
import type { BattleViewSnapshot } from "../messages";
import type { ManualSectionId, ManualViewState } from "./manual-state";
import { element, textElement } from "./render-elements";

const VIEW_TABS = [["battle", "战场"], ["manual", "战术手册"]] as const;
const MANUAL_TABS: readonly Readonly<{ id: ManualSectionId; label: string }>[] = [
  { id: "focus", label: "本关重点" },
  { id: "turn-command", label: "回合命令" },
  { id: "world", label: "World 数据" },
  { id: "actions", label: "动作函数" },
  { id: "sdk", label: "完整 SDK" },
];

export function renderViewTabs(viewState: ManualViewState): HTMLElement {
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

export function renderManual(snapshot: BattleViewSnapshot, viewState: ManualViewState): HTMLElement {
  const reference = snapshot.programReference;
  if (reference === undefined) throw new Error("Go reference is required for manual rendering");
  const stage = element("section", "manual-stage");
  stage.id = "manual-panel";
  stage.dataset.view = "manual";
  stage.setAttribute("role", "tabpanel");
  stage.setAttribute("aria-labelledby", "manual-tab");
  stage.append(renderManualTabs(viewState.sectionId), renderViewTabs(viewState), renderManualPanel(snapshot, viewState.sectionId, reference));
  stage.append(renderHiddenViewPanel("battle-panel", "battle", "battle-tab"));
  return stage;
}

export function renderHiddenViewPanel(id: "battle-panel" | "manual-panel", view: "battle" | "manual", labelledBy: string): HTMLElement {
  const panel = element("section", "view-panel-placeholder");
  panel.id = id;
  panel.dataset.view = view;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", labelledBy);
  panel.hidden = true;
  return panel;
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

function renderManualPanel(snapshot: BattleViewSnapshot, sectionId: ManualSectionId, reference: ProgramReference): HTMLElement {
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

function renderFocusSection(panel: HTMLElement, snapshot: BattleViewSnapshot, reference: ProgramReference): void {
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
