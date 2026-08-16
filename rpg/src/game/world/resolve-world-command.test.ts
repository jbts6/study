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

describe("resolveWorldCommand", () => {
  it("advances the repair quest through the approved exploration sequence", () => {
    let state = createPythonWorldInitialState();
    state = apply(state, { type: "talk", targetId: "toma" });
    state = apply(state, { type: "inspect", targetId: "scrap_pile" });
    state = apply(state, { type: "collect", targetId: "copper_wire_source" });
    state = apply(state, { type: "inspect", targetId: "weather_station" });
    state = apply(state, { type: "travel", locationId: "old_foundry" });
    state = apply(state, { type: "use", itemId: "copper_wire", targetId: "relay" });

    expect(state.revision).toBe(6);
    expect(state.inventory).toEqual([]);
    expect(state.worldFlags.relay_repaired).toBe(true);
    expect(state.quests[0]?.stepId).toBe("prepare_guardian_battle");
  });

  it("rejects collecting the same material source twice without changing state", () => {
    let state = createPythonWorldInitialState();
    state = apply(state, { type: "talk", targetId: "toma" });
    state = apply(state, { type: "inspect", targetId: "scrap_pile" });
    state = apply(state, { type: "collect", targetId: "copper_wire_source" });
    const result = resolveWorldCommand(state, PYTHON_WORLD_CONTENT, {
      expectedRevision: state.revision,
      type: "collect",
      targetId: "copper_wire_source",
    });

    expect(result).toEqual({
      accepted: false,
      errors: [{ code: "ITEM_UNAVAILABLE", path: "targetId", message: "材料来源已经收集" }],
      state,
    });
  });

  it("rejects prototype-inherited type names without throwing", () => {
    const state = createPythonWorldInitialState();
    for (const type of ["toString", "constructor", "hasOwnProperty"]) {
      const result = resolveWorldCommand(state, PYTHON_WORLD_CONTENT, {
        expectedRevision: state.revision,
        type,
      });
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(result.errors).toEqual([
          { code: "INVALID_COMMAND", path: "type", message: "不支持的世界指令类型；可用：talk、inspect、collect、use、travel、prepareBattle" },
        ]);
      }
    }
  });

  it("tells the player the correct travel format when targetId is misused", () => {
    const state = createPythonWorldInitialState();
    const result = resolveWorldCommand(state, PYTHON_WORLD_CONTENT, {
      expectedRevision: state.revision,
      type: "travel",
      targetId: "old_foundry",
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.errors[0]?.code).toBe("UNKNOWN_FIELD");
      expect(result.errors[0]?.message).toContain("正确格式");
      expect(result.errors[0]?.message).toContain("locationId");
    }
  });

  it("accepts the final report once and keeps repeated submissions idempotent", () => {
    let state = createPythonWorldInitialState();
    state = apply(state, { type: "talk", targetId: "toma" });
    state = apply(state, { type: "inspect", targetId: "scrap_pile" });
    state = apply(state, { type: "collect", targetId: "copper_wire_source" });
    state = apply(state, { type: "inspect", targetId: "weather_station" });
    state = apply(state, { type: "travel", locationId: "old_foundry" });
    state = apply(state, { type: "use", itemId: "copper_wire", targetId: "relay" });
    state = apply(state, { type: "prepareBattle", encounterId: "marsh_guardian" });
    state = settleEncounter({
      ...state,
      battle: { ...state.battle!, state: { ...state.battle!.state, phase: "won" as const } },
    }, PYTHON_WORLD_CONTENT);

    state = apply(state, { type: "talk", targetId: "toma" });
    expect(state.quests).toEqual([{ id: "repair_relay", status: "completed", stepId: "completed" }]);
    expect(state.worldFlags.chapter_01_completed).toBe(true);
    expect(state.worldFlags.chapter_02_unlocked).toBe(true);

    const revisionBeforeRepeat = state.revision;
    state = apply(state, { type: "talk", targetId: "toma" });
    expect(state.revision).toBe(revisionBeforeRepeat + 1);
    expect(state.quests).toEqual([{ id: "repair_relay", status: "completed", stepId: "completed" }]);
    expect(state.worldFlags.chapter_01_completed).toBe(true);
    expect(state.worldFlags.chapter_02_unlocked).toBe(true);
  });
});
