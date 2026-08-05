import { describe, expect, it } from 'vitest'

import type { TimelineGroupV1 } from '@sanverse/edit-domain'

import { buildTimelineViewModel } from './timeline-view-model'
import {
  EMPTY_SELECTION,
  allTimelineItems,
  boundPartners,
  clearSelection,
  extendSelection,
  isSelected,
  primarySelectedItemId,
  reconcileSelectionV2,
  selectAll,
  selectLane,
  selectOnly,
  selectRelativeToPlayhead,
  selectedItems,
  selectionCount,
  soleSelectedItemId,
  toggleSelection,
  type TimelineSelectionV2,
} from './timeline-selection-v2'
import {
  largeTimelineProject,
  projectWithAllTimelineFamilies,
  ticks,
} from './timeline-test-fixtures'

const modelOf = (project = projectWithAllTimelineFamilies(), selected: readonly string[] = []) =>
  buildTimelineViewModel({ project, selectedItemIds: selected, pending: null })

const itemsOfKind = (model: ReturnType<typeof modelOf>, kind: string) =>
  allTimelineItems(model).filter((item) => item.kind === kind)

describe('T1.2 picking things — one click', () => {
  it('picks exactly what was clicked when nothing is held down', () => {
    const model = modelOf()
    const overlay = itemsOfKind(model, 'media-overlay')[0]
    const selection = selectOnly(model, overlay.id)
    expect(selection.itemIds).toContain(overlay.id)
    expect(selection.anchorItemId).toBe(overlay.id)
  })

  it('picks nothing at all when asked for something that is not there', () => {
    // A stale id from a clip that was deleted a moment ago. Refusing to invent
    // a selection is what stops the next Delete landing on the wrong thing.
    expect(selectOnly(modelOf(), 'clip:clip_notreal')).toEqual(EMPTY_SELECTION)
  })

  it('lets go of everything, and that is not an edit', () => {
    expect(clearSelection()).toEqual(EMPTY_SELECTION)
    expect(selectionCount(EMPTY_SELECTION)).toBe(0)
  })
})

describe('T1.2 adding and removing with Ctrl or Cmd', () => {
  /*
   * These use the two pieces of B-roll rather than pieces of the main video.
   *
   * A piece of the main video is BOUND to the sound recorded with it, so
   * removing one removes both — which is right, and which would make these
   * tests about linking rather than about Ctrl-clicking.
   */
  it('adds a second thing without letting go of the first', () => {
    const model = modelOf()
    const [first, second] = itemsOfKind(model, 'media-overlay')
    const after = toggleSelection(model, selectOnly(model, first.id), second.id)
    expect(isSelected(after, first.id)).toBe(true)
    expect(isSelected(after, second.id)).toBe(true)
  })

  it('removes something that was already picked', () => {
    const model = modelOf()
    const [first, second] = itemsOfKind(model, 'media-overlay')
    const both = toggleSelection(model, selectOnly(model, first.id), second.id)
    const after = toggleSelection(model, both, second.id)
    expect(isSelected(after, second.id)).toBe(false)
    expect(isSelected(after, first.id)).toBe(true)
  })

  it('leaves the anchor on the thing just clicked, even when it was removed', () => {
    // That is where the user is looking, and it is where a following
    // Shift-click should measure from.
    const model = modelOf()
    const [first, second] = itemsOfKind(model, 'media-overlay')
    const both = toggleSelection(model, selectOnly(model, first.id), second.id)
    expect(toggleSelection(model, both, second.id).anchorItemId).toBe(second.id)
  })

  it('keeps one settled order, so two equal selections really are equal', () => {
    const model = modelOf()
    const [first, second] = itemsOfKind(model, 'media-overlay')
    const oneWay = toggleSelection(model, selectOnly(model, first.id), second.id)
    const otherWay = toggleSelection(model, selectOnly(model, second.id), first.id)
    expect(oneWay.itemIds).toEqual(otherWay.itemIds)
  })
})

describe('T1.2 a range with Shift', () => {
  /** Everything sitting on the overlay row, in the order it is drawn. */
  const overlayRow = () => {
    const model = modelOf()
    const lane = model.lanes.find((candidate) => candidate.id === 'lane:overlay')
    if (!lane || lane.items.length < 2) throw new Error('fixture has too few overlay items')
    return { model, items: lane.items }
  }

  it('takes everything between the anchor and the click, on the same row', () => {
    const { model, items } = overlayRow()
    const first = items[0]
    const last = items[items.length - 1]
    const selection = extendSelection(model, selectOnly(model, first.id), last.id)
    expect(selection.itemIds).toContain(first.id)
    expect(selection.itemIds).toContain(last.id)
    // Everything in between comes too, which is the whole point of a range.
    expect(selection.itemIds.length).toBeGreaterThanOrEqual(items.length)
  })

  it('does not move the anchor, so shift-clicking further keeps growing one range', () => {
    const { model, items } = overlayRow()
    const first = extendSelection(model, selectOnly(model, items[0].id), items[1].id)
    expect(first.anchorItemId).toBe(items[0].id)
    const second = extendSelection(model, first, items[items.length - 1].id)
    expect(second.anchorItemId).toBe(items[0].id)
    expect(second.itemIds.length).toBeGreaterThanOrEqual(first.itemIds.length)
  })

  it('behaves like a plain click when the anchor is on a different row', () => {
    // There is no honest range to build across rows. Predictable beats clever:
    // the user tries again and it works.
    const model = modelOf()
    const clip = itemsOfKind(model, 'clip')[0]
    const overlay = itemsOfKind(model, 'media-overlay')[0]
    const selection = extendSelection(model, selectOnly(model, clip.id), overlay.id)
    expect(selection.anchorItemId).toBe(overlay.id)
    expect(selection.itemIds).toContain(overlay.id)
  })
})

describe('T1.2 picking a lot at once', () => {
  it('takes everything on the timeline', () => {
    const model = modelOf()
    const everything = selectAll(model)
    expect(everything.itemIds.length).toBe(allTimelineItems(model).length)
  })

  it('takes everything on one row and nothing on the others', () => {
    const model = modelOf()
    const lane = model.lanes.find((candidate) => candidate.items.length > 0)
    if (!lane) throw new Error('fixture has no items')
    const selection = selectLane(model, lane.id)
    for (const item of lane.items) expect(isSelected(selection, item.id)).toBe(true)
  })

  it('counts a clip the playhead is sitting INSIDE as "before"', () => {
    /*
     * Judged on where an item BEGINS, not on whether it touches the playhead.
     * A clip the playhead is in the middle of began before now, so it belongs
     * to "before". Using "touches" instead would put the same clip in both
     * answers, and picking before-then-after would move it twice.
     */
    const model = modelOf()
    const clip = itemsOfKind(model, 'clip')[0]
    const inside = clip.startTicks + Math.floor(clip.durationTicks / 2)
    expect(selectRelativeToPlayhead(model, inside, 'before').itemIds).toContain(clip.id)
    expect(selectRelativeToPlayhead(model, inside, 'after').itemIds).not.toContain(clip.id)
  })

  it('picks nothing when there is nothing on that side', () => {
    expect(selectRelativeToPlayhead(modelOf(), ticks(99_999), 'after')).toEqual(EMPTY_SELECTION)
  })
})

describe('T1.2 things that are bound together', () => {
  const grouped = (ids: readonly string[]): readonly TimelineGroupV1[] => Object.freeze([
    Object.freeze({ groupId: 'group_aaaaaaaa', memberItemIds: Object.freeze([...ids].sort()) }),
  ])

  it('picks the whole group when one member is clicked', () => {
    const model = modelOf()
    const overlay = itemsOfKind(model, 'media-overlay')[0]
    const musicItem = itemsOfKind(model, 'music')[0]
    const groups = grouped([overlay.id, musicItem.id])
    const selection = selectOnly(model, overlay.id, groups)
    expect(isSelected(selection, musicItem.id)).toBe(true)
  })

  it('lets go of the whole group when one member is Ctrl-clicked off', () => {
    const model = modelOf()
    const overlay = itemsOfKind(model, 'media-overlay')[0]
    const musicItem = itemsOfKind(model, 'music')[0]
    const groups = grouped([overlay.id, musicItem.id])
    const picked = selectOnly(model, overlay.id, groups)
    const after = toggleSelection(model, picked, overlay.id, groups)
    expect(isSelected(after, overlay.id)).toBe(false)
    expect(isSelected(after, musicItem.id)).toBe(false)
  })

  it('ignores a group member that is no longer on the timeline', () => {
    const model = modelOf()
    const overlay = itemsOfKind(model, 'media-overlay')[0]
    const groups = grouped([overlay.id, 'overlay:broll_gonegone:0'])
    expect(boundPartners(model, overlay.id, groups)).toEqual([overlay.id])
  })

  it('picks a clip and the sound recorded WITH it, because nobody chose that link', () => {
    const model = modelOf()
    const clip = itemsOfKind(model, 'clip')[0]
    const partners = boundPartners(model, clip.id, [])
    const dialogue = allTimelineItems(model).find(
      (item) => item.laneId !== clip.laneId && item.clipId === clip.clipId,
    )
    if (dialogue) expect(partners).toContain(dialogue.id)
    expect(partners).toContain(clip.id)
  })
})

describe('T1.2 what the panels are shown', () => {
  it('shows the one thing when exactly one is picked', () => {
    const model = modelOf()
    const clip = itemsOfKind(model, 'clip')[0]
    const one: TimelineSelectionV2 = Object.freeze({ itemIds: [clip.id], anchorItemId: clip.id })
    expect(soleSelectedItemId(one)).toBe(clip.id)
    expect(primarySelectedItemId(one)).toBe(clip.id)
  })

  it('shows the thing the user pointed at when several are picked', () => {
    // NOT the first of the list, which has no meaning. The anchor is the last
    // thing they deliberately clicked.
    const several: TimelineSelectionV2 = Object.freeze({
      itemIds: ['clip:clip_a', 'clip:clip_b', 'clip:clip_c'],
      anchorItemId: 'clip:clip_b',
    })
    expect(soleSelectedItemId(several)).toBeNull()
    expect(primarySelectedItemId(several)).toBe('clip:clip_b')
  })

  it('shows nothing rather than guessing when the anchor is not in the selection', () => {
    const odd: TimelineSelectionV2 = Object.freeze({
      itemIds: ['clip:clip_a', 'clip:clip_b'],
      anchorItemId: 'clip:clip_gone',
    })
    expect(primarySelectedItemId(odd)).toBeNull()
  })

  it('returns the picked items themselves, in drawing order', () => {
    const model = modelOf()
    const clips = itemsOfKind(model, 'clip').slice(0, 2)
    const selection: TimelineSelectionV2 = Object.freeze({
      itemIds: clips.map((clip) => clip.id),
      anchorItemId: clips[0].id,
    })
    expect(selectedItems(model, selection).map((item) => item.id))
      .toEqual(allTimelineItems(model).filter((item) => selection.itemIds.includes(item.id)).map((item) => item.id))
  })
})

describe('T1.2 keeping a selection honest', () => {
  it('drops only what is genuinely no longer on the timeline', () => {
    const model = modelOf()
    const clip = itemsOfKind(model, 'clip')[0]
    const selection: TimelineSelectionV2 = Object.freeze({
      itemIds: [clip.id, 'overlay:broll_deleted:0'],
      anchorItemId: clip.id,
    })
    const reconciled = reconcileSelectionV2(model, selection)
    expect(reconciled.itemIds).toEqual([clip.id])
  })

  it('changes nothing at all when everything picked is still there', () => {
    // Returning the same object matters: a new object every render would make
    // React think the selection changed on every frame.
    const model = modelOf()
    const selection = selectOnly(model, itemsOfKind(model, 'clip')[0].id)
    expect(reconcileSelectionV2(model, selection)).toBe(selection)
  })

  it('KEEPS things that are only scrolled out of view', () => {
    /*
     * The single most important test in this file.
     *
     * The projection holds every item in the project; only the drawing is
     * limited to what is on screen. If this ever started reading the visible
     * items instead, a user who picked four clips and scrolled would come back
     * to fewer than four with no idea why.
     */
    const model = modelOf(largeTimelineProject())
    const everything = selectAll(model)
    expect(everything.itemIds.length).toBeGreaterThan(20)
    expect(reconcileSelectionV2(model, everything).itemIds.length).toBe(everything.itemIds.length)
  })

  it('moves the anchor to something that still exists when it goes', () => {
    const model = modelOf()
    const clip = itemsOfKind(model, 'clip')[0]
    const selection: TimelineSelectionV2 = Object.freeze({
      itemIds: [clip.id],
      anchorItemId: 'clip:clip_gonegone',
    })
    expect(reconcileSelectionV2(model, selection).anchorItemId).toBe(clip.id)
  })
})
