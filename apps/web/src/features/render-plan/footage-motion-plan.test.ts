import { describe, expect, it } from 'vitest'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import { ms, testProject } from '../../test-fixtures'
import { selectedFootageSourceTime, withFootageMotionDraft } from './footage-motion-plan'

function fixture() {
  const result = compileProjectToRenderPlan(testProject())
  if (!result.ok) throw new Error('Fixture compile failed')
  const segment = result.value.segments[0]
  if (segment.kind !== 'source-segment') throw new Error('Expected moving source')
  return { plan: result.value, segment }
}
describe('Inspector and draft use the render source clock', () => {
  it('keeps slow-clip controls available beyond the original source length, but not at its timeline end', () => {
    const { plan, segment } = fixture()
    const slow = { ...segment, sourceDurationTicks: ms(4000).ticks, interval: { start: ms(1000), duration: ms(8000) }, playbackRateDenominator: 2 }
    const result = { ...plan, segments: [slow] }
    expect(selectedFootageSourceTime(result, slow.nodeId, ms(7000).ticks)?.ticks).toBe(ms(3000).ticks)
    expect(selectedFootageSourceTime(result, slow.nodeId, ms(9000).ticks)).toBeNull()
    expect(selectedFootageSourceTime(result, 'missing', ms(7000).ticks)).toBeNull()
  })
  it('selects source time by clip identity when different layers overlap', () => {
    const { plan, segment } = fixture()
    const upper = { ...segment, nodeId: 'clip_upper', sourceStartTicks: ms(2000).ticks }
    expect(selectedFootageSourceTime({ ...plan, segments: [segment, upper] }, upper.nodeId, ms(1000).ticks)?.ticks).toBe(ms(3000).ticks)
  })
  it('projects a late source motion onto a fast clip using source span, not timeline duration', () => {
    const { plan, segment } = fixture()
    const fast = { ...segment, sourceDurationTicks: ms(8000).ticks, interval: { start: ms(0), duration: ms(4000) }, playbackRateNumerator: 2 }
    const draft = { motionId: 'motion_late', sourceInterval: { start: ms(6000), duration: ms(1000) },
      transform: { scale: 1.2, translateX: 0, translateY: 0, rotationDegrees: 0, opacity: 1 },
      crop: { top: 0, right: 0, bottom: 0, left: 0 }, tracks: [] }
    const input = { ...plan, segments: [fast, { ...fast, nodeId: 'clip_other', assetId: 'asset_other' }] }
    const result = withFootageMotionDraft(input, segment.assetId, draft)
    expect(result.segments[0].footageMotions).toEqual([draft])
    expect(result.segments[1]).toBe(input.segments[1])
    expect(input.segments[0].footageMotions).toEqual([])
  })
})
