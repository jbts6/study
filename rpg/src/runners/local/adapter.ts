import type { LocalPythonProcess } from "./python-process";
import { validateRunRequest } from "../protocol/validate-request.ts";
import type {
  ExecutionStatus,
  RunRequest,
  RunnerDiagnostic,
  RunnerState,
  RunResult,
} from "../protocol/types.ts";
import { clearTimer, RunnerStateStore } from "../shared/adapter.ts";

interface AdapterDependencies {
  startProcess(request: RunRequest): LocalPythonProcess;
}

interface ActiveRun {
  readonly request: RunRequest;
  readonly process: LocalPythonProcess;
  readonly resolve: (result: RunResult) => void;
  readonly done: Promise<void>;
  readonly markDone: () => void;
  timeoutTimer?: ReturnType<typeof setTimeout>;
  interruptTimer?: ReturnType<typeof setTimeout>;
  ending?: RunResult;
}

function emptyResult(
  request: Pick<RunRequest, "runId" | "attemptId">,
  executionStatus: ExecutionStatus,
  diagnostics: readonly RunnerDiagnostic[],
): RunResult {
  return {
    protocolVersion: 1,
    runId: request.runId,
    attemptId: request.attemptId,
    executionStatus,
    trace: [],
    diagnostics,
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs: 0, traceEvents: 0 },
  };
}

function failure(
  request: Pick<RunRequest, "runId" | "attemptId">,
  executionStatus: ExecutionStatus,
  code: string,
  message: string,
): RunResult {
  return emptyResult(request, executionStatus, [{
    code,
    severity: "error",
    message,
    recoveryAction: "修改代码后重新运行。",
  }]);
}

export class PythonRunnerAdapter {
  private readonly startProcess: AdapterDependencies["startProcess"];
  private active?: ActiveRun;
  private disposed = false;
  private readonly states = new RunnerStateStore<RunnerState>("ready");

  constructor(dependencies: AdapterDependencies) {
    this.startProcess = dependencies.startProcess;
  }

  get state(): RunnerState {
    return this.states.value;
  }

  onStateChange(listener: (state: RunnerState) => void): () => void {
    return this.states.subscribe(listener);
  }

  run(input: unknown): Promise<RunResult> {
    const validation = validateRunRequest(input);
    if (!validation.ok) {
      const ids = input as Partial<RunRequest> | null;
      return Promise.resolve(emptyResult(
        {
          runId: typeof ids?.runId === "string" ? ids.runId : "unknown",
          attemptId: typeof ids?.attemptId === "string" ? ids.attemptId : "unknown",
        },
        "invalid_request",
        validation.diagnostics,
      ));
    }

    const request = validation.value;
    if (this.disposed) {
      return Promise.resolve(failure(
        request,
        "runner_error",
        "RUNNER_DISPOSED",
        "本地 Python 执行器已关闭。",
      ));
    }
    if (this.active) {
      return Promise.resolve(failure(
        request,
        "runner_error",
        "RUNNER_BUSY",
        "上一段代码仍在运行。",
      ));
    }

    let process: LocalPythonProcess;
    try {
      process = this.startProcess(request);
    } catch (error) {
      return Promise.resolve(failure(
        request,
        "runner_error",
        "RUNNER_START_FAILED",
        error instanceof Error ? error.message : String(error),
      ));
    }

    return new Promise<RunResult>((resolve) => {
      let markDone!: () => void;
      const done = new Promise<void>((doneResolve) => { markDone = doneResolve; });
      const active: ActiveRun = { request, process, resolve, done, markDone };
      this.active = active;
      this.setState("running");
      active.timeoutTimer = setTimeout(() => {
        void this.terminate(active, failure(
          request,
          "timeout",
          "RUNNER_TIMEOUT",
          `代码运行超过 ${request.limits.timeoutMs}ms，已停止。`,
        ));
      }, request.limits.timeoutMs);

      process.result.then(
        (result) => {
          if (!active.ending) this.finish(active, result);
        },
        (error: unknown) => {
          if (active.ending) return;
          if (this.state === "interrupting") {
            this.finish(active, failure(
              request,
              "interrupted",
              "RUNNER_INTERRUPTED",
              "代码运行已中断。",
            ));
            return;
          }
          this.finish(active, failure(
            request,
            "runner_error",
            "RUNNER_PROCESS_FAILED",
            error instanceof Error ? error.message : String(error),
          ));
        },
      );
    });
  }

  async interrupt(runId: string): Promise<void> {
    const active = this.active;
    if (!active || active.request.runId !== runId || active.ending) return;

    if (active.timeoutTimer) clearTimeout(active.timeoutTimer);
    this.setState("interrupting");
    active.process.interrupt();
    active.interruptTimer = setTimeout(() => {
      void this.terminate(active, failure(
        active.request,
        "runner_error",
        "RUNNER_INTERRUPT_TIMEOUT",
        "Python 进程未及时响应中断，已终止。",
      ));
    }, active.request.limits.interruptGraceMs);
    await active.done;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const active = this.active;
    if (active) {
      await this.terminate(active, failure(
        active.request,
        "runner_error",
        "RUNNER_DISPOSED",
        "本地 Python 执行器已关闭。",
      ));
    }
    this.setState("unavailable");
  }

  private async terminate(active: ActiveRun, result: RunResult): Promise<void> {
    if (this.active !== active || active.ending) {
      await active.done;
      return;
    }
    active.ending = result;
    this.clearTimers(active);
    try {
      await active.process.kill();
    } finally {
      this.finish(active, result);
    }
  }

  private finish(active: ActiveRun, result: RunResult): void {
    if (this.active !== active) return;
    this.clearTimers(active);
    this.active = undefined;
    active.resolve(result);
    active.markDone();
    this.setState(this.disposed ? "unavailable" : "ready");
  }

  private clearTimers(active: ActiveRun): void {
    clearTimer(active.timeoutTimer);
    clearTimer(active.interruptTimer);
  }

  private setState(state: RunnerState): void {
    this.states.set(state);
  }
}
