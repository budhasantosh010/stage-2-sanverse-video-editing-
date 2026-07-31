import type { EditProject, MediaAsset } from '@sanverse/edit-domain'

const familyName = (asset: MediaAsset): string =>
  asset.mediaKind === 'video' ? 'Video' : asset.mediaKind === 'image' ? 'Image' : 'Audio'

export const safeAssetDisplayName = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null
  const last = value.split(/[\\/]/).at(-1) ?? ''
  const safe = last.replace(/[\x00-\x1f\x7f]/g, '').trim().replace(/\s+/g, ' ')
  if (!safe || safe === '.' || safe === '..') return null
  return safe.slice(0, 120)
}

export const deriveAssetDisplayLabels = (input: Readonly<{
  project: EditProject
  primaryDisplayName?: string | null
  originalNames?: Readonly<Record<string, string>>
}>): Readonly<Record<string, string>> => {
  const familyCounts = { video: 0, image: 0, audio: 0 }
  const candidates = input.project.assets.map((asset, index) => {
    familyCounts[asset.mediaKind] += 1
    const preferred = safeAssetDisplayName(input.originalNames?.[asset.assetId])
      ?? (index === 0 ? safeAssetDisplayName(input.primaryDisplayName) : null)
    return Object.freeze({
      asset,
      preferred,
      fallback: `${familyName(asset)} ${familyCounts[asset.mediaKind]}`,
    })
  })

  const duplicateCounts = new Map<string, number>()
  for (const candidate of candidates) {
    if (!candidate.preferred) continue
    const key = candidate.preferred.toLocaleLowerCase()
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1)
  }
  const duplicateIndexes = new Map<string, number>()
  const labels: Record<string, string> = {}
  for (const candidate of candidates) {
    if (!candidate.preferred) {
      labels[candidate.asset.assetId] = candidate.fallback
      continue
    }
    const key = candidate.preferred.toLocaleLowerCase()
    if ((duplicateCounts.get(key) ?? 0) === 1) {
      labels[candidate.asset.assetId] = candidate.preferred
      continue
    }
    const next = (duplicateIndexes.get(key) ?? 0) + 1
    duplicateIndexes.set(key, next)
    labels[candidate.asset.assetId] = `${candidate.preferred} (${next})`
  }
  return Object.freeze(labels)
}
