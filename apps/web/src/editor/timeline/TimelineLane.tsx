import {
  itemIntersectsVisibleRange,
  type TimelineGesture,
  type TimelineItemView,
  type TimelineLaneView,
  type TimelineViewportState,
  type VisibleTickRange,
} from '../../features/timeline'
import { TimelineItem } from './TimelineItem'
import type { TimelineSnapResult } from './timeline-snap'

export type TimelineLaneProps = Readonly<{
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

  return (
    <div
      className={`timeline-v1__lane timeline-v1__lane--${lane.kind}`}
      role="group"
      aria-label={`${lane.label} ${lane.kind} lane`}
      data-lane-id={lane.id}
      data-testid="timeline-lane"
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
