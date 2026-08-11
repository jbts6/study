import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PythonBridge } from "./python-bridge";
import { daemonScript, loadPythonDetection, sendAndWait } from "./test-support";
import type { RunRequest } from "../protocol/types";
import { worldViewFixture } from "../../game/testing/fixture";

const python = await loadPythonDetection();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      await bridge.kill();
    }
  });

  it("uses utf-8 for protocol input and player output", async () => {
    const previousEncoding = process.env.PYTHONIOENCODING;
    process.env.PYTHONIOENCODING = "ascii";
    const bridge = new PythonBridge({ pythonPath: python!.path, daemonScript });
    try {
      await bridge.waitReady();
      const request: RunRequest = {
        ...makeRequest("bridge-utf8"),
        files: {
          "main.py":
            "def choose_turn(world):\n    print('奥术')\n    return {'text': '工业幻想'}\n",
        },
      };
      const result = await sendAndWait(bridge, request);
      expect(result.executionStatus).toBe("completed");
      expect(result.streams.stdout).toContain("奥术");
      expect((result.returnValue as Record<string, unknown>).text).toBe("工业幻想");
    } finally {
      await bridge.kill();
      if (previousEncoding === undefined) delete process.env.PYTHONIOENCODING;
      else process.env.PYTHONIOENCODING = previousEncoding;
    }
  }, 10_000);

  it("increments generation after kill and respawn", async () => {
    const bridge = new PythonBridge({ pythonPath: python!.path, daemonScript });
    try {
      await bridge.waitReady();
      const generationBefore = bridge.generation;
      await bridge.kill();
      expect(bridge.generation).toBe(generationBefore + 1);
      await bridge.waitReady();
      expect(bridge.generation).toBe(generationBefore + 1);
    } finally {
      await bridge.kill();
    }
  });

  it("shares the same ready promise across waitReady calls", async () => {
    const bridge = new PythonBridge({ pythonPath: python!.path, daemonScript });
    try {
      const p1 = bridge.waitReady();
      const p2 = bridge.waitReady();
      expect(p1).toBe(p2);
      await p1;
    } finally {
      await bridge.kill();
    }
  });

  it("is idempotent across multiple kill calls", async () => {
    const bridge = new PythonBridge({ pythonPath: python!.path, daemonScript });
    await bridge.waitReady();
    const generationBefore = bridge.generation;
    await Promise.all([bridge.kill(), bridge.kill(), bridge.kill()]);
    expect(bridge.generation).toBe(generationBefore + 1);
  });
});

describe("python bridge failure paths", () => {
  it("rejects waitReady when the executable is missing", async () => {
    const bridge = new PythonBridge({ pythonPath: "/nonexistent/python-xyz-not-real", daemonScript });
    await expect(bridge.waitReady()).rejects.toThrow();
    await bridge.kill();
  });

  it.skipIf(!python)("rejects waitReady when the daemon exits before ready", async () => {
    const bridge = new PythonBridge({
      pythonPath: python!.path,
      daemonScript: path.join(__dirname, "nonexistent-daemon.py"),
    });
    await expect(bridge.waitReady()).rejects.toThrow();
    await bridge.kill();
  });
});
