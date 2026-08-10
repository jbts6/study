import { PROTOCOL_VERSION, type RunRequest, type RunResult, type RunnerDiagnostic, type RunnerState } from "../protocol/types";
import { validateRunRequest } from "../protocol/validate-request";
import type { PythonWorkerClient, PythonWorkerFactory } from "./worker-api";

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;
type TimerStarter = (handler: () => void, timeoutMs: number) => TimerHandle;
type TimerClearer = (timer: TimerHandle) => void;
type ActivePhase = "active" | "interrupting" | "restarting";

interface ActiveRun {
  readonly token: number;
  readonly request: RunRequest;
  readonly resolve: (result: RunResult) => void;
  phase: ActivePhase;
  hardTimer?: TimerHandle;
  graceTimer?: TimerHandle;
}

interface InitializingClient {
  readonly generation: number;
  readonly client: PythonWorkerClient;
  readonly promise: Promise<PythonWorkerClient | undefined>;
}

export interface PythonRunnerAdapterDependencies {
  readonly createWorker: PythonWorkerFactory;
  readonly createClient: (workerFactory: PythonWorkerFactory) => PythonWorkerClient;
  readonly setTimeoutFn?: TimerStarter;
  readonly clearTimeoutFn?: TimerClearer;
}

const RETRY_ACTION = "请稍后重新运行";

function requestIdentifiers(input: unknown): Pick<RunResult, "runId" | "attemptId"> {
  try {
    if (input === null || typeof input !== "object") return { runId: "", attemptId: "" };
    const value = input as Record<string, unknown>;
    return {
      runId: typeof value.runId === "string" ? value.runId : "",
      attemptId: typeof value.attemptId === "string" ? value.attemptId : "",
    };
  } catch {
    return { runId: "", attemptId: "" };
  }
}

function localResult(
  input: unknown,
  executionStatus: RunResult["executionStatus"],
  code: string,
  message: string,
  durationMs = 0,
): RunResult {
  const identifiers = requestIdentifiers(input);
  const diagnostic: RunnerDiagnostic = {
    code,
    severity: "error",
    message,
    recoveryAction: RETRY_ACTION,
  };
  return {
    protocolVersion: PROTOCOL_VERSION,
    ...identifiers,
    executionStatus,
    trace: [],
    diagnostics: [diagnostic],
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs, traceEvents: 0 },
  };
}

export class PythonRunnerAdapter {
  private active?: ActiveRun;
  private client?: PythonWorkerClient;
  private disposed = false;
  private generation = 0;
  private initialization?: InitializingClient;
  private nextToken = 0;
  private state: RunnerState = "loading";
  private readonly listeners = new Set<(state: RunnerState) => void>();
  private readonly terminatedClients = new WeakSet<PythonWorkerClient>();
  private readonly setTimeoutFn: TimerStarter;
  private readonly clearTimeoutFn: TimerClearer;

  constructor(private readonly dependencies: PythonRunnerAdapterDependencies) {
    this.setTimeoutFn = dependencies.setTimeoutFn ?? globalThis.setTimeout;
    this.clearTimeoutFn = dependencies.clearTimeoutFn ?? globalThis.clearTimeout;
  }

  run(request: RunRequest): Promise<RunResult> {
    const validation = validateRunRequest(request);
    if (!validation.ok) return Promise.resolve(this.invalidRequestResult(request, validation.diagnostics));
    if (this.disposed) return Promise.resolve(localResult(validation.value, "runner_error", "RUNNER_DISPOSED", "运行器已释放"));
    if (this.active) return Promise.resolve(localResult(validation.value, "invalid_request", "RUN_IN_PROGRESS", "已有运行请求正在执行"));
    return this.beginRun(validation.value);
  }

  async interrupt(runId: string): Promise<void> {
    const active = this.active;
    if (!active || active.request.runId !== runId || active.phase !== "active" || this.disposed) return;

    active.phase = "interrupting";
    this.setState("interrupting");
    const client = this.client;
    if (!client) return;
    try {
      await client.interrupt();
    } catch {
      if (this.acceptsWorkerOutcome(active)) this.rebuild(active, "runner_error", "WORKER_FATAL", "Python 运行器发生致命错误");
      return;
    }
    if (!this.acceptsWorkerOutcome(active)) return;
    active.graceTimer = this.setTimeoutFn(() => this.onGraceTimeout(active.token), active.request.limits.interruptGraceMs);
  }

  subscribe(listener: (state: RunnerState) => void): () => void {
    this.listeners.add(listener);
    this.notify(listener, this.state);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const active = this.active;
    if (active) {
      this.clearTimers(active);
      this.active = undefined;
      active.resolve(localResult(active.request, "interrupted", "RUNNER_DISPOSED", "运行器已释放"));
    }
    this.retireClient();
    this.listeners.clear();
    this.setState("unavailable");
  }

  private beginRun(request: RunRequest): Promise<RunResult> {
    return new Promise<RunResult>((resolve) => {
      const active: ActiveRun = { token: ++this.nextToken, request, resolve, phase: "active" };
      this.active = active;
      active.hardTimer = this.setTimeoutFn(() => this.onHardTimeout(active.token), request.limits.timeoutMs);
      void this.execute(active);
    });
  }

  private async execute(active: ActiveRun): Promise<void> {
    const client = await this.ensureClient();
    if (!this.acceptsWorkerOutcome(active)) return;
    if (!client) {
      this.settle(active, localResult(active.request, "runner_error", "RUNNER_UNAVAILABLE", "运行器不可用"), undefined);
      return;
    }
    this.setState("running");
    try {
      const result = await client.call(client.workerProxy.run, active.request);
      if (this.acceptsWorkerOutcome(active)) this.settle(active, result, "ready");
    } catch {
      if (this.acceptsWorkerOutcome(active)) this.rebuild(active, "runner_error", "WORKER_FATAL", "Python 运行器发生致命错误");
    }
  }

  private ensureClient(): Promise<PythonWorkerClient | undefined> {
    if (this.disposed) return Promise.resolve(undefined);
    if (this.initialization) return this.initialization.promise;
    if (this.client) return Promise.resolve(this.client);
    return this.startInitialization(false);
  }

  private startInitialization(rebuilding: boolean): Promise<PythonWorkerClient | undefined> {
    if (this.disposed) return Promise.resolve(undefined);
    if (this.initialization) return this.initialization.promise;
    if (this.client) return Promise.resolve(this.client);
    if (!rebuilding) this.setState("loading");

    const generation = ++this.generation;
    let client: PythonWorkerClient;
    try {
      client = this.dependencies.createClient(this.dependencies.createWorker);
    } catch {
      this.setState("unavailable");
      return Promise.resolve(undefined);
    }
    this.client = client;
    const promise = this.initializeClient(client, generation);
    this.initialization = { generation, client, promise };
    return promise;
  }

  private async initializeClient(client: PythonWorkerClient, generation: number): Promise<PythonWorkerClient | undefined> {
    try {
      const result = await Promise.resolve().then(() => {
        if (!this.isCurrentClient(client, generation)) return undefined;
        return client.call(client.workerProxy.initialize);
      });
      if (!this.isCurrentClient(client, generation)) return undefined;
      if (result?.state !== "ready") return this.failInitialization(client, generation);
      this.initialization = undefined;
      this.setState("ready");
      return client;
    } catch {
      if (!this.isCurrentClient(client, generation)) return undefined;
      return this.failInitialization(client, generation);
    }
  }

  private failInitialization(client: PythonWorkerClient, generation: number): undefined {
    if (!this.isCurrentClient(client, generation)) return undefined;
    this.client = undefined;
    this.initialization = undefined;
    this.terminateClient(client);
    this.setState("unavailable");
    return undefined;
  }

  private rebuild(active: ActiveRun, status: RunResult["executionStatus"], code: string, message: string, durationMs = 0): void {
    if (!this.acceptsWorkerOutcome(active)) return;
    active.phase = "restarting";
    this.clearTimers(active);
    this.setState("restarting");
    this.retireClient();
    void this.finishRebuild(active, status, code, message, durationMs);
  }

  private async finishRebuild(active: ActiveRun, status: RunResult["executionStatus"], code: string, message: string, durationMs: number): Promise<void> {
    const client = await this.startInitialization(true);
    if (!this.isRebuilding(active)) return;
    if (!client) {
      this.settle(active, localResult(active.request, "runner_error", "RUNNER_REBUILD_FAILED", "运行器不可用", durationMs), undefined);
      return;
    }
    this.settle(active, localResult(active.request, status, code, message, durationMs), "ready");
  }

  private onHardTimeout(token: number): void {
    const active = this.active;
    if (!active || active.token !== token) return;
    this.rebuild(active, "timeout", "HARD_TIMEOUT", "运行时间超过限制", active.request.limits.timeoutMs);
  }

  private onGraceTimeout(token: number): void {
    const active = this.active;
    if (!active || active.token !== token || active.phase !== "interrupting") return;
    this.rebuild(active, "interrupted", "INTERRUPT_GRACE_EXCEEDED", "中断等待超时", active.request.limits.interruptGraceMs);
  }

  private acceptsWorkerOutcome(active: ActiveRun): boolean {
    return !this.disposed && this.active === active && active.phase !== "restarting";
  }

  private isRebuilding(active: ActiveRun): boolean {
    return !this.disposed && this.active === active && active.phase === "restarting";
  }

  private isCurrentClient(client: PythonWorkerClient, generation: number): boolean {
    return !this.disposed && this.client === client && this.generation === generation;
  }

  private settle(active: ActiveRun, result: RunResult, state?: RunnerState): void {
    if (this.active !== active) return;
    this.clearTimers(active);
    this.active = undefined;
    active.resolve(result);
    if (!this.disposed && state) this.setState(state);
  }

  private retireClient(): void {
    const client = this.client;
    this.generation += 1;
    this.client = undefined;
    this.initialization = undefined;
    if (client) this.terminateClient(client);
  }

  private terminateClient(client: PythonWorkerClient): void {
    if (this.terminatedClients.has(client)) return;
    this.terminatedClients.add(client);
    try {
      client.terminate();
    } catch {
      // Termination failures must not leak Worker internals to callers.
    }
  }

  private clearTimers(active: ActiveRun): void {
    if (active.hardTimer !== undefined) {
      this.clearTimeoutFn(active.hardTimer);
      active.hardTimer = undefined;
    }
    if (active.graceTimer !== undefined) {
      this.clearTimeoutFn(active.graceTimer);
      active.graceTimer = undefined;
    }
  }

  private setState(state: RunnerState): void {
    if (this.state === state) return;
    this.state = state;
    for (const listener of [...this.listeners]) {
      if (this.listeners.has(listener)) this.notify(listener, state);
    }
  }

  private notify(listener: (state: RunnerState) => void, state: RunnerState): void {
    try {
      listener(state);
    } catch {
      // A subscriber must not be able to interrupt runner state transitions.
    }
  }

  private invalidRequestResult(input: unknown, diagnostics: readonly RunnerDiagnostic[]): RunResult {
    const identifiers = requestIdentifiers(input);
    return {
      protocolVersion: PROTOCOL_VERSION,
      ...identifiers,
      executionStatus: "invalid_request",
      trace: [],
      diagnostics,
      streams: { stdout: "", stderr: "", truncated: false },
      metrics: { durationMs: 0, traceEvents: 0 },
    };
  }
}
