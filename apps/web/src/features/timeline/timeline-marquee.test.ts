import { describe, expect, it } from 'vitest'

import { buildTimelineViewModel } from './timeline-view-model'
import {
  MARQUEE_EDGE_BAND_PX,
  MARQUEE_MAX_SCROLL_PX_PER_FRAME,
  MARQUEE_MINIMUM_TICKS,
  applyMarquee,
  beginMarquee,
  cancelMarquee,
  marqueeAutoScrollPx,
  marqueeBounds,
  marqueeIsMeaningful,
  marqueeItemIds,
  marqueeModeFor,
  updateMarquee,
} from './timeline-marquee'
import { EMPTY_SELECTION, allTimelineItems, selectOnly } from './timeline-selection-v2'
import { projectWithAllTimelineFamilies, ticks } from './timeline-test-fixtures'

const model = () => buildTimelineViewModel({
  project: projectWithAllTimelineFamilies(),
  selectedItemIds: [],
  pending: null,
})

const box = (
  fromSeconds: number,
  toSeconds: number,
  mode: 'replace' | 'add' | 'toggle' = 'replace',
  base = EMPTY_SELECTION,
  fromLane = 'lane:overlay',
  toLane = 'lane:overlay',
) => {
  const session = beginMarquee({
    atTicks: ticks(fromSeconds),
    laneId: fromLane,
    mode,
    baseSelection: base,
  })
  return updateMarquee(session, ticks(toSeconds), toLane)
}

describe('T1.3 dragging a box', () => {
  it('reads the keys the same way every time', () => {
    expect(marqueeModeFor({ ctrlKey: false, metaKey: false, shiftKey: false })).toBe('replace')
    expect(marqueeModeFor({ ctrlKey: true, metaKey: false, shiftKey: false })).toBe('add')
    expect(marqueeModeFor({ ctrlKey: false, metaKey: true, shiftKey: false })).toBe('add')
    expect(marqueeModeFor({ ctrlKey: false, metaKey: false, shiftKey: true })).toBe('toggle')
  })

  it('catches the same things whichever way round it was dragged', () => {
    // Dragging right-to-left must not behave differently from left-to-right.
    const forwards = marqueeItemIds(model(), box(0, 20))
    const backwards = marqueeItemIds(model(), box(20, 0))
    expect([...forwards].sort()).toEqual([...backwards].sort())
  })

  it('settles the corners so start is never after end', () => {
    const bounds = marqueeBounds(model(), box(20, 5))
    expect(bounds).not.toBeNull()
    if (!bounds) return
    expect(bounds.startTicks).toBeLessThanOrEqual(bounds.endTicks)
    expect(bounds.firstLaneIndex).toBeLessThanOrEqual(bounds.lastLaneIndex)
  })

  it('catches what it TOUCHES, not only what it fully contains', () => {
    /*
     * A sixty-second clip cannot be fully contained in a box a person can
     * comfortably drag on a zoomed-in timeline. Requiring containment would make
     * long clips impossible to catch, and the user would conclude the feature
     * was broken rather than that they had misunderstood it.
     */
    const built = model()
    const overlay = allTimelineItems(built).find((item) => item.kind === 'media-overlay')
    if (!overlay) throw new Error('fixture has no overlay')
    const justTheEdge = updateMarquee(
      beginMarquee({
        atTicks: overlay.startTicks + overlay.durationTicks - 1,
        laneId: overlay.laneId,
        mode: 'replace',
        baseSelection: EMPTY_SELECTION,
      }),
      overlay.startTicks + overlay.durationTicks + MARQUEE_MINIMUM_TICKS,
      overlay.laneId,
    )
    expect(marqueeItemIds(built, justTheEdge)).toContain(overlay.id)
  })

  it('does not catch something that ends exactly where the box starts', () => {
    // Half-open on both sides, the same rule the whole project uses.
    const built = model()
    const overlay = allTimelineItems(built).find((item) => item.kind === 'media-overlay')
    if (!overlay) throw new Error('fixture has no overlay')
    const after = updateMarquee(
      beginMarquee({
        atTicks: overlay.startTicks + overlay.durationTicks,
        laneId: overlay.laneId,
        mode: 'replace',
        baseSelection: EMPTY_SELECTION,
      }),
      overlay.startTicks + overlay.durationTicks + MARQUEE_MINIMUM_TICKS * 2,
      overlay.laneId,
    )
    expect(marqueeItemIds(built, after)).not.toContain(overlay.id)
  })

  it('ignores rows above and below the box', () => {
    const built = model()
    const onOneRow = box(0, 60, 'replace', EMPTY_SELECTION, 'lane:overlay', 'lane:overlay')
    const caught = marqueeItemIds(built, onOneRow)
    const overlayIds = built.lanes.find((lane) => lane.id === 'lane:overlay')?.items.map((item) => item.id) ?? []
    for (const id of caught) expect(overlayIds).toContain(id)
  })
})

describe('T1.3 a twitch is not a box', () => {
  it('treats a tiny drag on empty space as letting go of everything', () => {
    // A hand that shakes two pixels while clicking must not silently select.
    const built = model()
    const twitch = box(5, 5.05, 'replace', selectOnly(built, allTimelineItems(built)[0].id))
    expect(marqueeIsMeaningful(twitch)).toBe(false)
    expect(applyMarquee(built, twitch).itemIds).toEqual([])
  })

  it('leaves an existing selection alone when a tiny drag was adding to it', () => {
    const built = model()
    const base = selectOnly(built, allTimelineItems(built)[0].id)
    const twitch = box(5, 5.05, 'add', base)
    expect(applyMarquee(built, twitch)).toEqual(base)
  })

  it('counts a drag onto a different row even when it barely moved sideways', () => {
    const dragDown = box(5, 5.01, 'replace', EMPTY_SELECTION, 'lane:overlay', 'lane:video')
    expect(marqueeIsMeaningful(dragDown)).toBe(true)
  })
})

describe('T1.3 what a box does to what was already picked', () => {
  it('replaces the selection on a plain drag', () => {
    const built = model()
    const base = selectOnly(built, allTimelineItems(built)[0].id)
    const after = applyMarquee(built, box(0, 60, 'replace', base))
    expect(after.itemIds.length).toBeGreaterThan(0)
  })

  it('adds to the selection when Ctrl is held', () => {
    const built = model()
    const first = allTimelineItems(built)[0]
    const base = selectOnly(built, first.id)
    const after = applyMarquee(built, box(0, 60, 'add', base))
    expect(after.itemIds).toContain(first.id)
  })

  it('flips what it touches when Shift is held', () => {
    const built = model()
    const overlay = allTimelineItems(built).find((item) => item.kind === 'media-overlay')
    if (!overlay) throw new Error('fixture has no overlay')
    const base = selectOnly(built, overlay.id)
    const after = applyMarquee(
      built,
      box(0, 60, 'toggle', base, overlay.laneId, overlay.laneId),
    )
    expect(after.itemIds).not.toContain(overlay.id)
  })

  it('puts back exactly what was there when the drag is cancelled', () => {
    // Escape never creates anything, and it never loses anything either.
    const built = model()
    const base = selectOnly(built, allTimelineItems(built)[0].id)
    expect(cancelMarquee(box(0, 60, 'replace', base))).toBe(base)
  })

  it('never invents an item that is not on the timeline', () => {
    const built = model()
    const existing = new Set(allTimelineItems(built).map((item) => item.id))
    for (const id of applyMarquee(built, box(0, 600)).itemIds) {
      expect(existing.has(id)).toBe(true)
    }
  })
})

describe('T1.3 scrolling when the pointer reaches an edge', () => {
  it('does nothing at all in the middle, which is most of the time', () => {
    expect(marqueeAutoScrollPx({ pointerXInViewportPx: 300, viewportWidthPx: 600 })).toBe(0)
  })

  it('scrolls left near the left edge and right near the right edge', () => {
    expect(marqueeAutoScrollPx({ pointerXInViewportPx: 4, viewportWidthPx: 600 })).toBeLessThan(0)
    expect(marqueeAutoScrollPx({ pointerXInViewportPx: 596, viewportWidthPx: 600 })).toBeGreaterThan(0)
  })

  it('speeds up the further into the band the pointer goes', () => {
    // Easing off slows down rather than stopping dead, so the user can aim.
    const shallow = Math.abs(marqueeAutoScrollPx({ pointerXInViewportPx: MARQUEE_EDGE_BAND_PX - 4, viewportWidthPx: 600 }))
    const deep = Math.abs(marqueeAutoScrollPx({ pointerXInViewportPx: 0, viewportWidthPx: 600 }))
    expect(deep).toBeGreaterThan(shallow)
    expect(deep).toBeLessThanOrEqual(MARQUEE_MAX_SCROLL_PX_PER_FRAME)
  })

  it('answers zero rather than a wrong number for a viewport with no width', () => {
    expect(marqueeAutoScrollPx({ pointerXInViewportPx: 10, viewportWidthPx: 0 })).toBe(0)
    expect(marqueeAutoScrollPx({ pointerXInViewportPx: Number.NaN, viewportWidthPx: 600 })).toBe(0)
  })
})
