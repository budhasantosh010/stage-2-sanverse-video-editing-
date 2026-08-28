import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import { evaluateScene, prepareMotionSceneEvaluatorV15, type MotionSceneV1, type ResolvedMotionSceneV1 } from '@sanverse/motion-graph'
import type { CreativePerformanceRecorderV15 } from './performance.ts'

export interface MotionParityCheckpointV15 {
  readonly tick: number
  readonly previewHash: string
  readonly exportHash: string
  readonly equal: boolean
  readonly textParity: boolean
}

export interface MotionPreviewExportParityReportV15 {
  readonly schemaVersion: 'sanverse.motion-preview-export-parity/v1'
  readonly ok: boolean
  readonly checkpoints: readonly MotionParityCheckpointV15[]
}

const stableValue = (value: unknown): unknown => Array.isArray(value)
  ? value.map(stableValue)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([key, nested]) => [key, stableValue(nested)]))
    : value
const stable = (value: unknown): string => JSON.stringify(stableValue(value))
const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
const textSnapshot = (scene: ResolvedMotionSceneV1): readonly Readonly<{ id: string; text: string }>[] => Object.freeze(Object.values(scene.nodes)
  .filter((node): node is Extract<typeof node, { type: 'text' }> => node.type === 'text')
  .map((node) => Object.freeze({ id: node.id, text: node.text }))
  .sort((a, b) => a.id.localeCompare(b.id)))

/**
 * Preview/export parity uses two independently invoked paths over the same
 * canonical graph: the prepared hot preview evaluator and the one-shot export
 * evaluator. The report never becomes render authority; it only compares
 * deterministic evidence at exact ticks.
 */
export const compareMotionPreviewExportParityV15 = (input: Readonly<{
  scene: MotionSceneV1
  contexts: readonly MotionRenderContextV1[]
  recorder?: CreativePerformanceRecorderV15
}>): MotionPreviewExportParityReportV15 => {
  const preview = prepareMotionSceneEvaluatorV15(input.scene)
  const checkpoints = input.contexts.map((context) => {
    const previewFrame = input.recorder
      ? input.recorder.measure({ subsystem: 'Preview parity', operation: 'prepared-preview', tick: context.localTicks, nodeCount: Object.keys(input.scene.nodes).length }, () => preview.evaluate(context))
      : preview.evaluate(context)
    const exportFrame = input.recorder
      ? input.recorder.measure({ subsystem: 'Export parity', operation: 'canonical-export', tick: context.localTicks, nodeCount: Object.keys(input.scene.nodes).length }, () => evaluateScene(input.scene, context))
      : evaluateScene(input.scene, context)
    const previewJson = stable(previewFrame)
    const exportJson = stable(exportFrame)
    return Object.freeze({
      tick: context.localTicks,
      previewHash: fnv1a(previewJson),
      exportHash: fnv1a(exportJson),
      equal: previewJson === exportJson,
      textParity: JSON.stringify(textSnapshot(previewFrame)) === JSON.stringify(textSnapshot(exportFrame)),
    })
  })
  return Object.freeze({
    schemaVersion: 'sanverse.motion-preview-export-parity/v1',
    ok: checkpoints.every((checkpoint) => checkpoint.equal && checkpoint.textParity),
    checkpoints: Object.freeze(checkpoints),
  })
}
