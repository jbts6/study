import { expect, test, type Page } from "@playwright/test";

const REFERENCE_CAMPAIGN_CODE = `def unit(world, unit_id):
    return next(candidate for candidate in world["units"] if candidate["id"] == unit_id)

def objective(world, objective_id):
    return next(candidate for candidate in world["objectives"] if candidate["id"] == objective_id)

def command(world, action, move_path=[]):
    result = {"actorId": world["activeUnitId"], "expectedRevision": world["revision"], "action": action}
    if move_path:
        result["movePath"] = move_path
    return result

def distance(left, right):
    return abs(left["x"] - right["x"]) + abs(left["y"] - right["y"])

def step_toward(world, target):
    scout = unit(world, "scout")
    if scout["cell"]["x"] != target["x"]:
        return [{"x": scout["cell"]["x"] + (1 if target["x"] > scout["cell"]["x"] else -1), "y": scout["cell"]["y"]}]
    if scout["cell"]["y"] != target["y"]:
        return [{"x": scout["cell"]["x"], "y": scout["cell"]["y"] + (1 if target["y"] > scout["cell"]["y"] else -1)}]
    return []

def act_at_range(world, target, range_value, action, exact=False):
    current = distance(unit(world, "scout")["cell"], target)
    if (current == range_value) if exact else (current <= range_value):
        return command(world, action)
    move_path = step_toward(world, target)
    next_distance = distance(move_path[-1], target) if move_path else current
    if (next_distance == range_value) if exact else (next_distance <= range_value):
        return command(world, action, move_path)
    return command(world, {"type": "guard"}, move_path)

def skill_ready(world, skill_id):
    return any(skill["id"] == skill_id and skill["remainingCooldown"] == 0 for skill in unit(world, "scout")["skills"])

def cast_or_attack(world, target_id, preferred_skills):
    target = unit(world, target_id)
    scout = unit(world, "scout")
    skill = next((candidate for skill_id in preferred_skills for candidate in scout["skills"] if candidate["id"] == skill_id and candidate["remainingCooldown"] == 0), None)
    if skill is not None:
        if distance(scout["cell"], target["cell"]) <= skill["range"]:
            return command(world, {"type": "cast", "skillId": skill["id"], "targetId": target_id})
        move_path = step_toward(world, target["cell"])
        if move_path and distance(move_path[-1], target["cell"]) <= skill["range"]:
            return command(world, {"type": "cast", "skillId": skill["id"], "targetId": target_id}, move_path)
        return command(world, {"type": "guard"}, move_path)
    if distance(scout["cell"], target["cell"]) == 1:
        return command(world, {"type": "attack", "targetId": target_id})
    move_path = step_toward(world, target["cell"])
    if move_path and distance(move_path[-1], target["cell"]) == 1:
        return command(world, {"type": "attack", "targetId": target_id}, move_path)
    return command(world, {"type": "guard"}, move_path)

def interact_with(world, objective_id):
    return act_at_range(world, objective(world, objective_id)["cell"], 1, {"type": "interact", "targetId": objective_id}, True)

def self_cast_or_guard(world, skill_ids):
    for skill_id in skill_ids:
        if skill_ready(world, skill_id):
            return command(world, {"type": "cast", "skillId": skill_id, "targetId": "scout"})
    return command(world, {"type": "guard"})

def choose_turn(world):
    ids = [candidate["id"] for candidate in world["units"]]
    if "golem" in ids:
        return cast_or_attack(world, "golem", ["spark"])
    if "hunter-a" in ids:
        if not unit(world, "hunter-a")["disabled"]:
            return cast_or_attack(world, "hunter-a", ["spark"])
        if not objective(world, "scout-mark")["completed"]:
            return interact_with(world, "scout-mark")
        return cast_or_attack(world, "hunter-b", ["spark"])
    if any(item["id"] == "node-a" for item in world["objectives"]):
        if not objective(world, "node-a")["completed"]:
            return interact_with(world, "node-a")
        if not objective(world, "node-b")["completed"]:
            return interact_with(world, "node-b")
        if not unit(world, "hunter")["disabled"]:
            return cast_or_attack(world, "hunter", ["pierce", "spark"])
        guard = unit(world, "guard")
        if not guard["disabled"] and skill_ready(world, "fracture") and not any(status["id"] == "fracture" for status in guard["statuses"]):
            scout = unit(world, "scout")
            if scout["cell"] == {"x": 1, "y": 0}:
                return command(world, {"type": "guard"}, [{"x": 1, "y": 1}])
            if scout["cell"] == {"x": 1, "y": 1}:
                return command(world, {"type": "guard"}, [{"x": 2, "y": 1}])
            return cast_or_attack(world, "guard", ["fracture"])
        return cast_or_attack(world, "guard", ["spark", "pierce"])
    if any(item["id"] == "seal" for item in world["objectives"]):
        if not unit(world, "corruptor")["disabled"]:
            return cast_or_attack(world, "corruptor", ["spark"])
        if not objective(world, "seal")["completed"]:
            return interact_with(world, "seal")
        return cast_or_attack(world, "guard", ["pierce", "spark"])
    if "hunter" not in ids and "guard" not in ids:
        scout = unit(world, "scout")
        corruptor = unit(world, "corruptor")
        if corruptor["hp"] == 8 and scout["cell"] == {"x": 0, "y": 0}:
            return command(world, {"type": "guard"}, [{"x": 1, "y": 0}, {"x": 1, "y": 1}])
        if corruptor["hp"] == 8 and scout["cell"] == {"x": 1, "y": 1}:
            return command(world, {"type": "guard"}, [{"x": 1, "y": 2}])
        if corruptor["hp"] == 8 and scout["cell"] == {"x": 1, "y": 2}:
            return cast_or_attack(world, "corruptor", ["spark"])
        if corruptor["hp"] == 5 and scout["cell"] == {"x": 1, "y": 2}:
            return cast_or_attack(world, "corruptor", [])
        return cast_or_attack(world, "corruptor", ["spark"])
    scout = unit(world, "scout")
    corruptor = unit(world, "corruptor")
    if not corruptor["disabled"]:
        if corruptor["hp"] == 6 and skill_ready(world, "ward"):
            return self_cast_or_guard(world, ["ward"])
        return cast_or_attack(world, "corruptor", ["spark"])
    hunter = unit(world, "hunter")
    if not hunter["disabled"]:
        if hunter["hp"] == 5 and skill_ready(world, "renew"):
            return self_cast_or_guard(world, ["renew"])
        return cast_or_attack(world, "hunter", ["pierce", "spark"])
    if not objective(world, "final-seal")["completed"]:
        if scout["cell"] == {"x": 1, "y": 0} and skill_ready(world, "aegis") and not any(status["id"] == "aegis" for status in scout["statuses"]):
            return self_cast_or_guard(world, ["aegis"])
        return interact_with(world, "final-seal")
    guard = unit(world, "guard")
    if not guard["disabled"] and skill_ready(world, "fracture") and not any(status["id"] == "fracture" for status in guard["statuses"]):
        return cast_or_attack(world, "guard", ["fracture"])
    if not guard["disabled"]:
        return cast_or_attack(world, "guard", ["spark", "pierce"])
    return self_cast_or_guard(world, ["aegis", "renew", "ward"])
`;

const LEVELS = [
  { id: "python-marsh-01", reward: "ward", skills: ["spark", "mend"] },
  { id: "python-marsh-02", reward: "pierce", skills: ["spark", "mend", "ward"] },
  { id: "python-marsh-03", reward: "renew", skills: ["spark", "mend", "ward", "pierce"] },
  { id: "python-marsh-04", reward: "fracture", skills: ["spark", "mend", "ward", "pierce", "renew"] },
  { id: "python-marsh-05", reward: "aegis", skills: ["spark", "mend", "ward", "pierce", "renew", "fracture"] },
  { id: "python-marsh-06", skills: ["spark", "mend", "ward", "pierce", "renew", "fracture", "aegis"] },
] as const;

async function expectSkills(page: Page, expected: readonly string[]): Promise<void> {
  const skills = page.getByTestId("scout-skills").locator("li");
  await expect(skills).toHaveCount(expected.length);
  await expect(skills).toHaveText(expected.map((skill) => new RegExp(`^${skill} · `)));
}

async function completeCurrentLevel(page: Page, settlement: "victory" | "complete"): Promise<void> {
  const result = page.getByTestId(`settlement-${settlement}`);
  const runTurn = page.getByTestId("run-turn");
  const runner = page.getByTestId("runner-status");
  for (let turn = 0; turn < 20; turn += 1) {
    if (await result.isVisible()) return;
    await Promise.race([
      expect(result).toBeVisible(),
      expect(runTurn).toBeEnabled(),
      expect(runner).toHaveText("不可用"),
    ]).catch(() => undefined);
    if (await result.isVisible()) return;
    if (await runner.textContent() === "不可用") {
      throw new Error(`Runner 在 ${await page.getByTestId("current-level-id").textContent()} 不可用：${await page.getByTestId("feedback").textContent()}`);
    }
    if (await runTurn.isDisabled()) {
      throw new Error(`参考解法停止于 ${await page.getByTestId("current-level-id").textContent()}，战斗阶段：${await page.getByTestId("battle-phase").textContent()}，反馈：${await page.getByTestId("feedback").textContent()}`);
    }
    await runTurn.click();
  }
  throw new Error(`参考解法未能在 20 个玩家回合内完成 ${settlement} 结算。`);
}

test("runs, restores, and completes the complete six-level campaign", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("runner-status")).toHaveText("可运行");

  for (const [index, level] of LEVELS.entries()) {
    await expect(page.getByTestId("current-level-id")).toHaveText(level.id);
    await expectSkills(page, level.skills);
    await page.locator(".cm-content").fill(REFERENCE_CAMPAIGN_CODE);

    if (level.reward !== undefined) {
      await completeCurrentLevel(page, "victory");
      const settlement = page.getByTestId("settlement-victory");
      await expect(page.getByTestId("battle-phase")).toHaveText("胜利");
      await expect(settlement).toContainText(`获得新能力：${level.reward}`);
      await expect(page.getByTestId("advance-level")).toHaveCount(1);

      if (level.id === "python-marsh-02") {
        await expect(page.getByTestId("unit-corruptor")).toContainText("0 / 8");
        await page.reload();
        await expect(page.getByTestId("settlement-victory")).toBeVisible();
        await expect(page.getByTestId("battle-phase")).toHaveText("胜利");
        await expect(page.getByTestId("unit-corruptor")).toContainText("0 / 8");
        await expect(page.locator(".cm-content")).toContainText("def unit(world, unit_id):");
        await expectSkills(page, level.skills);
      }

      await page.getByTestId("advance-level").click();
      await expect(page.getByTestId("current-level-id")).toHaveText(LEVELS[index + 1].id);
      continue;
    }

    await completeCurrentLevel(page, "complete");
    await expect(page.getByTestId("battle-phase")).toHaveText("胜利");
    await expect(page.getByTestId("unit-guard")).toContainText("0 / 4");
    await expect(page.getByTestId("settlement-complete")).toContainText("沼心封印已经稳定");
    await expect(page.getByTestId("settlement-complete")).not.toContainText("获得新能力");
    await expect(page.getByTestId("advance-level")).toHaveCount(0);
    await expect(page.locator("button:visible").filter({ hasText: "重置存档" })).toHaveCount(1);

    await page.reload();
    await expect(page.getByTestId("settlement-complete")).toBeVisible();
    await expect(page.getByTestId("battle-phase")).toHaveText("胜利");
    await expect(page.getByTestId("unit-guard")).toContainText("0 / 4");
    await expect(page.locator(".cm-content")).toContainText("def unit(world, unit_id):");
    await expectSkills(page, level.skills);
  }
});

test("renders the tactical workspace with the light theme", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 244, 246)");
  await expect(page.locator(".status-rail")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".battle-panel")).toHaveCSS("background-image", "none");
  await expect(page.locator(".cm-content")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".cm-gutters")).toHaveCSS("background-color", "rgb(246, 248, 250)");
});
