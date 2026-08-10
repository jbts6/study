import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { RunnerProof } from "../tools/runner-proof/types";

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
});
