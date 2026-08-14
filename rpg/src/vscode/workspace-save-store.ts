import type { BattleState } from "../game/combat/types";
import { LocalSaveStore } from "../app/save-store";
import type { SaveDataV2, SaveLoadResult, SaveStore } from "../app/save-store";
import type { LevelId } from "../game/content/types";
import type { CampaignId } from "../programs/types";
import type { WorkspaceState } from "./platform-types";

export function workspaceSaveKey(campaignId: CampaignId): string {
  return `${campaignId}.workspace-save`;
}

export const WORKSPACE_SAVE_KEY = workspaceSaveKey("python-rpg");

export type WorkspaceSaveDataV2 = Readonly<{
  version: 2;
  currentLevelId: LevelId;
  battleState: BattleState;
}>;

export type WorkspaceSaveInput = WorkspaceSaveDataV2 | SaveDataV2;

export class WorkspaceSaveStore implements SaveStore {
  private readonly key: string;

  constructor(
    private readonly workspaceState: WorkspaceState,
    campaignId: CampaignId = "python-rpg",
  ) {
    this.key = workspaceSaveKey(campaignId);
  }

  load(): SaveLoadResult {
    let raw: unknown;
    try {
      raw = this.workspaceState.get<unknown>(this.key);
    } catch {
      return corrupted();
    }
    if (raw === undefined) return { ok: true, save: null };
    if (!isWorkspaceSaveShape(raw)) return corrupted();

    const validated = new LocalSaveStore(new SingleValueStorage(JSON.stringify({ ...raw, codeDraft: "" }))).load();
    if (!validated.ok || validated.save === null) return corrupted();
    return { ok: true, save: validated.save };
  }

  save(value: WorkspaceSaveInput): void {
    const save: WorkspaceSaveDataV2 = {
      version: 2,
      currentLevelId: value.currentLevelId,
      battleState: value.battleState,
    };
    void this.workspaceState.update(this.key, save);
  }

  remove(): void {
    void this.workspaceState.update(this.key, undefined);
  }
}

function isWorkspaceSaveShape(value: unknown): value is WorkspaceSaveDataV2 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.version === 2
    && typeof record.currentLevelId === "string"
    && "battleState" in record
    && !Object.prototype.hasOwnProperty.call(record, "codeDraft");
}

function corrupted(): SaveLoadResult {
  return {
    ok: false,
    message: "本地存档无法读取。请输入“重置存档”后重新开始。",
  };
}

class SingleValueStorage implements Storage {
  private value: string | null;

  constructor(value: string | null) {
    this.value = value;
  }

  get length(): number {
    return this.value === null ? 0 : 1;
  }

  clear(): void {
    this.value = null;
  }

  getItem(key: string): string | null {
    return key === "python-rpg.save" ? this.value : null;
  }

  key(index: number): string | null {
    return index === 0 && this.value !== null ? "python-rpg.save" : null;
  }

  removeItem(key: string): void {
    if (key === "python-rpg.save") this.value = null;
  }

  setItem(key: string, value: string): void {
    if (key === "python-rpg.save") this.value = value;
  }
}

export type { WorkspaceState } from "./platform-types";
