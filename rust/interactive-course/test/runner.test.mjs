import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_MAX_CODE_BYTES,
  createCargoRunner,
  validateCode,
} from '../server/runner.mjs';
import { parseCargoOutput } from '../server/output.mjs';

const tests = [{ id: 'greeting', label: '返回正确问候' }];
const hiddenTest = `
use rust_lesson::greeting;

#[test]
fn greeting_hidden_test() {
    assert_eq!(greeting("Ada"), "Hello, Ada!");
}
`;

test('validateCode rejects empty, NUL, and oversized input', () => {
  assert.deepEqual(validateCode(''), { ok: false, message: '代码不能为空' });
  assert.deepEqual(validateCode('fn main() {\u0000 }'), {
    ok: false,
    message: '代码包含不支持的控制字符',
  });
  const result = validateCode('x'.repeat(DEFAULT_MAX_CODE_BYTES + 1));
  assert.equal(result.ok, false);
  assert.match(result.message, /64 KiB/);
});

test('parseCargoOutput maps compile and test failures', () => {
  const compile = parseCargoOutput({
    stdout: '',
    stderr: 'error[E0425]: cannot find value `x`\nerror: could not compile `rust_lesson`',
    exitCode: 101,
    tests,
  });
  assert.equal(compile.status, 'compile_error');

  const failed = parseCargoOutput({
    stdout: 'test greeting_hidden_test ... FAILED\ntest result: FAILED. 0 passed; 1 failed',
    stderr: '',
    exitCode: 101,
    tests,
  });
  assert.equal(failed.status, 'test_failed');
  assert.equal(failed.tests[0].status, 'failed');
});

test('cargo runner executes a passing hidden test', async () => {
  const runner = createCargoRunner({ timeoutMs: 30_000 });
  const result = await runner.run({
    code: 'pub fn greeting(name: &str) -> String { format!("Hello, {name}!") }',
    hiddenTest,
    tests,
  });

  assert.equal(result.status, 'passed');
  assert.equal(result.tests[0].status, 'passed');
});

test('cargo runner reports compile errors without throwing', async () => {
  const runner = createCargoRunner({ timeoutMs: 30_000 });
  const result = await runner.run({
    code: 'pub fn greeting(name: &str) -> String {',
    hiddenTest,
    tests,
  });

  assert.equal(result.status, 'compile_error');
  assert.ok(result.stderr || result.diagnostics.length > 0);
});

test('cargo runner reports an unavailable command', async () => {
  const runner = createCargoRunner({ cargoCommand: 'study-cargo-does-not-exist' });
  const result = await runner.run({ code: 'pub fn answer() -> i32 { 42 }', hiddenTest: '#[test] fn ok() {}', tests });

  assert.equal(result.status, 'runner_unavailable');
});

test('cargo runner stops a job after the timeout', async () => {
  const runner = createCargoRunner({ timeoutMs: 1 });
  const result = await runner.run({
    code: 'pub fn answer() -> i32 { 42 }',
    hiddenTest: '#[test] fn slow() { std::thread::sleep(std::time::Duration::from_secs(5)); }',
    tests,
  });

  assert.equal(result.status, 'timeout');
});

test('cargo runner truncates noisy output', async () => {
  const runner = createCargoRunner({ maxOutputBytes: 512, timeoutMs: 30_000 });
  const result = await runner.run({
    code: 'pub fn answer() -> i32 { 42 }',
    hiddenTest: '#[test] fn noisy() { println!("{}", "x".repeat(100_000)); }',
    tests,
  });

  assert.ok(Buffer.byteLength(result.stdout, 'utf8') <= 512);
});
