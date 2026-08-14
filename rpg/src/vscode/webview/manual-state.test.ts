import { describe, expect, it } from "vitest";
import { resolveManualView, resolveReferenceSection } from "./manual-state";

describe("manual view state", () => {
  const first = { levelId: "go-marsh-01", revision: 0, hasReference: true } as const;

  it("opens the first referenced level on its focus section", () => {
    expect(resolveManualView(undefined, first, undefined)).toEqual({ view: "manual", sectionId: "focus" });
  });

  it("returns to the battlefield after a later revision", () => {
    expect(resolveManualView(undefined, { ...first, revision: 2 }, undefined))
      .toEqual({ view: "battle", sectionId: "focus" });
  });

  it("preserves a manual selection while the revision is unchanged", () => {
    expect(resolveManualView({ view: "manual", sectionId: "world" }, { ...first, revision: 0 }, undefined))
      .toEqual({ view: "manual", sectionId: "world" });
  });

  it("returns to the battlefield after a legal turn revision", () => {
    expect(resolveManualView(
      { view: "manual", sectionId: "world" },
      { ...first, revision: 1 },
      { previousRevision: 0 },
    )).toEqual({ view: "battle", sectionId: "world" });
  });

  it("resets the focus section when a later level starts", () => {
    expect(resolveManualView(
      { view: "manual", sectionId: "world" },
      { levelId: "go-marsh-02", revision: 0, hasReference: true },
      { previousLevelId: first.levelId },
    )).toEqual({ view: "manual", sectionId: "focus" });
  });

  it("does not infer a level change without an explicit previous level", () => {
    expect(resolveManualView(
      { view: "manual", sectionId: "world" },
      { levelId: "go-marsh-02", revision: 0, hasReference: true },
      undefined,
    )).toEqual({ view: "manual", sectionId: "world" });
  });

  it("restores the persisted section for the same level", () => {
    expect(resolveManualView(
      { view: "manual", sectionId: "world" },
      { ...first, revision: 0, hasReference: true },
      { persistedLevelId: first.levelId },
    )).toEqual({ view: "manual", sectionId: "world" });
  });

  it("keeps Python snapshots on the battlefield", () => {
    expect(resolveManualView({ view: "manual", sectionId: "world" }, {
      levelId: "python-marsh-01",
      revision: 0,
      hasReference: false,
    })).toEqual({ view: "battle", sectionId: "world" });
  });

  it("maps stable reference ids to manual sections", () => {
    expect(resolveReferenceSection("action.move-and-attack")).toBe("actions");
    expect(resolveReferenceSection("type.world")).toBe("world");
    expect(resolveReferenceSection("entrypoint.choose-turn")).toBe("turn-command");
    expect(resolveReferenceSection("unknown.reference")).toBe("turn-command");
  });
});
