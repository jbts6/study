import { GO_PROGRAM } from "../../../programs/go";
import type { CampaignDefinition } from "../../../programs/types";
import { GO_MARSH_01 } from "./go-marsh-01";
import { GO_MARSH_02 } from "./go-marsh-02";
import type { LevelDefinition, LevelId } from "../shared/types";

export const GO_LEVEL_ORDER: readonly LevelId[] = ["go-marsh-01", "go-marsh-02"];

export const GO_LEVELS: readonly LevelDefinition[] = [GO_MARSH_01, GO_MARSH_02];

export const GO_RPG_CAMPAIGN: CampaignDefinition = {
  id: "go-rpg",
  title: "Go 沼泽战役",
  program: GO_PROGRAM,
  levelOrder: GO_LEVEL_ORDER,
};
