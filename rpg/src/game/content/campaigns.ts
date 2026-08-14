import type { CampaignId, CampaignDefinition } from "../../programs/types";
import { GO_RPG_CAMPAIGN } from "./go/levels";
import { PYTHON_RPG_CAMPAIGN } from "./python/levels";

const CAMPAIGNS: readonly CampaignDefinition[] = [PYTHON_RPG_CAMPAIGN, GO_RPG_CAMPAIGN];

export function getCampaign(campaignId: CampaignId): CampaignDefinition {
  const campaign = CAMPAIGNS.find((candidate) => candidate.id === campaignId);
  if (campaign === undefined) throw new Error(`战役尚未注册: ${campaignId}`);
  return campaign;
}
