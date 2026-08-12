import { describe, expect, it } from "vitest";
import type { SaveDataV2, SaveLoadResult, SaveStore } from "./save-store";
import type { RunnerClient, RunnerDisplayState } from "./runner-client";
import type { ExecutionStatus, JsonValue, RunRequest, RunResult } from "../runners/protocol/types";
import { AppController } from "./app-controller";
import { mountApp } from "./app-view";
import { getLevel } from "../game/content/levels";

class FakeRunner implements RunnerClient {
  readonly state: RunnerDisplayState = "ready";
  connectCount = 0;
  lastRequest?: RunRequest;
  private readonly listeners = new Set<(state: RunnerDisplayState) => void>();

  constructor(private readonly result: RunResult) {}

  async connect(): Promise<void> {
    this.connectCount += 1;
  }

  async run(request: RunRequest): Promise<RunResult> {
    this.lastRequest = request;
    return this.result;
  }

  interrupt(_runId: string): void {}

  onStateChange(listener: (state: RunnerDisplayState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {}
}

class MemorySaveStore implements SaveStore {
  saved?: SaveDataV2;
  removeCount = 0;

  constructor(private readonly initial: SaveLoadResult | null) {}

  load(): SaveLoadResult {
    return this.initial ?? { ok: true, save: null };
  }

  save(value: SaveDataV2): void {
    this.saved = value;
  }

  remove(): void {
    this.removeCount += 1;
  }
}

function completed(returnValue: JsonValue | undefined): RunResult {
  return {
    protocolVersion: 1,
    runId: "test-run",
    attemptId: "test-run:1",
    executionStatus: "completed",
    ...(returnValue === undefined ? {} : { returnValue }),
    trace: [],
    diagnostics: [],
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs: 1, traceEvents: 0 },
  };
}

function failedResult(
  executionStatus: Exclude<ExecutionStatus, "completed">,
  diagnostic: RunResult["diagnostics"][number],
): RunResult {
  return {
    ...completed(undefined),
    executionStatus,
    diagnostics: [diagnostic],
  };
}

function createController(runner: FakeRunner, saveStore: MemorySaveStore): AppController {
  return new AppController({
    runner,
    saveStore,
    createId: () => "test-run",
  });
}

function mountSettlement(controller: AppController): Readonly<{ root: HTMLDivElement; unmount: () => void }> {
  const root = document.createElement("div");
  document.body.append(root);
  return { root, unmount: mountApp(root, controller) };
}

function winningBattle(levelId: "python-marsh-01" | "python-marsh-06") {
  const level = getLevel(levelId);
  return {
    ...level.initialBattle,
    phase: "won" as const,
    objectives: level.initialBattle.objectives.map((objective) => objective.key
      ? objective
      : { ...objective, completed: true, durability: 0 }),
  };
}

function visibleActionIds(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLButtonElement>("button:not([disabled]):not([hidden])")]
    .filter((button) => button.closest("dialog:not([open])") === null)
    .map((button) => button.dataset.testid ?? button.className);
}

describe("AppController", () => {
  it("rejects a level-invalid player interaction before it advances battle or save", async () => {
    const runner = new FakeRunner(completed({
      actorId: "scout",
      expectedRevision: 0,
      action: { type: "interact", targetId: "relay" },
    }));
    const saves = new MemorySaveStore(null);
    const controller = createController(runner, saves);
    await controller.start();

    await controller.runTurn();

    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("game");
    if (snapshot.mode !== "game") throw new Error("expected game mode");
    expect(snapshot.battleState.revision).toBe(0);
    expect(saves.saved?.battleState.revision).toBe(0);
    expect(snapshot.feedback.kind).toBe("error");
    expect(snapshot.feedback.messages).toContain("[INTERACTION_INVALID] $.action.targetId scout 只能交互非关键目标");
    expect(runner.lastRequest?.limits.maxValueDepth).toBe(4);
  });

  it("keeps battle and save unchanged when Python fails", async () => {
    const runner = new FakeRunner(failedResult("syntax_error", {
      code: "PYTHON_SYNTAX_ERROR",
      severity: "error",
      message: "SyntaxError: expected ':'",
      location: { file: "main.py", line: 3, column: 17 },
      recoveryAction: "修改代码后重新运行。",
    }));
    const saves = new MemorySaveStore(null);
    const controller = createController(runner, saves);
    await controller.start();
    const savedBefore = saves.saved;

    await controller.runTurn();

    const snapshot = controller.getSnapshot();
    if (snapshot.mode !== "game") throw new Error("expected game mode");
    expect(snapshot.battleState.revision).toBe(0);
    expect(saves.saved?.battleState.revision).toBe(savedBefore?.battleState.revision);
    expect(snapshot.feedback.kind).toBe("error");
    expect(snapshot.feedback.messages).toContain(
      "[error] PYTHON_SYNTAX_ERROR main.py:3:17 SyntaxError: expected ':'",
    );
  });

  it("requires the exact reset phrase before replacing a corrupt save", async () => {
    const saves = new MemorySaveStore({ ok: false, message: "损坏" });
    const runner = new FakeRunner(completed(null));
    const controller = createController(runner, saves);
    await controller.start();
    expect(controller.getSnapshot().mode).toBe("save_recovery");
    expect(runner.connectCount).toBe(0);

    controller.resetSave("重置");
    expect(controller.getSnapshot().mode).toBe("save_recovery");
    expect(saves.removeCount).toBe(0);

    controller.resetSave("重置存档");
    expect(controller.getSnapshot().mode).toBe("game");
    expect(saves.removeCount).toBe(1);
    expect(saves.saved?.version).toBe(2);
    expect(runner.connectCount).toBe(1);
  });

  it("derives the first-level reward from victory, restores its settlement, then advances only when requested", async () => {
    const first = getLevel("python-marsh-01");
    const victoryBattle = {
      ...first.initialBattle,
      units: first.initialBattle.units.map((unit) => unit.id === "golem" ? { ...unit, cell: { x: 1, y: 0 }, hp: 1 } : unit),
    };
    const runner = new FakeRunner(completed({ actorId: "scout", expectedRevision: 0, action: { type: "attack", targetId: "golem" } }));
    const saves = new MemorySaveStore({ ok: true, save: { version: 2, currentLevelId: "python-marsh-01", battleState: victoryBattle, codeDraft: "my code" } });
    const controller = createController(runner, saves);
    await controller.start();
    await controller.runTurn();

    const settled = controller.getSnapshot();
    if (settled.mode !== "game") throw new Error("expected game mode");
    expect(settled.battleState.phase).toBe("won");
    expect(settled.feedback.messages).toContain("获得新能力：ward");
    expect(saves.saved?.currentLevelId).toBe("python-marsh-01");

    const restored = createController(new FakeRunner(completed(null)), new MemorySaveStore({ ok: true, save: saves.saved! }));
    await restored.start();
    const restoredSnapshot = restored.getSnapshot();
    if (restoredSnapshot.mode !== "game") throw new Error("expected game mode");
    expect(restoredSnapshot.feedback.messages).toContain("获得新能力：ward");

    controller.advanceLevel();
    const next = controller.getSnapshot();
    if (next.mode !== "game") throw new Error("expected game mode");
    expect(next.currentLevelId).toBe("python-marsh-02");
    expect(next.codeDraft).toBe(getLevel("python-marsh-02").starterCode);
  });

  it("blocks an incomplete scout-mark victory without a reward or next level and retries with the current code", async () => {
    const third = getLevel("python-marsh-03");
    const failedObjectiveBattle = {
      ...third.initialBattle,
      units: third.initialBattle.units.map((unit) => unit.id === "hunter-a"
        ? { ...unit, cell: { x: 1, y: 0 }, hp: 1 }
        : unit.id === "hunter-b" ? { ...unit, disabled: true, hp: 0 } : unit),
    };
    const runner = new FakeRunner(completed({ actorId: "scout", expectedRevision: 0, action: { type: "attack", targetId: "hunter-a" } }));
    const saves = new MemorySaveStore({ ok: true, save: { version: 2, currentLevelId: "python-marsh-03", battleState: failedObjectiveBattle, codeDraft: "keep this" } });
    const controller = createController(runner, saves);
    await controller.start();
    await controller.runTurn();

    const settled = controller.getSnapshot();
    if (settled.mode !== "game") throw new Error("expected game mode");
    expect(settled.battleState.phase).toBe("won");
    expect(settled.feedback.messages).toContain("任务失败：勘测印记尚未激活");
    controller.advanceLevel();
    expect(controller.getSnapshot()).toEqual(settled);

    controller.retryLevel();
    const retried = controller.getSnapshot();
    if (retried.mode !== "game") throw new Error("expected game mode");
    expect(retried.battleState.phase).toBe("in_progress");
    expect(retried.codeDraft).toBe("keep this");
  });

  it("renders failure, level victory, and campaign completion settlements with only their allowed operations", async () => {
    const failedLevel = getLevel("python-marsh-03");
    const failedController = createController(
      new FakeRunner(completed(null)),
      new MemorySaveStore({ ok: true, save: {
        version: 2,
        currentLevelId: failedLevel.id,
        battleState: { ...failedLevel.initialBattle, phase: "lost" },
        codeDraft: "retry this",
      } }),
    );
    const failedView = mountSettlement(failedController);
    await failedController.start();

    expect(failedView.root.querySelector("[data-testid='settlement-failed']")).not.toBeNull();
    expect(failedView.root.querySelector("[data-testid='retry-level']")).not.toBeNull();
    expect(failedView.root.querySelector("[data-testid='advance-level']")).toBeNull();
    expect(failedView.root.querySelector("[data-testid='campaign-reset']")).toBeNull();
    expect(visibleActionIds(failedView.root)).toEqual(["retry-level"]);
    failedView.root.querySelector<HTMLButtonElement>("[data-testid='retry-level']")?.click();
    expect(failedController.getSnapshot()).toMatchObject({ mode: "game", battleState: { phase: "in_progress" } });
    failedView.unmount();

    const victoryController = createController(
      new FakeRunner(completed(null)),
      new MemorySaveStore({ ok: true, save: {
        version: 2,
        currentLevelId: "python-marsh-01",
        battleState: winningBattle("python-marsh-01"),
        codeDraft: "advance this",
      } }),
    );
    const victoryView = mountSettlement(victoryController);
    await victoryController.start();

    expect(victoryView.root.querySelector("[data-testid='settlement-victory']")).not.toBeNull();
    expect(victoryView.root.querySelector("[data-testid='advance-level']")).not.toBeNull();
    expect(victoryView.root.querySelector("[data-testid='retry-level']")).not.toBeNull();
    expect(victoryView.root.querySelector("[data-testid='campaign-reset']")).toBeNull();
    expect(visibleActionIds(victoryView.root)).toEqual(["advance-level", "retry-level"]);
    victoryView.root.querySelector<HTMLButtonElement>("[data-testid='advance-level']")?.click();
    expect(victoryController.getSnapshot()).toMatchObject({ mode: "game", currentLevelId: "python-marsh-02" });
    victoryView.unmount();

    const completionController = createController(
      new FakeRunner(completed(null)),
      new MemorySaveStore({ ok: true, save: {
        version: 2,
        currentLevelId: "python-marsh-06",
        battleState: winningBattle("python-marsh-06"),
        codeDraft: "archive this",
      } }),
    );
    const completionView = mountSettlement(completionController);
    await completionController.start();

    expect(completionView.root.querySelector("[data-testid='settlement-complete']")).not.toBeNull();
    expect(completionView.root.querySelector("[data-testid='campaign-reset']")).not.toBeNull();
    expect(completionView.root.querySelector("[data-testid='advance-level']")).toBeNull();
    expect(completionView.root.querySelector("[data-testid='retry-level']")).toBeNull();
    expect(visibleActionIds(completionView.root)).toEqual(["campaign-reset"]);
    completionView.unmount();
  });
});
