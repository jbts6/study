import type { Course, CourseState, ExecuteResult, Lesson } from "./model";

export interface AppShell {
  root: HTMLElement;
  courseTitle: HTMLElement;
  lessonNav: HTMLElement;
  lessonKicker: HTMLElement;
  lessonTitle: HTMLElement;
  lessonGoal: HTMLElement;
  explanation: HTMLElement;
  example: HTMLElement;
  exerciseGoal: HTMLElement;
  hints: HTMLElement;
  editorHost: HTMLElement;
  runButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  resultPanel: HTMLElement;
}

export function createAppShell(root: HTMLElement): AppShell {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-lockup"><span class="brand-mark">GO</span><span>交互式课程</span></div>
        <div class="topbar-context"><span class="status-dot"></span><span>本地学习空间</span></div>
      </header>
      <div class="course-grid">
        <aside class="course-nav" aria-label="课程目录">
          <div class="nav-heading"><span class="eyebrow">COURSE 01</span><h2 data-course-title>Go 起步</h2></div>
          <ol class="lesson-list" data-lesson-nav></ol>
          <div class="nav-footer"><span class="nav-footer__label">学习进度</span><span data-progress>0 / 0</span></div>
        </aside>
        <main class="lesson-main">
          <div class="lesson-content">
            <div class="lesson-kicker" data-lesson-kicker></div>
            <h1 data-lesson-title></h1>
            <p class="lesson-goal" data-lesson-goal></p>
            <div class="explanation" data-explanation></div>
            <section class="example-section"><div class="section-label">示例</div><pre class="code-example"><code data-example></code></pre></section>
            <section class="exercise-section"><div class="section-label">练习目标</div><p data-exercise-goal></p></section>
            <section class="hint-section"><div class="section-label">提示</div><ol data-hints></ol></section>
          </div>
          <section class="editor-panel" aria-label="代码编辑器">
            <div class="editor-toolbar"><div><span class="section-label">编辑器</span><span class="editor-file">main.go</span></div><div class="editor-actions"><button type="button" class="button button-secondary" data-reset>重置</button><button type="button" class="button button-primary" data-run>运行代码</button></div></div>
            <div class="editor-host" data-editor></div>
          </section>
        </main>
        <aside class="result-panel" aria-live="polite" data-result-panel></aside>
      </div>
    </div>`;

  return {
    root,
    courseTitle: required(root, "[data-course-title]"),
    lessonNav: required(root, "[data-lesson-nav]"),
    lessonKicker: required(root, "[data-lesson-kicker]"),
    lessonTitle: required(root, "[data-lesson-title]"),
    lessonGoal: required(root, "[data-lesson-goal]"),
    explanation: required(root, "[data-explanation]"),
    example: required(root, "[data-example]"),
    exerciseGoal: required(root, "[data-exercise-goal]"),
    hints: required(root, "[data-hints]"),
    editorHost: required(root, "[data-editor]"),
    runButton: requiredButton(root, "[data-run]"),
    resetButton: requiredButton(root, "[data-reset]"),
    resultPanel: required(root, "[data-result-panel]"),
  };
}

export function renderApp(elements: AppShell, course: Course, state: CourseState): void {
  elements.courseTitle.textContent = course.title;
  elements.lessonNav.innerHTML = course.lessons.map((lesson, index) => renderLessonNavItem(lesson, index, course, state)).join("");
  const lesson = course.lessons.find((item) => item.id === state.selectedLessonId) ?? course.lessons[0];
  if (!lesson) return;

  elements.lessonKicker.textContent = `第 ${String(course.lessons.indexOf(lesson) + 1).padStart(2, "0")} 节 / ${course.lessons.length} 节`;
  elements.lessonTitle.textContent = lesson.title;
  elements.lessonGoal.textContent = lesson.goal;
  renderParagraphs(elements.explanation, lesson.explanation);
  elements.example.textContent = lesson.exampleCode;
  elements.exerciseGoal.textContent = lesson.exerciseGoal;
  elements.hints.innerHTML = lesson.hints.map((hint) => `<li>${escapeHTML(hint)}</li>`).join("");
  elements.runButton.disabled = state.run.status === "running";
  elements.resetButton.disabled = state.run.status === "running";
  renderResult(elements.resultPanel, state.run.status === "idle" ? undefined : state.run.status === "running" ? undefined : state.run.result, state.run.status);
}

export function renderLoading(root: HTMLElement): void {
  root.innerHTML = `<div class="loading-state"><span class="loading-line"></span><p>正在加载课程内容</p></div>`;
}

export function renderFatalError(root: HTMLElement, message: string): void {
  root.innerHTML = `<div class="fatal-state"><span class="eyebrow">SERVICE STATUS</span><h1>课程暂时无法加载</h1><p>${escapeHTML(message)}</p></div>`;
}

function renderLessonNavItem(lesson: Lesson, index: number, course: Course, state: CourseState): string {
  const lessonIndex = course.lessons.indexOf(lesson);
  const recommended = lessonIndex === 0 || state.completedLessonIds.includes(course.lessons[lessonIndex - 1].id);
  const completed = state.completedLessonIds.includes(lesson.id);
  const selected = state.selectedLessonId === lesson.id;
  const status = completed ? "完成" : recommended ? "开始" : "建议先完成上一节";
  return `<li><button type="button" class="lesson-link${selected ? " is-selected" : ""}" data-lesson-id="${escapeHTML(lesson.id)}"${selected ? " aria-current=\"step\"" : ""}><span class="lesson-number">${String(index + 1).padStart(2, "0")}</span><span class="lesson-link__title">${escapeHTML(lesson.title)}</span><span class="lesson-link__status">${status}</span></button></li>`;
}

function renderResult(panel: HTMLElement, result: ExecuteResult | undefined, status: CourseState["run"]["status"]): void {
  if (status === "running") {
    panel.dataset.status = "running";
    panel.innerHTML = `<div class="result-heading"><span class="eyebrow">RUN STATUS</span><h2 data-run-state>运行中</h2></div><div class="running-state"><span class="running-bar"></span><p>正在编译并运行测试</p></div><div data-diagnostics></div><div data-test-results></div>`;
    return;
  }
  if (!result) {
    panel.dataset.status = "idle";
    panel.innerHTML = `<div class="result-heading"><span class="eyebrow">RUN RESULT</span><h2 data-run-state>等待运行</h2></div><p class="result-empty">完成练习后运行代码，结果会显示在这里。</p><div data-diagnostics></div><div data-test-results></div>`;
    return;
  }

  panel.dataset.status = result.status;
  const meta = statusMeta(result.status);
  const diagnosticHTML = result.diagnostics.length === 0
    ? `<div data-diagnostics></div>`
    : `<section class="result-section diagnostics" data-diagnostics><div class="section-label">编译诊断</div>${result.diagnostics.map((diagnostic) => `<p><span class="diagnostic-location">第 ${diagnostic.line ?? "?"} 行${diagnostic.column ? `，第 ${diagnostic.column} 列` : ""}</span>${escapeHTML(diagnostic.message)}</p>`).join("")}</section>`;
  const testHTML = `<section class="result-section" data-test-results><div class="section-label">测试结果</div>${result.tests.length === 0 ? "<p class=\"muted\">暂无测试结果</p>" : result.tests.map((test) => `<div class="test-result"><span class="test-result__mark">${test.status === "passed" ? "通过" : "失败"}</span><div><strong>${escapeHTML(test.name)}</strong>${test.message ? `<p>${escapeHTML(test.message)}</p>` : ""}</div></div>`).join("")}</section>`;
  panel.innerHTML = `<div class="result-heading"><span class="eyebrow">RUN RESULT</span><h2 data-run-state>${meta.title}</h2><p class="result-summary">${meta.summary}</p></div>${diagnosticHTML}${testHTML}${result.stdout ? `<section class="result-section"><div class="section-label">标准输出</div><pre class="result-output">${escapeHTML(result.stdout)}</pre></section>` : ""}${result.stderr ? `<section class="result-section"><div class="section-label">提示</div><p class="result-stderr">${escapeHTML(result.stderr)}</p></section>` : ""}`;
}

function renderParagraphs(container: HTMLElement, text: string): void {
  container.innerHTML = text.split(/\n\s*\n/).map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join("");
}

function statusMeta(status: ExecuteResult["status"]): { title: string; summary: string } {
  switch (status) {
    case "passed": return { title: "通过", summary: "这节练习已经完成，可以继续下一节。" };
    case "compile_error": return { title: "编译错误", summary: "代码还没有通过编译，请根据行号检查。" };
    case "test_failed": return { title: "测试未通过", summary: "程序可以编译，但结果和练习要求不一致。" };
    case "timeout": return { title: "执行超时", summary: "程序没有在限定时间内结束。" };
    case "runner_unavailable": return { title: "执行服务不可用", summary: "后端执行器暂时无法连接。" };
    case "invalid_request": return { title: "请求无效", summary: "提交内容不符合当前练习要求。" };
  }
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function required(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`missing app element: ${selector}`);
  return element;
}

function requiredButton(root: ParentNode, selector: string): HTMLButtonElement {
  const element = root.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`missing app button: ${selector}`);
  return element;
}
