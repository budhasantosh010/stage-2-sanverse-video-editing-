import { describe, expect, it } from 'vitest'

import { addAsset, acceptChangeSet, activeOverlayOperations, blockedChangeSets } from './project.ts'
import { validateOperation, validateOperationAgainstComposition } from './operations.ts'
import { effectiveComposition } from './project.ts'
import { DEFAULT_MUSIC_GAIN_DB } from './overlay-operations.ts'
import { validateComposition } from './composition.ts'
import {
  TEST_BROLL_ASSET_ID,
  TEST_MUSIC_ASSET_ID,
  changeSetOf,
  ms,
  testAsset,
  testCallout,
  testMediaOverlay,
  testMultiAssetProject,
  testMusic,
  testMusicAsset,
  testProject,
  testRemove,
  testSplit,
  testTitle,
} from './test-fixtures.ts'

const accept = (project: ReturnType<typeof testProject>, id: string, operations: readonly unknown[]) => {
  const result = acceptChangeSet(project, changeSetOf(id, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('multi-asset intake', () => {
  it('holds footage, B-roll, a picture, and music side by side', () => {
    const project = testMultiAssetProject()
    expect(project.assets.map((asset) => asset.mediaKind)).toEqual(['video', 'video', 'image', 'audio'])
  })

  it('does not create a change set, because putting media on the shelf is not an edit', () => {
    const project = testMultiAssetProject()
    expect(project.changeSets).toHaveLength(0)
    expect(project.redoStack).toHaveLength(0)
  })

  it('refuses the same asset twice', () => {
    const project = testMultiAssetProject()
    const again = addAsset(project, testMusicAsset())
    expect(again.ok).toBe(false)
  })

  it('refuses to put a picture or music on the timeline, because a timeline is made of footage', () => {
    const project = testMultiAssetProject()
    const track = project.composition.tracks[0]
    const withMusicOnTheTimeline = {
      ...project.composition,
      tracks: [{ ...track, clips: [{ ...track.clips[0], assetId: TEST_MUSIC_ASSET_ID }] }],
    }
    const result = validateComposition(withMusicOnTheTimeline, project.assets)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'ASSET_NOT_VIDEO')).toBe(true)
  })
})

describe('titles', () => {
  it('accepts a headline with and without a subhead', () => {
    expect(validateOperation(testTitle()).ok).toBe(true)
    expect(validateOperation(testTitle({ subhead: '' })).ok).toBe(true)
  })

  it('refuses an empty headline, because a title with no words is not a title', () => {
    expect(validateOperation(testTitle({ headline: '   ' })).ok).toBe(false)
  })

  it('refuses a newline hidden in a headline, which would silently become two lines', () => {
    expect(validateOperation(testTitle({ headline: 'one\ntwo' })).ok).toBe(false)
  })

  it('refuses a placement it does not know rather than choosing one', () => {
    expect(validateOperation(testTitle({ placement: 'top' as never })).ok).toBe(false)
  })
})

describe('callouts', () => {
  it('accepts a rectangle on the picture, with or without a label', () => {
    expect(validateOperation(testCallout()).ok).toBe(true)
    expect(validateOperation(testCallout({ label: '' })).ok).toBe(true)
  })

  it('refuses a rectangle hanging off the edge rather than trimming it to fit', () => {
    // Trimming would move the thing the user drew a box around.
    const result = validateOperation(testCallout({
      region: { coordinateSpace: 'composition-normalized', x: 0.8, y: 0.1, width: 0.4, height: 0.2 },
    }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'REGION_OFF_PICTURE')).toBe(true)
  })

  it('refuses a rectangle too small to see', () => {
    expect(validateOperation(testCallout({
      region: { coordinateSpace: 'composition-normalized', x: 0.5, y: 0.5, width: 0.001, height: 0.2 },
    })).ok).toBe(false)
  })
})

describe('B-roll and pictures', () => {
  it('accepts a clip laid over a stretch of the footage', () => {
    const project = testMultiAssetProject()
    const operation = validateOperation(testMediaOverlay())
    expect(operation.ok).toBe(true)
    if (!operation.ok) return
    const fits = validateOperationAgainstComposition(
      operation.value,
      effectiveComposition(project),
      project.assets,
    )
    expect(fits.ok).toBe(true)
  })

  it('refuses laying footage on top of itself', () => {
    const result = validateOperation(testMediaOverlay({ overlayAssetId: 'asset_aaaaaaaa' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'OVERLAY_ASSET_SAME_AS_FOOTAGE')).toBe(true)
  })

  it('refuses eight seconds of a clip that only has five left, instead of freezing a frame', () => {
    const project = testMultiAssetProject()
    const operation = validateOperation(testMediaOverlay({
      // The B-roll is 10 s. Starting at 6 s and asking for 5 s needs 11 s.
      overlaySourceStart: ms(6_000),
      sourceInterval: { start: ms(8_000), duration: ms(5_000) },
    }))
    if (!operation.ok) throw new Error('fixture must validate structurally')
    const fits = validateOperationAgainstComposition(
      operation.value,
      effectiveComposition(project),
      project.assets,
    )
    expect(fits.ok).toBe(false)
    if (fits.ok) return
    expect(fits.error.issues[0]?.code).toBe('OVERLAY_SPAN_OUTSIDE_ASSET')
  })

  it('does not apply that length rule to a still picture, which can be held for any time', () => {
    const project = testMultiAssetProject()
    const operation = validateOperation(testMediaOverlay({
      overlayAssetId: 'asset_cccccccc',
      sourceInterval: { start: ms(8_000), duration: ms(20_000) },
    }))
    if (!operation.ok) throw new Error('fixture must validate structurally')
    const fits = validateOperationAgainstComposition(
      operation.value,
      effectiveComposition(project),
      project.assets,
    )
    expect(fits.ok).toBe(true)
  })

  it('refuses a B-roll clip that is not in this project', () => {
    const project = testProject()
    const operation = validateOperation(testMediaOverlay())
    if (!operation.ok) throw new Error('fixture must validate structurally')
    const fits = validateOperationAgainstComposition(
      operation.value,
      effectiveComposition(project),
      project.assets,
    )
    expect(fits.ok).toBe(false)
    if (fits.ok) return
    expect(fits.error.issues[0]?.code).toBe('OVERLAY_ASSET_UNKNOWN')
  })

  it('is reported blocked when the footage it sits over is deleted', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_broll001', [testMediaOverlay()])
    expect(blockedChangeSets(project)).toHaveLength(0)

    // Cut at 8 s, then delete everything after it — the B-roll sat at 8-12 s.
    project = accept(project, 'changeset_split001', [testSplit({ atClipTime: ms(8_000) })])
    project = accept(project, 'changeset_remove01', [testRemove({ clipId: 'clip_bbbbbbbb' })])
    expect(blockedChangeSets(project)).toHaveLength(1)
    expect(activeOverlayOperations(project)).toHaveLength(0)
  })
})

describe('music', () => {
  it('accepts a bed under the whole video at a sensible default level', () => {
    const result = validateOperation(testMusic())
    expect(result.ok).toBe(true)
    expect(DEFAULT_MUSIC_GAIN_DB).toBe(-18)
  })

  it('refuses music pointed at a video file', () => {
    const project = testMultiAssetProject()
    const operation = validateOperation(testMusic({ assetId: TEST_BROLL_ASSET_ID }))
    if (!operation.ok) throw new Error('fixture must validate structurally')
    const fits = validateOperationAgainstComposition(
      operation.value,
      effectiveComposition(project),
      project.assets,
    )
    expect(fits.ok).toBe(false)
    if (fits.ok) return
    expect(fits.error.issues[0]?.code).toBe('OVERLAY_ASSET_WRONG_KIND')
  })

  it('refuses a loudness outside the band the system will ever play', () => {
    expect(validateOperation(testMusic({ gainDb: 40 })).ok).toBe(false)
    expect(validateOperation(testMusic({ gainDb: -200 })).ok).toBe(false)
  })

  it('SURVIVES a cut that would have blocked any other overlay', () => {
    // This is the whole reason music is anchored differently. A bed under the
    // finished video has no moment of footage to lose, so cutting cannot break
    // it — the music simply keeps playing over whatever is left.
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_music001', [testMusic()])
    project = accept(project, 'changeset_split001', [testSplit({ atClipTime: ms(8_000) })])
    project = accept(project, 'changeset_remove01', [testRemove({ clipId: 'clip_bbbbbbbb' })])

    expect(blockedChangeSets(project)).toHaveLength(0)
    expect(activeOverlayOperations(project)).toHaveLength(1)
  })

  it('is blocked when the music file itself is gone from the project', () => {
    const project = testProject(testAsset())
    const operation = validateOperation(testMusic())
    if (!operation.ok) throw new Error('fixture must validate structurally')
    const fits = validateOperationAgainstComposition(
      operation.value,
      effectiveComposition(project),
      project.assets,
    )
    expect(fits.ok).toBe(false)
    if (fits.ok) return
    expect(fits.error.issues[0]?.code).toBe('OVERLAY_ASSET_UNKNOWN')
  })
})
