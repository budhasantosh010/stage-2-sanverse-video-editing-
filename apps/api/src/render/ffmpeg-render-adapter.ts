import { createHash, randomUUID } from 'node:crypto'
import { constants, createReadStream } from 'node:fs'
import { chmod, copyFile, link, lstat, mkdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import { validateRenderPlan, type RenderPlan, type TextOverlayNode } from '@sanverse/render-contract'
import {
  NAMEPLATE_STYLE_V1,
  anchorFraction,
  ffmpegPlacementExpression,
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
}

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

  // The whole block is anchored as one unit, then each line is drawn inside it,
  // so the two lines cannot drift apart from each other.
  const blockX = ffmpegPlacementExpression({
    axis: 'x',
    point: node.target.point.x,
    anchorFraction: fraction.x,
    frameSize: plan.width,
    safeMargin: metrics.safeMargin,
  })
  const blockY = ffmpegPlacementExpression({
    axis: 'y',
    point: node.target.point.y,
    anchorFraction: fraction.y,
    frameSize: plan.height,
    safeMargin: metrics.safeMargin,
  })

  const background = toFfmpegColor(NAMEPLATE_STYLE_V1.backgroundColor, NAMEPLATE_STYLE_V1.backgroundOpacity)
  const shared =
    `fontfile='${fontPath}':box=1:boxcolor=${background}:boxborderw=${metrics.padding}` +
    `:fix_bounds=1:expansion=none:enable='${enable}'`

  const filters = [
    `drawtext=${shared}:textfile='primary-${index}.txt'` +
      `:fontcolor=${toFfmpegColor(NAMEPLATE_STYLE_V1.primaryColor, NAMEPLATE_STYLE_V1.primaryOpacity)}` +
      `:fontsize=${metrics.primaryFontSize}:x=${blockX}:y=${blockY}`,
  ]
  if (hasSecondary) {
    // The second line sits a fixed gap below the first, using the same anchored
    // block origin rather than a separately anchored position.
    const secondaryY = `(${blockY})+${metrics.primaryFontSize + metrics.lineGap}`
    filters.push(
      `drawtext=${shared}:textfile='secondary-${index}.txt'` +
        `:fontcolor=${toFfmpegColor(NAMEPLATE_STYLE_V1.secondaryColor, NAMEPLATE_STYLE_V1.secondaryOpacity)}` +
        `:fontsize=${metrics.secondaryFontSize}:x=${blockX}:y=${secondaryY}`,
    )
  }
  return filters
}

export function buildFfmpegArguments(input: BuildArgumentsInput): string[] {
  const plan = validateRenderPlan(input.plan)
  if (!plan.ok) {
    throw renderError('RENDER_INPUT_INVALID', 'The render plan is invalid.')
  }
  if (plan.value.nodes.length === 0) {
    throw renderError('RENDER_INPUT_INVALID', 'At least one accepted edit is required.')
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(input.fontPath)) {
    throw renderError('RENDER_INPUT_INVALID', 'The render font reference must be a fixed workspace filename.')
  }

  const filters: string[] = []
  plan.value.nodes.forEach((node, index) => {
    if (
      Buffer.byteLength(node.primaryText, 'utf8') > MAX_TEXT_BYTES ||
      Buffer.byteLength(node.secondaryText, 'utf8') > MAX_TEXT_BYTES
    ) {
      throw renderError('RENDER_INPUT_INVALID', 'A nameplate exceeds the render text limit.')
    }
    filters.push(...nameplateFilters(node, index, plan.value, input.fontPath))
  })

  return [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    '-n',
    '-i', input.sourcePath,
    '-vf', filters.join(','),
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    // Pinned so a rendered file's hash is reproducible. Raising this changes
    // output bytes, so it is a deliberate contract, not a performance dial to
    // be turned casually. See ADR-003.
    '-threads', '1',
    '-pix_fmt', 'yuv420p',
    // Audio is copied untouched. This is correct only while nothing cuts the
    // timeline. The first cut operation (G5-B) must replace this with a real
    // audio conform step, because copied audio can only be cut at its own
    // block boundaries and will drift out of sync.
    '-c:a', 'copy',
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
      for (const node of plan.value.nodes) {
        const endTicks = node.interval.start.ticks + node.interval.duration.ticks
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
        await Promise.all(plan.value.nodes.flatMap((node, index) => {
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
        if (
          outputProbe.width !== sourceProbe.width ||
          outputProbe.height !== sourceProbe.height ||
          Math.abs(outputProbe.durationMs - sourceProbe.durationMs) > DURATION_TOLERANCE_MS ||
          (sourceProbe.hasAudio && !outputProbe.hasAudio)
        ) {
          throw renderError('RENDER_OUTPUT_INVALID', 'The rendered output did not preserve source dimensions, duration, and audio.')
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
