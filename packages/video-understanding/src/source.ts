export interface VideoFrameRateV1 {
  readonly numerator: number
  readonly denominator: number
}

export interface VideoSourceDescriptorV1 {
  readonly sourceId: string
  readonly durationTicks: number
  readonly width: number
  readonly height: number
  readonly frameRate: VideoFrameRateV1
  readonly audioChannels?: number
  readonly sourceLabel?: string
}

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'

export const videoUnderstandingTicksToSeconds = (ticks: number): number => ticks / PROJECT_TIMESCALE

export interface NormalizedRectV1 {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
