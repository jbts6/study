import { expect, test } from "@playwright/test";

const WINNING_CODE = `def choose_turn(world):
    actor = world["activeUnitId"]
    revision = world["revision"]
    if revision == 0:
        return {
            "actorId": actor,
            "expectedRevision": revision,
            "movePath": [{"x": 1, "y": 0}],
            "action": {"type": "attack", "targetId": "golem"},
        }
    if revision == 2:
        return {
            "actorId": actor,
            "expectedRevision": revision,
            "action": {"type": "cast", "skillId": "spark", "targetId": "golem"},
        }
    return {
        "actorId": actor,
        "expectedRevision": revision,
        "action": {"type": "attack", "targetId": "golem"},
    }
`;

test("runs, restores, and completes the stage 3 encounter", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByTestId("current-level-id")).toHaveText("python-marsh-01");
  await expect(page.getByTestId("runner-status")).toHaveText("可运行");

  await page.locator(".cm-content").fill(WINNING_CODE);
  await page.getByTestId("run-turn").click();
  await expect(page.getByTestId("battle-revision")).toHaveText("2");

  await page.reload();
  await expect(page.getByTestId("battle-revision")).toHaveText("2");
  await expect(page.locator(".cm-content")).toContainText("revision == 2");

  await page.getByTestId("run-turn").click();
  await expect(page.getByTestId("battle-revision")).toHaveText("4");
  await page.getByTestId("run-turn").click();

  await expect(page.getByTestId("battle-phase")).toHaveText("胜利");
  await expect(page.getByTestId("unit-golem")).toContainText("0 / 8");
});
