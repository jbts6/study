import type { BattleState, TurnCommand, WorldView } from "../combat/types";
import { createPythonMarsh01 } from "../content/python-marsh-01";
import { projectWorldView } from "../world/project-world-view";

export const fixtureCommands: readonly TurnCommand[] = [
  { actorId: "scout", expectedRevision: 0, movePath: [{ x: 1, y: 0 }], action: { type: "attack", targetId: "golem" } },
  { actorId: "golem", expectedRevision: 1, action: { type: "wait" } },
  { actorId: "scout", expectedRevision: 2, action: { type: "cast", skillId: "spark", targetId: "golem" } },
  { actorId: "golem", expectedRevision: 3, action: { type: "wait" } },
  { actorId: "scout", expectedRevision: 4, action: { type: "attack", targetId: "golem" } },
];

export function createFixtureState(): BattleState {
  return createPythonMarsh01();
}

export const worldViewFixture: WorldView = projectWorldView(createFixtureState());
