import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PROJECT_TIMESCALE, type EditProject } from '@sanverse/edit-domain'
import {
  TEST_ASSET_ID,
  TEST_IMAGE_ASSET_ID,
  TEST_MUSIC_ASSET_ID,
  TEST_PROJECT_ID,
  testAsset,
  testImageAsset,
  testMusicAsset,
  testProject,
} from '@sanverse/edit-domain/test-fixtures'

import type { CommandInvocation, CommandResult } from '../process/command-runner.ts'
import type { ProjectRepository } from '../projects/project-repository.ts'
import { AnalysisError, type AnalysisRequest } from './analysis-request.ts'
import {
  AUDIO_NORMALIZATION_SCHEMA_VERSION,
  createMediaAnalysisService,
  parseLoudnormMeasurement,
  peaksFromPcm,
  WAVEFORM_SAMPLE_RATE,
} from './media-analysis-service.ts'

/**
 * Gate D — that real frames and real loudness numbers come out, and that
 * everything else is refused truthfully.
 *
 * FFmpeg is replaced by a stand-in that writes real bytes to the real file
 * FFmpeg would have written, so everything around the decoder — the argument
 * list, the moment asked for, the cache, the refusals — is exercised for real.
 * The decoder itself is proved against real media in the browser walkthrough,
 * because a test that also faked the file would prove nothing about decoding.
 */

const T = PROJECT_TIMESCALE
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'sanverse-analysis-'))
  roots.push(root)
  return root
}

const projectWithEverything = (): EditProject => {
  const base = testProject()
  return Object.freeze({
    ...base,
    assets: Object.freeze([testAsset(), testImageAsset(), testMusicAsset()]),
  }) as EditProject
}

/** Where FFmpeg was told to put its answer: the value after `-y`. */
const outputPath = (invocation: CommandInvocation): string =>
  invocation.args[invocation.args.length - 1]

type Harness = Readonly<{
  root: string
  invocations: CommandInvocation[]
  service: ReturnType<typeof createMediaAnalysisService>
}>

const harness = async (options: Readonly<{
  bytes?: (invocation: CommandInvocation) => Buffer
  exitCode?: number
  stderr?: string
  project?: EditProject
  missingAsset?: boolean
  onRun?: (invocation: CommandInvocation) => Promise<void>
}> = {}): Promise<Harness> => {
  const root = await temporaryRoot()
  const invocations: CommandInvocation[] = []

  const repository = {
    async resolveMediaPaths() {
      return { sourcePath: join(root, 'source.mp4'), trustedWorkDir: root }
    },
    async resolveAssetPath(_projectId: string, assetId: string) {
      if (options.missingAsset) throw new Error('gone')
      return join(root, 'assets', assetId)
    },
  } as unknown as ProjectRepository

  const runCommand = async (invocation: CommandInvocation): Promise<CommandResult> => {
    invocations.push(invocation)
    await options.onRun?.(invocation)
    const exitCode = options.exitCode ?? 0
    if (exitCode === 0 && outputPath(invocation) !== '-') {
      await writeFile(outputPath(invocation), options.bytes?.(invocation) ?? Buffer.from('WEBPfake'))
    }
    return { exitCode, stdout: '', stderr: options.stderr ?? '' }
  }

  const project = options.project ?? projectWithEverything()
  return {
    root,
    invocations,
    service: createMediaAnalysisService({
      repository,
      loadProject: async () => project,
      runCommand,
      ffmpegExecutable: 'ffmpeg',
    }),
  }
}

const frame = (overrides: Partial<Extract<AnalysisRequest, { kind: 'filmstrip-frame' }>> = {}): AnalysisRequest =>
  Object.freeze({
    kind: 'filmstrip-frame' as const,
    assetId: 'asset_aaaaaaaa',
    assetVersion: 'a'.repeat(16),
    sourceTicks: 5 * T,
    widthPx: 64,
    ...overrides,
  })

const waveform = (overrides: Partial<Extract<AnalysisRequest, { kind: 'waveform-block' }>> = {}): AnalysisRequest =>
  Object.freeze({
    kind: 'waveform-block' as const,
    assetId: TEST_MUSIC_ASSET_ID,
    assetVersion: 'd'.repeat(16),
    sourceTicks: 3 * T,
    spanTicks: T,
    peakCount: 64,
    ...overrides,
  })

const normalization = (overrides: Partial<Extract<AnalysisRequest, { kind: 'audio-normalization' }>> = {}): AnalysisRequest =>
  Object.freeze({
    kind: 'audio-normalization' as const,
    assetId: TEST_MUSIC_ASSET_ID,
    assetVersion: 'd'.repeat(16),
    sourceStartTicks: 3 * T,
    sourceEndTicks: 8 * T,
    ...overrides,
  })

const reversePreview = (overrides: Partial<Extract<AnalysisRequest, { kind: 'reverse-preview' }>> = {}): AnalysisRequest =>
  Object.freeze({
    kind: 'reverse-preview' as const,
    assetId: TEST_ASSET_ID,
    assetVersion: 'a'.repeat(16),
    sourceStartTicks: 2 * T,
    sourceEndTicks: 7 * T,
    ...overrides,
  })

const loudnormStderr = (overrides: Partial<Record<'input_i' | 'input_lra' | 'input_tp', string>> = {}): string => `
[Parsed_loudnorm_0 @ 0001]
{
  "input_i" : "${overrides.input_i ?? '-23.20'}",
  "input_tp" : "${overrides.input_tp ?? '-7.50'}",
  "input_lra" : "${overrides.input_lra ?? '4.10'}",
  "input_thresh" : "-33.20",
  "output_i" : "-16.01",
  "target_offset" : "0.01"
}
`

const refusal = async (run: () => Promise<unknown>): Promise<string> => {
  try { await run() } catch (error) {
    return error instanceof AnalysisError ? error.code : `NOT_ANALYSIS:${String(error)}`
  }
  return 'NO_REFUSAL'
}

describe('pulling one real frame out of a recording', () => {
  it('asks the decoder for that exact moment, at that exact size', async () => {
    const { service, invocations } = await harness()
    const artifact = await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })

    expect(artifact.contentType).toBe('image/webp')
    expect(artifact.bytes.byteLength).toBeGreaterThan(0)

    const args = invocations[0].args
    // Seeking BEFORE opening the file is what makes an hour-long recording take
    // a fraction of a second instead of half a minute.
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
    expect(args[args.indexOf('-ss') + 1]).toBe('5.000000000')
    expect(args).toContain('-frames:v')
    expect(args.join(' ')).toContain('scale=64:64:force_original_aspect_ratio=decrease,setsar=1')
    // A camera writes the time, the place and the device into its files. None
    // of that belongs in a thumbnail.
    expect(args).toContain('-map_metadata')
  })

  it('handles the very first moment of a recording', async () => {
    const { service, invocations } = await harness()
    await service.produce({ projectId: TEST_PROJECT_ID, request: frame({ sourceTicks: 0 }) })
    expect(invocations[0].args[invocations[0].args.indexOf('-ss') + 1]).toBe('0.000000000')
  })

  it('handles the last moment of a recording, one tick inside the end', async () => {
    const { service } = await harness()
    const artifact = await service.produce({
      projectId: TEST_PROJECT_ID,
      request: frame({ sourceTicks: 30 * T - 1 }),
    })
    expect(artifact.bytes.byteLength).toBeGreaterThan(0)
  })

  it('refuses a moment past the end rather than returning a black picture', async () => {
    const { service } = await harness()
    expect(await refusal(() => service.produce({
      projectId: TEST_PROJECT_ID,
      request: frame({ sourceTicks: 30 * T }),
    }))).toBe('SOURCE_TIME_OUT_OF_RANGE')
  })

  it('refuses a file the project does not have', async () => {
    const { service } = await harness()
    expect(await refusal(() => service.produce({
      projectId: TEST_PROJECT_ID,
      request: frame({ assetId: 'asset_zzzzzzzz' }),
    }))).toBe('ASSET_NOT_FOUND')
  })

  it('refuses when the file behind the name has different bytes now', async () => {
    // The whole reason the name carries a checksum: a replaced file must not be
    // able to serve a picture of the footage it replaced.
    const { service } = await harness()
    expect(await refusal(() => service.produce({
      projectId: TEST_PROJECT_ID,
      request: frame({ assetVersion: 'f'.repeat(16) }),
    }))).toBe('ANALYSIS_KEY_INVALID')
  })

  it('says the file is gone when it is gone, rather than saying the decoder failed', async () => {
    const { service } = await harness({ missingAsset: true })
    expect(await refusal(() => service.produce({
      projectId: TEST_PROJECT_ID,
      request: frame({ assetId: TEST_IMAGE_ASSET_ID, assetVersion: 'c'.repeat(16) }),
    }))).toBe('ASSET_KIND_UNSUPPORTED')
    expect(await refusal(() => service.produce({
      projectId: TEST_PROJECT_ID,
      request: { kind: 'image-thumbnail', assetId: TEST_IMAGE_ASSET_ID, assetVersion: 'c'.repeat(16), widthPx: 64, heightPx: 64 },
    }))).toBe('ASSET_MISSING')
  })

  it('reports a decoder that failed without repeating anything it said', async () => {
    const { service } = await harness({ exitCode: 1 })
    expect(await refusal(() => service.produce({ projectId: TEST_PROJECT_ID, request: frame() })))
      .toBe('DECODER_FAILED')
    try {
      await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    } catch (error) {
      // A path or a command line in an error message is a path that has
      // travelled to a browser.
      expect((error as Error).message).not.toMatch(/ffmpeg|[/\\]|scale=/i)
    }
  })

  it('refuses to take a picture of a picture at a moment, because a picture has none', async () => {
    const { service } = await harness()
    expect(await refusal(() => service.produce({
      projectId: TEST_PROJECT_ID,
      request: frame({ assetId: TEST_IMAGE_ASSET_ID, assetVersion: 'c'.repeat(16) }),
    }))).toBe('ASSET_KIND_UNSUPPORTED')
  })
})

describe('not doing the same work twice', () => {
  it('runs the decoder once and serves the second request from disk', async () => {
    const { service, invocations } = await harness()
    await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    expect(invocations).toHaveLength(1)
  })

  it('runs the decoder once for ten simultaneous requests for the same frame', async () => {
    const { service, invocations } = await harness({
      onRun: () => new Promise((resolve) => setTimeout(resolve, 5)),
    })
    await Promise.all(Array.from({ length: 10 }, () =>
      service.produce({ projectId: TEST_PROJECT_ID, request: frame() })))
    expect(invocations).toHaveLength(1)
  })

  it('makes a damaged cached file again instead of serving it forever', async () => {
    const { service, invocations, root } = await harness()
    await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    expect(invocations).toHaveLength(1)

    const framesDirectory = join(root, 'derived-media', 'v1', 'frames')
    const [name] = await readdir(framesDirectory)
    await writeFile(join(framesDirectory, name), Buffer.alloc(0))

    await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    expect(invocations).toHaveLength(2)
  })

  it('does not remember a failure, because a busy disk is not a missing file', async () => {
    let failing = true
    const root = await temporaryRoot()
    const invocations: CommandInvocation[] = []
    const service = createMediaAnalysisService({
      repository: {
        async resolveMediaPaths() { return { sourcePath: join(root, 'source.mp4'), trustedWorkDir: root } },
        async resolveAssetPath(_p: string, assetId: string) { return join(root, 'assets', assetId) },
      } as unknown as ProjectRepository,
      loadProject: async () => projectWithEverything(),
      runCommand: async (invocation) => {
        invocations.push(invocation)
        if (failing) return { exitCode: 1, stdout: '', stderr: '' }
        await writeFile(outputPath(invocation), Buffer.from('WEBPfake'))
        return { exitCode: 0, stdout: '', stderr: '' }
      },
    })

    expect(await refusal(() => service.produce({ projectId: TEST_PROJECT_ID, request: frame() })))
      .toBe('DECODER_FAILED')
    failing = false
    const artifact = await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    expect(artifact.bytes.byteLength).toBeGreaterThan(0)
  })
})

describe('shrinking a picture', () => {
  it('contains it inside the box rather than stretching it', async () => {
    const { service, invocations } = await harness()
    await service.produce({
      projectId: TEST_PROJECT_ID,
      request: { kind: 'image-thumbnail', assetId: TEST_IMAGE_ASSET_ID, assetVersion: 'c'.repeat(16), widthPx: 96, heightPx: 64 },
    })
    expect(invocations[0].args.join(' '))
      .toContain('scale=96:64:force_original_aspect_ratio=decrease,setsar=1')
  })

  it('refuses to shrink a video as if it were a picture', async () => {
    const { service } = await harness()
    expect(await refusal(() => service.produce({
      projectId: TEST_PROJECT_ID,
      request: { kind: 'image-thumbnail', assetId: 'asset_aaaaaaaa', assetVersion: 'a'.repeat(16), widthPx: 64, heightPx: 64 },
    }))).toBe('ASSET_KIND_UNSUPPORTED')
  })
})

describe('measuring a stretch of sound', () => {
  const pcm = (fill: (samples: Int16Array) => void, seconds = 1): Buffer => {
    const samples = new Int16Array(Math.floor(WAVEFORM_SAMPLE_RATE * seconds) * 2)
    fill(samples)
    return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
  }

  it('decodes only the stretch asked for, at a known rate and channel count', async () => {
    const { service, invocations } = await harness({ bytes: () => pcm(() => undefined) })
    await service.produce({ projectId: TEST_PROJECT_ID, request: waveform() })
    const args = invocations[0].args
    expect(args[args.indexOf('-ss') + 1]).toBe('3.000000000')
    expect(args[args.indexOf('-t') + 1]).toBe('1.000000000')
    expect(args[args.indexOf('-ar') + 1]).toBe(String(WAVEFORM_SAMPLE_RATE))
    // No channel count is forced. Forcing two shares a mono recording between
    // them and every voice recording reads three decibels quieter than it is.
    expect(args).not.toContain('-ac')
    // No picture is decoded to draw a sound shape.
    expect(args).toContain('-vn')
  })

  it('returns a closed, readable answer', async () => {
    const { service } = await harness({ bytes: () => pcm((samples) => { samples[100] = 16_384 }) })
    const artifact = await service.produce({ projectId: TEST_PROJECT_ID, request: waveform() })
    expect(artifact.contentType).toBe('application/json; charset=utf-8')
    const body = JSON.parse(artifact.bytes.toString('utf8'))
    expect(body.schemaVersion).toBe('sanverse.waveform-block/v1')
    expect(body.assetId).toBe(TEST_MUSIC_ASSET_ID)
    expect(body.peaks).toHaveLength(64)
    expect(Math.max(...body.peaks)).toBeCloseTo(0.5, 2)
  })

  it('draws silence as flat', async () => {
    const { service } = await harness({ bytes: () => pcm(() => undefined) })
    const artifact = await service.produce({ projectId: TEST_PROJECT_ID, request: waveform() })
    expect(JSON.parse(artifact.bytes.toString('utf8')).peaks.every((value: number) => value === 0)).toBe(true)
  })

  it('refuses to draw sound for a file that has none', async () => {
    const { service } = await harness()
    expect(await refusal(() => service.produce({
      projectId: TEST_PROJECT_ID,
      request: waveform({ assetId: TEST_IMAGE_ASSET_ID, assetVersion: 'c'.repeat(16) }),
    }))).toBe('ASSET_KIND_UNSUPPORTED')
  })

  it('refuses a moment past the end of the song', async () => {
    const { service } = await harness()
    expect(await refusal(() => service.produce({
      projectId: TEST_PROJECT_ID,
      request: waveform({ sourceTicks: 120 * T }),
    }))).toBe('SOURCE_TIME_OUT_OF_RANGE')
  })
})

describe('preparing a bounded backwards preview', () => {
  it('uses the exact source interval, reverses picture and sound, and returns a small MP4 proxy', async () => {
    const mp4 = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex')
    const { service, invocations } = await harness({ bytes: () => mp4 })
    const artifact = await service.produce({ projectId: TEST_PROJECT_ID, request: reversePreview() })
    const args = invocations[0].args
    expect(args[args.indexOf('-ss') + 1]).toBe('2.000000000')
    expect(args[args.indexOf('-t') + 1]).toBe('5.000000000')
    expect(args[args.indexOf('-filter_complex') + 1]).toContain('[0:v:0]reverse')
    expect(args[args.indexOf('-filter_complex') + 1]).toContain('force_divisible_by=2')
    expect(args[args.indexOf('-filter_complex') + 1]).toContain('pad=854:480')
    expect(args[args.indexOf('-filter_complex') + 1]).toContain('[0:a:0]areverse')
    expect(args).toContain('+faststart')
    expect(args).toContain('700k')
    expect(artifact.contentType).toBe('video/mp4')
    expect(artifact.bytes).toEqual(mp4)
  })

  it('prepares a silent video without inventing an audio stream', async () => {
    const base = projectWithEverything()
    const project = Object.freeze({
      ...base,
      assets: Object.freeze(base.assets.map((asset) =>
        asset.assetId === TEST_ASSET_ID && asset.mediaKind === 'video'
          ? Object.freeze({ ...asset, hasAudio: false })
          : asset)),
    })
    const { service, invocations } = await harness({
      project,
      bytes: () => Buffer.from('mp4'),
    })
    await service.produce({ projectId: TEST_PROJECT_ID, request: reversePreview() })
    const args = invocations[0].args
    expect(args).toContain('-vf')
    expect(args[args.indexOf('-vf') + 1]).toContain('reverse')
    expect(args).toContain('-an')
    expect(args).not.toContain('areverse')
  })

  it('caches the exact prepared interval and does not run FFmpeg twice', async () => {
    const { service, invocations } = await harness({ bytes: () => Buffer.from('mp4') })
    await service.produce({ projectId: TEST_PROJECT_ID, request: reversePreview() })
    await service.produce({ projectId: TEST_PROJECT_ID, request: reversePreview() })
    expect(invocations).toHaveLength(1)
  })

  it('refuses an interval outside the actual file before starting FFmpeg', async () => {
    const { service, invocations } = await harness()
    expect(await refusal(() => service.produce({
      projectId: TEST_PROJECT_ID,
      request: reversePreview({ sourceEndTicks: 10_000 * T }),
    }))).toBe('SOURCE_TIME_OUT_OF_RANGE')
    expect(invocations).toHaveLength(0)
  })
})

describe('measuring real loudness for normalization', () => {
  it('reads the final loudnorm JSON object and refuses incomplete measurements', () => {
    expect(parseLoudnormMeasurement(`noise {"other":1}\n${loudnormStderr()}`)).toEqual({
      integratedLufs: -23.2,
      loudnessRangeLufs: 4.1,
      truePeakDb: -7.5,
    })
    expect(parseLoudnormMeasurement('{"input_i":"-23"}')).toBeNull()
    expect(parseLoudnormMeasurement('not json')).toBeNull()
  })

  it('streams only the chosen source interval and returns reviewable evidence', async () => {
    const { service, invocations } = await harness({ stderr: loudnormStderr() })
    const artifact = await service.produce({ projectId: TEST_PROJECT_ID, request: normalization() })
    const args = invocations[0].args
    expect(args[args.indexOf('-ss') + 1]).toBe('3.000000000')
    expect(args[args.indexOf('-t') + 1]).toBe('5.000000000')
    expect(args.join(' ')).toContain('loudnorm=I=-16:LRA=11:TP=-1:print_format=json')
    expect(args.slice(-2)).toEqual(['null', '-'])

    const body = JSON.parse(artifact.bytes.toString('utf8'))
    expect(body).toEqual({
      schemaVersion: AUDIO_NORMALIZATION_SCHEMA_VERSION,
      assetId: TEST_MUSIC_ASSET_ID,
      assetVersion: 'd'.repeat(16),
      sourceStartTicks: 3 * T,
      sourceEndTicks: 8 * T,
      analysisVersion: 'ffmpeg-loudnorm-v1',
      integratedLufs: -23.2,
      loudnessRangeLufs: 4.1,
      truePeakDb: -7.5,
      recommendedGainDb: 6.5,
      targetIntegratedLufs: -16,
      targetTruePeakDb: -1,
    })
  })

  it('uses the true-peak ceiling when loudness alone would clip', async () => {
    const { service } = await harness({
      stderr: loudnormStderr({ input_i: '-30.00', input_tp: '-2.00' }),
    })
    const artifact = await service.produce({ projectId: TEST_PROJECT_ID, request: normalization() })
    expect(JSON.parse(artifact.bytes.toString('utf8')).recommendedGainDb).toBe(1)
  })

  it('caches exact evidence and does not run the decoder twice', async () => {
    const { service, invocations } = await harness({ stderr: loudnormStderr() })
    await service.produce({ projectId: TEST_PROJECT_ID, request: normalization() })
    await service.produce({ projectId: TEST_PROJECT_ID, request: normalization() })
    expect(invocations).toHaveLength(1)
  })

  it('refuses silence or an unreadable measurement without inventing a gain', async () => {
    const silent = await harness({
      stderr: loudnormStderr({ input_i: '-80.00', input_tp: '-80.00', input_lra: '0.00' }),
    })
    expect(await refusal(() => silent.service.produce({
      projectId: TEST_PROJECT_ID,
      request: normalization(),
    }))).toBe('AUDIO_SILENT')

    const broken = await harness({ stderr: 'no loudnorm json' })
    expect(await refusal(() => broken.service.produce({
      projectId: TEST_PROJECT_ID,
      request: normalization(),
    }))).toBe('AUDIO_SILENT')
  })
})

describe('turning raw sound numbers into a shape', () => {
  const expected = WAVEFORM_SAMPLE_RATE * 2

  const stereo = (fill: (samples: Int16Array) => void, length = expected): Buffer => {
    const samples = new Int16Array(length)
    fill(samples)
    return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
  }

  it('shows silence as exactly nothing', () => {
    expect(peaksFromPcm(stereo(() => undefined), expected, 16).every((value) => value === 0)).toBe(true)
  })

  it('keeps a single bang visible', () => {
    // Taking every Nth number instead would miss it entirely and the shape
    // would show a quiet passage where there was a snare drum.
    const peaks = peaksFromPcm(stereo((samples) => { samples[expected / 2] = 32_767 }), expected, 8)
    expect(Math.max(...peaks)).toBeCloseTo(1, 3)
    expect(peaks[4]).toBeCloseTo(1, 3)
  })

  it('keeps a bang that happens in ONE ear at its real loudness', () => {
    // Averaging the two ears would halve it. A shape whose job is to help
    // somebody find a moment must not hide the moment.
    const peaks = peaksFromPcm(stereo((samples) => { samples[1_000] = 32_767; samples[1_001] = 0 }), expected, 8)
    expect(Math.max(...peaks)).toBeCloseTo(1, 3)
  })

  it('never draws past the top of its lane', () => {
    expect(Math.max(...peaksFromPcm(stereo((samples) => samples.fill(-32_768)), expected, 4))).toBe(1)
  })

  it('measures a mono recording at its real height, not three decibels down', async () => {
    // Forcing one channel into two shares the sound between them so the TOTAL
    // energy is unchanged. Right for playing, wrong for measuring: every voice
    // recording would have been drawn at 71% of its real height. Measured
    // against a real mono file, not guessed at.
    const mono = new Int16Array(WAVEFORM_SAMPLE_RATE)
    mono[100] = 16_000
    const { service } = await harness({
      bytes: () => Buffer.from(mono.buffer, mono.byteOffset, mono.byteLength),
    })
    const artifact = await service.produce({ projectId: TEST_PROJECT_ID, request: waveform() })
    const peaks = JSON.parse(artifact.bytes.toString('utf8')).peaks as number[]
    expect(Math.max(...peaks)).toBeCloseTo(16_000 / 32_768, 4)
  })

  it('puts a short final block in the right place instead of stretching it', () => {
    // The last block of a song holds less sound than a whole block. Stretching
    // it would draw the final half-second as if it lasted a full one.
    const quarter = Math.floor(expected / 4)
    const peaks = peaksFromPcm(stereo((samples) => samples.fill(32_767, 0, quarter), quarter), expected, 8)
    expect(peaks[0]).toBeCloseTo(1, 3)
    expect(peaks[1]).toBeCloseTo(1, 3)
    expect(peaks[4]).toBe(0)
    expect(peaks[7]).toBe(0)
  })

  it('answers with exactly as many numbers as were asked for', () => {
    expect(peaksFromPcm(stereo(() => undefined), expected, 37)).toHaveLength(37)
  })
})

describe('what the process pool reports', () => {
  it('starts at nothing and returns to nothing', async () => {
    const { service } = await harness()
    expect(service.diagnostics()).toEqual({ activeFrames: 0, activeWaveforms: 0, activeVideos: 0, queued: 0, sharedJobs: 0 })
    await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    expect(service.diagnostics().activeFrames).toBe(0)
    expect(service.diagnostics().sharedJobs).toBe(0)
  })

  it('never runs more pictures at once than its ceiling, under a flood', async () => {
    let peak = 0
    const { service } = await harness({
      onRun: async () => { await new Promise((resolve) => setTimeout(resolve, 3)) },
    })
    const watcher = setInterval(() => {
      peak = Math.max(peak, service.diagnostics().activeFrames)
    }, 1)
    try {
      await Promise.all(Array.from({ length: 40 }, (_unused, index) =>
        service.produce({ projectId: TEST_PROJECT_ID, request: frame({ sourceTicks: index * T / 4 }) })))
    } finally {
      clearInterval(watcher)
    }
    expect(peak).toBeLessThanOrEqual(2)
    expect(service.diagnostics().activeFrames).toBe(0)
  })
})

describe('the throwaway store on disk', () => {
  it('keeps nothing outside its own folder', async () => {
    const { service, root } = await harness()
    await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    const entries = await readdir(root)
    expect(entries).toEqual(['derived-media'])
  })

  it('names its files by a hash, never by anything a person typed', async () => {
    const { service, root } = await harness()
    await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    const names = await readdir(join(root, 'derived-media', 'v1', 'frames'))
    expect(names).toHaveLength(1)
    expect(names[0]).toMatch(/^[a-f0-9]{64}\.webp$/)
  })

  it('leaves no working file behind', async () => {
    const { service, root } = await harness()
    await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    const work = await readdir(join(root, 'derived-media', 'v1', 'work')).catch(() => [])
    expect(work).toEqual([])
  })

  it('can be deleted at any moment with no effect on the project', async () => {
    const { service, root } = await harness()
    await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    await service.cache.clearProject(TEST_PROJECT_ID)
    expect(await service.cache.count(TEST_PROJECT_ID)).toBe(0)
    // And it simply gets made again.
    const artifact = await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    expect(artifact.bytes.byteLength).toBeGreaterThan(0)
    expect(await readdir(root)).toContain('derived-media')
  })

  it('throws away the least recently wanted once it is full', async () => {
    const root = await temporaryRoot()
    const { createDerivedMediaCache } = await import('./derived-media-cache.ts')
    const cache = createDerivedMediaCache(async () => root, { maxEntries: 16, sweepEveryWrites: 1 })
    for (let index = 0; index < 40; index += 1) {
      await cache.write(
        TEST_PROJECT_ID,
        frame({ sourceTicks: index * T }) as AnalysisRequest,
        { bytes: Buffer.from(`frame-${index}`), contentType: 'image/webp' },
      )
    }
    expect(await cache.count(TEST_PROJECT_ID)).toBeLessThanOrEqual(16)
  })

  it('refuses to serve a cached answer that is not a plain file', async () => {
    const root = await temporaryRoot()
    const { createDerivedMediaCache } = await import('./derived-media-cache.ts')
    const cache = createDerivedMediaCache(async () => root)
    const request = waveform() as AnalysisRequest
    await cache.write(TEST_PROJECT_ID, request, {
      bytes: Buffer.from('not json at all'),
      contentType: 'application/json; charset=utf-8',
    })
    // Numbers that no longer parse are corruption, not an answer.
    expect(await cache.read(TEST_PROJECT_ID, request)).toBeNull()
  })
})

describe('finding the original recording', () => {
  it('looks beside the project, not in the added-files folder', async () => {
    // The real spelling on disk uses a colon. Looking in the wrong folder made
    // the ONE file that is certainly there report itself as missing — found the
    // first time this ran against a real project, not by any test before it.
    const root = await temporaryRoot()
    const asked: string[] = []
    const service = createMediaAnalysisService({
      repository: {
        async resolveMediaPaths() { return { sourcePath: join(root, 'source.mp4'), trustedWorkDir: root } },
        async resolveAssetPath(_p: string, assetId: string) {
          asked.push(assetId)
          throw new Error('the original recording is not in the assets folder')
        },
      } as unknown as ProjectRepository,
      loadProject: async () => Object.freeze({
        ...testProject(),
        assets: Object.freeze([testAsset({ storageRef: `project:${TEST_PROJECT_ID}/source` })]),
      }) as EditProject,
      runCommand: async (invocation) => {
        await writeFile(outputPath(invocation), Buffer.from('WEBPfake'))
        return { exitCode: 0, stdout: '', stderr: '' }
      },
    })

    const artifact = await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    expect(artifact.bytes.byteLength).toBeGreaterThan(0)
    expect(asked).toEqual([])
  })

  it('accepts the older slash spelling too, so nothing has to be rewritten', async () => {
    const { service } = await harness({
      project: Object.freeze({
        ...testProject(),
        assets: Object.freeze([testAsset({ storageRef: `project/${TEST_PROJECT_ID}/source` })]),
      }) as EditProject,
    })
    expect((await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })).bytes.byteLength)
      .toBeGreaterThan(0)
  })
})

describe('nothing about the project changes', () => {
  it('never loads more than the project it was asked about, and never saves', async () => {
    const root = await temporaryRoot()
    const save = vi.fn()
    const service = createMediaAnalysisService({
      repository: {
        async resolveMediaPaths() { return { sourcePath: join(root, 'source.mp4'), trustedWorkDir: root } },
        async resolveAssetPath(_p: string, assetId: string) { return join(root, 'assets', assetId) },
        saveProjectState: save,
      } as unknown as ProjectRepository,
      loadProject: async () => projectWithEverything(),
      runCommand: async (invocation) => {
        await writeFile(outputPath(invocation), Buffer.from('WEBPfake'))
        return { exitCode: 0, stdout: '', stderr: '' }
      },
    })
    const before = projectWithEverything()
    await service.produce({ projectId: TEST_PROJECT_ID, request: frame() })
    // No operation, no change set, no revision, no undo entry.
    expect(save).not.toHaveBeenCalled()
    expect(projectWithEverything().revision).toBe(before.revision)
  })
})
