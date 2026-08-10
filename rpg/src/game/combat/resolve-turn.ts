import { validateTurnCommand } from "./validate-turn-command";
import { reduceBattle } from "./reduce-battle";
import type { BattleState, CommandResolution } from "./types";

/** Validates raw input before atomically reducing an accepted combat turn. */
export function resolveTurn(state: Readonly<BattleState>, input: unknown): CommandResolution {
  const validation = validateTurnCommand(state, input);
  if (!validation.accepted) return { accepted: false, errors: validation.errors, state };
  const reduced = reduceBattle(state, validation.command);
  return { accepted: true, command: validation.command, state: reduced.state, events: reduced.events };
}
