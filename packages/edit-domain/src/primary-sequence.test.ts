import { describe, expect, it } from 'vitest'

import {
  MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
  PLACE_PRIMARY_CLIP_PRIMITIVE_ID,
  SPLIT_PRIMITIVE_ID,
  REMOVE_PRIMITIVE_ID,
  TRIM_PRIMITIVE_ID,
} from './capabilities.ts'
import { validateOperation } from './operations.ts'
import { validateTimelineOperation } from './timeline-operations.ts'
import {
  acceptChangeSet,
  compositionDuration,
  effectiveComposition,
  placeSourceSpan,
  redoChangeSet,
  undoChangeSet,
  type EditProject,
} from './project.ts'
import {
  TEST_BROLL_ASSET_ID,
  TEST_CLIP_ID,
  TEST_IMAGE_ASSET_ID,
  TEST_MUSIC_ASSET_ID,
  TEST_TRACK_ID,
  changeSetOf,
  ms,
  testMultiAssetProject,
  testTitle,
} from './test-fixtures.ts'

/**
 * Gate C2 — Multi-asset Primary Sequence.
 *
 * The fixture's main recording is 30 s and fills 0-30 s. The B-roll asset is a
 * second 10 s recording, used here as a second piece of MAIN footage rather
 * than as an overlay.
 *
 * See DOCS/decisions/ADR-MULTI-ASSET-PRIMARY-SEQUENCE-V1.md for why this is the
 * existing composition rather than a new parallel structure.
 */

const place = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: 'operation_place0001',
  kind: 'place-primary-clip',
  capabilityId: PLACE_PRIMARY_CLIP_PRIMITIVE_ID,
  clipId: 'clip_second01',
  trackId: TEST_TRACK_ID,
  assetId: TEST_BROLL_ASSET_ID,
  sourceRange: { start: ms(0), duration: ms(10_000) },
  compositionStart: ms(30_000),
  extensions: {},
  ...overrides,
})

const move = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: 'operation_move00001',
  kind: 'move-primary-clip',
  capabilityId: MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
  clipId: 'clip_second01',
  compositionStart: ms(40_000),
  extensions: {},
  ...overrides,
})

const accept = (project: EditProject, changeSetId: string, operations: readonly unknown[]): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

/** Two recordings end to end: the original 0-30 s, then a second 30-40 s. */
const twoRecordings = (): EditProject =>
  accept(testMultiAssetProject(), 'changeset_place000001', [place()])

const clipsOf = (project: EditProject) =>
  effectiveComposition(project).tracks
    .find((track) => track.kind === 'video')!
    .clips.slice()
    .sort((a, b) => a.compositionStart.ticks - b.compositionStart.ticks)
    .map((clip) => ({
      clipId: clip.clipId,
      assetId: clip.assetId,
      startTicks: clip.compositionStart.ticks,
      durationTicks: clip.sourceRange.duration.ticks,
      sourceStartTicks: clip.sourceRange.start.ticks,
    }))

describe('C2 — placing a second recording on the main sequence', () => {
  it('adds it, and the finished video gets longer by exactly its length', () => {
    const before = compositionDuration(effectiveComposition(testMultiAssetProject())).ticks
    const after = compositionDuration(effectiveComposition(twoRecordings())).ticks
    expect(before).toBe(ms(30_000).ticks)
    expect(after).toBe(ms(40_000).ticks)
  })

  it('keeps the two recordings as two separate pieces, each naming its own file', () => {
    expect(clipsOf(twoRecordings())).toEqual([
      { clipId: TEST_CLIP_ID, assetId: 'asset_aaaaaaaa', startTicks: 0, durationTicks: ms(30_000).ticks, sourceStartTicks: 0 },
      { clipId: 'clip_second01', assetId: TEST_BROLL_ASSET_ID, startTicks: ms(30_000).ticks, durationTicks: ms(10_000).ticks, sourceStartTicks: 0 },
    ])
  })

  it('is one accepted edit and one Undo', () => {
    const project = twoRecordings()
    const undone = undoChangeSet(project)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(clipsOf(undone.value)).toHaveLength(1)

    const redone = redoChangeSet(undone.value)
    expect(redone.ok).toBe(true)
    if (!redone.ok) return
    expect(clipsOf(redone.value)).toHaveLength(2)
  })

  it('refuses to lay a recording on top of footage already there', () => {
    const project = testMultiAssetProject()
    const result = acceptChangeSet(
      project,
      changeSetOf('changeset_overlap0001', project.revision, [place({ compositionStart: ms(10_000) })] as never),
    )
    expect(result.ok).toBe(false)
  })

  it('refuses a piece of music or a picture on the main sequence', () => {
    for (const assetId of [TEST_MUSIC_ASSET_ID, TEST_IMAGE_ASSET_ID]) {
      const project = testMultiAssetProject()
      const result = acceptChangeSet(
        project,
        changeSetOf('changeset_wrongkind01', project.revision, [place({ assetId })] as never),
      )
      expect(result.ok).toBe(false)
    }
  })

  it('refuses a stretch longer than the recording it names', () => {
    const project = testMultiAssetProject()
    const result = acceptChangeSet(
      project,
      changeSetOf('changeset_toolong0001', project.revision, [
        place({ sourceRange: { start: ms(0), duration: ms(600_000) } }),
      ] as never),
    )
    expect(result.ok).toBe(false)
  })

  it('refuses a clip name already in use, so nothing is ever silently replaced', () => {
    const project = testMultiAssetProject()
    const result = acceptChangeSet(
      project,
      changeSetOf('changeset_dupeclip01', project.revision, [
        place({ clipId: TEST_CLIP_ID, compositionStart: ms(30_000) }),
      ] as never),
    )
    expect(result.ok).toBe(false)
  })

  it('lets the same recording be placed twice, which is what "show that bit again" means', () => {
    let project = twoRecordings()
    project = accept(project, 'changeset_again000001', [place({
      operationId: 'operation_place0002',
      clipId: 'clip_second02',
      sourceRange: { start: ms(2_000), duration: ms(3_000) },
      compositionStart: ms(40_000),
    })])
    const clips = clipsOf(project)
    expect(clips).toHaveLength(3)
    expect(clips[1].assetId).toBe(clips[2].assetId)
    expect(clips[2].sourceStartTicks).toBe(ms(2_000).ticks)
  })

  it('refuses an unknown key and a capability that cannot produce it', () => {
    expect(validateTimelineOperation(place({ ripple: true })).ok).toBe(false)
    expect(validateTimelineOperation(place({ capabilityId: TRIM_PRIMITIVE_ID })).ok).toBe(false)
  })

  it('travels through the one operation validator every caller uses', () => {
    const result = validateOperation(place())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.kind).toBe('place-primary-clip')
  })
})

describe('C2 — everything that already worked, still works on a second recording', () => {
  const secondClip = 'clip_second01'

  it('splits the second recording', () => {
    const project = accept(twoRecordings(), 'changeset_split000001', [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_split0001',
      kind: 'split-clip',
      capabilityId: SPLIT_PRIMITIVE_ID,
      clipId: secondClip,
      atClipTime: ms(5_000),
      newClipId: 'clip_second01b',
      extensions: {},
    }])
    const clips = clipsOf(project)
    expect(clips).toHaveLength(3)
    expect(clips[1].durationTicks).toBe(ms(5_000).ticks)
    expect(clips[2].durationTicks).toBe(ms(5_000).ticks)
    expect(clips[2].assetId).toBe(TEST_BROLL_ASSET_ID)
  })

  it('trims the second recording', () => {
    const project = accept(twoRecordings(), 'changeset_trim0000001', [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_trim00001',
      kind: 'trim-clip',
      capabilityId: TRIM_PRIMITIVE_ID,
      clipId: secondClip,
      trimStart: ms(2_000),
      trimEnd: ms(0),
      ripple: true,
      extensions: {},
    }])
    const clips = clipsOf(project)
    expect(clips[1].durationTicks).toBe(ms(8_000).ticks)
    expect(clips[1].sourceStartTicks).toBe(ms(2_000).ticks)
  })

  it('removes the second recording and closes the gap', () => {
    const project = accept(twoRecordings(), 'changeset_remove000001', [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_remove001',
      kind: 'remove-clip',
      capabilityId: REMOVE_PRIMITIVE_ID,
      clipId: secondClip,
      ripple: true,
      extensions: {},
    }])
    expect(clipsOf(project)).toHaveLength(1)
    expect(compositionDuration(effectiveComposition(project)).ticks).toBe(ms(30_000).ticks)
  })

  it('moves one piece to a chosen moment, and moves nothing else', () => {
    const project = accept(twoRecordings(), 'changeset_move00000001', [move()])
    const clips = clipsOf(project)
    expect(clips[0].startTicks).toBe(0)
    expect(clips[1].startTicks).toBe(ms(40_000).ticks)
    // The gap it left is real: black and silence, not a shorter video.
    expect(compositionDuration(effectiveComposition(project)).ticks).toBe(ms(50_000).ticks)
  })

  it('refuses a move that would land on top of another piece', () => {
    const project = twoRecordings()
    const result = acceptChangeSet(
      project,
      changeSetOf('changeset_moveonto001', project.revision, [move({ compositionStart: ms(10_000) })] as never),
    )
    expect(result.ok).toBe(false)
  })
})

describe('C2 — what is drawn on top does not move when the sequence changes', () => {
  it('leaves a title on the first recording exactly where it was', () => {
    // This is the strongest evidence the shape is right: a title is anchored to
    // a moment of a NAMED recording, so a second recording appearing after it
    // cannot touch it, and no new code was needed to make that true.
    const withTitle = accept(testMultiAssetProject(), 'changeset_title0000001', [testTitle()])
    const before = placeSourceSpan(
      effectiveComposition(withTitle),
      testTitle().assetId,
      testTitle().sourceInterval,
    ).map((placement) => placement.compositionRange.start.ticks)

    const withSecond = accept(withTitle, 'changeset_place000001', [place()])
    const after = placeSourceSpan(
      effectiveComposition(withSecond),
      testTitle().assetId,
      testTitle().sourceInterval,
    ).map((placement) => placement.compositionRange.start.ticks)

    expect(after).toEqual(before)
    expect(after).toHaveLength(1)
  })

  it('does not draw a title on the second recording just because time overlaps', () => {
    // The title names recording A. The second piece is recording B. Time is not
    // what decides — the name is.
    const project = accept(twoRecordings(), 'changeset_title0000001', [testTitle()])
    const placements = placeSourceSpan(
      effectiveComposition(project),
      testTitle().assetId,
      testTitle().sourceInterval,
    )
    for (const placement of placements) {
      expect(placement.clip.assetId).toBe(testTitle().assetId)
    }
  })
})
