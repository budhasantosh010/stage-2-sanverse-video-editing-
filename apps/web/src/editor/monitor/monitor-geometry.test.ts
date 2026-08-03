import { describe, expect, it } from 'vitest'
import { resolveMonitorContentRect } from './monitor-geometry'

const stageRect = Object.freeze({ left: 100, top: 50, width: 800, height: 450 })

describe('resolveMonitorContentRect', () => {
  it('fits portrait footage without stretching and reports letterboxing', () => {
    const result = resolveMonitorContentRect({ stageRect, sourceWidth: 1080, sourceHeight: 1920, fitMode: 'fit' })
    expect(result?.displayedContentRect).toEqual({ left: 373.4375, top: 50, width: 253.125, height: 450 })
    expect(result?.letterbox).toEqual({ top: 0, right: 273.4375, bottom: 0, left: 273.4375 })
    expect(result?.visibleSourceRect).toEqual({ x: 0, y: 0, width: 1080, height: 1920 })
  })

  it('fills the stage without stretching and reports the visible source crop', () => {
    const result = resolveMonitorContentRect({ stageRect, sourceWidth: 1080, sourceHeight: 1920, fitMode: 'fill' })
    expect(result?.displayedContentRect).toEqual({ left: 100, top: -436.1111111111111, width: 800, height: 1422.2222222222222 })
    expect(result?.visibleSourceRect.x).toBe(0)
    expect(result?.visibleSourceRect.y).toBeCloseTo(656.25)
    expect(result?.visibleSourceRect.width).toBe(1080)
    expect(result?.visibleSourceRect.height).toBeCloseTo(607.5)
  })

  it('uses one source pixel per CSS pixel for Actual and rejects invalid dimensions', () => {
    const result = resolveMonitorContentRect({ stageRect, sourceWidth: 1920, sourceHeight: 1080, fitMode: 'actual' })
    expect(result?.effectiveScale).toBe(1)
    expect(result?.displayedContentRect).toEqual({ left: -460, top: -265, width: 1920, height: 1080 })
    expect(resolveMonitorContentRect({ stageRect, sourceWidth: 0, sourceHeight: 1080, fitMode: 'fit' })).toBeNull()
  })
})
