import type { AppController, GameSnapshot } from "./app-controller";
import { mountCodeEditor } from "./code-editor";
import type { CodeEditorHandle } from "./code-editor";
import type { BattleState, BattleUnit } from "../game/combat/types";
import { getLevel } from "../game/content/levels";
import type { LevelDefinition } from "../game/content/types";
import { RESET_CONFIRMATION } from "./save-store";

type GameShell = Readonly<{
  element: HTMLElement;
  controller: AppController;
  level: HTMLSpanElement;
  runner: HTMLSpanElement;
  revision: HTMLSpanElement;
  phase: HTMLSpanElement;
  activeUnit: HTMLSpanElement;
  battlefield: HTMLElement;
  battleDirective: HTMLElement;
  briefing: HTMLElement;
  apiHelp: HTMLElement;
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
    </section>
    <section class="editor-panel" aria-labelledby="editor-heading">
      <div class="panel-heading"><p>本地 Python</p><h2 id="editor-heading">回合程序</h2></div>
      <section class="mission-briefing" aria-labelledby="mission-heading">
        <div class="mission-heading"><p>任务简报</p><h2 id="mission-heading"></h2></div>
        <p data-testid="mission-summary" class="mission-summary"></p>
        <p class="mission-constraint"></p>
        <div class="skill-readout"><h3>Scout 能力</h3><ul data-testid="scout-skills"></ul></div>
      </section>
      <div data-testid="code-editor" class="code-editor"></div>
      <details class="api-help">
        <summary>API 提示</summary>
        <div class="api-help-body" data-testid="api-hints">
          <section class="api-help-group" aria-labelledby="api-command-fields-heading">
            <h3 id="api-command-fields-heading">命令外层字段</h3>
            <ul class="api-command-fields"></ul>
          </section>
          <section class="api-help-group" aria-labelledby="api-move-path-heading">
            <h3 id="api-move-path-heading">movePath</h3>
            <ul class="api-move-path"></ul>
          </section>
          <section class="api-help-group" aria-labelledby="api-action-fields-heading">
            <h3 id="api-action-fields-heading">action</h3>
            <ul class="api-action-fields"></ul>
          </section>
          <section class="api-help-group" aria-labelledby="api-level-rules-heading">
            <h3 id="api-level-rules-heading">本关规则</h3>
            <ul class="api-level-rules"></ul>
          </section>
        </div>
      </details>
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
    level: requiredElement(element, "[data-testid='current-level-id']"),
    runner: requiredElement(element, "[data-testid='runner-status']"),
    revision: requiredElement(element, "[data-testid='battle-revision']"),
    phase: requiredElement(element, "[data-testid='battle-phase']"),
    activeUnit: requiredElement(element, ".active-unit"),
    battlefield: requiredElement(element, ".battlefield"),
    battleDirective: requiredElement(element, ".battle-directive"),
    briefing: requiredElement(element, ".mission-briefing"),
    apiHelp: requiredElement(element, ".api-help"),
    feedback: requiredElement(element, "[data-testid='feedback']"),
    run: requiredElement(element, "[data-testid='run-turn']"),
    interrupt: requiredElement(element, "[data-testid='interrupt-run']"),
    reset,
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
  shell.runner.textContent = running ? RUNNER_LABELS.running : RUNNER_LABELS[runnerState];
  shell.revision.textContent = String(battleState.revision);
  shell.phase.textContent = PHASE_LABELS[battleState.phase];
  shell.activeUnit.textContent = activeUnitId(battleState) ?? "无";
  const settlement = settlementFor(snapshot);
  shell.editor.setReadOnly(running || settlement !== undefined);
  shell.editor.setValue(snapshot.codeDraft);
  shell.run.disabled = runnerState !== "ready" || running || settlement !== undefined || battleState.phase !== "in_progress";
  shell.interrupt.hidden = !running;
  shell.interrupt.disabled = !running;
  shell.reset.hidden = settlement !== undefined;
  renderBattlefield(shell.battlefield, battleState);
  renderBattleDirective(shell.battleDirective, getLevel(snapshot.currentLevelId), battleState, settlement);
  const level = getLevel(snapshot.currentLevelId);
  renderBriefing(shell.briefing, level, battleState);
  renderApiHelp(shell.apiHelp, level);
  renderFeedback(shell.feedback, snapshot, settlement, shell.controller);
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
  settlement: Settlement | undefined,
): void {
  requiredElement(container, "[data-testid='battle-objective-summary']").textContent = level.briefing[0] ?? "完成关卡目标。";
  requiredElement(container, "[data-testid='battle-action-hint']").textContent = settlement === undefined
    ? `当前行动：${activeUnitId(state) ?? "无"}。编辑 choose_turn(world)，返回一条指令后运行回合。`
    : "本场战斗已结算。你可以复盘最终战场与代码。";
  const keyObjectives = state.objectives.filter((objective) => objective.key);
  requiredElement(container, "[data-testid='battle-constraint']").textContent = keyObjectives.length === 0
    ? `失败约束：在 ${state.maxRounds} 回合内完成任务。`
    : `失败约束：保护${keyObjectives.map((objective) => objective.id).join("、")}并在 ${state.maxRounds} 回合内完成任务。`;
}

function renderBriefing(container: HTMLElement, level: LevelDefinition, state: BattleState): void {
  requiredElement(container, "#mission-heading").textContent = level.title;
  requiredElement(container, "[data-testid='mission-summary']").textContent = level.briefing.join(" ");
  const keyObjectives = state.objectives.filter((objective) => objective.key);
  const constraints = keyObjectives.length === 0
    ? `当前行动：${activeUnitId(state) ?? "无"} · 回合限制：${state.maxRounds}`
    : `当前行动：${activeUnitId(state) ?? "无"} · 回合限制：${state.maxRounds} · 保护${keyObjectives.map((objective) => objective.id).join("、")}`;
  requiredElement(container, ".mission-constraint").textContent = constraints;
  const scout = state.units.find((unit) => unit.id === "scout");
  renderTextList(requiredElement(container, "[data-testid='scout-skills']"), (scout?.skills ?? []).map((skill) => (
    skill.remainingCooldown === 0 ? `${skill.id} · 可用` : `${skill.id} · 冷却 ${skill.remainingCooldown} 回合`
  )));
}

function renderApiHelp(container: HTMLElement, level: LevelDefinition): void {
  const movePathExamples = level.guidance.commandExamples.filter((entry) => entry.includes("movePath"));
  const actionExamples = level.guidance.commandExamples.filter((entry) => !entry.includes("movePath"));
  const groups = [
    level.guidance.worldFields,
    movePathExamples,
    actionExamples,
    [...level.guidance.objective, ...level.guidance.concepts, ...level.guidance.levelRules],
  ];
  const selectors = [".api-command-fields", ".api-move-path", ".api-action-fields", ".api-level-rules"];
  for (const [index, selector] of selectors.entries()) {
    renderTextList(requiredElement(container, selector), groups[index] ?? []);
  }
}

function renderTextList(container: HTMLElement, values: readonly string[]): void {
  container.replaceChildren(...values.map((value) => createTextElement("li", value)));
}

function renderFeedback(container: HTMLElement, snapshot: GameSnapshot, settlement: Settlement | undefined, controller: AppController): void {
  const { feedback, runnerState } = snapshot;
  if (settlement !== undefined) {
    renderSettlement(container, settlement, controller);
    return;
  }
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

type Settlement = Readonly<{ kind: "failed" | "victory" | "complete"; messages: readonly string[] }>;

function settlementFor(snapshot: GameSnapshot): Settlement | undefined {
  const level = getLevel(snapshot.currentLevelId);
  const { battleState } = snapshot;
  const unmetObjectives = battleState.phase === "won"
    ? battleState.objectives.filter((objective) => !objective.key && !objective.completed).map((objective) => `${objective.id} 尚未激活`)
    : [];
  const lockedMessage = "代码已锁定，运行已禁用；可查看最终战场与代码。";
  if (battleState.phase === "lost") return { kind: "failed", messages: ["战斗失败。重试本关以保留当前代码。", lockedMessage] };
  if (unmetObjectives.length > 0) return { kind: "failed", messages: [...unmetObjectives.map((reason) => `任务失败：${reason}`), lockedMessage] };
  if (battleState.phase !== "won") return undefined;
  if (level.reward.type === "campaign-complete") return { kind: "complete", messages: ["沼心封印已经稳定。最终战场与代码保留供复盘。", lockedMessage] };
  return { kind: "victory", messages: [`获得新能力：${level.reward.abilityId}`, `完成于第 ${battleState.round} 回合。`, lockedMessage] };
}

function renderSettlement(container: HTMLElement, settlement: Settlement, controller: AppController): void {
  container.className = `feedback-panel settlement-panel settlement-${settlement.kind}`;
  container.replaceChildren();
  const heading = settlement.kind === "failed" ? "任务失败" : settlement.kind === "complete" ? "战役完成" : "关卡完成";
  const section = document.createElement("section");
  section.dataset.testid = `settlement-${settlement.kind}`;
  section.append(createTextElement("h2", heading));
  for (const message of settlement.messages) section.append(createTextElement("p", message));
  const actions = document.createElement("div");
  actions.className = "settlement-actions";
  if (settlement.kind === "failed") {
    actions.append(createAction("retry-level", "重试本关", () => controller.retryLevel()));
  } else if (settlement.kind === "victory") {
    actions.append(
      createAction("advance-level", "进入下一关", () => controller.advanceLevel()),
      createAction("retry-level", "重试本关", () => controller.retryLevel()),
    );
  } else {
    actions.append(createAction("campaign-reset", "重置存档", () => {
      requiredElement<HTMLButtonElement>(container.closest(".app-shell")!, ".reset-trigger").click();
    }));
  }
  section.append(actions);
  container.append(section);
}

function createAction(testId: string, label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.testid = testId;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
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

function createTextElement(tag: "h2" | "h3" | "p" | "li", text: string): HTMLElement {
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
