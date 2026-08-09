import type { CreativeGraphicDirectiveV1, CreativeStyleDirectiveV1 } from './directives.ts'
import type { CreativeDirectionDocumentV1 } from './document.ts'
import {
  CREATIVE_EDIT_PROPOSAL_SCHEMA_VERSION,
} from './proposal.ts'
import type {
  CreativeComponentPlacementV1,
  CreativeEditProposalV1,
  CreativeFootageTreatmentAssignmentV1,
  CreativeMotionAssignmentV1,
  CreativeProposalConstraintV1,
  CreativeResolutionCatalogV1,
  CreativeStyleAssignmentV1,
} from './proposal.ts'
import { validateCreativeDirectionDocument } from './validation-directives.ts'
import { validateCreativeEditProposal } from './validation-proposal.ts'

export interface CreativeGraphicResolutionV1 {
  readonly candidateComponentIds: readonly string[]
  readonly selectedComponentId: string | null
}

export interface CreativeStyleResolutionV1 {
  readonly candidateStylePackIds: readonly string[]
  readonly selectedStylePackId: string | null
}

export interface CreativeIntentResolverV1 {
  readonly resolveGraphic: (directive: CreativeGraphicDirectiveV1, catalog: CreativeResolutionCatalogV1) => CreativeGraphicResolutionV1
  readonly resolveStyle: (directive: CreativeStyleDirectiveV1, catalog: CreativeResolutionCatalogV1) => CreativeStyleResolutionV1
}

const overlaps = (a: Readonly<{ startTicks: number; endTicks: number }>, b: Readonly<{ startTicks: number; endTicks: number }>): boolean => a.startTicks < b.endTicks && b.startTicks < a.endTicks

export const compileCreativeDirection = (input: Readonly<{
  document: CreativeDirectionDocumentV1
  proposalId: string
  resolver: CreativeIntentResolverV1
  catalog: CreativeResolutionCatalogV1
  status?: CreativeEditProposalV1['status']
  confidence?: number
  rationale?: string
}>): CreativeEditProposalV1 => {
  const documentValidation = validateCreativeDirectionDocument(input.document)
  if (!documentValidation.ok) throw new RangeError(documentValidation.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'))
  const document = documentValidation.value
  const activeDirectives = [...document.directives]
    .filter((directive) => directive.status !== 'rejected')
    .sort((a, b) => a.startTicks - b.startTicks || a.endTicks - b.endTicks || a.id.localeCompare(b.id))

  const placements: CreativeComponentPlacementV1[] = []
  const styles: CreativeStyleAssignmentV1[] = []
  const motions: CreativeMotionAssignmentV1[] = []
  const motionDirectives: Extract<(typeof activeDirectives)[number], { kind: 'motion' }>[] = []
  const footage: CreativeFootageTreatmentAssignmentV1[] = []
  const constraints: CreativeProposalConstraintV1[] = []
  const unresolved: string[] = []

  for (const directive of activeDirectives) {
    if (directive.kind === 'graphic') {
      const resolved = input.resolver.resolveGraphic(directive, input.catalog)
      placements.push(Object.freeze({
        id: `placement:${directive.id}`,
        startTicks: directive.startTicks,
        endTicks: directive.endTicks,
        sourceDirectiveId: directive.id,
        communicationIntent: directive.communicationIntent,
        candidateComponentIds: Object.freeze([...resolved.candidateComponentIds]),
        selectedComponentId: resolved.selectedComponentId,
        content: directive.content,
        ...(directive.styleIntent ? { styleIntent: directive.styleIntent } : {}),
        placementIntent: directive.placementIntent ?? 'auto',
        ...(directive.motionIntent ? { motionIntent: directive.motionIntent } : {}),
      }))
    } else if (directive.kind === 'style') {
      const resolved = input.resolver.resolveStyle(directive, input.catalog)
      styles.push(Object.freeze({
        id: `style:${directive.id}`,
        startTicks: directive.startTicks,
        endTicks: directive.endTicks,
        sourceDirectiveId: directive.id,
        semanticIntent: directive.styleIntent,
        candidateStylePackIds: Object.freeze([...resolved.candidateStylePackIds]),
        selectedStylePackId: resolved.selectedStylePackId,
      }))
    } else if (directive.kind === 'motion') {
      motionDirectives.push(directive)
    } else if (directive.kind === 'footage') {
      footage.push(Object.freeze({
        id: `footage:${directive.id}`,
        startTicks: directive.startTicks,
        endTicks: directive.endTicks,
        sourceDirectiveId: directive.id,
        treatment: directive.treatment,
        ...(directive.placementIntent ? { placementIntent: directive.placementIntent } : {}),
        ...(directive.intensity !== undefined ? { intensity: directive.intensity } : {}),
      }))
    } else if (directive.kind === 'constraint') {
      constraints.push(Object.freeze({
        id: `constraint:${directive.id}`,
        startTicks: directive.startTicks,
        endTicks: directive.endTicks,
        sourceDirectiveId: directive.id,
        constraint: directive.constraint,
        ...(directive.maximumGraphics !== undefined ? { maximumGraphics: directive.maximumGraphics } : {}),
        ...(directive.customText ? { customText: directive.customText } : {}),
      }))
    } else unresolved.push(directive.id)
  }

  for (const directive of motionDirectives) {
    const targetPlacementIds = placements.filter((placement) => overlaps(placement, directive)).map((placement) => placement.id)
    motions.push(Object.freeze({
      id: `motion:${directive.id}`,
      startTicks: directive.startTicks,
      endTicks: directive.endTicks,
      sourceDirectiveId: directive.id,
      character: directive.character,
      ...(directive.intensity !== undefined ? { intensity: directive.intensity } : {}),
      targetPlacementIds: Object.freeze(targetPlacementIds),
    }))
  }

  const proposal: CreativeEditProposalV1 = Object.freeze({
    schemaVersion: CREATIVE_EDIT_PROPOSAL_SCHEMA_VERSION,
    id: input.proposalId,
    sourceDirectiveIds: Object.freeze(activeDirectives.map((directive) => directive.id)),
    placements: Object.freeze(placements),
    styleAssignments: Object.freeze(styles),
    motionAssignments: Object.freeze(motions),
    footageTreatments: Object.freeze(footage),
    constraints: Object.freeze(constraints),
    unresolvedDirectiveIds: Object.freeze(unresolved),
    ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
    ...(input.rationale ? { rationale: input.rationale } : {}),
    status: input.status ?? 'proposed',
  })
  const validation = validateCreativeEditProposal(proposal, { durationTicks: document.durationTicks, document, catalog: input.catalog })
  if (!validation.ok) throw new RangeError(validation.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'))
  return validation.value
}
