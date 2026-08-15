import { describe, expect, it } from "vitest";
import { createPythonWorldInitialState, PYTHON_WORLD_CONTENT } from "./world-chapter-01";

describe("Python world chapter 1", () => {
  it("registers a reproducible initial state and a separately identified encounter", () => {
    expect(createPythonWorldInitialState()).toEqual({
      campaignId: "python-rpg",
      chapterId: "python-marsh-01",
      locationId: "rust-marsh-camp",
      revision: 0,
      worldFlags: {},
      inventory: [],
      quests: [{ id: "repair_relay", status: "active", stepId: "talk_to_toma" }],
      discoveredClues: [],
      battle: null,
    });

    const encounter = PYTHON_WORLD_CONTENT.encounters.marsh_guardian;
    expect(encounter?.battleLevelId).toBe("python-marsh-01");
    expect(encounter?.battleId).toBe("python-world-ch1-marsh-guardian");
    expect(encounter?.battleId).not.toBe("python-marsh-01");
  });
});
