/// <reference types="vite/client" />

import "./styles.css";
import { AppController } from "./app/app-controller";
import { mountApp } from "./app/app-view";
import { LocalSaveStore } from "./app/save-store";
import { WebSocketRunnerClient } from "./app/runner-client";
import { PYTHON_RPG_CAMPAIGN } from "./game/content/python/levels";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) throw new Error("Missing #app root");

const controller = new AppController({
  runner: new WebSocketRunnerClient("ws://127.0.0.1:5175"),
  saveStore: new LocalSaveStore(window.localStorage),
}, PYTHON_RPG_CAMPAIGN);

mountApp(root, controller);
void controller.start();
