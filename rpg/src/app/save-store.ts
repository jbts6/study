import type { BattleState } from "../game/combat/types";
import { isBattleState } from "../game/combat/is-battle-state";
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
export function isSaveDataV2(value: unknown): value is SaveDataV2 {
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
