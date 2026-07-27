import { createHash, randomUUID } from 'node:crypto'
import { constants, createReadStream } from 'node:fs'
import { chmod, copyFile, link, lstat, mkdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import { validateRenderPlan, type RenderPlan, type TextOverlayNode } from '@sanverse/render-contract'
import {
  NAMEPLATE_STYLE_V1,
  anchorFraction,
  ffmpegBoxPositionExpression,
  ffmpegTextInsetExpression,
  resolveNameplateMetrics,
  toFfmpegColor,
} from '@sanverse/render-contract/nameplate-style'

import { createCommandRunner, type CommandRunner } from '../process/command-runner.ts'
import { createFfprobeMediaProbe, type MediaProbePort } from '../media/media-probe.ts'
import { RenderError, type RenderPort, type RenderRequest, type RenderResult } from './render-port.ts'

const DURATION_TOLERANCE_MS = 100
const MAX_TEXT_BYTES = 4096

export type { CommandInvocation, CommandResult, CommandRunner } from '../process/command-runner.ts'
export { createCommandRunner } from '../process/command-runner.ts'

type AdapterOptions = {
  readonly fontPath: string
  readonly ffmpegExecutable?: string
  readonly ffprobeExecutable?: string
  readonly runCommand?: CommandRunner
  readonly mediaProbe?: MediaProbePort
}

type BuildArgumentsInput = {
  readonly sourcePath: string
  readonly outputPath: string
  readonly fontPath: string
  readonly plan: RenderPlan
  /** The source's own frame rate, so generated black matches it exactly. */
  readonly frameRate: Readonly<{ numerator: number; denominator: number }>
  /** False when the source has no sound at all, so no audio is built. */
  readonly hasAudio: boolean
}

/**
 * Every piece of audio is resampled to this before anything is joined.
 *
 * Joining two pieces of audio that disagree about sample rate or channel count
 * is not something FFmpeg guesses at; it fails. Conforming everything first is
 * also what replaced `-c:a copy`, which could only cut audio at its own
 * compression block boundaries and therefore drifted out of sync with the
 * picture at the first cut.
 */
const AUDIO_SAMPLE_RATE = 48_000
const AUDIO_CHANNEL_LAYOUT = 'stereo'

function renderError(code: RenderError['code'], message: string): RenderError {
  return new RenderError(code, message)
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function isInside(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

/**
 * Nine decimals is finer than one tick (about 0.69 microseconds), so the
 * conversion to FFmpeg's seconds cannot lose a tick at the boundary.
 */
const ticksToSeconds = (ticks: number): string => (ticks / PROJECT_TIMESCALE).toFixed(9)

/**
 * Build the drawtext filters for one nameplate.
 *
 * Every number here comes from the shared style contract. This file decides
 * nothing about how a nameplate looks; it only translates the contract into
 * FFmpeg's dialect. The browser preview translates the same contract into CSS,
 * and a test evaluates both and fails if they disagree.
 */
function nameplateFilters(node: TextOverlayNode, index: number, plan: RenderPlan, fontPath: string): string[] {
  const metrics = resolveNameplateMetrics(plan.width, plan.height)
  const fraction = anchorFraction(node.target.anchor)
  const startSeconds = ticksToSeconds(node.interval.start.ticks)
  const endSeconds = ticksToSeconds(node.interval.start.ticks + node.interval.duration.ticks)
  const enable = `gte(t\\,${startSeconds})*lt(t\\,${endSeconds})`

  const hasSecondary = node.secondaryText.length > 0

  const boxPosition = (axis: 'x' | 'y', lineHeight: number) =>
    ffmpegBoxPositionExpression({
      axis,
      point: axis === 'x' ? node.target.point.x : node.target.point.y,
      anchorFraction: axis === 'x' ? fraction.x : fraction.y,
      frameSize: axis === 'x' ? plan.width : plan.height,
      safeMargin: metrics.safeMargin,
      padding: metrics.padding,
      lineHeight,
    })

  // Each line is anchored on its own, exactly as the preview measures and
  // places each of its two boxes.
  const primaryX = `${boxPosition('x', metrics.primaryFontSize)}${ffmpegTextInsetExpression('x', metrics.padding, metrics.primaryFontSize)}`
  const primaryY = `${boxPosition('y', metrics.primaryFontSize)}${ffmpegTextInsetExpression('y', metrics.padding, metrics.primaryFontSize)}`
  const secondaryX = `${boxPosition('x', metrics.secondaryFontSize)}${ffmpegTextInsetExpression('x', metrics.padding, metrics.secondaryFontSize)}`
  // The second line's box sits a fixed distance below the first line's box.
  const secondaryY = `${boxPosition('y', metrics.primaryFontSize)}+${metrics.primaryFontSize + metrics.lineGap}` +
    ffmpegTextInsetExpression('y', metrics.padding, metrics.secondaryFontSize)

  const background = toFfmpegColor(NAMEPLATE_STYLE_V1.backgroundColor, NAMEPLATE_STYLE_V1.backgroundOpacity)
  const shared =
    `fontfile='${fontPath}':box=1:boxcolor=${background}:boxborderw=${metrics.padding}` +
    `:fix_bounds=1:expansion=none:enable='${enable}'`

  const filters = [
    `drawtext=${shared}:textfile='primary-${index}.txt'` +
      `:fontcolor=${toFfmpegColor(NAMEPLATE_STYLE_V1.primaryColor, NAMEPLATE_STYLE_V1.primaryOpacity)}` +
      `:fontsize=${metrics.primaryFontSize}:x=${primaryX}:y=${primaryY}`,
  ]
  if (hasSecondary) {
    filters.push(
      `drawtext=${shared}:textfile='secondary-${index}.txt'` +
        `:fontcolor=${toFfmpegColor(NAMEPLATE_STYLE_V1.secondaryColor, NAMEPLATE_STYLE_V1.secondaryOpacity)}` +
        `:fontsize=${metrics.secondaryFontSize}:x=${secondaryX}:y=${secondaryY}`,
    )
  }
  return filters
}

/** One stretch of the finished video: either real footage or a deliberate hole. */
type TimelinePiece =
  | { readonly kind: 'footage'; readonly durationTicks: number; readonly segment: RenderPlan['segments'][number] }
  | { readonly kind: 'hole'; readonly durationTicks: number }

/**
 * Lay the finished video out end to end, filling every hole explicitly.
 *
 * A hole is what "take this out but leave the space" produces. It has to become
 * real black and real silence, because FFmpeg joins pieces one after another
 * and has no notion of a gap between them; without this, removing a middle
 * section without rippling would silently shorten the export and every later
 * nameplate would land in the wrong place.
 */
export function layOutTimeline(plan: RenderPlan): readonly TimelinePiece[] {
  const ordered = [...plan.segments].sort((left, right) => left.interval.start.ticks - right.interval.start.ticks)
  const pieces: TimelinePiece[] = []
  let cursor = 0
  for (const segment of ordered) {
    if (segment.interval.start.ticks > cursor) {
      pieces.push({ kind: 'hole', durationTicks: segment.interval.start.ticks - cursor })
    }
    pieces.push({ kind: 'footage', durationTicks: segment.interval.duration.ticks, segment })
    cursor = segment.interval.start.ticks + segment.interval.duration.ticks
  }
  if (cursor < plan.durationTicks) {
    pieces.push({ kind: 'hole', durationTicks: plan.durationTicks - cursor })
  }
  return Object.freeze(pieces)
}

export function buildFfmpegArguments(input: BuildArgumentsInput): string[] {
  const plan = validateRenderPlan(input.plan)
  if (!plan.ok) {
    throw renderError('RENDER_INPUT_INVALID', 'The render plan is invalid.')
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(input.fontPath)) {
    throw renderError('RENDER_INPUT_INVALID', 'The render font reference must be a fixed workspace filename.')
  }
  if (
    !Number.isSafeInteger(input.frameRate.numerator) || input.frameRate.numerator <= 0 ||
    !Number.isSafeInteger(input.frameRate.denominator) || input.frameRate.denominator <= 0
  ) {
    throw renderError('RENDER_INPUT_INVALID', 'The source frame rate is not usable.')
  }

  const { width, height } = plan.value
  const rate = `${input.frameRate.numerator}/${input.frameRate.denominator}`
  const pieces = layOutTimeline(plan.value)
  const graph: string[] = []
  const concatInputs: string[] = []

  pieces.forEach((piece, index) => {
    const videoLabel = `v${index}`
    const audioLabel = `a${index}`
    const seconds = ticksToSeconds(piece.durationTicks)

    if (piece.kind === 'hole') {
      graph.push(`color=c=black:s=${width}x${height}:r=${rate}:d=${seconds},format=pix_fmts=yuv420p,setsar=1[${videoLabel}]`)
      if (input.hasAudio) {
        graph.push(
          `anullsrc=channel_layout=${AUDIO_CHANNEL_LAYOUT}:sample_rate=${AUDIO_SAMPLE_RATE}:d=${seconds}` +
            `,asetpts=PTS-STARTPTS[${audioLabel}]`,
        )
      }
    } else {
      const from = ticksToSeconds(piece.segment.sourceStartTicks)
      const to = ticksToSeconds(piece.segment.sourceStartTicks + piece.durationTicks)
      graph.push(
        `[0:v]trim=start=${from}:end=${to},setpts=PTS-STARTPTS,fps=${rate},format=pix_fmts=yuv420p,setsar=1[${videoLabel}]`,
      )
      if (input.hasAudio) {
        const steps = [
          `[0:a]atrim=start=${from}:end=${to}`,
          'asetpts=PTS-STARTPTS',
          `aresample=${AUDIO_SAMPLE_RATE}`,
          `aformat=sample_fmts=fltp:channel_layouts=${AUDIO_CHANNEL_LAYOUT}`,
        ]
        if (piece.segment.gainDb !== 0) steps.push(`volume=${piece.segment.gainDb}dB`)
        if (piece.segment.fadeInTicks > 0) {
          steps.push(`afade=t=in:st=0:d=${ticksToSeconds(piece.segment.fadeInTicks)}`)
        }
        if (piece.segment.fadeOutTicks > 0) {
          const start = piece.durationTicks - piece.segment.fadeOutTicks
          steps.push(`afade=t=out:st=${ticksToSeconds(start)}:d=${ticksToSeconds(piece.segment.fadeOutTicks)}`)
        }
        graph.push(`${steps.join(',')}[${audioLabel}]`)
      }
    }

    concatInputs.push(`[${videoLabel}]`)
    if (input.hasAudio) concatInputs.push(`[${audioLabel}]`)
  })

  const audioStreams = input.hasAudio ? 1 : 0
  graph.push(
    `${concatInputs.join('')}concat=n=${pieces.length}:v=1:a=${audioStreams}` +
      `[vcat]${input.hasAudio ? '[acat]' : ''}`,
  )

  const overlayFilters: string[] = []
  plan.value.overlays.forEach((node, index) => {
    if (
      Buffer.byteLength(node.primaryText, 'utf8') > MAX_TEXT_BYTES ||
      Buffer.byteLength(node.secondaryText, 'utf8') > MAX_TEXT_BYTES
    ) {
      throw renderError('RENDER_INPUT_INVALID', 'A nameplate exceeds the render text limit.')
    }
    overlayFilters.push(...nameplateFilters(node, index, plan.value, input.fontPath))
  })
  // `null` is a real filter that passes frames through unchanged. It keeps the
  // graph one shape whether or not anything is drawn, so an export with cuts
  // but no nameplates takes exactly the same code path.
  graph.push(`[vcat]${overlayFilters.length > 0 ? overlayFilters.join(',') : 'null'}[vout]`)

  return [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    '-n',
    '-i', input.sourcePath,
    '-filter_complex', graph.join(';'),
    '-map', '[vout]',
    ...(input.hasAudio ? ['-map', '[acat]'] : []),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    // Pinned so a rendered file's hash is reproducible. Raising this changes
    // output bytes, so it is a deliberate contract, not a performance dial to
    // be turned casually. See ADR-003.
    '-threads', '1',
    '-pix_fmt', 'yuv420p',
    // Audio is re-encoded from the conformed graph above. It is no longer
    // copied, because copied audio can only be cut at its own block boundaries
    // and drifts out of sync with the picture at the first cut.
    ...(input.hasAudio
      ? ['-c:a', 'aac', '-b:a', '192k', '-ar', String(AUDIO_SAMPLE_RATE), '-ac', '2']
      : ['-an']),
    '-map_metadata', '-1',
    '-movflags', '+faststart',
    input.outputPath,
  ]
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw renderError('RENDER_CANCELLED', 'Export was cancelled.')
}

async function sha256(path: string, signal?: AbortSignal): Promise<string> {
  throwIfCancelled(signal)
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) {
    throwIfCancelled(signal)
    hash.update(chunk)
  }
  throwIfCancelled(signal)
  return hash.digest('hex')
}

async function validatePaths(request: RenderRequest, fontPath: string) {
  const work = await realpath(request.trustedWorkDir).catch(() => {
    throw renderError('RENDER_PATH_INVALID', 'The trusted render workspace does not exist.')
  })
  const sourcePath = await realpath(request.sourcePath).catch(() => {
    throw renderError('RENDER_PATH_INVALID', 'The controlled source media does not exist.')
  })
  const source = await stat(sourcePath)
  if (!source.isFile()) throw renderError('RENDER_PATH_INVALID', 'The controlled source media is not a file.')
  const font = await realpath(fontPath).catch(() => {
    throw renderError('RENDER_PATH_INVALID', 'The configured renderer font does not exist.')
  })
  if (!(await stat(font)).isFile()) throw renderError('RENDER_PATH_INVALID', 'The configured renderer font is not a file.')

  const requestedOutputPath = resolve(request.outputPath)
  const outputParent = await realpath(dirname(requestedOutputPath)).catch(() => {
    throw renderError('RENDER_PATH_INVALID', 'The render output directory does not exist.')
  })
  const outputPath = resolve(outputParent, basename(requestedOutputPath))
  if (!isInside(work, outputParent) || outputPath === sourcePath || !/\.mp4$/i.test(basename(outputPath))) {
    throw renderError('RENDER_PATH_INVALID', 'The render output must be a distinct MP4 inside the trusted workspace.')
  }
  try {
    await lstat(outputPath)
    throw renderError('RENDER_PATH_INVALID', 'The render output already exists.')
  } catch (error) {
    if (!isMissing(error)) throw error
  }
  return { work, sourcePath, outputPath, fontPath: font }
}

async function cleanupPrivatePartial(path: string): Promise<void> {
  try {
    const info = await lstat(path)
    if (info.isFile() && info.nlink === 1) await chmod(path, 0o600).catch(() => undefined)
    await rm(path, { force: true })
  } catch (error) {
    if (!isMissing(error)) throw error
  }
}

export function createFfmpegRenderAdapter(options: AdapterOptions): RenderPort {
  const ffmpegExecutable = options.ffmpegExecutable ?? 'ffmpeg'
  const runCommand = options.runCommand ?? createCommandRunner()
  const mediaProbe = options.mediaProbe ?? createFfprobeMediaProbe({
    ffprobeExecutable: options.ffprobeExecutable,
    runCommand,
  })

  return {
    async render(request): Promise<RenderResult> {
      if (request.signal?.aborted) throw renderError('RENDER_CANCELLED', 'Export was cancelled.')
      const plan = validateRenderPlan(request.plan)
      if (!plan.ok) throw renderError('RENDER_INPUT_INVALID', 'The render plan is invalid.')

      const paths = await validatePaths(request, options.fontPath)
      const sourceProbe = await mediaProbe.probe({ path: paths.sourcePath, cwd: paths.work, signal: request.signal })

      // The plan was compiled against the project's own record of the media.
      // If the file on disk disagrees, something replaced it, and rendering
      // would silently produce a video that does not match what was approved.
      if (sourceProbe.width !== plan.value.width || sourceProbe.height !== plan.value.height) {
        throw renderError('RENDER_INPUT_INVALID', 'The source media no longer matches the project composition.')
      }
      // Black filling a deliberate hole has to be generated at the source's own
      // frame rate, or the joined pieces disagree and the export stutters. If
      // the rate cannot be read, that is refused rather than guessed at.
      const frameRate = sourceProbe.frameRate
      if (frameRate === null) {
        throw renderError('RENDER_INPUT_INVALID', 'The source media frame rate could not be read.')
      }
      // Every piece of footage must actually exist inside the file on disk.
      // Overlays no longer need this check: they are positioned from the
      // segments, so a segment that fits guarantees an overlay that fits.
      for (const segment of plan.value.segments) {
        const endTicks = segment.sourceStartTicks + segment.interval.duration.ticks
        if (endTicks > sourceProbe.duration.ticks) {
          throw renderError('RENDER_INPUT_INVALID', 'An accepted edit extends beyond the source duration.')
        }
      }

      const renderTempDir = resolve(paths.work, `.render-${randomUUID()}`)
      const partialPath = resolve(renderTempDir, 'output.mp4')
      try {
        await mkdir(renderTempDir, { recursive: false, mode: 0o700 })
        const canonicalRenderTempDir = await realpath(renderTempDir)
        if (canonicalRenderTempDir !== renderTempDir || !isInside(paths.work, canonicalRenderTempDir)) {
          throw renderError('RENDER_PATH_INVALID', 'The private render workspace is not safe.')
        }
        await copyFile(paths.fontPath, resolve(renderTempDir, 'font.ttf'), constants.COPYFILE_EXCL)
        await Promise.all(plan.value.overlays.flatMap((node, index) => {
          const files = [
            writeFile(resolve(renderTempDir, `primary-${index}.txt`), node.primaryText, { encoding: 'utf8', flag: 'wx', mode: 0o600 }),
          ]
          if (node.secondaryText.length > 0) {
            files.push(writeFile(resolve(renderTempDir, `secondary-${index}.txt`), node.secondaryText, { encoding: 'utf8', flag: 'wx', mode: 0o600 }))
          }
          return files
        }))
        const command = buildFfmpegArguments({
          sourcePath: paths.sourcePath,
          outputPath: partialPath,
          fontPath: 'font.ttf',
          plan: plan.value,
          frameRate,
          hasAudio: sourceProbe.hasAudio,
        })
        const rendered = await runCommand({
          executable: ffmpegExecutable,
          args: command,
          cwd: renderTempDir,
          signal: request.signal,
        })
        if (rendered.exitCode !== 0) {
          throw renderError('RENDER_FAILED', 'FFmpeg could not render the accepted edits.')
        }
        const outputInfo = await lstat(partialPath).catch((error) => {
          if (isMissing(error)) throw renderError('RENDER_OUTPUT_MISSING', 'FFmpeg completed without producing an output file.')
          throw error
        })
        const canonicalPartial = await realpath(partialPath).catch(() => '')
        if (!outputInfo.isFile() || outputInfo.size <= 0 || outputInfo.nlink !== 1 || canonicalPartial !== partialPath) {
          throw renderError('RENDER_OUTPUT_INVALID', 'FFmpeg did not produce a private regular output file.')
        }
        const outputProbe = await mediaProbe.probe({ path: partialPath, cwd: paths.work, signal: request.signal })
        // The length to check against is the PLAN's, not the source file's.
        // After a cut the export is deliberately shorter, and comparing it to
        // the original would reject every successful cut.
        const expectedDurationMs = plan.value.durationTicks / (PROJECT_TIMESCALE / 1000)
        if (
          outputProbe.width !== sourceProbe.width ||
          outputProbe.height !== sourceProbe.height ||
          Math.abs(outputProbe.durationMs - expectedDurationMs) > DURATION_TOLERANCE_MS ||
          (sourceProbe.hasAudio && !outputProbe.hasAudio)
        ) {
          throw renderError('RENDER_OUTPUT_INVALID', 'The rendered output did not match the approved dimensions, length, and audio.')
        }
        const outputSha256 = await sha256(partialPath, request.signal)
        throwIfCancelled(request.signal)
        await chmod(partialPath, 0o444)
        const currentOutputParent = await realpath(dirname(paths.outputPath)).catch(() => '')
        if (currentOutputParent !== dirname(paths.outputPath)) {
          throw renderError('RENDER_PATH_INVALID', 'The render output directory changed before publication.')
        }
        throwIfCancelled(request.signal)
        await link(partialPath, paths.outputPath)
        await rm(partialPath, { force: true }).catch(() => undefined)
        return Object.freeze({
          outputPath: paths.outputPath,
          width: outputProbe.width,
          height: outputProbe.height,
          durationMs: outputProbe.durationMs,
          hasAudio: outputProbe.hasAudio,
          sha256: outputSha256,
          projectRevision: plan.value.projectRevision,
        })
      } catch (error) {
        await cleanupPrivatePartial(partialPath).catch(() => undefined)
        if (request.signal?.aborted) throw renderError('RENDER_CANCELLED', 'Export was cancelled.')
        if (error instanceof RenderError) throw error
        throw renderError('RENDER_FAILED', 'The renderer failed safely before publishing an export.')
      } finally {
        await rm(renderTempDir, { recursive: true, force: true }).catch(() => undefined)
      }
    },
  }
}
