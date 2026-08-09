import { describe, expect, it } from 'vitest'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import {
  PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE,
  createCreativeDirectionDocument,
  createCreativeDirective,
  createDefaultCreativeDirectionTracks,
  validateCreativeDirectionDocument,
} from './index.ts'

const t = (seconds: number) => seconds * PROJECT_TIMESCALE
const clone = (value: unknown): any => JSON.parse(JSON.stringify(value))

describe('Plan B0 Creative Direction validation', () => {
  it('accepts the original product-launch reference fixture with all eight tracks', () => {
    const result = validateCreativeDirectionDocument(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE)
    expect(result.ok).toBe(true)
    expect(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.tracks.map((track) => track.type)).toEqual([
      'STYLE', 'GRAPHICS', 'MOTION', 'FOOTAGE', 'TRANSITION', 'EMPHASIS', 'NOTES', 'CONSTRAINTS',
    ])
    expect(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.durationTicks).toBe(t(95))
  })

  it('rejects negative, reversed and beyond-duration exact-tick regions', () => {
    for (const [startTicks, endTicks] of [[-1, t(1)], [t(2), t(1)], [t(94), t(96)]]) {
      const input = clone(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE)
      input.directives[2]!.startTicks = startTicks
      input.directives[2]!.endTicks = endTicks
      const result = validateCreativeDirectionDocument(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.issues.some((entry) => entry.code === 'TIME_INVALID')).toBe(true)
    }
  })

  it('rejects fractional ticks rather than inventing a millisecond clock', () => {
    const input = clone(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE)
    input.directives[2]!.startTicks = 0.5
    const result = validateCreativeDirectionDocument(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((entry) => entry.code === 'TIME_INVALID')).toBe(true)
  })

  it('rejects unknown track types and unknown directive types', () => {
    const badTrack = clone(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE) as unknown as { tracks: Array<Record<string, unknown>> }
    badTrack.tracks[0]!.type = 'AUDIO'
    expect(validateCreativeDirectionDocument(badTrack).ok).toBe(false)
    const badKind = clone(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE) as unknown as { directives: Array<Record<string, unknown>> }
    badKind.directives[2]!.kind = 'css-animation'
    expect(validateCreativeDirectionDocument(badKind).ok).toBe(false)
  })

  it('rejects duplicate directive IDs', () => {
    const input = clone(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE)
    input.directives[3]!.id = input.directives[2]!.id
    const result = validateCreativeDirectionDocument(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((entry) => entry.code === 'DUPLICATE_ID')).toBe(true)
  })

  it('rejects conflicting overlapping required styles while allowing compatible overlap', () => {
    const tracks = createDefaultCreativeDirectionTracks()
    const a = Object.freeze({ ...createCreativeDirective('style', { id: 'style:a', startTicks: 0, endTicks: t(10), priority: 'required' }), styleIntent: 'clean-product-demo' })
    const compatible = Object.freeze({ ...createCreativeDirective('style', { id: 'style:b', startTicks: t(5), endTicks: t(15), priority: 'required' }), styleIntent: 'clean-product-demo' })
    expect(validateCreativeDirectionDocument({ schemaVersion: 'sanverse.creative-direction/v1', durationTicks: t(20), tracks, directives: [a, compatible], comments: [], versions: [] }).ok).toBe(true)
    const conflicting = Object.freeze({ ...compatible, styleIntent: 'retro-maximal' })
    const result = validateCreativeDirectionDocument({ schemaVersion: 'sanverse.creative-direction/v1', durationTicks: t(20), tracks, directives: [a, conflicting], comments: [], versions: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((entry) => entry.code === 'CONFLICT')).toBe(true)
  })

  it('rejects comments that reference a missing directive', () => {
    const input = clone(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE)
    input.comments[0]!.target = { kind: 'directive', directiveId: 'missing:directive' }
    const result = validateCreativeDirectionDocument(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((entry) => entry.code === 'REFERENCE_INVALID')).toBe(true)
  })

  it('constructs only validated documents', () => {
    expect(() => createCreativeDirectionDocument({ durationTicks: t(10) })).not.toThrow()
    expect(() => createCreativeDirectionDocument({ durationTicks: 0 })).toThrow(RangeError)
  })
})
