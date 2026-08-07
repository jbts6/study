import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const modulePath = resolve('python', 'basics-course', 'runner-adapter.js');

test('运行器适配器初始化并执行 Python 代码', async () => {
  const source = existsSync(modulePath) ? readFileSync(modulePath, 'utf8') : '';
  const context = { window: {} };
  runInNewContext(source, context);

  const statuses = [];
  const runner = {
    async init() {},
    async run(code) {
      return { ok: true, output: `输出：${code}` };
    },
  };
  const global = {
    loadPyodide: 'loadPyodide',
    createPythonRunner(options) {
      assert.equal(options.loadPyodide, 'loadPyodide');
      return runner;
    },
  };
  const createRunnerAdapter = context.window.PythonCourseRunnerAdapter?.createRunnerAdapter;
  assert.equal(typeof createRunnerAdapter, 'function');

  const adapter = createRunnerAdapter({
    global,
    document: {},
    setRuntimeStatus: (message, kind) => statuses.push([message, kind]),
  });
  await adapter.initialize();

  const editor = { value: 'print(1)' };
  const output = {};
  const button = { disabled: false };
  await adapter.run(editor, output, button);

  assert.deepEqual(statuses, [
    ['正在加载 Python 运行时…', 'loading'],
    ['Python 已就绪', 'ready'],
  ]);
  assert.equal(output.className, 'code-output is-success');
  assert.equal(output.textContent, '输出：print(1)');
  assert.equal(button.disabled, false);
});
