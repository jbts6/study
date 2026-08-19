import { createStore } from './store.js';
import {
  getLessonProgression,
  groupLessons,
  isLessonUnlocked,
  renderLessonContent,
} from './lesson-view.js';

export function createCourseApp(dependencies = {}) {
  return new CourseApp(dependencies);
}

class CourseApp {
  constructor(dependencies) {
    this.document = dependencies.document ?? globalThis.document;
    this.fetch = dependencies.fetch ?? globalThis.fetch?.bind(globalThis);
    this.store = dependencies.store ?? createStore();
    this.elements = getElements(this.document);

    this.course = null;
    this.activeLesson = null;
    this.progress = this.store.load();
    this.running = false;
    this.lastResult = null;
  }

  start() {
    if (!this.elements.main) return Promise.resolve();
    this.bindEvents();
    this.render();
    return this.loadCourse();
  }

  async loadCourse() {
    if (typeof this.fetch !== 'function') {
      this.lastResult = requestFailure('找不到本地网络请求能力。请使用支持现代浏览器的 VS Code 窗口。');
      this.render();
      return;
    }
    try {
      const response = await this.fetch('/api/course');
      if (!response.ok) throw new Error(`课程服务返回 HTTP ${response.status}`);
      this.course = await response.json();
      const lessons = Array.isArray(this.course.lessons) ? this.course.lessons : [];
      this.activeLesson =
        lessons.find((lesson) => lesson.id === this.progress.currentLessonId) ??
        lessons[0] ??
        null;
      this.progress = this.store.save({
        ...this.progress,
        currentLessonId: this.activeLesson?.id ?? '',
      });
      this.lastResult = null;
    } catch (error) {
      this.lastResult = requestFailure(
        `无法加载课程内容。请确认本地课程服务正在运行，然后刷新页面。\n${errorMessage(error)}`,
      );
    }
    this.render();
  }

  bindEvents() {
    this.elements.editor.addEventListener('input', () => {
      if (!this.activeLesson) return;
      this.progress = this.store.save({
        ...this.progress,
        drafts: {
          ...this.progress.drafts,
          [this.activeLesson.id]: this.elements.editor.value,
        },
      });
    });
    this.elements.runButton.addEventListener('click', () => this.runExercise());
    this.elements.nextLessonButton.addEventListener('click', () => this.goToNextLesson());
    this.elements.masteredCheck.addEventListener('change', () => {
      if (!this.activeLesson) return;
      const mastered = new Set(this.progress.mastered);
      if (this.elements.masteredCheck.checked) mastered.add(this.activeLesson.id);
      else mastered.delete(this.activeLesson.id);
      this.progress = this.store.save({ ...this.progress, mastered: [...mastered] });
      this.renderProgress();
    });
  }

  async runExercise() {
    const lessons = this.course?.lessons ?? [];
    const unlocked = this.activeLesson && isLessonUnlocked(
      lessons,
      this.activeLesson.id,
      this.progress.practiced,
    );
    if (!unlocked || this.running || typeof this.fetch !== 'function') return;
    this.saveDraft();
    this.running = true;
    this.lastResult = { status: 'running', stdout: '', stderr: '' };
    this.renderWorkspace();
    try {
      const response = await this.fetch('/api/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lessonId: this.activeLesson.id,
          code: this.elements.editor.value,
        }),
      });
      try {
        this.lastResult = await response.json();
      } catch {
        this.lastResult = requestFailure(`执行服务返回了无法读取的响应（HTTP ${response.status}）。`);
      }
      if (this.lastResult.status === 'passed') {
        this.progress = this.store.save({
          ...this.progress,
          practiced: [...new Set([...this.progress.practiced, this.activeLesson.id])],
        });
      }
    } catch (error) {
      this.lastResult = requestFailure(
        `无法连接本地执行服务。请确认 npm start 正在运行，然后重试。\n${errorMessage(error)}`,
      );
    } finally {
      this.running = false;
      this.render();
    }
  }

  saveDraft() {
    this.progress = this.store.save({
      ...this.progress,
      drafts: {
        ...this.progress.drafts,
        [this.activeLesson.id]: this.elements.editor.value,
      },
    });
  }

  goToNextLesson() {
    const progression = getLessonProgression(
      this.course?.lessons ?? [],
      this.activeLesson?.id ?? '',
      this.progress.practiced,
    );
    if (this.running || progression.status !== 'next') return;
    this.saveDraft();
    this.selectLesson(progression.nextLesson);
  }

  render() {
    this.renderProgress();
    this.renderLessons();
    this.renderLessonCopy();
    this.renderWorkspace();
  }

  renderProgress() {
    const total = this.course?.lessons?.length ?? 0;
    this.elements.progressSummary.textContent = `已练习 ${this.progress.practiced.length}/${total} · 已掌握 ${this.progress.mastered.length}/${total}`;
    this.elements.courseCount.textContent = total ? `${total} 课节` : '';
  }

  renderLessons() {
    const lessons = Array.isArray(this.course?.lessons) ? this.course.lessons : [];
    this.elements.lessonList.replaceChildren();
    groupLessons(lessons).forEach((group) => {
      const moduleItem = this.document.createElement('li');
      const title = this.document.createElement('h2');
      const list = this.document.createElement('ol');
      moduleItem.className = 'lesson-module';
      title.className = 'lesson-module-title';
      title.textContent = group.module.title;
      group.lessons.forEach((lesson) => list.append(this.createLessonItem(lesson, lessons)));
      moduleItem.append(title, list);
      this.elements.lessonList.append(moduleItem);
    });
    if (!lessons.length) {
      const item = this.document.createElement('li');
      item.className = 'nav-empty';
      item.textContent = this.course ? '暂无可用课节' : '正在载入…';
      this.elements.lessonList.append(item);
    }
  }

  createLessonItem(lesson, lessons) {
    const item = this.document.createElement('li');
    const button = this.document.createElement('button');
    const active = lesson.id === this.activeLesson?.id;
    const unlocked = isLessonUnlocked(lessons, lesson.id, this.progress.practiced);
    const index = this.document.createElement('span');
    const name = this.document.createElement('span');
    const state = this.document.createElement('span');
    button.type = 'button';
    button.className = 'lesson-link';
    button.classList.toggle('is-active', active);
    button.dataset.locked = String(!unlocked);
    button.setAttribute('aria-current', active ? 'page' : 'false');
    index.className = 'lesson-index';
    index.textContent = String(lesson.order ?? lessons.indexOf(lesson) + 1);
    name.className = 'lesson-name';
    name.textContent = lesson.title;
    state.className = 'lesson-state';
    state.textContent = this.progressState(lesson.id, unlocked);
    button.append(index, name, state);
    button.addEventListener('click', () => this.selectLesson(lesson));
    item.append(button);
    return item;
  }

  selectLesson(lesson) {
    if (this.running || lesson.id === this.activeLesson?.id) return;
    this.activeLesson = lesson;
    this.progress = this.store.save({ ...this.progress, currentLessonId: lesson.id });
    this.lastResult = null;
    this.render();
    this.elements.main.focus({ preventScroll: true });
    this.elements.main.scrollIntoView({ block: 'start' });
  }

  renderLessonCopy() {
    if (!this.course) {
      const requestFailed = this.lastResult?.status === 'request_failed';
      const title = requestFailed
        ? '课程暂时无法打开'
        : '正在加载课程内容';
      const message = this.lastResult?.stderr || '正在读取本地课程目录…';
      this.showEmptyLesson(title, message);
      this.elements.main.setAttribute('aria-busy', requestFailed ? 'false' : 'true');
      return;
    }
    this.elements.main.setAttribute('aria-busy', 'false');
    if (!this.activeLesson) {
      this.showEmptyLesson(
        '暂无可用课节',
        '课程目录为空，请检查本地课程内容文件。',
      );
      return;
    }
    this.elements.lessonCopy.innerHTML = renderLessonContent(this.activeLesson);
  }

  showEmptyLesson(title, message) {
    const container = this.document.createElement('div');
    const eyebrow = this.document.createElement('p');
    const heading = this.document.createElement('h2');
    const copy = this.document.createElement('p');
    container.className = 'empty-state';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = '课程内容';
    heading.textContent = title;
    copy.textContent = message;
    container.append(eyebrow, heading, copy);
    this.elements.lessonCopy.replaceChildren(container);
  }

  renderWorkspace() {
    const lessons = this.course?.lessons ?? [];
    const ready = Boolean(this.activeLesson);
    const unlocked = ready && isLessonUnlocked(
      lessons,
      this.activeLesson.id,
      this.progress.practiced,
    );
    const editable = unlocked && !this.running;
    const progression = getLessonProgression(
      lessons,
      this.activeLesson?.id ?? '',
      this.progress.practiced,
    );
    const hasNextLesson = progression.status === 'next';
    this.elements.editor.disabled = !editable;
    this.elements.runButton.disabled = !editable;
    this.elements.masteredCheck.disabled = !editable;
    this.elements.nextLessonButton.hidden = !hasNextLesson;
    this.elements.nextLessonButton.disabled = this.running || !hasNextLesson;
    this.elements.nextLessonButton.textContent = hasNextLesson
      ? `下一课：第 ${progression.nextLesson.order} 课 · ${progression.nextLesson.title}`
      : '';
    this.elements.courseComplete.hidden = progression.status !== 'complete';
    this.elements.lessonLock.hidden = unlocked || !this.activeLesson;
    if (ready && !this.running) {
      const code = this.progress.drafts[this.activeLesson.id]
        ?? this.activeLesson.starterCode
        ?? '';
      if (this.elements.editor.value !== code) this.elements.editor.value = code;
    }
    this.elements.masteredCheck.checked = ready
      && this.progress.mastered.includes(this.activeLesson.id);
    this.elements.runButton.textContent = this.running ? '正在运行' : '运行练习';
    this.renderResult();
  }

  renderResult() {
    if (!this.lastResult) {
      return this.showResult('等待运行', '', '尚未运行');
    }
    if (this.lastResult.status === 'running') {
      return this.showResult('running', 'running', '正在运行练习，请稍候…');
    }
    const status = this.lastResult.status || 'runner_unavailable';
    const sections = [];
    if (this.lastResult.stdout) {
      sections.push(`标准输出\n${this.lastResult.stdout.trimEnd()}`);
    }
    if (this.lastResult.stderr) {
      const label = status === 'passed' ? '测试输出' : '错误信息';
      sections.push(`${label}\n${this.lastResult.stderr.trimEnd()}`);
    }
    if (this.lastResult.diagnostics?.length) {
      sections.push(`诊断\n${this.lastResult.diagnostics.join('\n')}`);
    }
    this.showResult(status, status, sections.join('\n\n') || statusMessage(status));
  }

  showResult(label, status, output) {
    this.elements.resultStatus.textContent = label;
    this.elements.resultStatus.dataset.status = status;
    this.elements.resultOutput.textContent = output;
  }

  progressState(id, unlocked) {
    if (!unlocked) return '锁定：先通过上一节';
    if (this.progress.mastered.includes(id)) return '已掌握';
    if (this.progress.practiced.includes(id)) return '已练习';
    return '可运行';
  }
}

function getElements(documentRef) {
  if (!documentRef) return {};
  return {
    main: documentRef.querySelector('#course-main'),
    progressSummary: documentRef.querySelector('#progress-summary'),
    courseCount: documentRef.querySelector('#course-count'),
    lessonList: documentRef.querySelector('#lesson-list'),
    lessonCopy: documentRef.querySelector('#lesson-copy'),
    editor: documentRef.querySelector('#code-editor'),
    runButton: documentRef.querySelector('#run-button'),
    nextLessonButton: documentRef.querySelector('#next-lesson-button'),
    courseComplete: documentRef.querySelector('#course-complete'),
    masteredCheck: documentRef.querySelector('#mastered-check'),
    lessonLock: documentRef.querySelector('#lesson-lock'),
    resultStatus: documentRef.querySelector('#result-status'),
    resultOutput: documentRef.querySelector('#result-output'),
  };
}

function requestFailure(message) {
  return { status: 'request_failed', stdout: '', stderr: message };
}

function statusMessage(status) {
  const messages = {
    passed: '练习通过。可以勾选独立重建，记录掌握证据。',
    compile_error: '代码无法编译，请根据错误信息修正语法。',
    test_failed: '测试未通过，请对照失败信息检查返回值和边界。',
    runtime_error: '代码运行时发生错误，请从错误信息定位问题。',
    timeout: '运行超过时间限制，请检查是否存在无限循环。',
    runner_unavailable: '本地 Python 执行器不可用，请确认 Python 已安装。',
    request_failed: '请求失败，请确认本地课程服务正在运行。',
  };
  return messages[status] || '运行完成，请查看状态和输出。';
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

if (typeof document !== 'undefined') {
  createCourseApp().start();
}
