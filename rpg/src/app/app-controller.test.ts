import { describe, expect, it } from "vitest";
import type { SaveDataV1, SaveLoadResult, SaveStore } from "./save-store";
import type { RunnerClient, RunnerDisplayState } from "./runner-client";
import type { ExecutionStatus, JsonValue, RunRequest, RunResult } from "../runners/protocol/types";
import { AppController } from "./app-controller";
import { createPythonMarsh01 } from "../game/content/python-marsh-01";

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
  saved?: SaveDataV1;
  removeCount = 0;

  constructor(private readonly initial: SaveLoadResult | null) {}

  load(): SaveLoadResult {
    return this.initial ?? { ok: true, save: null };
  }

  save(value: SaveDataV1): void {
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
    createEncounter: createPythonMarsh01,
    enemyCommand: (state) => ({
      actorId: state.turnOrder[state.turnIndex]!,
      expectedRevision: state.revision,
      action: { type: "wait" },
    }),
    createId: () => "test-run",
  });
}

describe("AppController", () => {
  it("applies a valid player command, auto-waits the enemy, and saves revision 2", async () => {
    const runner = new FakeRunner(completed({
      actorId: "scout",
      expectedRevision: 0,
      movePath: [{ x: 1, y: 0 }],
      action: { type: "attack", targetId: "golem" },
    }));
    const saves = new MemorySaveStore(null);
    const controller = createController(runner, saves);
    await controller.start();

    await controller.runTurn();

    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("game");
    if (snapshot.mode !== "game") throw new Error("expected game mode");
    expect(snapshot.battleState.revision).toBe(2);
    expect(snapshot.battleState.turnOrder[snapshot.battleState.turnIndex]).toBe("scout");
    expect(saves.saved?.battleState.revision).toBe(2);
    expect(snapshot.feedback.kind).toBe("success");
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
    expect(saves.saved?.version).toBe(1);
    expect(runner.connectCount).toBe(1);
  });
});
