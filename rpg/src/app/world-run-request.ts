import type { CampaignDefinition } from "../programs/types";
import type { ExecutionLimits, JsonObject, PythonRunRequest } from "../runners/protocol/types";
import type { WorldCampaignContent } from "../game/content/world/types";
import type { GameState } from "../game/world/campaign-types";
import { projectCampaignWorldView } from "../game/world/project-campaign-world-view";
import { projectWorldView } from "../game/world/project-world-view";

export type WorldRunRequestInput = Readonly<{
  campaign: CampaignDefinition;
  content: WorldCampaignContent;
  state: GameState;
  codeDraft: string;
  runId: string;
  limits: ExecutionLimits;
}>;

export function createWorldRunRequest(input: WorldRunRequestInput): PythonRunRequest {
  const battle = input.state.battle;
  const worldView: JsonObject = battle === null
    ? projectCampaignWorldView(input.state, input.content)
    : projectWorldView(battle.state);
  const callable = battle === null ? "choose_world_action" : "choose_turn";
  const file = input.campaign.program.runEntrypointFileName(input.state.chapterId);

  return {
    protocolVersion: 1,
    runId: input.runId,
    attemptId: `${input.runId}:1`,
    questId: input.state.chapterId,
    language: "python",
    files: input.campaign.program.createRunFiles(input.state.chapterId, input.codeDraft),
    worldView,
    entrypoint: { file, callable },
    allowedModules: ["math"],
    limits: input.limits,
  };
}
