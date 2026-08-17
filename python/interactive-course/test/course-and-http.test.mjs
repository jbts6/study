import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { once } from 'node:events';
import { loadLearningCatalog } from '../../../learning/catalog.mjs';
import { loadCourse } from '../server/catalog.mjs';
import { createHandler } from '../server/http.mjs';
import { createPythonRunner } from '../server/runner.mjs';

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

async function withServer(run) {
  const catalog = loadCourse(courseRoot);
  const server = http.createServer(
    createHandler({
      catalog,
      runner: createPythonRunner({
        pythonCommand: process.env.PYTHON_COURSE_PYTHON_PATH || 'python',
      }),
    }),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  try {
    await run('http://127.0.0.1:' + address.port);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('executes a correct Python solution', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl + '/api/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lessonId: 'python-functions-01',
        code: [
          'def summarize(lines):',
          '    return {',
          '        "total": len(lines),',
          '        "errors": sum("ERROR" in line for line in lines),',
          '    }',
        ].join('\n'),
      }),
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.status, 'passed');
  });
});

test('returns test_failed for an incorrect Python solution', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl + '/api/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lessonId: 'python-functions-01',
        code: 'def summarize(lines):\n    return {"total": 0, "errors": 0}',
      }),
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.status, 'test_failed');
    assert.match(result.stderr, /FAILED/);
  });
});
