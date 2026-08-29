import { describe, expect, it } from 'vitest'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import { CreativeSceneFrameMaterializerErrorV1, creativeFrameTicksV1 } from './creative-scene-frame-materializer.ts'

describe('Creative exact-tick frame schedule', () => {
  it('uses exact integer ticks for ordinary 30 fps materialization', () => {
    const result = creativeFrameTicksV1(PROJECT_TIMESCALE, { numerator: 30, denominator: 1 })
    expect(result.ticksPerFrame).toBe(48_000)
    expect(result.ticks).toHaveLength(30)
    expect(result.ticks[0]).toBe(0)
    expect(result.ticks.at(-1)).toBe(29 * 48_000)
  })

  it('represents 30000/1001 exactly on the canonical Sanverse clock', () => {
    const result = creativeFrameTicksV1(PROJECT_TIMESCALE * 2, { numerator: 30_000, denominator: 1_001 })
    expect(result.ticksPerFrame).toBe(48_048)
    expect(result.ticks.every((tick) => Number.isSafeInteger(tick))).toBe(true)
    expect(result.ticks.at(-1)! < PROJECT_TIMESCALE * 2).toBe(true)
  })

  it('fails closed for a frame rate that the canonical clock cannot represent exactly', () => {
    expect(() => creativeFrameTicksV1(PROJECT_TIMESCALE, { numerator: 59_999, denominator: 1 }))
      .toThrowError(CreativeSceneFrameMaterializerErrorV1)
  })
})
