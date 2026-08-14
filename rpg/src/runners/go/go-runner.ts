import type { RunnerClient, RunnerDisplayState } from "../../app/runner-client";
import { validateRunRequest } from "../protocol/validate-request";
import type {
  CompiledRunRequest,
  ExecutionStatus,
  JsonValue,
  RunRequest,
  RunnerDiagnostic,
  RunnerMetrics,
  RunResult,
} from "../protocol/types";
import { clearTimer, RunnerStateStore } from "../shared/adapter";
import { detectGo, type GoDetection } from "./go-detector";
import { createGoProject, readTurnResult, type GoProject } from "./go-project";
import {
  startGoProcess,
  type GoProcessHandle,
  type GoProcessResult,
  type StartGoProcess,
} from "./go-process";

export interface GoRunnerOptions {
  readonly globalStoragePath: string;
  readonly runtimeDirectory?: string;
  readonly detectGo?: () => Promise<GoDetection>;
  readonly createProject?: typeof createGoProject;
  readonly startProcess?: StartGoProcess;
}

interface ActiveRun {
  readonly runId: string;
  readonly interruptGraceMs: number;
  handle?: GoProcessHandle;
  interrupted: boolean;
  interruptTimer?: ReturnType<typeof setTimeout>;
  termination?: Promise<void>;
  terminationError?: unknown;
}

type PreparedRun =
  | Readonly<{
    ok: true;
    request: CompiledRunRequest;
    detection: Extract<GoDetection, { ok: true }>;
  }>
  | Readonly<{ ok: false; result: RunResult }>;

interface ResultDetails {
  readonly status: ExecutionStatus;
  readonly diagnostics?: readonly RunnerDiagnostic[];
  readonly returnValue?: JsonValue;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly truncated?: boolean;
  readonly buildDurationMs?: number;
  readonly executionDurationMs?: number;
}

const RECOVERY_ACTION = "修改 Go 代码后重新运行。";

function diagnostic(code: string, message: string): RunnerDiagnostic {
  return { code, severity: "error", message, recoveryAction: RECOVERY_ACTION };
}

function cleanupDiagnostic(error: unknown): RunnerDiagnostic {
  return {
    code: "GO_CLEANUP_FAILED",
    severity: "warning",
    message: error instanceof Error ? error.message : String(error),
    recoveryAction: "关闭 Runner 后重试；临时目录可能需要手动清理。",
  };
}

function appendDiagnostic(result: RunResult, extra: RunnerDiagnostic): RunResult {
  return { ...result, diagnostics: [...result.diagnostics, extra] };
}

function result(request: Pick<RunRequest, "runId" | "attemptId">, details: ResultDetails): RunResult {
  const buildDurationMs = details.buildDurationMs ?? 0;
  const executionDurationMs = details.executionDurationMs ?? 0;
  const metrics: RunnerMetrics = {
    durationMs: buildDurationMs + executionDurationMs,
    buildDurationMs,
    executionDurationMs,
    traceEvents: 0,
  };
  return {
    protocolVersion: 1,
    runId: request.runId,
    attemptId: request.attemptId,
    executionStatus: details.status,
    ...(details.returnValue === undefined ? {} : { returnValue: details.returnValue }),
    trace: [],
    diagnostics: details.diagnostics ?? [],
    streams: {
      stdout: details.stdout ?? "",
      stderr: details.stderr ?? "",
      truncated: details.truncated ?? false,
    },
    metrics,
  };
}

function parseCompileDiagnostics(stderr: string, questId: string): readonly RunnerDiagnostic[] {
  const diagnostics: RunnerDiagnostic[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    const match = line.match(/(?:^|[\\/])strategy\.go:(\d+)(?::(\d+))?:\s*(.+)$/);
    if (!match) continue;
    diagnostics.push({
      code: "GO_COMPILE_ERROR",
      severity: "error",
      message: match[3],
      location: {
        file: `${questId}.go`,
        line: Number(match[1]),
        ...(match[2] === undefined ? {} : { column: Number(match[2]) }),
      },
      recoveryAction: RECOVERY_ACTION,
    });
  }
  return diagnostics.length > 0
    ? diagnostics
    : [diagnostic("GO_COMPILE_ERROR", stderr || "Go 编译失败。")];
}

export class GoRunner implements RunnerClient {
  private readonly globalStoragePath: string;
  private readonly runtimeDirectory?: string;
  private readonly detect: () => Promise<GoDetection>;
  private readonly prepareProject: typeof createGoProject;
  private readonly startProcess: StartGoProcess;
  private readonly states = new RunnerStateStore<RunnerDisplayState>("connecting");
  private detection?: Extract<GoDetection, { ok: true }>;
  private active?: ActiveRun;
  private disposed = false;

  constructor(options: GoRunnerOptions) {
    this.globalStoragePath = options.globalStoragePath;
    this.runtimeDirectory = options.runtimeDirectory;
    this.detect = options.detectGo ?? detectGo;
    this.prepareProject = options.createProject ?? createGoProject;
    this.startProcess = options.startProcess ?? startGoProcess;
  }

  get state(): RunnerDisplayState {
    return this.states.value;
  }

  onStateChange(listener: (state: RunnerDisplayState) => void): () => void {
    return this.states.subscribe(listener);
  }

  async connect(): Promise<void> {
    if (this.disposed) throw new Error("Go 执行器已关闭。");
    if (this.detection) return;
    this.states.set("connecting");
    const detection = await this.detect();
    if (!detection.ok) {
      if (this.disposed) throw new Error("Go 执行器已关闭。");
      this.states.set("unavailable");
      throw new Error(`${detection.message} ${detection.recoveryAction}`);
    }
    if (this.disposed) throw new Error("Go 执行器已关闭。");
    this.detection = detection;
    this.states.set("ready");
  }

  async run(input: RunRequest): Promise<RunResult> {
    const prepared = this.prepareRun(input);
    if (!prepared.ok) return prepared.result;
    const { request, detection } = prepared;
    const active: ActiveRun = {
      runId: request.runId,
      interruptGraceMs: request.limits.interruptGraceMs,
      interrupted: false,
    };
    this.active = active;
    this.states.set("running");
    return this.performRun(request, detection, active);
  }

  private prepareRun(input: RunRequest): PreparedRun {
    const validation = validateRunRequest(input);
    if (!validation.ok) {
      return { ok: false, result: result(input, {
        status: "invalid_request",
        diagnostics: validation.diagnostics,
      }) };
    }
    const request = validation.value;
    if (request.language !== "go") {
      return { ok: false, result: result(request, {
        status: "invalid_request",
        diagnostics: [diagnostic("INVALID_GO_REQUEST", "Go 执行器只接受 Go 请求。")],
      }) };
    }
    if (this.disposed || !this.detection) {
      return { ok: false, result: result(request, {
        status: "runner_error",
        diagnostics: [diagnostic("GO_RUNNER_UNAVAILABLE", "Go 执行器尚未连接或已关闭。")],
      }) };
    }
    if (this.active) {
      return { ok: false, result: result(request, {
        status: "runner_error",
        diagnostics: [diagnostic("RUNNER_BUSY", "上一段 Go 代码仍在运行。")],
      }) };
    }
    return { ok: true, request, detection: this.detection };
  }

  private async performRun(
    request: CompiledRunRequest,
    detection: Extract<GoDetection, { ok: true }>,
    active: ActiveRun,
  ): Promise<RunResult> {
    let project: GoProject | undefined;
    let outcome: RunResult;
    try {
      project = await this.prepareProject({
        request,
        goVersion: detection.version,
        globalStoragePath: this.globalStoragePath,
        runtimeDirectory: this.runtimeDirectory,
      });
      outcome = await this.runProject(request, project, active);
    } catch (error) {
      outcome = result(request, {
        status: active.interrupted ? "interrupted" : "runner_error",
        diagnostics: [diagnostic(
          active.interrupted ? "RUNNER_INTERRUPTED" : "GO_RUNNER_FAILED",
          active.interrupted ? "Go 代码运行已中断。" : error instanceof Error ? error.message : String(error),
        )],
      });
    }
    return this.finishRun(outcome, project, active);
  }

  private async finishRun(
    outcome: RunResult,
    project: GoProject | undefined,
    active: ActiveRun,
  ): Promise<RunResult> {
    let cleanupError: unknown;
    try {
      if (active.termination) await active.termination;
      if (project) await project.cleanup();
    } catch (error) {
      cleanupError = error;
    } finally {
      clearTimer(active.interruptTimer);
      active.handle = undefined;
      if (this.active === active) this.active = undefined;
      this.states.set(this.disposed ? "unavailable" : "ready");
    }
    if (active.terminationError !== undefined) {
      outcome = appendDiagnostic(outcome, diagnostic(
        "GO_TERMINATION_FAILED",
        active.terminationError instanceof Error ? active.terminationError.message : String(active.terminationError),
      ));
    }
    return cleanupError === undefined ? outcome : appendDiagnostic(outcome, cleanupDiagnostic(cleanupError));
  }

  interrupt(runId: string): void {
    const active = this.active;
    if (!active || active.runId !== runId || active.interrupted) return;
    active.interrupted = true;
    active.handle?.interrupt();
    active.interruptTimer = setTimeout(() => {
      const handle = active.handle;
      if (handle) this.terminate(active, handle);
    }, active.interruptGraceMs);
  }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    const active = this.active;
    if (active) {
      active.interrupted = true;
      const handle = active.handle;
      if (handle) this.terminate(active, handle);
    }
    this.states.set("unavailable");
  }

  private terminate(active: ActiveRun, handle: GoProcessHandle): void {
    active.termination = handle.kill().catch((error: unknown) => {
      active.terminationError = error;
    });
  }

  private async runProject(
    request: CompiledRunRequest,
    project: GoProject,
    active: ActiveRun,
  ): Promise<RunResult> {
    const build = await this.buildProject(request, project, active);
    if (!build.ok) return build.result;
    return this.executeProject(request, project, active, build.durationMs);
  }

  private async buildProject(
    request: CompiledRunRequest,
    project: GoProject,
    active: ActiveRun,
  ): Promise<{ readonly ok: true; readonly durationMs: number } | { readonly ok: false; readonly result: RunResult }> {
    if (project.cached) return { ok: true, durationMs: 0 };
    const build = await this.runStage(active, {
      command: this.detection!.goPath,
      args: ["build", "-o", project.buildBinaryPath, "."],
      cwd: project.directory,
      timeoutMs: request.limits.buildTimeoutMs,
      maxOutputBytes: request.limits.maxOutputBytes,
    });
    if (active.interrupted) return { ok: false, result: this.interruptedResult(request, build.durationMs, 0, build) };
    if (build.timedOut) {
      return { ok: false, result: result(request, {
        status: "timeout",
        diagnostics: [diagnostic("GO_BUILD_TIMEOUT", `Go 构建超过 ${request.limits.buildTimeoutMs}ms，已停止。`)],
        stderr: build.stderr,
        truncated: build.truncated,
        buildDurationMs: build.durationMs,
      }) };
    }
    if (build.exitCode !== 0) {
      return { ok: false, result: result(request, {
        status: "compile_error",
        diagnostics: parseCompileDiagnostics(build.stderr, request.questId),
        stdout: build.stdout,
        stderr: build.stderr,
        truncated: build.truncated,
        buildDurationMs: build.durationMs,
      }) };
    }
    await project.promoteBuild();
    return { ok: true, durationMs: build.durationMs };
  }

  private async executeProject(
    request: CompiledRunRequest,
    project: GoProject,
    active: ActiveRun,
    buildDurationMs: number,
  ): Promise<RunResult> {
    const execution = await this.runStage(active, {
      command: project.binaryPath,
      args: [],
      cwd: project.directory,
      env: { ...process.env, RPG_RESULT_PATH: project.resultPath },
      stdin: JSON.stringify(request.worldView),
      timeoutMs: request.limits.executionTimeoutMs,
      maxOutputBytes: request.limits.maxOutputBytes,
    });
    const executionDurationMs = execution.durationMs;
    if (active.interrupted) return this.interruptedResult(request, buildDurationMs, executionDurationMs, execution);
    if (execution.timedOut) {
      return result(request, {
        status: "timeout",
        diagnostics: [diagnostic("GO_EXECUTION_TIMEOUT", `Go 策略运行超过 ${request.limits.executionTimeoutMs}ms，已停止。`)],
        stdout: execution.stdout,
        stderr: execution.stderr,
        truncated: execution.truncated,
        buildDurationMs,
        executionDurationMs,
      });
    }
    if (execution.exitCode !== 0) {
      return result(request, {
        status: "runtime_error",
        diagnostics: [diagnostic("GO_RUNTIME_ERROR", execution.stderr || "Go 策略进程异常退出。")],
        stdout: execution.stdout,
        stderr: execution.stderr,
        truncated: execution.truncated,
        buildDurationMs,
        executionDurationMs,
      });
    }
    return this.readExecutionResult(request, project.resultPath, execution, buildDurationMs, executionDurationMs);
  }

  private async readExecutionResult(
    request: CompiledRunRequest,
    resultPath: string,
    execution: GoProcessResult,
    buildDurationMs: number,
    executionDurationMs: number,
  ): Promise<RunResult> {
    const returnValue = await readTurnResult(resultPath);
    if (returnValue === undefined) {
      return result(request, {
        status: "runner_error",
        diagnostics: [diagnostic("INVALID_TURN_RESULT", "Go 策略未写入有效的 TurnCommand JSON。")],
        stdout: execution.stdout,
        stderr: execution.stderr,
        truncated: execution.truncated,
        buildDurationMs,
        executionDurationMs,
      });
    }
    return result(request, {
      status: "completed",
      returnValue,
      stdout: execution.stdout,
      stderr: execution.stderr,
      truncated: execution.truncated,
      buildDurationMs,
      executionDurationMs,
    });
  }

  private async runStage(
    active: ActiveRun,
    options: Parameters<StartGoProcess>[0],
  ): Promise<GoProcessResult> {
    if (active.interrupted) throw new Error("Go 代码运行已中断。");
    const handle = this.startProcess(options);
    active.handle = handle;
    const outcome = await handle.result;
    if (active.handle === handle) active.handle = undefined;
    return outcome;
  }

  private interruptedResult(
    request: CompiledRunRequest,
    buildDurationMs: number,
    executionDurationMs: number,
    processResult: GoProcessResult,
  ): RunResult {
    return result(request, {
      status: "interrupted",
      diagnostics: [diagnostic("RUNNER_INTERRUPTED", "Go 代码运行已中断。")],
      stdout: processResult.stdout,
      stderr: processResult.stderr,
      truncated: processResult.truncated,
      buildDurationMs,
      executionDurationMs,
    });
  }
}
