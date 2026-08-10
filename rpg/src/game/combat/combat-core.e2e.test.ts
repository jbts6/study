import { describe, expect, it } from "vitest";
import { projectWorldView } from "../world/project-world-view";
import { createFixtureState, fixtureCommands } from "../testing/fixture";
import { createReplay, recordAcceptedTurn, verifyReplay } from "../replay/replay";
import { resolveTurn } from "./resolve-turn";

const metadata = {
  engineVersion: "0.1.0",
  contentVersion: "python-slice-1",
  runnerProtocolVersion: 1 as const,
  questId: "core-fixture",
  battleId: "core-fixture",
  seed: "2463534242",
};

describe("core fixture", () => {
  it("replays five fixed commands identically without Python", async () => {
    const run = async () => {
      let state = createFixtureState();
      let replay = await createReplay(metadata, state);
      const expected = [
        { revision: 1, types: ["moved", "damaged", "turn_advanced"], hp: 6, sparkCooldown: 0 },
        { revision: 2, types: ["cooldown_changed", "turn_advanced"], hp: 6, sparkCooldown: 0 },
        { revision: 3, types: ["damaged", "cooldown_changed", "turn_advanced"], hp: 2, sparkCooldown: 1 },
        { revision: 4, types: ["turn_advanced"], hp: 2, sparkCooldown: 1 },
        {
          revision: 5,
          types: ["damaged", "cooldown_changed", "unit_disabled", "battle_finished"],
          hp: 0,
          sparkCooldown: 0,
        },
      ] as const;

      for (const [index, command] of fixtureCommands.entries()) {
        const view = projectWorldView(state);
        const json = JSON.stringify(view);

        expect(Object.isFrozen(view)).toBe(true);
        expect(() => JSON.parse(json)).not.toThrow();
        expect(json).not.toContain("rngState");
        expect(json).not.toContain("remainingCooldown");
        expect(json).not.toContain("lurker");
        expect(command.expectedRevision).toBe(view.revision);

        const result = resolveTurn(state, command);
        expect(result.accepted).toBe(true);
        if (!result.accepted) throw new Error("fixture command rejected");

        expect(result.state.revision).toBe(expected[index]!.revision);
        expect(result.events.map((event) => event.type)).toEqual(expected[index]!.types);
        expect(result.state.units.find((unit) => unit.id === "golem")?.hp).toBe(expected[index]!.hp);
        expect(result.state.units.find((unit) => unit.id === "scout")?.skills?.find((skill) => skill.id === "spark")?.remainingCooldown)
          .toBe(expected[index]!.sparkCooldown);

        for (const [eventIndex, event] of result.events.entries()) {
          expect(event.seq).toBe(eventIndex + 1);
          expect(event.stateRevision).toBe(state.revision + 1);
        }

        replay = await recordAcceptedTurn(replay, state, result);
        const step = replay.steps.at(-1)!;
        expect(step.seq).toBe(index + 1);
        expect(step.stateRevision).toBe(index);
        expect(step.rngBefore).toBe(2463534242);
        expect(step.rngAfter).toBe(2463534242);
        expect(step.eventsHash).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(step.stateHash).toMatch(/^sha256:[0-9a-f]{64}$/);

        state = result.state;
      }

      return { state, replay, verification: await verifyReplay(replay) };
    };

    const a = await run();
    const b = await run();

    expect(a.state.phase).toBe("won");
    expect(a.verification).toMatchObject({ verified: true });
    expect(a.replay.steps).toHaveLength(5);

    for (const [index, step] of a.replay.steps.entries()) {
      const same = b.replay.steps[index]!;
      expect({
        seq: step.seq,
        stateRevision: step.stateRevision,
        rngBefore: step.rngBefore,
        rngAfter: step.rngAfter,
        eventsHash: step.eventsHash,
        stateHash: step.stateHash,
      }).toEqual({
        seq: same.seq,
        stateRevision: same.stateRevision,
        rngBefore: same.rngBefore,
        rngAfter: same.rngAfter,
        eventsHash: same.eventsHash,
        stateHash: same.stateHash,
      });
    }

    expect(a.replay.finalStateHash).toBe(b.replay.finalStateHash);
  });
});
