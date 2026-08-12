import type { BattleState, BattleUnit, Cell, WorldUnit, WorldView } from "../combat/types";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue);
    }
  }
  return value;
}

function copyCell(cell: Cell): Cell {
  return { x: cell.x, y: cell.y };
}

function projectUnit(unit: BattleUnit): WorldUnit {
  const sharedFields = {
    id: unit.id,
    team: unit.team,
    cell: copyCell(unit.cell),
    hp: unit.hp,
    maxHp: unit.maxHp,
    disabled: unit.disabled,
    statuses: unit.statuses.map((status) => ({ ...status })),
  };

  if (unit.team === "enemies") {
    return sharedFields;
  }

  return {
    ...sharedFields,
    move: unit.move,
    attack: unit.attack,
    defense: unit.defense,
    skills: unit.skills.map(({ id, range, power, remainingCooldown, target, kind }) => ({ id, range, power, remainingCooldown, target, kind })),
  };
}

/**
 * Creates an immutable public combat projection that excludes engine-only state.
 */
export function projectWorldView(state: Readonly<BattleState>): WorldView {
  const units = state.units
    .filter((unit) => unit.team === "allies" || unit.visibility === "revealed")
    .map(projectUnit);
  const activeActorId = state.turnOrder[state.turnIndex];
  const activeUnitId = activeActorId !== undefined && units.some((unit) => unit.id === activeActorId) ? activeActorId : null;
  const view: WorldView = {
    battleId: state.battleId,
    contentVersion: state.contentVersion,
    revision: state.revision,
    round: state.round,
    activeUnitId,
    board: {
      width: state.board.width,
      height: state.board.height,
      blockedCells: state.board.blockedCells.map(copyCell),
      hazardCells: state.board.hazardCells.map(copyCell),
      coverCells: state.board.coverCells.map(copyCell),
    },
    objectives: state.objectives.map(({ id, cell, durability, completed }) => ({
      id,
      cell: copyCell(cell),
      durability,
      completed,
    })),
    units,
  };

  return deepFreeze(view);
}
