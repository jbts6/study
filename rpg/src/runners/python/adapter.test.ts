import { afterEach, describe, expect, it, vi } from "vitest";
import { worldViewFixture } from "../../game/testing/fixture";
import type { RunRequest, RunResult, RunnerState } from "../protocol/types";
import { PythonRunnerAdapter } from "./adapter";
import type { PythonWorkerApi, PythonWorkerClient } from "./worker-api";

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

interface FakeClient {
  readonly call: ReturnType<typeof vi.fn>;
  readonly interrupt: ReturnType<typeof vi.fn>;
  readonly terminate: ReturnType<typeof vi.fn>;
  readonly workerProxy: PythonWorkerApi & {
    initialize: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  };
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function request(overrides: Partial<RunRequest> = {}): RunRequest {
  return {
    protocolVersion: 1,
    runId: "run-01J8K3",
    attemptId: "python-marsh-03-attempt-2",
    questId: "python-marsh-03",
    language: "python",
    files: { "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n" },
    entrypoint: { file: "main.py", callable: "choose_turn" },
    worldView: structuredClone(worldViewFixture),
    allowedModules: ["math"],
    limits: {
      timeoutMs: 100,
      interruptGraceMs: 20,
      maxFiles: 8,
      maxFileBytes: 16_384,
      maxSourceBytes: 65_536,
      maxOutputBytes: 16_384,
      maxTraceEvents: 1_000,
      maxValueDepth: 3,
    },
    ...overrides,
  };
}

function completed(input: RunRequest, executionStatus: RunResult["executionStatus"] = "completed"): RunResult {
  return {
    protocolVersion: 1,
    runId: input.runId,
    attemptId: input.attemptId,
    executionStatus,
    trace: [],
    diagnostics: [],
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs: 1, traceEvents: 0 },
  };
}

function fakeClient(options: {
  initialize?: () => Promise<{ state: "ready" | "unavailable"; runtimeVersion?: string }>;
  run?: (input: RunRequest) => Promise<RunResult>;
  interrupt?: () => Promise<void>;
} = {}): FakeClient {
  const initialize = vi.fn(options.initialize ?? (async () => ({ state: "ready" as const })));
  const run = vi.fn(options.run ?? (async (input: RunRequest) => completed(input)));
  const workerProxy = {
    initialize,
    run,
    interrupt: vi.fn(async (_runId: string) => undefined),
  } as FakeClient["workerProxy"];
  return {
    workerProxy,
    call: vi.fn((method: (...args: any[]) => Promise<unknown>, ...args: any[]) => method(...args)),
    interrupt: vi.fn(options.interrupt ?? (async () => undefined)),
    terminate: vi.fn(),
  } as unknown as FakeClient;
}

function makeAdapter(...clients: FakeClient[]) {
  const createWorker = vi.fn(() => ({}) as Worker);
  const createClient = vi.fn((workerFactory: () => Worker): PythonWorkerClient => {
    workerFactory();
    const client = clients.shift();
    if (!client) throw new Error("missing fake client");
    return client as unknown as PythonWorkerClient;
  });
  return {
    adapter: new PythonRunnerAdapter({ createWorker, createClient }),
    createWorker,
    createClient,
  };
}

async function flush(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function timerHarness() {
  let nextHandle = 0;
  const callbacks = new Map<number, () => void>();
  const setTimeoutFn = vi.fn((callback: () => void, _delayMs: number) => {
    const handle = ++nextHandle;
    callbacks.set(handle, callback);
    return handle;
  });
  const clearTimeoutFn = vi.fn((handle: number) => {
    callbacks.delete(handle);
  });
  return { callbacks, setTimeoutFn, clearTimeoutFn };
}

function diagnosticCode(result: RunResult): string | undefined {
  return result.diagnostics[0]?.code;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PythonRunnerAdapter", () => {
  it("transitions loading to ready to running to ready and returns the worker result unchanged", async () => {
    const input = request();
    const pendingRun = deferred<RunResult>();
    const client = fakeClient({ run: () => pendingRun.promise });
    const { adapter } = makeAdapter(client);
    const states: RunnerState[] = [];
    adapter.subscribe((state) => states.push(state));

    const resultPromise = adapter.run(input);
    await flush();
    expect(states).toEqual(["loading", "ready", "running"]);

    const workerResult = completed(input);
    pendingRun.resolve(workerResult);
    await expect(resultPromise).resolves.toBe(workerResult);
    expect(states).toEqual(["loading", "ready", "running", "ready"]);
  });

  it("returns invalid_request without creating a worker and passes a frozen validation snapshot", async () => {
    const client = fakeClient({ run: () => deferred<RunResult>().promise });
    const { adapter, createClient, createWorker } = makeAdapter(client);
    const invalid = request({ limits: { ...request().limits, timeoutMs: 0 } });

    const invalidResult = await adapter.run(invalid);
    expect(invalidResult.executionStatus).toBe("invalid_request");
    expect(diagnosticCode(invalidResult)).toBe("INVALID_LIMIT");
    expect(createClient).not.toHaveBeenCalled();
    expect(createWorker).not.toHaveBeenCalled();

    const original = request();
    const resultPromise = adapter.run(original);
    await flush();
    const received = client.workerProxy.run.mock.calls[0]?.[0] as RunRequest;
    expect(received).not.toBe(original);
    expect(Object.isFrozen(received)).toBe(true);
    expect(Object.isFrozen(received.files)).toBe(true);
    (original.files as Record<string, string>)["main.py"] = "changed";
    expect(received.files["main.py"]).toContain("choose_turn");
    adapter.dispose();
    await resultPromise;
  });

  it("admits only one concurrent first run and preserves the first request", async () => {
    const initialization = deferred<{ state: "ready" | "unavailable" }>();
    const client = fakeClient({ initialize: () => initialization.promise });
    const { adapter, createClient } = makeAdapter(client);
    const first = request();
    const second = request({ runId: "run-second", attemptId: "attempt-second" });

    const firstResult = adapter.run(first);
    const secondResult = await adapter.run(second);
    expect(secondResult.executionStatus).toBe("invalid_request");
    expect(diagnosticCode(secondResult)).toBe("RUN_IN_PROGRESS");
    expect(createClient).toHaveBeenCalledTimes(1);

    initialization.resolve({ state: "ready" });
    await expect(firstResult).resolves.toMatchObject({ runId: first.runId, executionStatus: "completed" });
    expect(client.workerProxy.run).toHaveBeenCalledWith(expect.objectContaining({ runId: first.runId }));
  });

  it("clears the hard timer after completion and ignores an interrupt for another run", async () => {
    vi.useFakeTimers();
    const input = request();
    const pendingRun = deferred<RunResult>();
    const client = fakeClient({ run: () => pendingRun.promise });
    const { adapter, createClient } = makeAdapter(client);

    const resultPromise = adapter.run(input);
    await flush();
    await adapter.interrupt("other-run");
    expect(client.interrupt).not.toHaveBeenCalled();
    pendingRun.resolve(completed(input));
    await expect(resultPromise).resolves.toMatchObject({ executionStatus: "completed" });
    await vi.advanceTimersByTimeAsync(input.limits.timeoutMs + 1);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("interrupts the current run and accepts its result during the grace period", async () => {
    vi.useFakeTimers();
    const input = request();
    const pendingRun = deferred<RunResult>();
    const client = fakeClient({ run: () => pendingRun.promise });
    const { adapter, createClient } = makeAdapter(client);

    const resultPromise = adapter.run(input);
    await flush();
    await adapter.interrupt(input.runId);
    expect(client.interrupt).toHaveBeenCalledTimes(1);
    pendingRun.resolve(completed(input, "interrupted"));
    await expect(resultPromise).resolves.toMatchObject({ executionStatus: "interrupted" });
    await vi.advanceTimersByTimeAsync(input.limits.interruptGraceMs + 1);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("rebuilds exactly once on hard timeout, keeps the timeout duration, and ignores a late old result", async () => {
    vi.useFakeTimers();
    const input = request();
    const oldRun = deferred<RunResult>();
    const oldClient = fakeClient({ run: () => oldRun.promise });
    const replacement = fakeClient();
    const { adapter, createClient } = makeAdapter(oldClient, replacement);

    const timedOut = adapter.run(input);
    await flush();
    await vi.advanceTimersByTimeAsync(input.limits.timeoutMs);
    await expect(timedOut).resolves.toMatchObject({
      executionStatus: "timeout",
      diagnostics: [expect.objectContaining({ code: "HARD_TIMEOUT" })],
      metrics: { durationMs: input.limits.timeoutMs, traceEvents: 0 },
    });
    expect(oldClient.terminate).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(2);

    oldRun.resolve(completed(input));
    await flush();
    await expect(adapter.run(request({ runId: "run-after-timeout", attemptId: "attempt-after-timeout" }))).resolves.toMatchObject({ executionStatus: "completed" });
    expect(replacement.workerProxy.run).toHaveBeenCalledTimes(1);
  });

  it("times out during initialization and ignores its late success", async () => {
    vi.useFakeTimers();
    const input = request();
    const delayedInitialization = deferred<{ state: "ready" | "unavailable" }>();
    const oldClient = fakeClient({ initialize: () => delayedInitialization.promise });
    const replacement = fakeClient();
    const { adapter, createClient } = makeAdapter(oldClient, replacement);

    const timedOut = adapter.run(input);
    await vi.advanceTimersByTimeAsync(input.limits.timeoutMs);
    await expect(timedOut).resolves.toMatchObject({
      executionStatus: "timeout",
      metrics: { durationMs: input.limits.timeoutMs, traceEvents: 0 },
    });
    delayedInitialization.resolve({ state: "ready" });
    await flush();
    expect(oldClient.terminate).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(2);
    await expect(adapter.run(request({ runId: "run-after-init", attemptId: "attempt-after-init" }))).resolves.toMatchObject({ executionStatus: "completed" });
  });

  it("rebuilds after the interrupt grace period and returns INTERRUPT_GRACE_EXCEEDED", async () => {
    vi.useFakeTimers();
    const input = request();
    const oldClient = fakeClient({ run: () => deferred<RunResult>().promise });
    const replacement = fakeClient();
    const { adapter, createClient } = makeAdapter(oldClient, replacement);

    const interrupted = adapter.run(input);
    await flush();
    await adapter.interrupt(input.runId);
    await vi.advanceTimersByTimeAsync(input.limits.interruptGraceMs);
    await expect(interrupted).resolves.toMatchObject({
      executionStatus: "interrupted",
      diagnostics: [expect.objectContaining({ code: "INTERRUPT_GRACE_EXCEEDED" })],
    });
    expect(oldClient.terminate).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it("rebuilds after a worker rejection and uses the replacement for the next run", async () => {
    const input = request();
    const oldClient = fakeClient({ run: async () => Promise.reject(new Error("C:\\secret\\token")) });
    const replacement = fakeClient();
    const { adapter } = makeAdapter(oldClient, replacement);

    const failed = await adapter.run(input);
    expect(failed.executionStatus).toBe("runner_error");
    expect(diagnosticCode(failed)).toBe("WORKER_FATAL");
    expect(failed.diagnostics[0]?.message).not.toContain("secret");
    expect(oldClient.terminate).toHaveBeenCalledTimes(1);
    await expect(adapter.run(request({ runId: "run-recovered", attemptId: "attempt-recovered" }))).resolves.toMatchObject({ executionStatus: "completed" });
    expect(replacement.workerProxy.run).toHaveBeenCalledTimes(1);
  });

  it("uses stable unavailable diagnostics for initialization and rebuild failures", async () => {
    const initialClient = fakeClient({ initialize: async () => Promise.reject(new Error("C:\\private\\stack")) });
    const initialStates: RunnerState[] = [];
    const initial = makeAdapter(initialClient).adapter;
    initial.subscribe((state) => initialStates.push(state));
    const initialFailure = await initial.run(request());
    expect(initialFailure).toMatchObject({ executionStatus: "runner_error", diagnostics: [expect.objectContaining({ code: "RUNNER_UNAVAILABLE" })] });
    expect(initialFailure.diagnostics[0]?.message).not.toContain("private");
    expect(initialStates.at(-1)).toBe("unavailable");

    const fatal = fakeClient({ run: async () => Promise.reject(new Error("worker secret")) });
    const brokenReplacement = fakeClient({ initialize: async () => ({ state: "unavailable" as const }) });
    const rebuildStates: RunnerState[] = [];
    const rebuilding = makeAdapter(fatal, brokenReplacement).adapter;
    rebuilding.subscribe((state) => rebuildStates.push(state));
    const rebuildFailure = await rebuilding.run(request());
    expect(rebuildFailure).toMatchObject({ executionStatus: "runner_error", diagnostics: [expect.objectContaining({ code: "RUNNER_REBUILD_FAILED" })] });
    expect(rebuildFailure.diagnostics[0]?.message).toContain("运行器不可用");
    expect(rebuildStates.at(-1)).toBe("unavailable");
  });

  it("settles running and initializing promises on dispose, terminates once, and rejects later runs", async () => {
    const runningInput = request();
    const runningClient = fakeClient({ run: () => deferred<RunResult>().promise });
    const runningTimers = timerHarness();
    const runningSetup = makeAdapter(runningClient);
    const running = new PythonRunnerAdapter({
      createWorker: runningSetup.createWorker,
      createClient: runningSetup.createClient,
      setTimeoutFn: runningTimers.setTimeoutFn,
      clearTimeoutFn: runningTimers.clearTimeoutFn,
    });
    const pendingRun = running.run(runningInput);
    await flush();
    await running.interrupt(runningInput.runId);
    expect(runningTimers.setTimeoutFn).toHaveBeenCalledTimes(2);
    running.dispose();
    running.dispose();
    expect(runningTimers.clearTimeoutFn).toHaveBeenCalledTimes(2);
    expect(runningTimers.callbacks).toHaveLength(0);
    await expect(pendingRun).resolves.toMatchObject({ executionStatus: "interrupted", diagnostics: [expect.objectContaining({ code: "RUNNER_DISPOSED" })] });
    expect(runningClient.terminate).toHaveBeenCalledTimes(1);
    await expect(running.run(runningInput)).resolves.toMatchObject({ executionStatus: "runner_error", diagnostics: [expect.objectContaining({ code: "RUNNER_DISPOSED" })] });

    const delayedInitialization = deferred<{ state: "ready" | "unavailable" }>();
    const initializingClient = fakeClient({ initialize: () => delayedInitialization.promise });
    const initializingTimers = timerHarness();
    const initializingSetup = makeAdapter(initializingClient);
    const initializing = new PythonRunnerAdapter({
      createWorker: initializingSetup.createWorker,
      createClient: initializingSetup.createClient,
      setTimeoutFn: initializingTimers.setTimeoutFn,
      clearTimeoutFn: initializingTimers.clearTimeoutFn,
    });
    const pendingInitialization = initializing.run(request());
    expect(initializingTimers.setTimeoutFn).toHaveBeenCalledTimes(1);
    initializing.dispose();
    expect(initializingTimers.clearTimeoutFn).toHaveBeenCalledTimes(1);
    expect(initializingTimers.callbacks).toHaveLength(0);
    delayedInitialization.resolve({ state: "ready" });
    await expect(pendingInitialization).resolves.toMatchObject({ executionStatus: "interrupted", diagnostics: [expect.objectContaining({ code: "RUNNER_DISPOSED" })] });
    expect(initializingClient.terminate).toHaveBeenCalledTimes(1);
  });

  it("immediately snapshots subscription state, suppresses duplicate states, and honors unsubscribe", async () => {
    const input = request();
    const pendingRun = deferred<RunResult>();
    const client = fakeClient({ run: () => pendingRun.promise });
    const { adapter } = makeAdapter(client);
    const states: RunnerState[] = [];
    const unsubscribe = adapter.subscribe((state) => states.push(state));
    const removedStates: RunnerState[] = [];
    const removeSecondListener = adapter.subscribe((state) => removedStates.push(state));
    removeSecondListener();

    const result = adapter.run(input);
    await flush();
    pendingRun.resolve(completed(input));
    await result;
    expect(states).toEqual(["loading", "ready", "running", "ready"]);
    expect(states.every((state, index) => index === 0 || state !== states[index - 1])).toBe(true);
    expect(removedStates).toEqual(["loading"]);
    unsubscribe();
  });
});
