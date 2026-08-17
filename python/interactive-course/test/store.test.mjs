import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../web/store.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test('restores the current lesson, draft and mastery evidence', () => {
  const storage = memoryStorage();
  const store = createStore(storage);

  store.save({
    currentLessonId: 'python-functions-01',
    drafts: { 'python-functions-01': 'def summarize(lines):\n    return {}' },
    practiced: ['python-functions-01'],
    mastered: ['python-functions-01'],
  });

  assert.deepEqual(store.load(), {
    currentLessonId: 'python-functions-01',
    drafts: { 'python-functions-01': 'def summarize(lines):\n    return {}' },
    practiced: ['python-functions-01'],
    mastered: ['python-functions-01'],
  });
});

test('falls back to empty progress when storage is corrupted', () => {
  const storage = memoryStorage({
    'python-course.progress.v1': '{broken json',
  });
  const store = createStore(storage);

  assert.deepEqual(store.load(), {
    currentLessonId: '',
    drafts: {},
    practiced: [],
    mastered: [],
  });
});
