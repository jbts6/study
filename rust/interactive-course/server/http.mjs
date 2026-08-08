import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { URL } from 'node:url';

export const MAX_REQUEST_BYTES = 64 * 1024;

export function createHandler({ catalog, runner, staticRoot = null }) {
  if (!catalog || typeof catalog.publicCourse !== 'function' || typeof catalog.lesson !== 'function') {
    throw new TypeError('catalog must expose publicCourse() and lesson()');
  }
  if (!runner || typeof runner.run !== 'function') {
    throw new TypeError('runner must expose run()');
  }

  return (request, response) => {
    Promise.resolve(handleRequest({ request, response, catalog, runner, staticRoot }))
      .catch((error) => {
        if (response.headersSent || response.writableEnded) return;
        const status = error.statusCode || 500;
        writeJson(response, status, { error: status === 500 ? '服务器内部错误' : error.message });
      });
  };
}

async function handleRequest({ request, response, catalog, runner, staticRoot }) {
  const requestUrl = new URL(request.url || '/', 'http://localhost');

  if (requestUrl.pathname === '/api/course') {
    if (request.method !== 'GET') throw httpError(405, '只支持 GET');
    return writeJson(response, 200, catalog.publicCourse());
  }

  if (requestUrl.pathname === '/api/execute') {
    if (request.method !== 'POST') throw httpError(405, '只支持 POST');
    return executeLesson({ request, response, catalog, runner });
  }

  if (requestUrl.pathname.startsWith('/api/')) {
    throw httpError(404, '接口不存在');
  }

  if (staticRoot) return serveStatic(response, requestUrl.pathname, staticRoot);
  throw httpError(404, '资源不存在');
}

async function executeLesson({ request, response, catalog, runner }) {
  const payload = await readJson(request);
  const lessonId = typeof payload?.lessonId === 'string' ? payload.lessonId.trim() : '';
  const code = typeof payload?.code === 'string' ? payload.code : '';
  if (!lessonId || !code) throw httpError(400, 'lessonId 和 code 不能为空');

  const lesson = catalog.lesson(lessonId);
  if (!lesson) throw httpError(404, '课节不存在');

  const result = await runner.run({
    code,
    hiddenTest: lesson.hiddenTest,
    tests: lesson.tests,
  });
  return writeJson(response, 200, normalizeResult(result));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw httpError(413, '请求体过大');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    throw httpError(400, `JSON 无效: ${error.message}`);
  }
}

async function serveStatic(response, pathname, staticRoot) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const root = path.resolve(staticRoot);
  const filePath = path.resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    throw httpError(403, '资源路径无效');
  }
  try {
    await fs.access(filePath);
  } catch {
    throw httpError(404, '资源不存在');
  }
  response.statusCode = 200;
  response.setHeader('Content-Type', contentType(filePath));
  await pipeline(createReadStream(filePath), response);
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

function normalizeResult(result) {
  return {
    status: result?.status || 'runner_unavailable',
    stdout: result?.stdout || '',
    stderr: result?.stderr || '',
    diagnostics: Array.isArray(result?.diagnostics) ? result.diagnostics : [],
    tests: Array.isArray(result?.tests) ? result.tests : [],
  };
}

function writeJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}
