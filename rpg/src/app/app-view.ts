import type { AppController, AppFeedback, GameSnapshot } from "./app-controller";
import { mountCodeEditor } from "./code-editor";
import type { CodeEditorHandle } from "./code-editor";
import type { BattleState, BattleUnit } from "../game/combat/types";
import { RESET_CONFIRMATION } from "./save-store";

type GameShell = Readonly<{
  element: HTMLElement;
  level: HTMLSpanElement;
  runner: HTMLSpanElement;
  revision: HTMLSpanElement;
  phase: HTMLSpanElement;
  activeUnit: HTMLSpanElement;
  battlefield: HTMLElement;
  feedback: HTMLElement;
  run: HTMLButtonElement;
  interrupt: HTMLButtonElement;
  editor: CodeEditorHandle;
}>;

const RUNNER_LABELS = {
  connecting: "连接中",
  ready: "可运行",
  running: "运行中",
  unavailable: "不可用",
} as const;

const PHASE_LABELS = {
  in_progress: "进行中",
  won: "胜利",
  lost: "失败",
} as const;

const UNAVAILABLE_HINT = "启动 Runner 后刷新页面";

const GAME_SHELL_MARKUP = `
  <header class="status-rail">
    <div class="brand-lockup"><p>本地战术仪器</p><h1>Python RPG</h1></div>
    <dl class="status-track">
      <div><dt>关卡</dt><dd><span data-testid="current-level-id"></span></dd></div>
      <div><dt>回合</dt><dd>修订 <span data-testid="battle-revision"></span></dd></div>
      <div><dt>当前单位</dt><dd><span class="active-unit"></span></dd></div>
      <div><dt>Runner</dt><dd><span data-testid="runner-status"></span></dd></div>
    </dl>
  </header>
  <div class="workspace">
    <section class="battle-panel" aria-labelledby="battle-heading">
      <div class="panel-heading"><p>蓝图战场</p><h2 id="battle-heading">遭遇状态：<span data-testid="battle-phase"></span></h2></div>
      <div class="battlefield" role="grid" aria-label="Python 沼泽战场"></div>
    </section>
    <section class="editor-panel" aria-labelledby="editor-heading">
      <div class="panel-heading"><p>本地 Python</p><h2 id="editor-heading">回合程序</h2></div>
      <div data-testid="code-editor" class="code-editor"></div>
      <div class="action-row">
        <button data-testid="run-turn" class="run-turn" type="button">运行回合</button>
        <button data-testid="interrupt-run" class="interrupt-run" type="button" hidden>中断运行</button>
        <button class="reset-trigger" type="button">重置存档</button>
      </div>
    </section>
    <section data-testid="feedback" class="feedback-panel" aria-live="polite" aria-atomic="true"></section>
  </div>
  <dialog class="reset-dialog" aria-labelledby="reset-dialog-title">
    <form class="reset-form">
      <h2 id="reset-dialog-title">重置本地存档</h2>
      <p>此操作会丢弃当前战斗与代码草稿。请输入“重置存档”确认。</p>
      <label>确认文本<input name="confirmation" autocomplete="off" /></label>
      <div class="dialog-actions">
        <button data-dialog-close type="button">取消</button>
        <button data-reset-save type="submit" disabled>重置存档</button>
      </div>
    </form>
  </dialog>
`;

export function mountApp(root: HTMLElement, controller: AppController): () => void {
  let shell: GameShell | undefined;
  const unsubscribe = controller.subscribe((snapshot) => {
    if (snapshot.mode === "save_recovery") {
      shell?.editor.destroy();
      shell = undefined;
      renderRecovery(root, snapshot.message, controller);
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

function createGameShell(controller: AppController, snapshot: GameSnapshot): GameShell {
  const element = document.createElement("main");
  element.className = "app-shell";
  element.innerHTML = GAME_SHELL_MARKUP;

  const dialog = requiredElement<HTMLDialogElement>(element, ".reset-dialog");
  const resetInput = requiredElement<HTMLInputElement>(dialog, "input");
  const resetForm = requiredElement<HTMLFormElement>(dialog, "form");
  const resetButton = requiredElement<HTMLButtonElement>(dialog, "[data-reset-save]");
  requiredElement<HTMLButtonElement>(element, ".reset-trigger").addEventListener("click", () => dialog.showModal());
  requiredElement<HTMLButtonElement>(dialog, "[data-dialog-close]").addEventListener("click", () => dialog.close());
  wireResetConfirmation(resetForm, resetInput, resetButton, (confirmation) => {
    controller.resetSave(confirmation);
    dialog.close();
  });

  const editor = mountCodeEditor(requiredElement(element, "[data-testid='code-editor']"), snapshot.codeDraft, (code) => {
    controller.setCode(code);
  });
  const shell: GameShell = {
    element,
    level: requiredElement(element, "[data-testid='current-level-id']"),
    runner: requiredElement(element, "[data-testid='runner-status']"),
    revision: requiredElement(element, "[data-testid='battle-revision']"),
    phase: requiredElement(element, "[data-testid='battle-phase']"),
    activeUnit: requiredElement(element, ".active-unit"),
    battlefield: requiredElement(element, ".battlefield"),
    feedback: requiredElement(element, "[data-testid='feedback']"),
    run: requiredElement(element, "[data-testid='run-turn']"),
    interrupt: requiredElement(element, "[data-testid='interrupt-run']"),
    editor,
  };
  shell.run.addEventListener("click", () => void controller.runTurn());
  shell.interrupt.addEventListener("click", () => void controller.interrupt());
  return shell;
}

function updateGameShell(shell: GameShell, snapshot: GameSnapshot): void {
  const { battleState, runnerState } = snapshot;
  const running = runnerState === "running" || snapshot.activeRunId !== undefined;
  shell.level.textContent = snapshot.currentLevelId;
  shell.runner.textContent = RUNNER_LABELS[runnerState];
  shell.revision.textContent = String(battleState.revision);
  shell.phase.textContent = PHASE_LABELS[battleState.phase];
  shell.activeUnit.textContent = activeUnitId(battleState) ?? "无";
  shell.editor.setReadOnly(running);
  shell.editor.setValue(snapshot.codeDraft);
  shell.run.disabled = runnerState !== "ready" || running || battleState.phase !== "in_progress";
  shell.interrupt.hidden = !running;
  shell.interrupt.disabled = !running;
  renderBattlefield(shell.battlefield, battleState);
  renderFeedback(shell.feedback, snapshot.feedback, runnerState);
}

function renderRecovery(root: HTMLElement, message: string, controller: AppController): void {
  root.innerHTML = `
    <main class="recovery-shell">
      <section class="recovery-panel" aria-labelledby="recovery-heading">
        <p>本地存档恢复</p>
        <h1 id="recovery-heading">存档需要重置</h1>
        <div class="recovery-message" aria-live="polite"></div>
        <form class="reset-form">
          <label>确认文本<input name="confirmation" autocomplete="off" /></label>
          <button data-reset-save type="submit" disabled>重置存档</button>
        </form>
      </section>
    </main>
  `;
  requiredElement(root, ".recovery-message").textContent = message;
  const form = requiredElement<HTMLFormElement>(root, "form");
  const input = requiredElement<HTMLInputElement>(form, "input");
  const button = requiredElement<HTMLButtonElement>(form, "[data-reset-save]");
  wireResetConfirmation(form, input, button, (confirmation) => controller.resetSave(confirmation));
}

function wireResetConfirmation(
  form: HTMLFormElement,
  input: HTMLInputElement,
  button: HTMLButtonElement,
  confirm: (value: string) => void,
): void {
  const updateButton = (): void => {
    button.disabled = input.value !== RESET_CONFIRMATION;
  };
  input.addEventListener("input", updateButton);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value === RESET_CONFIRMATION) confirm(input.value);
  });
}

function renderBattlefield(container: HTMLElement, state: BattleState): void {
  const activeId = activeUnitId(state);
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
        marker.className = "battle-objective";
        marker.textContent = `${objective.id} · ${objective.completed ? "完成" : objective.durability}`;
        cell.append(marker);
      }
      for (const unit of units) cell.append(renderUnit(unit, unit.id === activeId));
      container.append(cell);
    }
  }
}

function renderUnit(unit: BattleUnit, isActive: boolean): HTMLElement {
  const element = document.createElement("article");
  element.className = `battle-unit${isActive ? " is-active" : ""}`;
  element.dataset.testid = `unit-${unit.id}`;
  element.textContent = `${unit.id} · ${unit.hp} / ${unit.maxHp}`;
  return element;
}

function renderFeedback(container: HTMLElement, feedback: AppFeedback, runnerState: GameSnapshot["runnerState"]): void {
  const messages = runnerState === "unavailable" && !feedback.messages.includes(UNAVAILABLE_HINT)
    ? [UNAVAILABLE_HINT, ...feedback.messages]
    : feedback.messages;
  container.className = `feedback-panel feedback-${feedback.kind}`;
  container.replaceChildren();
  if (feedback.title) container.append(createTextElement("h2", feedback.title));
  for (const message of messages) container.append(createTextElement("p", message));
  if (feedback.stdout) container.append(createOutput("标准输出", feedback.stdout));
  if (feedback.stderr) container.append(createOutput("错误输出", feedback.stderr));
  if (!feedback.title && messages.length === 0) {
    container.append(createTextElement("p", runnerState === "connecting" ? "正在连接本地 Runner。" : "等待下一条回合指令。"));
  }
}

function createOutput(label: string, value: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "feedback-output";
  wrapper.append(createTextElement("h3", label));
  const output = document.createElement("pre");
  output.textContent = value;
  wrapper.append(output);
  return wrapper;
}

function createTextElement(tag: "h2" | "h3" | "p", text: string): HTMLElement {
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

function activeUnitId(state: BattleState): string | undefined {
  return state.turnOrder[state.turnIndex];
}

function atCell(item: Readonly<{ cell: Readonly<{ x: number; y: number }> }>, x: number, y: number): boolean {
  return atCoordinates(item.cell, x, y);
}

function atCoordinates(cell: Readonly<{ x: number; y: number }>, x: number, y: number): boolean {
  return cell.x === x && cell.y === y;
}

function cellLabel(x: number, y: number, units: readonly BattleUnit[]): string {
  const occupants = units.length === 0 ? "空" : units.map((unit) => unit.id).join("、");
  return `坐标 ${x}, ${y}，单位：${occupants}`;
}

function requiredElement<T extends Element = HTMLElement>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing required view element: ${selector}`);
  return element;
}
