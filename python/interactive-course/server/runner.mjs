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
      let tempDir = null;

      try {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'python-course-'));
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
        if (tempDir) {
          await fs.rm(tempDir, { recursive: true, force: true });
        }
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
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timedOut = false;
    let settled = false;
    let timer = null;

    const append = (current, chunk) => {
      const combined = Buffer.concat([current, chunk]);
      return combined.length > maxOutputBytes
        ? combined.subarray(combined.length - maxOutputBytes)
        : combined;
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback();
    };

    child.stdout.on('data', (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr = append(stderr, chunk);
    });
    child.once('error', (error) => {
      settle(() => reject(error));
    });
    child.once('close', (exitCode) => {
      settle(() =>
        resolve({
          exitCode,
          stdout: stdout.toString('utf8'),
          stderr: stderr.toString('utf8'),
          timedOut,
        }),
      );
    });

    timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
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
