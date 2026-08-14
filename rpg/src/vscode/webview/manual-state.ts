export type ManualSectionId = "focus" | "turn-command" | "world" | "actions" | "sdk";
export type ManualView = "battle" | "manual";
export type ManualViewState = Readonly<{ view: ManualView; sectionId: ManualSectionId }>;
export type PersistedManualState = Readonly<{ levelId: string; view: ManualView; sectionId: ManualSectionId }>;
export type ManualSnapshotInfo = Readonly<{ levelId: string; revision: number; hasReference: boolean }>;
export type ManualTransitionContext = Readonly<{
  previousRevision?: number;
  previousLevelId?: string;
  persistedLevelId?: string;
}>;

export function resolveManualView(
  previous: ManualViewState | undefined,
  snapshot: ManualSnapshotInfo,
  context?: ManualTransitionContext,
): ManualViewState {
  const fallback: ManualViewState = { view: "manual", sectionId: "focus" };

  if (!snapshot.hasReference) {
    return { view: "battle", sectionId: previous?.sectionId ?? "focus" };
  }

  const priorLevelId = context?.previousLevelId ?? context?.persistedLevelId;
  if (snapshot.revision === 0 && priorLevelId !== undefined && priorLevelId !== snapshot.levelId) return fallback;

  const current = previous ?? fallback;
  if (snapshot.revision > 0 && (
    previous === undefined
    || (context?.previousRevision !== undefined && snapshot.revision > context.previousRevision)
  )) {
    return { view: "battle", sectionId: current.sectionId };
  }

  return current;
}

export function resolveReferenceSection(referenceId: string): ManualSectionId {
  if (referenceId === "entrypoint.choose-turn" || referenceId === "type.turn-command") return "turn-command";
  if (referenceId.startsWith("action.")) return "actions";
  if (referenceId.startsWith("type.")) return "world";
  return "turn-command";
}
