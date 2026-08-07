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

const footageMotion = (overrides: Record<string, unknown> = {}) => ({
  motionId: 'motion_aaaaaaaa',
  sourceInterval: { start: ms(2_000), duration: ms(3_000) },
  transform: { translateX: 0.1, translateY: -0.05, scale: 1.2, rotationDegrees: 5, opacity: 1 },
  crop: { top: 0.05, right: 0.02, bottom: 0.03, left: 0.04 },
  tracks: [],
  ...overrides,
})

describe('primary-footage motion', () => {
  it('splits only at motion boundaries and transforms input zero without adding another primary input', () => {
    const motionPlan = plan({
      segments: [testSegmentNode({ footageMotions: [footageMotion()] as never })],
    })
    const graph = buildFilterGraph({ ...base, plan: motionPlan as never })
    const command = buildFfmpegArguments({ ...base, plan: motionPlan as never })

    expect(graph).toContain('[0:v]trim=start=0.000000000:end=2.000000000')
    expect(graph).toContain('[0:v]trim=start=2.000000000:end=5.000000000')
    expect(graph).toContain('[0:v]trim=start=5.000000000:end=8.000000000')
    expect(graph).toContain('concat=n=3:v=1:a=1')
    expect(graph).toContain("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='")
    expect(graph).toContain("scale=w='max(2,trunc(iw*(1.2)/2)*2)'")
    expect(graph).toContain("rotate='(5)*PI/180'")
    expect(graph).toContain("x='(W-w)/2+(0.1)*W'")
    expect(graph).toContain("y='(H-h)/2+(-0.05)*H'")
    expect(graph).toContain('[motion_video_1]format=pix_fmts=yuv420p,setsar=1[v1]')
    expect(graph).not.toContain('],format=')
    expect(command.filter((argument) => argument === base.sourcePath)).toHaveLength(1)
  })

  it('skips per-pixel crop masking and rotation for scale-and-pan-only motion', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({
        segments: [testSegmentNode({ footageMotions: [footageMotion({
          transform: { translateX: 0.1, translateY: 0.05, scale: 1, rotationDegrees: 0, opacity: 1 },
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          tracks: [
            {
              property: 'scale',
              keyframes: [
                { at: ms(0), value: 1, easing: { kind: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 } },
                { at: ms(3_000), value: 1.2, easing: { kind: 'linear' } },
              ],
            },
          ],
        })] as never })],
      }) as never,
    })

    expect(graph).not.toContain('geq=')
    expect(graph).not.toContain('rotate=')
    expect(graph).toContain('[source_video_1]scale=')
    expect(graph).toContain('[motion_background_1][motion_scaled_1]overlay=')
  })

  it('samples the shared evaluator for animated scale, pan, crop, and easing', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({
        segments: [testSegmentNode({ footageMotions: [footageMotion({
          transform: { translateX: 0, translateY: 0, scale: 1, rotationDegrees: 0, opacity: 1 },
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          tracks: [
            {
              property: 'scale',
              keyframes: [
                { at: ms(0), value: 1, easing: { kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
                { at: ms(3_000), value: 1.35, easing: { kind: 'linear' } },
              ],
            },
            {
              property: 'translate-x',
              keyframes: [
                { at: ms(0), value: 0, easing: { kind: 'spring', mass: 1, stiffness: 120, damping: 14, velocity: 0 } },
                { at: ms(3_000), value: 0.2, easing: { kind: 'linear' } },
              ],
            },
            {
              property: 'crop-left',
              keyframes: [
                { at: ms(0), value: 0, easing: { kind: 'bounce', intensity: 0.5 } },
                { at: ms(3_000), value: 0.1, easing: { kind: 'linear' } },
              ],
            },
          ],
        })] as never })],
      }) as never,
    })

    expect(graph).toContain('if(lt(t,')
    expect(graph).toContain('if(lt(T,')
    expect(graph).toContain(':eval=frame')
    expect(graph.length).toBeLessThan(300_000)
  })

  it('keeps source audio timing and draws accepted overlays above transformed footage', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({
        segments: [testSegmentNode({ footageMotions: [footageMotion()] as never })],
        overlays: [titleNode()],
      }) as never,
    })

    // v8 keeps A1 as one linked composition-time window, independent of the
    // picture-only motion splits above it.
    expect(graph).toContain('[0:a]atrim=start=0.000000000:end=8.000000000')
    expect(graph.indexOf('[motion_composited_1]')).toBeLessThan(graph.indexOf('concat=n=3'))
    expect(graph.indexOf('concat=n=3')).toBeLessThan(graph.indexOf('drawtext='))
  })
})

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

  it('keeps authored opacity intact so an entrance fade can reveal the title', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({
        overlays: [titleNode()],
        visuals: [{
          visualId: 'title_0001',
          nodeIds: ['title_0001'],
          transform: { translateX: 0.08, translateY: 0, scale: 1.25, rotationDegrees: 0, opacity: 1 },
          crop: { top: 0, right: 0, bottom: 0, left: 0.05 },
          layer: 0,
          mask: { shape: 'none', feather: 0 },
          tracks: [],
          transition: {
            enter: { kind: 'fade', duration: ms(500), easing: { kind: 'linear' } },
            exit: { kind: 'none', duration: ms(0), easing: { kind: 'linear' } },
          },
          effects: [],
        }],
      }) as never,
    })
    const styled = /\[wtdrawn0\]([^;]+)\[wtstyled0\]/.exec(graph)?.[1] ?? ''

    expect(styled).toContain('fade=t=in')
    expect(styled).not.toContain('colorchannelmixer=aa=0')
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
  it('translates the shared visual contract into native FFmpeg motion and effects', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({
        sources: VIDEO_SOURCES,
        overlays: [brollNode()],
        visuals: [{
          visualId: 'broll_0001',
          nodeIds: ['broll_0001'],
          transform: { translateX: 0.1, translateY: -0.05, scale: 1.1, rotationDegrees: 8, opacity: 0.8 },
          crop: { top: 0.05, right: 0, bottom: 0, left: 0.05 },
          layer: 0,
          mask: { shape: 'ellipse', feather: 0 },
          tracks: [{
            property: 'translate-x',
            keyframes: [
              { at: ms(0), value: 0, easing: { kind: 'bounce', intensity: 0.5 } },
              { at: ms(1_000), value: 0.1, easing: { kind: 'linear' } },
            ],
          }],
          transition: {
            enter: { kind: 'fade', duration: ms(250), easing: { kind: 'linear' } },
            exit: { kind: 'none', duration: ms(0), easing: { kind: 'linear' } },
          },
          effects: [{ kind: 'saturation', amount: 0.8 }],
        }],
      }) as never,
    })

    expect(graph).toContain('rotate=')
    expect(graph).toContain('saturation=0.8')
    expect(graph).toContain('fade=t=in')
    expect(graph).toContain('overlay=x=')
    expect(graph).toContain("crop=w='max(2,trunc(iw*0.95/2)*2)':h='max(2,trunc(ih*0.95/2)*2)'")
    expect(graph).not.toContain('crop=486:274')
  })

  it('derives crop dimensions from the actual even-sized input after contain scaling', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: plan({
        sources: VIDEO_SOURCES,
        overlays: [brollNode()],
        visuals: [{
          visualId: 'broll_0001',
          nodeIds: ['broll_0001'],
          transform: { translateX: 0, translateY: 0, scale: 1, rotationDegrees: 0, opacity: 1 },
          crop: { top: 0, right: 0, bottom: 0, left: 0.126089 },
          layer: 0,
          mask: { shape: 'none', feather: 0 },
          tracks: [],
          transition: {
            enter: { kind: 'none', duration: ms(0), easing: { kind: 'linear' } },
            exit: { kind: 'none', duration: ms(0), easing: { kind: 'linear' } },
          },
          effects: [],
        }],
      }) as never,
    })

    expect(graph).toContain("crop=w='max(2,trunc(iw*0.873911/2)*2)'")
    expect(graph).toContain("h='max(2,trunc(ih*1/2)*2)'")
    expect(graph).toContain("x='trunc(iw*0.126089)'")
    expect(graph).not.toContain('crop=447:288')
  })

  it('scales the clip to fit its box without stretching, and centres it', () => {
    // Box: 0.4 * 1280 = 512 wide, 0.4 * 720 = 288 high, at 64,36.
    const graph = buildFilterGraph({
      ...base,
      plan: plan({ sources: VIDEO_SOURCES, overlays: [brollNode()] }) as never,
    })
    expect(graph).toContain('scale=512:288:force_original_aspect_ratio=decrease')
    expect(graph).toContain("overlay=x='64+(512-overlay_w)/2':y='36+(288-overlay_h)/2'")
  })

  it('MOVES the clip onto the moment it appears, instead of leaving it at zero', () => {
    // The bug this guards against shipped and was found only by a real export:
    // a 4-second clip reset to time 0 exists from 0s to 4s, so an overlay
    // enabled at 11s had nothing to composite. The export succeeded, was the
    // right length, and the B-roll was simply absent.
    const graph = buildFilterGraph({
      ...base,
      plan: plan({ sources: VIDEO_SOURCES, overlays: [brollNode()] }) as never,
    })
    expect(graph).toContain('setpts=PTS-STARTPTS+2.000000000/TB')
    expect(graph).not.toContain('setpts=PTS-STARTPTS,scale=512')
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
    expect(graph.indexOf('overlay=x=')).toBeLessThan(graph.indexOf('drawtext'))
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
    expect(graph).toContain('amix=inputs=3:duration=first:dropout_transition=0:normalize=0')
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
      // A genuinely silent source compiles with no linked A1 window.
      plan: plan({ segments: [testSegmentNode({ linkedAudio: null })] }) as never,
    })
    expect(command).toContain('-an')
    expect(command).not.toContain('[aout]')
  })
})

describe('the graph is syntactically a filter graph', () => {
  /**
   * The guard that would have caught the real bug this batch shipped with.
   *
   * A real export failed with "No option name near…" because a filter was
   * written `overlay:x=…` instead of `overlay=x=…`. FFmpeg joins a filter's
   * FIRST option to its name with an equals sign; only later options use
   * colons. Every existing test asserted that PIECES of the string were
   * present, and every one of them passed while the whole thing was
   * unparseable.
   *
   * This walks every filter in the graph and demands that the part before the
   * first colon or equals sign is a plain filter name — so a filter whose
   * first option is attached with the wrong character fails here rather than
   * three minutes into a user's export.
   */
  const filtersIn = (graph: string): string[] =>
    graph
      .split(';')
      .map((chain) => chain.replace(/^(\[[^\]]+\])+/, '').replace(/(\[[^\]]+\])+$/, ''))
      .flatMap((chain) => splitTopLevel(chain))
      .filter((filter) => filter.length > 0)

  /** Split a chain on commas that are not inside quotes or brackets. */
  const splitTopLevel = (chain: string): string[] => {
    const parts: string[] = []
    let depth = 0
    let quoted = false
    let current = ''
    for (let index = 0; index < chain.length; index += 1) {
      const character = chain[index]
      if (character === '\\') { current += character + (chain[index + 1] ?? ''); index += 1; continue }
      if (character === "'") { quoted = !quoted; current += character; continue }
      if (!quoted && (character === '(' || character === '[')) depth += 1
      if (!quoted && (character === ')' || character === ']')) depth -= 1
      if (!quoted && depth === 0 && character === ',') { parts.push(current); current = ''; continue }
      current += character
    }
    parts.push(current)
    return parts.map((part) => part.trim())
  }

  const CASES: Array<[string, Parameters<typeof testPlan>[0], boolean]> = [
    ['B-roll', { sources: VIDEO_SOURCES, overlays: [brollNode()] }, true],
    ['a picture', { sources: IMAGE_SOURCES, overlays: [brollNode({ assetId: 'asset_cccccccc', sourceStartTicks: 0 })] }, true],
    ['a title', { overlays: [titleNode()] }, true],
    ['a callout', { overlays: [calloutNode()] }, true],
    ['music', { sources: MUSIC_SOURCES, music: [musicNode()] }, true],
    ['music over silent footage', { sources: MUSIC_SOURCES, music: [musicNode()] }, false],
    ['everything', {
      sources: [...VIDEO_SOURCES, { assetId: 'asset_dddddddd', mediaKind: 'audio' as const }],
      overlays: [brollNode(), titleNode(), calloutNode()],
      music: [musicNode()],
    }, true],
  ]

  for (const [name, overrides, hasAudio] of CASES) {
    it(`writes every filter as name=firstOption for ${name}`, () => {
      const graph = buildFilterGraph({ ...base, hasAudio, plan: plan(overrides) as never })
      for (const filter of filtersIn(graph)) {
        const head = /^[a-z0-9_]+/.exec(filter)?.[0] ?? ''
        expect(head.length, `filter has no name: ${filter.slice(0, 60)}`).toBeGreaterThan(0)
        const after = filter.slice(head.length)
        // Either the filter takes no options at all, or its first option is
        // attached with '=' — never with ':'.
        expect(
          after.length === 0 || after.startsWith('='),
          `filter "${head}" attaches its first option with "${after.slice(0, 1)}" instead of "="`,
        ).toBe(true)
      }
    })
  }
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

    expect(graph).toContain('overlay=x=')
    expect(graph).toContain("textfile='title-1-0.txt'")
    expect(graph).toContain('drawbox=')
    expect(graph).toContain('amix=')
    expect(command.filter((argument) => argument === '-i')).toHaveLength(3)
    // The whole graph still goes in a file, so no length of it can hit the
    // 32,767-character Windows command-line limit.
    expect(command.join(' ').length).toBeLessThan(1_000)
  })
})
