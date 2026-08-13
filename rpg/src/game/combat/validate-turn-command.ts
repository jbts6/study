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

const COMMAND_SHAPE_HINT = "顶层命令必须包含 actorId（字符串）、expectedRevision（整数）和 action（字典），movePath 可选；例如 {\"actorId\": world[\"activeUnitId\"], \"expectedRevision\": world[\"revision\"], \"action\": {\"type\": \"wait\"}}";
const MOVE_PATH_SHAPE_HINT = "movePath 必须是坐标对象数组，每个元素都写成 {\"x\": 整数, \"y\": 整数}；正确示例：[{\"x\": 1, \"y\": 0}]；不能写成 [[1, 0]]";
const ACTION_TYPE_HINT = "action.type 必须是 \"attack\"、\"cast\"、\"interact\"、\"guard\" 或 \"wait\"";

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
  return field === undefined ? undefined : rejected("UNKNOWN_FIELD", `${path}.${field}`, `${path === "$" ? "顶层命令" : "action"} 不支持字段 ${field}；${path === "$" ? COMMAND_SHAPE_HINT : ACTION_TYPE_HINT}`);
}

/** Parses a movement path without trusting caller-owned objects. */
function readMovePath(value: Record<string, unknown>): readonly Cell[] | CommandValidation {
  if (!Object.hasOwn(value, "movePath")) return [];
  if (!Array.isArray(value.movePath) || !value.movePath.every(isIntegerCell)) {
    return rejected("INVALID_MOVE_PATH", "$.movePath", MOVE_PATH_SHAPE_HINT);
  }
  return value.movePath.map((cell) => ({ x: cell.x, y: cell.y }));
}

/** Parses one exact action object into a safe turn action. */
function readAction(value: unknown): MainAction | CommandValidation {
  if (!isRecord(value)) return rejected("INVALID_COMMAND", "$.action", `action 必须是 Python 字典；${COMMAND_SHAPE_HINT}`);
  if (typeof value.type !== "string") return rejected("INVALID_COMMAND", "$.action.type", ACTION_TYPE_HINT);

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
        : rejected("INVALID_COMMAND", "$.action", `${value.type} 不需要 targetId、skillId 或其他字段；${ACTION_TYPE_HINT}`);
    case "cast":
      return readCastAction(value);
    default:
      return rejected("INVALID_COMMAND", "$.action.type", `${ACTION_TYPE_HINT}；收到 ${JSON.stringify(value.type)}`);
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
    return rejected("INVALID_COMMAND", "$.action", `${type} 格式必须是 {\"type\": \"${type}\", \"targetId\": \"目标 ID\"}；targetId 必须是字符串`);
  }
  return { type, targetId: value.targetId };
}

/** Parses an exact cast action with exactly one target form. */
function readCastAction(value: Record<string, unknown>): MainAction | CommandValidation {
  if (typeof value.skillId !== "string") return rejected("INVALID_COMMAND", "$.action.skillId", "skillId 必须是字符串，例如 \"spark\"；施法格式是 {\"type\": \"cast\", \"skillId\": \"spark\", \"targetId\": \"golem\"}");
  const hasTargetId = Object.hasOwn(value, "targetId");
  const hasTargetCell = Object.hasOwn(value, "targetCell");
  if (hasTargetId === hasTargetCell || !hasExactKeys(value, ["type", "skillId"], hasTargetId ? ["targetId"] : ["targetCell"])) {
    return rejected("SKILL_TARGET_SHAPE", "$.action", "cast 必须在 targetId 和 targetCell 中二选一；单位目标使用 targetId 字符串，格子目标使用 {\"x\": 整数, \"y\": 整数} 的 targetCell");
  }
  if (hasTargetId && typeof value.targetId === "string") return { type: "cast", skillId: value.skillId, targetId: value.targetId };
  if (hasTargetCell && isIntegerCell(value.targetCell)) return { type: "cast", skillId: value.skillId, targetCell: { x: value.targetCell.x, y: value.targetCell.y } };
  return rejected("SKILL_TARGET_SHAPE", "$.action", "cast 的目标格式不正确；单位目标示例：{\"targetId\": \"golem\"}，格子目标示例：{\"targetCell\": {\"x\": 1, \"y\": 0}}");
}

/** Parses a JSON command into a detached, type-safe value. */
function readCommand(input: unknown): ParsedCommand | CommandValidation {
  if (!isRecord(input)) return rejected("INVALID_COMMAND", "$", COMMAND_SHAPE_HINT);
  const unknown = unknownField(input, ["actorId", "expectedRevision", "movePath", "action"], "$");
  if (unknown !== undefined) return unknown;
  if (!hasExactKeys(input, ["actorId", "expectedRevision", "action"], ["movePath"])) {
    return rejected("INVALID_COMMAND", "$", COMMAND_SHAPE_HINT);
  }
  if (typeof input.actorId !== "string") return rejected("INVALID_COMMAND", "$.actorId", "actorId 必须是字符串，例如 world[\"activeUnitId\"]；它必须是当前行动者的 ID");
  if (typeof input.expectedRevision !== "number" || !Number.isFinite(input.expectedRevision) || !Number.isInteger(input.expectedRevision)) {
    return rejected("INVALID_COMMAND", "$.expectedRevision", "expectedRevision 必须是整数，直接使用 world[\"revision\"]，不要写字符串 \"0\"");
  }
  const movePath = readMovePath(input);
  if ("accepted" in movePath) return movePath;
  const action = readAction(input.action);
  if ("accepted" in action) return action;
  return { actorId: input.actorId, expectedRevision: input.expectedRevision, movePath, action };
}

/** Returns the active unit when the command actor owns this turn. */
function activeActor(state: BattleState, actorId: string): BattleUnit | CommandValidation {
  if (state.turnOrder[state.turnIndex] !== actorId) return rejected("NOT_ACTIVE_ACTOR", "$.actorId", `actorId 必须等于当前行动者；请使用 world[\"activeUnitId\"]（当前应为 ${state.turnOrder[state.turnIndex] ?? "无"}）`);
  const actor = state.units.find((unit) => unit.id === actorId);
  return actor === undefined ? rejected("NOT_ACTIVE_ACTOR", "$.actorId", `找不到行动者 ${actorId}；请从 world[\"activeUnitId\"] 读取 ID`) : actor;
}

/** Checks every movement step and returns the final action origin. */
function validateMovePath(state: BattleState, actor: BattleUnit, path: readonly Cell[]): Cell | CommandValidation {
  if (path.length > actor.move) return rejected("MOVE_TOO_FAR", "$.movePath", `当前单位 ${actor.id} 的 move=${actor.move}，movePath 最多包含 ${actor.move} 个格子，每个元素代表一步；请删掉多余坐标，例如 [{\"x\": 1, \"y\": 0}]`);
  let previous = actor.cell;
  for (let index = 0; index < path.length; index += 1) {
    const cell = path[index];
    if (manhattanDistance(previous, cell) !== 1) {
      return rejected("INVALID_MOVE_PATH", `$.movePath[${index}]`, `movePath[${index}] 必须是从上一格正交相邻（上下左右一格）的一步；不能斜走或跳格。上一格是 (${previous.x}, ${previous.y})，收到 (${cell.x}, ${cell.y})`);
    }
    if (!isOnBoard(state, cell) || isBlocked(state, actor.id, cell)) return rejected("MOVE_BLOCKED", `$.movePath[${index}]`, `坐标 (${cell.x}, ${cell.y}) 越界或被单位/阻挡格占用；请从战场坐标中选择未被占用的相邻格`);
    previous = cell;
  }
  return previous;
}

/** Tests whether a cell is inside the battle board. */
function isOnBoard(state: BattleState, cell: Cell): boolean {
  return cell.x >= 0 && cell.x < state.board.width && cell.y >= 0 && cell.y < state.board.height;
}

/** Tests whether terrain or another unit occupies a destination. */
function isBlocked(state: BattleState, actorId: string, cell: Cell): boolean {
  return state.board.blockedCells.some((blocked) => sameCell(blocked, cell)) || state.units.some((unit) => unit.id !== actorId && sameCell(unit.cell, cell));
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
  if (skill === undefined) return rejected("SKILL_NOT_FOUND", "$.action.skillId", `技能 ${action.skillId} 不存在；当前单位可用技能：${actor.skills.map((candidate) => candidate.id).join("、") || "无"}。请从这些 ID 中选择，例如 \"spark\"`);
  if (skill.remainingCooldown > 0) return rejected("SKILL_ON_COOLDOWN", "$.action.skillId", `技能 ${skill.id} 冷却中，冷却剩余 ${skill.remainingCooldown} 回合；读取 world[\"units\"] 中该技能的 remainingCooldown，降为 0 后再施放`);
  if (skill.target === "unit") {
    if (action.targetId === undefined || action.targetCell !== undefined) return rejected("SKILL_TARGET_SHAPE", "$.action", `技能 ${skill.id} 需要单位目标；targetId 与 targetCell 只能二选一，请使用 {\"targetId\": \"单位 ID\"}，不要使用 targetCell`);
    return validateUnitTarget(state, actor, origin, action.targetId, skill.range, "INVALID_TARGET", "$.action.targetId", skill.kind === "heal" ? "ally" : "enemy");
  }
  if (action.targetCell === undefined || action.targetId !== undefined) return rejected("SKILL_TARGET_SHAPE", "$.action", `技能 ${skill.id} 需要格子目标；targetId 与 targetCell 只能二选一，请使用 {\"targetCell\": {\"x\": 整数, \"y\": 整数}}，不要使用 targetId`);
  return validateCellTarget(state, actor, origin, action.targetCell, skill.range, skill.kind);
}

/** Validates that a cell-target skill points to one legal unit occupant. */
function validateCellTarget(state: BattleState, actor: BattleUnit, origin: Cell, cell: Cell, range: number, kind: "damage" | "heal"): CommandValidation | undefined {
  if (!isOnBoard(state, cell)) return rejected("INVALID_TARGET", "$.action.targetCell", `格子目标 (${cell.x}, ${cell.y}) 不在战场内；合法坐标范围是 x=0..${state.board.width - 1}、y=0..${state.board.height - 1}`);
  const occupants = state.units.filter((unit) => sameCell(unit.cell, cell));
  const target = occupants[0];
  const hasRequiredTeam = kind === "damage" ? target?.team !== actor.team : target?.team === actor.team;
  if (occupants.length !== 1 || target === undefined || !hasRequiredTeam || target.visibility !== "revealed" || target.disabled) {
    return rejected("INVALID_TARGET", "$.action.targetCell", `格子目标 (${cell.x}, ${cell.y}) 必须正好有一个可见且未禁用的${kind === "damage" ? "敌方" : "友方"}单位；请从 world[\"units\"] 的 cell 中选择`);
  }
  return manhattanDistance(origin, cell) <= range
    ? undefined
    : rejected("TARGET_OUT_OF_RANGE", "$.action.targetCell", `格子目标超出技能距离 ${range}；请移动到目标附近，或选择距离不超过 ${range} 的坐标`);
}

/** Validates a living unit target, its team, and its range. */
function validateUnitTarget(state: BattleState, actor: BattleUnit, origin: Cell, targetId: string, range: number, invalidCode: "INVALID_TARGET", path: string, targetTeam: "enemy" | "ally" = "enemy"): CommandValidation | undefined {
  const target = state.units.find((unit) => unit.id === targetId);
  const hasRequiredTeam = targetTeam === "enemy" ? target?.team !== actor.team : target?.team === actor.team;
  if (target === undefined || !isOnBoard(state, target.cell) || !hasRequiredTeam || target.visibility !== "revealed" || target.disabled) {
    const expected = targetTeam === "enemy" ? "敌方" : "友方";
    const available = state.units.filter((unit) => unit.team === (targetTeam === "enemy" ? "enemies" : "allies") && isOnBoard(state, unit.cell) && unit.visibility === "revealed" && !unit.disabled).map((unit) => unit.id);
    return rejected(invalidCode, path, `targetId 必须是可见且未禁用的${expected}单位 ID；当前可选：${available.join("、") || "无"}。收到 ${targetId}`);
  }
  return manhattanDistance(origin, target.cell) <= range
    ? undefined
    : rejected("TARGET_OUT_OF_RANGE", path, `目标 ${targetId} 距离为 ${manhattanDistance(origin, target.cell)}，超出允许距离 ${range}；请先在 movePath 中移动到相邻格`);
}

/** Validates an unfinished objective exactly adjacent to the final position. */
function validateInteraction(state: BattleState, origin: Cell, targetId: string): CommandValidation | undefined {
  const objective = state.objectives.find((candidate) => candidate.id === targetId);
  const available = state.objectives.filter((candidate) => !candidate.completed).map((candidate) => candidate.id);
  if (objective === undefined || objective.completed) return rejected("INTERACTION_INVALID", "$.action.targetId", `targetId 必须是未完成目标 ID；当前可选：${available.join("、") || "无"}。格式示例：{\"type\": \"interact\", \"targetId\": \"relay\"}`);
  return manhattanDistance(origin, objective.cell) === 1
    ? undefined
    : rejected("INTERACTION_INVALID", "$.action.targetId", `目标 ${targetId} 必须与行动者正交相邻才能交互；目标坐标是 (${objective.cell.x}, ${objective.cell.y})，请在 movePath 中走到相邻格`);
}

/** Strictly validates one turn command without mutating the battle state. */
export function validateTurnCommand(state: Readonly<BattleState>, input: unknown): CommandValidation {
  const command = readCommand(input);
  if ("accepted" in command) return command;
  if (state.phase !== "in_progress") return rejected("BATTLE_COMPLETE", "$.phase", "战斗已结束");
  if (command.expectedRevision !== state.revision) return rejected("EXPECTED_REVISION_MISMATCH", "$.expectedRevision", `expectedRevision 必须等于当前 world[\"revision\"] 的值 ${state.revision}；收到 ${command.expectedRevision}，请重新读取 world[\"revision\"]`);
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
