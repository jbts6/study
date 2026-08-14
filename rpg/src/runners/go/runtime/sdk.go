package main

type World struct {
	ActiveUnitID string `json:"activeUnitId"`
	Revision     int    `json:"revision"`
	Units        []Unit `json:"units"`
}

type Cell struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type Unit struct {
	ID     string  `json:"id"`
	Cell   Cell    `json:"cell"`
	Skills []Skill `json:"skills"`
}

type Skill struct {
	ID    string `json:"id"`
	Range int    `json:"range"`
}

type Action struct {
	Type     string `json:"type"`
	TargetID string `json:"targetId,omitempty"`
	SkillID  string `json:"skillId,omitempty"`
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
