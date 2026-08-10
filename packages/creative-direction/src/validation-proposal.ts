import {
  CREATIVE_FOOTAGE_TREATMENTS,
  CREATIVE_MOTION_CHARACTERS,
  CREATIVE_PLACEMENT_INTENTS,
} from './directives.ts'
import type { CreativeDirectionDocumentV1 } from './document.ts'
import { CREATIVE_EDIT_PROPOSAL_SCHEMA_VERSION } from './proposal.ts'
import type { CreativeEditProposalV1, CreativeResolutionCatalogV1 } from './proposal.ts'
import { validateCreativeGraphicContent } from './validation-directives.ts'
import {
  boundedString,
  creativeRegionValid,
  creativeValidationIssue as issue,
  finite01,
  isRecord,
  stableCreativeId,
  validationFail,
  validationOk,
} from './validation-shared.ts'
import type { CreativeValidationIssueV1, CreativeValidationResultV1 } from './validation-shared.ts'

const proposalRegionIssues = (value: unknown, durationTicks: number, path: string): readonly CreativeValidationIssueV1[] => {
  if (!isRecord(value)) return Object.freeze([issue(path, 'TYPE_INVALID', 'proposal item must be an object.')])
  return creativeRegionValid(value.startTicks, value.endTicks, durationTicks)
    ? Object.freeze([])
    : Object.freeze([issue(path, 'TIME_INVALID', 'proposal region must sit inside document duration.')])
}

export const validateCreativeEditProposal = (
  input: unknown,
  options: Readonly<{ durationTicks: number; catalog?: CreativeResolutionCatalogV1; document?: CreativeDirectionDocumentV1 }>,
): CreativeValidationResultV1<CreativeEditProposalV1> => {
  if (!isRecord(input)) return validationFail([issue('$', 'TYPE_INVALID', 'Creative Edit Proposal must be an object.')])
  const issues: CreativeValidationIssueV1[] = []
  if (input.schemaVersion !== CREATIVE_EDIT_PROPOSAL_SCHEMA_VERSION) issues.push(issue('$.schemaVersion', 'SCHEMA_UNSUPPORTED', 'proposal schema is unsupported.'))
  if (!stableCreativeId(input.id)) issues.push(issue('$.id', 'VALUE_INVALID', 'proposal id must be stable.'))
  if (!['draft', 'proposed', 'accepted', 'rejected', 'applied'].includes(String(input.status))) issues.push(issue('$.status', 'VALUE_INVALID', 'proposal status is unsupported.'))
  if (input.confidence !== undefined && !finite01(input.confidence)) issues.push(issue('$.confidence', 'VALUE_INVALID', 'confidence must be inside [0,1].'))
  if (input.rationale !== undefined && (typeof input.rationale !== 'string' || input.rationale.length > 2000)) issues.push(issue('$.rationale', 'VALUE_INVALID', 'rationale must be at most 2000 characters.'))

  const sourceDirectiveIds = Array.isArray(input.sourceDirectiveIds) ? input.sourceDirectiveIds : []
  if (!Array.isArray(input.sourceDirectiveIds) || new Set(sourceDirectiveIds).size !== sourceDirectiveIds.length || !sourceDirectiveIds.every(stableCreativeId)) issues.push(issue('$.sourceDirectiveIds', 'VALUE_INVALID', 'sourceDirectiveIds must be unique stable IDs.'))
  const knownDirectiveIds = options.document ? new Set(options.document.directives.map((directive) => directive.id)) : null
  if (knownDirectiveIds) for (const id of sourceDirectiveIds) if (typeof id === 'string' && !knownDirectiveIds.has(id)) issues.push(issue('$.sourceDirectiveIds', 'REFERENCE_INVALID', `proposal references missing directive ${id}.`))

  const allItemIds = new Set<string>(), placementIds = new Set<string>()
  const availableComponents = new Set(options.catalog?.componentIds ?? [])
  const availableStyles = new Set(options.catalog?.stylePackIds ?? [])
  const arrays = ['placements', 'styleAssignments', 'motionAssignments', 'footageTreatments', 'constraints'] as const

  for (const key of arrays) {
    const collection = input[key]
    if (!Array.isArray(collection)) { issues.push(issue(`$.${key}`, 'TYPE_INVALID', `${key} must be an array.`)); continue }
    collection.forEach((entry, index) => {
      const path = `$.${key}[${index}]`
      issues.push(...proposalRegionIssues(entry, options.durationTicks, path))
      if (!isRecord(entry)) return
      if (!stableCreativeId(entry.id)) issues.push(issue(`${path}.id`, 'VALUE_INVALID', 'proposal item id must be stable.'))
      else if (allItemIds.has(entry.id)) issues.push(issue(`${path}.id`, 'DUPLICATE_ID', `duplicate proposal item id: ${entry.id}`)); else allItemIds.add(entry.id)
      if (!stableCreativeId(entry.sourceDirectiveId)) issues.push(issue(`${path}.sourceDirectiveId`, 'REFERENCE_INVALID', 'sourceDirectiveId must be stable.'))
      else if (knownDirectiveIds && !knownDirectiveIds.has(entry.sourceDirectiveId)) issues.push(issue(`${path}.sourceDirectiveId`, 'REFERENCE_INVALID', `proposal item references missing directive ${entry.sourceDirectiveId}.`))
      if (entry.sourceObservationIds !== undefined && (!Array.isArray(entry.sourceObservationIds) || entry.sourceObservationIds.length > 32 || new Set(entry.sourceObservationIds).size !== entry.sourceObservationIds.length || !entry.sourceObservationIds.every(stableCreativeId))) issues.push(issue(`${path}.sourceObservationIds`, 'VALUE_INVALID', 'sourceObservationIds must be at most 32 unique stable B1 observation IDs.'))

      if (key === 'placements') {
        if (stableCreativeId(entry.id)) placementIds.add(entry.id)
        if (!boundedString(entry.communicationIntent, 160)) issues.push(issue(`${path}.communicationIntent`, 'VALUE_INVALID', 'placement communicationIntent must be bounded.'))
        if (!Array.isArray(entry.candidateComponentIds) || entry.candidateComponentIds.length === 0 || !entry.candidateComponentIds.every(stableCreativeId)) issues.push(issue(`${path}.candidateComponentIds`, 'VALUE_INVALID', 'placement needs at least one stable component candidate.'))
        if (entry.selectedComponentId !== null && !stableCreativeId(entry.selectedComponentId)) issues.push(issue(`${path}.selectedComponentId`, 'VALUE_INVALID', 'selectedComponentId must be null or stable.'))
        if (typeof entry.selectedComponentId === 'string' && Array.isArray(entry.candidateComponentIds) && !entry.candidateComponentIds.includes(entry.selectedComponentId)) issues.push(issue(`${path}.selectedComponentId`, 'REFERENCE_INVALID', 'selected component must be one of the candidates.'))
        if (options.catalog && typeof entry.selectedComponentId === 'string' && !availableComponents.has(entry.selectedComponentId)) issues.push(issue(`${path}.selectedComponentId`, 'REFERENCE_INVALID', `resolved component ${entry.selectedComponentId} is not in the supplied Plan-A catalog.`))
        issues.push(...validateCreativeGraphicContent(entry.content, `${path}.content`))
        if (!CREATIVE_PLACEMENT_INTENTS.includes(entry.placementIntent as never)) issues.push(issue(`${path}.placementIntent`, 'VALUE_INVALID', 'placementIntent is unsupported.'))
        if (entry.motionIntent !== undefined && !CREATIVE_MOTION_CHARACTERS.includes(entry.motionIntent as never)) issues.push(issue(`${path}.motionIntent`, 'VALUE_INVALID', 'motionIntent is unsupported.'))
      } else if (key === 'styleAssignments') {
        if (!boundedString(entry.semanticIntent, 120)) issues.push(issue(`${path}.semanticIntent`, 'VALUE_INVALID', 'style semanticIntent must be bounded.'))
        if (!Array.isArray(entry.candidateStylePackIds) || !entry.candidateStylePackIds.every(stableCreativeId)) issues.push(issue(`${path}.candidateStylePackIds`, 'VALUE_INVALID', 'candidateStylePackIds must be stable IDs.'))
        if (entry.selectedStylePackId !== null && !stableCreativeId(entry.selectedStylePackId)) issues.push(issue(`${path}.selectedStylePackId`, 'VALUE_INVALID', 'selectedStylePackId must be null or stable.'))
        if (typeof entry.selectedStylePackId === 'string' && Array.isArray(entry.candidateStylePackIds) && !entry.candidateStylePackIds.includes(entry.selectedStylePackId)) issues.push(issue(`${path}.selectedStylePackId`, 'REFERENCE_INVALID', 'selected style must be one of the candidates.'))
        if (options.catalog && typeof entry.selectedStylePackId === 'string' && !availableStyles.has(entry.selectedStylePackId)) issues.push(issue(`${path}.selectedStylePackId`, 'REFERENCE_INVALID', `resolved style ${entry.selectedStylePackId} is not in the supplied Plan-A style catalog.`))
      } else if (key === 'motionAssignments') {
        if (!CREATIVE_MOTION_CHARACTERS.includes(entry.character as never)) issues.push(issue(`${path}.character`, 'VALUE_INVALID', 'motion assignment character is unsupported.'))
        if (entry.intensity !== undefined && !finite01(entry.intensity)) issues.push(issue(`${path}.intensity`, 'VALUE_INVALID', 'motion assignment intensity must be inside [0,1].'))
        if (!Array.isArray(entry.targetPlacementIds) || !entry.targetPlacementIds.every(stableCreativeId)) issues.push(issue(`${path}.targetPlacementIds`, 'VALUE_INVALID', 'targetPlacementIds must be stable IDs.'))
      } else if (key === 'footageTreatments') {
        if (!CREATIVE_FOOTAGE_TREATMENTS.includes(entry.treatment as never)) issues.push(issue(`${path}.treatment`, 'VALUE_INVALID', 'footage treatment is unsupported.'))
      } else if (key === 'constraints') {
        if (!boundedString(entry.constraint, 120)) issues.push(issue(`${path}.constraint`, 'VALUE_INVALID', 'proposal constraint must be bounded.'))
      }
    })
  }

  if (Array.isArray(input.motionAssignments)) input.motionAssignments.forEach((entry, index) => {
    if (!isRecord(entry) || !Array.isArray(entry.targetPlacementIds)) return
    for (const placementId of entry.targetPlacementIds) if (typeof placementId === 'string' && !placementIds.has(placementId)) issues.push(issue(`$.motionAssignments[${index}].targetPlacementIds`, 'REFERENCE_INVALID', `motion assignment references missing placement ${placementId}.`))
  })

  if (!Array.isArray(input.unresolvedDirectiveIds) || !input.unresolvedDirectiveIds.every(stableCreativeId)) issues.push(issue('$.unresolvedDirectiveIds', 'VALUE_INVALID', 'unresolvedDirectiveIds must be stable IDs.'))
  else if (knownDirectiveIds) for (const id of input.unresolvedDirectiveIds) if (!knownDirectiveIds.has(id)) issues.push(issue('$.unresolvedDirectiveIds', 'REFERENCE_INVALID', `unresolved directive ${id} does not exist.`))

  return issues.length ? validationFail(issues) : validationOk(input as unknown as CreativeEditProposalV1)
}
