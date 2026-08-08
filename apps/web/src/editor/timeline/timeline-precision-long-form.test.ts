import { describe, expect, it } from 'vitest'

import { effectiveComposition, validateProject, type EditProject } from '@sanverse/edit-domain'
import { buildTimelineViewModel, planPrecisionTrimRequest } from '../../features/timeline'
import { testAsset, testProject } from '../../test-fixtures'
import { ticks, time } from '../../features/timeline/timeline-test-fixtures'
import { planTimelineTrimViewFrames } from './timeline-trim-view-plan'

const LONG_FORM_CLIPS = 250
const LONG_FORM_SECONDS = 60 * 60
const CLIP_TICKS = ticks(LONG_FORM_SECONDS) / LONG_FORM_CLIPS

/**
 * A schema-valid one-hour initial composition built directly, not by replaying
 * 249 Split revisions. The latter measures fixture/history construction rather
 * than the cost of one T3 planner call and took ~45 seconds per test.
 */
const buildHourProject = (): EditProject => {
  const asset = testAsset({ duration: time(LONG_FORM_SECONDS), byteLength: 2_000_000_000 })
  const base = testProject(asset)
  const videoTrack = base.composition.tracks.find((track) => track.kind === 'video')!
  const template = videoTrack.clips[0]
  const clips = Object.freeze(Array.from({ length: LONG_FORM_CLIPS }, (_, index) => Object.freeze({
    ...template,
    clipId: `clip_long${String(index).padStart(6, '0')}`,
    sourceRange: Object.freeze({
      start: Object.freeze({ ticks: index * CLIP_TICKS, timescale: base.timescale }),
      duration: Object.freeze({ ticks: CLIP_TICKS, timescale: base.timescale }),
    }),
    compositionStart: Object.freeze({ ticks: index * CLIP_TICKS, timescale: base.timescale }),
  })))
  const project: EditProject = Object.freeze({
    ...base,
    composition: Object.freeze({
      ...base.composition,
      tracks: Object.freeze(base.composition.tracks.map((track) =>
        track.trackId === videoTrack.trackId ? Object.freeze({ ...track, clips }) : track)),
    }),
  })
  const checked = validateProject(project)
  if (!checked.ok) throw new Error(`long-form fixture invalid: ${JSON.stringify(checked.error)}`)
  return checked.value
}

const HOUR_PROJECT = buildHourProject()
const primaryClips = (project: EditProject) =>
  effectiveComposition(project).tracks
    .find((track) => track.kind === 'video')!
    .clips.slice()
    .sort((a, b) => a.compositionStart.ticks - b.compositionStart.ticks)

const planning = (operationId: string, request: Parameters<typeof planPrecisionTrimRequest>[1]) =>
  planPrecisionTrimRequest({ project: HOUR_PROJECT, operationId, existingItemIds: [] }, request)

describe('T3 precision trimming on a sixty-minute primary sequence', () => {
  it('keeps ripple work bounded by the primary track instead of the project duration', () => {
    const clips = primaryClips(HOUR_PROJECT)
    expect(clips).toHaveLength(LONG_FORM_CLIPS)
    const last = clips[clips.length - 1]
    expect(last.compositionStart.ticks + last.sourceRange.duration.ticks).toBe(ticks(LONG_FORM_SECONDS))

    const result = planning('operation_longripple01', {
      mode: 'ripple-trim', clipId: clips[100].clipId, edge: 'end', deltaTicks: -ticks(0.5),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.operation.changes.length).toBeLessThanOrEqual(clips.length)
    expect(result.operation.changes.length).toBeGreaterThan(100)
  })

  it('plans roll, slip, slide, and multi-roll with work proportional to affected clips', () => {
    const clips = primaryClips(HOUR_PROJECT)
    const halfFrame = ticks(1 / 60)
    const results = [
      planning('operation_longroll001', { mode: 'roll', leftClipId: clips[120].clipId, rightClipId: clips[121].clipId, deltaTicks: halfFrame }),
      planning('operation_longslip001', { mode: 'slip', clipId: clips[121].clipId, deltaTicks: halfFrame }),
      planning('operation_longslide01', { mode: 'slide', clipId: clips[121].clipId, deltaTicks: halfFrame }),
      planning('operation_longmulti01', {
        mode: 'multi-roll',
        editPoints: Object.freeze([
          Object.freeze({ leftClipId: clips[80].clipId, rightClipId: clips[81].clipId }),
          Object.freeze({ leftClipId: clips[180].clipId, rightClipId: clips[181].clipId }),
        ]),
        deltaTicks: halfFrame,
      }),
    ]
    for (const result of results) {
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.operation.changes.length).toBeLessThanOrEqual(4)
    }
  })

  it('keeps active Trim View analysis to four exact frames on the hour-long project', () => {
    const clips = primaryClips(HOUR_PROJECT)
    const selected = clips[121]
    const model = buildTimelineViewModel({ project: HOUR_PROJECT, selectedItemIds: [`clip:${selected.clipId}`], pending: null })
    const result = planning('operation_longview001', { mode: 'slide', clipId: selected.clipId, deltaTicks: ticks(1 / 60) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const frames = planTimelineTrimViewFrames({
      model,
      assetFacts: Object.freeze({
        [selected.assetId]: Object.freeze({ assetVersion: 'a'.repeat(16), mediaKind: 'video' as const, hasAudio: true }),
      }),
      plan: result,
    })
    expect(frames).toHaveLength(4)
    expect(new Set(frames.map((frame) => frame.keyId)).size).toBeLessThanOrEqual(4)
  })
})
