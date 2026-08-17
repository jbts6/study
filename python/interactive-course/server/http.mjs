import fs from 'node:fs';
import path from 'node:path';

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
]);

export function createHandler({ catalog, runner, staticRoot = null }) {
  return async function handle(request, response) {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');

      if (request.method === 'GET' && url.pathname === '/api/course') {
        return writeJson(response, 200, catalog.publicCourse());
      }

      if (request.method === 'POST' && url.pathname === '/api/execute') {
        let payload;
        try {
          payload = await readJson(request);
        } catch {
          return writeJson(
            response,
            400,
            executionResult('invalid_request', '请求 JSON 无效'),
          );
        }
        const lessonId =
          typeof payload?.lessonId === 'string' ? payload.lessonId.trim() : '';
        const code = typeof payload?.code === 'string' ? payload.code : '';
        if (!lessonId || !code.trim()) {
          return writeJson(
            response,
            400,
            executionResult('invalid_request', 'lessonId 和 code 不能为空'),
          );
        }
        let lesson;
        try {
          lesson = catalog.lesson(lessonId);
        } catch (error) {
          return writeJson(
            response,
            400,
            executionResult(
              'invalid_request',
              error instanceof Error ? error.message : String(error),
            ),
          );
        }
        return writeJson(
          response,
          200,
          await runner.run({ code, hiddenTest: lesson.hiddenTest }),
        );
      }

      if (request.method === 'GET' && staticRoot) {
        return await serveStatic(response, url.pathname, staticRoot);
      }

      return writeJson(response, 404, { error: 'Not found' });
    } catch (error) {
      if (request.method === 'GET' && error instanceof URIError) {
        return writeJson(response, 400, { error: 'Invalid path' });
      }
      return writeJson(
        response,
        500,
        executionResult(
          'runner_unavailable',
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStatic(response, pathname, staticRoot) {
  const root = path.resolve(staticRoot);
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath.endsWith('/')
    ? decodedPath + 'index.html'
    : decodedPath;
  const filePath = path.resolve(root, '.' + relativePath);

  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return writeJson(response, 404, { error: 'Not found' });
  }

  try {
    const contents = await fs.promises.readFile(filePath);
    response.writeHead(200, {
      'content-type':
        CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ||
        'application/octet-stream',
      'content-length': contents.length,
    });
    response.end(contents);
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'EISDIR')) {
      return writeJson(response, 404, { error: 'Not found' });
    }
    throw error;
  }
}

function executionResult(status, stderr) {
  return {
    status,
    stdout: '',
    stderr,
    diagnostics: [],
    checks: [],
    durationMs: 0,
  };
}

function writeJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}
