import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLearningCatalog } from '../../../learning/catalog.mjs';
import { loadCourse } from '../server/catalog.mjs';

const courseRoot = fileURLToPath(
  new URL('../internal/course/content/', import.meta.url),
);

test('loads the shared route and exposes no hidden Python tests', () => {
  const route = loadLearningCatalog();
  const course = loadCourse(courseRoot);
  const publicCourse = course.publicCourse();

  assert.deepEqual(route.tracks.map((track) => track.id), [
    'python',
    'go',
    'rust',
  ]);
  assert.equal(publicCourse.lessons.length, 1);
  assert.equal(publicCourse.lessons[0].id, 'python-functions-01');
  assert.equal('hiddenTest' in publicCourse.lessons[0], false);
  assert.match(course.lesson('python-functions-01').hiddenTest, /unittest/);
});
