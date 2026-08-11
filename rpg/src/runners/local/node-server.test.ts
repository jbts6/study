import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { startRunnerServer } from "./node-server";
import { loadPythonDetection } from "./test-support";
import { worldViewFixture } from "../../game/testing/fixture";
import type { RunRequest } from "../protocol/types";

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

describe.skipIf(!python)("node runner server (CPython 3.12+)", () => {
  it("accepts a websocket connection and runs a request", async () => {
    const server = await startRunnerServer(0);
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
      await new Promise<void>((resolve) => ws.on("open", resolve));
      const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), 10_000);
        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString()) as {
            type: string;
            result?: Record<string, unknown>;
          };
          if (msg.type === "run_result" && msg.result) {
            clearTimeout(timer);
            resolve(msg.result);
          }
        });
        ws.send(JSON.stringify({ type: "run", request: makeRequest("server-1") }));
      });
      expect(result.executionStatus).toBe("completed");
      ws.close();
    } finally {
      await server.close();
    }
  });
});
