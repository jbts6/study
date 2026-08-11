import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { startRunnerServer } from "./node-server";
import { loadPythonDetection } from "./test-support";
import { worldViewFixture } from "../../game/testing/fixture";
import type { RunRequest } from "../protocol/types";

const python = await loadPythonDetection();

const CHOOSE_TURN = `def choose_turn(world):
    actor = world['activeUnitId']
    revision = world['revision']
    return {'actorId': actor, 'expectedRevision': revision, 'action': {'type': 'wait'}}
`;

function makeRequest(runId: string): RunRequest {
  return {
    protocolVersion: 1 as const,
    runId,
    attemptId: "e2e-1",
    questId: "python-marsh-01",
    language: "python",
    files: { "main.py": CHOOSE_TURN },
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
}

describe.skipIf(!python)("local runner end-to-end (CPython 3.12+)", () => {
  it("runs a real choose_turn strategy and returns a turn command", async () => {
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
        ws.send(JSON.stringify({ type: "run", request: makeRequest("e2e-1") }));
      });

      expect(result.executionStatus).toBe("completed");
      const returnValue = result.returnValue as Record<string, unknown>;
      expect(returnValue.actorId).toBe("scout");
      expect(returnValue.expectedRevision).toBe(0);
      expect((returnValue.action as Record<string, unknown>).type).toBe("wait");
      const trace = result.trace as unknown[];
      expect(trace.length).toBeGreaterThan(0);
      ws.close();
    } finally {
      await server.close();
    }
  });
});
