import { describe, expect, it } from 'vitest'

import { buildFfmpegArguments, buildFilterGraph, planInputs } from './ffmpeg-render-adapter.ts'
import { ms, testPlan, testSegmentNode, testSourceFacts } from '../test-fixtures.ts'

/**
 * Gate C2 — the exporter opening more than one recording.
 *
 * The plan has always named the recording on every piece of footage and always
 * listed every file it needed. The exporter simply never asked: it read the
 * footage as input zero, always, because the main sequence could only ever be
 * made of one recording.
 */

const base = {
  sourcePath: '/work/source.mp4',
  outputPath: '/work/out.mp4',
  fontPath: 'font.ttf',
  ...testSourceFacts,
}

const SECOND = 'asset_bbbbbbbb'

/** 0-8 s of the original recording, then 8-14 s of a second one. */
const twoRecordings = () => testPlan({
  durationTicks: ms(14_000).ticks,
  sources: [
    { assetId: 'asset_aaaaaaaa', mediaKind: 'video' as const },
    { assetId: SECOND, mediaKind: 'video' as const },
  ],
  segments: [
    testSegmentNode({ interval: { start: ms(0), duration: ms(8_000) } }),
    testSegmentNode({
      nodeId: 'clip_second01',
      interval: { start: ms(8_000), duration: ms(6_000) },
      assetId: SECOND,
      sourceStartTicks: ms(2_000).ticks,
    }),
  ],
  overlays: [],
  music: [],
})

const graphOf = (plan: ReturnType<typeof twoRecordings>) =>
  buildFilterGraph({ ...base, plan: plan as never })

describe('exporting a video made of two recordings', () => {
  it('opens each recording as its own input, in the plan’s own order', () => {
    expect(planInputs(twoRecordings() as never)).toEqual([
      { assetId: 'asset_aaaaaaaa', mediaKind: 'video', index: 0 },
      { assetId: SECOND, mediaKind: 'video', index: 1 },
    ])
  })

  it('reads each piece of footage from the input that actually holds it', () => {
    const graph = graphOf(twoRecordings())
    // The first piece comes from input 0 …
    expect(graph).toContain('[0:v]trim=start=0.000000000:end=8.000000000')
    // … and the second from input 1, at ITS own moment, not the finished
    // video's. Reading 8-14 s of input 0 was the bug this gate removes.
    expect(graph).toContain('[1:v]trim=start=2.000000000:end=8.000000000')
    expect(graph).toContain('[1:a]atrim=start=2.000000000:end=8.000000000')
  })

  it('joins the two into one video of the right length', () => {
    const graph = graphOf(twoRecordings())
    expect(graph).toContain('concat=n=2:v=1:a=1')
  })

  it('passes the second recording’s file to FFmpeg as a real input', () => {
    const args = buildFfmpegArguments({
      ...base,
      plan: twoRecordings() as never,
      extraSourcePaths: { [SECOND]: '/work/second.mp4' },
    })
    expect(args).toContain('/work/second.mp4')
    // Input zero stays the original recording, which is what `sourcePath` is.
    expect(args.indexOf('/work/source.mp4')).toBeLessThan(args.indexOf('/work/second.mp4'))
  })

  it('refuses rather than guessing when a recording’s file was not supplied', () => {
    // Guessing would export a video silently missing a section.
    expect(() => buildFfmpegArguments({ ...base, plan: twoRecordings() as never }))
      .toThrowError(/was not supplied/)
  })

  it('still reads a single-recording video from input zero, exactly as before', () => {
    const graph = buildFilterGraph({
      ...base,
      plan: testPlan({
        segments: [testSegmentNode({ interval: { start: ms(0), duration: ms(8_000) } })],
        overlays: [],
        music: [],
      }) as never,
    })
    expect(graph).toContain('[0:v]trim=')
    expect(graph).not.toContain('[1:v]trim=')
  })

  it('hides and mutes per piece, so one recording can be black while the other plays', () => {
    const plan = twoRecordings()
    const mixed = { ...plan, segments: [plan.segments[0], { ...plan.segments[1], videoEnabled: false }] }
    const graph = buildFilterGraph({ ...base, plan: mixed as never })
    expect(graph).toContain('[0:v]trim=')
    expect(graph).not.toContain('[1:v]trim=')
    expect(graph).toContain('color=c=black')
    // Its sound is untouched: hiding a picture is not muting a person.
    expect(graph).toContain('[1:a]atrim=')
  })
})
