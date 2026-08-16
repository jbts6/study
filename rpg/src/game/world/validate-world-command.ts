import type { WorldCampaignContent } from "../content/world/types";
import type {
  GameState,
  WorldCommand,
  WorldCommandError,
  WorldCommandValidation,
  WorldFlagValue,
} from "./campaign-types";

const COMMAND_KEYS = {
  inspect: ["expectedRevision", "type", "targetId"],
  talk: ["expectedRevision", "type", "targetId"],
  collect: ["expectedRevision", "type", "targetId"],
  use: ["expectedRevision", "type", "itemId", "targetId"],
  travel: ["expectedRevision", "type", "locationId"],
  prepareBattle: ["expectedRevision", "type", "encounterId"],
} as const;

const COMMAND_EXAMPLES: Record<keyof typeof COMMAND_KEYS, string> = {
  inspect: '{"expectedRevision": 修订号, "type": "inspect", "targetId": "目标id"}',
  talk: '{"expectedRevision": 修订号, "type": "talk", "targetId": "NPC id"}',
  collect: '{"expectedRevision": 修订号, "type": "collect", "targetId": "材料来源id"}',
  use: '{"expectedRevision": 修订号, "type": "use", "itemId": "物品id", "targetId": "目标id"}',
  travel: '{"expectedRevision": 修订号, "type": "travel", "locationId": "地点id"}',
  prepareBattle: '{"expectedRevision": 修订号, "type": "prepareBattle", "encounterId": "遭遇id"}',
};

const error = (code: WorldCommandError["code"], path: string, message: string): WorldCommandError => ({ code, path, message });

function matchesRequirements(flags: Readonly<Record<string, WorldFlagValue>>, requirements: Readonly<Record<string, WorldFlagValue>> | undefined): boolean {
  return Object.entries(requirements ?? {}).every(([key, value]) => flags[key] === value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateWorldCommand(
  state: Readonly<GameState>,
  content: WorldCampaignContent,
  input: unknown,
): WorldCommandValidation {
  if (!isPlainObject(input)) return { accepted: false, errors: [error("INVALID_COMMAND", "", "指令必须是普通对象")] };
  const type = input.type;
  if (typeof input.expectedRevision !== "number" || !Number.isInteger(input.expectedRevision)) {
    return { accepted: false, errors: [error("INVALID_COMMAND", "expectedRevision", "expectedRevision 必须是整数")] };
  }
  if (input.expectedRevision !== state.revision) {
    return { accepted: false, errors: [error("EXPECTED_REVISION_MISMATCH", "expectedRevision", "状态已更新，请重新运行代码")] };
  }
  if (typeof type !== "string" || !Object.hasOwn(COMMAND_KEYS, type)) {
    return { accepted: false, errors: [error("INVALID_COMMAND", "type", "不支持的世界指令类型；可用：talk、inspect、collect、use、travel、prepareBattle")] };
  }
  const keys = Object.keys(input).sort();
  const expectedKeys = [...COMMAND_KEYS[type as keyof typeof COMMAND_KEYS]].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    const unknown = keys.find((key) => !(expectedKeys as readonly string[]).includes(key));
    const suffix = `；${type} 的正确格式：${COMMAND_EXAMPLES[type as keyof typeof COMMAND_KEYS]}`;
    return { accepted: false, errors: [error(unknown === undefined ? "INVALID_COMMAND" : "UNKNOWN_FIELD", unknown ?? "", unknown === undefined ? `指令字段不完整${suffix}` : `指令包含未知字段 ${unknown}${suffix}`)] };
  }

  if (state.battle !== null) return { accepted: false, errors: [error("BATTLE_ACTIVE", "type", "战斗进行中不能执行世界指令")] };

  const chapter = content.chapters[state.chapterId];
  const location = content.locations[state.locationId];
  if (chapter === undefined || location === undefined) {
    return { accepted: false, errors: [error("INVALID_TARGET", "locationId", "当前地点未注册")] };
  }

  if (type === "travel") {
    if (typeof input.locationId !== "string") return { accepted: false, errors: [error("INVALID_COMMAND", "locationId", "地点必须是字符串")] };
    if (!location.connectedLocationIds.includes(input.locationId)) return { accepted: false, errors: [error("TRAVEL_LOCKED", "locationId", `地点未连接或尚未解锁；当前可前往：${location.connectedLocationIds.join("、") || "无"}`)] };
    if (content.locations[input.locationId] === undefined) return { accepted: false, errors: [error("INVALID_TARGET", "locationId", "目标地点未注册")] };
    if (!matchesRequirements(state.worldFlags, location.travelRequirements?.[input.locationId])) return { accepted: false, errors: [error("TRAVEL_LOCKED", "locationId", "前往该地点的路线尚未解锁")] };
    return { accepted: true, command: input as WorldCommand };
  }
  if (type === "prepareBattle") {
    if (typeof input.encounterId !== "string" || !chapter.encounterIds.includes(input.encounterId)) return { accepted: false, errors: [error("INVALID_TARGET", "encounterId", "遭遇未注册")] };
    const encounter = content.encounters[input.encounterId];
    if (encounter === undefined) return { accepted: false, errors: [error("INVALID_TARGET", "encounterId", "遭遇未注册")] };
    if (!matchesRequirements(state.worldFlags, encounter.prerequisiteFlags)) return { accepted: false, errors: [error("TASK_CONDITION_UNMET", "encounterId", "遭遇前置条件未满足")] };
    return { accepted: true, command: input as WorldCommand };
  }

  if (typeof input.targetId !== "string") return { accepted: false, errors: [error("INVALID_COMMAND", "targetId", "目标必须是字符串")] };
  if (type === "talk") {
    if (!location.npcIds.includes(input.targetId) || content.npcs[input.targetId] === undefined) return { accepted: false, errors: [error("INVALID_TARGET", "targetId", `NPC 不在当前地点；此处 NPC：${location.npcIds.join("、") || "无"}`)] };
    return { accepted: true, command: input as WorldCommand };
  }
  if (type === "inspect") {
    if (!location.objectIds.includes(input.targetId) || content.objects[input.targetId] === undefined) return { accepted: false, errors: [error("INVALID_TARGET", "targetId", `对象不在当前地点；此处对象：${location.objectIds.join("、") || "无"}`)] };
    if (input.targetId === "scrap_pile" && state.worldFlags.talked_to_toma !== true) return { accepted: false, errors: [error("TASK_CONDITION_UNMET", "targetId", "需要先与托玛交谈")] };
    if (input.targetId === "weather_station" && state.worldFlags.scrap_pile_inspected !== true) return { accepted: false, errors: [error("TASK_CONDITION_UNMET", "targetId", "需要先调查废料堆")] };
    return { accepted: true, command: input as WorldCommand };
  }
  if (type === "collect") {
    if (!location.itemSourceIds.includes(input.targetId) || content.itemSources[input.targetId] === undefined) return { accepted: false, errors: [error("INVALID_TARGET", "targetId", `材料来源不在当前地点；此处材料来源：${location.itemSourceIds.join("、") || "无"}`)] };
    if (state.worldFlags[`collected:${input.targetId}`] === true) return { accepted: false, errors: [error("ITEM_UNAVAILABLE", "targetId", "材料来源已经收集")] };
    const source = content.itemSources[input.targetId];
    if (!matchesRequirements(state.worldFlags, source.requiredFlags)) return { accepted: false, errors: [error("TASK_CONDITION_UNMET", "targetId", "收集材料的前置条件未满足")] };
    return { accepted: true, command: input as WorldCommand };
  }

  if (typeof input.itemId !== "string") return { accepted: false, errors: [error("INVALID_COMMAND", "itemId", "物品必须是字符串")] };
  if (!location.objectIds.includes(input.targetId) || content.objects[input.targetId] === undefined) return { accepted: false, errors: [error("INVALID_TARGET", "targetId", "对象不在当前地点")] };
  const object = content.objects[input.targetId];
  if (object.requiredItemId !== input.itemId) return { accepted: false, errors: [error("TASK_CONDITION_UNMET", "itemId", "该物品不能用于此对象")] };
  const item = state.inventory.find((entry) => entry.id === input.itemId);
  if (item === undefined || item.amount < 1) return { accepted: false, errors: [error("ITEM_MISSING", "itemId", "背包中缺少所需物品")] };
  return { accepted: true, command: input as WorldCommand };
}
