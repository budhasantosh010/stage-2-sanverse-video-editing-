import { randomBytes } from 'node:crypto'
import { mkdir, open, rm } from 'node:fs/promises'
import { join } from 'node:path'

import {
  MAX_CLIP_GAIN_DB,
  MIN_CLIP_GAIN_DB,
  PROJECT_TIMESCALE,
  type EditProject,
  type MediaAsset,
} from '@sanverse/edit-domain'

import { createCommandRunner, type CommandRunner } from '../process/command-runner.ts'
import type { ProjectRepository } from '../projects/project-repository.ts'
import {
  AnalysisError,
  analysisRequestId,
  ticksToSeconds,
  type AnalysisRequest,
} from './analysis-request.ts'
import {
  createAnalysisCoordinator,
  DEFAULT_ANALYSIS_LIMITS,
  type AnalysisCoordinator,
  type AnalysisCoordinatorLimits,
} from './analysis-coordinator.ts'
import {
  createDerivedMediaCache,
  DERIVED_MEDIA_DIRECTORY,
  type DerivedArtifact,
  type DerivedMediaCache,
} from './derived-media-cache.ts'

/**
 * Making the pictures and the sound-shapes the timeline draws.
 *
 * This is where a request stops being a name and becomes real bytes, using the
 * SAME FFmpeg that produces the finished video. That matters: a filmstrip drawn
 * by a different decoder from the one that exports could show a frame the
 * export does not contain, and the user would cut on a picture that is not
 * there.
 */

/**
 * The one thing about the sound that is forced: how many samples per second.
 *
 * The rate is pinned so the amount of work per second of media is the same
 * whatever the file is. The CHANNELS are deliberately left exactly as the file
 * has them — see the note below, which cost a real measurement to learn.
 */
export const WAVEFORM_SAMPLE_RATE = 48_000

/**
 * How loudness is decided when there is more than one channel.
 *
 * **The loudest of all channels at that position wins.**
 *
 * Not the average. A clap that happens only in the left ear is a real, visible
 * event; averaging it with a silent right ear halves it, and averaging it across
 * six cinema channels all but erases it. A waveform whose job is to help
 * somebody find a moment must not hide the moment.
 *
 * Taking the largest absolute value across a bucket of interleaved samples gives
 * exactly this, because the largest value in a bucket is the largest value of
 * any channel in that bucket — interleaving does not change which number is
 * biggest.
 *
 * ## Why the channels are not forced to two
 *
 * They were, at first, so that the number of samples in a block was known
 * arithmetic. Measured against a real mono file, every waveform came back at
 * 71% of its true height:
 *
 * ```
 *   the file's real loudest point       0.1187
 *   what this reported                  0.0840   ← 71%, exactly 1/√2
 * ```
 *
 * The reason is that turning one channel into two shares the sound between them
 * so the TOTAL energy is unchanged — which is right for playing sound and wrong
 * for measuring it. Every mono recording, which is most voice recordings, would
 * have been drawn three decibels quieter than it is.
 *
 * So the file's own channels are kept, and the short-block problem is solved a
 * different way: the length of the block is worked out from how much sound came
 * back and how much was ASKED for, which needs neither the rate nor the channel
 * count. See `extractWaveform`.
 */
export type WaveformBlockPayload = Readonly<{
  schemaVersion: 'sanverse.waveform-block/v1'
  assetId: string
  sourceTicks: number
  spanTicks: number
  peaks: readonly number[]
}>

export const WAVEFORM_BLOCK_SCHEMA_VERSION = 'sanverse.waveform-block/v1'

export const AUDIO_NORMALIZATION_SCHEMA_VERSION = 'sanverse.audio-normalization-evidence/v1' as const
export const AUDIO_NORMALIZATION_ANALYSIS_VERSION = 'ffmpeg-loudnorm-v1' as const
export const CREATOR_TARGET_INTEGRATED_LUFS = -16
export const CREATOR_TARGET_TRUE_PEAK_DB = -1

export type AudioNormalizationEvidenceV1 = Readonly<{
  schemaVersion: typeof AUDIO_NORMALIZATION_SCHEMA_VERSION
  assetId: string
  assetVersion: string
  sourceStartTicks: number
  sourceEndTicks: number
  analysisVersion: typeof AUDIO_NORMALIZATION_ANALYSIS_VERSION
  integratedLufs: number
  loudnessRangeLufs: number
  truePeakDb: number
  recommendedGainDb: number
  targetIntegratedLufs: number
  targetTruePeakDb: number
}>

type LoudnormMeasurement = Readonly<{
  integratedLufs: number
  loudnessRangeLufs: number
  truePeakDb: number
}>

const finiteMetric = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

/** Read only the final JSON object emitted by FFmpeg loudnorm. */
export const parseLoudnormMeasurement = (stderr: string): LoudnormMeasurement | null => {
  const objects = stderr.match(/\{[\s\S]*?\}/g) ?? []
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    try {
      const value = JSON.parse(objects[index]) as Record<string, unknown>
      const integratedLufs = finiteMetric(value.input_i)
      const loudnessRangeLufs = finiteMetric(value.input_lra)
      const truePeakDb = finiteMetric(value.input_tp)
      if (integratedLufs === null || loudnessRangeLufs === null || truePeakDb === null) continue
      return Object.freeze({ integratedLufs, loudnessRangeLufs, truePeakDb })
    } catch {
      // FFmpeg may print unrelated braces. Continue to the preceding object.
    }
  }
  return null
}

export type MediaAnalysisService = Readonly<{
  produce(input: Readonly<{
    projectId: string
    request: AnalysisRequest
    signal?: AbortSignal
  }>): Promise<DerivedArtifact>
  diagnostics(): ReturnType<AnalysisCoordinator['diagnostics']>
  cache: DerivedMediaCache
}>

export type MediaAnalysisServiceOptions = Readonly<{
  repository: ProjectRepository
  loadProject: (projectId: string) => Promise<EditProject>
  runCommand?: CommandRunner
  ffmpegExecutable?: string
  coordinator?: AnalysisCoordinator
  cache?: DerivedMediaCache
  limits?: AnalysisCoordinatorLimits
}>

const findAsset = (project: EditProject, assetId: string): MediaAsset | undefined =>
  project.assets.find((candidate) => candidate.assetId === assetId)

/** The bytes of a file, named the way the browser named them. */
const assetVersionOf = (asset: MediaAsset): string => asset.sha256.slice(0, 16)

/**
 * Whether this is the ORIGINAL RECORDING the project was made from.
 *
 * It matters because that one file lives beside the project as `source.mp4`,
 * while everything the user added afterwards lives in `assets/`. Ask the wrong
 * folder and the answer is "that file is gone" for the one file that is
 * certainly there — which is exactly what happened the first time this ran
 * against a real project.
 *
 * BOTH spellings are accepted, and that is not tidiness. The saved projects on
 * disk say `project:<id>/source` with a COLON; other code in this repository
 * had written `project/<id>/source` with a slash, which silently never matched
 * anything. Accepting both means a project saved under either spelling works,
 * and neither has to be rewritten.
 */
export const isOriginalRecording = (projectId: string, asset: MediaAsset): boolean =>
  asset.storageRef === `project:${projectId}/source` ||
  asset.storageRef === `project/${projectId}/source`

/**
 * Which kinds of file each question can be asked of.
 *
 * A picture has no moments, so asking for "the frame at four seconds" of a
 * photograph is refused rather than answered with the only frame there is —
 * answering would teach a caller that the moment mattered when it did not.
 */
const ACCEPTS: Readonly<Record<AnalysisRequest['kind'], readonly MediaAsset['mediaKind'][]>> = Object.freeze({
  'filmstrip-frame': Object.freeze(['video'] as const),
  'image-thumbnail': Object.freeze(['image'] as const),
  'waveform-block': Object.freeze(['video', 'audio'] as const),
  'audio-normalization': Object.freeze(['video', 'audio'] as const),
  'reverse-preview': Object.freeze(['video'] as const),
})

export function createMediaAnalysisService(options: MediaAnalysisServiceOptions): MediaAnalysisService {
  const runCommand = options.runCommand ?? createCommandRunner()
  const ffmpegExecutable = options.ffmpegExecutable ?? 'ffmpeg'
  const coordinator = options.coordinator ?? createAnalysisCoordinator(options.limits ?? DEFAULT_ANALYSIS_LIMITS)

  /**
   * The project's own folder, reached through the SAME checked resolution that
   * playback and export use. No path ever comes from the browser.
   */
  const projectDirectory = async (projectId: string): Promise<string> => {
    const { trustedWorkDir } = await options.repository.resolveMediaPaths(projectId)
    return trustedWorkDir
  }

  const cache = options.cache ?? createDerivedMediaCache(projectDirectory)

  /**
   * Where the file actually is.
   *
   * The original recording lives beside the project as `source.mp4`; everything
   * the user added afterwards lives in `assets/`. Both go through the
   * repository, which already refuses symbolic links, hard links, and anything
   * whose real path is not the path that was asked for.
   */
  const resolveAssetFile = async (projectId: string, asset: MediaAsset): Promise<string> => {
    if (isOriginalRecording(projectId, asset)) {
      const { sourcePath } = await options.repository.resolveMediaPaths(projectId)
      return sourcePath
    }
    return options.repository.resolveAssetPath(projectId, asset.assetId)
  }

  /**
   * Somewhere short-lived for FFmpeg to write its answer.
   *
   * FFmpeg writes a file rather than sending bytes back down a pipe because the
   * shared process runner reads a program's output as TEXT, and a picture read
   * as text is a corrupt picture. One extra file, immediately deleted, is the
   * honest way round that.
   */
  const workFile = async (projectId: string, extension: string): Promise<string> => {
    const directory = join(await projectDirectory(projectId), DERIVED_MEDIA_DIRECTORY, 'work')
    await mkdir(directory, { recursive: true })
    return join(directory, `${randomBytes(16).toString('hex')}${extension}`)
  }

  const readWorkFile = async (path: string, limitBytes: number): Promise<Buffer> => {
    let handle
    try {
      handle = await open(path, 'r')
      const info = await handle.stat()
      if (!info.isFile() || info.size <= 0) {
        throw new AnalysisError('DECODER_FAILED', 'That part of the file could not be read.', 502)
      }
      if (info.size > limitBytes) {
        throw new AnalysisError('DECODER_FAILED', 'That preview came back larger than expected.', 502)
      }
      return await handle.readFile()
    } finally {
      await handle?.close().catch(() => undefined)
    }
  }

  /**
   * Run FFmpeg, and turn whatever went wrong into one of a closed set of
   * refusals.
   *
   * The program's own diagnostic text is NEVER passed on. It contains the full
   * path of the user's file, and a path is exactly the thing that must not
   * travel back to a browser.
   */
  const runFfmpeg = async (
    args: readonly string[],
    cwd: string,
    signal: AbortSignal,
  ): Promise<void> => {
    let result
    try {
      result = await runCommand({ executable: ffmpegExecutable, args, cwd, signal })
    } catch (error) {
      if (signal.aborted) throw new AnalysisError('ANALYSIS_CANCELLED', 'That preview was no longer needed.', 499)
      const code = (error as { code?: unknown })?.code
      if (code === 'RENDER_TOOL_UNAVAILABLE') {
        throw new AnalysisError('DECODER_UNAVAILABLE', 'The tool that makes preview pictures is not installed.', 503)
      }
      if (code === 'RENDER_PROCESS_BLOCKED') {
        throw new AnalysisError('DECODER_UNAVAILABLE', 'The tool that makes preview pictures was blocked from starting.', 503)
      }
      if (code === 'RENDER_CANCELLED') {
        throw new AnalysisError('ANALYSIS_CANCELLED', 'That preview was no longer needed.', 499)
      }
      throw new AnalysisError('DECODER_FAILED', 'That part of the file could not be read.', 502)
    }
    if (result.exitCode !== 0) {
      throw new AnalysisError('DECODER_FAILED', 'That part of the file could not be read.', 502)
    }
  }

  const runFfmpegForMeasurement = async (
    args: readonly string[],
    cwd: string,
    signal: AbortSignal,
  ): Promise<string> => {
    try {
      const result = await runCommand({ executable: ffmpegExecutable, args, cwd, signal })
      if (result.exitCode !== 0) {
        throw new AnalysisError('DECODER_FAILED', 'That sound could not be measured.', 502)
      }
      return result.stderr
    } catch (error) {
      if (error instanceof AnalysisError) throw error
      if (signal.aborted) throw new AnalysisError('ANALYSIS_CANCELLED', 'That analysis was no longer needed.', 499)
      const code = (error as { code?: unknown })?.code
      if (code === 'RENDER_TOOL_UNAVAILABLE' || code === 'RENDER_PROCESS_BLOCKED') {
        throw new AnalysisError('DECODER_UNAVAILABLE', 'The tool that measures sound is not available.', 503)
      }
      if (code === 'RENDER_CANCELLED') {
        throw new AnalysisError('ANALYSIS_CANCELLED', 'That analysis was no longer needed.', 499)
      }
      throw new AnalysisError('DECODER_FAILED', 'That sound could not be measured.', 502)
    }
  }

  /**
   * One real frame, at one exact moment, at a bounded size.
   *
   * `-ss` before `-i` is deliberate: it seeks to the moment before decoding
   * starts, which on an hour-long recording is the difference between a fraction
   * of a second and half a minute. It seeks to the nearest keyframe and then
   * decodes forward to the exact moment, so the frame is the right one and not
   * merely a nearby one.
   *
   * `force_original_aspect_ratio=decrease` fits the picture INSIDE the box
   * without stretching it — the same rule the exporter uses for pictures laid on
   * top, so a thumbnail cannot be a different shape from the thing it previews.
   * `setsar=1` finishes the job for footage recorded with non-square pixels, so a
   * 4:3-pixel source is shown at the shape it will actually be exported at.
   *
   * Orientation recorded by a phone is applied by FFmpeg's own default, so a
   * clip filmed upright is previewed upright — the same way it will export.
   *
   * `-map_metadata -1` strips everything else the file was carrying. A camera
   * writes the time, the place, and the device into its files; none of that
   * belongs in a thumbnail.
   */
  const extractFrame = async (
    projectId: string,
    filePath: string,
    request: Extract<AnalysisRequest, { kind: 'filmstrip-frame' }>,
    signal: AbortSignal,
  ): Promise<DerivedArtifact> => {
    const output = await workFile(projectId, '.webp')
    const cwd = await projectDirectory(projectId)
    try {
      await runFfmpeg([
        '-hide_banner', '-nostdin', '-v', 'error',
        '-ss', ticksToSeconds(request.sourceTicks),
        '-i', filePath,
        '-frames:v', '1',
        '-vf', `scale=${request.widthPx}:${request.widthPx}:force_original_aspect_ratio=decrease,setsar=1`,
        '-map_metadata', '-1',
        '-f', 'webp', '-quality', '72', '-compression_level', '4',
        '-y', output,
      ], cwd, signal)
      return Object.freeze({
        bytes: await readWorkFile(output, 2 * 1024 * 1024),
        contentType: 'image/webp',
      })
    } finally {
      await rm(output, { force: true }).catch(() => undefined)
    }
  }

  /** A picture, contained inside a bounded box, orientation honoured. */
  const extractImage = async (
    projectId: string,
    filePath: string,
    request: Extract<AnalysisRequest, { kind: 'image-thumbnail' }>,
    signal: AbortSignal,
  ): Promise<DerivedArtifact> => {
    const output = await workFile(projectId, '.webp')
    const cwd = await projectDirectory(projectId)
    try {
      await runFfmpeg([
        '-hide_banner', '-nostdin', '-v', 'error',
        '-i', filePath,
        '-frames:v', '1',
        '-vf', `scale=${request.widthPx}:${request.heightPx}:force_original_aspect_ratio=decrease,setsar=1`,
        '-map_metadata', '-1',
        '-f', 'webp', '-quality', '78', '-compression_level', '4',
        '-y', output,
      ], cwd, signal)
      return Object.freeze({
        bytes: await readWorkFile(output, 2 * 1024 * 1024),
        contentType: 'image/webp',
      })
    } finally {
      await rm(output, { force: true }).catch(() => undefined)
    }
  }

  /**
   * One bounded stretch of sound, turned into a small list of loudness numbers.
   *
   * Only the requested stretch is decoded — `-ss` then `-t` — so memory is tied
   * to what is on screen and not to how long the user's music is. Ten seconds is
   * the ceiling, which at this format is under two megabytes.
   */
  const extractWaveform = async (
    projectId: string,
    filePath: string,
    request: Extract<AnalysisRequest, { kind: 'waveform-block' }>,
    /** How much sound actually remains in the file from this moment. */
    availableTicks: number,
    signal: AbortSignal,
  ): Promise<DerivedArtifact> => {
    const output = await workFile(projectId, '.pcm')
    const cwd = await projectDirectory(projectId)
    try {
      await runFfmpeg([
        '-hide_banner', '-nostdin', '-v', 'error',
        '-ss', ticksToSeconds(request.sourceTicks),
        '-t', ticksToSeconds(request.spanTicks),
        '-i', filePath,
        '-vn', '-map', '0:a:0',
        // No `-ac`: the file's own channels are kept, or every mono recording
        // reads three decibels quieter than it is. See the long note above.
        '-ar', String(WAVEFORM_SAMPLE_RATE),
        '-f', 's16le', '-acodec', 'pcm_s16le',
        '-y', output,
      ], cwd, signal)
      const raw = await readWorkFile(output, 16 * 1024 * 1024)
      /*
       * How wide the block is, in samples, WITHOUT knowing the rate or the
       * channel count.
       *
       * The sound that came back covers `availableTicks`; the block on screen
       * is `spanTicks` wide. So the numbers fill that fraction of it and the
       * rest is silence — which is what is actually there. A block at the very
       * end of a song holds half a second of sound and must be drawn as half a
       * second of sound, not as a whole second stretched to fit.
       */
      const actualSamples = Math.floor(raw.byteLength / 2)
      const covered = Math.max(1, Math.min(availableTicks, request.spanTicks))
      const expectedSamples = Math.max(1, Math.round((actualSamples * request.spanTicks) / covered))
      const peaks = peaksFromPcm(raw, expectedSamples, request.peakCount)
      const payload: WaveformBlockPayload = Object.freeze({
        schemaVersion: WAVEFORM_BLOCK_SCHEMA_VERSION,
        assetId: request.assetId,
        sourceTicks: request.sourceTicks,
        spanTicks: request.spanTicks,
        peaks,
      })
      return Object.freeze({
        bytes: Buffer.from(JSON.stringify(payload), 'utf8'),
        contentType: 'application/json; charset=utf-8',
      })
    } finally {
      await rm(output, { force: true }).catch(() => undefined)
    }
  }

  /**
   * Prepare one short backwards copy for the browser Preview.
   *
   * FFmpeg's reverse filters buffer the chosen interval before emitting it, so
   * the request parser caps this at thirty seconds and the coordinator runs one
   * prepared-video job at a time. The artifact is intentionally a modest H.264
   * MP4: it is a throwaway editing proxy, not the final export, and it must stay
   * under the derived-media cache's four-megabyte per-file ceiling.
   */
  const extractReversePreview = async (
    projectId: string,
    filePath: string,
    request: Extract<AnalysisRequest, { kind: 'reverse-preview' }>,
    hasAudio: boolean,
    signal: AbortSignal,
  ): Promise<DerivedArtifact> => {
    const output = await workFile(projectId, '.mp4')
    const cwd = await projectDirectory(projectId)
    const durationTicks = request.sourceEndTicks - request.sourceStartTicks
    const common = [
      '-hide_banner', '-nostdin', '-v', 'error',
      '-ss', ticksToSeconds(request.sourceStartTicks),
      '-t', ticksToSeconds(durationTicks),
      '-i', filePath,
    ] as const
    const videoEncoding = [
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30',
      '-maxrate', '700k', '-bufsize', '1400k',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-map_metadata', '-1',
    ] as const
    try {
      if (hasAudio) {
        await runFfmpeg([
          ...common,
          '-filter_complex',
          '[0:v:0]reverse,scale=854:480:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=854:480:(ow-iw)/2:(oh-ih)/2,setsar=1[v];[0:a:0]areverse[a]',
          '-map', '[v]', '-map', '[a]',
          ...videoEncoding,
          '-c:a', 'aac', '-b:a', '64k', '-ar', '48000',
          '-y', output,
        ], cwd, signal)
      } else {
        await runFfmpeg([
          ...common,
          '-map', '0:v:0',
          '-vf', 'reverse,scale=854:480:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=854:480:(ow-iw)/2:(oh-ih)/2,setsar=1',
          ...videoEncoding,
          '-an',
          '-y', output,
        ], cwd, signal)
      }
      return Object.freeze({
        bytes: await readWorkFile(output, 4 * 1024 * 1024),
        contentType: 'video/mp4',
      })
    } finally {
      await rm(output, { force: true }).catch(() => undefined)
    }
  }

  const analyzeNormalization = async (
    projectId: string,
    filePath: string,
    request: Extract<AnalysisRequest, { kind: 'audio-normalization' }>,
    signal: AbortSignal,
  ): Promise<DerivedArtifact> => {
    const durationTicks = request.sourceEndTicks - request.sourceStartTicks
    const projectCwd = await projectDirectory(projectId)
    const stderr = await runFfmpegForMeasurement([
      '-hide_banner', '-nostdin', '-v', 'info',
      '-ss', ticksToSeconds(request.sourceStartTicks),
      '-t', ticksToSeconds(durationTicks),
      '-i', filePath,
      '-vn', '-map', '0:a:0',
      '-af', `loudnorm=I=${CREATOR_TARGET_INTEGRATED_LUFS}:LRA=11:TP=${CREATOR_TARGET_TRUE_PEAK_DB}:print_format=json`,
      '-f', 'null', '-',
    ], projectCwd, signal)
    const measured = parseLoudnormMeasurement(stderr)
    if (!measured || measured.integratedLufs <= -70) {
      throw new AnalysisError('AUDIO_SILENT', 'This sound is silent or too quiet to normalize safely.', 422)
    }
    const loudnessGain = CREATOR_TARGET_INTEGRATED_LUFS - measured.integratedLufs
    const peakSafeGain = CREATOR_TARGET_TRUE_PEAK_DB - measured.truePeakDb
    const recommendedGainDb = Math.round(
      Math.min(MAX_CLIP_GAIN_DB, Math.max(MIN_CLIP_GAIN_DB, Math.min(loudnessGain, peakSafeGain))) * 100,
    ) / 100
    const evidence: AudioNormalizationEvidenceV1 = Object.freeze({
      schemaVersion: AUDIO_NORMALIZATION_SCHEMA_VERSION,
      assetId: request.assetId,
      assetVersion: request.assetVersion,
      sourceStartTicks: request.sourceStartTicks,
      sourceEndTicks: request.sourceEndTicks,
      analysisVersion: AUDIO_NORMALIZATION_ANALYSIS_VERSION,
      integratedLufs: measured.integratedLufs,
      loudnessRangeLufs: measured.loudnessRangeLufs,
      truePeakDb: measured.truePeakDb,
      recommendedGainDb,
      targetIntegratedLufs: CREATOR_TARGET_INTEGRATED_LUFS,
      targetTruePeakDb: CREATOR_TARGET_TRUE_PEAK_DB,
    })
    return Object.freeze({
      bytes: Buffer.from(JSON.stringify(evidence), 'utf8'),
      contentType: 'application/json; charset=utf-8',
    })
  }

  return Object.freeze({
    cache,
    diagnostics: () => coordinator.diagnostics(),

    async produce({ projectId, request, signal }) {
      const project = await options.loadProject(projectId)
      const asset = findAsset(project, request.assetId)
      if (!asset) throw new AnalysisError('ASSET_NOT_FOUND', 'That file is not part of this project.', 404)

      // The name carries which BYTES were expected. If they no longer match, the
      // file behind the slot changed, and the honest answer is to refuse rather
      // than hand back a picture of the old footage.
      if (assetVersionOf(asset) !== request.assetVersion) {
        throw new AnalysisError('ANALYSIS_KEY_INVALID', 'That file has changed since this preview was asked for.', 409)
      }

      if (!ACCEPTS[request.kind].includes(asset.mediaKind)) {
        throw new AnalysisError('ASSET_KIND_UNSUPPORTED', 'That kind of preview does not apply to this file.', 415)
      }
      if ((request.kind === 'waveform-block' || request.kind === 'audio-normalization') && !asset.hasAudio) {
        throw new AnalysisError('ASSET_KIND_UNSUPPORTED', 'That file has no sound to measure.', 415)
      }

      const durationTicks = asset.duration?.ticks ?? 0
      if (request.kind === 'audio-normalization' || request.kind === 'reverse-preview') {
        if (
          durationTicks <= 0 ||
          request.sourceStartTicks < 0 ||
          request.sourceEndTicks > durationTicks ||
          request.sourceEndTicks <= request.sourceStartTicks
        ) {
          throw new AnalysisError(
            'SOURCE_TIME_OUT_OF_RANGE',
            request.kind === 'audio-normalization'
              ? 'That stretch of sound is outside the file.'
              : 'That stretch of footage is outside the file.',
            416,
          )
        }
      } else if (request.kind !== 'image-thumbnail') {
        if (durationTicks <= 0 || request.sourceTicks >= durationTicks) {
          throw new AnalysisError('SOURCE_TIME_OUT_OF_RANGE', 'That moment is past the end of the file.', 416)
        }
      }
      // A picture and a whole-interval loudness measurement do not use the
      // waveform-only "amount remaining after sourceTicks" value.
      const availableTicks = request.kind === 'filmstrip-frame' || request.kind === 'waveform-block'
        ? Math.max(0, durationTicks - request.sourceTicks)
        : 0

      // Already made? Then no program has to run at all. This is what makes a
      // reopened project instant and a re-scroll free.
      const cached = await cache.read(projectId, request)
      if (cached) return cached

      const lane = request.kind === 'reverse-preview'
        ? 'video' as const
        : request.kind === 'waveform-block' || request.kind === 'audio-normalization'
          ? 'waveform' as const
          : 'frame' as const
      return coordinator.run({
        lane,
        jobId: `${projectId}:${analysisRequestId(request)}`,
        signal,
        work: async (jobSignal) => {
          // Checked again inside the job: a cheap read here saves a whole FFmpeg
          // run for every request that queued behind an identical one.
          const late = await cache.read(projectId, request)
          if (late) return late

          let filePath: string
          try {
            filePath = await resolveAssetFile(projectId, asset)
          } catch {
            throw new AnalysisError('ASSET_MISSING', 'That file is no longer where the project left it.', 410)
          }

          const artifact = request.kind === 'filmstrip-frame'
            ? await extractFrame(projectId, filePath, request, jobSignal)
            : request.kind === 'image-thumbnail'
              ? await extractImage(projectId, filePath, request, jobSignal)
              : request.kind === 'audio-normalization'
                ? await analyzeNormalization(projectId, filePath, request, jobSignal)
                : request.kind === 'reverse-preview'
                  ? await extractReversePreview(projectId, filePath, request, asset.hasAudio, jobSignal)
                  : await extractWaveform(projectId, filePath, request, availableTicks, jobSignal)

          // Only successes are kept. A file that was busy for one second must
          // not be reported missing for the rest of the session.
          await cache.write(projectId, request, artifact)
          return artifact
        },
      })
    },
  })
}

/**
 * Turn raw sound numbers into one loudness value per bucket.
 *
 * The samples arrive as pairs of whole numbers between −32,768 and 32,767 (this
 * is what "16-bit sound" means: each moment of each channel is one of 65,536
 * possible levels). Dividing by 32,768 puts everything on the 0-to-1 scale the
 * timeline draws with.
 *
 * A block that came back short — the last block of a song — is padded with
 * silence to the length it was ASKED for, so the shape stays in the right place
 * instead of being stretched to fill a width it does not occupy.
 */
export const peaksFromPcm = (
  raw: Buffer,
  expectedSamples: number,
  peakCount: number,
): readonly number[] => {
  const buckets = Math.max(1, Math.floor(peakCount))
  const available = Math.floor(raw.byteLength / 2)
  const total = Math.max(expectedSamples, 1)
  const peaks = new Array<number>(buckets).fill(0)
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const from = Math.floor((bucket * total) / buckets)
    const to = Math.min(available, Math.floor(((bucket + 1) * total) / buckets))
    let loudest = 0
    for (let index = from; index < to; index += 1) {
      const value = Math.abs(raw.readInt16LE(index * 2))
      if (value > loudest) loudest = value
    }
    // 32,768 rather than 32,767, because the scale runs from −32,768 upwards and
    // the quietest possible value must map to exactly 0, the loudest to 1.
    const scaled = loudest / 32_768
    peaks[bucket] = scaled > 1 ? 1 : scaled
  }
  return Object.freeze(peaks)
}
