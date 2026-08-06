import {
  itemIntersectsVisibleRange,
  type TimelineGesture,
  type TimelineItemAction,
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
import {
  clipDerivedMedia,
  derivedMediaClipFor,
  type AssetFacts,
  type AudioNormalizationRequestV1,
  type ClipDerivedMedia,
} from '../../features/media-analysis'
import { TimelineItem } from './TimelineItem'
import { decorationHeightPx, laneDensity, laneHeightPx } from './timeline-lane-metrics'
import type { TimelineSnapResult } from './timeline-snap'
import type { RateStretchPreview } from './TimelineRateStretchHandle'

const NO_MEDIA: ClipDerivedMedia = Object.freeze({ kind: 'none' as const })

export type TimelineLaneProps = Readonly<{
  projectId: string
  /** What each file is and which bytes it holds. Never a path, never a URL. */
  assetFacts: Readonly<Record<string, AssetFacts>>
  /** True when this row has been silenced, so its shape is drawn faintly. */
  muted: boolean
  /** How wide the window is, which decides how tall rows are. */
  layoutWidthPx: number
  /** The height the user chose for this row, if they chose one. */
  heightPx?: number
  /** True while a box is being dragged, so an empty-space click is not also fired. */
  marqueeActive?: boolean
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
  rateStretchActive: boolean
  onRateStretchPreview(targetDurationTicks: number): RateStretchPreview
  onRateStretchCommit(targetDurationTicks: number): void
  pointerTicks(clientX: number): number
  pointerTime(clientX: number, excludedTicks?: readonly number[], bypassSnapping?: boolean): TimelineSnapResult
  onSnapGuide(ticks: number | null): void
  onSelect(itemId: string, modifiers?: Readonly<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>): void
  onClearSelection(): void
  onSeek(ticks: number): void
  onGesture(gesture: TimelineGesture): void
  onItemAction(itemId: string, action: TimelineItemAction): void
  onOpenProposal(): void
  onContextMenu(item: TimelineItemView, clientX: number, clientY: number): void
}>

export function TimelineLane({
  lane,
  projectId,
  assetFacts,
  muted,
  layoutWidthPx,
  heightPx,
  marqueeActive,
  dragPreview,
  onMediaDrop,
  timescale,
  viewport,
  visibleRange,
  overscanTicks,
  busy,
  rateStretchActive,
  onRateStretchPreview,
  onRateStretchCommit,
  pointerTicks,
  pointerTime,
  onSnapGuide,
  onSelect,
  onClearSelection,
  onSeek,
  onGesture,
  onItemAction,
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

  // How much detail this row has room for, decided ONCE for the row rather than
  // by each clip, so two clips in the same row can never disagree about it.
  const density = laneDensity(lane.kind, layoutWidthPx)
  // The height the user asked for, if they asked for one; otherwise the height
  // the window width decides. A row folded away is a thin strip, not zero: a
  // row that vanished could not be found again to unfold it.
  const rowHeightPx = heightPx ?? laneHeightPx(lane.kind, layoutWidthPx)
  const decorationPx = decorationHeightPx(lane.kind, layoutWidthPx)

  const mediaFor = (item: TimelineItemView): ClipDerivedMedia => {
    const clip = derivedMediaClipFor(item, lane.kind, assetFacts)
    if (clip === null) return NO_MEDIA
    // The SAME pure function the timeline uses to build its shopping list. One
    // function, two callers: the list and the drawing can never disagree.
    return clipDerivedMedia({
      clip,
      timescale,
      pixelsPerSecond: viewport.pixelsPerSecond,
      density,
    })
  }

  const normalizationFor = (
    item: TimelineItemView,
  ): Readonly<{ projectId: string; request: AudioNormalizationRequestV1 }> | null => {
    if (
      (lane.kind !== 'dialogue' && lane.kind !== 'music') ||
      item.assetId === null ||
      item.sourceStartTicks === null ||
      item.sourceDurationTicks === null ||
      item.sourceDurationTicks <= 0
    ) return null
    const facts = assetFacts[item.assetId]
    if (!facts?.hasAudio) return null
    return Object.freeze({
      projectId,
      request: Object.freeze({
        assetId: item.assetId,
        assetVersion: facts.assetVersion,
        sourceStartTicks: item.sourceStartTicks,
        sourceEndTicks: item.sourceStartTicks + item.sourceDurationTicks,
      }),
    })
  }

  return (
    <div
      className={`timeline-v1__lane timeline-v1__lane--${lane.kind}`}
      role="group"
      aria-label={`${lane.label} ${lane.kind} lane`}
      data-lane-id={lane.id}
      data-testid="timeline-lane"
      data-lane-density={density}
      style={{ ['--timeline-lane-height' as string]: `${rowHeightPx}px` }}
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
        // A drag that drew a box is not also a click on empty space. Without
        // this, letting go of a marquee would immediately clear what it caught.
        if (marqueeActive) return
        onClearSelection()
        onSeek(pointerTicks(event.clientX))
      }}
    >
      {visibleItems.map((item) => (
        <TimelineItem
          key={item.id}
          item={item}
          laneKind={lane.kind}
          derivedMedia={mediaFor(item)}
          decorationHeightPx={decorationPx}
          muted={muted}
          timescale={timescale}
          pixelsPerSecond={viewport.pixelsPerSecond}
          busy={busy}
          rateStretchActive={rateStretchActive}
          onRateStretchPreview={onRateStretchPreview}
          onRateStretchCommit={onRateStretchCommit}
          normalization={normalizationFor(item)}
          pointerTicks={pointerTicks}
          pointerTime={pointerTime}
          onSnapGuide={onSnapGuide}
          onSelect={onSelect}
          onSeek={onSeek}
          onGesture={onGesture}
          onItemAction={onItemAction}
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
