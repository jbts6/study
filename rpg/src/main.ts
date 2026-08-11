/// <reference types="vite/client" />

import "./styles.css";
import { AppController } from "./app/app-controller";
import { mountApp } from "./app/app-view";
import { LocalSaveStore } from "./app/save-store";
import { WebSocketRunnerClient } from "./app/runner-client";
import { createPythonMarsh01 } from "./game/content/python-marsh-01";
import type { BattleState, TurnCommand } from "./game/combat/types";

function enemyWait(state: Readonly<BattleState>): TurnCommand {
  const actorId = state.turnOrder[state.turnIndex];
  if (actorId === undefined) throw new Error("Enemy turn has no active actor");
  return { actorId, expectedRevision: state.revision, action: { type: "wait" } };
}

const root = document.querySelector<HTMLElement>("#app");
if (root === null) throw new Error("Missing #app root");

const controller = new AppController({
  runner: new WebSocketRunnerClient("ws://127.0.0.1:5175"),
  saveStore: new LocalSaveStore(window.localStorage),
  createEncounter: createPythonMarsh01,
  enemyCommand: enemyWait,
});

mountApp(root, controller);
void controller.start();
