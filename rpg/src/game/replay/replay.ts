import { resolveTurn } from "../combat/resolve-turn";
import type {
  BattleState,
  CommandResolution,
  Replay,
  ReplayMetadata,
  ReplayMismatch,
  ReplayStep,
  ReplayVerification,
} from "../combat/types";
import { canonicalSha256 } from "./canonical-hash";

const ENGINE_VERSION = "0.1.0";
const CONTENT_VERSION = "python-slice-1";
const RUNNER_PROTOCOL_VERSION = 1;

function mismatch(
  step: number,
  field: ReplayMismatch["field"],
  expected: ReplayMismatch["expected"],
  actual: ReplayMismatch["actual"],
  replay: Replay,
): ReplayVerification {
  return {
    verified: false,
    mismatch: {
      step,
      field,
      expected,
      actual,
      engineVersion: replay.metadata.engineVersion,
      contentVersion: replay.metadata.contentVersion,
      runnerProtocolVersion: replay.metadata.runnerProtocolVersion,
    },
  };
}

async function finalMismatch(replay: Replay, state: BattleState): Promise<ReplayVerification> {
  if (state.phase !== replay.outcome) {
    return mismatch(replay.steps.length, "outcome", replay.outcome, state.phase, replay);
  }
  return mismatch(
    replay.steps.length,
    "finalStateHash",
    replay.finalStateHash,
    await canonicalSha256(state),
    replay,
  );
}

/** Starts an immutable replay record from a deterministic battle state. */
export async function createReplay(
  metadata: ReplayMetadata,
  initialState: BattleState,
): Promise<Replay> {
  const metadataSnapshot = structuredClone(metadata);
  const initialStateSnapshot = structuredClone(initialState);
  const initialStateHash = await canonicalSha256(initialStateSnapshot);
  return {
    replayVersion: 1,
    metadata: metadataSnapshot,
    initialState: initialStateSnapshot,
    initialStateHash,
    steps: [],
    outcome: initialState.phase,
    finalStateHash: initialStateHash,
  };
}

/** Appends the canonical evidence for an already accepted combat turn. */
export async function recordAcceptedTurn(
  replay: Replay,
  before: BattleState,
  resolution: Extract<CommandResolution, { accepted: true }>,
): Promise<Replay> {
  const replaySnapshot = structuredClone(replay);
  const beforeSnapshot = structuredClone(before);
  const resolutionSnapshot = structuredClone(resolution);
  const stateHash = await canonicalSha256(resolutionSnapshot.state);
  const step: ReplayStep = {
    seq: replaySnapshot.steps.length + 1,
    round: beforeSnapshot.round,
    turnIndex: beforeSnapshot.turnIndex,
    stateRevision: beforeSnapshot.revision,
    actorId: resolutionSnapshot.command.actorId,
    command: resolutionSnapshot.command,
    rngBefore: beforeSnapshot.rngState,
    rngAfter: resolutionSnapshot.state.rngState,
    events: resolutionSnapshot.events,
    eventsHash: await canonicalSha256(resolutionSnapshot.events),
    stateHash,
  };
  return {
    ...replaySnapshot,
    steps: [...replaySnapshot.steps, step],
    outcome: resolutionSnapshot.state.phase,
    finalStateHash: stateHash,
  };
}

/** Replays each command from the initial state and verifies all canonical evidence. */
export async function verifyReplay(replay: Replay): Promise<ReplayVerification> {
  if (replay.replayVersion !== 1) return mismatch(0, "replayVersion", 1, replay.replayVersion, replay);
  if (replay.metadata.engineVersion !== ENGINE_VERSION) {
    return mismatch(0, "engineVersion", ENGINE_VERSION, replay.metadata.engineVersion, replay);
  }
  if (replay.metadata.contentVersion !== CONTENT_VERSION) {
    return mismatch(0, "contentVersion", CONTENT_VERSION, replay.metadata.contentVersion, replay);
  }
  if (replay.metadata.runnerProtocolVersion !== RUNNER_PROTOCOL_VERSION) {
    return mismatch(0, "runnerProtocolVersion", RUNNER_PROTOCOL_VERSION, replay.metadata.runnerProtocolVersion, replay);
  }

  const actualInitialHash = await canonicalSha256(replay.initialState);
  if (actualInitialHash !== replay.initialStateHash) {
    return mismatch(0, "initialStateHash", replay.initialStateHash, actualInitialHash, replay);
  }

  let state = replay.initialState;
  for (const [index, step] of replay.steps.entries()) {
    const stepNumber = index + 1;
    const result = resolveTurn(state, step.command);
    if (!result.accepted) return mismatch(stepNumber, "command", "accepted", "rejected", replay);

    const checks: readonly [ReplayMismatch["field"], string | number, string | number][] = [
      ["rngBefore", step.rngBefore, state.rngState],
      ["rngAfter", step.rngAfter, result.state.rngState],
      ["eventsHash", step.eventsHash, await canonicalSha256(result.events)],
      ["stateHash", step.stateHash, await canonicalSha256(result.state)],
    ];
    for (const [field, expected, actual] of checks) {
      if (expected !== actual) return mismatch(stepNumber, field, expected, actual, replay);
    }
    state = result.state;
  }

  if (state.phase === replay.outcome && await canonicalSha256(state) === replay.finalStateHash) {
    return { verified: true, finalStateHash: replay.finalStateHash };
  }
  return finalMismatch(replay, state);
}
