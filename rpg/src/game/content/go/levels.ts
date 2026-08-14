import { GO_PROGRAM } from "../../../programs/go";
import type { CampaignDefinition } from "../../../programs/types";
import { GO_MARSH_01 } from "./go-marsh-01";
import type { LevelDefinition, LevelId } from "../shared/types";

export const GO_LEVEL_ORDER: readonly LevelId[] = ["go-marsh-01"];

export const GO_LEVELS: readonly LevelDefinition[] = [GO_MARSH_01];

export const GO_RPG_CAMPAIGN: CampaignDefinition = {
  id: "go-rpg",
  title: "Go 沼泽战役",
  program: GO_PROGRAM,
  levelOrder: GO_LEVEL_ORDER,
};
