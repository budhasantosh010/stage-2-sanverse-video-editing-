import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import {
  RENDER_PLAN_SCHEMA_VERSION,
  type MovingSourceSegmentNode,
  type RenderPlan,
  type TextOverlayNode,
} from '@sanverse/render-contract'

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

/** One fully explicit v8 moving-picture segment. Tests override only the fact they exercise. */
export const testSegmentNode = (
  overrides: Partial<MovingSourceSegmentNode> = {},
): MovingSourceSegmentNode => {
  const {
    interval: requestedInterval,
    sourceStartTicks: requestedSourceStartTicks,
    sourceDurationTicks: requestedSourceDurationTicks,
    linkedAudio: requestedLinkedAudio,
    ...rest
  } = overrides
  const interval = requestedInterval ?? { start: ms(0), duration: ms(8_000) }
  const sourceStartTicks = requestedSourceStartTicks ?? 0
  const sourceDurationTicks = requestedSourceDurationTicks ?? interval.duration.ticks
  const linkedAudio = requestedLinkedAudio === undefined
    ? Object.freeze({
        interval,
        sourceStartTicks,
        sourceDurationTicks,
      })
    : requestedLinkedAudio
  return {
    nodeId: 'clip_aaaaaaaa',
    kind: 'source-segment',
    assetId: 'asset_aaaaaaaa',
    videoEnabled: true,
    audioEnabled: true,
    footageMotions: [],
    gainDb: 0,
    fadeInTicks: 0,
    fadeOutTicks: 0,
    playbackRateNumerator: 1,
    playbackRateDenominator: 1,
    direction: 'forward',
    maintainAudioPitch: true,
    pan: 0,
    ...rest,
    // These defaults depend on the possibly-overridden interval/source range,
    // so they are re-applied after the spread unless the test explicitly
    // supplied its own v8 value.
    interval,
    sourceStartTicks,
    sourceDurationTicks,
    linkedAudio,
  }
}

/** Matches the 1280x720, 8-second media the probe fixture reports. */
export const testPlan = (overrides: Partial<RenderPlan> = {}): RenderPlan => ({
  schemaVersion: RENDER_PLAN_SCHEMA_VERSION,
  projectId: 'project_aaaaaaaaaaaaaaaa',
  projectRevision: 1,
  compositionId: 'composition_aaaaaaaa',
  width: 1280,
  height: 720,
  durationTicks: 8_000 * TICKS_PER_MS,
  sources: [{ assetId: 'asset_aaaaaaaa', mediaKind: 'video' }],
  segments: [testSegmentNode()],
  transitions: [],
  overlays: [testOverlayNode()],
  visuals: [],
  music: [],
  ...overrides,
})

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