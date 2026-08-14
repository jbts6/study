import { describe, expect, it } from "vitest";
import "./styles.css";
import { getLevel, LEVEL_ORDER } from "../../game/content/levels";
import type { LevelId } from "../../game/content/types";
import { GO_PROGRAM } from "../../programs/go";
import { calculateCellSize, renderGame } from "./render-game";
import type { GameViewSnapshot } from "../messages";

function snapshot(levelId: LevelId, theme: GameViewSnapshot["theme"] = "dark"): GameViewSnapshot {
  const level = getLevel(levelId);
  return {
    mode: "game",
    theme,
    campaignTitle: "Python 沼泽战役",
    languageLabel: "Python",
    playerFileName: `${levelId}.py`,
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
    expect(root.querySelector("[data-view-tabs]")).toBeNull();
  });

  it("does not show a manual navigation button for Python combat feedback", () => {
    const root = document.createElement("div");
    renderGame(root, {
      ...snapshot("python-marsh-02"),
      feedback: {
        kind: "error",
        title: "指令无效",
        messages: ["[INVALID_COMMAND] $.action 无效"],
        stdout: "",
        stderr: "",
        relatedReferenceIds: ["type.turn-command"],
      },
    });

    expect(root.querySelector("[data-local-command='openManualReference']")).toBeNull();
  });

  it("renders the 6 by 4 finale without changing component structure", () => {
    const root = document.createElement("div");
    renderGame(root, snapshot("python-marsh-06", "light"));

    expect(root.dataset.theme).toBe("light");
    expect(root.querySelectorAll("[role='gridcell']")).toHaveLength(24);
    expect(root.querySelector("[role='grid']")?.getAttribute("aria-rowcount")).toBe("4");
    expect(root.querySelector("[role='grid']")?.getAttribute("aria-colcount")).toBe("6");
  });

  it("shows retry-only actions when a won battle still has unmet non-key objectives", () => {
    const level = getLevel("python-marsh-06");
    const state = {
      ...structuredClone(level.initialBattle),
      phase: "won" as const,
      objectives: level.initialBattle.objectives.map((objective) => objective.key
        ? { ...objective, completed: true, durability: 0 }
        : objective),
    };
    const root = document.createElement("div");
    renderGame(root, { ...snapshot("python-marsh-06"), battleState: state });

    expect(root.querySelector("[data-command='retryLevel']")?.textContent).toContain("重试本关");
    expect(root.querySelector("[data-command='advanceLevel']")).toBeNull();
  });

  it("shows advance and retry for a won ability level, and retry only for a lost battle", () => {
    const ability = getLevel("python-marsh-01");
    const won = {
      ...structuredClone(ability.initialBattle),
      phase: "won" as const,
      objectives: ability.initialBattle.objectives.map((objective) => objective.key
        ? objective
        : { ...objective, completed: true, durability: 0 }),
    };
    const wonRoot = document.createElement("div");
    renderGame(wonRoot, { ...snapshot("python-marsh-01"), battleState: won });
    expect(wonRoot.querySelector("[data-command='advanceLevel']")?.textContent).toContain("进入下一关");
    expect(wonRoot.querySelector("[data-command='retryLevel']")?.textContent).toContain("重试本关");

    const lostRoot = document.createElement("div");
    renderGame(lostRoot, {
      ...snapshot("python-marsh-01"),
      battleState: { ...structuredClone(ability.initialBattle), phase: "lost" },
    });
    expect(lostRoot.querySelector("[data-command='retryLevel']")?.textContent).toContain("重试本关");
    expect(lostRoot.querySelector("[data-command='advanceLevel']")).toBeNull();
  });

  it("locks a completed campaign battle without retry or advance actions", () => {
    const level = getLevel("python-marsh-06");
    const state = {
      ...structuredClone(level.initialBattle),
      phase: "won" as const,
      objectives: level.initialBattle.objectives.map((objective) => ({
        ...objective,
        completed: true,
        durability: 0,
      })),
    };
    const root = document.createElement("div");
    renderGame(root, { ...snapshot("python-marsh-06"), battleState: state });

    expect(root.querySelector("[data-command='retryLevel']")).toBeNull();
    expect(root.querySelector("[data-command='advanceLevel']")).toBeNull();
  });

  it("renders the active Go campaign identity and source file", () => {
    const root = document.createElement("div");
    const goSnapshot = {
      ...snapshot("go-marsh-01"),
      campaignTitle: "Go 沼泽战役",
      languageLabel: "Go",
      playerFileName: "go-marsh-01.go",
    } as GameViewSnapshot;

    renderGame(root, goSnapshot);

    expect(root.textContent).toContain("Go 沼泽战役");
    expect(root.textContent).toContain("Go");
    expect(root.textContent).toContain("go-marsh-01.go");
    expect(root.textContent).not.toContain("Python RPG");
  });

  it("renders the Go tactical manual without changing the five-section layout", () => {
    const root = document.createElement("div");
    const level = getLevel("go-marsh-01");
    const goSnapshot: GameViewSnapshot = {
      ...snapshot("go-marsh-01"),
      campaignTitle: "Go 沼泽战役",
      languageLabel: "Go",
      playerFileName: "go-marsh-01.go",
      programReference: GO_PROGRAM.reference,
    };

    renderGame(root, goSnapshot, { view: "manual", sectionId: "focus" });

    expect(root.children).toHaveLength(5);
    expect(root.querySelector("[role='tablist'][data-view-tabs]")).not.toBeNull();
    expect(root.querySelector("[role='tabpanel'][data-view='manual']")).not.toBeNull();
    expect(root.querySelector("[role='tab'][aria-selected='true']")?.textContent).toContain("本关重点");
    expect(root.textContent).toContain("MoveAndAttack");
    expect(root.textContent).toContain("func ChooseTurn(world World) TurnCommand");
    expect(root.querySelector("[data-reference-id='action.move-and-attack']")).not.toBeNull();
    expect(root.textContent).toContain(level.guidance.apiFocus?.summary);
  });

  it("offers a stable local API navigation button for combat reference feedback", () => {
    const level = getLevel("go-marsh-01");
    const goSnapshot: GameViewSnapshot = {
      ...snapshot("go-marsh-01"),
      campaignTitle: "Go 沼泽战役",
      languageLabel: "Go",
      playerFileName: "go-marsh-01.go",
      level,
      programReference: GO_PROGRAM.reference,
      feedback: {
        kind: "error",
        title: "指令无效",
        messages: ["[INVALID_MOVE_PATH] $.movePath 路径无效"],
        stdout: "",
        stderr: "",
        relatedReferenceIds: ["action.move-and-attack"],
      },
    };
    const root = document.createElement("div");
    renderGame(root, goSnapshot);

    const button = root.querySelector<HTMLButtonElement>("[data-local-command='openManualReference']");
    expect(button?.textContent).toContain("查看相关 API");
    expect(button?.dataset.referenceId).toBe("action.move-and-attack");

    const compileRoot = document.createElement("div");
    renderGame(compileRoot, {
      ...goSnapshot,
      feedback: { ...goSnapshot.feedback, title: "Go 编译失败", relatedReferenceIds: undefined },
    });
    expect(compileRoot.querySelector("[data-local-command='openManualReference']")).toBeNull();
  });

  it("keeps view and manual tab controls connected to labelled panels", () => {
    const level = getLevel("go-marsh-01");
    const goSnapshot: GameViewSnapshot = {
      ...snapshot("go-marsh-01"),
      campaignTitle: "Go 沼泽战役",
      languageLabel: "Go",
      playerFileName: "go-marsh-01.go",
      level,
      programReference: GO_PROGRAM.reference,
    };

    for (const view of ["battle", "manual"] as const) {
      const root = document.createElement("div");
      renderGame(root, goSnapshot, { view, sectionId: "focus" });

      for (const tab of root.querySelectorAll<HTMLButtonElement>("[data-view-tabs] [role='tab']")) {
        const panelId = tab.getAttribute("aria-controls");
        expect(panelId).not.toBeNull();
        const panel = panelId === null ? null : root.querySelector(`#${panelId}`);
        expect(panel).not.toBeNull();
        expect(panel?.getAttribute("aria-labelledby")).toBe(tab.id);
      }

      const manualTabs = [...root.querySelectorAll<HTMLButtonElement>("[data-manual-tabs] [role='tab']")];
      const manualPanel = root.querySelector("#manual-content");
      if (view === "manual") {
        expect(manualTabs.map((tab) => tab.id)).toEqual(["focus", "turn-command", "world", "actions", "sdk"]);
        expect(manualPanel?.getAttribute("aria-labelledby")).toBe("focus");
      } else {
        expect(manualTabs).toHaveLength(0);
        expect(manualPanel).toBeNull();
      }
    }
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
