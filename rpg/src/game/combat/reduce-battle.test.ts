import { describe, expect, it } from "vitest";
import { createFixtureState } from "../testing/fixture";
import { reduceBattle } from "./reduce-battle";
import { resolveTurn } from "./resolve-turn";
import type { BattleState, TurnCommand } from "./types";

function findUnit(state: BattleState, id: string) {
  const unit = state.units.find((candidate) => candidate.id === id);
  if (unit === undefined) throw new Error(`Missing fixture unit ${id}`);
  return unit;
}

function replaceUnit(state: BattleState, id: string, update: Record<string, unknown>): BattleState {
  return {
    ...state,
    units: state.units.map((unit) => unit.id === id ? { ...unit, ...update } : unit),
  } as BattleState;
}

describe("reduceBattle", () => {
  it("emits attack events in exact protocol order with the accepted revision", () => {
    const result = reduceBattle(createFixtureState(), {
      actorId: "scout",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 0 }],
      action: { type: "attack", targetId: "golem" },
    });

    expect(result.state.revision).toBe(1);
    expect(result.events).toEqual([
      { protocolVersion: 1, seq: 1, stateRevision: 1, type: "moved", payload: { actorId: "scout", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } } },
      { protocolVersion: 1, seq: 2, stateRevision: 1, type: "damaged", payload: { sourceId: "scout", targetId: "golem", amount: 2, hpAfter: 6, coverBonus: 1 } },
      { protocolVersion: 1, seq: 3, stateRevision: 1, type: "turn_advanced", payload: { round: 1, turnIndex: 1, activeUnitId: "golem" } },
    ]);
  });

  it("does not mutate nested state or command input", () => {
    const state = createFixtureState();
    const command: TurnCommand = {
      actorId: "scout",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 0 }],
      action: { type: "attack", targetId: "golem" },
    };
    const stateBefore = JSON.parse(JSON.stringify(state));
    const commandBefore = JSON.parse(JSON.stringify(command));

    reduceBattle(state, command);

    expect(state).toEqual(stateBefore);
    expect(command).toEqual(commandBefore);
  });

  it("resolves raw command rejection atomically without spending a turn", () => {
    const state = createFixtureState();
    const stateBefore = JSON.parse(JSON.stringify(state));
    const result = resolveTurn(state, {
      actorId: "scout",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 1 }],
      action: { type: "attack", targetId: "golem" },
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) throw new Error("The invalid command unexpectedly resolved");
    expect(result.state).toBe(state);
    expect("events" in result).toBe(false);
    expect(state).toEqual(stateBefore);
  });

  it("resolves unit and validator-confirmed cell casts against their target", () => {
    const unitResult = reduceBattle(createFixtureState(), {
      actorId: "scout",
      expectedRevision: 0,
      action: { type: "cast", skillId: "spark", targetId: "golem" },
    });
    expect(findUnit(unitResult.state, "golem").hp).toBe(4);
    expect(unitResult.events.map((event) => event.type)).toEqual(["damaged", "cooldown_changed", "turn_advanced"]);

    const initial = createFixtureState();
    const cellState: BattleState = {
      ...initial,
      units: initial.units.map((unit) => unit.id === "scout"
        ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" ? { ...skill, target: "cell" as const } : skill) }
        : unit),
    };
    const cellResult = resolveTurn(cellState, {
      actorId: "scout",
      expectedRevision: 0,
      action: { type: "cast", skillId: "spark", targetCell: { x: 2, y: 0 } },
    });

    expect(cellResult.accepted).toBe(true);
    if (!cellResult.accepted) throw new Error("The valid cell cast was rejected");
    expect(findUnit(cellResult.state, "golem").hp).toBe(4);
    expect(cellResult.events[0]).toMatchObject({ type: "damaged", payload: { sourceId: "scout", targetId: "golem", amount: 4, hpAfter: 4, coverBonus: 1 } });
  });

  it("heals up to max hp and decrements a cooldown on its owner's later turn", () => {
    const damagedState = replaceUnit(createFixtureState(), "scout", { hp: 5 });
    const healed = reduceBattle(damagedState, {
      actorId: "scout",
      expectedRevision: 0,
      action: { type: "cast", skillId: "mend", targetId: "scout" },
    });
    expect(findUnit(healed.state, "scout").hp).toBe(8);
    expect(healed.events.map((event) => event.type)).toEqual(["healed", "cooldown_changed", "turn_advanced"]);

    const used = reduceBattle(createFixtureState(), {
      actorId: "scout",
      expectedRevision: 0,
      action: { type: "cast", skillId: "spark", targetId: "golem" },
    }).state;
    const afterGolem = reduceBattle(used, { actorId: "golem", expectedRevision: 1, action: { type: "wait" } }).state;
    const cooled = reduceBattle(afterGolem, { actorId: "scout", expectedRevision: 2, action: { type: "wait" } });

    expect(cooled.events).toContainEqual(expect.objectContaining({
      type: "cooldown_changed",
      payload: { unitId: "scout", skillId: "spark", remainingCooldown: 0 },
    }));
  });

  it("emits interact and objective progress events before advancing", () => {
    const result = reduceBattle(createFixtureState(), {
      actorId: "scout",
      expectedRevision: 0,
      action: { type: "interact", targetId: "relay" },
    });

    expect(result.events).toEqual([
      { protocolVersion: 1, seq: 1, stateRevision: 1, type: "interacted", payload: { actorId: "scout", targetId: "relay", durabilityAfter: 1 } },
      { protocolVersion: 1, seq: 2, stateRevision: 1, type: "objective_progressed", payload: { targetId: "relay", durabilityAfter: 1, completed: false } },
      { protocolVersion: 1, seq: 3, stateRevision: 1, type: "turn_advanced", payload: { round: 1, turnIndex: 1, activeUnitId: "golem" } },
    ]);
  });

  it("adds guard then removes expired statuses before the owner's next action", () => {
    const guarded = reduceBattle(createFixtureState(), {
      actorId: "scout",
      expectedRevision: 0,
      action: { type: "guard" },
    });
    expect(guarded.events[0]).toEqual({
      protocolVersion: 1,
      seq: 1,
      stateRevision: 1,
      type: "status_added",
      payload: { unitId: "scout", statusId: "guarded", remainingTurns: 1, defenseBonus: 2 },
    });
    expect(findUnit(guarded.state, "scout").statuses).toEqual([{ id: "guarded", remainingTurns: 1, defenseBonus: 2 }]);

    const afterGolem = reduceBattle(guarded.state, { actorId: "golem", expectedRevision: 1, action: { type: "wait" } }).state;
    const expired = reduceBattle(afterGolem, { actorId: "scout", expectedRevision: 2, action: { type: "wait" } });
    expect(expired.events[0]).toEqual({
      protocolVersion: 1,
      seq: 1,
      stateRevision: 3,
      type: "status_removed",
      payload: { unitId: "scout", statusId: "guarded" },
    });
    expect(findUnit(expired.state, "scout").statuses).toEqual([]);
  });

  it("sorts status removals and decrements surviving statuses at accepted-turn start", () => {
    const state = replaceUnit(createFixtureState(), "scout", {
      statuses: [
        { id: "zeta", remainingTurns: 1, defenseBonus: 1 },
        { id: "alpha", remainingTurns: 1, defenseBonus: 1 },
        { id: "omega", remainingTurns: 2, defenseBonus: 3 },
      ],
    });
    const result = reduceBattle(state, { actorId: "scout", expectedRevision: 0, action: { type: "wait" } });

    expect(result.events.slice(0, 2).map((event) => event.payload.statusId)).toEqual(["alpha", "zeta"]);
    expect(findUnit(result.state, "scout").statuses).toEqual([{ id: "omega", remainingTurns: 1, defenseBonus: 3 }]);
  });

  it("refreshes effect statuses and consumes xorshift exactly when chance is present", () => {
    const initial = createFixtureState();
    const appliedState: BattleState = {
      ...initial,
      units: initial.units.map((unit) => unit.id === "scout"
        ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" ? { ...skill, effect: { statusId: "alpha", duration: 2, defenseBonus: 3, chancePermille: 1000 } } : skill) }
        : unit.id === "golem" ? { ...unit, statuses: [{ id: "alpha", remainingTurns: 5, defenseBonus: 9 }, { id: "zeta", remainingTurns: 4, defenseBonus: 1 }] } : unit),
    };
    const applied = reduceBattle(appliedState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetId: "golem" } });
    expect(applied.state.rngState).toBe(723471715);
    expect(findUnit(applied.state, "golem").statuses).toEqual([
      { id: "alpha", remainingTurns: 2, defenseBonus: 3 },
      { id: "zeta", remainingTurns: 4, defenseBonus: 1 },
    ]);

    const missedState: BattleState = {
      ...createFixtureState(),
      units: createFixtureState().units.map((unit) => unit.id === "scout"
        ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" ? { ...skill, effect: { statusId: "missed", duration: 1, defenseBonus: 1, chancePermille: 0 } } : skill) }
        : unit),
    };
    const missed = reduceBattle(missedState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetId: "golem" } });
    expect(missed.state.rngState).toBe(723471715);
    expect(findUnit(missed.state, "golem").statuses).toEqual([]);

    const certainState: BattleState = {
      ...createFixtureState(),
      units: createFixtureState().units.map((unit) => unit.id === "scout"
        ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" ? { ...skill, effect: { statusId: "certain", duration: 1, defenseBonus: 1 } } : skill) }
        : unit),
    };
    const certain = reduceBattle(certainState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetId: "golem" } });
    expect(certain.state.rngState).toBe(2463534242);
    expect(findUnit(certain.state, "golem").statuses).toEqual([{ id: "certain", remainingTurns: 1, defenseBonus: 1 }]);

    const undefinedChanceState: BattleState = {
      ...createFixtureState(),
      units: createFixtureState().units.map((unit) => unit.id === "scout"
        ? { ...unit, skills: unit.skills.map((skill) => skill.id === "spark" ? { ...skill, effect: { statusId: "undefined", duration: 1, defenseBonus: 1, chancePermille: undefined } } : skill) }
        : unit),
    };
    const undefinedChance = reduceBattle(undefinedChanceState, { actorId: "scout", expectedRevision: 0, action: { type: "cast", skillId: "spark", targetId: "golem" } });
    expect(undefinedChance.state.rngState).toBe(723471715);
    expect(findUnit(undefinedChance.state, "golem").statuses).toEqual([]);
  });

  it("applies hazard damage after the action, then emits disable and terminal outcomes", () => {
    const hazardState = replaceUnit(createFixtureState(), "scout", { cell: { x: 2, y: 1 } });
    const hazard = reduceBattle(hazardState, { actorId: "scout", expectedRevision: 0, action: { type: "wait" } });
    expect(hazard.events).toEqual([
      { protocolVersion: 1, seq: 1, stateRevision: 1, type: "damaged", payload: { sourceId: "hazard", targetId: "scout", amount: 2, hpAfter: 8, coverBonus: 0 } },
      { protocolVersion: 1, seq: 2, stateRevision: 1, type: "turn_advanced", payload: { round: 1, turnIndex: 1, activeUnitId: "golem" } },
    ]);

    const winning = replaceUnit(createFixtureState(), "golem", { hp: 2 });
    const won = reduceBattle(winning, {
      actorId: "scout",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 0 }],
      action: { type: "attack", targetId: "golem" },
    });
    expect(won.events.map((event) => event.type)).toEqual(["moved", "damaged", "unit_disabled", "battle_finished"]);
    expect(won.events[3]).toMatchObject({ type: "battle_finished", payload: { outcome: "won" } });
    expect(findUnit(won.state, "golem").disabled).toBe(true);

    const lossBase = createFixtureState();
    const lossState: BattleState = {
      ...lossBase,
      round: 1,
      maxRounds: 1,
      turnIndex: 1,
      units: lossBase.units.map((unit) => unit.id === "golem"
        ? { ...unit, skills: unit.skills.map((skill) => ({ ...skill, remainingCooldown: 0 })) }
        : unit),
    };
    const lost = reduceBattle(lossState, { actorId: "golem", expectedRevision: 0, action: { type: "wait" } });
    expect(lost.events.map((event) => event.type)).toEqual(["battle_finished"]);
    expect(lost.events[0]).toMatchObject({ type: "battle_finished", payload: { outcome: "lost" } });
  });

  it("skips disabled turn entries and only advances in-progress battles", () => {
    const base = createFixtureState();
    const skipState: BattleState = {
      ...base,
      turnOrder: ["scout", "golem", "lurker"],
      units: base.units.map((unit) => unit.id === "golem"
        ? { ...unit, hp: 2 }
        : unit.id === "lurker" ? { ...unit, disabled: false, visibility: "revealed" }
        : unit),
    };
    const skipped = reduceBattle(skipState, {
      actorId: "scout",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 0 }],
      action: { type: "attack", targetId: "golem" },
    });
    expect(skipped.state.phase).toBe("in_progress");
    expect(skipped.state).toMatchObject({ round: 1, turnIndex: 2 });
    expect(skipped.events.at(-1)).toMatchObject({ type: "turn_advanced", payload: { round: 1, turnIndex: 2, activeUnitId: "lurker" } });

    const wrapBase = createFixtureState();
    const wrapState: BattleState = {
      ...wrapBase,
      round: 1,
      turnIndex: 2,
      turnOrder: ["golem", "scout", "lurker"],
      units: wrapBase.units.map((unit) => unit.id === "golem"
        ? { ...unit, hp: 0, disabled: true }
        : unit.id === "lurker" ? { ...unit, disabled: false, visibility: "revealed" }
        : unit),
    };
    const wrapped = reduceBattle(wrapState, { actorId: "lurker", expectedRevision: 0, action: { type: "wait" } });
    expect(wrapped.state.phase).toBe("in_progress");
    expect(wrapped.state).toMatchObject({ round: 2, turnIndex: 1 });
    expect(wrapped.events.at(-1)).toMatchObject({ type: "turn_advanced", payload: { round: 2, turnIndex: 1, activeUnitId: "scout" } });

    const maxRound = reduceBattle({ ...wrapState, maxRounds: 1 }, { actorId: "lurker", expectedRevision: 0, action: { type: "wait" } });
    expect(maxRound.state).toMatchObject({ phase: "lost", round: 2, turnIndex: 1 });
    expect(maxRound.events).toContainEqual(expect.objectContaining({ type: "battle_finished", payload: { outcome: "lost" } }));
    expect(maxRound.events.some((event) => event.type === "turn_advanced")).toBe(false);
  });

  it("captures a validator-confirmed cell target before moving its actor", () => {
    const base = createFixtureState();
    const state: BattleState = {
      ...base,
      units: base.units.map((unit) => unit.id === "scout"
        ? {
            ...unit,
            hp: 5,
            skills: unit.skills.map((skill) => skill.id === "mend" ? { ...skill, target: "cell" as const } : skill),
          }
        : unit),
    };
    const result = resolveTurn(state, {
      actorId: "scout",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 0 }],
      action: { type: "cast", skillId: "mend", targetCell: { x: 0, y: 0 } },
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) throw new Error("The legal moved cell heal was rejected");
    expect(findUnit(result.state, "scout")).toMatchObject({ cell: { x: 1, y: 0 }, hp: 8 });
    expect(result.events.slice(0, 2)).toMatchObject([
      { type: "moved", payload: { actorId: "scout", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } } },
      { type: "healed", payload: { sourceId: "scout", targetId: "scout", amount: 3, hpAfter: 8 } },
    ]);
  });
});
