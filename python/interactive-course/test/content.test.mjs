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
  'python-parameters-01',
  'python-dataclasses-01',
  'python-modules-01',
  'python-paths-01',
  'python-log-parsing-01',
  'python-json-csv-01',
  'python-errors-01',
  'python-unittest-01',
  'python-argparse-01',
  'python-file-scan-01',
  'python-reporting-01',
  'python-log-auditor-01',
];

const requiredLists = [
  'objectives',
  'activityTypes',
  'sourceRefs',
  'hints',
  'concepts',
  'commonMistakes',
  'recap',
];

const placeholderPattern = /TODO|TBD|FIXME|待补充|稍后实现/i;

test('maps the implemented Python lessons in order', () => {
  const course = loadCourse(courseRoot).publicCourse();
  assert.deepEqual(course.lessons.map((lesson) => lesson.id), expectedLessonIds);
});

test('keeps the final course complete and ordered', () => {
  const lessons = loadCourse(courseRoot).publicCourse().lessons;

  assert.equal(lessons.length, 18);
  assert.deepEqual(
    [...new Set(lessons.map((lesson) => lesson.module.id))],
    ['python-expressions', 'reusable-programs', 'files-reliability', 'log-auditor'],
  );
  assert.deepEqual(
    lessons.map((lesson) => lesson.order),
    Array.from({ length: 18 }, (_, index) => index + 1),
  );

  for (const lesson of lessons) {
    for (const field of requiredLists) {
      assert.ok(lesson[field].length > 0, `${lesson.id}: ${field}`);
    }
    assert.ok(lesson.exercise.steps.length > 0, `${lesson.id}: exercise.steps`);
    assert.ok(lesson.exercise.acceptance.length > 0, `${lesson.id}: exercise.acceptance`);
    assert.doesNotMatch(JSON.stringify(lesson), placeholderPattern, lesson.id);
  }
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
