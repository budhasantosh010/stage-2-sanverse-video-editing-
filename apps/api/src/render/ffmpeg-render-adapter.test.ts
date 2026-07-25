import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { link, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import type { AddNameplateAction } from '@sanverse/edit-domain/actions'
import {
  buildFfmpegArguments,
  createCommandRunner,
  createFfmpegRenderAdapter,
  type CommandInvocation,
  type CommandResult,
} from './ffmpeg-render-adapter.ts'

class FakeChild extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  kill = vi.fn(() => true)
}

const action = (overrides: Partial<AddNameplateAction> = {}): AddNameplateAction => ({
  schemaVersion: 'sanverse.action/v1',
  actionId: 'action-1',
  kind: 'add-nameplate',
  target: { x: 1, y: 1, sourceTimeMs: 1_000 },
  primaryText: String.raw`O'Brien, CEO: C:\clips\[safe]`,
  secondaryText: '50% %{pts}; safe',
  startMs: 1_000,
  durationMs: 5_000,
  ...overrides,
})

const probe = (durationSeconds = 8, hasAudio = true) => JSON.stringify({
  streams: [
    { codec_type: 'video', width: 1280, height: 720 },
    ...(hasAudio ? [{ codec_type: 'audio' }] : []),
  ],
  format: { duration: String(durationSeconds) },
})

describe('FFmpeg render adapter', () => {
  it('builds an argument array with externalized text, copied audio, bounded placement, and no shell string', () => {
    const args = buildFfmpegArguments({
      sourcePath: String.raw`C:\source video.mp4`,
      outputPath: String.raw`C:\trusted output\render.mp4`,
      fontPath: 'font.ttf',
      width: 1280,
      height: 720,
      actions: [action()],
    })

    expect(args[args.indexOf('-i') + 1]).toBe(String.raw`C:\source video.mp4`)
    expect(args).toContain('-map')
    expect(args).toContain('0:a?')
    expect(args).toContain('copy')
    expect(args).toContain('-n')
    expect(args).not.toContain('-y')
    expect(args.at(-1)).toBe(String.raw`C:\trusted output\render.mp4`)
    const filter = args[args.indexOf('-vf') + 1]
    expect(filter).not.toContain('drawbox=')
    expect(filter).toContain('fontcolor=0xffffff:fontsize=25')
    expect(filter).toContain('box=1:boxcolor=0x000000@0.82:boxborderw=8')
    expect(filter).toContain("fontfile='font.ttf':textfile='primary-0.txt'")
    expect(filter).toContain("fontfile='font.ttf':textfile='secondary-0.txt'")
    expect(filter).not.toContain("O'Brien")
    expect(filter).toContain('expansion=none')
    expect(filter).toContain(String.raw`gte(t\,1.000)*lt(t\,6.000)`)
  })

  it('renders the compact dark preview style instead of a fixed light panel', () => {
    const args = buildFfmpegArguments({
      sourcePath: 'source.mp4',
      outputPath: 'output.mp4',
      fontPath: 'font.ttf',
      width: 714,
      height: 1280,
      actions: [action({
        target: { x: 0.25, y: 0.25, sourceTimeMs: 0 },
        primaryText: 'hello text',
        secondaryText: '',
        startMs: 0,
      })],
    })

    const filter = args[args.indexOf('-vf') + 1]
    expect(filter).not.toContain('drawbox=')
    expect(filter).toContain('fontcolor=0xffffff:fontsize=25')
    expect(filter).toContain('box=1:boxcolor=0x000000@0.82:boxborderw=8')
    expect(filter).toContain('x=187:y=328')
    expect(filter).toContain('fix_bounds=1')
  })

  it('does not settle cancellation until the spawned process closes and catches the post-spawn abort race', async () => {
    const controller = new AbortController()
    const child = new FakeChild()
    const runner = createCommandRunner({
      spawnProcess: vi.fn(() => {
        controller.abort()
        return child as never
      }),
    })
    let settled = false

    const pending = runner({
      executable: 'ffmpeg',
      args: [],
      cwd: '.',
      signal: controller.signal,
    }).finally(() => { settled = true })
    await Promise.resolve()

    expect(child.kill).toHaveBeenCalledOnce()
    expect(settled).toBe(false)
    child.emit('close', null)
    await expect(pending).rejects.toMatchObject({ code: 'RENDER_CANCELLED' })
    expect(settled).toBe(true)
  })

  it.each(['EPERM', 'EACCES'])('classifies a blocked renderer process as RENDER_PROCESS_BLOCKED for %s', async (code) => {
    const child = new FakeChild()
    const runner = createCommandRunner({ spawnProcess: vi.fn(() => child as never) })
    const pending = runner({ executable: 'ffprobe', args: [], cwd: '.' })
    const error = Object.assign(new Error('operating system denied process launch'), { code })

    child.emit('error', error)
    child.emit('close', null)

    await expect(pending).rejects.toMatchObject({ code: 'RENDER_PROCESS_BLOCKED' })
  })

  it('classifies a synchronous renderer process launch denial', async () => {
    const launchError = Object.assign(new Error('operating system denied process launch'), { code: 'EPERM' })
    const runner = createCommandRunner({
      spawnProcess: vi.fn(() => { throw launchError }),
    })

    await expect(runner({ executable: 'ffprobe', args: [], cwd: '.' }))
      .rejects.toMatchObject({ code: 'RENDER_PROCESS_BLOCKED' })
  })

  it('rejects invalid runtime actions and bounded-resource violations before command creation', () => {
    const base = {
      sourcePath: 'source.mp4',
      outputPath: 'output.mp4',
      fontPath: 'font.ttf',
      width: 1280,
      height: 720,
    }

    expect(() => buildFfmpegArguments({
      ...base,
      actions: [action({ durationMs: -1 })],
    })).toThrow(expect.objectContaining({ code: 'RENDER_INPUT_INVALID' }))
    expect(() => buildFfmpegArguments({
      ...base,
      actions: [action({ primaryText: 'x'.repeat(4097) })],
    })).toThrow(expect.objectContaining({ code: 'RENDER_INPUT_INVALID' }))
    expect(() => buildFfmpegArguments({
      ...base,
      actions: Array.from({ length: 101 }, (_, index) => action({ actionId: `action-${index}` })),
    })).toThrow(expect.objectContaining({ code: 'RENDER_INPUT_INVALID' }))
  })

  it('renders to a private partial file, verifies media invariants, and atomically publishes the output', async () => {
    const work = await mkdtemp(join(tmpdir(), 'sanverse-render-'))
    const sourcePath = join(work, 'source.mp4')
    const outputPath = join(work, 'export.mp4')
    const fontPath = join(work, 'font.ttf')
    await writeFile(sourcePath, 'source')
    await writeFile(fontPath, 'font')
    const calls: CommandInvocation[] = []
    let externalizedPrimary = ''
    const runCommand = vi.fn(async (invocation: CommandInvocation): Promise<CommandResult> => {
      calls.push(invocation)
      if (invocation.executable === 'ffprobe') {
        return { exitCode: 0, stdout: probe(), stderr: '' }
      }
      externalizedPrimary = await readFile(join(invocation.cwd, 'primary-0.txt'), 'utf8')
      expect(invocation.args.at(-1)).toBe(join(invocation.cwd, 'output.mp4'))
      await writeFile(invocation.args.at(-1)!, 'rendered')
      return { exitCode: 0, stdout: '', stderr: '' }
    })
    const renderer = createFfmpegRenderAdapter({ fontPath, runCommand })

    const result = await renderer.render({
      sourcePath,
      outputPath,
      trustedWorkDir: work,
      actions: [action()],
    })

    expect(result).toMatchObject({ outputPath, width: 1280, height: 720, durationMs: 8_000, hasAudio: true })
    expect(await readFile(outputPath, 'utf8')).toBe('rendered')
    expect(calls).toHaveLength(3)
    expect(calls[1].args.at(-1)).not.toBe(outputPath)
    expect(externalizedPrimary).toBe(action().primaryText)
  })

  it('rebuilds output from the canonical parent instead of publishing through a junction spelling', async () => {
    const work = await mkdtemp(join(tmpdir(), 'sanverse-render-'))
    const actualOutputDir = join(work, 'actual')
    const outputAlias = join(work, 'alias')
    await mkdir(actualOutputDir)
    await symlink(actualOutputDir, outputAlias, 'junction')
    const sourcePath = join(work, 'source.mp4')
    const fontPath = join(work, 'font.ttf')
    await writeFile(sourcePath, 'source')
    await writeFile(fontPath, 'font')
    const runCommand = async (invocation: CommandInvocation): Promise<CommandResult> => {
      if (invocation.executable === 'ffprobe') return { exitCode: 0, stdout: probe(), stderr: '' }
      await writeFile(invocation.args.at(-1)!, 'rendered')
      return { exitCode: 0, stdout: '', stderr: '' }
    }
    const renderer = createFfmpegRenderAdapter({ fontPath, runCommand })

    const result = await renderer.render({
      sourcePath,
      outputPath: join(outputAlias, 'export.mp4'),
      trustedWorkDir: work,
      actions: [action()],
    })

    expect(result.outputPath).toBe(join(actualOutputDir, 'export.mp4'))
  })

  it('rejects a hard-linked partial artifact instead of publishing an aliased file', async () => {
    const work = await mkdtemp(join(tmpdir(), 'sanverse-render-'))
    const sourcePath = join(work, 'source.mp4')
    const outputPath = join(work, 'export.mp4')
    const outside = join(work, 'outside-sentinel.mp4')
    const fontPath = join(work, 'font.ttf')
    await writeFile(sourcePath, 'source')
    await writeFile(outside, 'outside')
    await writeFile(fontPath, 'font')
    const runCommand = async (invocation: CommandInvocation): Promise<CommandResult> => {
      if (invocation.executable === 'ffprobe') return { exitCode: 0, stdout: probe(), stderr: '' }
      await link(outside, invocation.args.at(-1)!)
      return { exitCode: 0, stdout: '', stderr: '' }
    }
    const renderer = createFfmpegRenderAdapter({ fontPath, runCommand })

    await expect(renderer.render({ sourcePath, outputPath, trustedWorkDir: work, actions: [action()] }))
      .rejects.toMatchObject({ code: 'RENDER_OUTPUT_INVALID' })
    expect(await readFile(outside, 'utf8')).toBe('outside')
  })

  it('does not apply media probe tolerance to semantic action timing', async () => {
    const work = await mkdtemp(join(tmpdir(), 'sanverse-render-'))
    const sourcePath = join(work, 'source.mp4')
    const outputPath = join(work, 'export.mp4')
    const fontPath = join(work, 'font.ttf')
    await writeFile(sourcePath, 'source')
    await writeFile(fontPath, 'font')
    const runCommand = vi.fn(async (invocation: CommandInvocation): Promise<CommandResult> =>
      invocation.executable === 'ffprobe'
        ? { exitCode: 0, stdout: probe(2), stderr: '' }
        : { exitCode: 0, stdout: '', stderr: '' },
    )
    const renderer = createFfmpegRenderAdapter({ fontPath, runCommand })

    await expect(renderer.render({
      sourcePath,
      outputPath,
      trustedWorkDir: work,
      actions: [action({ startMs: 2_050, durationMs: 10 })],
    })).rejects.toMatchObject({ code: 'RENDER_INPUT_INVALID' })
    expect(runCommand).toHaveBeenCalledOnce()
  })

  it.each([
    ['non-zero FFmpeg exit', async (invocation: CommandInvocation) =>
      invocation.executable === 'ffprobe'
        ? { exitCode: 0, stdout: probe(), stderr: '' }
        : { exitCode: 9, stdout: '', stderr: 'failed' }, 'RENDER_FAILED'],
    ['missing output', async (invocation: CommandInvocation) =>
      invocation.executable === 'ffprobe'
        ? { exitCode: 0, stdout: probe(), stderr: '' }
        : { exitCode: 0, stdout: '', stderr: '' }, 'RENDER_OUTPUT_MISSING'],
  ])('fails closed for %s and leaves no published export', async (_label, runCommand, code) => {
    const work = await mkdtemp(join(tmpdir(), 'sanverse-render-'))
    const sourcePath = join(work, 'source.mp4')
    const outputPath = join(work, 'export.mp4')
    const fontPath = join(work, 'font.ttf')
    await writeFile(sourcePath, 'source')
    await writeFile(fontPath, 'font')
    const renderer = createFfmpegRenderAdapter({ fontPath, runCommand })

    await expect(renderer.render({ sourcePath, outputPath, trustedWorkDir: work, actions: [action()] }))
      .rejects.toMatchObject({ code })
    await expect(readFile(outputPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects cancellation and output paths outside the trusted render workspace', async () => {
    const work = await mkdtemp(join(tmpdir(), 'sanverse-render-'))
    const sourcePath = join(work, 'source.mp4')
    const fontPath = join(work, 'font.ttf')
    await writeFile(sourcePath, 'source')
    await writeFile(fontPath, 'font')
    const runCommand = vi.fn()
    const renderer = createFfmpegRenderAdapter({ fontPath, runCommand })
    const controller = new AbortController()
    controller.abort()

    await expect(renderer.render({
      sourcePath,
      outputPath: join(work, '..', 'outside.mp4'),
      trustedWorkDir: work,
      actions: [action()],
    })).rejects.toMatchObject({ code: 'RENDER_PATH_INVALID' })
    await expect(renderer.render({
      sourcePath,
      outputPath: join(work, 'cancelled.mp4'),
      trustedWorkDir: work,
      actions: [action()],
      signal: controller.signal,
    })).rejects.toMatchObject({ code: 'RENDER_CANCELLED' })
    expect(runCommand).not.toHaveBeenCalled()
  })

  it('rejects output dimension, duration, or audio loss after FFmpeg succeeds', async () => {
    const work = await mkdtemp(join(tmpdir(), 'sanverse-render-'))
    const sourcePath = join(work, 'source.mp4')
    const outputPath = join(work, 'export.mp4')
    const fontPath = join(work, 'font.ttf')
    await writeFile(sourcePath, 'source')
    await writeFile(fontPath, 'font')
    let probes = 0
    const runCommand = async (invocation: CommandInvocation): Promise<CommandResult> => {
      if (invocation.executable === 'ffprobe') {
        probes += 1
        return probes === 1
          ? { exitCode: 0, stdout: probe(), stderr: '' }
          : { exitCode: 0, stdout: JSON.stringify({ streams: [{ codec_type: 'video', width: 640, height: 720 }], format: { duration: '7.5' } }), stderr: '' }
      }
      await writeFile(invocation.args.at(-1)!, 'bad-output')
      return { exitCode: 0, stdout: '', stderr: '' }
    }
    const renderer = createFfmpegRenderAdapter({ fontPath, runCommand })

    await expect(renderer.render({ sourcePath, outputPath, trustedWorkDir: work, actions: [action()] }))
      .rejects.toMatchObject({ code: 'RENDER_OUTPUT_INVALID' })
    await expect(readFile(outputPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not publish when cancellation arrives after output probing', async () => {
    const work = await mkdtemp(join(tmpdir(), 'sanverse-render-'))
    const sourcePath = join(work, 'source.mp4')
    const outputPath = join(work, 'export.mp4')
    const fontPath = join(work, 'font.ttf')
    await writeFile(sourcePath, 'source')
    await writeFile(fontPath, 'font')
    const controller = new AbortController()
    let probes = 0
    const runCommand = async (invocation: CommandInvocation): Promise<CommandResult> => {
      if (invocation.executable === 'ffprobe') {
        probes += 1
        if (probes === 2) controller.abort()
        return { exitCode: 0, stdout: probe(), stderr: '' }
      }
      await writeFile(invocation.args.at(-1)!, 'rendered')
      return { exitCode: 0, stdout: '', stderr: '' }
    }
    const renderer = createFfmpegRenderAdapter({ fontPath, runCommand })

    await expect(renderer.render({
      sourcePath,
      outputPath,
      trustedWorkDir: work,
      actions: [action()],
      signal: controller.signal,
    })).rejects.toMatchObject({ code: 'RENDER_CANCELLED' })
    await expect(readFile(outputPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
