import { validateRunRequest } from "../protocol/validate-request.ts";
import type { RunRequest, RunResult, RunnerState, RunnerDiagnostic } from "../protocol/types.ts";
import type { LocalRunnerChannel } from "./channel.ts";

type TimerHandle = number;
type TimerStarter = (handler: () => void, ms: number) => TimerHandle;
type TimerClearer = (handle: TimerHandle) => void;

export interface PythonRunnerAdapterDependencies {
  readonly createChannel: () => LocalRunnerChannel;
  readonly setTimeoutFn?: TimerStarter;
  readonly clearTimeoutFn?: TimerClearer;
}

interface ChannelLease {
  readonly channel: LocalRunnerChannel;
  readonly generation: number;
}

interface ActiveRun {
  readonly request: RunRequest;
  readonly lease: ChannelLease;
  readonly resolve: (result: RunResult) => void;
  readonly hardTimer: TimerHandle;
  graceTimer?: TimerHandle;
  interrupting?: boolean;
}

function localResult(
  request: Pick<RunRequest, "runId" | "attemptId">,
  executionStatus: RunResult["executionStatus"],
  code: string,
  message: string,
): RunResult {
  const diagnostic: RunnerDiagnostic = { code, severity: "error", message, recoveryAction: "请稍后重新运行" };
  return {
    protocolVersion: 1,
    runId: request.runId,
    attemptId: request.attemptId,
    executionStatus,
    returnValue: undefined,
    returnValueTraceSeq: undefined,
    trace: [],
    diagnostics: [diagnostic],
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs: 0, traceEvents: 0 },
  };
}

function interruptedResult(request: Pick<RunRequest, "runId" | "attemptId">): RunResult {
  return {
    protocolVersion: 1,
    runId: request.runId,
    attemptId: request.attemptId,
    executionStatus: "interrupted",
    returnValue: undefined,
    returnValueTraceSeq: undefined,
    trace: [],
    diagnostics: [{ code: "INTERRUPTED", severity: "info", message: "Python 运行已中断。", recoveryAction: "修改代码后重新运行" }],
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs: 0, traceEvents: 0 },
  };
}

export class PythonRunnerAdapter {
  private channel: LocalRunnerChannel | undefined;
  private readonly createChannelFn: () => LocalRunnerChannel;
  private readonly setTimeoutFn: TimerStarter;
  private readonly clearTimeoutFn: TimerClearer;
  private _state: RunnerState = "loading";
  private active: ActiveRun | undefined;
  private disposed = false;
  private disposePromise: Promise<void> | undefined;
  private pendingRestart: Promise<void> | undefined;
  private readonly listeners = new Set<(state: RunnerState) => void>();

  constructor(deps: PythonRunnerAdapterDependencies) {
    this.createChannelFn = deps.createChannel;
    this.setTimeoutFn = deps.setTimeoutFn ?? ((h, ms) => setTimeout(h, ms) as unknown as number);
    this.clearTimeoutFn = deps.clearTimeoutFn ?? ((h) => clearTimeout(h as unknown as ReturnType<typeof setTimeout>));
  }

  get state(): RunnerState {
    return this._state;
  }

  onStateChange(listener: (state: RunnerState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private setState(state: RunnerState): void {
    this._state = state;
    for (const listener of this.listeners) listener(state);
  }

  private ensureChannel(): ChannelLease {
    if (this.channel) {
      return { channel: this.channel, generation: this.channel.generation };
    }
    const ch = this.createChannelFn();
    const lease: ChannelLease = { channel: ch, generation: ch.generation };
    ch.onMessage = (result) => this.handleMessage(lease, result);
    ch.onExit = (code, signal) => this.handleExit(lease, code, signal);
    this.channel = ch;
    return lease;
  }

  private clearActiveTimers(active: ActiveRun): void {
    this.clearTimeoutFn(active.hardTimer);
    if (active.graceTimer) this.clearTimeoutFn(active.graceTimer);
  }

  private handleMessage(lease: ChannelLease, result: RunResult): void {
    const active = this.active;
    if (!active || active.lease !== lease) return;
    if (result.runId !== active.request.runId || result.attemptId !== active.request.attemptId) return;
    this.clearActiveTimers(active);
    this.active = undefined;
    if (this._state !== "restarting") this.setState("ready");
    active.resolve(result);
  }

  private handleExit(lease: ChannelLease, code: number | null, signal: NodeJS.Signals | null): void {
    if (this.channel !== lease.channel) return;
    this.channel = undefined;
    const active = this.active;
    if (active && active.lease === lease) {
      this.clearActiveTimers(active);
      this.active = undefined;
      if (active.interrupting && signal === "SIGINT") {
        active.resolve(interruptedResult(active.request));
      } else {
        active.resolve(
          localResult(active.request, "runner_error", "RUNNER_PROCESS_EXITED",
            `Python 子进程意外退出 (code=${code}, signal=${signal})。`),
        );
      }
    }
    if (!this.disposed) this.setState("ready");
  }

  run(request: RunRequest): Promise<RunResult> {
    const validation = validateRunRequest(request);
    if (!validation.ok) {
      return Promise.resolve(localResult(request, "invalid_request", "INVALID_REQUEST", "请求校验失败。"));
    }
    const validated = validation.value;
    if (this.disposed) {
      return Promise.resolve(localResult(validated, "runner_error", "RUNNER_DISPOSED", "运行器已释放。"));
    }
    if (this.active) {
      return Promise.resolve(localResult(validated, "invalid_request", "RUN_IN_PROGRESS", "已有运行请求正在执行。"));
    }
    return this.executeRun(validated);
  }

  private async executeRun(validated: RunRequest): Promise<RunResult> {
    if (this.pendingRestart) {
      const pending = this.pendingRestart;
      await pending;
      if (this.pendingRestart === pending) this.pendingRestart = undefined;
    }
    if (this.disposed) {
      return localResult(validated, "runner_error", "RUNNER_DISPOSED", "运行器已释放。");
    }
    if (this.active) {
      return localResult(validated, "invalid_request", "RUN_IN_PROGRESS", "已有运行请求正在执行。");
    }
    const lease = this.ensureChannel();
    try {
      await lease.channel.waitReady();
    } catch {
      await this.dropLease(lease);
      return localResult(validated, "runner_error", "RUNNER_START_FAILED", "Python 子进程启动失败。");
    }
    if (this.disposed) {
      return localResult(validated, "runner_error", "RUNNER_DISPOSED", "运行器已释放。");
    }
    if (this.active) {
      return localResult(validated, "invalid_request", "RUN_IN_PROGRESS", "已有运行请求正在执行。");
    }
    return new Promise<RunResult>((resolve) => {
      const hardTimer = this.setTimeoutFn(() => this.handleHardTimeout(), validated.limits.timeoutMs);
      this.active = { request: validated, lease, resolve, hardTimer };
      this.setState("running");
      lease.channel.send(validated).catch(() => {
        const active = this.active;
        if (!active || active.lease !== lease) return;
        this.clearActiveTimers(active);
        this.active = undefined;
        this.beginRestart(lease);
        resolve(localResult(validated, "runner_error", "RUNNER_SEND_FAILED", "Python 子进程写入失败。"));
      });
    });
  }

  private async dropLease(lease: ChannelLease): Promise<void> {
    if (this.channel === lease.channel) this.channel = undefined;
    try {
      await lease.channel.kill();
    } catch {
      /* ignore cleanup errors */
    }
  }

  private beginRestart(lease: ChannelLease): void {
    this.setState("restarting");
    if (this.channel === lease.channel) this.channel = undefined;
    this.pendingRestart = lease.channel.kill().catch(() => { /* ignore */ });
  }

  private handleHardTimeout(): void {
    const active = this.active;
    if (!active) return;
    this.clearActiveTimers(active);
    this.active = undefined;
    const lease = active.lease;
    this.beginRestart(lease);
    active.resolve(
      localResult(active.request, "timeout", "RUNNER_TIMEOUT", "Python 运行超时，子进程已终止并重建。"),
    );
  }

  interrupt(runId: string): Promise<void> {
    const active = this.active;
    if (!active || active.request.runId !== runId) return Promise.resolve();
    this.setState("interrupting");
    this.clearTimeoutFn(active.hardTimer);
    const interrupting = { ...active, interrupting: true };
    this.active = interrupting;
    active.lease.channel.interrupt();
    if (this.active !== interrupting) return Promise.resolve();
    const graceTimer = this.setTimeoutFn(() => {
      const stillActive = this.active;
      if (!stillActive || stillActive.request.runId !== runId) return;
      this.clearActiveTimers(stillActive);
      this.active = undefined;
      const lease = stillActive.lease;
      this.beginRestart(lease);
      stillActive.resolve(
        localResult(stillActive.request, "timeout", "RUNNER_INTERRUPT_TIMEOUT", "中断等待超时，子进程已终止并重建。"),
      );
    }, active.request.limits.interruptGraceMs);
    this.active = { ...interrupting, graceTimer };
    return Promise.resolve();
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;
    this.disposePromise = this.performDispose();
    return this.disposePromise;
  }

  private async performDispose(): Promise<void> {
    this.disposed = true;
    const active = this.active;
    if (active) {
      this.clearActiveTimers(active);
      this.active = undefined;
      active.resolve(localResult(active.request, "runner_error", "RUNNER_DISPOSED", "运行器已释放。"));
    }
    const channel = this.channel;
    const pendingRestart = this.pendingRestart;
    this.channel = undefined;
    this.setState("unavailable");
    if (pendingRestart) {
      await pendingRestart;
      if (this.pendingRestart === pendingRestart) this.pendingRestart = undefined;
    }
    if (channel) {
      try {
        await channel.kill();
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}
