import type { ProgramReference } from "../types";

export const GO_REFERENCE: ProgramReference = {
  entrypoint: {
    signature: "func ChooseTurn(world World) TurnCommand",
    description: "每个回合由程序返回一条 TurnCommand；world 是当前回合的只读快照。",
  },
  sections: [
    {
      id: "types",
      title: "世界与命令类型",
      entries: [
        {
          id: "type.world",
          signature: `type World struct {
  BattleID string
  ContentVersion string
  ActiveUnitID string
  Revision int
  Round int
  Board Board
  Objectives []Objective
  Units []Unit
}`,
          description: "当前回合的只读战场快照；ActiveUnitID 是正在行动的单位，Revision 用于构造当前回合命令。",
        },
        {
          id: "type.cell",
          signature: `type Cell struct {
  X int
  Y int
}`,
          description: "棋盘上的绝对坐标，X 表示列，Y 表示行。",
        },
        {
          id: "type.board",
          signature: `type Board struct {
  Width int
  Height int
  BlockedCells []Cell
  HazardCells []Cell
  CoverCells []Cell
}`,
          description: "棋盘尺寸和环境格列表；这些 Cell 都使用绝对坐标。",
        },
        {
          id: "type.objective",
          signature: `type Objective struct {
  ID string
  Cell Cell
  Durability int
  Completed bool
}`,
          description: "关卡目标的坐标、耐久度和完成状态；Interact 使用目标 ID。",
        },
        {
          id: "type.status",
          signature: `type Status struct {
  ID string
  RemainingTurns int
  DefenseBonus int
}`,
          description: "单位身上的状态效果及其剩余回合和防御加成。",
        },
        {
          id: "type.unit",
          signature: `type Unit struct {
  ID string
  Team string
  Cell Cell
  HP int
  MaxHP int
  Disabled bool
  Statuses []Status
  Move int
  Attack int
  Defense int
  Skills []Skill
}`,
          description: "战场单位的身份、队伍、位置、生命值、属性、状态和可用技能。",
        },
        {
          id: "type.skill",
          signature: `type Skill struct {
  ID string
  Range int
  Power int
  RemainingCooldown int
  Target string
  Kind string
}`,
          description: "单位技能的 ID、射程、威力、冷却、目标类型和技能种类。",
        },
        {
          id: "type.action",
          signature: `type Action struct {
  Type string
  TargetID string
  SkillID string
  TargetCell *Cell
}`,
          description: "移动完成后执行的单个动作；只填写该动作需要的目标字段。",
        },
        {
          id: "type.turn-command",
          signature: `type TurnCommand struct {
  ActorID string
  ExpectedRevision int
  MovePath []Cell
  Action Action
}`,
          description: "返回给引擎的单回合命令。MovePath 是顶层 `[]Cell` 绝对坐标序列；每一步正交相邻，移动完成后再执行动作。",
        },
      ],
    },
    {
      id: "actions",
      title: "动作构造器",
      entries: [
        {
          id: "action.wait",
          signature: "func Wait(world World) TurnCommand",
          description: "让当前单位跳过本回合；ActorID 和 ExpectedRevision 从 world 读取。",
          example: "return Wait(world)",
        },
        {
          id: "action.attack",
          signature: "func Attack(world World, targetID string) TurnCommand",
          description: "让当前单位攻击 targetID 指定的单位。",
          example: "return Attack(world, \"golem\")",
        },
        {
          id: "action.move-and-attack",
          signature: "func MoveAndAttack(world World, path []Cell, targetID string) TurnCommand",
          description: "沿 path 移动后攻击 targetID；path 使用绝对坐标，每一步正交相邻，移动完成后再执行动作。",
          example: "return MoveAndAttack(world, []Cell{{X: 1, Y: 0}, {X: 1, Y: 1}}, \"golem\")",
        },
        {
          id: "action.guard",
          signature: "func Guard(world World) TurnCommand",
          description: "让当前单位防御并结束本回合。",
          example: "return Guard(world)",
        },
        {
          id: "action.cast",
          signature: "func Cast(world World, skillID string, targetID string) TurnCommand",
          description: "使用 skillID 指定的技能作用于 targetID 指定的目标。",
          example: "return Cast(world, \"spark\", \"golem\")",
        },
        {
          id: "action.move-and-cast",
          signature: "func MoveAndCast(world World, path []Cell, skillID string, targetID string) TurnCommand",
          description: "沿 path 移动后施放 skillID；path 使用绝对坐标，每一步正交相邻，移动完成后再执行动作。",
          example: "return MoveAndCast(world, []Cell{{X: 1, Y: 0}, {X: 2, Y: 0}}, \"spark\", \"golem\")",
        },
        {
          id: "action.interact",
          signature: "func Interact(world World, targetID string) TurnCommand",
          description: "与 targetID 指定的关卡目标交互。",
          example: "return Interact(world, \"seal\")",
        },
        {
          id: "action.move-and-interact",
          signature: "func MoveAndInteract(world World, path []Cell, targetID string) TurnCommand",
          description: "沿 path 移动后与 targetID 交互；path 使用绝对坐标，每一步正交相邻，移动完成后再执行动作。",
          example: "return MoveAndInteract(world, []Cell{{X: 0, Y: 1}, {X: 0, Y: 2}}, \"seal\")",
        },
      ],
    },
  ],
};
