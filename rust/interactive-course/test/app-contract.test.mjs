import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  canOpenLesson,
  createCourseApp,
  executionPresentation,
} from '../web/app.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const course = {
  id: 'rust-core',
  title: 'Rust 核心训练',
  lessons: [
    {
      id: 'rust-start-00',
      title: '工具链',
      goal: '完成第一题',
      explanation: '解释',
      exampleCode: 'pub fn answer() -> i32 { 42 }',
      starterCode: 'pub fn answer() -> i32 { 0 }',
      exerciseGoal: '返回 42',
      hints: ['修改返回值'],
      tests: [{ id: 'answer', label: '返回 42' }],
    },
    {
      id: 'rust-start-01',
      title: '变量',
      goal: '完成第二题',
      explanation: '解释',
      exampleCode: 'pub fn answer() -> i32 { 42 }',
      starterCode: 'pub fn answer() -> i32 { 0 }',
      exerciseGoal: '返回 42',
      hints: ['修改返回值'],
      tests: [{ id: 'answer', label: '返回 42' }],
    },
  ],
};

function fakeElement() {
  return {
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    hidden: false,
    className: '',
    addEventListener() {},
    querySelectorAll() { return []; },
  };
}

function fakeDocument() {
  const elements = new Map([
    'courseNav', 'progressText', 'lessonMain', 'runButton', 'editor',
    'output', 'lessonStatus', 'storageNotice', 'courseTitle', 'courseError',
  ].map((id) => [id, fakeElement()]));
  return {
    getElementById(id) { return elements.get(id) ?? null; },
    elements,
  };
}

test('page declares stable DOM contract', async () => {
  const html = await readFile(path.resolve(here, '../web/index.html'), 'utf8');
  for (const id of ['courseNav', 'progressText', 'lessonMain', 'runButton', 'editor', 'output', 'lessonStatus', 'storageNotice']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('every lesson can be previewed while invalid lesson ids stay unavailable', () => {
  assert.equal(canOpenLesson(course, { passed: [] }, 'rust-start-00'), true);
  assert.equal(canOpenLesson(course, { passed: [] }, 'rust-start-01'), true);
  assert.equal(canOpenLesson(course, { passed: ['rust-start-00'] }, 'rust-start-01'), true);
  assert.equal(canOpenLesson(course, { passed: [] }, 'missing-lesson'), false);
});

test('execution statuses have explicit presentation states', () => {
  assert.equal(executionPresentation({ status: 'passed' }).tone, 'success');
  assert.equal(executionPresentation({ status: 'compile_error' }).tone, 'error');
  assert.equal(executionPresentation({ status: 'test_failed' }).tone, 'error');
  assert.equal(executionPresentation({ status: 'timeout' }).tone, 'warning');
  assert.equal(executionPresentation({ status: 'runner_unavailable' }).tone, 'warning');
  assert.equal(executionPresentation({ status: 'invalid_request' }).tone, 'error');
});

test('app loads the course and renders the initial lesson', async () => {
  const document = fakeDocument();
  const store = {
    load: () => ({ currentLessonId: '', passed: [], drafts: {} }),
    setCurrentLesson() {},
    getDraft: () => '',
    getStatus: () => '',
  };
  const app = createCourseApp({
    document,
    fetchImpl: async () => ({ ok: true, json: async () => course }),
    store,
  });

  await app.load();

  assert.match(document.elements.get('courseNav').innerHTML, /工具链/);
  assert.match(document.elements.get('courseNav').innerHTML, /建议先完成上一课/);
  assert.doesNotMatch(document.elements.get('courseNav').innerHTML, /disabled/);
  assert.match(document.elements.get('lessonMain').innerHTML, /完成第一题/);
  assert.match(document.elements.get('progressText').textContent, /1 \/ 2/);
});
