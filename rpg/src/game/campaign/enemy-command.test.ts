import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "../content/types";
import type { BattleState } from "../combat/types";
import { createFixtureState } from "../testing/fixture";
import { enemyCommand } from "./enemy-command";

function fixtureLevel(): LevelDefinition {
  return {
    id: "python-marsh-01",
    title: "fixture",
    briefing: [],
    starterCode: "",
    guidance: { objective: ["test"], concepts: ["test"], worldFields: ["test"], commandExamples: ["test"], levelRules: ["test"] },
    initialBattle: createFixtureState(),
    enemyBehaviors: { golem: { type: "corrupt" } },
    reward: { type: "ability", abilityId: "ward" },
  };
}

function activeEnemy(overrides: Partial<BattleState> = {}): BattleState {
  const state = createFixtureState();
  const base: BattleState = {
    ...state,
    turnOrder: ["golem"],
    turnIndex: 0,
    units: state.units.map((unit) => unit.id === "golem"
        ? { ...unit, cell: { x: 1, y: 1 } }
        : unit),
  };
  return { ...base, ...overrides };
}

function levelWithBehavior(type: "corrupt" | "hunt-player" | "guard"): LevelDefinition {
  return { ...fixtureLevel(), enemyBehaviors: { golem: { type } } };
}

describe("enemyCommand", () => {
  it("lets a corrupt enemy interact when it is already next to the key objective", () => {
    expect(enemyCommand(fixtureLevel(), activeEnemy())).toEqual({
      actorId: "golem",
      expectedRevision: 0,
      action: { type: "interact", targetId: "relay" },
    });
  });

  it("moves a corrupt enemy one step and interacts when the new cell is adjacent", () => {
    const state = activeEnemy({
      objectives: [{ id: "relay", cell: { x: 1, y: 1 }, durability: 2, completed: false, key: true }],
      units: createFixtureState().units.map((unit) => unit.id === "golem"
        ? { ...unit, cell: { x: 2, y: 0 } }
        : unit),
    });

    expect(enemyCommand(fixtureLevel(), state)).toEqual({
      actorId: "golem",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 0 }],
      action: { type: "interact", targetId: "relay" },
    });
  });

  it("lets a hunter attack scout when already in ordinary attack range", () => {
    const state = activeEnemy({
      units: createFixtureState().units.map((unit) => unit.id === "golem"
        ? { ...unit, cell: { x: 1, y: 0 } }
        : unit),
    });

    expect(enemyCommand(levelWithBehavior("hunt-player"), state)).toEqual({
      actorId: "golem",
      expectedRevision: 0,
      action: { type: "attack", targetId: "scout" },
    });
  });

  it("moves a hunter toward scout and attacks from the new adjacent cell", () => {
    const state = activeEnemy({
      units: createFixtureState().units.map((unit) => unit.id === "golem"
        ? { ...unit, cell: { x: 2, y: 0 } }
        : unit),
    });

    expect(enemyCommand(levelWithBehavior("hunt-player"), state)).toEqual({
      actorId: "golem",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 0 }],
      action: { type: "attack", targetId: "scout" },
    });
  });

  it("makes a guard attack scout in range and otherwise guard without moving", () => {
    const adjacent = activeEnemy({
      units: createFixtureState().units.map((unit) => unit.id === "golem"
        ? { ...unit, cell: { x: 1, y: 0 } }
        : unit),
    });
    expect(enemyCommand(levelWithBehavior("guard"), adjacent)).toEqual({
      actorId: "golem",
      expectedRevision: 0,
      action: { type: "attack", targetId: "scout" },
    });
    expect(enemyCommand(levelWithBehavior("guard"), activeEnemy())).toEqual({
      actorId: "golem",
      expectedRevision: 0,
      action: { type: "guard" },
    });
  });

  it("chooses a legal greedy step by distance, then y, then x", () => {
    const state = activeEnemy({
      board: { ...createFixtureState().board, height: 3 },
      units: createFixtureState().units.map((unit) => unit.id === "golem"
        ? { ...unit, cell: { x: 1, y: 1 } }
        : unit.id === "lurker" ? { ...unit, cell: { x: 0, y: 2 } }
        : unit),
      objectives: [{ id: "relay", cell: { x: 2, y: 2 }, durability: 2, completed: false, key: true }],
    });

    expect(enemyCommand(fixtureLevel(), state)).toEqual({
      actorId: "golem",
      expectedRevision: 0,
      movePath: [{ x: 2, y: 1 }],
      action: { type: "interact", targetId: "relay" },
    });
  });

  it("guards when no legal adjacent cell is available", () => {
    const state = activeEnemy({
      board: {
        ...createFixtureState().board,
        blockedCells: [{ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }],
      },
      objectives: [{ id: "relay", cell: { x: 2, y: 0 }, durability: 2, completed: false, key: true }],
    });

    expect(enemyCommand(fixtureLevel(), state)).toEqual({
      actorId: "golem",
      expectedRevision: 0,
      action: { type: "guard" },
    });
  });

  it("guards when the key objective is already completed", () => {
    const state = activeEnemy({
      objectives: [{ id: "relay", cell: { x: 1, y: 1 }, durability: 0, completed: true, key: true }],
    });

    expect(enemyCommand(fixtureLevel(), state)).toEqual({
      actorId: "golem",
      expectedRevision: 0,
      action: { type: "guard" },
    });
  });

  it("rejects corrupt behavior when the level has multiple key objectives", () => {
    const state = activeEnemy({
      objectives: [
        { id: "relay-a", cell: { x: 1, y: 1 }, durability: 2, completed: false, key: true },
        { id: "relay-b", cell: { x: 2, y: 1 }, durability: 2, completed: false, key: true },
      ],
    });

    expect(() => enemyCommand(fixtureLevel(), state)).toThrow("腐化职责要求关卡恰好包含一个关键目标");
  });
});
