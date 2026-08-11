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
  waitReady = vi.fn((): Promise<void> => Promise.resolve());
  send = vi.fn((): Promise<void> => Promise.resolve());
  interrupt = vi.fn();
  private killResolvers: (() => void)[] = [];
  kill = vi.fn((): Promise<void> => {
    return new Promise<void>((resolve) => {
      this.killResolvers.push(resolve);
    });
  });

  constructor(generation: number) {
    this.generation = generation;
    this.pid = 1000 + generation;
  }
  emitMessage(result: RunResult): void { this.onMessage?.(result); }
  emitExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.onExit?.(code, signal);
    const resolvers = this.killResolvers;
    this.killResolvers = [];
    for (const r of resolvers) r();
  }
}

function makeRequest(runId: string, timeoutMs = 2000): RunRequest {
  return {
    protocolVersion: 1 as const, runId, attemptId: "a1", questId: "q", language: "python",
    files: { "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n" },
    entrypoint: { file: "main.py", callable: "choose_turn" },
    worldView: worldViewFixture, allowedModules: [],
    limits: { timeoutMs, interruptGraceMs: 200, maxFiles: 10, maxFileBytes: 65536, maxSourceBytes: 65536, maxOutputBytes: 16384, maxTraceEvents: 1000, maxValueDepth: 3 },
  };
}
function makeCompleted(runId: string, attemptId = "a1"): RunResult {
  return { protocolVersion: 1, runId, attemptId, executionStatus: "completed", returnValue: null, returnValueTraceSeq: undefined, trace: [], diagnostics: [], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 5, traceEvents: 0 } };
}
function makeInterrupted(runId: string): RunResult {
  return { protocolVersion: 1, runId, attemptId: "a1", executionStatus: "interrupted", returnValue: null, returnValueTraceSeq: undefined, trace: [], diagnostics: [{ code: "INTERRUPTED", severity: "info", message: "Python 运行已中断。", recoveryAction: "修改代码后重新运行" }], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 0, traceEvents: 0 } };
}
function createAdapter(opts: { failReady?: boolean } = {}): { adapter: PythonRunnerAdapter; channels: MockChannel[] } {
  const channels: MockChannel[] = [];
  const adapter = new PythonRunnerAdapter({
    createChannel: () => {
      const ch = new MockChannel(channels.length);
      if (opts.failReady) ch.waitReady.mockRejectedValueOnce(new Error("startup fail"));
      channels.push(ch);
      return ch;
    },
    setTimeoutFn, clearTimeoutFn,
  });
  return { adapter, channels };
}

async function waitForSend(channels: MockChannel[], index: number): Promise<void> {
  await vi.waitFor(() => { expect(channels[index]?.send).toHaveBeenCalled(); });
}
async function waitForKill(ch: MockChannel): Promise<void> {
  await vi.waitFor(() => { expect(ch.kill).toHaveBeenCalled(); });
}

describe("python runner adapter", () => {
  it("runs a request and resolves with the result", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1"));
    await waitForSend(channels, 0);
    channels[0].emitMessage(makeCompleted("r1"));
    const result = await promise;
    expect(result.executionStatus).toBe("completed");
    expect(result.runId).toBe("r1");
  });

  it("rejects concurrent runs with RUN_IN_PROGRESS", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const p1 = adapter.run(makeRequest("r1"));
    await waitForSend(channels, 0);
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
    await waitForSend(channels, 0);
    triggerAllTimers();
    const result = await promise;
    expect(result.executionStatus).toBe("timeout");
    expect(result.diagnostics[0].code).toBe("RUNNER_TIMEOUT");
    expect(channels[0].kill).toHaveBeenCalledTimes(1);
    channels[0].emitExit(null, "SIGKILL");
  });

  it("disposes and resolves active run as disposed", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1"));
    await waitForSend(channels, 0);
    const disposePromise = adapter.dispose();
    await waitForKill(channels[0]);
    channels[0].emitExit(null, "SIGKILL");
    await disposePromise;
    const result = await promise;
    expect(result.executionStatus).toBe("runner_error");
    expect(result.diagnostics[0].code).toBe("RUNNER_DISPOSED");
    expect(channels[0].kill).toHaveBeenCalledTimes(1);
  });

  it("rebuilds channel after hard timeout for next run", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const p1 = adapter.run(makeRequest("r1", 100));
    await waitForSend(channels, 0);
    triggerAllTimers();
    await p1;
    channels[0].emitExit(null, "SIGKILL");
    const p2 = adapter.run(makeRequest("r2", 100));
    await waitForSend(channels, 1);
    channels[1].emitMessage(makeCompleted("r2"));
    const r2 = await p2;
    expect(r2.executionStatus).toBe("completed");
  });

  it("maps channel ready failure to RUNNER_START_FAILED", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter({ failReady: true });
    const promise = adapter.run(makeRequest("r1"));
    await waitForKill(channels[0]);
    channels[0].emitExit(null, "SIGKILL");
    const result = await promise;
    expect(result.executionStatus).toBe("runner_error");
    expect(result.diagnostics[0].code).toBe("RUNNER_START_FAILED");
    expect(channels[0].kill).toHaveBeenCalledTimes(1);
  });

  it("restarts the channel after RUNNER_SEND_FAILED", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1"));
    channels[0].send.mockRejectedValueOnce(new Error("write fail"));
    const result = await promise;
    expect(result.executionStatus).toBe("runner_error");
    expect(result.diagnostics[0].code).toBe("RUNNER_SEND_FAILED");
    await waitForKill(channels[0]);

    const retry = adapter.run(makeRequest("r2"));
    expect(channels).toHaveLength(1);
    channels[0].emitExit(null, "SIGKILL");
    await waitForSend(channels, 1);
    channels[1].emitMessage(makeCompleted("r2"));
    expect((await retry).executionStatus).toBe("completed");
  });

  it("dispose is idempotent and awaits channel kill", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1"));
    await waitForSend(channels, 0);
    const d1 = adapter.dispose();
    const d2 = adapter.dispose();
    expect(d1).toBe(d2);
    await waitForKill(channels[0]);
    channels[0].emitExit(null, "SIGKILL");
    await d1;
    expect(channels[0].kill).toHaveBeenCalledTimes(1);
    const result = await promise;
    expect(result.diagnostics[0].code).toBe("RUNNER_DISPOSED");
  });

  it("dispose waits for an in-flight restart barrier", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const run = adapter.run(makeRequest("r1", 100));
    await waitForSend(channels, 0);
    triggerAllTimers();
    await run;

    let disposed = false;
    const disposePromise = adapter.dispose().then(() => { disposed = true; });
    await Promise.resolve();
    expect(disposed).toBe(false);

    channels[0].emitExit(null, "SIGKILL");
    await disposePromise;
    expect(disposed).toBe(true);
  });

  it("ignores messages with wrong runId", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1"));
    await waitForSend(channels, 0);
    channels[0].emitMessage(makeCompleted("other"));
    channels[0].emitMessage(makeCompleted("r1"));
    const result = await promise;
    expect(result.runId).toBe("r1");
  });

  it("ignores messages with wrong attemptId", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1"));
    await waitForSend(channels, 0);
    channels[0].emitMessage(makeCompleted("r1", "other"));
    channels[0].emitMessage(makeCompleted("r1"));
    const result = await promise;
    expect(result.runId).toBe("r1");
  });

  it("does not settle r2 from stale r1 message or old channel exit after timeout", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const p1 = adapter.run(makeRequest("r1", 100));
    await waitForSend(channels, 0);
    triggerAllTimers();
    const r1 = await p1;
    expect(r1.diagnostics[0].code).toBe("RUNNER_TIMEOUT");
    const p2 = adapter.run(makeRequest("r2", 100));
    channels[0].emitMessage(makeCompleted("r1"));
    channels[0].emitExit(null, "SIGKILL");
    await waitForSend(channels, 1);
    expect(channels[0].send).toHaveBeenCalledTimes(1);
    expect(channels[1].send).toHaveBeenCalledTimes(1);
    channels[1].emitMessage(makeCompleted("r2"));
    const r2 = await p2;
    expect(r2.executionStatus).toBe("completed");
    expect(r2.runId).toBe("r2");
  });

  it("keeps concurrent retries behind the same restart barrier", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const p1 = adapter.run(makeRequest("r1", 100));
    await waitForSend(channels, 0);
    triggerAllTimers();
    await p1;

    const p2 = adapter.run(makeRequest("r2", 100));
    const p3 = adapter.run(makeRequest("r3", 100));
    expect(channels).toHaveLength(1);

    channels[0].emitExit(null, "SIGKILL");
    await waitForSend(channels, 1);
    channels[1].emitMessage(makeCompleted("r2"));

    const [r2, r3] = await Promise.all([p2, p3]);
    expect(r2.executionStatus).toBe("completed");
    expect(r3.executionStatus).toBe("invalid_request");
    expect(r3.diagnostics[0].code).toBe("RUN_IN_PROGRESS");
  });

  it("ignores messages from a previous generation channel", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const p1 = adapter.run(makeRequest("r1", 100));
    await waitForSend(channels, 0);
    triggerAllTimers();
    await p1;
    channels[0].emitExit(null, "SIGKILL");
    const p2 = adapter.run(makeRequest("r2", 100));
    await waitForSend(channels, 1);
    channels[0].emitMessage(makeCompleted("r2"));
    channels[1].emitMessage(makeCompleted("r2"));
    const r2 = await p2;
    expect(r2.executionStatus).toBe("completed");
    expect(r2.runId).toBe("r2");
  });

  it("resolves interrupted when a message arrives after interrupt", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1", 5000));
    await waitForSend(channels, 0);
    await adapter.interrupt("r1");
    channels[0].emitMessage(makeInterrupted("r1"));
    const result = await promise;
    expect(result.executionStatus).toBe("interrupted");
    expect(result.diagnostics[0].code).toBe("INTERRUPTED");
  });

  it("resolves interrupted when the process exits during interrupt", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1", 5000));
    await waitForSend(channels, 0);
    await adapter.interrupt("r1");
    channels[0].emitExit(null, "SIGINT");
    const result = await promise;
    expect(result.executionStatus).toBe("interrupted");
    expect(result.diagnostics[0].code).toBe("INTERRUPTED");
  });

  it("reports a non-SIGINT exit during interrupt as a runner failure", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1", 5000));
    await waitForSend(channels, 0);
    await adapter.interrupt("r1");
    channels[0].emitExit(1, "SIGTERM");
    const result = await promise;
    expect(result.executionStatus).toBe("runner_error");
    expect(result.diagnostics[0].code).toBe("RUNNER_PROCESS_EXITED");
  });

  it("records interrupt intent before signaling the channel", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const first = adapter.run(makeRequest("r1", 5000));
    await waitForSend(channels, 0);
    channels[0].interrupt.mockImplementationOnce(() => {
      channels[0].emitExit(null, "SIGINT");
    });

    await adapter.interrupt("r1");
    const interrupted = await first;
    expect(interrupted.executionStatus).toBe("interrupted");

    const second = adapter.run(makeRequest("r2", 100));
    await waitForSend(channels, 1);
    channels[1].emitMessage(makeCompleted("r2"));
    expect((await second).executionStatus).toBe("completed");
  });

  it("upgrades to RUNNER_INTERRUPT_TIMEOUT after grace", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const promise = adapter.run(makeRequest("r1", 5000));
    await waitForSend(channels, 0);
    await adapter.interrupt("r1");
    triggerAllTimers();
    const result = await promise;
    expect(result.executionStatus).toBe("timeout");
    expect(result.diagnostics[0].code).toBe("RUNNER_INTERRUPT_TIMEOUT");
    expect(channels[0].kill).toHaveBeenCalledTimes(1);
    channels[0].emitExit(null, "SIGKILL");
  });

  it("uses a new generation after interrupt-induced exit", async () => {
    resetTimers();
    const { adapter, channels } = createAdapter();
    const p1 = adapter.run(makeRequest("r1", 5000));
    await waitForSend(channels, 0);
    await adapter.interrupt("r1");
    channels[0].emitExit(null, "SIGINT");
    await p1;
    const p2 = adapter.run(makeRequest("r2", 100));
    await waitForSend(channels, 1);
    channels[1].emitMessage(makeCompleted("r2"));
    const r2 = await p2;
    expect(r2.executionStatus).toBe("completed");
  });
});
