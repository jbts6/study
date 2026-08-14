import { EditorView } from "codemirror";
import { describe, expect, it } from "vitest";
import type { AppController, AppSnapshot, GameSnapshot } from "./app-controller";
import { idleFeedback } from "./app-feedback";
import { mountApp } from "./app-view";
import { getLevel } from "../game/content/levels";
import { PYTHON_RPG_CAMPAIGN } from "../game/content/python/levels";

function createPythonController(snapshot: GameSnapshot, changes: string[]): AppController {
  return {
    campaign: PYTHON_RPG_CAMPAIGN,
    subscribe: (listener: (snapshot: AppSnapshot) => void) => {
      listener(snapshot);
      return () => undefined;
    },
    setCode: (code: string) => changes.push(code),
    resetSave: () => undefined,
    runTurn: async () => undefined,
    interrupt: async () => undefined,
  } as unknown as AppController;
}

describe("mountApp", () => {
  it("creates a working Python editor from the campaign language", () => {
    const level = getLevel("python-marsh-01");
    const snapshot: GameSnapshot = {
      mode: "game",
      currentLevelId: level.id,
      battleState: level.initialBattle,
      codeDraft: level.starterCode,
      runnerState: "ready",
      feedback: idleFeedback(),
      diagnostics: [],
    };
    const changes: string[] = [];
    const controller = createPythonController(snapshot, changes);
    const root = document.createElement("div");
    document.body.append(root);
    const unmount = mountApp(root, controller);
    const content = root.querySelector(".cm-content");
    if (!(content instanceof HTMLElement)) throw new Error("CodeMirror content was not mounted");
    const view = EditorView.findFromDOM(content);
    if (view === null) throw new Error("CodeMirror view was not mounted");

    view.dispatch({ changes: { from: 0, insert: "# edited\n" } });

    expect(changes.at(-1)).toContain("# edited");

    unmount();
    root.remove();
  });
});
