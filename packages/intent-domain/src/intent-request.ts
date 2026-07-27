import { err, isRecord, ok, type Result } from '@sanverse/edit-domain/result'
import { findCapability } from '@sanverse/edit-domain/capabilities'
import { CLIP_ID_PATTERN } from '@sanverse/edit-domain/composition'
import { MAX_PROJECT_TICKS } from '@sanverse/edit-domain/time'
import { PROJECT_ID_PATTERN } from '@sanverse/edit-domain'

/**
 * Everything the system is allowed to know about one user request.
 *
 * The shape is closed: an unknown field is refused, not ignored. That is the
 * only reliable way to keep three things out of this object forever —
 *
 *   - filesystem paths      (a provider must never learn where files live)
 *   - the raw project JSON  (an edit history is the user's private work)
 *   - media bytes           (the video itself never leaves by default)
 *
 * If a future feature needs one of them, it has to be added here deliberately,
 * reviewed, and reflected in the outbound allowlist. Nothing can leak in by
 * accident through a stray extra key.
 */
export const INTENT_REQUEST_SCHEMA = 'sanverse.intent-request/v1'

export const REQUEST_ID_PATTERN = /^request_[a-z0-9]{8,64}$/

/** About 150 words. Long enough for any real instruction, short enough to bound cost. */
export const MAX_MESSAGE_LENGTH = 1_000

export const MAX_REQUESTED_CAPABILITIES = 16

/** Language tags such as `en`, `en-GB`, `pt-BR`. */
export const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

export type NormalizedPoint = Readonly<{ x: number; y: number }>

/**
 * What the user was looking at when they asked.
 *
 * `sampledClipTimeTicks` and `point` are both null when the user simply typed
 * without pointing. That is a normal case, not an error: the system then either
 * uses an owner-approved default or asks one short question.
 */
export type IntentContext = Readonly<{
  clipId: string
  /** Where they pointed, on that clip's own timeline. Null when they did not point. */
  sampledClipTimeTicks: number | null
  /** Where they pointed on the finished frame, 0..1 on each axis. Null when they did not point. */
  point: NormalizedPoint | null
  /** Where the playhead is on the finished video, whether or not they pointed. */
  playheadTicks: number
  compositionDurationTicks: number
  compositionWidth: number
  compositionHeight: number
}>

export type IntentRequest = Readonly<{
  schemaVersion: typeof INTENT_REQUEST_SCHEMA
  /** Opaque and issued by the server, so a client cannot replay someone else's request. */
  requestId: string
  projectId: string
  /** The revision the user was looking at. An answer for an older one is refused. */
  baseRevision: number
  message: string
  context: IntentContext
  /** Capabilities the caller is asking to use. Unknown IDs are refused outright. */
  capabilityIds: readonly string[]
  locale: string
}>

export type IntentRequestError = {
  readonly code: 'INTENT_REQUEST_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: string }[]
}

const REQUEST_KEYS = [
  'schemaVersion',
  'requestId',
  'projectId',
  'baseRevision',
  'message',
  'context',
  'capabilityIds',
  'locale',
] as const

const CONTEXT_KEYS = [
  'clipId',
  'sampledClipTimeTicks',
  'point',
  'playheadTicks',
  'compositionDurationTicks',
  'compositionWidth',
  'compositionHeight',
] as const

const MAX_DIMENSION = 16_384

type Issue = IntentRequestError['issues'][number]

const isTicks = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_PROJECT_TICKS

const validatePoint = (input: unknown, path: string, issues: Issue[]): NormalizedPoint | null => {
  if (input === null) return null
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  const keys = Object.keys(input)
  if (keys.length !== 2 || !Object.hasOwn(input, 'x') || !Object.hasOwn(input, 'y')) {
    issues.push({ path, code: 'FIELD_UNKNOWN' })
    return null
  }
  let valid = true
  for (const axis of ['x', 'y'] as const) {
    const value = input[axis]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      issues.push({ path: `${path}.${axis}`, code: 'VALUE_OUT_OF_RANGE' })
      valid = false
    }
  }
  if (!valid) return null
  return Object.freeze({ x: input.x as number, y: input.y as number })
}

const validateContext = (input: unknown, path: string, issues: Issue[]): IntentContext | null => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  for (const key of CONTEXT_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(CONTEXT_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }

  const before = issues.length
  if (typeof input.clipId !== 'string' || !CLIP_ID_PATTERN.test(input.clipId)) {
    issues.push({ path: `${path}.clipId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (input.sampledClipTimeTicks !== null && !isTicks(input.sampledClipTimeTicks)) {
    issues.push({ path: `${path}.sampledClipTimeTicks`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!isTicks(input.playheadTicks)) {
    issues.push({ path: `${path}.playheadTicks`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!isTicks(input.compositionDurationTicks) || (input.compositionDurationTicks as number) <= 0) {
    issues.push({ path: `${path}.compositionDurationTicks`, code: 'VALUE_OUT_OF_RANGE' })
  }
  for (const key of ['compositionWidth', 'compositionHeight'] as const) {
    const value = input[key]
    if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > MAX_DIMENSION) {
      issues.push({ path: `${path}.${key}`, code: 'VALUE_OUT_OF_RANGE' })
    }
  }
  const point = validatePoint(input.point, `${path}.point`, issues)
  if (issues.length !== before) return null

  return Object.freeze({
    clipId: input.clipId as string,
    sampledClipTimeTicks: (input.sampledClipTimeTicks ?? null) as number | null,
    point,
    playheadTicks: input.playheadTicks as number,
    compositionDurationTicks: input.compositionDurationTicks as number,
    compositionWidth: input.compositionWidth as number,
    compositionHeight: input.compositionHeight as number,
  })
}

export const validateIntentRequest = (
  input: unknown,
  path = '$',
): Result<IntentRequest, IntentRequestError> => {
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'INTENT_REQUEST_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  for (const key of REQUEST_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(REQUEST_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }
  if (input.schemaVersion !== INTENT_REQUEST_SCHEMA) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.requestId !== 'string' || !REQUEST_ID_PATTERN.test(input.requestId)) {
    issues.push({ path: `${path}.requestId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.projectId !== 'string' || !PROJECT_ID_PATTERN.test(input.projectId)) {
    issues.push({ path: `${path}.projectId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  // A missing revision is refused rather than defaulted to zero. Guessing it
  // would let an answer built against an unknown state be applied as if it
  // were current, which is the exact failure revision fencing exists to stop.
  if (!Number.isSafeInteger(input.baseRevision) || (input.baseRevision as number) < 0) {
    issues.push({ path: `${path}.baseRevision`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.message !== 'string') {
    issues.push({ path: `${path}.message`, code: 'TYPE_INVALID' })
  } else if (input.message.trim().length === 0) {
    issues.push({ path: `${path}.message`, code: 'VALUE_OUT_OF_RANGE' })
  } else if ([...input.message].length > MAX_MESSAGE_LENGTH) {
    issues.push({ path: `${path}.message`, code: 'TEXT_TOO_LONG' })
  }
  if (typeof input.locale !== 'string' || !LOCALE_PATTERN.test(input.locale)) {
    issues.push({ path: `${path}.locale`, code: 'VALUE_OUT_OF_RANGE' })
  }

  if (!Array.isArray(input.capabilityIds)) {
    issues.push({ path: `${path}.capabilityIds`, code: 'TYPE_INVALID' })
  } else if (input.capabilityIds.length === 0 || input.capabilityIds.length > MAX_REQUESTED_CAPABILITIES) {
    issues.push({ path: `${path}.capabilityIds`, code: 'VALUE_OUT_OF_RANGE' })
  } else {
    const seen = new Set<string>()
    input.capabilityIds.forEach((capabilityId, index) => {
      if (typeof capabilityId !== 'string' || !findCapability(capabilityId)) {
        issues.push({ path: `${path}.capabilityIds[${index}]`, code: 'CAPABILITY_UNKNOWN' })
        return
      }
      if (seen.has(capabilityId)) {
        issues.push({ path: `${path}.capabilityIds[${index}]`, code: 'DUPLICATE_ID' })
        return
      }
      seen.add(capabilityId)
    })
  }

  const context = validateContext(input.context, `${path}.context`, issues)

  if (issues.length > 0 || !context) {
    return err({
      code: 'INTENT_REQUEST_INVALID',
      issues: issues.length > 0 ? issues : [{ path: `${path}.context`, code: 'TYPE_INVALID' }],
    })
  }

  return ok(Object.freeze({
    schemaVersion: INTENT_REQUEST_SCHEMA,
    requestId: input.requestId as string,
    projectId: input.projectId as string,
    baseRevision: input.baseRevision as number,
    message: (input.message as string).trim(),
    context,
    capabilityIds: Object.freeze([...(input.capabilityIds as string[])]),
    locale: input.locale as string,
  }))
}
