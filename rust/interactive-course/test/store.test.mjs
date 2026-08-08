import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createStore } from '../web/store.js';

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, value);
  }
}

test('store starts with a stable empty state', () => {
  const store = createStore(new MemoryStorage());
  assert.deepEqual(store.load(), { currentLessonId: '', passed: [], drafts: {} });
});

test('store normalizes malformed saved state', () => {
  const storage = new MemoryStorage();
  storage.setItem('rust-course-state-v1', JSON.stringify({
    currentLessonId: 42,
    passed: ['rust-start-00', 7, 'rust-start-00'],
    drafts: { 'rust-start-00': 'code', bad: 8 },
  }));
  const store = createStore(storage);

  assert.deepEqual(store.load(), {
    currentLessonId: '',
    passed: ['rust-start-00'],
    drafts: { 'rust-start-00': 'code' },
  });
});

test('store persists current lesson, passed status, and drafts', () => {
  const store = createStore(new MemoryStorage());
  store.setCurrentLesson('rust-start-00');
  store.togglePassed('rust-start-00');
  store.setDraft('rust-start-00', 'pub fn greeting() {}');

  assert.equal(store.load().currentLessonId, 'rust-start-00');
  assert.deepEqual(store.load().passed, ['rust-start-00']);
  assert.equal(store.getDraft('rust-start-00'), 'pub fn greeting() {}');
  store.togglePassed('rust-start-00');
  assert.deepEqual(store.load().passed, []);
});

test('store remains usable when browser storage is unavailable', () => {
  const store = createStore(null);
  store.setCurrentLesson('rust-start-00');
  store.setDraft('rust-start-00', 'draft');

  assert.equal(store.load().currentLessonId, 'rust-start-00');
  assert.equal(store.getDraft('rust-start-00'), 'draft');
  assert.match(store.getStatus(), /不可用|内存/);
});

