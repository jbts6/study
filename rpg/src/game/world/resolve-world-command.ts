import type { WorldCampaignContent } from "../content/world/types";
import type { GameState, WorldCommand, WorldCommandError } from "./campaign-types";
import { reduceWorld } from "./reduce-world";
import { validateWorldCommand } from "./validate-world-command";
import { validateQuestStep } from "./validate-quest-step";

export type WorldCommandResolution =
  | Readonly<{ accepted: true; command: WorldCommand; state: GameState }>
  | Readonly<{ accepted: false; errors: readonly WorldCommandError[]; state: GameState }>;

export function resolveWorldCommand(
  state: Readonly<GameState>,
  content: WorldCampaignContent,
  input: unknown,
): WorldCommandResolution {
  const validation = validateWorldCommand(state, content, input);
  if (!validation.accepted) return { accepted: false, errors: validation.errors, state };
  const step = validateQuestStep(state, content, validation.command);
  if (!step.ok) return { accepted: false, errors: [step.error], state };
  return { accepted: true, command: validation.command, state: reduceWorld(state, content, validation.command) };
}
