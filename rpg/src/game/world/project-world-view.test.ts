import { describe, expect, it } from "vitest";
import { createFixtureState } from "../testing/fixture";
import { projectWorldView } from "./project-world-view";

const forbiddenKeys = new Set([
  "rngState",
  "failureConditions",
  "visibility",
  "remainingCooldown",
  "hazardDamage",
  "maxRounds",
  "phase",
  "turnIndex",
  "turnOrder",
  "initiative",
  "cooldown",
  "key",
]);

function expectDeepFrozen(value: unknown): void {
  if (value !== null && typeof value === "object") {
    expect(Object.isFrozen(value)).toBe(true);
    for (const nestedValue of Object.values(value)) {
      expectDeepFrozen(nestedValue);
    }
  }
}

function expectNoForbiddenKeys(value: unknown): void {
  if (value !== null && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      expect(forbiddenKeys.has(key)).toBe(false);
      expectNoForbiddenKeys(nestedValue);
    }
  }
}

describe("projectWorldView", () => {
  it("creates a frozen JSON-safe whitelist projection without state references", () => {
    const state = createFixtureState();
    const view = projectWorldView(state);
    const scout = view.units.find((unit) => unit.id === "scout");
    const golem = view.units.find((unit) => unit.id === "golem");

    expect(() => JSON.parse(JSON.stringify(view))).not.toThrow();
    expect(view.units.map((unit) => unit.id)).toEqual(["scout", "golem"]);
    expect(scout).toEqual({
      id: "scout",
      team: "allies",
      cell: { x: 0, y: 0 },
      hp: 10,
      maxHp: 10,
      disabled: false,
      statuses: [],
      move: 2,
      attack: 4,
      defense: 0,
      skills: [
        { id: "spark", range: 2, power: 2, target: "unit", kind: "damage" },
        { id: "mend", range: 1, power: 3, target: "unit", kind: "heal" },
      ],
    });
    expect(golem).toEqual({
      id: "golem",
      team: "enemies",
      cell: { x: 2, y: 0 },
      hp: 8,
      maxHp: 8,
      disabled: false,
      statuses: [],
    });
    expect(golem).not.toHaveProperty("skills");
    expect(JSON.stringify(view)).not.toContain("smash");
    expectDeepFrozen(view);
    expectNoForbiddenKeys(view);
    expect(scout?.cell).not.toBe(state.units[0]?.cell);
    expect(view.board.hazardCells).not.toBe(state.board.hazardCells);
    expect(view.objectives[0]?.cell).not.toBe(state.objectives[0]?.cell);

    const mutableState = state as unknown as {
      units: Array<{ cell: { x: number } }>;
      board: { hazardCells: Array<{ x: number }> };
      objectives: Array<{ cell: { x: number } }>;
    };
    mutableState.units[0]!.cell.x = 1;
    mutableState.board.hazardCells[0]!.x = 1;
    mutableState.objectives[0]!.cell.x = 1;
    expect(scout?.cell).toEqual({ x: 0, y: 0 });
    expect(view.board.hazardCells).toEqual([{ x: 2, y: 1 }]);
    expect(view.objectives[0]?.cell).toEqual({ x: 0, y: 1 });
  });
});
