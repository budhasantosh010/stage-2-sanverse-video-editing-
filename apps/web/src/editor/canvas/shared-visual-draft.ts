import { useCallback, useEffect, useState } from 'react'
import type { VisualProperties } from '@sanverse/edit-domain'
import type {
  CanvasInteractionMode,
  CanvasSelectionResult,
  SharedVisualDraft,
  SharedVisualDraftController,
} from './canvas-contract'

const equal = (left: VisualProperties, right: VisualProperties): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

const selectionKey = (selection: CanvasSelectionResult): string | null =>
  selection.kind === 'supported' && selection.selection.state === 'committed'
    ? `${selection.selection.timelineItemId}:${selection.selection.visualId}`
    : null

export const createSharedVisualDraft = (
  selection: CanvasSelectionResult,
): SharedVisualDraft | null => {
  const key = selectionKey(selection)
  if (!key || selection.kind !== 'supported') return null
  return Object.freeze({
    selectionKey: key,
    projectRevision: selection.selection.projectRevision,
    authoritative: selection.selection.visualProperties,
    value: selection.selection.visualProperties,
    dirty: false,
    interaction: null,
    notice: null,
  })
}

export const reconcileSharedVisualDraft = (
  current: SharedVisualDraft | null,
  selection: CanvasSelectionResult,
): SharedVisualDraft | null => {
  const next = createSharedVisualDraft(selection)
  if (!next) return null
  if (
    current &&
    current.selectionKey === next.selectionKey &&
    current.projectRevision === next.projectRevision
  ) return current
  return next
}

export const updateSharedVisualDraft = (
  current: SharedVisualDraft | null,
  value: VisualProperties,
): SharedVisualDraft | null => current ? Object.freeze({
  ...current,
  value,
  dirty: !equal(value, current.authoritative),
  notice: null,
}) : null

export const resetSharedVisualDraft = (
  current: SharedVisualDraft | null,
): SharedVisualDraft | null => current ? Object.freeze({
  ...current,
  value: current.authoritative,
  dirty: false,
  interaction: null,
  notice: null,
}) : null

export const startSharedVisualInteraction = (
  current: SharedVisualDraft | null,
  mode: CanvasInteractionMode,
): SharedVisualDraft | null => {
  if (!current) return null
  if (current.dirty) return Object.freeze({
    ...current,
    notice: 'Apply or reset the current Inspector changes before dragging this item.',
  })
  return Object.freeze({ ...current, interaction: mode, notice: null })
}

export const finishSharedVisualInteraction = (
  current: SharedVisualDraft | null,
): SharedVisualDraft | null => current ? Object.freeze({ ...current, interaction: null }) : null

export const markSharedVisualDraftApplied = (
  current: SharedVisualDraft | null,
): SharedVisualDraft | null => current ? Object.freeze({
  ...current,
  authoritative: current.value,
  dirty: false,
  interaction: null,
  notice: null,
}) : null

export function useSharedVisualDraft(selection: CanvasSelectionResult): SharedVisualDraftController {
  const [draft, setDraft] = useState<SharedVisualDraft | null>(() => createSharedVisualDraft(selection))

  useEffect(() => {
    setDraft((current) => reconcileSharedVisualDraft(current, selection))
  }, [selection])

  const currentDraft = reconcileSharedVisualDraft(draft, selection)

  const update = useCallback((value: VisualProperties) => {
    setDraft((current) => updateSharedVisualDraft(reconcileSharedVisualDraft(current, selection), value))
  }, [selection])
  const reset = useCallback(
    () => setDraft((current) => resetSharedVisualDraft(reconcileSharedVisualDraft(current, selection))),
    [selection],
  )
  const beginInteraction = useCallback((mode: CanvasInteractionMode): boolean => {
    if (!currentDraft || currentDraft.dirty || currentDraft.interaction !== null) {
      setDraft((current) => {
        const reconciled = reconcileSharedVisualDraft(current, selection)
        return reconciled?.dirty
          ? Object.freeze({ ...reconciled, notice: 'Apply or reset the current Inspector changes before dragging this item.' })
          : reconciled
      })
      return false
    }
    setDraft((current) => startSharedVisualInteraction(reconcileSharedVisualDraft(current, selection), mode))
    return true
  }, [currentDraft, selection])
  const endInteraction = useCallback(() => setDraft((current) => finishSharedVisualInteraction(current)), [])
  const reportNotice = useCallback((message: string | null) => {
    setDraft((current) => current ? Object.freeze({ ...current, notice: message }) : current)
  }, [])
  const markApplied = useCallback(() => setDraft((current) => markSharedVisualDraftApplied(current)), [])

  return Object.freeze({ draft: currentDraft, update, reset, beginInteraction, endInteraction, reportNotice, markApplied })
}
