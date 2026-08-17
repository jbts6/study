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
        const payload = await readJson(request);
        const lessonId =
          typeof payload.lessonId === 'string' ? payload.lessonId.trim() : '';
        const code = typeof payload.code === 'string' ? payload.code : '';
        if (!lessonId || !code.trim()) {
          return writeJson(response, 400, {
            status: 'invalid_request',
            stderr: 'lessonId 和 code 不能为空',
          });
        }
        const lesson = catalog.lesson(lessonId);
        return writeJson(
          response,
          200,
          await runner.run({ code, hiddenTest: lesson.hiddenTest }),
        );
      }

      if (request.method === 'GET' && staticRoot) {
        return serveStatic(response, url.pathname, staticRoot);
      }

      return writeJson(response, 404, { error: 'Not found' });
    } catch (error) {
      return writeJson(response, 500, {
        status: 'runner_unavailable',
        stderr: error instanceof Error ? error.message : String(error),
      });
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

function writeJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}
