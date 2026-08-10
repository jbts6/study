import { xorshift32 } from "./types";
import type {
  BattleEvent,
  BattleEventPayload,
  BattlePhase,
  BattleState,
  BattleUnit,
  Cell,
  MainAction,
  Objective,
  ReducedBattle,
  Skill,
  Status,
  TurnCommand,
} from "./types";

type Draft = {
  units: readonly BattleUnit[];
  objectives: readonly Objective[];
  rngState: number;
  disabledIds: readonly string[];
};

/** Reduces one already-validated turn command without mutating its inputs. */
export function reduceBattle(state: Readonly<BattleState>, command: TurnCommand): ReducedBattle {
  const stateRevision = state.revision + 1;
  const events: BattleEvent[] = [];
  let draft: Draft = { units: state.units, objectives: state.objectives, rngState: state.rngState, disabledIds: [] };
  draft = expireStatuses(draft, command.actorId, events, stateRevision);

  const beforeMove = requireUnit(draft.units, command.actorId);
  const destination = command.movePath?.[command.movePath.length - 1];
  if (destination !== undefined) {
    draft = { ...draft, units: replaceUnit(draft.units, command.actorId, { cell: copyCell(destination) }) };
    emit(events, stateRevision, "moved", { actorId: command.actorId, from: copyCell(beforeMove.cell), to: copyCell(destination) });
  }

  const actionResult = reduceAction(draft, command.actorId, command.action, state.board, events, stateRevision);
  draft = applyHazard(actionResult.draft, command.actorId, state, events, stateRevision);
  draft = advanceCooldowns(draft, command.actorId, actionResult.castSkillId, events, stateRevision);
  emitDisabled(events, stateRevision, draft.disabledIds);

  const next = nextTurn(state);
  const phase = determinePhase(draft, state, next.round);
  if (phase !== "in_progress") emit(events, stateRevision, "battle_finished", { outcome: phase });
  emit(events, stateRevision, "turn_advanced", { round: next.round, turnIndex: next.turnIndex, activeUnitId: next.activeUnitId });

  return {
    state: {
      ...state,
      revision: stateRevision,
      round: next.round,
      turnIndex: next.turnIndex,
      phase,
      units: draft.units,
      objectives: draft.objectives,
      rngState: draft.rngState,
    },
    events,
  };
}

function reduceAction(
  draft: Draft,
  actorId: string,
  action: MainAction,
  board: BattleState["board"],
  events: BattleEvent[],
  stateRevision: number,
): Readonly<{ draft: Draft; castSkillId?: string }> {
  const actor = requireUnit(draft.units, actorId);
  switch (action.type) {
    case "attack":
      return { draft: damage(draft, actor, requireUnit(draft.units, action.targetId), 0, board, events, stateRevision) };
    case "cast":
      return reduceCast(draft, actor, action, board, events, stateRevision);
    case "interact":
      return { draft: interact(draft, actor, action.targetId, events, stateRevision) };
    case "guard":
      return { draft: guard(draft, actor, events, stateRevision) };
    case "wait":
      return { draft };
  }
}

function reduceCast(
  draft: Draft,
  actor: BattleUnit,
  action: Extract<MainAction, { type: "cast" }>,
  board: BattleState["board"],
  events: BattleEvent[],
  stateRevision: number,
): Readonly<{ draft: Draft; castSkillId: string }> {
  const skill = requireSkill(actor, action.skillId);
  const target = action.targetId === undefined
    ? requireCellOccupant(draft.units, action.targetCell as Cell)
    : requireUnit(draft.units, action.targetId);
  let next = skill.kind === "damage"
    ? damage(draft, actor, target, skill.power, board, events, stateRevision)
    : heal(draft, actor, target, skill.power, events, stateRevision);
  next = applyEffect(next, target.id, skill.effect, events, stateRevision);
  next = setCooldown(next, actor.id, skill.id, skill.cooldown);
  return { draft: next, castSkillId: skill.id };
}

function expireStatuses(draft: Draft, actorId: string, events: BattleEvent[], stateRevision: number): Draft {
  const actor = requireUnit(draft.units, actorId);
  const expired = actor.statuses.filter((status) => status.remainingTurns <= 1).sort(compareStatus);
  for (const status of expired) emit(events, stateRevision, "status_removed", { unitId: actor.id, statusId: status.id });
  const statuses = actor.statuses
    .filter((status) => status.remainingTurns > 1)
    .map((status) => ({ ...status, remainingTurns: status.remainingTurns - 1 }))
    .sort(compareStatus);
  return { ...draft, units: replaceUnit(draft.units, actor.id, { statuses }) };
}

function damage(
  draft: Draft,
  actor: BattleUnit,
  target: BattleUnit,
  power: number,
  board: BattleState["board"],
  events: BattleEvent[],
  stateRevision: number,
): Draft {
  const coverBonus = isCovered(board.coverCells, target.cell) ? 1 : 0;
  const defense = target.defense + target.statuses.reduce((total, status) => total + status.defenseBonus, 0);
  const amount = Math.max(1, actor.attack + power - defense - coverBonus);
  const hpAfter = Math.max(0, target.hp - amount);
  const disabled = hpAfter === 0;
  const units = replaceUnit(draft.units, target.id, { hp: hpAfter, disabled: target.disabled || disabled });
  emit(events, stateRevision, "damaged", { sourceId: actor.id, targetId: target.id, amount, hpAfter, coverBonus });
  return disabled && !target.disabled ? { ...draft, units, disabledIds: appendUnique(draft.disabledIds, target.id) } : { ...draft, units };
}

function heal(draft: Draft, actor: BattleUnit, target: BattleUnit, power: number, events: BattleEvent[], stateRevision: number): Draft {
  const hpAfter = Math.min(target.maxHp, target.hp + power);
  emit(events, stateRevision, "healed", { sourceId: actor.id, targetId: target.id, amount: hpAfter - target.hp, hpAfter });
  return { ...draft, units: replaceUnit(draft.units, target.id, { hp: hpAfter }) };
}

function applyEffect(draft: Draft, targetId: string, effect: Skill["effect"], events: BattleEvent[], stateRevision: number): Draft {
  if (effect === undefined) return draft;
  const random = Object.hasOwn(effect, "chancePermille") ? xorshift32(draft.rngState) : undefined;
  const next = random === undefined ? draft : { ...draft, rngState: random.nextState };
  if (random !== undefined && !(random.value % 1000 < effect.chancePermille!)) return next;
  const target = requireUnit(next.units, targetId);
  const status: Status = { id: effect.statusId, remainingTurns: effect.duration, defenseBonus: effect.defenseBonus };
  const statuses = [...target.statuses.filter((current) => current.id !== status.id), status].sort(compareStatus);
  emit(events, stateRevision, "status_added", { unitId: target.id, statusId: status.id, remainingTurns: status.remainingTurns, defenseBonus: status.defenseBonus });
  return { ...next, units: replaceUnit(next.units, target.id, { statuses }) };
}

function guard(draft: Draft, actor: BattleUnit, events: BattleEvent[], stateRevision: number): Draft {
  const status: Status = { id: "guarded", remainingTurns: 1, defenseBonus: 2 };
  const statuses = [...actor.statuses.filter((current) => current.id !== status.id), status].sort(compareStatus);
  emit(events, stateRevision, "status_added", { unitId: actor.id, statusId: status.id, remainingTurns: status.remainingTurns, defenseBonus: status.defenseBonus });
  return { ...draft, units: replaceUnit(draft.units, actor.id, { statuses }) };
}

function interact(draft: Draft, actor: BattleUnit, targetId: string, events: BattleEvent[], stateRevision: number): Draft {
  const target = requireObjective(draft.objectives, targetId);
  const durabilityAfter = Math.max(0, target.durability - 1);
  const completed = durabilityAfter === 0;
  const objectives = draft.objectives.map((objective) => objective.id === target.id ? { ...objective, durability: durabilityAfter, completed } : objective);
  emit(events, stateRevision, "interacted", { actorId: actor.id, targetId: target.id, durabilityAfter });
  emit(events, stateRevision, "objective_progressed", { targetId: target.id, durabilityAfter, completed });
  return { ...draft, objectives };
}

function applyHazard(draft: Draft, actorId: string, state: BattleState, events: BattleEvent[], stateRevision: number): Draft {
  const actor = requireUnit(draft.units, actorId);
  if (!isCovered(state.board.hazardCells, actor.cell)) return draft;
  const hpAfter = Math.max(0, actor.hp - state.board.hazardDamage);
  const disabled = hpAfter === 0;
  const units = replaceUnit(draft.units, actor.id, { hp: hpAfter, disabled: actor.disabled || disabled });
  emit(events, stateRevision, "damaged", { sourceId: "hazard", targetId: actor.id, amount: state.board.hazardDamage, hpAfter, coverBonus: 0 });
  return disabled && !actor.disabled ? { ...draft, units, disabledIds: appendUnique(draft.disabledIds, actor.id) } : { ...draft, units };
}

function advanceCooldowns(draft: Draft, actorId: string, castSkillId: string | undefined, events: BattleEvent[], stateRevision: number): Draft {
  const actor = requireUnit(draft.units, actorId);
  let changed = false;
  const skills = actor.skills.map((skill) => {
    const remainingCooldown = skill.id === castSkillId ? skill.remainingCooldown : Math.max(0, skill.remainingCooldown - 1);
    if (remainingCooldown === skill.remainingCooldown && skill.id !== castSkillId) return skill;
    changed = true;
    emit(events, stateRevision, "cooldown_changed", { unitId: actor.id, skillId: skill.id, remainingCooldown });
    return { ...skill, remainingCooldown };
  });
  return changed ? { ...draft, units: replaceUnit(draft.units, actor.id, { skills }) } : draft;
}

function setCooldown(draft: Draft, actorId: string, skillId: string, remainingCooldown: number): Draft {
  const actor = requireUnit(draft.units, actorId);
  const skills = actor.skills.map((skill) => skill.id === skillId ? { ...skill, remainingCooldown } : skill);
  return { ...draft, units: replaceUnit(draft.units, actorId, { skills }) };
}

function emitDisabled(events: BattleEvent[], stateRevision: number, disabledIds: readonly string[]): void {
  for (const unitId of disabledIds) emit(events, stateRevision, "unit_disabled", { unitId });
}

function determinePhase(draft: Draft, state: BattleState, nextRound: number): BattlePhase {
  const hasEnemy = draft.units.some((unit) => unit.team === "enemies" && !unit.disabled);
  if (!hasEnemy) return "won";
  const hasAlly = draft.units.some((unit) => unit.team === "allies" && !unit.disabled);
  const keyDestroyed = state.failureConditions.keyObjectiveDestroyed
    && draft.objectives.some((objective) => objective.key && objective.durability === 0);
  return !hasAlly || keyDestroyed || nextRound > state.maxRounds ? "lost" : "in_progress";
}

function nextTurn(state: BattleState): Readonly<{ round: number; turnIndex: number; activeUnitId: string }> {
  const turnIndex = (state.turnIndex + 1) % state.turnOrder.length;
  const round = state.round + (turnIndex === 0 ? 1 : 0);
  return { round, turnIndex, activeUnitId: state.turnOrder[turnIndex] as string };
}

function emit(events: BattleEvent[], stateRevision: number, type: BattleEvent["type"], payload: BattleEventPayload): void {
  events.push({ protocolVersion: 1, seq: events.length + 1, stateRevision, type, payload });
}

function replaceUnit(units: readonly BattleUnit[], id: string, update: Partial<BattleUnit>): readonly BattleUnit[] {
  return units.map((unit) => unit.id === id ? { ...unit, ...update } : unit);
}

function requireUnit(units: readonly BattleUnit[], id: string): BattleUnit {
  const unit = units.find((candidate) => candidate.id === id);
  if (unit === undefined) throw new Error(`Validated command references missing unit: ${id}`);
  return unit;
}

function requireCellOccupant(units: readonly BattleUnit[], cell: Cell): BattleUnit {
  const unit = units.find((candidate) => sameCell(candidate.cell, cell));
  if (unit === undefined) throw new Error("Validated cell target has no occupant");
  return unit;
}

function requireSkill(actor: BattleUnit, id: string): Skill {
  const skill = actor.skills.find((candidate) => candidate.id === id);
  if (skill === undefined) throw new Error(`Validated command references missing skill: ${id}`);
  return skill;
}

function requireObjective(objectives: readonly Objective[], id: string): Objective {
  const objective = objectives.find((candidate) => candidate.id === id);
  if (objective === undefined) throw new Error(`Validated command references missing objective: ${id}`);
  return objective;
}

function isCovered(cells: readonly Cell[], cell: Cell): boolean {
  return cells.some((candidate) => sameCell(candidate, cell));
}

function sameCell(left: Cell, right: Cell): boolean {
  return left.x === right.x && left.y === right.y;
}

function copyCell(cell: Cell): Cell {
  return { x: cell.x, y: cell.y };
}

function compareStatus(left: Status, right: Status): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function appendUnique(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids : [...ids, id];
}
