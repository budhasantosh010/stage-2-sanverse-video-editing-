import type { KeyboardEvent, MouseEvent } from 'react'
import { mediaDragSourceProps, type MediaAssetView } from '../../features/media'
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

/**
 * One row on the shelf. Three lines, always in the same places:
 *
 *   [thumb]  my-interview.mp4                      <- what it is called
 *            Video · 4:12                          <- what kind, how long
 *            1920×1080 · Used 2 times              <- how big, where it is used
 *
 * A fixed three-line shape rather than "show whatever this asset happens to
 * have" is what lets a person scan forty rows: the third line is ALWAYS the one
 * that says whether it is in the video, so the eye learns one place to look.
 * When a fact does not exist — a sound file has no resolution — the slot says
 * something true and short rather than collapsing and shifting the line below.
 *
 * Missing and selected are never signalled by colour alone: missing gets the
 * word "Missing media" and an underline, selected gets a border, an outline,
 * and `aria-selected`.
 */
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
  const visualSize = asset.width && asset.height
    ? `${asset.width}×${asset.height}`
    : asset.kind === 'audio' ? 'Sound only' : '—'
  const usage = asset.usageCount === 0 ? 'Unused' : `Used ${asset.usageCount} ${asset.usageCount === 1 ? 'time' : 'times'}`
  const state = asset.status === 'available'
    ? usage
    : asset.status === 'checking'
      ? 'Checking source'
      : asset.status === 'missing'
        ? 'Missing media'
        : 'Unsupported'
  const accessibleState = asset.status === 'available' ? usage : `${state}, ${usage}`

  return (
    <li
      role="option"
      aria-selected={selected}
      className={`media-bin__card${selected ? ' media-bin__card--selected' : ''}`}
      {...mediaDragSourceProps(asset)}
    >
      <button
        type="button"
        className="media-bin__card-select"
        data-asset-id={asset.assetId}
        data-status={asset.status}
        tabIndex={tabIndex}
        aria-label={`${asset.displayName}, ${kindName(asset.kind)}, ${accessibleState}`}
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
          <span>
            {visualSize} · <span className={`media-bin__status media-bin__status--${asset.status}`}>{state}</span>
            {/* When the source is in trouble, the third line says BOTH what is
                wrong and whether the video depends on it — losing "Used 2
                times" here is exactly the fact that decides how urgent it is. */}
            {asset.status === 'available' ? null : ` · ${usage}`}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="media-bin__card-actions"
        aria-label={`Actions for ${asset.displayName}`}
        aria-haspopup="menu"
        onClick={(event) => { event.stopPropagation(); onOpenMenu(event) }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
    </li>
  )
}
