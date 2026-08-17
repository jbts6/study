import { describe, expect, it } from "vitest";
import { validateLevelCommand } from "../../campaign/validate-level-command";
import { resolveTurn } from "../../combat/resolve-turn";
import { getLevel } from "../levels";
import { resolveWorldCommand } from "../../world/resolve-world-command";
import { createPythonWorldInitialState, PYTHON_WORLD_CONTENT } from "./world-chapter-01";

function apply(state: ReturnType<typeof createPythonWorldInitialState>, input: Record<string, unknown>) {
  const result = resolveWorldCommand(state, PYTHON_WORLD_CONTENT, {
    expectedRevision: state.revision,
    ...input,
  });
  if (!result.accepted) throw new Error(result.errors[0]?.message ?? "命令失败");
  return result.state;
}

function resolve(state: ReturnType<typeof createPythonWorldInitialState>, input: Record<string, unknown>) {
  return resolveWorldCommand(state, PYTHON_WORLD_CONTENT, {
    expectedRevision: state.revision,
    ...input,
  });
}

const readyForChapterThree = {
  ...createPythonWorldInitialState(),
  chapterId: "python-marsh-02",
  locationId: "rust-marsh-camp",
  worldFlags: { venom_fork_cleared: true },
  quests: [{ id: "venom_fork", status: "completed" as const, stepId: "completed" }],
};

describe("Python world chapter 3", () => {
  it("opens survey ridge and enforces the charged stake", () => {
    const traveled = apply(readyForChapterThree, { type: "travel", locationId: "survey-ridge" });
    expect(traveled.chapterId).toBe("python-marsh-03");
    expect(traveled.quests[0]).toEqual({ id: "survey_ridge", status: "active", stepId: "pick_survey_stake" });
    const wrong = resolve(traveled, { type: "inspect", targetId: "stake-north" });
    expect(wrong.accepted).toBe(false);
    if (!wrong.accepted) expect(wrong.errors[0]?.message).toContain("stake-east");
    const inspected = apply(traveled, { type: "inspect", targetId: "stake-east" });
    expect(inspected.quests[0]?.stepId).toBe("prepare_survey_battle");
  });

  it("rejects fixed hunter-a focus after the target is disabled", () => {
    const encounter = PYTHON_WORLD_CONTENT.encounters.survey_pack!;
    const initialBattle = structuredClone(encounter.initialBattle);
    const state = {
      ...initialBattle,
      units: initialBattle.units.map((unit) => unit.id === "hunter-a"
        ? { ...unit, hp: 0, disabled: true }
        : unit),
    };
    const level = {
      ...getLevel("python-marsh-03"),
      enemyBehaviors: {
        ...getLevel("python-marsh-03").enemyBehaviors,
        ...encounter.enemyBehaviors,
      },
    };
    const levelValidation = validateLevelCommand(
      level,
      state,
      {
        actorId: "scout",
        expectedRevision: state.revision,
        action: { type: "attack", targetId: "hunter-a" },
      },
    );
    expect(levelValidation.accepted).toBe(true);
    if (levelValidation.accepted) {
      const resolution = resolveTurn(state, levelValidation.command);
      expect(resolution.accepted).toBe(false);
      if (!resolution.accepted) {
        expect(resolution.errors[0]?.code).toBe("INVALID_TARGET");
        expect(resolution.errors[0]?.message).toContain("hunter-a");
      }
    }
  });

});
