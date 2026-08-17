# Python 学习入口与公共课程契约 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 建立与 RPG 解耦的本地 Python 交互课程，并用一份公共目录固定 Python、Go、Rust 的学习顺序和课程元数据。

**Architecture:** 新增 learning/ 作为只保存公共路线与课程契约的数据层；新增 python/interactive-course/，使用 Node.js 内置 HTTP 服务、本机 CPython、unittest、原生 HTML/CSS/JavaScript 提供一个可运行的 Python 垂直切片。Go、Rust 现有课程只进入公共目录，本计划不修改其执行器或前端。

**Tech Stack:** Node.js 24.15.0、CPython 3.12+、Python 标准库 unittest、Node.js 内置 test/http/fs/child_process、原生 HTML/CSS/JavaScript。

## Global Constraints

- 只监听 127.0.0.1，不提供公网服务。
- 采用信任本地代码模型；学习者运行自己的本地 Python 代码。
- 不复用或泛化 rpg/ 的战斗 Runner；python/interactive-course/ 拥有独立、最小的课程执行器。
- 不引入 Pyodide、React、Vue、CodeMirror、JSON Schema 验证库、测试框架或其他运行时依赖。
- 不复制外部课程全文；公共目录只保存能力映射和来源链接。
- 当前计划只交付 Python 垂直切片。统一 Hub UI、Go/Rust 适配、跨语言日志项目分别另写计划。
- 测试代码总预算固定为 3 个文件、6 个用例，不得增加。
- 平台回归测试固定为 test/course-and-http.test.mjs 和 test/store.test.mjs，合计 2 个文件、5 个用例。
- 课程验收脚本固定为 hidden_test.py，合计 1 个文件、1 个 unittest 用例；同样计入测试代码总预算。
- 不测试私有函数、字段转发、CSS 细节、完整状态矩阵、极端竞态或未复现边界。
- 每次提交只包含当前任务文件，不纳入工作区已有的 RPG、方案或状态文件改动。
- 页面直接进入可用课程，不制作营销页。
- 页面采用安静、工作型布局：课程导航、讲解、编辑区、结果区四个职责区；不堆叠装饰卡片。
- CSS 使用变量定义背景、表面、正文、弱化、强调、成功、危险和边框色；正文对比度至少 4.5:1。
- 桌面主视口为 1280x800，移动验收视口为 390x844；交互目标至少 44px。
- 所有按钮、课节导航和编辑区可键盘操作，焦点清晰；支持 prefers-reduced-motion。

---

## File Map

### 公共路线

- Create: learning/catalog.json
  - 保存三门语言的顺序、阶段、入口命令、课程来源和一个代表性单元。
- Create: learning/catalog.mjs
  - 加载并验证公共目录，只检查当前实现真正依赖的字段。
- Create: learning/README.md
  - 说明三门语言的顺序、各入口启动方式和本阶段边界。

### Python 课程数据

- Create: python/interactive-course/package.json
  - 声明 Node 版本、start 和 test 命令。
- Create: python/interactive-course/internal/course/content/course.json
  - 保存 Python 课程标题、阶段和课节顺序。
- Create: python/interactive-course/internal/course/content/lessons/python-functions-01/lesson.json
  - 保存公共课节元数据。
- Create: python/interactive-course/internal/course/content/lessons/python-functions-01/starter.py
  - 学习者起始代码。
- Create: python/interactive-course/internal/course/content/lessons/python-functions-01/example.py
  - 完整示例。
- Create: python/interactive-course/internal/course/content/lessons/python-functions-01/hidden_test.py
  - 服务端 unittest 验收。
- Create: python/interactive-course/server/model.mjs
  - Catalog 和公开课节映射。
- Create: python/interactive-course/server/catalog.mjs
  - 从固定课程目录读取课节和代码文件。

### Python 执行服务

- Create: python/interactive-course/server/runner.mjs
  - 在临时目录运行 solution.py 和隐藏 unittest，返回统一执行结果。
- Create: python/interactive-course/server/http.mjs
  - 提供 GET /api/course、POST /api/execute 和静态文件服务。
- Create: python/interactive-course/server/main.mjs
  - 检测配置并启动 127.0.0.1:8010。

### Python 课程页面

- Create: python/interactive-course/web/index.html
  - 语义化课程页面骨架。
- Create: python/interactive-course/web/app.js
  - 加载课程、切换课节、提交代码和显示结果。
- Create: python/interactive-course/web/store.js
  - 保存当前课节、草稿、practiced 和 mastered 状态。
- Create: python/interactive-course/web/styles.css
  - 定义工具型课程界面、响应式布局和状态样式。

### 核心测试、课程验收与文档

- Create: python/interactive-course/test/course-and-http.test.mjs
  - 固定 3 个用例：目录公开边界、正确答案通过、错误答案 test_failed。
- Create: python/interactive-course/test/store.test.mjs
  - 固定 2 个用例：进度恢复、损坏状态回退。
- Modify: python/README.md
  - 删除已不存在的 basics-course/Pyodide 启动说明，改为新课程入口。
- Modify: README.md
  - 增加多语言学习工坊和 Python 课程入口，不改变 RPG 的现有运行说明。

---

### Task 1: 公共学习目录与 Python 课程数据

**Files:**

- Create: learning/catalog.json
- Create: learning/catalog.mjs
- Create: learning/README.md
- Create: python/interactive-course/package.json
- Create: python/interactive-course/internal/course/content/course.json
- Create: python/interactive-course/internal/course/content/lessons/python-functions-01/lesson.json
- Create: python/interactive-course/internal/course/content/lessons/python-functions-01/starter.py
- Create: python/interactive-course/internal/course/content/lessons/python-functions-01/example.py
- Create: python/interactive-course/internal/course/content/lessons/python-functions-01/hidden_test.py
- Create: python/interactive-course/server/model.mjs
- Create: python/interactive-course/server/catalog.mjs
- Create: python/interactive-course/test/course-and-http.test.mjs

**Interfaces:**

- Consumes: 仓库根目录、Node.js 24.15.0。
- Produces: loadLearningCatalog(filePath?)、loadCourse(contentRoot?)、Catalog.publicCourse()、Catalog.lesson(id)。
- Public lesson fields: id、track、stage、title、objectives、prerequisites、activityTypes、sourceRefs、estimatedMinutes、explanation、starterCode、exampleCode、exerciseGoal、hints。
- Private lesson fields: hiddenTest。该字段不得出现在 GET /api/course 的结果中。

- [ ] **Step 1: 创建 package.json 和第一条失败测试**

python/interactive-course/package.json：

~~~json
{
  "name": "python-interactive-course",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "start": "node server/main.mjs",
    "test": "node --test test/*.test.mjs"
  }
}
~~~

python/interactive-course/test/course-and-http.test.mjs 的第 1 个且仅第 1 个目录测试：

~~~javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLearningCatalog } from '../../../learning/catalog.mjs';
import { loadCourse } from '../server/catalog.mjs';

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
~~~

- [ ] **Step 2: 运行测试并确认 RED**

Run:

~~~bash
cd python/interactive-course
node --test --test-name-pattern="loads the shared route" test/course-and-http.test.mjs
~~~

Expected: FAIL，提示 learning/catalog.mjs 或 server/catalog.mjs 不存在。

- [ ] **Step 3: 创建公共目录**

learning/catalog.json：

~~~json
{
  "version": 1,
  "currentTrack": "python",
  "tracks": [
    {
      "id": "python",
      "stage": "foundation",
      "title": "Python 基础与自动化",
      "entryCommand": "cd python/interactive-course && npm start",
      "sourceRefs": [
        "https://programming-26.mooc.fi/",
        "https://cs50.harvard.edu/python/"
      ],
      "representativeUnit": "python-functions-01"
    },
    {
      "id": "go",
      "stage": "engineering",
      "title": "Go 工程与并发",
      "entryCommand": "cd go/interactive-course && go run ./cmd/server --addr 127.0.0.1:8080 --runner-mode local",
      "sourceRefs": [
        "https://go.dev/tour/",
        "https://quii.gitbook.io/learn-go-with-tests"
      ],
      "representativeUnit": "go-start-01"
    },
    {
      "id": "rust",
      "stage": "systems",
      "title": "Rust 系统建模",
      "entryCommand": "cd rust/interactive-course && npm start",
      "sourceRefs": [
        "https://doc.rust-lang.org/book/",
        "https://rustlings.rust-lang.org/"
      ],
      "representativeUnit": "rust-start-00"
    }
  ]
}
~~~

learning/catalog.mjs：

~~~javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PATH = fileURLToPath(
  new URL('./catalog.json', import.meta.url),
);
const TRACK_IDS = ['python', 'go', 'rust'];

export function loadLearningCatalog(filePath = DEFAULT_PATH) {
  const value = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  if (value.version !== 1 || !Array.isArray(value.tracks)) {
    throw new Error('学习目录格式无效');
  }

  const ids = value.tracks.map((track) => track.id);
  if (ids.join(',') !== TRACK_IDS.join(',')) {
    throw new Error('学习顺序必须是 python、go、rust');
  }

  for (const track of value.tracks) {
    for (const field of [
      'id',
      'stage',
      'title',
      'entryCommand',
      'representativeUnit',
    ]) {
      if (typeof track[field] !== 'string' || !track[field].trim()) {
        throw new Error('学习目录缺少字段: ' + field);
      }
    }
  }

  return Object.freeze({
    version: value.version,
    currentTrack: value.currentTrack,
    tracks: value.tracks.map((track) => Object.freeze({ ...track })),
  });
}
~~~

learning/README.md 只说明顺序、启动命令和当前阶段，不添加第二套课程正文。

- [ ] **Step 4: 创建 Python 代表课节**

course.json：

~~~json
{
  "id": "python-foundation",
  "title": "Python 基础与自动化",
  "track": "python",
  "stage": "foundation",
  "lessons": [
    {
      "id": "python-functions-01",
      "directory": "lessons/python-functions-01"
    }
  ]
}
~~~

lesson.json：

~~~json
{
  "id": "python-functions-01",
  "track": "python",
  "stage": "foundation",
  "title": "用函数汇总日志",
  "objectives": [
    "定义接收列表并返回字典的函数",
    "使用循环和条件统计错误记录"
  ],
  "prerequisites": [],
  "activityTypes": ["guided", "rebuild"],
  "sourceRefs": ["helsinki-python-parts-2-4"],
  "estimatedMinutes": 90,
  "explanation": "把输入、处理和返回值放进函数，避免把逻辑散落在顶层脚本。",
  "exerciseGoal": "实现 summarize(lines)，返回 total 和 errors 两个计数。",
  "hints": [
    "先创建 total 和 errors 变量",
    "用字符串是否包含 ERROR 判断错误记录"
  ]
}
~~~

starter.py：

~~~python
def summarize(lines):
    """Return total and error counts for the given log lines."""
    pass
~~~

example.py：

~~~python
def summarize(lines):
    """Return total and error counts for the given log lines."""
    errors = 0
    for line in lines:
        if "ERROR" in line:
            errors += 1
    return {"total": len(lines), "errors": errors}
~~~

hidden_test.py：

~~~python
import unittest

from solution import summarize


class SummarizeTests(unittest.TestCase):
    def test_counts_total_and_error_lines(self):
        lines = [
            "INFO boot",
            "ERROR missing config",
            "INFO ready",
            "ERROR timeout",
        ]
        self.assertEqual(summarize(lines), {"total": 4, "errors": 2})


if __name__ == "__main__":
    unittest.main()
~~~

- [ ] **Step 5: 实现最小 Catalog**

server/model.mjs：

~~~javascript
export class Catalog {
  constructor(course, lessons) {
    this.course = Object.freeze({ ...course });
    this.lessons = new Map(
      lessons.map((lesson) => [lesson.id, Object.freeze({ ...lesson })]),
    );
  }

  lesson(id) {
    const lesson = this.lessons.get(id);
    if (!lesson) throw new Error('未知课节: ' + id);
    return lesson;
  }

  publicCourse() {
    return {
      ...this.course,
      lessons: [...this.lessons.values()].map(
        ({ hiddenTest, ...lesson }) => lesson,
      ),
    };
  }
}
~~~

server/catalog.mjs：

~~~javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Catalog } from './model.mjs';

const DEFAULT_ROOT = fileURLToPath(
  new URL('../internal/course/content/', import.meta.url),
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function loadCourse(contentRoot = DEFAULT_ROOT) {
  const root = path.resolve(contentRoot);
  const course = readJson(path.join(root, 'course.json'));
  const seen = new Set();

  const lessons = course.lessons.map((entry) => {
    if (seen.has(entry.id)) throw new Error('课节 id 重复: ' + entry.id);
    seen.add(entry.id);

    const lessonRoot = path.join(root, entry.directory);
    const metadata = readJson(path.join(lessonRoot, 'lesson.json'));
    if (metadata.id !== entry.id) {
      throw new Error('课节 id 与目录声明不一致: ' + entry.id);
    }

    return {
      ...metadata,
      starterCode: readText(path.join(lessonRoot, 'starter.py')),
      exampleCode: readText(path.join(lessonRoot, 'example.py')),
      hiddenTest: readText(path.join(lessonRoot, 'hidden_test.py')),
    };
  });

  return new Catalog(
    {
      id: course.id,
      title: course.title,
      track: course.track,
      stage: course.stage,
    },
    lessons,
  );
}
~~~

- [ ] **Step 6: 运行第 1 个测试并确认 GREEN**

Run:

~~~bash
cd python/interactive-course
npm test
~~~

Expected: 1 test passed。

- [ ] **Step 7: 提交**

~~~bash
git add learning python/interactive-course/package.json python/interactive-course/internal python/interactive-course/server/model.mjs python/interactive-course/server/catalog.mjs python/interactive-course/test/course-and-http.test.mjs
git commit -m "feat: add shared learning catalog"
~~~

---

### Task 2: 本机 CPython 执行器与 HTTP API

**Files:**

- Create: python/interactive-course/server/runner.mjs
- Create: python/interactive-course/server/http.mjs
- Create: python/interactive-course/server/main.mjs
- Modify: python/interactive-course/test/course-and-http.test.mjs

**Interfaces:**

- Consumes: Catalog.lesson(id) 返回的 hiddenTest、本机 python 命令。
- Produces: createPythonRunner(options).run({ code, hiddenTest })。
- Produces: createHandler({ catalog, runner, staticRoot })。
- GET /api/course 返回 Catalog.publicCourse()。
- POST /api/execute 接收 { lessonId, code }。
- 执行结果字段固定为 status、stdout、stderr、diagnostics、checks、durationMs。

- [ ] **Step 1: 在现有测试文件增加正确答案和错误答案两个失败测试**

只新增以下两个用例，使该平台回归测试文件总数固定为 3：

~~~javascript
import http from 'node:http';
import { once } from 'node:events';
import { createHandler } from '../server/http.mjs';
import { createPythonRunner } from '../server/runner.mjs';

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
~~~

- [ ] **Step 2: 运行测试并确认 RED**

Run:

~~~bash
cd python/interactive-course
npm test
~~~

Expected: 第 1 个目录测试通过；新增两个执行测试因 runner.mjs/http.mjs 不存在而失败。

- [ ] **Step 3: 实现 runner.mjs**

实现以下公开结构，不额外导出内部辅助函数：

~~~javascript
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_CODE_BYTES = 64 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 32 * 1024;

export function createPythonRunner(options = {}) {
  const pythonCommand = options.pythonCommand || 'python';
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxOutputBytes =
    options.maxOutputBytes || DEFAULT_MAX_OUTPUT_BYTES;

  return {
    async run({ code, hiddenTest }) {
      if (typeof code !== 'string' || !code.trim()) {
        return result('invalid_request', '', '代码不能为空', 0);
      }
      if (Buffer.byteLength(code) > DEFAULT_MAX_CODE_BYTES) {
        return result('invalid_request', '', '代码超过 64 KiB', 0);
      }

      const startedAt = performance.now();
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'python-course-'),
      );

      try {
        await fs.writeFile(path.join(tempDir, 'solution.py'), code, 'utf8');
        await fs.writeFile(
          path.join(tempDir, 'test_lesson.py'),
          hiddenTest,
          'utf8',
        );
        const processResult = await execute({
          pythonCommand,
          cwd: tempDir,
          timeoutMs,
          maxOutputBytes,
        });
        return classify(processResult, performance.now() - startedAt);
      } catch (error) {
        return result(
          'runner_unavailable',
          '',
          error instanceof Error ? error.message : String(error),
          performance.now() - startedAt,
        );
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    },
  };
}

function execute({ pythonCommand, cwd, timeoutMs, maxOutputBytes }) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonCommand,
      ['-m', 'unittest', '-v', 'test_lesson.py'],
      { cwd, windowsHide: true },
    );
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const append = (current, chunk) =>
      (current + chunk.toString()).slice(-maxOutputBytes);
    child.stdout.on('data', (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr = append(stderr, chunk);
    });
    child.once('error', reject);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.once('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
}

function classify(value, durationMs) {
  if (value.timedOut) {
    return result('timeout', value.stdout, '执行超过 5 秒', durationMs);
  }
  if (value.exitCode === 0) {
    return result('passed', value.stdout, value.stderr, durationMs);
  }

  const output = value.stdout + '\n' + value.stderr;
  if (/SyntaxError|IndentationError|TabError/.test(output)) {
    return result('compile_error', value.stdout, value.stderr, durationMs);
  }
  if (/FAILED \(failures=/.test(output)) {
    return result('test_failed', value.stdout, value.stderr, durationMs);
  }
  return result('runtime_error', value.stdout, value.stderr, durationMs);
}

function result(status, stdout, stderr, durationMs) {
  return {
    status,
    stdout,
    stderr,
    diagnostics: [],
    checks: [],
    durationMs: Math.round(durationMs),
  };
}
~~~

实现时修正进程 error 与 close 可能重复结算的问题，但不为重复关闭、信号排列
或极端竞态添加测试矩阵。

- [ ] **Step 4: 实现 http.mjs 和 main.mjs**

http.mjs 必须完成：

~~~javascript
import fs from 'node:fs';
import path from 'node:path';

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

      writeJson(response, 404, { error: 'Not found' });
    } catch (error) {
      writeJson(response, 500, {
        status: 'runner_unavailable',
        stderr: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
~~~

同文件实现 readJson、serveStatic、writeJson。静态路径只允许解析到 staticRoot
内部；默认文档为 index.html。

main.mjs：

~~~javascript
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
~~~

- [ ] **Step 5: 运行 3 个核心测试并确认 GREEN**

Run:

~~~bash
cd python/interactive-course
npm test
~~~

Expected: 3 tests passed。

- [ ] **Step 6: 提交**

~~~bash
git add python/interactive-course/server python/interactive-course/test/course-and-http.test.mjs
git commit -m "feat: execute Python course exercises"
~~~

---

### Task 3: Python 课程页面与本地进度

**Files:**

- Create: python/interactive-course/web/index.html
- Create: python/interactive-course/web/app.js
- Create: python/interactive-course/web/store.js
- Create: python/interactive-course/web/styles.css
- Create: python/interactive-course/test/store.test.mjs

**Interfaces:**

- Consumes: GET /api/course、POST /api/execute。
- Produces: createStore(storage)、createCourseApp(dependencies)。
- Progress shape: currentLessonId、drafts、practiced、mastered。
- 本计划只有一个课节；practiced 在执行通过后写入，mastered 由“完成独立重建”复选框显式写入。

- [ ] **Step 1: 写 store 的最后两个自动化测试**

test/store.test.mjs 固定只有以下两个用例：

~~~javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../web/store.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test('restores the current lesson, draft and mastery evidence', () => {
  const storage = memoryStorage();
  const store = createStore(storage);

  store.save({
    currentLessonId: 'python-functions-01',
    drafts: { 'python-functions-01': 'def summarize(lines):\n    return {}' },
    practiced: ['python-functions-01'],
    mastered: ['python-functions-01'],
  });

  assert.deepEqual(store.load(), {
    currentLessonId: 'python-functions-01',
    drafts: { 'python-functions-01': 'def summarize(lines):\n    return {}' },
    practiced: ['python-functions-01'],
    mastered: ['python-functions-01'],
  });
});

test('falls back to empty progress when storage is corrupted', () => {
  const storage = memoryStorage({
    'python-course.progress.v1': '{broken json',
  });
  const store = createStore(storage);

  assert.deepEqual(store.load(), {
    currentLessonId: '',
    drafts: {},
    practiced: [],
    mastered: [],
  });
});
~~~

- [ ] **Step 2: 运行测试并确认 RED**

Run:

~~~bash
cd python/interactive-course
node --test test/store.test.mjs
~~~

Expected: FAIL，提示 web/store.js 不存在。

- [ ] **Step 3: 实现 store.js**

~~~javascript
const STORAGE_KEY = 'python-course.progress.v1';
const EMPTY_STATE = Object.freeze({
  currentLessonId: '',
  drafts: {},
  practiced: [],
  mastered: [],
});

export function createStore(storage = globalThis.localStorage) {
  return {
    load() {
      try {
        const value = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
        return normalize(value);
      } catch {
        return clone(EMPTY_STATE);
      }
    },
    save(value) {
      const next = normalize(value);
      storage?.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    },
  };
}

function normalize(value) {
  if (!value || typeof value !== 'object') return clone(EMPTY_STATE);
  return {
    currentLessonId:
      typeof value.currentLessonId === 'string'
        ? value.currentLessonId
        : '',
    drafts:
      value.drafts && typeof value.drafts === 'object'
        ? { ...value.drafts }
        : {},
    practiced: uniqueStrings(value.practiced),
    mastered: uniqueStrings(value.mastered),
  };
}

function uniqueStrings(value) {
  return [...new Set(Array.isArray(value) ? value.filter(
    (item) => typeof item === 'string' && item,
  ) : [])];
}

function clone(value) {
  return {
    currentLessonId: value.currentLessonId,
    drafts: { ...value.drafts },
    practiced: [...value.practiced],
    mastered: [...value.mastered],
  };
}
~~~

- [ ] **Step 4: 创建语义化页面骨架**

index.html 必须包含：

- header：产品名“本地编程工坊”和当前阶段“Python 基础与自动化”。
- nav：课节列表和 practiced/mastered 文本状态。
- main：目标、讲解、示例、编辑器、运行按钮、独立重建复选框、结果区。
- textarea 有可见 label。
- 结果区使用 aria-live="polite"。
- 不使用嵌套卡片、装饰渐变、emoji 或全页 spinner。

核心结构：

~~~html
<body>
  <header class="topbar">
    <div>
      <p class="product-name">本地编程工坊</p>
      <h1>Python 基础与自动化</h1>
    </div>
    <p id="progress-summary" class="progress-summary"></p>
  </header>
  <div class="course-layout">
    <nav aria-label="课程目录">
      <ol id="lesson-list"></ol>
    </nav>
    <main id="course-main" tabindex="-1">
      <section id="lesson-copy"></section>
      <section class="workspace">
        <div class="editor-pane">
          <label for="code-editor">你的 Python 代码</label>
          <textarea id="code-editor" spellcheck="false"></textarea>
          <div class="actions">
            <button id="run-button" type="button">运行练习</button>
            <label class="mastery-check">
              <input id="mastered-check" type="checkbox">
              我已从空白文件独立重建
            </label>
          </div>
        </div>
        <section class="result-pane" aria-labelledby="result-title">
          <h2 id="result-title">运行结果</h2>
          <pre id="result-output" aria-live="polite">尚未运行</pre>
        </section>
      </section>
    </main>
  </div>
  <script type="module" src="./app.js"></script>
</body>
~~~

- [ ] **Step 5: 实现 app.js 的单课节主流程**

app.js 使用 createStore，完成：

1. 加载 /api/course。
2. 恢复当前课节和草稿。
3. 编辑时保存草稿。
4. 运行时禁用按钮并显示“正在运行”。
5. passed 时写入 practiced。
6. mastered 复选框单独写入 mastered。
7. compile_error、test_failed、runtime_error、timeout、runner_unavailable
   显示状态名称、stdout 和 stderr。
8. 请求失败时保留草稿并显示可操作错误。

不得增加第二套客户端状态机。页面状态只由 course、activeLesson、progress、
running、lastResult 五个变量组成。

- [ ] **Step 6: 实现 styles.css**

CSS token 起点：

~~~css
:root {
  color-scheme: light;
  --bg: #eef2ef;
  --surface: #ffffff;
  --surface-strong: #1f2924;
  --text: #18211c;
  --muted: #627068;
  --border: #c8d2cb;
  --accent: #176b4a;
  --accent-strong: #0f5137;
  --success: #1e6b45;
  --danger: #a13d36;
  --warning: #8a5a10;
  --focus: #d3952c;
  --radius: 6px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
}
~~~

布局约束：

- body 使用非纯白背景，主内容不包在浮动大卡片中。
- course-layout 桌面为 240px + minmax(0, 1fr)。
- workspace 桌面为 minmax(0, 1fr) + minmax(280px, 0.7fr)。
- textarea 高度使用 clamp(320px, 48vh, 560px)，动态内容不得改变工具栏尺寸。
- 结果区使用深色表面，但整体页面不能读成单一深蓝/暗色主题。
- 720px 以下改为单列，导航横向滚动或折叠，按钮高度至少 44px。
- :focus-visible 使用 3px 实线 focus token。
- prefers-reduced-motion: reduce 时禁用非必要过渡。

- [ ] **Step 7: 运行全部 5 个平台回归测试**

Run:

~~~bash
cd python/interactive-course
npm test
~~~

Expected: 5 tests passed，测试文件数为 2。

不得新增 Playwright、快照、CSS 或 DOM 单元测试。
课程目录中的 hidden_test.py 另有 1 个 unittest 用例，作为学习者提交代码的验收
脚本；它不由 npm test 直接发现，但计入总测试代码预算。

- [ ] **Step 8: 浏览器人工验收**

Start:

~~~bash
cd python/interactive-course
npm start
~~~

检查 http://127.0.0.1:8010：

- 1280x800：目录、讲解、编辑器和结果区无重叠；编辑器和结果区均可直接操作。
- 390x844：页面单列，正文与按钮不溢出，运行结果不会遮挡编辑器。
- 正确答案显示 passed，并在刷新后保留 practiced。
- 勾选独立重建后刷新，mastered 仍保留。
- 错误答案显示 test_failed 和 unittest 失败信息。
- 手动制造 SyntaxError，显示 compile_error 和真实 Python 行号。
- Tab 可遍历目录、编辑器、运行按钮和掌握复选框。
- 减弱动效偏好下没有非必要动画。

使用浏览器截图验证桌面和移动端，但截图验收不转化为自动化测试文件。

- [ ] **Step 9: 提交**

~~~bash
git add python/interactive-course/web python/interactive-course/test/store.test.mjs
git commit -m "feat: add Python course interface"
~~~

---

### Task 4: 文档、核心验证与交付

**Files:**

- Modify: python/README.md
- Modify: README.md
- Verify only: learning/、python/interactive-course/。

**Interfaces:**

- Consumes: 前三项任务的启动命令、端口和测试预算。
- Produces: 新学习入口的唯一启动说明。

- [ ] **Step 1: 重写 python/README.md**

README 必须：

- 删除不存在的 basics-course/、sync-course.mjs、Pyodide 和 CDN 说明。
- 将主线说明改为 Helsinki MOOC 默认、CS50P 视频替代。
- 给出本地启动命令：

~~~bash
cd python/interactive-course
npm start
~~~

- 给出访问地址 http://127.0.0.1:8010。
- 给出工具要求 Node.js 24.15.0、CPython 3.12+。
- 明确首版只有一个代表课节，用于验证课程契约和执行反馈。
- 只列 npm test 一个平台回归验证命令，并注明平台回归固定为 2 个文件、5 个用例。
- 明确课程验收脚本另有 1 个文件、1 个用例，总测试代码预算为 3 个文件、6 个用例。

- [ ] **Step 2: 更新根 README.md**

在 RPG 介绍之前或目录区域增加“多语言学习工坊”入口：

- learning/：三语言顺序和公共目录。
- python/interactive-course/：当前可运行的 Python 垂直切片。
- go/interactive-course/：现有 Go 课程。
- rust/interactive-course/：现有 Rust 课程。
- rpg/：可选项目化练习，不再作为全部课程边界。

不删除现有 RPG 启动和 VS Code 扩展说明。

- [ ] **Step 3: 运行定向语法检查**

Run each command separately:

~~~bash
node --check learning/catalog.mjs
node --check python/interactive-course/server/catalog.mjs
node --check python/interactive-course/server/http.mjs
node --check python/interactive-course/server/main.mjs
node --check python/interactive-course/server/model.mjs
node --check python/interactive-course/server/runner.mjs
node --check python/interactive-course/web/app.js
node --check python/interactive-course/web/store.js
~~~

Expected: 每条命令退出码 0。

- [ ] **Step 4: 运行唯一自动化测试命令**

~~~bash
cd python/interactive-course
npm test
~~~

Expected:

- 2 个测试文件。
- 5 个测试用例。
- 5 passed，0 failed。

以上数量只统计 npm test 平台回归套件；还需静态核对 hidden_test.py 恰好包含 1 个
unittest 用例，使本阶段测试代码总量保持为 3 个文件、6 个用例。

不要运行 rpg/、Go 或 Rust 全量测试；本计划未修改这些模块。

- [ ] **Step 5: 核对测试预算和改动范围**

Run:

~~~bash
git status --short
git diff --check
~~~

确认：

- 平台回归测试文件只有 course-and-http.test.mjs 和 store.test.mjs，共 5 个用例。
- 课程验收脚本只有 hidden_test.py，共 1 个 unittest 用例。
- 测试代码总量为 3 个文件、6 个用例。
- 没有修改 rpg/、go/interactive-course/ 或 rust/interactive-course/。
- 没有把工作区原有无关改动加入暂存区。

- [ ] **Step 6: 完成人工浏览器验收**

重新执行 Task 3 的桌面、移动、正确答案、错误答案、语法错误、进度恢复和键盘
检查。记录截图路径和发现的问题；修复只围绕这些核心状态，不追加自动化测试。

- [ ] **Step 7: 提交文档与交付修订**

~~~bash
git add README.md python/README.md learning/README.md
git commit -m "docs: document Python learning entry"
~~~

## Plan Self-Review

### Spec Coverage

- Python -> Go -> Rust 顺序：Task 1 的 learning/catalog.json。
- 外部课程引用而非复制：Task 1 的 sourceRefs 和 learning/README.md。
- 独立 Python 入口：Task 1 至 Task 3。
- 本机 CPython + unittest：Task 2。
- 公共执行结果语义：Task 2。
- practiced 与 mastered 分离：Task 3。
- 本地进度恢复：Task 3。
- 核心测试和测试预算：Global Constraints、Task 2、Task 3、Task 4。
- 可访问性与响应式：Task 3 人工验收。

### Intentionally Deferred

- 统一 Hub UI。
- Go 执行结果适配。
- Rust 执行结果适配。
- 完整 Python 主线课程。
- 跨语言日志分析项目。
- RPG 选修项目映射。

这些子系统各自需要独立规格复核或实施计划。不得在执行本计划时顺手加入。

### Fixed Test Budget

| 测试文件 | 用例数 | 覆盖 |
|---|---:|---|
| test/course-and-http.test.mjs | 3 | 目录公开边界、正确答案、错误答案 |
| test/store.test.mjs | 2 | 进度恢复、损坏状态回退 |
| internal/course/content/lessons/python-functions-01/hidden_test.py | 1 | 学习者答案的核心行为验收 |
| 合计 | 6 | 3 个文件，不得增加 |

计划中没有未完成占位、“类似上一任务”或未定义接口。后续任务使用的函数名和状态
均由前置任务明确产生。
