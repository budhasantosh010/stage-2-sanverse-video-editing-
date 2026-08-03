import type { DragEvent } from 'react'
import type { MediaAssetView } from './media-contract'
import {
  createMediaDragPayload,
  MEDIA_DRAG_ENABLED,
  MEDIA_DRAG_MIME,
  serializeMediaDragPayload,
} from './media-drag-contract'

/**
 * Everything an asset row needs in order to BE a drag source, prepared now and
 * switched on in Gate C.
 *
 * The flag is not timidity. A drag gesture is a promise: press, move, and
 * something will accept it. Until the Timeline can accept a drop, that promise
 * cannot be kept, and a gesture that starts and dies is read by the user as a
 * broken product — worse than a product that simply does not offer it yet.
 *
 * So while `MEDIA_DRAG_ENABLED` is false this returns NOTHING: no `draggable`
 * attribute, no handler, no `aria-grabbed`. A screen reader is not told about a
 * capability that does not exist, and a mouse user gets no drag cursor.
 *
 * The contract, the serializer and this adapter are all tested regardless, so
 * Gate C flips one boolean rather than writing this under time pressure.
 */

export type MediaDragSourceProps = Readonly<{
  draggable?: true
  onDragStart?(event: DragEvent<HTMLElement>): void
}>

/** Empty object = an ordinary, undraggable row. */
const NOT_DRAGGABLE: MediaDragSourceProps = Object.freeze({})

export const mediaDragSourceProps = (
  asset: MediaAssetView,
  enabled: boolean = MEDIA_DRAG_ENABLED,
): MediaDragSourceProps => {
  if (!enabled) return NOT_DRAGGABLE
  const payload = createMediaDragPayload({
    assetId: asset.assetId,
    mediaKind: asset.kind,
    sourceDurationTicks: asset.durationTicks,
  })
  // Media whose local file is missing cannot be placed, so it cannot be dragged.
  if (payload === null || asset.status !== 'available') return NOT_DRAGGABLE
  return Object.freeze({
    draggable: true as const,
    onDragStart(event: DragEvent<HTMLElement>) {
      // `copy` and not `move`: the asset stays on the shelf. Dragging it to the
      // timeline places a use of it, it does not take it away.
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData(MEDIA_DRAG_MIME, serializeMediaDragPayload(payload))
    },
  })
}
