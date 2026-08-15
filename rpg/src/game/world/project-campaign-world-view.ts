import type { CampaignWorldView, GameState, WorldFlagValue } from "./campaign-types";
import type { FlagRequirements, WorldCampaignContent } from "../content/world/types";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue);
    }
  }
  return value;
}

function matchesRequirements(
  worldFlags: Readonly<Record<string, WorldFlagValue>>,
  requirements: FlagRequirements | undefined,
): boolean {
  return Object.entries(requirements ?? {}).every(([flag, expectedValue]) => worldFlags[flag] === expectedValue);
}

/**
 * Creates an immutable public exploration projection without exposing world rules or battle state.
 */
export function projectCampaignWorldView(
  state: Readonly<GameState>,
  content: WorldCampaignContent,
): CampaignWorldView {
  const location = content.locations[state.locationId];
  if (location === undefined) {
    throw new Error(`未注册的世界地点: ${state.locationId}`);
  }

  const npcs = location.npcIds.map((npcId) => {
    const npc = content.npcs[npcId];
    if (npc === undefined) throw new Error(`未注册的 NPC: ${npcId}`);
    return { id: npc.id, name: npc.name, role: npc.role, mood: npc.mood };
  });

  const objects = location.objectIds.map((objectId) => {
    const object = content.objects[objectId];
    if (object === undefined) throw new Error(`未注册的世界对象: ${objectId}`);
    return {
      id: object.id,
      type: object.type,
      status: object.id === "relay" && state.worldFlags.relay_repaired === true
        ? "repaired"
        : object.initialStatus,
      requiredItems: object.requiredItemId === undefined ? [] : [object.requiredItemId],
    };
  });

  const itemSourceObjects = location.itemSourceIds
    .map((sourceId) => {
      const source = content.itemSources[sourceId];
      if (source === undefined) throw new Error(`未注册的物品来源: ${sourceId}`);
      return source;
    })
    .filter((source) => (
      matchesRequirements(state.worldFlags, source.requiredFlags)
      && state.worldFlags[`collected:${source.id}`] !== true
    ))
    .map((source) => ({
      id: source.id,
      type: "item-source",
      status: "available",
      requiredItems: [],
    }));

  const availableTravel = location.connectedLocationIds.filter((locationId) => (
    matchesRequirements(state.worldFlags, location.travelRequirements?.[locationId])
  ));

  const view: CampaignWorldView = {
    revision: state.revision,
    location: location.weather === undefined
      ? { id: location.id, name: location.name }
      : { id: location.id, name: location.name, weather: location.weather },
    npcs,
    objects: [...objects, ...itemSourceObjects],
    inventory: state.inventory.map((item) => ({ id: item.id, amount: item.amount })),
    quests: state.quests.map((quest) => ({ id: quest.id, status: quest.status, stepId: quest.stepId })),
    availableTravel: [...availableTravel],
  };

  return deepFreeze(view);
}
