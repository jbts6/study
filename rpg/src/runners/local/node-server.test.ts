import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { isLoopbackOrigin, startRunnerServer } from "./node-server";
import { PythonRunnerAdapter } from "./adapter";
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

describe("origin validation", () => {
  it.each([
    ["http://localhost:5173", true],
    ["http://127.0.0.1:5173", true],
    ["http://[::1]:5173", true],
    ["https://localhost", true],
    ["https://localhost.attacker.example", false],
    ["https://attacker.example/?next=localhost", false],
    ["https://127.0.0.1.evil.example", false],
    ["file:///etc/passwd", false],
    ["not a url", false],
    ["null", false],
  ])("origin %s allowed=%s", (origin, allowed) => {
    expect(isLoopbackOrigin(origin)).toBe(allowed);
  });
});

describe.skipIf(!python)("node runner server (CPython 3.12+)", () => {
  it("rejects a forbidden origin with 1008 and accepts loopback", async () => {
    const server = await startRunnerServer(0);
    try {
      const forbidden = new WebSocket(`ws://127.0.0.1:${server.port}`, {
        headers: { origin: "https://attacker.example" },
      });
      const code = await new Promise<number>((resolve) => {
        forbidden.on("close", (c) => resolve(c ?? 0));
      });
      expect(code).toBe(1008);

      const allowed = new WebSocket(`ws://127.0.0.1:${server.port}`, {
        headers: { origin: "http://localhost:5173" },
      });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("open timeout")), 5_000);
        allowed.on("open", () => { clearTimeout(timer); resolve(); });
      });
      allowed.close();
    } finally {
      await server.close();
    }
  });

  it("accepts a websocket connection and runs a request", async () => {
    const server = await startRunnerServer(0);
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
      await new Promise<void>((resolve) => ws.on("open", resolve));
      const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), 10_000);
        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString()) as { type: string; result?: Record<string, unknown> };
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

  it("close is idempotent and releases adapters", async () => {
    const server = await startRunnerServer(0);
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("open timeout")), 5_000);
      ws.on("open", () => { clearTimeout(timer); resolve(); });
    });
    const d1 = server.close();
    const d2 = server.close();
    expect(d1).toBe(d2);
    await d1;
  });

  it("waits for disposal already started by an abnormal socket close", async () => {
    let releaseDisposal!: () => void;
    const disposal = new Promise<void>((resolve) => { releaseDisposal = resolve; });
    const disposeSpy = vi.spyOn(PythonRunnerAdapter.prototype, "dispose")
      .mockImplementation(() => disposal);
    const server = await startRunnerServer(0);
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("open timeout")), 5_000);
        ws.on("open", () => { clearTimeout(timer); resolve(); });
      });
      const socketClosed = new Promise<void>((resolve) => ws.on("close", () => resolve()));
      ws.terminate();
      await socketClosed;
      await vi.waitFor(() => { expect(disposeSpy).toHaveBeenCalled(); });

      let serverClosed = false;
      const closing = server.close().then(() => { serverClosed = true; });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(serverClosed).toBe(false);

      releaseDisposal();
      await closing;
    } finally {
      releaseDisposal();
      await server.close();
      disposeSpy.mockRestore();
    }
  });

  it("dispose message releases adapter and closes socket with 1001", async () => {
    const server = await startRunnerServer(0);
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("open timeout")), 5_000);
        ws.on("open", () => { clearTimeout(timer); resolve(); });
      });
      const closed = new Promise<number>((resolve) => ws.on("close", (c) => resolve(c ?? 0)));
      ws.send(JSON.stringify({ type: "dispose" }));
      const code = await closed;
      expect(code).toBe(1001);
    } finally {
      await server.close();
    }
  });

  it("returns protocol_error for unknown messages", async () => {
    const server = await startRunnerServer(0);
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("open timeout")), 5_000);
        ws.on("open", () => { clearTimeout(timer); resolve(); });
      });
      const message = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), 5_000);
        ws.on("message", (data) => { clearTimeout(timer); resolve(data.toString()); });
        ws.send(JSON.stringify({ type: "bogus" }));
      });
      expect(message).toContain("protocol_error");
      ws.close();
    } finally {
      await server.close();
    }
  });
});
