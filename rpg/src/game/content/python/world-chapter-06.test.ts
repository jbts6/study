import { describe, expect, it } from "vitest";
import { enemyCommand } from "../../campaign/enemy-command";
import { validateLevelCommand } from "../../campaign/validate-level-command";
import { resolveTurn } from "../../combat/resolve-turn";
import type { BattleState, TurnCommand } from "../../combat/types";
import { getLevel } from "../levels";
import { resolveWorldCommand } from "../../world/resolve-world-command";
import { settleEncounter } from "../../world/settle-encounter";
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

const readyForChapterSix = {
  ...createPythonWorldInitialState(),
  chapterId: "python-marsh-05",
  locationId: "rust-marsh-camp",
  worldFlags: { rift_nodes_cleared: true },
  quests: [{ id: "rift_nodes", status: "completed" as const, stepId: "completed" }],
};

function command(state: BattleState, action: TurnCommand["action"], movePath?: readonly { x: number; y: number }[]): TurnCommand {
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

function pathToRange(state: BattleState, target: { x: number; y: number }, range: number): readonly { x: number; y: number }[] {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const occupied = (cell: { x: number; y: number }) => state.units.some((unit) => (
    unit.id !== "scout" && unit.cell.x === cell.x && unit.cell.y === cell.y
  ));
  const queue: { cell: { x: number; y: number }; path: { x: number; y: number }[] }[] = [{ cell: scout.cell, path: [] }];
  const seen = new Set([`${scout.cell.x},${scout.cell.y}`]);
  let best = queue[0];
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (distance(current.cell, target) < distance(best.cell, target)) best = current;
    if (current.path.length > 0 && distance(current.cell, target) <= range) return current.path;
    if (current.path.length === scout.move) continue;
    for (const [dx, dy] of steps) {
      const next = { x: current.cell.x + dx, y: current.cell.y + dy };
      const key = `${next.x},${next.y}`;
      if (next.x < 0 || next.y < 0 || next.x >= state.board.width || next.y >= state.board.height) continue;
      if (occupied(next)
        || state.board.blockedCells.some((cell) => cell.x === next.x && cell.y === next.y)
        || state.board.hazardCells.some((cell) => cell.x === next.x && cell.y === next.y)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ cell: next, path: [...current.path, next] });
    }
  }
  return best.path;
}

function nearestEnemyStrategy(state: BattleState): TurnCommand {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const target = state.units
    .filter((unit) => unit.team === "enemies" && !unit.disabled)
    .sort((left, right) => distance(scout.cell, left.cell) - distance(scout.cell, right.cell))[0];
  if (target === undefined) return command(state, { type: "wait" });
  const movePath = pathToRange(state, target.cell, 1);
  const endpoint = movePath[movePath.length - 1] ?? scout.cell;
  return distance(endpoint, target.cell) === 1
    ? command(state, { type: "attack", targetId: target.id }, movePath)
    : command(state, { type: "guard" }, movePath);
}

function dynamicStrategy(state: BattleState): TurnCommand {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const supportSkillId = ["ward", "renew", "aegis"][state.round - 1];
  const supportSkill = scout.skills.find((skill) => (
    skill.id === supportSkillId && skill.remainingCooldown === 0
  ));
  if (supportSkill !== undefined) {
    return command(state, {
      type: "cast",
      skillId: supportSkill.id,
      targetId: "scout",
    });
  }
  if (scout.hp <= 3) {
    const heal = scout.skills.find((skill) => ["renew", "aegis", "ward"].includes(skill.id) && skill.remainingCooldown === 0);
    if (heal !== undefined) return command(state, { type: "cast", skillId: heal.id, targetId: "scout" });
  }
  const corruptor = state.units.find((unit) => unit.id === "corruptor")!;
  const hunter = state.units.find((unit) => unit.id === "hunter")!;
  const guard = state.units.find((unit) => unit.id === "guard")!;
  if (!corruptor.disabled) return attackUnit(state, corruptor);
  if (!hunter.disabled) return attackUnit(state, hunter);
  const seal = state.objectives.find((objective) => objective.id === "final-seal")!;
  if (!seal.completed) {
    const movePath = pathToRange(state, seal.cell, 1);
    const endpoint = movePath[movePath.length - 1] ?? scout.cell;
    return distance(endpoint, seal.cell) === 1
      ? command(state, { type: "interact", targetId: seal.id }, movePath)
      : command(state, { type: "guard" }, movePath);
  }
  return attackUnit(state, guard);
}

function attackUnit(state: BattleState, target: BattleState["units"][number]): TurnCommand {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const fracture = scout.skills.find((skill) => skill.id === "fracture");
  const pierce = scout.skills.find((skill) => skill.id === "pierce");
  const spark = scout.skills.find((skill) => skill.id === "spark");
  const movePath = pathToRange(state, target.cell, 2);
  const endpoint = movePath[movePath.length - 1] ?? scout.cell;
  const targetDistance = distance(endpoint, target.cell);
  if (target.id === "guard" && targetDistance <= 1 && fracture?.remainingCooldown === 0) {
    return command(state, { type: "cast", skillId: "fracture", targetId: target.id }, movePath);
  }
  if (targetDistance <= 2 && spark?.remainingCooldown === 0) {
    return command(state, { type: "cast", skillId: "spark", targetId: target.id }, movePath);
  }
  if (targetDistance <= 1 && pierce?.remainingCooldown === 0) {
    return command(state, { type: "cast", skillId: "pierce", targetId: target.id }, movePath);
  }
  if (targetDistance === 1) return command(state, { type: "attack", targetId: target.id }, movePath);
  return command(state, { type: "guard" }, movePath);
}

function runBattle(strategy: (state: BattleState) => TurnCommand): {
  state: BattleState;
  rejected: boolean;
  rejectedCode?: string;
  rejectedMessage?: string;
  usedSkills: string[];
} {
  const encounter = PYTHON_WORLD_CONTENT.encounters.marsh_heart_final!;
  const level = getLevel("python-marsh-06");
  let state = structuredClone(encounter.initialBattle);
  const usedSkills: string[] = [];
  for (let turn = 0; turn < state.maxRounds * state.turnOrder.length && state.phase === "in_progress"; turn += 1) {
    const activeId = state.turnOrder[state.turnIndex];
    const raw = activeId === "scout" ? strategy(state) : enemyCommand(level, state);
    if (activeId === "scout" && raw.action.type === "cast") {
      usedSkills.push(raw.action.skillId);
    }
    const validation = validateLevelCommand(level, state, raw);
    if (!validation.accepted) return {
      state,
      rejected: true,
      rejectedCode: validation.errors[0]?.code,
      rejectedMessage: `${validation.errors[0]?.message ?? ""} command=${JSON.stringify(raw)} units=${JSON.stringify(state.units.map((unit) => ({ id: unit.id, cell: unit.cell, disabled: unit.disabled })))}`,
      usedSkills,
    };
    const resolution = resolveTurn(state, validation.command);
    if (!resolution.accepted) return {
      state,
      rejected: true,
      rejectedCode: resolution.errors[0]?.code,
      rejectedMessage: `${resolution.errors[0]?.message ?? ""} command=${JSON.stringify(raw)} units=${JSON.stringify(state.units.map((unit) => ({ id: unit.id, cell: unit.cell, disabled: unit.disabled })))}`,
      usedSkills,
    };
    state = resolution.state;
  }
  return { state, rejected: false, usedSkills };
}

describe("Python world chapter 6", () => {
  it("opens marsh heart and selects omen-a from the public object state", () => {
    const traveled = apply(readyForChapterSix, { type: "travel", locationId: "marsh-heart" });
    expect(traveled.chapterId).toBe("python-marsh-06");
    expect(traveled.quests[0]).toEqual({ id: "marsh_heart", status: "active", stepId: "read_marsh_omen" });
    const wrong = resolve(traveled, { type: "inspect", targetId: "omen-b" });
    expect(wrong.accepted).toBe(false);
    if (!wrong.accepted) expect(wrong.errors[0]?.message).toContain("omen-a");
    const selected = apply(traveled, { type: "inspect", targetId: "omen-a" });
    expect(selected.quests[0]?.stepId).toBe("prepare_marsh_heart");
  });

  it("loses when it only attacks nearby enemies", () => {
    const outcome = runBattle(nearestEnemyStrategy);
    expect(outcome.rejected, outcome.rejectedMessage).toBe(false);
    expect(outcome.state.phase).toBe("lost");
    expect(outcome.state.objectives.find((objective) => objective.id === "final-seal")?.completed).toBe(false);
  });

  it("wins the final battle and settles the completed campaign", () => {
    const prepared = apply(apply(readyForChapterSix, { type: "travel", locationId: "marsh-heart" }), { type: "inspect", targetId: "omen-a" });
    const battleReady = apply(prepared, { type: "prepareBattle", encounterId: "marsh_heart_final" });
    const outcome = runBattle(dynamicStrategy);
    expect(outcome.rejected, outcome.rejectedMessage).toBe(false);
    expect(outcome.state.phase, JSON.stringify({
      round: outcome.state.round,
      units: outcome.state.units.map((unit) => ({ id: unit.id, hp: unit.hp, disabled: unit.disabled, cell: unit.cell })),
      objectives: outcome.state.objectives,
    })).toBe("won");
    expect(outcome.state.round).toBeLessThanOrEqual(18);
    expect(outcome.state.objectives.find((objective) => objective.id === "final-seal")?.completed).toBe(true);
    expect(outcome.state.objectives.find((objective) => objective.id === "relay")?.durability).toBeGreaterThan(0);
    expect(outcome.usedSkills).toEqual(expect.arrayContaining([
      "ward", "renew", "aegis", "fracture", "pierce",
    ]));
    const settled = settleEncounter({ ...battleReady, battle: { ...battleReady.battle!, state: outcome.state } }, PYTHON_WORLD_CONTENT);
    expect(settled.battle).toBeNull();
    expect(settled.quests[0]).toEqual({ id: "marsh_heart", status: "completed", stepId: "completed" });
    expect(settled.worldFlags.marsh_heart_sealed).toBe(true);
    expect(PYTHON_WORLD_CONTENT.chapters["python-marsh-06"]?.victory.campaignComplete).toBe(true);
    expect(PYTHON_WORLD_CONTENT.chapters["python-marsh-06"]?.victory.reportStep).toBeUndefined();
  });
});
