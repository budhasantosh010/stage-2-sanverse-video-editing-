export type InspectorDraft<T> = Readonly<{
  selectionKey: string
  projectRevision: number
  authoritative: T
  value: T
  dirty: boolean
}>

const equalDraftValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

export function createInspectorDraft<T>(
  selectionKey: string,
  projectRevision: number,
  authoritative: T,
): InspectorDraft<T> {
  return Object.freeze({
    selectionKey,
    projectRevision,
    authoritative,
    value: authoritative,
    dirty: false,
  })
}

export function updateInspectorDraft<T>(
  draft: InspectorDraft<T>,
  value: T,
): InspectorDraft<T> {
  return Object.freeze({
    ...draft,
    value,
    dirty: !equalDraftValue(value, draft.authoritative),
  })
}

export function resetInspectorDraft<T>(draft: InspectorDraft<T>): InspectorDraft<T> {
  if (!draft.dirty && draft.value === draft.authoritative) return draft
  return createInspectorDraft(draft.selectionKey, draft.projectRevision, draft.authoritative)
}

export function reconcileInspectorDraft<T>(
  draft: InspectorDraft<T>,
  selectionKey: string,
  projectRevision: number,
  authoritative: T,
): InspectorDraft<T> {
  if (draft.selectionKey === selectionKey && draft.projectRevision === projectRevision) return draft
  return createInspectorDraft(selectionKey, projectRevision, authoritative)
}

export type InspectorSelectionChangeDecision =
  | Readonly<{ kind: 'continue'; nextItemId: string | null }>
  | Readonly<{ kind: 'confirm'; currentItemId: string | null; nextItemId: string | null }>

export function requestInspectorSelectionChange(
  currentItemId: string | null,
  nextItemId: string | null,
  dirty: boolean,
): InspectorSelectionChangeDecision {
  if (!dirty || currentItemId === nextItemId) {
    return Object.freeze({ kind: 'continue', nextItemId })
  }
  return Object.freeze({ kind: 'confirm', currentItemId, nextItemId })
}
