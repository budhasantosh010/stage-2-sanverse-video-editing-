import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VISUAL_PROPERTIES,
  PROJECT_TIMESCALE,
  validateOperation,
  type EditProject,
} from '@sanverse/edit-domain'

import { TEST_CLIP_ID, testProject } from '../../test-fixtures'
import {
  createIds,
  projectWithAllTimelineFamilies,
  splitProject,
} from '../../features/timeline/timeline-test-fixtures'
import { buildTimelineViewModel } from '../../features/timeline'
import type {
  InspectorCaptionSelection,
  InspectorCalloutSelection,
  InspectorMediaOverlaySelection,
  InspectorMusicSelection,
  InspectorTitleSelection,
  InspectorVideoClipSelection,
} from './inspector-contract'
import {
  buildCaptionCueOperation,
  buildCaptionStyleOperation,
  buildClipAudioOperation,
  buildClipEnabledOperation,
  buildClipTransitionOperation,
  buildCalloutOperation,
  buildMediaOverlayOperation,
  buildMusicOperation,
  buildTitleOperation,
  buildVisualPropertiesOperation,
} from './inspector-operations'
import { resolveInspectorSelection } from './inspector-selection-resolver'

const labels = Object.freeze({
  asset_aaaaaaaa: 'owner.mp4',
  asset_image0001: 'product.png',
  asset_broll0001: 'demo.mp4',
  asset_music0001: 'theme.wav',
})

const selected = <T extends Exclude<ReturnType<typeof resolveInspectorSelection>, { kind: 'nothing' }>>(
  project: EditProject,
  predicate: (kind: string) => boolean,
): T => {
  const unselected = buildTimelineViewModel({ project, selectedItemId: null, pending: null, assetLabels: labels })
  const item = unselected.lanes.flatMap((lane) => lane.items).find((candidate) => predicate(candidate.kind))
  if (!item) throw new Error('selection fixture missing')
  const timeline = buildTimelineViewModel({ project, selectedItemId: item.id, pending: null, assetLabels: labels })
  const resolution = resolveInspectorSelection({
    project,
    timeline,
    selectedTimelineItemId: item.id,
    pending: null,
    assetLabels: labels,
  })
  if (resolution.kind === 'nothing') throw new Error('selection did not resolve')
  return resolution as T
}

const expectValid = (operation: unknown) => {
  const result = validateOperation(operation)
  expect(result.ok).toBe(true)
}

describe('Inspector operation builders', () => {
  it('builds existing enabled and audio operations for a selected clip', () => {
    const clip = selected<InspectorVideoClipSelection>(testProject(), (kind) => kind === 'clip')
    const enabled = buildClipEnabledOperation(clip, false, 'operation_enabled1')
    const audio = buildClipAudioOperation(clip, {
      gainDb: -8,
      fadeInTicks: PROJECT_TIMESCALE,
      fadeOutTicks: 2 * PROJECT_TIMESCALE,
    }, 'operation_audio001')

    expect(enabled).toMatchObject({ ok: true, operation: { kind: 'set-clip-enabled', clipId: TEST_CLIP_ID, enabled: false } })
    expect(audio).toMatchObject({ ok: true, operation: { kind: 'set-clip-audio', gainDb: -8 } })
    if (enabled.ok) expectValid(enabled.operation)
    if (audio.ok) expectValid(audio.operation)
  })

  it('refuses an audio draft whose two fades are longer than the clip', () => {
    const clip = selected<InspectorVideoClipSelection>(testProject(), (kind) => kind === 'clip')
    const result = buildClipAudioOperation(clip, {
      gainDb: 0,
      fadeInTicks: 20 * PROJECT_TIMESCALE,
      fadeOutTicks: 20 * PROJECT_TIMESCALE,
    }, 'operation_audio002')
    expect(result).toEqual({ ok: false, message: 'The two fades cannot be longer than this clip.' })
  })

  it('builds a transition only when an adjacent clip exists', () => {
    const project = splitProject(testProject(), 10, createIds())
    const first = selected<InspectorVideoClipSelection>(project, (kind) => kind === 'clip')
    const result = buildClipTransitionOperation(first, {
      style: 'dip-to-black',
      durationTicks: Math.round(PROJECT_TIMESCALE / 2),
      audio: 'fade-through-silence',
    }, 'operation_trans001')
    expect(result).toMatchObject({
      ok: true,
      operation: {
        kind: 'set-clip-transition',
        clipId: first.clip.clipId,
        nextClipId: first.nextClipId,
        style: 'dip-to-black',
      },
    })
    if (result.ok) expectValid(result.operation)
  })

  it('builds full-state caption cue and style repairs', () => {
    const project = projectWithAllTimelineFamilies()
    const caption = selected<InspectorCaptionSelection>(project, (kind) => kind === 'caption')
    const cue = buildCaptionCueOperation(caption, {
      lines: ['Repaired words'],
      startTicks: 2 * PROJECT_TIMESCALE,
      endTicks: 3 * PROJECT_TIMESCALE,
    }, 'operation_caption1')
    const style = buildCaptionStyleOperation(caption, 'sanverse.caption.plain/v1', 'operation_caption2')
    expect(cue).toMatchObject({ ok: true, operation: { kind: 'set-caption-cue', lines: ['Repaired words'] } })
    expect(style).toMatchObject({ ok: true, operation: { kind: 'set-caption-style', styleId: 'sanverse.caption.plain/v1' } })
    if (cue.ok) expectValid(cue.operation)
    if (style.ok) expectValid(style.operation)
  })

  it('builds title, callout, media-overlay and music repairs without losing untouched fields', () => {
    const project = projectWithAllTimelineFamilies()
    const title = selected<InspectorTitleSelection>(project, (kind) => kind === 'title')
    const callout = selected<InspectorCalloutSelection>(project, (kind) => kind === 'callout')
    const media = selected<InspectorMediaOverlaySelection>(project, (kind) => kind === 'media-overlay')
    const music = selected<InspectorMusicSelection>(project, (kind) => kind === 'music')

    const titleResult = buildTitleOperation(title, {
      headline: 'New headline',
      subhead: 'New subhead',
      placement: 'lower-third',
      styleId: 'sanverse.title.plain/v1',
      startTicks: title.operation.sourceInterval.start.ticks,
      endTicks: title.operation.sourceInterval.start.ticks + title.operation.sourceInterval.duration.ticks,
    }, 'operation_title001')
    const calloutResult = buildCalloutOperation(callout, {
      label: 'New label',
      styleId: callout.operation.styleId,
      region: callout.operation.region,
      startTicks: callout.operation.sourceInterval.start.ticks,
      endTicks: callout.operation.sourceInterval.start.ticks + callout.operation.sourceInterval.duration.ticks,
    }, 'operation_callout1')
    const mediaResult = buildMediaOverlayOperation(media, {
      overlayAssetId: media.operation.overlayAssetId,
      region: media.operation.region,
      opacity: 0.5,
      useOverlayAudio: true,
      startTicks: media.operation.sourceInterval.start.ticks,
      endTicks: media.operation.sourceInterval.start.ticks + media.operation.sourceInterval.duration.ticks,
      overlaySourceStartTicks: media.operation.overlaySourceStart.ticks,
    }, 'operation_broll001')
    const musicResult = buildMusicOperation(music, {
      compositionStartTicks: PROJECT_TIMESCALE,
      sourceStartTicks: 0,
      gainDb: -24,
      fadeInTicks: PROJECT_TIMESCALE,
      fadeOutTicks: PROJECT_TIMESCALE,
    }, 'operation_music001')

    for (const result of [titleResult, calloutResult, mediaResult, musicResult]) {
      expect(result.ok).toBe(true)
      if (result.ok) expectValid(result.operation)
    }
    expect(titleResult).toMatchObject({ ok: true, operation: { kind: 'set-title', headline: 'New headline' } })
    expect(calloutResult).toMatchObject({ ok: true, operation: { kind: 'set-callout', label: 'New label' } })
    expect(mediaResult).toMatchObject({ ok: true, operation: { kind: 'set-media-overlay', opacity: 0.5, useOverlayAudio: true } })
    expect(musicResult).toMatchObject({ ok: true, operation: { kind: 'set-music', gainDb: -24 } })
  })

  it('builds one full-state visual-properties operation and preserves keyframes', () => {
    const project = projectWithAllTimelineFamilies()
    const title = selected<InspectorTitleSelection>(project, (kind) => kind === 'title')
    const visual = {
      ...DEFAULT_VISUAL_PROPERTIES,
      transform: { ...DEFAULT_VISUAL_PROPERTIES.transform, scale: 1.25, opacity: 0.8 },
      layer: 3,
      tracks: [{
        property: 'scale' as const,
        keyframes: [
          { at: { ticks: 0, timescale: 1_440_000 as const }, value: 1, easing: { kind: 'linear' as const } },
          { at: { ticks: PROJECT_TIMESCALE, timescale: 1_440_000 as const }, value: 1.25, easing: { kind: 'linear' as const } },
        ],
      }],
    }
    const result = buildVisualPropertiesOperation(title, visual, 'operation_visual01')
    expect(result).toMatchObject({
      ok: true,
      operation: {
        kind: 'set-visual-properties',
        visualId: title.visualId,
        transform: { scale: 1.25, opacity: 0.8 },
        layer: 3,
        tracks: [{ property: 'scale' }],
      },
    })
    if (result.ok) expectValid(result.operation)
  })

  it('does not mutate authoritative selections while building repairs', () => {
    const project = projectWithAllTimelineFamilies()
    const title = selected<InspectorTitleSelection>(project, (kind) => kind === 'title')
    const before = JSON.stringify(title)
    const result = buildTitleOperation(title, {
      headline: 'Changed in the draft',
      subhead: title.operation.subhead,
      placement: title.operation.placement,
      styleId: title.operation.styleId,
      startTicks: title.operation.sourceInterval.start.ticks,
      endTicks: title.operation.sourceInterval.start.ticks + title.operation.sourceInterval.duration.ticks,
    }, 'operation_immutabl')
    expect(result.ok).toBe(true)
    expect(JSON.stringify(title)).toBe(before)
  })
})
