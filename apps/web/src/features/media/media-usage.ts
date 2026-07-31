import { activeOverlayOperations, effectiveComposition, type EditProject } from '@sanverse/edit-domain'
import type { MediaAssetUsage, MediaUsageKind } from './media-contract'

const KIND_ORDER: readonly MediaUsageKind[] = ['primary-video', 'media-overlay', 'music', 'unused']

export const buildMediaUsageIndex = (project: EditProject): ReadonlyMap<string, MediaAssetUsage> => {
  const counts = new Map<string, { count: number; kinds: Set<MediaUsageKind> }>()
  for (const asset of project.assets) counts.set(asset.assetId, { count: 0, kinds: new Set() })

  const add = (assetId: string, kind: MediaUsageKind) => {
    const current = counts.get(assetId)
    if (!current) return
    current.count += 1
    current.kinds.add(kind)
  }

  for (const track of effectiveComposition(project).tracks) {
    if (track.kind !== 'video') continue
    for (const clip of track.clips) add(clip.assetId, 'primary-video')
  }
  for (const operation of activeOverlayOperations(project)) {
    if (operation.kind === 'add-media-overlay') add(operation.overlayAssetId, 'media-overlay')
    if (operation.kind === 'add-music') add(operation.assetId, 'music')
  }

  return new Map([...counts].map(([assetId, value]) => [assetId, Object.freeze({
    count: value.count,
    kinds: Object.freeze(value.count === 0
      ? ['unused'] as const
      : KIND_ORDER.filter((kind) => kind !== 'unused' && value.kinds.has(kind))),
  })]))
}
