import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parseCargoOutput, truncateOutput } from './output.mjs';

export const DEFAULT_MAX_CODE_BYTES = 64 * 1024;
export const DEFAULT_MAX_OUTPUT_BYTES = 32 * 1024;
export const DEFAULT_TIMEOUT_MS = 5_000;

export function validateCode(code, maxBytes = DEFAULT_MAX_CODE_BYTES) {
  if (typeof code !== 'string' || code.trim() === '') {
    return { ok: false, message: '代码不能为空' };
  }
  if (code.includes('\u0000')) {
    return { ok: false, message: '代码包含不支持的控制字符' };
  }
  if (Buffer.byteLength(code, 'utf8') > maxBytes) {
    return { ok: false, message: `代码不能超过 ${Math.round(maxBytes / 1024)} KiB` };
  }
  return { ok: true };
}

export function createCargoRunner(options = {}) {
  const cargoCommand = options.cargoCommand || 'cargo';
  const maxCodeBytes = options.maxCodeBytes || DEFAULT_MAX_CODE_BYTES;
  const maxOutputBytes = options.maxOutputBytes || DEFAULT_MAX_OUTPUT_BYTES;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const spawnProcess = options.spawnProcess || spawn;

  return {
    async run({ code, hiddenTest, tests = [] }) {
      const validation = validateCode(code, maxCodeBytes);
      if (!validation.ok) return invalidResult(validation.message, tests);
      if (typeof hiddenTest !== 'string' || hiddenTest.trim() === '') {
        return invalidResult('课节测试不可用', tests);
      }

      let tempDir = null;
      try {
        tempDir = await createProject(code, hiddenTest);
        const processResult = await executeCargo({
          spawnProcess,
          cargoCommand,
          manifestPath: path.join(tempDir, 'Cargo.toml'),
          timeoutMs,
          maxOutputBytes,
        });
        if (processResult.error?.code === 'ENOENT') {
          return unavailableResult('未找到 cargo，请先安装 Rust 工具链');
        }

        const stdout = sanitizePath(processResult.stdout, tempDir);
        const stderr = sanitizePath(processResult.stderr, tempDir);
        return parseCargoOutput({
          stdout,
          stderr,
          exitCode: processResult.exitCode,
          timedOut: processResult.timedOut,
          tests,
        });
      } catch (error) {
        if (error?.code === 'ENOENT') return unavailableResult('未找到 cargo，请先安装 Rust 工具链');
        return unavailableResult(`运行器不可用: ${error.message}`);
      } finally {
        if (tempDir) await rm(tempDir, { recursive: true, force: true });
      }
    },
  };
}

async function createProject(code, hiddenTest) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'rust-course-'));
  try {
    await mkdir(path.join(tempDir, 'src'), { recursive: true });
    await mkdir(path.join(tempDir, 'tests'), { recursive: true });
    await writeFile(path.join(tempDir, 'Cargo.toml'), [
      '[package]',
      'name = "rust_lesson"',
      'version = "0.1.0"',
      'edition = "2021"',
      '',
      '[lib]',
      'path = "src/lib.rs"',
      '',
    ].join('\n'));
    await writeFile(path.join(tempDir, 'src/lib.rs'), code);
    await writeFile(path.join(tempDir, 'tests/lesson.rs'), hiddenTest);
    return tempDir;
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function executeCargo({ spawnProcess, cargoCommand, manifestPath, timeoutMs, maxOutputBytes }) {
  return new Promise((resolve) => {
    let timedOut = false;
    let settled = false;
    const child = spawnProcess(
      cargoCommand,
      ['test', '--quiet', '--manifest-path', manifestPath, '--', '--nocapture'],
      { cwd: path.dirname(manifestPath), windowsHide: true },
    );
    const stdout = collectStream(child.stdout, maxOutputBytes);
    const stderr = collectStream(child.stderr, maxOutputBytes);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      Promise.all([stdout, stderr]).then(([out, err]) => resolve({
        ...result,
        stdout: out,
        stderr: err,
        timedOut,
      }));
    };

    child.once('error', (error) => finish({ error, exitCode: null }));
    child.once('close', (exitCode) => finish({ exitCode, error: null }));
  });
}

function collectStream(stream, maxBytes) {
  if (!stream) return Promise.resolve('');
  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    stream.on('data', (chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (total < maxBytes) {
        chunks.push(bytes.subarray(0, maxBytes - total));
      }
      total += bytes.length;
    });
    stream.on('end', () => {
      const output = Buffer.concat(chunks).toString('utf8');
      const suffix = total > maxBytes ? '\n[输出已截断]' : '';
      resolve(truncateOutput(output + suffix, maxBytes).value);
    });
    stream.on('error', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function sanitizePath(value, tempDir) {
  return value.split(tempDir).join('<temp-project>');
}

function invalidResult(message, tests) {
  return {
    status: 'invalid_request',
    stdout: '',
    stderr: message,
    diagnostics: [{ message }],
    tests: tests.map((test) => ({ ...test, status: 'failed', message })),
  };
}

function unavailableResult(message) {
  return {
    status: 'runner_unavailable',
    stdout: '',
    stderr: message,
    diagnostics: [{ message }],
    tests: [],
  };
}
