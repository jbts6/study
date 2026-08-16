import { describe, expect, it } from "vitest";
import { PYTHON_RPG_CAMPAIGN } from "../game/content/python/levels";
import type { WorkspaceState } from "./platform-types";
import {
  PLAYER_FILESET_VERSION,
  ensureCurrentPlayerFiles,
  playerFilesetVersionKey,
} from "./player-fileset-migration";
import type { DocumentWorkspace } from "./level-workspace";

class MemoryState implements WorkspaceState {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  update(key: string, value: unknown | undefined): void {
    if (value === undefined) this.values.delete(key);
    else this.values.set(key, value);
  }
}

function workspaceThatResets(resetLevelFiles: () => Promise<void>): DocumentWorkspace {
  return { resetLevelFiles } as DocumentWorkspace;
}

describe("ensureCurrentPlayerFiles", () => {
  it("版本不匹配时重置玩家文件并更新版本", async () => {
    const state = new MemoryState();
    let resetCount = 0;
    const workspace = workspaceThatResets(async () => { resetCount += 1; });

    await expect(ensureCurrentPlayerFiles(workspace, state, PYTHON_RPG_CAMPAIGN)).resolves.toBe(true);

    expect(resetCount).toBe(1);
    expect(state.get<number>(playerFilesetVersionKey("python-rpg"))).toBe(PLAYER_FILESET_VERSION);
  });

  it("当前版本不重置玩家文件", async () => {
    const state = new MemoryState();
    state.update(playerFilesetVersionKey("python-rpg"), PLAYER_FILESET_VERSION);
    const workspace = workspaceThatResets(async () => { throw new Error("should not reset"); });

    await expect(ensureCurrentPlayerFiles(workspace, state, PYTHON_RPG_CAMPAIGN)).resolves.toBe(false);
  });

  it("重置失败时不写入版本标记", async () => {
    const state = new MemoryState();
    const workspace = workspaceThatResets(async () => { throw new Error("reset failed"); });

    await expect(ensureCurrentPlayerFiles(workspace, state, PYTHON_RPG_CAMPAIGN))
      .rejects.toThrow("reset failed");

    expect(state.get<number>(playerFilesetVersionKey("python-rpg"))).toBeUndefined();
  });
});
