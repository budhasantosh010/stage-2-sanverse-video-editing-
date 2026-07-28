import { describe, expect, it } from 'vitest'

import {
  buildFfmpegArguments,
  buildFilterGraph,
  planInputs,
} from './ffmpeg-render-adapter.ts'
import { ms, testPlan, testSegmentNode, testSourceFacts } from '../test-fixtures.ts'

/**
 * These tests read the filter graph the exporter would hand FFmpeg.
 *
 * They are not a substitute for running a real export — Rule #3 says passing
 * tests are not proof the product works — but they are how a mistake in the
 * arithmetic is caught before a user waits three minutes for a wrong video.
 */

const FONT = 'font.ttf'
const base = {
  sourcePath: '/work/source.mp4',
  outputPath: '/work/out.mp4',
  fontPath: FONT,
  ...testSourceFacts,
}

/** The fixture plan is 1280x720 and 8 seconds long. */
const plan = (overrides: Parameters<typeof testPlan>[0]) => testPlan({
  segments: [testSegmentNode({ interval: { start: ms(0), duration: ms(8_000) } })],
  overlays: [],
  ...overrides,
})

const titleNode = (overrides: Record<string, unknown> = {}) => ({
  nodeId: 'title_0001',
  kind: 'title-overlay' as const,
  interval: { start: ms(1_000), duration: ms(3_000) },
  headline: 'How we edit',
  subhead: 'in under a minute',
  placement: 'center' as const,
  styleId: 'sanverse.title.boxed/v1',
  ...overrides,
})

const calloutNode = (overrides: Record<string, unknown> = {}) => ({
  nodeId: 'callout_0001',
  kind: 'callout-overlay' as const,
  interval: { start: ms(2_000), duration: ms(2_000) },
  region: { x: 0.5, y: 0.25, width: 0.25, height: 0.5 },
  label: 'this button',
  styleId: 'sanverse.callout.outline/v1',
  ...overrides,
})

const brollNode = (overrides: Record<string, unknown> = {}) => ({
  nodeId: 'broll_0001',
  kind: 'media-overlay' as const,
  interval: { start: ms(2_000), duration: ms(3_000) },
  assetId: 'asset_bbbbbbbb',
  sourceStartTicks: ms(1_000).ticks,
  region: { x: 0.05, y: 0.05, width: 0.4, height: 0.4 },
  opacity: 1,
  useOverlayAudio: false,
  ...overrides,
})

const musicNode = (overrides: Record<string, unknown> = {}) => ({
  nodeId: 'music_0001',
  kind: 'music' as const,
  interval: { start: ms(0), duration: ms(8_000) },
  assetId: 'asset_dddddddd',
  sourceStartTicks: 0,
  gainDb: -18,
  fadeInTicks: ms(1_000).ticks,
  fadeOutTicks: ms(2_000).ticks,
  ...overrides,
})

const VIDEO_SOURCES = [
  { assetId: 'asset_aaaaaaaa', mediaKind: 'video' as const },
  { assetId: 'asset_bbbbbbbb', mediaKind: 'video' as const },
]
const IMAGE_SOURCES = [
  { assetId: 'asset_aaaaaaaa', mediaKind: 'video' as const },
  { assetId: 'asset_cccccccc', mediaKind: 'image' as const },
]
const MUSIC_SOURCES = [
  { assetId: 'asset_aaaaaaaa', mediaKind: 'video' as const },
  { assetId: 'asset_dddddddd', mediaKind: 'audio' as const },
]

describe('input numbering', () => {
  it('always gives the main footage input 0, and the rest the plan order', () => {
    const inputs = planInputs(plan({ sources: VIDEO_SOURCES }) as never)
    expect(inputs).toEqual([
      { assetId: 'asset_aaaaaaaa', mediaKind: 'video', index: 0 },
      { assetId: 'asset_bbbbbbbb', mediaKind: 'video', index: 1 },
    ])
  })

  it('refuses to build a command when a file the plan needs was not supplied', () => {
    expect(() => buildFfmpegArguments({
      ...base,
      plan: plan({ sources: VIDEO_SOURCES, overlays: [brollNode()] }) as never,
    })).toThrow(/not supplied|not provided/i)
  })
})

describe('titles', () => {
  it('draws a headline and a subhead as two filters, stacked', () => {
    const graph = buildFilterGraph({ ...base, plan: plan({ overlays: [titleNode()] }) as never })
    expect(graph).toContain("textfile='title-0-0.txt'")
    expect(graph).toContain("textfile='title-0-1.txt'")
  })

  it('draws only one filter when there is no subhead', () => {
    const graph = buildFilterGraph({ ...base, plan: plan({ overlays: [titleNode({ subhead: '' })] }) as never })
    expect(graph).toContain("textfile='title-0-0.txt'")
    expect(graph).not.toContain("textfile='title-0-1.txt'")
  })

  it('takes every number from the shared style, scaled to this video', () => {
    // 720-high frame: headline 0.075 * 720 = 54, subhead 0.038 * 720 = 27.36 -> 27,
    // padding 0.018 * 720 = 12.96 -> 13.
    const graph = buildFilterGraph({ ...base, plan: plan({ overlays: [titleNode()] }) as never })
    expect(graph).toContain('fontsize=54')
    expect(graph).toContain('fontsize=27')
    expect(graph).toContain('boxborderw=13')
  })

  it('puts a lower-third title lower than a centred one', () => {
    const centred = buildFilterGraph({ ...base, plan: plan({ overlays: [titleNode()] }) as never })
    const lower = buildFilterGraph({
      ...base,
      plan: plan({ overlays: [titleNode({ placement: 'lower-third' })] }) as never,
    })
    const topOf = (graph: string) => Number(/:y=(\d+)\+/.exec(graph)?.[1] ?? -1)
    expect(topOf(lower)).toBeGreaterThan(topOf(centred))
  })

  it('never puts title words on the command line', () => {
    const command = buildFfmpegArguments({
      ...base,
      plan: plan({ overlays: [titleNode({ headline: 'drop -f; rm -rf' })] }) as never,
    })
    expect(command.join(' ')).not.toContain('rm -rf')
  })
})

describe('callouts', () => {
  it('draws the rectangle in whole pixels taken from the shared contract', () => {
    // 1280x720: x 0.5 -> 640, y 0.25 -> 180, w 0.25 -> 320, h 0.5 -> 360.
    // Border 0.005 * 720 = 3.6 -> 4.
    const graph = buildFilterGraph({ ...base, plan: plan({ overlays: [calloutNode()] }) as never })
    expect(graph).toContain('drawbox=x=640:y=180:w=320:h=360')
    expect(graph).toContain(':t=4:')
  })

  it('draws the label from a file, never inline', () => {
    const graph = buildFilterGraph({ ...base, plan: plan({ overlays: [calloutNode()] }) as never })
    expect(graph).toContain("textfile='callout-0.txt'")
    expect(graph).not.toContain('this button')
  })

  it('draws only the rectangle when there is no label', () => {
    const graph = buildFilterGraph({ ...base, plan: plan({ overlays: [calloutNode({ label: '' })] }) as never })
    expect(graph).toContain('drawbox=')
    expect(graph).not.toContain("textfile='callout-0.txt'")
  })

  it('puts the label inside the top when the rectangle is against the top edge', () => {
    // Otherwise the label would be drawn off the frame and simply not appear.
    const graph = buildFilterGraph({
      ...base,
      plan: plan({ overlays: [calloutNode({ region: { x: 0.1, y: 0, width: 0.2, height: 0.2 } })] }) as never,
    })
    const labelY = Number(/callout-0\.txt'[^;]*?:y=(\d+)\+/.exec(graph)?.[1] ?? -1)
    expect(labelY).toBeGreaterThanOrEqual(0)
  })
})

describe('B-roll and pictures', () => {
  it('scales the clip to fit its box without stretching, and centres it', () => {
    // Box: 0.4 * 1280 = 512 wide, 0.4 * 720 = 288 high, at 64,36.
    const graph = buildFilterGraph({
      ...base,
      plan: plan({ sources: VIDEO_SOURCES, overlays: [brollNode()] }) as never,
    })
    expect(graph).toContain('scale=512:288:force_original_aspect_ratio=decrease')
    expect(graph).toContain("x='64+(512-overlay_w)/2'")
    expect(graph).toContain("y='36+(288-overlay_h)/2'")
  })

  it('reads the requested stretch of the clip, not the start of it', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({ sources: VIDEO_SOURCES, overlays: [brollNode()] }) as never,
    })
    // Starts 1 s into the clip and runs for 3 s.
    expect(graph).toContain('[1:v]trim=start=1.000000000:end=4.000000000')
  })

  it('composites the clip UNDER the words, so a caption is never hidden', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({ sources: VIDEO_SOURCES, overlays: [brollNode(), titleNode()] }) as never,
    })
    expect(graph.indexOf('overlay:x=')).toBeLessThan(graph.indexOf('drawtext'))
  })

  it('bounds a looping still picture, so the export can finish', () => {
    const command = buildFfmpegArguments({
      ...base,
      plan: plan({
        sources: IMAGE_SOURCES,
        overlays: [brollNode({ assetId: 'asset_cccccccc', sourceStartTicks: 0 })],
      }) as never,
      extraSourcePaths: { asset_cccccccc: '/work/picture.png' },
    })
    expect(command).toContain('-loop')
    const bound = command[command.indexOf('-t') + 1]
    // The picture is needed for 3 seconds and not one frame longer.
    expect(Number(bound)).toBeCloseTo(3, 9)
  })

  it('makes a see-through overlay see-through, rather than ignoring the setting', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({ sources: VIDEO_SOURCES, overlays: [brollNode({ opacity: 0.5 })] }) as never,
    })
    expect(graph).toContain('colorchannelmixer=aa=0.5')
  })
})

describe('music', () => {
  it('mixes music under the speech without quietly ducking it', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({ sources: MUSIC_SOURCES, music: [musicNode()] }) as never,
    })
    expect(graph).toContain('volume=-18dB')
    expect(graph).toContain('amix=inputs=2:duration=first:dropout_transition=0:normalize=0')
    expect(graph).toContain('[aout]')
  })

  it('fades the music in and out at the moments the plan states', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({ sources: MUSIC_SOURCES, music: [musicNode()] }) as never,
    })
    expect(graph).toContain('afade=t=in:st=0:d=1.000000000')
    // 8 s long, 2 s fade out, so it begins at 6 s.
    expect(graph).toContain('afade=t=out:st=6.000000000:d=2.000000000')
  })

  it('delays music that starts partway through the video', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({
        sources: MUSIC_SOURCES,
        music: [musicNode({ interval: { start: ms(2_500), duration: ms(5_500) } })],
      }) as never,
    })
    expect(graph).toContain('adelay=2500|2500')
  })

  it('builds a real sound track for silent footage, so music is actually heard', () => {
    // A file with no audio stream at all behaves differently in every player,
    // so silence is generated and the music mixed onto it.
    const graph = buildFilterGraph({
      ...base,
      hasAudio: false,
      plan: plan({ sources: MUSIC_SOURCES, music: [musicNode()] }) as never,
    })
    expect(graph).toContain('anullsrc=')
    expect(graph).toContain('[aout]')

    const command = buildFfmpegArguments({
      ...base,
      hasAudio: false,
      plan: plan({ sources: MUSIC_SOURCES, music: [musicNode()] }) as never,
      extraSourcePaths: { asset_dddddddd: '/work/music.mp3' },
    })
    expect(command).toContain('[aout]')
    expect(command).not.toContain('-an')
  })

  it('still exports without sound when there is none anywhere', () => {
    const command = buildFfmpegArguments({
      ...base,
      hasAudio: false,
      plan: plan({}) as never,
    })
    expect(command).toContain('-an')
    expect(command).not.toContain('[aout]')
  })
})

describe('everything at once', () => {
  it('builds one graph holding a title, a callout, B-roll, and music', () => {
    const built = {
      ...base,
      plan: plan({
        sources: [...VIDEO_SOURCES, { assetId: 'asset_dddddddd', mediaKind: 'audio' as const }],
        overlays: [brollNode(), titleNode(), calloutNode()],
        music: [musicNode()],
      }) as never,
      extraSourcePaths: { asset_bbbbbbbb: '/work/broll.mp4', asset_dddddddd: '/work/music.mp3' },
    }
    const graph = buildFilterGraph(built)
    const command = buildFfmpegArguments(built)

    expect(graph).toContain('overlay:x=')
    expect(graph).toContain("textfile='title-1-0.txt'")
    expect(graph).toContain('drawbox=')
    expect(graph).toContain('amix=')
    expect(command.filter((argument) => argument === '-i')).toHaveLength(3)
    // The whole graph still goes in a file, so no length of it can hit the
    // 32,767-character Windows command-line limit.
    expect(command.join(' ').length).toBeLessThan(1_000)
  })
})
