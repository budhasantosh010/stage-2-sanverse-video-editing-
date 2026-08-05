import { describe, expect, it } from 'vitest'

import { buildFilterGraph } from './ffmpeg-render-adapter.ts'
import { ms, testPlan, testSegmentNode, testSourceFacts } from '../test-fixtures.ts'

/**
 * Gate T0.7 — FAIL-051: a project holding footage of more than one size.
 *
 * ── WHAT WAS BROKEN ──────────────────────────────────────────────────────────
 *
 * Footage went into the exporter at whatever size it was recorded at. FFmpeg's
 * `concat` step, which joins the pieces end to end, refuses outright unless
 * every piece is already the same width, the same height and the same pixel
 * shape. Proved by running the real thing:
 *
 *   Input link in0:v0 parameters (size 714x1280, SAR 1:1) do not match the
 *   corresponding output link in0:v0 parameters (1920x1080, SAR 1:1)
 *
 * So the WHOLE export failed, and the message the user got — "The local
 * renderer could not produce a verified MP4" — explained nothing.
 *
 * It was recorded as "portrait phone footage cannot be exported into a
 * landscape project". That understated it. Any two clips of different sizes
 * failed: 1080p next to 720p, a 4K clip next to anything, a square clip from
 * social media next to a normal one.
 *
 * ── WHAT MUST NOW BE TRUE ────────────────────────────────────────────────────
 *
 * Every piece reaching `concat` is exactly the canvas size, with square pixels
 * and one colour storage, no matter what was imported. These tests hold that
 * line at the level of the instructions the exporter writes. The proof that the
 * instructions actually produce a playable file is a real export, probed with
 * ffprobe, recorded in T0_MIXED_FORMAT_EXPORT.md.
 */

const base = {
  sourcePath: '/work/source.mp4',
  outputPath: '/work/out.mp4',
  fontPath: 'font.ttf',
  ...testSourceFacts,
}

const PORTRAIT = 'asset_portrait01'

/** A normal widescreen clip, then an upright phone clip. */
const landscapeThenPortrait = (framing?: 'fit' | 'fill') => testPlan({
  ...(framing ? { framing } : {}),
  width: 1920,
  height: 1080,
  durationTicks: ms(10_000).ticks,
  sources: [
    { assetId: 'asset_aaaaaaaa', mediaKind: 'video' as const },
    { assetId: PORTRAIT, mediaKind: 'video' as const },
  ],
  segments: [
    testSegmentNode({ interval: { start: ms(0), duration: ms(6_000) } }),
    testSegmentNode({
      nodeId: 'clip_portrait1',
      interval: { start: ms(6_000), duration: ms(4_000) },
      assetId: PORTRAIT,
      sourceStartTicks: 0,
    }),
  ],
  overlays: [],
  music: [],
})

const graphOf = (plan: ReturnType<typeof landscapeThenPortrait>) =>
  buildFilterGraph({ ...base, plan: plan as never })

/** The instruction lines, one per graph step, with the labels intact. */
const linesOf = (graph: string) => graph.split(';').map((line) => line.trim()).filter(Boolean)

describe('exporting a project whose clips are not all the same size', () => {
  it('makes every piece of footage the canvas size before joining them', () => {
    // This single assertion is FAIL-051. Without it `concat` is handed a
    // 714x1280 piece and a 1920x1080 piece and refuses the entire export.
    const graph = graphOf(landscapeThenPortrait())
    const normalizing = linesOf(graph).filter((line) => line.includes('force_original_aspect_ratio'))
    expect(normalizing).toHaveLength(2)
    for (const line of normalizing) {
      expect(line).toContain('scale=w=1920:h=1080')
    }
  })

  it('normalizes the FIRST clip too, not only the odd one out', () => {
    // Tempting shortcut: leave the clip that already matches alone. It would
    // work today and break the first time somebody changed the project size,
    // and the failure would look like it came from the clip that was untouched.
    const graph = graphOf(landscapeThenPortrait())
    expect(graph).toContain('[source_video_0]')
    expect(graph).toContain('[normalized_video_0]')
    expect(graph).toContain('[normalized_video_1]')
  })

  it('declares the size, the pixel shape and the colour storage on every piece', () => {
    // These are the exact three things `concat` compares. Missing any one of
    // them fails the export on the second clip.
    const graph = graphOf(landscapeThenPortrait())
    for (const line of linesOf(graph).filter((l) => l.includes('force_original_aspect_ratio'))) {
      expect(line).toContain('setsar=1')
      expect(line).toContain('format=pix_fmts=yuv420p')
      expect(line).toMatch(/pad=w=1920:h=1080|crop=w='min\(iw,1920\)'/)
    }
  })

  it('squares oblong pixels before measuring against the canvas', () => {
    const graph = graphOf(landscapeThenPortrait())
    const line = linesOf(graph).find((l) => l.includes('force_original_aspect_ratio'))
    expect(line).toBeDefined()
    const squaring = line!.indexOf('iw*sar')
    const measuring = line!.indexOf('force_original_aspect_ratio')
    expect(squaring).toBeGreaterThanOrEqual(0)
    expect(measuring).toBeGreaterThan(squaring)
  })

  it('shows the whole picture with black bars by default', () => {
    const graph = graphOf(landscapeThenPortrait())
    expect(graph).toContain('force_original_aspect_ratio=decrease')
    expect(graph).toContain("pad=w=1920:h=1080:x='(ow-iw)/2':y='(oh-ih)/2':color=black")
    expect(graph).not.toContain('force_original_aspect_ratio=increase')
  })

  it('fills the screen and cuts the overhang when the project asks for it', () => {
    const graph = graphOf(landscapeThenPortrait('fill'))
    expect(graph).toContain('force_original_aspect_ratio=increase')
    expect(graph).toContain("crop=w='min(iw,1920)':h='min(ih,1080)'")
    expect(graph).not.toContain('force_original_aspect_ratio=decrease')
  })

  it('frames the footage before moving it, not after', () => {
    // Motion moves and scales the picture relative to the canvas. Running it
    // against a picture that is not yet canvas-shaped would scale an upright
    // phone clip relative to its own 714x1280, so "no motion at all" and
    // "motion that changes nothing" would frame the same clip differently.
    const graph = graphOf(landscapeThenPortrait())
    const lines = linesOf(graph)
    const framed = lines.findIndex((line) => line.includes('[normalized_video_0]'))
    const moved = lines.findIndex((line) => line.startsWith('[normalized_video_0]'))
    expect(framed).toBeGreaterThanOrEqual(0)
    expect(moved).toBeGreaterThan(framed)
  })

  it('keeps every piece exactly as long as it was, so framing cannot move a cut', () => {
    const graph = graphOf(landscapeThenPortrait())
    expect(graph).toContain('trim=start=0.000000000:end=6.000000000')
    expect(graph).toContain('trim=start=0.000000000:end=4.000000000')
    expect(graph).toContain('concat=n=2:v=1:a=1')
  })

  it('brings every clip’s sound to one rate and one shape as well', () => {
    // The picture is not the only thing that has to match. A mono clip at
    // 44.1 kHz next to a stereo clip at 48 kHz fails the join in the same way.
    const graph = graphOf(landscapeThenPortrait())
    const audio = linesOf(graph).filter((line) => line.includes('atrim='))
    expect(audio).toHaveLength(2)
    for (const line of audio) {
      expect(line).toContain('aresample=48000')
      expect(line).toContain('aformat=sample_fmts=fltp:channel_layouts=stereo')
    }
  })

  it('black filling a hole is already the canvas size, so it joins the rest', () => {
    const plan = testPlan({
      width: 1920,
      height: 1080,
      durationTicks: ms(9_000).ticks,
      sources: [{ assetId: 'asset_aaaaaaaa', mediaKind: 'video' as const }],
      segments: [
        testSegmentNode({ interval: { start: ms(0), duration: ms(4_000) } }),
        testSegmentNode({
          nodeId: 'clip_after0001',
          interval: { start: ms(6_000), duration: ms(3_000) },
          sourceStartTicks: ms(6_000).ticks,
        }),
      ],
      overlays: [],
      music: [],
    })
    const graph = buildFilterGraph({ ...base, plan: plan as never })
    expect(graph).toContain('color=c=black:s=1920x1080')
  })

  it('writes nothing into the instructions that did not come from a number or a fixed word', () => {
    // The instructions are written to a file and handed to FFmpeg's filter
    // parser. Everything the framing contributes comes from two numbers and a
    // two-value choice, so there is no route for text a user typed to be read
    // as an instruction.
    const graph = graphOf(landscapeThenPortrait())
    for (const line of linesOf(graph).filter((l) => l.includes('force_original_aspect_ratio'))) {
      expect(line).toMatch(/^[a-zA-Z0-9_=:',()*\-+/.\[\] ]+$/)
    }
  })
})
