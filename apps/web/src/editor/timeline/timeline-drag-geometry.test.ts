import { describe, expect, it } from 'vitest'
import { dragEdgeScroll, dragTrackAt } from './timeline-drag-geometry'
const viewport = { left: 100, right: 700, top: 200, bottom: 500 }
describe('bounded timeline drag geometry', () => {
  it('pans both axes while held against a visible edge', () => {
    expect(dragEdgeScroll({ x: 698, y: 498 }, viewport, 16)).toEqual({ x: 10.397, y: 10.397 })
    expect(dragEdgeScroll({ x: 102, y: 202 }, viewport, 16)).toEqual({ x: -10.397, y: -10.397 })
  })
  it('does not scroll outside the viewport or away from edges', () => {
    expect(dragEdgeScroll({ x: 701, y: 300 }, viewport, 16)).toEqual({ x: 0, y: 0 })
    expect(dragEdgeScroll({ x: 400, y: 350 }, viewport, 16)).toEqual({ x: 0, y: 0 })
  })
  it('bounds a delayed frame instead of jumping after a stalled tab', () => {
    expect(dragEdgeScroll({ x: 700, y: 500 }, viewport, 1000)).toEqual(dragEdgeScroll({ x: 700, y: 500 }, viewport, 32))
  })
  it('targets the visible row, never a row hidden beyond the scroll port', () => {
    const tracks = [{ ...viewport, top: 210, bottom: 250, trackId: 'video' }, { ...viewport, top: 250, bottom: 290, trackId: 'audio' }]
    expect(dragTrackAt({ x: 350, y: 270 }, viewport, tracks)).toBe('audio')
    expect(dragTrackAt({ x: 90, y: 270 }, viewport, tracks)).toBeNull()
    expect(dragTrackAt({ x: 350, y: 510 }, viewport, [{ ...viewport, top: 505, bottom: 550, trackId: 'offscreen' }])).toBeNull()
  })
})
