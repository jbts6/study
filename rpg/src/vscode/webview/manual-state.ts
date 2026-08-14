export type ManualSectionId = "focus" | "turn-command" | "world" | "actions" | "sdk";
export type ManualView = "battle" | "manual";
export type ManualViewState = Readonly<{ view: ManualView; sectionId: ManualSectionId }>;
export type PersistedManualState = Readonly<{ levelId: string; view: ManualView; sectionId: ManualSectionId }>;
export type ManualSnapshotInfo = Readonly<{ levelId: string; revision: number; hasReference: boolean }>;
export type ManualTransitionContext = Readonly<{ previousRevision?: number; persistedLevelId?: string }>;

const stateLevelId = Symbol("manualStateLevelId");
type InternalManualViewState = ManualViewState & { [stateLevelId]?: string };

export function resolveManualView(
  previous: ManualViewState | undefined,
  snapshot: ManualSnapshotInfo,
  context?: ManualTransitionContext,
): ManualViewState {
  const prior = previous as InternalManualViewState | undefined;
  const fallback: ManualViewState = { view: "manual", sectionId: "focus" };

  if (!snapshot.hasReference) {
    return withLevel({ view: "battle", sectionId: previous?.sectionId ?? "focus" }, snapshot.levelId);
  }

  const levelChanged = context?.persistedLevelId !== undefined
    ? context.persistedLevelId !== snapshot.levelId
    : prior?.[stateLevelId] !== undefined
      ? prior[stateLevelId] !== snapshot.levelId
      : snapshot.levelId !== "go-marsh-01";
  if (snapshot.revision === 0 && levelChanged) return withLevel(fallback, snapshot.levelId);

  const current = previous ?? fallback;
  if (snapshot.revision > 0 && (
    previous === undefined
    || (context?.previousRevision !== undefined && snapshot.revision > context.previousRevision)
  )) {
    return withLevel({ view: "battle", sectionId: current.sectionId }, snapshot.levelId);
  }

  return withLevel(current, snapshot.levelId);
}

export function resolveReferenceSection(referenceId: string): ManualSectionId {
  if (referenceId === "entrypoint.choose-turn" || referenceId === "type.turn-command") return "turn-command";
  if (referenceId.startsWith("action.")) return "actions";
  if (referenceId.startsWith("type.")) return "world";
  return "turn-command";
}

function withLevel(state: ManualViewState, levelId: string): ManualViewState {
  const value = { ...state } as InternalManualViewState;
  Object.defineProperty(value, stateLevelId, { value: levelId, enumerable: false });
  return value;
}
