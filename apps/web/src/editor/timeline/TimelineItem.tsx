import { useCallback, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

import {
  ticksToPixels,
  type TimelineGesture,
  type TimelineItemAction,
  type TimelineItemView,
  type TimelineLaneKind,
} from '../../features/timeline'
import type { ClipDerivedMedia } from '../../features/media-analysis'
import { formatTimelineTime } from './timeline-ruler-model'
import type { TimelineSnapResult } from './timeline-snap'
import { TimelineTrimHandle } from './TimelineTrimHandle'
import { TimelineFilmstrip } from './TimelineFilmstrip'
import { TimelineWaveform } from './TimelineWaveform'

export type TimelineItemProps = Readonly<{
  item: TimelineItemView
  laneKind: TimelineLaneKind
  /** The pictures or sound shape this clip should draw. `none` means neither. */
  derivedMedia: ClipDerivedMedia
  /** How tall those are drawn, leaving room for the name and the handles. */
  decorationHeightPx: number
  /** A silenced track still shows its shape, drawn faintly. */
  muted: boolean
  timescale: number
  pixelsPerSecond: number
  busy: boolean
  pointerTicks(clientX: number): number
  pointerTime(clientX: number, excludedTicks?: readonly number[], bypassSnapping?: boolean): TimelineSnapResult
  onSnapGuide(ticks: number | null): void
  onSelect(itemId: string): void
  onSeek(ticks: number): void
  onGesture(gesture: TimelineGesture): void
  /** One whole gesture on something laid on top of the footage. */
  onItemAction(itemId: string, action: TimelineItemAction): void
  onOpenProposal(): void
  onContextMenu(item: TimelineItemView, clientX: number, clientY: number): void
}>

/**
 * Families that can be picked up and dragged along their lane.
 *
 * Pieces of the main recording are not among them: they sit end to end and
 * moving one means reordering, which is a different question with a different
 * answer. Titles and callouts are not either - they are edited in the panel on
 * the right, and a handle that moved and snapped back would be a lie.
 */
const DRAGGABLE_KINDS: readonly TimelineItemView['kind'][] = Object.freeze(['media-overlay', 'music'])

/** Below this the pointer has not really moved; it was a click, and a click selects. */
const DRAG_THRESHOLD_PX = 3

/**
 * The small word under a clip's name — and nothing at all when it would only
 * repeat what the user can already see.
 *
 * Every ordinary clip used to be labelled COMMITTED, in capitals, on the clip
 * itself. In a video made of eight clips that is the word COMMITTED eight
 * times, saying nothing: of course it is in the video, it is on the timeline.
 * Worse, it is our word, not the user's — "committed" is what an engineer calls
 * an edit that has been recorded, and a non-editor reading it has no idea
 * whether it is good news.
 *
 * The three states that ARE worth a word all mean something is different about
 * that clip, so those keep their label and now stand out because they are the
 * only ones wearing one.
 */
const itemStateLabel = (item: TimelineItemView): string | null => {
  if (item.state === 'proposed') return 'Proposed'
  if (item.state === 'blocked') return 'Needs attention'
  if (!item.enabled) return 'Hidden'
  return null
}

/**
 * The same thing for a screen reader, which cannot see that a clip sits on the
 * timeline and so does need telling. Plain words, never "committed".
 */
const itemStateForScreenReader = (item: TimelineItemView): string =>
  itemStateLabel(item) ?? 'in your video'

const itemAccessibleLabel = (item: TimelineItemView, timescale: number): string => {
  const kind = item.kind.replace('-', ' ')
  const start = formatTimelineTime(item.startTicks, timescale, true)
  const duration = formatTimelineTime(item.durationTicks, timescale, true)
  const detail = item.detail ? `, ${item.detail}` : ''
  return `${kind}, ${item.label}${detail}, starts ${start}, duration ${duration}, ${itemStateForScreenReader(item)}`
}

/** What the small mark in the corner says, when there is anything to say. */
const DECORATION_STATE_LABEL: Readonly<Record<string, string>> = Object.freeze({
  missing: 'File missing',
  error: 'No preview',
})

export function TimelineItem({
  item,
  laneKind,
  derivedMedia,
  decorationHeightPx,
  muted,
  timescale,
  pixelsPerSecond,
  busy,
  pointerTicks,
  pointerTime,
  onSnapGuide,
  onSelect,
  onSeek,
  onGesture,
  onItemAction,
  onOpenProposal,
  onContextMenu,
}: TimelineItemProps) {
  const [trimPreview, setTrimPreview] = useState<Readonly<{ edge: 'start' | 'end'; deltaTicks: number }> | null>(null)
  /**
   * Whether the pictures or the sound shape arrived.
   *
   * Held here rather than read from the controller so that a clip re-renders
   * once when its decoration state changes, instead of every clip re-rendering
   * every time any picture anywhere arrives.
   */
  const [decorationState, setDecorationState] = useState<'loading' | 'ready' | 'missing' | 'error' | 'none'>('none')
  const onDecorationState = useCallback(
    (next: 'loading' | 'ready' | 'missing' | 'error' | 'none') => {
      setDecorationState((current) => (current === next ? current : next))
    },
    [],
  )
  /**
   * The drag in progress.
   *
   * The bookkeeping lives in a ref because the pointer handlers read it many
   * times a second; only the part that is DRAWN lives in state. Neither ever
   * reaches the project: see `timeline-item-drag-session.ts` for why.
   */
  const dragRef = useRef<Readonly<{ pointerId: number; originClientX: number; moved: boolean }> | null>(null)
  const [dragOffsetTicks, setDragOffsetTicks] = useState<number | null>(null)
  const canonicalLeftPx = ticksToPixels(item.startTicks, timescale, pixelsPerSecond)
  const canonicalWidthPx = ticksToPixels(item.durationTicks, timescale, pixelsPerSecond)
  const previewStartTicks = trimPreview?.edge === 'start'
    ? item.startTicks + trimPreview.deltaTicks
    : item.startTicks
  const previewDurationTicks = trimPreview
    ? item.durationTicks - trimPreview.deltaTicks
    : item.durationTicks
  const leftPx = trimPreview?.edge === 'start'
    ? ticksToPixels(previewStartTicks, timescale, pixelsPerSecond)
    : canonicalLeftPx
  const widthPx = ticksToPixels(previewDurationTicks, timescale, pixelsPerSecond)
  const isOverlayFamily = DRAGGABLE_KINDS.includes(item.kind)
  const canTrim = item.state === 'committed' && item.selected
    && ((item.kind === 'clip' && item.clipId !== null) || isOverlayFamily)
  const canDragBody = isOverlayFamily && item.state === 'committed' && !busy

  const selectAndSeek = (event?: MouseEvent<HTMLButtonElement>) => {
    onSelect(item.id)
    if (event) {
      onSeek(pointerTicks(event.clientX))
    } else {
      onSeek(Math.min(
        item.startTicks + Math.max(1, Math.floor(item.durationTicks / 2)),
        item.startTicks + item.durationTicks - 1,
      ))
    }
    if (item.state === 'proposed') onOpenProposal()
  }

  /**
   * A drag decides ONE edit, when the pointer is released.
   *
   * Everything before that is a ghost. Escape and a cancelled pointer both end
   * the gesture and create nothing - there is nothing to undo, because nothing
   * was ever done.
   */
  const beginBodyDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!canDragBody || event.button !== 0) return
    dragRef.current = Object.freeze({ pointerId: event.pointerId, originClientX: event.clientX, moved: false })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveBodyDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const travelled = Math.abs(event.clientX - drag.originClientX)
    if (!drag.moved && travelled < DRAG_THRESHOLD_PX) return
    if (!drag.moved) dragRef.current = Object.freeze({ ...drag, moved: true })
    // Shift asks for the exact position under the pointer, ignoring snapping
    // for this one gesture. Per-gesture on purpose: a modifier that stayed on
    // would be a setting nobody remembers changing.
    const snapped = pointerTime(
      event.clientX,
      [item.startTicks, item.startTicks + item.durationTicks],
      event.shiftKey,
    )
    const nextStart = Math.max(0, snapped.ticks - Math.floor(item.durationTicks / 2))
    setDragOffsetTicks(nextStart - item.startTicks)
    onSnapGuide(snapped.snappedToTicks)
  }

  const endBodyDrag = (event: PointerEvent<HTMLButtonElement>, commit: boolean) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    onSnapGuide(null)
    const offset = dragOffsetTicks
    setDragOffsetTicks(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    // No movement is a click, and a click selects. No change is not an edit: a
    // change set that changes nothing still takes a revision and a slot in
    // Undo, which reads to the user as a broken button.
    if (!commit || !drag.moved || offset === null || offset === 0) return
    onItemAction(item.id, { type: 'move', toStartTicks: item.startTicks + offset })
  }

  const ghostLeftPx = dragOffsetTicks === null
    ? leftPx
    : ticksToPixels(Math.max(0, item.startTicks + dragOffsetTicks), timescale, pixelsPerSecond)

  return (
    <div
      className={[
        'timeline-v1__item-shell',
        trimPreview ? 'timeline-v1__item-shell--trimming' : '',
        dragOffsetTicks !== null ? 'timeline-v1__item-shell--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: `${ghostLeftPx}px`, width: `${Math.max(2, widthPx)}px` }}
      data-testid="timeline-item-shell"
      data-item-id={item.id}
      data-canonical-left={canonicalLeftPx}
      data-canonical-width={canonicalWidthPx}
    >
      <button
        type="button"
        className={[
          'timeline-v1__item',
          `timeline-v1__item--${item.kind}`,
          `timeline-v1__item--lane-${laneKind}`,
          `timeline-v1__item--${item.state}`,
          item.selected ? 'timeline-v1__item--selected' : '',
          item.enabled ? '' : 'timeline-v1__item--disabled',
          decorationState === 'loading' ? 'timeline-v1__item--loading-decoration' : '',
        ].filter(Boolean).join(' ')}
        data-decoration-state={decorationState}
        aria-label={itemAccessibleLabel(item, timescale)}
        aria-selected={item.selected}
        title={itemAccessibleLabel(item, timescale)}
        data-testid="timeline-item"
        data-state={item.state}
        data-kind={item.kind}
        data-lane-kind={laneKind}
        onClick={(event) => {
          // A drag that moved is not also a click. Selecting AND moving from
          // one gesture would put the Inspector on something that just moved.
          if (dragOffsetTicks !== null) return
          selectAndSeek(event)
        }}
        onPointerDown={beginBodyDrag}
        onPointerMove={moveBodyDrag}
        onPointerUp={(event) => endBodyDrag(event, true)}
        onPointerCancel={(event) => endBodyDrag(event, false)}
        onContextMenu={(event) => {
          event.preventDefault()
          onSelect(item.id)
          onContextMenu(item, event.clientX, event.clientY)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            selectAndSeek()
          }
          if (event.key === 'Escape' && dragRef.current) {
            // Escape during a drag cancels it and creates nothing.
            event.preventDefault()
            event.stopPropagation()
            dragRef.current = null
            setDragOffsetTicks(null)
            onSnapGuide(null)
            return
          }
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            onSelect(item.id)
            onContextMenu(item, rect.left + rect.width / 2, rect.top + rect.height / 2)
          }
        }}
      >
        {/*
          The pictures and the sound shape sit BEHIND the words and in front of
          the clip's own colour. They never take a click: see the note in
          `TimelineFilmstrip`.
        */}
        <TimelineFilmstrip
          media={derivedMedia}
          widthPx={Math.max(2, widthPx)}
          heightPx={decorationHeightPx}
          onStateChange={onDecorationState}
        />
        <TimelineWaveform
          media={derivedMedia}
          widthPx={Math.max(2, widthPx)}
          heightPx={decorationHeightPx}
          muted={muted}
          selected={item.selected}
          onStateChange={onDecorationState}
        />
        <span className="timeline-v1__item-label">{item.label}</span>
        {itemStateLabel(item) ? <span className="timeline-v1__item-state">{itemStateLabel(item)}</span> : null}
        {item.blockedReason ? <span className="timeline-v1__item-warning">Needs attention</span> : null}
        {/*
          A preview that could not be made is SAID, not left as a blank. A blank
          reads as a successful frame of black, which is a lie about the footage.
        */}
        {decorationState === 'missing' || decorationState === 'error' ? (
          <span className="timeline-v1__decoration-state" data-state={decorationState}>
            {DECORATION_STATE_LABEL[decorationState]}
          </span>
        ) : null}
      </button>

      {canTrim ? (
        <>
          <TimelineTrimHandle
            edge="start"
            disabled={busy}
            itemStartTicks={item.startTicks}
            itemDurationTicks={item.durationTicks}
            pointerTime={pointerTime}
            onSnapGuide={onSnapGuide}
            onPreview={(deltaTicks) => setTrimPreview(deltaTicks === null ? null : { edge: 'start', deltaTicks })}
            onCommit={(deltaTicks) => {
              if (isOverlayFamily) {
                onItemAction(item.id, { type: 'trim-start', toStartTicks: item.startTicks + deltaTicks })
                return
              }
              onGesture({ type: 'trim-start', clipId: item.clipId as string, deltaTicks })
            }}
          />
          <TimelineTrimHandle
            edge="end"
            disabled={busy}
            itemStartTicks={item.startTicks}
            itemDurationTicks={item.durationTicks}
            pointerTime={pointerTime}
            onSnapGuide={onSnapGuide}
            onPreview={(deltaTicks) => setTrimPreview(deltaTicks === null ? null : { edge: 'end', deltaTicks })}
            onCommit={(deltaTicks) => {
              if (isOverlayFamily) {
                onItemAction(item.id, {
                  type: 'trim-end',
                  toEndTicks: item.startTicks + item.durationTicks - deltaTicks,
                })
                return
              }
              onGesture({ type: 'trim-end', clipId: item.clipId as string, deltaTicks })
            }}
          />
        </>
      ) : null}

      {trimPreview ? (
        <output className="timeline-v1__trim-tooltip" aria-live="polite">
          Start {formatTimelineTime(previewStartTicks, timescale, true)} · Duration {formatTimelineTime(previewDurationTicks, timescale, true)}
        </output>
      ) : null}
    </div>
  )
}
