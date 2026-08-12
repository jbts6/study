import type { BattleState, TurnCommand, WorldView } from "../combat/types";
import { projectWorldView } from "../world/project-world-view";

export const fixtureCommands: readonly TurnCommand[] = [
  { actorId: "scout", expectedRevision: 0, movePath: [{ x: 1, y: 0 }], action: { type: "attack", targetId: "golem" } },
  { actorId: "golem", expectedRevision: 1, action: { type: "wait" } },
  { actorId: "scout", expectedRevision: 2, action: { type: "cast", skillId: "spark", targetId: "golem" } },
  { actorId: "golem", expectedRevision: 3, action: { type: "wait" } },
  { actorId: "scout", expectedRevision: 4, action: { type: "attack", targetId: "golem" } },
];

export function createFixtureState(): BattleState {
  return {
    battleId: "core-fixture", contentVersion: "python-slice-1", revision: 0, round: 1, turnIndex: 0, turnOrder: ["scout", "golem"], phase: "in_progress", rngState: 2463534242, maxRounds: 4,
    board: { width: 3, height: 2, blockedCells: [], hazardCells: [{ x: 2, y: 1 }], coverCells: [{ x: 2, y: 0 }], hazardDamage: 2 },
    objectives: [{ id: "relay", cell: { x: 0, y: 1 }, durability: 2, completed: false, key: true }], failureConditions: { keyObjectiveDestroyed: false },
    units: [
      { id: "scout", team: "allies", visibility: "revealed", cell: { x: 0, y: 0 }, hp: 10, maxHp: 10, attack: 4, defense: 0, move: 2, initiative: 9, disabled: false, statuses: [], skills: [
        { id: "spark", range: 2, power: 2, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" },
        { id: "mend", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "heal" },
      ] },
      { id: "golem", team: "enemies", visibility: "revealed", cell: { x: 2, y: 0 }, hp: 8, maxHp: 8, attack: 2, defense: 1, move: 1, initiative: 4, disabled: false, statuses: [], skills: [{ id: "smash", range: 1, power: 1, cooldown: 2, remainingCooldown: 1, target: "unit", kind: "damage" }] },
      { id: "lurker", team: "enemies", visibility: "hidden", cell: { x: 2, y: 1 }, hp: 5, maxHp: 5, attack: 3, defense: 0, move: 1, initiative: 1, disabled: true, statuses: [], skills: [{ id: "ambush", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" }] },
    ],
  };
}

export const worldViewFixture: WorldView = projectWorldView(createFixtureState());
