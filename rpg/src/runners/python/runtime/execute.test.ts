import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide } from "pyodide";
import { worldViewFixture } from "../../../game/testing/fixture";
import executeSource from "./execute.py?raw";

let pyodide: Awaited<ReturnType<typeof loadPyodide>>;

beforeAll(async () => {
  pyodide = await loadPyodide();
  await pyodide.runPythonAsync(executeSource);
});

async function run(request: object, slot = "__test_request__") {
  pyodide.globals.set(slot, pyodide.toPy(request));
  const raw = await pyodide.runPythonAsync(`import json; json.dumps(execute_request(${slot}))`);
  return JSON.parse(String(raw)) as Record<string, any>;
}

const baseRequest = {
  protocolVersion: 1,
  runId: "run-runtime-01",
  attemptId: "attempt-runtime-01",
  questId: "python-marsh-03",
  language: "python",
  entrypoint: { file: "main.py", callable: "choose_turn" },
  worldView: worldViewFixture,
  allowedModules: [],
  limits: {
    timeoutMs: 2_000,
    interruptGraceMs: 250,
    maxFiles: 8,
    maxFileBytes: 16_384,
    maxSourceBytes: 65_536,
    maxOutputBytes: 16_384,
    maxTraceEvents: 1_000,
    maxValueDepth: 3,
  },
};

function expectCompleteShape(result: Record<string, any>) {
  expect(result.protocolVersion).toBe(1);
  expect(typeof result.runId).toBe("string");
  expect(typeof result.attemptId).toBe("string");
  expect(typeof result.executionStatus).toBe("string");
  expect(Object.hasOwn(result, "returnValue")).toBe(true);
  expect(result.trace).toEqual(expect.any(Array));
  expect(result.diagnostics).toEqual(expect.any(Array));
  expect(result.streams).toEqual(expect.objectContaining({ stdout: expect.any(String), stderr: expect.any(String), truncated: expect.any(Boolean) }));
  expect(result.metrics).toEqual(expect.objectContaining({ durationMs: expect.any(Number), traceEvents: expect.any(Number) }));
}

describe("python execution isolation and policy", () => {
  it("executes a multi-file player program and captures stdout", async () => {
    const files = {
      "helpers/choose.py": "def action(world):\n    return {'action': {'type': 'wait'}, 'revision': world['revision']}\n",
      "main.py": "from helpers.choose import action\ndef choose_turn(world):\n    print('ready')\n    return action(world)\n",
    };
    const result = await run({ ...baseRequest, files });
    expectCompleteShape(result);
    expect(result).toMatchObject({ executionStatus: "completed", returnValue: { action: { type: "wait" }, revision: worldViewFixture.revision }, streams: { stdout: "ready\n", stderr: "", truncated: false } });
  });

  it("does not retain entry-module globals across runs", async () => {
    const first = await run({ ...baseRequest, files: { "main.py": "leaked = 41\ndef choose_turn(world): return leaked\n" } });
    expect(first).toMatchObject({ executionStatus: "completed", returnValue: 41 });
    const second = await run({ ...baseRequest, attemptId: "attempt-runtime-02", files: { "main.py": "def choose_turn(world): return leaked\n" } });
    expect(second).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "PYTHON_RUNTIME_ERROR" }] });
  });

  it("does not retain imported-module globals across runs", async () => {
    const first = await run({ ...baseRequest, files: { "helpers/state.py": "value = 41\n", "main.py": "from helpers.state import value\ndef choose_turn(world): return value\n" } });
    expect(first).toMatchObject({ executionStatus: "completed", returnValue: 41 });
    const second = await run({ ...baseRequest, attemptId: "attempt-runtime-03", files: { "helpers/state.py": "def read(): return value\n", "main.py": "from helpers.state import read\ndef choose_turn(world): return read()\n" } });
    expect(second).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "PYTHON_RUNTIME_ERROR" }] });
  });

  it("restores process globals when player code mutates them", async () => {
    const before = JSON.parse(String(await pyodide.runPythonAsync("import json, os, sys; json.dumps({'cwd': os.getcwd(), 'path': list(sys.path), 'meta': [type(item).__name__ for item in sys.meta_path]})")));
    const result = await run({
      ...baseRequest,
      allowedModules: ["os", "sys"],
      files: { "main.py": "import os, sys\ndef choose_turn(world):\n    sys.path = []\n    sys.meta_path = []\n    sys.modules = {}\n    os.chdir('/')\n    return None\n" },
    });
    expect(result).toMatchObject({ executionStatus: "completed", returnValue: null });
    const after = JSON.parse(String(await pyodide.runPythonAsync("import json, os, sys; json.dumps({'cwd': os.getcwd(), 'path': list(sys.path), 'meta': [type(item).__name__ for item in sys.meta_path]})")));
    expect(after).toEqual(before);
  });

  it("keeps concurrent runs isolated with separate request roots", async () => {
    const [left, right] = await Promise.all([
      run({ ...baseRequest, runId: "run-concurrent-left", attemptId: "attempt-left", files: { "main.py": "print('left')\ndef choose_turn(world): return 'left'\n" } }, "__request_left__"),
      run({ ...baseRequest, runId: "run-concurrent-right", attemptId: "attempt-right", files: { "main.py": "print('right')\ndef choose_turn(world): return 'right'\n" } }, "__request_right__"),
    ]);
    expect(left).toMatchObject({ executionStatus: "completed", returnValue: "left", streams: { stdout: "left\n" } });
    expect(right).toMatchObject({ executionStatus: "completed", returnValue: "right", streams: { stdout: "right\n" } });
  });

  it("blocks browser, networking, and package-loader roots by default", async () => {
    for (const blocked of ["js", "pyodide", "micropip", "socket"]) {
      const result = await run({
        ...baseRequest,
        files: { "helpers/blocked.py": `import ${blocked}\n`, "main.py": "import helpers.blocked\ndef choose_turn(world): return None\n" },
      });
      expect(result).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "MODULE_NOT_ALLOWED" }] });
    }
  });

  it("requires an explicit root allow-list for standard-library modules", async () => {
    const denied = await run({ ...baseRequest, files: { "main.py": "import math\ndef choose_turn(world): return math.isqrt(9)\n" } });
    expect(denied).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "MODULE_NOT_ALLOWED" }] });
    const allowed = await run({ ...baseRequest, allowedModules: ["math"], files: { "main.py": "import math\ndef choose_turn(world): return math.isqrt(9)\n" } });
    expect(allowed).toMatchObject({ executionStatus: "completed", returnValue: 3 });
  });

  it("uses the same restricted builtins for imported player modules", async () => {
    const result = await run({
      ...baseRequest,
      files: { "helpers/unsafe.py": "def action(): return open('secret')\n", "main.py": "from helpers.unsafe import action\ndef choose_turn(world): return action()\n" },
    });
    expect(result).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "PYTHON_RUNTIME_ERROR" }] });
  });

  it("returns stable syntax diagnostics without paths or tracebacks", async () => {
    const result = await run({ ...baseRequest, files: { "main.py": "def choose_turn(world)\n    return None\n" } });
    expect(result).toMatchObject({ executionStatus: "syntax_error", diagnostics: [{ code: "PYTHON_SYNTAX_ERROR", location: { file: "main.py", line: 1 } }] });
    expect(JSON.stringify(result)).not.toMatch(/Traceback|[A-Z]:[\\/]|python-run-/);
  });

  it("maps ordinary exceptions to a stable runtime diagnostic", async () => {
    const result = await run({ ...baseRequest, files: { "main.py": "def choose_turn(world): raise ValueError('private detail')\n" } });
    expect(result).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "PYTHON_RUNTIME_ERROR", message: "Python 运行失败。" }] });
    expect(JSON.stringify(result)).not.toContain("private detail");
  });

  it("clips UTF-8 stdout and stderr independently and marks truncation", async () => {
    const result = await run({
      ...baseRequest,
      allowedModules: ["sys"],
      limits: { ...baseRequest.limits, maxOutputBytes: 32 },
      files: { "main.py": "import sys\nprint('你好' * 20)\nprint('错误' * 20, file=sys.stderr)\ndef choose_turn(world): return None\n" },
    });
    expect(result.executionStatus).toBe("completed");
    expect(result.streams.truncated).toBe(true);
    expect(new TextEncoder().encode(result.streams.stdout).length).toBeLessThanOrEqual(32);
    expect(new TextEncoder().encode(result.streams.stderr).length).toBeLessThanOrEqual(32);
  });

  it("rejects values deeper than the configured depth or not JSON-serializable", async () => {
    const tooDeep = await run({ ...baseRequest, files: { "main.py": "def choose_turn(world): return {'a': {'b': {'c': 1}}}\n" } });
    expect(tooDeep).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "RETURN_NOT_SERIALIZABLE" }] });
    const nonFinite = await run({ ...baseRequest, files: { "main.py": "def choose_turn(world): return float('nan')\n" } });
    expect(nonFinite).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "RETURN_NOT_SERIALIZABLE" }] });
    const nonStringKey = await run({ ...baseRequest, files: { "main.py": "def choose_turn(world): return {1: 'x'}\n" } });
    expect(nonStringKey).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "RETURN_NOT_SERIALIZABLE" }] });
  });

  it("enforces the trace-event budget", async () => {
    const result = await run({
      ...baseRequest,
      limits: { ...baseRequest.limits, maxTraceEvents: 3 },
      files: { "main.py": "def choose_turn(world):\n    total = 0\n    for value in range(100):\n        total += value\n    return total\n" },
    });
    expect(result).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "TRACE_LIMIT_REACHED" }] });
  });

  it("rejects every explicitly prohibited builtin", async () => {
    for (const builtin of ["open", "eval", "exec", "compile", "input", "help", "globals", "locals", "vars", "getattr", "setattr", "delattr", "__import__"]) {
      const result = await run({ ...baseRequest, files: { "main.py": `def choose_turn(world): return ${builtin}('x')\n` } });
      expect(result.executionStatus).toBe("runtime_error");
      expect(result.diagnostics[0]?.code).toBe(builtin === "__import__" ? "MODULE_NOT_ALLOWED" : "PYTHON_RUNTIME_ERROR");
    }
  });
});
