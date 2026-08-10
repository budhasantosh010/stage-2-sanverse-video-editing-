import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import { ANALYSIS_PROVENANCE_KINDS } from './provenance.ts'
import { SEMANTIC_MOMENT_KINDS, SPATIAL_OBSERVATION_KINDS, TEMPORAL_VISUAL_REGION_KINDS, VIDEO_SHOT_TRANSITIONS } from './observations.ts'
import { VIDEO_UNDERSTANDING_SCHEMA_VERSION } from './document.ts'
import type { VideoUnderstandingDocumentV1 } from './document.ts'

export interface VideoUnderstandingValidationIssueV1 { readonly path: string; readonly code: 'TYPE_INVALID' | 'VALUE_INVALID' | 'DUPLICATE_ID' | 'TIME_INVALID' | 'REFERENCE_INVALID' | 'CONFLICT'; readonly message: string }
export type VideoUnderstandingValidationResultV1 = Readonly<{ ok: true; value: VideoUnderstandingDocumentV1 }> | Readonly<{ ok: false; issues: readonly VideoUnderstandingValidationIssueV1[] }>
const issue = (path: string, code: VideoUnderstandingValidationIssueV1['code'], message: string): VideoUnderstandingValidationIssueV1 => Object.freeze({ path, code, message })
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const id = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 180
const tick = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const confidence = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
const rangeValid = (value: Record<string, unknown>, duration: number): boolean => tick(value.startTicks) && tick(value.endTicks) && Number(value.startTicks) < Number(value.endTicks) && Number(value.endTicks) <= duration
const normalizedRectValid = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  const keys = ['x', 'y', 'width', 'height'] as const
  if (!keys.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]) && Number(value[key]) >= 0 && Number(value[key]) <= 1)) return false
  return Number(value.x) + Number(value.width) <= 1 && Number(value.y) + Number(value.height) <= 1
}
const pushDuplicate = (seen: Set<string>, value: unknown, path: string, issues: VideoUnderstandingValidationIssueV1[]) => { if (!id(value)) { issues.push(issue(path, 'VALUE_INVALID', 'id must be a bounded non-empty string.')); return }; if (seen.has(value)) issues.push(issue(path, 'DUPLICATE_ID', `duplicate id: ${value}`)); else seen.add(value) }

export const validateVideoUnderstanding = (input: unknown): VideoUnderstandingValidationResultV1 => {
  if (!isRecord(input)) return Object.freeze({ ok: false, issues: Object.freeze([issue('$', 'TYPE_INVALID', 'video understanding must be an object.')]) })
  const issues: VideoUnderstandingValidationIssueV1[] = []
  if (input.schemaVersion !== VIDEO_UNDERSTANDING_SCHEMA_VERSION) issues.push(issue('$.schemaVersion', 'VALUE_INVALID', 'unsupported video-understanding schema.'))
  if (!isRecord(input.source)) issues.push(issue('$.source', 'TYPE_INVALID', 'source must be an object.'))
  const source = isRecord(input.source) ? input.source : {}
  if (!id(source.sourceId)) issues.push(issue('$.source.sourceId', 'VALUE_INVALID', 'sourceId must be stable.'))
  if (!tick(source.durationTicks) || Number(source.durationTicks) <= 0) issues.push(issue('$.source.durationTicks', 'TIME_INVALID', 'durationTicks must be a positive exact tick count.'))
  if (!Number.isSafeInteger(source.width) || Number(source.width) <= 0 || !Number.isSafeInteger(source.height) || Number(source.height) <= 0) issues.push(issue('$.source', 'VALUE_INVALID', 'source width/height must be positive integers.'))
  if (!isRecord(source.frameRate) || !Number.isSafeInteger(source.frameRate.numerator) || Number(source.frameRate.numerator) <= 0 || !Number.isSafeInteger(source.frameRate.denominator) || Number(source.frameRate.denominator) <= 0) issues.push(issue('$.source.frameRate', 'VALUE_INVALID', 'frameRate must be a positive rational.'))
  const duration = tick(source.durationTicks) ? Number(source.durationTicks) : 0
  const provenanceIds = new Set<string>(), transcriptIds = new Set<string>(), allIds = new Set<string>()
  if (!Array.isArray(input.provenance)) issues.push(issue('$.provenance', 'TYPE_INVALID', 'provenance must be an array.')); else input.provenance.forEach((entry, index) => {
    const path = `$.provenance[${index}]`; if (!isRecord(entry)) { issues.push(issue(path, 'TYPE_INVALID', 'provenance entry must be object.')); return }
    pushDuplicate(provenanceIds, entry.id, `${path}.id`, issues); if (id(entry.id)) allIds.add(entry.id)
    if (!ANALYSIS_PROVENANCE_KINDS.includes(entry.kind as never)) issues.push(issue(`${path}.kind`, 'VALUE_INVALID', 'unknown provenance kind.'))
    if (!id(entry.analyzerId)) issues.push(issue(`${path}.analyzerId`, 'VALUE_INVALID', 'analyzerId must be stable.'))
  })
  const requireProvenance = (value: unknown, path: string) => { if (!id(value) || !provenanceIds.has(value)) issues.push(issue(path, 'REFERENCE_INVALID', `missing provenance reference: ${String(value)}`)) }
  if (!Array.isArray(input.transcript)) issues.push(issue('$.transcript', 'TYPE_INVALID', 'transcript must be an array.')); else input.transcript.forEach((entry, index) => {
    const path = `$.transcript[${index}]`; if (!isRecord(entry)) { issues.push(issue(path, 'TYPE_INVALID', 'transcript segment must be object.')); return }
    pushDuplicate(transcriptIds, entry.id, `${path}.id`, issues); if (id(entry.id)) allIds.add(entry.id)
    if (!rangeValid(entry, duration)) issues.push(issue(path, 'TIME_INVALID', 'transcript range must fit source duration.'))
    if (typeof entry.text !== 'string' || !entry.text.trim()) issues.push(issue(`${path}.text`, 'VALUE_INVALID', 'transcript text must be non-empty.'))
    requireProvenance(entry.provenance, `${path}.provenance`)
    if (entry.words !== undefined) {
      if (!Array.isArray(entry.words)) issues.push(issue(`${path}.words`, 'TYPE_INVALID', 'words must be an array.'))
      else { const wordIds = new Set<string>(); entry.words.forEach((word, wordIndex) => { const wordPath = `${path}.words[${wordIndex}]`; if (!isRecord(word)) { issues.push(issue(wordPath, 'TYPE_INVALID', 'word must be object.')); return }; pushDuplicate(wordIds, word.id, `${wordPath}.id`, issues); if (!rangeValid(word, duration) || Number(word.startTicks) < Number(entry.startTicks) || Number(word.endTicks) > Number(entry.endTicks)) issues.push(issue(wordPath, 'TIME_INVALID', 'word timing must fit segment/source.')); if (word.confidence !== undefined && !confidence(word.confidence)) issues.push(issue(`${wordPath}.confidence`, 'VALUE_INVALID', 'word confidence must be [0,1].')) }) }
    }
  })
  const validateTimed = (collection: unknown, path: string, allowedKinds: readonly string[], options: { confidenceRequired?: boolean; spatial?: boolean; transcriptRefs?: boolean; shot?: boolean } = {}) => {
    if (!Array.isArray(collection)) { issues.push(issue(path, 'TYPE_INVALID', `${path.slice(2)} must be an array.`)); return }
    const local = new Set<string>(); let previousEnd = -1
    collection.forEach((entry, index) => { const itemPath = `${path}[${index}]`; if (!isRecord(entry)) { issues.push(issue(itemPath, 'TYPE_INVALID', 'entry must be object.')); return }; pushDuplicate(local, entry.id, `${itemPath}.id`, issues); if (id(entry.id)) { if (allIds.has(entry.id)) issues.push(issue(`${itemPath}.id`, 'DUPLICATE_ID', `duplicate document id: ${entry.id}`)); allIds.add(entry.id) }; if (!rangeValid(entry, duration)) issues.push(issue(itemPath, 'TIME_INVALID', 'range must fit source duration.')); if (!allowedKinds.includes(String(entry.kind ?? entry.transitionIn))) issues.push(issue(`${itemPath}.${options.shot ? 'transitionIn' : 'kind'}`, 'VALUE_INVALID', 'unknown closed enum value.')); if ((options.confidenceRequired || entry.confidence !== undefined) && !confidence(entry.confidence)) issues.push(issue(`${itemPath}.confidence`, 'VALUE_INVALID', 'confidence must be finite [0,1].')); requireProvenance(entry.provenance, `${itemPath}.provenance`); if (options.shot && tick(entry.startTicks) && Number(entry.startTicks) < previousEnd) issues.push(issue(itemPath, 'CONFLICT', 'shots may have gaps but must not overlap.')); if (options.shot && tick(entry.endTicks)) previousEnd = Number(entry.endTicks); if (options.spatial && !normalizedRectValid(entry.bounds)) issues.push(issue(`${itemPath}.bounds`, 'VALUE_INVALID', 'normalized bounds must stay inside 0..1 source space.')); if (options.transcriptRefs) { if (!Array.isArray(entry.transcriptSegmentIds) || entry.transcriptSegmentIds.some((ref) => !transcriptIds.has(String(ref)))) issues.push(issue(`${itemPath}.transcriptSegmentIds`, 'REFERENCE_INVALID', 'semantic moment references missing transcript segment.')) } })
  }
  validateTimed(input.shots, '$.shots', VIDEO_SHOT_TRANSITIONS, { shot: true })
  validateTimed(input.visualRegions, '$.visualRegions', TEMPORAL_VISUAL_REGION_KINDS, { confidenceRequired: true })
  validateTimed(input.spatialObservations, '$.spatialObservations', SPATIAL_OBSERVATION_KINDS, { confidenceRequired: true, spatial: true })
  validateTimed(input.semanticMoments, '$.semanticMoments', SEMANTIC_MOMENT_KINDS, { confidenceRequired: true, transcriptRefs: true })
  validateTimed(input.observations, '$.observations', ['audio-present','speech-present','silence','source-note'], { confidenceRequired: true })
  void PROJECT_TIMESCALE // imported authority is intentionally shared with the edit domain; no local timescale constant exists here.
  return issues.length ? Object.freeze({ ok: false, issues: Object.freeze(issues) }) : Object.freeze({ ok: true, value: input as unknown as VideoUnderstandingDocumentV1 })
}
