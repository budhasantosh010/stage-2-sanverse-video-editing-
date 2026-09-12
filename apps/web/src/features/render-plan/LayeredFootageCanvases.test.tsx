import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import { testMultiAssetProject } from '@sanverse/edit-domain/test-fixtures'
import { LayeredFootageCanvases, pictureStackIndex } from './LayeredFootageCanvases'

afterEach(cleanup)
describe('layered canvas binding', () => {
  it('publishes initial empty-interval readiness so the shared clock can play through gaps', () => {
    const compiled = compileProjectToRenderPlan(testMultiAssetProject(), { layered: true })
    if (!compiled.ok) throw new Error('Fixture failed')
    const onStatus = vi.fn()
    render(<LayeredFootageCanvases plan={compiled.value} ticks={compiled.value.durationTicks}
      playing={false} reducedMotion={false} sources={new Map()} onStatus={onStatus} />)
    expect(onStatus).toHaveBeenCalledWith({ state: 'ready' })
  })
  it('orders canvas and overlays by the shared track manifest, not selection or array order', () => {
    const compiled = compileProjectToRenderPlan(testMultiAssetProject(), { layered: true })
    if (!compiled.ok) throw new Error('Fixture failed')
    const base = compiled.value
    const plan = { ...base, pictureLayers: [
      { trackId: 'track_lower', nodeIds: ['title_lower'] },
      { trackId: 'track_upper', nodeIds: [base.segments[0].nodeId, 'title_upper'] },
    ] }
    expect(pictureStackIndex(plan, 'title_lower')).toBeLessThan(pictureStackIndex(plan, base.segments[0].nodeId))
    expect(pictureStackIndex(plan, 'title_upper')).toBeGreaterThan(pictureStackIndex(plan, base.segments[0].nodeId))
  })
  it('preserves every same-track manifest position across mixed node families and tracks', () => {
    const compiled = compileProjectToRenderPlan(testMultiAssetProject(), { layered: true })
    if (!compiled.ok) throw new Error('Fixture failed')
    const plan = { ...compiled.value, pictureLayers: [
      { trackId: 'track_lower', nodeIds: ['title_lower', 'media_lower', 'callout_lower'] },
      { trackId: 'track_upper', nodeIds: [compiled.value.segments[0].nodeId, 'title_upper', 'media_upper'] },
      { trackId: 'track_caption', nodeIds: ['caption_upper'] },
    ] }
    const indices = plan.pictureLayers.flatMap(layer => layer.nodeIds.map(id => pictureStackIndex(plan, id)))
    for (let index = 1; index < indices.length; index += 1) {
      expect(indices[index]).toBeGreaterThan(indices[index - 1])
    }
    expect(indices.every(Number.isInteger)).toBe(true)
    expect(pictureStackIndex(plan, 'missing_node')).toBeLessThan(indices[0])
  })
  it('keeps all picture ranks below editor controls without a fixed layer-count limit', () => {
    const compiled = compileProjectToRenderPlan(testMultiAssetProject(), { layered: true })
    if (!compiled.ok) throw new Error('Fixture failed')
    const plan = { ...compiled.value, pictureLayers: Array.from({ length: 120 }, (_, track) => ({
      trackId: `track_${track}`, nodeIds: Array.from({ length: 3 }, (_, node) => `node_${track}_${node}`),
    })) }
    const indices = plan.pictureLayers.flatMap(layer => layer.nodeIds.map(id => pictureStackIndex(plan, id)))
    expect(new Set(indices).size).toBe(indices.length)
    expect(indices.every(index => Number.isInteger(index) && index < 0)).toBe(true)
  })
})
