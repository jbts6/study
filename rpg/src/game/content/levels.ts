import { ABILITY_CATALOG } from "./ability-catalog";
import { PYTHON_MARSH_01 } from "./python-marsh-01";
import { PYTHON_MARSH_02 } from "./python-marsh-02";
import { PYTHON_MARSH_03 } from "./python-marsh-03";
import type { LevelDefinition, LevelId } from "./types";

export const LEVEL_ORDER: readonly LevelId[] = ["python-marsh-01", "python-marsh-02", "python-marsh-03", "python-marsh-04", "python-marsh-05", "python-marsh-06"];

const LEVELS = [PYTHON_MARSH_01, PYTHON_MARSH_02, PYTHON_MARSH_03] as const;

validateLevels(LEVELS);

export function getLevel(levelId: LevelId): LevelDefinition {
  const level = LEVELS.find((candidate) => candidate.id === levelId);
  if (level === undefined) throw new Error(`关卡尚未注册: ${levelId}`);
  return level;
}

export function getNextLevelId(levelId: LevelId): LevelId | undefined {
  const index = LEVEL_ORDER.indexOf(levelId);
  return index < 0 ? undefined : LEVEL_ORDER[index + 1];
}

export function validateLevels(levels: readonly LevelDefinition[]): void {
  const ids = new Set<string>();
  for (const level of levels) {
    if (!level.id || !level.title || level.briefing.length === 0 || level.starterCode === undefined || level.apiHints.length === 0) throw new Error("关卡缺少必填字段");
    if (ids.has(level.id)) throw new Error("关卡 ID 重复");
    ids.add(level.id);
    const units = new Set(level.initialBattle.units.map((unit) => unit.id));
    for (const unitId of Object.keys(level.enemyBehaviors)) if (!units.has(unitId)) throw new Error("关卡引用不存在的单位");
    if (level.reward.type === "ability" && !(level.reward.abilityId in ABILITY_CATALOG)) throw new Error("关卡引用不存在的能力");
    const objectiveIds = new Set(level.initialBattle.objectives.map((objective) => objective.id));
    if (objectiveIds.size !== level.initialBattle.objectives.length) throw new Error("关卡目标 ID 重复");
    if (Object.values(level.enemyBehaviors).some((behavior) => behavior.type === "corrupt")
      && level.initialBattle.objectives.filter((objective) => objective.key).length !== 1) {
      throw new Error("关卡引用不存在的目标");
    }
  }
}
