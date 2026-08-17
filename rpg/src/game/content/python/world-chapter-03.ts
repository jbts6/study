import type { BattleState } from "../../combat/types";
import { injectUnlockedAbilities } from "../ability-catalog";
import { getLevel } from "../levels";
import type { WorldCampaignContent } from "../world/types";

/** 第三章「勘测印记」：选择充能印桩后完成三名猎手遭遇。 */
export function createSurveyRidgeContent(): Pick<WorldCampaignContent, "chapters" | "locations" | "objects" | "encounters"> {
  const base = structuredClone(getLevel("python-marsh-03").initialBattle);
  const battle: BattleState = {
    ...base,
    battleId: "python-world-ch3-survey-pack",
    maxRounds: 12,
    turnOrder: ["scout", "hunter-a", "hunter-b", "hunter-c"],
    units: [
      ...base.units,
      {
        id: "hunter-c",
        team: "enemies",
        visibility: "revealed",
        cell: { x: 3, y: 1 },
        hp: 5,
        maxHp: 5,
        attack: 2,
        defense: 0,
        move: 1,
        initiative: 3,
        disabled: false,
        statuses: [],
        skills: [],
      },
    ],
  };

  return {
    chapters: {
      "python-marsh-03": {
        id: "python-marsh-03",
        questId: "survey_ridge",
        startLocationId: "survey-ridge",
        locationIds: ["survey-ridge"],
        encounterIds: ["survey_pack"],
        questChain: [
          {
            stepId: "pick_survey_stake",
            accept: { type: "inspect", targetFromState: () => "stake-east" },
            effects: { advanceTo: "prepare_survey_battle" },
          },
          {
            stepId: "prepare_survey_battle",
            accept: { type: "prepareBattle", encounterId: "survey_pack" },
            effects: { enterBattle: "survey_pack", advanceTo: "defeat_survey_pack" },
          },
          {
            stepId: "defeat_survey_pack",
            accept: { type: "talk", targetId: "toma" },
            effects: { advanceTo: "submit_survey_report" },
          },
          {
            stepId: "submit_survey_report",
            accept: { type: "talk", targetId: "toma" },
            effects: { flags: { survey_ridge_cleared: true }, advanceTo: "completed" },
          },
        ],
        victory: {
          returnLocationId: "rust-marsh-camp",
          setFlags: { survey_pack_defeated: true },
          reportStep: "submit_survey_report",
        },
      },
    },
    locations: {
      "survey-ridge": {
        id: "survey-ridge",
        name: "勘测高地",
        weather: "acid_rain",
        connectedLocationIds: ["rust-marsh-camp"],
        npcIds: [],
        objectIds: ["stake-north", "stake-east", "stake-west"],
        itemSourceIds: [],
      },
    },
    objects: {
      "stake-north": { id: "stake-north", type: "survey-stake", initialStatus: "drained" },
      "stake-east": { id: "stake-east", type: "survey-stake", initialStatus: "charged" },
      "stake-west": { id: "stake-west", type: "survey-stake", initialStatus: "drained" },
    },
    encounters: {
      survey_pack: {
        id: "survey_pack",
        battleLevelId: "python-marsh-03",
        battleId: "python-world-ch3-survey-pack",
        initialBattle: injectUnlockedAbilities("python-marsh-03", battle),
        prerequisiteFlags: {},
        enemyBehaviors: {
          "hunter-a": { type: "hunt-player" },
          "hunter-b": { type: "hunt-player" },
          "hunter-c": { type: "hunt-player" },
        },
      },
    },
  };
}
