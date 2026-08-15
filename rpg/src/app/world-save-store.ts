import { isSaveDataV2, SAVE_KEY } from "./save-store";
import type { WorldCampaignContent } from "../game/content/world/types";
import type { GameState } from "../game/world/campaign-types";
import { validateGameState } from "../game/world/validate-game-state";

export const WORLD_SAVE_KEY = "python-rpg.world-save";
export const LEGACY_WORLD_SAVE_KEY = SAVE_KEY;

export type CampaignSaveV3 = Readonly<{
  version: 3;
  gameState: GameState;
}>;

export type LocalSaveDataV3 = CampaignSaveV3 & Readonly<{
  codeDrafts: Readonly<Record<string, string>>;
}>;

export type WorkspaceSaveDataV3 = CampaignSaveV3;

export type WorldSaveLoadResult =
  | Readonly<{ ok: true; save: LocalSaveDataV3 | null }>
  | Readonly<{
      ok: false;
      reason: "legacy_v2" | "corrupt";
      message: string;
      legacyCodeDraft?: string;
    }>;

export interface WorldSaveStore {
  load(): WorldSaveLoadResult;
  save(value: LocalSaveDataV3): void;
  remove(): void;
}

const CORRUPT_MESSAGE = "本地存档无法读取。请输入“重置存档”后重新开始。";
const LEGACY_MESSAGE = "检测到旧版战斗存档。导出旧代码后开始新的世界战役。";

export class LocalWorldSaveStore implements WorldSaveStore {
  constructor(
    private readonly storage: Storage,
    private readonly content: WorldCampaignContent,
  ) {}

  load(): WorldSaveLoadResult {
    const rawWorldSave = this.storage.getItem(WORLD_SAVE_KEY);
    if (rawWorldSave !== null) return this.loadV3(rawWorldSave);

    const rawLegacySave = this.storage.getItem(LEGACY_WORLD_SAVE_KEY);
    if (rawLegacySave === null) return { ok: true, save: null };
    return this.loadLegacy(rawLegacySave);
  }

  save(value: LocalSaveDataV3): void {
    this.storage.setItem(WORLD_SAVE_KEY, JSON.stringify(value));
  }

  remove(): void {
    this.storage.removeItem(WORLD_SAVE_KEY);
    this.storage.removeItem(LEGACY_WORLD_SAVE_KEY);
  }

  private loadV3(raw: string): WorldSaveLoadResult {
    try {
      const value: unknown = JSON.parse(raw);
      return isLocalSaveDataV3(value, this.content)
        ? { ok: true, save: value }
        : corrupted();
    } catch {
      return corrupted();
    }
  }

  private loadLegacy(raw: string): WorldSaveLoadResult {
    try {
      const value: unknown = JSON.parse(raw);
      return isSaveDataV2(value)
        ? { ok: false, reason: "legacy_v2", message: LEGACY_MESSAGE, legacyCodeDraft: value.codeDraft }
        : corrupted();
    } catch {
      return corrupted();
    }
  }
}

function isLocalSaveDataV3(value: unknown, content: WorldCampaignContent): value is LocalSaveDataV3 {
  if (!isRecord(value)
    || value.version !== 3
    || !validateGameState(value.gameState, content)
    || !isRecord(value.codeDrafts)) return false;
  return Object.entries(value.codeDrafts).every(([key, draft]) => key.trim().length > 0 && typeof draft === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function corrupted(): WorldSaveLoadResult {
  return { ok: false, reason: "corrupt", message: CORRUPT_MESSAGE };
}
