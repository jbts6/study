import { describe, expect, it } from "vitest";
import type { JsonValue, PythonRunRequest, RunRequest, RunResult } from "../runners/protocol/types";
import type { WorldView } from "../game/combat/types";
import type { CampaignDefinition } from "../programs/types";
import { PYTHON_RPG_CAMPAIGN } from "../game/content/python/levels";
import { PYTHON_WORLD_CONTENT } from "../game/content/python/world-chapter-01";
import { createPythonWorldInitialState } from "../game/content/python/world-chapter-01";
import { getLevel } from "../game/content/levels";
import type { GameState } from "../game/world/campaign-types";
import { WorldCampaignController } from "./world-campaign-controller";
import type { LocalSaveDataV3, WorldSaveLoadResult, WorldSaveStore } from "./world-save-store";
import type { RunnerClient, RunnerDisplayState } from "./runner-client";

class FakeRunner implements RunnerClient {
  readonly requests: RunRequest[] = [];
  private readonly listeners = new Set<(state: RunnerDisplayState) => void>();
  private currentState: RunnerDisplayState = "ready";

  constructor(
    private readonly results: readonly RunResult[],
    private readonly validateEntrypoint = false,
  ) {}

  get state(): RunnerDisplayState {
    return this.currentState;
  }

  async connect(): Promise<void> {}

  async run(request: RunRequest): Promise<RunResult> {
    this.requests.push(request);
    if (this.validateEntrypoint && request.language === "python" && !request.files[request.entrypoint.file]?.includes(`def ${request.entrypoint.callable}(`)) {
      return missingEntrypointResult(request);
    }
    const result = this.results[this.requests.length - 1];
    if (result === undefined) throw new Error("missing fake runner result");
    return result;
  }

  interrupt(_runId: string): void {}

  onStateChange(listener: (state: RunnerDisplayState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(state: RunnerDisplayState): void {
    this.currentState = state;
    for (const listener of this.listeners) listener(state);
  }

  close(): void {}
}

class ChapterFlowRunner implements RunnerClient {
  readonly state: RunnerDisplayState = "ready";
  readonly requests: RunRequest[] = [];
  private worldStep = 0;
  private battleTarget: (turn: number) => string = (turn) => turn <= 2 ? "golem" : "lurker";

  retarget(target: (turn: number) => string): void {
    this.battleTarget = target;
  }

  async connect(): Promise<void> {}

  async run(request: RunRequest): Promise<RunResult> {
    this.requests.push(request);
    if (request.language !== "python") throw new Error("chapter flow requires Python requests");
    const revision = requestRevision(request);
    if (request.entrypoint.callable === "choose_turn") {
      const battleTurn = this.requests.filter((item) => item.language === "python" && item.entrypoint.callable === "choose_turn").length;
      const targetId = this.battleTarget(battleTurn);
      const view = request.worldView as unknown as WorldView;
      const scout = view.units.find((unit) => unit.id === "scout");
      const target = view.units.find((unit) => unit.id === targetId);
      let movePath: { x: number; y: number }[] | undefined;
      if (scout !== undefined && target !== undefined) {
        const board = view.board;
        const blocked = (cell: { x: number; y: number }) => view.units.some((unit) => unit.id !== "scout" && unit.cell.x === cell.x && unit.cell.y === cell.y);
        const inBoard = (cell: { x: number; y: number }) => cell.x >= 0 && cell.y >= 0 && cell.x < board.width && cell.y < board.height;
        const distance = (cell: { x: number; y: number }) => Math.abs(cell.x - target.cell.x) + Math.abs(cell.y - target.cell.y);
        const start = { x: scout.cell.x, y: scout.cell.y };
        const steps = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => ({ dx, dy }));
        let best: { x: number; y: number }[] | undefined;
        const consider = (path: { x: number; y: number }[]) => {
          if (!path.every((cell) => inBoard(cell) && !blocked(cell))) return;
          if (best === undefined || distance(path[path.length - 1]!) < distance(best[best.length - 1]!)) best = path;
        };
        for (const first of steps) {
          const p1 = { x: start.x + first.dx, y: start.y + first.dy };
          consider([p1]);
          for (const second of steps) consider([p1, { x: p1.x + second.dx, y: p1.y + second.dy }]);
        }
        movePath = best !== undefined && distance(best[best.length - 1]!) < distance(start) ? best : undefined;
      }
      return completed({
        actorId: "scout",
        expectedRevision: revision,
        ...(movePath === undefined ? {} : { movePath }),
        action: { type: "attack", targetId },
      });
    }

    const commands: readonly JsonValue[] = [
      { expectedRevision: revision, type: "talk", targetId: "toma" },
      { expectedRevision: revision, type: "inspect", targetId: "scrap_pile" },
      { expectedRevision: revision, type: "collect", targetId: "copper_wire_source" },
      { expectedRevision: revision, type: "inspect", targetId: "weather_station" },
      { expectedRevision: revision, type: "travel", locationId: "old_foundry" },
      { expectedRevision: revision, type: "use", itemId: "copper_wire", targetId: "relay" },
      { expectedRevision: revision, type: "prepareBattle", encounterId: "marsh_guardian" },
      { expectedRevision: revision, type: "talk", targetId: "toma" },
    ];
    const command = commands[this.worldStep];
    if (command === undefined) throw new Error("chapter flow has no remaining world command");
    this.worldStep += 1;
    return completed(command);
  }

  interrupt(): void {}
  onStateChange(): () => void { return () => undefined; }
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

function requestRevision(request: PythonRunRequest): number {
  const revision = request.worldView.revision;
  if (typeof revision !== "number") throw new Error("world revision is missing");
  return revision;
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

function missingEntrypointResult(request: PythonRunRequest): RunResult {
  return {
    protocolVersion: 1,
    runId: request.runId,
    attemptId: request.attemptId,
    executionStatus: "runtime_error",
    trace: [],
    diagnostics: [{
      code: "PYTHON_ENTRYPOINT_MISSING",
      severity: "error",
      message: `callable ${request.entrypoint.callable} not found`,
      recoveryAction: "补充入口函数后重新运行。",
    }],
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs: 1, traceEvents: 0 },
  };
}

function createWorldController(
  runner: RunnerClient,
  saveStore: MemoryWorldSaveStore,
  campaign: CampaignDefinition = PYTHON_RPG_CAMPAIGN,
): WorldCampaignController {
  return new WorldCampaignController({
    runner,
    saveStore,
    createId: () => "world-run",
    turnDelayMs: 0,
    explorationStepLimit: 30,
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

async function driveToWorldBattle(controller: WorldCampaignController): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    const snapshot = controller.getSnapshot();
    if (snapshot.mode === "battle") return;
    if (snapshot.mode !== "exploration") throw new Error("expected exploration snapshot before battle");
    await controller.runCode(snapshot.codeDraft);
  }
  throw new Error("battle was not reached");
}

function worldCommands(): readonly JsonValue[] {
  return [
    { expectedRevision: 0, type: "talk", targetId: "toma" },
    { expectedRevision: 1, type: "inspect", targetId: "scrap_pile" },
    { expectedRevision: 2, type: "collect", targetId: "copper_wire_source" },
    { expectedRevision: 3, type: "inspect", targetId: "weather_station" },
    { expectedRevision: 4, type: "travel", locationId: "old_foundry" },
    { expectedRevision: 5, type: "use", itemId: "copper_wire", targetId: "relay" },
    { expectedRevision: 6, type: "prepareBattle", encounterId: "marsh_guardian" },
  ];
}

describe("WorldCampaignController exploration auto-walk", () => {
  it("auto-walks the exploration chain to the encounter checkpoint in one run", async () => {
    const runner = new FakeRunner(worldCommands().map((command) => completed(command)));
    const controller = createWorldController(runner, new MemoryWorldSaveStore());
    await controller.start();

    await controller.runCode(getLevel("python-marsh-01").starterCode);

    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("battle");
    expect(runner.requests).toHaveLength(7);
    if (snapshot.mode === "battle") expect(snapshot.feedback.messages.join(" ")).toContain("遭遇");
  });

  it("stops the walk on a rejected command and resumes from the same step", async () => {
    const interrupted = [
      worldCommands()[0]!,
      { expectedRevision: 1, type: "inspect", targetId: "weather_station" },
    ];
    const runner = new FakeRunner(interrupted.map((command) => completed(command)));
    const controller = createWorldController(runner, new MemoryWorldSaveStore());
    await controller.start();

    await controller.runCode(getLevel("python-marsh-01").starterCode);

    const stopped = controller.getSnapshot();
    expect(stopped.mode).toBe("exploration");
    expect(runner.requests).toHaveLength(2);

    const resume = [worldCommands()[1]!, ...worldCommands().slice(2)];
    (runner as unknown as { results: readonly RunResult[] }).results = [
      ...interrupted.map((command) => completed(command)),
      ...resume.map((command) => completed(command)),
    ];
    await controller.runCode(getLevel("python-marsh-01").starterCode);

    expect(controller.getSnapshot().mode).toBe("battle");
    expect(runner.requests).toHaveLength(8);
    expect(runner.requests[2]?.worldView).toMatchObject({ revision: 1 });
  });

  it("stops the walk at the exploration step limit", async () => {
    const pingPongContent: typeof PYTHON_WORLD_CONTENT = {
      ...PYTHON_WORLD_CONTENT,
      chapters: {
        ...PYTHON_WORLD_CONTENT.chapters,
        "python-marsh-01": {
          ...PYTHON_WORLD_CONTENT.chapters["python-marsh-01"]!,
          questChain: [
            { stepId: "talk_to_toma", accept: { type: "talk", targetId: "toma" }, effects: { advanceTo: "loop_two" } },
            { stepId: "loop_two", accept: { type: "talk", targetId: "toma" }, effects: { advanceTo: "talk_to_toma" } },
          ],
        },
      },
    };
    const loop = Array.from({ length: 10 }, (_, index) => completed({ expectedRevision: index, type: "talk", targetId: "toma" }));
    const runner = new FakeRunner(loop);
    const starter = getLevel("python-marsh-01").starterCode;
    const controller = new WorldCampaignController({
      runner,
      saveStore: new MemoryWorldSaveStore(),
      createId: () => "world-run",
      turnDelayMs: 0,
      explorationStepLimit: 3,
      runLimits: {
        timeoutMs: 5_000, interruptGraceMs: 500, maxFiles: 10, maxFileBytes: 65_536,
        maxSourceBytes: 65_536, maxOutputBytes: 16_384, maxTraceEvents: 1_000, maxValueDepth: 4,
      },
    }, PYTHON_RPG_CAMPAIGN, pingPongContent);
    await controller.start();

    await controller.runCode(starter);

    expect(runner.requests).toHaveLength(3);
    const snapshot = controller.getSnapshot();
    if (snapshot.mode !== "exploration") throw new Error("expected exploration snapshot");
    expect(snapshot.feedback.messages.join(" ")).toContain("最多自动执行");
  });
});

describe("WorldCampaignController autonomous battle", () => {
  it("auto-plays the guardian battle to settlement within one runCode call", async () => {
    const runner = new ChapterFlowRunner();
    const controller = createWorldController(runner, new MemoryWorldSaveStore());
    await controller.start();
    await driveToWorldBattle(controller);
    const requestsBefore = runner.requests.length;

    const battle = controller.getSnapshot();
    if (battle.mode !== "battle") throw new Error("expected battle snapshot");
    await controller.runCode(battle.codeDraft);

    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("exploration");
    expect(runner.requests.length - requestsBefore).toBe(4);
  });

  it("stops the auto sequence on a rejected command and restarts from the initial battle", async () => {
    const runner = new ChapterFlowRunner();
    runner.retarget(() => "golem");
    const controller = createWorldController(runner, new MemoryWorldSaveStore());
    await controller.start();
    await driveToWorldBattle(controller);

    const battle = controller.getSnapshot();
    if (battle.mode !== "battle") throw new Error("expected battle snapshot");
    await controller.runCode(battle.codeDraft);

    const stopped = controller.getSnapshot();
    expect(stopped.mode).toBe("battle");
    if (stopped.mode !== "battle") throw new Error("expected stopped battle snapshot");
    expect(stopped.battleState.phase).toBe("in_progress");
    expect(stopped.feedback.kind).toBe("error");
    const turnRequests = runner.requests.filter((request) => request.language === "python" && request.entrypoint.callable === "choose_turn");
    expect(turnRequests).toHaveLength(3);
    const revisionAtRejection = requestRevision(turnRequests[2] as PythonRunRequest);

    runner.retarget((turn) => turn <= 5 ? "golem" : "lurker");
    const battleAgain = controller.getSnapshot();
    if (battleAgain.mode !== "battle") throw new Error("expected battle snapshot");
    await controller.runCode(battleAgain.codeDraft);

    expect(controller.getSnapshot().mode).toBe("exploration");
    const requestsAfterRestart = runner.requests.filter((request) => request.language === "python" && request.entrypoint.callable === "choose_turn");
    expect(requestRevision(requestsAfterRestart[3] as PythonRunRequest)).toBeLessThan(revisionAtRejection);
    expect(requestsAfterRestart).toHaveLength(7);
  });

  it("accumulates battle events across auto-played turns", async () => {
    const runner = new ChapterFlowRunner();
    const controller = createWorldController(runner, new MemoryWorldSaveStore());
    await controller.start();
    await driveToWorldBattle(controller);
    const battleLogs: (readonly import("../game/combat/types").BattleEvent[])[] = [];
    controller.subscribe((snapshot) => {
      if (snapshot.mode === "battle") battleLogs.push(snapshot.battleLog);
    });

    const battle = controller.getSnapshot();
    if (battle.mode !== "battle") throw new Error("expected battle snapshot");
    await controller.runCode(battle.codeDraft);

    const last = battleLogs.at(-1);
    expect(last).toBeDefined();
    if (last === undefined) throw new Error("expected battle snapshots during auto-play");
    expect(last.some((event) => event.type === "damaged" && event.payload.targetId === "golem")).toBe(true);
    expect(last.some((event) => event.type === "damaged" && event.payload.targetId === "lurker")).toBe(true);
    expect(last.filter((event) => event.type === "battle_finished")).toHaveLength(1);
  });
});

describe("WorldCampaignController", () => {
  it("initializes exploration with world and battle callables in the default draft", async () => {
    const controller = createWorldController(new FakeRunner([]), new MemoryWorldSaveStore());
    await controller.start();

    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("exploration");
    if (snapshot.mode !== "exploration") throw new Error("expected exploration snapshot");
    expect(snapshot.codeDraft).toContain("def choose_world_action(world):");
    expect(snapshot.codeDraft).toContain("def choose_turn(world):");
    const starter = getLevel("python-marsh-01").starterCode;
    expect(starter.match(/def choose_world_action\(world\):/g)).toHaveLength(1);
    expect(starter.match(/def choose_turn\(world\):/g)).toHaveLength(1);
  });

  it("runs the default exploration draft without a missing-callable program error", async () => {
    const runner = new FakeRunner(worldCommands().map((command) => completed(command)), true);
    const controller = createWorldController(runner, new MemoryWorldSaveStore());
    await controller.start();
    const initial = controller.getSnapshot();
    if (initial.mode !== "exploration") throw new Error("expected exploration snapshot");

    await controller.runCode(initial.codeDraft);

    const snapshot = controller.getSnapshot();
    if (snapshot.mode !== "battle") throw new Error("expected battle checkpoint snapshot");
    expect(snapshot.feedback.layer).toBe("task");
    expect(runner.requests[0]).toMatchObject({ entrypoint: { callable: "choose_world_action" } });
  });

  it("runs an exploration command, saves the accepted state and publishes task feedback", async () => {
    const runner = new FakeRunner([
      completed({ expectedRevision: 0, type: "talk", targetId: "toma" }),
      completed({ expectedRevision: 1, type: "inspect", targetId: "weather_station" }),
    ]);
    const saveStore = new MemoryWorldSaveStore();
    const controller = createWorldController(runner, saveStore);
    await controller.start();
    await controller.runCode("def choose_world_action(world):\n    return {}\n");

    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("exploration");
    if (snapshot.mode !== "exploration") throw new Error("expected exploration snapshot");
    expect(snapshot.gameState.revision).toBe(1);
    expect(snapshot.feedback.kind).toBe("error");
    expect(runner.requests[0]).toMatchObject({ entrypoint: { callable: "choose_world_action" } });
    expect(saveStore.saved.at(-1)?.gameState.revision).toBe(1);
  });

  it("preserves an edited draft across runner state snapshots", async () => {
    const runner = new FakeRunner([]);
    const saveStore = new MemoryWorldSaveStore();
    const controller = createWorldController(runner, saveStore);
    await controller.start();

    controller.setCode("# edited draft\n");
    runner.emit("connecting");

    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("exploration");
    if (snapshot.mode !== "exploration") throw new Error("expected exploration snapshot");
    expect(snapshot.codeDraft).toBe("# edited draft\n");
    expect(saveStore.saved.at(-1)?.codeDrafts["python-marsh-01"]).toBe("# edited draft\n");
  });

  it("completes the first chapter from exploration through battle and report submission", async () => {
    const runner = new ChapterFlowRunner();
    const saveStore = new MemoryWorldSaveStore();
    const controller = createWorldController(runner, saveStore);
    await controller.start();

    for (let step = 0; step < 12; step += 1) {
      const current = controller.getSnapshot();
      if (current.mode !== "exploration" && current.mode !== "battle") throw new Error("expected active chapter snapshot");
      if (current.mode === "exploration" && current.gameState.quests[0]?.status === "completed") break;
      await controller.runCode(current.codeDraft);
    }

    const snapshot = controller.getSnapshot();
    expect(snapshot.mode).toBe("exploration");
    if (snapshot.mode !== "exploration") throw new Error("expected completed exploration snapshot");
    expect(snapshot.gameState.quests).toEqual([
      { id: "repair_relay", status: "completed", stepId: "completed" },
    ]);
    expect(snapshot.gameState.worldFlags.chapter_02_unlocked).toBe(true);
    expect(snapshot.gameState.battle).toBeNull();
    expect(saveStore.saved.at(-1)?.gameState).toEqual(snapshot.gameState);
    expect(runner.requests.map((request) => request.language === "python" ? request.entrypoint.callable : "go"))
      .toEqual([
        "choose_world_action",
        "choose_world_action",
        "choose_world_action",
        "choose_world_action",
        "choose_world_action",
        "choose_world_action",
        "choose_world_action",
        "choose_turn",
        "choose_turn",
        "choose_turn",
        "choose_turn",
        "choose_world_action",
      ]);
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
