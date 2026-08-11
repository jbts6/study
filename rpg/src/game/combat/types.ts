export type Cell = Readonly<{ x: number; y: number }>;
export type Team = "allies" | "enemies";
export type BattlePhase = "in_progress" | "won" | "lost";
export type Status = Readonly<{ id: string; remainingTurns: number; defenseBonus: number }>;
export type SkillEffect = Readonly<{ statusId: string; duration: number; defenseBonus: number; chancePermille?: number }>;
export type Skill = Readonly<{ id: string; range: number; power: number; cooldown: number; remainingCooldown: number; target: "unit" | "cell"; kind: "damage" | "heal"; effect?: SkillEffect }>;
export type BattleUnit = Readonly<{ id: string; team: Team; visibility: "revealed" | "hidden"; cell: Cell; hp: number; maxHp: number; attack: number; defense: number; move: number; initiative: number; disabled: boolean; skills: readonly Skill[]; statuses: readonly Status[] }>;
export type Objective = Readonly<{ id: string; cell: Cell; durability: number; completed: boolean; key: boolean }>;
export type BattleBoard = Readonly<{ width: number; height: number; blockedCells: readonly Cell[]; hazardCells: readonly Cell[]; coverCells: readonly Cell[]; hazardDamage: number }>;
export type BattleState = Readonly<{ battleId: string; contentVersion: string; revision: number; round: number; turnIndex: number; turnOrder: readonly string[]; phase: BattlePhase; units: readonly BattleUnit[]; board: BattleBoard; objectives: readonly Objective[]; rngState: number; maxRounds: number; failureConditions: Readonly<{ keyObjectiveDestroyed: boolean }> }>;
export type MainAction =
  | Readonly<{ type: "attack"; targetId: string }>
  | Readonly<{ type: "cast"; skillId: string; targetId?: string; targetCell?: Cell }>
  | Readonly<{ type: "interact"; targetId: string }>
  | Readonly<{ type: "guard" }>
  | Readonly<{ type: "wait" }>;
export type TurnCommand = Readonly<{ actorId: string; expectedRevision: number; movePath?: readonly Cell[]; action: MainAction }>;
export type BattleErrorCode = "INVALID_COMMAND" | "UNKNOWN_FIELD" | "EXPECTED_REVISION_MISMATCH" | "BATTLE_COMPLETE" | "NOT_ACTIVE_ACTOR" | "ACTOR_DISABLED" | "INVALID_MOVE_PATH" | "MOVE_TOO_FAR" | "MOVE_BLOCKED" | "INVALID_TARGET" | "TARGET_OUT_OF_RANGE" | "SKILL_NOT_FOUND" | "SKILL_ON_COOLDOWN" | "SKILL_TARGET_SHAPE" | "INTERACTION_INVALID";
export type CommandError = Readonly<{ code: BattleErrorCode; path: string; message: string }>;
export type CommandValidation = Readonly<{ accepted: true; command: TurnCommand }> | Readonly<{ accepted: false; errors: readonly CommandError[] }>;
export type BattleEventPayload = Readonly<Record<string, string | number | boolean | Cell>>;
export type BattleEvent = Readonly<{ protocolVersion: 1; seq: number; stateRevision: number; type: "moved" | "interacted" | "damaged" | "healed" | "status_added" | "status_removed" | "cooldown_changed" | "objective_progressed" | "unit_disabled" | "turn_advanced" | "battle_finished"; payload: BattleEventPayload }>;
export type ReducedBattle = Readonly<{ state: BattleState; events: readonly BattleEvent[] }>;
export type CommandResolution = Readonly<{ accepted: true; command: TurnCommand; state: BattleState; events: readonly BattleEvent[] }> | Readonly<{ accepted: false; errors: readonly CommandError[]; state: BattleState }>;
export type WorldUnit = Readonly<{ id: string; team: Team; cell: Cell; hp: number; maxHp: number; disabled: boolean; statuses: readonly Status[]; move?: number; attack?: number; defense?: number; skills?: readonly Readonly<Pick<Skill, "id" | "range" | "power" | "target" | "kind">>[] }>;
export type WorldView = Readonly<{ battleId: string; contentVersion: string; revision: number; round: number; activeUnitId: string | null; board: Readonly<Pick<BattleBoard, "width" | "height" | "blockedCells" | "hazardCells" | "coverCells">>; objectives: readonly Readonly<Pick<Objective, "id" | "cell" | "durability" | "completed">>[]; units: readonly WorldUnit[] }>;
export function xorshift32(state: number): Readonly<{ value: number; nextState: number }> {
  let value = state >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  value >>>= 0;
  return { value, nextState: value };
}
