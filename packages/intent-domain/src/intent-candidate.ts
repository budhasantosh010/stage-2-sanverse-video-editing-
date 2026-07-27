import { err, isRecord, ok, type Result } from '@sanverse/edit-domain/result'
import { ANCHORS, type Anchor } from '@sanverse/edit-domain/geometry'
import {
  MAX_PRIMARY_TEXT_LENGTH,
  MAX_SECONDARY_TEXT_LENGTH,
} from '@sanverse/edit-domain/operations'

import {
  validateClarificationQuestion,
  type ClarificationQuestion,
} from './clarification.ts'
import type { NormalizedPoint } from './intent-request.ts'

/**
 * What a provider hands back. Untrusted, always.
 *
 * This is deliberately NOT an operation and NOT a render plan. It is a set of
 * raw arguments and a claim about which capability they belong to. Deterministic
 * code decides whether that claim is allowed, fills in anything missing from
 * owner-approved defaults, and only then builds a real operation.
 *
 * The gap matters. If a provider could hand back an operation, then anything
 * that could make the provider say something — a sentence typed into a video's
 * own subtitle track, a filename, a pasted script — could write directly into
 * the user's project.
 */
export const INTENT_CANDIDATE_SCHEMA = 'sanverse.intent-candidate/v1'

/** Ten minutes. A nameplate longer than this is a mistake, not a request. */
export const MAX_CANDIDATE_DURATION_MS = 600_000

/** A quarter of a second. Anything shorter cannot be read. */
export const MIN_CANDIDATE_DURATION_MS = 250

export const MAX_CANDIDATE_START_MS = 24 * 60 * 60 * 1_000

export const UNSUPPORTED_REASONS = [
  'not-an-edit',
  'capability-missing',
  'out-of-scope',
] as const
export type UnsupportedReason = (typeof UNSUPPORTED_REASONS)[number]

export const PROVIDER_FAILURE_REASONS = [
  'timeout',
  'unavailable',
  'invalid-response',
] as const
export type ProviderFailureReason = (typeof PROVIDER_FAILURE_REASONS)[number]

/**
 * Raw nameplate arguments.
 *
 * Every field may be null, meaning "the provider did not decide this". Null is
 * not a failure — deterministic code fills it from what the user was doing, or
 * asks one short question. A provider guessing a value it does not know is far
 * worse than a provider admitting it.
 */
export type NameplateCandidateArguments = Readonly<{
  primaryText: string | null
  secondaryText: string | null
  startMs: number | null
  durationMs: number | null
  point: NormalizedPoint | null
  anchor: Anchor | null
}>

export type IntentCandidate =
  | Readonly<{
      schemaVersion: typeof INTENT_CANDIDATE_SCHEMA
      kind: 'proposal-candidate'
      capabilityId: string
      capabilityVersion: number
      arguments: NameplateCandidateArguments
    }>
  | Readonly<{
      schemaVersion: typeof INTENT_CANDIDATE_SCHEMA
      kind: 'clarification-required'
      question: ClarificationQuestion
    }>
  | Readonly<{
      schemaVersion: typeof INTENT_CANDIDATE_SCHEMA
      kind: 'unsupported'
      reason: UnsupportedReason
    }>
  | Readonly<{
      schemaVersion: typeof INTENT_CANDIDATE_SCHEMA
      kind: 'provider-failure'
      reason: ProviderFailureReason
    }>

export const CANDIDATE_KINDS = [
  'proposal-candidate',
  'clarification-required',
  'unsupported',
  'provider-failure',
] as const

export type IntentCandidateError = {
  readonly code: 'INTENT_CANDIDATE_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: string }[]
}

/**
 * The exact key set a provider may return under `arguments`.
 *
 * Exported because a provider adapter has to describe this shape to a real
 * model. Generating that description from this constant is what stops the
 * instruction given to the model and the validator applied to its reply from
 * ever drifting apart — a drift that would show up as a provider which fails
 * validation on every single call, for reasons nobody could see.
 */
export const NAMEPLATE_ARGUMENT_KEYS = [
  'primaryText',
  'secondaryText',
  'startMs',
  'durationMs',
  'point',
  'anchor',
] as const

const ARGUMENT_KEYS = NAMEPLATE_ARGUMENT_KEYS

type Issue = IntentCandidateError['issues'][number]

const fail = (path: string, code: string): IntentCandidateError => ({
  code: 'INTENT_CANDIDATE_INVALID',
  issues: [{ path, code }],
})

const expectExactKeys = (
  input: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  issues: Issue[],
): void => {
  for (const key of keys) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    // An unexpected key is refused rather than dropped. A provider that adds
    // `{"shellCommand": ...}` or a whole operation object is rejected here,
    // loudly, instead of having the extra silently stripped and the rest used.
    if (!keys.includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  }
}

const validateNullablePoint = (
  input: unknown,
  path: string,
  issues: Issue[],
): NormalizedPoint | null => {
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
  return valid ? Object.freeze({ x: input.x as number, y: input.y as number }) : null
}

const validateNullableText = (
  input: unknown,
  path: string,
  maxLength: number,
  issues: Issue[],
): string | null => {
  if (input === null) return null
  if (typeof input !== 'string') {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  if ([...trimmed].length > maxLength) {
    issues.push({ path, code: 'TEXT_TOO_LONG' })
    return null
  }
  // Control characters would survive into the drawn frame and into an FFmpeg
  // argument. They are refused rather than stripped, so what is approved in the
  // preview is exactly the text that was proposed.
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    issues.push({ path, code: 'TEXT_HAS_CONTROL_CHARACTERS' })
    return null
  }
  return trimmed
}

const validateNullableMilliseconds = (
  input: unknown,
  path: string,
  bounds: { readonly min: number; readonly max: number },
  issues: Issue[],
): number | null => {
  if (input === null) return null
  if (!Number.isSafeInteger(input) || (input as number) < bounds.min || (input as number) > bounds.max) {
    issues.push({ path, code: 'VALUE_OUT_OF_RANGE' })
    return null
  }
  return input as number
}

const validateArguments = (
  input: unknown,
  path: string,
  issues: Issue[],
): NameplateCandidateArguments | null => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  expectExactKeys(input, ARGUMENT_KEYS, path, issues)
  const before = issues.length

  const primaryText = validateNullableText(input.primaryText, `${path}.primaryText`, MAX_PRIMARY_TEXT_LENGTH, issues)
  const secondaryText = validateNullableText(input.secondaryText, `${path}.secondaryText`, MAX_SECONDARY_TEXT_LENGTH, issues)
  const startMs = validateNullableMilliseconds(input.startMs, `${path}.startMs`, { min: 0, max: MAX_CANDIDATE_START_MS }, issues)
  const durationMs = validateNullableMilliseconds(input.durationMs, `${path}.durationMs`, { min: MIN_CANDIDATE_DURATION_MS, max: MAX_CANDIDATE_DURATION_MS }, issues)
  const point = validateNullablePoint(input.point, `${path}.point`, issues)
  let anchor: Anchor | null = null
  if (input.anchor !== null) {
    if (!ANCHORS.includes(input.anchor as Anchor)) {
      issues.push({ path: `${path}.anchor`, code: 'VALUE_OUT_OF_RANGE' })
    } else {
      anchor = input.anchor as Anchor
    }
  }

  if (issues.length !== before) return null
  return Object.freeze({ primaryText, secondaryText, startMs, durationMs, point, anchor })
}

export const validateIntentCandidate = (
  input: unknown,
  path = '$',
): Result<IntentCandidate, IntentCandidateError> => {
  if (!isRecord(input)) return err(fail(path, 'TYPE_INVALID'))
  if (input.schemaVersion !== INTENT_CANDIDATE_SCHEMA) {
    return err(fail(`${path}.schemaVersion`, 'VALUE_OUT_OF_RANGE'))
  }
  if (typeof input.kind !== 'string' || !(CANDIDATE_KINDS as readonly string[]).includes(input.kind)) {
    return err(fail(`${path}.kind`, 'CANDIDATE_KIND_UNKNOWN'))
  }

  const issues: Issue[] = []

  if (input.kind === 'proposal-candidate') {
    expectExactKeys(input, ['schemaVersion', 'kind', 'capabilityId', 'capabilityVersion', 'arguments'], path, issues)
    if (typeof input.capabilityId !== 'string' || input.capabilityId.trim().length === 0) {
      issues.push({ path: `${path}.capabilityId`, code: 'VALUE_OUT_OF_RANGE' })
    }
    if (!Number.isSafeInteger(input.capabilityVersion) || (input.capabilityVersion as number) <= 0) {
      issues.push({ path: `${path}.capabilityVersion`, code: 'VALUE_OUT_OF_RANGE' })
    }
    const args = validateArguments(input.arguments, `${path}.arguments`, issues)
    if (issues.length > 0 || !args) {
      return err({ code: 'INTENT_CANDIDATE_INVALID', issues: issues.length > 0 ? issues : [{ path, code: 'TYPE_INVALID' }] })
    }
    return ok(Object.freeze({
      schemaVersion: INTENT_CANDIDATE_SCHEMA,
      kind: 'proposal-candidate',
      capabilityId: input.capabilityId as string,
      capabilityVersion: input.capabilityVersion as number,
      arguments: args,
    }))
  }

  if (input.kind === 'clarification-required') {
    expectExactKeys(input, ['schemaVersion', 'kind', 'question'], path, issues)
    const question = validateClarificationQuestion(input.question, `${path}.question`)
    if (!question.ok) issues.push(...question.error.issues)
    if (issues.length > 0 || !question.ok) {
      return err({ code: 'INTENT_CANDIDATE_INVALID', issues: issues.length > 0 ? issues : [{ path, code: 'TYPE_INVALID' }] })
    }
    return ok(Object.freeze({
      schemaVersion: INTENT_CANDIDATE_SCHEMA,
      kind: 'clarification-required',
      question: question.value,
    }))
  }

  const reasons: readonly string[] = input.kind === 'unsupported' ? UNSUPPORTED_REASONS : PROVIDER_FAILURE_REASONS
  expectExactKeys(input, ['schemaVersion', 'kind', 'reason'], path, issues)
  if (typeof input.reason !== 'string' || !reasons.includes(input.reason)) {
    issues.push({ path: `${path}.reason`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (issues.length > 0) return err({ code: 'INTENT_CANDIDATE_INVALID', issues })

  return ok(
    input.kind === 'unsupported'
      ? Object.freeze({
          schemaVersion: INTENT_CANDIDATE_SCHEMA,
          kind: 'unsupported' as const,
          reason: input.reason as UnsupportedReason,
        })
      : Object.freeze({
          schemaVersion: INTENT_CANDIDATE_SCHEMA,
          kind: 'provider-failure' as const,
          reason: input.reason as ProviderFailureReason,
        }),
  )
}
