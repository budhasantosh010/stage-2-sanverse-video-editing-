import { describe, expect, it } from 'vitest'
import { DEFAULT_VISUAL_PROPERTIES } from '@sanverse/edit-domain'
import { beginCanvasInteraction, updateCanvasInteraction } from './canvas-gesture-state'

describe('detached canvas gesture state', () => {
  it('records one immutable starting transaction without changing project state', () => {
    const session = beginCanvasInteraction({
      mode: 'move',
      pointerId: 7,
      startClient: { x: 10, y: 20 },
      startRect: { x: 100, y: 100, width: 200, height: 100 },
      properties: DEFAULT_VISUAL_PROPERTIES,
    })
    expect(session).toMatchObject({ mode: 'move', pointerId: 7, currentProperties: DEFAULT_VISUAL_PROPERTIES })
    expect(Object.isFrozen(session)).toBe(true)
  })

  it('fails closed for zero or non-finite bounds', () => {
    expect(beginCanvasInteraction({
      mode: 'move', pointerId: 1, startClient: { x: 0, y: 0 },
      startRect: { x: 0, y: 0, width: 0, height: 20 }, properties: DEFAULT_VISUAL_PROPERTIES,
    })).toBeNull()
  })

  it('updates only the detached current value and guide list', () => {
    const session = beginCanvasInteraction({
      mode: 'move', pointerId: 1, startClient: { x: 0, y: 0 },
      startRect: { x: 0, y: 0, width: 100, height: 100 }, properties: DEFAULT_VISUAL_PROPERTIES,
    })!
    const nextProperties = Object.freeze({
      ...DEFAULT_VISUAL_PROPERTIES,
      transform: Object.freeze({ ...DEFAULT_VISUAL_PROPERTIES.transform, translateX: 0.1 }),
    })
    const next = updateCanvasInteraction(session, nextProperties, [{ axis: 'x', positionPx: 500, label: 'Frame center' }])
    expect(next.currentProperties.transform.translateX).toBe(0.1)
    expect(session.currentProperties.transform.translateX).toBe(0)
    expect(next.guides).toHaveLength(1)
  })
})
