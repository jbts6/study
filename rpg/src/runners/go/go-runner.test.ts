import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { worldViewFixture } from "../../game/testing/fixture";
import type { CompiledRunRequest } from "../protocol/types";
import type { GoProcessHandle, GoProcessResult, StartGoProcessOptions } from "./go-process";
import { GoRunner } from "./go-runner";

const roots: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function request(source: string, overrides: Partial<CompiledRunRequest["limits"]> = {}): CompiledRunRequest {
  return {
    protocolVersion: 1,
    runId: "run-go-1",
    attemptId: "attempt-go-1",
    questId: "go-marsh-01",
    language: "go",
    files: { "strategy.go": source },
    entrypoint: { file: "strategy.go" },
    worldView: worldViewFixture,
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

async function fixtureRunner(
  startProcess: (options: StartGoProcessOptions) => GoProcessHandle,
): Promise<GoRunner> {
  const root = await mkdtemp(path.join(tmpdir(), "go-runner-test-"));
  roots.push(root);
  const runner = new GoRunner({
    globalStoragePath: path.join(root, "storage"),
    detectGo: async () => ({ ok: true, goPath: "go", version: "1.24.3" }),
    startProcess,
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
    const runner = await fixtureRunner((options) => {
      stage += 1;
      if (stage === 1) {
        const output = options.args[options.args.indexOf("-o") + 1];
        return processAfter(writeFile(output, "binary"), { durationMs: 11 });
      }
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

  it("把 WorldView 写入策略进程 stdin", async () => {
    let stage = 0;
    let stdin = "";
    const runner = await fixtureRunner((options) => {
      stage += 1;
      if (stage === 1) {
        const output = options.args[options.args.indexOf("-o") + 1];
        return processAfter(writeFile(output, "binary"));
      } else {
        stdin = options.stdin ?? "";
        return processAfter(writeFile(
          options.env?.RPG_RESULT_PATH ?? "",
          JSON.stringify({ action: { type: "wait" } }),
        ));
      }
    });

    await runner.run(request("package main\nfunc ChooseTurn(world World) TurnCommand { return Wait(world) }"));

    expect(JSON.parse(stdin)).toEqual(worldViewFixture);
  });

  it("临时工程包含 SDK、入口和玩家策略", async () => {
    let stage = 0;
    let projectDirectory = "";
    let contents: string[] = [];
    const files = ["go.mod", "strategy.go", "sdk.go", "runner_main.go"];
    const runner = await fixtureRunner((options) => {
      stage += 1;
      if (stage === 1) {
        projectDirectory = options.cwd;
        const output = options.args[options.args.indexOf("-o") + 1];
        const inspectAndBuild = Promise.all(
          files.map((file) => readFile(path.join(options.cwd, file), "utf8")),
        ).then(async (loaded) => {
          contents = loaded;
          await writeFile(output, "binary");
        });
        return processAfter(inspectAndBuild);
      }
      return processAfter(writeFile(
        options.env?.RPG_RESULT_PATH ?? "",
        JSON.stringify({ action: { type: "wait" } }),
      ));
    });

    await runner.run(request("package main\nfunc ChooseTurn(world World) TurnCommand { return Wait(world) }"));

    expect(contents[0]).toContain("module local/python-rpg-strategy");
    expect(contents[1]).toContain("func ChooseTurn");
    expect(contents[2]).toContain("type TurnCommand struct");
    expect(contents[3]).toContain("RPG_RESULT_PATH");
    await expect(access(projectDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
