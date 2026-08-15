import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLevel } from "../../game/content/levels";
import { GO_PROGRAM } from "../../programs/go";
import type { GameViewSnapshot } from "../messages";

type Harness = {
  root: HTMLElement;
  posted: ReturnType<typeof vi.fn>;
  stateCalls: unknown[];
};

function goSnapshot(relatedReferenceIds?: readonly string[]): GameViewSnapshot {
  const level = getLevel("go-marsh-01");
  return {
    mode: "game",
    theme: "dark",
    campaignTitle: "Go 沼泽战役",
    languageLabel: "Go",
    playerFileName: "go-marsh-01.go",
    level,
    battleState: structuredClone(level.initialBattle),
    runnerState: "ready",
    feedback: {
      layer: "task",
      kind: relatedReferenceIds === undefined ? "idle" : "error",
      title: relatedReferenceIds === undefined ? "" : "指令无效",
      messages: [],
      stdout: "",
      stderr: "",
      relatedReferenceIds,
    },
    programReference: GO_PROGRAM.reference,
  };
}

async function createHarness(): Promise<Harness> {
  vi.resetModules();
  document.body.innerHTML = "<div id='game-root'></div>";
  const posted = vi.fn();
  const stateCalls: unknown[] = [];
  Object.defineProperty(globalThis, "acquireVsCodeApi", {
    configurable: true,
    value: () => ({
      postMessage: posted,
      getState: () => undefined,
      setState: (state: unknown) => stateCalls.push(state),
    }),
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class {
      disconnect(): void {}
      observe(): void {}
    },
  });
  await import("./main");
  posted.mockClear();
  return { root: document.querySelector<HTMLElement>("#game-root")!, posted, stateCalls };
}

function sendSnapshot(snapshot: GameViewSnapshot): void {
  window.dispatchEvent(new MessageEvent("message", { data: { type: "snapshot", snapshot } }));
}

function press(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
}

describe("webview main local manual interactions", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 600 });
  });

  it("cycles both tablists and persists Enter/Space activations with focus", async () => {
    const { root, stateCalls } = await createHarness();
    sendSnapshot(goSnapshot());
    stateCalls.length = 0;

    const viewTabs = [...root.querySelectorAll<HTMLButtonElement>("[data-view-tabs] [role='tab']")];
    viewTabs[0]!.focus();
    press(viewTabs[0]!, "ArrowLeft");
    expect(document.activeElement).toBe(viewTabs.at(-1));
    press(viewTabs.at(-1)!, "ArrowRight");
    expect(document.activeElement).toBe(viewTabs[0]);

    let manualTabs = [...root.querySelectorAll<HTMLButtonElement>("[data-manual-tabs] [role='tab']")];
    manualTabs[0]!.focus();
    press(manualTabs[0]!, "ArrowLeft");
    expect(document.activeElement).toBe(manualTabs.at(-1));
    press(manualTabs.at(-1)!, "ArrowRight");
    expect(document.activeElement).toBe(manualTabs[0]);

    const worldTab = root.querySelector<HTMLButtonElement>("[data-manual-tabs] [data-section='world']")!;
    worldTab.focus();
    press(worldTab, "Enter");
    expect(root.querySelector("[data-manual-tabs] [aria-selected='true']")?.id).toBe("world");
    expect(document.activeElement).toBe(root.querySelector("[data-manual-heading]"));
    expect(stateCalls.at(-1)).toEqual({ levelId: "go-marsh-01", view: "manual", sectionId: "world" });

    const battleTab = root.querySelector<HTMLButtonElement>("[data-view-tabs] [data-view='battle']")!;
    battleTab.focus();
    press(battleTab, " ");
    expect(root.querySelector("[data-view='battle'][role='tabpanel']")).not.toBeNull();
    expect(document.activeElement).toBe(root.querySelector(".turn-line"));
    expect(stateCalls.at(-1)).toEqual({ levelId: "go-marsh-01", view: "battle", sectionId: "world" });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    const manualViewTab = root.querySelector<HTMLButtonElement>("[data-view-tabs] [data-view='manual']")!;
    manualViewTab.click();
    manualTabs = [...root.querySelectorAll<HTMLButtonElement>("[data-manual-tabs] [role='tab']")];
    manualTabs[0]!.focus();
    press(manualTabs[0]!, "ArrowUp");
    expect(document.activeElement).toBe(manualTabs.at(-1));
    press(manualTabs.at(-1)!, "ArrowDown");
    expect(document.activeElement).toBe(manualTabs[0]);
  });

  it("focuses the first related API and falls back to turn-command without an id", async () => {
    const { root, stateCalls } = await createHarness();
    sendSnapshot(goSnapshot(["type.world", "action.move-and-attack"]));
    stateCalls.length = 0;

    root.querySelector<HTMLButtonElement>("[data-local-command='openManualReference']")!.click();
    expect(root.querySelector("[data-manual-tabs] [aria-selected='true']")?.id).toBe("world");
    expect(document.activeElement).toBe(root.querySelector("[data-reference-id='type.world'] h3"));
    expect(stateCalls.at(-1)).toEqual({ levelId: "go-marsh-01", view: "manual", sectionId: "world" });

    sendSnapshot(goSnapshot());
    const fallback = document.createElement("button");
    fallback.type = "button";
    fallback.dataset.localCommand = "openManualReference";
    root.append(fallback);
    fallback.click();
    expect(root.querySelector("[data-manual-tabs] [aria-selected='true']")?.id).toBe("turn-command");
    expect(document.activeElement).toBe(root.querySelector("[data-manual-heading]"));
    expect(stateCalls.at(-1)).toEqual({ levelId: "go-marsh-01", view: "manual", sectionId: "turn-command" });
  });

  it("keeps host actions on the existing WebviewCommand protocol", async () => {
    const { root, posted } = await createHarness();
    sendSnapshot(goSnapshot());
    root.querySelector<HTMLButtonElement>("[data-command='runTurn']")!.click();
    expect(posted).toHaveBeenCalledWith({ type: "runTurn" });
  });
});
