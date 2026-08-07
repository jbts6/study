import { beforeEach, describe, expect, it } from "vitest";
import { createCourseStore } from "./store";
import type { Course } from "./model";

const course: Course = {
  id: "go-start",
  title: "Go 起步",
  lessons: [
    lesson("go-start-01", "第一节"),
    lesson("go-start-02", "第二节"),
    lesson("go-start-03", "第三节"),
  ],
};

function lesson(id: string, title: string) {
  return {
    id,
    title,
    goal: "目标",
    explanation: "讲解",
    exampleCode: "package main",
    starterCode: `starter ${id}`,
    exerciseGoal: "练习",
    hints: ["提示"],
    tests: [{ id: "test", label: "测试" }],
  };
}

describe("course store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("restores drafts and progress, then unlocks the next lesson after passing", () => {
    const storage = window.localStorage;
    const first = createCourseStore(course, storage);
    expect(first.state().selectedLessonId).toBe("go-start-01");
    expect(first.isUnlocked("go-start-02")).toBe(false);

    first.setDraft("go-start-01", "edited code");
    first.markPassed("go-start-01");
    expect(first.isUnlocked("go-start-02")).toBe(true);
    expect(first.selectLesson("go-start-02")).toBe(true);

    const restored = createCourseStore(course, storage);
    expect(restored.state().selectedLessonId).toBe("go-start-02");
    expect(restored.getDraft("go-start-01")).toBe("edited code");
    expect(restored.isUnlocked("go-start-03")).toBe(false);
  });

  it("does not persist a locked selection and reset restores starter code", () => {
    const store = createCourseStore(course, window.localStorage);
    expect(store.selectLesson("go-start-02")).toBe(false);
    expect(store.getDraft("go-start-01")).toBe("starter go-start-01");
    store.setDraft("go-start-01", "changed");
    expect(store.resetLesson("go-start-01")).toBe("starter go-start-01");
    expect(store.getDraft("go-start-01")).toBe("starter go-start-01");
  });

  it("ignores corrupt persisted data", () => {
    window.localStorage.setItem("go-course-progress", "not-json");
    window.localStorage.setItem("go-course-drafts", "{bad");
    const store = createCourseStore(course, window.localStorage);
    expect(store.state().completedLessonIds).toEqual([]);
    expect(store.getDraft("go-start-01")).toBe("starter go-start-01");
  });
});
