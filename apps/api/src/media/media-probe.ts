import { mediaTimeFromSeconds, type MediaTime } from '@sanverse/edit-domain/time'

import { createCommandRunner, type CommandRunner } from '../process/command-runner.ts'
import { RenderError } from '../render/render-port.ts'

/**
 * What the system learns by looking at a real media file.
 *
 * This is the boundary where messy reality — durations that are decimal
 * seconds, frame rates like 30000/1001 — is converted once into the project's
 * exact whole-number clock. Nothing downstream ever rounds again.
 */
export type MediaProbe = Readonly<{
  width: number
  height: number
  durationMs: number
  duration: MediaTime
  /** Seconds lost when the probed duration was converted to project ticks. */
  durationResidualSeconds: number
  frameRate: Readonly<{ numerator: number; denominator: number }> | null
  hasAudio: boolean
}>

export interface MediaProbePort {
  probe(input: { readonly path: string; readonly cwd: string; readonly signal?: AbortSignal }): Promise<MediaProbe>
}

const probeError = (message: string): RenderError => new RenderError('RENDER_OUTPUT_INVALID', message)

const parseFrameRate = (value: unknown): MediaProbe['frameRate'] => {
  if (typeof value !== 'string') return null
  const match = /^(\d+)\/(\d+)$/.exec(value)
  if (!match) return null
  const numerator = Number(match[1])
  const denominator = Number(match[2])
  if (!Number.isSafeInteger(numerator) || numerator <= 0) return null
  if (!Number.isSafeInteger(denominator) || denominator <= 0) return null
  return Object.freeze({ numerator, denominator })
}

export function parseProbeOutput(stdout: string): MediaProbe {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw probeError('FFprobe returned invalid JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw probeError('FFprobe returned an invalid media description.')
  }
  const record = parsed as { streams?: unknown; format?: { duration?: unknown } }
  if (!Array.isArray(record.streams)) throw probeError('FFprobe did not report media streams.')
  const streams = record.streams.filter((stream): stream is Record<string, unknown> =>
    typeof stream === 'object' && stream !== null,
  )
  const video = streams.find((stream) => stream.codec_type === 'video')
  const durationSeconds = Number(record.format?.duration)
  const width = Number(video?.width)
  const height = Number(video?.height)
  if (
    !Number.isSafeInteger(width) || width <= 0 ||
    !Number.isSafeInteger(height) || height <= 0 ||
    !Number.isFinite(durationSeconds) || durationSeconds <= 0
  ) {
    throw probeError('FFprobe did not report finite video dimensions and duration.')
  }

  const converted = mediaTimeFromSeconds(durationSeconds)
  if (!converted.ok) throw probeError('The media duration cannot be expressed on the project clock.')

  return Object.freeze({
    width,
    height,
    durationMs: Math.round(durationSeconds * 1000),
    duration: converted.value.time,
    durationResidualSeconds: converted.value.residualSeconds,
    frameRate: parseFrameRate(video?.r_frame_rate),
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
  })
}

export function createFfprobeMediaProbe(options: {
  readonly ffprobeExecutable?: string
  readonly runCommand?: CommandRunner
} = {}): MediaProbePort {
  const ffprobeExecutable = options.ffprobeExecutable ?? 'ffprobe'
  const runCommand = options.runCommand ?? createCommandRunner()
  return {
    async probe(input) {
      const result = await runCommand({
        executable: ffprobeExecutable,
        args: [
          '-v', 'error',
          '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration',
          '-of', 'json',
          input.path,
        ],
        cwd: input.cwd,
        signal: input.signal,
      })
      if (result.exitCode !== 0) throw probeError('FFprobe could not validate the media file.')
      return parseProbeOutput(result.stdout)
    },
  }
}
