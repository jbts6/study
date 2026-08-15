import type { WorldCampaignContent } from "../content/world/types";
import type { GameState, QuestState, WorldCommand } from "./campaign-types";

function advanceQuest(state: GameState, fromStep: string, toStep: string): readonly QuestState[] {
  return state.quests.map((quest, index) => index === 0 && quest.stepId === fromStep ? { ...quest, stepId: toStep } : quest);
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

export function reduceWorld(state: Readonly<GameState>, content: WorldCampaignContent, command: WorldCommand): GameState {
  let next: GameState = {
    ...state,
    worldFlags: { ...state.worldFlags },
    inventory: state.inventory.map((item) => ({ ...item })),
    quests: state.quests.map((quest) => ({ ...quest })),
    discoveredClues: [...state.discoveredClues],
    battle: state.battle === null ? null : { encounterId: state.battle.encounterId, state: cloneBattle(state.battle.state) },
    revision: state.revision + 1,
  };

  if (command.type === "talk" && command.targetId === "toma") {
    next = { ...next, worldFlags: { ...next.worldFlags, talked_to_toma: true }, quests: advanceQuest(next, "talk_to_toma", "inspect_scrap_pile") };
  } else if (command.type === "inspect" && command.targetId === "scrap_pile") {
    next = { ...next, worldFlags: { ...next.worldFlags, scrap_pile_inspected: true }, discoveredClues: addClue(next.discoveredClues, "scrap_contains_copper"), quests: advanceQuest(next, "inspect_scrap_pile", "collect_copper_wire") };
  } else if (command.type === "collect") {
    const source = content.itemSources[command.targetId];
    if (source !== undefined) {
      next = { ...next, worldFlags: { ...next.worldFlags, [`collected:${source.id}`]: true }, inventory: addItem(next.inventory, source.itemId, source.amount), quests: advanceQuest(next, "collect_copper_wire", "inspect_weather") };
    }
  } else if (command.type === "inspect" && command.targetId === "weather_station") {
    next = { ...next, worldFlags: { ...next.worldFlags, safe_route_known: true }, discoveredClues: addClue(next.discoveredClues, "acid_rain_safe_route"), quests: advanceQuest(next, "inspect_weather", "travel_to_relay") };
  } else if (command.type === "travel") {
    next = { ...next, locationId: command.locationId, quests: advanceQuest(next, "travel_to_relay", "repair_relay") };
  } else if (command.type === "use" && command.itemId === "copper_wire" && command.targetId === "relay") {
    next = { ...next, inventory: removeItem(next.inventory, command.itemId, 1), worldFlags: { ...next.worldFlags, relay_repaired: true }, quests: advanceQuest(next, "repair_relay", "prepare_guardian_battle") };
  } else if (command.type === "prepareBattle") {
    const encounter = content.encounters[command.encounterId];
    if (encounter !== undefined) next = { ...next, battle: { encounterId: encounter.id, state: cloneBattle(encounter.initialBattle) }, quests: advanceQuest(next, "prepare_guardian_battle", "defeat_guardian") };
  }
  return next;
}
