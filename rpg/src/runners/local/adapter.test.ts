import { describe, expect, it, vi } from "vitest";
import { PythonRunnerAdapter } from "./adapter";
import type { LocalRunnerChannel } from "./channel";
import type { RunRequest, RunResult } from "../protocol/types";
import { worldViewFixture } from "../../game/testing/fixture";

type TimerHandle = number;
let nextTimerId = 1;
const timers = new Map<TimerHandle, () => void>();
const setTimeoutFn = vi.fn((h: () => void, _ms: number): TimerHandle => {
  const id = nextTimerId++;
  timers.set(id, h);
  return id;
});
const clearTimeoutFn = vi.fn((id: TimerHandle) => { timers.delete(id); });

function triggerAllTimers(): void {
  for (const [, h] of timers) h();
  timers.clear();
}
function resetTimers(): void {
  timers.clear();
  nextTimerId = 1;
  setTimeoutFn.mockClear();
  clearTimeoutFn.mockClear();
}

class MockChannel implements LocalRunnerChannel {
  generation: number;
  pid: number | undefined;
  onMessage: ((r: RunResult) => void) | undefined;
  onExit: ((c: number | null, s: NodeJS.Signals | null) => void) | undefined;
  send = vi.fn(() => true);
  interrupt = vi.fn();
  kill = vi.fn(() => { this.onExit?.(null, "SIGKILL"); });

  constructor(generation: number) {
    this.generation = generation;
    this.pid = 1000 + generation;
  }
  emitMessage(result: RunResult): void { this.onMessage?.(result); }
}

function makeRequest(runId: string, timeoutMs = 2000): RunRequest {
  return {
    protocolVersion: 1 as const, runId, attemptId: "a1", questId: "q", language: "python",
    files: { "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n" }, entrypoint: { file: "main.py", callable: "choose_turn" },
    worldView: worldViewFixture, allowedModules: [],
    limits: { timeoutMs, interruptGraceMs: 200, maxFiles: 10, maxFileBytes: 65536, maxSourceBytes: 65536, maxOutputBytes: 16384, maxTraceEvents: 1000, maxValueDepth: 3 },
  };
}
function makeCompleted(runId: string): RunResult {
  return { protocolVersion: 1, runId, attemptId: "a1", executionStatus: "completed", returnValue: null, returnValueTraceSeq: undefined, trace: [], diagnostics: [], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 5, traceEvents: 0 } };
}
function createAdapter(): { adapter: PythonRunnerAdapter; channels: MockChannel[] } {
  const channels: MockChannel[] = [];
  const adapter = new PythonRunnerAdapter({
    createChannel: () => { const ch = new MockChannel(channels.length); channels.push(ch); return ch; },
    setTimeoutFn, clearTimeoutFn,
  });
  return { adapter, channels };
}

describe("python runner adapter", () => {
  it("runs a request and resolves with the result", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1"));
    expect(channels.length).toBe(1);
    expect(channels[0].send).toHaveBeenCalledTimes(1);
    channels[0].emitMessage(makeCompleted("r1"));
    const result = await promise;
    expect(result.executionStatus).toBe("completed");
    expect(result.runId).toBe("r1");
  });

  it("rejects concurrent runs with RUN_IN_PROGRESS", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const p1 = adapter.run(makeRequest("r1"));
    const r2 = await adapter.run(makeRequest("r2"));
    expect(r2.executionStatus).toBe("invalid_request");
    expect(r2.diagnostics[0].code).toBe("RUN_IN_PROGRESS");
    channels[0].emitMessage(makeCompleted("r1"));
    await p1;
  });

  it("kills channel on hard timeout and resolves with timeout", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1", 100));
    triggerAllTimers();
    const result = await promise;
    expect(result.executionStatus).toBe("timeout");
    expect(result.diagnostics[0].code).toBe("RUNNER_TIMEOUT");
    expect(channels[0].kill).toHaveBeenCalledTimes(1);
  });

  it("disposes and resolves active run as disposed", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1"));
    adapter.dispose();
    const result = await promise;
    expect(result.executionStatus).toBe("runner_error");
    expect(result.diagnostics[0].code).toBe("RUNNER_DISPOSED");
    expect(channels[0].kill).toHaveBeenCalledTimes(1);
  });

  it("rebuilds channel after hard timeout for next run", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const p1 = adapter.run(makeRequest("r1", 100));
    triggerAllTimers();
    await p1;
    expect(channels.length).toBe(1);
    // after kill, channel is undefined; next run creates a new one
    const p2 = adapter.run(makeRequest("r2", 100));
    expect(channels.length).toBe(2);
    channels[1].emitMessage(makeCompleted("r2"));
    const r2 = await p2;
    expect(r2.executionStatus).toBe("completed");
  });
});
