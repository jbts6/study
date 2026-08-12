import type { BattleState, BattleUnit, Cell, Objective, Skill, SkillEffect, Status } from "../game/combat/types";
import { getLevel } from "../game/content/levels";
import type { LevelId } from "../game/content/types";

export const SAVE_KEY = "python-rpg.save";
export const RESET_CONFIRMATION = "重置存档";

export type SaveDataV2 = Readonly<{
  version: 2;
  currentLevelId: LevelId;
  battleState: BattleState;
  codeDraft: string;
}>;

export type SaveLoadResult =
  | Readonly<{ ok: true; save: SaveDataV2 | null }>
  | Readonly<{ ok: false; message: string }>;

export interface SaveStore {
  load(): SaveLoadResult;
  save(value: SaveDataV2): void;
  remove(): void;
}

export class LocalSaveStore implements SaveStore {
  constructor(private readonly storage: Storage) {}

  load(): SaveLoadResult {
    const raw = this.storage.getItem(SAVE_KEY);
    if (raw === null) return { ok: true, save: null };
    try {
      const value: unknown = JSON.parse(raw);
      return isSaveDataV2(value)
        ? { ok: true, save: value }
        : corrupted();
    } catch {
      return corrupted();
    }
  }

  save(value: SaveDataV2): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(value));
  }

  remove(): void {
    this.storage.removeItem(SAVE_KEY);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value >= 1;
}

function isCell(value: unknown): value is Cell {
  return isRecord(value) && Number.isInteger(value.x) && Number.isInteger(value.y);
}

function isStatus(value: unknown): value is Status {
  return isRecord(value)
    && typeof value.id === "string"
    && Number.isInteger(value.remainingTurns)
    && isFiniteNumber(value.defenseBonus);
}

function isSkillEffect(value: unknown): value is SkillEffect {
  return isRecord(value)
    && typeof value.statusId === "string"
    && isFiniteNumber(value.duration)
    && Number.isInteger(value.duration)
    && value.duration >= 1
    && isFiniteNumber(value.defenseBonus)
    && (value.chancePermille === undefined
      || (isFiniteNumber(value.chancePermille)
        && Number.isInteger(value.chancePermille)
        && value.chancePermille >= 0
        && value.chancePermille <= 1_000));
}

function isSkill(value: unknown): value is Skill {
  return isRecord(value)
    && typeof value.id === "string"
    && isFiniteNumber(value.range)
    && isFiniteNumber(value.power)
    && isFiniteNumber(value.cooldown)
    && isFiniteNumber(value.remainingCooldown)
    && (value.target === "unit" || value.target === "cell")
    && (value.kind === "damage" || value.kind === "heal")
    && (value.effect === undefined || isSkillEffect(value.effect));
}

function isUnit(value: unknown): value is BattleUnit {
  return isRecord(value)
    && typeof value.id === "string"
    && (value.team === "allies" || value.team === "enemies")
    && (value.visibility === "revealed" || value.visibility === "hidden")
    && isCell(value.cell)
    && isFiniteNumber(value.hp)
    && isFiniteNumber(value.maxHp)
    && isFiniteNumber(value.attack)
    && isFiniteNumber(value.defense)
    && isFiniteNumber(value.move)
    && isFiniteNumber(value.initiative)
    && typeof value.disabled === "boolean"
    && Array.isArray(value.skills)
    && value.skills.every(isSkill)
    && Array.isArray(value.statuses)
    && value.statuses.every(isStatus);
}

function isObjective(value: unknown): value is Objective {
  return isRecord(value)
    && typeof value.id === "string"
    && isCell(value.cell)
    && isFiniteNumber(value.durability)
    && typeof value.completed === "boolean"
    && typeof value.key === "boolean";
}

function isBattleState(value: unknown): value is BattleState {
  if (!isRecord(value)
    || typeof value.battleId !== "string"
    || typeof value.contentVersion !== "string"
    || !isNonNegativeInteger(value.revision)
    || !isPositiveInteger(value.round)
    || !isNonNegativeInteger(value.turnIndex)
    || !Array.isArray(value.turnOrder)
    || value.turnOrder.length === 0
    || !value.turnOrder.every((unitId) => typeof unitId === "string")
    || (value.phase !== "in_progress" && value.phase !== "won" && value.phase !== "lost")
    || !Array.isArray(value.units)
    || !value.units.every(isUnit)
    || !isBoard(value.board)
    || !Array.isArray(value.objectives)
    || !value.objectives.every(isObjective)
    || !isNonNegativeInteger(value.rngState)
    || !isPositiveInteger(value.maxRounds)
    || !isFailureConditions(value.failureConditions)) return false;

  const unitIds = value.units.map((unit) => unit.id);
  const uniqueUnitIds = new Set(unitIds);
  if (uniqueUnitIds.size !== unitIds.length || value.turnIndex >= value.turnOrder.length) return false;
  if (!value.turnOrder.every((unitId) => uniqueUnitIds.has(unitId))) return false;
  const activeId = value.turnOrder[value.turnIndex];
  const activeUnit = value.units.find((unit) => unit.id === activeId);
  return value.phase !== "in_progress" || (activeUnit !== undefined && !activeUnit.disabled);
}

function isBoard(value: unknown): boolean {
  return isRecord(value)
    && isPositiveInteger(value.width)
    && isPositiveInteger(value.height)
    && Array.isArray(value.blockedCells)
    && value.blockedCells.every(isCell)
    && Array.isArray(value.hazardCells)
    && value.hazardCells.every(isCell)
    && Array.isArray(value.coverCells)
    && value.coverCells.every(isCell)
    && isNonNegativeInteger(value.hazardDamage);
}

function isFailureConditions(value: unknown): boolean {
  return isRecord(value) && typeof value.keyObjectiveDestroyed === "boolean";
}

function isSaveDataV2(value: unknown): value is SaveDataV2 {
  if (!isRecord(value)
    || value.version !== 2
    || typeof value.currentLevelId !== "string"
    || typeof value.codeDraft !== "string"
    || !isBattleState(value.battleState)) return false;
  try {
    return getLevel(value.currentLevelId as LevelId).id === value.currentLevelId
      && value.battleState.battleId === value.currentLevelId;
  } catch {
    return false;
  }
}

function corrupted(): SaveLoadResult {
  return {
    ok: false,
    message: "本地存档无法读取。请输入“重置存档”后重新开始。",
  };
}
