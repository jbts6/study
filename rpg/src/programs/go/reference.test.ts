import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GO_PROGRAM } from "./index";

const sdkSource = readFileSync(
  resolve(process.cwd(), "src/runners/go/runtime/sdk.go"),
  "utf8",
);
const normalizedSdkSource = sdkSource.replace(/\s+/g, " ");

const reference = GO_PROGRAM.reference;
if (reference === undefined) throw new Error("GO_PROGRAM.reference 未定义");

const entries = reference.sections.flatMap((section) => section.entries);
const entryById = new Map(entries.map((entry) => [entry.id, entry]));

function getEntry(id: string) {
  const entry = entryById.get(id);
  if (entry === undefined) throw new Error(`缺少参考条目: ${id}`);
  return entry;
}

describe("Go tactical manual reference", () => {
  it("按稳定顺序暴露完整的类型、动作和入口条目", () => {
    const ids = reference.sections.flatMap((section) => section.entries.map((entry) => entry.id));
    const referenceIds = new Set(["entrypoint.choose-turn", ...ids]);

    expect(reference.entrypoint.signature).toBe("func ChooseTurn(world World) TurnCommand");
    expect(ids).toEqual([
      "type.world", "type.cell", "type.board", "type.objective", "type.status",
      "type.unit", "type.skill", "type.action", "type.turn-command",
      "action.wait", "action.attack", "action.move-and-attack", "action.guard",
      "action.cast", "action.move-and-cast", "action.interact", "action.move-and-interact",
    ]);
    expect(reference.sections.map((section) => section.id)).toEqual(["types", "actions"]);
    expect(referenceIds.has("entrypoint.choose-turn")).toBe(true);
  });

  it("为每个 Go DTO 记录真实字段名和类型", () => {
    const typeFields: Readonly<Record<string, readonly string[]>> = {
      "type.world": [
        "type World struct", "BattleID string", "ContentVersion string", "ActiveUnitID string",
        "Revision int", "Round int", "Board Board", "Objectives []Objective", "Units []Unit",
      ],
      "type.cell": ["type Cell struct", "X int", "Y int"],
      "type.board": [
        "type Board struct", "Width int", "Height int", "BlockedCells []Cell", "HazardCells []Cell",
        "CoverCells []Cell",
      ],
      "type.objective": ["type Objective struct", "ID string", "Cell Cell", "Durability int", "Completed bool"],
      "type.status": ["type Status struct", "ID string", "RemainingTurns int", "DefenseBonus int"],
      "type.unit": [
        "type Unit struct", "ID string", "Team string", "Cell Cell", "HP int", "MaxHP int", "Disabled bool",
        "Statuses []Status", "Move int", "Attack int", "Defense int", "Skills []Skill",
      ],
      "type.skill": [
        "type Skill struct", "ID string", "Range int", "Power int", "RemainingCooldown int",
        "Target string", "Kind string",
      ],
      "type.action": [
        "type Action struct", "Type string", "TargetID string", "SkillID string", "TargetCell *Cell",
      ],
      "type.turn-command": [
        "type TurnCommand struct", "ActorID string", "ExpectedRevision int", "MovePath []Cell", "Action Action",
      ],
    };

    for (const [id, fields] of Object.entries(typeFields)) {
      const signature = getEntry(id).signature;
      for (const field of fields) expect(signature).toContain(field);
      for (const field of fields) expect(normalizedSdkSource).toContain(field);
    }
  });

  it("为八个动作提供完整签名、说明和最小示例", () => {
    const actions: Readonly<Record<string, string>> = {
      "action.wait": "func Wait(world World) TurnCommand",
      "action.attack": "func Attack(world World, targetID string) TurnCommand",
      "action.move-and-attack": "func MoveAndAttack(world World, path []Cell, targetID string) TurnCommand",
      "action.guard": "func Guard(world World) TurnCommand",
      "action.cast": "func Cast(world World, skillID string, targetID string) TurnCommand",
      "action.move-and-cast": "func MoveAndCast(world World, path []Cell, skillID string, targetID string) TurnCommand",
      "action.interact": "func Interact(world World, targetID string) TurnCommand",
      "action.move-and-interact": "func MoveAndInteract(world World, path []Cell, targetID string) TurnCommand",
    };

    for (const [id, signature] of Object.entries(actions)) {
      const entry = getEntry(id);
      expect(entry.signature).toBe(signature);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.example?.length).toBeGreaterThan(0);
      expect(sdkSource).toContain(signature);
    }
  });

  it("说明移动组合动作的绝对坐标路径和执行顺序", () => {
    for (const id of ["action.move-and-attack", "action.move-and-cast", "action.move-and-interact"]) {
      const entry = getEntry(id);
      expect(entry.description).toContain("每一步正交相邻，移动完成后再执行动作");
      expect(entry.example).toContain("[]Cell{{X: ");
    }

    expect(getEntry("type.turn-command").description).toContain("顶层 `[]Cell` 绝对坐标序列");
  });
});
