import { describe, expect, it, vi } from 'vitest'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import { ms, testMultiAssetProject } from '@sanverse/edit-domain/test-fixtures'
import { createLayeredFootagePreview } from './layered-footage-preview'
import type { LayerVideoDecoderPool } from './layer-video-decoder'

function setup() {
  const compiled = compileProjectToRenderPlan(testMultiAssetProject(), { layered: true })
  if (!compiled.ok) throw new Error('Fixture compile failed')
  const base = compiled.value.segments[0]
  if (base.kind !== 'source-segment') throw new Error('Expected moving fixture')
  const plan = { ...compiled.value, segments: [base, { ...base, nodeId: 'clip_upper' }], pictureLayers: [
    { trackId: 'track_lower', nodeIds: [base.nodeId] }, { trackId: 'track_upper', nodeIds: ['clip_upper'] },
  ] }
  const contexts = new Map<string, ReturnType<typeof context>>()
  function context() { return { save: vi.fn(), restore: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '', globalCompositeOperation: 'source-over', globalAlpha: 1 } }
  const canvases = new Map<string, HTMLCanvasElement>()
  const canvasFor = (id: string) => {
    if (!canvases.has(id)) {
      const canvas = document.createElement('canvas')
      const ctx = context()
      vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as never)
      contexts.set(id, ctx)
      canvases.set(id, canvas)
    }
    return canvases.get(id)!
  }
  const video = document.createElement('video')
  Object.defineProperties(video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } })
  const pool: LayerVideoDecoderPool = { update: vi.fn(), frame: vi.fn(() => video), status: vi.fn(() => ({ state: 'ready' as const })), dispose: vi.fn() }
  const controller = createLayeredFootagePreview({ canvasFor, sourceFor: () => ({ url: '/source.mp4' }), createPool: () => pool })
  return { plan, controller, pool, contexts, canvases, base }
}

describe('layered footage preview resources', () => {
  it('dips each rendered surface to the declared color without exposing the lower layer', () => {
    const { plan, controller, contexts } = setup()
    const modified = { ...plan, transitions: [{
      nodeId: 'transition_test', kind: 'transition-edge' as const, fromSegmentId: 'clip_upper', toSegmentId: plan.segments[0].nodeId,
      style: 'dip-to-white' as const, durationTicks: ms(1000).ticks, audio: 'cut' as const,
    }] }
    controller.update({ plan: modified, ticks: ms(500).ticks, playing: false })
    const ctx = contexts.get(plan.segments[0].nodeId)!
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, plan.width, plan.height)
    expect(ctx.fillStyle).toBe('white')
    expect(ctx.globalCompositeOperation).toBe('source-atop')
    expect(ctx.globalAlpha).toBe(0.5)
    controller.dispose()
  })
  it('draws simultaneous footage on separate surfaces without owning a clock or changing the plan', () => {
    const { plan, controller, pool, contexts } = setup()
    const before = JSON.stringify(plan)
    expect(controller.update({ plan, ticks: ms(2000).ticks, playing: true }).state).toBe('ready')
    expect(pool.update).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'clip_upper', sourceTicks: ms(2000).ticks })]), true)
    expect(contexts.size).toBe(2)
    for (const ctx of contexts.values()) expect(ctx.drawImage).toHaveBeenCalledOnce()
    expect(JSON.stringify(plan)).toBe(before)
    controller.dispose()
    expect(pool.dispose).toHaveBeenCalledOnce()
  })
  it('clears hidden/removed layers instead of retaining a stale upper picture', () => {
    const { plan, controller, contexts } = setup()
    controller.update({ plan, ticks: ms(2000).ticks, playing: false })
    const upper = contexts.get('clip_upper')!
    upper.clearRect.mockClear()
    controller.update({ plan: { ...plan, segments: plan.segments.map(s => s.nodeId === 'clip_upper' ? { ...s, videoEnabled: false } : s) }, ticks: ms(2000).ticks, playing: false })
    expect(upper.clearRect).toHaveBeenCalledOnce()
    expect(upper.drawImage).toHaveBeenCalledTimes(1)
    controller.dispose()
  })
  it('reports loading while any current frame is unavailable, and draws only when ready', () => {
    const { plan, controller, pool, contexts } = setup()
    vi.mocked(pool.frame).mockReturnValue(null)
    vi.mocked(pool.status).mockReturnValue({ state: 'seeking' })
    expect(controller.update({ plan, ticks: ms(2000).ticks, playing: false }).state).toBe('loading')
    for (const ctx of contexts.values()) expect(ctx.drawImage).not.toHaveBeenCalled()
    controller.dispose()
  })
  it('applies source-relative crop, scale, rotation and opacity on a transparent surface', () => {
    const { plan, controller, contexts } = setup()
    const modified = { ...plan, segments: plan.segments.map(s => ({ ...s, footageMotions: [{
      motionId: 'motion_layer', sourceInterval: { start: ms(0), duration: ms(3000) },
      transform: { translateX: 0.1, translateY: 0, rotationDegrees: 90, scale: 0.5, opacity: 0.5 },
      crop: { left: 0.25, right: 0, top: 0, bottom: 0 }, tracks: [],
    }] })) }
    controller.update({ plan: modified, ticks: ms(2000).ticks, playing: false })
    const ctx = contexts.get('clip_upper')!
    expect(ctx.translate).toHaveBeenCalledWith(plan.width * 0.6, plan.height * 0.5)
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(ctx.scale).toHaveBeenCalledWith(0.5, 0.5)
    expect(ctx.globalAlpha).toBe(0.5)
    expect(ctx.clip).toHaveBeenCalledOnce()
    controller.dispose()
  })
  it('retains the last complete picture during a seek instead of blanking or mixing different moments', () => {
    const { plan, controller, pool, contexts } = setup()
    controller.update({ plan, ticks: ms(1000).ticks, playing: false })
    for (const ctx of contexts.values()) { ctx.clearRect.mockClear(); ctx.drawImage.mockClear() }
    const readyFrame = pool.frame(plan.segments[0].nodeId)
    vi.mocked(pool.frame).mockImplementation(id => id === 'clip_upper' ? null : readyFrame)
    vi.mocked(pool.status).mockImplementation(id => ({ state: id === 'clip_upper' ? 'seeking' : 'ready' }))
    expect(controller.update({ plan, ticks: ms(2000).ticks, playing: false }).state).toBe('loading')
    for (const ctx of contexts.values()) {
      expect(ctx.clearRect).not.toHaveBeenCalled()
      expect(ctx.drawImage).not.toHaveBeenCalled()
    }
    controller.dispose()
  })
  it('refuses unprepared reverse playback instead of playing it forwards', () => {
    const { plan, controller, pool } = setup()
    const reversed = { ...plan, segments: plan.segments.map(s => ({ ...s, direction: 'reverse' as const })) }
    expect(controller.update({ plan: reversed, ticks: ms(2000).ticks, playing: true })).toMatchObject({ state: 'loading', reason: 'REVERSE_PREPARING' })
    expect(pool.update).toHaveBeenLastCalledWith([], false)
    controller.dispose()
  })
})
