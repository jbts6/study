import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const runnerPath = resolve('python', 'basics-course', 'runner.js');

function loadFactory() {
  const window = { TextEncoder, TextDecoder };
  runInNewContext(readFileSync(runnerPath, 'utf8'), { window, TextEncoder, TextDecoder });
  return window.PythonCourseRunner.createPythonRunner;
}

test('未初始化时返回可显示的就绪提示', async () => {
  const createPythonRunner = loadFactory();
  const runner = createPythonRunner({ loadPyodide: async () => ({}) });

  const result = await runner.run('print(1)');
  assert.equal(result.ok, false);
  assert.equal(result.output, '');
  assert.equal(result.error, 'Python 运行时尚未就绪');
});

test('初始化加载状态和动态包后执行 Python', async () => {
  const createPythonRunner = loadFactory();
  const calls = [];
  const statuses = [];
  const fake = {
    async loadPackagesFromImports(code) {
      calls.push(['packages', code]);
    },
    async runPythonAsync(code) {
      calls.push(['run', code]);
      return 'ok';
    }
  };
  const runner = createPythonRunner({
    loadPyodide: async () => fake,
    onStatus: (status) => statuses.push(status)
  });

  assert.equal(runner.status, 'idle');
  await runner.init();
  assert.equal(runner.status, 'ready');
  const result = await runner.run('import math\nprint(math.sqrt(9))');
  assert.equal(result.ok, true);
  assert.equal(result.output, 'ok');
  assert.equal(calls[0][0], 'packages');
  assert.equal(calls[1][0], 'run');
  assert.deepEqual(statuses.map(({ state }) => state), ['loading', 'ready', 'running', 'ready']);
});

test('运行异常返回最后的 traceback，而不是抛出到页面', async () => {
  const createPythonRunner = loadFactory();
  const runner = createPythonRunner({
    loadPyodide: async () => ({
      async loadPackagesFromImports() {},
      async runPythonAsync() {
        throw new Error('Traceback (most recent call last):\n  File "/usr/local/lib/python3.12/site-packages/pyodide.py", line 2\nRuntimeError: bad code');
      }
    })
  });

  await runner.init();
  const result = await runner.run('broken');
  assert.equal(result.ok, false);
  assert.equal(result.output, '');
  assert.match(result.error, /RuntimeError: bad code/);
  assert.doesNotMatch(result.error, /usr\/local\/lib/);
});

test('无输出返回约定文本，过长输出限制在 32 KiB 内', async () => {
  const createPythonRunner = loadFactory();
  let value;
  const runner = createPythonRunner({
    loadPyodide: async () => ({
      async loadPackagesFromImports() {},
      async runPythonAsync() {
        return value;
      }
    })
  });

  await runner.init();
  value = undefined;
  const emptyResult = await runner.run('pass');
  assert.equal(emptyResult.ok, true);
  assert.equal(emptyResult.output, '（无输出）');
  value = 'x'.repeat(40 * 1024);
  const result = await runner.run('print("x")');
  assert.equal(result.ok, true);
  assert.ok(new TextEncoder().encode(result.output).length <= 32 * 1024);
  assert.match(result.output, /输出已截断/);
});

test('需要本地 Python 的代码保留异常并追加环境提示', async () => {
  const createPythonRunner = loadFactory();
  const runner = createPythonRunner({
    loadPyodide: async () => ({
      async loadPackagesFromImports() {},
      async runPythonAsync() {
        throw new Error("ModuleNotFoundError: No module named 'requests'");
      }
    })
  });

  await runner.init();
  const result = await runner.run('import requests');
  assert.equal(result.ok, false);
  assert.match(result.error, /ModuleNotFoundError/);
  assert.match(result.error, /该示例需要本地 Python 环境/);
});
