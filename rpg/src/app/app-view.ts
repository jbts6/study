import type { GameSnapshot, SaveRecoverySnapshot } from "./app-controller";
import { mountCodeEditor } from "./code-editor";
import type { CodeEditorHandle } from "./code-editor";
import type { ControllerSnapshot, GameController, WorldExplorationSnapshot, WorldRecoverySnapshot } from "./controller-types";
import { RESET_CONFIRMATION } from "./save-store";
import { renderBattleApp, renderBattleFeedback, type BattleSettlement } from "./render-battle-app";
import { renderWorldApp, renderWorldFeedback } from "./render-world-app";

type ActiveSnapshot = GameSnapshot | WorldExplorationSnapshot | Extract<ControllerSnapshot, { mode: "battle" }>;

type GameShell = Readonly<{
  element: HTMLElement;
  controller: GameController;
  statusLevelLabel: HTMLElement;
  statusLevel: HTMLElement;
  statusRevisionLabel: HTMLElement;
  statusRevision: HTMLElement;
  statusFocusLabel: HTMLElement;
  statusFocus: HTMLElement;
  runner: HTMLElement;
  scene: HTMLElement;
  briefing: HTMLElement;
  apiHelp: HTMLDetailsElement;
  editorHeading: HTMLElement;
  feedback: HTMLElement;
  run: HTMLButtonElement;
  interrupt: HTMLButtonElement;
  reset: HTMLButtonElement;
  editor: CodeEditorHandle;
}>;

const RUNNER_LABELS = {
  connecting: "连接中",
  ready: "可运行",
  running: "运行中",
  unavailable: "不可用",
} as const;

const APP_SHELL_MARKUP = `
  <header class="status-rail">
    <div class="brand-lockup"><p>本地战术仪器</p><h1>Python RPG</h1></div>
    <dl class="status-track">
      <div><dt data-testid="status-level-label">关卡</dt><dd><span data-testid="current-level-id"></span></dd></div>
      <div><dt data-testid="status-revision-label">回合</dt><dd>修订 <span data-testid="battle-revision"></span></dd></div>
      <div><dt data-testid="status-focus-label">当前单位</dt><dd><span class="active-unit"></span></dd></div>
      <div><dt>Runner</dt><dd><span data-testid="runner-status"></span></dd></div>
    </dl>
  </header>
  <div class="workspace">
    <section data-testid="scene-panel" class="battle-panel"></section>
    <section class="editor-panel" aria-labelledby="editor-heading">
      <div class="panel-heading"><p>本地 Python</p><h2 id="editor-heading" data-testid="editor-heading"></h2></div>
      <section data-testid="mode-briefing" class="mission-briefing"></section>
      <div data-testid="code-editor" class="code-editor"></div>
      <details data-testid="mode-help" class="api-help"></details>
      <div class="action-row">
        <button data-testid="run-turn" class="run-turn" type="button">运行 Python</button>
        <button data-testid="interrupt-run" class="interrupt-run" type="button" hidden>中断运行</button>
        <button class="reset-trigger" type="button">重置存档</button>
      </div>
    </section>
    <section data-testid="feedback" class="feedback-panel" aria-live="polite" aria-atomic="true"></section>
  </div>
  <dialog class="reset-dialog" aria-labelledby="reset-dialog-title">
    <form class="reset-form">
      <h2 id="reset-dialog-title">重置本地存档</h2>
      <p>此操作会丢弃当前战役与代码草稿。请输入“重置存档”确认。</p>
      <label>确认文本<input name="confirmation" autocomplete="off" /></label>
      <div class="dialog-actions">
        <button data-dialog-close type="button">取消</button>
        <button data-reset-save type="submit" disabled>重置存档</button>
      </div>
    </form>
  </dialog>
`;

export function mountApp(root: HTMLElement, controller: GameController): () => void {
  let shell: GameShell | undefined;
  const unsubscribe = controller.subscribe((snapshot) => {
    if (isRecoverySnapshot(snapshot)) {
      shell?.editor.destroy();
      shell = undefined;
      renderRecovery(root, snapshot, controller);
      return;
    }
    if (shell === undefined) {
      root.replaceChildren();
      shell = createGameShell(controller, snapshot);
      root.append(shell.element);
    }
    updateGameShell(shell, snapshot);
  });

  return () => {
    unsubscribe();
    shell?.editor.destroy();
    root.replaceChildren();
  };
}

function createGameShell(controller: GameController, snapshot: ActiveSnapshot): GameShell {
  const element = document.createElement("main");
  element.className = "app-shell";
  element.innerHTML = APP_SHELL_MARKUP;
  const dialog = requiredElement<HTMLDialogElement>(element, ".reset-dialog");
  const resetInput = requiredElement<HTMLInputElement>(dialog, "input");
  const resetForm = requiredElement<HTMLFormElement>(dialog, "form");
  const resetButton = requiredElement<HTMLButtonElement>(dialog, "[data-reset-save]");
  const reset = requiredElement<HTMLButtonElement>(element, ".reset-trigger");
  reset.addEventListener("click", () => dialog.showModal());
  requiredElement<HTMLButtonElement>(dialog, "[data-dialog-close]").addEventListener("click", () => dialog.close());
  wireResetConfirmation(resetForm, resetInput, resetButton, (confirmation) => {
    controller.resetSave(confirmation);
    dialog.close();
  });
  const editor = mountCodeEditor(
    requiredElement(element, "[data-testid='code-editor']"),
    snapshot.codeDraft,
    controller.campaign.program.language,
    (code) => controller.setCode(code),
  );
  const shell: GameShell = {
    element,
    controller,
    statusLevelLabel: requiredElement(element, "[data-testid='status-level-label']"),
    statusLevel: requiredElement(element, "[data-testid='current-level-id']"),
    statusRevisionLabel: requiredElement(element, "[data-testid='status-revision-label']"),
    statusRevision: requiredElement(element, "[data-testid='battle-revision']"),
    statusFocusLabel: requiredElement(element, "[data-testid='status-focus-label']"),
    statusFocus: requiredElement(element, ".active-unit"),
    runner: requiredElement(element, "[data-testid='runner-status']"),
    scene: requiredElement(element, "[data-testid='scene-panel']"),
    briefing: requiredElement(element, "[data-testid='mode-briefing']"),
    apiHelp: requiredElement<HTMLDetailsElement>(element, "[data-testid='mode-help']"),
    editorHeading: requiredElement(element, "[data-testid='editor-heading']"),
    feedback: requiredElement(element, "[data-testid='feedback']"),
    run: requiredElement<HTMLButtonElement>(element, "[data-testid='run-turn']"),
    interrupt: requiredElement<HTMLButtonElement>(element, "[data-testid='interrupt-run']"),
    reset,
    editor,
  };
  shell.run.addEventListener("click", () => void controller.runCode(shell.editor.getValue()));
  shell.interrupt.addEventListener("click", () => void controller.interrupt());
  return shell;
}

function updateGameShell(shell: GameShell, snapshot: ActiveSnapshot): void {
  const running = snapshot.runnerState === "running" || snapshot.activeRunId !== undefined;
  let settlement: BattleSettlement | undefined;
  if (snapshot.mode === "exploration") {
    renderWorldApp(shell.scene, shell.briefing, shell.apiHelp, snapshot);
    renderWorldFeedback(shell.feedback, snapshot);
    shell.editorHeading.textContent = "探索程序";
    shell.statusLevelLabel.textContent = "章节";
    shell.statusLevel.textContent = snapshot.gameState.chapterId;
    shell.statusRevisionLabel.textContent = "世界";
    shell.statusRevision.textContent = String(snapshot.gameState.revision);
    shell.statusFocusLabel.textContent = "当前位置";
    shell.statusFocus.textContent = snapshot.worldView.location.name;
    shell.run.textContent = "运行探索";
  } else {
    settlement = renderBattleApp(shell.scene, shell.briefing, shell.apiHelp, snapshot);
    renderBattleFeedback(shell.feedback, snapshot, settlement, shell.controller);
    shell.editorHeading.textContent = "回合程序";
    shell.statusLevelLabel.textContent = "关卡";
    shell.statusLevel.textContent = snapshot.mode === "game" ? snapshot.currentLevelId : snapshot.battleLevelId;
    shell.statusRevisionLabel.textContent = "回合";
    shell.statusRevision.textContent = String(snapshot.battleState.revision);
    shell.statusFocusLabel.textContent = "当前单位";
    shell.statusFocus.textContent = snapshot.battleState.turnOrder[snapshot.battleState.turnIndex] ?? "无";
    shell.run.textContent = "运行回合";
  }

  shell.runner.textContent = running ? RUNNER_LABELS.running : RUNNER_LABELS[snapshot.runnerState];
  shell.editor.setReadOnly(running || settlement !== undefined);
  shell.editor.setValue(snapshot.codeDraft);
  shell.run.disabled = snapshot.runnerState !== "ready"
    || running
    || settlement !== undefined
    || (snapshot.mode !== "exploration" && snapshot.battleState.phase !== "in_progress");
  shell.interrupt.hidden = !running;
  shell.interrupt.disabled = !running;
  shell.reset.hidden = settlement !== undefined;
}

function renderRecovery(
  root: HTMLElement,
  snapshot: SaveRecoverySnapshot | WorldRecoverySnapshot,
  controller: GameController,
): void {
  root.innerHTML = `
    <main class="recovery-shell">
      <section class="recovery-panel" aria-labelledby="recovery-heading">
        <p>本地存档恢复</p>
        <h1 id="recovery-heading">存档需要重置</h1>
        <div class="recovery-message" aria-live="polite"></div>
        <div data-testid="legacy-code-slot"></div>
        <form class="reset-form">
          <label>确认文本<input name="confirmation" autocomplete="off" /></label>
          <button data-reset-save type="submit" disabled>重置存档</button>
        </form>
      </section>
    </main>
  `;
  requiredElement(root, ".recovery-message").textContent = snapshot.message;
  const legacyCode = "legacyCodeDraft" in snapshot ? snapshot.legacyCodeDraft : undefined;
  if (legacyCode !== undefined) renderLegacyCode(requiredElement(root, "[data-testid='legacy-code-slot']"), legacyCode);
  const form = requiredElement<HTMLFormElement>(root, "form");
  const input = requiredElement<HTMLInputElement>(form, "input");
  const button = requiredElement<HTMLButtonElement>(form, "[data-reset-save]");
  wireResetConfirmation(form, input, button, (confirmation) => controller.resetSave(confirmation));
}

function renderLegacyCode(container: HTMLElement, code: string): void {
  const wrapper = document.createElement("section");
  wrapper.className = "legacy-code-export";
  const heading = document.createElement("h2");
  heading.textContent = "旧版代码备份";
  const area = document.createElement("textarea");
  area.dataset.testid = "legacy-code";
  area.readOnly = true;
  area.value = code;
  const download = document.createElement("button");
  download.type = "button";
  download.dataset.testid = "download-legacy-code";
  download.textContent = "下载旧代码";
  download.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = `data:text/plain;charset=utf-8,${encodeURIComponent(code)}`;
    link.download = "python-rpg-legacy.py";
    link.click();
  });
  wrapper.append(heading, area, download);
  container.append(wrapper);
}

function wireResetConfirmation(
  form: HTMLFormElement,
  input: HTMLInputElement,
  button: HTMLButtonElement,
  confirm: (value: string) => void,
): void {
  const updateButton = (): void => { button.disabled = input.value !== RESET_CONFIRMATION; };
  input.addEventListener("input", updateButton);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value === RESET_CONFIRMATION) confirm(input.value);
  });
}

function isRecoverySnapshot(snapshot: ControllerSnapshot): snapshot is SaveRecoverySnapshot | WorldRecoverySnapshot {
  return snapshot.mode === "save_recovery" || snapshot.mode === "world_recovery";
}

function requiredElement<T extends Element = HTMLElement>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing required app element: ${selector}`);
  return element;
}
