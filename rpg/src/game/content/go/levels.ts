import { GO_PROGRAM } from "../../../programs/go";
import type { CampaignDefinition } from "../../../programs/types";
import { GO_MARSH_01 } from "./go-marsh-01";
import { GO_MARSH_02 } from "./go-marsh-02";
import { GO_MARSH_03 } from "./go-marsh-03";
import { GO_MARSH_04 } from "./go-marsh-04";
import { GO_MARSH_05 } from "./go-marsh-05";
import { GO_MARSH_06 } from "./go-marsh-06";
import type { ProgramReference } from "../../../programs/types";
import type { LevelDefinition, LevelId } from "../shared/types";

export const GO_LEVEL_ORDER: readonly LevelId[] = [
  "go-marsh-01", "go-marsh-02", "go-marsh-03",
  "go-marsh-04", "go-marsh-05", "go-marsh-06",
];

export const GO_LEVELS: readonly LevelDefinition[] = [
  GO_MARSH_01, GO_MARSH_02, GO_MARSH_03,
  GO_MARSH_04, GO_MARSH_05, GO_MARSH_06,
];

export function validateGoApiFocus(
  levels: readonly LevelDefinition[],
  reference: ProgramReference,
): void {
  const referenceIds = new Set([
    "entrypoint.choose-turn",
    ...reference.sections.flatMap((section) => section.entries.map((entry) => entry.id)),
  ]);

  for (const level of levels) {
    const apiFocus = level.guidance.apiFocus;
    if (apiFocus === undefined) throw new Error(`关卡 ${level.id} 缺少 apiFocus`);
    for (const referenceId of apiFocus.referenceIds) {
      if (!referenceIds.has(referenceId)) {
        throw new Error(`关卡 ${level.id} 引用不存在的 API 条目: ${referenceId}`);
      }
    }
  }
}

if (GO_PROGRAM.reference === undefined) throw new Error("Go 程序缺少参考条目");
validateGoApiFocus(GO_LEVELS, GO_PROGRAM.reference);

export const GO_RPG_CAMPAIGN: CampaignDefinition = {
  id: "go-rpg",
  title: "Go 沼泽战役",
  program: GO_PROGRAM,
  levelOrder: GO_LEVEL_ORDER,
};
