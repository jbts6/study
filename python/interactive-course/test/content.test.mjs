import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadCourse } from '../server/catalog.mjs';
import { createPythonRunner } from '../server/runner.mjs';

const courseRoot = fileURLToPath(
  new URL('../internal/course/content/', import.meta.url),
);

const expectedLessonIds = [
  'python-values-01',
  'python-conditions-01',
  'python-sequences-01',
  'python-mappings-01',
  'python-loops-01',
  'python-functions-01',
];

test('maps the implemented Python lessons in order', () => {
  const course = loadCourse(courseRoot).publicCourse();
  assert.deepEqual(course.lessons.map((lesson) => lesson.id), expectedLessonIds);
});

test('every implemented example passes and starter remains an exercise', async () => {
  const catalog = loadCourse(courseRoot);
  const runner = createPythonRunner({
    pythonCommand: process.env.PYTHON_COURSE_PYTHON_PATH || 'python',
  });

  for (const lesson of catalog.publicCourse().lessons) {
    assert.equal('hiddenTest' in lesson, false, lesson.id);

    const internal = catalog.lesson(lesson.id);
    const example = await runner.run({
      code: internal.exampleCode,
      hiddenTest: internal.hiddenTest,
    });
    assert.equal(example.status, 'passed', `${lesson.id}: ${example.stderr}`);

    const starter = await runner.run({
      code: internal.starterCode,
      hiddenTest: internal.hiddenTest,
    });
    assert.notEqual(starter.status, 'passed', lesson.id);
  }
});
