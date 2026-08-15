import { describe, expect, it } from "vitest";
import type { JsonValue, RunRequest, RunResult } from "../runners/protocol/types";
import type { CampaignDefinition } from "../programs/types";
import { PYTHON_RPG_CAMPAIGN } from "../game/content/python/levels";
import { PYTHON_WORLD_CONTENT } from "../game/content/python/world-chapter-01";
import { createPythonWorldInitialState } from "../game/content/python/world-chapter-01";
import type { GameState } from "../game/world/campaign-types";
import { WorldCampaignController } from "./world-campaign-controller";
import type { LocalSaveDataV3, WorldSaveLoadResult, WorldSaveStore } from "./world-save-store";
import type { RunnerClient, RunnerDisplayState } from "./runner-client";

class FakeRunner implements RunnerClient {
  readonly state: RunnerDisplayState = "ready";
  readonly requests: RunRequest[] = [];
  private readonly listeners = new Set<(state: RunnerDisplayState) => void>();

  constructor(private readonly results: readonly RunResult[]) {}

  async connect(): Promise<void> {}

  async run(request: RunRequest): Promise<RunResult> {
    this.requests.push(request);
    const result = this.results[this.requests.length - 1];
    if (result === undefined) throw new Error("missing fake runner result");
    return result;
  }

  interrupt(_runId: string): void {}

  onStateChange(listener: (state: RunnerDisplayState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {}
}

class MemoryWorldSaveStore implements WorldSaveStore {
  readonly saved: LocalSaveDataV3[] = [];

  constructor(private readonly initial: WorldSaveLoadResult = { ok: true, save: null }) {}

  load(): WorldSaveLoadResult {
    return this.initial;
  }

  save(value: LocalSaveDataV3): void {
    this.saved.push(value);
  }

  remove(): void {}
}

function completed(returnValue: JsonValue): RunResult {
  return {
    protocolVersion: 1,
    runId: "world-run",
    attemptId: "world-run:1",
    executionStatus: "completed",
    returnValue,
    trace: [],
    diagnostics: [],
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs: 1, traceEvents: 0 },
  };
}

function syntaxErrorResult(): RunResult {
  return {
    protocolVersion: 1,
    runId: "world-run",
    attemptId: "world-run:1",
    executionStatus: "syntax_error",
    trace: [],
    diagnostics: [{
      code: "PYTHON_SYNTAX_ERROR",
      severity: "error",
      message: "SyntaxError: expected ':'",
      location: { file: "main.py", line: 1, column: 12 },
      recoveryAction: "修改代码后重新运行。",
    }],
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs: 1, traceEvents: 0 },
  };
}

function createWorldController(
  runner: FakeRunner,
  saveStore: MemoryWorldSaveStore,
  campaign: CampaignDefinition = PYTHON_RPG_CAMPAIGN,
): WorldCampaignController {
  return new WorldCampaignController({
    runner,
    saveStore,
    createId: () => "world-run",
    runLimits: {
      timeoutMs: 5_000,
      interruptGraceMs: 500,
      maxFiles: 10,
      maxFileBytes: 65_536,
      maxSourceBytes: 65_536,
      maxOutputBytes: 16_384,
      maxTraceEvents: 1_000,
      maxValueDepth: 4,
    },
  }, campaign, PYTHON_WORLD_CONTENT);
}

describe("WorldCampaignController", () => {
  it("runs an exploration command, saves the accepted state and publishes task feedback", async () => {
    const runner = new FakeRunner([completed({ expectedRevision: 0, type: "talk", targetId: "toma" })]);
    const saveStore = new MemoryWorldSaveStore();
    const controller = createWorldController(runner, saveStore);
    await controller.start();
    await controller.runCode("def choose_world_action(world):\n    return {}\n");

    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("exploration");
    if (snapshot.mode !== "exploration") throw new Error("expected exploration snapshot");
    expect(snapshot.gameState.revision).toBe(1);
    expect(snapshot.feedback.layer).toBe("task");
    expect(snapshot.worldView).toEqual(snapshot.worldView);
    expect(runner.requests[0]).toMatchObject({ entrypoint: { callable: "choose_world_action" } });
    expect(saveStore.saved.at(-1)?.gameState.revision).toBe(1);
  });

  it("keeps world state unchanged after a syntax error", async () => {
    const runner = new FakeRunner([syntaxErrorResult()]);
    const controller = createWorldController(runner, new MemoryWorldSaveStore());
    await controller.start();
    const before = controller.getSnapshot();
    await controller.runCode("def broken(:\n");
    const after = controller.getSnapshot();

    expect(after.mode).toBe("exploration");
    if (before.mode !== "exploration" || after.mode !== "exploration") throw new Error("expected exploration snapshots");
    expect(after.gameState).toEqual(before.gameState);
    expect(after.feedback.layer).toBe("program");
    expect(after.diagnostics).toHaveLength(1);
  });

  it("returns a recovery snapshot for a legacy world save", async () => {
    const saveStore = new MemoryWorldSaveStore({
      ok: false,
      reason: "legacy_v2",
      message: "legacy",
      legacyCodeDraft: "old code",
    });
    const controller = createWorldController(new FakeRunner([]), saveStore);
    await controller.start();

    expect(controller.getSnapshot()).toEqual({
      mode: "world_recovery",
      reason: "legacy_v2",
      message: "legacy",
      legacyCodeDraft: "old code",
    });
  });

  it("exposes the active battle directly and switches the Python callable", async () => {
    const state: GameState = {
      ...createPythonWorldInitialState(),
      battle: {
        encounterId: "marsh_guardian",
        state: PYTHON_WORLD_CONTENT.encounters.marsh_guardian!.initialBattle,
      },
    };
    const saveStore = new MemoryWorldSaveStore({
      ok: true,
      save: { version: 3, gameState: state, codeDrafts: { "python-marsh-01": "battle code" } },
    });
    const runner = new FakeRunner([completed({ actorId: "scout", expectedRevision: 0, action: { type: "wait" } })]);
    const controller = createWorldController(runner, saveStore);
    await controller.start();
    await controller.runCode("battle code");

    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("battle");
    if (snapshot.mode !== "battle") throw new Error("expected battle snapshot");
    expect(snapshot.battleLevelId).toBe("python-marsh-01");
    expect(snapshot.battleState).toBe(snapshot.gameState.battle?.state);
    expect(runner.requests[0]).toMatchObject({ entrypoint: { callable: "choose_turn" } });
  });
});
