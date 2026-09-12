import { describe, expect, it } from 'vitest'
import { testPlan, testSegmentNode, testSourceFacts, ms } from '../test-fixtures.ts'
import { buildFilterGraph } from './ffmpeg-render-adapter.ts'
import type { RenderPlan } from '@sanverse/render-contract'

function layered(): RenderPlan {
  return testPlan({
    schemaVersion: 'sanverse.render-plan/v10', durationTicks: ms(6000).ticks,
    segments: [
      testSegmentNode({ nodeId: 'clip_bottom', interval: { start: ms(0), duration: ms(6000) }, sourceDurationTicks: ms(6000).ticks }),
      testSegmentNode({ nodeId: 'clip_top', interval: { start: ms(1000), duration: ms(2000) }, sourceDurationTicks: ms(2000).ticks }),
    ], overlays: [],
    pictureLayers: [{ trackId: 'track_bottom', nodeIds: ['clip_bottom'] }, { trackId: 'track_top', nodeIds: ['clip_top'] }],
  })
}
const graph = (plan: RenderPlan) => buildFilterGraph({ sourcePath: 'source.mp4', outputPath: 'output.mp4', fontPath: 'font.ttf', ...testSourceFacts, plan })

describe('layered FFmpeg picture composition', () => {
  it('composites simultaneous footage without concatenating or extending its duration', () => {
    const result = graph(layered())
    expect(result).not.toContain('concat=')
    expect(result).toContain('d=6.000000000')
    expect(result).toContain('PTS-STARTPTS+1.000000000/TB')
    expect(result).toContain("gte(t\\,1.000000000)*lt(t\\,3.000000000)")
    expect(result).toContain('[layer_picture_0][layer_source_1]overlay')
  })
  it('uses explicit layer order even when segment array order differs', () => {
    const plan = layered()
    const result = graph({ ...plan, pictureLayers: [...plan.pictureLayers!].reverse() })
    expect(result).toContain('[vcat][layer_source_1]overlay')
    expect(result).toContain('[layer_picture_0][layer_source_0]overlay')
  })
  it('skips hidden picture layers instead of covering lower footage with black', () => {
    const plan = layered()
    const result = graph({ ...plan, segments: plan.segments.map(s => s.nodeId === 'clip_top' ? { ...s, videoEnabled: false } : s) })
    expect(result).not.toContain('layer_source_1')
    expect(result).toContain('[vcat][layer_source_0]overlay')
  })
  it('keeps transparent framing until final composition', () => {
    const result = graph(layered())
    expect(result).toContain(":color=black@0")
    expect(result).toContain('format=pix_fmts=rgba')
    expect(result).toContain('format=pix_fmts=yuv420p,setsar=1[vout]')
  })
})
