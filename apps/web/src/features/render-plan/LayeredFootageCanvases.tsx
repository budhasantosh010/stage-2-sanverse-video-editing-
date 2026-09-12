import { useLayoutEffect, useRef } from 'react'
import type { RenderPlan } from '@sanverse/render-contract'
import { createLayeredFootagePreview, type LayeredPreviewStatus } from './layered-footage-preview'

export type LayeredFootageSource = Readonly<{ url: string; reversePrepared?: boolean }>

/** Sibling surfaces share the overlay stacking context. No project or clock is owned here. */
export function LayeredFootageCanvases(props: Readonly<{
  plan: RenderPlan
  ticks: number
  playing: boolean
  reducedMotion: boolean
  sources: ReadonlyMap<string, LayeredFootageSource>
  onStatus: (status: LayeredPreviewStatus) => void
}>) {
  const canvases = useRef(new Map<string, HTMLCanvasElement>())
  const current = useRef(props)
  current.current = props
  const controller = useRef<ReturnType<typeof createLayeredFootagePreview> | null>(null)
  useLayoutEffect(() => {
    const resource = createLayeredFootagePreview({
      canvasFor: id => canvases.current.get(id) ?? null,
      sourceFor: segment => current.current.sources.get(segment.nodeId) ?? null,
      onStatus: status => current.current.onStatus(status),
    })
    controller.current = resource
    return () => { resource.dispose(); controller.current = null }
  }, [props.plan.projectId])
  useLayoutEffect(() => {
    const status = controller.current?.update(props)
    if (status) props.onStatus(status)
  }, [props.plan, props.ticks, props.playing, props.reducedMotion, props.sources])
  return <>{props.plan.segments.map(segment => <canvas
    key={segment.nodeId}
    ref={canvas => { if (canvas) canvases.current.set(segment.nodeId, canvas); else canvases.current.delete(segment.nodeId) }}
    data-layered-footage={segment.nodeId}
    aria-hidden="true"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: pictureStackIndex(props.plan, segment.nodeId) }}
  />)}</>
}

export function pictureStackIndex(plan: RenderPlan, nodeId: string): number {
  if (!plan.pictureLayers) return 0
  const nodeIds = plan.pictureLayers.flatMap(layer => layer.nodeIds)
  // The content parent is an explicit stacking context. Negative integer ranks
  // preserve the complete export paint order below its guides/controls, without
  // reserving a fixed number of slots per track or letting picture counts cross
  // the controls' z-index. Unknown nodes stay below all manifest content.
  return nodeIds.indexOf(nodeId) - nodeIds.length
}
