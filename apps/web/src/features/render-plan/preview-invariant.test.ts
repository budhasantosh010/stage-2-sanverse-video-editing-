import { describe, expect, it } from 'vitest'
import {
  PROJECT_TIMESCALE,
  acceptChangeSet,
  activeTrackOutputs,
  effectiveComposition,
  redoChangeSet,
  undoChangeSet,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'
import {
  CLIP_ENABLED_PRIMITIVE_ID,
  REMOVE_PRIMITIVE_ID,
  SPLIT_PRIMITIVE_ID,
  TRACK_OUTPUT_PRIMITIVE_ID,
  TRIM_PRIMITIVE_ID,
} from '@sanverse/edit-domain/capabilities'

import { resolvePrimarySource } from './primary-source.ts'
import {
  isCurrentGeneration,
  previewIsGap,
  previewIsLoading,
  reconcilePrimaryPreview,
} from './preview-reconciliation.ts'
import { TEST_ASSET_ID, TEST_CLIP_ID, testProject } from '../../test-fixtures.ts'

/**
 * Gate T0.4 — the promise the preview makes about the user's own footage.
 *
 * ── THE INVARIANT, IN ONE SENTENCE ───────────────────────────────────────────
 *
 * When all four of these are true —
 *
 *   · the video track is switched on
 *   · a switched-on clip covers the moment the playhead is at
 *   · that clip's file is in the project
 *   · the project on screen is the one that was accepted
 *
 * — then the monitor CANNOT say "No media at this time", cannot resolve to a
 * gap, and cannot sit at unexplained black.
 *
 * The owner's screen recording was one violation of this. The fix has to hold
 * after every single kind of edit, not just at the moment it was written, which
 * is what this file is for: it drives the project through each operation and
 * re-checks the promise every time.
 *
 * ── WHY IT IS WRITTEN THIS WAY ───────────────────────────────────────────────
 *
 * The check is deliberately expressed the same way in every case, as one helper
 * (`promiseHolds`) applied to a project. A per-case, hand-written assertion
 * would drift: somebody would soften one of them while fixing an unrelated
 * failure, and the softened one would be the one that mattered.
 */

const seconds = (value: number): number => Math.round(value * PROJECT_TIMESCALE)
const ticksOf = (value: number) => Object.freeze({ ticks: value, timescale: PROJECT_TIMESCALE })

let operationCounter = 0
const nextOperationId = (): string => {
  operationCounter += 1
  return `operation_${operationCounter.toString(16).padStart(8, '0')}`
}
let changeSetCounter = 0
const nextChangeSetId = (): string => {
  changeSetCounter += 1
  return `changeset_${changeSetCounter.toString(16).padStart(8, '0')}`
}

const accept = (project: EditProject, ...operations: readonly EditOperation[]): EditProject => {
  const result = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1' as const,
    changeSetId: nextChangeSetId(),
    baseRevision: project.revision,
    operations,
    provenance: { source: 'direct' as const, requestId: null },
    extensions: {},
  })
  if (!result.ok) throw new Error(`could not accept: ${JSON.stringify(result.error)}`)
  return result.value
}

/**
 * The promise itself, checked at a fine grain across the whole video.
 *
 * Every quarter of a second is examined. For each one it works out, straight
 * from the composition, whether the four conditions hold — and if they do, it
 * insists that the resolver reports real footage. It also insists on the
 * converse where the composition really is empty, because a resolver that
 * answered "footage" everywhere would pass a one-sided check while being just
 * as wrong.
 */
const promiseHolds = (project: EditProject): void => {
  const composition = effectiveComposition(project)
  const outputs = activeTrackOutputs(project)
  const total = composition.tracks.flatMap((track) => track.clips).reduce(
    (end, clip) => Math.max(end, clip.compositionStart.ticks + clip.sourceRange.duration.ticks),
    0,
  )
  const step = Math.max(1, Math.round(PROJECT_TIMESCALE / 4))

  for (let tick = 0; tick <= total; tick += step) {
    const covering = composition.tracks
      .flatMap((track) => track.clips)
      .find((clip) =>
        tick >= clip.compositionStart.ticks &&
        tick < clip.compositionStart.ticks + clip.sourceRange.duration.ticks,
      )
    const fileIsPresent = covering
      ? project.assets.some((asset) => asset.assetId === covering.assetId)
      : false
    const shouldShowFootage = Boolean(covering) && covering!.enabled && fileIsPresent && outputs.V1

    const decision = resolvePrimarySource(project, tick)

    if (shouldShowFootage) {
      expect(
        decision.kind,
        `at ${(tick / PROJECT_TIMESCALE).toFixed(2)}s a switched-on clip with its file present ` +
        `must not be reported as empty`,
      ).toBe('active')
      if (decision.kind !== 'active') continue
      expect(decision.clipId).toBe(covering!.clipId)
      expect(decision.assetId).toBe(covering!.assetId)
      // The moment inside the original recording, to the tick. Being off by a
      // little is how a preview and an export come to disagree.
      expect(decision.sourceTicks).toBe(
        covering!.sourceRange.start.ticks + (tick - covering!.compositionStart.ticks),
      )
    } else {
      expect(
        decision.kind,
        `at ${(tick / PROJECT_TIMESCALE).toFixed(2)}s there is genuinely nothing, and saying ` +
        `there is footage would be just as wrong`,
      ).toBe('gap')
    }
  }
}

const trackOutput = (enabled: boolean): EditOperation => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: nextOperationId(),
  kind: 'set-track-output',
  capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
  trackId: 'V1',
  outputEnabled: enabled,
  extensions: {},
}) as unknown as EditOperation

const splitAt = (clipId: string, atSeconds: number): EditOperation => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: nextOperationId(),
  kind: 'split-clip',
  capabilityId: SPLIT_PRIMITIVE_ID,
  clipId,
  atClipTime: ticksOf(seconds(atSeconds)),
  newClipId: `clip_${nextOperationId().slice(-8)}`,
  extensions: {},
}) as unknown as EditOperation

const trim = (clipId: string, startSeconds: number, endSeconds: number, ripple: boolean): EditOperation => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: nextOperationId(),
  kind: 'trim-clip',
  capabilityId: TRIM_PRIMITIVE_ID,
  clipId,
  trimStart: ticksOf(seconds(startSeconds)),
  trimEnd: ticksOf(seconds(endSeconds)),
  ripple,
  extensions: {},
}) as unknown as EditOperation

const remove = (clipId: string, ripple: boolean): EditOperation => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: nextOperationId(),
  kind: 'remove-clip',
  capabilityId: REMOVE_PRIMITIVE_ID,
  clipId,
  ripple,
  extensions: {},
}) as unknown as EditOperation

const setEnabled = (clipId: string, enabled: boolean): EditOperation => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: nextOperationId(),
  kind: 'set-clip-enabled',
  capabilityId: CLIP_ENABLED_PRIMITIVE_ID,
  clipId,
  enabled,
  extensions: {},
}) as unknown as EditOperation

/** Whichever clip is first in the current arrangement. */
const firstClipId = (project: EditProject): string =>
  effectiveComposition(project).tracks[0]?.clips[0]?.clipId ?? TEST_CLIP_ID

describe('the promise: switched-on footage under the playhead is never called empty', () => {
  it('A · one recording, checked from the first frame to the last', () => {
    promiseHolds(testProject())
  })

  it('E · a switched-off clip is a gap, and says so as a switched-off clip', () => {
    // Split first: the domain refuses to switch off the only clip in a project,
    // because a video with nothing in it is not a video. So the shape that can
    // actually occur is two clips with one of them off.
    const split = accept(testProject(), splitAt(TEST_CLIP_ID, 10))
    const second = effectiveComposition(split).tracks[0].clips[1]
    const project = accept(split, setEnabled(second.clipId, false))
    promiseHolds(project)
    const decision = resolvePrimarySource(project, seconds(15))
    expect(decision.kind === 'gap' && decision.reason).toBe('CLIP_DISABLED')
    // and the clip BEFORE it is still perfectly visible — one switched-off clip
    // must cost only its own stretch
    expect(resolvePrimarySource(project, seconds(5)).kind).toBe('active')
  })

  it('F · the whole track switched off is a gap, and is named ahead of the clip', () => {
    // Naming the clip here would send the user to the wrong switch: turning
    // that one clip back on would still show nothing.
    const split = accept(testProject(), splitAt(TEST_CLIP_ID, 10))
    const second = effectiveComposition(split).tracks[0].clips[1]
    const project = accept(accept(split, setEnabled(second.clipId, false)), trackOutput(false))
    promiseHolds(project)
    // The clip is off AND the whole track is off. The track is named, because
    // turning that one clip back on would still show nothing.
    const decision = resolvePrimarySource(project, seconds(15))
    expect(decision.kind === 'gap' && decision.reason).toBe('V1_OUTPUT_DISABLED')
  })

  it('G · a clip whose file is gone is a gap, and is reported as a fault, not as an empty stretch', () => {
    const base = testProject()
    const broken = Object.freeze({ ...base, assets: Object.freeze([]) }) as EditProject
    const decision = resolvePrimarySource(broken, seconds(5))
    expect(decision.kind === 'gap' && decision.reason).toBe('ASSET_MISSING')
  })

  it('I · holds after a trim', () => {
    promiseHolds(accept(testProject(), trim(TEST_CLIP_ID, 2, 3, false)))
  })

  it('I · holds after a trim that closes the gap behind it', () => {
    promiseHolds(accept(testProject(), trim(TEST_CLIP_ID, 2, 3, true)))
  })

  it('J · holds after a split, at the cut and either side of it', () => {
    const project = accept(testProject(), splitAt(TEST_CLIP_ID, 12))
    promiseHolds(project)
    // The frame exactly on the cut belongs to one side only — never to both and
    // never to neither, which is what a half-open interval buys.
    const onTheCut = resolvePrimarySource(project, seconds(12))
    const justBefore = resolvePrimarySource(project, seconds(12) - 1)
    expect(onTheCut.kind).toBe('active')
    expect(justBefore.kind).toBe('active')
    if (onTheCut.kind === 'active' && justBefore.kind === 'active') {
      expect(onTheCut.clipId).not.toBe(justBefore.clipId)
    }
  })

  it('K · holds after a delete that leaves the space', () => {
    const project = accept(testProject(), splitAt(TEST_CLIP_ID, 10))
    const second = effectiveComposition(project).tracks[0].clips[1]
    promiseHolds(accept(project, remove(second.clipId, false)))
  })

  it('K · holds after a delete that closes the gap', () => {
    const project = accept(testProject(), splitAt(TEST_CLIP_ID, 10))
    const second = effectiveComposition(project).tracks[0].clips[1]
    promiseHolds(accept(project, remove(second.clipId, true)))
  })

  it('O · holds after Undo', () => {
    const edited = accept(testProject(), trim(TEST_CLIP_ID, 3, 0, false))
    const undone = undoChangeSet(edited)
    expect(undone.ok).toBe(true)
    if (undone.ok) promiseHolds(undone.value)
  })

  it('P · holds after Redo', () => {
    const edited = accept(testProject(), trim(TEST_CLIP_ID, 3, 0, false))
    const undone = undoChangeSet(edited)
    if (!undone.ok) throw new Error('undo failed')
    const redone = redoChangeSet(undone.value)
    expect(redone.ok).toBe(true)
    if (redone.ok) promiseHolds(redone.value)
  })

  it('O/P · holds through a whole run of edits, then all the way back, then forward again', () => {
    // The case a single-step test misses. Each Undo is itself a revision, so a
    // stale index or a remembered clip survives many steps before it shows.
    let project = accept(testProject(), splitAt(TEST_CLIP_ID, 8))
    const second = effectiveComposition(project).tracks[0].clips[1]
    project = accept(project, trim(second.clipId, 1, 1, false))
    project = accept(project, setEnabled(second.clipId, false))
    promiseHolds(project)

    for (let step = 0; step < 3; step += 1) {
      const undone = undoChangeSet(project)
      if (!undone.ok) break
      project = undone.value
      promiseHolds(project)
    }
    for (let step = 0; step < 3; step += 1) {
      const redone = redoChangeSet(project)
      if (!redone.ok) break
      project = redone.value
      promiseHolds(project)
    }
  })

  it('Q · holds on a project rebuilt from what was saved', () => {
    // Reopening must give the same answers. A project that came back from disk
    // differently would make the preview disagree with itself between sessions.
    const edited = accept(testProject(), splitAt(TEST_CLIP_ID, 9))
    const roundTripped = JSON.parse(JSON.stringify(edited)) as EditProject
    promiseHolds(roundTripped)
    for (const tick of [0, seconds(4), seconds(9), seconds(20)]) {
      expect(resolvePrimarySource(roundTripped, tick)).toEqual(resolvePrimarySource(edited, tick))
    }
  })

  it('S · selection changing over and over cannot alter a single answer', () => {
    // The thing the owner's recording appeared to show. It is now structurally
    // impossible rather than merely avoided: the resolver takes two arguments,
    // so there is nowhere for a selection to be passed in.
    const project = accept(testProject(), splitAt(TEST_CLIP_ID, 11))
    const answers = [0, seconds(5), seconds(11), seconds(25)].map((tick) =>
      JSON.stringify(resolvePrimarySource(project, tick)),
    )
    for (let round = 0; round < 20; round += 1) {
      const again = [0, seconds(5), seconds(11), seconds(25)].map((tick) =>
        JSON.stringify(resolvePrimarySource(project, tick)),
      )
      expect(again).toEqual(answers)
    }
    expect(resolvePrimarySource).toHaveLength(2)
  })

  it('T · Fit and Fill cannot alter a single answer either', () => {
    // Fit/Fill is about how the picture is framed. It has nothing to say about
    // whether the picture EXISTS, and there is no slot for it here.
    const project = testProject()
    const before = resolvePrimarySource(project, seconds(5))
    const withFraming = Object.freeze({
      ...project,
      extensions: Object.freeze({ 'sanverse.render/framing': 'fill' }),
    }) as EditProject
    expect(resolvePrimarySource(withFraming, seconds(5))).toEqual(before)
  })
})

describe('re-pointing the one video element after an edit', () => {
  const base = () => reconcilePrimaryPreview({
    nextProject: testProject(),
    playheadTicks: seconds(5),
    loadedAssetId: TEST_ASSET_ID,
    playbackIntent: 'paused',
    generation: 0,
  })

  it('keeps the file already open when the playhead is still inside it', () => {
    // Swapping the source inside the same recording throws away everything the
    // browser buffered and makes the picture stutter at every cut, for nothing.
    const action = base()
    expect(action.kind).toBe('seek-loaded-source')
    expect(previewIsLoading(action)).toBe(false)
  })

  it('opens a different file only when the playhead is genuinely in a different one', () => {
    const action = reconcilePrimaryPreview({
      nextProject: testProject(),
      playheadTicks: seconds(5),
      loadedAssetId: 'asset_somethingelse',
      playbackIntent: 'paused',
      generation: 0,
    })
    expect(action.kind).toBe('load-and-seek')
    // and only THEN is it honest to say the picture is on its way
    expect(previewIsLoading(action)).toBe(true)
  })

  it('seeks to the exact moment of the original recording, not to the moment on the timeline', () => {
    const project = accept(testProject(), trim(TEST_CLIP_ID, 4, 0, true))
    const action = reconcilePrimaryPreview({
      nextProject: project,
      playheadTicks: seconds(1),
      loadedAssetId: TEST_ASSET_ID,
      playbackIntent: 'paused',
      generation: 0,
    })
    if (action.kind === 'show-gap') throw new Error('expected footage')
    // One second into the video is five seconds into the recording, because the
    // first four seconds were trimmed off the front.
    expect(action.sourceTicks).toBe(seconds(5))
    expect(action.sourceSeconds).toBeCloseTo(5, 6)
  })

  it('carries the user’s play or pause intention through a file swap', () => {
    for (const intent of ['playing', 'paused'] as const) {
      const action = reconcilePrimaryPreview({
        nextProject: testProject(),
        playheadTicks: seconds(5),
        loadedAssetId: 'asset_somethingelse',
        playbackIntent: intent,
        generation: 0,
      })
      if (action.kind === 'show-gap') throw new Error('expected footage')
      expect(action.playbackIntent).toBe(intent)
    }
  })

  it('throws away a load that finished after the world moved on', () => {
    // t=0    playhead enters recording B  -> start loading B
    // t=40   the user presses Undo, playhead is back in A
    // t=90   B finishes: "I am ready, seek to 4.2s"
    // Obeying that last message puts recording B on screen while the playhead
    // sits in recording A — wrong footage, and nothing looks broken.
    const first = reconcilePrimaryPreview({
      nextProject: testProject(),
      playheadTicks: seconds(5),
      loadedAssetId: null,
      playbackIntent: 'paused',
      generation: 0,
    })
    const second = reconcilePrimaryPreview({
      nextProject: testProject(),
      playheadTicks: seconds(9),
      loadedAssetId: null,
      playbackIntent: 'paused',
      generation: first.generation,
    })
    expect(isCurrentGeneration(second, second.generation)).toBe(true)
    expect(isCurrentGeneration(first, second.generation)).toBe(false)
  })

  it('reports a genuine gap as a gap, with the reason that decides the wording', () => {
    const project = accept(testProject(), trackOutput(false))
    const action = reconcilePrimaryPreview({
      nextProject: project,
      playheadTicks: seconds(5),
      loadedAssetId: TEST_ASSET_ID,
      playbackIntent: 'playing',
      generation: 3,
    })
    expect(previewIsGap(action)).toBe(true)
    if (action.kind === 'show-gap') expect(action.reason).toBe('V1_OUTPUT_DISABLED')
  })

  it('never asks for a file that is not in the project', () => {
    const broken = Object.freeze({ ...testProject(), assets: Object.freeze([]) }) as EditProject
    const action = reconcilePrimaryPreview({
      nextProject: broken,
      playheadTicks: seconds(5),
      loadedAssetId: TEST_ASSET_ID,
      playbackIntent: 'paused',
      generation: 0,
    })
    expect(action.kind).toBe('show-gap')
  })

  it('cannot be told about selection, hover or any pointer state', () => {
    // The argument list is the proof. There is no third parameter, so a
    // selection is not merely unused here — it is unexpressible.
    expect(reconcilePrimaryPreview).toHaveLength(1)
    const action = base()
    expect(Object.keys(action).sort()).not.toContain('selectedItemId')
  })

  it('gives a fresh number to every decision, so the newest one always wins', () => {
    let generation = 0
    const seen = new Set<number>()
    for (let step = 0; step < 10; step += 1) {
      const action = reconcilePrimaryPreview({
        nextProject: testProject(),
        playheadTicks: seconds(step),
        loadedAssetId: TEST_ASSET_ID,
        playbackIntent: 'paused',
        generation,
      })
      expect(seen.has(action.generation)).toBe(false)
      seen.add(action.generation)
      generation = action.generation
    }
  })
})
