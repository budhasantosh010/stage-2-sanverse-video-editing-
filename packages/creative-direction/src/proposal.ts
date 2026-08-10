import type {
  CreativeFootageTreatmentV1,
  CreativeGraphicContentV1,
  CreativeMotionCharacterV1,
  CreativePlacementIntentV1,
} from './directives.ts'

export const CREATIVE_EDIT_PROPOSAL_SCHEMA_VERSION = 'sanverse.creative-edit-proposal/v1' as const
export type CreativeProposalStatusV1 = 'draft' | 'proposed' | 'accepted' | 'rejected' | 'applied'

export interface CreativeComponentPlacementV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly sourceDirectiveId: string
  readonly sourceObservationIds?: readonly string[]
  readonly communicationIntent: string
  readonly candidateComponentIds: readonly string[]
  readonly selectedComponentId: string | null
  readonly content: CreativeGraphicContentV1
  readonly styleIntent?: string
  readonly placementIntent: CreativePlacementIntentV1
  readonly motionIntent?: CreativeMotionCharacterV1
}

export interface CreativeStyleAssignmentV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly sourceDirectiveId: string
  readonly sourceObservationIds?: readonly string[]
  readonly semanticIntent: string
  readonly candidateStylePackIds: readonly string[]
  readonly selectedStylePackId: string | null
}

export interface CreativeMotionAssignmentV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly sourceDirectiveId: string
  readonly sourceObservationIds?: readonly string[]
  readonly character: CreativeMotionCharacterV1
  readonly intensity?: number
  readonly targetPlacementIds: readonly string[]
}

export interface CreativeFootageTreatmentAssignmentV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly sourceDirectiveId: string
  readonly sourceObservationIds?: readonly string[]
  readonly treatment: CreativeFootageTreatmentV1
  readonly placementIntent?: CreativePlacementIntentV1
  readonly intensity?: number
}

export interface CreativeProposalConstraintV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly sourceDirectiveId: string
  readonly sourceObservationIds?: readonly string[]
  readonly constraint: string
  readonly maximumGraphics?: number
  readonly customText?: string
}

export interface CreativeEditProposalV1 {
  readonly schemaVersion: typeof CREATIVE_EDIT_PROPOSAL_SCHEMA_VERSION
  readonly id: string
  readonly sourceDirectiveIds: readonly string[]
  readonly placements: readonly CreativeComponentPlacementV1[]
  readonly styleAssignments: readonly CreativeStyleAssignmentV1[]
  readonly motionAssignments: readonly CreativeMotionAssignmentV1[]
  readonly footageTreatments: readonly CreativeFootageTreatmentAssignmentV1[]
  readonly constraints: readonly CreativeProposalConstraintV1[]
  /** Directives intentionally preserved when B0 has no compiler rule yet. */
  readonly unresolvedDirectiveIds: readonly string[]
  readonly confidence?: number
  readonly rationale?: string
  readonly status: CreativeProposalStatusV1
}

export interface CreativeResolutionCatalogV1 {
  readonly componentIds: readonly string[]
  readonly stylePackIds: readonly string[]
}
