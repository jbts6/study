import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCatalog } from './catalog.mjs';
import { createHandler } from './http.mjs';
import { createCargoRunner } from './runner.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = path.resolve(root, '../internal/course/content');
const staticRoot = path.resolve(root, '../web');
const catalog = loadCatalog(contentRoot);
const runner = createCargoRunner();
const port = Number(process.env.PORT || 5173);
const server = http.createServer(createHandler({ catalog, runner, staticRoot }));

server.listen(port, '127.0.0.1', () => {
  console.log(`Rust interactive course: http://127.0.0.1:${port}`);
});
