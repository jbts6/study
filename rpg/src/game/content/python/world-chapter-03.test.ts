import { describe, expect, it } from "vitest";
import { enemyCommand } from "../../campaign/enemy-command";
import { validateLevelCommand } from "../../campaign/validate-level-command";
import { resolveTurn } from "../../combat/resolve-turn";
import type { BattleState, TurnCommand } from "../../combat/types";
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

function combatCommand(state: BattleState, action: TurnCommand["action"], movePath?: readonly { x: number; y: number }[]): TurnCommand {
  return {
    actorId: "scout",
    expectedRevision: state.revision,
    ...(movePath === undefined ? {} : { movePath }),
    action,
  };
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function adjacentPath(state: BattleState, target: { x: number; y: number }): readonly { x: number; y: number }[] {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const candidates = [
    { x: target.x - 1, y: target.y },
    { x: target.x + 1, y: target.y },
    { x: target.x, y: target.y - 1 },
    { x: target.x, y: target.y + 1 },
  ];
  const valid = candidates
    .filter((cell) => cell.x >= 0 && cell.x < state.board.width && cell.y >= 0 && cell.y < state.board.height)
    .filter((cell) => !state.board.blockedCells.some((blocked) => blocked.x === cell.x && blocked.y === cell.y))
    .filter((cell) => !state.units.some((unit) => unit.id !== "scout" && unit.cell.x === cell.x && unit.cell.y === cell.y))
    .filter((cell) => distance(scout.cell, cell) <= scout.move);
  const destination = valid.sort((left, right) => distance(scout.cell, left) - distance(scout.cell, right))[0];
  if (destination === undefined) return [];
  if (distance(scout.cell, destination) === 1) return [destination];
  const middle = { x: scout.cell.x + Math.sign(destination.x - scout.cell.x), y: scout.cell.y };
  return [middle, destination];
}

function chooseLowestHpEnemy(state: BattleState) {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  let selected;
  for (const unit of state.units) {
    if (unit.team !== "enemies" || unit.disabled) continue;
    if (selected === undefined
      || unit.hp < selected.hp
      || (unit.hp === selected.hp && distance(scout.cell, unit.cell) < distance(scout.cell, selected.cell))) {
      selected = unit;
    }
  }
  return selected;
}

function chooseScoutCommand(state: BattleState): TurnCommand {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const mark = state.objectives.find((objective) => objective.id === "scout-mark")!;
  if (!mark.completed) {
    return combatCommand(state, { type: "interact", targetId: mark.id }, [{ x: 0, y: 1 }]);
  }

  const target = chooseLowestHpEnemy(state);
  if (target === undefined) return combatCommand(state, { type: "wait" });
  const pierce = scout.skills.find((skill) => skill.id === "pierce")!;
  const spark = scout.skills.find((skill) => skill.id === "spark")!;
  const targetDistance = distance(scout.cell, target.cell);
  if (state.round === 2 && targetDistance === 2 && spark.remainingCooldown === 0) {
    return combatCommand(state, { type: "wait" });
  }
  if (targetDistance <= spark.range && spark.remainingCooldown === 0) {
    return combatCommand(state, { type: "cast", skillId: "spark", targetId: target.id });
  }
  if (targetDistance === 1) {
    return pierce.remainingCooldown === 0
      ? combatCommand(state, { type: "cast", skillId: "pierce", targetId: target.id })
      : combatCommand(state, { type: "attack", targetId: target.id });
  }
  return combatCommand(state, { type: "attack", targetId: target.id }, adjacentPath(state, target.cell));
}

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

  it("wins the survey pack after activating the mark and selecting live targets", () => {
    const encounter = PYTHON_WORLD_CONTENT.encounters.survey_pack!;
    const level = {
      ...getLevel("python-marsh-03"),
      enemyBehaviors: {
        ...getLevel("python-marsh-03").enemyBehaviors,
        ...encounter.enemyBehaviors,
      },
    };
    let state = structuredClone(encounter.initialBattle);
    for (let turn = 0; turn < state.maxRounds * state.turnOrder.length && state.phase === "in_progress"; turn += 1) {
      const activeId = state.turnOrder[state.turnIndex];
      const command = activeId === "scout"
        ? chooseScoutCommand(state)
        : enemyCommand(level, state);
      const validation = validateLevelCommand(level, state, command);
      expect(validation.accepted).toBe(true);
      if (!validation.accepted) break;
      const resolution = resolveTurn(state, validation.command);
      expect(resolution.accepted).toBe(true);
      if (!resolution.accepted) break;
      state = resolution.state;
    }
    expect(state.phase).toBe("won");
    expect(state.objectives.find((objective) => objective.id === "scout-mark")?.completed).toBe(true);
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
