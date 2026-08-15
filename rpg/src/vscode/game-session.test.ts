import { describe, expect, it } from "vitest";
import type { RunRequest, RunnerDiagnostic, RunResult } from "../runners/protocol/types";
import type { RunnerClient, RunnerDisplayState } from "../app/runner-client";
import type { SaveDataV2, SaveLoadResult, SaveStore } from "../app/save-store";
import type { LocalSaveDataV3, WorldSaveLoadResult, WorldSaveStore } from "../app/world-save-store";
import { AppController } from "../app/app-controller";
import { WorldCampaignController } from "../app/world-campaign-controller";
import type { GameSnapshot } from "../app/app-controller";
import { GameSession } from "./game-session";
import type { ExtensionMessage, ThemePreference } from "./messages";
import { getLevel } from "../game/content/levels";
import { PYTHON_RPG_CAMPAIGN } from "../game/content/python/levels";
import { PYTHON_WORLD_CONTENT, createPythonWorldInitialState } from "../game/content/python/world-chapter-01";
import { GO_RPG_CAMPAIGN } from "../game/content/go/levels";
import type { CampaignDefinition } from "../programs/types";
import { idleFeedback } from "../app/app-feedback";

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

class MemoryWorldSaveStore implements WorldSaveStore {
  value?: LocalSaveDataV3;
  constructor(private readonly initial: WorldSaveLoadResult = { ok: true, save: null }) {}
  load(): WorldSaveLoadResult { return this.initial; }
  save(value: LocalSaveDataV3): void { this.value = value; }
  remove(): void { this.value = undefined; }
}

function staticController(snapshot: GameSnapshot, campaign: CampaignDefinition): AppController {
  return {
    campaign,
    start: async () => undefined,
    getSnapshot: () => snapshot,
    subscribe: (listener: (value: GameSnapshot) => void) => {
      listener(snapshot);
      return () => undefined;
    },
  } as unknown as AppController;
}

describe("GameSession", () => {
  it("runs unsaved level code and republishes a complete snapshot when the Webview is ready", async () => {
    const runner = new FakeRunner();
    const controller = new AppController({ runner, saveStore: new MemorySaveStore(), createId: () => "session-run" }, PYTHON_RPG_CAMPAIGN);
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
    expect(afterRun?.type === "snapshot" && afterRun.snapshot.mode === "battle" && afterRun.snapshot.battleState.revision).toBe(2);

    messages.length = 0;
    await session.handle({ type: "ready" });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.type === "snapshot" && messages[0].snapshot.mode === "battle" && messages[0].snapshot.battleState.revision).toBe(2);

    await session.handle({ type: "setTheme", theme: "dark" });
    expect(theme).toBe("dark");
    expect(opened).toEqual(["python-marsh-01"]);
    session.dispose();
  });

  it("restores a Python world exploration snapshot and opens its chapter file", async () => {
    const gameState = createPythonWorldInitialState();
    const controller = new WorldCampaignController({
      runner: new FakeRunner(),
      saveStore: new MemoryWorldSaveStore({
        ok: true,
        save: { version: 3, gameState, codeDrafts: { [gameState.chapterId]: "restored world code" } },
      }),
    }, PYTHON_RPG_CAMPAIGN, PYTHON_WORLD_CONTENT);
    const messages: ExtensionMessage[] = [];
    const openedLevelIds: string[] = [];
    const session = new GameSession({
      controller,
      workspace: {
        ensureLevelFiles: async () => undefined,
        readLevelCode: async () => "",
        openLevel: async (levelId) => { openedLevelIds.push(levelId); },
      },
      postMessage: (message) => { messages.push(message); },
      getTheme: () => "system",
      setTheme: async () => undefined,
      diagnostics: { clear: () => undefined, replace: () => undefined },
    });

    await session.start();

    const postedMessage = messages.at(-1);
    const postedSnapshot = postedMessage?.type === "snapshot" ? postedMessage.snapshot : undefined;
    expect(postedSnapshot).toMatchObject({
      mode: "exploration",
      chapterId: "python-marsh-01",
      playerFileName: "python-marsh-01.py",
      location: { id: "rust-marsh-camp" },
    });
    expect(openedLevelIds).toEqual(["python-marsh-01"]);
    session.dispose();
  });

  it("restores a Python world battle snapshot through its battle level", async () => {
    const gameState = {
      ...createPythonWorldInitialState(),
      battle: {
        encounterId: "marsh_guardian",
        state: PYTHON_WORLD_CONTENT.encounters.marsh_guardian!.initialBattle,
      },
    };
    const controller = new WorldCampaignController({
      runner: new FakeRunner(),
      saveStore: new MemoryWorldSaveStore({
        ok: true,
        save: { version: 3, gameState, codeDrafts: {} },
      }),
    }, PYTHON_RPG_CAMPAIGN, PYTHON_WORLD_CONTENT);
    const messages: ExtensionMessage[] = [];
    const openedLevelIds: string[] = [];
    const session = new GameSession({
      controller,
      workspace: {
        ensureLevelFiles: async () => undefined,
        readLevelCode: async () => "",
        openLevel: async (levelId) => { openedLevelIds.push(levelId); },
      },
      postMessage: (message) => { messages.push(message); },
      getTheme: () => "system",
      setTheme: async () => undefined,
      diagnostics: { clear: () => undefined, replace: () => undefined },
    });

    await session.start();

    const postedMessage = messages.at(-1);
    const postedSnapshot = postedMessage?.type === "snapshot" ? postedMessage.snapshot : undefined;
    expect(postedSnapshot).toMatchObject({
      mode: "battle",
      level: { id: "python-marsh-01" },
      battleState: gameState.battle.state,
    });
    expect(openedLevelIds).toEqual(["python-marsh-01"]);
    session.dispose();
  });

  it("maps legacy and world recovery snapshots to the shared recovery view", async () => {
    const legacyMessages: ExtensionMessage[] = [];
    const legacySession = new GameSession({
      controller: new AppController({
        runner: new FakeRunner(),
        saveStore: new MemorySaveStore({ ok: false, message: "legacy" }),
      }, PYTHON_RPG_CAMPAIGN),
      workspace: {
        ensureLevelFiles: async () => undefined,
        readLevelCode: async () => "",
        openLevel: async () => undefined,
      },
      postMessage: (message) => { legacyMessages.push(message); },
      getTheme: () => "dark",
      setTheme: async () => undefined,
      diagnostics: { clear: () => undefined, replace: () => undefined },
    });
    await legacySession.start();
    const legacyMessage = legacyMessages.at(-1);
    const legacySnapshot = legacyMessage?.type === "snapshot" ? legacyMessage.snapshot : undefined;
    expect(legacySnapshot).toMatchObject({
      mode: "recovery",
      reason: "corrupt",
      message: "legacy",
      canReset: true,
    });
    legacySession.dispose();

    const worldMessages: ExtensionMessage[] = [];
    const worldSession = new GameSession({
      controller: new WorldCampaignController({
        runner: new FakeRunner(),
        saveStore: new MemoryWorldSaveStore({ ok: false, reason: "corrupt", message: "broken" }),
      }, PYTHON_RPG_CAMPAIGN, PYTHON_WORLD_CONTENT),
      workspace: {
        ensureLevelFiles: async () => undefined,
        readLevelCode: async () => "",
        openLevel: async () => undefined,
      },
      postMessage: (message) => { worldMessages.push(message); },
      getTheme: () => "dark",
      setTheme: async () => undefined,
      diagnostics: { clear: () => undefined, replace: () => undefined },
    });
    await worldSession.start();
    const worldMessage = worldMessages.at(-1);
    const worldSnapshot = worldMessage?.type === "snapshot" ? worldMessage.snapshot : undefined;
    expect(worldSnapshot).toMatchObject({
      mode: "recovery",
      reason: "corrupt",
      message: "broken",
      canReset: true,
    });
    worldSession.dispose();
  });

  it("clears stale diagnostics before a run and projects Python locations onto the current level", async () => {
    const controller = new AppController({
      runner: new FakeRunner(true),
      saveStore: new MemorySaveStore(),
      createId: () => "syntax-run",
    }, PYTHON_RPG_CAMPAIGN);
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
    }, PYTHON_RPG_CAMPAIGN);
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

  it("uses the active Go campaign when opening and publishing its level", async () => {
    const level = getLevel("go-marsh-01");
    const controller = staticController({
      mode: "game",
      currentLevelId: level.id,
      battleState: level.initialBattle,
      codeDraft: "",
      runnerState: "ready",
      feedback: idleFeedback(),
      diagnostics: [],
    }, GO_RPG_CAMPAIGN);
    const opened: string[] = [];
    const messages: ExtensionMessage[] = [];
    const session = new GameSession({
      controller,
      workspace: {
        ensureLevelFiles: async () => undefined,
        readLevelCode: async () => "",
        openLevel: async (levelId) => { opened.push(levelId); },
      },
      postMessage: async (message) => { messages.push(message); },
      getTheme: () => "system",
      setTheme: async () => undefined,
      diagnostics: { clear: () => undefined, replace: () => undefined },
    });

    await session.start();

    expect(opened).toEqual(["go-marsh-01"]);
    const message = messages.at(-1);
    expect(message?.type === "snapshot" && message.snapshot.mode === "battle"
      ? message.snapshot.level.id
      : undefined).toBe("go-marsh-01");
    expect(message?.type === "snapshot" ? message.snapshot : undefined).toMatchObject({
      campaignTitle: "Go 沼泽战役",
      languageLabel: "Go",
      playerFileName: "go-marsh-01.go",
    });
    expect(message?.type === "snapshot" && message.snapshot.mode === "battle"
      ? message.snapshot.programReference?.entrypoint.signature
      : undefined).toBe(GO_RPG_CAMPAIGN.program.reference?.entrypoint.signature);
    expect(message?.type === "snapshot" && message.snapshot.mode === "battle"
      ? message.snapshot.level.guidance.apiFocus?.referenceIds
      : undefined).toEqual(getLevel("go-marsh-01").guidance.apiFocus?.referenceIds);
    session.dispose();
  });

  it("rejects a level outside the active campaign instead of looking it up globally", async () => {
    const level = getLevel("python-marsh-01");
    const controller = staticController({
      mode: "game",
      currentLevelId: level.id,
      battleState: level.initialBattle,
      codeDraft: "",
      runnerState: "ready",
      feedback: idleFeedback(),
      diagnostics: [],
    }, GO_RPG_CAMPAIGN);
    const session = new GameSession({
      controller,
      workspace: {
        ensureLevelFiles: async () => undefined,
        readLevelCode: async () => "",
        openLevel: async () => undefined,
      },
      postMessage: async () => undefined,
      getTheme: () => "system",
      setTheme: async () => undefined,
      diagnostics: { clear: () => undefined, replace: () => undefined },
    });

    await expect(session.start()).rejects.toThrow("关卡不属于当前战役");
    session.dispose();
  });
});
