import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

import {
  ticksToPixels,
  type PrecisionTrimPlan,
  type PrecisionTrimRequestV1,
  type TimelineGesture,
  type TimelineItemAction,
  type TimelineItemView,
  type TimelineLaneKind,
  type TimelinePrecisionToolV1,
} from '../../features/timeline'
import type { AudioNormalizationRequestV1, ClipDerivedMedia } from '../../features/media-analysis'
import { formatTimelineTime } from './timeline-ruler-model'
import type { TimelineSnapResult } from './timeline-snap'
import { TimelineTrimHandle } from './TimelineTrimHandle'
import { TimelineFilmstrip } from './TimelineFilmstrip'
import { TimelineWaveform } from './TimelineWaveform'
import { TimelineRateStretchHandle, type RateStretchPreview } from './TimelineRateStretchHandle'
import type { TimelineTool } from './TimelineToolbar'
import { TimelinePrecisionHandle } from './TimelinePrecisionHandle'
import { TimelineAudioDirectControls, type TimelineAudioState } from './TimelineAudioDirectControls'
import type { TimelineBodyDragApi, TimelineBodyDragFeedback, TimelineBodyDragRequest } from '../../features/timeline/timeline-body-drag-plan'
import { dragEdgeScroll, dragTrackAt } from './timeline-drag-geometry'

type BodyPointer = Pick<PointerEvent<HTMLButtonElement>, 'pointerId' | 'clientX' | 'clientY' | 'shiftKey' | 'currentTarget'>

export type TimelineItemProps = Readonly<{
  item: TimelineItemView
  laneKind: TimelineLaneKind
  /** The pictures or sound shape this clip should draw. `none` means neither. */
  derivedMedia: ClipDerivedMedia
  /** How tall those are drawn, leaving room for the name and the handles. */
  decorationHeightPx: number
  /** A silenced track still shows its shape, drawn faintly. */
  muted: boolean
  waveformDisplayMode: 'combined' | 'separate'
  timescale: number
  pixelsPerSecond: number
  busy: boolean
  activeTool: TimelineTool
  primarySelected?: boolean
  /** Gapless primary footage may be reordered directly without inventing free-position timing. */
  primaryReorder?: Readonly<{ currentIndex: number; otherClipCenterTicks: readonly number[] }> | null
  laneLabel: string
  rateStretchActive: boolean
  frameTicks: number
  precisionTool: TimelinePrecisionToolV1
  onPrecisionPreview(request: PrecisionTrimRequestV1): PrecisionTrimPlan
  onPrecisionDraft(plan: PrecisionTrimPlan | null): void
  onPrecisionCommit(plan: Extract<PrecisionTrimPlan, { ok: true }>): void
  onRateStretchPreview(targetDurationTicks: number): RateStretchPreview
  onRateStretchCommit(targetDurationTicks: number): void
  normalization: Readonly<{ projectId: string; request: AudioNormalizationRequestV1 }> | null
  pointerTicks(clientX: number): number
  pointerTime(clientX: number, excludedTicks?: readonly number[], bypassSnapping?: boolean): TimelineSnapResult
  onSnapGuide(ticks: number | null): void
  /**
   * Picking this item, and which keys were held while doing it.
   *
   * The modifiers travel WITH the click rather than being read from somewhere
   * else, because "was Ctrl down" is only true for the instant of that press.
   * Reading it later would sometimes answer about a different key press.
   */
  onSelect(itemId: string, modifiers?: Readonly<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>): void
  animated?: boolean
  onAnimationBadgeClick?(): void
  onSeek(ticks: number): void
  onGesture(gesture: TimelineGesture): void
  /** One whole gesture on something laid on top of the footage. */
  onItemAction(itemId: string, action: TimelineItemAction): void
  bodyDrag?: TimelineBodyDragApi
  bodyDragFeedback?: TimelineBodyDragFeedback | null
  onBodyDragFeedback?(feedback: TimelineBodyDragFeedback | null): void
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
  // A screen reader hears the speed too. A badge only a sighted user can see
  // would make a retimed clip indistinguishable from a normal one by ear.
  const speed = item.speedBadge ? `, playing at ${item.speedBadge}` : ''
  return `${kind}, ${item.label}${detail}${speed}, starts ${start}, duration ${duration}, ${itemStateForScreenReader(item)}`
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
  waveformDisplayMode,
  timescale,
  pixelsPerSecond,
  busy,
  activeTool,
  primarySelected = false,
  primaryReorder = null,
  laneLabel,
  rateStretchActive,
  frameTicks,
  precisionTool,
  onPrecisionPreview,
  onPrecisionDraft = () => undefined,
  onPrecisionCommit,
  onRateStretchPreview,
  onRateStretchCommit,
  normalization,
  pointerTicks,
  pointerTime,
  onSnapGuide,
  onSelect,
  animated = false,
  onAnimationBadgeClick = () => undefined,
  onSeek,
  onGesture,
  onItemAction,
  bodyDrag,
  bodyDragFeedback,
  onBodyDragFeedback,
  onOpenProposal,
  onContextMenu,
}: TimelineItemProps) {
  const [trimPreview, setTrimPreview] = useState<Readonly<{ edge: 'start' | 'end'; deltaTicks: number }> | null>(null)
  const [precisionDraft, setPrecisionDraft] = useState<PrecisionTrimPlan | null>(null)
  const setPrecisionDraftPlan = (plan: PrecisionTrimPlan | null) => {
    setPrecisionDraft(plan)
    onPrecisionDraft(plan)
  }
  const [rateStretchDraft, setRateStretchDraft] = useState<Readonly<{
    targetDurationTicks: number
    preview: RateStretchPreview
  }> | null>(null)
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
  const dragRef = useRef<Readonly<{
    pointerId: number
    originClientX: number
    originClientY: number
    revision?: number
    grabOffsetTicks: number
    moved: boolean
    offsetTicks: number | null
    request?: TimelineBodyDragRequest
  }> | null>(null)
  const selectedOnPointerDownRef = useRef(false)
  const scrollFrameRef = useRef<number | null>(null)
  const scrollPointerRef = useRef<BodyPointer | null>(null)
  const scrollTimeRef = useRef<number | null>(null)
  const updateDragRef = useRef<(event: BodyPointer, startScroll?: boolean) => void>(() => undefined)
  const stopDragScroll = () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
    scrollFrameRef.current = null
    scrollPointerRef.current = null
    scrollTimeRef.current = null
  }
  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
  }, [])

  const panDragFrame = (now: number) => {
    scrollFrameRef.current = null
    const pointer = scrollPointerRef.current
    if (!pointer || !dragRef.current?.moved) return
    const port = pointer.currentTarget.closest<HTMLElement>('[data-timeline-viewport]')
    if (!port) return
    const step = dragEdgeScroll({ x: pointer.clientX, y: pointer.clientY }, port.getBoundingClientRect(), scrollTimeRef.current === null ? 16 : now - scrollTimeRef.current)
    scrollTimeRef.current = now
    if (step.x === 0 && step.y === 0) return
    const left = port.scrollLeft
    const top = port.scrollTop
    port.scrollLeft = Math.max(0, Math.min(port.scrollWidth - port.clientWidth, left + step.x))
    port.scrollTop = Math.max(0, Math.min(port.scrollHeight - port.clientHeight, top + step.y))
    if (left === port.scrollLeft && top === port.scrollTop) return
    // Recompute from the same pointer after scroll: the grabbed point stays under it.
    updateDragRef.current(pointer, false)
    scrollFrameRef.current = requestAnimationFrame(panDragFrame)
  }
  const suppressClickRef = useRef(false)
  const [dragOffsetTicks, setDragOffsetTicks] = useState<number | null>(null)
  const [dragSnappingBypassed, setDragSnappingBypassed] = useState(false)
  const canonicalLeftPx = ticksToPixels(item.startTicks, timescale, pixelsPerSecond)
  const canonicalWidthPx = ticksToPixels(item.durationTicks, timescale, pixelsPerSecond)
  const successfulPrecision = precisionDraft?.ok ? precisionDraft : null
  const previewStartTicks = successfulPrecision
    ? successfulPrecision.feedback.selectedStartTicks
    : trimPreview?.edge === 'start'
      ? item.startTicks + trimPreview.deltaTicks
      : item.startTicks
  const previewDurationTicks = rateStretchDraft
    ? rateStretchDraft.targetDurationTicks
    : successfulPrecision
      ? successfulPrecision.feedback.selectedDurationTicks
      : trimPreview
        ? item.durationTicks - trimPreview.deltaTicks
        : item.durationTicks
  const leftPx = successfulPrecision || trimPreview?.edge === 'start'
    ? ticksToPixels(previewStartTicks, timescale, pixelsPerSecond)
    : canonicalLeftPx
  const widthPx = ticksToPixels(previewDurationTicks, timescale, pixelsPerSecond)
  const isOverlayFamily = DRAGGABLE_KINDS.includes(item.kind)
  const isPrimaryPrecisionTarget = item.state === 'committed' && item.selected && laneKind === 'video'
    && item.kind === 'clip' && item.clipId !== null
  const canPrecisionEdge = isPrimaryPrecisionTarget
    && (precisionTool === 'standard-trim' || precisionTool === 'ripple-trim')
  const canPrecisionBody = isPrimaryPrecisionTarget
    && (precisionTool === 'slip' || precisionTool === 'slide')
  const canTrim = !rateStretchActive && item.state === 'committed' && item.selected && isOverlayFamily
  const canRateStretch = rateStretchActive
    && item.state === 'committed'
    && item.selected
    && item.kind === 'clip'
    && item.clipId !== null
  const canDirectAudio = item.state === 'committed'
    && item.selected
    && (laneKind === 'dialogue' || laneKind === 'music')
    && item.gainDb !== null
    && item.fadeInTicks !== null
    && item.fadeOutTicks !== null
    && (laneKind === 'music' || item.pan !== null)
  const canReorderPrimary = activeTool === 'select'
    && primaryReorder !== null
    && item.kind === 'clip'
    && laneKind === 'video'
    && item.state === 'committed'
    && !busy
  const canDragBody = activeTool === 'select'
    && (isOverlayFamily || canReorderPrimary || (bodyDrag !== undefined && item.kind === 'clip'))
    && item.state === 'committed'
    && !busy
  const canRazorSplit = activeTool === 'razor'
    && item.state === 'committed'
    && item.kind !== 'gap'
    && !busy

  const selectAndSeek = (event?: MouseEvent<HTMLButtonElement>) => {
    const modifiers = event
      ? { ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey }
      : undefined
    onSelect(item.id, modifiers)
    // Adding something to a selection must NOT move the playhead. The user is
    // building up a group of things to act on; jumping the picture about while
    // they do it makes them lose their place in their own video.
    if (modifiers && (modifiers.ctrlKey || modifiers.metaKey || modifiers.shiftKey)) return
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
    selectedOnPointerDownRef.current = false
    suppressClickRef.current = false
    if (event.button !== 0) return
    /*
     * Pick non-draggable items on the press,
     * before a late filmstrip or waveform can replace content under the
     * pointer and make the browser cancel the following click. That exact
     * race made the first real click after opening Studio appear dead while
     * Enter still worked.
     */
    if (!canDragBody && !canRazorSplit) {
      const modifiers = {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      }
      const selectedOnPress = !item.selected || modifiers.ctrlKey || modifiers.metaKey || modifiers.shiftKey
      if (selectedOnPress) onSelect(item.id, modifiers)
      if (!modifiers.ctrlKey && !modifiers.metaKey && !modifiers.shiftKey) {
        onSeek(pointerTicks(event.clientX))
      }
      if (item.state === 'proposed') onOpenProposal()
      selectedOnPointerDownRef.current = selectedOnPress
      return
    }
    if (!canDragBody) return
    if (canDragBody) {
      const modifiers = {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      }
      const selectedOnPress = !item.selected || modifiers.ctrlKey || modifiers.metaKey || modifiers.shiftKey
      if (selectedOnPress) onSelect(item.id, modifiers)
      // Preserve the group during a drag, but let a plain click focus the
      // selected member (for example linked audio) in the Inspector.
      selectedOnPointerDownRef.current = selectedOnPress
    }
    dragRef.current = Object.freeze({
      pointerId: event.pointerId,
      originClientX: event.clientX,
      originClientY: event.clientY || 0,
      revision: bodyDrag?.revision,
      grabOffsetTicks: pointerTicks(event.clientX) - item.startTicks,
      moved: false,
      offsetTicks: null,
    })
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveBodyDrag = (event: BodyPointer, startScroll = true) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const travelled = Math.hypot(event.clientX - drag.originClientX, (event.clientY || 0) - drag.originClientY)
    if (!drag.moved && travelled < DRAG_THRESHOLD_PX) return
    if (!drag.moved) dragRef.current = Object.freeze({ ...drag, moved: true })
    // Shift asks for the exact position under the pointer, ignoring snapping
    // for this one gesture. Per-gesture on purpose: a modifier that stayed on
    // would be a setting nobody remembers changing.
    // Move the grabbed point with the pointer, not the clip's centre. Snap
    // the resulting leading edge so the shown guide equals the landed edge.
    const leadingEdgeClientX = event.clientX - ticksToPixels(drag.grabOffsetTicks, timescale, pixelsPerSecond)
    const snapped = canReorderPrimary && !bodyDrag
      ? Object.freeze({ ticks: pointerTicks(leadingEdgeClientX), snappedToTicks: null })
      : pointerTime(
          leadingEdgeClientX,
          [item.startTicks, item.startTicks + item.durationTicks],
          event.shiftKey,
        )
    const nextStart = Math.max(0, snapped.ticks)
    const offsetTicks = nextStart - item.startTicks
    let request: TimelineBodyDragRequest | undefined
    if (bodyDrag) {
      const viewport = event.currentTarget.closest('[data-timeline-viewport]')
      const lanes = Array.from(viewport?.querySelectorAll<HTMLElement>('[data-body-track-id]') ?? [])
      const destinationTrackId = viewport ? dragTrackAt(
        { x: event.clientX, y: event.clientY },
        viewport.getBoundingClientRect(),
        lanes.map(lane => {
          const { left, right, top, bottom } = lane.getBoundingClientRect()
          return { left, right, top, bottom, trackId: lane.dataset.bodyTrackId! }
        }),
      ) : null
      const hoveredLane = lanes.find(lane => lane.dataset.bodyTrackId === destinationTrackId)
      request = { itemId: item.id, destinationTrackId: destinationTrackId ?? '', toStartTicks: nextStart, revision: drag.revision }
      const plan = destinationTrackId ? bodyDrag.preview(request) : { ok: false as const, refusal: { code: 'DROP_OUTSIDE', message: 'Release over a timeline track, or release here to cancel.' } }
      const sourceLane = event.currentTarget.closest('[data-body-track-id]')
      const deltaY = hoveredLane && sourceLane ? hoveredLane.getBoundingClientRect().top - sourceLane.getBoundingClientRect().top : 0
      onBodyDragFeedback?.({ itemId: item.id, linkedClipId: item.clipId ?? item.linkedClipId, deltaTicks: offsetTicks, deltaY, plan })
    }
    dragRef.current = Object.freeze({ ...(dragRef.current ?? drag), moved: true, offsetTicks, request })
    setDragOffsetTicks(offsetTicks)
    setDragSnappingBypassed(event.shiftKey)
    onSnapGuide(snapped.snappedToTicks)
    if (startScroll && bodyDrag) {
      scrollPointerRef.current = { currentTarget: event.currentTarget, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey }
      if (scrollFrameRef.current === null) scrollFrameRef.current = requestAnimationFrame(panDragFrame)
    }
  }
  updateDragRef.current = moveBodyDrag

  const endBodyDrag = (event: PointerEvent<HTMLButtonElement>, commit: boolean) => {
    stopDragScroll()
    // A release can arrive beyond the last move event (including outside the
    // viewport). Commit the actual release position, never a stale valid lane.
    if (commit && bodyDrag && dragRef.current?.moved) moveBodyDrag(event, false)
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    onSnapGuide(null)
    const offset = drag.offsetTicks
    suppressClickRef.current = drag.moved
    const clear = () => {
      setDragOffsetTicks(null)
      setDragSnappingBypassed(false)
      onBodyDragFeedback?.(null)
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    // No movement is a click, and a click selects. No change is not an edit: a
    // change set that changes nothing still takes a revision and a slot in
    // Undo, which reads to the user as a broken button.
    if (!commit || !drag.moved || offset === null) {
      if (commit && !drag.moved && !event.ctrlKey && !event.metaKey && !event.shiftKey) onSeek(pointerTicks(event.clientX))
      clear()
      return
    }
    if (bodyDrag && drag.request) {
      if (!drag.request.destinationTrackId) { clear(); return }
      void Promise.resolve(bodyDrag.commit(drag.request)).finally(clear)
      return
    }
    clear()
    if (offset === 0) return
    if (canReorderPrimary && primaryReorder && item.clipId) {
      const draggedCenterTicks = item.startTicks + Math.floor(item.durationTicks / 2) + offset
      const toIndex = primaryReorder.otherClipCenterTicks
        .filter((centerTicks) => centerTicks < draggedCenterTicks)
        .length
      if (toIndex !== primaryReorder.currentIndex) {
        onGesture({ type: 'move-to-index', clipId: item.clipId, toIndex })
      }
      return
    }
    onItemAction(item.id, { type: 'move', toStartTicks: item.startTicks + offset })
  }

  const ghostLeftPx = dragOffsetTicks === null
    ? leftPx
    : ticksToPixels(Math.max(0, item.startTicks + dragOffsetTicks), timescale, pixelsPerSecond)
  const linkedId = item.clipId ?? item.linkedClipId
  const sharedGhost = bodyDragFeedback && (bodyDragFeedback.itemId === item.id || (linkedId !== null && bodyDragFeedback.linkedClipId === linkedId) || (item.selected && bodyDrag?.selectedItemIds?.includes(bodyDragFeedback.itemId))) ? bodyDragFeedback : null
  const ghostY = sharedGhost?.itemId === item.id ? sharedGhost.deltaY : 0
  const ghostX = sharedGhost ? ticksToPixels(sharedGhost.deltaTicks, timescale, pixelsPerSecond) : 0

  return (
    <div
      className={[
        'timeline-v1__item-shell',
        trimPreview ? 'timeline-v1__item-shell--trimming' : '',
        rateStretchDraft ? 'timeline-v1__item-shell--rate-stretching' : '',
        dragOffsetTicks !== null || sharedGhost ? 'timeline-v1__item-shell--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: `${sharedGhost ? leftPx : ghostLeftPx}px`, width: `${Math.max(2, widthPx)}px`, transform: sharedGhost ? `translate3d(${ghostX}px, ${ghostY}px, 0)` : undefined }}
      data-drag-valid={sharedGhost ? String(sharedGhost.plan.ok) : undefined}
      data-testid="timeline-item-shell"
      data-item-id={item.id}
      data-primary-selected={primarySelected ? 'yes' : 'no'}
      data-active-tool={activeTool}
      data-primary-reorder={canReorderPrimary ? 'yes' : 'no'}
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
        data-timeline-item-id={item.id}
        data-state={item.state}
        data-kind={item.kind}
        data-lane-kind={laneKind}
        data-body-draggable={canDragBody ? 'true' : undefined}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            selectedOnPointerDownRef.current = false
            return
          }
          if (selectedOnPointerDownRef.current) {
            selectedOnPointerDownRef.current = false
            return
          }
          // A drag that moved is not also a click. Selecting AND moving from
          // one gesture would put the Inspector on something that just moved.
          if (dragOffsetTicks !== null) return
          if (canRazorSplit) {
            const atTicks = pointerTicks(event.clientX)
            const endTicks = item.startTicks + item.durationTicks
            onSelect(item.id)
            onSeek(atTicks)
            if (atTicks <= item.startTicks || atTicks >= endTicks) return
            if (item.kind === 'clip') onGesture({ type: 'split', atTicks })
            else onItemAction(item.id, { type: 'split', atTicks })
            return
          }
          selectAndSeek(event)
        }}
        onPointerDown={beginBodyDrag}
        onPointerMove={moveBodyDrag}
        onPointerUp={(event) => endBodyDrag(event, true)}
        onPointerCancel={(event) => {
          selectedOnPointerDownRef.current = false
          endBodyDrag(event, false)
        }}
        onLostPointerCapture={(event) => {
          if (dragRef.current) endBodyDrag(event, false)
        }}
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
            stopDragScroll()
            dragRef.current = null
            setDragOffsetTicks(null)
            setDragSnappingBypassed(false)
            onBodyDragFeedback?.(null)
            suppressClickRef.current = true
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
          heightPx={Math.max(2, decorationHeightPx - 12)}
          muted={muted}
          channelDisplayMode={waveformDisplayMode}
          selected={item.selected}
          onStateChange={onDecorationState}
        />
        <span className="timeline-v1__item-label">{item.label}</span>
        {/*
          The speed badge. Drawn only when the piece has actually been retimed,
          because it sits over the filmstrip and every badge hides frames the
          user is using to find their place. `aria-hidden` because the same
          words are already inside the button's spoken label above, and hearing
          them twice is worse than not hearing them at all.
        */}
        {item.speedBadge ? (
          <span className="timeline-v1__item-speed" aria-hidden="true" data-timeline-speed-badge={item.speedBadge}>
            {item.speedBadge}
          </span>
        ) : null}
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

      {animated ? (
        <button
          type="button"
          className="timeline-v1__animation-badge"
          aria-label={`Show animation for ${item.label}`}
          title="Show animation"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(item.id)
            onAnimationBadgeClick()
          }}
        >
          <span aria-hidden="true">◇</span>
        </button>
      ) : null}

      {canRateStretch ? (
        <TimelineRateStretchHandle
          itemStartTicks={item.startTicks}
          itemDurationTicks={item.durationTicks}
          disabled={busy}
          pointerTime={pointerTime}
          previewFor={onRateStretchPreview}
          onSnapGuide={onSnapGuide}
          onDraft={(targetDurationTicks, preview) => {
            setRateStretchDraft(targetDurationTicks === null || preview === null
              ? null
              : Object.freeze({ targetDurationTicks, preview }))
          }}
          onCommit={onRateStretchCommit}
        />
      ) : null}

      {canPrecisionEdge ? (
        <>
          <TimelinePrecisionHandle
            kind="edge"
            edge="start"
            label={`${precisionTool === 'ripple-trim' ? 'Ripple trim' : 'Trim'} start`}
            disabled={busy}
            itemStartTicks={item.startTicks}
            itemDurationTicks={item.durationTicks}
            frameTicks={frameTicks}
            pointerTicks={pointerTicks}
            pointerTime={pointerTime}
            requestForDelta={(deltaTicks) => Object.freeze({
              mode: precisionTool as 'standard-trim' | 'ripple-trim',
              clipId: item.clipId as string,
              edge: 'start' as const,
              deltaTicks,
            })}
            previewFor={onPrecisionPreview}
            onSnapGuide={onSnapGuide}
            onDraft={setPrecisionDraftPlan}
            onCommit={onPrecisionCommit}
          />
          <TimelinePrecisionHandle
            kind="edge"
            edge="end"
            label={`${precisionTool === 'ripple-trim' ? 'Ripple trim' : 'Trim'} end`}
            disabled={busy}
            itemStartTicks={item.startTicks}
            itemDurationTicks={item.durationTicks}
            frameTicks={frameTicks}
            pointerTicks={pointerTicks}
            pointerTime={pointerTime}
            requestForDelta={(deltaTicks) => Object.freeze({
              mode: precisionTool as 'standard-trim' | 'ripple-trim',
              clipId: item.clipId as string,
              edge: 'end' as const,
              deltaTicks,
            })}
            previewFor={onPrecisionPreview}
            onSnapGuide={onSnapGuide}
            onDraft={setPrecisionDraftPlan}
            onCommit={onPrecisionCommit}
          />
        </>
      ) : null}

      {canPrecisionBody ? (
        <TimelinePrecisionHandle
          kind="body"
          label={precisionTool === 'slip' ? 'Slip source' : 'Slide clip'}
          disabled={busy}
          itemStartTicks={item.startTicks}
          itemDurationTicks={item.durationTicks}
          frameTicks={frameTicks}
          pointerTicks={pointerTicks}
          pointerTime={pointerTime}
          requestForDelta={(deltaTicks) => Object.freeze({
            mode: precisionTool as 'slip' | 'slide',
            clipId: item.clipId as string,
            deltaTicks,
          })}
          previewFor={onPrecisionPreview}
          onSnapGuide={onSnapGuide}
          onDraft={setPrecisionDraftPlan}
          onCommit={onPrecisionCommit}
        />
      ) : null}

      {canDirectAudio ? (
        <TimelineAudioDirectControls
          accepted={Object.freeze({
            gainDb: item.gainDb as number,
            fadeInTicks: item.fadeInTicks as number,
            fadeOutTicks: item.fadeOutTicks as number,
            pan: item.pan ?? 0,
          })}
          durationTicks={item.durationTicks}
          disabled={busy}
          muted={muted || !item.enabled}
          supportsPan={laneKind === 'dialogue'}
          normalization={normalization}
          onCommit={(next: TimelineAudioState) => {
            if (laneKind === 'dialogue' && item.linkedClipId !== null) {
              onGesture({
                type: 'set-audio',
                clipId: item.linkedClipId,
                gainDb: next.gainDb,
                fadeInTicks: next.fadeInTicks,
                fadeOutTicks: next.fadeOutTicks,
                pan: next.pan,
              })
              return
            }
            if (laneKind === 'music') {
              onItemAction(item.id, {
                type: 'set-audio',
                gainDb: next.gainDb,
                fadeInTicks: next.fadeInTicks,
                fadeOutTicks: next.fadeOutTicks,
              })
            }
          }}
        />
      ) : null}

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

      {dragOffsetTicks !== null ? (
        <output className="timeline-v1__drag-tooltip" aria-live="polite" data-testid="timeline-drag-tooltip">
          {sharedGhost ? sharedGhost.plan.ok ? `${sharedGhost.plan.description} · ${formatTimelineTime(sharedGhost.plan.landingStartTicks, timescale, true)}` : sharedGhost.plan.refusal.message : `${laneLabel} · ${formatTimelineTime(Math.max(0, item.startTicks + dragOffsetTicks), timescale, true)} · Move`}{dragSnappingBypassed ? ' · Snapping off' : ''}
        </output>
      ) : null}
      {trimPreview ? (
        <output className="timeline-v1__trim-tooltip" aria-live="polite">
          Start {formatTimelineTime(previewStartTicks, timescale, true)} · Duration {formatTimelineTime(previewDurationTicks, timescale, true)}
        </output>
      ) : null}
      {precisionDraft ? (
        <output
          className={`timeline-v1__trim-tooltip timeline-v1__precision-tooltip${precisionDraft.ok ? '' : ' timeline-v1__precision-tooltip--refused'}`}
          aria-live="polite"
          data-precision-trim-state={precisionDraft.ok ? 'valid' : 'refused'}
        >
          {precisionDraft.ok
            ? `${precisionDraft.description} · Δ ${formatTimelineTime(Math.abs(precisionDraft.feedback.appliedDeltaTicks), timescale, true)}${precisionDraft.feedback.appliedDeltaTicks < 0 ? ' earlier/shorter' : ' later/longer'}`
            : precisionDraft.refusal.message}
        </output>
      ) : null}
      {rateStretchDraft ? (
        <output className={`timeline-v1__trim-tooltip timeline-v1__rate-stretch-tooltip${rateStretchDraft.preview.ok ? '' : ' timeline-v1__rate-stretch-tooltip--refused'}`} aria-live="polite">
          {rateStretchDraft.preview.message}
        </output>
      ) : null}
    </div>
  )
}
