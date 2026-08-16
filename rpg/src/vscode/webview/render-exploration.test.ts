import { describe, expect, it } from "vitest";
import type { ExplorationViewSnapshot } from "../messages";
import { renderExploration } from "./render-exploration";

function explorationSnapshot(): ExplorationViewSnapshot {
  return {
    mode: "exploration",
    theme: "dark",
    campaignTitle: "Python 锈沼战役",
    languageLabel: "Python",
    playerFileName: "python-marsh-01.py",
    chapterId: "python-marsh-01",
    chapters: [
      { id: "python-marsh-01", title: "唤醒中继器" },
      { id: "python-marsh-02", title: "毒沼岔路" },
    ],
    location: { id: "rust-marsh-camp", name: "锈沼营地", weather: "acid_rain" },
    npcs: [{ id: "toma", name: "托玛", role: "engineer", mood: "worried" }],
    objects: [{ id: "scrap_pile", type: "salvage", status: "uninspected", requiredItems: [] }],
    inventory: [{ id: "copper_wire", amount: 1 }],
    quests: [{ id: "repair_relay", status: "active", stepId: "talk_to_toma" }],
    availableTravel: ["old_foundry"],
    runnerState: "ready",
    feedback: {
      layer: "task",
      kind: "idle",
      title: "",
      messages: [],
      stdout: "",
      stderr: "",
    },
  };
}

describe("exploration Webview renderer", () => {
  it("renders world information and a Python run action without a battle grid", () => {
    const root = document.createElement("main");
    renderExploration(root, explorationSnapshot());

    expect([...root.children].map((child) => child.className)).toEqual([
      "game-header exploration-header",
      "mission-strip exploration-task",
      "exploration-stage",
      "feedback-panel feedback-idle feedback-layer-task",
      "action-bar exploration-actions",
    ]);
    expect(root.querySelector("h1")?.textContent).toBe("锈沼营地");
    expect(root.textContent).toContain("托玛");
    expect(root.textContent).toContain("repair_relay");
    expect(root.textContent).toContain("copper_wire");
    expect(root.textContent).toContain("old_foundry");
    expect(root.querySelector(".battle-grid")).toBeNull();
    expect(root.querySelector("[data-feedback-layer]")?.getAttribute("data-feedback-layer")).toBe("task");
    expect(root.querySelector(".feedback-panel h2")?.textContent).toBe("任务反馈");
    expect(root.querySelector<HTMLButtonElement>("[data-command='runTurn']")?.textContent).toBe("运行 Python");
  });

  it("renders chapter switch buttons and disables the current chapter", () => {
    const root = document.createElement("main");
    renderExploration(root, explorationSnapshot());

    const buttons = [...root.querySelectorAll<HTMLButtonElement>(".chapter-switch button")];
    expect(buttons.map((button) => button.textContent)).toEqual(["第1章", "第2章"]);
    expect(buttons[0]?.disabled).toBe(true);
    expect(buttons[1]?.disabled).toBe(false);
    expect(buttons[1]?.dataset.chapterId).toBe("python-marsh-02");
    expect(buttons[1]?.title).toBe("毒沼岔路");
  });
});
