const TEST_LINE = /^test\s+([A-Za-z0-9_]+)\s+\.\.\.\s+(ok|FAILED|ignored)\s*$/;

export function parseCargoOutput({ stdout = '', stderr = '', exitCode = 0, timedOut = false, tests = [] }) {
  const output = `${stdout}\n${stderr}`;
  const testStatuses = parseTestStatuses(stdout);
  const status = timedOut
    ? 'timeout'
    : isCompileError(output)
      ? 'compile_error'
      : isTestFailure(output)
        ? 'test_failed'
        : exitCode === 0
          ? 'passed'
          : 'test_failed';

  return {
    status,
    stdout,
    stderr,
    diagnostics: collectDiagnostics(stderr),
    tests: tests.map((definition) => ({
      id: definition.id,
      label: definition.label,
      status: testStatus(definition.id, testStatuses, status),
      message: status === 'passed' ? '' : statusMessage(status),
    })),
  };
}

export function truncateOutput(value, maxBytes) {
  const source = String(value ?? '');
  const limit = Number.isInteger(maxBytes) && maxBytes >= 0 ? maxBytes : 0;
  const bytes = Buffer.from(source, 'utf8');
  if (bytes.length <= limit) return { value: source, truncated: false };
  return {
    value: bytes.subarray(0, limit).toString('utf8'),
    truncated: true,
  };
}

function parseTestStatuses(stdout) {
  const statuses = new Map();
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.trim().match(TEST_LINE);
    if (!match) continue;
    statuses.set(match[1], match[2] === 'ok' ? 'passed' : 'failed');
  }
  return statuses;
}

function testStatus(id, statuses, overallStatus) {
  if (statuses.has(id)) return statuses.get(id);
  return overallStatus === 'passed' ? 'passed' : 'failed';
}

function isCompileError(output) {
  return /could not compile|error\[E\d+\]|error: aborting due to|failed to parse/i.test(output)
    && !/test result:\s+FAILED/i.test(output);
}

function isTestFailure(output) {
  return /test result:\s+FAILED|test\s+[^\r\n]+\.\.\.\s+FAILED|failures:/i.test(output);
}

function collectDiagnostics(stderr) {
  return stderr
    .split(/\r?\n/)
    .filter((line) => /error(?:\[E\d+\])?:/i.test(line))
    .slice(0, 12)
    .map((line) => ({ message: line.trim() }));
}

function statusMessage(status) {
  return {
    compile_error: '代码未通过编译',
    test_failed: '隐藏测试未通过',
    timeout: '运行超过时间限制',
  }[status] || '';
}
