import { isSaveDataV2 } from "../app/save-store";
import type {
  LocalSaveDataV3,
  WorkspaceSaveDataV3,
  WorldSaveLoadResult,
  WorldSaveStore,
} from "../app/world-save-store";
import { validateGameState } from "../game/world/validate-game-state";
import type { WorldCampaignContent } from "../game/content/world/types";
import type { CampaignId } from "../programs/types";
import type { WorkspaceState } from "./platform-types";

export function workspaceWorldSaveKey(campaignId: CampaignId): string {
  return `${campaignId}.workspace-save`;
}

export const WORKSPACE_WORLD_SAVE_KEY = workspaceWorldSaveKey("python-rpg");
export const workspaceSaveKey = workspaceWorldSaveKey;
export const WORKSPACE_SAVE_KEY = WORKSPACE_WORLD_SAVE_KEY;

export class WorkspaceWorldSaveStore implements WorldSaveStore {
  private readonly key: string;

  constructor(
    private readonly workspaceState: WorkspaceState,
    private readonly content: WorldCampaignContent,
    campaignId: CampaignId = "python-rpg",
  ) {
    this.key = workspaceWorldSaveKey(campaignId);
  }

  load(): WorldSaveLoadResult {
    let raw: unknown;
    try {
      raw = this.workspaceState.get<unknown>(this.key);
    } catch {
      return corrupted();
    }
    if (raw === undefined) return { ok: true, save: null };

    const value = parseStoredValue(raw);
    if (value === null) return corrupted();
    if (isWorkspaceSaveDataV3(value, this.content)) {
      return { ok: true, save: { ...value, codeDrafts: {} } };
    }
    if (isWorkspaceSaveDataV2(value)) return legacyV2();
    return corrupted();
  }

  save(value: LocalSaveDataV3): void {
    const save: WorkspaceSaveDataV3 = {
      version: 3,
      gameState: value.gameState,
    };
    void this.workspaceState.update(this.key, save);
  }

  remove(): void {
    void this.workspaceState.update(this.key, undefined);
  }
}

function parseStoredValue(raw: unknown): unknown | null {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isWorkspaceSaveDataV3(value: unknown, content: WorldCampaignContent): value is WorkspaceSaveDataV3 {
  return isRecord(value)
    && value.version === 3
    && validateGameState(value.gameState, content);
}

function isWorkspaceSaveDataV2(value: unknown): boolean {
  if (!isRecord(value)
    || value.version !== 2
    || typeof value.currentLevelId !== "string"
    || !Object.prototype.hasOwnProperty.call(value, "battleState")
    || Object.prototype.hasOwnProperty.call(value, "codeDraft")) return false;
  return isSaveDataV2({ ...value, codeDraft: "" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function legacyV2(): WorldSaveLoadResult {
  return {
    ok: false,
    reason: "legacy_v2",
    message: "检测到旧版战斗存档。导出旧代码后开始新的世界战役。",
  };
}

function corrupted(): WorldSaveLoadResult {
  return {
    ok: false,
    reason: "corrupt",
    message: "本地存档无法读取。请输入“重置存档”后重新开始。",
  };
}
