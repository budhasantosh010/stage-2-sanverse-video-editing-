import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { link, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { ms, probeJson, testOverlayNode, testPlan, testSegmentNode, testSourceFacts } from '../test-fixtures.ts'
import {
  buildFfmpegArguments,
  buildFilterGraph,
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

const probe = probeJson
const PRIMARY_TEXT = String.raw`O'Brien, CEO: C:\clips\[safe]`

describe('FFmpeg render adapter', () => {
  it('builds an argument array with externalized text, conformed audio, bounded placement, and no shell string', () => {
    const graphInput = {
      sourcePath: String.raw`C:\source video.mp4`,
      outputPath: String.raw`C:\trusted output\render.mp4`,
      fontPath: 'font.ttf',
      ...testSourceFacts,
      plan: testPlan(),
    }
    const args = buildFfmpegArguments(graphInput)

    expect(args[args.indexOf('-i') + 1]).toBe(String.raw`C:\source video.mp4`)
    expect(args).toContain('-map')
    expect(args).toContain('[vout]')
    expect(args).toContain('[aout]')
    // Audio is conformed and re-encoded. `-c:a copy` could only cut audio at
    // its own compression block boundaries, so it drifted out of sync with the
    // picture at the first cut.
    expect(args).not.toContain('copy')
    expect(args).toContain('aac')
    expect(args).toContain('-n')
    expect(args).not.toContain('-y')
    expect(args.at(-1)).toBe(String.raw`C:\trusted output\render.mp4`)
    const filter = buildFilterGraph(graphInput)
    expect(filter).not.toContain('drawbox=')
    expect(filter).toContain('fontcolor=0xffffff@1:fontsize=25')
    expect(filter).toContain('fontcolor=0xffffff@0.78')
    expect(filter).toContain('box=1:boxcolor=0x000000@0.82:boxborderw=8')
    expect(filter).toContain("textfile='primary-0.txt'")
    expect(filter).toContain("textfile='secondary-0.txt'")
    expect(filter).toContain("fontfile='font.ttf'")
    expect(filter).not.toContain("O'Brien")
    expect(filter).toContain('expansion=none')
    expect(filter).toContain(String.raw`gte(t\,1.000000000)*lt(t\,6.000000000)`)
  })

  it('takes every visual number from the shared style contract, scaled to the video', () => {
    const graphInput = {
      sourcePath: 'source.mp4',
      outputPath: 'output.mp4',
      fontPath: 'font.ttf',
      ...testSourceFacts,
      plan: testPlan({
        width: 714,
        height: 1280,
        overlays: [testOverlayNode({
          target: { coordinateSpace: 'composition-normalized', point: { x: 0.25, y: 0.25 }, anchor: 'center' },
          primaryText: 'hello text',
          secondaryText: '',
          interval: { start: ms(0), duration: ms(5_000) },
        })],
      }),
    }
    buildFfmpegArguments(graphInput)

    const filter = buildFilterGraph(graphInput)
    expect(filter).not.toContain('drawbox=')
    // 714 is the shortest edge here, so sizes follow it rather than the height.
    expect(filter).toContain(`fontsize=${Math.round(714 * 0.035)}`)
    expect(filter).toContain(`boxborderw=${Math.round(714 * 0.011)}`)
    expect(filter).toContain('fix_bounds=1')
    // Placement is an expression so FFmpeg applies the shared clamp using the
    // real measured text box, exactly as the browser does.
    expect(filter).toContain('text_w')
    expect(filter).not.toContain("textfile='secondary-0.txt'")
  })

  it('rejects a plan whose overlay runs past the end of the video', () => {
    expect(() => buildFfmpegArguments({
      sourcePath: 'source.mp4',
      outputPath: 'output.mp4',
      fontPath: 'font.ttf',
      ...testSourceFacts,
      plan: testPlan({ overlays: [testOverlayNode({ interval: { start: ms(7_000), duration: ms(5_000) } })] }),
    })).toThrow(expect.objectContaining({ code: 'RENDER_INPUT_INVALID' }))
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
      ...testSourceFacts,
    }

    expect(() => buildFfmpegArguments({
      ...base,
      plan: testPlan({ overlays: [testOverlayNode({ interval: { start: ms(0), duration: ms(0) } })] }),
    })).toThrow(expect.objectContaining({ code: 'RENDER_INPUT_INVALID' }))
    expect(() => buildFfmpegArguments({
      ...base,
      plan: testPlan({ overlays: [testOverlayNode({ primaryText: 'x'.repeat(4097) })] }),
    })).toThrow(expect.objectContaining({ code: 'RENDER_INPUT_INVALID' }))
    expect(() => buildFfmpegArguments({
      ...base,
      plan: testPlan({
        // The ceiling rose to 4,096 when captions arrived: a captioned
        // ten-minute talk is ~200 cues, and a cut through one makes it two.
        overlays: Array.from({ length: 4_097 }, (_, index) => testOverlayNode({ nodeId: `operation_${index}` })),
      }),
    })).toThrow(expect.objectContaining({ code: 'RENDER_INPUT_INVALID' }))
    // No overlays is now perfectly legal — a video that was only cut still
    // exports. What is refused is a plan with no FOOTAGE in it.
    expect(() => buildFfmpegArguments({ ...base, plan: testPlan({ segments: [] }) }))
      .toThrow(expect.objectContaining({ code: 'RENDER_INPUT_INVALID' }))
    expect(() => buildFfmpegArguments({
      ...base,
      plan: testPlan({
        durationTicks: ms(31_000).ticks,
        segments: [testSegmentNode({
          interval: { start: ms(0), duration: ms(31_000) },
          sourceDurationTicks: ms(31_000).ticks,
          direction: 'reverse',
          playbackRateNumerator: 1,
          playbackRateDenominator: 1,
          maintainAudioPitch: true,
        })],
        overlays: [],
      }),
    })).toThrow(expect.objectContaining({
      code: 'RENDER_INPUT_INVALID',
      message: expect.stringContaining('thirty-second'),
    }))
    expect(buildFfmpegArguments({ ...base, plan: testPlan({ overlays: [] }) })).toContain('-filter_complex_script')
    // An unrecognised node is refused, never skipped.
    expect(() => buildFfmpegArguments({
      ...base,
      plan: testPlan({ overlays: [{ ...testOverlayNode(), kind: 'colour-grade' } as never] }),
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
      plan: testPlan(),
    })

    expect(result).toMatchObject({ outputPath, width: 1280, height: 720, durationMs: 8_000, hasAudio: true })
    expect(await readFile(outputPath, 'utf8')).toBe('rendered')
    expect(calls).toHaveLength(3)
    expect(calls[1].args.at(-1)).not.toBe(outputPath)
    expect(externalizedPrimary).toBe(PRIMARY_TEXT)
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
      plan: testPlan(),
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

    await expect(renderer.render({ sourcePath, outputPath, trustedWorkDir: work, plan: testPlan() }))
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
      plan: testPlan({ overlays: [testOverlayNode({ interval: { start: ms(2_050), duration: ms(10) } })] }),
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

    await expect(renderer.render({ sourcePath, outputPath, trustedWorkDir: work, plan: testPlan() }))
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
      plan: testPlan(),
    })).rejects.toMatchObject({ code: 'RENDER_PATH_INVALID' })
    await expect(renderer.render({
      sourcePath,
      outputPath: join(work, 'cancelled.mp4'),
      trustedWorkDir: work,
      plan: testPlan(),
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

    await expect(renderer.render({ sourcePath, outputPath, trustedWorkDir: work, plan: testPlan() }))
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
      plan: testPlan(),
      signal: controller.signal,
    })).rejects.toMatchObject({ code: 'RENDER_CANCELLED' })
    await expect(readFile(outputPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
