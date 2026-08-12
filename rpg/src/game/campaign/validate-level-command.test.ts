import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "../content/types";
import type { BattleState, TurnCommand } from "../combat/types";
import { createFixtureState } from "../testing/fixture";
import { validateLevelCommand } from "./validate-level-command";

function fixtureLevel(): LevelDefinition {
  return {
    id: "python-marsh-01",
    title: "fixture",
    briefing: [],
    starterCode: "",
    apiHints: [],
    initialBattle: createFixtureState(),
    enemyBehaviors: { golem: { type: "corrupt" } },
    reward: { type: "ability", abilityId: "ward" },
  };
}

function command(action: TurnCommand["action"]): TurnCommand {
  return { actorId: "scout", expectedRevision: 0, action };
}

describe("validateLevelCommand", () => {
  it("rejects scout interaction with the key objective and explains why", () => {
    const state = createFixtureState();
    const before = structuredClone(state);

    const result = validateLevelCommand(fixtureLevel(), state, command({ type: "interact", targetId: "relay" }));

    expect(result).toEqual({
      accepted: false,
      errors: [expect.objectContaining({
        code: "INTERACTION_INVALID",
        path: "$.action.targetId",
        message: "scout 只能交互非关键目标",
      })],
    });
    expect(state).toEqual(before);
  });

  it("allows scout to interact with a non-key objective and restricts corrupt to the unique key objective", () => {
    const level = fixtureLevel();
    const state: BattleState = {
      ...createFixtureState(),
      objectives: [
        ...createFixtureState().objectives,
        { id: "seal", cell: { x: 1, y: 1 }, durability: 1, completed: false, key: false },
      ],
    };

    expect(validateLevelCommand(level, state, command({ type: "interact", targetId: "seal" }))).toEqual({
      accepted: true,
      command: command({ type: "interact", targetId: "seal" }),
    });
    expect(validateLevelCommand(level, state, { ...command({ type: "interact", targetId: "seal" }), actorId: "golem" })).toEqual({
      accepted: false,
      errors: [expect.objectContaining({
        code: "INTERACTION_INVALID",
        path: "$.action.targetId",
        message: "corrupt 角色只能交互该关唯一关键目标",
      })],
    });
    expect(validateLevelCommand(level, state, { ...command({ type: "interact", targetId: "relay" }), actorId: "golem" })).toEqual({
      accepted: true,
      command: { ...command({ type: "interact", targetId: "relay" }), actorId: "golem" },
    });
  });

  it("rejects non-corrupt enemies from interacting with either objective role", () => {
    const level: LevelDefinition = {
      ...fixtureLevel(),
      enemyBehaviors: { golem: { type: "guard" } },
    };
    const state = createFixtureState();

    expect(validateLevelCommand(level, state, { ...command({ type: "interact", targetId: "relay" }), actorId: "golem" })).toEqual({
      accepted: false,
      errors: [expect.objectContaining({
        code: "INTERACTION_INVALID",
        path: "$.action.targetId",
        message: "只有 scout 或 corrupt 角色可以交互目标",
      })],
    });
  });
});
