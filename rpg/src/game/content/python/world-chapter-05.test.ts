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

const readyForChapterFive = {
  ...createPythonWorldInitialState(),
  chapterId: "python-marsh-04",
  locationId: "rust-marsh-camp",
  worldFlags: { lock_yard_cleared: true },
  quests: [{ id: "lock_yard", status: "completed" as const, stepId: "completed" }],
};

function battleCommand(state: BattleState, action: TurnCommand["action"], movePath?: readonly { x: number; y: number }[]): TurnCommand {
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
  const occupied = (cell: { x: number; y: number }) => state.units.some((unit) => (
    unit.id !== "scout" && !unit.disabled && unit.cell.x === cell.x && unit.cell.y === cell.y
  ));
  const queue: { cell: { x: number; y: number }; path: { x: number; y: number }[] }[] = [{ cell: scout.cell, path: [] }];
  const seen = new Set([`${scout.cell.x},${scout.cell.y}`]);
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.path.length > 0 && distance(current.cell, target) === 1) return current.path;
    if (current.path.length === scout.move) continue;
    for (const [dx, dy] of steps) {
      const next = { x: current.cell.x + dx, y: current.cell.y + dy };
      const key = `${next.x},${next.y}`;
      if (next.x < 0 || next.y < 0 || next.x >= state.board.width || next.y >= state.board.height) continue;
      if (occupied(next) || state.board.blockedCells.some((cell) => cell.x === next.x && cell.y === next.y)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ cell: next, path: [...current.path, next] });
    }
  }
  return [];
}

function pick_entry(world: { objects: readonly { id: string; status: string }[] }): string {
  return world.objects.find((object) => object.status === "aligned")?.id ?? "entry-stone-c";
}

function go_interact(state: BattleState, targetId: string): TurnCommand {
  return battleCommand(state, { type: "interact", targetId }, adjacentPath(
    state,
    state.objectives.find((objective) => objective.id === targetId)!.cell,
  ));
}

function attack_target(state: BattleState, unitId: string): TurnCommand {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const target = state.units.find((unit) => unit.id === unitId)!;
  const targetDistance = distance(scout.cell, target.cell);
  const fracture = scout.skills.find((skill) => skill.id === "fracture");
  const pierce = scout.skills.find((skill) => skill.id === "pierce");
  const movePath = adjacentPath(state, target.cell);
  const endpoint = movePath[movePath.length - 1] ?? scout.cell;
  const nextDistance = distance(endpoint, target.cell);
  if (targetDistance === 1 || nextDistance === 1) {
    if (unitId === "guard" && fracture?.remainingCooldown === 0) {
      return battleCommand(state, { type: "cast", skillId: "fracture", targetId: unitId }, movePath);
    }
    if (pierce?.remainingCooldown === 0) {
      return battleCommand(state, { type: "cast", skillId: "pierce", targetId: unitId }, movePath);
    }
    return battleCommand(state, { type: "attack", targetId: unitId }, movePath);
  }
  return battleCommand(state, { type: "guard" }, movePath);
}

function dynamicStrategy(state: BattleState): TurnCommand {
  const node = state.objectives.find((objective) => (
    (objective.id === "node-a" || objective.id === "node-b") && !objective.completed
  ));
  if (node !== undefined) return go_interact(state, node.id);
  const target = state.units.find((unit) => unit.team === "enemies" && !unit.disabled);
  return target === undefined ? battleCommand(state, { type: "wait" }) : attack_target(state, target.id);
}

function fixedOldPositionStrategy(state: BattleState): TurnCommand {
  const nodeA = state.objectives.find((objective) => objective.id === "node-a")!;
  const nodeB = state.objectives.find((objective) => objective.id === "node-b")!;
  if (!nodeA.completed) return battleCommand(state, { type: "interact", targetId: "node-a" });
  if (!nodeB.completed) return battleCommand(state, { type: "interact", targetId: "node-b" }, [{ x: 1, y: 0 }]);
  const target = state.units.find((unit) => unit.id === "hunter" && !unit.disabled)
    ?? state.units.find((unit) => unit.id === "guard" && !unit.disabled);
  if (target === undefined) return battleCommand(state, { type: "wait" });
  // 只等待 hunter 回到旧坐标，忽略敌人当前坐标，最终超时。
  const oldHunterCell = { x: 4, y: 0 };
  if (target.id === "hunter" && (target.cell.x !== oldHunterCell.x || target.cell.y !== oldHunterCell.y)) {
    return battleCommand(state, { type: "wait" });
  }
  return battleCommand(state, { type: "attack", targetId: target.id });
}

function runBattle(strategy: (state: BattleState) => TurnCommand): {
  state: BattleState;
  rejected: boolean;
  rejectedAt?: "nodes" | "enemies";
  rejectedCode?: string;
} {
  const encounter = PYTHON_WORLD_CONTENT.encounters.rift_guardians!;
  const level = getLevel("python-marsh-05");
  let state = structuredClone(encounter.initialBattle);
  for (let turn = 0; turn < state.maxRounds * state.turnOrder.length && state.phase === "in_progress"; turn += 1) {
    const activeId = state.turnOrder[state.turnIndex];
    const command = activeId === "scout" ? strategy(state) : enemyCommand(level, state);
    const validation = validateLevelCommand(level, state, command);
    if (!validation.accepted) return {
      state,
      rejected: true,
      rejectedAt: state.objectives.some((objective) => !objective.completed && objective.id.startsWith("node-")) ? "nodes" : "enemies",
      rejectedCode: validation.errors[0]?.code,
    };
    const resolution = resolveTurn(state, validation.command);
    if (!resolution.accepted) return {
      state,
      rejected: true,
      rejectedAt: state.objectives.some((objective) => !objective.completed && objective.id.startsWith("node-")) ? "nodes" : "enemies",
      rejectedCode: resolution.errors[0]?.code,
    };
    state = resolution.state;
  }
  return { state, rejected: false };
}

describe("Python world chapter 5", () => {
  it("opens rift nodes and accepts only the aligned entry stone", () => {
    const traveled = apply(readyForChapterFive, { type: "travel", locationId: "rift-nodes" });
    expect(traveled.chapterId).toBe("python-marsh-05");
    expect(traveled.quests[0]).toEqual({ id: "rift_nodes", status: "active", stepId: "pick_rift_entry" });
    const viewObjects = [
      { id: "entry-stone-a", status: "unstable" },
      { id: "entry-stone-b", status: "aligned" },
      { id: "entry-stone-c", status: "dormant" },
    ];
    expect(pick_entry({ objects: viewObjects })).toBe("entry-stone-b");
    for (const targetId of ["entry-stone-a", "entry-stone-c"]) {
      const wrong = resolve(traveled, { type: "inspect", targetId });
      expect(wrong.accepted).toBe(false);
      if (!wrong.accepted) expect(wrong.errors[0]?.message).toContain("entry-stone-b");
    }
    const selected = apply(traveled, { type: "inspect", targetId: "entry-stone-b" });
    expect(selected.quests[0]?.stepId).toBe("prepare_rift_battle");
  });

  it("rejects a fixed old-position strategy", () => {
    const result = runBattle(fixedOldPositionStrategy);
    expect(result.rejected).toBe(false);
    expect(result.state.phase).toBe("lost");
    expect(result.state.objectives.find((objective) => objective.id === "node-a")?.completed).toBe(true);
    expect(result.state.objectives.find((objective) => objective.id === "node-b")?.completed).toBe(true);
    expect(result.state.units.find((unit) => unit.id === "scout")?.disabled).toBe(true);
  });

  it("wins with separated dynamic entry, interaction, and attack helpers", () => {
    const result = runBattle(dynamicStrategy);
    expect(result.rejected).toBe(false);
    expect(result.state.phase).toBe("won");
    expect(result.state.round).toBeLessThanOrEqual(14);
    expect(result.state.objectives.find((objective) => objective.id === "node-a")?.completed).toBe(true);
    expect(result.state.objectives.find((objective) => objective.id === "node-b")?.completed).toBe(true);
    expect(result.state.units.find((unit) => unit.id === "hunter")?.disabled).toBe(true);
    expect(result.state.units.find((unit) => unit.id === "guard")?.disabled).toBe(true);
  });
});
