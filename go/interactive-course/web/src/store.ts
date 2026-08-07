import type { Course, CourseState, RunState } from "./model";

export const PROGRESS_STORAGE_KEY = "go-course-progress";
export const DRAFT_STORAGE_KEY = "go-course-drafts";

interface PersistedProgress {
  selectedLessonId?: string;
  completedLessonIds?: string[];
}

type Listener = (state: CourseState) => void;

export interface CourseStore {
  state(): CourseState;
  getDraft(lessonId: string): string;
  setDraft(lessonId: string, code: string): void;
  resetLesson(lessonId: string): string;
  isUnlocked(lessonId: string): boolean;
  selectLesson(lessonId: string): boolean;
  markPassed(lessonId: string): void;
  setRun(run: RunState): void;
  subscribe(listener: Listener): () => void;
}

export function createCourseStore(course: Course, storage: Storage): CourseStore {
  const lessonIds = new Set(course.lessons.map((lesson) => lesson.id));
  const persistedProgress = readJSON<PersistedProgress>(storage, PROGRESS_STORAGE_KEY) ?? {};
  const persistedDrafts = readJSON<Record<string, unknown>>(storage, DRAFT_STORAGE_KEY) ?? {};
  const completedLessonIds = Array.isArray(persistedProgress.completedLessonIds)
    ? persistedProgress.completedLessonIds.filter((id): id is string => typeof id === "string" && lessonIds.has(id))
    : [];
  const drafts: Record<string, string> = {};
  for (const [lessonId, code] of Object.entries(persistedDrafts)) {
    if (lessonIds.has(lessonId) && typeof code === "string") {
      drafts[lessonId] = code;
    }
  }

  const initialSelection = persistedProgress.selectedLessonId && lessonIds.has(persistedProgress.selectedLessonId)
    ? persistedProgress.selectedLessonId
    : course.lessons[0]?.id ?? "";
  let current: CourseState = {
    selectedLessonId: initialSelection,
    completedLessonIds,
    drafts,
    run: { status: "idle" },
  };
  if (!isUnlocked(current.selectedLessonId, course, current.completedLessonIds)) {
    current.selectedLessonId = course.lessons[0]?.id ?? "";
  }

  const listeners = new Set<Listener>();
  const emit = (): void => {
    persist(storage, current);
    const snapshot = cloneState(current);
    listeners.forEach((listener) => listener(snapshot));
  };

  return {
    state: () => cloneState(current),
    getDraft: (lessonId) => drafts[lessonId] ?? course.lessons.find((lesson) => lesson.id === lessonId)?.starterCode ?? "",
    setDraft: (lessonId, code) => {
      if (!lessonIds.has(lessonId)) return;
      drafts[lessonId] = code;
      persist(storage, current);
    },
    resetLesson: (lessonId) => {
      delete drafts[lessonId];
      current = { ...current, run: { status: "idle" } };
      emit();
      return course.lessons.find((lesson) => lesson.id === lessonId)?.starterCode ?? "";
    },
    isUnlocked: (lessonId) => isUnlocked(lessonId, course, current.completedLessonIds),
    selectLesson: (lessonId) => {
      if (!lessonIds.has(lessonId) || !isUnlocked(lessonId, course, current.completedLessonIds)) return false;
      current = { ...current, selectedLessonId: lessonId, run: { status: "idle" } };
      emit();
      return true;
    },
    markPassed: (lessonId) => {
      if (!lessonIds.has(lessonId) || current.completedLessonIds.includes(lessonId)) return;
      current = { ...current, completedLessonIds: [...current.completedLessonIds, lessonId] };
      emit();
    },
    setRun: (run) => {
      current = { ...current, run };
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function isUnlocked(lessonId: string, course: Course, completedLessonIds: string[]): boolean {
  const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
  return index === 0 || (index > 0 && completedLessonIds.includes(course.lessons[index - 1].id));
}

function persist(storage: Storage, state: CourseState): void {
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      selectedLessonId: state.selectedLessonId,
      completedLessonIds: state.completedLessonIds,
    } satisfies PersistedProgress));
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state.drafts));
  } catch {
    // Storage can be disabled in private browsing; the in-memory state remains usable.
  }
}

function readJSON<T>(storage: Storage, key: string): T | undefined {
  try {
    const value = storage.getItem(key);
    return value ? (JSON.parse(value) as T) : undefined;
  } catch {
    return undefined;
  }
}

function cloneState(state: CourseState): CourseState {
  return {
    ...state,
    completedLessonIds: [...state.completedLessonIds],
    drafts: { ...state.drafts },
  };
}
