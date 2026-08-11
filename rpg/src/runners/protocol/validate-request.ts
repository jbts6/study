import type {
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

function isSafePythonPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.includes("\\") || value.includes("\0") || value.startsWith("/") || /^[A-Za-z]:/.test(value)) return false;

  const parts = value.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === ".." || part === "__pycache__")) return false;
  if (!parts.at(-1)?.endsWith(".py")) return false;
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

export function validateRunRequest(input: unknown): RequestValidationResult {
  if (!isObject(input)) return invalid("INVALID_REQUEST", "运行请求必须是 JSON 对象");
  if (input.protocolVersion !== 1) return invalid("UNSUPPORTED_PROTOCOL_VERSION", "不支持的运行协议版本");

  for (const field of ["runId", "attemptId", "questId"] as const) {
    const value = input[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      return invalid("INVALID_IDENTIFIER", `${field} 必须是非空字符串`);
    }
  }
  if (input.language !== "python") return invalid("UNSUPPORTED_LANGUAGE", "仅支持 Python 运行请求");
  if (!validateLimits(input.limits)) return invalid("INVALID_LIMIT", "limits 必须包含正安全整数");
  const limits = input.limits;

  if (!isObject(input.files) || Object.keys(input.files).length === 0) {
    return invalid("INVALID_FILES", "files 必须是非空对象");
  }
  const files = input.files;
  if (Object.keys(files).length > limits.maxFiles) return invalid("FILE_LIMIT_EXCEEDED", "文件数量超过限制");
  let totalSourceBytes = 0;
  for (const [file, source] of Object.entries(files)) {
    if (!isSafePythonPath(file)) return invalid("INVALID_FILE_PATH", `无效的 Python 文件路径: ${file}`);
    if (typeof source !== "string") return invalid("INVALID_FILES", `文件内容必须是字符串: ${file}`);
    const sourceBytes = byteLength(source);
    if (sourceBytes > limits.maxFileBytes) return invalid("FILE_LIMIT_EXCEEDED", `单文件源码超过限制: ${file}`);
    totalSourceBytes += sourceBytes;
  }
  if (totalSourceBytes > limits.maxSourceBytes) return invalid("SOURCE_LIMIT_EXCEEDED", "源码总字节数超过限制");

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

  if (!isObject(input.worldView)) return invalid("INVALID_WORLD_VIEW", "worldView 必须是 JSON 对象");
  return { ok: true, value: input as unknown as RunRequest };
}
