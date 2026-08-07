(function attachCourseStore(global) {
  'use strict';

  const STORAGE_KEY = 'py-course-progress-v2';
  const MIN_DAY = 1;
  const MAX_DAY = 30;

  function emptyState() {
    return { currentDay: MIN_DAY, completed: [], drafts: {} };
  }

  function cloneState(state) {
    return {
      currentDay: state.currentDay,
      completed: [...state.completed],
      drafts: { ...state.drafts }
    };
  }

  function normalizeDay(value) {
    const day = Number(value);
    if (!Number.isFinite(day)) return MIN_DAY;
    return Math.min(MAX_DAY, Math.max(MIN_DAY, Math.trunc(day)));
  }

  function normalizeCompleted(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= MIN_DAY && day <= MAX_DAY))]
      .sort((left, right) => left - right);
  }

  function normalizeDrafts(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, draft]) => typeof key === 'string' && typeof draft === 'string')
    );
  }

  function normalizeState(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      currentDay: normalizeDay(source.currentDay),
      completed: normalizeCompleted(source.completed),
      drafts: normalizeDrafts(source.drafts)
    };
  }

  function getDefaultStorage() {
    try {
      return global.localStorage;
    } catch {
      return null;
    }
  }

  /**
   * Creates a tolerant progress store. Storage failures become status messages,
   * so reading the course remains possible when browser storage is unavailable.
   */
  function createStore(storage = getDefaultStorage()) {
    let state = emptyState();
    let loaded = false;
    let status = '';

    function setStatus(message) {
      status = message;
    }

    function load() {
      loaded = true;
      state = emptyState();
      if (!storage || typeof storage.getItem !== 'function') {
        setStatus('浏览器未提供可用的本地存储，进度仍可使用但不会持久化。');
        return cloneState(state);
      }
      try {
        const raw = storage.getItem(STORAGE_KEY);
        state = normalizeState(raw ? JSON.parse(raw) : null);
        setStatus('');
      } catch {
        state = emptyState();
        setStatus('本地进度数据无法读取，已恢复为空进度。');
      }
      return cloneState(state);
    }

    function ensureLoaded() {
      if (!loaded) load();
    }

    function save(nextState) {
      state = normalizeState(nextState);
      loaded = true;
      if (!storage || typeof storage.setItem !== 'function') {
        setStatus('浏览器未提供可用的本地存储，进度仍可使用但不会持久化。');
        return cloneState(state);
      }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        setStatus('');
      } catch {
        setStatus('本地进度无法保存，当前页面仍可继续使用。');
      }
      return cloneState(state);
    }

    function toggleComplete(day) {
      ensureLoaded();
      const normalizedDay = normalizeDay(day);
      const completed = new Set(state.completed);
      if (completed.has(normalizedDay)) completed.delete(normalizedDay);
      else completed.add(normalizedDay);
      return save({ ...state, completed: [...completed] });
    }

    function setCurrentDay(day) {
      ensureLoaded();
      return save({ ...state, currentDay: normalizeDay(day) });
    }

    function getDraft(key) {
      ensureLoaded();
      return state.drafts[String(key)] ?? null;
    }

    function setDraft(key, value) {
      ensureLoaded();
      const drafts = { ...state.drafts };
      if (value == null) delete drafts[String(key)];
      else drafts[String(key)] = String(value);
      return save({ ...state, drafts });
    }

    return {
      load,
      save,
      toggleComplete,
      setCurrentDay,
      getDraft,
      setDraft,
      getStatus: () => status
    };
  }

  global.createStore = createStore;
  global.PythonCourseStore = { createStore, STORAGE_KEY };
})(window);
