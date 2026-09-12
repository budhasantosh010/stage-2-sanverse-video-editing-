import { describe, expect, it } from 'vitest'
import type { FootageMotionNode, FreezeSegmentNode } from '@sanverse/render-contract'
import { testPlan, testSegmentNode, testSourceFacts, ms } from '../test-fixtures.ts'
import { buildFilterGraph, layOutTimeline } from './ffmpeg-render-adapter.ts'

const motion: FootageMotionNode = {
  motionId: 'motion_retime01', sourceInterval: { start: ms(0), duration: ms(4000) },
  transform: { scale: 1, translateX: 0, translateY: 0, rotationDegrees: 0, opacity: 1 },
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  tracks: [{ property: 'scale', keyframes: [
    { at: ms(0), value: 1, easing: { kind: 'linear' } },
    { at: ms(4000), value: 2, easing: { kind: 'linear' } },
  ] }],
}
const graph = (segment: ReturnType<typeof testSegmentNode> | FreezeSegmentNode) => buildFilterGraph({
  sourcePath: 'source.mp4', outputPath: 'output.mp4', fontPath: 'font.ttf', ...testSourceFacts,
  plan: testPlan({ durationTicks: segment.interval.duration.ticks, segments: [segment], overlays: [] }),
})
const scale = (result: string) => result.match(/w='max\(2,trunc\(iw\*\((.*?)\)\/2\)\*2\)'/)![1]

describe('source-anchored footage motion under retiming', () => {
  it('samples the full source motion when playing four source seconds in two seconds', () => {
    const result = scale(graph(testSegmentNode({ interval: { start: ms(0), duration: ms(2000) }, sourceDurationTicks: ms(4000).ticks,
      playbackRateNumerator: 2, footageMotions: [motion] })))
    expect(result).toContain(',2)')
  })
  it('keeps an animated held-frame transform fixed at its held source tick', () => {
    const segment: FreezeSegmentNode = { ...testSegmentNode(), kind: 'freeze-segment',
      interval: { start: ms(0), duration: ms(2000) }, sourceTimeTicks: ms(2000).ticks,
      sourceStartTicks: ms(2000).ticks, sourceDurationTicks: 1, audioEnabled: false,
      linkedAudio: null, gainDb: 0, fadeInTicks: 0, fadeOutTicks: 0,
      playbackRateNumerator: 1, playbackRateDenominator: 1, direction: 'forward', maintainAudioPitch: true, pan: 0,
      footageMotions: [motion] }
    expect(scale(graph(segment))).toBe('1.5')
  })
  it('orders reverse motion pieces in composition order with fades at the actual edges', () => {
    const segment = testSegmentNode({ interval: { start: ms(0), duration: ms(2000) }, sourceDurationTicks: ms(4000).ticks,
      playbackRateNumerator: 2, direction: 'reverse', fadeInTicks: ms(100).ticks, fadeOutTicks: ms(200).ticks,
      footageMotions: [{ ...motion, sourceInterval: { start: ms(0), duration: ms(2000) }, tracks: [] }] })
    const pieces = layOutTimeline(testPlan({ segments: [segment], durationTicks: ms(2000).ticks, overlays: [] }))
    expect(pieces.map(p => p.kind === 'footage' && [p.segment.interval.start.ticks, p.segment.sourceStartTicks, p.segment.footageMotions.length, p.segment.fadeInTicks, p.segment.fadeOutTicks]))
      .toEqual([[0, ms(2000).ticks, 0, ms(100).ticks, 0], [ms(1000).ticks, 0, 1, 0, ms(200).ticks]])
  })
  it('samples a reverse animation from the end toward the start', () => {
    const result = scale(graph(testSegmentNode({ interval: { start: ms(0), duration: ms(4000) }, direction: 'reverse', footageMotions: [motion] })))
    expect(result).toMatch(/if\(lt\(t,[^)]*\),2,/)
    expect(result).toContain(',1)')
  })
})
