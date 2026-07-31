import type { MediaAsset } from '@sanverse/edit-domain'
import { deriveAssetDisplayLabels, safeAssetDisplayName } from './media-display-labels'
import { buildMediaUsageIndex } from './media-usage'
import type { MediaAssetView, MediaBinBuildInput, MediaBinViewModel, MediaFilter } from './media-contract'

const kindLabel = (asset: MediaAsset): MediaAssetView['kind'] => asset.mediaKind

export const buildMediaBinViewModel = (input: MediaBinBuildInput): MediaBinViewModel => {
  const labels = deriveAssetDisplayLabels({
    project: input.project,
    primaryDisplayName: input.primaryDisplayName,
    originalNames: Object.freeze(Object.fromEntries(input.project.assets.map((asset) => [
      asset.assetId,
      input.originalNames?.[asset.assetId] ?? input.assetSources[asset.assetId]?.originalName ?? '',
    ]))),
  })
  const usage = buildMediaUsageIndex(input.project)
  const primaryAssetId = input.project.composition.tracks
    .find((track) => track.kind === 'video')?.clips[0]?.assetId ?? null

  const assets = Object.freeze(input.project.assets.map((asset) => {
    const source = input.assetSources[asset.assetId]
    const status = source?.status ?? 'missing'
    const assetUsage = usage.get(asset.assetId) ?? Object.freeze({ count: 0, kinds: Object.freeze(['unused'] as const) })
    const inUse = assetUsage.count > 0
    const canAddAsOverlay = status === 'available' && asset.assetId !== primaryAssetId && asset.mediaKind !== 'audio'
    const canAddAsMusic = status === 'available' && asset.mediaKind === 'audio'
    return Object.freeze({
      assetId: asset.assetId,
      kind: kindLabel(asset),
      displayName: labels[asset.assetId] ?? `${asset.mediaKind} ${asset.assetId.slice(-6)}`,
      originalName: safeAssetDisplayName(source?.originalName) ?? null,
      durationTicks: asset.duration?.ticks ?? null,
      width: asset.width,
      height: asset.height,
      status,
      usageCount: assetUsage.count,
      usageKinds: assetUsage.kinds,
      canAddAsOverlay,
      canAddAsMusic,
      canRemove: false,
      removeBlockedReason: inUse
        ? 'This media is used in the project. Remove its timeline uses first.'
        : 'Removing unused media is not available yet. The source file remains safe.',
      previewSource: status === 'available' ? source?.url ?? null : null,
      thumbnailSource: status === 'available' && asset.mediaKind === 'image' ? source?.url ?? null : null,
    } satisfies MediaAssetView)
  }))

  return Object.freeze({
    assets,
    counts: Object.freeze({
      all: assets.length,
      video: assets.filter((asset) => asset.kind === 'video').length,
      image: assets.filter((asset) => asset.kind === 'image').length,
      audio: assets.filter((asset) => asset.kind === 'audio').length,
      missing: assets.filter((asset) => asset.status === 'missing').length,
    }),
  })
}

export const filterMediaAssets = (
  model: MediaBinViewModel,
  query: string,
  filter: MediaFilter,
): readonly MediaAssetView[] => {
  const needle = query.trim().toLocaleLowerCase().slice(0, 120)
  return Object.freeze(model.assets.filter((asset) => {
    const kindMatches = filter === 'all'
      || filter === 'missing' && asset.status === 'missing'
      || filter === asset.kind
    if (!kindMatches) return false
    if (!needle) return true
    return [asset.displayName, asset.originalName ?? '', asset.kind]
      .some((value) => value.toLocaleLowerCase().includes(needle))
  }))
}
