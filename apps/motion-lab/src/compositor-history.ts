import type { MotionAuthoringMetadataV1, MotionGraphOperationV1, MotionSelectionStateV1 } from '@sanverse/motion-graph'

export interface MotionLabCompositorSnapshotV1 {
  readonly graphOperations: readonly MotionGraphOperationV1[]
  readonly authoringMetadata: MotionAuthoringMetadataV1
  readonly selection: MotionSelectionStateV1
}

export interface MotionLabCompositorHistoryV1 {
  readonly undo: readonly MotionLabCompositorSnapshotV1[]
  readonly redo: readonly MotionLabCompositorSnapshotV1[]
  readonly limit: number
}

export const createCompositorHistory = (limit = 50): MotionLabCompositorHistoryV1 => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new RangeError('Compositor history limit must be an integer inside [1, 500].')
  return Object.freeze({ undo: Object.freeze([]), redo: Object.freeze([]), limit })
}

export const pushCompositorHistory = (history: MotionLabCompositorHistoryV1, snapshot: MotionLabCompositorSnapshotV1): MotionLabCompositorHistoryV1 => Object.freeze({
  undo: Object.freeze([...history.undo, snapshot].slice(-history.limit)),
  redo: Object.freeze([]),
  limit: history.limit,
})

export const undoCompositorHistory = (
  history: MotionLabCompositorHistoryV1,
  current: MotionLabCompositorSnapshotV1,
): Readonly<{ history: MotionLabCompositorHistoryV1; snapshot: MotionLabCompositorSnapshotV1 | null }> => {
  const snapshot = history.undo.at(-1) ?? null
  if (!snapshot) return Object.freeze({ history, snapshot: null })
  return Object.freeze({
    snapshot,
    history: Object.freeze({ undo: Object.freeze(history.undo.slice(0, -1)), redo: Object.freeze([...history.redo, current].slice(-history.limit)), limit: history.limit }),
  })
}

export const redoCompositorHistory = (
  history: MotionLabCompositorHistoryV1,
  current: MotionLabCompositorSnapshotV1,
): Readonly<{ history: MotionLabCompositorHistoryV1; snapshot: MotionLabCompositorSnapshotV1 | null }> => {
  const snapshot = history.redo.at(-1) ?? null
  if (!snapshot) return Object.freeze({ history, snapshot: null })
  return Object.freeze({
    snapshot,
    history: Object.freeze({ undo: Object.freeze([...history.undo, current].slice(-history.limit)), redo: Object.freeze(history.redo.slice(0, -1)), limit: history.limit }),
  })
}
