import type {
  BattleState,
  BattleUnit,
  Cell,
  CommandError,
  CommandValidation,
  MainAction,
} from "./types";

type ParsedCommand = Readonly<{
  actorId: string;
  expectedRevision: number;
  movePath: readonly Cell[];
  action: MainAction;
}>;

const rejected = (code: CommandError["code"], path: string, message: string): CommandValidation => ({
  accepted: false,
  errors: [{ code, path, message }],
});

/** Validates unknown JSON values as ordinary records. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks that a JSON object has all and only the declared fields. */
function hasExactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}

/** Determines whether a value is a finite integer grid coordinate. */
function isIntegerCell(value: unknown): value is Cell {
  return isRecord(value) && hasExactKeys(value, ["x", "y"]) && Number.isFinite(value.x) && Number.isInteger(value.x) && Number.isFinite(value.y) && Number.isInteger(value.y);
}

/** Builds a stable unknown-field validation response. */
function unknownField(value: Record<string, unknown>, allowed: readonly string[], path: string): CommandValidation | undefined {
  const field = Object.keys(value).find((key) => !allowed.includes(key));
  return field === undefined ? undefined : rejected("UNKNOWN_FIELD", `${path}.${field}`, "命令包含未知字段");
}

/** Parses a movement path without trusting caller-owned objects. */
function readMovePath(value: Record<string, unknown>): readonly Cell[] | CommandValidation {
  if (!Object.hasOwn(value, "movePath")) return [];
  if (!Array.isArray(value.movePath) || !value.movePath.every(isIntegerCell)) {
    return rejected("INVALID_MOVE_PATH", "$.movePath", "移动路径必须是整数坐标数组");
  }
  return value.movePath.map((cell) => ({ x: cell.x, y: cell.y }));
}

/** Parses one exact action object into a safe turn action. */
function readAction(value: unknown): MainAction | CommandValidation {
  if (!isRecord(value)) return rejected("INVALID_COMMAND", "$.action", "主动作必须是对象");
  if (typeof value.type !== "string") return rejected("INVALID_COMMAND", "$.action.type", "主动作类型无效");

  const unknown = unknownActionField(value);
  if (unknown !== undefined) return unknown;

  switch (value.type) {
    case "attack":
    case "interact":
      return readTargetAction(value, value.type);
    case "guard":
    case "wait":
      return hasExactKeys(value, ["type"])
        ? { type: value.type }
        : rejected("INVALID_COMMAND", "$.action", "主动作字段无效");
    case "cast":
      return readCastAction(value);
    default:
      return rejected("INVALID_COMMAND", "$.action.type", "主动作类型无效");
  }
}

/** Finds unknown action fields for the declared action type. */
function unknownActionField(value: Record<string, unknown>): CommandValidation | undefined {
  const fields = value.type === "attack" || value.type === "interact"
    ? ["type", "targetId"]
    : value.type === "cast"
      ? ["type", "skillId", "targetId", "targetCell"]
      : ["type"];
  return unknownField(value, fields, "$.action");
}

/** Parses an exact unit-targeting action. */
function readTargetAction(value: Record<string, unknown>, type: "attack" | "interact"): MainAction | CommandValidation {
  if (!hasExactKeys(value, ["type", "targetId"]) || typeof value.targetId !== "string") {
    return rejected("INVALID_COMMAND", "$.action", "主动作字段无效");
  }
  return { type, targetId: value.targetId };
}

/** Parses an exact cast action with exactly one target form. */
function readCastAction(value: Record<string, unknown>): MainAction | CommandValidation {
  if (typeof value.skillId !== "string") return rejected("INVALID_COMMAND", "$.action.skillId", "技能标识无效");
  const hasTargetId = Object.hasOwn(value, "targetId");
  const hasTargetCell = Object.hasOwn(value, "targetCell");
  if (hasTargetId === hasTargetCell || !hasExactKeys(value, ["type", "skillId"], hasTargetId ? ["targetId"] : ["targetCell"])) {
    return rejected("SKILL_TARGET_SHAPE", "$.action", "技能目标形状无效");
  }
  if (hasTargetId && typeof value.targetId === "string") return { type: "cast", skillId: value.skillId, targetId: value.targetId };
  if (hasTargetCell && isIntegerCell(value.targetCell)) return { type: "cast", skillId: value.skillId, targetCell: { x: value.targetCell.x, y: value.targetCell.y } };
  return rejected("SKILL_TARGET_SHAPE", "$.action", "技能目标形状无效");
}

/** Parses a JSON command into a detached, type-safe value. */
function readCommand(input: unknown): ParsedCommand | CommandValidation {
  if (!isRecord(input)) return rejected("INVALID_COMMAND", "$", "命令必须是对象");
  const unknown = unknownField(input, ["actorId", "expectedRevision", "movePath", "action"], "$");
  if (unknown !== undefined) return unknown;
  if (!hasExactKeys(input, ["actorId", "expectedRevision", "action"], ["movePath"])) {
    return rejected("INVALID_COMMAND", "$", "命令字段无效");
  }
  if (typeof input.actorId !== "string") return rejected("INVALID_COMMAND", "$.actorId", "行动者标识无效");
  if (typeof input.expectedRevision !== "number" || !Number.isFinite(input.expectedRevision) || !Number.isInteger(input.expectedRevision)) {
    return rejected("INVALID_COMMAND", "$.expectedRevision", "预期版本必须是有限整数");
  }
  const movePath = readMovePath(input);
  if ("accepted" in movePath) return movePath;
  const action = readAction(input.action);
  if ("accepted" in action) return action;
  return { actorId: input.actorId, expectedRevision: input.expectedRevision, movePath, action };
}

/** Returns the active unit when the command actor owns this turn. */
function activeActor(state: BattleState, actorId: string): BattleUnit | CommandValidation {
  if (state.turnOrder[state.turnIndex] !== actorId) return rejected("NOT_ACTIVE_ACTOR", "$.actorId", "当前不是该单位的回合");
  const actor = state.units.find((unit) => unit.id === actorId);
  return actor === undefined ? rejected("NOT_ACTIVE_ACTOR", "$.actorId", "当前行动者不存在") : actor;
}

/** Checks every movement step and returns the final action origin. */
function validateMovePath(state: BattleState, actor: BattleUnit, path: readonly Cell[]): Cell | CommandValidation {
  if (path.length > actor.move) return rejected("MOVE_TOO_FAR", "$.movePath", "移动距离超过上限");
  let previous = actor.cell;
  for (let index = 0; index < path.length; index += 1) {
    const cell = path[index];
    if (manhattanDistance(previous, cell) !== 1) {
      return rejected("INVALID_MOVE_PATH", `$.movePath[${index}]`, "移动路径必须逐格正交相邻");
    }
    if (!isOnBoard(state, cell) || isBlocked(state, cell)) return rejected("MOVE_BLOCKED", `$.movePath[${index}]`, "移动路径被阻挡");
    previous = cell;
  }
  return previous;
}

/** Tests whether a cell is inside the battle board. */
function isOnBoard(state: BattleState, cell: Cell): boolean {
  return cell.x >= 0 && cell.x < state.board.width && cell.y >= 0 && cell.y < state.board.height;
}

/** Tests whether terrain or any unit occupies a destination. */
function isBlocked(state: BattleState, cell: Cell): boolean {
  return state.board.blockedCells.some((blocked) => sameCell(blocked, cell)) || state.units.some((unit) => sameCell(unit.cell, cell));
}

/** Compares two cells by coordinates. */
function sameCell(left: Cell, right: Cell): boolean {
  return left.x === right.x && left.y === right.y;
}

/** Calculates Manhattan distance on the board. */
function manhattanDistance(left: Cell, right: Cell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

/** Validates the main action from the completed movement endpoint. */
function validateAction(state: BattleState, actor: BattleUnit, origin: Cell, action: MainAction): CommandValidation | undefined {
  switch (action.type) {
    case "attack":
      return validateUnitTarget(state, actor, origin, action.targetId, 1, "INVALID_TARGET", "$.action.targetId");
    case "cast":
      return validateCast(state, actor, origin, action);
    case "interact":
      return validateInteraction(state, origin, action.targetId);
    case "guard":
    case "wait":
      return undefined;
  }
}

/** Validates a cast skill, its cooldown, and its declared target type. */
function validateCast(state: BattleState, actor: BattleUnit, origin: Cell, action: Extract<MainAction, { type: "cast" }>): CommandValidation | undefined {
  const skill = actor.skills.find((candidate) => candidate.id === action.skillId);
  if (skill === undefined) return rejected("SKILL_NOT_FOUND", "$.action.skillId", "技能不存在");
  if (skill.remainingCooldown > 0) return rejected("SKILL_ON_COOLDOWN", "$.action.skillId", "技能冷却中");
  if (skill.target === "unit") {
    if (action.targetId === undefined || action.targetCell !== undefined) return rejected("SKILL_TARGET_SHAPE", "$.action", "技能需要单位目标");
    return validateUnitTarget(state, actor, origin, action.targetId, skill.range, "INVALID_TARGET", "$.action.targetId", skill.kind === "heal" ? "ally" : "enemy");
  }
  if (action.targetCell === undefined || action.targetId !== undefined) return rejected("SKILL_TARGET_SHAPE", "$.action", "技能需要格子目标");
  if (!isOnBoard(state, action.targetCell)) return rejected("INVALID_TARGET", "$.action.targetCell", "技能目标不在战场内");
  return manhattanDistance(origin, action.targetCell) <= skill.range
    ? undefined
    : rejected("TARGET_OUT_OF_RANGE", "$.action.targetCell", "技能目标超出距离");
}

/** Validates a living unit target, its team, and its range. */
function validateUnitTarget(state: BattleState, actor: BattleUnit, origin: Cell, targetId: string, range: number, invalidCode: "INVALID_TARGET", path: string, targetTeam: "enemy" | "ally" = "enemy"): CommandValidation | undefined {
  const target = state.units.find((unit) => unit.id === targetId);
  const hasRequiredTeam = targetTeam === "enemy" ? target?.team !== actor.team : target?.team === actor.team;
  if (target === undefined || !hasRequiredTeam || target.visibility !== "revealed" || target.disabled) {
    return rejected(invalidCode, path, "目标无效");
  }
  return manhattanDistance(origin, target.cell) <= range
    ? undefined
    : rejected("TARGET_OUT_OF_RANGE", path, "目标超出距离");
}

/** Validates an unfinished objective exactly adjacent to the final position. */
function validateInteraction(state: BattleState, origin: Cell, targetId: string): CommandValidation | undefined {
  const objective = state.objectives.find((candidate) => candidate.id === targetId);
  if (objective === undefined || objective.completed) return rejected("INTERACTION_INVALID", "$.action.targetId", "交互目标无效");
  return manhattanDistance(origin, objective.cell) === 1
    ? undefined
    : rejected("INTERACTION_INVALID", "$.action.targetId", "交互目标必须相邻");
}

/** Strictly validates one turn command without mutating the battle state. */
export function validateTurnCommand(state: Readonly<BattleState>, input: unknown): CommandValidation {
  const command = readCommand(input);
  if ("accepted" in command) return command;
  if (state.phase !== "in_progress") return rejected("BATTLE_COMPLETE", "$.phase", "战斗已结束");
  if (command.expectedRevision !== state.revision) return rejected("EXPECTED_REVISION_MISMATCH", "$.expectedRevision", "预期版本不匹配");
  const actor = activeActor(state, command.actorId);
  if ("accepted" in actor) return actor;
  if (actor.disabled) return rejected("ACTOR_DISABLED", "$.actorId", "行动者无法行动");
  const endpoint = validateMovePath(state, actor, command.movePath);
  if ("accepted" in endpoint) return endpoint;
  const actionError = validateAction(state, actor, endpoint, command.action);
  if (actionError !== undefined) return actionError;
  return {
    accepted: true,
    command: command.movePath.length === 0
      ? { actorId: command.actorId, expectedRevision: command.expectedRevision, action: command.action }
      : command,
  };
}
