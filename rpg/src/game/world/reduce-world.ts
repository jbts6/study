import type { QuestStep, WorldCampaignContent } from "../content/world/types";
import type { GameState, QuestState, WorldCommand } from "./campaign-types";

function advanceQuest(quests: readonly QuestState[], toStep: string): readonly QuestState[] {
  return quests.map((quest, index) => index === 0
    ? { ...quest, status: toStep === "completed" ? "completed" : quest.status, stepId: toStep }
    : quest);
}

function addClue(clues: readonly string[], clue: string): readonly string[] {
  return clues.includes(clue) ? [...clues] : [...clues, clue];
}

function addItem(inventory: GameState["inventory"], itemId: string, amount: number): GameState["inventory"] {
  const existing = inventory.find((item) => item.id === itemId);
  if (existing === undefined) return [...inventory, { id: itemId, amount }];
  return inventory.map((item) => item.id === itemId ? { ...item, amount: item.amount + amount } : { ...item });
}

function removeItem(inventory: GameState["inventory"], itemId: string, amount: number): GameState["inventory"] {
  return inventory.flatMap((item) => {
    if (item.id !== itemId) return [{ ...item }];
    const remaining = item.amount - amount;
    return remaining > 0 ? [{ ...item, amount: remaining }] : [];
  });
}

function cloneBattle(state: NonNullable<GameState["battle"]>["state"]): NonNullable<GameState["battle"]>["state"] {
  return {
    ...state,
    turnOrder: [...state.turnOrder],
    units: state.units.map((unit) => ({ ...unit, cell: { ...unit.cell }, skills: unit.skills.map((skill) => ({ ...skill })), statuses: unit.statuses.map((status) => ({ ...status })) })),
    board: { ...state.board, blockedCells: state.board.blockedCells.map((cell) => ({ ...cell })), hazardCells: state.board.hazardCells.map((cell) => ({ ...cell })), coverCells: state.board.coverCells.map((cell) => ({ ...cell })) },
    objectives: state.objectives.map((objective) => ({ ...objective, cell: { ...objective.cell } })),
    failureConditions: { ...state.failureConditions },
  };
}

function initialQuest(content: WorldCampaignContent, chapterId: string): readonly QuestState[] {
  const chapter = content.chapters[chapterId];
  if (chapter === undefined) throw new Error(`遭遇尚未注册的章节: ${chapterId}`);
  const firstStep = chapter.questChain[0];
  if (firstStep === undefined) throw new Error(`章节 ${chapterId} 没有任务链`);
  return [{ id: chapter.questId, status: "active", stepId: firstStep.stepId }];
}

/** Applies the effects of the chapter quest step that validateQuestStep already matched. */
export function reduceWorld(state: Readonly<GameState>, content: WorldCampaignContent, command: WorldCommand): GameState {
  const chapter = content.chapters[state.chapterId];
  const quest = state.quests[0];
  if (chapter === undefined || quest === undefined) return { ...state, revision: state.revision + 1 };
  const step: QuestStep | undefined = chapter.questChain.find((candidate) => candidate.stepId === quest.stepId);
  if (step === undefined) return { ...state, revision: state.revision + 1 };

  const next: { -readonly [K in keyof GameState]: GameState[K] } = {
    ...state,
    worldFlags: { ...state.worldFlags },
    inventory: state.inventory.map((item) => ({ ...item })),
    quests: state.quests.map((item) => ({ ...item })),
    discoveredClues: [...state.discoveredClues],
    battle: state.battle === null ? null : { encounterId: state.battle.encounterId, state: cloneBattle(state.battle.state) },
    revision: state.revision + 1,
  };

  const effects = step.effects;
  if (effects.flags !== undefined) Object.assign(next.worldFlags, effects.flags);
  if (effects.addClue !== undefined) next.discoveredClues = addClue(next.discoveredClues, effects.addClue);
  if (command.type === "collect") {
    const source = content.itemSources[command.targetId];
    if (source !== undefined) {
      next.worldFlags = { ...next.worldFlags, [`collected:${source.id}`]: true };
      next.inventory = addItem(next.inventory, source.itemId, source.amount);
    }
  }
  if (command.type === "use") next.inventory = removeItem(next.inventory, command.itemId, 1);
  if (command.type === "travel") next.locationId = command.locationId;
  if (effects.enterBattle !== undefined) {
    const encounter = content.encounters[effects.enterBattle];
    if (encounter !== undefined) next.battle = { encounterId: encounter.id, state: cloneBattle(encounter.initialBattle) };
  }
  next.quests = advanceQuest(next.quests, effects.advanceTo);
  if (effects.switchChapter !== undefined) {
    next.chapterId = effects.switchChapter;
    next.quests = initialQuest(content, effects.switchChapter);
  }
  return next as GameState;
}
