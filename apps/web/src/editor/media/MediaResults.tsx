import { useRef, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react'
import type { MediaAssetView } from '../../features/media'
import { MediaAssetCard } from './MediaAssetCard'

/**
 * The only part of the Media panel that scrolls.
 *
 * That is a deliberate structural decision, not a styling one. If the whole
 * panel scrolled, then scrolling down to row thirty would carry Import, Search
 * and Filter off the top of the screen — so the moment a user has enough media
 * to need to scroll is exactly the moment the tools for coping with a lot of
 * media become unreachable. Header and toolbar are pinned; only the list moves.
 *
 * This region is also the drop target for files dragged in from the operating
 * system. It is the results area and not the whole panel so that a file
 * released over the Import button, or over the search box, still lands
 * somewhere sensible rather than being swallowed by an invisible full-panel
 * catcher.
 */
export function MediaResults({
  assets,
  totalAssets,
  selectedAssetId,
  dropActive,
  onSelect,
  onOpenMenu,
  onKeyDown,
  onShowAll,
  onDropFiles,
  onDropActiveChange,
}: Readonly<{
  assets: readonly MediaAssetView[]
  totalAssets: number
  selectedAssetId: string | null
  dropActive: boolean
  onSelect(assetId: string): void
  onOpenMenu(assetId: string, event: MouseEvent<HTMLButtonElement>): void
  onKeyDown(event: KeyboardEvent<HTMLButtonElement>, assetId: string): void
  onShowAll(): void
  onDropFiles(files: readonly File[]): void
  onDropActiveChange(active: boolean): void
}>) {
  // Drag enter/leave fire for every child element the pointer crosses. Counting
  // them is what stops the highlight flickering off as the pointer moves over a
  // row inside the very region it is being dragged across.
  const dragDepth = useRef(0)

  const endDrag = () => {
    dragDepth.current = 0
    onDropActiveChange(false)
  }

  /**
   * Is this an OS FILE drag, as opposed to something dragged from inside the
   * app? A real browser always lists 'Files' in `types` for a file drag, and
   * will list the Sanverse media type for a row drag once Gate C enables one —
   * so this is what keeps a future timeline drag from being mistaken for an
   * import. Where `types` is absent, fall back to whether files actually came.
   */
  const isFileDrag = (event: DragEvent<HTMLElement>): boolean => {
    const transfer = event.dataTransfer as DataTransfer | undefined
    if (!transfer) return false
    if (transfer.types) return [...transfer.types].includes('Files')
    return (transfer.files?.length ?? 0) > 0
  }

  return (
    <div
      className={`media-bin__results${dropActive ? ' media-bin__results--drop-active' : ''}`}
      data-testid="media-results"
      onDragEnter={(event) => {
        if (!isFileDrag(event)) return
        event.preventDefault()
        dragDepth.current += 1
        onDropActiveChange(true)
      }}
      onDragOver={(event) => {
        if (!isFileDrag(event)) return
        // Preventing default is what tells the browser a drop is allowed here.
        // Without it the browser navigates away to the dropped file instead.
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(event) => {
        if (!isFileDrag(event)) return
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) onDropActiveChange(false)
      }}
      onDrop={(event) => {
        if (!isFileDrag(event)) return
        event.preventDefault()
        endDrag()
        onDropFiles(Object.freeze([...event.dataTransfer.files]))
      }}
    >
      {dropActive ? (
        <p className="media-bin__drop-message" role="status">Drop files to add them to this project</p>
      ) : null}

      {totalAssets === 0 ? (
        <div className="media-bin__empty">
          <strong>No media yet</strong>
          <p>Import a video, image, or audio file, or drag one in from your computer.</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="media-bin__empty">
          <strong>No matching media</strong>
          <p>Nothing here matches the search, the filter, or the folder you are in.</p>
          <button type="button" onClick={onShowAll}>Show all media</button>
        </div>
      ) : (
        <ul className="media-bin__list" role="listbox" aria-label="Project media assets">
          {assets.map((asset, index) => (
            <MediaAssetCard
              key={asset.assetId}
              asset={asset}
              selected={asset.assetId === selectedAssetId}
              tabIndex={asset.assetId === selectedAssetId || (selectedAssetId === null && index === 0) ? 0 : -1}
              onSelect={() => onSelect(asset.assetId)}
              onOpenMenu={(event) => onOpenMenu(asset.assetId, event)}
              onKeyDown={(event) => onKeyDown(event, asset.assetId)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
