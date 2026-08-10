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

  it("exposes filter through the controlled safe builtins", async () => {
    const result = await run({
      ...baseRequest,
      files: { "main.py": "def choose_turn(world): return list(filter(lambda value: value > 1, [1, 2, 3]))\n" },
    });
    expect(result).toMatchObject({ executionStatus: "completed", returnValue: [2, 3] });
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

  it("安全轨迹不执行 repr 或容器子类协议，并在预算处停止", async () => {
    const result = await run({
      ...baseRequest,
      limits: { ...baseRequest.limits, maxTraceEvents: 2 },
      files: {
        "main.py": "class Explosive:\n def __repr__(self): raise AssertionError('repr called')\nclass Trap(list):\n def __iter__(self): raise AssertionError('iter called')\ndef choose_turn(world):\n text = 'x' * 201\n trap = Trap([1, 2])\n return {'value': Explosive(), 'trap': trap}",
      },
    });
    expect(result).toMatchObject({ executionStatus: "runtime_error", diagnostics: [{ code: "TRACE_LIMIT_REACHED" }] });
    expect(result.trace).toHaveLength(2);
    expect(JSON.stringify(result.trace)).not.toContain("repr called");
    expect(JSON.stringify(result.trace)).not.toContain("iter called");
  });

  it("只记录玩家文件四类事件并保留 returnValueTraceSeq", async () => {
    const result = await run({
      ...baseRequest,
      files: {
        "main.py": "def recur(n):\n if n == 0: raise ValueError('bad')\n return recur(n - 1)\ndef choose_turn(world):\n try: recur(1)\n except ValueError: pass\n marker = 'x' * 201\n return {'action': {'type': 'wait'}}",
      },
    });
    expect(result.executionStatus).toBe("completed");
    expect(result.trace.every((event: { file: string; event: string }) => event.file === "main.py" ? ["call", "line", "return", "exception"].includes(event.event) : false)).toBe(true);
    expect(result.trace.some((event: { event: string }) => event.event === "exception")).toBe(true);
    expect(JSON.stringify(result.trace)).toContain("<truncated:string>");
    expect(result.trace.some((event: { seq: number; event: string; function: string }) => event.seq === result.returnValueTraceSeq ? event.event === "return" ? event.function === "choose_turn" : false : false)).toBe(true);
  });

  it("轨迹序号连续，循环引用、集合上限和深度上限都被安全裁剪", async () => {
    const result = await run({
      ...baseRequest,
      files: {
        "main.py": "def choose_turn(world):\n a = []; a.append(a)\n many = list(range(21))\n deep = [[[[1]]]]\n return {'action': {'type': 'wait'}}",
      },
    });
    expect(result.executionStatus).toBe("completed");
    expect(result.trace.map((event: { seq: number }) => event.seq)).toEqual(result.trace.map((_: unknown, index: number) => index + 1));
    const traceText = JSON.stringify(result.trace);
    expect(traceText).toContain("<circular>");
    expect(traceText).toContain("<truncated:collection>");
    expect(traceText).toContain("<truncated:depth>");
    expect(traceText).not.toMatch(/<exec>|<frozen>|execute\.py|[A-Za-z]:\\|\/home\//);
  });

  it("安全快照不执行玩家对象协议或描述符", async () => {
    const result = await run({
      ...baseRequest,
      files: {
        "main.py": "class Explosive:\n def __repr__(self): raise AssertionError('repr called')\nclass Trap(list):\n def __iter__(self): raise AssertionError('iter called')\nclass Descriptor:\n def __get__(self, instance, owner): raise AssertionError('descriptor called')\nclass Holder:\n value = Descriptor()\ndef choose_turn(world):\n explosive = Explosive()\n trap = Trap([1, 2])\n holder = Holder()\n return {'action': {'type': 'wait'}}",
      },
    });
    expect(result.executionStatus).toBe("completed");
    const traceText = JSON.stringify(result.trace);
    expect(traceText).toContain("<unserializable>");
    expect(traceText).not.toContain("repr called");
    expect(traceText).not.toContain("iter called");
    expect(traceText).not.toContain("descriptor called");
  });

  it("安全快照不依赖玩家可改写的模块函数", async () => {
    const result = await run({
      ...baseRequest,
      allowedModules: ["math"],
      files: {
        "main.py": "import math\ndef choose_turn(world):\n original = math.isfinite\n math.isfinite = lambda value: False\n number = 1.0\n math.isfinite = original\n return {'action': {'type': 'wait'}}",
      },
    });
    expect(result.executionStatus).toBe("completed");
    expect(JSON.stringify(result.trace)).not.toContain("<non-finite-float>");
  });

  it("安全快照不调用玩家注入的共享内建", async () => {
    const result = await run({
      ...baseRequest,
      allowedModules: ["sys"],
      files: {
        "main.py": "import sys\noriginal_type = sys.modules['builtins'].type\ninjected_callers = []\ndef injected(value):\n injected_callers.append(sys._getframe(1).f_code.co_name)\n return original_type(value)\ndef choose_turn(world):\n sys.modules['builtins'].type = injected\n marker = 1\n sys.modules['builtins'].type = original_type\n return {'action': {'type': 'wait'}, 'injectedCallers': injected_callers}",
      },
    });
    expect(result).toMatchObject({ executionStatus: "completed", returnValue: { injectedCallers: [] } });
  });

  it("轨迹文件过滤不调用玩家改写的路径方法", async () => {
    const result = await run({
      ...baseRequest,
      allowedModules: ["pathlib"],
      files: {
        "main.py": "import pathlib\noriginal_resolve = pathlib.Path.resolve\nresolve_called = [False]\ndef injected(path):\n resolve_called[0] = True\n return original_resolve(path)\ndef choose_turn(world):\n pathlib.Path.resolve = injected\n marker = 1\n pathlib.Path.resolve = original_resolve\n return {'action': {'type': 'wait'}, 'resolveCalled': resolve_called[0]}",
      },
    });
    expect(result).toMatchObject({ executionStatus: "completed", returnValue: { resolveCalled: false } });
  });

  it("轨迹局部变量过滤不调用非字符串键协议", async () => {
    const result = await run({
      ...baseRequest,
      allowedModules: ["sys"],
      files: {
        "main.py": "import sys\ncalled = [False]\nclass Key:\n def startswith(self, prefix):\n  called[0] = True\n  return False\ndef choose_turn(world):\n frame = sys._getframe()\n frame.f_locals[Key()] = 1\n marker = 1\n return {'action': {'type': 'wait'}, 'called': called[0]}",
      },
    });
    expect(result).toMatchObject({ executionStatus: "completed", returnValue: { called: false } });
  });

  it("在加载入口前构造轨迹文件映射，不调用玩家替换的 relative_to", async () => {
    const result = await run({
      ...baseRequest,
      allowedModules: ["pathlib"],
      files: {
        "main.py": "import pathlib\noriginal_relative_to = pathlib.Path.relative_to\nrelative_to_called = [False]\ndef injected(path, other, walk_up=False):\n relative_to_called[0] = True\n pathlib.Path.relative_to = original_relative_to\n return original_relative_to(path, other, walk_up=walk_up)\npathlib.Path.relative_to = injected\ndef choose_turn(world):\n pathlib.Path.relative_to = original_relative_to\n return {'action': {'type': 'wait'}, 'relativeToCalled': relative_to_called[0]}",
      },
    });
    expect(result).toMatchObject({ executionStatus: "completed", returnValue: { relativeToCalled: false } });
  });

  it("入口别名关联实际入口帧的返回轨迹序号", async () => {
    const result = await run({
      ...baseRequest,
      files: {
        "main.py": "def original(world):\n return {'action': {'type': 'wait'}}\nchoose_turn = original",
      },
    });
    const entryReturn = result.trace.find((event: { event: string; function: string }) => event.event === "return" && event.function === "original");
    expect(result.executionStatus).toBe("completed");
    expect(entryReturn).toBeDefined();
    expect(result.returnValueTraceSeq).toBe(entryReturn?.seq);
  });
});
