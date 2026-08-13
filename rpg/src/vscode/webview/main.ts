import "./styles.css";
import type { ExtensionMessage, ThemePreference, WebviewCommand } from "../messages";
import { calculateCellSize, renderGame } from "./render-game";

type VsCodeApi = Readonly<{
  postMessage(message: WebviewCommand): void;
}>;

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const gameRoot = document.querySelector<HTMLElement>("#game-root");
if (gameRoot === null) throw new Error("Missing #game-root");
const root: HTMLElement = gameRoot;

let resizeObserver: ResizeObserver | undefined;

window.addEventListener("message", (event: MessageEvent<ExtensionMessage>) => {
  const message = event.data;
  if (message.type !== "snapshot") return;
  if (message.snapshot.mode === "save_recovery") {
    renderRecovery(message.snapshot.message, message.snapshot.theme);
    return;
  }
  renderGame(root, message.snapshot);
  observeBattlefield();
});

root.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
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

vscode.postMessage({ type: "ready" });

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
