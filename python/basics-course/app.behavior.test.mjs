import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const courseRoot = resolve('python', 'basics-course');

class FakeClassList {
  #values = new Set();

  toggle(name, force) {
    const nextValue = force === undefined ? !this.#values.has(name) : Boolean(force);
    if (nextValue) this.#values.add(name);
    else this.#values.delete(name);
    return nextValue;
  }

  contains(name) {
    return this.#values.has(name);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.classList = new FakeClassList();
    this.children = [];
    this.style = {};
    this.listeners = new Map();
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  querySelectorAll() {
    return [];
  }

  focus() {}
}

class FakeDocument {
  constructor() {
    this.readyState = 'complete';
    this.elements = new Map(
      [
        'menuButton',
        'sidebarBackdrop',
        'storageNotice',
        'lessonNav',
        'progressBar',
        'progressText',
        'sidebarCount',
        'lessonMain',
        'courseSidebar',
        'runtimeDot',
        'runtimeStatus',
      ].map((id) => [id, new FakeElement('div')]),
    );
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  addEventListener() {}
}

test('首次课程启动写入当前章节失败时显示可读存储状态', () => {
  const document = new FakeDocument();
  const storage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota exceeded');
    },
  };
  const window = {
    document,
    localStorage: storage,
    marked: { parse: () => '' },
    DOMPurify: { sanitize: (html) => html },
    PYTHON_COURSE: {
      lessons: [{ day: 1, title: '第一天', content: '' }],
      source: 'test',
    },
  };
  const context = { window, marked: window.marked, DOMPurify: window.DOMPurify };

  runInNewContext(readFileSync(resolve(courseRoot, 'store.js'), 'utf8'), context);
  runInNewContext(readFileSync(resolve(courseRoot, 'runner-adapter.js'), 'utf8'), context);
  runInNewContext(readFileSync(resolve(courseRoot, 'app.js'), 'utf8'), context);

  const notice = document.getElementById('storageNotice');
  assert.match(notice.textContent, /本地进度无法保存/);
  assert.equal(notice.classList.contains('is-visible'), true);
});
