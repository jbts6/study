import type { BattleEvent, BattleState } from "../game/combat/types";

/** Formats battle events into the player-facing feedback shown after a turn. */
export function formatBattleFeedback(state: BattleState, events: readonly BattleEvent[]): readonly string[] {
  return events.flatMap((event) => {
    if (event.type === "interacted") return [];
    if (event.type === "objective_progressed") return formatObjectiveProgress(state, event);
    return [formatBattleEvent(event)];
  });
}

function formatObjectiveProgress(state: BattleState, event: BattleEvent): string {
  const targetId = event.payload.targetId;
  const target = typeof targetId === "string" ? state.objectives.find((objective) => objective.id === targetId) : undefined;
  if (target === undefined) return formatBattleEvent(event);
  const durability = event.payload.durabilityAfter;
  const value = typeof durability === "number" ? durability : target.durability;
  if (target.key) return `中继器受到腐化：${target.id} 耐久 ${value}${value === 0 ? "（已毁）" : ""}`;
  return `封印激活进度：${target.id} 耐久 ${value}${target.completed ? "（已完成）" : ""}`;
}

function formatBattleEvent(event: BattleEvent): string {
  return `[${event.type}] ${JSON.stringify(event.payload)}`;
}
