import { describe, expect, it } from 'vitest'
import { DEFAULT_VISUAL_PROPERTIES } from '@sanverse/edit-domain'
import {
  clientPointToNormalized,
  clientRectToNormalized,
  computeVideoContentRect,
  cropFromClientDelta,
  moveTransformByClientDelta,
  normalizedPointToClient,
  resizeUniformFromCorner,
  rotateFromClientPoint,
} from './canvas-geometry'

describe('canvas video content geometry', () => {
  it('uses the full element when content and element are both 16:9', () => {
    expect(computeVideoContentRect({ x: 10, y: 20, width: 1600, height: 900 }, 1920, 1080)).toEqual({
      x: 10, y: 20, width: 1600, height: 900,
    })
  })

  it('pillarboxes 16:9 content inside a wider element', () => {
    expect(computeVideoContentRect({ x: 0, y: 0, width: 2000, height: 900 }, 1920, 1080)).toEqual({
      x: 200, y: 0, width: 1600, height: 900,
    })
  })

  it('letterboxes 16:9 content inside a taller element', () => {
    expect(computeVideoContentRect({ x: 0, y: 0, width: 1600, height: 1200 }, 1920, 1080)).toEqual({
      x: 0, y: 150, width: 1600, height: 900,
    })
  })

  it('fits portrait content without guessing from screenshot dimensions', () => {
    expect(computeVideoContentRect({ x: 0, y: 0, width: 1000, height: 800 }, 1080, 1920)).toEqual({
      x: 275, y: 0, width: 450, height: 800,
    })
  })

  it('fails closed before metadata or layout dimensions exist', () => {
    expect(computeVideoContentRect({ x: 0, y: 0, width: 0, height: 800 }, 1920, 1080)).toBeNull()
    expect(computeVideoContentRect({ x: 0, y: 0, width: 1000, height: 800 }, 0, 0)).toBeNull()
  })

  it('round-trips client and normalized positions and rejects black bars', () => {
    const content = { x: 200, y: 100, width: 1600, height: 900 }
    const normalized = clientPointToNormalized({ x: 600, y: 325 }, content)
    expect(normalized).toEqual({ x: 0.25, y: 0.25 })
    expect(normalizedPointToClient(normalized!, content)).toEqual({ x: 600, y: 325 })
    expect(clientPointToNormalized({ x: 100, y: 325 }, content)).toBeNull()
  })

  it('converts exact client bounds into frame fractions without mutation', () => {
    const rect = Object.freeze({ x: 300, y: 250, width: 400, height: 225 })
    expect(clientRectToNormalized(rect, { x: 100, y: 100, width: 1600, height: 900 })).toEqual({
      x: 0.125, y: 1 / 6, width: 0.25, height: 0.25,
    })
    expect(rect).toEqual({ x: 300, y: 250, width: 400, height: 225 })
  })
})

describe('canvas transform geometry', () => {
  it('moves by exact displayed pixels converted to normalized frame units', () => {
    expect(moveTransformByClientDelta(DEFAULT_VISUAL_PROPERTIES.transform, { x: 16, y: -9 }, { x: 0, y: 0, width: 1600, height: 900 })).toMatchObject({
      translateX: 0.01,
      translateY: -0.01,
    })
  })

  it('constrains move to the dominant axis with Shift', () => {
    expect(moveTransformByClientDelta(DEFAULT_VISUAL_PROPERTIES.transform, { x: 30, y: 10 }, { x: 0, y: 0, width: 1000, height: 500 }, true)).toMatchObject({
      translateX: 0.03,
      translateY: 0,
    })
  })

  it('uniformly resizes around the centre with Alt', () => {
    const result = resizeUniformFromCorner({
      properties: DEFAULT_VISUAL_PROPERTIES,
      startRect: { x: 100, y: 100, width: 200, height: 100 },
      corner: 'bottom-right',
      currentClient: { x: 400, y: 250 },
      contentRect: { x: 0, y: 0, width: 1000, height: 500 },
      fromCenter: true,
    })
    expect(result?.transform.scale).toBeGreaterThan(1)
    expect(result?.transform.translateX).toBe(0)
    expect(result?.transform.translateY).toBe(0)
  })

  it('keeps the opposite corner fixed by adjusting translation', () => {
    const result = resizeUniformFromCorner({
      properties: DEFAULT_VISUAL_PROPERTIES,
      startRect: { x: 100, y: 100, width: 200, height: 100 },
      corner: 'bottom-right',
      currentClient: { x: 400, y: 250 },
      contentRect: { x: 0, y: 0, width: 1000, height: 500 },
      fromCenter: false,
    })
    expect(result?.transform.scale).toBeGreaterThan(1)
    expect(result?.transform.translateX).toBeGreaterThan(0)
    expect(result?.transform.translateY).toBeGreaterThan(0)
  })

  it('rotates around the visual centre and snaps Shift to 15 degrees', () => {
    expect(rotateFromClientPoint({
      startRotationDegrees: 0,
      center: { x: 100, y: 100 },
      startClient: { x: 200, y: 100 },
      currentClient: { x: 100, y: 200 },
      snap15: false,
    })).toBe(90)
    expect(rotateFromClientPoint({
      startRotationDegrees: 0,
      center: { x: 100, y: 100 },
      startClient: { x: 200, y: 100 },
      currentClient: { x: 190, y: 140 },
      snap15: true,
    })).toBe(30)
  })

  it('updates crop edges and refuses a crop that removes the whole visual', () => {
    expect(cropFromClientDelta({
      crop: DEFAULT_VISUAL_PROPERTIES.crop,
      edge: 'left',
      deltaPx: 25,
      visualSizePx: 200,
    })).toEqual({ top: 0, right: 0, bottom: 0, left: 0.125 })
    expect(cropFromClientDelta({
      crop: { top: 0, right: 0.4, bottom: 0, left: 0.5 },
      edge: 'left',
      deltaPx: 30,
      visualSizePx: 200,
    })).toBeNull()
  })
})
