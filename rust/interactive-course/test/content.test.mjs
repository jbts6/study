import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';

import { loadCatalog } from '../server/catalog.mjs';
import { createCargoRunner } from '../server/runner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = path.resolve(here, '../internal/course/content');

test('course content maps the twelve Rust chapters in order', () => {
  const catalog = loadCatalog(contentRoot);
  const course = catalog.publicCourse();

  assert.equal(course.lessons.length, 12);
  assert.deepEqual(
    course.lessons.map((lesson) => lesson.id),
    Array.from({ length: 12 }, (_, index) => `rust-start-${String(index).padStart(2, '0')}`),
  );
  for (const lesson of course.lessons) {
    assert.ok(lesson.goal);
    assert.ok(lesson.explanation);
    assert.ok(lesson.exampleCode);
    assert.ok(lesson.starterCode);
    assert.ok(lesson.exerciseGoal);
    assert.ok(lesson.hints.length > 0);
    assert.ok(lesson.tests.length > 0);
    assert.equal('hiddenTest' in lesson, false);
  }
});
test('every lesson example passes its server-side hidden tests', async () => {
  const catalog = loadCatalog(contentRoot);
  const runner = createCargoRunner({ timeoutMs: 10_000 });

  for (const lesson of catalog.publicCourse().lessons) {
    const internal = catalog.lesson(lesson.id);
    const result = await runner.run({
      code: internal.exampleCode,
      hiddenTest: internal.hiddenTest,
      tests: internal.tests,
    });
    assert.equal(result.status, 'passed', `${lesson.id}: ${result.stderr}`);
  }
});

test('the concurrency lesson demonstrates a channel ownership boundary', () => {
  const catalog = loadCatalog(contentRoot);
  assert.match(catalog.lesson('rust-start-08').exampleCode, /mpsc::channel/);
});
