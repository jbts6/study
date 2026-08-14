import type { TurnCommand, WorldView } from "../../game/combat/types";

export const PROTOCOL_VERSION = 1 as const;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type ExecutionStatus = "completed" | "syntax_error" | "compile_error" | "runtime_error" | "timeout" | "interrupted" | "invalid_request" | "runner_error";
export type RunnerState = "loading" | "ready" | "running" | "interrupting" | "unavailable";
export type DiagnosticSeverity = "error" | "warning" | "info";

export interface ExecutionLimits {
  readonly timeoutMs: number;
  readonly interruptGraceMs: number;
  readonly maxFiles: number;
  readonly maxFileBytes: number;
  readonly maxSourceBytes: number;
  readonly maxOutputBytes: number;
  readonly maxTraceEvents: number;
  readonly maxValueDepth: number;
}

export type PythonEntrypoint = Readonly<{
  readonly file: string;
  readonly callable: string;
}>;

export type CompiledEntrypoint = Readonly<{
  readonly file: string;
}>;

export type Entrypoint = PythonEntrypoint | CompiledEntrypoint;

export type BaseRunRequest = Readonly<{
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly runId: string;
  readonly attemptId: string;
  readonly questId: string;
  readonly files: Readonly<Record<string, string>>;
  readonly worldView: WorldView;
  readonly limits: ExecutionLimits;
}>;

export type PythonRunRequest = BaseRunRequest & Readonly<{
  readonly language: "python";
  readonly entrypoint: PythonEntrypoint;
  readonly allowedModules: readonly string[];
}>;

export type CompiledRunRequest = BaseRunRequest & Readonly<{
  readonly language: "go" | "rust";
  readonly entrypoint: CompiledEntrypoint;
  readonly limits: ExecutionLimits & Readonly<{
    readonly buildTimeoutMs: number;
    readonly executionTimeoutMs: number;
  }>;
}>;

export type RunRequest = PythonRunRequest | CompiledRunRequest;

export interface SourceLocation {
  readonly file: string;
  readonly line: number;
  readonly column?: number;
}

export interface RunnerDiagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly location?: SourceLocation;
  readonly traceSeq?: number;
  readonly recoveryAction: string;
}

export interface TraceEvent {
  readonly seq: number;
  readonly file: string;
  readonly line: number;
  readonly event: "call" | "line" | "return" | "exception";
  readonly function: string;
  readonly depth: number;
  readonly locals: Readonly<Record<string, JsonValue>>;
}

export interface OutputStreams {
  readonly stdout: string;
  readonly stderr: string;
  readonly truncated: boolean;
}

export interface RunnerMetrics {
  readonly durationMs: number;
  readonly traceEvents: number;
}

export interface RunResult {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly runId: string;
  readonly attemptId: string;
  readonly executionStatus: ExecutionStatus;
  readonly returnValue?: JsonValue;
  readonly returnValueTraceSeq?: number;
  readonly trace: readonly TraceEvent[];
  readonly diagnostics: readonly RunnerDiagnostic[];
  readonly streams: OutputStreams;
  readonly metrics: RunnerMetrics;
}

export interface RequestValidationSuccess {
  readonly ok: true;
  readonly value: RunRequest;
}

export interface RequestValidationFailure {
  readonly ok: false;
  readonly diagnostics: readonly RunnerDiagnostic[];
}

export type RequestValidationResult = RequestValidationSuccess | RequestValidationFailure;
export type ReturnedTurnIntent = JsonValue;
export type ParsedTurnCommand = TurnCommand;
