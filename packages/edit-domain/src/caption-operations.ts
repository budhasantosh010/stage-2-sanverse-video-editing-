import { err, isRecord, ok, type Result } from './result.ts'
import { capabilityProduces } from './capabilities.ts'
import { validateTimeRange, type TimeRange } from './time.ts'
import { OPERATION_SCHEMA_VERSION } from './timeline-operations.ts'

/**
 * Captions as edits.
 *
 * A caption is a DECISION — this text, on screen, at this moment — so it lives
 * in the project and is undoable, exactly like a nameplate. The transcript it
 * was cut from does not (see `transcript.ts` for why).
 *
 * Every cue's timing is on the ORIGINAL footage's clock, never the finished
 * video's (ADR-005). That is what makes captions survive cutting: remove four
 * seconds from the front and every caption moves with the words it belongs to,
 * without anyone recomputing anything.
 *
 *   ┌ add-captions ─────────────────────────────────────────────┐
 *   │ one operation, N cues, ONE Undo                            │
 *   │ "put captions on my video" is one thought, so it is one    │
 *   │ entry in history — not 150 of them                         │
 *   └────────────────────────────────────────────────────────────┘
 *              │
 *              ├─ set-caption-cue     fix one line's words or timing
 *              ├─ remove-caption-cue  delete one line
 *              └─ set-caption-style   change how they all look
 *
 * The three later operations name the set they act on, and are folded over it
 * in history order by `foldCaptionOperations`. This is why fixing a typo is one
 * small entry in history rather than a rewrite of all 150 cues.
 */

export const CAPTION_SET_ID_PATTERN = /^captions_[a-z0-9]{8,64}$/
export const CAPTION_CUE_ID_PATTERN = /^cue_[a-z0-9]{4,64}$/

export const MAX_CAPTION_CUES = 1_000
export const MAX_CAPTION_LINES = 3
/**
 * A hard ceiling, not a style rule. Segmentation aims at 42 characters; this
 * only stops something absurd reaching the renderer, which is where v1's
 * equivalent mistake was caught far too late.
 */
export const MAX_CAPTION_LINE_LENGTH = 120

/**
 * The looks a caption may have. The domain owns WHICH CHOICES EXIST; the
 * renderer owns what each one looks like. Splitting it this way means a new
 * look is a renderer change, while an operation naming a look that does not
 * exist is refused here, before anything is drawn.
 */
export const CAPTION_STYLE_IDS = Object.freeze([
  'sanverse.caption.plain/v1',
  'sanverse.caption.boxed/v1',
] as const)

export type CaptionStyleId = (typeof CAPTION_STYLE_IDS)[number]
export const DEFAULT_CAPTION_STYLE_ID: CaptionStyleId = 'sanverse.caption.boxed/v1'

export type CaptionCue = Readonly<{
  cueId: string
  /** When it is on screen, on the footage's own clock. */
  sourceInterval: TimeRange
  lines: readonly string[]
}>

export type AddCaptionsOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'add-captions'
  capabilityId: string
  captionSetId: string
  /** The footage every cue in this set is anchored to. */
  assetId: string
  styleId: CaptionStyleId
  cues: readonly CaptionCue[]
}>

/** Replace one cue outright. Both fields are always carried, never patched. */
export type SetCaptionCueOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'set-caption-cue'
  capabilityId: string
  captionSetId: string
  cueId: string
  sourceInterval: TimeRange
  lines: readonly string[]
}>

export type RemoveCaptionCueOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'remove-caption-cue'
  capabilityId: string
  captionSetId: string
  cueId: string
}>

export type SetCaptionStyleOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'set-caption-style'
  capabilityId: string
  captionSetId: string
  styleId: CaptionStyleId
}>

export type CaptionOperation =
  | AddCaptionsOperation
  | SetCaptionCueOperation
  | RemoveCaptionCueOperation
  | SetCaptionStyleOperation

export const CAPTION_OPERATION_KINDS: readonly string[] = Object.freeze([
  'add-captions',
  'set-caption-cue',
  'remove-caption-cue',
  'set-caption-style',
])

export const isCaptionOperationKind = (kind: string): boolean => CAPTION_OPERATION_KINDS.includes(kind)

export type CaptionIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'CAPABILITY_UNKNOWN'
  | 'TEXT_TOO_LONG'
  | 'TOO_MANY_CUES'
  | 'DUPLICATE_CUE_ID'
  | 'CUES_OVERLAP'
  | 'CUES_EMPTY'

export type CaptionOperationError = {
  readonly code: 'OPERATION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: CaptionIssueCode }[]
}

type Issue = CaptionOperationError['issues'][number]

const ADD_KEYS = [
  'schemaVersion', 'operationId', 'kind', 'capabilityId',
  'captionSetId', 'assetId', 'styleId', 'cues',
] as const
const SET_CUE_KEYS = [
  'schemaVersion', 'operationId', 'kind', 'capabilityId',
  'captionSetId', 'cueId', 'sourceInterval', 'lines',
] as const
const REMOVE_CUE_KEYS = [
  'schemaVersion', 'operationId', 'kind', 'capabilityId', 'captionSetId', 'cueId',
] as const
const SET_STYLE_KEYS = [
  'schemaVersion', 'operationId', 'kind', 'capabilityId', 'captionSetId', 'styleId',
] as const

const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/

const endTicks = (range: TimeRange): number => range.start.ticks + range.duration.ticks

const checkKeys = (
  input: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  issues: Issue[],
): void => {
  for (const key of keys) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  }
}

const checkCommon = (
  input: Record<string, unknown>,
  kind: string,
  path: string,
  issues: Issue[],
): void => {
  if (input.schemaVersion !== OPERATION_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) {
    issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.capabilityId !== 'string' || !capabilityProduces(input.capabilityId, kind)) {
    issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  }
  if (typeof input.captionSetId !== 'string' || !CAPTION_SET_ID_PATTERN.test(input.captionSetId)) {
    issues.push({ path: `${path}.captionSetId`, code: 'VALUE_OUT_OF_RANGE' })
  }
}

/** Lines are validated identically wherever they appear, so they cannot drift. */
const validateLines = (input: unknown, path: string, issues: Issue[]): readonly string[] | null => {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_CAPTION_LINES) {
    issues.push({ path, code: 'VALUE_OUT_OF_RANGE' })
    return null
  }
  const lines: string[] = []
  input.forEach((line, index) => {
    if (typeof line !== 'string' || line.trim().length === 0) {
      issues.push({ path: `${path}[${index}]`, code: 'VALUE_OUT_OF_RANGE' })
      return
    }
    if ([...line].length > MAX_CAPTION_LINE_LENGTH) {
      issues.push({ path: `${path}[${index}]`, code: 'TEXT_TOO_LONG' })
      return
    }
    // A newline inside a line would make one line silently become two on
    // screen, so it is refused rather than converted.
    if (/[\r\n]/.test(line)) {
      issues.push({ path: `${path}[${index}]`, code: 'VALUE_OUT_OF_RANGE' })
      return
    }
    lines.push(line)
  })
  return lines.length === input.length ? Object.freeze(lines) : null
}

const validateStyleId = (input: unknown, path: string, issues: Issue[]): CaptionStyleId | null => {
  if (typeof input !== 'string' || !(CAPTION_STYLE_IDS as readonly string[]).includes(input)) {
    issues.push({ path, code: 'VALUE_OUT_OF_RANGE' })
    return null
  }
  return input as CaptionStyleId
}

const validateCue = (input: unknown, path: string, issues: Issue[]): CaptionCue | null => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  checkKeys(input, ['cueId', 'sourceInterval', 'lines'], path, issues)
  if (typeof input.cueId !== 'string' || !CAPTION_CUE_ID_PATTERN.test(input.cueId)) {
    issues.push({ path: `${path}.cueId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  const lines = validateLines(input.lines, `${path}.lines`, issues)
  const interval = validateTimeRange(input.sourceInterval, `${path}.sourceInterval`)
  if (!interval.ok) issues.push({ path: `${path}.sourceInterval`, code: 'VALUE_OUT_OF_RANGE' })
  if (!lines || !interval.ok || typeof input.cueId !== 'string') return null
  return Object.freeze({ cueId: input.cueId, sourceInterval: interval.value, lines })
}

const validateAddCaptions = (
  input: Record<string, unknown>,
  path: string,
): Result<AddCaptionsOperation, CaptionOperationError> => {
  const issues: Issue[] = []
  checkKeys(input, ADD_KEYS, path, issues)
  checkCommon(input, 'add-captions', path, issues)

  if (typeof input.assetId !== 'string' || input.assetId.trim().length === 0) {
    issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  const styleId = validateStyleId(input.styleId, `${path}.styleId`, issues)

  if (!Array.isArray(input.cues)) {
    issues.push({ path: `${path}.cues`, code: 'TYPE_INVALID' })
    return err({ code: 'OPERATION_INVALID', issues })
  }
  if (input.cues.length === 0) {
    // An empty set is a no-op that still occupies a history entry and looks to
    // the user like captions were added. Refused instead.
    issues.push({ path: `${path}.cues`, code: 'CUES_EMPTY' })
  }
  if (input.cues.length > MAX_CAPTION_CUES) {
    issues.push({ path: `${path}.cues`, code: 'TOO_MANY_CUES' })
    return err({ code: 'OPERATION_INVALID', issues })
  }

  const cues: CaptionCue[] = []
  const seen = new Set<string>()
  input.cues.forEach((raw, index) => {
    const cue = validateCue(raw, `${path}.cues[${index}]`, issues)
    if (!cue) return
    if (seen.has(cue.cueId)) issues.push({ path: `${path}.cues[${index}].cueId`, code: 'DUPLICATE_CUE_ID' })
    seen.add(cue.cueId)
    cues.push(cue)
  })

  // Two captions on screen at once has no defined appearance, so it is caught
  // here rather than discovered as overlapping text in an exported file.
  const sorted = [...cues].sort((a, b) => a.sourceInterval.start.ticks - b.sourceInterval.start.ticks)
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].sourceInterval.start.ticks < endTicks(sorted[index - 1].sourceInterval)) {
      issues.push({ path: `${path}.cues`, code: 'CUES_OVERLAP' })
      break
    }
  }

  if (issues.length > 0 || !styleId) return err({ code: 'OPERATION_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind: 'add-captions' as const,
    capabilityId: input.capabilityId as string,
    captionSetId: input.captionSetId as string,
    assetId: input.assetId as string,
    styleId,
    cues: Object.freeze(cues),
  }))
}

const validateSetCaptionCue = (
  input: Record<string, unknown>,
  path: string,
): Result<SetCaptionCueOperation, CaptionOperationError> => {
  const issues: Issue[] = []
  checkKeys(input, SET_CUE_KEYS, path, issues)
  checkCommon(input, 'set-caption-cue', path, issues)
  if (typeof input.cueId !== 'string' || !CAPTION_CUE_ID_PATTERN.test(input.cueId)) {
    issues.push({ path: `${path}.cueId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  const lines = validateLines(input.lines, `${path}.lines`, issues)
  const interval = validateTimeRange(input.sourceInterval, `${path}.sourceInterval`)
  if (!interval.ok) issues.push({ path: `${path}.sourceInterval`, code: 'VALUE_OUT_OF_RANGE' })

  if (issues.length > 0 || !lines || !interval.ok) return err({ code: 'OPERATION_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind: 'set-caption-cue' as const,
    capabilityId: input.capabilityId as string,
    captionSetId: input.captionSetId as string,
    cueId: input.cueId as string,
    sourceInterval: interval.value,
    lines,
  }))
}

const validateRemoveCaptionCue = (
  input: Record<string, unknown>,
  path: string,
): Result<RemoveCaptionCueOperation, CaptionOperationError> => {
  const issues: Issue[] = []
  checkKeys(input, REMOVE_CUE_KEYS, path, issues)
  checkCommon(input, 'remove-caption-cue', path, issues)
  if (typeof input.cueId !== 'string' || !CAPTION_CUE_ID_PATTERN.test(input.cueId)) {
    issues.push({ path: `${path}.cueId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })
  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind: 'remove-caption-cue' as const,
    capabilityId: input.capabilityId as string,
    captionSetId: input.captionSetId as string,
    cueId: input.cueId as string,
  }))
}

const validateSetCaptionStyle = (
  input: Record<string, unknown>,
  path: string,
): Result<SetCaptionStyleOperation, CaptionOperationError> => {
  const issues: Issue[] = []
  checkKeys(input, SET_STYLE_KEYS, path, issues)
  checkCommon(input, 'set-caption-style', path, issues)
  const styleId = validateStyleId(input.styleId, `${path}.styleId`, issues)
  if (issues.length > 0 || !styleId) return err({ code: 'OPERATION_INVALID', issues })
  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind: 'set-caption-style' as const,
    capabilityId: input.capabilityId as string,
    captionSetId: input.captionSetId as string,
    styleId,
  }))
}

export const validateCaptionOperation = (
  input: unknown,
  path = '$',
): Result<CaptionOperation, CaptionOperationError> => {
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  switch (input.kind) {
    case 'add-captions': return validateAddCaptions(input, path)
    case 'set-caption-cue': return validateSetCaptionCue(input, path)
    case 'remove-caption-cue': return validateRemoveCaptionCue(input, path)
    case 'set-caption-style': return validateSetCaptionStyle(input, path)
    default:
      return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.kind`, code: 'VALUE_OUT_OF_RANGE' }] })
  }
}

/** The state of one caption set after every accepted change has been applied. */
export type CaptionSet = Readonly<{
  captionSetId: string
  assetId: string
  styleId: CaptionStyleId
  cues: readonly CaptionCue[]
}>

/**
 * Replay caption operations in history order to get the sets as they stand.
 *
 * Editing a caption is a fold over history rather than a rewrite of the
 * original operation, for the same reason cutting is: it keeps one user action
 * as exactly one Undo, and it lets a change in the middle of the history be
 * switched off on its own without disturbing what came after it.
 *
 * An edit naming a set that does not exist is IGNORED, not an error. It reaches
 * this point only when the change set that created the set was switched off or
 * blocked, and in that case the user's intent — "do not show those captions" —
 * is already satisfied.
 */
export const foldCaptionOperations = (
  operations: readonly CaptionOperation[],
): readonly CaptionSet[] => {
  const sets = new Map<string, { assetId: string; styleId: CaptionStyleId; cues: Map<string, CaptionCue> }>()

  for (const operation of operations) {
    switch (operation.kind) {
      case 'add-captions': {
        const cues = new Map<string, CaptionCue>()
        for (const cue of operation.cues) cues.set(cue.cueId, cue)
        sets.set(operation.captionSetId, { assetId: operation.assetId, styleId: operation.styleId, cues })
        break
      }
      case 'set-caption-cue': {
        const set = sets.get(operation.captionSetId)
        if (!set) break
        set.cues.set(operation.cueId, Object.freeze({
          cueId: operation.cueId,
          sourceInterval: operation.sourceInterval,
          lines: operation.lines,
        }))
        break
      }
      case 'remove-caption-cue': {
        sets.get(operation.captionSetId)?.cues.delete(operation.cueId)
        break
      }
      case 'set-caption-style': {
        const set = sets.get(operation.captionSetId)
        if (set) set.styleId = operation.styleId
        break
      }
    }
  }

  return Object.freeze([...sets.entries()].map(([captionSetId, set]) => Object.freeze({
    captionSetId,
    assetId: set.assetId,
    styleId: set.styleId,
    cues: Object.freeze(
      [...set.cues.values()].sort(
        (a, b) => a.sourceInterval.start.ticks - b.sourceInterval.start.ticks,
      ),
    ),
  })))
}
