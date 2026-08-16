import { EditorView } from "codemirror";
import { describe, expect, it } from "vitest";
import type { GameSnapshot } from "./app-controller";
import type {
  ControllerSnapshot,
  GameController,
  WorldExplorationSnapshot,
  WorldRecoverySnapshot,
} from "./controller-types";
import { idleFeedback } from "./app-feedback";
import { mountApp } from "./app-view";
import { getLevel } from "../game/content/levels";
import { PYTHON_RPG_CAMPAIGN } from "../game/content/python/levels";
import { createPythonWorldInitialState, PYTHON_WORLD_CONTENT } from "../game/content/python/world-chapter-01";
import { projectCampaignWorldView } from "../game/world/project-campaign-world-view";

function createController(snapshot: ControllerSnapshot, runs: string[] = []): GameController {
  return {
    campaign: PYTHON_RPG_CAMPAIGN,
    start: async () => undefined,
    subscribe: (listener) => {
      listener(snapshot);
      return () => undefined;
    },
    getSnapshot: () => snapshot,
    setCode: () => undefined,
    runCode: async (code) => { runs.push(code); },
    interrupt: async () => undefined,
    resetSave: () => undefined,
    retryLevel: () => undefined,
    advanceLevel: () => undefined,
  };
}

function explorationSnapshot(): WorldExplorationSnapshot {
  const initialState = createPythonWorldInitialState();
  const gameState = {
    ...initialState,
    worldFlags: { ...initialState.worldFlags, safe_route_known: true },
  };
  return {
    mode: "exploration",
    gameState,
    worldView: projectCampaignWorldView(gameState, PYTHON_WORLD_CONTENT),
    codeDraft: getLevel("python-marsh-01").starterCode,
    runnerState: "ready",
    feedback: idleFeedback(),
    diagnostics: [],
  };
}

function battleSnapshot(): GameSnapshot {
  const level = getLevel("python-marsh-01");
  return {
    mode: "game",
    currentLevelId: level.id,
    battleState: level.initialBattle,
    codeDraft: level.starterCode,
    runnerState: "ready",
    feedback: idleFeedback(),
    diagnostics: [],
  };
}

describe("mountApp", () => {
  it("renders world exploration and runs the edited Python source", () => {
    const runs: string[] = [];
    const root = document.createElement("div");
    document.body.append(root);
    const unmount = mountApp(root, createController(explorationSnapshot(), runs));

    expect(root.querySelector("h1")?.textContent).toContain("Python RPG");
    expect(root.textContent).toContain("锈沼营地");
    expect(root.textContent).toContain("repair_relay");
    expect(root.textContent).toContain("old_foundry");
    expect(root.querySelector(".battlefield")).toBeNull();

    const content = root.querySelector(".cm-content");
    if (!(content instanceof HTMLElement)) throw new Error("CodeMirror content was not mounted");
    const view = EditorView.findFromDOM(content);
    if (view === null) throw new Error("CodeMirror view was not mounted");
    view.dispatch({ changes: { from: 0, insert: "# edited\n" } });
    root.querySelector<HTMLButtonElement>("[data-testid='run-turn']")?.click();
    expect(runs.at(-1)).toContain("# edited");

    unmount();
    root.remove();
  });

  it("keeps legacy V2 code readable and downloadable before reset", () => {
    const snapshot: WorldRecoverySnapshot = {
      mode: "world_recovery",
      reason: "legacy_v2",
      message: "检测到旧版存档",
      legacyCodeDraft: "def choose_turn(world):\n    return {}\n",
    };
    const root = document.createElement("div");
    const unmount = mountApp(root, createController(snapshot));

    const legacyCode = root.querySelector<HTMLTextAreaElement>("[data-testid='legacy-code']");
    const download = root.querySelector<HTMLButtonElement>("[data-testid='download-legacy-code']");
    const reset = root.querySelector<HTMLButtonElement>("[data-reset-save]");
    expect(legacyCode?.readOnly).toBe(true);
    expect(legacyCode?.value).toContain("choose_turn");
    expect(download).not.toBeNull();
    expect(reset).not.toBeNull();
    if (download === null || reset === null) throw new Error("Recovery actions were not rendered");
    expect(download.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);

    unmount();
  });

  it("keeps the extracted battle renderer and complete grid intact", () => {
    const snapshot = battleSnapshot();
    const root = document.createElement("div");
    const unmount = mountApp(root, createController(snapshot));

    expect(root.querySelectorAll("[role='gridcell']")).toHaveLength(
      snapshot.battleState.board.width * snapshot.battleState.board.height,
    );
    expect(root.textContent).toContain("保护 relay");
    expect(root.querySelector("[data-testid='api-hints']")?.textContent).not.toContain("prepareBattle");
    expect(root.querySelector("[data-testid='unit-scout']")).not.toBeNull();

    unmount();
  });
});
