import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadCatalog } from '../server/catalog.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = path.resolve(here, '../internal/course/content');

test('catalog exposes the course without leaking hidden test source', () => {
  const catalog = loadCatalog(contentRoot);
  const course = catalog.publicCourse();

  assert.equal(course.id, 'rust-core');
  assert.equal(course.lessons.length, 12);
  assert.deepEqual(course.lessons[0].id, 'rust-start-00');
  assert.deepEqual(course.lessons.at(-1).id, 'rust-start-11');
  assert.equal('hiddenTest' in course.lessons[0], false);
  assert.equal('hidden_test.rs' in course.lessons[0], false);
  assert.match(catalog.lesson('rust-start-00').hiddenTest, /#\[test\]/);
  assert.equal(catalog.lesson('missing-lesson'), null);
});

test('catalog rejects duplicate lesson ids', () => {
  assert.throws(
    () => loadCatalog(path.resolve(here, 'fixtures/duplicate-course')),
    /duplicate lesson id/i,
  );
});
