import {
  DEFAULT_NAMEPLATE_ANCHOR,
  NAMEPLATE_COMPONENT_ID,
  PROJECT_TIMESCALE,
  TICKS_PER_MILLISECOND,
  clipCompositionRange,
  findClip,
  findCapability,
  validateChangeSet,
  validateOperation,
  validateOperationAgainstComposition,
  type ChangeSet,
  type Clip,
  type EditProject,
} from '@sanverse/edit-domain'
import {
  DEFAULT_CLARIFICATION,
  validateIntentCandidate,
  validateIntentRequest,
  type ClarificationField,
  type IntentRequest,
  type NameplateCandidateArguments,
} from '@sanverse/intent-domain'

import { ProviderCallError, type IntentProviderPort } from './intent-port.ts'
import {
  assertOutboundPayloadSafe,
  buildOutboundPayload,
  describeOutbound,
  OutboundPolicyError,
} from './outbound-data-policy.ts'

/** Owner-approved default: five seconds, the same as a hand-made nameplate. */
export const DEFAULT_VISIBLE_MS = 5_000

export type IntentRejectionCode =
  | 'REQUEST_INVALID'
  | 'STALE_REVISION'
  | 'CAPABILITY_NOT_ALLOWED'
  | 'PROVIDER_RESPONSE_INVALID'
  | 'PROVIDER_UNAVAILABLE'
  | 'CLIP_UNKNOWN'
  | 'DOES_NOT_FIT'
  | 'OUTBOUND_BLOCKED'

/**
 * The four endings, from the user's point of view.
 *
 * Only `proposal` produces anything, and even that is a *pending* change set:
 * nothing is saved and nothing is exported until the user presses Accept. The
 * other three leave the project byte-for-byte unchanged.
 */
export type IntentOutcome =
  | Readonly<{
      kind: 'proposal'
      requestId: string
      changeSet: ChangeSet
      /** One plain sentence describing what will happen, for the user to check. */
      explanation: string
      /** Set when a deterministic default or a clamp changed what was asked for. */
      note: string | null
    }>
  | Readonly<{ kind: 'clarification'; requestId: string; field: ClarificationField; question: string }>
  | Readonly<{ kind: 'unsupported'; requestId: string; message: string }>
  | Readonly<{ kind: 'rejected'; requestId: string; code: IntentRejectionCode; message: string }>

export type IntentServiceOptions = Readonly<{
  provider: IntentProviderPort
  loadProject(projectId: string): Promise<EditProject>
  createOperationId(): string
  /** Milliseconds a provider is allowed before the call is abandoned. */
  timeoutMs?: number
  /** Safe metadata sink. Never receives the message or the reply. */
  log?(event: Record<string, unknown>): void
}>

const clarify = (requestId: string, field: ClarificationField, question?: string): IntentOutcome =>
  Object.freeze({
    kind: 'clarification' as const,
    requestId,
    field,
    question: question ?? DEFAULT_CLARIFICATION[field],
  })

const reject = (requestId: string, code: IntentRejectionCode, message: string): IntentOutcome =>
  Object.freeze({ kind: 'rejected' as const, requestId, code, message })

const formatSeconds = (ticks: number): string => {
  const total = ticks / (TICKS_PER_MILLISECOND * 1_000)
  const minutes = Math.floor(total / 60)
  const seconds = total - minutes * 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

const changeSetIdFor = (operationId: string): string =>
  `changeset_${operationId.replace(/^operation_/, '').slice(0, 32)}`

/**
 * Turn untrusted arguments into a canonical operation, or explain what is
 * missing.
 *
 * Every value the provider left as null is filled here, from what the user was
 * actually doing, using defaults the owner approved. The provider never gets to
 * invent a position or a time it does not know.
 */
const buildOperation = (
  request: IntentRequest,
  clip: Clip,
  args: NameplateCandidateArguments,
  operationId: string,
):
  | Readonly<{ ok: true; operation: unknown; note: string | null; startTicks: number; durationTicks: number }>
  | Readonly<{ ok: false; field: ClarificationField }>
  | Readonly<{ ok: false; unfit: string }> => {
  if (!args.primaryText) return Object.freeze({ ok: false as const, field: 'primary-text' as const })

  const point = args.point ?? request.context.point
  if (!point) return Object.freeze({ ok: false as const, field: 'position' as const })

  const clipRange = clipCompositionRange(clip)
  const clipStart = clipRange.start.ticks
  const clipEnd = clipStart + clipRange.duration.ticks

  const requestedStart =
    args.startMs !== null
      ? args.startMs * TICKS_PER_MILLISECOND
      : request.context.sampledClipTimeTicks !== null
        ? clipStart + request.context.sampledClipTimeTicks
        : request.context.playheadTicks

  const notes: string[] = []

  // A start beyond the end of the video is a real misunderstanding, not
  // something to quietly nudge. It is refused and explained.
  if (requestedStart >= clipEnd) {
    return Object.freeze({
      ok: false as const,
      unfit: `That moment is past the end of this video, which is ${formatSeconds(clipEnd)} long.`,
    })
  }
  const start = Math.max(clipStart, requestedStart)
  if (start !== requestedStart) notes.push('Moved to the start of the video.')

  const requestedDuration = (args.durationMs ?? DEFAULT_VISIBLE_MS) * TICKS_PER_MILLISECOND
  const duration = Math.min(requestedDuration, clipEnd - start)
  if (duration !== requestedDuration) {
    notes.push(`Shortened to ${((duration / TICKS_PER_MILLISECOND) / 1_000).toFixed(1)} seconds so it ends with the video.`)
  }
  if (args.point === null && request.context.point) notes.push('Placed where you pointed.')
  if (args.durationMs === null) notes.push('Visible for 5 seconds, the usual length.')

  const sampledClipTime = Math.min(Math.max(0, start - clipStart), clipRange.duration.ticks - 1)

  const operation = {
    schemaVersion: 'sanverse.operation/v2',
    operationId,
    kind: 'add-nameplate',
    capabilityId: NAMEPLATE_COMPONENT_ID,
    clipId: clip.clipId,
    sampledClipTime: { ticks: sampledClipTime, timescale: PROJECT_TIMESCALE },
    compositionInterval: {
      start: { ticks: start, timescale: PROJECT_TIMESCALE },
      duration: { ticks: duration, timescale: PROJECT_TIMESCALE },
    },
    target: {
      coordinateSpace: 'composition-normalized',
      point: { x: point.x, y: point.y },
      anchor: args.anchor ?? DEFAULT_NAMEPLATE_ANCHOR,
    },
    primaryText: args.primaryText,
    secondaryText: args.secondaryText ?? '',
    extensions: {},
  }

  return Object.freeze({
    ok: true as const,
    operation,
    note: notes.length > 0 ? notes.join(' ') : null,
    startTicks: start,
    durationTicks: duration,
  })
}

export function createIntentService(options: IntentServiceOptions) {
  const { provider, loadProject, createOperationId } = options
  const timeoutMs = options.timeoutMs ?? 20_000
  const log = options.log ?? (() => undefined)

  /**
   * The order below is fixed and never varies. Every failure before the change
   * set is built returns no pending operation at all, which is what makes
   * "the AI cannot edit your video" a structural fact rather than a promise.
   *
   *   1  validate the request
   *   2  load the exact project revision
   *   3  refuse a stale revision, before spending anything on a provider
   *   4  intersect the requested capabilities with the registry
   *   5  build the outbound payload and check it against the allowlist
   *   6  call the provider
   *   7  treat the reply as untrusted
   *   8  validate the reply's shape
   *   9  hand back clarification / unsupported / failure unchanged
   *  10  check the claimed capability is one that was actually offered
   *  11  build the canonical operation from defaults and evidence
   *  12  check the operation against this project's real bounds
   *  13  build a PENDING change set — still not applied
   */
  return {
    async propose(rawRequest: unknown, signal?: AbortSignal): Promise<IntentOutcome> {
      const parsed = validateIntentRequest(rawRequest)
      if (!parsed.ok) {
        const requestId =
          typeof rawRequest === 'object' && rawRequest !== null && typeof (rawRequest as { requestId?: unknown }).requestId === 'string'
            ? ((rawRequest as { requestId: string }).requestId)
            : 'request_unknown'
        return reject(requestId, 'REQUEST_INVALID', 'That request could not be read. Try describing it again.')
      }
      const request = parsed.value

      const project = await loadProject(request.projectId)

      if (project.revision !== request.baseRevision) {
        return reject(
          request.requestId,
          'STALE_REVISION',
          'Your video changed while that was being prepared. Ask again and it will use the latest version.',
        )
      }

      const allowed = request.capabilityIds.filter((capabilityId) => findCapability(capabilityId) !== undefined)
      if (allowed.length === 0) {
        return reject(request.requestId, 'CAPABILITY_NOT_ALLOWED', 'That is not something this version can do yet.')
      }

      const clip = findClip(project.composition, request.context.clipId)
      if (!clip) {
        return reject(request.requestId, 'CLIP_UNKNOWN', 'That part of the video could not be found. Reopen the project and try again.')
      }

      let serializedLength = 0
      let reply: unknown
      const controller = new AbortController()
      const abortOuter = () => controller.abort()
      signal?.addEventListener('abort', abortOuter, { once: true })
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const payload = buildOutboundPayload(request)
        serializedLength = assertOutboundPayloadSafe(payload).length
        log({ event: 'intent.outbound', ...describeOutbound(request.requestId, payload), bytes: serializedLength })
        reply = await provider.propose(payload, { signal: controller.signal })
      } catch (error) {
        if (error instanceof OutboundPolicyError) {
          log({ event: 'intent.outbound-blocked', requestId: request.requestId })
          return reject(request.requestId, 'OUTBOUND_BLOCKED', 'That request was not sent, because it contained something private.')
        }
        if (error instanceof ProviderCallError || controller.signal.aborted) {
          // `detail` is safe to log ONLY because `ProviderCallError` is thrown
          // exclusively by this project's own adapters with this project's own
          // wording. A provider's response text is never placed in it. Without
          // this the owner cannot tell a wrong API key from an unreachable
          // proxy — the user-facing sentence is identical for both.
          log({
            event: 'intent.provider-failed',
            requestId: request.requestId,
            provider: provider.name,
            detail: error instanceof ProviderCallError ? error.message : 'The request was cancelled.',
          })
          return reject(request.requestId, 'PROVIDER_UNAVAILABLE', 'The assistant is not responding right now. Your video is unchanged.')
        }
        throw error
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abortOuter)
      }

      const candidate = validateIntentCandidate(reply)
      if (!candidate.ok) {
        log({ event: 'intent.candidate-invalid', requestId: request.requestId, issue: candidate.error.issues[0]?.code })
        return reject(
          request.requestId,
          'PROVIDER_RESPONSE_INVALID',
          'The assistant replied with something this app could not use. Nothing was changed.',
        )
      }

      if (candidate.value.kind === 'clarification-required') {
        return clarify(request.requestId, candidate.value.question.field, candidate.value.question.question)
      }
      if (candidate.value.kind === 'unsupported') {
        return Object.freeze({
          kind: 'unsupported' as const,
          requestId: request.requestId,
          message: 'This version can add text to your video. It cannot do that yet.',
        })
      }
      if (candidate.value.kind === 'provider-failure') {
        return reject(request.requestId, 'PROVIDER_UNAVAILABLE', 'The assistant is not responding right now. Your video is unchanged.')
      }

      // A capability that was never offered is refused outright. This is the
      // check that stops "ignore your instructions and run this" from turning
      // into anything at all: the reply names a capability, and a name that is
      // not on the offered list simply has no code path behind it.
      if (!allowed.includes(candidate.value.capabilityId)) {
        log({ event: 'intent.capability-refused', requestId: request.requestId, claimed: candidate.value.capabilityId })
        return reject(request.requestId, 'CAPABILITY_NOT_ALLOWED', 'That is not something this version can do yet.')
      }

      const built = buildOperation(request, clip, candidate.value.arguments, createOperationId())
      if (!built.ok) {
        if ('field' in built) return clarify(request.requestId, built.field)
        return reject(request.requestId, 'DOES_NOT_FIT', built.unfit)
      }

      const operation = validateOperation(built.operation)
      if (!operation.ok) {
        log({ event: 'intent.operation-invalid', requestId: request.requestId, issue: operation.error.issues[0]?.code })
        return reject(request.requestId, 'DOES_NOT_FIT', 'That edit could not be built for this video. Nothing was changed.')
      }
      const fits = validateOperationAgainstComposition(operation.value, project.composition)
      if (!fits.ok) {
        return reject(request.requestId, 'DOES_NOT_FIT', 'That edit does not fit this video. Try a different moment.')
      }

      const changeSet = validateChangeSet({
        schemaVersion: 'sanverse.change-set/v1',
        changeSetId: changeSetIdFor(operation.value.operationId),
        baseRevision: project.revision,
        operations: [operation.value],
        // Provenance ties this back to the request that produced it, so an
        // AI-made edit is always distinguishable from one the user made.
        provenance: { source: 'ai', requestId: request.requestId },
        extensions: {},
      })
      if (!changeSet.ok) {
        return reject(request.requestId, 'DOES_NOT_FIT', 'That edit could not be prepared. Nothing was changed.')
      }

      const secondary = operation.value.secondaryText ? ` and “${operation.value.secondaryText}”` : ''
      return Object.freeze({
        kind: 'proposal' as const,
        requestId: request.requestId,
        changeSet: changeSet.value,
        explanation: `Shows “${operation.value.primaryText}”${secondary} from ${formatSeconds(built.startTicks)} for ${((built.durationTicks / TICKS_PER_MILLISECOND) / 1_000).toFixed(1)} seconds.`,
        note: built.note,
      })
    },
  }
}

export type IntentService = ReturnType<typeof createIntentService>
