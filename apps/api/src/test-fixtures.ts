import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import type { RenderPlan, SourceSegmentNode, TextOverlayNode } from '@sanverse/render-contract'

import type { MediaProbePort } from './media/media-probe.ts'
import type { ProjectRepository } from './projects/project-repository.ts'

const TICKS_PER_MS = PROJECT_TIMESCALE / 1000

export const ms = (milliseconds: number) => ({
  ticks: milliseconds * TICKS_PER_MS,
  timescale: PROJECT_TIMESCALE,
}) as const

export const testOverlayNode = (overrides: Partial<TextOverlayNode> = {}): TextOverlayNode => ({
  nodeId: 'operation_aaaaaaaa',
  kind: 'text-overlay',
  interval: { start: ms(1_000), duration: ms(5_000) },
  target: { coordinateSpace: 'composition-normalized', point: { x: 1, y: 1 }, anchor: 'center' },
  primaryText: String.raw`O'Brien, CEO: C:\clips\[safe]`,
  secondaryText: '50% %{pts}; safe',
  styleId: 'sanverse.nameplate.default/v1',
  ...overrides,
} as TextOverlayNode)

export const testSegmentNode = (overrides: Partial<SourceSegmentNode> = {}): SourceSegmentNode => ({
  nodeId: 'clip_aaaaaaaa',
  kind: 'source-segment',
  interval: { start: ms(0), duration: ms(8_000) },
  assetId: 'asset_aaaaaaaa',
  sourceStartTicks: 0,
  videoEnabled: true,
  audioEnabled: true,
  footageMotions: [],
  gainDb: 0,
  fadeInTicks: 0,
  fadeOutTicks: 0,
  videoFadeInTicks: 0,
  videoFadeOutTicks: 0,
  transitionAudioFadeInTicks: 0,
  transitionAudioFadeOutTicks: 0,
  ...overrides,
} as SourceSegmentNode)

/** Matches the 1280x720, 8-second media the probe fixture reports. */
export const testPlan = (overrides: Partial<RenderPlan> = {}): RenderPlan => ({
  schemaVersion: 'sanverse.render-plan/v7',
  projectId: 'project_aaaaaaaaaaaaaaaa',
  projectRevision: 1,
  compositionId: 'composition_aaaaaaaa',
  width: 1280,
  height: 720,
  durationTicks: 8_000 * TICKS_PER_MS,
  sources: [{ assetId: 'asset_aaaaaaaa', mediaKind: 'video' }],
  segments: [testSegmentNode()],
  overlays: [testOverlayNode()],
  visuals: [],
  music: [],
  ...overrides,
} as RenderPlan)

/** The source facts the argument builder needs alongside a plan. */
export const testSourceFacts = {
  frameRate: { numerator: 30, denominator: 1 },
  hasAudio: true,
} as const

export const probeJson = (durationSeconds = 8, hasAudio = true, width = 1280, height = 720) =>
  JSON.stringify({
    streams: [
      { codec_type: 'video', width, height, r_frame_rate: '30/1' },
      ...(hasAudio ? [{ codec_type: 'audio' }] : []),
    ],
    format: { duration: String(durationSeconds) },
  })

export const stubMediaProbe = (
  probe: Partial<Awaited<ReturnType<MediaProbePort['probe']>>> = {},
): MediaProbePort => ({
  async probe() {
    return {
      width: 1280,
      height: 720,
      durationMs: 8_000,
      duration: ms(8_000),
      durationResidualSeconds: 0,
      frameRate: { numerator: 30, denominator: 1 },
      hasAudio: true,
      ...probe,
    }
  },
})

export const stubRepositoryMethods = (): Pick<ProjectRepository, 'resolveMediaPaths'> => ({
  async resolveMediaPaths() {
    return { sourcePath: 'source.mp4', trustedWorkDir: 'work' }
  },
})
