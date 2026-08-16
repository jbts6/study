import type { BattleState } from "../../combat/types";
import { getLevel } from "../levels";
import { injectUnlockedAbilities } from "../ability-catalog";
import type { WorldCampaignContent } from "../world/types";

/**
 * 第二章「毒沼岔路」内容：venom-fork 地点、数据推导任务链、venom_guardian 遭遇。
 *
 * 数值推演（引擎实测，见 world-chapter-02.test.ts）：
 * - 无条件追打 corruptor：r3 败（relay 被腐化，侧翼绕过单格卡位）。
 * - 站桩输出但从不管 bog-wisp：r5 败（wisp 每回合 3 点磨死 scout）。
 * - 站桩 + 读状态分支（wisp 贴脸先击杀）：r7 胜，relay 剩 1 点耐久。
 * corruptor 生命由 8 覆写为 5，给 wisp 间隙留足回合。
 */
export function createVenomForkContent(): Pick<WorldCampaignContent, "chapters" | "locations" | "objects" | "encounters"> {
  const base = structuredClone(getLevel("python-marsh-02").initialBattle);
  const battle: BattleState = {
    ...base,
    battleId: "python-world-ch2-venom-guardian",
    turnOrder: ["scout", "corruptor", "bog-wisp"],
    units: [
      ...base.units.map((unit) => unit.id === "corruptor" ? { ...unit, hp: 5, maxHp: 5 } : unit),
      {
        id: "bog-wisp", team: "enemies", visibility: "revealed", cell: { x: 3, y: 1 },
        hp: 3, maxHp: 3, attack: 3, defense: 0, move: 2, initiative: 6, disabled: false,
        statuses: [], skills: [],
      },
    ],
  };
  return {
    chapters: {
      "python-marsh-02": {
        id: "python-marsh-02",
        questId: "venom_fork",
        startLocationId: "venom-fork",
        locationIds: ["venom-fork"],
        encounterIds: ["venom_guardian"],
        questChain: [
          { stepId: "read_waysign", accept: { type: "inspect", targetId: "waysign" }, effects: { addClue: "venom_fork_intel", advanceTo: "pick_signal_tower" } },
          {
            stepId: "pick_signal_tower",
            accept: {
              type: "inspect",
              targetFromState: (state) => state.inventory.some((item) => item.id === "copper_wire" && item.amount >= 1)
                ? "signal-tower-a"
                : "signal-tower-b",
            },
            effects: { addClue: "venom_guardian_weakness", advanceTo: "prepare_venom_battle" },
          },
          { stepId: "prepare_venom_battle", accept: { type: "prepareBattle", encounterId: "venom_guardian" }, effects: { enterBattle: "venom_guardian", advanceTo: "defeat_venom_guardian" } },
          { stepId: "submit_venom_report", accept: { type: "talk", targetId: "toma" }, effects: { flags: { venom_fork_cleared: true }, advanceTo: "completed" } },
        ],
        victory: {
          returnLocationId: "rust-marsh-camp",
          setFlags: { venom_guardian_defeated: true },
          reportStep: "submit_venom_report",
        },
      },
    },
    locations: {
      "venom-fork": {
        id: "venom-fork",
        name: "毒沼岔口",
        weather: "acid_rain",
        connectedLocationIds: ["rust-marsh-camp"],
        npcIds: [],
        objectIds: ["waysign", "signal-tower-a", "signal-tower-b"],
        itemSourceIds: [],
      },
    },
    objects: {
      waysign: { id: "waysign", type: "signpost", initialStatus: "weathered" },
      "signal-tower-a": { id: "signal-tower-a", type: "beacon", initialStatus: "silent" },
      "signal-tower-b": { id: "signal-tower-b", type: "beacon", initialStatus: "marked" },
    },
    encounters: {
      venom_guardian: {
        id: "venom_guardian",
        battleLevelId: "python-marsh-02",
        battleId: "python-world-ch2-venom-guardian",
        initialBattle: injectUnlockedAbilities("python-marsh-02", battle),
        prerequisiteFlags: {},
        enemyBehaviors: { "bog-wisp": { type: "hunt-player" } },
      },
    },
  };
}
