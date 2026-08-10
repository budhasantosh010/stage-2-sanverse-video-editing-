import {
  createCreativeDirectionDocument,
} from '@sanverse/creative-direction'
import type {
  CreativeDirectionDocumentV1,
  CreativeGraphicDirectiveV1,
  CreativeDirectiveV1,
} from '@sanverse/creative-direction'
import type {
  SemanticMomentV1,
  VideoUnderstandingDocumentV1,
} from '@sanverse/video-understanding'

export interface CreativeSourceTraceV1 {
  readonly observationId: string
  readonly observationKind: string
  readonly startTicks: number
  readonly endTicks: number
  readonly confidence?: number
  readonly provenanceId: string
  readonly analyzerId: string
  readonly transcriptSegmentIds: readonly string[]
}

const allObservationRecords = (document: VideoUnderstandingDocumentV1): readonly Readonly<{
  id: string
  startTicks: number
  endTicks: number
  kind: string
  confidence?: number
  provenance: string
  transcriptSegmentIds?: readonly string[]
}>[] => Object.freeze([
  ...document.semanticMoments,
  ...document.spatialObservations,
  ...document.visualRegions,
  ...document.shots.map((shot) => Object.freeze({ ...shot, kind: 'shot' as const })),
  ...document.observations,
  ...document.transcript.map((segment) => Object.freeze({ ...segment, kind: 'transcript' as const })),
])

/**
 * Resolve one stable B1 observation ID into the provenance/time trace needed by
 * B0 proposal and integration evidence. This stays read-only over B1.
 */
export const resolveCreativeSourceTrace = (document: VideoUnderstandingDocumentV1, observationId: string): CreativeSourceTraceV1 => {
  const observation = allObservationRecords(document).find((entry) => entry.id === observationId)
  if (!observation) throw new RangeError(`Unknown B1 observation: ${observationId}`)
  const provenance = document.provenance.find((entry) => entry.id === observation.provenance)
  if (!provenance) throw new RangeError(`Observation ${observationId} references missing provenance ${observation.provenance}.`)
  return Object.freeze({
    observationId,
    observationKind: observation.kind,
    startTicks: observation.startTicks,
    endTicks: observation.endTicks,
    ...(observation.confidence !== undefined ? { confidence: observation.confidence } : {}),
    provenanceId: provenance.id,
    analyzerId: provenance.analyzerId,
    transcriptSegmentIds: Object.freeze([...(observation.transcriptSegmentIds ?? (observation.kind === 'transcript' ? [observation.id] : []))]),
  })
}

const semanticTranscriptText = (document: VideoUnderstandingDocumentV1, moment: SemanticMomentV1): string => moment.transcriptSegmentIds
  .map((id) => document.transcript.find((segment) => segment.id === id)?.text ?? '')
  .filter(Boolean)
  .join(' ')
  .trim()

/**
 * Deterministic B1 → B0 adapter for a source statistic. It creates semantic
 * direction only. Component selection remains a separate B0 planner/resolver
 * decision and this module has no Motion-library dependency.
 */
export const createSourceStatisticCreativeDirection = (
  source: VideoUnderstandingDocumentV1,
  observationId: string,
): CreativeDirectionDocumentV1 => {
  const moment = source.semanticMoments.find((entry) => entry.id === observationId)
  if (!moment) throw new RangeError(`Statistic source ${observationId} is not a B1 semantic moment.`)
  if (moment.kind !== 'percentage' && moment.kind !== 'statistic' && moment.kind !== 'money') throw new RangeError(`Semantic moment ${observationId} is ${moment.kind}, not a statistic.`)
  if (moment.value === undefined) throw new RangeError(`Semantic moment ${observationId} has no statistic value.`)
  resolveCreativeSourceTrace(source, observationId)
  const transcriptText = semanticTranscriptText(source, moment)
  const displayedValue = `${String(moment.value)}${moment.unit === '%' ? '%' : moment.unit && moment.unit !== 'currency' ? ` ${moment.unit}` : ''}`
  const directive: CreativeGraphicDirectiveV1 = Object.freeze({
    id: `graphic:source-statistic:${observationId.replace(/[^a-z0-9:-]+/giu, '-')}`,
    kind: 'graphic',
    track: 'GRAPHICS',
    startTicks: moment.startTicks,
    endTicks: moment.endTicks,
    source: 'system',
    priority: 'required',
    status: 'accepted',
    sourceObservationIds: Object.freeze([observationId]),
    communicationIntent: 'source-statistic',
    preferredFamily: 'value',
    content: Object.freeze({
      primaryText: transcriptText || moment.subject || 'Source statistic',
      ...(moment.kind === 'percentage' && typeof moment.value === 'number' && moment.value >= 0 && moment.value <= 100
        ? { items: Object.freeze([`Observed · ${moment.value}`, `Remaining · ${Number((100 - moment.value).toFixed(4))}`]) }
        : {}),
      fields: Object.freeze({ value: displayedValue }),
    }),
    placementIntent: 'center',
    motionIntent: 'restrained',
  })
  return createCreativeDirectionDocument({ durationTicks: source.source.durationTicks, directives: Object.freeze([directive]) })
}

/**
 * Adds verified B1 references to an existing B0 directive while preserving its
 * stable directive ID and all semantic creative choices.
 */
export const linkCreativeDirectiveToSourceObservations = (
  document: CreativeDirectionDocumentV1,
  directiveId: string,
  observationIds: readonly string[],
  source: VideoUnderstandingDocumentV1,
): CreativeDirectionDocumentV1 => {
  if (observationIds.length === 0) throw new RangeError('At least one B1 observation ID is required.')
  for (const id of observationIds) resolveCreativeSourceTrace(source, id)
  const found = document.directives.some((directive) => directive.id === directiveId)
  if (!found) throw new RangeError(`Unknown B0 directive: ${directiveId}`)
  const directives: readonly CreativeDirectiveV1[] = Object.freeze(document.directives.map((directive) => directive.id === directiveId
    ? Object.freeze({ ...directive, sourceObservationIds: Object.freeze([...observationIds]) }) as CreativeDirectiveV1
    : directive))
  return createCreativeDirectionDocument({
    durationTicks: document.durationTicks,
    tracks: document.tracks,
    directives,
    comments: document.comments,
    versions: document.versions,
  })
}
