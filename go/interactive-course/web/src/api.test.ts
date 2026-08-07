import { describe, expect, it, vi } from "vitest";
import { ApiError, executeLesson, fetchCourse } from "./api";
import type { Course } from "./model";

const course: Course = {
  id: "go-start",
  title: "Go 起步",
  lessons: [],
};

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("course api", () => {
  it("loads the public course", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(course));
    await expect(fetchCourse(fetcher)).resolves.toEqual(course);
    expect(fetcher).toHaveBeenCalledWith("/api/course");
  });

  it("returns structured execution results even for non-2xx statuses", async () => {
    const result = {
      status: "runner_unavailable",
      stdout: "",
      stderr: "执行服务不可用",
      diagnostics: [],
      tests: [],
    } as const;
    const fetcher = vi.fn().mockResolvedValue(response(result, { status: 503 }));
    await expect(executeLesson({ lessonId: "go-start-01", code: "package main" }, fetcher)).resolves.toEqual(result);
  });

  it("raises an api error when a response is not structured", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("offline", { status: 503 }));
    await expect(fetchCourse(fetcher)).rejects.toBeInstanceOf(ApiError);
  });
});
