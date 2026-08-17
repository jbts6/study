import { injectUnlockedAbilities } from "../ability-catalog";
import { getLevel } from "../levels";
import type { WorldCampaignContent } from "../world/types";

/** 第四章「双重封锁」：按物资与情报选择入口，解除封锁后回营报告。 */
export function createLockYardContent(): Pick<WorldCampaignContent, "chapters" | "locations" | "objects" | "encounters"> {
  const base = structuredClone(getLevel("python-marsh-04").initialBattle);
  const battle = {
    ...base,
    battleId: "python-world-ch4-lockdown-pair",
  };

  return {
    chapters: {
      "python-marsh-04": {
        id: "python-marsh-04",
        questId: "lock_yard",
        startLocationId: "lock-yard",
        locationIds: ["lock-yard"],
        encounterIds: ["lockdown_pair"],
        questChain: [
          {
            stepId: "pick_lock_gate",
            accept: {
              type: "inspect",
              targetFromState: (state) => state.inventory.some((item) => item.id === "copper_wire" && item.amount >= 1)
                && state.worldFlags.venom_fork_cleared === true
                ? "gate-a"
                : "gate-b",
            },
            effects: { advanceTo: "prepare_lockdown_battle" },
          },
          {
            stepId: "prepare_lockdown_battle",
            accept: { type: "prepareBattle", encounterId: "lockdown_pair" },
            effects: { enterBattle: "lockdown_pair", advanceTo: "defeat_lockdown_pair" },
          },
          {
            stepId: "defeat_lockdown_pair",
            accept: { type: "talk", targetId: "toma" },
            effects: { advanceTo: "submit_lock_report" },
          },
          {
            stepId: "submit_lock_report",
            accept: { type: "talk", targetId: "toma" },
            effects: { flags: { lock_yard_cleared: true }, advanceTo: "completed" },
          },
        ],
        victory: {
          returnLocationId: "rust-marsh-camp",
          setFlags: { lockdown_pair_defeated: true },
          reportStep: "submit_lock_report",
        },
      },
    },
    locations: {
      "lock-yard": {
        id: "lock-yard",
        name: "封锁堆场",
        weather: "acid_rain",
        connectedLocationIds: ["rust-marsh-camp"],
        npcIds: [],
        objectIds: ["gate-a", "gate-b"],
        itemSourceIds: [],
      },
    },
    objects: {
      "gate-a": { id: "gate-a", type: "lock-gate", initialStatus: "copper_lock" },
      "gate-b": { id: "gate-b", type: "lock-gate", initialStatus: "signal_lock" },
    },
    encounters: {
      lockdown_pair: {
        id: "lockdown_pair",
        battleLevelId: "python-marsh-04",
        battleId: "python-world-ch4-lockdown-pair",
        initialBattle: injectUnlockedAbilities("python-marsh-04", battle),
        prerequisiteFlags: {},
      },
    },
  };
}
