import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorldView } from "../../game/combat/types";
import { getLevel } from "../../game/content/levels";
import { worldViewFixture } from "../../game/testing/fixture";
import type { CompiledRunRequest } from "../protocol/types";
import type { GoProcessHandle, GoProcessResult, StartGoProcessOptions } from "./go-process";
import { detectGo } from "./go-detector";
import { createGoProject } from "./go-project";
import { GoRunner } from "./go-runner";

const roots: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function request(
  source: string,
  overrides: Partial<CompiledRunRequest["limits"]> = {},
  worldView: WorldView = worldViewFixture,
): CompiledRunRequest {
  return {
    protocolVersion: 1,
    runId: "run-go-1",
    attemptId: "attempt-go-1",
    questId: "go-marsh-01",
    language: "go",
    files: { "strategy.go": source },
    entrypoint: { file: "strategy.go" },
    worldView,
    limits: {
      timeoutMs: 5_000,
      buildTimeoutMs: 2_000,
      executionTimeoutMs: 1_000,
      interruptGraceMs: 100,
      maxFiles: 10,
      maxFileBytes: 65_536,
      maxSourceBytes: 65_536,
      maxOutputBytes: 16_384,
      maxTraceEvents: 1_000,
      maxValueDepth: 3,
      ...overrides,
    },
  };
}

const sdkWorldViewFixture: WorldView = {
  ...worldViewFixture,
  units: worldViewFixture.units.map((unit) => unit.id === "scout"
    ? {
        ...unit,
        statuses: [{ id: "warded", remainingTurns: 2, defenseBonus: 1 }],
      }
    : unit),
};

const sdkContractProgram = `package main

func require(condition bool, message string) {
    if !condition {
        panic(message)
    }
}

func ChooseTurn(world World) TurnCommand {
    require(world.BattleID == "core-fixture", "battleId")
    require(world.ContentVersion == "python-slice-1", "contentVersion")
    require(world.ActiveUnitID == "scout", "activeUnitId")
    require(world.Revision == 0, "revision")
    require(world.Board.Width == 3 && world.Board.Height == 2, "board size")
    require(len(world.Board.BlockedCells) == 0, "blocked cells")
    require(len(world.Board.HazardCells) == 1 && world.Board.HazardCells[0] == (Cell{X: 2, Y: 1}), "hazard cells")
    require(len(world.Board.CoverCells) == 1 && world.Board.CoverCells[0] == (Cell{X: 2, Y: 0}), "cover cells")
    require(len(world.Objectives) == 1, "objectives")
    relay := world.Objectives[0]
    require(relay.ID == "relay" && relay.Cell == (Cell{X: 0, Y: 1}), "relay identity")
    require(relay.Durability == 2 && !relay.Completed, "relay state")
    require(len(world.Units) == 2, "units")
    scout := world.Units[0]
    require(scout.ID == "scout" && scout.Team == "allies", "scout identity")
    require(scout.Cell == (Cell{X: 0, Y: 0}) && scout.HP == 10 && scout.MaxHP == 10, "scout health")
    require(!scout.Disabled && scout.Move == 2 && scout.Attack == 4 && scout.Defense == 0, "scout stats")
    require(len(scout.Statuses) == 1, "scout statuses")
    require(scout.Statuses[0].ID == "warded" && scout.Statuses[0].RemainingTurns == 2 && scout.Statuses[0].DefenseBonus == 1, "status fields")
    require(len(scout.Skills) == 2, "scout skills")
    spark := scout.Skills[0]
    require(spark.ID == "spark" && spark.Range == 2 && spark.Power == 2, "spark stats")
    require(spark.RemainingCooldown == 0 && spark.Target == "unit" && spark.Kind == "damage", "spark fields")
    golem := world.Units[1]
    require(golem.ID == "golem" && golem.Team == "enemies", "golem identity")
    require(golem.HP == 8 && golem.MaxHP == 8 && !golem.Disabled, "golem state")

    switch world.Round {
    case 1:
        return Guard(world)
    case 2:
        return Cast(world, "spark", "golem")
    case 3:
        return MoveAndCast(world, []Cell{{X: 1, Y: 0}}, "spark", "golem")
    case 4:
        return Interact(world, "relay")
    case 5:
        return MoveAndInteract(world, []Cell{{X: 0, Y: 1}}, "relay")
    default:
        panic("unexpected round")
    }
}
`;

const sdkExpectedTurns = [
  { round: 1, command: { actorId: "scout", expectedRevision: 0, action: { type: "guard" } } },
  { round: 2, command: { actorId: "scout", expectedRevision: 0, action: { type: "cast", targetId: "golem", skillId: "spark" } } },
  { round: 3, command: { actorId: "scout", expectedRevision: 0, movePath: [{ x: 1, y: 0 }], action: { type: "cast", targetId: "golem", skillId: "spark" } } },
  { round: 4, command: { actorId: "scout", expectedRevision: 0, action: { type: "interact", targetId: "relay" } } },
  { round: 5, command: { actorId: "scout", expectedRevision: 0, movePath: [{ x: 0, y: 1 }], action: { type: "interact", targetId: "relay" } } },
] as const;

const GO_STARTER_LEVEL_IDS = ["go-marsh-01", "go-marsh-02"] as const;

function completedProcess(overrides: Partial<GoProcessResult> = {}): GoProcessHandle {
  return {
    result: Promise.resolve({
      exitCode: 0,
      signal: null,
      stdout: "",
      stderr: "",
      truncated: false,
      timedOut: false,
      durationMs: 7,
      ...overrides,
    }),
    interrupt: vi.fn(),
    kill: vi.fn().mockResolvedValue(undefined),
  };
}

function processAfter(task: Promise<void>, overrides: Partial<GoProcessResult> = {}): GoProcessHandle {
  const process = completedProcess(overrides);
  return { ...process, result: task.then(() => process.result) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function fixtureRunner(
  startProcess: (options: StartGoProcessOptions) => GoProcessHandle,
  overrides: Partial<ConstructorParameters<typeof GoRunner>[0]> = {},
): Promise<GoRunner> {
  const root = await mkdtemp(path.join(tmpdir(), "go-runner-test-"));
  roots.push(root);
  const runner = new GoRunner({
    globalStoragePath: path.join(root, "storage"),
    runtimeDirectory: path.resolve("src/runners/go/runtime"),
    detectGo: async () => ({ ok: true, goPath: "go", version: "1.24.3" }),
    startProcess,
    ...overrides,
  });
  await runner.connect();
  return runner;
}

describe("GoRunner", () => {
  it("将 Go 编译错误映射到玩家 Go 源文件的行列", async () => {
    const runner = await fixtureRunner((options) => completedProcess({
      exitCode: 1,
      stderr: `${path.join(options.cwd, "strategy.go")}:2:57: not enough return values`,
    }));

    const result = await runner.run(request("package main\nfunc ChooseTurn(world World) TurnCommand { return }"));

    expect(result).toMatchObject({
      executionStatus: "compile_error",
      diagnostics: [{ location: { file: "go-marsh-01.go", line: 2, column: 57 } }],
      metrics: { buildDurationMs: 7, executionDurationMs: 0 },
    });
  });

  it("从结果文件读取 TurnCommand 并保留玩家日志", async () => {
    let stage = 0;
    let stdin = "";
    const runner = await fixtureRunner((options) => {
      stage += 1;
      if (stage === 1) {
        const output = options.args[options.args.indexOf("-o") + 1];
        return processAfter(writeFile(output, "binary"), { durationMs: 11 });
      }
      stdin = options.stdin ?? "";
      return processAfter(writeFile(options.env?.RPG_RESULT_PATH ?? "", JSON.stringify({
        actorId: "scout",
        expectedRevision: 0,
        action: { type: "wait" },
      })), { stdout: "debug: choosing wait", durationMs: 13 });
    });

    const result = await runner.run(request(`package main
import "fmt"
func ChooseTurn(world World) TurnCommand {
  fmt.Println("debug: choosing wait")
  return Wait(world)
}`));

    expect(result).toMatchObject({
      executionStatus: "completed",
      returnValue: { action: { type: "wait" } },
      streams: { stdout: "debug: choosing wait" },
      metrics: { durationMs: 24, buildDurationMs: 11, executionDurationMs: 13 },
    });
    expect(JSON.parse(stdin)).toEqual(worldViewFixture);
  });

  it("分别报告构建超时，不把构建时间算作策略超时", async () => {
    const runner = await fixtureRunner(() => completedProcess({ timedOut: true, durationMs: 2_001 }));

    await expect(runner.run(request("package main\nfunc ChooseTurn(world World) TurnCommand { return Wait(world) }")))
      .resolves.toMatchObject({
        executionStatus: "timeout",
        diagnostics: [{ code: "GO_BUILD_TIMEOUT" }],
        metrics: { buildDurationMs: 2_001, executionDurationMs: 0 },
      });
  });

  it("分别报告策略执行超时", async () => {
    let stage = 0;
    const runner = await fixtureRunner((options) => {
      stage += 1;
      if (stage === 1) {
        const output = options.args[options.args.indexOf("-o") + 1];
        return processAfter(writeFile(output, "binary"));
      }
      return completedProcess({ timedOut: true, durationMs: 1_001 });
    });

    await expect(runner.run(request("package main\nfunc ChooseTurn(world World) TurnCommand { return Wait(world) }")))
      .resolves.toMatchObject({
        executionStatus: "timeout",
        diagnostics: [{ code: "GO_EXECUTION_TIMEOUT" }],
        metrics: { buildDurationMs: 7, executionDurationMs: 1_001 },
      });
  });

  it("结果文件为空时返回 INVALID_TURN_RESULT", async () => {
    let stage = 0;
    const runner = await fixtureRunner((options) => {
      stage += 1;
      if (stage === 1) {
        const output = options.args[options.args.indexOf("-o") + 1];
        return processAfter(writeFile(output, "binary"));
      }
      return completedProcess();
    });

    await expect(runner.run(request("package main\nfunc ChooseTurn(world World) TurnCommand { return Wait(world) }")))
      .resolves.toMatchObject({
        executionStatus: "runner_error",
        diagnostics: [{ code: "INVALID_TURN_RESULT" }],
      });
  });

  it("检测期间关闭后保持 unavailable", async () => {
    const detection = deferred<Awaited<ReturnType<NonNullable<ConstructorParameters<typeof GoRunner>[0]["detectGo"]>>>>();
    const root = await mkdtemp(path.join(tmpdir(), "go-runner-connect-test-"));
    roots.push(root);
    const runner = new GoRunner({
      globalStoragePath: path.join(root, "storage"),
      detectGo: () => detection.promise,
    });

    const connecting = runner.connect();
    runner.close();
    detection.resolve({ ok: true, goPath: "go", version: "1.24.3" });

    await expect(connecting).rejects.toThrow("已关闭");
    expect(runner.state).toBe("unavailable");
  });

  it("清理失败保留执行结果并复位状态", async () => {
    let stage = 0;
    let projectDirectory = "";
    const runner = await fixtureRunner((options) => {
      stage += 1;
      if (stage === 1) {
        const output = options.args[options.args.indexOf("-o") + 1];
        return processAfter(writeFile(output, "binary"));
      }
      return processAfter(writeFile(
        options.env?.RPG_RESULT_PATH ?? "",
        JSON.stringify({ action: { type: "wait" } }),
      ));
    }, {
      createProject: async (options) => {
        const project = await createGoProject(options);
        projectDirectory = project.directory;
        return { ...project, cleanup: async () => { throw new Error("cleanup denied"); } };
      },
    });

    const result = await runner.run(request("package main\nfunc ChooseTurn(world World) TurnCommand { return Wait(world) }"));

    expect(result).toMatchObject({
      executionStatus: "completed",
      returnValue: { action: { type: "wait" } },
      diagnostics: [{ code: "GO_CLEANUP_FAILED", severity: "warning", message: "cleanup denied" }],
    });
    expect(runner.state).toBe("ready");
    await rm(projectDirectory, { recursive: true, force: true });
  });

  it("强制终止失败时返回可观察诊断", async () => {
    vi.useFakeTimers();
    const started = deferred<void>();
    const child: GoProcessHandle = {
      result: new Promise<GoProcessResult>(() => undefined),
      interrupt: vi.fn(),
      kill: vi.fn().mockRejectedValue(new Error("tree kill denied")),
    };
    const runner = await fixtureRunner(() => {
      started.resolve();
      return child;
    });

    const pending = runner.run(request("package main\nfunc ChooseTurn(world World) TurnCommand { return Wait(world) }"));
    await started.promise;
    runner.interrupt("run-go-1");
    await vi.advanceTimersByTimeAsync(100);
    vi.useRealTimers();
    const outcome = await Promise.race([
      pending,
      new Promise<"still-pending">((resolve) => setTimeout(() => resolve("still-pending"), 250)),
    ]);

    expect(outcome).not.toBe("still-pending");
    expect(outcome).toMatchObject({
      executionStatus: "interrupted",
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "GO_TERMINATION_FAILED", message: "tree kill denied" }),
      ]),
    });
  });

  it("使用本机 Go 校验完整世界字段并精确构造六关所需动作", async () => {
    const detection = await detectGo();
    if (!detection.ok) {
      throw new Error(`${detection.code}: ${detection.recoveryAction}`);
    }
    const root = await mkdtemp(path.join(tmpdir(), "go-runner-real-test-"));
    roots.push(root);
    const runner = new GoRunner({
      globalStoragePath: path.join(root, "storage"),
      runtimeDirectory: path.resolve("src/runners/go/runtime"),
      detectGo: async () => detection,
    });
    await runner.connect();

    for (const expected of sdkExpectedTurns) {
      const result = await runner.run(request(
        sdkContractProgram,
        { buildTimeoutMs: 15_000, executionTimeoutMs: 5_000 },
        { ...sdkWorldViewFixture, round: expected.round },
      ));
      expect(result.executionStatus).toBe("completed");
      expect(result.returnValue).toEqual(expected.command);
    }
    for (const levelId of GO_STARTER_LEVEL_IDS) {
      const result = await runner.run(request(
        getLevel(levelId).starterCode,
        { buildTimeoutMs: 15_000, executionTimeoutMs: 5_000 },
      ));
      expect(result.executionStatus, levelId).toBe("completed");
    }
    runner.close();
  });
});
