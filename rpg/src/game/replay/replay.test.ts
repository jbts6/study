import { describe, expect, it } from "vitest";
import { resolveTurn } from "../combat/resolve-turn";
import { createFixtureState, fixtureCommands } from "../testing/fixture";
import { canonicalSha256 } from "./canonical-hash";
import { createReplay, recordAcceptedTurn, verifyReplay } from "./replay";

const metadata = {
  engineVersion: "0.1.0",
  contentVersion: "python-slice-1",
  runnerProtocolVersion: 1 as const,
  questId: "core-fixture",
  battleId: "core-fixture",
  seed: "2463534242",
};

async function createFixtureReplay() {
  let state = createFixtureState();
  let replay = await createReplay(metadata, state);
  for (const command of fixtureCommands) {
    const resolution = resolveTurn(state, command);
    if (!resolution.accepted) throw new Error("fixture rejected");
    replay = await recordAcceptedTurn(replay, state, resolution);
    state = resolution.state;
  }
  return replay;
}

describe("replay", () => {
  it("replays five accepted fixture turns successfully", async () => {
    const replay = await createFixtureReplay();

    await expect(verifyReplay(replay)).resolves.toMatchObject({
      verified: true,
      finalStateHash: replay.finalStateHash,
    });
    expect(replay.steps).toHaveLength(5);
  });

  it("keeps creation inputs isolated before asynchronous hashing", async () => {
    const inputMetadata = { ...metadata };
    const inputState = createFixtureState();
    const replay = await createReplay(inputMetadata, inputState);

    (inputMetadata as { engineVersion: string }).engineVersion = "mutated";
    (inputState as unknown as { units: Array<{ cell: { x: number } }> }).units[0]!.cell.x = 99;

    expect(replay.metadata).not.toBe(inputMetadata);
    expect(replay.initialState).not.toBe(inputState);
    expect(replay.initialState.units[0]).not.toBe(inputState.units[0]);
    expect(replay.metadata.engineVersion).toBe("0.1.0");
    expect(replay.initialState.units[0]?.cell.x).toBe(0);
    await expect(verifyReplay(replay)).resolves.toMatchObject({ verified: true });
  });

  it("keeps recorded replay evidence isolated from all input graphs", async () => {
    const before = createFixtureState();
    const replay = await createReplay(metadata, before);
    const resolution = resolveTurn(before, fixtureCommands[0]!);
    if (!resolution.accepted) throw new Error("fixture rejected");
    const recorded = await recordAcceptedTurn(replay, before, resolution);

    (replay as unknown as { initialState: { units: Array<{ hp: number }> } }).initialState.units[0]!.hp = 1;
    (before as unknown as { units: Array<{ hp: number }> }).units[0]!.hp = 1;
    (resolution.command as unknown as { action: { type: string } }).action.type = "wait";
    (resolution.state as unknown as { units: Array<{ hp: number }> }).units[1]!.hp = 1;
    (resolution.events[0]!.payload as { sourceId?: string }).sourceId = "tampered";

    expect(recorded.initialState).not.toBe(replay.initialState);
    expect(recorded.steps[0]?.command).not.toBe(resolution.command);
    expect(recorded.steps[0]?.events).not.toBe(resolution.events);
    expect(recorded.steps[0]?.events[0]).not.toBe(resolution.events[0]);
    await expect(verifyReplay(recorded)).resolves.toMatchObject({ verified: true });
  });

  it("detects version, initial, first-step, middle-step and final deviations", async () => {
    const replay = await createFixtureReplay();

    await expect(verifyReplay({ ...replay, replayVersion: 2 as 1 })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "replayVersion", step: 0, expected: 1, actual: 2 },
    });
    await expect(verifyReplay({ ...replay, metadata: { ...replay.metadata, engineVersion: "0.2.0" } })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "engineVersion", step: 0 },
    });
    await expect(verifyReplay({ ...replay, metadata: { ...replay.metadata, contentVersion: "python-slice-2" } })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "contentVersion", step: 0 },
    });
    await expect(verifyReplay({ ...replay, metadata: { ...replay.metadata, runnerProtocolVersion: 2 as 1 } })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "runnerProtocolVersion", step: 0 },
    });
    await expect(verifyReplay({ ...replay, initialStateHash: "sha256:initial" })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "initialStateHash", step: 0, expected: "sha256:initial" },
    });
    await expect(verifyReplay({ ...replay, steps: [{ ...replay.steps[0]!, rngAfter: 7 }, ...replay.steps.slice(1)] })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "rngAfter", step: 1, expected: 7, actual: replay.steps[0]?.rngAfter },
    });
    await expect(verifyReplay({ ...replay, steps: [{ ...replay.steps[0]!, stateHash: "sha256:first" }, ...replay.steps.slice(1)] })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "stateHash", step: 1, expected: "sha256:first" },
    });
    await expect(verifyReplay({ ...replay, steps: [...replay.steps.slice(0, 2), { ...replay.steps[2]!, eventsHash: "sha256:middle" }, ...replay.steps.slice(3)] })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "eventsHash", step: 3, expected: "sha256:middle" },
    });
    await expect(verifyReplay({ ...replay, outcome: "lost" })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "outcome", step: 5, expected: "lost" },
    });
    await expect(verifyReplay({ ...replay, finalStateHash: "sha256:final" })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "finalStateHash", step: 5, expected: "sha256:final", actual: replay.finalStateHash },
    });
  });

  it("uses the actual step index when a recorded sequence is tampered", async () => {
    const replay = await createFixtureReplay();
    const steps = [{ ...replay.steps[0]!, seq: 999, rngAfter: 7 }, ...replay.steps.slice(1)];

    await expect(verifyReplay({ ...replay, steps })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "rngAfter", step: 1, expected: 7, actual: replay.steps[0]?.rngAfter },
    });
  });

  it("compares replayed events instead of trusting recorded event payloads", async () => {
    const replay = await createFixtureReplay();
    const firstStep = replay.steps[0]!;
    const events = firstStep.events.map((event, index) => index === 0
      ? { ...event, payload: { ...event.payload, sourceId: "tampered" } }
      : event);
    const eventsHash = await canonicalSha256(events);

    await expect(verifyReplay({ ...replay, steps: [{ ...firstStep, events, eventsHash }, ...replay.steps.slice(1)] })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "eventsHash", step: 1, expected: eventsHash, actual: firstStep.eventsHash },
    });
  });
});
