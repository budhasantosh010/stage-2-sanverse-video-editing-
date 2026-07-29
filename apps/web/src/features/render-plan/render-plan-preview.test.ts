import { describe, expect, it } from 'vitest'

import type { RenderPlan } from '@sanverse/render-contract'
import { changeSetOf, testCallout, testProject, testTitle } from '@sanverse/edit-domain/test-fixtures'
import {
  compilePreviewPlan,
  isNodeVisible,
  segmentVideoOpacityAt,
  visualCssStyleAt,
  withPendingChangeSet,
} from './render-plan-preview.ts'

const S = 1_440_000 as const
const at = (seconds: number) => ({ ticks: seconds * S, timescale: S })
const node = {
  nodeId: 'broll_motion',
  kind: 'media-overlay' as const,
  interval: { start: at(2), duration: at(3) },
  assetId: 'asset_bbbbbbbb',
  sourceStartTicks: 0,
  region: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 },
  opacity: 1,
  useOverlayAudio: false,
}
const plan = {
  schemaVersion: 'sanverse.render-plan/v5',
  projectId: 'project_aaaaaaaa',
  projectRevision: 1,
  compositionId: 'composition_aaaaaaaa',
  width: 1280,
  height: 720,
  durationTicks: 8 * S,
  sources: [
    { assetId: 'asset_aaaaaaaa', mediaKind: 'video' },
    { assetId: 'asset_bbbbbbbb', mediaKind: 'video' },
  ],
  segments: [],
  overlays: [node],
  visuals: [{
    visualId: node.nodeId,
    nodeIds: [node.nodeId],
    transform: { translateX: 0, translateY: 0, scale: 1, rotationDegrees: 0, opacity: 0.8 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    layer: 2,
    mask: { shape: 'none', feather: 0 },
    tracks: [{
      property: 'translate-x',
      keyframes: [
        { at: at(0), value: 0, easing: { kind: 'linear' } },
        { at: at(1), value: 0.1, easing: { kind: 'linear' } },
      ],
    }],
    transition: {
      enter: { kind: 'fade', duration: at(0.25), easing: { kind: 'linear' } },
      exit: { kind: 'none', duration: at(0), easing: { kind: 'linear' } },
    },
    effects: [],
  }],
  music: [],
} satisfies RenderPlan

describe('motion preview timing', () => {
  it('matches an explicit clip-transition ramp and skips it for reduced motion', () => {
    const segment = {
      nodeId: 'clip_aaaaaaaa',
      kind: 'source-segment' as const,
      interval: { start: at(0), duration: at(10) },
      assetId: 'asset_aaaaaaaa',
      sourceStartTicks: 0,
      gainDb: 0,
      fadeInTicks: 0,
      fadeOutTicks: 0,
      videoFadeInTicks: 0,
      videoFadeOutTicks: at(0.5).ticks,
      transitionAudioFadeInTicks: 0,
      transitionAudioFadeOutTicks: at(0.5).ticks,
    }
    expect(segmentVideoOpacityAt(segment, at(9.75).ticks, false)).toBe(0.5)
    expect(segmentVideoOpacityAt(segment, at(9.75).ticks, true)).toBe(1)
  })

  it('seeks deterministically on the project clock and uses half-open visibility', () => {
    expect(isNodeVisible(node, 2 * S)).toBe(true)
    expect(isNodeVisible(node, 5 * S)).toBe(false)
    expect(visualCssStyleAt(plan, node, 2 * S, 1280, 720, false)?.opacity).toBe(0)
    expect(visualCssStyleAt(plan, node, 3 * S, 1280, 720, false)?.transform).toContain('translate(128px')
  })

  it('resolves the final authored state and skips spatial transitions for reduced motion', () => {
    const reduced = visualCssStyleAt(plan, node, 2 * S, 1280, 720, true)
    expect(reduced?.opacity).toBe(0.8)
    expect(reduced?.transform).toContain('translate(128px')
    expect(reduced?.zIndex).toBe(2)
  })
})

describe('compound preview', () => {
  it('previews every action in one detached pending change set', () => {
    const project = testProject()
    const pending = changeSetOf('changeset_preview01', project.revision, [
      testTitle(),
      testCallout(),
    ])
    const previewProject = withPendingChangeSet(project, pending)
    const preview = compilePreviewPlan(previewProject)
    expect(project.changeSets).toHaveLength(0)
    expect(previewProject.changeSets).toHaveLength(1)
    expect(preview?.overlays.map((overlay) => overlay.kind)).toEqual([
      'title-overlay',
      'callout-overlay',
    ])
  })
})
