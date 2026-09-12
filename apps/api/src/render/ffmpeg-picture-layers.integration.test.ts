import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { buildFfmpegArguments, buildFilterGraph } from './ffmpeg-render-adapter.ts'
import { testPlan, testSegmentNode, ms } from '../test-fixtures.ts'
import type { FootageMotionNode, FreezeSegmentNode, PrimarySegmentNode } from '@sanverse/render-contract'

const run = promisify(execFile)

it.skipIf(!process.env.SANVERSE_LAYER_FFMPEG)('renders real overlapping footage with transparent scaled upper picture and exact duration', async () => {
  const ffmpeg = process.env.SANVERSE_LAYER_FFMPEG!
  const root = join(process.cwd(), '.sanverse-data', 'layer-engine-checks')
  await mkdir(root, { recursive: true })
  const cwd = await mkdtemp(join(root, 'render-'))
  const media = async (color: string) => {
    const path = join(cwd, `${color}.mp4`)
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=160x90:r=30:d=4`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path], { windowsHide: true })
    return path
  }
  const [red, blue] = await Promise.all([media('red'), media('blue')])
  const plan = testPlan({
    schemaVersion: 'sanverse.render-plan/v10', width: 160, height: 90, durationTicks: ms(4000).ticks,
    sources: [{ assetId: 'asset_aaaaaaaa', mediaKind: 'video' }, { assetId: 'asset_blue0000', mediaKind: 'video' }],
    overlays: [], segments: [
      testSegmentNode({ nodeId: 'clip_lower', interval: { start: ms(0), duration: ms(4000) }, audioEnabled: false, linkedAudio: null }),
      testSegmentNode({ nodeId: 'clip_upper', assetId: 'asset_blue0000', interval: { start: ms(1000), duration: ms(2000) }, audioEnabled: false, linkedAudio: null,
        footageMotions: [{ motionId: 'motion_upper000', sourceInterval: { start: ms(0), duration: ms(2000) }, transform: { scale: 0.5, translateX: 0, translateY: 0, rotationDegrees: 0, opacity: 1 }, crop: { left: 0, right: 0, top: 0, bottom: 0 }, tracks: [] }],
      }),
    ],
    pictureLayers: [{ trackId: 'track_lower', nodeIds: ['clip_lower'] }, { trackId: 'track_upper', nodeIds: ['clip_upper'] }],
  })
  const input = { plan, sourcePath: red, outputPath: join(cwd, 'layered.mp4'), extraSourcePaths: { asset_blue0000: blue }, fontPath: 'font.ttf', frameRate: { numerator: 30, denominator: 1 }, hasAudio: false }
  await writeFile(join(cwd, 'filtergraph.txt'), buildFilterGraph(input))
  await run(ffmpeg, buildFfmpegArguments(input), { cwd, windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 })
  const decoded = await run(ffmpeg, ['-v', 'error', '-i', input.outputPath, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { windowsHide: true, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 })
  const pixels = decoded.stdout
  const frameBytes = 160 * 90 * 3
  expect(pixels.length / frameBytes).toBe(120)
  const rgb = (frame: number, x: number, y: number) => [...pixels.subarray(frame * frameBytes + (y * 160 + x) * 3, frame * frameBytes + (y * 160 + x) * 3 + 3)]
  const redAt = (frame: number, x = 80, y = 45) => { const [r, g, b] = rgb(frame, x, y); expect(r).toBeGreaterThan(200); expect(g).toBeLessThan(30); expect(b).toBeLessThan(30) }
  redAt(0)
  redAt(29)
  redAt(45, 4, 4)
  redAt(90)
  redAt(119)
  const [r, g, b] = rgb(45, 80, 45)
  expect(b).toBeGreaterThan(200)
  expect(r).toBeLessThan(30)
  expect(g).toBeLessThan(30)
  await writeFile(join(cwd, 'evidence.json'), JSON.stringify({ output: input.outputPath, frames: 120, durationSeconds: 4, width: 160, height: 90, lowerVisibleAroundUpper: true, outsideUpperIntervalRestored: true }, null, 2))
}, 60_000)

it.skipIf(!process.env.SANVERSE_LAYER_FFMPEG).each(['reverse-boundary', 'fast-animation', 'held-animation'] as const)(
  'renders correct source-anchored geometry: %s', async mode => {
    const ffmpeg = process.env.SANVERSE_LAYER_FFMPEG!
    const root = join(process.cwd(), '.sanverse-data', 'layer-engine-checks')
    await mkdir(root, { recursive: true })
    const cwd = await mkdtemp(join(root, `${mode}-`))
    const media = async (color: string) => {
      const path = join(cwd, `${color}.mp4`)
      await run(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=160x90:r=30:d=4`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path], { windowsHide: true })
      return path
    }
    const [red, blue] = await Promise.all([media('red'), media('blue')])
    const motion: FootageMotionNode = {
      motionId: 'motion_realtime01', sourceInterval: { start: ms(0), duration: ms(mode === 'reverse-boundary' ? 2000 : 4000) },
      transform: { scale: 0.5, translateX: 0, translateY: 0, rotationDegrees: 0, opacity: 1 },
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      tracks: mode === 'reverse-boundary' ? [] : [{ property: 'scale', keyframes: [
        { at: ms(0), value: 0.25, easing: { kind: 'linear' } },
        { at: ms(4000), value: 1, easing: { kind: 'linear' } },
      ] }],
    }
    const moving = testSegmentNode({ nodeId: 'clip_upper', assetId: 'asset_blue0000',
      interval: { start: ms(0), duration: ms(2000) }, sourceDurationTicks: ms(4000).ticks,
      playbackRateNumerator: 2, direction: mode === 'reverse-boundary' ? 'reverse' : 'forward',
      audioEnabled: false, linkedAudio: null, footageMotions: [motion] })
    const held: FreezeSegmentNode = { ...moving, kind: 'freeze-segment', sourceTimeTicks: ms(2000).ticks,
      sourceStartTicks: ms(2000).ticks, sourceDurationTicks: 1, playbackRateNumerator: 1, playbackRateDenominator: 1,
      direction: 'forward', audioEnabled: false, linkedAudio: null, gainDb: 0, fadeInTicks: 0, fadeOutTicks: 0, maintainAudioPitch: true, pan: 0 }
    const upper: PrimarySegmentNode = mode === 'held-animation' ? held : moving
    const plan = testPlan({ schemaVersion: 'sanverse.render-plan/v10', width: 160, height: 90, durationTicks: ms(2000).ticks,
      sources: [{ assetId: 'asset_aaaaaaaa', mediaKind: 'video' }, { assetId: 'asset_blue0000', mediaKind: 'video' }], overlays: [],
      segments: [testSegmentNode({ nodeId: 'clip_lower', interval: { start: ms(0), duration: ms(2000) }, audioEnabled: false, linkedAudio: null }), upper],
      pictureLayers: [{ trackId: 'track_lower', nodeIds: ['clip_lower'] }, { trackId: 'track_upper', nodeIds: ['clip_upper'] }],
    })
    const input = { plan, sourcePath: red, outputPath: join(cwd, 'layered.mp4'), extraSourcePaths: { asset_blue0000: blue }, fontPath: 'font.ttf', frameRate: { numerator: 30, denominator: 1 }, hasAudio: false }
    await writeFile(join(cwd, 'filtergraph.txt'), buildFilterGraph(input))
    await run(ffmpeg, buildFfmpegArguments(input), { cwd, windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 })
    const decoded = await run(ffmpeg, ['-v', 'error', '-i', input.outputPath, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { windowsHide: true, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 })
    const pixels = decoded.stdout
    expect(pixels.length / (160 * 90 * 3)).toBe(60)
    const colorAt = (frame: number, x: number) => {
      const offset = frame * 160 * 90 * 3 + (45 * 160 + x) * 3
      return pixels[offset] > 180 && pixels[offset + 2] < 50 ? 'red' : pixels[offset + 2] > 180 && pixels[offset] < 50 ? 'blue' : 'other'
    }
    const samples = mode === 'reverse-boundary' ? [[7, 10, 'blue'], [45, 10, 'red']]
      : mode === 'fast-animation' ? [[7, 30, 'red'], [52, 30, 'blue']]
      : [[0, 20, 'red'], [52, 20, 'red'], [52, 80, 'blue']]
    for (const [frame, x, color] of samples) expect(colorAt(Number(frame), Number(x))).toBe(color)
    await writeFile(join(cwd, 'evidence.json'), JSON.stringify({ mode, output: input.outputPath, frames: 60, samples }, null, 2))
  }, 60_000,
)
