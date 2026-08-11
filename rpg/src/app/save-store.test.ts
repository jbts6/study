import { beforeEach, describe, expect, it } from "vitest";
import { createPythonMarsh01, CURRENT_LEVEL_ID, STARTER_CODE } from "../game/content/python-marsh-01";
import { LocalSaveStore } from "./save-store";

describe("LocalSaveStore", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips the single V1 save", () => {
    const store = new LocalSaveStore(localStorage);
    const save = {
      version: 1 as const,
      currentLevelId: CURRENT_LEVEL_ID,
      battleState: createPythonMarsh01(),
      codeDraft: STARTER_CODE,
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

  it("rejects a V1 object with a malformed skill effect", () => {
    const battleState = createPythonMarsh01();
    localStorage.setItem("python-rpg.save", JSON.stringify({
      version: 1,
      currentLevelId: CURRENT_LEVEL_ID,
      battleState: {
        ...battleState,
        units: battleState.units.map((unit, unitIndex) => unitIndex === 0
          ? {
              ...unit,
              skills: unit.skills.map((skill, skillIndex) => skillIndex === 0
                ? { ...skill, effect: { statusId: "shock", duration: 1, defenseBonus: 0, chancePermille: 1001 } }
                : skill),
            }
          : unit),
      },
      codeDraft: STARTER_CODE,
    }));

    expect(new LocalSaveStore(localStorage).load().ok).toBe(false);
  });
});
