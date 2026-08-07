(function attachPythonRunner(global) {
  'use strict';

  const MAX_OUTPUT_BYTES = 32 * 1024;
  const NO_OUTPUT = '（无输出）';
  const NOT_READY = 'Python 运行时尚未就绪';
  const LOCAL_PYTHON_HINT = '该示例需要本地 Python 环境';

  function createTextEncoder() {
    const Encoder = global.TextEncoder || (typeof TextEncoder === 'function' ? TextEncoder : null);
    return Encoder ? new Encoder() : null;
  }

  function utf8ByteLength(value, encoder = createTextEncoder()) {
    if (encoder) return encoder.encode(value).length;
    return unescape(encodeURIComponent(value)).length;
  }

  function statusMessage(state) {
    return {
      idle: '等待 Python 运行时',
      loading: '正在加载 Python 运行时…',
      ready: 'Python 已就绪',
      running: '正在运行 Python 代码…',
      error: 'Python 运行时不可用'
    }[state] || state;
  }

  function truncateUtf8(value) {
    const text = String(value ?? '');
    if (!text) return NO_OUTPUT;
    const encoder = createTextEncoder();
    if (utf8ByteLength(text, encoder) <= MAX_OUTPUT_BYTES) return text;

    const suffix = '\n…[输出已截断]';
    const suffixBytes = utf8ByteLength(suffix, encoder);
    const prefixBytes = MAX_OUTPUT_BYTES - suffixBytes;
    let prefix;
    if (encoder) {
      const bytes = encoder.encode(text).slice(0, prefixBytes);
      while (bytes.length && (bytes[bytes.length - 1] & 0xc0) === 0x80) bytes.pop();
      const Decoder = global.TextDecoder || (typeof TextDecoder === 'function' ? TextDecoder : null);
      prefix = Decoder ? new Decoder().decode(bytes) : text.slice(0, prefixBytes);
    } else {
      let usedBytes = 0;
      let end = 0;
      for (const character of text) {
        const characterBytes = utf8ByteLength(character, null);
        if (usedBytes + characterBytes > prefixBytes) break;
        usedBytes += characterBytes;
        end += character.length;
      }
      prefix = text.slice(0, end);
    }
    return `${prefix}${suffix}`;
  }

  function stripHostPaths(value) {
    return String(value)
      .replace(/(["'])(?:[A-Za-z]:[\\/]|\/)[^"'\n]+\1/g, '$1<python-host>$1')
      .replace(/\b(?:[A-Za-z]:[\\/]|\/)(?:[^\s:]|:(?!\d))+?(?=:\d+)/g, '<python-host>');
  }

  function needsLocalPython(code) {
    return /\b(?:requests|urllib|httpx|aiohttp|socket)\b|(?:\b(?:open|Path)\s*\(|__file__)/i.test(code);
  }

  function formatError(error, code) {
    const raw = error instanceof Error ? error.message : String(error ?? 'Python 代码运行失败');
    const lines = stripHostPaths(raw).split(/\r?\n/).filter(Boolean);
    const traceback = lines.slice(-20).join('\n') || 'Python 代码运行失败';
    return needsLocalPython(code) && !traceback.includes(LOCAL_PYTHON_HINT)
      ? `${traceback}\n${LOCAL_PYTHON_HINT}`
      : traceback;
  }

  function decodeResult(value) {
    let raw = value;
    if (raw && typeof raw.toJs === 'function') raw = raw.toJs();
    if (raw instanceof Map) raw = Object.fromEntries(raw.entries());
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && ('output' in parsed || 'error' in parsed)) return parsed;
      } catch {
        // Fake runners and older Pyodide snippets may return plain text.
      }
    }
    if (raw && typeof raw === 'object' && ('output' in raw || 'error' in raw)) return raw;
    return { output: raw == null ? '' : String(raw) };
  }

  function buildExecutionScript(code) {
    const source = JSON.stringify(String(code)).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return `
import contextlib as __course_contextlib
import io as __course_io
import json as __course_json
import traceback as __course_traceback

__course_stdout = __course_io.StringIO()
__course_stderr = __course_io.StringIO()
__course_error = ''
try:
    with __course_contextlib.redirect_stdout(__course_stdout), __course_contextlib.redirect_stderr(__course_stderr):
        exec(compile(${source}, '<python-course>', 'exec'), globals(), globals())
except BaseException:
    __course_error = __course_traceback.format_exc()

__course_json.dumps({
    'output': __course_stdout.getvalue() + __course_stderr.getvalue(),
    'error': __course_error,
})
`;
  }

  function createPythonRunner(options = {}) {
    const loadPyodide = options.loadPyodide;
    const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
    let pyodide = null;
    let state = 'idle';
    let initPromise = null;
    let running = false;

    function setStatus(nextState) {
      state = nextState;
      onStatus({ state, message: statusMessage(state) });
    }

    async function init() {
      if (state === 'ready' && pyodide) return pyodide;
      if (initPromise) return initPromise;
      initPromise = (async () => {
        setStatus('loading');
        try {
          if (typeof loadPyodide !== 'function') throw new Error('Pyodide 加载函数未提供');
          pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
          if (!pyodide || typeof pyodide.runPythonAsync !== 'function') {
            throw new Error('Pyodide 运行时加载不完整');
          }
          setStatus('ready');
          return pyodide;
        } catch (error) {
          pyodide = null;
          setStatus('error');
          throw error;
        } finally {
          initPromise = null;
        }
      })();
      return initPromise;
    }

    async function run(code) {
      if (state !== 'ready' || !pyodide) return { ok: false, output: '', error: NOT_READY };
      if (running) return { ok: false, output: '', error: 'Python 代码正在运行，请稍候' };

      running = true;
      setStatus('running');
      const source = String(code ?? '');
      try {
        if (typeof pyodide.loadPackagesFromImports === 'function') {
          await pyodide.loadPackagesFromImports(source);
        }
        const result = decodeResult(await pyodide.runPythonAsync(buildExecutionScript(source)));
        if (result.error) return { ok: false, output: '', error: formatError(result.error, source) };
        return { ok: true, output: truncateUtf8(result.output) };
      } catch (error) {
        return { ok: false, output: '', error: formatError(error, source) };
      } finally {
        running = false;
        if (state === 'running') setStatus('ready');
      }
    }

    return {
      init,
      run,
      get status() {
        return state;
      }
    };
  }

  global.createPythonRunner = createPythonRunner;
  global.PythonCourseRunner = { createPythonRunner };
})(window);
