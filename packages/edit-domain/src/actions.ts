export type PointTarget = {
  x: number
  y: number
  sourceTimeMs: number
}

export type AddNameplateAction = {
  schemaVersion: 'sanverse.action/v1'
  actionId: string
  kind: 'add-nameplate'
  target: PointTarget
  primaryText: string
  secondaryText: string
  startMs: number
  durationMs: number
}

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export type ActionValidationIssue = {
  readonly path: string
  readonly code: 'FIELD_REQUIRED' | 'FIELD_UNKNOWN' | 'TYPE_INVALID' | 'VALUE_OUT_OF_RANGE'
}

export type ActionValidationError = {
  readonly code: 'ACTION_INVALID'
  readonly issues: readonly ActionValidationIssue[]
}

const ACTION_KEYS = [
  'schemaVersion',
  'actionId',
  'kind',
  'target',
  'primaryText',
  'secondaryText',
  'startMs',
  'durationMs',
] as const
const TARGET_KEYS = ['x', 'y', 'sourceTimeMs'] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const checkExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  issues: ActionValidationIssue[],
) => {
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) issues.push({ path: `${path}${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) issues.push({ path: `${path}${key}`, code: 'FIELD_UNKNOWN' })
  }
}

const checkFiniteNumber = (
  value: unknown,
  path: string,
  predicate: (value: number) => boolean,
  issues: ActionValidationIssue[],
) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push({ path, code: 'TYPE_INVALID' })
  } else if (!predicate(value)) {
    issues.push({ path, code: 'VALUE_OUT_OF_RANGE' })
  }
}

const cloneAction = (action: AddNameplateAction): AddNameplateAction =>
  Object.freeze({
    schemaVersion: action.schemaVersion,
    actionId: action.actionId,
    kind: action.kind,
    target: Object.freeze({
      x: action.target.x,
      y: action.target.y,
      sourceTimeMs: action.target.sourceTimeMs,
    }),
    primaryText: action.primaryText,
    secondaryText: action.secondaryText,
    startMs: action.startMs,
    durationMs: action.durationMs,
  })

export const validateAddNameplateAction = (
  input: unknown,
): Result<AddNameplateAction, ActionValidationError> => {
  const issues: ActionValidationIssue[] = []
  if (!isRecord(input)) {
    return { ok: false, error: { code: 'ACTION_INVALID', issues: [{ path: '$', code: 'TYPE_INVALID' }] } }
  }

  checkExactKeys(input, ACTION_KEYS, '', issues)
  if (input.schemaVersion !== 'sanverse.action/v1') {
    issues.push({ path: 'schemaVersion', code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.actionId !== 'string') {
    issues.push({ path: 'actionId', code: 'TYPE_INVALID' })
  } else if (input.actionId.trim().length === 0) {
    issues.push({ path: 'actionId', code: 'VALUE_OUT_OF_RANGE' })
  }
  if (input.kind !== 'add-nameplate') issues.push({ path: 'kind', code: 'VALUE_OUT_OF_RANGE' })
  if (typeof input.primaryText !== 'string') {
    issues.push({ path: 'primaryText', code: 'TYPE_INVALID' })
  } else if (input.primaryText.trim().length === 0) {
    issues.push({ path: 'primaryText', code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.secondaryText !== 'string') {
    issues.push({ path: 'secondaryText', code: 'TYPE_INVALID' })
  }
  checkFiniteNumber(input.startMs, 'startMs', (value) => value >= 0, issues)
  checkFiniteNumber(input.durationMs, 'durationMs', (value) => value > 0, issues)

  if (!isRecord(input.target)) {
    issues.push({ path: 'target', code: 'TYPE_INVALID' })
  } else {
    checkExactKeys(input.target, TARGET_KEYS, 'target.', issues)
    checkFiniteNumber(input.target.x, 'target.x', (value) => value >= 0 && value <= 1, issues)
    checkFiniteNumber(input.target.y, 'target.y', (value) => value >= 0 && value <= 1, issues)
    checkFiniteNumber(input.target.sourceTimeMs, 'target.sourceTimeMs', (value) => value >= 0, issues)
  }

  if (issues.length > 0) return { ok: false, error: { code: 'ACTION_INVALID', issues } }
  return { ok: true, value: cloneAction(input as AddNameplateAction) }
}

export const proposeAddNameplate = (
  input: unknown,
): Result<AddNameplateAction, ActionValidationError> => validateAddNameplateAction(input)

export const copyAddNameplateAction = cloneAction
