import "./styles.css";

import { ApiError, executeLesson, fetchCourse } from "./api";
import { createCodeEditor, type CodeEditor } from "./editor";
import { createAppShell, renderApp, renderFatalError, renderLoading } from "./render";
import type { ExecuteResult } from "./model";
import { createCourseStore } from "./store";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("页面缺少应用容器");

void boot(root);

async function boot(appRoot: HTMLElement): Promise<void> {
  renderLoading(appRoot);
  try {
    const course = await fetchCourse();
    const store = createCourseStore(course, getStorage());
    const elements = createAppShell(appRoot);
    let currentLessonId = store.state().selectedLessonId;
    let editor: CodeEditor;

    const render = (): void => renderApp(elements, course, store.state());
    const selectedLesson = (): NonNullable<typeof course.lessons[number]> => {
      return course.lessons.find((lesson) => lesson.id === currentLessonId) ?? course.lessons[0];
    };

    render();
    editor = createCodeEditor(elements.editorHost, store.getDraft(currentLessonId), (code) => {
      store.setDraft(currentLessonId, code);
    });
    store.subscribe(render);

    elements.lessonNav.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-lesson-id]");
      if (!target?.dataset.lessonId || target.disabled) return;
      if (!store.selectLesson(target.dataset.lessonId)) return;
      currentLessonId = target.dataset.lessonId;
      editor.setCode(store.getDraft(currentLessonId));
      editor.focus();
    });

    elements.resetButton.addEventListener("click", () => {
      editor.setCode(store.resetLesson(currentLessonId));
      editor.focus();
    });

    elements.runButton.addEventListener("click", async () => {
      const lesson = selectedLesson();
      if (!lesson || store.state().run.status === "running") return;
      const code = editor.getCode();
      store.setDraft(lesson.id, code);
      store.setRun({ status: "running" });
      let result: ExecuteResult;
      try {
        result = await executeLesson({ lessonId: lesson.id, code });
      } catch (error) {
        result = unavailableResult(error instanceof ApiError ? error.message : "执行服务暂时不可用");
      }
      store.setRun({ status: result.status, result });
      if (result.status === "passed") store.markPassed(lesson.id);
    });

    window.addEventListener("beforeunload", () => editor.destroy(), { once: true });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "请确认 Go 服务端正在运行。";
    renderFatalError(appRoot, message);
  }
}

function unavailableResult(message: string): ExecuteResult {
  return { status: "runner_unavailable", stdout: "", stderr: message, diagnostics: [], tests: [] };
}

function getStorage(): Storage {
  try {
    const storage = window.localStorage;
    const probe = "__go_course_storage_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return new MemoryStorage();
  }
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}
