import { describe, expect, it } from "vitest";
import { resolveTurn } from "../combat/resolve-turn";
import { createFixtureState, fixtureCommands } from "../testing/fixture";
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

  it("detects version, initial, first-step, middle-step and final deviations", async () => {
    const replay = await createFixtureReplay();

    await expect(verifyReplay({ ...replay, replayVersion: 2 as 1 })).resolves.toMatchObject({
      verified: false,
      mismatch: { field: "replayVersion", step: 0 },
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
      mismatch: { field: "rngAfter", step: 1, expected: 7 },
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
      mismatch: { field: "finalStateHash", step: 5, expected: "sha256:final" },
    });
  });
});
