const STORAGE_KEY = 'python-course.progress.v1';
const EMPTY_STATE = Object.freeze({
  currentLessonId: '',
  drafts: {},
  practiced: [],
  mastered: [],
});

export function createStore(storage = globalThis.localStorage) {
  return {
    load() {
      try {
        const value = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
        return normalize(value);
      } catch {
        return clone(EMPTY_STATE);
      }
    },
    save(value) {
      const next = normalize(value);
      storage?.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    },
  };
}

function normalize(value) {
  if (!value || typeof value !== 'object') return clone(EMPTY_STATE);
  return {
    currentLessonId:
      typeof value.currentLessonId === 'string'
        ? value.currentLessonId
        : '',
    drafts:
      value.drafts && typeof value.drafts === 'object'
        ? { ...value.drafts }
        : {},
    practiced: uniqueStrings(value.practiced),
    mastered: uniqueStrings(value.mastered),
  };
}

function uniqueStrings(value) {
  return [
    ...new Set(
      Array.isArray(value)
        ? value.filter((item) => typeof item === 'string' && item)
        : [],
    ),
  ];
}

function clone(value) {
  return {
    currentLessonId: value.currentLessonId,
    drafts: { ...value.drafts },
    practiced: [...value.practiced],
    mastered: [...value.mastered],
  };
}
