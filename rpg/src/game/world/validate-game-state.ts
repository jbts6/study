import { getLevel } from "../content/levels";
import type { WorldCampaignContent } from "../content/world/types";
import { isBattleState } from "../combat/is-battle-state";
import type { GameState, WorldFlagValue } from "./campaign-types";

export function validateGameState(value: unknown, content: WorldCampaignContent): value is GameState {
  if (!isRecord(value)
    || value.campaignId !== "python-rpg"
    || typeof value.chapterId !== "string"
    || typeof value.locationId !== "string"
    || !isNonNegativeInteger(value.revision)
    || !isWorldFlags(value.worldFlags)
    || !isInventory(value.inventory)
    || !isQuests(value.quests)
    || !isStringList(value.discoveredClues)
    || !isBattle(value.battle, content)) return false;

  const chapter = hasOwn(content.chapters, value.chapterId) ? content.chapters[value.chapterId] : undefined;
  return chapter !== undefined
    && chapter.locationIds.includes(value.locationId)
    && hasOwn(content.locations, value.locationId);
}

function isBattle(value: unknown, content: WorldCampaignContent): boolean {
  if (value === null) return true;
  if (!isRecord(value) || typeof value.encounterId !== "string" || value.encounterId.length === 0) return false;
  const encounter = hasOwn(content.encounters, value.encounterId) ? content.encounters[value.encounterId] : undefined;
  if (encounter === undefined || !isBattleState(value.state)) return false;
  try {
    getLevel(encounter.battleLevelId);
  } catch {
    return false;
  }
  return value.state.battleId === encounter.battleId;
}

function isInventory(value: unknown): boolean {
  return Array.isArray(value)
    && value.every((item) => isRecord(item)
      && isNonEmptyString(item.id)
      && isNonNegativeInteger(item.amount));
}

function isQuests(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const questIds = new Set<string>();
  for (const quest of value) {
    if (!isRecord(quest)
      || !isNonEmptyString(quest.id)
      || !isNonEmptyString(quest.stepId)
      || (quest.status !== "locked" && quest.status !== "active" && quest.status !== "completed")
      || questIds.has(quest.id)) return false;
    questIds.add(quest.id);
  }
  return true;
}

function isWorldFlags(value: unknown): value is Readonly<Record<string, WorldFlagValue>> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((flag) => typeof flag === "boolean"
    || typeof flag === "string"
    || (typeof flag === "number" && Number.isFinite(flag)));
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
