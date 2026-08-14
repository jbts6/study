import { PYTHON_PROGRAM } from "../../../programs/python";
import type { CampaignDefinition } from "../../../programs/types";
import { PYTHON_MARSH_01 } from "./python-marsh-01";
import { PYTHON_MARSH_02 } from "./python-marsh-02";
import { PYTHON_MARSH_03 } from "./python-marsh-03";
import { PYTHON_MARSH_04 } from "./python-marsh-04";
import { PYTHON_MARSH_05 } from "./python-marsh-05";
import { PYTHON_MARSH_06 } from "./python-marsh-06";
import type { LevelDefinition, LevelId } from "../shared/types";

export const PYTHON_LEVEL_ORDER: readonly LevelId[] = [
  "python-marsh-01",
  "python-marsh-02",
  "python-marsh-03",
  "python-marsh-04",
  "python-marsh-05",
  "python-marsh-06",
];

export const PYTHON_LEVELS: readonly LevelDefinition[] = [
  PYTHON_MARSH_01,
  PYTHON_MARSH_02,
  PYTHON_MARSH_03,
  PYTHON_MARSH_04,
  PYTHON_MARSH_05,
  PYTHON_MARSH_06,
];

export const PYTHON_RPG_CAMPAIGN: CampaignDefinition = {
  id: "python-rpg",
  title: "Python 沼泽战役",
  program: PYTHON_PROGRAM,
  levelOrder: PYTHON_LEVEL_ORDER,
};
