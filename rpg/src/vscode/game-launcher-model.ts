import type { CampaignDefinition, CampaignId } from "../programs/types";
import { registeredCampaigns } from "../game/content/campaigns";

export type GameLauncherAction = Readonly<{
  campaignId: CampaignId;
  label: string;
  description: string;
  command: string;
}>;

export function campaignItems(campaigns: readonly CampaignDefinition[]): readonly GameLauncherAction[] {
  return campaigns.map((campaign) => ({
    campaignId: campaign.id,
    label: campaign.title,
    description: `在当前窗口打开${campaign.title}`,
    command: "pythonRpg.open",
  }));
}

export const GAME_LAUNCHER_ACTIONS = campaignItems(registeredCampaigns());
