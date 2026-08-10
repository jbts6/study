import type {
  ExecutionLimits,
  RequestValidationFailure,
  RequestValidationResult,
  RunnerDiagnostic,
  RunRequest,
} from "./types";

const RECOVERY_ACTION = "修正运行请求后重新运行";
const REQUEST_FIELDS = new Set([
  "protocolVersion",
  "runId",
  "attemptId",
  "questId",
  "language",
  "files",
  "entrypoint",
  "worldView",
  "allowedModules",
  "limits",
]);
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

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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
  if (!isPlainObject(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== LIMIT_FIELDS.length ||
    keys.some(
      (key) =>
        typeof key !== "string" ||
        !LIMIT_FIELDS.includes(key as (typeof LIMIT_FIELDS)[number]),
    )
  ) {
    return false;
  }
  return LIMIT_FIELDS.every((key) => hasOwn(value, key) && Number.isSafeInteger(value[key]) && (value[key] as number) > 0);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;

  const objectValue = value as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  Object.freeze(objectValue);
  for (const nestedValue of Object.values(objectValue as Record<string, unknown>)) {
    deepFreeze(nestedValue, seen);
  }
  return value;
}

function isJsonData(value: unknown, path = new WeakSet<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (path.has(value)) return false;
  path.add(value);

  let valid = false;
  if (Array.isArray(value)) {
    valid = value.every((nestedValue) => isJsonData(nestedValue, path));
  } else if (isPlainObject(value)) {
    valid = Object.values(value).every((nestedValue) => isJsonData(nestedValue, path));
  }
  path.delete(value);
  return valid;
}

export function validateRunRequest(input: unknown): RequestValidationResult {
  try {
    if (!isPlainObject(input)) return invalid("INVALID_REQUEST", "运行请求必须是普通对象");
    const rawUnknownField = Reflect.ownKeys(input).find(
      (key) => typeof key !== "string" || !REQUEST_FIELDS.has(key),
    );
    if (input.protocolVersion !== 1) return invalid("UNSUPPORTED_PROTOCOL_VERSION", "不支持的运行协议版本");
    if (rawUnknownField !== undefined) {
      return invalid("UNKNOWN_REQUEST_FIELD", `未知运行请求字段: ${String(rawUnknownField)}`);
    }
    const snapshot = structuredClone(input) as unknown;
    if (!isPlainObject(snapshot)) return invalid("INVALID_REQUEST", "运行请求必须是普通对象");
    if (snapshot.protocolVersion !== 1) return invalid("UNSUPPORTED_PROTOCOL_VERSION", "不支持的运行协议版本");

    const unknownField = Object.keys(snapshot).find((key) => !REQUEST_FIELDS.has(key));
    if (unknownField !== undefined) return invalid("UNKNOWN_REQUEST_FIELD", `未知运行请求字段: ${String(unknownField)}`);

    for (const field of ["runId", "attemptId", "questId"] as const) {
      const value = snapshot[field];
      if (typeof value !== "string" || value.trim().length === 0) return invalid("INVALID_IDENTIFIER", `${field} 必须是非空字符串`);
    }
    if (snapshot.language !== "python") return invalid("UNSUPPORTED_LANGUAGE", "仅支持 Python 运行请求");

    if (!validateLimits(snapshot.limits)) return invalid("INVALID_LIMIT", "limits 必须包含八个正安全整数");
    const limits = snapshot.limits;

    if (!isPlainObject(snapshot.files) || Object.keys(snapshot.files).length === 0) return invalid("INVALID_FILES", "files 必须是非空对象");
    const files = snapshot.files;
    if (Object.keys(files).length > limits.maxFiles) return invalid("FILE_LIMIT_EXCEEDED", "文件数量超过限制");
    let totalSourceBytes = 0;
    for (const [file, source] of Object.entries(files)) {
      if (!isSafePythonPath(file)) return invalid("INVALID_FILE_PATH", `不安全的 Python 文件路径: ${file}`);
      if (typeof source !== "string") return invalid("INVALID_FILES", `文件内容必须是字符串: ${file}`);
      const sourceBytes = byteLength(source);
      if (sourceBytes > limits.maxFileBytes) return invalid("FILE_LIMIT_EXCEEDED", `单文件源码超过限制: ${file}`);
      totalSourceBytes += sourceBytes;
    }
    if (totalSourceBytes > limits.maxSourceBytes) return invalid("SOURCE_LIMIT_EXCEEDED", "源码总字节数超过限制");
    if (!isPlainObject(snapshot.entrypoint)) return invalid("INVALID_ENTRYPOINT", "entrypoint 必须是对象");
    const entrypoint = snapshot.entrypoint;
    if (typeof entrypoint.file !== "string" || typeof entrypoint.callable !== "string") return invalid("INVALID_ENTRYPOINT", "entrypoint 必须包含文件和 callable");
    if (!hasOwn(files, entrypoint.file)) return invalid("ENTRYPOINT_FILE_MISSING", "入口文件不存在");
    if (!SAFE_IDENTIFIER.test(entrypoint.callable)) return invalid("INVALID_IDENTIFIER", "入口 callable 不是 Python 标识符");

    if (!Array.isArray(snapshot.allowedModules)) return invalid("INVALID_ALLOWED_MODULE", "allowedModules 必须是字符串数组");
    const modules = new Set<string>();
    for (const module of snapshot.allowedModules) {
      if (typeof module !== "string" || !SAFE_IDENTIFIER.test(module)) return invalid("INVALID_ALLOWED_MODULE", "allowedModules 必须是不带点的 Python 标识符");
      if (modules.has(module)) return invalid("DUPLICATE_ALLOWED_MODULE", `allowedModules 重复: ${module}`);
      modules.add(module);
    }

    if (!isPlainObject(snapshot.worldView) || !isJsonData(snapshot.worldView)) {
      return invalid("INVALID_WORLD_VIEW", "worldView 必须是 JSON 数据对象");
    }

    return { ok: true, value: deepFreeze(snapshot as unknown as RunRequest) };
  } catch {
    return invalid("INVALID_REQUEST", "运行请求无法读取");
  }
}
