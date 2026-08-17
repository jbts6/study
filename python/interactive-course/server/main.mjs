import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { loadCourse } from './catalog.mjs';
import { createHandler } from './http.mjs';
import { createPythonRunner } from './runner.mjs';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 8010);
const staticRoot = fileURLToPath(new URL('../web/', import.meta.url));
const catalog = loadCourse();
const runner = createPythonRunner({
  pythonCommand: process.env.PYTHON_COURSE_PYTHON_PATH || 'python',
});

http
  .createServer(createHandler({ catalog, runner, staticRoot }))
  .listen(port, host, () => {
    console.log('Python 课程已启动：http://' + host + ':' + port);
  });
