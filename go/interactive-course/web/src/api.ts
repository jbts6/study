import type { Course, ExecuteResult, ExecutionStatus } from "./model";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const executionStatuses = new Set<ExecutionStatus>([
  "passed",
  "compile_error",
  "test_failed",
  "timeout",
  "runner_unavailable",
  "invalid_request",
]);

export class ApiError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "ApiError";
    this.httpStatus = httpStatus;
  }
}

export async function fetchCourse(fetcher: Fetcher = fetch): Promise<Course> {
  const response = await fetcher("/api/course");
  const payload = await readJSON(response);
  if (!response.ok) {
    throw new ApiError(messageFromPayload(payload, "课程服务暂时不可用"), response.status);
  }
  if (!isCourse(payload)) {
    throw new ApiError("课程数据格式无效", response.status);
  }
  return payload;
}

export async function executeLesson(
  request: { lessonId: string; code: string },
  fetcher: Fetcher = fetch,
): Promise<ExecuteResult> {
  let response: Response;
  try {
    response = await fetcher("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    return unavailableResult("无法连接执行服务，请确认后端正在运行。", "runner_unavailable");
  }

  const payload = await readJSON(response);
  if (!isExecuteResult(payload)) {
    throw new ApiError(messageFromPayload(payload, "执行服务返回了无效结果"), response.status);
  }
  return payload;
}

async function readJSON(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function isCourse(value: unknown): value is Course {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" || !Array.isArray(value.lessons)) {
    return false;
  }
  return value.lessons.every((lesson) => isRecord(lesson) && typeof lesson.id === "string" && typeof lesson.title === "string");
}

function isExecuteResult(value: unknown): value is ExecuteResult {
  if (!isRecord(value) || typeof value.status !== "string" || !executionStatuses.has(value.status as ExecutionStatus)) {
    return false;
  }
  return typeof value.stdout === "string" && typeof value.stderr === "string" && Array.isArray(value.diagnostics) && Array.isArray(value.tests);
}

function unavailableResult(message: string, status: ExecutionStatus): ExecuteResult {
  return { status, stdout: "", stderr: message, diagnostics: [], tests: [] };
}

function messageFromPayload(payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload.stderr === "string" && payload.stderr.trim() !== "") {
    return payload.stderr;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
