import { describe, expect, it } from 'vitest'
import {
  CAPTION_STYLE_BOXED,
  CAPTION_STYLE_PLAIN_ID,
  captionLineTop,
  resolveCaptionMetrics,
} from '@sanverse/render-contract/caption-style'

import { ms, testPlan, testSegmentNode, testSourceFacts } from '../test-fixtures.ts'
import { buildFfmpegArguments, buildFilterGraph } from './ffmpeg-render-adapter.ts'

const captionNode = (overrides: Record<string, unknown> = {}) => ({
  nodeId: 'captions_aaaaaaaa.cue_0001',
  kind: 'caption-overlay' as const,
  interval: { start: ms(1_000), duration: ms(2_000) },
  lines: ['hello there'],
  styleId: CAPTION_STYLE_BOXED.styleId,
  ...overrides,
})

const graphFor = (overlays: readonly unknown[], planOverrides: Record<string, unknown> = {}) =>
  buildFilterGraph({
    sourcePath: 'source.mp4',
    outputPath: 'output.mp4',
    fontPath: 'font.ttf',
    ...testSourceFacts,
    plan: testPlan({ overlays: overlays as never, ...planOverrides }),
  })

describe('exporting captions', () => {
  it('draws one line as one drawtext filter, timed to the cue', () => {
    const graph = graphFor([captionNode()])
    expect(graph).toContain("textfile='caption-0-0.txt'")
    expect(graph).toContain(String.raw`gte(t\,1.000000000)*lt(t\,3.000000000)`)
  })

  it('draws a two-line caption as two filters, stacked', () => {
    const graph = graphFor([captionNode({ lines: ['first line', 'second line'] })])
    expect(graph).toContain("textfile='caption-0-0.txt'")
    expect(graph).toContain("textfile='caption-0-1.txt'")
  })

  it('centres captions horizontally using the real measured text width', () => {
    const graph = graphFor([captionNode()])
    // `text_w` is substituted by FFmpeg, so this is the same centring the
    // browser performs rather than a guess at it.
    expect(graph).toContain('x=round((1280-text_w)/2)')
  })

  it('takes every number from the shared caption style', () => {
    const metrics = resolveCaptionMetrics(1280, 720, CAPTION_STYLE_BOXED)
    const graph = graphFor([captionNode()])
    expect(graph).toContain(`fontsize=${metrics.fontSize}`)
    expect(graph).toContain(`boxborderw=${metrics.padding}`)
    const top = captionLineTop(0, 1, 720, metrics)
    expect(graph).toContain(`y=${top + metrics.padding}+(${metrics.fontSize}-text_h)/2`)
  })

  it('draws a plate for the boxed look and an outline for the plain one', () => {
    const boxed = graphFor([captionNode()])
    expect(boxed).toContain('box=1')
    expect(boxed).not.toContain(':borderw=')

    const plain = graphFor([captionNode({ styleId: CAPTION_STYLE_PLAIN_ID })])
    expect(plain).not.toContain('box=1')
    expect(plain).toContain(':borderw=')
    expect(plain).toContain('bordercolor=0x000000@1')
  })

  it('stacks two lines upward from the bottom, into the picture', () => {
    // A two-line caption must not slide down out of the safe area.
    const metrics = resolveCaptionMetrics(1280, 720, CAPTION_STYLE_BOXED)
    const firstOfTwo = captionLineTop(0, 2, 720, metrics)
    const secondOfTwo = captionLineTop(1, 2, 720, metrics)
    const onlyLine = captionLineTop(0, 1, 720, metrics)
    expect(secondOfTwo).toBeGreaterThan(firstOfTwo)
    expect(firstOfTwo).toBeLessThan(onlyLine)
    expect(secondOfTwo).toBe(onlyLine)
  })

  it('never puts caption text on the command line', () => {
    // Text goes into files, so nothing a user typed can be read as filter
    // syntax, and no shell ever sees it.
    const args = buildFfmpegArguments({
      sourcePath: 'source.mp4',
      outputPath: 'output.mp4',
      fontPath: 'font.ttf',
      ...testSourceFacts,
      plan: testPlan({ overlays: [captionNode({ lines: ["O'Brien: drop -f;"] })] as never }),
    })
    expect(args.join(' ')).not.toContain("O'Brien")
  })

  it('keeps the command line short however many captions there are', () => {
    // THE POINT OF THE GRAPH FILE. 400 cues of two lines is ~800 drawtext
    // filters. Inline, that is well past the 32,767-character ceiling Windows
    // puts on a whole command line, and the failure would have arrived on the
    // first real captioned video as an unexplained operating-system error.
    const many = Array.from({ length: 400 }, (_, index) => captionNode({
      nodeId: `captions_aaaaaaaa.cue_${index}`,
      interval: { start: ms(index * 50), duration: ms(40) },
      lines: ['a reasonably long first caption line', 'and a second line under it'],
    }))
    const args = buildFfmpegArguments({
      sourcePath: 'source.mp4',
      outputPath: 'output.mp4',
      fontPath: 'font.ttf',
      ...testSourceFacts,
      plan: testPlan({
        durationTicks: 30_000 * 1_440,
        segments: [testSegmentNode({ interval: { start: ms(0), duration: ms(30_000) } })],
        overlays: many as never,
      }),
    })
    expect(args.join(' ').length).toBeLessThan(1_000)
    expect(args).toContain('-filter_complex_script')

    // The graph itself is genuinely enormous — which is exactly why it is not
    // on the command line.
    const graph = graphFor(many, {
      durationTicks: 30_000 * 1_440,
      segments: [testSegmentNode({ interval: { start: ms(0), duration: ms(30_000) } })],
    })
    expect(graph.length).toBeGreaterThan(32_767)
  })

  it('refuses a caption line past the render text limit', () => {
    expect(() => graphFor([captionNode({ lines: ['x'.repeat(4_097)] })]))
      .toThrow(expect.objectContaining({ code: 'RENDER_INPUT_INVALID' }))
  })

  it('draws captions and nameplates in the same graph without confusing them', () => {
    const graph = graphFor([
      captionNode(),
      {
        nodeId: 'operation_nameplate',
        kind: 'text-overlay' as const,
        interval: { start: ms(5_000), duration: ms(2_000) },
        target: { coordinateSpace: 'composition-normalized', point: { x: 0.5, y: 0.5 }, anchor: 'center' },
        primaryText: 'Ada Lovelace',
        secondaryText: 'Mathematician',
        styleId: 'sanverse.nameplate.default/v1',
      },
    ])
    expect(graph).toContain("textfile='caption-0-0.txt'")
    expect(graph).toContain("textfile='primary-1.txt'")
    expect(graph).toContain("textfile='secondary-1.txt'")
  })
})
