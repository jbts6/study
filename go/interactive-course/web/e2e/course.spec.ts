import { expect, test, type Page } from "@playwright/test";

const course = {
  id: "go-start",
  title: "Go 起步",
  lessons: [
    lesson("go-start-01", "第一个 Go 程序", "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Hello, Go!\")\n}"),
    lesson("go-start-02", "变量与基础类型", "package main"),
    lesson("go-start-03", "if 与 for 控制流", "package main"),
    lesson("go-start-04", "函数与返回值", "package main"),
  ],
};

function lesson(id: string, title: string, starterCode: string) {
  return {
    id,
    title,
    goal: "认识 Go 的基础结构。",
    explanation: "这是浏览器验收使用的课程内容。",
    exampleCode: starterCode,
    starterCode,
    exerciseGoal: "完成当前练习。",
    hints: ["先阅读示例。"],
    tests: [{ id: "TestLesson", label: "检查练习结果" }],
  };
}

test.describe("Go 交互式课程页面", () => {
  test("桌面端可提前浏览后续课程并记录完成状态", async ({ page }) => {
    await mockCourse(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "第一个 Go 程序", exact: true })).toBeVisible();
    await expect(page.locator(".cm-editor")).toBeVisible();
    const nextLesson = page.locator('[data-lesson-id="go-start-02"]');
    await expect(nextLesson).toBeEnabled();
    await expect(nextLesson).toContainText("建议先完成上一节");
    await page.getByRole("button", { name: "运行代码", exact: true }).click();
    await expect(page.getByRole("heading", { name: "通过", exact: true })).toBeVisible();
    await expect(nextLesson).toContainText("开始");

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasOverflow).toBe(false);
  });

  test("移动端结果区位于编辑器之后且执行按钮可操作", async ({ page }) => {
    await mockCourse(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator(".cm-editor")).toBeVisible();

    const runButton = page.getByRole("button", { name: "运行代码", exact: true });
    await expect(runButton).toBeEnabled();
    await runButton.click();
    await expect(page.getByRole("heading", { name: "通过", exact: true })).toBeVisible();

    const editorBox = await page.locator("[data-editor]").boundingBox();
    const resultBox = await page.locator("[data-result-panel]").boundingBox();
    expect(editorBox).not.toBeNull();
    expect(resultBox).not.toBeNull();
    expect(resultBox?.y ?? 0).toBeGreaterThan((editorBox?.y ?? 0) + (editorBox?.height ?? 0) - 1);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasOverflow).toBe(false);
  });

  test("执行服务不可用时显示明确状态", async ({ page }) => {
    await mockCourse(page);
    await page.route("**/api/execute", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ status: "runner_unavailable", stdout: "", stderr: "执行服务不可用", diagnostics: [], tests: [] }),
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "运行代码", exact: true }).click();
    await expect(page.getByRole("heading", { name: "执行服务不可用", exact: true })).toBeVisible();
  });
});

async function mockCourse(page: Page): Promise<void> {
  await page.route("**/api/course", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(course) });
  });
  await page.route("**/api/execute", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "passed",
        stdout: "Hello, Go!\n",
        stderr: "",
        diagnostics: [],
        tests: [{ name: "检查练习结果", status: "passed", message: "" }],
      }),
    });
  });
}
