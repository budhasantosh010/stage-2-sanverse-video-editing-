import { describe, expect, it } from 'vitest'

import {
  PROJECT_TIMESCALE,
  acceptChangeSet,
  activeOverlayOperations,
  createIdFactory,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'
import {
  changeSetOf,
  ms,
  testMediaOverlay,
  testMultiAssetProject,
  testMusic,
  testTitle,
} from '@sanverse/edit-domain/test-fixtures'

import {
  MIN_ITEM_TICKS,
  laneSpans,
  parseTimelineItemId,
  planTimelineItemAction,
  spansOverlap,
  trackIdForItem,
  type TimelineItemAction,
} from './timeline-item-operations'

const ids = createIdFactory('changeset_itemaction01')

const accept = (project: EditProject, changeSetId: string, operations: readonly unknown[]): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const plan = (
  project: EditProject,
  itemId: string,
  action: TimelineItemAction,
  overrides: Partial<Parameters<typeof planTimelineItemAction>[0]> = {},
) =>
  planTimelineItemAction({
    project,
    itemId,
    action,
    lockedTrackIds: [],
    pendingProposalExists: false,
    exportInProgress: false,
    expectedRevision: project.revision,
    ids,
    ...overrides,
  })

/** The fixture footage is 30 s; B-roll sits on source seconds 8-12. */
const withBroll = (): EditProject =>
  accept(testMultiAssetProject(), 'changeset_addbroll001', [testMediaOverlay()])

const withMusic = (): EditProject =>
  accept(testMultiAssetProject(), 'changeset_addmusic001', [testMusic()])

const applyPlan = (project: EditProject, operations: readonly EditOperation[]): EditProject =>
  accept(project, 'changeset_applied0001', operations)

describe('reading a timeline item id', () => {
  it('names the thing each id points at, and refuses anything it does not know', () => {
    expect(parseTimelineItemId('overlay:broll_0001:0')).toEqual({ family: 'overlay', targetId: 'broll_0001' })
    expect(parseTimelineItemId('overlay:title_0001:2')).toEqual({ family: 'overlay', targetId: 'title_0001' })
    expect(parseTimelineItemId('music:music_0001:0')).toEqual({ family: 'music', targetId: 'music_0001' })
    expect(parseTimelineItemId('clip:clip_aaaaaaaa')).toEqual({ family: 'clip', targetId: 'clip_aaaaaaaa' })
    for (const bad of ['', 'overlay:broll_0001', 'caption:x:0', 'overlay:asset_aaaa:0']) {
      expect(parseTimelineItemId(bad)).toBeNull()
    }
  })

  it('puts each item on exactly one of the five tracks', () => {
    expect(trackIdForItem('overlay:broll_0001:0')).toBe('V2')
    expect(trackIdForItem('music:music_0001:0')).toBe('A2')
    expect(trackIdForItem('clip:clip_aaaaaaaa')).toBe('V1')
    expect(trackIdForItem('nonsense')).toBeNull()
  })
})

describe('what is already on a lane', () => {
  it('lists B-roll on V2 and music on A2, and keeps titles out of the collision question', () => {
    const project = accept(withBroll(), 'changeset_addtitle001', [testTitle(), testMusic()])
    const v2 = laneSpans(project, 'V2')
    expect(v2.map((span) => span.targetId)).toEqual(['broll_0001'])
    // Words on top of a picture is what a title is for, so it is not a clash.
    expect(v2.some((span) => span.targetId === 'title_0001')).toBe(false)
    expect(laneSpans(project, 'A2').map((span) => span.targetId)).toEqual(['music_0001'])
  })

  it('counts two spans as overlapping only when they share an instant', () => {
    const a = { startTicks: 0, durationTicks: 100 }
    expect(spansOverlap(a, { startTicks: 99, durationTicks: 10 })).toBe(true)
    // Half-open: one ending exactly where the next begins is not an overlap.
    expect(spansOverlap(a, { startTicks: 100, durationTicks: 10 })).toBe(false)
  })
})

describe('P1-F.1A C1.10 moving something already on the timeline', () => {
  it('moves B-roll by re-pinning it to the moment of footage now underneath it', () => {
    const project = withBroll()
    const before = laneSpans(project, 'V2')[0]
    const result = plan(project, 'overlay:broll_0001:0', { type: 'move', toStartTicks: ms(14_000).ticks })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const moved = applyPlan(project, result.operations)
    const after = laneSpans(moved, 'V2')[0]
    expect(after.startTicks).toBe(ms(14_000).ticks)
    expect(after.durationTicks).toBe(before.durationTicks)
  })

  it('is one operation and therefore one Undo', () => {
    const result = plan(withBroll(), 'overlay:broll_0001:0', { type: 'move', toStartTicks: ms(14_000).ticks })
    expect(result.ok && result.operations).toHaveLength(1)
  })

  it('moves music by simple arithmetic, because music is measured on the finished video', () => {
    const project = withMusic()
    const result = plan(project, 'music:music_0001:0', { type: 'move', toStartTicks: ms(5_000).ticks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const moved = applyPlan(project, result.operations)
    expect(laneSpans(moved, 'A2')[0].startTicks).toBe(ms(5_000).ticks)
  })

  it('refuses to drop one clip on top of another rather than hiding one behind the other', () => {
    let project = withBroll()
    project = accept(project, 'changeset_addsecond01', [{
      ...testMediaOverlay(),
      operationId: 'operation_broll002',
      overlayId: 'broll_0002',
      sourceInterval: { start: ms(20_000), duration: ms(4_000) },
    }])
    const result = plan(project, 'overlay:broll_0001:0', { type: 'move', toStartTicks: ms(21_000).ticks })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.code).toBe('COLLISION')
  })

  it('refuses to move a clip past the end of the video', () => {
    const result = plan(withBroll(), 'overlay:broll_0001:0', { type: 'move', toStartTicks: ms(29_000).ticks })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.code).toBe('OUT_OF_RANGE')
  })
})

describe('P1-F.1A C1.11 trimming', () => {
  it('trimming the head of B-roll also starts the clip later in its own file', () => {
    // Otherwise the frame that was showing at a moment would change, and the
    // user would see the clip restart rather than begin later.
    const project = withBroll()
    const result = plan(project, 'overlay:broll_0001:0', { type: 'trim-start', toStartTicks: ms(9_000).ticks })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const trimmed = applyPlan(project, result.operations)
    const overlay = activeOverlayOperations(trimmed).find((operation) => operation.kind === 'add-media-overlay')
    expect(overlay?.kind === 'add-media-overlay' && overlay.overlaySourceStart.ticks)
      .toBe(testMediaOverlay().overlaySourceStart.ticks + ms(1_000).ticks)
    expect(laneSpans(trimmed, 'V2')[0]).toMatchObject({
      startTicks: ms(9_000).ticks,
      durationTicks: ms(3_000).ticks,
    })
  })

  it('trimming the tail leaves the start of the clip exactly where it was', () => {
    const project = withBroll()
    const result = plan(project, 'overlay:broll_0001:0', { type: 'trim-end', toEndTicks: ms(10_000).ticks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const trimmed = applyPlan(project, result.operations)
    expect(laneSpans(trimmed, 'V2')[0]).toMatchObject({
      startTicks: ms(8_000).ticks,
      durationTicks: ms(2_000).ticks,
    })
  })

  it('refuses a trim that would leave nothing to grab hold of', () => {
    const start = ms(8_000).ticks
    const result = plan(withBroll(), 'overlay:broll_0001:0', {
      type: 'trim-end',
      toEndTicks: start + MIN_ITEM_TICKS - 1,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.code).toBe('TOO_SHORT')
  })

  it('refuses to show more of a clip than the clip contains', () => {
    // The B-roll fixture is 12 s and already starts 1 s in, so 12 s of it
    // cannot be shown however far the handle is dragged.
    const project = withBroll()
    const result = plan(project, 'overlay:broll_0001:0', { type: 'trim-end', toEndTicks: ms(20_500).ticks })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.code).toBe('SOURCE_EXHAUSTED')
  })

  it('trimming music shortens it and gives it a real length', () => {
    const project = withMusic()
    const result = plan(project, 'music:music_0001:0', { type: 'trim-end', toEndTicks: ms(6_000).ticks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const trimmed = applyPlan(project, result.operations)
    expect(laneSpans(trimmed, 'A2')[0].durationTicks).toBe(ms(6_000).ticks)
  })

  it('trimming the head of music also starts later in the song', () => {
    const project = withMusic()
    const result = plan(project, 'music:music_0001:0', { type: 'trim-start', toStartTicks: ms(4_000).ticks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const trimmed = applyPlan(project, result.operations)
    const music = activeOverlayOperations(trimmed).find((operation) => operation.kind === 'add-music')
    expect(music?.kind === 'add-music' && music.sourceStart.ticks).toBe(ms(4_000).ticks)
    expect(laneSpans(trimmed, 'A2')[0].startTicks).toBe(ms(4_000).ticks)
  })
})

describe('P1-F.1A C1.12 splitting', () => {
  it('splits B-roll into two halves that together cover exactly what one covered', () => {
    const project = withBroll()
    const before = laneSpans(project, 'V2')[0]
    const result = plan(project, 'overlay:broll_0001:0', { type: 'split', atTicks: ms(10_000).ticks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.operations).toHaveLength(2)

    const split = applyPlan(project, result.operations)
    const spans = laneSpans(split, 'V2')
    expect(spans).toHaveLength(2)
    expect(spans[0]).toMatchObject({ startTicks: before.startTicks, durationTicks: ms(2_000).ticks })
    expect(spans[1]).toMatchObject({ startTicks: ms(10_000).ticks, durationTicks: ms(2_000).ticks })
    expect(spans[0].durationTicks + spans[1].durationTicks).toBe(before.durationTicks)
  })

  it('makes the right half resume where the left half stopped, not start over', () => {
    const project = withBroll()
    const result = plan(project, 'overlay:broll_0001:0', { type: 'split', atTicks: ms(10_000).ticks })
    if (!result.ok) throw new Error('expected a plan')
    const split = applyPlan(project, result.operations)
    const overlays = activeOverlayOperations(split).filter((operation) => operation.kind === 'add-media-overlay')
    const starts = overlays.map((operation) =>
      operation.kind === 'add-media-overlay' ? operation.overlaySourceStart.ticks : -1,
    ).sort((left, right) => left - right)
    expect(starts).toEqual([ms(1_000).ticks, ms(3_000).ticks])
  })

  it('gives the new half a name derived from the change set, never a random one', () => {
    // Random names would make the same history replay to a different file.
    const first = plan(withBroll(), 'overlay:broll_0001:0', { type: 'split', atTicks: ms(10_000).ticks })
    const second = plan(withBroll(), 'overlay:broll_0001:0', { type: 'split', atTicks: ms(10_000).ticks })
    expect(first.ok && second.ok && JSON.stringify(first.operations)).toBe(
      second.ok ? JSON.stringify(second.operations) : 'different',
    )
  })

  it('refuses to split on an edge, where one half would be nothing', () => {
    const result = plan(withBroll(), 'overlay:broll_0001:0', { type: 'split', atTicks: ms(8_000).ticks })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.code).toBe('OUT_OF_RANGE')
  })

  it('splits music into two pieces that carry on through the song', () => {
    const project = withMusic()
    const result = plan(project, 'music:music_0001:0', { type: 'split', atTicks: ms(10_000).ticks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const split = applyPlan(project, result.operations)
    const spans = laneSpans(split, 'A2')
    expect(spans).toHaveLength(2)
    expect(spans[0]).toMatchObject({ startTicks: 0, durationTicks: ms(10_000).ticks })
    expect(spans[1].startTicks).toBe(ms(10_000).ticks)
  })
})

describe('P1-F.1A C1.13 taking something off the timeline', () => {
  it('deletes B-roll and leaves the video the same length', () => {
    const project = withBroll()
    const result = plan(project, 'overlay:broll_0001:0', { type: 'delete', ripple: false })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const deleted = applyPlan(project, result.operations)
    expect(laneSpans(deleted, 'V2')).toEqual([])
  })

  it('closes the gap on the music track, where closing it is exact', () => {
    // Two beds end to end: the first runs 0-12 s, the second 12-18 s.
    let project = accept(testMultiAssetProject(), 'changeset_addmusic001', [
      { ...testMusic(), durationTicks: ms(12_000) },
    ])
    project = accept(project, 'changeset_addsecond01', [{
      ...testMusic(),
      operationId: 'operation_music002',
      musicId: 'music_0002',
      compositionStart: ms(12_000),
      durationTicks: ms(6_000),
    }])
    const result = plan(project, 'music:music_0001:0', { type: 'delete', ripple: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const rippled = applyPlan(project, result.operations)
    expect(laneSpans(rippled, 'A2')).toEqual([
      { targetId: 'music_0002', startTicks: 0, durationTicks: ms(6_000).ticks },
    ])
  })

  it('refuses to close the gap on B-roll, and says what to do instead', () => {
    // Closing it would re-pin every later clip to earlier footage, which moves
    // them onto different moments of the recording — never what was meant.
    const result = plan(withBroll(), 'overlay:broll_0001:0', { type: 'delete', ripple: true })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toContain('Use Delete instead')
  })
})

describe('P1-F.1A refusals that protect the user', () => {
  it('refuses everything on a locked track', () => {
    const actions: TimelineItemAction[] = [
      { type: 'move', toStartTicks: ms(14_000).ticks },
      { type: 'trim-end', toEndTicks: ms(10_000).ticks },
      { type: 'split', atTicks: ms(10_000).ticks },
      { type: 'delete', ripple: false },
    ]
    for (const action of actions) {
      const result = plan(withBroll(), 'overlay:broll_0001:0', action, { lockedTrackIds: ['V2'] })
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.refusal.code).toBe('TRACK_LOCKED')
    }
  })

  it('locks each track separately, so a padlock on V2 leaves music alone', () => {
    const result = plan(withMusic(), 'music:music_0001:0', { type: 'delete', ripple: false }, {
      lockedTrackIds: ['V2'],
    })
    expect(result.ok).toBe(true)
  })

  it('refuses while a suggestion is on screen or an export is running', () => {
    const pending = plan(withBroll(), 'overlay:broll_0001:0', { type: 'delete', ripple: false }, {
      pendingProposalExists: true,
    })
    expect(pending.ok === false && pending.refusal.code).toBe('PROPOSAL_PENDING')

    const exporting = plan(withBroll(), 'overlay:broll_0001:0', { type: 'delete', ripple: false }, {
      exportInProgress: true,
    })
    expect(exporting.ok === false && exporting.refusal.code).toBe('EXPORT_IN_PROGRESS')
  })

  it('refuses an edit built against a project that has since moved on', () => {
    const project = withBroll()
    const result = plan(project, 'overlay:broll_0001:0', { type: 'delete', ripple: false }, {
      expectedRevision: project.revision - 1,
    })
    expect(result.ok === false && result.refusal.code).toBe('PROJECT_STALE')
  })

  it('refuses an item that is no longer there', () => {
    const result = plan(withBroll(), 'overlay:broll_9999:0', { type: 'delete', ripple: false })
    expect(result.ok === false && result.refusal.code).toBe('ITEM_UNKNOWN')
  })

  it('sends the main video track to the controls that already know how cutting works', () => {
    const result = plan(withBroll(), 'clip:clip_aaaaaaaa', { type: 'split', atTicks: ms(4_000).ticks })
    expect(result.ok === false && result.refusal.code).toBe('OPERATION_UNSUPPORTED')
  })

  it('never changes the project itself, whatever it is asked', () => {
    const project = withBroll()
    const before = JSON.stringify(project)
    plan(project, 'overlay:broll_0001:0', { type: 'move', toStartTicks: ms(14_000).ticks })
    plan(project, 'overlay:broll_0001:0', { type: 'delete', ripple: true })
    plan(project, 'overlay:broll_0001:0', { type: 'split', atTicks: ms(10_000).ticks })
    expect(JSON.stringify(project)).toBe(before)
  })

  it('measures in whole ticks and never in rounded seconds', () => {
    const oddTick = ms(14_000).ticks + 7
    const result = plan(withBroll(), 'overlay:broll_0001:0', { type: 'move', toStartTicks: oddTick })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const moved = applyPlan(withBroll(), result.operations)
    expect(laneSpans(moved, 'V2')[0].startTicks).toBe(oddTick)
    expect(PROJECT_TIMESCALE).toBe(1_440_000)
  })
})
