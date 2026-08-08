import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { createHandler } from '../server/http.mjs';

function startServer() {
  const catalog = {
    publicCourse: () => ({
      id: 'rust-core',
      title: 'Rust 核心训练',
      lessons: [{
        id: 'rust-start-00',
        title: '工具链',
        goal: '完成第一个练习',
        explanation: '说明',
        exampleCode: 'pub fn answer() -> i32 { 42 }',
        starterCode: 'pub fn answer() -> i32 { 0 }',
        exerciseGoal: '返回 42',
        hints: ['修改返回值'],
        tests: [{ id: 'answer', label: '返回 42' }],
      }],
    }),
    lesson: (id) => id === 'rust-start-00'
      ? { id, hiddenTest: '#[test] fn answer() {}', tests: [{ id: 'answer', label: '返回 42' }] }
      : null,
  };
  const runner = {
    run: async ({ code, hiddenTest, tests }) => ({
      status: 'passed',
      stdout: `${code.length}:${hiddenTest.length}`,
      stderr: '',
      diagnostics: [],
      tests: tests.map((item) => ({ ...item, status: 'passed', message: '' })),
    }),
  };
  const server = http.createServer(createHandler({ catalog, runner }));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function request(baseUrl, options = {}) {
  const response = await fetch(baseUrl + (options.path || '/api/course'), {
    method: options.method || 'GET',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    body: options.body,
  });
  return { status: response.status, body: await response.json() };
}

test('GET /api/course returns public course data', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const response = await request(baseUrl);
  assert.equal(response.status, 200);
  assert.equal(response.body.lessons[0].id, 'rust-start-00');
  assert.equal('hiddenTest' in response.body.lessons[0], false);
});

test('POST /api/execute selects hidden tests on the server', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const response = await request(baseUrl, {
    path: '/api/execute',
    method: 'POST',
    body: JSON.stringify({ lessonId: 'rust-start-00', code: 'pub fn answer() -> i32 { 42 }' }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'passed');
  assert.equal(response.body.tests[0].status, 'passed');
});

test('POST /api/execute rejects malformed requests', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const unknownLesson = await request(baseUrl, {
    path: '/api/execute',
    method: 'POST',
    body: JSON.stringify({ lessonId: 'missing', code: 'fn main() {}' }),
  });
  assert.equal(unknownLesson.status, 404);

  const invalidJson = await fetch(baseUrl + '/api/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(invalidJson.status, 400);
});

