import type { QuestStep, WorldCampaignContent } from "../content/world/types";
import type { GameState, WorldCommand, WorldCommandError } from "./campaign-types";

export type QuestStepValidation =
  | Readonly<{ ok: true; step: QuestStep }>
  | Readonly<{ ok: false; error: WorldCommandError }>;

const FREE_EXPLORATION_STEP: QuestStep = {
  stepId: "__free_exploration__",
  accept: { type: "talk" },
  effects: { advanceTo: "__free_exploration__" },
};

/** Validates a structurally valid world command against the current chapter quest step. */
export function validateQuestStep(
  state: Readonly<GameState>,
  content: WorldCampaignContent,
  command: WorldCommand,
): QuestStepValidation {
  const chapter = content.chapters[state.chapterId];
  const quest = state.quests[0];
  if (chapter === undefined || quest === undefined || quest.status === "completed") {
    // 章节完成后的自由探索：命令放行，位移与切章由 reduce 处理。
    return { ok: true, step: FREE_EXPLORATION_STEP };
  }
  const step = chapter.questChain.find((candidate) => candidate.stepId === quest.stepId);
  if (step === undefined) {
    return { ok: false, error: { code: "TASK_CONDITION_UNMET", path: "type", message: `未知任务步骤: ${quest.stepId}` } };
  }
  if (command.type !== step.accept.type) {
    return { ok: false, error: { code: "TASK_CONDITION_UNMET", path: "type", message: `当前步骤是 ${step.stepId}，需要 ${step.accept.type} 指令` } };
  }
  const expectedTarget = step.accept.targetFromState !== undefined ? step.accept.targetFromState(state) : step.accept.targetId;
  if (expectedTarget !== undefined) {
    const actual = "targetId" in command ? command.targetId
      : "locationId" in command ? command.locationId
      : "encounterId" in command ? command.encounterId : undefined;
    if (actual !== expectedTarget) {
      return { ok: false, error: { code: "TASK_CONDITION_UNMET", path: "targetId", message: `当前步骤是 ${step.stepId}，目标应该是 ${expectedTarget}，收到 ${actual ?? "无"}` } };
    }
  }
  if (step.accept.itemId !== undefined && command.type === "use" && command.itemId !== step.accept.itemId) {
    return { ok: false, error: { code: "TASK_CONDITION_UNMET", path: "itemId", message: `当前步骤是 ${step.stepId}，需要使用 ${step.accept.itemId}` } };
  }
  return { ok: true, step };
}
