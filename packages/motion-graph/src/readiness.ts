import type { MotionValidationIssueV1 } from '@sanverse/motion-contract'
import type { MotionSceneV1 } from './scene.ts'
import { validateMotionScene } from './validation.ts'
import { deriveLayerTree, deriveNodeEffectRelationships, deriveTimelineTracks } from './projections.ts'

export interface MotionCompositorReadinessReportV1 {
  readonly ready: boolean
  readonly issues: readonly MotionValidationIssueV1[]
  readonly nodeCount: number
  readonly semanticPartCount: number
  readonly effectCount: number
  readonly maskCount: number
  readonly timelineTrackCount: number
}

export const validateCompositorReadiness = (scene: MotionSceneV1): MotionCompositorReadinessReportV1 => {
  const validation = validateMotionScene(scene)
  const issues: MotionValidationIssueV1[] = validation.ok ? [] : [...validation.issues]
  if (validation.ok) {
    const covered = new Set(scene.semanticParts.flatMap((part) => part.nodeIds))
    for (const node of Object.values(scene.nodes)) {
      if (node.id !== scene.rootNodeId && !covered.has(node.id)) issues.push({ path: `$.nodes.${node.id}`, code: 'VALUE_INVALID', message: 'Visually meaningful node is not mapped to a semantic part.' })
    }
    try { deriveLayerTree(scene); deriveNodeEffectRelationships(scene); deriveTimelineTracks(scene) } catch (error) {
      issues.push({ path: '$', code: 'VALUE_INVALID', message: error instanceof Error ? error.message : 'Graph projection failed.' })
    }
  }
  return Object.freeze({
    ready: issues.length === 0,
    issues: Object.freeze(issues),
    nodeCount: Object.keys(scene.nodes).length,
    semanticPartCount: scene.semanticParts.length,
    effectCount: Object.values(scene.nodes).reduce((sum, node) => sum + node.effects.length, 0),
    maskCount: Object.values(scene.nodes).reduce((sum, node) => sum + node.masks.length, 0),
    timelineTrackCount: validation.ok ? deriveTimelineTracks(scene).length : 0,
  })
}
