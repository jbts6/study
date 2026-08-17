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
const executionResultFields = [
  'checks',
  'diagnostics',
  'durationMs',
  'status',
  'stderr',
  'stdout',
];

function captureFailure(failures, label, check) {
  try {
    check();
  } catch (error) {
    failures.push(label + ': ' + error.message);
  }
}

function checkExecutionResponse(
  failures,
  label,
  response,
  result,
  expectedHttpStatus,
  expectedResultStatus,
) {
  captureFailure(failures, label, () => {
    assert.equal(response.status, expectedHttpStatus);
    assert.equal(result.status, expectedResultStatus);
    assert.deepEqual(Object.keys(result).sort(), executionResultFields);
  });
}

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
    assert.deepEqual(Object.keys(result).sort(), executionResultFields);
  });
});

test('keeps execution and static failures inside HTTP contracts', async () => {
  const failures = [];

  await withServer(async (baseUrl) => {
    const incorrectResponse = await fetch(baseUrl + '/api/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lessonId: 'python-functions-01',
        code: 'def summarize(lines):\n    return {"total": 0, "errors": 0}',
      }),
    });
    const incorrectResult = await incorrectResponse.json();
    checkExecutionResponse(
      failures,
      'incorrect solution',
      incorrectResponse,
      incorrectResult,
      200,
      'test_failed',
    );
    captureFailure(failures, 'incorrect solution output', () => {
      assert.match(incorrectResult.stderr, /FAILED/);
    });

    const syntaxResponse = await fetch(baseUrl + '/api/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lessonId: 'python-functions-01',
        code: 'def summarize(:\n    return {}',
      }),
    });
    const syntaxResult = await syntaxResponse.json();
    checkExecutionResponse(
      failures,
      'syntax error',
      syntaxResponse,
      syntaxResult,
      200,
      'compile_error',
    );
    captureFailure(failures, 'syntax error diagnostics', () => {
      assert.match(syntaxResult.stderr, /solution\.py/);
      assert.match(syntaxResult.stderr, /SyntaxError/);
      assert.doesNotMatch(syntaxResult.stderr, /File "(?:[A-Za-z]:[\\/]|\/)/);
      assert.doesNotMatch(syntaxResult.stderr, /python-course-/);
    });

    const invalidJsonResponse = await fetch(baseUrl + '/api/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    checkExecutionResponse(
      failures,
      'invalid JSON',
      invalidJsonResponse,
      await invalidJsonResponse.json(),
      400,
      'invalid_request',
    );

    const unknownLessonResponse = await fetch(baseUrl + '/api/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lessonId: 'missing', code: 'value = 1' }),
    });
    checkExecutionResponse(
      failures,
      'unknown lesson',
      unknownLessonResponse,
      await unknownLessonResponse.json(),
      400,
      'invalid_request',
    );

    const missingFieldResponse = await fetch(baseUrl + '/api/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lessonId: 'python-functions-01', code: '' }),
    });
    checkExecutionResponse(
      failures,
      'missing field',
      missingFieldResponse,
      await missingFieldResponse.json(),
      400,
      'invalid_request',
    );
  });

  let staticStatus = null;
  let staticBody = '';
  const handler = createHandler({
    catalog: loadCourse(courseRoot),
    runner: createPythonRunner(),
    staticRoot: courseRoot,
  });
  try {
    await handler(
      { method: 'GET', url: '/%' },
      {
        writeHead(statusCode) {
          staticStatus = statusCode;
        },
        end(body = '') {
          staticBody += body;
        },
      },
    );
    captureFailure(failures, 'invalid static path', () => {
      assert.ok(staticStatus === 400 || staticStatus === 404);
      assert.doesNotThrow(() => JSON.parse(staticBody));
    });
  } catch (error) {
    failures.push('invalid static path rejected: ' + error.message);
  }

  const unavailableResult = await createPythonRunner({
    pythonCommand: 'python-course-command-does-not-exist',
  }).run({
    code: 'def summarize(lines):\n    return {}',
    hiddenTest: 'import unittest',
  });
  captureFailure(failures, 'missing Python recovery guidance', () => {
    assert.equal(unavailableResult.status, 'runner_unavailable');
    assert.match(unavailableResult.stderr, /python-course-command-does-not-exist/);
    assert.match(unavailableResult.stderr, /--version/);
    assert.match(unavailableResult.stderr, /python\.org\/downloads/);
  });

  assert.deepEqual(failures, []);
});
