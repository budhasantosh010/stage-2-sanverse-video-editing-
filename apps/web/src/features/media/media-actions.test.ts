import { describe, expect, it } from 'vitest'
import { acceptChangeSet, type EditProject } from '@sanverse/edit-domain'
import { testBrollAsset, testImageAsset, testMediaOverlay, testMultiAssetProject, testMusic, testMusicAsset, TEST_ASSET_ID } from '@sanverse/edit-domain/test-fixtures'
import { buildAddAsBrollOperation, buildAddAsMusicOperation, sourceMomentAt } from './media-actions'

const ids = { operationId: 'operation_media0001', overlayId: 'broll_media0001', musicId: 'music_media0001' }
const accept = (project: EditProject, operation: ReturnType<typeof testMusic>): EditProject => {
  const result = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1', changeSetId: 'changeset_music001', baseRevision: project.revision,
    operations: [operation], provenance: { source: 'direct', requestId: null }, extensions: {},
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('Media Bin placement builders', () => {
  it('maps the playhead to source footage without mutating the project', () => {
    const project = testMultiAssetProject()
    const before = JSON.stringify(project)
    expect(sourceMomentAt(project, 2_000)).toMatchObject({ assetId: TEST_ASSET_ID, startTicks: 2_880_000 })
    expect(JSON.stringify(project)).toBe(before)
  })

  it('builds one existing B-roll operation for compatible image or secondary video', () => {
    const project = testMultiAssetProject()
    const image = buildAddAsBrollOperation({ project, expectedRevision: project.revision, asset: testImageAsset(), playheadMs: 2_000, ids })
    expect(image).toMatchObject({ ok: true, timelineItemId: `overlay:${ids.overlayId}:0`, operation: { kind: 'add-media-overlay' } })
    const video = buildAddAsBrollOperation({ project, expectedRevision: project.revision, asset: testBrollAsset(), playheadMs: 2_000, ids })
    expect(video).toMatchObject({ ok: true, operation: { overlayAssetId: testBrollAsset().assetId, useOverlayAudio: false } })
  })

  it('refuses primary footage, audio, and stale revisions', () => {
    const project = testMultiAssetProject()
    expect(buildAddAsBrollOperation({ project, expectedRevision: project.revision, asset: project.assets[0], playheadMs: 1_000, ids })).toMatchObject({ ok: false })
    expect(buildAddAsBrollOperation({ project, expectedRevision: project.revision, asset: testMusicAsset(), playheadMs: 1_000, ids })).toMatchObject({ ok: false })
    expect(buildAddAsBrollOperation({ project, expectedRevision: project.revision - 1, asset: testImageAsset(), playheadMs: 1_000, ids })).toMatchObject({ ok: false, message: expect.stringContaining('changed') })
  })

  it('adds a bed under the rest of the video, with no length asked for', () => {
    const project = testMultiAssetProject()
    const first = buildAddAsMusicOperation({ project, expectedRevision: project.revision, asset: testMusicAsset(), playheadMs: 2_000, ids })
    expect(first).toMatchObject({
      ok: true,
      operation: { kind: 'add-music', compositionStart: { ticks: 2_880_000 }, durationTicks: null },
    })
  })

  it('refuses to stack a second piece of music on top of one already playing', () => {
    // The old behaviour replaced the existing bed with a `set-music`. That was
    // silent loss: the music somebody chose ten minutes ago simply vanished and
    // there was nothing on screen to say so. Refusing names the clash instead.
    const withMusic = accept(testMultiAssetProject(), testMusic())
    const second = buildAddAsMusicOperation({ project: withMusic, expectedRevision: withMusic.revision, asset: testMusicAsset(), playheadMs: 3_000, ids })
    expect(second).toMatchObject({ ok: false, message: expect.stringContaining('already music playing') })
  })

  it('refuses wrong media kind without project mutation', () => {
    const project = testMultiAssetProject()
    const before = JSON.stringify(project)
    expect(buildAddAsMusicOperation({ project, expectedRevision: project.revision, asset: testImageAsset(), playheadMs: 0, ids })).toMatchObject({ ok: false })
    expect(JSON.stringify(project)).toBe(before)
  })
})
