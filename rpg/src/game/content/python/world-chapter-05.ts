import { injectUnlockedAbilities } from "../ability-catalog";
import { getLevel } from "../levels";
import type { WorldCampaignContent } from "../world/types";

/** 第五章「裂隙节点」：选择稳定入口，激活节点并回营报告。 */
export function createRiftNodesContent(): Pick<WorldCampaignContent, "chapters" | "locations" | "objects" | "encounters"> {
  const base = structuredClone(getLevel("python-marsh-05").initialBattle);
  const battle = { ...base, battleId: "python-world-ch5-rift-guardians" };

  return {
    chapters: {
      "python-marsh-05": {
        id: "python-marsh-05",
        questId: "rift_nodes",
        startLocationId: "rift-nodes",
        locationIds: ["rift-nodes"],
        encounterIds: ["rift_guardians"],
        questChain: [
          {
            stepId: "pick_rift_entry",
            accept: { type: "inspect", targetFromState: () => "entry-stone-b" },
            effects: { advanceTo: "prepare_rift_battle" },
          },
          {
            stepId: "prepare_rift_battle",
            accept: { type: "prepareBattle", encounterId: "rift_guardians" },
            effects: { enterBattle: "rift_guardians", advanceTo: "defeat_rift_guardians" },
          },
          {
            stepId: "defeat_rift_guardians",
            accept: { type: "talk", targetId: "toma" },
            effects: { advanceTo: "submit_rift_report" },
          },
          {
            stepId: "submit_rift_report",
            accept: { type: "talk", targetId: "toma" },
            effects: { flags: { rift_nodes_cleared: true }, advanceTo: "completed" },
          },
        ],
        victory: {
          returnLocationId: "rust-marsh-camp",
          setFlags: { rift_guardians_defeated: true },
          reportStep: "submit_rift_report",
        },
      },
    },
    locations: {
      "rift-nodes": {
        id: "rift-nodes",
        name: "裂隙节点",
        weather: "acid_rain",
        connectedLocationIds: ["rust-marsh-camp"],
        npcIds: [],
        objectIds: ["entry-stone-a", "entry-stone-b", "entry-stone-c"],
        itemSourceIds: [],
      },
    },
    objects: {
      "entry-stone-a": { id: "entry-stone-a", type: "rift-entry", initialStatus: "unstable" },
      "entry-stone-b": { id: "entry-stone-b", type: "rift-entry", initialStatus: "aligned" },
      "entry-stone-c": { id: "entry-stone-c", type: "rift-entry", initialStatus: "dormant" },
    },
    encounters: {
      rift_guardians: {
        id: "rift_guardians",
        battleLevelId: "python-marsh-05",
        battleId: "python-world-ch5-rift-guardians",
        initialBattle: injectUnlockedAbilities("python-marsh-05", battle),
        prerequisiteFlags: {},
      },
    },
  };
}
