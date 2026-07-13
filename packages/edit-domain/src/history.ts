import {
  copyAddNameplateAction,
  validateAddNameplateAction,
  type ActionValidationError,
  type AddNameplateAction,
  type Result,
} from './actions.ts'

export type EditHistory = {
  readonly accepted: readonly AddNameplateAction[]
  readonly redoStack: readonly AddNameplateAction[]
  readonly issuedActionIds: readonly string[]
}

export type HistoryValidationError = {
  readonly code: 'HISTORY_INVALID'
  readonly issues: readonly {
    readonly path: string
    readonly code:
      | 'FIELD_REQUIRED'
      | 'FIELD_UNKNOWN'
      | 'TYPE_INVALID'
      | 'ACTION_INVALID'
      | 'DUPLICATE_ACTION_ID'
      | 'ACTION_ID_NOT_ISSUED'
  }[]
}

export type HistoryError =
  | ActionValidationError
  | HistoryValidationError
  | { readonly code: 'DUPLICATE_ACTION_ID'; readonly actionId: string }
  | { readonly code: 'NOTHING_TO_UNDO' }
  | { readonly code: 'NOTHING_TO_REDO' }

const copyHistory = (
  accepted: readonly AddNameplateAction[],
  redoStack: readonly AddNameplateAction[],
  issuedActionIds: readonly string[],
): EditHistory =>
  Object.freeze({
    accepted: Object.freeze(accepted.map(copyAddNameplateAction)),
    redoStack: Object.freeze(redoStack.map(copyAddNameplateAction)),
    issuedActionIds: Object.freeze([...issuedActionIds]),
  })

export const createHistory = (): EditHistory => copyHistory([], [], [])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const validateHistory = (input: unknown): Result<EditHistory, HistoryValidationError> => {
  type Issue = HistoryValidationError['issues'][number]
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return { ok: false, error: { code: 'HISTORY_INVALID', issues: [{ path: '$', code: 'TYPE_INVALID' }] } }
  }

  const keys = ['accepted', 'redoStack', 'issuedActionIds'] as const
  for (const key of keys) {
    if (!Object.hasOwn(input, key)) issues.push({ path: key, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!keys.includes(key as (typeof keys)[number])) issues.push({ path: key, code: 'FIELD_UNKNOWN' })
  }

  const accepted = Array.isArray(input.accepted) ? input.accepted : []
  const redoStack = Array.isArray(input.redoStack) ? input.redoStack : []
  const issuedActionIds = Array.isArray(input.issuedActionIds) ? input.issuedActionIds : []
  if (!Array.isArray(input.accepted)) issues.push({ path: 'accepted', code: 'TYPE_INVALID' })
  if (!Array.isArray(input.redoStack)) issues.push({ path: 'redoStack', code: 'TYPE_INVALID' })
  if (!Array.isArray(input.issuedActionIds)) issues.push({ path: 'issuedActionIds', code: 'TYPE_INVALID' })

  const validatedActions: AddNameplateAction[] = []
  const activeIds = new Set<string>()
  for (const [collectionName, collection] of [
    ['accepted', accepted],
    ['redoStack', redoStack],
  ] as const) {
    collection.forEach((candidate, index) => {
      const validated = validateAddNameplateAction(candidate)
      if (!validated.ok) {
        issues.push({ path: `${collectionName}.${index}`, code: 'ACTION_INVALID' })
        return
      }
      if (activeIds.has(validated.value.actionId)) {
        issues.push({ path: `${collectionName}.${index}.actionId`, code: 'DUPLICATE_ACTION_ID' })
      } else {
        activeIds.add(validated.value.actionId)
      }
      validatedActions.push(validated.value)
    })
  }

  const issuedIds = new Set<string>()
  issuedActionIds.forEach((candidate, index) => {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      issues.push({ path: `issuedActionIds.${index}`, code: 'TYPE_INVALID' })
    } else if (issuedIds.has(candidate)) {
      issues.push({ path: `issuedActionIds.${index}`, code: 'DUPLICATE_ACTION_ID' })
    } else {
      issuedIds.add(candidate)
    }
  })
  for (const actionId of activeIds) {
    if (!issuedIds.has(actionId)) {
      issues.push({ path: 'issuedActionIds', code: 'ACTION_ID_NOT_ISSUED' })
    }
  }

  if (issues.length > 0) return { ok: false, error: { code: 'HISTORY_INVALID', issues } }
  return {
    ok: true,
    value: copyHistory(
      validatedActions.slice(0, accepted.length),
      validatedActions.slice(accepted.length),
      issuedActionIds as string[],
    ),
  }
}

export const accept = (
  history: EditHistory,
  proposal: unknown,
): Result<EditHistory, HistoryError> => {
  const current = validateHistory(history)
  if (!current.ok) return current
  const validated = validateAddNameplateAction(proposal)
  if (!validated.ok) return validated
  const actionId = validated.value.actionId
  if (current.value.issuedActionIds.includes(actionId)) {
    return { ok: false, error: { code: 'DUPLICATE_ACTION_ID', actionId } }
  }
  return {
    ok: true,
    value: copyHistory(
      [...current.value.accepted, validated.value],
      [],
      [...current.value.issuedActionIds, actionId],
    ),
  }
}

export const undo = (history: EditHistory): Result<EditHistory, HistoryError> => {
  const current = validateHistory(history)
  if (!current.ok) return current
  const action = current.value.accepted.at(-1)
  if (!action) return { ok: false, error: { code: 'NOTHING_TO_UNDO' } }
  return {
    ok: true,
    value: copyHistory(
      current.value.accepted.slice(0, -1),
      [...current.value.redoStack, action],
      current.value.issuedActionIds,
    ),
  }
}

export const redo = (history: EditHistory): Result<EditHistory, HistoryError> => {
  const current = validateHistory(history)
  if (!current.ok) return current
  const action = current.value.redoStack.at(-1)
  if (!action) return { ok: false, error: { code: 'NOTHING_TO_REDO' } }
  return {
    ok: true,
    value: copyHistory(
      [...current.value.accepted, action],
      current.value.redoStack.slice(0, -1),
      current.value.issuedActionIds,
    ),
  }
}
