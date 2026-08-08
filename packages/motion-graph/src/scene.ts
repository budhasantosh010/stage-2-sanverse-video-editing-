import type { MotionAspectRatio, MotionComponentModuleV1, MotionRenderContextV1 } from '@sanverse/motion-contract'
import type { MotionNodeId, MotionLayoutMetadataV1 } from './properties.ts'
import type { MotionNodeV1 } from './nodes.ts'
import type { MotionSemanticPartV1 } from './parts.ts'
import type { MotionExposureV1 } from './exposures.ts'

export interface MotionSceneV1 {
  readonly schemaVersion: 'sanverse.motion-scene/v1'
  readonly componentId: string
  readonly componentVersion: number
  readonly rootNodeId: MotionNodeId
  readonly nodes: Readonly<Record<MotionNodeId, MotionNodeV1>>
  readonly semanticParts: readonly MotionSemanticPartV1[]
  readonly exposures: readonly MotionExposureV1[]
  readonly layout: MotionLayoutMetadataV1
  readonly supportedAspectRatios: readonly MotionAspectRatio[]
}
export const createMotionScene = (input: Omit<MotionSceneV1, 'schemaVersion'>): MotionSceneV1 => Object.freeze({ schemaVersion: 'sanverse.motion-scene/v1', ...input })

export interface MotionGraphBackedComponentModuleV1<Props, Style> extends MotionComponentModuleV1<Props, Style> {
  readonly createScene: (props: Props, style: Style, context: MotionRenderContextV1) => MotionSceneV1
}
