package main

type World struct {
	BattleID       string      `json:"battleId"`
	ContentVersion string      `json:"contentVersion"`
	ActiveUnitID   string      `json:"activeUnitId"`
	Revision       int         `json:"revision"`
	Round          int         `json:"round"`
	Board          Board       `json:"board"`
	Objectives     []Objective `json:"objectives"`
	Units          []Unit      `json:"units"`
}

type Cell struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type Board struct {
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	BlockedCells []Cell `json:"blockedCells"`
	HazardCells  []Cell `json:"hazardCells"`
	CoverCells   []Cell `json:"coverCells"`
}

type Objective struct {
	ID         string `json:"id"`
	Cell       Cell   `json:"cell"`
	Durability int    `json:"durability"`
	Completed  bool   `json:"completed"`
}

type Status struct {
	ID             string `json:"id"`
	RemainingTurns int    `json:"remainingTurns"`
	DefenseBonus   int    `json:"defenseBonus"`
}

type Unit struct {
	ID       string   `json:"id"`
	Team     string   `json:"team"`
	Cell     Cell     `json:"cell"`
	HP       int      `json:"hp"`
	MaxHP    int      `json:"maxHp"`
	Disabled bool     `json:"disabled"`
	Statuses []Status `json:"statuses"`
	Move     int      `json:"move"`
	Attack   int      `json:"attack"`
	Defense  int      `json:"defense"`
	Skills   []Skill  `json:"skills"`
}

type Skill struct {
	ID                string `json:"id"`
	Range             int    `json:"range"`
	Power             int    `json:"power"`
	RemainingCooldown int    `json:"remainingCooldown"`
	Target            string `json:"target"`
	Kind              string `json:"kind"`
}

type Action struct {
	Type       string `json:"type"`
	TargetID   string `json:"targetId,omitempty"`
	SkillID    string `json:"skillId,omitempty"`
	TargetCell *Cell  `json:"targetCell,omitempty"`
}

type TurnCommand struct {
	ActorID          string `json:"actorId"`
	ExpectedRevision int    `json:"expectedRevision"`
	MovePath         []Cell `json:"movePath,omitempty"`
	Action           Action `json:"action"`
}

func Wait(world World) TurnCommand {
	return TurnCommand{ActorID: world.ActiveUnitID, ExpectedRevision: world.Revision, Action: Action{Type: "wait"}}
}

func Attack(world World, targetID string) TurnCommand {
	return TurnCommand{ActorID: world.ActiveUnitID, ExpectedRevision: world.Revision, Action: Action{Type: "attack", TargetID: targetID}}
}

func MoveAndAttack(world World, path []Cell, targetID string) TurnCommand {
	command := Attack(world, targetID)
	command.MovePath = path
	return command
}

func Guard(world World) TurnCommand {
	return TurnCommand{ActorID: world.ActiveUnitID, ExpectedRevision: world.Revision, Action: Action{Type: "guard"}}
}

func Cast(world World, skillID string, targetID string) TurnCommand {
	return TurnCommand{ActorID: world.ActiveUnitID, ExpectedRevision: world.Revision, Action: Action{Type: "cast", TargetID: targetID, SkillID: skillID}}
}

func MoveAndCast(world World, path []Cell, skillID string, targetID string) TurnCommand {
	command := Cast(world, skillID, targetID)
	command.MovePath = path
	return command
}

func Interact(world World, targetID string) TurnCommand {
	return TurnCommand{ActorID: world.ActiveUnitID, ExpectedRevision: world.Revision, Action: Action{Type: "interact", TargetID: targetID}}
}

func MoveAndInteract(world World, path []Cell, targetID string) TurnCommand {
	command := Interact(world, targetID)
	command.MovePath = path
	return command
}
