import type { BattleErrorCode, BattleEvent, BattleState } from "../game/combat/types";
import { getLevel } from "../game/content/levels";
import type { LevelDefinition, LevelId } from "../game/content/types";
import type { WorldCommand, WorldCommandError } from "../game/world/campaign-types";
import type { ImplementedLanguage } from "../programs/types";
import type { RunResult, RunnerDiagnostic } from "../runners/protocol/types";
import { formatBattleFeedback } from "./battle-feedback";

export type AppFeedback = Readonly<{
  layer?: "program" | "task" | "strategy";
  kind: "idle" | "success" | "error" | "info";
  title: string;
  messages: readonly string[];
  stdout: string;
  stderr: string;
  relatedReferenceIds?: readonly string[];
}>;

const ERROR_REFERENCE_MAP: Partial<Record<BattleErrorCode, readonly string[]>> = {
  INVALID_COMMAND: ["type.turn-command"],
  UNKNOWN_FIELD: ["type.turn-command"],
  EXPECTED_REVISION_MISMATCH: ["type.turn-command"],
  INVALID_MOVE_PATH: ["type.cell", "action.move-and-attack", "action.move-and-cast", "action.move-and-interact"],
  MOVE_TOO_FAR: ["type.cell", "action.move-and-attack", "action.move-and-cast", "action.move-and-interact"],
  MOVE_BLOCKED: ["type.cell", "type.board", "action.move-and-attack", "action.move-and-cast", "action.move-and-interact"],
  INVALID_TARGET: ["type.unit", "action.attack", "action.cast"],
  TARGET_OUT_OF_RANGE: ["type.unit", "action.attack", "action.cast", "action.move-and-attack", "action.move-and-cast"],
  SKILL_NOT_FOUND: ["type.skill", "action.cast", "action.move-and-cast"],
  SKILL_ON_COOLDOWN: ["type.skill", "action.cast", "action.move-and-cast"],
  SKILL_TARGET_SHAPE: ["type.skill", "action.cast", "action.move-and-cast"],
  INTERACTION_INVALID: ["type.objective", "action.interact", "action.move-and-interact"],
};

export function idleFeedback(): AppFeedback {
  return { layer: "task", kind: "idle", title: "", messages: [], stdout: "", stderr: "" };
}

export function successFeedback(
  state: BattleState,
  events: readonly BattleEvent[],
  result: RunResult,
  level: LevelDefinition = getLevel(state.battleId as LevelId),
): AppFeedback {
  const settlement = settlementFeedback(level, state);
  if (settlement.kind !== "idle") return { ...settlement, stdout: result.streams.stdout, stderr: result.streams.stderr };
  return {
    layer: "strategy",
    kind: "success",
    title: "回合已推进",
    messages: formatBattleFeedback(state, events),
    stdout: result.streams.stdout,
    stderr: result.streams.stderr,
  };
}

export function settlementFeedback(level: LevelDefinition, state: BattleState): AppFeedback {
  if (state.phase === "lost") return errorFeedback("任务失败", ["战斗失败。重试本关以保留当前代码。"], "strategy");
  const unmet = unmetObjectives(state);
  if (unmet.length > 0) return errorFeedback("任务失败", unmet.map((reason) => `任务失败：${reason}`), "strategy");
  if (state.phase !== "won") return idleFeedback();
  return level.reward.type === "ability"
    ? { layer: "strategy", kind: "success", title: "关卡完成", messages: [`获得新能力：${level.reward.abilityId}`], stdout: "", stderr: "" }
    : { layer: "strategy", kind: "success", title: "战役完成", messages: ["沼心封印已经稳定。"], stdout: "", stderr: "" };
}

export function isSuccessfulSettlement(levelId: LevelId, state: BattleState): boolean {
  return state.phase === "won" && unmetObjectives(state).length === 0 && getLevel(levelId).id === levelId;
}

export function isRetriableSettlement(levelId: LevelId, state: BattleState): boolean {
  const successful = isSuccessfulSettlement(levelId, state);
  return state.phase === "lost"
    || (state.phase === "won" && !successful)
    || (successful && getLevel(levelId).reward.type === "ability");
}

export function combatErrorFeedback(errors: readonly Readonly<{ code: string; path: string; message: string }>[]): AppFeedback {
  const relatedReferenceIds = [...new Set(errors.flatMap((error) =>
    ERROR_REFERENCE_MAP[error.code as BattleErrorCode] ?? ["type.turn-command"]
  ))];
  return {
    ...errorFeedback("指令无效", errors.map((error) => `[${error.code}] ${error.path} ${error.message}`)),
    relatedReferenceIds,
  };
}

export function worldErrorFeedback(errors: readonly WorldCommandError[]): AppFeedback {
  return errorFeedback("探索指令无效", errors.map((error) => `[${error.code}] ${error.path} ${error.message}`));
}

export function worldCommandFeedback(command: WorldCommand, result: RunResult): AppFeedback {
  return {
    layer: "task",
    kind: "success",
    title: "探索行动已接受",
    messages: [`已执行世界指令：${command.type}`],
    stdout: result.streams.stdout,
    stderr: result.streams.stderr,
  };
}

export function feedbackFromRunResult(result: RunResult, language: ImplementedLanguage): AppFeedback {
  const interrupted = result.executionStatus === "interrupted";
  const messages = result.diagnostics.map(formatDiagnostic);
  if (interrupted) messages.unshift("运行已中断，回合未推进。");
  const languageName = languageLabel(language);
  const title = interrupted
    ? "运行已中断"
    : result.executionStatus === "compile_error" ? `${languageName} 编译失败` : `${languageName} 运行失败`;
  return {
    layer: "program",
    kind: interrupted ? "info" : "error",
    title,
    messages,
    stdout: result.streams.stdout,
    stderr: result.streams.stderr,
  };
}

export function errorFeedback(
  title: string,
  messages: readonly string[],
  layer: AppFeedback["layer"] = "task",
): AppFeedback {
  return { layer, kind: "error", title, messages, stdout: "", stderr: "" };
}

function unmetObjectives(state: BattleState): readonly string[] {
  if (state.phase !== "won") return [];
  return state.objectives.filter((objective) => !objective.key && !objective.completed)
    .map((objective) => objective.id === "scout-mark" ? "勘测印记尚未激活" : `${objective.id} 尚未激活`);
}

function formatDiagnostic(diagnostic: RunnerDiagnostic): string {
  const prefix = `[${diagnostic.severity}] ${diagnostic.code}`;
  if (diagnostic.location === undefined) return `${prefix} ${diagnostic.message}`;
  const { file, line, column } = diagnostic.location;
  return `${prefix} ${file}:${line}${column === undefined ? "" : `:${column}`} ${diagnostic.message}`;
}

function languageLabel(language: ImplementedLanguage): string {
  return language === "python" ? "Python" : "Go";
}
