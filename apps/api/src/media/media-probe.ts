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

/**
 * What one file turns out to be, when it could be a video, a picture, or music.
 *
 * The strict `parseProbeOutput` above exists for the FOOTAGE, which must be a
 * real video with real dimensions and a real length, and refuses anything else.
 * This one is for the shelf, where all three kinds are legitimate — so it has
 * to work out which it is looking at instead of assuming.
 *
 * The rule, and why it is this one:
 *
 *   has a picture, no length   → a STILL PICTURE
 *   has a picture and a length → a VIDEO
 *   has a length, no picture   → MUSIC
 *
 * A PNG or a JPEG genuinely has no length: the file describes one frame and
 * nothing about time. So "has a picture but the file cannot say how long it
 * lasts" IS the definition of a still picture, rather than a list of file
 * extensions that would go out of date.
 *
 * An animated GIF has both a picture and a length, so it is read as a video —
 * which is what it is.
 */
export type MediaDescription =
  | Readonly<{
      mediaKind: 'video'
      width: number
      height: number
      duration: MediaTime
      durationMs: number
      durationResidualSeconds: number
      frameRate: Readonly<{ numerator: number; denominator: number }> | null
      hasAudio: boolean
    }>
  | Readonly<{ mediaKind: 'image'; width: number; height: number; codecName: string }>
  | Readonly<{
      mediaKind: 'audio'
      duration: MediaTime
      durationMs: number
      durationResidualSeconds: number
      codecName: string
    }>

export function parseMediaDescription(stdout: string): MediaDescription {
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
  const hasAudio = streams.some((stream) => stream.codec_type === 'audio')

  const rawDuration = Number(record.format?.duration)
  const hasLength = Number.isFinite(rawDuration) && rawDuration > 0
  const width = Number(video?.width)
  const height = Number(video?.height)
  const hasPicture =
    video !== undefined &&
    Number.isSafeInteger(width) && width > 0 &&
    Number.isSafeInteger(height) && height > 0

  if (!hasPicture && !hasLength) {
    throw probeError('That file does not look like a video, a picture, or a piece of music.')
  }

  if (hasPicture && !hasLength) {
    return Object.freeze({
      mediaKind: 'image' as const,
      width,
      height,
      codecName: typeof video.codec_name === 'string' ? video.codec_name : '',
    })
  }

  const converted = mediaTimeFromSeconds(rawDuration)
  if (!converted.ok) throw probeError('The media duration cannot be expressed on the project clock.')
  const timing = {
    duration: converted.value.time,
    durationMs: Math.round(rawDuration * 1000),
    durationResidualSeconds: converted.value.residualSeconds,
  }

  if (!hasPicture) {
    if (!hasAudio) throw probeError('That file has neither a picture nor any sound.')
    const audioStream = streams.find((stream) => stream.codec_type === 'audio')
    return Object.freeze({
      mediaKind: 'audio' as const,
      ...timing,
      codecName: typeof audioStream?.codec_name === 'string' ? audioStream.codec_name : '',
    })
  }

  return Object.freeze({
    mediaKind: 'video' as const,
    width,
    height,
    ...timing,
    frameRate: parseFrameRate(video?.r_frame_rate),
    hasAudio,
  })
}

export interface MediaDescriberPort {
  describe(input: {
    readonly path: string
    readonly cwd: string
    readonly signal?: AbortSignal
  }): Promise<MediaDescription>
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

/**
 * The same ffprobe call, read the permissive way, for files on the shelf.
 *
 * One executable, one argument list, two readings — so a video described here
 * and the same video described by the strict probe can never disagree about its
 * length or its size.
 */
export function createFfprobeMediaDescriber(options: {
  readonly ffprobeExecutable?: string
  readonly runCommand?: CommandRunner
} = {}): MediaDescriberPort {
  const ffprobeExecutable = options.ffprobeExecutable ?? 'ffprobe'
  const runCommand = options.runCommand ?? createCommandRunner()
  return {
    async describe(input) {
      const result = await runCommand({
        executable: ffprobeExecutable,
        args: [
          '-v', 'error',
          '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration',
          '-of', 'json',
          input.path,
        ],
        cwd: input.cwd,
        signal: input.signal,
      })
      if (result.exitCode !== 0) throw probeError('FFprobe could not read that file.')
      return parseMediaDescription(result.stdout)
    },
  }
}

/**
 * What to tell the browser a file is, worked out from ITS BYTES.
 *
 * Never from the name the user gave it. A name is something a person typed and
 * can say anything; the codec came from actually decoding the first frames.
 *
 * An unrecognised codec falls back to a type the browser will refuse to render
 * as a document, so an unexpected file can only ever fail to display — it can
 * never be treated as a page.
 */
export function contentTypeFor(description: MediaDescription): string {
  if (description.mediaKind === 'image') {
    const known: Record<string, string> = {
      png: 'image/png',
      mjpeg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      bmp: 'image/bmp',
      gif: 'image/gif',
      tiff: 'image/tiff',
    }
    return known[description.codecName] ?? 'application/octet-stream'
  }
  if (description.mediaKind === 'audio') {
    const known: Record<string, string> = {
      mp3: 'audio/mpeg',
      aac: 'audio/aac',
      flac: 'audio/flac',
      opus: 'audio/ogg',
      vorbis: 'audio/ogg',
      pcm_s16le: 'audio/wav',
    }
    return known[description.codecName] ?? 'audio/mpeg'
  }
  return 'video/mp4'
}
