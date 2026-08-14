import { describe, expect, it } from "vitest";
import { getCampaign } from "../game/content/campaigns";
import { campaignItems } from "./game-launcher-model";

describe("campaign launcher items", () => {
  it("lists only implemented Python and Go campaigns", () => {
    expect(campaignItems([getCampaign("python-rpg"), getCampaign("go-rpg")])).toEqual([
      expect.objectContaining({ campaignId: "python-rpg", label: "Python 沼泽战役", command: "pythonRpg.open" }),
      expect.objectContaining({ campaignId: "go-rpg", label: "Go 沼泽战役", command: "pythonRpg.open" }),
    ]);
  });
});
