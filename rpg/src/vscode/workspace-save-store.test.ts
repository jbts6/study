import { describe, expect, it } from "vitest";
import { getLevel } from "../game/content/levels";
import { WorkspaceSaveStore, WORKSPACE_SAVE_KEY } from "./workspace-save-store";

class MemoryWorkspaceState {
  value: unknown;

  get<T>(key: string): T | undefined {
    return key === WORKSPACE_SAVE_KEY ? this.value as T | undefined : undefined;
  }

  update(key: string, value: unknown): void {
    if (key === WORKSPACE_SAVE_KEY) this.value = value;
  }
}

describe("WorkspaceSaveStore", () => {
  it("round-trips battle state without storing Python code", async () => {
    const state = new MemoryWorkspaceState();
    const store = new WorkspaceSaveStore(state);
    const save = {
      version: 2 as const,
      currentLevelId: "python-marsh-02" as const,
      battleState: getLevel("python-marsh-02").initialBattle,
    };

    await store.save({ ...save, codeDraft: "must stay in the Python file" });

    expect(state.value).toEqual(save);
    expect(store.load()).toEqual({ ok: true, save: { ...save, codeDraft: "" } });
  });

  it("reports malformed workspace state without replacing it", () => {
    const state = new MemoryWorkspaceState();
    state.value = { version: 2, currentLevelId: "python-marsh-01", battleState: { broken: true } };
    const store = new WorkspaceSaveStore(state);

    expect(store.load()).toEqual({
      ok: false,
      message: "本地存档无法读取。请输入“重置存档”后重新开始。",
    });
    expect(state.value).toEqual({
      version: 2,
      currentLevelId: "python-marsh-01",
      battleState: { broken: true },
    });
  });

  it("removes the workspace save", async () => {
    const state = new MemoryWorkspaceState();
    const store = new WorkspaceSaveStore(state);
    await store.save({
      version: 2,
      currentLevelId: "python-marsh-01",
      battleState: getLevel("python-marsh-01").initialBattle,
    });

    await store.remove();

    expect(state.value).toBeUndefined();
  });
});
