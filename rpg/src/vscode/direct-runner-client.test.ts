import { describe, expect, it, vi } from "vitest";
import type { RunRequest, RunResult } from "../runners/protocol/types";
import type { LocalPythonProcess } from "../runners/local/python-process";
import { DirectRunnerClient } from "./direct-runner-client";
import { worldViewFixture } from "../game/testing/fixture";

const request: RunRequest = {
  protocolVersion: 1,
  runId: "direct-1",
  attemptId: "direct-1:1",
  questId: "python-marsh-02",
  language: "python",
  files: { "main.py": "def choose_turn(world):\n    return {}\n" },
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
    maxValueDepth: 4,
  },
};

const result: RunResult = {
  protocolVersion: 1,
  runId: request.runId,
  attemptId: request.attemptId,
  executionStatus: "completed",
  returnValue: null,
  trace: [],
  diagnostics: [],
  streams: { stdout: "", stderr: "", truncated: false },
  metrics: { durationMs: 1, traceEvents: 0 },
};

describe("DirectRunnerClient", () => {
  it("rejects runs before Python detection has completed", async () => {
    const client = new DirectRunnerClient({
      detect: () => new Promise(() => undefined),
      createProcess: () => { throw new Error("not called"); },
    });

    await expect(client.run(request)).rejects.toThrow("尚未连接");
  });

  it("detects Python, runs one process, and publishes lifecycle states", async () => {
    const states: string[] = [];
    let received: RunRequest | undefined;
    const process: LocalPythonProcess = {
      pid: 42,
      result: Promise.resolve(result),
      interrupt: vi.fn(),
      kill: vi.fn(async () => undefined),
    };
    const client = new DirectRunnerClient({
      detect: async () => ({ ok: true as const, path: "python", version: "3.12.1" }),
      createProcess: (next) => { received = next; return process; },
    });
    client.onStateChange((state) => states.push(state));

    await client.connect();
    expect(client.state).toBe("ready");
    await expect(client.run(request)).resolves.toEqual(result);
    expect(received).toBe(request);
    expect(states).toEqual(["ready", "running", "ready"]);
    expect(process.kill).toHaveBeenCalledTimes(1);
  });

  it("interrupts only the matching active run", async () => {
    let resolveResult!: (value: RunResult) => void;
    const process: LocalPythonProcess = {
      result: new Promise((resolve) => { resolveResult = resolve; }),
      interrupt: vi.fn(),
      kill: vi.fn(async () => undefined),
    };
    const client = new DirectRunnerClient({
      detect: async () => ({ ok: true as const, path: "python", version: "3.12.1" }),
      createProcess: () => process,
    });
    await client.connect();
    const running = client.run(request);
    await client.interrupt("wrong-run");
    expect(process.interrupt).not.toHaveBeenCalled();
    await client.interrupt(request.runId);
    expect(process.interrupt).toHaveBeenCalledTimes(1);
    resolveResult(result);
    await running;
  });
});
