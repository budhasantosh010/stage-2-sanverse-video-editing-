import type { MediaAssetView } from './media-contract'

/**
 * How the Media list is ordered on screen.
 *
 * Sorting is PRESENTATION. It answers "what order do I want to look at these
 * in", which is a question about the person looking, not about the video. So it
 * creates no edit, no revision, no history entry, and no render change — the
 * exported MP4 is byte-identical whichever order the shelf is in.
 *
 * This lives in a pure function on purpose: the whole guarantee above is easy
 * to state and easy to break, and a pure function over a list is something a
 * test can hold still and prove.
 */

export const MEDIA_SORT_FIELDS = Object.freeze(['added', 'name', 'type', 'duration'] as const)
export type MediaSortField = (typeof MEDIA_SORT_FIELDS)[number]

export const MEDIA_SORT_DIRECTIONS = Object.freeze(['ascending', 'descending'] as const)
export type MediaSortDirection = (typeof MEDIA_SORT_DIRECTIONS)[number]

export const MEDIA_SORT_LABELS: Readonly<Record<MediaSortField, string>> = Object.freeze({
  added: 'Date added',
  name: 'Name',
  type: 'Type',
  duration: 'Duration',
})

/** Plain words for the direction, which change meaning with the field. */
export const mediaSortDirectionLabel = (field: MediaSortField, direction: MediaSortDirection): string => {
  const ascending = direction === 'ascending'
  if (field === 'added') return ascending ? 'Oldest first' : 'Newest first'
  if (field === 'duration') return ascending ? 'Shortest first' : 'Longest first'
  return ascending ? 'A to Z' : 'Z to A'
}

/** Kinds get a fixed order so "Type" means the same thing every time. */
const KIND_RANK: Readonly<Record<MediaAssetView['kind'], number>> = Object.freeze({
  video: 0,
  image: 1,
  audio: 2,
  unknown: 3,
})

/**
 * A still picture has no duration. It is ordered as -1 rather than as 0 or as
 * "last", so it holds ONE fixed place in the ordering and simply swaps ends
 * when the direction flips — the same as every other value. Treating it as a
 * special case that always sinks to the bottom would mean reversing the sort
 * did not actually reverse the list, which is the kind of small lie that makes
 * a user stop trusting a control.
 */
const durationOf = (asset: MediaAssetView): number => asset.durationTicks ?? -1

const compareOn = (
  field: MediaSortField,
  a: MediaAssetView,
  b: MediaAssetView,
  positionOf: (asset: MediaAssetView) => number,
): number => {
  if (field === 'name') return a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' })
  if (field === 'type') return KIND_RANK[a.kind] - KIND_RANK[b.kind]
  if (field === 'duration') return durationOf(a) - durationOf(b)
  // 'added' is the order the project already holds them in. It is a real
  // comparison, not a no-op, so that "Newest first" genuinely reverses.
  return positionOf(a) - positionOf(b)
}

/**
 * Order a list of assets without ever moving equal items about.
 *
 * The tie-break is the asset's position in the project — the order they were
 * added — and it is applied ASCENDING regardless of direction. That is what
 * makes the result stable: two clips with the same name, or three pictures that
 * all have no duration, keep the same relative order every single render.
 * Without it, re-sorting a list can visibly reshuffle rows that did not change,
 * and the user reasonably concludes something happened to their media.
 */
export const sortMediaAssets = (
  assets: readonly MediaAssetView[],
  field: MediaSortField,
  direction: MediaSortDirection,
): readonly MediaAssetView[] => {
  const originalIndex = new Map(assets.map((asset, index) => [asset.assetId, index]))
  const positionOf = (asset: MediaAssetView): number => originalIndex.get(asset.assetId) ?? 0
  const sign = direction === 'ascending' ? 1 : -1
  return Object.freeze([...assets].sort((a, b) => {
    const primary = compareOn(field, a, b, positionOf)
    if (primary !== 0) return primary * sign
    return positionOf(a) - positionOf(b)
  }))
}
