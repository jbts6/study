import { describe, expect, it } from "vitest";
import { PYTHON_WORLD_CONTENT, createPythonWorldInitialState } from "../content/python/world-chapter-01";
import type { GameState, WorldCommand } from "./campaign-types";
import { resolveWorldCommand } from "./resolve-world-command";
import { settleEncounter } from "./settle-encounter";

type WorldCommandInput = {
  [K in WorldCommand["type"]]: Omit<Extract<WorldCommand, { type: K }>, "expectedRevision">
}[WorldCommand["type"]];

function apply(state: GameState, command: WorldCommandInput): GameState {
  const result = resolveWorldCommand(state, PYTHON_WORLD_CONTENT, {
    ...command,
    expectedRevision: state.revision,
  });
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error("expected command acceptance");
  return result.state;
}

function prepareGuardianBattle(): GameState {
  let state = createPythonWorldInitialState();
  state = apply(state, { type: "talk", targetId: "toma" });
  state = apply(state, { type: "inspect", targetId: "scrap_pile" });
  state = apply(state, { type: "collect", targetId: "copper_wire_source" });
  state = apply(state, { type: "inspect", targetId: "weather_station" });
  state = apply(state, { type: "travel", locationId: "old_foundry" });
  state = apply(state, { type: "use", itemId: "copper_wire", targetId: "relay" });
  return apply(state, { type: "prepareBattle", encounterId: "marsh_guardian" });
}

describe("settleEncounter", () => {
  it("settles a guardian victory back into exploration", () => {
    const prepared = prepareGuardianBattle();
    const state = {
      ...prepared,
      battle: { ...prepared.battle!, state: { ...prepared.battle!.state, phase: "won" as const } },
    };
    const settled = settleEncounter(state, PYTHON_WORLD_CONTENT);

    expect(settled.battle).toBeNull();
    expect(settled.locationId).toBe("rust-marsh-camp");
    expect(settled.worldFlags.marsh_guardian_defeated).toBe(true);
    expect(settled.quests[0]?.stepId).toBe("submit_report");
    expect(settled.revision).toBe(state.revision + 1);
  });

  it("retries a nominal win when a required objective is incomplete", () => {
    const prepared = prepareGuardianBattle();
    const nominalWin = {
      ...prepared,
      battle: {
        ...prepared.battle!,
        state: {
          ...prepared.battle!.state,
          phase: "won" as const,
          objectives: [
            ...prepared.battle!.state.objectives,
            {
              id: "required-mark",
              cell: { x: 1, y: 1 },
              durability: 1,
              completed: false,
              key: false,
            },
          ],
        },
      },
    };

    const retried = settleEncounter(nominalWin, PYTHON_WORLD_CONTENT);

    expect(retried.battle?.state.phase).toBe("in_progress");
    expect(retried.worldFlags.marsh_guardian_defeated).toBeUndefined();
    expect(retried.quests).toEqual(nominalWin.quests);
  });

  it("resets a lost guardian battle without changing exploration progress", () => {
    const prepared = prepareGuardianBattle();
    const lost = {
      ...prepared,
      battle: { ...prepared.battle!, state: { ...prepared.battle!.state, phase: "lost" as const } },
    };
    const retried = settleEncounter(lost, PYTHON_WORLD_CONTENT);

    expect(retried.battle?.encounterId).toBe("marsh_guardian");
    expect(retried.battle?.state.phase).toBe("in_progress");
    expect(retried.battle?.state.battleId).toBe("python-world-ch1-marsh-guardian");
    expect(retried.battle?.state).not.toBe(PYTHON_WORLD_CONTENT.encounters.marsh_guardian.initialBattle);
    expect(retried.battle?.state.units).not.toBe(PYTHON_WORLD_CONTENT.encounters.marsh_guardian.initialBattle.units);
    expect(retried.locationId).toBe(lost.locationId);
    expect(retried.worldFlags).toEqual(lost.worldFlags);
    expect(retried.quests).toEqual(lost.quests);
    expect(retried.discoveredClues).toEqual(lost.discoveredClues);
    expect(retried.revision).toBe(lost.revision + 1);
  });

  it("rejects settlement when no battle is active or battle is still in progress", () => {
    const initial = createPythonWorldInitialState();
    expect(() => settleEncounter(initial, PYTHON_WORLD_CONTENT)).toThrow("没有正在结算的战斗");

    const prepared = prepareGuardianBattle();
    expect(() => settleEncounter(prepared, PYTHON_WORLD_CONTENT)).toThrow("战斗尚未结束");
  });
});
