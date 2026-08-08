export const STORAGE_KEY = 'rust-course-state-v1';

const EMPTY_STATE = Object.freeze({ currentLessonId: '', passed: [], drafts: {} });

export function createStore(storage = defaultStorage()) {
  let state = cloneState(EMPTY_STATE);
  let loaded = false;
  let status = storage ? '' : '浏览器存储不可用，当前进度仅保存在内存中';

  function load() {
    if (loaded) return cloneState(state);
    loaded = true;
    if (!storage || typeof storage.getItem !== 'function') return cloneState(state);
    try {
      const raw = storage.getItem(STORAGE_KEY);
      state = normalizeState(raw ? JSON.parse(raw) : null);
    } catch (error) {
      state = cloneState(EMPTY_STATE);
      status = `读取学习进度失败，已使用内存状态: ${error.message}`;
    }
    return cloneState(state);
  }

  function save(nextState) {
    state = normalizeState(nextState);
    if (!storage || typeof storage.setItem !== 'function') return cloneState(state);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      status = `保存学习进度失败，当前仍保留内存状态: ${error.message}`;
    }
    return cloneState(state);
  }

  function ensureLoaded() {
    if (!loaded) load();
  }

  return {
    load,
    setCurrentLesson(id) {
      ensureLoaded();
      return save({ ...state, currentLessonId: normalizeText(id) });
    },
    togglePassed(id) {
      ensureLoaded();
      const lessonId = normalizeText(id);
      const passed = new Set(state.passed);
      if (passed.has(lessonId)) passed.delete(lessonId);
      else if (lessonId) passed.add(lessonId);
      return save({ ...state, passed: [...passed] });
    },
    getDraft(id) {
      ensureLoaded();
      return state.drafts[normalizeText(id)] || '';
    },
    setDraft(id, value) {
      ensureLoaded();
      const lessonId = normalizeText(id);
      const drafts = { ...state.drafts };
      if (lessonId) drafts[lessonId] = typeof value === 'string' ? value : '';
      return save({ ...state, drafts });
    },
    getStatus() {
      return status;
    },
  };
}

export function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const passed = Array.isArray(source.passed)
    ? [...new Set(source.passed.filter((id) => typeof id === 'string' && id.trim()))]
    : [];
  const drafts = source.drafts && typeof source.drafts === 'object' && !Array.isArray(source.drafts)
    ? Object.fromEntries(
      Object.entries(source.drafts)
        .filter(([id, draft]) => typeof id === 'string' && typeof draft === 'string')
        .map(([id, draft]) => [id, draft]),
    )
    : {};
  return {
    currentLessonId: typeof source.currentLessonId === 'string' ? source.currentLessonId : '',
    passed,
    drafts,
  };
}

function cloneState(value) {
  return {
    currentLessonId: value.currentLessonId,
    passed: [...value.passed],
    drafts: { ...value.drafts },
  };
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}
