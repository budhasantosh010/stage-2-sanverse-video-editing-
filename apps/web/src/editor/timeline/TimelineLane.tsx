import {
  itemIntersectsVisibleRange,
  type TimelineGesture,
  type TimelineItemView,
  type TimelineLaneView,
  type TimelineViewportState,
  type VisibleTickRange,
} from '../../features/timeline'
import {
  MEDIA_DRAG_MIME,
  parseMediaDragPayload,
  type MediaDragKind,
  type MediaDragPayloadV1,
} from '../../features/media'
import { acceptsMediaKind } from '../../features/timeline'
import { TimelineItem } from './TimelineItem'
import type { TimelineSnapResult } from './timeline-snap'

export type TimelineLaneProps = Readonly<{
  /** The drag in flight, so a lane can say yes or no before the user lets go. */
  dragPreview?: MediaDragPayloadV1 | null
  /** Absent while media drag is switched off, which removes the drop target entirely. */
  onMediaDrop?: ((laneId: string, assetId: string, atTicks: number) => void) | null
  lane: TimelineLaneView
  timescale: number
  viewport: TimelineViewportState
  visibleRange: VisibleTickRange
  overscanTicks: number
  busy: boolean
  pointerTicks(clientX: number): number
  pointerTime(clientX: number, excludedTicks?: readonly number[]): TimelineSnapResult
  onSnapGuide(ticks: number | null): void
  onSelect(itemId: string): void
  onClearSelection(): void
  onSeek(ticks: number): void
  onGesture(gesture: TimelineGesture): void
  onOpenProposal(): void
  onContextMenu(item: TimelineItemView, clientX: number, clientY: number): void
}>

export function TimelineLane({
  lane,
  dragPreview,
  onMediaDrop,
  timescale,
  viewport,
  visibleRange,
  overscanTicks,
  busy,
  pointerTicks,
  pointerTime,
  onSnapGuide,
  onSelect,
  onClearSelection,
  onSeek,
  onGesture,
  onOpenProposal,
  onContextMenu,
}: TimelineLaneProps) {
  const start = Math.max(0, visibleRange.startTicks - overscanTicks)
  const end = visibleRange.endTicks + overscanTicks
  const visibleItems = lane.items.filter((item) =>
    item.selected || itemIntersectsVisibleRange({
      itemStartTicks: item.startTicks,
      itemDurationTicks: item.durationTicks,
      visibleStartTicks: start,
      visibleEndTicks: end,
    }),
  )

  /**
   * Whether a drop here would be accepted, asked BEFORE the user lets go.
   *
   * The planner answers, so the highlight and the outcome are the same
   * decision. A lane that lit up green and then refused would be the product
   * changing its mind after the user had committed to the gesture.
   */
  const dragKind = dragPreview?.mediaKind ?? null
  const accepts = dragKind !== null && acceptsMediaKind(lane.id, dragKind)

  return (
    <div
      className={`timeline-v1__lane timeline-v1__lane--${lane.kind}`}
      role="group"
      aria-label={`${lane.label} ${lane.kind} lane`}
      data-lane-id={lane.id}
      data-testid="timeline-lane"
      data-drop-target={dragKind === null ? undefined : accepts ? 'accepts' : 'refuses'}
      onDragOver={(event) => {
        if (!onMediaDrop || dragKind === null) return
        // Claiming the drop is what stops the browser from opening the file,
        // so it must happen even on a lane that will refuse — otherwise
        // letting go over V1 would navigate away from the editor.
        event.preventDefault()
        event.dataTransfer.dropEffect = accepts ? 'copy' : 'none'
      }}
      onDrop={(event) => {
        if (!onMediaDrop) return
        event.preventDefault()
        const payload = parseMediaDragPayload(event.dataTransfer.getData(MEDIA_DRAG_MIME))
        if (!payload) return
        onMediaDrop(lane.id, payload.assetId, pointerTicks(event.clientX))
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        onClearSelection()
        onSeek(pointerTicks(event.clientX))
      }}
    >
      {visibleItems.map((item) => (
        <TimelineItem
          key={item.id}
          item={item}
          laneKind={lane.kind}
          timescale={timescale}
          pixelsPerSecond={viewport.pixelsPerSecond}
          busy={busy}
          pointerTicks={pointerTicks}
          pointerTime={pointerTime}
          onSnapGuide={onSnapGuide}
          onSelect={onSelect}
          onSeek={onSeek}
          onGesture={onGesture}
          onOpenProposal={onOpenProposal}
          onContextMenu={onContextMenu}
        />
      ))}
      {lane.items.length === 0 ? (
        <span className="timeline-v1__lane-empty" style={{ left: `${viewport.scrollLeftPx + 12}px` }}>Empty</span>
      ) : null}
    </div>
  )
}
