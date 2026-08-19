import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLessonProgression,
  groupLessons,
  isLessonUnlocked,
  renderLessonContent,
} from '../web/lesson-view.js';

test('renders structured lesson copy and escapes authored text', () => {
  const html = renderLessonContent({
    title: '<img src=x onerror=alert(1)>',
    stage: 'foundation',
    order: 1,
    estimatedMinutes: '<svg onload=alert(1)>',
    module: { id: 'expressions', title: 'Python 表达方式', order: 1 },
    objectives: ['格式化日志'],
    concepts: [{ title: 'f-string', explanation: '组合文本', analogy: '模板字符串', code: 'print("ok")' }],
    commonMistakes: [{ symptom: '引号不配对', cause: '字符串未结束', fix: '配对引号' }],
    exercise: { goal: '返回摘要', steps: ['实现函数'], acceptance: ['输出稳定'] },
    hints: ['先写函数签名'],
    exampleCode: 'def answer():\n    return 1',
    recap: ['会格式化日志'],
  });

  assert.match(html, /第 1 课/);
  assert.match(html, /<details/);
  assert.match(html, /lesson-objectives[^]*<ul><li>格式化日志<\/li><\/ul>/);
  assert.match(html, /lesson-recap[^]*<ul><li>会格式化日志<\/li><\/ul>/);
  assert.doesNotMatch(html, /<img src=/);
  assert.doesNotMatch(html, /<svg onload=/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;svg/);
});

test('groups neighboring lessons by module', () => {
  const module = { id: 'expressions', title: 'Python 表达方式', order: 1 };
  const groups = groupLessons([
    { id: 'one', module },
    { id: 'two', module },
    { id: 'three', module: { id: 'functions', title: '可复用程序', order: 2 } },
  ]);

  assert.deepEqual(groups.map((group) => [group.module.id, group.lessons.length]), [
    ['expressions', 2],
    ['functions', 1],
  ]);
});

test('unlocks only the first lesson and the lesson after a pass', () => {
  const lessons = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
  assert.equal(isLessonUnlocked(lessons, 'one', []), true);
  assert.equal(isLessonUnlocked(lessons, 'two', []), false);
  assert.equal(isLessonUnlocked(lessons, 'two', ['one']), true);
  assert.equal(isLessonUnlocked(lessons, 'three', ['one']), false);
});

test('offers the next ordered lesson only after the current lesson passes', () => {
  const lessons = [
    { id: 'one', title: '第一课' },
    { id: 'two', title: '第二课' },
    { id: 'three', title: '第三课' },
  ];

  assert.deepEqual(getLessonProgression(lessons, 'one', []), {
    status: 'pending',
    nextLesson: null,
  });
  assert.deepEqual(getLessonProgression(lessons, 'one', ['one']), {
    status: 'next',
    nextLesson: lessons[1],
  });
  assert.deepEqual(getLessonProgression(lessons, 'three', ['three']), {
    status: 'complete',
    nextLesson: null,
  });
});

test('does not advance when the current lesson is missing from the catalog', () => {
  assert.deepEqual(getLessonProgression([{ id: 'one' }], 'missing', ['missing']), {
    status: 'pending',
    nextLesson: null,
  });
});
