import "./styles.css";
import "./styles-exploration.css";
import type { BattleViewSnapshot, ExtensionMessage, ThemePreference, WebviewCommand } from "../messages";
import { renderExploration } from "./render-exploration";
import { calculateCellSize, renderGame } from "./render-game";
import {
  resolveManualView,
  resolveReferenceSection,
  type ManualSectionId,
  type ManualViewState,
  type PersistedManualState,
} from "./manual-state";

type VsCodeApi = Readonly<{
  postMessage(message: WebviewCommand): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}>;

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const gameRoot = document.querySelector<HTMLElement>("#game-root");
if (gameRoot === null) throw new Error("Missing #game-root");
const root: HTMLElement = gameRoot;

let resizeObserver: ResizeObserver | undefined;
let previousSnapshot: BattleViewSnapshot | undefined;
let latestSnapshot: BattleViewSnapshot | undefined;
let persistedState = vscode.getState<PersistedManualState>();
let manualViewState: ManualViewState | undefined = persistedState === undefined
  ? undefined
  : { view: persistedState.view, sectionId: persistedState.sectionId };

window.addEventListener("message", (event: MessageEvent<ExtensionMessage>) => {
  const message = event.data;
  if (message.type !== "snapshot") return;
  if (message.snapshot.mode === "recovery") {
    previousSnapshot = undefined;
    latestSnapshot = undefined;
    manualViewState = undefined;
    renderRecovery(message.snapshot.message, message.snapshot.theme);
    return;
  }
  if (message.snapshot.mode === "exploration") {
    previousSnapshot = undefined;
    latestSnapshot = undefined;
    manualViewState = undefined;
    renderExploration(root, message.snapshot);
    resizeObserver?.disconnect();
    return;
  }
  previousSnapshot = latestSnapshot;
  latestSnapshot = message.snapshot;
  manualViewState = resolveManualView(manualViewState, {
    levelId: message.snapshot.level.id,
    revision: message.snapshot.battleState.revision,
    hasReference: message.snapshot.programReference !== undefined,
  }, {
    previousRevision: previousSnapshot?.battleState.revision,
    previousLevelId: previousSnapshot?.level.id,
    persistedLevelId: persistedState?.levelId,
  });
  persistManualState(message.snapshot.level.id);
  renderGame(root, message.snapshot, manualViewState);
  observeBattlefield();
});

root.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const localCommand = target.closest<HTMLElement>("[data-local-command]");
  if (localCommand?.dataset.localCommand === "openManualReference") {
    openManualReference(localCommand.dataset.referenceId);
    return;
  }
  const viewTab = target.closest<HTMLButtonElement>("[role='tab'][data-view]");
  if (viewTab !== null && viewTab.closest("[data-view-tabs]") !== null) {
    activateViewTab(viewTab);
    return;
  }
  const manualTab = target.closest<HTMLButtonElement>("[role='tab'][data-section]");
  if (manualTab !== null && manualTab.closest("[data-manual-tabs]") !== null) {
    activateManualTab(manualTab);
    return;
  }
  const button = target.closest<HTMLButtonElement>("button[data-command]");
  if (button === null) return;
  const command = button.dataset.command;
  if (command === "setTheme") {
    const theme = button.dataset.theme as ThemePreference | undefined;
    if (theme !== undefined) vscode.postMessage({ type: "setTheme", theme });
    return;
  }
  if (isSimpleCommand(command)) vscode.postMessage({ type: command });
});

root.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const tab = target.closest<HTMLButtonElement>("[role='tab']");
  if (tab === null) return;
  const tablist = tab.closest<HTMLElement>("[role='tablist']");
  if (tablist === null) return;
  const tabs = [...tablist.querySelectorAll<HTMLButtonElement>("[role='tab']")];
  const currentIndex = tabs.indexOf(tab);
  if (currentIndex < 0) return;
  const narrow = window.innerWidth <= 720;
  const forward = narrow ? event.key === "ArrowRight" : event.key === "ArrowDown";
  const backward = narrow ? event.key === "ArrowLeft" : event.key === "ArrowUp";
  if (forward || backward) {
    event.preventDefault();
    const nextIndex = (currentIndex + (forward ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex]?.focus();
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (tab.dataset.view !== undefined) activateViewTab(tab);
    else activateManualTab(tab);
  }
});

vscode.postMessage({ type: "ready" });

function activateViewTab(tab: HTMLButtonElement): void {
  const view = tab.dataset.view;
  if (view !== "battle" && view !== "manual") return;
  updateManualView({ view, sectionId: manualViewState?.sectionId ?? "focus" }, "view");
}

function activateManualTab(tab: HTMLButtonElement): void {
  const sectionId = tab.dataset.section as ManualSectionId | undefined;
  if (sectionId === undefined || !isManualSection(sectionId)) return;
  updateManualView({ view: "manual", sectionId }, "section");
}

function openManualReference(referenceId: string | undefined): void {
  const id = referenceId ?? latestSnapshot?.feedback.relatedReferenceIds?.[0];
  const sectionId = id === undefined ? "turn-command" : resolveReferenceSection(id);
  updateManualView({ view: "manual", sectionId }, "reference", id);
}

function updateManualView(next: ManualViewState, focusMode: "view" | "section" | "reference", referenceId?: string): void {
  manualViewState = next;
  if (latestSnapshot === undefined) return;
  persistManualState(latestSnapshot.level.id);
  renderGame(root, latestSnapshot, manualViewState);
  observeBattlefield();
  if (focusMode === "reference" && referenceId !== undefined) {
    const entry = [...root.querySelectorAll<HTMLElement>("[data-reference-id]")]
      .find((candidate) => candidate.dataset.referenceId === referenceId);
    const target = entry?.querySelector<HTMLElement>("[tabindex='-1']");
    if (target !== null && target !== undefined) {
      target.focus();
      return;
    }
  }
  if (focusMode === "reference") {
    root.querySelector<HTMLElement>("[data-manual-heading]")?.focus();
    return;
  }
  if (focusMode === "section" || (focusMode === "view" && next.view === "manual")) {
    root.querySelector<HTMLElement>("[data-manual-heading]")?.focus();
    return;
  }
  root.querySelector<HTMLElement>("[data-view='battle'] .turn-line")?.focus();
}

function persistManualState(levelId: string): void {
  if (manualViewState === undefined) return;
  persistedState = { levelId, view: manualViewState.view, sectionId: manualViewState.sectionId };
  vscode.setState(persistedState);
}

function isManualSection(value: string): value is ManualSectionId {
  return value === "focus"
    || value === "turn-command"
    || value === "world"
    || value === "actions"
    || value === "sdk";
}

function observeBattlefield(): void {
  resizeObserver?.disconnect();
  const stage = root.querySelector<HTMLElement>(".battle-stage");
  const frame = root.querySelector<HTMLElement>(".battle-frame");
  if (stage === null || frame === null) return;
  const columns = Number(frame.dataset.columns);
  const rows = Number(frame.dataset.rows);
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry === undefined) return;
    const availableWidth = Math.max(0, entry.contentRect.width - 32);
    const availableHeight = Math.max(0, entry.contentRect.height - 62);
    frame.style.setProperty("--cell-size", `${calculateCellSize(availableWidth, availableHeight, columns, rows)}px`);
  });
  resizeObserver.observe(stage);
}

function renderRecovery(message: string, theme: ThemePreference): void {
  resizeObserver?.disconnect();
  root.dataset.theme = theme;
  root.className = "game-view recovery-view";
  const panel = document.createElement("section");
  panel.className = "recovery-panel";
  const kicker = document.createElement("p");
  kicker.className = "game-kicker";
  kicker.textContent = "本地存档恢复";
  const heading = document.createElement("h1");
  heading.textContent = "战役状态无法读取";
  const detail = document.createElement("p");
  detail.textContent = message;
  const reset = document.createElement("button");
  reset.type = "button";
  reset.dataset.command = "resetCampaign";
  reset.textContent = "重置战役";
  panel.append(kicker, heading, detail, reset);
  root.replaceChildren(panel);
}

function isSimpleCommand(value: string | undefined): value is Exclude<WebviewCommand["type"], "setTheme"> {
  return value === "ready"
    || value === "runTurn"
    || value === "interruptRun"
    || value === "retryLevel"
    || value === "advanceLevel"
    || value === "resetCampaign";
}
