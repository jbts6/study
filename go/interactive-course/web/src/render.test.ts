import { describe, expect, it } from "vitest";
import { createAppShell, renderApp } from "./render";
import type { Course, CourseState, ExecuteResult } from "./model";

const course: Course = {
  id: "go-start",
  title: "Go 起步",
  lessons: [
    {
      id: "go-start-01",
      title: "第一个 Go 程序",
      goal: "认识入口",
      explanation: "解释",
      exampleCode: "package main",
      starterCode: "package main",
      exerciseGoal: "完成程序",
      hints: ["提示"],
      tests: [{ id: "TestHello", label: "输出欢迎语" }],
    },
    {
      id: "go-start-02",
      title: "变量与基础类型",
      goal: "认识变量",
      explanation: "解释",
      exampleCode: "package main",
      starterCode: "package main",
      exerciseGoal: "完成程序",
      hints: ["提示"],
      tests: [{ id: "TestProfile", label: "生成简介" }],
    },
  ],
};

const baseState: CourseState = {
  selectedLessonId: "go-start-01",
  completedLessonIds: [],
  drafts: {},
  run: { status: "idle" },
};

function result(status: ExecuteResult["status"]): CourseState {
  return {
    ...baseState,
    run: {
      status,
      result: {
        status,
        stdout: "",
        stderr: "错误",
        diagnostics: [{ line: 4, column: 2, message: "语法错误" }],
        tests: [{ name: "输出欢迎语", status: "failed", message: "期望输出" }],
      },
    },
  };
}

describe("app rendering", () => {
  it("renders the lesson shell and keeps running state actionable", () => {
    const root = document.createElement("div");
    const elements = createAppShell(root);
    renderApp(elements, course, { ...baseState, run: { status: "running" } });
    expect(root.querySelector("[data-editor]")).not.toBeNull();
    expect(root.querySelector("[data-run-state]")?.textContent).toContain("运行中");
    expect(elements.runButton.disabled).toBe(true);
  });

  it("keeps later lessons available and marks the recommended order", () => {
    const root = document.createElement("div");
    const elements = createAppShell(root);
    renderApp(elements, course, baseState);
    const laterLesson = root.querySelector<HTMLButtonElement>('[data-lesson-id="go-start-02"]');
    expect(laterLesson?.disabled).toBe(false);
    expect(laterLesson?.textContent).toContain("建议先完成上一节");
  });

  it("shows diagnostics and failed tests in the result panel", () => {
    const root = document.createElement("div");
    const elements = createAppShell(root);
    renderApp(elements, course, result("compile_error"));
    expect(root.querySelector("[data-diagnostics]")?.textContent).toContain("第 4 行");
    expect(root.querySelector("[data-test-results]")?.textContent).toContain("输出欢迎语");
  });
});
