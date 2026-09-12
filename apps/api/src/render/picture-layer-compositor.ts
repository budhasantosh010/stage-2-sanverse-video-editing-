import type { PictureLayer } from '@sanverse/render-contract'

export type PictureSurface = Readonly<{ nodeId: string; label: string; overlayFilter: string }>

/** Assemble already-rendered surfaces in canonical paint order, not discovery order. */
export function compositePictureLayers(layers: readonly PictureLayer[], surfaces: readonly PictureSurface[]): readonly string[] {
  const byNode = new Map<string, PictureSurface[]>()
  for (const surface of surfaces) {
    const entries = byNode.get(surface.nodeId) ?? []
    entries.push(surface)
    byNode.set(surface.nodeId, entries)
  }
  const graph: string[] = []
  let previous = 'vcat'
  for (const layer of layers) {
    for (const id of layer.nodeIds) {
      for (const surface of byNode.get(id) ?? []) {
        const next = `layer_picture_${graph.length}`
        graph.push(`[${previous}][${surface.label}]${surface.overlayFilter}[${next}]`)
        previous = next
      }
    }
  }
  graph.push(`[${previous}]format=pix_fmts=yuv420p,setsar=1[vout]`)
  return graph
}
