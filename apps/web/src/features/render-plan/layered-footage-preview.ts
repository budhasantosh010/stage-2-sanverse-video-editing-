import { evaluateFootageMotionAt, mediaTime } from '@sanverse/edit-domain'
import type { PrimarySegmentNode, RenderPlan } from '@sanverse/render-contract'
import { pictureNodesAt, segmentSourceTicksAt } from '@sanverse/render-contract/picture-layers'
import { normalizeVisual } from '@sanverse/render-contract/visual-normalization'
import { createLayerVideoDecoderPool, type LayerVideoDecoderPool, type LayerVideoRequest } from './layer-video-decoder'
import { segmentVideoOpacityAt } from './render-plan-preview'

type Snapshot = Readonly<{ plan: RenderPlan; ticks: number; playing: boolean; reducedMotion?: boolean }>
export type LayeredPreviewStatus = Readonly<{
  state: 'ready' | 'loading' | 'error'
  reason?: 'REVERSE_PREPARING' | 'SOURCE_MISSING' | 'DECODE_FAILED' | 'CAPACITY_EXCEEDED' | 'DRAW_FAILED'
}>
type Options = Readonly<{
  canvasFor: (nodeId: string) => HTMLCanvasElement | null
  sourceFor: (segment: PrimarySegmentNode) => Readonly<{ url: string; reversePrepared?: boolean }> | null
  onStatus?: (status: LayeredPreviewStatus) => void
  createPool?: (onChange: () => void) => LayerVideoDecoderPool
}>

/** Rendering resources only: the editor supplies every composition tick. No timer or edit state lives here. */
export function createLayeredFootagePreview(options: Options) {
  let snapshot: Snapshot | null = null
  let disposed = false
  let active: readonly PrimarySegmentNode[] = []
  let status: LayeredPreviewStatus = { state: 'ready' }
  const drawn = new Map<string, HTMLCanvasElement>()
  const sourceKeys = new Map<string, string>()
  const pool = options.createPool?.(() => draw()) ?? createLayerVideoDecoderPool({ onChange: () => draw() })
  function publish(next: LayeredPreviewStatus) {
    if (status.state !== next.state || status.reason !== next.reason) {
      status = next
      options.onStatus?.(next)
    }
    return status
  }
  function clear(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }
  function clearAll() { drawn.forEach(clear) }
  function draw(): LayeredPreviewStatus {
    if (!snapshot || disposed) return status
    const { plan, ticks } = snapshot
    const frames: { segment: PrimarySegmentNode; canvas: HTMLCanvasElement; source: HTMLVideoElement }[] = []
    // Present a complete moment, not a mixture of independently arriving seeks.
    // While waiting, the previous complete picture is retained and labelled loading.
    for (const segment of active) {
      const canvas = options.canvasFor(segment.nodeId)
      const source = pool.frame(segment.nodeId)
      const resource = pool.status(segment.nodeId)
      if (resource.state === 'error') { clearAll(); return publish({ state: 'error', reason: 'DECODE_FAILED' }) }
      if (!canvas || !source) return publish({ state: 'loading' })
      frames.push({ segment, canvas, source })
    }
    for (const { segment, canvas, source } of frames) {
      drawn.set(segment.nodeId, canvas)
      const sourceTicks = segmentSourceTicksAt(segment, ticks)
      if (sourceTicks === null) { clear(canvas); continue }
      const normalization = normalizeVisual({
        sourceWidth: source.videoWidth, sourceHeight: source.videoHeight,
        canvasWidth: plan.width, canvasHeight: plan.height, fitMode: plan.framing ?? 'fit',
      })
      const ctx = canvas.getContext('2d')
      if (!ctx || !normalization.ok) { clearAll(); return publish({ state: 'error', reason: 'DRAW_FAILED' }) }
      if (canvas.width !== plan.width) canvas.width = plan.width
      if (canvas.height !== plan.height) canvas.height = plan.height
      const motion = segment.footageMotions.find(m => sourceTicks >= m.sourceInterval.start.ticks && sourceTicks < m.sourceInterval.start.ticks + m.sourceInterval.duration.ticks)
      const evaluated = motion ? evaluateFootageMotionAt({ motion, sourceTime: mediaTime(sourceTicks), reducedMotion: snapshot.reducedMotion ?? false }) : null
      const transform = evaluated?.transform ?? { translateX: 0, translateY: 0, scale: 1, rotationDegrees: 0, opacity: 1 }
      const crop = evaluated?.crop ?? { left: 0, right: 0, top: 0, bottom: 0 }
      const fit = normalization.value
      ctx.save()
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.translate(plan.width * (0.5 + transform.translateX), plan.height * (0.5 + transform.translateY))
        ctx.rotate(transform.rotationDegrees * Math.PI / 180)
        ctx.scale(transform.scale, transform.scale)
        ctx.globalAlpha = transform.opacity
        ctx.beginPath()
        ctx.rect((crop.left - 0.5) * plan.width, (crop.top - 0.5) * plan.height,
          (1 - crop.left - crop.right) * plan.width, (1 - crop.top - crop.bottom) * plan.height)
        ctx.clip()
        ctx.drawImage(source, fit.padLeft - fit.cropLeft - plan.width / 2, fit.padTop - fit.cropTop - plan.height / 2, fit.scaledWidth, fit.scaledHeight)
      } catch {
        clearAll()
        return publish({ state: 'error', reason: 'DRAW_FAILED' })
      } finally { ctx.restore() }
      // FFmpeg dips the already transformed surface to a color, preserving its
      // alpha. Fading the entire DOM layer would incorrectly reveal lower video.
      const opacity = segmentVideoOpacityAt(segment, ticks, snapshot.reducedMotion ?? false, plan.transitions)
      if (opacity < 1) {
        const transition = plan.transitions.find(edge => edge.toSegmentId === segment.nodeId)
          ?? plan.transitions.find(edge => edge.fromSegmentId === segment.nodeId)
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalCompositeOperation = 'source-atop'
        ctx.globalAlpha = 1 - opacity
        ctx.fillStyle = transition?.style === 'dip-to-white' ? 'white' : 'black'
        ctx.fillRect(0, 0, plan.width, plan.height)
        ctx.restore()
      }
    }
    return publish({ state: 'ready' })
  }
  return {
    update(next: Snapshot): LayeredPreviewStatus {
      if (disposed) throw new Error('Layered preview is disposed')
      if (snapshot && snapshot.plan.projectId !== next.plan.projectId) { clearAll(); sourceKeys.clear() }
      snapshot = next
      active = pictureNodesAt(next.plan, next.ticks).filter((node): node is PrimarySegmentNode => node.kind === 'source-segment' || node.kind === 'freeze-segment')
      const ids = new Set(active.map(segment => segment.nodeId))
      for (const [id, canvas] of drawn) if (!ids.has(id)) { clear(canvas); drawn.delete(id) }
      for (const id of sourceKeys.keys()) if (!ids.has(id)) sourceKeys.delete(id)
      const requests: LayerVideoRequest[] = []
      for (const segment of active) {
        const source = options.sourceFor(segment)
        if (!source || (segment.direction === 'reverse' && !source.reversePrepared)) {
          pool.update([], false)
          clearAll()
          return publish(source ? { state: 'loading', reason: 'REVERSE_PREPARING' } : { state: 'error', reason: 'SOURCE_MISSING' })
        }
        const sourceTicks = segmentSourceTicksAt(segment, next.ticks)!
        const key = segment.assetId + ':' + source.url
        if (sourceKeys.has(segment.nodeId) && sourceKeys.get(segment.nodeId) !== key) {
          const canvas = drawn.get(segment.nodeId)
          if (canvas) clear(canvas)
        }
        sourceKeys.set(segment.nodeId, key)
        requests.push({
          id: segment.nodeId, url: source.url,
          sourceTicks: segment.direction === 'reverse'
            ? segment.sourceStartTicks + segment.sourceDurationTicks - 1 - sourceTicks : sourceTicks,
          playbackRate: segment.playbackRateNumerator / segment.playbackRateDenominator,
          hold: segment.kind === 'freeze-segment',
        })
      }
      try { pool.update(requests, next.playing) }
      catch { clearAll(); return publish({ state: 'error', reason: 'CAPACITY_EXCEEDED' }) }
      return draw()
    },
    dispose() {
      if (disposed) return
      disposed = true
      pool.dispose()
      clearAll()
      drawn.clear()
      sourceKeys.clear()
      snapshot = null
      active = []
    },
  }
}
