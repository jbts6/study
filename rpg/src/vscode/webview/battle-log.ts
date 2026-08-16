import type { BattleEvent } from "../../game/combat/types";

const sourceName = (id: string): string => (id === "hazard" ? "酸沼" : id);

/** Formats engine battle events into readable log lines for the battle log panel. */
export function formatBattleEvents(events: readonly BattleEvent[]): readonly string[] {
  const lines: string[] = [];
  for (const event of events) {
    const payload = event.payload;
    switch (event.type) {
      case "moved":
        lines.push(`${payload.actorId} 移动到 (${(payload.to as { x: number; y: number }).x}, ${(payload.to as { x: number; y: number }).y})`);
        break;
      case "damaged":
        lines.push(`${sourceName(String(payload.sourceId))} 对 ${payload.targetId} 造成 ${payload.amount} 点伤害（剩余 ${payload.hpAfter}）`);
        break;
      case "healed":
        lines.push(`${payload.sourceId} 为 ${payload.targetId} 恢复 ${payload.amount} 点生命（剩余 ${payload.hpAfter}）`);
        break;
      case "interacted":
        lines.push(`${payload.actorId} 与 ${payload.targetId} 交互`);
        break;
      case "objective_progressed":
        if (payload.completed === true) lines.push(`目标 ${payload.targetId} 已激活`);
        break;
      case "unit_disabled":
        lines.push(`${payload.unitId} 被消灭`);
        break;
      case "battle_finished":
        lines.push(payload.outcome === "won" ? "战斗胜利" : "战斗失败");
        break;
      default:
        break;
    }
  }
  return lines;
}
