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

const expectRejectedWithMessage = (state: BattleState, input: unknown, code: string, path: string, fragments: readonly string[]): void => {
  const result = validateTurnCommand(state, input);
  expect(result).toMatchObject({ accepted: false, errors: [expect.objectContaining({ code, path })] });
  if (result.accepted) throw new Error("预期命令校验失败");
  for (const fragment of fragments) expect(result.errors[0]?.message).toContain(fragment);
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

  it("explains the legal Python shape when a player uses an invalid command format", () => {
    const state = createFixtureState();

    expectRejectedWithMessage(state, { ...validWait() as object, movePath: [[1, 0]] }, "INVALID_MOVE_PATH", "$.movePath", [
      "坐标对象数组",
      '[{"x": 1, "y": 0}]',
      "不能写成 [[1, 0]]",
    ]);
    expectRejectedWithMessage(state, { ...validWait() as object, expectedRevision: "0" }, "INVALID_COMMAND", "$.expectedRevision", [
      "整数",
      'world["revision"]',
    ]);
    expectRejectedWithMessage(state, { ...validWait() as object, action: { type: "dash" } }, "INVALID_COMMAND", "$.action.type", [
      "attack",
      "cast",
      "interact",
      "guard",
      "wait",
    ]);
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

  it("explains movement step, distance, and destination constraints", () => {
    const state = createFixtureState();

    expectRejectedWithMessage(state, { ...validWait() as object, movePath: [{ x: 1, y: 1 }] }, "INVALID_MOVE_PATH", "$.movePath[0]", [
      "正交相邻",
      "上下左右一格",
    ]);
    expectRejectedWithMessage(state, { ...validWait() as object, movePath: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }] }, "MOVE_TOO_FAR", "$.movePath", [
      "最多包含 2 个格子",
      "每个元素代表一步",
    ]);
    expectRejectedWithMessage(state, { ...validWait() as object, movePath: [{ x: -1, y: 0 }] }, "MOVE_BLOCKED", "$.movePath[0]", [
      "坐标 (-1, 0)",
      "越界或被单位/阻挡格占用",
    ]);
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
    expectRejected({ ...cellTargetState, units: cellTargetState.units.map((unit) => unit.id === "lurker" ? { ...unit, cell: { x: 1, y: 0 }, visibility: "revealed" as const } : unit) }, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: { x: 1, y: 0 } } }, "INVALID_TARGET", "$.action.targetCell");
    expect(validateTurnCommand(cellTargetState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "mend", targetCell: { x: 0, y: 0 } } })).toMatchObject({ accepted: true });
    expectRejected({ ...cellTargetState, units: cellTargetState.units.map((unit) => unit.id === "golem" ? { ...unit, cell: { x: 1, y: 0 } } : unit) }, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "mend", targetCell: { x: 1, y: 0 } } }, "INVALID_TARGET", "$.action.targetCell");
  });

  it("reports invalid cell occupants before their out-of-range distance", () => {
    const state = createFixtureState();
    const cellTargetState = {
      ...state,
      units: state.units.map((unit) => unit.id === "scout"
        ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" || skill.id === "mend" ? { ...skill, target: "cell" as const } : skill) }
        : unit),
    };
    const farCell = { x: 2, y: 1 };
    const emptyFarState = { ...cellTargetState, units: cellTargetState.units.map((unit) => unit.id === "lurker" ? { ...unit, cell: { x: 1, y: 0 } } : unit) };
    const disabledFarState = { ...cellTargetState, units: cellTargetState.units.map((unit) => unit.id === "lurker" ? { ...unit, visibility: "revealed" as const } : unit) };
    const wrongTeamFarState = { ...cellTargetState, units: cellTargetState.units.map((unit) => unit.id === "golem" ? { ...unit, cell: farCell } : unit.id === "lurker" ? { ...unit, cell: { x: 1, y: 0 } } : unit) };
    const legalFarState = { ...cellTargetState, units: cellTargetState.units.map((unit) => unit.id === "golem" ? { ...unit, cell: farCell } : unit.id === "lurker" ? { ...unit, cell: { x: 1, y: 0 } } : unit) };

    expectRejected(emptyFarState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: farCell } }, "INVALID_TARGET", "$.action.targetCell");
    expectRejected(disabledFarState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: farCell } }, "INVALID_TARGET", "$.action.targetCell");
    expectRejected(wrongTeamFarState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "mend", targetCell: farCell } }, "INVALID_TARGET", "$.action.targetCell");
    expectRejected(legalFarState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: farCell } }, "TARGET_OUT_OF_RANGE", "$.action.targetCell");
  });

  it("rejects cell-target skills when a cell has multiple occupants", () => {
    const state = createFixtureState();
    const duplicateOccupantState = {
      ...state,
      units: state.units.map((unit) => unit.id === "scout"
        ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" ? { ...skill, target: "cell" as const } : skill) }
        : unit.id === "lurker" ? { ...unit, cell: { x: 2, y: 0 }, visibility: "revealed" as const, disabled: false } : unit),
    };

    expectRejected(duplicateOccupantState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: { x: 2, y: 0 } } }, "INVALID_TARGET", "$.action.targetCell");
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

  it("explains legal skill, target, and interaction values after the command shape is valid", () => {
    const state = createFixtureState();

    expectRejectedWithMessage(state, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "missing", targetId: "golem" } }, "SKILL_NOT_FOUND", "$.action.skillId", [
      "当前单位可用技能",
      "spark",
      "mend",
    ]);
    expectRejectedWithMessage({ ...state, units: state.units.map((unit) => unit.id === "scout" ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" ? { ...skill, remainingCooldown: 1 } : skill) } : unit) }, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetId: "golem" } }, "SKILL_ON_COOLDOWN", "$.action.skillId", [
      "spark",
      "冷却剩余 1 回合",
    ]);
    expectRejectedWithMessage(state, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetId: "scout" } }, "INVALID_TARGET", "$.action.targetId", [
      "敌方单位 ID",
      "golem",
    ]);
    expectRejectedWithMessage(state, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetCell: { x: 2, y: 0 } } }, "SKILL_TARGET_SHAPE", "$.action", [
      "targetId",
      "targetCell",
      "二选一",
    ]);
    expectRejectedWithMessage(state, { actorId: "scout", expectedRevision: 0, action: { type: "interact", targetId: "missing" } }, "INTERACTION_INVALID", "$.action.targetId", [
      "未完成目标 ID",
      "relay",
    ]);
  });
});
