import { describe, expect, it } from "vitest";
import { createFixtureState } from "../testing/fixture";
import type { BattleState } from "./types";
import { validateTurnCommand } from "./validate-turn-command";

const validWait = (): unknown => ({
  actorId: "scout",
  expectedRevision: 0,
  action: { type: "wait" },
});

const expectRejected = (state: BattleState, input: unknown, code: string, path: string): void => {
  expect(validateTurnCommand(state, input)).toEqual({
    accepted: false,
    errors: [expect.objectContaining({ code, path })],
  });
};

describe("validateTurnCommand", () => {
  it("accepts omitted and empty move paths without changing the state", () => {
    const state = createFixtureState();
    const before = structuredClone(state);

    expect(validateTurnCommand(state, validWait())).toMatchObject({ accepted: true });
    expect(validateTurnCommand(state, { ...validWait() as object, movePath: [] })).toMatchObject({ accepted: true });
    expect(state).toEqual(before);
  });

  it("strictly parses the top-level command and all action shapes", () => {
    const state = createFixtureState();

    expectRejected(state, null, "INVALID_COMMAND", "$");
    expectRejected(state, { expectedRevision: 0, action: { type: "wait" } }, "INVALID_COMMAND", "$");
    expectRejected(state, { ...validWait() as object, extra: true }, "UNKNOWN_FIELD", "$.extra");
    expectRejected(state, { ...validWait() as object, expectedRevision: Number.NaN }, "INVALID_COMMAND", "$.expectedRevision");
    expectRejected(state, { ...validWait() as object, movePath: undefined }, "INVALID_MOVE_PATH", "$.movePath");
    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "wait", extra: true } }, "UNKNOWN_FIELD", "$.action.extra");
    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetId: "golem", targetCell: { x: 2, y: 0 } } }, "SKILL_TARGET_SHAPE", "$.action");
    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: { x: 2.5, y: 0 } } }, "SKILL_TARGET_SHAPE", "$.action");
  });

  it("checks phase, revision, active actor, and disabled actor before commands", () => {
    const state = createFixtureState();

    expectRejected({ ...state, phase: "won" }, validWait(), "BATTLE_COMPLETE", "$.phase");
    expectRejected(state, { ...validWait() as object, expectedRevision: 1 }, "EXPECTED_REVISION_MISMATCH", "$.expectedRevision");
    expectRejected(state, { ...validWait() as object, actorId: "golem" }, "NOT_ACTIVE_ACTOR", "$.actorId");
    expectRejected({ ...state, units: state.units.map((unit) => unit.id === "scout" ? { ...unit, disabled: true } : unit) }, validWait(), "ACTOR_DISABLED", "$.actorId");
  });

  it("validates every orthogonal movement step before the action", () => {
    const state = createFixtureState();

    expectRejected(state, { ...validWait() as object, movePath: [{ x: 1.5, y: 0 }] }, "INVALID_MOVE_PATH", "$.movePath");
    expectRejected(state, { ...validWait() as object, movePath: [{ x: 1, y: 1 }] }, "INVALID_MOVE_PATH", "$.movePath[0]");
    expectRejected(state, { ...validWait() as object, movePath: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }, "MOVE_TOO_FAR", "$.movePath");
    expectRejected(state, { ...validWait() as object, movePath: [{ x: -1, y: 0 }] }, "MOVE_BLOCKED", "$.movePath[0]");
    expectRejected({ ...state, board: { ...state.board, blockedCells: [{ x: 1, y: 0 }] } }, { ...validWait() as object, movePath: [{ x: 1, y: 0 }] }, "MOVE_BLOCKED", "$.movePath[0]");
    expectRejected(state, { ...validWait() as object, movePath: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }, "MOVE_BLOCKED", "$.movePath[1]");
    expectRejected({ ...state, units: state.units.map((unit) => unit.id === "lurker" ? { ...unit, cell: { x: 1, y: 0 } } : unit) }, { ...validWait() as object, movePath: [{ x: 1, y: 0 }] }, "MOVE_BLOCKED", "$.movePath[0]");
  });

  it("uses the completed move endpoint for action distance and target validation", () => {
    const state = createFixtureState();

    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "attack", targetId: "golem" } }, "TARGET_OUT_OF_RANGE", "$.action.targetId");
    expect(validateTurnCommand(state, { actorId: "scout", expectedRevision: 0, movePath: [{ x: 1, y: 0 }], action: { type: "attack", targetId: "golem" } })).toMatchObject({ accepted: true });
    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "attack", targetId: "missing" } }, "INVALID_TARGET", "$.action.targetId");
    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "attack", targetId: "scout" } }, "INVALID_TARGET", "$.action.targetId");
  });

  it("rejects a revealed enemy unit whose cell lies outside the board", () => {
    const state = createFixtureState();
    const invalidTargetState = {
      ...state,
      units: state.units.map((unit) => unit.id === "golem" ? { ...unit, cell: { x: 3, y: 0 } } : unit),
    };

    expectRejected(invalidTargetState, { actorId: "scout", expectedRevision: 0, action: { type: "attack", targetId: "golem" } }, "INVALID_TARGET", "$.action.targetId");
  });

  it("allows the actor to return to its vacated start cell", () => {
    const state = createFixtureState();

    expect(validateTurnCommand(state, {
      actorId: "scout",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 0 }, { x: 0, y: 0 }],
      action: { type: "wait" },
    })).toMatchObject({ accepted: true });
  });

  it("returns a command detached from successful move and cell-target input", () => {
    const state = createFixtureState();
    const cellSkillState = {
      ...state,
      units: state.units.map((unit) => unit.id === "scout"
        ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" ? { ...skill, target: "cell" as const } : skill) }
        : unit),
    };
    const input = {
      actorId: "scout",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 0 }],
      action: { type: "cast" as const, skillId: "spark", targetCell: { x: 2, y: 0 } },
    };
    const validation = validateTurnCommand(cellSkillState, input);

    expect(validation.accepted).toBe(true);
    if (!validation.accepted) throw new Error("预期命令校验成功");
    const commandBeforeMutation = structuredClone(validation.command);
    input.movePath[0].x = 0;
    input.action.targetCell.x = 0;

    expect(validation.command).toEqual(commandBeforeMutation);
  });

  it("does not mutate state while rejecting a command", () => {
    const state = createFixtureState();
    const before = structuredClone(state);

    expectRejected(state, { ...validWait() as object, movePath: [{ x: 1, y: 1 }] }, "INVALID_MOVE_PATH", "$.movePath[0]");

    expect(state).toEqual(before);
  });

  it("requires a legal occupant for damage and heal cell-target skills", () => {
    const state = createFixtureState();
    const cellTargetState = {
      ...state,
      units: state.units.map((unit) => unit.id === "scout"
        ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" || skill.id === "mend" ? { ...skill, target: "cell" as const } : skill) }
        : unit),
    };

    expect(validateTurnCommand(cellTargetState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: { x: 2, y: 0 } } })).toMatchObject({ accepted: true });
    expectRejected(cellTargetState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: { x: 1, y: 0 } } }, "INVALID_TARGET", "$.action.targetCell");
    expectRejected(cellTargetState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: { x: 0, y: 0 } } }, "INVALID_TARGET", "$.action.targetCell");
    expectRejected({ ...cellTargetState, units: cellTargetState.units.map((unit) => unit.id === "lurker" ? { ...unit, cell: { x: 1, y: 0 } } : unit) }, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: { x: 1, y: 0 } } }, "INVALID_TARGET", "$.action.targetCell");
    expect(validateTurnCommand(cellTargetState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "mend", targetCell: { x: 0, y: 0 } } })).toMatchObject({ accepted: true });
    expectRejected({ ...cellTargetState, units: cellTargetState.units.map((unit) => unit.id === "golem" ? { ...unit, cell: { x: 1, y: 0 } } : unit) }, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "mend", targetCell: { x: 1, y: 0 } } }, "INVALID_TARGET", "$.action.targetCell");
  });

  it("validates skill existence, cooldown, target kind, and interaction objectives", () => {
    const state = createFixtureState();

    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "missing", targetId: "golem" } }, "SKILL_NOT_FOUND", "$.action.skillId");
    expectRejected({ ...state, units: state.units.map((unit) => unit.id === "scout" ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" ? { ...skill, remainingCooldown: 1 } : skill) } : unit) }, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetId: "golem" } }, "SKILL_ON_COOLDOWN", "$.action.skillId");
    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: { x: 2, y: 0 } } }, "SKILL_TARGET_SHAPE", "$.action");
    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetId: "scout" } }, "INVALID_TARGET", "$.action.targetId");
    expect(validateTurnCommand(state, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "mend", targetId: "scout" } })).toMatchObject({ accepted: true });
    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "mend", targetId: "golem" } }, "INVALID_TARGET", "$.action.targetId");
    expect(validateTurnCommand(state, { actorId: "scout", expectedRevision: 0, action: { type: "interact", targetId: "relay" } })).toMatchObject({ accepted: true });
    expectRejected(state, { actorId: "scout", expectedRevision: 0, movePath: [{ x: 0, y: 1 }], action: { type: "interact", targetId: "relay" } }, "INTERACTION_INVALID", "$.action.targetId");
    expectRejected(state, { actorId: "scout", expectedRevision: 0, action: { type: "interact", targetId: "missing" } }, "INTERACTION_INVALID", "$.action.targetId");
  });
});
