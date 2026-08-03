import { useEffect, useRef } from 'react'
import type { MediaFolderV1 } from '@sanverse/edit-domain/media-organization'
import type { MediaAssetView } from '../../features/media'

/**
 * The actions for ONE asset.
 *
 * Every entry here does something real today. There is no greyed-out "Delete"
 * teaching the user that half this product does not work — media deletion does
 * not exist yet, so it is not listed. The single exception is "Remove", which is
 * kept visible and disabled WITH its reason attached, because the user can
 * already see the media is in their video and needs to be told why it cannot go.
 *
 * Focus is captured on open and handed back to whatever opened it on close, so
 * a keyboard user does not lose their place in a list of forty rows.
 */
export function MediaContextMenu({
  asset,
  folders,
  currentFolderId,
  busy,
  organizationPending,
  onAddAsBroll,
  onAddAsMusic,
  onMoveToFolder,
  onMoveToRoot,
  onShowSource,
  onClose,
}: Readonly<{
  asset: MediaAssetView
  folders: readonly MediaFolderV1[]
  currentFolderId: string | null
  busy: boolean
  organizationPending: boolean
  onAddAsBroll(): void
  onAddAsMusic(): void
  onMoveToFolder(folderId: string): void
  onMoveToRoot(): void
  onShowSource(): void
  onClose(): void
}>) {
  const ref = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)

  useEffect(() => {
    openerRef.current = document.activeElement
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('keydown', close)
      const opener = openerRef.current
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [onClose])

  return (
    <div ref={ref} className="media-bin__context-menu" role="menu" aria-label={`${asset.displayName} actions`}>
      {asset.kind === 'video' || asset.kind === 'image' ? (
        <button role="menuitem" type="button" disabled={busy || !asset.canAddAsOverlay} onClick={onAddAsBroll}>
          {asset.kind === 'video' ? 'Add as B-roll' : 'Add at playhead'}
        </button>
      ) : null}
      {asset.kind === 'audio' ? (
        <button role="menuitem" type="button" disabled={busy || !asset.canAddAsMusic} onClick={onAddAsMusic}>Add as music</button>
      ) : null}

      {folders.length > 0 || currentFolderId !== null ? <hr /> : null}
      {folders
        .filter((folder) => folder.folderId !== currentFolderId)
        .map((folder) => (
          <button
            key={folder.folderId}
            role="menuitem"
            type="button"
            disabled={organizationPending}
            onClick={() => onMoveToFolder(folder.folderId)}
          >
            Move to “{folder.name}”
          </button>
        ))}
      {currentFolderId !== null ? (
        <button role="menuitem" type="button" disabled={organizationPending} onClick={onMoveToRoot}>
          Move to All media
        </button>
      ) : null}

      <hr />
      <button role="menuitem" type="button" onClick={onShowSource}>Source information</button>
      {asset.previewSource
        ? <a role="menuitem" href={asset.previewSource} target="_blank" rel="noreferrer">Open media</a>
        : null}
      <button role="menuitem" type="button" disabled title={asset.removeBlockedReason ?? undefined}>Remove</button>
      <button role="menuitem" type="button" onClick={onClose}>Close menu</button>
    </div>
  )
}
