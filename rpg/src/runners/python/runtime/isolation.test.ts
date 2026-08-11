import { describe, expect, it, vi } from "vitest";
import { PythonRunnerAdapter } from "../../local/adapter";
import { PythonBridge } from "../../local/python-bridge";
import {
  daemonScript,
  loadPythonDetection,
  requireDetectedPython,
  sendAndWait,
  withPythonBridge,
} from "../../local/test-support";
import type { RunRequest } from "../../protocol/types";
import { worldViewFixture } from "../../../game/testing/fixture";

const python = await loadPythonDetection();

function makeRequest(runId: string, helperValue: string): RunRequest {
  return {
    protocolVersion: 1 as const,
    runId,
    attemptId: "iso-a1",
    questId: "q",
    language: "python",
    files: {
      "main.py": `def choose_turn(world):\n    import helper\n    return {'action': {'type': 'wait'}, 'value': helper.VALUE}\n`,
      "helper.py": `VALUE = "${helperValue}"\n`,
    },
    entrypoint: { file: "main.py", callable: "choose_turn" },
    worldView: worldViewFixture,
    allowedModules: [],
    limits: {
      timeoutMs: 5_000,
      interruptGraceMs: 500,
      maxFiles: 10,
      maxFileBytes: 65_536,
      maxSourceBytes: 65_536,
      maxOutputBytes: 16_384,
      maxTraceEvents: 1_000,
      maxValueDepth: 3,
    },
  };
}

describe.skipIf(!python)("resident process isolation (CPython 3.12+)", () => {
  it("does not leak sys.modules between runs with same-named helper", async () => {
    await withPythonBridge(async (bridge) => {
      const first = await sendAndWait(bridge, makeRequest("iso-1", "first"));
      expect(first.executionStatus).toBe("completed");
      expect((first.returnValue as Record<string, unknown>)?.value).toBe("first");

      const second = await sendAndWait(bridge, makeRequest("iso-2", "second"));
      expect(second.executionStatus).toBe("completed");
      expect((second.returnValue as Record<string, unknown>)?.value).toBe("second");
    });
  });

  it("does not retain allowed-module attributes across requests", async () => {
    await withPythonBridge(async (bridge) => {
      const mutate: RunRequest = {
        protocolVersion: 1 as const,
        runId: "iso-leak-1",
        attemptId: "iso-a1",
        questId: "q",
        language: "python",
        files: {
          "main.py":
            "def choose_turn(world):\n    import math\n    math.LEAKED = 'present'\n    return {'action': {'type': 'wait'}}\n",
        },
        entrypoint: { file: "main.py", callable: "choose_turn" },
        worldView: worldViewFixture,
        allowedModules: ["math"],
        limits: {
          timeoutMs: 5_000,
          interruptGraceMs: 500,
          maxFiles: 10,
          maxFileBytes: 65_536,
          maxSourceBytes: 65_536,
          maxOutputBytes: 16_384,
          maxTraceEvents: 1_000,
          maxValueDepth: 3,
        },
      };
      const observe: RunRequest = {
        ...mutate,
        runId: "iso-leak-2",
        files: {
          "main.py":
            "def choose_turn(world):\n    import math\n    try:\n        leaked = math.LEAKED\n    except Exception:\n        leaked = None\n    return {'action': {'type': 'wait'}, 'leaked': leaked}\n",
        },
      };
      const first = await sendAndWait(bridge, mutate);
      expect(first.executionStatus).toBe("completed");
      const second = await sendAndWait(bridge, observe);
      expect(second.executionStatus).toBe("completed");
      expect((second.returnValue as Record<string, unknown>)?.leaked).toBeNull();
    });
  });

  it("interrupts a long-running strategy and continues with a new request", async () => {
    const detection = await requireDetectedPython();
    const adapter = new PythonRunnerAdapter({
      createChannel: () => new PythonBridge({ pythonPath: detection.path, daemonScript }),
    });
    try {
      const longReq: RunRequest = {
        protocolVersion: 1 as const,
        runId: "iso-intr-1",
        attemptId: "iso-a1",
        questId: "q",
        language: "python",
        files: {
          "main.py":
            "def choose_turn(world):\n    total = 0\n    while True:\n        total = sum(range(1000))\n    return {'action': {'type': 'wait'}}\n",
        },
        entrypoint: { file: "main.py", callable: "choose_turn" },
        worldView: worldViewFixture,
        allowedModules: [],
        limits: {
          timeoutMs: 30_000,
          interruptGraceMs: 3_000,
          maxFiles: 10,
          maxFileBytes: 65_536,
          maxSourceBytes: 65_536,
          maxOutputBytes: 16_384,
          maxTraceEvents: 100_000,
          maxValueDepth: 3,
        },
      };
      const promise = adapter.run(longReq);
      await vi.waitFor(() => expect(adapter.state).toBe("running"));
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      await adapter.interrupt(longReq.runId);
      const r1 = await promise;
      expect(r1.executionStatus).toBe("interrupted");

      const shortReq: RunRequest = {
        protocolVersion: 1 as const,
        runId: "iso-intr-2",
        attemptId: "iso-a1",
        questId: "q",
        language: "python",
        files: { "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n" },
        entrypoint: { file: "main.py", callable: "choose_turn" },
        worldView: worldViewFixture,
        allowedModules: [],
        limits: {
          timeoutMs: 5_000,
          interruptGraceMs: 500,
          maxFiles: 10,
          maxFileBytes: 65_536,
          maxSourceBytes: 65_536,
          maxOutputBytes: 16_384,
          maxTraceEvents: 1_000,
          maxValueDepth: 3,
        },
      };
      const r2 = await adapter.run(shortReq);
      expect(r2.executionStatus).toBe("completed");
    } finally {
      await adapter.dispose();
    }
  });
});
