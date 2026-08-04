import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  type EditProject,
} from '@sanverse/edit-domain'
import {
  TRACK_OUTPUT_PRIMITIVE_ID,
  MUSIC_PRIMITIVE_ID,
} from '@sanverse/edit-domain/capabilities'
import {
  changeSetOf,
  ms,
  testCaptions,
  testMediaOverlay,
  testMultiAssetProject,
  testMusic,
  testTitle,
} from '@sanverse/edit-domain/test-fixtures'

import { compileProjectToRenderPlan } from './compile-project.ts'
import type { RenderPlan } from './render-plan.ts'

const setOutput = (trackId: string, outputEnabled: boolean, operationId = 'operation_output01') => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'set-track-output',
  capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
  trackId,
  outputEnabled,
  extensions: {},
})

const accept = (project: EditProject, changeSetId: string, operations: readonly unknown[]): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const compile = (project: EditProject): RenderPlan => {
  const result = compileProjectToRenderPlan(project)
  if (!result.ok) throw new Error(`compile failed: ${JSON.stringify(result.error)}`)
  return result.value
}

/** Everything on screen, plus the music, plus captions. */
const fullProject = (): EditProject =>
  accept(testMultiAssetProject(), 'changeset_fullstack1', [
    testTitle(), testMediaOverlay(), testMusic(), testCaptions(),
  ])

describe('P1-F.1A C1.18 track output reaches the exported file', () => {
  it('says yes to picture and sound on every piece when nothing has been switched off', () => {
    const plan = compile(fullProject())
    for (const segment of plan.segments) {
      expect(segment.videoEnabled).toBe(true)
      expect(segment.audioEnabled).toBe(true)
    }
  })

  it('V1 off leaves black of exactly the same length, so nothing after it moves', () => {
    const before = compile(fullProject())
    const after = compile(accept(fullProject(), 'changeset_hidevideo1', [setOutput('V1', false)]))

    expect(after.durationTicks).toBe(before.durationTicks)
    expect(after.segments).toHaveLength(before.segments.length)
    after.segments.forEach((segment, index) => {
      expect(segment.videoEnabled).toBe(false)
      expect(segment.interval).toEqual(before.segments[index].interval)
    })
  })

  it('V1 off leaves the voice alone, and A1 off leaves the picture alone', () => {
    const noPicture = compile(accept(fullProject(), 'changeset_hidevideo1', [setOutput('V1', false)]))
    expect(noPicture.segments.every((segment) => segment.audioEnabled)).toBe(true)

    const noVoice = compile(accept(fullProject(), 'changeset_mutevoice1', [setOutput('A1', false)]))
    expect(noVoice.segments.every((segment) => segment.videoEnabled)).toBe(true)
    expect(noVoice.segments.every((segment) => !segment.audioEnabled)).toBe(true)
  })

  it('V2 off draws no title, no B-roll, and no nameplate', () => {
    const plan = compile(accept(fullProject(), 'changeset_hideover01', [setOutput('V2', false)]))
    expect(plan.overlays.filter((node) => node.kind !== 'caption-overlay')).toEqual([])
    // Captions are their own track and are untouched by hiding the overlays.
    expect(plan.overlays.some((node) => node.kind === 'caption-overlay')).toBe(true)
  })

  it('C1 off draws no captions and leaves everything else on screen', () => {
    const plan = compile(accept(fullProject(), 'changeset_hidecaps01', [setOutput('C1', false)]))
    expect(plan.overlays.some((node) => node.kind === 'caption-overlay')).toBe(false)
    expect(plan.overlays.some((node) => node.kind === 'title-overlay')).toBe(true)
    expect(plan.overlays.some((node) => node.kind === 'media-overlay')).toBe(true)
  })

  it('A2 off carries no music, and leaves the dialogue heard', () => {
    const plan = compile(accept(fullProject(), 'changeset_mutemusic1', [setOutput('A2', false)]))
    expect(plan.music).toEqual([])
    expect(plan.segments.every((segment) => segment.audioEnabled)).toBe(true)
  })

  it('hiding the overlays does not break Export when something was adjusted on them', () => {
    // A visual adjustment names a node that is no longer drawn. That is the
    // expected outcome of hiding the track, not a broken project — and a user
    // must never reach a state where a switch makes Export stop working.
    const project = accept(fullProject(), 'changeset_hideover01', [setOutput('V2', false)])
    expect(compileProjectToRenderPlan(project).ok).toBe(true)
  })

  it('switching a track back on restores the same plan the user saw before', () => {
    const before = compile(fullProject())
    let project = accept(fullProject(), 'changeset_mutemusic1', [setOutput('A2', false)])
    project = accept(project, 'changeset_unmutemus1', [setOutput('A2', true, 'operation_output02')])
    const after = compile(project)

    expect(after.music).toEqual(before.music)
    expect(after.segments).toEqual(before.segments)
    expect(after.overlays).toEqual(before.overlays)
  })

  it('moves the plan version, because the export key is built from it', () => {
    // Without this a user who muted the dialogue and pressed Export would be
    // handed the file from before the mute and have no way to tell.
    expect(compile(fullProject()).schemaVersion).toBe('sanverse.render-plan/v7')
  })
})

describe('P1-F.1A C1.11 music length in the exported file', () => {
  const musicProject = (durationTicks: unknown): EditProject =>
    accept(testMultiAssetProject(), 'changeset_addmusic01', [{ ...testMusic(), durationTicks }])

  it('an unbounded bed still runs to the end of the finished video', () => {
    const plan = compile(musicProject(null))
    expect(plan.music[0].interval.start.ticks).toBe(0)
    expect(plan.music[0].interval.duration.ticks).toBe(plan.durationTicks)
  })

  it('a length the user set is honoured exactly', () => {
    const plan = compile(musicProject(ms(6_000)))
    expect(plan.music[0].interval.duration.ticks).toBe(ms(6_000).ticks)
  })

  it('never pads with silence to reach a length the song cannot fill', () => {
    // The song is 120 s. Starting 118 s in leaves 2 s, whatever was asked for.
    const project = accept(testMultiAssetProject(), 'changeset_addmusic01', [
      { ...testMusic(), sourceStart: ms(118_000), durationTicks: ms(30_000) },
    ])
    expect(compile(project).music[0].interval.duration.ticks).toBe(ms(2_000).ticks)
  })

  it('never runs past the end of the finished video either', () => {
    const plan = compile(musicProject(ms(600_000)))
    expect(plan.music[0].interval.duration.ticks).toBe(plan.durationTicks)
  })

  it('shortens the fades rather than letting them overrun a shortened bed', () => {
    const project = accept(testMultiAssetProject(), 'changeset_addmusic01', [
      { ...testMusic(), fadeIn: ms(1_000), fadeOut: ms(2_000), durationTicks: ms(2_000) },
    ])
    const node = compile(project).music[0]
    expect(node.fadeInTicks + node.fadeOutTicks).toBeLessThanOrEqual(node.interval.duration.ticks)
  })

  it('lets a repair shorten a bed already on the timeline', () => {
    let project = musicProject(null)
    project = accept(project, 'changeset_trimmusic1', [
      {
        ...testMusic(),
        operationId: 'operation_setmusic01',
        kind: 'set-music',
        capabilityId: MUSIC_PRIMITIVE_ID,
        durationTicks: ms(3_000),
      },
    ])
    expect(compile(project).music[0].interval.duration.ticks).toBe(ms(3_000).ticks)
  })
})
