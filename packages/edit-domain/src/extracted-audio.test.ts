import { describe, expect, it } from 'vitest'
import { acceptChangeSet, activeTimelineTrackState, effectiveComposition, redoChangeSet, undoChangeSet, validateProject } from './project.ts'
import { changeSetOf, ms, testProject, TEST_CLIP_ID, testAsset, testTrim } from './test-fixtures.ts'
import { validateOperation } from './operations.ts'
import { validateComposition } from './composition.ts'

const extract = (project = testProject(), suffix = '01') => {
  const operation = validateOperation({
    schemaVersion: 'sanverse.operation/v3', operationId: 'operation_extract' + suffix,
    capabilityId: 'sanverse.timeline.extract-audio.primitive/v1', kind: 'extract-clip-audio',
    clipId: TEST_CLIP_ID, newClipId: 'clip_extracted' + suffix,
    trackId: activeTimelineTrackState(project).tracks.find(track => track.role === 'music')!.trackId,
    extensions: {},
  })
  expect(operation.ok).toBe(true)
  if (!operation.ok) throw new Error(JSON.stringify(operation.error))
  return acceptChangeSet(project, changeSetOf('changeset_extract' + suffix, project.revision, [operation.value]))
}

describe('independent extracted dialogue', () => {
  it('preserves long sound fades while clearing fades on the shorter detached picture', () => {
    const base = testProject()
    const project = { ...base, composition: { ...base.composition,
      tracks: base.composition.tracks.map(track => ({ ...track, clips: track.clips.map(clip => ({
        ...clip, sourceRange: { start: ms(10000), duration: ms(5000) },
        compositionStart: ms(10000), fadeIn: ms(8000), fadeOut: ms(6000),
        linkedAudio: { sourceRange: { start: ms(0), duration: ms(15000) },
          compositionOffsetTicks: -ms(10000).ticks },
      })) })),
    } }
    expect(validateProject(project).ok).toBe(true)
    const result = extract(project)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const composition = effectiveComposition(result.value)
    expect(composition.tracks.find(track => track.kind === 'video')!.clips[0]).toMatchObject({
      audioDetached: true, linkedAudio: null, fadeIn: ms(0), fadeOut: ms(0),
    })
    expect(composition.tracks.find(track => track.kind === 'audio')!.clips[0]).toMatchObject({
      compositionStart: ms(0), sourceRange: { start: ms(0), duration: ms(15000) },
      fadeIn: ms(8000), fadeOut: ms(6000),
    })
  })

  it('extracts one sound clip and restores the exact linked state with Undo/Redo', () => {
    const before = testProject()
    const result = extract(before)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const composition = effectiveComposition(result.value)
    const picture = composition.tracks.find(track => track.kind === 'video')!.clips[0]
    const sound = composition.tracks.find(track => track.kind === 'audio')!.clips[0]
    expect(picture).toMatchObject({ audioDetached: true })
    expect(sound).toMatchObject({ clipId: 'clip_extracted01', assetId: picture.assetId, extractedFromClipId: TEST_CLIP_ID })
    expect(sound.sourceRange).toEqual(picture.sourceRange)
    expect(sound.gainDb).toBe(picture.gainDb)
    expect(validateProject(JSON.parse(JSON.stringify(result.value))).ok).toBe(true)
    const undo = undoChangeSet(result.value)
    if (!undo.ok) throw new Error('Undo failed')
    expect(effectiveComposition(undo.value)).toEqual(effectiveComposition(before))
    const redo = redoChangeSet(undo.value)
    if (!redo.ok) throw new Error('Redo failed')
    expect(effectiveComposition(redo.value)).toEqual(composition)
  })

  it('trims extracted sound without changing the picture', () => {
    const result = extract()
    if (!result.ok) throw new Error(JSON.stringify(result.error))
    const before = effectiveComposition(result.value).tracks.find(track => track.kind === 'video')
    const trimmed = acceptChangeSet(result.value, changeSetOf('changeset_trimaudio', result.value.revision, [
      testTrim({ clipId: 'clip_extracted01', trimStart: ms(1000), trimEnd: ms(2000), ripple: false }),
    ]))
    expect(trimmed.ok).toBe(true)
    if (!trimmed.ok) return
    expect(effectiveComposition(trimmed.value).tracks.find(track => track.kind === 'video')).toEqual(before)
    expect(effectiveComposition(trimmed.value).tracks.find(track => track.kind === 'audio')!.clips[0].sourceRange.duration).toEqual(ms(27000))
  })

  it('refuses extraction from silent footage and refuses a second extraction', () => {
    expect(extract(testProject(testAsset({ hasAudio: false }))).ok).toBe(false)
    const once = extract()
    if (!once.ok) throw new Error(JSON.stringify(once.error))
    expect(extract(once.value, '02').ok).toBe(false)
  })
  it('rejects corrupted extracted-audio placement and link state', () => {
    const result = extract()
    if (!result.ok) throw new Error(JSON.stringify(result.error))
    const composition = effectiveComposition(result.value)
    const soundTrack = composition.tracks.find(track => track.kind === 'audio')!
    for (const patch of [{ kind: 'video' }, { clips: [{ ...soundTrack.clips[0], audioDetached: true }] }]) {
      expect(validateComposition({ ...composition, tracks: composition.tracks.map(track =>
        track.trackId === soundTrack.trackId ? { ...track, ...patch } : track) }, result.value.assets).ok).toBe(false)
    }
  })
})
