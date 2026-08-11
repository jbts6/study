import { describe, expect, it } from "vitest";
import { PythonBridge } from "./python-bridge";
import { daemonScript, loadPythonDetection, sendAndWait } from "./test-support";
import type { RunRequest } from "../protocol/types";
import { worldViewFixture } from "../../game/testing/fixture";

const python = await loadPythonDetection();

function makeRequest(runId: string): RunRequest {
  return {
    protocolVersion: 1 as const,
    runId,
    attemptId: "a1",
    questId: "q",
    language: "python",
    files: { "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n" },
    entrypoint: { file: "main.py", callable: "choose_turn" },
    worldView: worldViewFixture,
    allowedModules: [],
    limits: {
      timeoutMs: 2_000,
      interruptGraceMs: 200,
      maxFiles: 10,
      maxFileBytes: 65_536,
      maxSourceBytes: 65_536,
      maxOutputBytes: 16_384,
      maxTraceEvents: 1_000,
      maxValueDepth: 3,
    },
  };
}

describe.skipIf(!python)("python bridge (CPython 3.12+)", () => {
  it("spawns a daemon, exchanges a request, and returns a result", async () => {
    const bridge = new PythonBridge({ pythonPath: python!.path, daemonScript });
    try {
      await bridge.waitReady();
      const result = await sendAndWait(bridge, makeRequest("bridge-1"));
      expect(result.runId).toBe("bridge-1");
      expect(result.executionStatus).toBe("completed");
    } finally {
      bridge.kill();
    }
  });

  it("increments generation after kill and respawn", async () => {
    const bridge = new PythonBridge({ pythonPath: python!.path, daemonScript });
    try {
      await bridge.waitReady();
      const generationBefore = bridge.generation;
      const exited = new Promise<void>((resolve) => {
        bridge.onExit = () => resolve();
      });
      bridge.kill();
      await exited;
      expect(bridge.generation).toBe(generationBefore + 1);
      await bridge.waitReady();
      expect(bridge.generation).toBe(generationBefore + 1);
    } finally {
      bridge.kill();
    }
  });
});
