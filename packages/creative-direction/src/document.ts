import { MAX_PROJECT_TICKS, PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import type { CreativeCommentV1 } from './comments.ts'
import { convertCreativeDirectiveKind } from './directives.ts'
import type { CreativeDirectiveKindV1, CreativeDirectiveV1 } from './directives.ts'
import { createDefaultCreativeDirectionTracks } from './tracks.ts'
import type { CreativeDirectionTrackV1 } from './tracks.ts'
import type { CreativeDirectionVersionV1 } from './versions.ts'
import { validateCreativeDirectionDocument } from './validation-directives.ts'
import type { CreativeValidationIssueV1 } from './validation-shared.ts'

export const CREATIVE_DIRECTION_SCHEMA_VERSION = 'sanverse.creative-direction/v1' as const
export const CREATIVE_DIRECTION_TICKS_PER_SECOND = PROJECT_TIMESCALE

export interface CreativeDirectionDocumentV1 {
  readonly schemaVersion: typeof CREATIVE_DIRECTION_SCHEMA_VERSION
  readonly durationTicks: number
  readonly tracks: readonly CreativeDirectionTrackV1[]
  readonly directives: readonly CreativeDirectiveV1[]
  readonly comments: readonly CreativeCommentV1[]
  readonly versions: readonly CreativeDirectionVersionV1[]
}

export const createCreativeDirectionDocument = (input: Readonly<{
  durationTicks: number
  tracks?: readonly CreativeDirectionTrackV1[]
  directives?: readonly CreativeDirectiveV1[]
  comments?: readonly CreativeCommentV1[]
  versions?: readonly CreativeDirectionVersionV1[]
}>): CreativeDirectionDocumentV1 => {
  if (!Number.isSafeInteger(input.durationTicks) || input.durationTicks <= 0 || input.durationTicks > MAX_PROJECT_TICKS) throw new RangeError(`durationTicks must be a positive exact project tick count <= ${MAX_PROJECT_TICKS}.`)
  const document: CreativeDirectionDocumentV1 = Object.freeze({
    schemaVersion: CREATIVE_DIRECTION_SCHEMA_VERSION,
    durationTicks: input.durationTicks,
    tracks: Object.freeze([...(input.tracks ?? createDefaultCreativeDirectionTracks())]),
    directives: Object.freeze([...(input.directives ?? [])]),
    comments: Object.freeze([...(input.comments ?? [])]),
    versions: Object.freeze([...(input.versions ?? [])]),
  })
  const validation = validateCreativeDirectionDocument(document)
  if (!validation.ok) throw new RangeError(validation.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'))
  return validation.value
}

export type CreativeDirectionOperationV1 =
  | Readonly<{ operationId: string; type: 'add-directive'; directive: CreativeDirectiveV1 }>
  | Readonly<{ operationId: string; type: 'remove-directive'; directiveId: string }>
  | Readonly<{ operationId: string; type: 'move-directive'; directiveId: string; deltaTicks: number }>
  | Readonly<{ operationId: string; type: 'resize-directive'; directiveId: string; edge: 'start' | 'end'; tick: number }>
  | Readonly<{ operationId: string; type: 'duplicate-directive'; directiveId: string; duplicateId: string; offsetTicks: number }>
  | Readonly<{ operationId: string; type: 'change-directive-kind'; directiveId: string; kind: CreativeDirectiveKindV1 }>
  | Readonly<{ operationId: string; type: 'replace-directive'; directiveId: string; directive: CreativeDirectiveV1 }>

export type CreativeDirectionOperationErrorCodeV1 = 'OPERATION_INVALID' | 'DIRECTIVE_NOT_FOUND' | 'DUPLICATE_ID' | 'RESULT_INVALID'

export interface CreativeDirectionOperationErrorV1 {
  readonly code: CreativeDirectionOperationErrorCodeV1
  readonly operationId: string
  readonly message: string
  readonly issues?: readonly CreativeValidationIssueV1[]
}

export type CreativeDirectionOperationResultV1 =
  | Readonly<{ ok: true; document: CreativeDirectionDocumentV1; affectedDirectiveIds: readonly string[] }>
  | Readonly<{ ok: false; error: CreativeDirectionOperationErrorV1 }>

const operationFailure = (operationId: string, code: CreativeDirectionOperationErrorCodeV1, message: string, issues?: readonly CreativeValidationIssueV1[]): CreativeDirectionOperationResultV1 => Object.freeze({ ok: false, error: Object.freeze({ code, operationId, message, ...(issues ? { issues: Object.freeze(issues) } : {}) }) })

const withDirectives = (document: CreativeDirectionDocumentV1, directives: readonly CreativeDirectiveV1[], comments = document.comments): CreativeDirectionOperationResultV1 => {
  const candidate: CreativeDirectionDocumentV1 = Object.freeze({ ...document, directives: Object.freeze([...directives]), comments: Object.freeze([...comments]) })
  const validation = validateCreativeDirectionDocument(candidate)
  return validation.ok
    ? Object.freeze({ ok: true, document: validation.value, affectedDirectiveIds: Object.freeze([]) })
    : operationFailure('candidate', 'RESULT_INVALID', 'Creative Direction operation would create an invalid document.', validation.issues)
}

const exactInteger = (value: number): boolean => Number.isSafeInteger(value)
const replaceAt = (values: readonly CreativeDirectiveV1[], index: number, value: CreativeDirectiveV1): readonly CreativeDirectiveV1[] => Object.freeze(values.map((entry, current) => current === index ? value : entry))

export const applyCreativeDirectionOperation = (document: CreativeDirectionDocumentV1, operation: CreativeDirectionOperationV1): CreativeDirectionOperationResultV1 => {
  const sourceValidation = validateCreativeDirectionDocument(document)
  if (!sourceValidation.ok) return operationFailure(operation.operationId, 'RESULT_INVALID', 'Source Creative Direction document is invalid.', sourceValidation.issues)
  if (!operation.operationId.trim()) return operationFailure(operation.operationId, 'OPERATION_INVALID', 'operationId must be non-empty.')
  const index = 'directiveId' in operation ? document.directives.findIndex((directive) => directive.id === operation.directiveId) : -1
  if ('directiveId' in operation && index < 0) return operationFailure(operation.operationId, 'DIRECTIVE_NOT_FOUND', `Missing directive ${operation.directiveId}.`)

  let nextDirectives: readonly CreativeDirectiveV1[] = document.directives
  let nextComments = document.comments
  let affected: readonly string[] = Object.freeze([])

  if (operation.type === 'add-directive') {
    if (document.directives.some((directive) => directive.id === operation.directive.id)) return operationFailure(operation.operationId, 'DUPLICATE_ID', `Directive ${operation.directive.id} already exists.`)
    nextDirectives = Object.freeze([...document.directives, operation.directive])
    affected = Object.freeze([operation.directive.id])
  } else if (operation.type === 'remove-directive') {
    nextDirectives = Object.freeze(document.directives.filter((directive) => directive.id !== operation.directiveId))
    nextComments = Object.freeze(document.comments.filter((comment) => !(comment.target.kind === 'directive' && comment.target.directiveId === operation.directiveId)))
    affected = Object.freeze([operation.directiveId])
  } else if (operation.type === 'move-directive') {
    if (!exactInteger(operation.deltaTicks)) return operationFailure(operation.operationId, 'OPERATION_INVALID', 'deltaTicks must be an exact safe integer.')
    const source = document.directives[index]!
    const moved = Object.freeze({ ...source, startTicks: source.startTicks + operation.deltaTicks, endTicks: source.endTicks + operation.deltaTicks }) as CreativeDirectiveV1
    nextDirectives = replaceAt(document.directives, index, moved)
    affected = Object.freeze([source.id])
  } else if (operation.type === 'resize-directive') {
    if (!exactInteger(operation.tick)) return operationFailure(operation.operationId, 'OPERATION_INVALID', 'resize tick must be an exact safe integer.')
    const source = document.directives[index]!
    const resized = Object.freeze({ ...source, ...(operation.edge === 'start' ? { startTicks: operation.tick } : { endTicks: operation.tick }) }) as CreativeDirectiveV1
    nextDirectives = replaceAt(document.directives, index, resized)
    affected = Object.freeze([source.id])
  } else if (operation.type === 'duplicate-directive') {
    if (!operation.duplicateId.trim() || !exactInteger(operation.offsetTicks)) return operationFailure(operation.operationId, 'OPERATION_INVALID', 'duplicate needs a stable ID and exact offsetTicks.')
    if (document.directives.some((directive) => directive.id === operation.duplicateId)) return operationFailure(operation.operationId, 'DUPLICATE_ID', `Directive ${operation.duplicateId} already exists.`)
    const source = document.directives[index]!
    const duplicate = Object.freeze({ ...source, id: operation.duplicateId, startTicks: source.startTicks + operation.offsetTicks, endTicks: source.endTicks + operation.offsetTicks }) as CreativeDirectiveV1
    nextDirectives = Object.freeze([...document.directives.slice(0, index + 1), duplicate, ...document.directives.slice(index + 1)])
    affected = Object.freeze([source.id, duplicate.id])
  } else if (operation.type === 'change-directive-kind') {
    const source = document.directives[index]!
    const changed = convertCreativeDirectiveKind(source, operation.kind)
    nextDirectives = replaceAt(document.directives, index, changed)
    affected = Object.freeze([source.id])
  } else if (operation.type === 'replace-directive') {
    if (operation.directive.id !== operation.directiveId) return operationFailure(operation.operationId, 'OPERATION_INVALID', 'replace-directive must preserve stable directive identity.')
    nextDirectives = replaceAt(document.directives, index, operation.directive)
    affected = Object.freeze([operation.directiveId])
  }

  const result = withDirectives(document, nextDirectives, nextComments)
  if (!result.ok) return Object.freeze({ ok: false, error: Object.freeze({ ...result.error, operationId: operation.operationId }) })
  return Object.freeze({ ok: true, document: result.document, affectedDirectiveIds: affected })
}

export const creativeSecondsToTicks = (seconds: number): number => {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('seconds must be finite and non-negative.')
  const ticks = seconds * PROJECT_TIMESCALE
  if (!Number.isSafeInteger(ticks)) throw new RangeError('seconds must map exactly to project ticks.')
  return ticks
}

export const creativeTicksToSeconds = (ticks: number): number => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) throw new RangeError('ticks must be a non-negative safe integer.')
  return ticks / PROJECT_TIMESCALE
}
