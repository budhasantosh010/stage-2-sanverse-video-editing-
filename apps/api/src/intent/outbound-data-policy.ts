import { findCapability } from '@sanverse/edit-domain/capabilities'
import { PROJECT_TIMESCALE, toSeconds } from '@sanverse/edit-domain/time'
import type { IntentRequest } from '@sanverse/intent-domain/intent-request'

/**
 * The complete list of everything that may leave this machine.
 *
 * This file exists so the answer to "what does the AI see?" is one short list a
 * person can read, not something you work out by tracing calls. Anything not
 * built here cannot be sent, because the sender is handed this object and never
 * the request.
 *
 * NOT SENT, deliberately:
 *
 *   the video, or any frame of it     the whole point is that footage stays local
 *   any filesystem path               a provider must never learn where files live
 *   the original filename             "Q3-layoffs-rehearsal.mp4" is private
 *   the project ID or any clip ID     internal identifiers the provider cannot use
 *   the edit history                  the user's work is not context
 *   the file hash                     an identifier that follows the user around
 *
 * SENT:
 *
 *   the message the user typed        they typed it in order to be acted on
 *   their language                    so the reply is in their language
 *   the capability list               so it can only choose from what exists
 *   the frame size                    so it can reason about position
 *   three times, in seconds           video length, playhead, pointed-at moment
 *   the pointed-at spot               two numbers between 0 and 1
 */
export const OUTBOUND_FIELDS = [
  'message',
  'locale',
  'capabilities',
  'frame',
  'timing',
  'point',
] as const

export type OutboundCapability = Readonly<{
  capabilityId: string
  version: number
  accepts: string
}>

export type OutboundPayload = Readonly<{
  message: string
  locale: string
  capabilities: readonly OutboundCapability[]
  frame: Readonly<{ width: number; height: number }>
  timing: Readonly<{
    videoLengthSeconds: number
    playheadSeconds: number
    /** Null when the user typed without pointing. */
    pointedAtSeconds: number | null
  }>
  point: Readonly<{ x: number; y: number }> | null
}>

export class OutboundPolicyError extends Error {
  readonly code = 'OUTBOUND_POLICY_VIOLATION'
  constructor(message: string) {
    super(message)
    this.name = 'OutboundPolicyError'
  }
}

const round = (value: number, places: number): number => Number(value.toFixed(places))

export const buildOutboundPayload = (request: IntentRequest): OutboundPayload => {
  const capabilities: OutboundCapability[] = []
  for (const capabilityId of request.capabilityIds) {
    const capability = findCapability(capabilityId)
    if (!capability) throw new OutboundPolicyError('An unregistered capability cannot be described.')
    capabilities.push(Object.freeze({
      capabilityId: capability.capabilityId,
      version: capability.version,
      accepts: capability.accepts,
    }))
  }

  const context = request.context
  return Object.freeze({
    message: request.message,
    locale: request.locale,
    capabilities: Object.freeze(capabilities),
    frame: Object.freeze({ width: context.compositionWidth, height: context.compositionHeight }),
    timing: Object.freeze({
      videoLengthSeconds: round(toSeconds({ ticks: context.compositionDurationTicks, timescale: PROJECT_TIMESCALE }), 3),
      playheadSeconds: round(toSeconds({ ticks: context.playheadTicks, timescale: PROJECT_TIMESCALE }), 3),
      pointedAtSeconds:
        context.sampledClipTimeTicks === null
          ? null
          : round(toSeconds({ ticks: context.sampledClipTimeTicks, timescale: PROJECT_TIMESCALE }), 3),
    }),
    point: context.point === null ? null : Object.freeze({ x: round(context.point.x, 6), y: round(context.point.y, 6) }),
  })
}

/** Serialized size a provider may be sent. Bounds cost and bounds leakage. */
export const MAX_OUTBOUND_BYTES = 8 * 1024

/**
 * Last gate before the wire. Checked again here rather than trusted from the
 * builder, because this is the point of no return: once bytes leave, they may
 * be logged, cached, or trained on by someone else, and deleting them later is
 * not possible.
 */
export const assertOutboundPayloadSafe = (payload: OutboundPayload): string => {
  const keys = Object.keys(payload)
  for (const key of keys) {
    if (!(OUTBOUND_FIELDS as readonly string[]).includes(key)) {
      throw new OutboundPolicyError(`"${key}" is not on the outbound allowlist.`)
    }
  }
  for (const field of OUTBOUND_FIELDS) {
    if (!keys.includes(field)) throw new OutboundPolicyError(`"${field}" is missing from the outbound payload.`)
  }
  const serialized = JSON.stringify(payload)
  if (serialized.length > MAX_OUTBOUND_BYTES) {
    throw new OutboundPolicyError('The outbound payload is larger than the allowed bound.')
  }
  // A Windows or POSIX path in the message would mean the message itself is
  // carrying private location data, whatever the field list says.
  if (/[A-Za-z]:\\|\/(?:Users|home|var|etc)\//.test(payload.message)) {
    throw new OutboundPolicyError('The message looks like it contains a filesystem path.')
  }
  return serialized
}

/**
 * What may be written to a log about one request.
 * Sizes and shapes only. Never the message, never the reply.
 */
export const describeOutbound = (requestId: string, payload: OutboundPayload) =>
  Object.freeze({
    requestId,
    messageLength: payload.message.length,
    capabilityCount: payload.capabilities.length,
    hasPoint: payload.point !== null,
    locale: payload.locale,
  })
