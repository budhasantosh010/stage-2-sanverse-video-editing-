import { describe, expect, it } from 'vitest'

import { NAMEPLATE_COMPONENT_ID } from '@sanverse/edit-domain/capabilities'
import { TICKS_PER_MILLISECOND } from '@sanverse/edit-domain/time'

import { MAX_MESSAGE_LENGTH, validateIntentRequest } from './intent-request.ts'

const validRequest = () => ({
  schemaVersion: 'sanverse.intent-request/v1',
  requestId: 'request_0123456789abcdef',
  projectId: 'project_0123456789abcdef',
  baseRevision: 3,
  message: 'Put my name on screen here',
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
})

describe('validateIntentRequest', () => {
  it('accepts a complete request', () => {
    const result = validateIntentRequest(validRequest())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.message).toBe('Put my name on screen here')
      expect(result.value.context.point).toEqual({ x: 0.4, y: 0.7 })
    }
  })

  it('accepts a request with no point, because typing without pointing is normal', () => {
    const result = validateIntentRequest({
      ...validRequest(),
      context: { ...validRequest().context, sampledClipTimeTicks: null, point: null },
    })
    expect(result.ok).toBe(true)
  })

  it('refuses a message longer than the bound', () => {
    const result = validateIntentRequest({ ...validRequest(), message: 'a'.repeat(MAX_MESSAGE_LENGTH + 1) })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues[0].code).toBe('TEXT_TOO_LONG')
  })

  it('refuses an empty message', () => {
    const result = validateIntentRequest({ ...validRequest(), message: '   ' })
    expect(result.ok).toBe(false)
  })

  it('refuses a missing base revision instead of assuming zero', () => {
    const { baseRevision: _dropped, ...withoutRevision } = validRequest()
    const result = validateIntentRequest(withoutRevision)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues[0]).toEqual({ path: '$.baseRevision', code: 'FIELD_REQUIRED' })
  })

  it('refuses a capability that is not in the registry', () => {
    const result = validateIntentRequest({ ...validRequest(), capabilityIds: ['sanverse.shell/v1'] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues[0].code).toBe('CAPABILITY_UNKNOWN')
  })

  it('refuses coordinates outside the picture', () => {
    const result = validateIntentRequest({
      ...validRequest(),
      context: { ...validRequest().context, point: { x: 1.5, y: 0.5 } },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues[0].path).toBe('$.context.point.x')
  })

  it('refuses an unknown context field, which is how paths and media stay out', () => {
    const result = validateIntentRequest({
      ...validRequest(),
      context: { ...validRequest().context, sourcePath: 'C:/Users/Lenovo/video.mp4' },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.issues.some((issue) => issue.path === '$.context.sourcePath')).toBe(true)
    }
  })

  it('refuses an unknown top-level field, so raw project JSON cannot ride along', () => {
    const result = validateIntentRequest({ ...validRequest(), project: { revision: 3 } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues.some((issue) => issue.path === '$.project')).toBe(true)
  })

  it('refuses a request ID the client invented in the wrong shape', () => {
    const result = validateIntentRequest({ ...validRequest(), requestId: '../../etc/passwd' })
    expect(result.ok).toBe(false)
  })
})
