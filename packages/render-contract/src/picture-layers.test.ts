import { describe, expect, it } from 'vitest'
import { activeTimelineTrackState } from '@sanverse/edit-domain'
import { testMultiAssetProject, ms } from '@sanverse/edit-domain/test-fixtures'
import { compileProjectToRenderPlan } from './compile-project'
import { validateRenderPlan, type RenderPlan } from './render-plan'
import { pictureNodesAt, segmentSourceTicksAt } from './picture-layers'

function plan(): RenderPlan {
  const result = compileProjectToRenderPlan(testMultiAssetProject(), { layered: true })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}
function overlapping(): RenderPlan {
  const base = plan()
  const source = base.segments[0]
  if (source.kind !== 'source-segment') throw new Error('Expected moving fixture')
  return {
    ...base,
    segments: [source, { ...source, nodeId: 'clip_upper', sourceDurationTicks: ms(1000).ticks, interval: { start: ms(1000), duration: ms(1000) } }],
    pictureLayers: [
      { trackId: 'track_lower', nodeIds: [base.segments[0].nodeId] },
      { trackId: 'track_upper', nodeIds: ['clip_upper'] },
    ],
  }
}

describe('explicit picture layer contract', () => {
  it('keeps the live compiler on v9 until both renderers are integrated', () => {
    const result = compileProjectToRenderPlan(testMultiAssetProject())
    expect(result).toMatchObject({ ok: true, value: { schemaVersion: 'sanverse.render-plan/v9' } })
    if (result.ok) expect(result.value).not.toHaveProperty('pictureLayers')
  })
  it('compiles stable track identity into the opt-in v10 plan', () => {
    const compiled = plan()
    expect(compiled.schemaVersion).toBe('sanverse.render-plan/v10')
    const primary = activeTimelineTrackState(testMultiAssetProject()).tracks.find(t => t.role === 'primary-video')!
    expect(compiled.pictureLayers).toContainEqual({ trackId: primary.trackId, nodeIds: [compiled.segments[0].nodeId] })
    expect(validateRenderPlan(compiled).ok).toBe(true)
  })
  it('permits simultaneous footage on different explicit layers only', () => {
    expect(validateRenderPlan(overlapping()).ok).toBe(true)
    const same = overlapping()
    expect(validateRenderPlan({ ...same, pictureLayers: [{ trackId: 'track_one', nodeIds: same.segments.map(s => s.nodeId) }] })).toMatchObject({ ok: false })
  })
  it.each(['missing', 'duplicate', 'unknown', 'duplicate-track'] as const)('refuses %s layer identities', fault => {
    const base = overlapping()
    const layers = fault === 'missing' ? [] : fault === 'duplicate'
      ? [{ trackId: 'track_a', nodeIds: [base.segments[0].nodeId, base.segments[0].nodeId, 'clip_upper'] }]
      : fault === 'unknown' ? [{ trackId: 'track_a', nodeIds: [...base.segments.map(s => s.nodeId), 'not_a_node'] }]
      : [{ trackId: 'track_a', nodeIds: [base.segments[0].nodeId] }, { trackId: 'track_a', nodeIds: ['clip_upper'] }]
    expect(validateRenderPlan({ ...base, pictureLayers: layers }).ok).toBe(false)
  })
  it('requires layer metadata on v10 and rejects it on v9', () => {
    const { pictureLayers: _, ...base } = plan()
    expect(validateRenderPlan(base).ok).toBe(false)
    expect(validateRenderPlan({ ...plan(), schemaVersion: 'sanverse.render-plan/v9' }).ok).toBe(false)
  })
  it('draws bottom to top by explicit order, independent of segment array order', () => {
    const base = overlapping()
    expect(pictureNodesAt(base, ms(1500).ticks).map(n => n.nodeId)).toEqual([base.segments[0].nodeId, 'clip_upper'])
    expect(pictureNodesAt({ ...base, segments: [...base.segments].reverse() }, ms(1500).ticks)).toEqual(pictureNodesAt(base, ms(1500).ticks))
  })
  it('uses half-open intervals and reveals the lower layer when the upper is disabled', () => {
    const base = overlapping()
    expect(pictureNodesAt(base, ms(2000).ticks).map(n => n.nodeId)).toEqual([base.segments[0].nodeId])
    expect(pictureNodesAt({ ...base, segments: base.segments.map(s => s.nodeId === 'clip_upper' ? { ...s, videoEnabled: false } : s) }, ms(1500).ticks).map(n => n.nodeId)).toEqual([base.segments[0].nodeId])
    expect(pictureNodesAt(base, base.durationTicks)).toEqual([])
  })
  it('maps forward, reverse, speed and held frames through exact source time', () => {
    const base = plan().segments[0]
    if (base.kind !== 'source-segment') throw new Error('Expected moving fixture')
    const segment = { ...base, sourceStartTicks: ms(5000).ticks, sourceDurationTicks: ms(4000).ticks, interval: { start: ms(1000), duration: ms(2000) }, playbackRateNumerator: 2, playbackRateDenominator: 1 }
    expect(segmentSourceTicksAt(segment, ms(1500).ticks)).toBe(ms(6000).ticks)
    expect(segmentSourceTicksAt({ ...segment, direction: 'reverse' }, ms(1500).ticks)).toBe(ms(8000).ticks - 1)
    expect(segmentSourceTicksAt({ ...segment, kind: 'freeze-segment', sourceTimeTicks: ms(7000).ticks } as never, ms(1500).ticks)).toBe(ms(7000).ticks)
    expect(segmentSourceTicksAt(segment, ms(3000).ticks)).toBeNull()
  })
})
