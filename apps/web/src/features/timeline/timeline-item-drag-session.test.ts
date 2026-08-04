import { describe, expect, it } from 'vitest'

import {
  TIMELINE_ITEM_DRAG_SCHEMA_VERSION,
  advanceTimelineItemDrag,
  beginTimelineItemDrag,
  timelineItemDragAction,
  timelineItemDragGhost,
} from './timeline-item-drag-session'

/**
 * Gate C1.3 — dragging something already on the timeline.
 *
 * The one rule: ONE GESTURE = ONE CHANGE SET = ONE UNDO. Nothing in this file
 * touches a project, and that is the point — a drag across the screen fires
 * hundreds of pointer events, and an edit per event would be hundreds of
 * revisions and hundreds of Undos for one movement of the hand.
 */

const T = 1_440_000

const session = (overrides: Record<string, unknown> = {}) =>
  Object.freeze({
    ...beginTimelineItemDrag({
      itemId: 'overlay:broll_0001:0',
      laneId: 'lane:overlay',
      grip: 'body',
      startTicks: 8 * T,
      durationTicks: 4 * T,
      pointerTicks: 10 * T,
      placementMode: 'normal',
      baseRevision: 7,
    }),
    ...overrides,
  })

describe('a drag session', () => {
  it('starts as pending, never as valid, so no green ghost flashes before the check', () => {
    const started = session()
    expect(started.schemaVersion).toBe(TIMELINE_ITEM_DRAG_SCHEMA_VERSION)
    expect(started.validity).toBe('pending')
    expect(started.refusal).toBeNull()
  })

  it('remembers the revision the gesture began on, so a late drop refuses', () => {
    expect(session().baseRevision).toBe(7)
  })

  it('moves the ghost without deciding anything', () => {
    const moved = advanceTimelineItemDrag({
      session: session(),
      rawTargetTicks: 11 * T + 13,
      snappedTargetTicks: 11 * T,
      refusal: null,
    })
    expect(moved.rawTargetTicks).toBe(11 * T + 13)
    expect(moved.snappedTargetTicks).toBe(11 * T)
    expect(moved.validity).toBe('valid')
  })

  it('carries the exact refusal the release would give, so the two cannot disagree', () => {
    const refused = advanceTimelineItemDrag({
      session: session(),
      rawTargetTicks: 20 * T,
      snappedTargetTicks: 20 * T,
      refusal: { code: 'COLLISION', message: 'There is already something on this track at that moment.' },
    })
    expect(refused.validity).toBe('refused')
    expect(refused.refusal?.code).toBe('COLLISION')
  })

  it('keeps the original position untouched throughout, so cancelling restores it exactly', () => {
    const moved = advanceTimelineItemDrag({
      session: session(),
      rawTargetTicks: 25 * T,
      snappedTargetTicks: 25 * T,
      refusal: null,
    })
    expect(moved.originalStartTicks).toBe(8 * T)
    expect(moved.originalDurationTicks).toBe(4 * T)
  })
})

describe('what a release should ask for', () => {
  it('asks to move when the body was dragged', () => {
    const moved = advanceTimelineItemDrag({
      session: session(),
      rawTargetTicks: 14 * T,
      snappedTargetTicks: 14 * T,
      refusal: null,
    })
    expect(timelineItemDragAction(moved)).toEqual({ type: 'move', toStartTicks: 14 * T })
  })

  it('asks for nothing when the item was put back where it was', () => {
    // A change set that changes nothing would still take a revision and a slot
    // in Undo, which reads to the user as a broken button.
    const putBack = advanceTimelineItemDrag({
      session: session(),
      rawTargetTicks: 8 * T,
      snappedTargetTicks: 8 * T,
      refusal: null,
    })
    expect(timelineItemDragAction(putBack)).toBeNull()
  })

  it('asks to trim the head when the left edge was dragged', () => {
    const trimmed = advanceTimelineItemDrag({
      session: session({ grip: 'start' }),
      rawTargetTicks: 9 * T,
      snappedTargetTicks: 9 * T,
      refusal: null,
    })
    expect(timelineItemDragAction(trimmed)).toEqual({ type: 'trim-start', toStartTicks: 9 * T })
  })

  it('asks to trim the tail when the right edge was dragged', () => {
    const trimmed = advanceTimelineItemDrag({
      session: session({ grip: 'end' }),
      rawTargetTicks: 11 * T,
      snappedTargetTicks: 11 * T,
      refusal: null,
    })
    expect(timelineItemDragAction(trimmed)).toEqual({ type: 'trim-end', toEndTicks: 11 * T })
  })

  it('asks for nothing when an edge was dragged back to where it started', () => {
    const untouched = advanceTimelineItemDrag({
      session: session({ grip: 'end' }),
      rawTargetTicks: 12 * T,
      snappedTargetTicks: 12 * T,
      refusal: null,
    })
    expect(timelineItemDragAction(untouched)).toBeNull()
  })
})

describe('where the ghost is drawn', () => {
  it('slides the whole item when the body is held', () => {
    const moved = advanceTimelineItemDrag({
      session: session(),
      rawTargetTicks: 14 * T,
      snappedTargetTicks: 14 * T,
      refusal: null,
    })
    expect(timelineItemDragGhost(moved)).toEqual({ startTicks: 14 * T, durationTicks: 4 * T })
  })

  it('pulls the head in without moving the tail', () => {
    const trimmed = advanceTimelineItemDrag({
      session: session({ grip: 'start' }),
      rawTargetTicks: 9 * T,
      snappedTargetTicks: 9 * T,
      refusal: null,
    })
    expect(timelineItemDragGhost(trimmed)).toEqual({ startTicks: 9 * T, durationTicks: 3 * T })
  })

  it('pulls the tail in without moving the head', () => {
    const trimmed = advanceTimelineItemDrag({
      session: session({ grip: 'end' }),
      rawTargetTicks: 10 * T,
      snappedTargetTicks: 10 * T,
      refusal: null,
    })
    expect(timelineItemDragGhost(trimmed)).toEqual({ startTicks: 8 * T, durationTicks: 2 * T })
  })

  it('never draws a negative-length ghost when an edge is dragged past the other', () => {
    const inverted = advanceTimelineItemDrag({
      session: session({ grip: 'end' }),
      rawTargetTicks: 2 * T,
      snappedTargetTicks: 2 * T,
      refusal: null,
    })
    expect(timelineItemDragGhost(inverted).durationTicks).toBe(0)
  })
})
