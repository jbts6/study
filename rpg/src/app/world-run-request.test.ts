import { describe, expect, it } from "vitest";
import { createDefaultRunLimits } from "./app-controller";
import { PYTHON_RPG_CAMPAIGN } from "../game/content/python/levels";
import { PYTHON_WORLD_CONTENT, createPythonWorldInitialState } from "../game/content/python/world-chapter-01";
import type { GameState, WorldCommand } from "../game/world/campaign-types";
import { resolveWorldCommand } from "../game/world/resolve-world-command";
import { createWorldRunRequest } from "./world-run-request";

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

describe("createWorldRunRequest", () => {
  it("uses choose_world_action and the campaign view during exploration", () => {
    const request = createWorldRunRequest({
      campaign: PYTHON_RPG_CAMPAIGN,
      content: PYTHON_WORLD_CONTENT,
      state: createPythonWorldInitialState(),
      codeDraft: "def choose_world_action(world):\n    return {}\n",
      runId: "run-1",
      limits: createDefaultRunLimits().python,
    });

    expect(request.entrypoint.callable).toBe("choose_world_action");
    expect(request.allowedModules).toEqual(["math"]);
    expect(request.worldView).toMatchObject({ revision: 0, location: { id: "rust-marsh-camp" } });
  });

  it("uses choose_turn and the existing battle view during an encounter", () => {
    const state = prepareGuardianBattle();
    const request = createWorldRunRequest({
      campaign: PYTHON_RPG_CAMPAIGN,
      content: PYTHON_WORLD_CONTENT,
      state,
      codeDraft: "def choose_turn(world):\n    return {}\n",
      runId: "run-2",
      limits: createDefaultRunLimits().python,
    });

    expect(request.entrypoint.callable).toBe("choose_turn");
    expect(request.worldView).toMatchObject({ battleId: "python-world-ch1-marsh-guardian" });
  });
});
