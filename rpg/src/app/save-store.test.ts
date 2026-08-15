import { beforeEach, describe, expect, it } from "vitest";
import { getLevel } from "../game/content/levels";
import { isSaveDataV2, LocalSaveStore } from "./save-store";

describe("LocalSaveStore", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips the V2 campaign save", () => {
    const store = new LocalSaveStore(localStorage);
    const save = {
      version: 2 as const,
      currentLevelId: "python-marsh-02" as const,
      battleState: getLevel("python-marsh-02").initialBattle,
      codeDraft: getLevel("python-marsh-02").starterCode,
    };

    store.save(save);

    expect(store.load()).toEqual({ ok: true, save });
    expect(localStorage.length).toBe(1);
  });

  it("reports corrupted JSON instead of replacing it", () => {
    localStorage.setItem("python-rpg.save", "{broken");
    const store = new LocalSaveStore(localStorage);

    expect(store.load()).toEqual({
      ok: false,
      message: "本地存档无法读取。请输入“重置存档”后重新开始。",
    });
    expect(localStorage.getItem("python-rpg.save")).toBe("{broken");
  });

  it("rejects V1 and a V2 battle that belongs to another level", () => {
    const battleState = getLevel("python-marsh-01").initialBattle;
    localStorage.setItem("python-rpg.save", JSON.stringify({
      version: 1,
      currentLevelId: "python-marsh-01",
      battleState,
      codeDraft: "draft",
    }));
    expect(new LocalSaveStore(localStorage).load().ok).toBe(false);
    localStorage.setItem("python-rpg.save", JSON.stringify({
      version: 2,
      currentLevelId: "python-marsh-02",
      battleState,
      codeDraft: "draft",
    }));
    expect(new LocalSaveStore(localStorage).load().ok).toBe(false);
  });

  it("rejects unknown versions and malformed battle snapshots", () => {
    const battleState = getLevel("python-marsh-01").initialBattle;
    localStorage.setItem("python-rpg.save", JSON.stringify({
      version: 3,
      currentLevelId: "python-marsh-01",
      battleState,
      codeDraft: "draft",
    }));
    expect(new LocalSaveStore(localStorage).load().ok).toBe(false);
    localStorage.setItem("python-rpg.save", JSON.stringify({
      version: 2,
      currentLevelId: "python-marsh-01",
      battleState: { ...battleState, revision: 0.5 },
      codeDraft: "draft",
    }));
    expect(new LocalSaveStore(localStorage).load().ok).toBe(false);
  });

  it("exports the V2 shape guard for legacy world-save recovery", () => {
    const save = {
      version: 2 as const,
      currentLevelId: "python-marsh-01" as const,
      battleState: getLevel("python-marsh-01").initialBattle,
      codeDraft: "draft",
    };

    expect(isSaveDataV2(save)).toBe(true);
    expect(isSaveDataV2({ ...save, codeDraft: 1 })).toBe(false);
  });
});
