import { createHash, randomUUID } from 'node:crypto'
import { constants, createReadStream } from 'node:fs'
import { chmod, copyFile, link, lstat, mkdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { spawn } from 'node:child_process'

import { validateAddNameplateAction, type AddNameplateAction } from '@sanverse/edit-domain/actions'
import { RenderError, type RenderPort, type RenderRequest, type RenderResult } from './render-port.ts'

const MAX_TOOL_OUTPUT_BYTES = 1024 * 1024
const DURATION_TOLERANCE_MS = 100
const NAMEPLATE_PRIMARY_FONT_RATIO = 0.035
const NAMEPLATE_SECONDARY_FONT_RATIO = 0.026
const NAMEPLATE_PADDING_RATIO = 0.011
const NAMEPLATE_BACKGROUND = '0x000000@0.82'
const MAX_ACTIONS_PER_RENDER = 100
const MAX_TEXT_BYTES = 4096

export type CommandInvocation = {
  readonly executable: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly signal?: AbortSignal
}

export type CommandResult = {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export type CommandRunner = (invocation: CommandInvocation) => Promise<CommandResult>

type AdapterOptions = {
  readonly fontPath: string
  readonly ffmpegExecutable?: string
  readonly ffprobeExecutable?: string
  readonly runCommand?: CommandRunner
}

type MediaProbe = {
  readonly width: number
  readonly height: number
  readonly durationMs: number
  readonly hasAudio: boolean
}

type BuildArgumentsInput = {
  readonly sourcePath: string
  readonly outputPath: string
  readonly fontPath: string
  readonly width: number
  readonly height: number
  readonly actions: readonly AddNameplateAction[]
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

function finitePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw renderError('RENDER_INPUT_INVALID', `${label} must be a positive integer.`)
  }
}

export function buildFfmpegArguments(input: BuildArgumentsInput): string[] {
  finitePositiveInteger(input.width, 'Render width')
  finitePositiveInteger(input.height, 'Render height')
  if (input.actions.length === 0) {
    throw renderError('RENDER_INPUT_INVALID', 'At least one accepted action is required.')
  }
  if (input.actions.length > MAX_ACTIONS_PER_RENDER) {
    throw renderError('RENDER_INPUT_INVALID', 'The render contains too many accepted actions.')
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(input.fontPath)) {
    throw renderError('RENDER_INPUT_INVALID', 'The render font reference must be a fixed workspace filename.')
  }

  const shortestEdge = Math.min(input.width, input.height)
  const primaryFontSize = Math.max(12, Math.round(shortestEdge * NAMEPLATE_PRIMARY_FONT_RATIO))
  const secondaryFontSize = Math.max(10, Math.round(shortestEdge * NAMEPLATE_SECONDARY_FONT_RATIO))
  const padding = Math.max(4, Math.round(shortestEdge * NAMEPLATE_PADDING_RATIO))
  const filters: string[] = []

  input.actions.forEach((action, index) => {
    const validated = validateAddNameplateAction(action)
    if (
      !validated.ok ||
      Buffer.byteLength(action.primaryText, 'utf8') > MAX_TEXT_BYTES ||
      Buffer.byteLength(action.secondaryText, 'utf8') > MAX_TEXT_BYTES
    ) {
      throw renderError('RENDER_INPUT_INVALID', 'An accepted action is invalid or exceeds the render text limit.')
    }
    const x = Math.min(Math.max(0, Math.round(action.target.x * input.width)), input.width - 1)
    const y = Math.min(Math.max(0, Math.round(action.target.y * input.height)), input.height - 1)
    const start = action.startMs / 1000
    const end = (action.startMs + action.durationMs) / 1000
    const enable = `gte(t\\,${start.toFixed(3)})*lt(t\\,${end.toFixed(3)})`

    filters.push(
      `drawtext=fontfile='${input.fontPath}':textfile='primary-${index}.txt':fontcolor=0xffffff:fontsize=${primaryFontSize}:box=1:boxcolor=${NAMEPLATE_BACKGROUND}:boxborderw=${padding}:fix_bounds=1:expansion=none:x=${x + padding}:y=${y + padding}:enable='${enable}'`,
    )
    if (action.secondaryText.length > 0) {
      filters.push(
        `drawtext=fontfile='${input.fontPath}':textfile='secondary-${index}.txt':fontcolor=0xffffff@0.78:fontsize=${secondaryFontSize}:box=1:boxcolor=${NAMEPLATE_BACKGROUND}:boxborderw=${padding}:fix_bounds=1:expansion=none:x=${x + padding}:y=${y + primaryFontSize + (padding * 3)}:enable='${enable}'`,
      )
    }
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
    '-threads', '1',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    '-map_metadata', '-1',
    '-movflags', '+faststart',
    input.outputPath,
  ]
}

function parseProbe(stdout: string): MediaProbe {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw renderError('RENDER_OUTPUT_INVALID', 'FFprobe returned invalid JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw renderError('RENDER_OUTPUT_INVALID', 'FFprobe returned an invalid media description.')
  }
  const record = parsed as { streams?: unknown; format?: { duration?: unknown } }
  if (!Array.isArray(record.streams)) {
    throw renderError('RENDER_OUTPUT_INVALID', 'FFprobe did not report media streams.')
  }
  const streams = record.streams.filter((stream): stream is Record<string, unknown> =>
    typeof stream === 'object' && stream !== null,
  )
  const video = streams.find((stream) => stream.codec_type === 'video')
  const durationSeconds = Number(record.format?.duration)
  const width = Number(video?.width)
  const height = Number(video?.height)
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw renderError('RENDER_OUTPUT_INVALID', 'FFprobe did not report finite video dimensions and duration.')
  }
  return {
    width,
    height,
    durationMs: Math.round(durationSeconds * 1000),
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
  }
}

export function createCommandRunner({
  spawnProcess = spawn,
}: {
  spawnProcess?: typeof spawn
} = {}): CommandRunner {
  return async (invocation: CommandInvocation): Promise<CommandResult> => {
    if (invocation.signal?.aborted) throw renderError('RENDER_CANCELLED', 'Export was cancelled.')
    return new Promise((resolvePromise, reject) => {
    let stdout = Buffer.alloc(0)
    let stderr = Buffer.alloc(0)
    let settled = false
    let terminalError: unknown
    const classifyLaunchError = (error: unknown): unknown => {
      const code = (error as NodeJS.ErrnoException)?.code
      if (code === 'ENOENT') return renderError('RENDER_TOOL_UNAVAILABLE', `${invocation.executable} is not available.`)
      if (code === 'EPERM' || code === 'EACCES') {
        return renderError('RENDER_PROCESS_BLOCKED', `${invocation.executable} was blocked from starting.`)
      }
      return renderError('RENDER_FAILED', 'The renderer process could not start.')
    }
    let child: ReturnType<typeof spawn>
    try {
      child = spawnProcess(invocation.executable, [...invocation.args], {
        cwd: invocation.cwd,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      reject(classifyLaunchError(error))
      return
    }
    const childStdout = child.stdout!
    const childStderr = child.stderr!
    const requestTermination = (error: unknown) => {
      if (terminalError === undefined) terminalError = error
      try { child.kill() } catch { /* close/error remains the settlement boundary */ }
    }
    const append = (current: Buffer, chunk: Buffer): Buffer => {
      const next = Buffer.concat([current, chunk])
      if (next.byteLength > MAX_TOOL_OUTPUT_BYTES) {
        requestTermination(renderError('RENDER_FAILED', 'Renderer diagnostic output exceeded the safe limit.'))
        return current
      }
      return next
    }
    childStdout.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk)
    })
    childStderr.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk)
    })
    const onAbort = () => {
      requestTermination(renderError('RENDER_CANCELLED', 'Export was cancelled.'))
    }
    invocation.signal?.addEventListener('abort', onAbort, { once: true })
    if (invocation.signal?.aborted) onAbort()
    child.once('error', (error) => {
      if (terminalError === undefined) {
        terminalError = classifyLaunchError(error)
      }
    })
    child.once('close', (exitCode) => {
      invocation.signal?.removeEventListener('abort', onAbort)
      if (settled) return
      settled = true
      if (terminalError !== undefined) {
        reject(terminalError)
        return
      }
      resolvePromise({
        exitCode: exitCode ?? -1,
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'),
      })
    })
    })
  }
}

const defaultRunCommand = createCommandRunner()

async function probeMedia(
  executable: string,
  path: string,
  cwd: string,
  runCommand: CommandRunner,
  signal?: AbortSignal,
): Promise<MediaProbe> {
  const result = await runCommand({
    executable,
    args: [
      '-v', 'error',
      '-show_entries', 'stream=codec_type,width,height:format=duration',
      '-of', 'json',
      path,
    ],
    cwd,
    signal,
  })
  if (result.exitCode !== 0) {
    throw renderError('RENDER_OUTPUT_INVALID', 'FFprobe could not validate the media file.')
  }
  return parseProbe(result.stdout)
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
  const ffprobeExecutable = options.ffprobeExecutable ?? 'ffprobe'
  const runCommand = options.runCommand ?? defaultRunCommand

  return {
    async render(request): Promise<RenderResult> {
      if (request.signal?.aborted) throw renderError('RENDER_CANCELLED', 'Export was cancelled.')
      const paths = await validatePaths(request, options.fontPath)
      const sourceProbe = await probeMedia(ffprobeExecutable, paths.sourcePath, paths.work, runCommand, request.signal)
      for (const action of request.actions) {
        if (action.startMs >= sourceProbe.durationMs || action.startMs + action.durationMs > sourceProbe.durationMs) {
          throw renderError('RENDER_INPUT_INVALID', 'An accepted action extends beyond the source duration.')
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
        await Promise.all(request.actions.flatMap((action, index) => {
          const files = [
            writeFile(resolve(renderTempDir, `primary-${index}.txt`), action.primaryText, { encoding: 'utf8', flag: 'wx', mode: 0o600 }),
          ]
          if (action.secondaryText.length > 0) {
            files.push(writeFile(resolve(renderTempDir, `secondary-${index}.txt`), action.secondaryText, { encoding: 'utf8', flag: 'wx', mode: 0o600 }))
          }
          return files
        }))
        const command = buildFfmpegArguments({
          sourcePath: paths.sourcePath,
          outputPath: partialPath,
          fontPath: 'font.ttf',
          width: sourceProbe.width,
          height: sourceProbe.height,
          actions: request.actions,
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
        const outputProbe = await probeMedia(ffprobeExecutable, partialPath, paths.work, runCommand, request.signal)
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
