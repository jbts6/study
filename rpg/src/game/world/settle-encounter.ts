import { getLevel } from "../content/levels";
import type { LevelDefinition } from "../content/shared/types";
import type { WorldCampaignContent } from "../content/world/types";
import type { GameState, QuestState } from "./campaign-types";

export function encounterBattleLevel(
  content: WorldCampaignContent,
  encounterId: string,
): LevelDefinition {
  const encounter = content.encounters[encounterId];
  if (encounter === undefined) throw new Error(`遭遇尚未注册: ${encounterId}`);
  return getLevel(encounter.battleLevelId);
}

export function settleEncounter(
  state: Readonly<GameState>,
  content: WorldCampaignContent,
): GameState {
  const activeBattle = state.battle;
  if (activeBattle === null) throw new Error("没有正在结算的战斗");
  if (activeBattle.state.phase === "in_progress") throw new Error("战斗尚未结束");

  const encounter = content.encounters[activeBattle.encounterId];
  if (encounter === undefined) throw new Error(`遭遇尚未注册: ${activeBattle.encounterId}`);
  const chapter = content.chapters[state.chapterId];
  if (chapter === undefined) throw new Error(`遭遇尚未注册的章节: ${state.chapterId}`);

  const next: GameState = {
    ...state,
    worldFlags: { ...state.worldFlags },
    inventory: state.inventory.map((item) => ({ ...item })),
    quests: state.quests.map((quest) => ({ ...quest })),
    discoveredClues: [...state.discoveredClues],
    battle: null,
    revision: state.revision + 1,
  };

  const victory = chapter.victory;
  const wonAllObjectives = activeBattle.state.phase === "won"
    && !hasIncompleteRequiredObjective(activeBattle.state);
  if (wonAllObjectives) {
    return {
      ...next,
      locationId: victory.returnLocationId,
      worldFlags: victory.setFlags === undefined ? next.worldFlags : { ...next.worldFlags, ...victory.setFlags },
      quests: victory.reportStep === undefined
        ? advanceQuestTo(next.quests, "completed")
        : advanceQuestTo(next.quests, victory.reportStep),
    };
  }

  return {
    ...next,
    battle: { encounterId: encounter.id, state: cloneBattle(encounter.initialBattle) },
  };
}

function hasIncompleteRequiredObjective(
  state: NonNullable<GameState["battle"]>["state"],
): boolean {
  return state.objectives.some(
    (objective) => !objective.key && !objective.completed,
  );
}

function advanceQuestTo(quests: readonly QuestState[], toStep: string): readonly QuestState[] {
  return quests.map((quest, index) => index === 0
    ? { ...quest, status: toStep === "completed" ? "completed" : quest.status, stepId: toStep }
    : quest);
}

/** Resets an active battle back to its encounter's initial state (used at the start of every run). */
export function resetEncounterBattle(state: Readonly<GameState>, content: WorldCampaignContent): GameState {
  if (state.battle === null) return state;
  const encounter = content.encounters[state.battle.encounterId];
  if (encounter === undefined) throw new Error(`遭遇尚未注册: ${state.battle.encounterId}`);
  return { ...state, battle: { encounterId: encounter.id, state: cloneBattle(encounter.initialBattle) } };
}

function cloneBattle(state: NonNullable<GameState["battle"]>["state"]): NonNullable<GameState["battle"]>["state"] {
  return {
    ...state,
    turnOrder: [...state.turnOrder],
    units: state.units.map((unit) => ({
      ...unit,
      cell: { ...unit.cell },
      skills: unit.skills.map((skill) => skill.effect === undefined ? { ...skill } : { ...skill, effect: { ...skill.effect } }),
      statuses: unit.statuses.map((status) => ({ ...status })),
    })),
    board: {
      ...state.board,
      blockedCells: state.board.blockedCells.map((cell) => ({ ...cell })),
      hazardCells: state.board.hazardCells.map((cell) => ({ ...cell })),
      coverCells: state.board.coverCells.map((cell) => ({ ...cell })),
    },
    objectives: state.objectives.map((objective) => ({ ...objective, cell: { ...objective.cell } })),
    failureConditions: { ...state.failureConditions },
  };
}
