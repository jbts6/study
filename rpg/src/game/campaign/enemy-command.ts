import type { BattleState, BattleUnit, Cell, TurnCommand } from "../combat/types";
import type { LevelDefinition } from "../content/types";

/** Creates the deterministic command for the currently active enemy. */
export function enemyCommand(level: LevelDefinition, state: Readonly<BattleState>): TurnCommand {
  const actorId = state.turnOrder[state.turnIndex];
  if (actorId === undefined) throw new Error("Enemy turn has no active actor");
  const actor = state.units.find((unit) => unit.id === actorId);
  if (actor === undefined) throw new Error(`Enemy turn references missing actor: ${actorId}`);
  const behavior = level.enemyBehaviors[actorId];
  if (behavior === undefined) throw new Error(`Enemy actor has no behavior: ${actorId}`);

  switch (behavior.type) {
    case "corrupt":
      return corruptCommand(state, actor);
    case "hunt-player":
      return huntCommand(state, actor);
    case "guard":
      return guardCommand(state, actor);
  }
}

function corruptCommand(state: Readonly<BattleState>, actor: BattleUnit): TurnCommand {
  const keyObjectives = state.objectives.filter((objective) => objective.key);
  if (keyObjectives.length !== 1) throw new Error("腐化职责要求关卡恰好包含一个关键目标");
  const target = keyObjectives[0];
  if (target === undefined) throw new Error("腐化职责要求关卡恰好包含一个关键目标");
  if (target.completed) return command(state, actor.id, { type: "guard" });
  if (distance(actor.cell, target.cell) === 1) return command(state, actor.id, { type: "interact", targetId: target.id });

  const next = greedyStep(state, actor, target.cell);
  return next === undefined
    ? command(state, actor.id, { type: "guard" })
    : command(state, actor.id, distance(next, target.cell) === 1
      ? { type: "interact", targetId: target.id }
      : { type: "guard" }, [next]);
}

function huntCommand(state: Readonly<BattleState>, actor: BattleUnit): TurnCommand {
  const player = state.units.find((unit) => unit.id === "scout");
  if (player === undefined) return command(state, actor.id, { type: "guard" });
  if (distance(actor.cell, player.cell) === 1) return command(state, actor.id, { type: "attack", targetId: player.id });

  const next = greedyStep(state, actor, player.cell);
  return next === undefined
    ? command(state, actor.id, { type: "guard" })
    : command(state, actor.id, distance(next, player.cell) === 1
      ? { type: "attack", targetId: player.id }
      : { type: "guard" }, [next]);
}

function guardCommand(state: Readonly<BattleState>, actor: BattleUnit): TurnCommand {
  const player = state.units.find((unit) => unit.id === "scout");
  return player !== undefined && distance(actor.cell, player.cell) === 1
    ? command(state, actor.id, { type: "attack", targetId: player.id })
    : command(state, actor.id, { type: "guard" });
}

function command(
  state: Readonly<BattleState>,
  actorId: string,
  action: TurnCommand["action"],
  movePath?: readonly Cell[],
): TurnCommand {
  return movePath === undefined
    ? { actorId, expectedRevision: state.revision, action }
    : { actorId, expectedRevision: state.revision, movePath, action };
}

function greedyStep(state: Readonly<BattleState>, actor: BattleUnit, target: Cell): Cell | undefined {
  if (actor.move < 1) return undefined;
  const candidates = neighbors(actor.cell)
    .filter((cell) => isOpen(state, actor.id, cell))
    .sort((left, right) => compareCandidate(left, right, target));
  return candidates[0];
}

function neighbors(cell: Cell): readonly Cell[] {
  return [
    { x: cell.x - 1, y: cell.y },
    { x: cell.x + 1, y: cell.y },
    { x: cell.x, y: cell.y - 1 },
    { x: cell.x, y: cell.y + 1 },
  ];
}

function isOpen(state: Readonly<BattleState>, actorId: string, cell: Cell): boolean {
  const inBounds = cell.x >= 0 && cell.x < state.board.width && cell.y >= 0 && cell.y < state.board.height;
  return inBounds
    && !state.board.blockedCells.some((blocked) => sameCell(blocked, cell))
    && !state.units.some((unit) => unit.id !== actorId && sameCell(unit.cell, cell));
}

function compareCandidate(left: Cell, right: Cell, target: Cell): number {
  const distanceDifference = distance(left, target) - distance(right, target);
  if (distanceDifference !== 0) return distanceDifference;
  return left.y - right.y || left.x - right.x;
}

function distance(left: Cell, right: Cell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function sameCell(left: Cell, right: Cell): boolean {
  return left.x === right.x && left.y === right.y;
}
