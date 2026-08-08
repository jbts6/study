import { createStore } from './store.js';

export function canOpenLesson(course, state, lessonId) {
  const lessons = Array.isArray(course?.lessons) ? course.lessons : [];
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return false;
  if (index === 0) return true;
  const passed = new Set(Array.isArray(state?.passed) ? state.passed : []);
  return passed.has(lessons[index - 1].id);
}

export function executionPresentation(result = {}) {
  const messages = {
    passed: ['success', '本课通过', '隐藏测试全部通过，可以继续下一课。'],
    compile_error: ['error', '编译失败', '先根据诊断修正代码，再次运行。'],
    test_failed: ['error', '测试未通过', '代码已编译，但至少一个行为测试没有通过。'],
    timeout: ['warning', '运行超时', '代码超过时间限制，检查是否存在阻塞或无限循环。'],
    runner_unavailable: ['warning', '运行器不可用', '请确认本机 Rust 工具链已安装，并从课程目录启动服务。'],
    invalid_request: ['error', '请求无效', '检查当前课节和代码内容后重试。'],
  };
  const [tone, title, message] = messages[result.status] || ['idle', '等待运行', '编辑代码后运行本课练习。'];
  return { tone, title, message };
}

export function createCourseApp({
  document = globalThis.document,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  store = createStore(),
} = {}) {
  if (!document || typeof document.getElementById !== 'function') {
    throw new TypeError('document is required');
  }
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl is required');
  }

  const refs = {
    nav: document.getElementById('courseNav'),
    progress: document.getElementById('progressText'),
    main: document.getElementById('lessonMain'),
    storageNotice: document.getElementById('storageNotice'),
    title: document.getElementById('courseTitle'),
    error: document.getElementById('courseError'),
  };
  let course = null;
  let state = store.load();
  let activeLesson = null;
  let lastResult = null;

  async function load() {
    setPageState('loading');
    try {
      const response = await fetchImpl('/api/course');
      if (!response.ok) throw new Error(`课程加载失败 (${response.status})`);
      course = await response.json();
      if (!Array.isArray(course.lessons) || course.lessons.length === 0) {
        throw new Error('课程没有可用课节');
      }
      state = store.load();
      const saved = course.lessons.find((lesson) => lesson.id === state.currentLessonId);
      const firstOpen = course.lessons.find((lesson) => canOpenLesson(course, state, lesson.id));
      activeLesson = saved && canOpenLesson(course, state, saved.id) ? saved : firstOpen;
      state = store.setCurrentLesson(activeLesson.id) || { ...state, currentLessonId: activeLesson.id };
      render();
      setPageState('ready');
      return course;
    } catch (error) {
      setPageState('error', error.message);
      throw error;
    }
  }

  function selectLesson(lessonId) {
    if (!course || !canOpenLesson(course, state, lessonId)) return false;
    activeLesson = course.lessons.find((lesson) => lesson.id === lessonId);
    state = store.setCurrentLesson(lessonId) || { ...state, currentLessonId: lessonId };
    lastResult = null;
    render();
    return true;
  }

  async function runActive() {
    if (!activeLesson) return null;
    const editor = document.getElementById('editor');
    const runButton = document.getElementById('runButton');
    const output = document.getElementById('output');
    const status = document.getElementById('lessonStatus');
    const code = editor?.value || '';
    store.setDraft(activeLesson.id, code);
    if (runButton) {
      runButton.disabled = true;
      runButton.textContent = '运行中...';
    }
    if (status) {
      status.dataset.tone = 'running';
      status.textContent = '正在运行 Rust 测试...';
    }
    try {
      const response = await fetchImpl('/api/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonId: activeLesson.id, code }),
      });
      const result = await response.json();
      lastResult = result;
      if (result.status === 'passed' && !state.passed.includes(activeLesson.id)) {
        state = store.togglePassed(activeLesson.id) || {
          ...state,
          passed: [...state.passed, activeLesson.id],
        };
      }
      renderResult(result, output, status);
      renderNav();
      return result;
    } catch (error) {
      const result = { status: 'runner_unavailable', stderr: error.message, stdout: '' };
      lastResult = result;
      renderResult(result, output, status);
      return result;
    } finally {
      if (runButton) {
        runButton.disabled = false;
        runButton.textContent = '运行代码';
      }
    }
  }

  function render() {
    if (!course || !activeLesson) return;
    if (refs.title) refs.title.textContent = course.title || 'Rust 核心训练';
    if (refs.storageNotice) refs.storageNotice.textContent = store.getStatus() || '';
    renderNav();
    renderLesson();
  }

  function renderNav() {
    if (!course || !refs.nav) return;
    const activeIndex = course.lessons.findIndex((lesson) => lesson.id === activeLesson?.id);
    refs.nav.innerHTML = course.lessons.map((lesson, index) => {
      const passed = state.passed.includes(lesson.id);
      const open = canOpenLesson(course, state, lesson.id);
      return `<button class="lesson-link${lesson.id === activeLesson?.id ? ' is-active' : ''}${passed ? ' is-passed' : ''}" data-lesson-id="${escapeHtml(lesson.id)}" ${open ? '' : 'disabled'}>${
        `<span class="lesson-index">${String(index + 1).padStart(2, '0')}</span>`
        + `<span class="lesson-link-copy"><strong>${escapeHtml(lesson.title)}</strong><small>${passed ? '已通过' : open ? '可开始' : '完成上一课后解锁'}</small></span>`
      }</button>`;
    }).join('');
    refs.nav.querySelectorAll?.('[data-lesson-id]').forEach((button) => {
      button.addEventListener('click', () => selectLesson(button.dataset.lessonId));
    });
    if (refs.progress) refs.progress.textContent = `${Math.max(activeIndex + 1, 1)} / ${course.lessons.length}`;
  }

  function renderLesson() {
    const draft = store.getDraft(activeLesson.id) || activeLesson.starterCode || '';
    refs.main.innerHTML = `<article class="lesson-content">
      <p class="lesson-kicker">第 ${String(course.lessons.indexOf(activeLesson) + 1).padStart(2, '0')} 课 / Rust 核心训练</p>
      <h1>${escapeHtml(activeLesson.title)}</h1>
      <p class="lesson-goal">${escapeHtml(activeLesson.goal)}</p>
      <section class="lesson-section"><h2>本课任务</h2><p>${escapeHtml(activeLesson.exerciseGoal)}</p></section>
      <section class="lesson-section"><h2>关键讲解</h2><p>${escapeHtml(activeLesson.explanation)}</p></section>
      <section class="lesson-section example-section"><h2>示例</h2><pre><code>${escapeHtml(activeLesson.exampleCode)}</code></pre></section>
      <section class="exercise-panel"><div class="exercise-heading"><div><p class="section-label">动手写</p><h2>完成练习</h2></div><span id="lessonStatus" data-tone="idle">编辑后运行测试</span></div>
        <textarea id="editor" spellcheck="false" aria-label="Rust 代码编辑器">${escapeHtml(draft)}</textarea>
        <div class="exercise-actions"><button id="runButton" type="button">运行代码</button><span class="test-summary">${activeLesson.tests.length} 项隐藏测试</span></div>
        <pre id="output" class="run-output" aria-live="polite">${escapeHtml(lastResult?.stdout || '')}</pre>
      </section>
      <section class="lesson-section hints-section"><h2>提示</h2><ul>${activeLesson.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join('')}</ul></section>
    </article>`;
    const editor = document.getElementById('editor');
    const runButton = document.getElementById('runButton');
    if (editor) editor.addEventListener('input', () => store.setDraft(activeLesson.id, editor.value));
    if (runButton) runButton.addEventListener('click', runActive);
    if (lastResult) renderResult(lastResult, document.getElementById('output'), document.getElementById('lessonStatus'));
  }

  function renderResult(result, output, status) {
    const presentation = executionPresentation(result);
    if (status) {
      status.dataset.tone = presentation.tone;
      status.textContent = presentation.title;
    }
    if (output) {
      const text = [result.stdout, result.stderr].filter(Boolean).join('\n');
      output.textContent = text || presentation.message;
      output.dataset.tone = presentation.tone;
    }
  }

  function setPageState(nextState, message = '') {
    if (refs.error) {
      refs.error.hidden = nextState !== 'error';
      refs.error.textContent = message;
    }
    if (refs.main && nextState === 'loading') refs.main.innerHTML = '<p class="page-message">正在载入课程...</p>';
    if (refs.main && nextState === 'error') refs.main.innerHTML = `<p class="page-message">${escapeHtml(message)}</p>`;
  }

  return { load, selectLesson, runActive, getCourse: () => course, getState: () => state };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

if (typeof document !== 'undefined' && document.getElementById('courseNav')) {
  const app = createCourseApp();
  globalThis.RustCourseApp = app;
  app.load().catch(() => {});
}
