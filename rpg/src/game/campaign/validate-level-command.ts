import type { BattleState, CommandValidation, TurnCommand } from "../combat/types";
import type { LevelDefinition } from "../content/types";

function rejected(message: string): CommandValidation {
  return {
    accepted: false,
    errors: [{ code: "INTERACTION_INVALID", path: "$.action.targetId", message }],
  };
}

/** Applies level-specific command permissions before combat validation. */
export function validateLevelCommand(
  level: LevelDefinition,
  state: Readonly<BattleState>,
  command: TurnCommand,
): CommandValidation {
  if (command.action.type !== "interact") return { accepted: true, command };
  const interaction = command.action;

  const objective = state.objectives.find((candidate) => candidate.id === interaction.targetId);
  if (objective === undefined) return { accepted: true, command };

  if (command.actorId === "scout" && objective.key) return rejected("scout 只能交互非关键目标");

  if (level.enemyBehaviors[command.actorId]?.type === "corrupt") {
    const keyObjectives = state.objectives.filter((candidate) => candidate.key);
    if (keyObjectives.length !== 1 || keyObjectives[0]?.id !== objective.id) {
      return rejected("corrupt 角色只能交互该关唯一关键目标");
    }
  } else if (command.actorId !== "scout") {
    return rejected("只有 scout 或 corrupt 角色可以交互目标");
  }

  return { accepted: true, command };
}
