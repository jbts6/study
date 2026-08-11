import { validateRunRequest } from "../protocol/validate-request";
import type { RunRequest, RunResult, RunnerState, RunnerDiagnostic } from "../protocol/types";
import type { LocalRunnerChannel } from "./channel";

type TimerHandle = number;
type TimerStarter = (handler: () => void, ms: number) => TimerHandle;
type TimerClearer = (handle: TimerHandle) => void;

export interface PythonRunnerAdapterDependencies {
  readonly createChannel: () => LocalRunnerChannel;
  readonly setTimeoutFn?: TimerStarter;
  readonly clearTimeoutFn?: TimerClearer;
}

interface ActiveRun {
  readonly request: RunRequest;
  readonly resolve: (result: RunResult) => void;
  readonly hardTimer: TimerHandle;
  graceTimer?: TimerHandle;
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

export class PythonRunnerAdapter {
  private channel: LocalRunnerChannel | undefined;
  private readonly createChannelFn: () => LocalRunnerChannel;
  private readonly setTimeoutFn: TimerStarter;
  private readonly clearTimeoutFn: TimerClearer;
  private _state: RunnerState = "loading";
  private active: ActiveRun | undefined;
  private disposed = false;
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

  private ensureChannel(): LocalRunnerChannel {
    if (this.channel) return this.channel;
    const ch = this.createChannelFn();
    ch.onMessage = (result) => this.handleMessage(result);
    ch.onExit = (code, signal) => this.handleExit(code, signal);
    this.channel = ch;
    this.setState("ready");
    return ch;
  }

  private clearActiveTimers(active: ActiveRun): void {
    this.clearTimeoutFn(active.hardTimer);
    if (active.graceTimer) this.clearTimeoutFn(active.graceTimer);
  }

  private handleMessage(result: RunResult): void {
    const active = this.active;
    if (!active) return;
    this.clearActiveTimers(active);
    this.active = undefined;
    if (this._state !== "restarting") this.setState("ready");
    active.resolve(result);
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.channel = undefined;
    const active = this.active;
    if (active) {
      this.clearActiveTimers(active);
      this.active = undefined;
      active.resolve(
        localResult(active.request, "runner_error", "RUNNER_PROCESS_EXITED",
          `Python 子进程意外退出 (code=${code}, signal=${signal})。`),
      );
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
    const channel = this.ensureChannel();
    return new Promise<RunResult>((resolve) => {
      const hardTimer = this.setTimeoutFn(() => this.handleHardTimeout(), validated.limits.timeoutMs);
      this.active = { request: validated, resolve, hardTimer };
      this.setState("running");
      channel.send(validated);
    });
  }

  private handleHardTimeout(): void {
    const active = this.active;
    if (!active) return;
    this.clearActiveTimers(active);
    this.active = undefined;
    this.setState("restarting");
    this.channel?.kill();
    active.resolve(
      localResult(active.request, "timeout", "RUNNER_TIMEOUT", "Python 运行超时，子进程已终止并重建。"),
    );
  }

  interrupt(runId: string): Promise<void> {
    const active = this.active;
    if (!active || active.request.runId !== runId) return Promise.resolve();
    this.setState("interrupting");
    this.channel?.interrupt();
    const graceTimer = this.setTimeoutFn(() => {
      const stillActive = this.active;
      if (stillActive && stillActive.request.runId === runId) {
        this.clearActiveTimers(stillActive);
        this.active = undefined;
        this.setState("restarting");
        this.channel?.kill();
        stillActive.resolve(
          localResult(stillActive.request, "timeout", "RUNNER_INTERRUPT_TIMEOUT", "中断等待超时，子进程已终止并重建。"),
        );
      }
    }, active.request.limits.interruptGraceMs);
    this.active = { ...active, graceTimer };
    return Promise.resolve();
  }

  dispose(): void {
    this.disposed = true;
    const active = this.active;
    if (active) {
      this.clearActiveTimers(active);
      this.active = undefined;
      active.resolve(localResult(active.request, "runner_error", "RUNNER_DISPOSED", "运行器已释放。"));
    }
    this.channel?.kill();
    this.channel = undefined;
    this.setState("unavailable");
  }
}
