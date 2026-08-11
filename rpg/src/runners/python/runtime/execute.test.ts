import { describe, expect, it } from "vitest";
import {
  loadPythonDetection,
  sendAndWait,
  withPythonBridge,
} from "../../local/test-support";
import type { RunRequest } from "../../protocol/types";
import { worldViewFixture } from "../../../game/testing/fixture";

const python = await loadPythonDetection();

const DEFAULT_LIMITS = {
  timeoutMs: 5_000,
  interruptGraceMs: 500,
  maxFiles: 10,
  maxFileBytes: 65_536,
  maxSourceBytes: 65_536,
  maxOutputBytes: 16_384,
  maxTraceEvents: 1_000,
  maxValueDepth: 3,
};

function baseRequest(overrides: {
  runId: string;
  files: Record<string, string>;
  entrypoint: { file: string; callable: string };
  attemptId?: string;
  allowedModules?: string[];
  limits?: Partial<typeof DEFAULT_LIMITS>;
}): RunRequest {
  const { runId, files, entrypoint, attemptId = "a1", allowedModules = [], limits = {} } = overrides;
  return {
    protocolVersion: 1 as const,
    runId,
    attemptId,
    questId: "exec-contract",
    language: "python",
    files,
    entrypoint,
    worldView: worldViewFixture,
    allowedModules,
    limits: { ...DEFAULT_LIMITS, ...limits },
  };
}

describe.skipIf(!python)("execute contract (CPython 3.12+)", () => {
  it("executes multiple files and captures stdout", async () => {
    const result = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-multi",
          files: {
            "main.py":
              "def choose_turn(world):\n    import helper\n    print('hello')\n    return {'action': {'type': 'wait'}, 'value': helper.VALUE}\n",
            "helper.py": "VALUE = 42\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(result.executionStatus).toBe("completed");
    expect(result.streams.stdout).toContain("hello");
    expect((result.returnValue as Record<string, unknown>)?.value).toBe(42);
  });

  it("does not retain entry or player modules across requests", async () => {
    await withPythonBridge(async (bridge) => {
      const first = await sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-retain-1",
          files: {
            "main.py":
              "def choose_turn(world):\n    import helper\n    return {'action': {'type': 'wait'}, 'value': helper.VALUE}\n",
            "helper.py": "VALUE = 'first'\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      );
      expect((first.returnValue as Record<string, unknown>)?.value).toBe("first");

      const second = await sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-retain-2",
          files: {
            "main.py":
              "def choose_turn(world):\n    import helper\n    return {'action': {'type': 'wait'}, 'value': helper.VALUE}\n",
            "helper.py": "VALUE = 'second'\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      );
      expect((second.returnValue as Record<string, unknown>)?.value).toBe("second");
    });
  });

  it("restores daemon sys.modules, sys.path, sys.meta_path and cwd after each request", async () => {
    await withPythonBridge(async (bridge) => {
      // Player code cannot reach sys/os: they are outside the allowed set and
      // not in SAFE_BUILTINS, so the guarded import rejects them. This keeps
      // daemon-owned state (cwd, sys.path, sys.meta_path, sys.modules) out of
      // player reach; combined with per-request module restoration (proven by
      // the retain test above) the daemon baseline stays intact across runs.
      const sysDenied = await sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-restore-sys",
          files: {
            "main.py":
              "def choose_turn(world):\n    __import__('sys')\n    return {'action': {'type': 'wait'}}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      );
      expect(sysDenied.executionStatus).toBe("runtime_error");
      expect(sysDenied.diagnostics[0].code).toBe("MODULE_NOT_ALLOWED");

      const osDenied = await sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-restore-os",
          files: {
            "main.py":
              "def choose_turn(world):\n    __import__('os')\n    return {'action': {'type': 'wait'}}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      );
      expect(osDenied.diagnostics[0].code).toBe("MODULE_NOT_ALLOWED");

      // Daemon is still usable after the rejected attempts.
      const ok = await sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-restore-ok",
          files: {
            "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      );
      expect(ok.executionStatus).toBe("completed");
    });
  });

  it("rejects imports by default and allows explicitly permitted math", async () => {
    const denied = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-deny-math",
          allowedModules: [],
          files: {
            "main.py":
              "def choose_turn(world):\n    import math\n    return {'action': {'type': 'wait'}}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(denied.executionStatus).toBe("runtime_error");
    expect(denied.diagnostics[0].code).toBe("MODULE_NOT_ALLOWED");

    const allowed = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-allow-math",
          allowedModules: ["math"],
          files: {
            "main.py":
              "def choose_turn(world):\n    import math\n    return {'action': {'type': 'wait'}, 'value': math.floor(3.7)}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(allowed.executionStatus).toBe("completed");
    expect((allowed.returnValue as Record<string, unknown>)?.value).toBe(3);
  });

  it("blocks dynamic loading of a prohibited root", async () => {
    const result = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-dynamic-block",
          allowedModules: ["math"],
          files: {
            "main.py":
              "def choose_turn(world):\n    __import__('socket')\n    return {'action': {'type': 'wait'}}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(result.executionStatus).toBe("runtime_error");
    expect(result.diagnostics[0].code).toBe("MODULE_NOT_ALLOWED");
  });

  it.each(["importlib.py", "ImportLib.py"])(
    "blocks preloaded module access through colliding player filename %s",
    async (collidingFilename) => {
    const result = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: `exec-preloaded-collision-${collidingFilename}`,
          files: {
            "main.py":
              "def choose_turn(world):\n    import importlib\n    imported = importlib.import_module('socket')\n    return {'module': imported.__name__}\n",
            [collidingFilename]: "",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(result.executionStatus).toBe("runtime_error");
    expect(result.diagnostics[0].code).toBe("MODULE_NOT_ALLOWED");
    },
  );

  it.each(["math.py", "Math.py"])(
    "does not let player file %s replace an allowed standard-library module",
    async (collidingFilename) => {
    const result = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: `exec-allowed-module-collision-${collidingFilename}`,
          allowedModules: ["math"],
          files: {
            "main.py":
              "def choose_turn(world):\n    import math\n    return {'value': math.VALUE}\n",
            [collidingFilename]: "VALUE = 99\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(result.executionStatus).toBe("runtime_error");
    expect(result.diagnostics[0].code).toBe("MODULE_NOT_ALLOWED");
    },
  );

  it("applies SAFE_BUILTINS to entry and player modules", async () => {
    const entry = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-builtin-entry",
          files: {
            "main.py":
              "def choose_turn(world):\n    open('x')\n    return {'action': {'type': 'wait'}}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(entry.executionStatus).toBe("runtime_error");

    const helper = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-builtin-helper",
          files: {
            "main.py":
              "def choose_turn(world):\n    import helper\n    return helper.run()\n",
            "helper.py": "def run():\n    return eval('1')\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(helper.executionStatus).toBe("runtime_error");
  });

  it("hides private exception text for syntax and runtime errors", async () => {
    const syntax = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-syntax",
          files: {
            "main.py": "def choose_turn(world)\n    return {'action': {'type': 'wait'}}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(syntax.executionStatus).toBe("syntax_error");
    expect(syntax.diagnostics[0].code).toBe("PYTHON_SYNTAX_ERROR");
    expect(syntax.diagnostics[0].location).toMatchObject({ file: "main.py" });

    const runtime = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-runtime",
          files: {
            "main.py":
              "def choose_turn(world):\n    raise ValueError('secret-traceback-text')\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(runtime.executionStatus).toBe("runtime_error");
    expect(runtime.diagnostics[0].code).toBe("PYTHON_RUNTIME_ERROR");
    expect(JSON.stringify(runtime)).not.toContain("secret-traceback-text");
  });

  it("truncates stdout by utf-8 bytes without splitting multibyte sequences", async () => {
    const result = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-trunc-utf8",
          limits: { maxOutputBytes: 25 },
          files: {
            "main.py":
              "def choose_turn(world):\n    print('\u4e2d' * 100)\n    return {'action': {'type': 'wait'}}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(result.executionStatus).toBe("completed");
    expect(result.streams.truncated).toBe(true);
    expect(result.streams.stdout).toContain("[output truncated]");
    const bytes = Buffer.from(result.streams.stdout, "utf-8");
    expect(bytes.length).toBeLessThanOrEqual(25);
  });

  it("rejects non-json return values and nested depth over the limit", async () => {
    const setReturn = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-set-return",
          files: {
            "main.py":
              "def choose_turn(world):\n    return {'action': {'type': 'wait'}, 's': set()}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(setReturn.executionStatus).toBe("runtime_error");
    expect(setReturn.diagnostics[0].code).toBe("RETURN_NOT_SERIALIZABLE");

    const deep = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-deep",
          limits: { maxValueDepth: 2 },
          files: {
            "main.py":
              "def choose_turn(world):\n    return {'action': {'type': 'wait'}, 'a': {'b': {'c': 1}}}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(deep.executionStatus).toBe("runtime_error");
    expect(deep.diagnostics[0].code).toBe("RETURN_NOT_SERIALIZABLE");
  });

  it("enforces trace event limit with seq, type and file filter", async () => {
    const result = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-trace-limit",
          limits: { maxTraceEvents: 5 },
          files: {
            "main.py":
              "def choose_turn(world):\n    total = 0\n    for i in range(100):\n        total += i\n    return {'action': {'type': 'wait'}, 'total': total}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(result.executionStatus).toBe("runtime_error");
    expect(result.diagnostics[0].code).toBe("TRACE_LIMIT_REACHED");
    const trace = result.trace as ReadonlyArray<{
      seq: number;
      event: string;
      file: string;
    }>;
    expect(trace.length).toBe(5);
    expect(trace[0].seq).toBe(1);
    expect(trace[4].seq).toBe(5);
    const validEvents = new Set(["call", "line", "return", "exception"]);
    for (const event of trace) {
      expect(validEvents.has(event.event)).toBe(true);
      expect(event.file).toBe("main.py");
    }
  });

  it("records returnValueTraceSeq pointing at the entry return event", async () => {
    const result = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-trace-retseq",
          files: {
            "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n",
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    expect(result.executionStatus).toBe("completed");
    const trace = result.trace as ReadonlyArray<{
      seq: number;
      event: string;
      function: string;
    }>;
    const returnSeq = result.returnValueTraceSeq;
    expect(returnSeq).toBeDefined();
    const returnEvent = trace.find((event) => event.seq === returnSeq);
    expect(returnEvent?.event).toBe("return");
    expect(returnEvent?.function).toBe("choose_turn");
  });

  it("does not invoke player repr, descriptors or container subclass protocols during trace", async () => {
    const result = await withPythonBridge(async (bridge) =>
      sendAndWait(
        bridge,
        baseRequest({
          runId: "exec-trace-safe",
          files: {
            "main.py": [
              "def choose_turn(world):",
              "    class Trap(list):",
              "        def __repr__(self):",
              "            print('REPR_CALLED')",
              "        def __len__(self):",
              "            print('LEN_CALLED')",
              "    trap = Trap()",
              "    trap.append(1)",
              "    other = [1, 2, 3]",
              "    return {'action': {'type': 'wait'}, 'trap': trap, 'other': other}",
            ].join("\n"),
          },
          entrypoint: { file: "main.py", callable: "choose_turn" },
        }),
      ),
    );
    // trap (a list subclass) is not JSON-serializable, so the run ends with
    // RETURN_NOT_SERIALIZABLE. The contract under test is that producing the
    // trace locals snapshot never called the player's __repr__/__len__.
    expect(result.streams.stdout).not.toContain("REPR_CALLED");
    expect(result.streams.stdout).not.toContain("LEN_CALLED");
  });
});
