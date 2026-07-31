import type { KeyboardEvent, MouseEvent } from 'react'
import type { MediaAssetView } from '../../features/media'
import { MediaAssetThumbnail } from './MediaAssetThumbnail'

const kindName = (kind: MediaAssetView['kind']): string =>
  kind === 'video' ? 'Video' : kind === 'image' ? 'Image' : kind === 'audio' ? 'Audio' : 'Unknown'

const duration = (ticks: number | null): string => {
  if (ticks === null) return 'Still image'
  const seconds = ticks / 1_440_000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} sec`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
}

export function MediaAssetCard({
  asset,
  selected,
  tabIndex,
  onSelect,
  onOpenMenu,
  onKeyDown,
}: Readonly<{
  asset: MediaAssetView
  selected: boolean
  tabIndex: number
  onSelect(): void
  onOpenMenu(event: MouseEvent<HTMLButtonElement>): void
  onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void
}>) {
  const visualSize = asset.width && asset.height ? `${asset.width}×${asset.height}` : null
  const usage = asset.usageCount === 0 ? 'Unused' : `Used ${asset.usageCount} ${asset.usageCount === 1 ? 'time' : 'times'}`
  const status = asset.status === 'available'
    ? usage
    : asset.status === 'checking'
      ? 'Checking source'
      : asset.status === 'missing'
        ? 'Missing media'
        : 'Unsupported'
  const accessibleStatus = asset.status === 'available' ? usage : `${status}, ${usage}`
  return (
    <li role="option" aria-selected={selected} className={`media-bin__card${selected ? ' media-bin__card--selected' : ''}`}>
      <button
        type="button"
        className="media-bin__card-select"
        data-asset-id={asset.assetId}
        tabIndex={tabIndex}
        aria-label={`${asset.displayName}, ${kindName(asset.kind)}, ${accessibleStatus}`}
        onClick={onSelect}
        onContextMenu={(event) => { event.preventDefault(); onOpenMenu(event) }}
        onKeyDown={(event) => {
          if (event.shiftKey && event.key === 'F10') {
            event.preventDefault()
            onOpenMenu(event as unknown as MouseEvent<HTMLButtonElement>)
            return
          }
          onKeyDown(event)
        }}
      >
        <span className="media-bin__thumbnail"><MediaAssetThumbnail asset={asset} /></span>
        <span className="media-bin__card-copy">
          <strong title={asset.displayName}>{asset.displayName}</strong>
          <span>{kindName(asset.kind)} · {duration(asset.durationTicks)}</span>
          {visualSize ? <span>{visualSize}</span> : null}
          <span className={`media-bin__status media-bin__status--${asset.status}`}>{status}</span>
          {asset.status !== 'available' ? <span>{usage}</span> : null}
        </span>
      </button>
    </li>
  )
}
