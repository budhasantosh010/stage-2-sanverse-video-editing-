import { describe, expect, it } from 'vitest'

import { anchorFractions, layoutAnchoredBox, validateSpatialTarget } from './geometry'

describe('spatial targets', () => {
  it('accepts both coordinate spaces and never assumes one', () => {
    for (const coordinateSpace of ['source-normalized', 'composition-normalized'] as const) {
      expect(
        validateSpatialTarget({ coordinateSpace, point: { x: 0.5, y: 0.5 }, anchor: 'center' }),
      ).toMatchObject({ ok: true })
    }
    expect(
      validateSpatialTarget({ point: { x: 0.5, y: 0.5 }, anchor: 'center' }),
    ).toMatchObject({ ok: false })
  })

  it('rejects points outside the picture and unknown anchors', () => {
    expect(
      validateSpatialTarget({ coordinateSpace: 'composition-normalized', point: { x: 1.5, y: 0.5 }, anchor: 'center' }),
    ).toMatchObject({ ok: false })
    expect(
      validateSpatialTarget({ coordinateSpace: 'composition-normalized', point: { x: 0.5, y: 0.5 }, anchor: 'middle' }),
    ).toMatchObject({ ok: false })
  })
})

describe('anchored placement', () => {
  it('puts the named part of the box on the point', () => {
    expect(anchorFractions('top-left')).toEqual({ x: 0, y: 0 })
    expect(anchorFractions('center')).toEqual({ x: 0.5, y: 0.5 })
    expect(anchorFractions('bottom-right')).toEqual({ x: 1, y: 1 })
  })

  it('centres the box on the click, which is what pointing at a spot means', () => {
    const box = layoutAnchoredBox({
      point: { x: 0.5, y: 0.5 },
      anchor: 'center',
      boxWidth: 400,
      boxHeight: 100,
      frameWidth: 1920,
      frameHeight: 1080,
      safeMargin: 32,
    })
    expect(box).toEqual({ x: 760, y: 490, width: 400, height: 100 })
  })

  it('keeps a box clicked at the very edge fully inside the safe area', () => {
    const box = layoutAnchoredBox({
      point: { x: 1, y: 1 },
      anchor: 'center',
      boxWidth: 400,
      boxHeight: 100,
      frameWidth: 1920,
      frameHeight: 1080,
      safeMargin: 32,
    })
    expect(box.x + box.width).toBeLessThanOrEqual(1920 - 32)
    expect(box.y + box.height).toBeLessThanOrEqual(1080 - 32)
    expect(box.x).toBeGreaterThanOrEqual(32)
  })

  it('centres rather than inverting when the box cannot fit the safe area', () => {
    const box = layoutAnchoredBox({
      point: { x: 0, y: 0 },
      anchor: 'top-left',
      boxWidth: 1900,
      boxHeight: 60,
      frameWidth: 1000,
      frameHeight: 600,
      safeMargin: 32,
    })
    expect(box.x).toBe(Math.round((1000 - 1900) / 2))
    expect(Number.isFinite(box.x)).toBe(true)
  })

  it('produces whole pixels, because half a pixel means preview and export disagree', () => {
    const box = layoutAnchoredBox({
      point: { x: 0.333, y: 0.777 },
      anchor: 'center',
      boxWidth: 371,
      boxHeight: 93,
      frameWidth: 1920,
      frameHeight: 1080,
      safeMargin: 32,
    })
    expect(Number.isInteger(box.x)).toBe(true)
    expect(Number.isInteger(box.y)).toBe(true)
  })
})
