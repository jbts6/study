import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { worldViewFixture } from "../src/game/testing/fixture";
import type { RunRequest, RunResult } from "../src/runners/protocol/types";
import type { RunnerProof } from "../tools/runner-proof/types";

type StrategyRunnerProof = RunnerProof & {
  runRequest(request: RunRequest): Promise<RunResult>;
  interruptRun(runId: string): Promise<void>;
};

const validRequest: RunRequest = {
  protocolVersion: 1,
  runId: "run-browser-01",
  attemptId: "attempt-browser-01",
  questId: "python-marsh-03",
  language: "python",
  files: {
    "main.py": "def choose_turn(world):\n return {'action': {'type': 'wait'}}",
  },
  entrypoint: { file: "main.py", callable: "choose_turn" },
  worldView: worldViewFixture,
  allowedModules: [],
  limits: {
    timeoutMs: 15_000,
    interruptGraceMs: 250,
    maxFiles: 8,
    maxFileBytes: 16_384,
    maxSourceBytes: 65_536,
    maxOutputBytes: 16_384,
    maxTraceEvents: 1_000,
    maxValueDepth: 3,
  },
};

const UNSAFE_DIAGNOSTIC_PATTERN = /[A-Z]:\\|\/Users\/|\$[A-Z_]+|pyodide/i;

function expectSafeDiagnostics(result: RunResult): void {
  expect(JSON.stringify(result.diagnostics)).not.toMatch(UNSAFE_DIAGNOSTIC_PATTERN);
}

async function loadRunner(
  page: Page,
): Promise<Awaited<ReturnType<RunnerProof["load"]>>> {
  return page.evaluate(() => window.runnerProof.load());
}

test.describe("Pyodide Worker compatibility", () => {
  test.describe.configure({ mode: "serial" });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/tools/runner-proof/");
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("固定依赖在真实 Worker 中加载", async () => {
    await expect(loadRunner(page)).resolves.toMatchObject({ runtime: "314.0.3" });
  });

  test("真实 Worker 执行 Python", async () => {
    await expect(page.evaluate(() => window.runnerProof.execute("6 * 7"))).resolves.toEqual(42);
    await expect(
      page.evaluate(() => window.runnerProof.execute("{'answer': 42}")),
    ).resolves.toEqual({ answer: 42 });
  });

  test("SharedArrayBuffer 中断无限循环并恢复同一客户端", async () => {
    const capabilities = await page.evaluate(() => ({
      isolated: crossOriginIsolated,
      shared: typeof SharedArrayBuffer === "function",
    }));

    expect(
      capabilities.isolated,
      "SharedArrayBuffer proof requires COOP: same-origin and COEP: require-corp response headers",
    ).toBe(true);
    expect(
      capabilities.shared,
      "SharedArrayBuffer is unavailable; verify the COOP/COEP headers in rpg/vite.config.ts",
    ).toBe(true);

    const pending = page.evaluate(() => window.runnerProof.execute("while True: pass"));
    await page.waitForTimeout(100);
    await expect(page.evaluate(() => window.runnerProof.interrupt())).resolves.toEqual({
      status: "interrupted",
    });
    await expect(pending).rejects.toThrow(/KeyboardInterrupt|interrupted/i);
    await expect(page.evaluate(() => window.runnerProof.execute("40 + 2"))).resolves.toEqual(42);
  });

  test("硬超时终止旧 Worker 并以新 Worker 恢复", async () => {
    await expect(
      page.evaluate(() => window.runnerProof.hardTimeout("while True: pass", 200)),
    ).resolves.toEqual({ status: "timeout", rebuilt: true });
    await expect(page.evaluate(() => window.runnerProof.execute("40 + 2"))).resolves.toEqual(42);
  });

  test("多文件导入返回入口结果", async () => {
    await expect(
      page.evaluate(() =>
        window.runnerProof.writeAndImport(
          {
            "helper.py": "VALUE = 41",
            "main.py": "import helper\nRESULT = helper.VALUE + 1",
          },
          "main.py",
        ),
      ),
    ).resolves.toEqual(42);
  });

  test("同名模块连续运行不会复用 sys.modules 缓存", async () => {
    await expect(
      page.evaluate(() =>
        window.runnerProof.isolatedRun(
          {
            "helper.py": "VALUE = 41",
            "main.py": "import helper\nRESULT = helper.VALUE + 1",
          },
          "main.py",
        ),
      ),
    ).resolves.toEqual(42);
    await expect(
      page.evaluate(() =>
        window.runnerProof.isolatedRun(
          {
            "helper.py": "VALUE = 7",
            "main.py": "import helper\nRESULT = helper.VALUE + 1",
          },
          "main.py",
        ),
      ),
    ).resolves.toEqual(8);
  });

  test("正式 Worker 返回受限 JSON、硬超时与主动中断", async () => {
    await expect(
      page.evaluate(
        (request) => (window.runnerProof as StrategyRunnerProof).runRequest(request),
        validRequest,
      ),
    ).resolves.toMatchObject({
      executionStatus: "completed",
      returnValue: { action: { type: "wait" } },
    });

    const nonSerializable = await page.evaluate(
      (request) =>
        (window.runnerProof as StrategyRunnerProof).runRequest({
          ...request,
          files: { "main.py": "def choose_turn(world):\n  return {1, 2}" },
        }),
      validRequest,
    );
    expect(nonSerializable).toMatchObject({
      executionStatus: "runtime_error",
      diagnostics: [{ code: "RETURN_NOT_SERIALIZABLE" }],
    });
    expectSafeDiagnostics(nonSerializable);

    const timedOut = await page.evaluate(
      (request) =>
        (window.runnerProof as StrategyRunnerProof).runRequest({
          ...request,
          files: { "main.py": "def choose_turn(world):\n  while True: pass" },
          limits: {
            ...request.limits,
            timeoutMs: 500,
            maxTraceEvents: 1_000_000_000,
          },
        }),
      validRequest,
    );
    expect(timedOut).toMatchObject({
      executionStatus: "timeout",
      diagnostics: [{ code: "HARD_TIMEOUT" }],
    });
    expectSafeDiagnostics(timedOut);

    const interruptedRequest: RunRequest = {
      ...validRequest,
      runId: "run-browser-interrupt",
      files: { "main.py": "def choose_turn(world):\n  while True: pass" },
      limits: { ...validRequest.limits, maxTraceEvents: 1_000_000_000 },
    };
    const pending = page.evaluate(
      (request) => (window.runnerProof as StrategyRunnerProof).runRequest(request),
      interruptedRequest,
    );
    await page.waitForTimeout(100);
    await page.evaluate(
      (runId) => (window.runnerProof as StrategyRunnerProof).interruptRun(runId),
      interruptedRequest.runId,
    );
    const interrupted = await pending;
    expect(interrupted).toMatchObject({
      executionStatus: "interrupted",
      returnValue: null,
      diagnostics: [{ code: "INTERRUPTED", severity: "info" }],
      streams: { stdout: "", stderr: "", truncated: false },
    });
    expectSafeDiagnostics(interrupted);
    await expect(
      page.evaluate(
        (request) => (window.runnerProof as StrategyRunnerProof).runRequest(request),
        validRequest,
      ),
    ).resolves.toMatchObject({ executionStatus: "completed" });
  });
});
