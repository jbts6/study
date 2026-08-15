/// <reference types="vite/client" />

import "./styles.css";
import { mountApp } from "./app/app-view";
import { WebSocketRunnerClient } from "./app/runner-client";
import { WorldCampaignController } from "./app/world-campaign-controller";
import { LocalWorldSaveStore } from "./app/world-save-store";
import { PYTHON_RPG_CAMPAIGN } from "./game/content/python/levels";
import { PYTHON_WORLD_CONTENT } from "./game/content/python/world-chapter-01";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) throw new Error("Missing #app root");

const controller = new WorldCampaignController({
  runner: new WebSocketRunnerClient("ws://127.0.0.1:5175"),
  saveStore: new LocalWorldSaveStore(window.localStorage, PYTHON_WORLD_CONTENT),
}, PYTHON_RPG_CAMPAIGN, PYTHON_WORLD_CONTENT);

mountApp(root, controller);
void controller.start();
