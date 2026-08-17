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

const readyForChapterFour = {
  ...createPythonWorldInitialState(),
  chapterId: "python-marsh-03",
  locationId: "rust-marsh-camp",
  worldFlags: { survey_ridge_cleared: true },
  quests: [{ id: "survey_ridge", status: "completed" as const, stepId: "completed" }],
};

function battleCommand(state: BattleState, action: TurnCommand["action"], movePath?: readonly { x: number; y: number }[]): TurnCommand {
  return {
    actorId: "scout",
    expectedRevision: state.revision,
    ...(movePath === undefined ? {} : { movePath }),
    action,
  };
}

function runBattle(strategy: (state: BattleState) => TurnCommand): BattleState {
  const encounter = PYTHON_WORLD_CONTENT.encounters.lockdown_pair!;
  const level = getLevel("python-marsh-04");
  let state = structuredClone(encounter.initialBattle);
  for (let turn = 0; turn < state.maxRounds * state.turnOrder.length && state.phase === "in_progress"; turn += 1) {
    const activeId = state.turnOrder[state.turnIndex];
    const command = activeId === "scout" ? strategy(state) : enemyCommand(level, state);
    const validation = validateLevelCommand(level, state, command);
    if (!validation.accepted) throw new Error(validation.errors[0]?.message ?? "命令验证失败");
    const resolution = resolveTurn(state, validation.command);
    if (!resolution.accepted) throw new Error(resolution.errors[0]?.message ?? "回合结算失败");
    state = resolution.state;
  }
  return state;
}

function chaseGuardOnly(state: BattleState): TurnCommand {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const guard = state.units.find((unit) => unit.id === "guard")!;
  const distance = (cell: { x: number; y: number }) => Math.abs(cell.x - guard.cell.x) + Math.abs(cell.y - guard.cell.y);
  if (distance(scout.cell) === 1) return battleCommand(state, { type: "attack", targetId: "guard" });

  const occupied = (cell: { x: number; y: number }) => state.units.some((unit) => (
    unit.id !== "scout" && !unit.disabled && unit.cell.x === cell.x && unit.cell.y === cell.y
  ));
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const movePath = steps
    .map(([dx, dy]) => ({ x: scout.cell.x + dx, y: scout.cell.y + dy }))
    .filter((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < state.board.width && cell.y < state.board.height && !occupied(cell))
    .sort((left, right) => distance(left) - distance(right))[0];
  return movePath === undefined
    ? battleCommand(state, { type: "guard" })
    : battleCommand(state, { type: "guard" }, [movePath]);
}

function combinedStrategy(state: BattleState): TurnCommand {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const seal = state.objectives.find((objective) => objective.id === "seal")!;
  const corruptor = state.units.find((unit) => unit.id === "corruptor")!;
  const guard = state.units.find((unit) => unit.id === "guard")!;
  if (!corruptor.disabled) {
    return battleCommand(state, { type: "cast", skillId: "spark", targetId: "corruptor" }, [{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  }
  if (!seal.completed) {
    return battleCommand(state, { type: "interact", targetId: "seal" }, [{ x: 1, y: 0 }, { x: 1, y: 1 }]);
  }
  const pierce = scout.skills.find((skill) => skill.id === "pierce");
  const spark = scout.skills.find((skill) => skill.id === "spark");
  const guardDistance = Math.abs(scout.cell.x - guard.cell.x) + Math.abs(scout.cell.y - guard.cell.y);
  if (guardDistance > 1) {
    return battleCommand(state, { type: "attack", targetId: "guard" }, [{ x: 2, y: 1 }, { x: 3, y: 1 }]);
  }
  if (pierce?.remainingCooldown === 0) return battleCommand(state, { type: "cast", skillId: "pierce", targetId: "guard" });
  if (spark?.remainingCooldown === 0) return battleCommand(state, { type: "cast", skillId: "spark", targetId: "guard" });
  return battleCommand(state, { type: "attack", targetId: "guard" });
}

describe("Python world chapter 4", () => {
  it("opens lock yard after survey ridge and starts at the gate step", () => {
    const traveled = apply(readyForChapterFour, { type: "travel", locationId: "lock-yard" });
    expect(traveled.chapterId).toBe("python-marsh-04");
    expect(traveled.quests[0]).toEqual({ id: "lock_yard", status: "active", stepId: "pick_lock_gate" });
  });

  it("selects gate-a only with copper wire and venom fork clearance", () => {
    const ready = {
      ...readyForChapterFour,
      inventory: [{ id: "copper_wire", amount: 1 }],
      worldFlags: { survey_ridge_cleared: true, venom_fork_cleared: true },
    };
    const traveled = apply(ready, { type: "travel", locationId: "lock-yard" });
    const wrong = resolve(traveled, { type: "inspect", targetId: "gate-b" });
    expect(wrong.accepted).toBe(false);
    if (!wrong.accepted) expect(wrong.errors[0]?.message).toContain("gate-a");
    const selected = apply(traveled, { type: "inspect", targetId: "gate-a" });
    expect(selected.quests[0]?.stepId).toBe("prepare_lockdown_battle");
  });

  it("selects gate-b when either condition is missing", () => {
    const traveled = apply(readyForChapterFour, { type: "travel", locationId: "lock-yard" });
    const wrong = resolve(traveled, { type: "inspect", targetId: "gate-a" });
    expect(wrong.accepted).toBe(false);
    if (!wrong.accepted) expect(wrong.errors[0]?.message).toContain("gate-b");
    const selected = apply(traveled, { type: "inspect", targetId: "gate-b" });
    expect(selected.quests[0]?.stepId).toBe("prepare_lockdown_battle");
  });

  it("loses when it only chases the guard", () => {
    expect(runBattle(chaseGuardOnly).phase).toBe("lost");
  });

  it("wins after corruptor, seal, and guard objectives are handled", () => {
    const outcome = runBattle(combinedStrategy);
    expect(outcome.phase).toBe("won");
    expect(outcome.round).toBeLessThanOrEqual(12);
    expect(outcome.objectives.find((objective) => objective.id === "seal")?.completed).toBe(true);
  });
});
