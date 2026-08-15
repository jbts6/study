import { describe, expect, it } from "vitest";
import { PYTHON_WORLD_CONTENT, createPythonWorldInitialState } from "../content/python/world-chapter-01";
import { projectCampaignWorldView } from "./project-campaign-world-view";

describe("projectCampaignWorldView", () => {
  it("projects a frozen JSON-safe view without exposing hidden world flags", () => {
    const state = {
      ...createPythonWorldInitialState(),
      worldFlags: { talked_to_toma: true, internal_reward_seed: 42 },
      revision: 1,
    };
    const view = projectCampaignWorldView(state, PYTHON_WORLD_CONTENT);

    expect(view.revision).toBe(1);
    expect(view.location.id).toBe("rust-marsh-camp");
    expect(view.npcs.map((npc) => npc.id)).toEqual(["toma"]);
    expect(view.objects.map((object) => object.id)).toEqual(["scrap_pile", "weather_station"]);
    expect(view.availableTravel).toEqual([]);
    expect(JSON.stringify(view)).not.toContain("internal_reward_seed");
    expect(Object.isFrozen(view)).toBe(true);
  });
});
