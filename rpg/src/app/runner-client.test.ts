// @vitest-environment node

import { describe, expect, it } from "vitest";
import { startRunnerServer } from "../runners/local/node-server";
import { loadPythonDetection } from "../runners/local/test-support";
import type { RunRequest } from "../runners/protocol/types";
import { worldViewFixture } from "../game/testing/fixture";
import { WebSocketRunnerClient } from "./runner-client";

const python = await loadPythonDetection();

describe.skipIf(!python)("WebSocketRunnerClient", () => {
  it("runs one request through the loopback server", async () => {
    const server = await startRunnerServer(0);
    const client = new WebSocketRunnerClient(`ws://127.0.0.1:${server.port}`);
    const states: string[] = [];
    client.onStateChange((state) => states.push(state));

    try {
      await client.connect();
      const request: RunRequest = {
        protocolVersion: 1,
        runId: "browser-client-1",
        attemptId: "browser-client-1:1",
        questId: "python-marsh-01",
        language: "python",
        files: {
          "main.py": "def choose_turn(world):\n    return {'actorId': world['activeUnitId'], 'expectedRevision': world['revision'], 'action': {'type': 'wait'}}\n",
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

      const result = await client.run(request);

      expect(result.executionStatus).toBe("completed");
      expect(result.returnValue).toMatchObject({ actorId: "scout" });
      expect(states).toContain("running");
      expect(states.at(-1)).toBe("ready");
    } finally {
      client.close();
      await server.close();
    }
  });
});
