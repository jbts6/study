import { beforeEach, describe, expect, it } from "vitest";
import { getLevel } from "../game/content/levels";
import { PYTHON_WORLD_CONTENT, createPythonWorldInitialState } from "../game/content/python/world-chapter-01";
import { LocalWorldSaveStore, WORLD_SAVE_KEY } from "./world-save-store";

const LEGACY_SAVE_KEY = "python-rpg.save";

describe("LocalWorldSaveStore", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips V3 world state and local code drafts", () => {
    const store = new LocalWorldSaveStore(localStorage, PYTHON_WORLD_CONTENT);
    const save = {
      version: 3 as const,
      gameState: createPythonWorldInitialState(),
      codeDrafts: { "python-marsh-01": "def choose_world_action(world):\n    return {}\n" },
    };

    store.save(save);

    expect(store.load()).toEqual({ ok: true, save });
  });

  it("reports V2 as recoverable and exposes only its local code draft", () => {
    localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify({
      version: 2,
      currentLevelId: "python-marsh-01",
      battleState: getLevel("python-marsh-01").initialBattle,
      codeDraft: "old code",
    }));

    expect(new LocalWorldSaveStore(localStorage, PYTHON_WORLD_CONTENT).load()).toEqual({
      ok: false,
      reason: "legacy_v2",
      message: "检测到旧版战斗存档。导出旧代码后开始新的世界战役。",
      legacyCodeDraft: "old code",
    });
  });

  it("reports corrupt JSON without replacing the original value", () => {
    localStorage.setItem(WORLD_SAVE_KEY, "{broken");

    expect(new LocalWorldSaveStore(localStorage, PYTHON_WORLD_CONTENT).load()).toEqual({
      ok: false,
      reason: "corrupt",
      message: "本地存档无法读取。请输入“重置存档”后重新开始。",
    });
    expect(localStorage.getItem(WORLD_SAVE_KEY)).toBe("{broken");
  });

  it("removes both the V3 world save and the legacy V2 save", () => {
    localStorage.setItem(WORLD_SAVE_KEY, "world");
    localStorage.setItem(LEGACY_SAVE_KEY, "legacy");

    new LocalWorldSaveStore(localStorage, PYTHON_WORLD_CONTENT).remove();

    expect(localStorage.getItem(WORLD_SAVE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull();
  });

  it("rejects a V3 save whose active battle does not match registered content", () => {
    const gameState = {
      ...createPythonWorldInitialState(),
      battle: {
        encounterId: "marsh_guardian",
        state: {
          ...getLevel("python-marsh-01").initialBattle,
          battleId: "different-battle",
        },
      },
    };
    localStorage.setItem(WORLD_SAVE_KEY, JSON.stringify({ version: 3, gameState }));

    expect(new LocalWorldSaveStore(localStorage, PYTHON_WORLD_CONTENT).load()).toEqual({
      ok: false,
      reason: "corrupt",
      message: "本地存档无法读取。请输入“重置存档”后重新开始。",
    });
  });
});
