(function startPythonCourse(global) {
  'use strict';

  const MAX_DAY = 30;
  const PYTHON_LANGUAGE = 'language-python';
  const READ_ONLY_LANGUAGE_PATTERN = /^(?:language-shell|language-json|language-html)$/;
  const SYNC_COMMAND = 'node basics-course/sync-course.mjs';
  const defaultState = { currentDay: 1, completed: [], drafts: {} };
  const document = global.document;
  let courseData = null;
  let appState = { ...defaultState };
  let progressStore = null;
  let runnerAdapter = null;

  const byId = (id) => document.getElementById(id);

  function make(tag, className = '', text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function loadCourseData() {
    const raw = global.PYTHON_COURSE;
    if (!raw || !Array.isArray(raw.lessons)) return null;
    const lessons = raw.lessons
      .filter((lesson) => lesson && Number.isInteger(Number(lesson.day)))
      .map((lesson) => ({ ...lesson, day: Number(lesson.day) }))
      .filter((lesson) => lesson.day >= 1 && lesson.day <= MAX_DAY)
      .sort((left, right) => left.day - right.day);
    return { source: String(raw.source || ''), lessons };
  }

  function setRuntimeStatus(message, kind = 'idle') {
    const dot = byId('runtimeDot');
    const label = byId('runtimeStatus');
    if (dot) dot.className = `status-dot ${kind}`;
    if (label) label.textContent = message;
  }

  function showStorageStatus() {
    const notice = byId('storageNotice');
    if (!notice || !progressStore || typeof progressStore.getStatus !== 'function') return;
    notice.textContent = progressStore.getStatus() || '';
    notice.classList.toggle('is-visible', Boolean(notice.textContent));
  }

  function showMessage(title, message, command = '') {
    const main = byId('lessonMain');
    if (!main) return;
    const section = make('section', 'page-message');
    section.append(make('h1', '', title), make('p', '', message));
    if (command) {
      const hint = make('p', 'command-hint', '在 python 目录执行：');
      hint.append(make('code', '', command));
      section.append(hint);
    }
    main.replaceChildren(section);
  }

  function updateProgress() {
    const total = courseData?.lessons.length || MAX_DAY;
    const completed = new Set(appState.completed);
    const count = courseData?.lessons.filter((lesson) => completed.has(lesson.day)).length || 0;
    const bar = byId('progressBar');
    const text = byId('progressText');
    const sidebarCount = byId('sidebarCount');
    if (bar) bar.style.width = `${Math.round((count / Math.max(total, 1)) * 100)}%`;
    if (text) text.textContent = `${count} / ${total} 天`;
    if (sidebarCount) sidebarCount.textContent = `${total} 天`;
  }

  function renderNav() {
    const nav = byId('lessonNav');
    if (!nav) return;
    nav.replaceChildren();
    if (!courseData) {
      nav.append(make('p', 'nav-message', '等待生成课程数据'));
      updateProgress();
      return;
    }
    const completed = new Set(appState.completed);
    courseData.lessons.forEach((lesson) => {
      const item = make('button', 'nav-item');
      item.type = 'button';
      item.classList.toggle('is-active', lesson.day === appState.currentDay);
      item.classList.toggle('is-complete', completed.has(lesson.day));
      item.setAttribute('aria-current', lesson.day === appState.currentDay ? 'page' : 'false');
      item.append(
        make('span', 'nav-day', String(lesson.day).padStart(2, '0')),
        make('span', 'nav-title', lesson.title || `第 ${lesson.day} 天`),
        make('span', 'nav-status', completed.has(lesson.day) ? '已完成' : '未完成')
      );
      item.addEventListener('click', () => selectDay(lesson.day));
      nav.append(item);
    });
    updateProgress();
  }

  function getLanguage(codeElement) {
    const languageClass = [...codeElement.classList]
      .find((name) => name.startsWith('language-') || name.startsWith('lang-'));
    if (!languageClass) return '';
    return languageClass.startsWith('lang-')
      ? `language-${languageClass.slice(5)}`
      : languageClass;
  }

  function canRun(language) {
    if (READ_ONLY_LANGUAGE_PATTERN.test(language)) return false;
    return !language || language === PYTHON_LANGUAGE;
  }

  function createCodeBlock(code, language, day, blockIndex) {
    const runnable = canRun(language);
    const wrapper = make('section', `code-block${runnable ? ' is-runnable' : ' is-readonly'}`);
    const head = make('div', 'code-header');
    const label = runnable ? (language ? 'Python' : 'Python 示例') : `只读 · ${language.replace('language-', '') || '文本'}`;
    head.append(make('span', 'code-label', label));
    if (runnable) {
      const runButton = make('button', 'run-button', '运行');
      runButton.type = 'button';
      head.append(runButton);
      const editor = make('textarea', 'code-editor');
      editor.spellcheck = false;
      editor.value = progressStore?.getDraft(`${day}:${blockIndex}`) ?? code;
      const output = make('output', 'code-output');
      output.setAttribute('aria-live', 'polite');
      editor.addEventListener('input', () => {
        if (progressStore) appState = progressStore.setDraft(`${day}:${blockIndex}`, editor.value);
        showStorageStatus();
      });
      runButton.addEventListener('click', () => runCode(editor, output, runButton));
      wrapper.append(head, editor, output);
    } else {
      head.append(make('span', 'readonly-label', '只读'));
      const pre = make('pre', 'code-readonly');
      pre.append(make('code', '', code));
      wrapper.append(head, pre);
    }
    return wrapper;
  }

  function renderMarkdown(lesson) {
    const markdown = make('div', 'markdown-body');
    if (!global.marked || typeof global.marked.parse !== 'function' || !global.DOMPurify) {
      markdown.append(make('p', 'inline-error', 'Markdown 渲染器未加载，请检查本地网络后刷新页面。'));
      return markdown;
    }
    const html = DOMPurify.sanitize(marked.parse(String(lesson.content || '')));
    markdown.innerHTML = html;
    markdown.querySelectorAll('pre code').forEach((codeElement, blockIndex) => {
      const pre = codeElement.closest('pre');
      if (pre) pre.replaceWith(createCodeBlock(codeElement.textContent || '', getLanguage(codeElement), lesson.day, blockIndex));
    });
    return markdown;
  }

  function appendSource(section, lesson) {
    if (!lesson.sourcePath && !lesson.sourceUrl) return;
    const source = make('p', 'lesson-source', `来源：${lesson.sourcePath || '本地课程数据'}`);
    if (lesson.sourceUrl) {
      const link = make('a', '', '查看 GitHub 原文');
      link.href = lesson.sourceUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      source.append(' · ', link);
    }
    section.append(source);
  }

  function createPagerButton(label, day, disabled) {
    const button = make('button', 'pager-button', label);
    button.type = 'button';
    button.disabled = disabled;
    if (!disabled) button.addEventListener('click', () => selectDay(day));
    return button;
  }

  function createLessonActions(lesson) {
    const actions = make('footer', 'lesson-actions');
    const complete = make('button', 'complete-button');
    const isComplete = appState.completed.includes(lesson.day);
    complete.type = 'button';
    complete.classList.toggle('is-complete', isComplete);
    complete.textContent = isComplete ? '取消完成标记' : '标记本天完成';
    complete.addEventListener('click', () => {
      if (progressStore) appState = progressStore.toggleComplete(lesson.day);
      renderNav();
      renderLesson(lesson, appState);
      showStorageStatus();
    });
    const pager = make('div', 'lesson-pager');
    pager.append(
      createPagerButton('上一天', lesson.day - 1, lesson.day === 1),
      createPagerButton('下一天', lesson.day + 1, lesson.day === MAX_DAY)
    );
    actions.append(complete, pager);
    return actions;
  }

  function renderLesson(lesson, state = appState) {
    const main = byId('lessonMain');
    if (!main || !lesson) return;
    appState = state || appState;
    const article = make('article', 'lesson');
    article.append(
      make('p', 'lesson-eyebrow', `第 ${String(lesson.day).padStart(2, '0')} 天 / 共 ${courseData?.lessons.length || MAX_DAY} 天`),
      make('h1', '', lesson.title || `第 ${lesson.day} 天`)
    );
    appendSource(article, lesson);
    article.append(renderMarkdown(lesson), createLessonActions(lesson));
    main.replaceChildren(article);
    main.focus({ preventScroll: true });
  }

  function selectDay(day) {
    const lesson = courseData?.lessons.find((item) => item.day === day);
    if (!lesson) return;
    appState = progressStore ? progressStore.setCurrentDay(day) : { ...appState, currentDay: day };
    renderNav();
    renderLesson(lesson, appState);
    closeSidebar();
    if (typeof global.scrollTo === 'function') global.scrollTo({ top: 0, behavior: 'auto' });
    showStorageStatus();
  }

  function runCode(editor, output, button) {
    if (!runnerAdapter || typeof runnerAdapter.run !== 'function') {
      output.className = 'code-output is-error';
      output.textContent = 'Python 运行器尚未加载，等待 Task 3 提供 runner.js。';
      return;
    }
    return runnerAdapter.run(editor, output, button);
  }

  function closeSidebar() {
    byId('courseSidebar')?.classList.remove('is-open');
    byId('sidebarBackdrop')?.classList.remove('is-visible');
    byId('menuButton')?.setAttribute('aria-expanded', 'false');
  }

  function toggleSidebar() {
    const sidebar = byId('courseSidebar');
    const isOpen = sidebar?.classList.toggle('is-open');
    byId('sidebarBackdrop')?.classList.toggle('is-visible', Boolean(isOpen));
    byId('menuButton')?.setAttribute('aria-expanded', String(Boolean(isOpen)));
  }

  function initializeRunner() {
    const factory = global.PythonCourseRunnerAdapter?.createRunnerAdapter;
    runnerAdapter = typeof factory === 'function'
      ? factory({ global, document, setRuntimeStatus })
      : null;
    runnerAdapter?.initialize();
  }

  function boot() {
    const factory = global.createStore || global.PythonCourseStore?.createStore;
    let storage = null;
    try { storage = global.localStorage; } catch { storage = null; }
    progressStore = typeof factory === 'function' ? factory(storage) : null;
    appState = progressStore?.load() || { ...defaultState };
    courseData = loadCourseData();
    byId('menuButton')?.addEventListener('click', toggleSidebar);
    byId('sidebarBackdrop')?.addEventListener('click', closeSidebar);
    showStorageStatus();
    renderNav();
    if (!courseData || courseData.lessons.length === 0) {
      setRuntimeStatus('课程数据未生成', 'error');
      showMessage('还没有课程数据', '请先同步本地课程数据，再刷新此页面。', SYNC_COMMAND);
    } else {
      const initial = courseData.lessons.find((lesson) => lesson.day === appState.currentDay) || courseData.lessons[0];
      appState = progressStore?.setCurrentDay(initial.day) || { ...appState, currentDay: initial.day };
      showStorageStatus();
      renderNav();
      renderLesson(initial, appState);
    }
    initializeRunner();
  }

  global.PythonCourseApp = { loadCourseData, renderLesson };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window);
