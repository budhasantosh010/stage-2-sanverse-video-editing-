import { err, isRecord, ok, type Result } from './result.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { validateOperation, type EditOperation, type OperationError } from './operations.ts'

/**
 * One user request becomes one change set.
 *
 * "Tighten my intro" might be five operations, but the user approved one
 * thing, so one Undo must reverse all five. Undoing a third of an approved
 * request would leave the project in a state nobody ever saw or agreed to.
 */
export type ChangeSetSource = 'direct' | 'ai' | 'migration'

export type ChangeSetProvenance = Readonly<{
  source: ChangeSetSource
  /** Ties an AI-proposed change back to the request that produced it. */
  requestId: string | null
}>

export type ChangeSet = Readonly<{
  schemaVersion: 'sanverse.change-set/v1'
  changeSetId: string
  /**
   * The project revision this change set was built against. Accept fails when
   * it no longer matches, so an answer computed against an older project can
   * never be applied to a newer one.
   */
  baseRevision: number
  operations: readonly EditOperation[]
  provenance: ChangeSetProvenance
  extensions: Extensions
}>

/** How the project records a change set it has accepted. */
export type ChangeSetRecord = Readonly<{
  changeSet: ChangeSet
  /** False when the user switched this change set off without deleting it. */
  active: boolean
  /**
   * Set when this change set can no longer be applied — for example its clip
   * was removed. A blocked change set is shown to the user and never silently
   * altered to make it fit.
   */
  blockedReason: string | null
}>

export const CHANGE_SET_ID_PATTERN = /^changeset_[a-z0-9]{8,64}$/
export const MAX_OPERATIONS_PER_CHANGE_SET = 64

export type ChangeSetIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'TOO_MANY_OPERATIONS'
  | 'DUPLICATE_OPERATION_ID'

export type ChangeSetError = {
  readonly code: 'CHANGE_SET_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: ChangeSetIssueCode | 'OPERATION_INVALID' }[]
}

const CHANGE_SET_KEYS = [
  'schemaVersion',
  'changeSetId',
  'baseRevision',
  'operations',
  'provenance',
  'extensions',
] as const
const PROVENANCE_KEYS = ['source', 'requestId'] as const
const SOURCES: readonly ChangeSetSource[] = ['direct', 'ai', 'migration']

export const validateChangeSet = (input: unknown, path = '$'): Result<ChangeSet, ChangeSetError> => {
  type Issue = ChangeSetError['issues'][number]
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'CHANGE_SET_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  for (const key of CHANGE_SET_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(CHANGE_SET_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }
  if (input.schemaVersion !== 'sanverse.change-set/v1') {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.changeSetId !== 'string' || !CHANGE_SET_ID_PATTERN.test(input.changeSetId)) {
    issues.push({ path: `${path}.changeSetId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!Number.isSafeInteger(input.baseRevision) || (input.baseRevision as number) < 0) {
    issues.push({ path: `${path}.baseRevision`, code: 'VALUE_OUT_OF_RANGE' })
  }

  let provenance: ChangeSetProvenance | null = null
  if (!isRecord(input.provenance)) {
    issues.push({ path: `${path}.provenance`, code: 'TYPE_INVALID' })
  } else {
    for (const key of PROVENANCE_KEYS) {
      if (!Object.hasOwn(input.provenance, key)) {
        issues.push({ path: `${path}.provenance.${key}`, code: 'FIELD_REQUIRED' })
      }
    }
    for (const key of Object.keys(input.provenance)) {
      if (!(PROVENANCE_KEYS as readonly string[]).includes(key)) {
        issues.push({ path: `${path}.provenance.${key}`, code: 'FIELD_UNKNOWN' })
      }
    }
    const source = input.provenance.source
    const requestId = input.provenance.requestId
    const sourceValid = SOURCES.includes(source as ChangeSetSource)
    const requestIdValid = requestId === null || (typeof requestId === 'string' && requestId.length > 0 && requestId.length <= 128)
    if (!sourceValid) issues.push({ path: `${path}.provenance.source`, code: 'VALUE_OUT_OF_RANGE' })
    if (!requestIdValid) issues.push({ path: `${path}.provenance.requestId`, code: 'VALUE_OUT_OF_RANGE' })
    if (sourceValid && requestIdValid) {
      provenance = Object.freeze({
        source: source as ChangeSetSource,
        requestId: (requestId ?? null) as string | null,
      })
    }
  }

  const operations: EditOperation[] = []
  if (!Array.isArray(input.operations)) {
    issues.push({ path: `${path}.operations`, code: 'TYPE_INVALID' })
  } else if (input.operations.length === 0) {
    issues.push({ path: `${path}.operations`, code: 'VALUE_OUT_OF_RANGE' })
  } else if (input.operations.length > MAX_OPERATIONS_PER_CHANGE_SET) {
    issues.push({ path: `${path}.operations`, code: 'TOO_MANY_OPERATIONS' })
  } else {
    const seen = new Set<string>()
    input.operations.forEach((rawOperation, index) => {
      const operationPath = `${path}.operations[${index}]`
      const operation = validateOperation(rawOperation, operationPath)
      if (!operation.ok) {
        issues.push({ path: operationPath, code: 'OPERATION_INVALID' })
        return
      }
      if (seen.has(operation.value.operationId)) {
        issues.push({ path: `${operationPath}.operationId`, code: 'DUPLICATE_OPERATION_ID' })
        return
      }
      seen.add(operation.value.operationId)
      operations.push(operation.value)
    })
  }

  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) issues.push({ path: `${path}.extensions`, code: 'VALUE_OUT_OF_RANGE' })

  if (issues.length > 0 || !provenance) {
    return err({ code: 'CHANGE_SET_INVALID', issues: issues.length > 0 ? issues : [{ path, code: 'TYPE_INVALID' }] })
  }

  return ok(Object.freeze({
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: input.changeSetId as string,
    baseRevision: input.baseRevision as number,
    operations: Object.freeze(operations),
    provenance,
    extensions: extensions.ok ? extensions.value : emptyExtensions(),
  }))
}

export type { OperationError }
