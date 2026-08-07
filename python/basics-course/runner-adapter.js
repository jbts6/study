(function attachPythonRunnerAdapter(global) {
  'use strict';

  function createRunnerAdapter(options = {}) {
    const runtimeGlobal = options.global || global;
    const document = options.document || runtimeGlobal.document;
    const setRuntimeStatus = options.setRuntimeStatus || (() => {});
    let pythonRunner = null;

    async function initialize() {
      try {
        const factory = runtimeGlobal.createPythonRunner
          || runtimeGlobal.PythonCourseRunner?.createPythonRunner;
        pythonRunner = typeof factory === 'function'
          ? factory({ loadPyodide: runtimeGlobal.loadPyodide, document })
          : null;
        if (!pythonRunner || typeof pythonRunner.init !== 'function') {
          setRuntimeStatus('运行器待 Task 3 接入', 'idle');
          return;
        }
        setRuntimeStatus('正在加载 Python 运行时…', 'loading');
        await pythonRunner.init();
        setRuntimeStatus('Python 已就绪', 'ready');
      } catch (error) {
        setRuntimeStatus(`Python 加载失败：${error?.message || String(error)}`, 'error');
      }
    }

    async function run(editor, output, button) {
      if (!pythonRunner || typeof pythonRunner.run !== 'function') {
        output.className = 'code-output is-error';
        output.textContent = 'Python 运行器尚未加载，等待 Task 3 提供 runner.js。';
        return;
      }
      button.disabled = true;
      output.className = 'code-output is-running';
      output.textContent = '运行中…';
      try {
        const result = await pythonRunner.run(editor.value);
        output.className = result?.ok ? 'code-output is-success' : 'code-output is-error';
        output.textContent = result?.ok
          ? (result.output || '（无输出）')
          : (result?.error || result?.output || '代码运行失败。');
      } catch (error) {
        output.className = 'code-output is-error';
        output.textContent = `代码运行失败：${error?.message || String(error)}`;
      } finally {
        button.disabled = false;
      }
    }

    return { initialize, run };
  }

  global.PythonCourseRunnerAdapter = { createRunnerAdapter };
})(window);
