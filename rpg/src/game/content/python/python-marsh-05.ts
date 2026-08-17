import type { BattleState } from "../../combat/types";
import type { LevelDefinition } from "../shared/types";

export const STARTER_CODE_05 = `def pick_entry(world):
    for obj in world["objects"]:
        if obj["status"] == "aligned":
            return obj["id"]
    return "entry-stone-c"


def go_interact(world, target_id):
    actor = None
    for unit in world["units"]:
        if unit["id"] == world["activeUnitId"]:
            actor = unit
    for objective in world["objectives"]:
        if actor is not None:
            if objective["id"] == target_id:
                cell = actor["cell"]
                point = objective["cell"]
                distance = abs(cell["x"] - point["x"])
                distance += abs(cell["y"] - point["y"])
                if distance == 1:
                    return {"type": "interact",
                            "targetId": target_id}
    # 路线由你补充；未相邻时先安全等待。
    return {"type": "wait"}


def attack_target(world, unit_id):
    actor = None
    target = None
    for unit in world["units"]:
        if unit["id"] == world["activeUnitId"]:
            actor = unit
        if unit["id"] == unit_id and not unit["disabled"]:
            target = unit
    if actor is not None and target is not None:
        cell = actor["cell"]
        point = target["cell"]
        distance = abs(cell["x"] - point["x"])
        distance += abs(cell["y"] - point["y"])
        if distance == 1:
            return {"type": "attack", "targetId": unit_id}
    # 移动与技能选择留给你的路线策略。
    return {"type": "wait"}


def choose_world_action(world):
    step = world["quests"][0]["stepId"]
    if step == "pick_rift_entry":
        entry = pick_entry(world)
        return {"expectedRevision": world["revision"],
                "type": "inspect", "targetId": entry}
    if step == "prepare_rift_battle":
        return {"expectedRevision": world["revision"],
                "type": "prepareBattle",
                "encounterId": "rift_guardians"}
    return {"expectedRevision": world["revision"],
            "type": "talk", "targetId": "toma"}


def choose_turn(world):
    base = {
        "actorId": world["activeUnitId"],
        "expectedRevision": world["revision"],
        "movePath": [],
    }
    for objective in world["objectives"]:
        if objective["id"] in ("node-a", "node-b"):
            if not objective["completed"]:
                action = go_interact(world, objective["id"])
                return {**base, "action": action}
    for unit in world["units"]:
        if unit["id"] in ("hunter", "guard"):
            if not unit["disabled"]:
                action = attack_target(world, unit["id"])
                return {**base, "action": action}
    return {**base, "action": {"type": "wait"}}
`;

function createPythonMarsh05(): BattleState {
  return {
    battleId: "python-marsh-05",
    contentVersion: "python-campaign-4",
    revision: 0,
    round: 1,
    turnIndex: 0,
    turnOrder: ["scout", "hunter", "guard"],
    phase: "in_progress",
    rngState: 2_463_534_242,
    maxRounds: 14,
    board: {
      width: 5,
      height: 3,
      blockedCells: [],
      hazardCells: [],
      coverCells: [{ x: 3, y: 1 }],
      hazardDamage: 0,
    },
    objectives: [
      {
        id: "relay",
        cell: { x: 0, y: 2 },
        durability: 6,
        completed: false,
        key: true,
      },
      {
        id: "node-a",
        cell: { x: 0, y: 1 },
        durability: 1,
        completed: false,
        key: false,
      },
      {
        id: "node-b",
        cell: { x: 1, y: 1 },
        durability: 1,
        completed: false,
        key: false,
      },
    ],
    failureConditions: { keyObjectiveDestroyed: true },
    units: [
      {
        id: "scout",
        team: "allies",
        visibility: "revealed",
        cell: { x: 0, y: 0 },
        hp: 8,
        maxHp: 10,
        attack: 4,
        defense: 0,
        move: 2,
        initiative: 9,
        disabled: false,
        statuses: [],
        skills: [
          {
            id: "spark",
            range: 2,
            power: 2,
            cooldown: 1,
            remainingCooldown: 0,
            target: "unit",
            kind: "damage",
          },
          {
            id: "mend",
            range: 1,
            power: 3,
            cooldown: 1,
            remainingCooldown: 0,
            target: "unit",
            kind: "heal",
          },
        ],
      },
      {
        id: "hunter",
        team: "enemies",
        visibility: "revealed",
        cell: { x: 4, y: 0 },
        hp: 5,
        maxHp: 5,
        attack: 2,
        defense: 0,
        move: 1,
        initiative: 5,
        disabled: false,
        statuses: [],
        skills: [],
      },
      {
        id: "guard",
        team: "enemies",
        visibility: "revealed",
        cell: { x: 3, y: 2 },
        hp: 4,
        maxHp: 4,
        attack: 1,
        defense: 6,
        move: 1,
        initiative: 4,
        disabled: false,
        statuses: [],
        skills: [],
      },
    ],
  };
}

export const PYTHON_MARSH_05: LevelDefinition = {
  id: "python-marsh-05",
  title: "裂隙节点",
  briefing: [
    "猎手会追击 scout，守卫保护节点。",
    "激活两处节点，再用 fracture 处理高防守卫。",
    "把选敌人、选目标、选行动拆成辅助函数。",
  ],
  starterCode: STARTER_CODE_05,
  guidance: {
    objective: ["保护 relay，激活 node-a 与 node-b，并在 14 回合内消灭 hunter 和 guard。"],
    concepts: [
      "把查找单位、查找目标、检查技能冷却和选择行动拆成小型辅助函数。",
      "辅助函数只负责一个判断，choose_turn 负责组合结果并返回最终命令。",
    ],
    worldFields: [
      "world[\"activeUnitId\"] 是本回合 actorId；world[\"revision\"] 是 expectedRevision。",
      "world[\"units\"] 提供 hunter、guard 和 scout 的 cell、hp、disabled 与 statuses。",
      "world[\"objectives\"] 提供 node-a、node-b 的 cell 与 completed，也包含需要保护的 relay。",
      "scout 的 skills 中 remainingCooldown 为 0 表示 fracture、pierce 等技能当前可用。",
    ],
    commandExamples: [
      "完整外层结构：{\"actorId\": world[\"activeUnitId\"], \"expectedRevision\": world[\"revision\"], \"movePath\": [{\"x\": 1, \"y\": 0}], \"action\": {\"type\": \"guard\"}}。",
      "激活节点分别使用 {\"action\": {\"type\": \"interact\", \"targetId\": \"node-a\"}} 和 {\"action\": {\"type\": \"interact\", \"targetId\": \"node-b\"}}。",
      "削弱高防 guard：{\"action\": {\"type\": \"cast\", \"skillId\": \"fracture\", \"targetId\": \"guard\"}}。",
    ],
    levelRules: [
      "node-a 与 node-b 都必须激活；交互时 scout 必须位于目标的正交相邻格。",
      "hunter 会追击 scout，guard 会保护关键位置；relay 被毁、scout 失能或超过 14 回合都会失败。",
    ],
  },
  initialBattle: createPythonMarsh05(),
  enemyBehaviors: {
    hunter: { type: "hunt-player" },
    guard: { type: "guard" },
  },
  reward: { type: "ability", abilityId: "aegis" },
};
