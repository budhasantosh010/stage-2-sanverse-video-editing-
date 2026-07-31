import { useEffect, useRef } from 'react'
import type { MediaAssetView } from '../../features/media'

export function MediaContextMenu({
  asset,
  busy,
  onAddAsBroll,
  onAddAsMusic,
  onClose,
}: Readonly<{
  asset: MediaAssetView
  busy: boolean
  onAddAsBroll(): void
  onAddAsMusic(): void
  onClose(): void
}>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
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
      {asset.previewSource ? <a role="menuitem" href={asset.previewSource} target="_blank" rel="noreferrer">Preview media</a> : null}
      <button role="menuitem" type="button" disabled title={asset.removeBlockedReason ?? undefined}>Remove</button>
      <button role="menuitem" type="button" onClick={onClose}>Close menu</button>
    </div>
  )
}
