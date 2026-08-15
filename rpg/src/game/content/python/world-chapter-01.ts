import type { GameState } from "../../world/campaign-types";
import type { WorldCampaignContent } from "../world/types";
import { PYTHON_MARSH_01 } from "./python-marsh-01";

const MARSH_GUARDIAN_BATTLE = {
  ...PYTHON_MARSH_01.initialBattle,
  battleId: "python-world-ch1-marsh-guardian",
};

export const PYTHON_WORLD_CONTENT: WorldCampaignContent = {
  chapters: {
    "python-marsh-01": {
      id: "python-marsh-01",
      startLocationId: "rust-marsh-camp",
      locationIds: ["rust-marsh-camp", "old_foundry"],
      encounterIds: ["marsh_guardian"],
    },
  },
  locations: {
    "rust-marsh-camp": {
      id: "rust-marsh-camp",
      name: "锈沼营地",
      weather: "acid_rain",
      connectedLocationIds: ["old_foundry"],
      npcIds: ["toma"],
      objectIds: ["scrap_pile", "weather_station"],
      itemSourceIds: ["copper_wire_source"],
      travelRequirements: {
        old_foundry: { safe_route_known: true },
      },
    },
    old_foundry: {
      id: "old_foundry",
      name: "旧铸造厂",
      connectedLocationIds: ["rust-marsh-camp"],
      npcIds: [],
      objectIds: ["relay"],
      itemSourceIds: [],
    },
  },
  npcs: {
    toma: {
      id: "toma",
      name: "托玛",
      role: "engineer",
      mood: "worried",
    },
  },
  objects: {
    scrap_pile: {
      id: "scrap_pile",
      type: "salvage",
      initialStatus: "uninspected",
    },
    weather_station: {
      id: "weather_station",
      type: "sensor",
      initialStatus: "operational",
    },
    relay: {
      id: "relay",
      type: "machine",
      initialStatus: "damaged",
      requiredItemId: "copper_wire",
    },
  },
  itemSources: {
    copper_wire_source: {
      id: "copper_wire_source",
      itemId: "copper_wire",
      name: "铜线",
      amount: 1,
      requiredFlags: { scrap_pile_inspected: true },
    },
  },
  encounters: {
    marsh_guardian: {
      id: "marsh_guardian",
      battleLevelId: "python-marsh-01",
      battleId: "python-world-ch1-marsh-guardian",
      initialBattle: MARSH_GUARDIAN_BATTLE,
      prerequisiteFlags: { relay_repaired: true },
    },
  },
};

export function createPythonWorldInitialState(): GameState {
  return {
    campaignId: "python-rpg",
    chapterId: "python-marsh-01",
    locationId: "rust-marsh-camp",
    revision: 0,
    worldFlags: {},
    inventory: [],
    quests: [{ id: "repair_relay", status: "active", stepId: "talk_to_toma" }],
    discoveredClues: [],
    battle: null,
  };
}
