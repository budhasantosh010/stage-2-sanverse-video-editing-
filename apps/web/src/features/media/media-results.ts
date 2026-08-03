import { folderOfAsset, type MediaOrganizationV1 } from '@sanverse/edit-domain/media-organization'
import type { MediaAssetView, MediaBinViewModel } from './media-contract'
import type { MediaPresentationState } from './media-presentation'
import { sortMediaAssets } from './media-sort'
import { filterMediaAssets } from './media-view-model'

/**
 * Turn "everything in the project" into "the rows on screen right now".
 *
 * The order of the four steps is deliberate and is the whole reason this is one
 * function instead of four calls scattered through a component:
 *
 *   1. folder    which shelf am I looking at
 *   2. kind      video / picture / sound / missing
 *   3. words     the search box
 *   4. order     sort, last, so it orders only what survived
 *
 * Sorting first and filtering afterwards would give the same list, but the
 * result count shown to the user would be computed against a different set
 * depending on where the count was read — the classic way two numbers on the
 * same screen come to disagree.
 */

export type MediaResults = Readonly<{
  /** Rows to draw, already ordered. */
  visible: readonly MediaAssetView[]
  /** How many assets are in the chosen folder before kind and words narrow it. */
  inFolder: number
}>

export const selectMediaResults = (
  model: MediaBinViewModel,
  presentation: MediaPresentationState,
  organization: MediaOrganizationV1,
): MediaResults => {
  const inFolder = presentation.folderId === null
    ? model.assets
    : model.assets.filter((asset) => folderOfAsset(organization, asset.assetId) === presentation.folderId)

  const narrowed = filterMediaAssets(
    Object.freeze({ ...model, assets: inFolder }),
    presentation.query,
    presentation.filter,
  )

  return Object.freeze({
    visible: sortMediaAssets(narrowed, presentation.sortField, presentation.sortDirection),
    inFolder: inFolder.length,
  })
}

/** How many assets sit in each folder, plus how many are still at the root. */
export const mediaFolderCounts = (
  model: MediaBinViewModel,
  organization: MediaOrganizationV1,
): Readonly<{ root: number; byFolder: Readonly<Record<string, number>> }> => {
  const byFolder: Record<string, number> = {}
  let root = 0
  for (const asset of model.assets) {
    const folderId = folderOfAsset(organization, asset.assetId)
    if (folderId === null) root += 1
    else byFolder[folderId] = (byFolder[folderId] ?? 0) + 1
  }
  return Object.freeze({ root, byFolder: Object.freeze(byFolder) })
}
