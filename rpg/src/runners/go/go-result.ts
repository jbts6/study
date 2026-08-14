import type {
  ExecutionStatus,
  JsonValue,
  RunRequest,
  RunnerDiagnostic,
  RunnerMetrics,
  RunResult,
} from "../protocol/types";

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

export function goDiagnostic(code: string, message: string): RunnerDiagnostic {
  return { code, severity: "error", message, recoveryAction: RECOVERY_ACTION };
}

export function cleanupDiagnostic(error: unknown): RunnerDiagnostic {
  return {
    code: "GO_CLEANUP_FAILED",
    severity: "warning",
    message: error instanceof Error ? error.message : String(error),
    recoveryAction: "关闭 Runner 后重试；临时目录可能需要手动清理。",
  };
}

export function appendDiagnostic(result: RunResult, extra: RunnerDiagnostic): RunResult {
  return { ...result, diagnostics: [...result.diagnostics, extra] };
}

export function createGoResult(
  request: Pick<RunRequest, "runId" | "attemptId">,
  details: ResultDetails,
): RunResult {
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

export function parseGoCompileDiagnostics(stderr: string, questId: string): readonly RunnerDiagnostic[] {
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
    : [goDiagnostic("GO_COMPILE_ERROR", stderr || "Go 编译失败。")];
}
