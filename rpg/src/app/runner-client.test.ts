// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";
import { startRunnerServer } from "../runners/local/node-server";
import { loadPythonDetection } from "../runners/local/test-support";
import type { RunRequest } from "../runners/protocol/types";
import { worldViewFixture } from "../game/testing/fixture";
import { WebSocketRunnerClient } from "./runner-client";

const python = await loadPythonDetection();

interface ClosingServer {
  readonly port: number;
  readonly receivedRun: Promise<void>;
  close(): Promise<void>;
}

function startClosingServer(): Promise<ClosingServer> {
  return new Promise((resolve, reject) => {
    const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    let resolveRun!: () => void;
    const receivedRun = new Promise<void>((runResolve) => { resolveRun = runResolve; });
    let closed = false;

    server.once("error", reject);
    server.on("connection", (socket) => {
      socket.on("message", (data) => {
        const message = JSON.parse(data.toString()) as { type?: string };
        if (message.type === "subscribe_state") {
          socket.send(JSON.stringify({ type: "state", state: "ready" }));
        }
        if (message.type === "run") {
          socket.send(JSON.stringify({ type: "state", state: "running" }));
          resolveRun();
        }
      });
    });
    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine loopback test server port."));
        return;
      }
      resolve({
        port: address.port,
        receivedRun,
        close: async () => {
          if (closed) return;
          closed = true;
          for (const socket of server.clients) socket.close(1001);
          await new Promise<void>((closeResolve) => server.close(() => closeResolve()));
        },
      });
    });
  });
}

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
      const distinctStates = states.filter((state, index) => index === 0 || state !== states[index - 1]);
      expect(distinctStates).toEqual(["ready", "running", "ready"]);
    } finally {
      client.close();
      await server.close();
    }
  });

  it("rejects a remote URL before creating a socket", async () => {
    let socketCreations = 0;
    vi.stubGlobal("WebSocket", class {
      constructor() {
        socketCreations += 1;
      }
    });

    try {
      const client = new WebSocketRunnerClient("ws://runner.example");

      await expect(client.connect()).rejects.toThrow("loopback");
      expect(socketCreations).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects an active request when the loopback server closes", async () => {
    const server = await startClosingServer();
    const client = new WebSocketRunnerClient(`ws://127.0.0.1:${server.port}`);
    try {
      await client.connect();
      const request: RunRequest = {
        protocolVersion: 1,
        runId: "browser-client-unavailable",
        attemptId: "browser-client-unavailable:1",
        questId: "python-marsh-01",
        language: "python",
        files: {
          "main.py": "def choose_turn(world):\n    while True:\n        pass\n",
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

      const result = client.run(request);
      const rejection = expect(result).rejects.toThrow("本地 Python Runner 不可用。启动 Runner 后刷新页面。");
      await server.receivedRun;
      const closing = server.close();
      await rejection;
      await closing;
      expect(client.state).toBe("unavailable");
    } finally {
      client.close();
      await server.close();
    }
  });
});
