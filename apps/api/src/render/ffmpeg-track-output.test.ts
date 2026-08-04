import { describe, expect, it } from 'vitest'

import { buildFilterGraph } from './ffmpeg-render-adapter.ts'
import { ms, testPlan, testSegmentNode, testSourceFacts } from '../test-fixtures.ts'

/**
 * What a switched-off track actually does to the file FFmpeg is told to build.
 *
 * Reading the filter graph is not the same as watching the exported video —
 * Rule #3 — but it is where a mistake is caught before a user waits for a wrong
 * one. The real export proof lives in the evidence folder.
 */

const base = {
  sourcePath: '/work/source.mp4',
  outputPath: '/work/out.mp4',
  fontPath: 'font.ttf',
  ...testSourceFacts,
}

const graphFor = (
  overrides: Record<string, unknown>,
  hasAudio = true,
): string => {
  const plan = testPlan({
    segments: [testSegmentNode({ interval: { start: ms(0), duration: ms(8_000) }, ...overrides } as never)],
    overlays: [],
    music: [],
  })
  return buildFilterGraph({ ...base, hasAudio, plan: plan as never })
}

describe('P1-F.1A C1.18 a switched-off track changes the exported file', () => {
  it('normally reads the picture and the sound out of the footage', () => {
    const graph = graphFor({})
    expect(graph).toContain('[0:v]trim=')
    expect(graph).toContain('[0:a]atrim=')
  })

  it('V1 off draws black instead of the picture, and never opens the video stream', () => {
    const graph = graphFor({ videoEnabled: false })
    expect(graph).toContain('color=c=black:s=1280x720')
    expect(graph).not.toContain('[0:v]trim=')
    // The voice is untouched: hiding the picture is not muting the person.
    expect(graph).toContain('[0:a]atrim=')
  })

  it('A1 off is real silence, not the clip turned down', () => {
    // A very low volume is still audible on headphones, and a user who muted a
    // track and then heard it faintly would be right to say the product lied.
    const graph = graphFor({ audioEnabled: false })
    expect(graph).toContain('anullsrc=')
    expect(graph).not.toContain('[0:a]atrim=')
    expect(graph).not.toContain('volume=')
    // The picture is untouched.
    expect(graph).toContain('[0:v]trim=')
  })

  it('both off still holds the same length, so nothing after it moves', () => {
    const graph = graphFor({ videoEnabled: false, audioEnabled: false })
    expect(graph).toContain('color=c=black:s=1280x720:r=30/1:d=8')
    expect(graph).toContain(':d=8.000000000,asetpts=PTS-STARTPTS')
    expect(graph).toContain('concat=n=1:v=1:a=1')
  })

  it('a piece with no sound track at all is unaffected by the mute switch', () => {
    const graph = graphFor({ audioEnabled: false }, false)
    expect(graph).toContain('concat=n=1:v=1:a=0')
    expect(graph).not.toContain('anullsrc=')
  })

  it('keeps the loudness and ramps a user set when the track is still heard', () => {
    const graph = graphFor({ gainDb: -6, fadeInTicks: ms(500).ticks })
    expect(graph).toContain('volume=-6dB')
    expect(graph).toContain('afade=t=in:st=0:d=0.5')
  })
})
