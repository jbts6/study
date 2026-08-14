import { describe, expect, it } from "vitest";
import { getLevel } from "../game/content/levels";
import { WorkspaceSaveStore, workspaceSaveKey } from "./workspace-save-store";

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

describe("WorkspaceSaveStore", () => {
  it("round-trips battle state without storing Python code", async () => {
    const state = new MemoryWorkspaceState();
    const store = new WorkspaceSaveStore(state, "python-rpg");
    const save = {
      version: 2 as const,
      currentLevelId: "python-marsh-02" as const,
      battleState: getLevel("python-marsh-02").initialBattle,
    };

    await store.save({ ...save, codeDraft: "must stay in the Python file" });

    expect(state.values.get(workspaceSaveKey("python-rpg"))).toEqual(save);
    expect(store.load()).toEqual({ ok: true, save: { ...save, codeDraft: "" } });
  });

  it("reports malformed workspace state without replacing it", () => {
    const state = new MemoryWorkspaceState();
    const malformed = { version: 2, currentLevelId: "python-marsh-01", battleState: { broken: true } };
    state.values.set(workspaceSaveKey("python-rpg"), malformed);
    const store = new WorkspaceSaveStore(state, "python-rpg");

    expect(store.load()).toEqual({
      ok: false,
      message: "本地存档无法读取。请输入“重置存档”后重新开始。",
    });
    expect(state.values.get(workspaceSaveKey("python-rpg"))).toEqual({
      version: 2,
      currentLevelId: "python-marsh-01",
      battleState: { broken: true },
    });
  });

  it("removes the workspace save", async () => {
    const state = new MemoryWorkspaceState();
    const store = new WorkspaceSaveStore(state, "python-rpg");
    await store.save({
      version: 2,
      currentLevelId: "python-marsh-01",
      battleState: getLevel("python-marsh-01").initialBattle,
    });

    await store.remove();

    expect(state.values.get(workspaceSaveKey("python-rpg"))).toBeUndefined();
  });

  it("不会读取另一战役的 workspaceState 存档", () => {
    const state = new MemoryWorkspaceState();
    const pythonSave = {
      version: 2 as const,
      currentLevelId: "python-marsh-01" as const,
      battleState: getLevel("python-marsh-01").initialBattle,
      codeDraft: "python code",
    };
    state.values.set(workspaceSaveKey("python-rpg"), pythonSave);

    expect(new WorkspaceSaveStore(state, "go-rpg").load()).toEqual({ ok: true, save: null });
  });
});
