import { describe, expect, it } from "vitest";
import { enemyCommand } from "../campaign/enemy-command";
import { validateLevelCommand } from "../campaign/validate-level-command";
import { resolveTurn } from "../combat/resolve-turn";
import type { BattleState, Cell, TurnCommand, WorldView } from "../combat/types";
import { injectUnlockedAbilities } from "./ability-catalog";
import { getLevel, LEVEL_ORDER } from "./levels";
import type { LevelId } from "./types";
import { projectWorldView } from "../world/project-world-view";

type ReferenceSolution = (world: WorldView) => TurnCommand;
type WorldUnit = WorldView["units"][number];

function command(world: WorldView, action: TurnCommand["action"], movePath: readonly Cell[] = []): TurnCommand {
  if (world.activeUnitId === null) throw new Error("参考解法没有可行动的单位");
  return movePath.length === 0
    ? { actorId: world.activeUnitId, expectedRevision: world.revision, action }
    : { actorId: world.activeUnitId, expectedRevision: world.revision, movePath, action };
}

function findUnit(world: WorldView, id: string): WorldUnit {
  const found = world.units.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`参考解法缺少单位: ${id}`);
  return found;
}

function findObjective(world: WorldView, id: string): NonNullable<WorldView["objectives"][number]> {
  const found = world.objectives.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`参考解法缺少目标: ${id}`);
  return found;
}

function distance(left: Cell, right: Cell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function stepToward(world: WorldView, target: Cell): readonly Cell[] {
  const scout = findUnit(world, "scout");
  if (scout.cell.x !== target.x) {
    return [{ x: scout.cell.x + Math.sign(target.x - scout.cell.x), y: scout.cell.y }];
  }
  if (scout.cell.y !== target.y) {
    return [{ x: scout.cell.x, y: scout.cell.y + Math.sign(target.y - scout.cell.y) }];
  }
  return [];
}

function actAtRange(world: WorldView, target: Cell, range: number, action: TurnCommand["action"], exact = false): TurnCommand {
  const currentDistance = distance(findUnit(world, "scout").cell, target);
  if (exact ? currentDistance === range : currentDistance <= range) return command(world, action);
  const movePath = stepToward(world, target);
  const endpoint = movePath[movePath.length - 1];
  const nextDistance = endpoint === undefined ? currentDistance : distance(endpoint, target);
  return exact ? nextDistance === range
    ? command(world, action, movePath)
    : command(world, { type: "guard" }, movePath)
    : nextDistance <= range
      ? command(world, action, movePath)
      : command(world, { type: "guard" }, movePath);
}

function skillReady(world: WorldView, skillId: string): boolean {
  return findUnit(world, "scout").skills?.some((skill) => skill.id === skillId && skill.remainingCooldown === 0) ?? false;
}

function castOrAttack(world: WorldView, targetId: string, preferredSkills: readonly string[]): TurnCommand {
  const target = findUnit(world, targetId);
  const skill = preferredSkills
    .map((skillId) => findUnit(world, "scout").skills?.find((candidate) => candidate.id === skillId && candidate.remainingCooldown === 0))
    .find((candidate) => candidate !== undefined);
  if (skill !== undefined) {
    const currentCell = findUnit(world, "scout").cell;
    if (distance(currentCell, target.cell) <= skill.range) return command(world, { type: "cast", skillId: skill.id, targetId });
    const movePath = stepToward(world, target.cell);
    const endpoint = movePath[movePath.length - 1];
    return endpoint !== undefined && distance(endpoint, target.cell) <= skill.range
      ? command(world, { type: "cast", skillId: skill.id, targetId }, movePath)
      : command(world, { type: "guard" }, movePath);
  }
  const currentCell = findUnit(world, "scout").cell;
  if (distance(currentCell, target.cell) === 1) return command(world, { type: "attack", targetId });
  const movePath = stepToward(world, target.cell);
  const endpoint = movePath[movePath.length - 1];
  return endpoint !== undefined && distance(endpoint, target.cell) === 1
    ? command(world, { type: "attack", targetId }, movePath)
    : command(world, { type: "guard" }, movePath);
}

function interactWith(world: WorldView, objectiveId: string): TurnCommand {
  const target = findObjective(world, objectiveId);
  return actAtRange(world, target.cell, 1, { type: "interact", targetId: objectiveId }, true);
}

function selfCastOrGuard(world: WorldView, skillIds: readonly string[]): TurnCommand {
  for (const skillId of skillIds) {
    if (skillReady(world, skillId)) return command(world, { type: "cast", skillId, targetId: "scout" });
  }
  return command(world, { type: "guard" });
}

const REFERENCE_SOLUTIONS: Readonly<Record<LevelId, ReferenceSolution>> = {
  "python-marsh-01": (world) => castOrAttack(world, "golem", ["spark"]),
  "python-marsh-02": (world) => {
    const scout = findUnit(world, "scout");
    const corruptor = findUnit(world, "corruptor");
    if (corruptor.hp === 8 && scout.cell.x === 0 && scout.cell.y === 0) return command(world, { type: "guard" }, [{ x: 1, y: 0 }, { x: 1, y: 1 }]);
    if (corruptor.hp === 8 && scout.cell.x === 1 && scout.cell.y === 1) return command(world, { type: "guard" }, [{ x: 1, y: 2 }]);
    if (corruptor.hp === 8 && scout.cell.x === 1 && scout.cell.y === 2) return castOrAttack(world, "corruptor", ["spark"]);
    if (corruptor.hp === 5 && scout.cell.x === 1 && scout.cell.y === 2) return castOrAttack(world, "corruptor", []);
    return castOrAttack(world, "corruptor", ["spark"]);
  },
  "python-marsh-03": (world) => {
    const hunterA = findUnit(world, "hunter-a");
    if (!hunterA.disabled) return castOrAttack(world, "hunter-a", ["spark"]);
    if (!findObjective(world, "scout-mark").completed) return interactWith(world, "scout-mark");
    return castOrAttack(world, "hunter-b", ["spark"]);
  },
  "python-marsh-04": (world) => {
    const corruptor = findUnit(world, "corruptor");
    if (!corruptor.disabled) return castOrAttack(world, "corruptor", ["spark"]);
    if (!findObjective(world, "seal").completed) return interactWith(world, "seal");
    return castOrAttack(world, "guard", ["pierce", "spark"]);
  },
  "python-marsh-05": (world) => {
    if (!findObjective(world, "node-a").completed) return interactWith(world, "node-a");
    if (!findObjective(world, "node-b").completed) return interactWith(world, "node-b");
    const hunter = findUnit(world, "hunter");
    if (!hunter.disabled) return castOrAttack(world, "hunter", ["pierce", "spark"]);
    const guard = findUnit(world, "guard");
    if (!guard.disabled && skillReady(world, "fracture") && !guard.statuses.some((status) => status.id === "fracture")) {
      const scout = findUnit(world, "scout");
      if (scout.cell.x === 1 && scout.cell.y === 0) return command(world, { type: "guard" }, [{ x: 1, y: 1 }]);
      if (scout.cell.x === 1 && scout.cell.y === 1) return command(world, { type: "guard" }, [{ x: 2, y: 1 }]);
      return castOrAttack(world, "guard", ["fracture"]);
    }
    return castOrAttack(world, "guard", ["spark", "pierce"]);
  },
  "python-marsh-06": (world) => {
    const scout = findUnit(world, "scout");
    const corruptor = findUnit(world, "corruptor");
    if (!corruptor.disabled) {
      if (corruptor.hp === 6 && skillReady(world, "ward")) return selfCastOrGuard(world, ["ward"]);
      return castOrAttack(world, "corruptor", ["spark"]);
    }
    const hunter = findUnit(world, "hunter");
    if (!hunter.disabled) {
      if (hunter.hp === 5 && skillReady(world, "renew")) return selfCastOrGuard(world, ["renew"]);
      return castOrAttack(world, "hunter", ["pierce", "spark"]);
    }
    if (!findObjective(world, "final-seal").completed) {
      if (scout.cell.x === 1 && scout.cell.y === 0 && skillReady(world, "aegis") && !scout.statuses.some((status) => status.id === "aegis")) {
        return selfCastOrGuard(world, ["aegis"]);
      }
      return interactWith(world, "final-seal");
    }
    const guard = findUnit(world, "guard");
    if (!guard.disabled && skillReady(world, "fracture") && !guard.statuses.some((status) => status.id === "fracture")) {
      return castOrAttack(world, "guard", ["fracture"]);
    }
    if (!guard.disabled) return castOrAttack(world, "guard", ["spark", "pierce"]);
    return selfCastOrGuard(world, ["aegis", "renew", "ward"]);
  },
};

function parseInstruction(input: TurnCommand): TurnCommand {
  return JSON.parse(JSON.stringify(input)) as TurnCommand;
}

function activeUnit(state: BattleState): WorldUnit | undefined {
  return state.units.find((unit) => unit.id === state.turnOrder[state.turnIndex]);
}

function runReferenceSolution(levelId: LevelId): BattleState {
  const level = getLevel(levelId);
  let state = injectUnlockedAbilities(levelId, structuredClone(level.initialBattle));

  for (let playerTurn = 0; state.phase === "in_progress" && playerTurn <= level.initialBattle.maxRounds; playerTurn += 1) {
    const beforeWorld = projectWorldView(state);
    const instruction = parseInstruction(REFERENCE_SOLUTIONS[levelId](beforeWorld));
    const levelValidation = validateLevelCommand(level, state, instruction);
    if (!levelValidation.accepted) throw new Error(levelValidation.errors[0]?.message ?? "参考解法违反关卡规则");
    const playerResolution = resolveTurn(state, levelValidation.command);
    if (!playerResolution.accepted) throw new Error(playerResolution.errors[0]?.message ?? "参考解法被战斗内核拒绝");
    state = playerResolution.state;

    while (state.phase === "in_progress" && activeUnit(state)?.team === "enemies") {
      const enemy = enemyCommand(level, state);
      const enemyValidation = validateLevelCommand(level, state, enemy);
      if (!enemyValidation.accepted) throw new Error(enemyValidation.errors[0]?.message ?? "敌方职责指令被拒绝");
      const enemyResolution = resolveTurn(state, enemyValidation.command);
      if (!enemyResolution.accepted) throw new Error(enemyResolution.errors[0]?.message ?? "敌方职责指令无法结算");
      state = enemyResolution.state;
    }
  }
  return state;
}

describe("campaign reference solutions", () => {
  it.each(LEVEL_ORDER)("can complete %s through the production turn pipeline", (levelId) => {
    const level = getLevel(levelId);
    const result = runReferenceSolution(levelId);
    expect(result.phase).toBe("won");
    expect(result.round).toBeLessThanOrEqual(level.initialBattle.maxRounds);
    expect(result.objectives.filter((objective) => !objective.key).every((objective) => objective.completed)).toBe(true);
  });
});
