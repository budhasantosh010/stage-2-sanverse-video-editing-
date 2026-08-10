import { describe, expect, it } from 'vitest'
import { pictureInPictureTransition, resolveProductStorySafePlacement } from './product-story.ts'

describe('A20 product-story primitives', () => {
  it('resolves deterministic safe placements at all seven semantic anchors', () => {
    const placements = ['top-left','top-right','center-left','center','center-right','bottom-left','bottom-right'] as const
    for (const placement of placements) {
      const first = resolveProductStorySafePlacement({ width: 1920, height: 1080, placement, safeOffset: 80, widthFraction: .4, heightFraction: .3 })
      const second = resolveProductStorySafePlacement({ width: 1920, height: 1080, placement, safeOffset: 80, widthFraction: .4, heightFraction: .3 })
      expect(first).toEqual(second)
      expect(first.left).toBeGreaterThanOrEqual(0)
      expect(first.top).toBeGreaterThanOrEqual(0)
      expect(first.left + first.maxWidth).toBeLessThanOrEqual(1920)
      expect(first.top + first.maxHeight).toBeLessThanOrEqual(1080)
    }
  })

  it('places top-right and bottom-left regions against the requested safe inset', () => {
    const topRight = resolveProductStorySafePlacement({ width: 1000, height: 800, placement: 'top-right', safeOffset: 50, widthFraction: .4, heightFraction: .25 })
    expect(topRight.left + topRight.maxWidth).toBe(950)
    expect(topRight.top).toBe(50)
    const bottomLeft = resolveProductStorySafePlacement({ width: 1000, height: 800, placement: 'bottom-left', safeOffset: 50, widthFraction: .4, heightFraction: .25 })
    expect(bottomLeft.left).toBe(50)
    expect(bottomLeft.top + bottomLeft.maxHeight).toBe(750)
  })

  it('fails closed for impossible placement inputs', () => {
    expect(() => resolveProductStorySafePlacement({ width: 0, height: 1080, placement: 'center' })).toThrow(RangeError)
    expect(() => resolveProductStorySafePlacement({ width: 1920, height: 1080, placement: 'center', safeOffset: 999 })).toThrow(RangeError)
    expect(() => resolveProductStorySafePlacement({ width: 1920, height: 1080, placement: 'center', widthFraction: 1.2 })).toThrow(RangeError)
  })

  it('returns pure analytic PIP enter/exit states without wall-clock history', () => {
    expect(pictureInPictureTransition(0)).toMatchObject({ opacity: 0, scale: .78, translateX: 28, translateY: 22 })
    expect(pictureInPictureTransition(1)).toMatchObject({ opacity: 1, scale: 1, translateX: 0, translateY: 0 })
    expect(pictureInPictureTransition(.42)).toEqual(pictureInPictureTransition(.42))
    expect(pictureInPictureTransition(0, { direction: 'exit' }).opacity).toBe(1)
    expect(pictureInPictureTransition(1, { direction: 'exit' }).opacity).toBe(0)
  })
})
