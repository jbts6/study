import { beforeEach, describe, expect, it, vi } from "vitest";
import { PythonRunnerAdapter } from "./adapter";
import type { LocalPythonProcess } from "./python-process";
import type { RunRequest, RunResult } from "../protocol/types";
import { worldViewFixture } from "../../game/testing/fixture";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeRequest(runId = "run-1"): RunRequest {
  return {
    protocolVersion: 1,
    runId,
    attemptId: "attempt-1",
    questId: "python-marsh-01",
    language: "python",
    files: { "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n" },
    entrypoint: { file: "main.py", callable: "choose_turn" },
    worldView: worldViewFixture,
    allowedModules: ["math"],
    limits: {
      timeoutMs: 1_000,
      interruptGraceMs: 100,
      maxFiles: 10,
      maxFileBytes: 65_536,
      maxSourceBytes: 65_536,
      maxOutputBytes: 16_384,
      maxTraceEvents: 1_000,
      maxValueDepth: 3,
    },
  };
}

function makeResult(request: RunRequest, executionStatus: RunResult["executionStatus"]): RunResult {
  return {
    protocolVersion: 1,
    runId: request.runId,
    attemptId: request.attemptId,
    executionStatus,
    trace: [],
    diagnostics: [],
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs: 1, traceEvents: 0 },
  };
}

function mockProcess() {
  const result = deferred<RunResult>();
  const process: LocalPythonProcess = {
    pid: 42,
    result: result.promise,
    interrupt: vi.fn(),
    kill: vi.fn().mockResolvedValue(undefined),
  };
  return { process, result };
}

describe("PythonRunnerAdapter", () => {
  beforeEach(() => vi.useFakeTimers());

  it("starts one process and returns its result", async () => {
    const child = mockProcess();
    const startProcess = vi.fn(() => child.process);
    const adapter = new PythonRunnerAdapter({ startProcess });
    const states: string[] = [];
    adapter.onStateChange((state) => states.push(state));
    const request = makeRequest();

    const pending = adapter.run(request);
    child.result.resolve(makeResult(request, "completed"));

    await expect(pending).resolves.toMatchObject({ executionStatus: "completed" });
    expect(startProcess).toHaveBeenCalledWith(request);
    expect(states).toEqual(["running", "ready"]);
  });

  it("rejects a second run while the first process is active", async () => {
    const child = mockProcess();
    const adapter = new PythonRunnerAdapter({ startProcess: () => child.process });
    const firstRequest = makeRequest("first");
    const first = adapter.run(firstRequest);

    await expect(adapter.run(makeRequest("second"))).resolves.toMatchObject({
      executionStatus: "runner_error",
      diagnostics: [{ code: "RUNNER_BUSY" }],
    });
    child.result.resolve(makeResult(firstRequest, "completed"));
    await first;
  });

  it("reports a process startup failure and remains ready", async () => {
    const adapter = new PythonRunnerAdapter({
      startProcess: () => { throw new Error("spawn failed"); },
    });

    await expect(adapter.run(makeRequest())).resolves.toMatchObject({
      executionStatus: "runner_error",
      diagnostics: [{ code: "RUNNER_START_FAILED", message: "spawn failed" }],
    });
    expect(adapter.state).toBe("ready");
  });

  it("kills a timed-out process and accepts the next run", async () => {
    const first = mockProcess();
    const second = mockProcess();
    const startProcess = vi.fn()
      .mockReturnValueOnce(first.process)
      .mockReturnValueOnce(second.process);
    const adapter = new PythonRunnerAdapter({ startProcess });

    const timedOut = adapter.run(makeRequest("slow"));
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(timedOut).resolves.toMatchObject({
      executionStatus: "timeout",
      diagnostics: [{ code: "RUNNER_TIMEOUT" }],
    });
    expect(first.process.kill).toHaveBeenCalledOnce();

    const nextRequest = makeRequest("next");
    const next = adapter.run(nextRequest);
    second.result.resolve(makeResult(nextRequest, "completed"));
    await expect(next).resolves.toMatchObject({ executionStatus: "completed" });
  });

  it("interrupts the active process and returns its interrupted result", async () => {
    const child = mockProcess();
    const adapter = new PythonRunnerAdapter({ startProcess: () => child.process });
    const request = makeRequest();
    const pending = adapter.run(request);

    const interrupting = adapter.interrupt(request.runId);
    expect(child.process.interrupt).toHaveBeenCalledOnce();
    child.result.resolve(makeResult(request, "interrupted"));

    await interrupting;
    await expect(pending).resolves.toMatchObject({ executionStatus: "interrupted" });
    expect(adapter.state).toBe("ready");
  });

  it("kills a process that ignores the interrupt grace period", async () => {
    const child = mockProcess();
    const adapter = new PythonRunnerAdapter({ startProcess: () => child.process });
    const request = makeRequest();
    const pending = adapter.run(request);

    const interrupting = adapter.interrupt(request.runId);
    await vi.advanceTimersByTimeAsync(100);
    await interrupting;

    expect(child.process.kill).toHaveBeenCalledOnce();
    await expect(pending).resolves.toMatchObject({
      executionStatus: "runner_error",
      diagnostics: [{ code: "RUNNER_INTERRUPT_TIMEOUT" }],
    });
  });

  it("kills an active process when disposed", async () => {
    const child = mockProcess();
    const adapter = new PythonRunnerAdapter({ startProcess: () => child.process });
    const pending = adapter.run(makeRequest());

    await adapter.dispose();

    expect(child.process.kill).toHaveBeenCalledOnce();
    await expect(pending).resolves.toMatchObject({
      executionStatus: "runner_error",
      diagnostics: [{ code: "RUNNER_DISPOSED" }],
    });
    expect(adapter.state).toBe("unavailable");
  });
});
