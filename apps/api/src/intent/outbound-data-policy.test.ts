import { describe, expect, it } from 'vitest'

import { NAMEPLATE_COMPONENT_ID, TICKS_PER_MILLISECOND } from '@sanverse/edit-domain'
import { validateIntentRequest, type IntentRequest } from '@sanverse/intent-domain'

import {
  OUTBOUND_FIELDS,
  OutboundPolicyError,
  assertOutboundPayloadSafe,
  buildOutboundPayload,
  describeOutbound,
} from './outbound-data-policy.ts'

const buildRequest = (overrides: Record<string, unknown> = {}): IntentRequest => {
  const parsed = validateIntentRequest({
    schemaVersion: 'sanverse.intent-request/v1',
    requestId: 'request_0123456789abcdef',
    projectId: 'project_0123456789abcdef',
    baseRevision: 2,
    message: 'add my name here',
    context: {
      clipId: 'clip_0123456789ab',
      sampledClipTimeTicks: 6_000 * TICKS_PER_MILLISECOND,
      point: { x: 0.4, y: 0.7 },
      playheadTicks: 6_000 * TICKS_PER_MILLISECOND,
      compositionDurationTicks: 30_000 * TICKS_PER_MILLISECOND,
      compositionWidth: 1920,
      compositionHeight: 1080,
    },
    capabilityIds: [NAMEPLATE_COMPONENT_ID],
    locale: 'en-GB',
    ...overrides,
  })
  if (!parsed.ok) throw new Error('fixture request is invalid')
  return parsed.value
}

describe('outbound data policy', () => {
  it('sends exactly the allowlisted fields and nothing else', () => {
    const payload = buildOutboundPayload(buildRequest())
    expect(Object.keys(payload).sort()).toEqual([...OUTBOUND_FIELDS].sort())
  })

  it('never carries the project ID, the clip ID or any identifier', () => {
    const serialized = JSON.stringify(buildOutboundPayload(buildRequest()))
    expect(serialized).not.toContain('project_')
    expect(serialized).not.toContain('clip_')
    expect(serialized).not.toContain('request_')
  })

  it('converts times to plain seconds a person could read', () => {
    const payload = buildOutboundPayload(buildRequest())
    expect(payload.timing).toEqual({
      videoLengthSeconds: 30,
      playheadSeconds: 6,
      pointedAtSeconds: 6,
    })
  })

  it('reports no pointed-at time when the user did not point', () => {
    const payload = buildOutboundPayload(
      buildRequest({
        context: {
          clipId: 'clip_0123456789ab',
          sampledClipTimeTicks: null,
          point: null,
          playheadTicks: 0,
          compositionDurationTicks: 30_000 * TICKS_PER_MILLISECOND,
          compositionWidth: 1920,
          compositionHeight: 1080,
        },
      }),
    )
    expect(payload.timing.pointedAtSeconds).toBeNull()
    expect(payload.point).toBeNull()
  })

  it('blocks a Windows path hidden in the message', () => {
    const payload = buildOutboundPayload(buildRequest({ message: 'read C:\\Users\\me\\secrets.txt' }))
    expect(() => assertOutboundPayloadSafe(payload)).toThrow(OutboundPolicyError)
  })

  it('blocks a POSIX home path hidden in the message', () => {
    const payload = buildOutboundPayload(buildRequest({ message: 'open /home/me/private.mp4 please' }))
    expect(() => assertOutboundPayloadSafe(payload)).toThrow(OutboundPolicyError)
  })

  it('blocks a payload that gained an extra field after it was built', () => {
    const payload = { ...buildOutboundPayload(buildRequest()), sourcePath: 'C:/video.mp4' } as never
    expect(() => assertOutboundPayloadSafe(payload)).toThrow(OutboundPolicyError)
  })

  it('logs shapes and sizes but never the message itself', () => {
    const request = buildRequest({ message: 'add "Very Private Client Name"' })
    const described = describeOutbound(request.requestId, buildOutboundPayload(request))
    expect(JSON.stringify(described)).not.toContain('Very Private Client Name')
    expect(described.messageLength).toBeGreaterThan(0)
  })
})
