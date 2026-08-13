import type { BattleState } from "../combat/types";
import type { LevelDefinition } from "./types";

export const CURRENT_LEVEL_ID = "python-marsh-01" as const;

export const STARTER_CODE = `def choose_turn(world):
    # world 包含当前行动者、战场、单位和目标。
    actor = world["activeUnitId"]
    revision = world["revision"]

    # 移动写在 movePath；普通攻击要写 action.type=attack 和 targetId；施法要写 cast、skillId 和 targetId。
    # 例如：{"movePath": [{"x": 1, "y": 0}, {"x": 1, "y": 1}], "action": {"type": "attack", "targetId": "golem"}}
    # 施法示例：{"movePath": [{"x": 1, "y": 0}], "action": {"type": "cast", "skillId": "spark", "targetId": "golem"}}
    return {
        "actorId": actor,
        "expectedRevision": revision,
        "action": {"type": "wait"},
    }
`;

export function createPythonMarsh01(): BattleState {
  return {
    battleId: "python-marsh-01",
    contentVersion: "python-slice-1",
    revision: 0,
    round: 1,
    turnIndex: 0,
    turnOrder: ["scout", "golem"],
    phase: "in_progress",
    rngState: 2463534242,
    maxRounds: 6,
    board: {
      width: 3,
      height: 2,
      blockedCells: [],
      hazardCells: [{ x: 2, y: 1 }],
      coverCells: [{ x: 2, y: 0 }],
      hazardDamage: 2,
    },
    objectives: [{
      id: "relay",
      cell: { x: 0, y: 1 },
      durability: 2,
      completed: false,
      key: true,
    }],
    failureConditions: { keyObjectiveDestroyed: true },
    units: [
      {
        id: "scout",
        team: "allies",
        visibility: "revealed",
        cell: { x: 0, y: 0 },
        hp: 10,
        maxHp: 10,
        attack: 4,
        defense: 0,
        move: 2,
        initiative: 9,
        disabled: false,
        statuses: [],
        skills: [
          { id: "spark", range: 2, power: 2, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" },
          { id: "mend", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "heal" },
        ],
      },
      {
        id: "golem",
        team: "enemies",
        visibility: "revealed",
        cell: { x: 2, y: 1 },
        hp: 6,
        maxHp: 6,
        attack: 2,
        defense: 1,
        move: 1,
        initiative: 4,
        disabled: false,
        statuses: [],
        skills: [
          { id: "smash", range: 1, power: 1, cooldown: 2, remainingCooldown: 1, target: "unit", kind: "damage" },
        ],
      },
      {
        id: "lurker",
        team: "enemies",
        visibility: "hidden",
        cell: { x: 2, y: 1 },
        hp: 5,
        maxHp: 5,
        attack: 3,
        defense: 0,
        move: 1,
        initiative: 1,
        disabled: true,
        statuses: [],
        skills: [
          { id: "ambush", range: 1, power: 3, cooldown: 1, remainingCooldown: 0, target: "unit", kind: "damage" },
        ],
      },
    ],
  };
}

export const PYTHON_MARSH_01: LevelDefinition = {
  id: CURRENT_LEVEL_ID,
  title: "唤醒中继器",
  briefing: ["在中继器被腐化前消灭敌人。", "读取 world 字典并返回一条合法指令。"],
  starterCode: STARTER_CODE,
  apiHints: [
    "world[\"activeUnitId\"] 是当前行动者。",
    "指令需要 actorId、expectedRevision 和 action。",
    "移动：顶层写 \"movePath\"；攻击：action 写 \"type\": \"attack\" 和 \"targetId\"。",
    "施法：action 写 \"type\": \"cast\"、\"skillId\" 和 \"targetId\"。",
  ],
  initialBattle: createPythonMarsh01(),
  enemyBehaviors: { golem: { type: "corrupt" } },
  reward: { type: "ability", abilityId: "ward" },
};
