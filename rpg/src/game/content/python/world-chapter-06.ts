import { injectUnlockedAbilities } from "../ability-catalog";
import { getLevel } from "../levels";
import type { WorldCampaignContent } from "../world/types";

/** 第六章「沼心封印」：读取征兆并完成终局战斗。 */
export function createMarshHeartContent(): Pick<WorldCampaignContent, "chapters" | "locations" | "objects" | "encounters"> {
  const base = structuredClone(getLevel("python-marsh-06").initialBattle);
  const battle = { ...base, battleId: "python-world-ch6-marsh-heart-final" };

  return {
    chapters: {
      "python-marsh-06": {
        id: "python-marsh-06",
        questId: "marsh_heart",
        startLocationId: "marsh-heart",
        locationIds: ["marsh-heart"],
        encounterIds: ["marsh_heart_final"],
        questChain: [
          {
            stepId: "read_marsh_omen",
            accept: {
              type: "inspect",
              targetFromState: (state) => state.worldFlags.rift_nodes_cleared === true ? "omen-a" : "omen-b",
            },
            effects: { advanceTo: "prepare_marsh_heart" },
          },
          {
            stepId: "prepare_marsh_heart",
            accept: { type: "prepareBattle", encounterId: "marsh_heart_final" },
            effects: { enterBattle: "marsh_heart_final", advanceTo: "defeat_marsh_heart" },
          },
          {
            stepId: "defeat_marsh_heart",
            accept: { type: "talk", targetId: "toma" },
            effects: { advanceTo: "completed" },
          },
        ],
        victory: {
          returnLocationId: "rust-marsh-camp",
          setFlags: { marsh_heart_sealed: true },
          campaignComplete: true,
        },
      },
    },
    locations: {
      "marsh-heart": {
        id: "marsh-heart",
        name: "沼心封印",
        weather: "acid_rain",
        connectedLocationIds: ["rust-marsh-camp"],
        npcIds: [],
        objectIds: ["omen-a", "omen-b"],
        itemSourceIds: [],
      },
    },
    objects: {
      "omen-a": { id: "omen-a", type: "marsh-omen", initialStatus: "converging" },
      "omen-b": { id: "omen-b", type: "marsh-omen", initialStatus: "scattered" },
    },
    encounters: {
      marsh_heart_final: {
        id: "marsh_heart_final",
        battleLevelId: "python-marsh-06",
        battleId: "python-world-ch6-marsh-heart-final",
        initialBattle: injectUnlockedAbilities("python-marsh-06", battle),
        prerequisiteFlags: {},
      },
    },
  };
}
