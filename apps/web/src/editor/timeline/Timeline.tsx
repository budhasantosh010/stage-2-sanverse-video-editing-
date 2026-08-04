import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type WheelEvent } from 'react'

import type { TimelineTrackId, TrackOutputState } from '@sanverse/edit-domain'
import {
  fitTimelineToViewport,
  timelineContentWidthPx,
  ticksToPixels,
  trackIdForLane,
  visibleTickRange,
  zoomTimelineAtAnchor,
  type PlacementMode,
  type TimelineGesture,
  type TimelineItemAction,
  type TimelineItemView,
  type TimelineViewModel,
  type TimelineViewportState,
} from '../../features/timeline'
import type { MediaDragPayloadV1 } from '../../features/media'
import { TimelineContextActions } from './TimelineContextActions'
import { TimelineContextMenu } from './TimelineContextMenu'
import { TimelineLane } from './TimelineLane'
import { TimelinePlayhead } from './TimelinePlayhead'
import { TimelineRuler } from './TimelineRuler'
import { TimelineTrackHeader } from './TimelineTrackHeader'
import { timelinePointerToTicks } from './timeline-ruler-model'
import { snapTimelineTicks, timelineSnapCandidates, type TimelineSnapResult } from './timeline-snap'
import { TimelineToolbar, type TimelineToolbarAction } from './TimelineToolbar'
import './Timeline.css'

export type TimelineProps = Readonly<{
  model: TimelineViewModel
  playheadTicks: number
  viewport: TimelineViewportState
  selectedItemId: string | null
  busy: boolean
  trimAmountTicks: number
  gainDb: number
  fadeInTicks: number
  fadeOutTicks: number
  advancedControls: ReactNode
  /** The media drag in flight, so lanes can show whether they will take it. */
  dragPreview?: MediaDragPayloadV1 | null
  /** Absent while media drag is switched off, which removes the drop target. */
  onMediaDrop?: ((laneId: string, assetId: string, atTicks: number) => void) | null
  /** Padlocks. Presentation state: they never change the finished video. */
  lockedTrackIds: readonly string[]
  /** Which tracks reach the finished video. Part of the project; one Undo each. */
  trackOutputs: TrackOutputState
  placementMode: PlacementMode
  snappingEnabled: boolean
  onToggleTrackLock(trackId: TimelineTrackId): void
  onToggleTrackOutput(trackId: TimelineTrackId): void
  onPlacementMode(mode: PlacementMode): void
  onToggleSnapping(): void
  /** One whole gesture on one item. Never called while a pointer is moving. */
  onItemAction(itemId: string, action: TimelineItemAction): void
  onViewportChange(viewport: TimelineViewportState): void
  onSeek(ticks: number): void
  onSelect(itemId: string | null): void
  onGesture(gesture: TimelineGesture): void
  onOpenProposal(): void
}>

/**
 * Whether a key press belongs to something the user is typing into.
 *
 * If this is wrong, typing the letter "s" into a caption or into the chat box
 * splits the video instead of writing a letter. So it names every kind of field
 * the app has, including the ones marked as such by the components that own
 * them, rather than only the three obvious HTML tags.
 */
const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return target.matches(
    'input, textarea, select, [contenteditable="true"], [data-text-entry], [role="textbox"], [role="combobox"]',
  )
}

/** One frame at 30 per second, in ticks. Used by the arrow keys. */
const FRAME_TICKS = 48_000

export function Timeline({
  model,
  playheadTicks,
  viewport,
  selectedItemId,
  busy,
  trimAmountTicks,
  gainDb,
  fadeInTicks,
  fadeOutTicks,
  advancedControls,
  dragPreview,
  onMediaDrop,
  lockedTrackIds,
  trackOutputs,
  placementMode,
  snappingEnabled,
  onToggleTrackLock,
  onToggleTrackOutput,
  onPlacementMode,
  onToggleSnapping,
  onItemAction,
  onViewportChange,
  onSeek,
  onSelect,
  onGesture,
  onOpenProposal,
}: TimelineProps) {
  const timelineRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const advancedDetailsRef = useRef<HTMLDetailsElement>(null)
  const [snapGuideTicks, setSnapGuideTicks] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<Readonly<{ itemId: string; x: number; y: number }> | null>(null)

  const allItems = useMemo(() => model.lanes.flatMap((lane) => lane.items), [model])
  const selectedItem = useMemo<TimelineItemView | null>(() => {
    if (!selectedItemId) return null
    return allItems.find((item) => item.id === selectedItemId) ?? null
  }, [allItems, selectedItemId])
  const contextItem = contextMenu
    ? allItems.find((item) => item.id === contextMenu.itemId) ?? null
    : null
  const snapCandidates = useMemo(() => timelineSnapCandidates({
    durationTicks: model.durationTicks,
    itemRanges: allItems,
  }), [allItems, model.durationTicks])

  const contentWidthPx = Math.max(
    viewport.viewportWidthPx,
    timelineContentWidthPx(model.durationTicks, model.timescale, viewport.pixelsPerSecond),
  )
  const visibleRange = visibleTickRange({ viewport, durationTicks: model.durationTicks, timescale: model.timescale })
  const overscanTicks = Math.max(1, Math.ceil((viewport.viewportWidthPx / viewport.pixelsPerSecond) * model.timescale))
  const playheadLeftPx = ticksToPixels(
    Math.min(model.durationTicks, Math.max(0, playheadTicks)),
    model.timescale,
    viewport.pixelsPerSecond,
  )

  const pointerTicks = (clientX: number): number => {
    const element = viewportRef.current
    if (!element) return 0
    return timelinePointerToTicks({
      clientX,
      viewportLeftPx: element.getBoundingClientRect().left,
      scrollLeftPx: element.scrollLeft,
      pixelsPerSecond: viewport.pixelsPerSecond,
      timescale: model.timescale,
      durationTicks: model.durationTicks,
    })
  }

  /**
   * Where the pointer is, after snapping — unless snapping is switched off, or
   * the user is holding Shift to ignore it for one gesture.
   *
   * The result is still a whole tick. Snapping never rounds canonical state to
   * whole pixels: a clip that landed on a pixel boundary would sit a fraction
   * of a frame away from the edge the user aimed at, and the export would show
   * it even though the screen did not.
   */
  const pointerTime = (
    clientX: number,
    excludedTicks: readonly number[] = [],
    bypassSnapping = false,
  ): TimelineSnapResult =>
    snapTimelineTicks({
      ticks: pointerTicks(clientX),
      candidateTicks: snappingEnabled && !bypassSnapping ? snapCandidates : [],
      excludedTicks,
      durationTicks: model.durationTicks,
      timescale: model.timescale,
      pixelsPerSecond: viewport.pixelsPerSecond,
    })

  /**
   * Why each toolbar action cannot be used right now, in words.
   *
   * Worked out once, here, so the button, its tooltip, its screen-reader label
   * and the keyboard shortcut all agree. A greyed-out button with no reason is
   * the product refusing to explain itself.
   */
  const selectedTrackId = selectedItem ? trackIdForLane(selectedItem.laneId) : null
  const selectedLocked = selectedTrackId !== null && lockedTrackIds.includes(selectedTrackId)
  const playheadInsideSelection = selectedItem !== null
    && playheadTicks > selectedItem.startTicks
    && playheadTicks < selectedItem.startTicks + selectedItem.durationTicks

  const disabledReasons: Readonly<Record<TimelineToolbarAction, string | null>> = {
    split: !selectedItem
      ? 'Choose something on the timeline first.'
      : selectedLocked
        ? `${selectedTrackId} is locked. Unlock it to change anything on it.`
        : !playheadInsideSelection
          ? 'Move the playhead inside the selected item first.'
          : null,
    lift: !selectedItem
      ? 'Choose something on the timeline first.'
      : selectedLocked
        ? `${selectedTrackId} is locked. Unlock it to change anything on it.`
        : null,
    'ripple-delete': !selectedItem
      ? 'Choose something on the timeline first.'
      : selectedLocked
        ? `${selectedTrackId} is locked. Unlock it to change anything on it.`
        : selectedItem.laneId === 'lane:overlay'
          // Closing the gap would re-pin every later clip to earlier footage,
          // which moves them onto different moments of the recording.
          ? 'B-roll is pinned to a moment of your footage, so closing the gap would move later clips. Use Delete.'
          : null,
  }

  /**
   * Do the thing, on whichever family the selected item belongs to.
   *
   * Pieces of the main recording go through the gesture adapter, which already
   * knows how cutting works and has done since Gate A. Everything laid on top —
   * B-roll, pictures, music — goes through the item planner. Two families, two
   * authorities, one button: the alternative was two Delete buttons that looked
   * identical and behaved differently.
   */
  const runToolbarAction = (action: TimelineToolbarAction) => {
    if (!selectedItem || disabledReasons[action] !== null || busy) return
    const isPrimaryFootage = selectedItem.kind === 'clip'

    if (action === 'split') {
      if (isPrimaryFootage) onGesture({ type: 'split', atTicks: playheadTicks })
      else onItemAction(selectedItem.id, { type: 'split', atTicks: playheadTicks })
      return
    }
    if (isPrimaryFootage) {
      onGesture({
        type: action === 'ripple-delete' ? 'remove-ripple' : 'remove-gap',
        atTicks: Math.max(selectedItem.startTicks, Math.min(
          playheadTicks,
          selectedItem.startTicks + selectedItem.durationTicks - 1,
        )),
      })
      return
    }
    onItemAction(selectedItem.id, { type: 'delete', ripple: action === 'ripple-delete' })
  }

  const openContextMenu = (item: TimelineItemView, clientX: number, clientY: number) => {
    const root = timelineRef.current
    if (!root) return
    const rect = root.getBoundingClientRect()
    setContextMenu(Object.freeze({
      itemId: item.id,
      x: Math.min(Math.max(8, clientX - rect.left), Math.max(8, rect.width - 230)),
      y: Math.min(Math.max(8, clientY - rect.top), Math.max(8, rect.height - 250)),
    }))
  }

  useEffect(() => {
    const element = viewportRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const width = Math.max(0, element.clientWidth)
      if (Math.abs(width - viewport.viewportWidthPx) < 0.5) return
      onViewportChange({ ...viewport, viewportWidthPx: width })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [onViewportChange, viewport])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    if (Math.abs(element.scrollLeft - viewport.scrollLeftPx) > 0.5) {
      element.scrollLeft = viewport.scrollLeftPx
    }
  }, [viewport.scrollLeftPx])

  useEffect(() => {
    if (contextMenu && !contextItem) setContextMenu(null)
  }, [contextItem, contextMenu])

  const changeZoom = (nextPixelsPerSecond: number, anchorViewportX?: number) => {
    const anchor = anchorViewportX ?? Math.min(
      viewport.viewportWidthPx,
      Math.max(0, playheadLeftPx - viewport.scrollLeftPx),
    )
    onViewportChange(zoomTimelineAtAnchor({
      viewport,
      nextPixelsPerSecond,
      anchorViewportX: Number.isFinite(anchor) ? anchor : viewport.viewportWidthPx / 2,
      durationTicks: model.durationTicks,
      timescale: model.timescale,
    }))
  }

  const fit = () => {
    setContextMenu(null)
    onViewportChange({
      pixelsPerSecond: fitTimelineToViewport({
        durationTicks: model.durationTicks,
        timescale: model.timescale,
        viewportWidthPx: viewport.viewportWidthPx,
        horizontalPaddingPx: 20,
      }),
      scrollLeftPx: 0,
      viewportWidthPx: viewport.viewportWidthPx,
    })
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      const factor = Math.exp(-event.deltaY * 0.002)
      changeZoom(viewport.pixelsPerSecond * factor, event.clientX - rect.left)
      return
    }
    if (event.shiftKey && Math.abs(event.deltaY) > 0) {
      event.preventDefault()
      event.currentTarget.scrollLeft += event.deltaY
    }
  }

  /**
   * The keyboard.
   *
   * ## The one deliberate change from before
   *
   * Plain `S` used to mean Split. It now means Snapping, and Split is
   * `Ctrl/Cmd+B`. Two meanings for one key is the kind of thing that makes a
   * user distrust their own hands, and every other editor on the planet uses
   * Ctrl+B for a cut, so the surprise is smaller this way round.
   *
   * Nothing here fires while the user is typing — see `isTypingTarget`.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isTypingTarget(event.target)) return
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey
    const command = event.ctrlKey || event.metaKey

    if (event.key === 'Escape') {
      event.preventDefault()
      // In order: cancel what is happening, then close what is open, then let
      // go of what is chosen. Escape never creates anything and never undoes.
      if (contextMenu) setContextMenu(null)
      else onSelect(null)
      return
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!selectedItem || busy) return
      event.preventDefault()
      runToolbarAction(event.shiftKey ? 'ripple-delete' : 'lift')
      return
    }

    if (command && event.key.toLowerCase() === 'b') {
      event.preventDefault()
      runToolbarAction('split')
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      onSeek(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      onSeek(model.durationTicks)
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      event.preventDefault()
      if (event.altKey && selectedItem && !busy) {
        // Alt nudges the selected item; without it the playhead steps.
        onItemAction(selectedItem.id, {
          type: 'move',
          toStartTicks: Math.max(0, selectedItem.startTicks + direction * FRAME_TICKS),
        })
        return
      }
      onSeek(Math.min(model.durationTicks, Math.max(0, playheadTicks + direction * FRAME_TICKS)))
      return
    }

    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      changeZoom(viewport.pixelsPerSecond * 1.25)
      return
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      changeZoom(viewport.pixelsPerSecond / 1.25)
      return
    }

    if (plain && event.key.toLowerCase() === 's') {
      event.preventDefault()
      onToggleSnapping()
      return
    }
    if (plain && event.key.toLowerCase() === 'v') {
      // The Select tool is the only tool, so this confirms rather than switches.
      // It exists because every editor has it and reaching for it must not
      // silently do something else.
      event.preventDefault()
    }
  }

  return (
    <section
      ref={timelineRef}
      className="timeline-v1"
      aria-label="Project timeline"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (!(event.target as HTMLElement).closest('.timeline-v1__context-menu')) setContextMenu(null)
      }}
      data-project-revision={model.projectRevision}
      data-testid="timeline-v1"
    >
      <TimelineToolbar
        durationTicks={model.durationTicks}
        timescale={model.timescale}
        viewport={viewport}
        selectedSummary={selectedItem ? `${selectedItem.label} · ${selectedItem.kind}` : null}
        disabledReasons={disabledReasons}
        snappingEnabled={snappingEnabled}
        placementMode={placementMode}
        busy={busy}
        onAction={runToolbarAction}
        onToggleSnapping={onToggleSnapping}
        onPlacementMode={onPlacementMode}
        onZoomOut={() => changeZoom(viewport.pixelsPerSecond / 1.25)}
        onZoomIn={() => changeZoom(viewport.pixelsPerSecond * 1.25)}
        onFit={fit}
      />

      <div className="timeline-v1__viewport-grid">
        {/*
          The track headers are real controls, so this column can no longer be
          hidden from screen readers the way a decorative label column was.
        */}
        <div className="timeline-v1__headers">
          <div className="timeline-v1__ruler-header" aria-hidden="true">Time</div>
          {model.lanes.map((lane) => {
            const trackId = trackIdForLane(lane.id)
            return (
              <TimelineTrackHeader
                key={lane.id}
                trackId={trackId}
                label={lane.label}
                kind={lane.kind}
                locked={lockedTrackIds.includes(trackId)}
                outputEnabled={trackOutputs[trackId]}
                outputDisabledReason={busy ? 'Project edits are paused right now.' : null}
                onToggleLock={() => onToggleTrackLock(trackId)}
                onToggleOutput={() => onToggleTrackOutput(trackId)}
              />
            )
          })}
        </div>

        <div
          ref={viewportRef}
          className="timeline-v1__viewport"
          data-timeline-viewport
          onScroll={(event) => {
            setContextMenu(null)
            const next = event.currentTarget.scrollLeft
            if (Math.abs(next - viewport.scrollLeftPx) > 0.5) {
              onViewportChange({ ...viewport, scrollLeftPx: next })
            }
          }}
          onWheel={onWheel}
        >
          <div className="timeline-v1__content" style={{ width: `${contentWidthPx}px` }}>
            <TimelineRuler
              durationTicks={model.durationTicks}
              timescale={model.timescale}
              viewport={viewport}
              visibleRange={visibleRange}
              onSeek={onSeek}
            />
            <div className="timeline-v1__lanes">
              {model.lanes.map((lane) => (
                <TimelineLane
                  key={lane.id}
                  lane={lane}
                  dragPreview={dragPreview}
                  onMediaDrop={onMediaDrop}
                  timescale={model.timescale}
                  viewport={viewport}
                  visibleRange={visibleRange}
                  overscanTicks={overscanTicks}
                  busy={busy}
                  pointerTicks={pointerTicks}
                  pointerTime={pointerTime}
                  onSnapGuide={setSnapGuideTicks}
                  onSelect={onSelect}
                  onClearSelection={() => onSelect(null)}
                  onSeek={onSeek}
                  onGesture={onGesture}
                  onItemAction={onItemAction}
                  onOpenProposal={onOpenProposal}
                  onContextMenu={openContextMenu}
                />
              ))}
            </div>
            {snapGuideTicks !== null ? (
              <div
                className="timeline-v1__snap-guide"
                data-testid="timeline-snap-guide"
                style={{ left: `${ticksToPixels(snapGuideTicks, model.timescale, viewport.pixelsPerSecond)}px` }}
                aria-hidden="true"
              />
            ) : null}
            <TimelinePlayhead
              playheadTicks={playheadTicks}
              durationTicks={model.durationTicks}
              timescale={model.timescale}
              leftPx={playheadLeftPx}
              disabled={false}
              pointerTime={pointerTime}
              onSnapGuide={setSnapGuideTicks}
              onSeek={onSeek}
            />
          </div>
        </div>
      </div>

      {model.diagnostics.length > 0 ? (
        <div className="timeline-v1__diagnostics" role="status" aria-label="Timeline notices">
          {model.diagnostics.map((diagnostic, index) => (
            <p key={`${diagnostic.code}:${diagnostic.operationId ?? index}`}>{diagnostic.message}</p>
          ))}
        </div>
      ) : null}

      <TimelineContextActions
        selectedItem={selectedItem}
        playheadTicks={playheadTicks}
        timescale={model.timescale}
        busy={busy}
        trimAmountTicks={trimAmountTicks}
        gainDb={gainDb}
        fadeInTicks={fadeInTicks}
        fadeOutTicks={fadeOutTicks}
        onGesture={onGesture}
        onSeek={onSeek}
        onOpenProposal={onOpenProposal}
        onOpenAdvancedControls={() => {
          if (!advancedDetailsRef.current) return
          advancedDetailsRef.current.open = true
          advancedDetailsRef.current.scrollIntoView({ block: 'nearest' })
          advancedDetailsRef.current.querySelector<HTMLElement>('button, input, summary')?.focus()
        }}
      />

      <details ref={advancedDetailsRef} className="timeline-v1__advanced">
        <summary>Advanced direct controls</summary>
        {advancedControls}
      </details>

      {contextMenu && contextItem ? (
        <TimelineContextMenu
          item={contextItem}
          x={contextMenu.x}
          y={contextMenu.y}
          playheadTicks={playheadTicks}
          busy={busy}
          onGesture={onGesture}
          onSeek={onSeek}
          onOpenProposal={onOpenProposal}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </section>
  )
}
