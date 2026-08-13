import { describe, expect, it } from "vitest";
import "./styles.css";
import { getLevel, LEVEL_ORDER } from "../../game/content/levels";
import type { LevelId } from "../../game/content/types";
import { calculateCellSize, renderGame } from "./render-game";
import type { GameViewSnapshot } from "../messages";

function snapshot(levelId: LevelId, theme: GameViewSnapshot["theme"] = "dark"): GameViewSnapshot {
  const level = getLevel(levelId);
  return {
    mode: "game",
    theme,
    level,
    battleState: structuredClone(level.initialBattle),
    runnerState: "ready",
    feedback: { kind: "idle", title: "", messages: [], stdout: "", stderr: "" },
  };
}

describe("game Webview renderer", () => {
  it("removes the Webview host padding so the game fills the editor group", () => {
    expect(Number.parseFloat(getComputedStyle(document.body).paddingLeft)).toBe(0);
    expect(Number.parseFloat(getComputedStyle(document.body).paddingRight)).toBe(0);
  });

  it("scales square cells from available size and board dimensions", () => {
    const smallBoard = calculateCellSize(600, 450, 4, 3);
    const largeBoard = calculateCellSize(600, 450, 6, 4);

    expect(smallBoard).toBeGreaterThan(largeBoard);
    expect(smallBoard).toBe(146);
    expect(smallBoard).toBeGreaterThan(112);
    expect(largeBoard * 6 + 5 * 5).toBeLessThanOrEqual(600);
    expect(largeBoard * 4 + 3 * 5).toBeLessThanOrEqual(450);
    expect(largeBoard).toBeGreaterThanOrEqual(42);
    expect(calculateCellSize(180, 240, 6, 4) * 6 + 5 * 5).toBeLessThanOrEqual(180);
  });

  it("renders the confirmed five-section half-screen layout", () => {
    const root = document.createElement("div");
    renderGame(root, snapshot("python-marsh-02"));

    expect(root.dataset.theme).toBe("dark");
    expect([...root.children].map((child) => child.className)).toEqual([
      "game-header",
      "mission-strip",
      "battle-stage",
      "feedback-panel feedback-idle",
      "action-bar",
    ]);
    expect(root.querySelectorAll("[role='gridcell']")).toHaveLength(12);
    expect(root.textContent).toContain("毒沼岔路");
    expect(root.textContent).toContain("保护 relay");
    expect(root.querySelector("details.guidance-drawer")?.hasAttribute("open")).toBe(false);
    expect(root.querySelector("[data-command='runTurn']")?.textContent).toContain("运行回合");
  });

  it("renders the 6 by 4 finale without changing component structure", () => {
    const root = document.createElement("div");
    renderGame(root, snapshot("python-marsh-06", "light"));

    expect(root.dataset.theme).toBe("light");
    expect(root.querySelectorAll("[role='gridcell']")).toHaveLength(24);
    expect(root.querySelector("[role='grid']")?.getAttribute("aria-rowcount")).toBe("4");
    expect(root.querySelector("[role='grid']")?.getAttribute("aria-colcount")).toBe("6");
  });

  it("renders every level with its own complete guidance and board dimensions", () => {
    for (const levelId of LEVEL_ORDER) {
      const root = document.createElement("div");
      const level = getLevel(levelId);
      renderGame(root, snapshot(levelId));

      expect(root.querySelectorAll("[role='gridcell']"), levelId)
        .toHaveLength(level.initialBattle.board.width * level.initialBattle.board.height);
      expect(root.querySelectorAll(".guidance-group"), levelId).toHaveLength(5);
      expect(root.textContent, levelId).toContain(level.guidance.objective[0]);
      expect(root.textContent, levelId).toContain(level.guidance.levelRules[0]);
    }
  });
});
