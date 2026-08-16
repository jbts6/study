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

type Strategy = (state: BattleState) => TurnCommand;

function command(state: BattleState, action: TurnCommand["action"], movePath?: { x: number; y: number }[]): TurnCommand {
  return { actorId: "scout", expectedRevision: state.revision, ...(movePath === undefined ? {} : { movePath }), action };
}

function pathToward(state: BattleState, target: { x: number; y: number }): { x: number; y: number }[] {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const blocked = (cell: { x: number; y: number }) => state.units.some((unit) => unit.id !== "scout" && unit.cell.x === cell.x && unit.cell.y === cell.y);
  const distance = (cell: { x: number; y: number }) => Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y);
  const start = { x: scout.cell.x, y: scout.cell.y };
  const steps = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => ({ dx, dy }));
  let best: { x: number; y: number }[] | undefined;
  const consider = (path: { x: number; y: number }[]) => {
    if (!path.every((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < state.board.width && cell.y < state.board.height && !blocked(cell))) return;
    if (best === undefined || distance(path[path.length - 1]!) < distance(best[best.length - 1]!)) best = path;
  };
  for (const first of steps) {
    const p1 = { x: start.x + first.dx, y: start.y + first.dy };
    consider([p1]);
    for (const second of steps) consider([p1, { x: p1.x + second.dx, y: p1.y + second.dy }]);
  }
  return best ?? [];
}

function simulate(strategy: Strategy): { phase: BattleState["phase"], markCompleted: boolean } {
  const encounter = PYTHON_WORLD_CONTENT.encounters.survey_pack!;
  const level = { ...getLevel("python-marsh-03"), enemyBehaviors: { ...getLevel("python-marsh-03").enemyBehaviors, ...encounter.enemyBehaviors } };
  let state = structuredClone(encounter.initialBattle);
  for (let safety = 0; safety < 48 && state.phase === "in_progress"; safety += 1) {
    const active = state.units.find((unit) => unit.id === state.turnOrder[state.turnIndex]);
    if (active === undefined) break;
    if (active.team === "allies") {
      const validation = validateLevelCommand(level, state, strategy(state));
      if (!validation.accepted) return { phase: "lost", markCompleted: state.objectives.find((o) => o.id === "scout-mark")?.completed ?? false };
      const resolution = resolveTurn(state, validation.command);
      if (!resolution.accepted) return { phase: "lost", markCompleted: false };
      state = resolution.state;
    } else {
      const enemy = enemyCommand(level, state);
      const validation = validateLevelCommand(level, state, enemy);
      if (!validation.accepted) break;
      const resolution = resolveTurn(state, validation.command);
      if (!resolution.accepted) break;
      state = resolution.state;
    }
  }
  return { phase: state.phase, markCompleted: state.objectives.find((o) => o.id === "scout-mark")?.completed ?? false };
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

  it("rejects fixed hunter-a focus after the target is disabled", () => {
    const outcome = simulate((state) => {
      const scout = state.units.find((unit) => unit.id === "scout")!;
      const hunter = state.units.find((unit) => unit.id === "hunter-a")!;
      if (Math.abs(scout.cell.x - hunter.cell.x) + Math.abs(scout.cell.y - hunter.cell.y) === 1) return command(state, { type: "attack", targetId: "hunter-a" });
      return command(state, { type: "guard" }, pathToward(state, hunter.cell));
    });
    expect(outcome.phase).toBe("lost");
  });

  it("wins with mark-first lowest-hp strategy", () => {
    const outcome = simulate((state) => {
      const scout = state.units.find((unit) => unit.id === "scout")!;
      const mark = state.objectives.find((objective) => objective.id === "scout-mark")!;
      const markDistance = Math.abs(scout.cell.x - mark.cell.x) + Math.abs(scout.cell.y - mark.cell.y);
      if (!mark.completed) {
        if (markDistance === 1) return command(state, { type: "interact", targetId: "scout-mark" });
        return command(state, { type: "interact", targetId: "scout-mark" }, pathToward(state, { x: 0, y: 1 }));
      }
      const enemies = state.units.filter((unit) => unit.team === "enemies" && !unit.disabled).sort((a, b) => a.hp - b.hp);
      const ward = scout.skills.find((skill) => skill.id === "ward")!;
      const mend = scout.skills.find((skill) => skill.id === "mend")!;
      const spark = scout.skills.find((skill) => skill.id === "spark")!;
      const ranged = spark.remainingCooldown === 0
        ? enemies.find((enemy) => Math.abs(scout.cell.x - enemy.cell.x) + Math.abs(scout.cell.y - enemy.cell.y) <= 2)
        : undefined;
      const adjacentEnemy = enemies.find((enemy) => Math.abs(scout.cell.x - enemy.cell.x) + Math.abs(scout.cell.y - enemy.cell.y) === 1);
      const target = ranged ?? adjacentEnemy ?? enemies[0];
      if (target === undefined) return command(state, { type: "wait" });
      if (ward.remainingCooldown === 0 && (scout.hp <= 3
        || (scout.hp === 4 && enemies.every((enemy) => enemy.hp > 4)))) {
        return command(state, { type: "cast", skillId: "ward", targetId: "scout" });
      }
      if (scout.hp <= 3 && mend.remainingCooldown === 0) {
        return command(state, { type: "cast", skillId: "mend", targetId: "scout" });
      }
      const distance = Math.abs(scout.cell.x - target.cell.x) + Math.abs(scout.cell.y - target.cell.y);
      if (distance === 1) {
        const escape = target.hp <= 4 ? pathToward(state, { x: 0, y: 1 }) : [];
        if (target.hp <= 2 && escape.length > 0) {
          const spark = scout.skills.find((skill) => skill.id === "spark")!;
          if (spark.remainingCooldown === 0) {
            return command(state, { type: "cast", skillId: "spark", targetId: target.id }, escape);
          }
        }
        return command(state, { type: "attack", targetId: target.id }, escape);
      }
      if (distance <= 2 && spark.remainingCooldown === 0) return command(state, { type: "cast", skillId: "spark", targetId: target.id });
      if (scout.hp <= 3 && ward.remainingCooldown === 0) {
        return command(state, { type: "cast", skillId: "ward", targetId: "scout" });
      }
      const route = pathToward(state, target.cell);
      if (distance > 2 && route.length === 0) {
        const adjacent = enemies.find((enemy) => Math.abs(scout.cell.x - enemy.cell.x) + Math.abs(scout.cell.y - enemy.cell.y) === 1);
        if (adjacent !== undefined) return command(state, { type: "attack", targetId: adjacent.id });
      }
      const safeTarget = target.id === "hunter-a"
        && !target.disabled ? { x: 0, y: 0 } : target.cell;
      return command(state, { type: "guard" }, pathToward(state, safeTarget));
    });
    expect(outcome.phase).toBe("won");
    expect(outcome.markCompleted).toBe(true);
  });
});
