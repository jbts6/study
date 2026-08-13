import { describe, expect, it } from "vitest";
import type { RunRequest, RunnerDiagnostic, RunResult } from "../runners/protocol/types";
import type { RunnerClient, RunnerDisplayState } from "../app/runner-client";
import type { SaveDataV2, SaveLoadResult, SaveStore } from "../app/save-store";
import { AppController } from "../app/app-controller";
import { GameSession } from "./game-session";
import type { ExtensionMessage, ThemePreference } from "./messages";
import { getLevel } from "../game/content/levels";

class FakeRunner implements RunnerClient {
  readonly state: RunnerDisplayState = "ready";
  lastRequest?: RunRequest;
  constructor(private readonly fail = false) {}
  async connect(): Promise<void> {}
  async run(request: RunRequest): Promise<RunResult> {
    this.lastRequest = request;
    if (this.fail) {
      return {
        protocolVersion: 1,
        runId: request.runId,
        attemptId: request.attemptId,
        executionStatus: "syntax_error",
        trace: [],
        diagnostics: [{
          code: "PYTHON_SYNTAX_ERROR",
          severity: "error",
          message: "SyntaxError: expected ':'",
          location: { file: "main.py", line: 3, column: 17 },
          recoveryAction: "修改代码后重新运行。",
        }],
        streams: { stdout: "", stderr: "", truncated: false },
        metrics: { durationMs: 1, traceEvents: 0 },
      };
    }
    return {
      protocolVersion: 1,
      runId: request.runId,
      attemptId: request.attemptId,
      executionStatus: "completed",
      returnValue: {
        actorId: "scout",
        expectedRevision: request.worldView.revision,
        action: { type: "wait" },
      },
      trace: [], diagnostics: [], streams: { stdout: "", stderr: "", truncated: false }, metrics: { durationMs: 1, traceEvents: 0 },
    };
  }
  interrupt(): void {}
  onStateChange(): () => void { return () => undefined; }
  close(): void {}
}

class MemorySaveStore implements SaveStore {
  value?: SaveDataV2;
  constructor(private readonly initial: SaveLoadResult = { ok: true, save: null }) {}
  load(): SaveLoadResult { return this.initial; }
  save(value: SaveDataV2): void { this.value = value; }
  remove(): void { this.value = undefined; }
}

describe("GameSession", () => {
  it("runs unsaved level code and republishes a complete snapshot when the Webview is ready", async () => {
    const runner = new FakeRunner();
    const controller = new AppController({ runner, saveStore: new MemorySaveStore(), createId: () => "session-run" });
    const messages: ExtensionMessage[] = [];
    const unsavedCode = "def choose_turn(world):\n    return {'unsaved': True}\n";
    const opened: string[] = [];
    let theme: ThemePreference = "system";
    const diagnostics: RunnerDiagnostic[][] = [];
    const session = new GameSession({
      controller,
      workspace: {
        ensureLevelFiles: async () => undefined,
        readLevelCode: async () => unsavedCode,
        openLevel: async (levelId) => { opened.push(levelId); },
      },
      postMessage: async (message) => { messages.push(message); },
      getTheme: () => theme,
      setTheme: async (next) => { theme = next; },
      diagnostics: {
        clear: () => { diagnostics.push([]); },
        replace: (_levelId, values) => { diagnostics.push([...values]); },
      },
    });

    await session.start();
    messages.length = 0;
    await session.handle({ type: "runTurn" });

    expect(runner.lastRequest?.files["main.py"]).toBe(unsavedCode);
    expect(messages.at(-1)?.type).toBe("snapshot");
    const afterRun = messages.at(-1);
    expect(afterRun?.type === "snapshot" && afterRun.snapshot.mode === "game" && afterRun.snapshot.battleState.revision).toBe(2);

    messages.length = 0;
    await session.handle({ type: "ready" });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.type === "snapshot" && messages[0].snapshot.mode === "game" && messages[0].snapshot.battleState.revision).toBe(2);

    await session.handle({ type: "setTheme", theme: "dark" });
    expect(theme).toBe("dark");
    expect(opened).toEqual(["python-marsh-01"]);
    session.dispose();
  });

  it("clears stale diagnostics before a run and projects Python locations onto the current level", async () => {
    const controller = new AppController({
      runner: new FakeRunner(true),
      saveStore: new MemorySaveStore(),
      createId: () => "syntax-run",
    });
    const projected: { levelId: string; diagnostics: readonly RunnerDiagnostic[] }[] = [];
    let clearCount = 0;
    const session = new GameSession({
      controller,
      workspace: {
        ensureLevelFiles: async () => undefined,
        readLevelCode: async () => "def choose_turn(world)\n    return {}\n",
        openLevel: async () => undefined,
      },
      postMessage: async () => undefined,
      getTheme: () => "system",
      setTheme: async () => undefined,
      diagnostics: {
        clear: () => { clearCount += 1; },
        replace: (levelId, diagnostics) => { projected.push({ levelId, diagnostics }); },
      },
    });

    await session.start();
    await session.handle({ type: "runTurn" });

    expect(clearCount).toBe(1);
    expect(projected.at(-1)).toMatchObject({
      levelId: "python-marsh-01",
      diagnostics: [{ location: { file: "main.py", line: 3, column: 17 } }],
    });
    session.dispose();
  });

  it("opens the next level document when a completed settlement advances", async () => {
    const first = getLevel("python-marsh-01");
    const victory = {
      ...first.initialBattle,
      phase: "won" as const,
      objectives: first.initialBattle.objectives.map((objective) => objective.key
        ? objective
        : { ...objective, completed: true, durability: 0 }),
    };
    const controller = new AppController({
      runner: new FakeRunner(),
      saveStore: new MemorySaveStore({
        ok: true,
        save: { version: 2, currentLevelId: first.id, battleState: victory, codeDraft: "" },
      }),
    });
    const opened: string[] = [];
    const session = new GameSession({
      controller,
      workspace: {
        ensureLevelFiles: async () => undefined,
        readLevelCode: async () => "",
        openLevel: async (levelId) => { opened.push(levelId); },
      },
      postMessage: async () => undefined,
      getTheme: () => "system",
      setTheme: async () => undefined,
      diagnostics: { clear: () => undefined, replace: () => undefined },
    });

    await session.start();
    await session.handle({ type: "advanceLevel" });

    expect(opened).toEqual(["python-marsh-01", "python-marsh-02"]);
    session.dispose();
  });
});
