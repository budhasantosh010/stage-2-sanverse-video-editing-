import { describe, expect, it } from 'vitest'
import { snapCanvasRect } from './canvas-snap'

describe('canvas snapping', () => {
  const frame = { x: 0, y: 0, width: 1000, height: 500 }

  it('snaps a visual centre to the frame centre and returns visible guides', () => {
    const result = snapCanvasRect({ rect: { x: 396, y: 198, width: 200, height: 100 }, frame, thresholdPx: 6 })
    expect(result.deltaX).toBe(4)
    expect(result.deltaY).toBe(2)
    expect(result.guides).toEqual([
      { axis: 'x', positionPx: 500, label: 'Frame center' },
      { axis: 'y', positionPx: 250, label: 'Frame center' },
    ])
  })

  it('snaps to frame and safe-margin edges deterministically', () => {
    expect(snapCanvasRect({ rect: { x: 96, y: 52, width: 200, height: 100 }, frame, thresholdPx: 6 })).toMatchObject({
      deltaX: 4,
      deltaY: -2,
    })
  })

  it('uses the earlier guide on equal-distance ties', () => {
    const result = snapCanvasRect({
      rect: { x: 4, y: 20, width: 2, height: 10 },
      frame: { x: 0, y: 0, width: 100, height: 100 },
      thresholdPx: 4,
    })
    expect(result.deltaX).toBe(-4)
    expect(result.guides[0]).toEqual({ axis: 'x', positionPx: 0, label: 'Frame edge' })
  })

  it('does nothing while Alt disables snapping or inputs are invalid', () => {
    expect(snapCanvasRect({ rect: { x: 499, y: 249, width: 1, height: 1 }, frame, disabled: true })).toEqual({
      deltaX: 0, deltaY: 0, guides: [],
    })
    expect(snapCanvasRect({ rect: { x: Number.NaN, y: 0, width: 1, height: 1 }, frame })).toEqual({
      deltaX: 0, deltaY: 0, guides: [],
    })
  })
})
