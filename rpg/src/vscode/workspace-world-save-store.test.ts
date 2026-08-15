import { describe, expect, it } from "vitest";
import { getLevel } from "../game/content/levels";
import { PYTHON_WORLD_CONTENT, createPythonWorldInitialState } from "../game/content/python/world-chapter-01";
import { WORKSPACE_WORLD_SAVE_KEY, WorkspaceWorldSaveStore } from "./workspace-world-save-store";

class MemoryWorkspaceState {
  readonly values = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  update(key: string, value: unknown): void {
    if (value === undefined) this.values.delete(key);
    else this.values.set(key, value);
  }
}

describe("WorkspaceWorldSaveStore", () => {
  it("persists only V3 world state and never stores Python code", async () => {
    const state = new MemoryWorkspaceState();
    const store = new WorkspaceWorldSaveStore(state, PYTHON_WORLD_CONTENT);
    const gameState = createPythonWorldInitialState();

    await store.save({
      version: 3,
      gameState,
      codeDrafts: { "python-marsh-01": "must stay in the Python file" },
    });

    expect(state.values.get(WORKSPACE_WORLD_SAVE_KEY)).toEqual({ version: 3, gameState });
    expect(store.load()).toEqual({ ok: true, save: { version: 3, gameState, codeDrafts: {} } });
  });

  it("reports a workspace V2 save as recoverable without exposing a code draft", () => {
    const state = new MemoryWorkspaceState();
    state.values.set(WORKSPACE_WORLD_SAVE_KEY, {
      version: 2,
      currentLevelId: "python-marsh-01",
      battleState: getLevel("python-marsh-01").initialBattle,
    });

    expect(new WorkspaceWorldSaveStore(state, PYTHON_WORLD_CONTENT).load()).toEqual({
      ok: false,
      reason: "legacy_v2",
      message: "检测到旧版战斗存档。导出旧代码后开始新的世界战役。",
      legacyLevelId: "python-marsh-01",
    });
  });

  it("reports malformed workspace state without replacing it", () => {
    const state = new MemoryWorkspaceState();
    const malformed = { version: 3, gameState: { broken: true } };
    state.values.set(WORKSPACE_WORLD_SAVE_KEY, malformed);

    expect(new WorkspaceWorldSaveStore(state, PYTHON_WORLD_CONTENT).load()).toEqual({
      ok: false,
      reason: "corrupt",
      message: "本地存档无法读取。请输入“重置存档”后重新开始。",
    });
    expect(state.values.get(WORKSPACE_WORLD_SAVE_KEY)).toEqual(malformed);
  });

  it("removes the workspace world save", async () => {
    const state = new MemoryWorkspaceState();
    const store = new WorkspaceWorldSaveStore(state, PYTHON_WORLD_CONTENT);
    await store.save({ version: 3, gameState: createPythonWorldInitialState(), codeDrafts: {} });

    await store.remove();

    expect(state.values.get(WORKSPACE_WORLD_SAVE_KEY)).toBeUndefined();
  });
});
