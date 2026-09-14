import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { acceptChangeSet, activeTimelineTrackState } from '@sanverse/edit-domain'
import { testProject, testAsset, changeSetOf, TEST_CLIP_ID, ms, testTrim } from '../../../../packages/edit-domain/src/test-fixtures.ts'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import { buildFfmpegArguments, buildFilterGraph } from './ffmpeg-render-adapter.ts'

const run = promisify(execFile)
it.skipIf(!process.env.SANVERSE_LAYER_FFMPEG)('exports extracted, trimmed, quietened and panned sound once without changing picture duration', async () => {
  const ffmpeg = process.env.SANVERSE_LAYER_FFMPEG!
  const root = join(process.cwd(), '.sanverse-data', 'extracted-audio-checks')
  await mkdir(root, { recursive: true })
  const cwd = await mkdtemp(join(root, 'render-'))
  const sourcePath = join(cwd, 'source.mp4')
  await run(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=30:d=4',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=4',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ac', '2', '-shortest', sourcePath],
    { windowsHide: true, timeout: 30000 })
  const base = testProject(testAsset({ duration: ms(4000), width: 160, height: 90 }))
  const extract = acceptChangeSet(base, changeSetOf('changeset_audioexport', base.revision, [{
    schemaVersion: 'sanverse.operation/v3', operationId: 'operation_audioexport',
    kind: 'extract-clip-audio', capabilityId: 'sanverse.timeline.extract-audio.primitive/v1',
    clipId: TEST_CLIP_ID, newClipId: 'clip_audioexport', extensions: {},
    trackId: activeTimelineTrackState(base).tracks.find(track => track.role === 'music')!.trackId,
  }]))
  if (!extract.ok) throw new Error(JSON.stringify(extract.error))
  const edited = acceptChangeSet(extract.value, changeSetOf('changeset_audioedited', extract.value.revision, [
    testTrim({ clipId: 'clip_audioexport', trimStart: ms(1000), trimEnd: ms(1000), ripple: false }),
    { schemaVersion: 'sanverse.operation/v3', operationId: 'operation_audiogain01',
      capabilityId: 'sanverse.timeline.audio.primitive/v1', kind: 'set-clip-audio',
      clipId: 'clip_audioexport', gainDb: -6, pan: 10000, fadeIn: ms(0), fadeOut: ms(0), extensions: {} },
  ]))
  if (!edited.ok) throw new Error(JSON.stringify(edited.error))
  const compiled = compileProjectToRenderPlan(edited.value)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.error))
  const outputPath = join(cwd, 'edited.mp4')
  const input = { plan: compiled.value, sourcePath, outputPath,
    fontPath: 'font.ttf', hasAudio: true, frameRate: { numerator: 30, denominator: 1 } }
  await writeFile(join(cwd, 'filtergraph.txt'), buildFilterGraph(input))
  await run(ffmpeg, buildFfmpegArguments(input),
    { cwd, windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 })
  const decoded = await run(ffmpeg, ['-v', 'error', '-i', outputPath, '-vn', '-ar', '48000', '-ac', '2', '-f', 'f32le', 'pipe:1'],
    { windowsHide: true, encoding: 'buffer', maxBuffer: 4 * 1024 * 1024 })
  const rms = (start: number, end: number, channel: number) => {
    let sum = 0, count = 0
    for (let sample = start * 48000; sample < end * 48000; sample++) {
      const value = decoded.stdout.readFloatLE((sample * 2 + channel) * 4)
      sum += value * value; count++
    }
    return Math.sqrt(sum / count)
  }
  expect(rms(0.1, 0.8, 1)).toBeLessThan(0.0001)
  expect(rms(3.2, 3.8, 1)).toBeLessThan(0.0001)
  expect(rms(1.3, 2.7, 0)).toBeLessThan(0.001)
  expect(rms(1.3, 2.7, 1)).toBeGreaterThan(0.02)
  expect(rms(1.3, 2.7, 1)).toBeLessThan(0.06)
  const video = await run(ffmpeg, ['-v', 'error', '-i', outputPath, '-an', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    { windowsHide: true, encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 })
  expect(video.stdout.length / (160 * 90 * 3)).toBe(120)
  expect(video.stdout[0]).toBeGreaterThan(200)
}, 60000)
