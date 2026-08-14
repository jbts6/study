import type {
  CompiledRunRequest,
  ExecutionLimits,
  RequestValidationFailure,
  RequestValidationResult,
  RunnerDiagnostic,
  RunRequest,
} from "./types";

const RECOVERY_ACTION = "修正运行请求后重新运行";
const LIMIT_FIELDS = [
  "timeoutMs",
  "interruptGraceMs",
  "maxFiles",
  "maxFileBytes",
  "maxSourceBytes",
  "maxOutputBytes",
  "maxTraceEvents",
  "maxValueDepth",
] as const;
const COMPILED_LIMIT_FIELDS = ["buildTimeoutMs", "executionTimeoutMs"] as const;
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_ALLOWED_MODULES = new Set(["math"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalid(code: string, message: string): RequestValidationFailure {
  const diagnostic: RunnerDiagnostic = {
    code,
    severity: "error",
    message,
    recoveryAction: RECOVERY_ACTION,
  };
  return { ok: false, diagnostics: [diagnostic] };
}

function isSafeSourcePath(value: unknown, extension: ".py" | ".go" | ".rs"): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.includes("\\") || value.includes("\0") || value.startsWith("/") || /^[A-Za-z]:/.test(value)) return false;

  const parts = value.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === ".." || part === "__pycache__")) return false;
  if (!parts.at(-1)?.endsWith(extension)) return false;
  return parts.every((part) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part));
}

function byteLength(source: string): number {
  return new TextEncoder().encode(source).byteLength;
}

function validateLimits(value: unknown): value is ExecutionLimits {
  return isObject(value) && LIMIT_FIELDS.every(
    (key) => Number.isSafeInteger(value[key]) && (value[key] as number) > 0,
  );
}

function validateCompiledLimits(value: unknown): value is CompiledRunRequest["limits"] {
  if (!validateLimits(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  return COMPILED_LIMIT_FIELDS.every(
    (key) => Number.isSafeInteger(record[key]) && (record[key] as number) > 0,
  );
}

function validateFiles(
  input: Record<string, unknown>,
  limits: ExecutionLimits,
  extension: ".py" | ".go" | ".rs",
  languageLabel: string,
): RequestValidationFailure | undefined {
  if (!isObject(input.files) || Object.keys(input.files).length === 0) {
    return invalid("INVALID_FILES", "files 必须是非空对象");
  }
  const files = input.files;
  if (Object.keys(files).length > limits.maxFiles) return invalid("FILE_LIMIT_EXCEEDED", "文件数量超过限制");
  let totalSourceBytes = 0;
  for (const [file, source] of Object.entries(files)) {
    if (!isSafeSourcePath(file, extension)) return invalid("INVALID_FILE_PATH", `无效的 ${languageLabel} 文件路径: ${file}`);
    if (typeof source !== "string") return invalid("INVALID_FILES", `文件内容必须是字符串: ${file}`);
    const sourceBytes = byteLength(source);
    if (sourceBytes > limits.maxFileBytes) return invalid("FILE_LIMIT_EXCEEDED", `单文件源码超过限制: ${file}`);
    totalSourceBytes += sourceBytes;
  }
  if (totalSourceBytes > limits.maxSourceBytes) return invalid("SOURCE_LIMIT_EXCEEDED", "源码总字节数超过限制");
  return undefined;
}

function validateWorldView(input: Record<string, unknown>): RequestValidationFailure | undefined {
  return isObject(input.worldView) ? undefined : invalid("INVALID_WORLD_VIEW", "worldView 必须是 JSON 对象");
}

function validatePythonRequest(input: Record<string, unknown>): RequestValidationResult {
  const files = input.files as Record<string, unknown>;
  if (!isObject(input.entrypoint)) return invalid("INVALID_ENTRYPOINT", "entrypoint 必须是对象");
  const entrypoint = input.entrypoint;
  if (typeof entrypoint.file !== "string" || typeof entrypoint.callable !== "string") {
    return invalid("INVALID_ENTRYPOINT", "entrypoint 必须包含文件和 callable");
  }
  if (!Object.hasOwn(files, entrypoint.file)) return invalid("ENTRYPOINT_FILE_MISSING", "入口文件不存在");
  if (!SAFE_IDENTIFIER.test(entrypoint.callable)) return invalid("INVALID_IDENTIFIER", "入口 callable 不是 Python 标识符");

  if (!Array.isArray(input.allowedModules)) return invalid("INVALID_ALLOWED_MODULE", "allowedModules 必须是字符串数组");
  for (const module of input.allowedModules) {
    if (typeof module !== "string" || !SAFE_IDENTIFIER.test(module)) {
      return invalid("INVALID_ALLOWED_MODULE", "allowedModules 必须是不带点的 Python 标识符");
    }
    if (!SAFE_ALLOWED_MODULES.has(module)) {
      return invalid("UNSUPPORTED_ALLOWED_MODULE", `allowedModules 仅支持: ${[...SAFE_ALLOWED_MODULES].join(", ")}`);
    }
  }
  return { ok: true, value: input as unknown as RunRequest };
}

function validateCompiledRequest(
  input: Record<string, unknown>,
  language: "go" | "rust",
): RequestValidationResult {
  const files = input.files as Record<string, unknown>;
  const languageLabel = language === "go" ? "Go" : "Rust";
  const invalidCode = language === "go" ? "INVALID_GO_REQUEST" : "INVALID_COMPILED_REQUEST";
  if (Object.hasOwn(input, "allowedModules")) {
    return invalid(invalidCode, `${languageLabel} 请求不支持 Python 模块白名单`);
  }
  if (!isObject(input.entrypoint)) return invalid("INVALID_ENTRYPOINT", "entrypoint 必须是对象");
  const entrypoint = input.entrypoint;
  if (typeof entrypoint.file !== "string" || Object.hasOwn(entrypoint, "callable")) {
    return invalid(invalidCode, `${languageLabel} 入口只包含文件名`);
  }
  if (!Object.hasOwn(files, entrypoint.file)) return invalid("ENTRYPOINT_FILE_MISSING", "入口文件不存在");
  if (!validateCompiledLimits(input.limits)) return invalid("INVALID_LIMIT", "编译请求 limits 必须包含构建和执行超时");
  return { ok: true, value: input as unknown as RunRequest };
}

export function validateRunRequest(input: unknown): RequestValidationResult {
  if (!isObject(input)) return invalid("INVALID_REQUEST", "运行请求必须是 JSON 对象");
  if (input.protocolVersion !== 1) return invalid("UNSUPPORTED_PROTOCOL_VERSION", "不支持的运行协议版本");

  for (const field of ["runId", "attemptId", "questId"] as const) {
    const value = input[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      return invalid("INVALID_IDENTIFIER", `${field} 必须是非空字符串`);
    }
  }
  if (input.language !== "python" && input.language !== "go" && input.language !== "rust") {
    return invalid("UNSUPPORTED_LANGUAGE", "仅支持 Python、Go 或 Rust 运行请求");
  }
  const language = input.language;
  if (!validateLimits(input.limits)) return invalid("INVALID_LIMIT", "limits 必须包含正安全整数");
  const limits = input.limits;

  const extension = language === "python" ? ".py" : language === "go" ? ".go" : ".rs";
  const languageLabel = language === "python" ? "Python" : language === "go" ? "Go" : "Rust";
  const filesFailure = validateFiles(input, limits, extension, languageLabel);
  if (filesFailure !== undefined) return filesFailure;
  const worldViewFailure = validateWorldView(input);
  if (worldViewFailure !== undefined) return worldViewFailure;
  return language === "python" ? validatePythonRequest(input) : validateCompiledRequest(input, language);
}
