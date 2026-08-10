import { describe, expect, it } from "vitest";
import { createFixtureState } from "../testing/fixture";
import { xorshift32 } from "./types";

describe("types", () => {
  it("uses stable unsigned rng and fixture skills", () => {
    const state = createFixtureState();

    expect(xorshift32(2463534242)).toEqual({ value: 723471715, nextState: 723471715 });
    expect(state.units.find((unit) => unit.id === "scout")?.skills.map((skill) => skill.id)).toEqual([
      "spark",
      "mend",
    ]);
    expect(Number.isInteger(state.rngState)).toBe(true);
  });
});
