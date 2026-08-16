import type { CampaignDefinition, CampaignId } from "../programs/types";
import type { WorkspaceState } from "./platform-types";
import type { DocumentWorkspace } from "./level-workspace";

export const PLAYER_FILESET_VERSION = 2;

export function playerFilesetVersionKey(campaignId: CampaignId): string {
  return campaignId + ".player-fileset-version";
}

export async function ensureCurrentPlayerFiles(
  workspace: DocumentWorkspace,
  state: WorkspaceState,
  campaign: CampaignDefinition,
): Promise<boolean> {
  const key = playerFilesetVersionKey(campaign.id);
  if (state.get<number>(key) === PLAYER_FILESET_VERSION) return false;
  await workspace.resetLevelFiles();
  await state.update(key, PLAYER_FILESET_VERSION);
  return true;
}
