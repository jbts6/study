import { describe, expect, it } from "vitest";
import { createFixtureState, fixtureCommands } from "../testing/fixture";
import { resolveTurn } from "./resolve-turn";

describe("core fixture", () => {
  it("finishes the fixed combat flow", () => {
    let state = createFixtureState();

    for (const command of fixtureCommands) {
      const result = resolveTurn(state, command);
      if (!result.accepted) throw new Error("fixture command rejected");
      state = result.state;
    }

    expect(state.phase).toBe("won");
    expect(state.revision).toBe(5);
    expect(state.units.find((unit) => unit.id === "golem")?.hp).toBe(0);
  });
});
