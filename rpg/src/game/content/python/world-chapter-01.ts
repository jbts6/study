import type { GameState } from "../../world/campaign-types";
import type { WorldCampaignContent } from "../world/types";
import { PYTHON_MARSH_01 } from "./python-marsh-01";
import { createVenomForkContent } from "./world-chapter-02";
import { createSurveyRidgeContent } from "./world-chapter-03";

const MARSH_GUARDIAN_BATTLE = {
  ...PYTHON_MARSH_01.initialBattle,
  battleId: "python-world-ch1-marsh-guardian",
};

const venomFork = createVenomForkContent();
const surveyRidge = createSurveyRidgeContent();

export const PYTHON_WORLD_CONTENT: WorldCampaignContent = {
  chapters: {
    "python-marsh-01": {
      id: "python-marsh-01",
      questId: "repair_relay",
      startLocationId: "rust-marsh-camp",
      locationIds: ["rust-marsh-camp", "old_foundry"],
      encounterIds: ["marsh_guardian"],
      questChain: [
        { stepId: "talk_to_toma", accept: { type: "talk", targetId: "toma" }, effects: { flags: { talked_to_toma: true }, advanceTo: "inspect_scrap_pile" } },
        { stepId: "inspect_scrap_pile", accept: { type: "inspect", targetId: "scrap_pile" }, effects: { flags: { scrap_pile_inspected: true }, addClue: "scrap_contains_copper", advanceTo: "collect_copper_wire" } },
        { stepId: "collect_copper_wire", accept: { type: "collect", targetId: "copper_wire_source" }, effects: { advanceTo: "inspect_weather" } },
        { stepId: "inspect_weather", accept: { type: "inspect", targetId: "weather_station" }, effects: { flags: { safe_route_known: true }, addClue: "acid_rain_safe_route", advanceTo: "travel_to_relay" } },
        { stepId: "travel_to_relay", accept: { type: "travel", targetId: "old_foundry" }, effects: { advanceTo: "repair_relay" } },
        { stepId: "repair_relay", accept: { type: "use", targetId: "relay", itemId: "copper_wire" }, effects: { flags: { relay_repaired: true }, advanceTo: "prepare_guardian_battle" } },
        { stepId: "prepare_guardian_battle", accept: { type: "prepareBattle", encounterId: "marsh_guardian" }, effects: { enterBattle: "marsh_guardian", advanceTo: "defeat_guardian" } },
        { stepId: "submit_report", accept: { type: "talk", targetId: "toma" }, effects: { flags: { talked_to_toma: true, chapter_01_completed: true, chapter_02_unlocked: true }, advanceTo: "completed" } },
      ],
      victory: {
        returnLocationId: "rust-marsh-camp",
        setFlags: { marsh_guardian_defeated: true },
        reportStep: "submit_report",
      },
    },
    ...venomFork.chapters,
    ...surveyRidge.chapters,
  },
  locations: {
    "rust-marsh-camp": {
      id: "rust-marsh-camp",
      name: "锈沼营地",
      weather: "acid_rain",
      connectedLocationIds: ["old_foundry", "venom-fork", "survey-ridge"],
      npcIds: ["toma"],
      objectIds: ["scrap_pile", "weather_station"],
      itemSourceIds: ["copper_wire_source"],
      travelRequirements: {
        old_foundry: { safe_route_known: true },
        "venom-fork": { chapter_02_unlocked: true },
        "survey-ridge": { venom_fork_cleared: true },
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
    ...venomFork.locations,
    ...surveyRidge.locations,
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
    ...venomFork.objects,
    ...surveyRidge.objects,
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
    ...venomFork.encounters,
    ...surveyRidge.encounters,
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
