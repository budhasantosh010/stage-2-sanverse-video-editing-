import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type WheelEvent } from 'react'

import {
  fitTimelineToViewport,
  timelineContentWidthPx,
  ticksToPixels,
  visibleTickRange,
  zoomTimelineAtAnchor,
  type TimelineGesture,
  type TimelineItemView,
  type TimelineViewModel,
  type TimelineViewportState,
} from '../../features/timeline'
import { TimelineContextActions } from './TimelineContextActions'
import { TimelineContextMenu } from './TimelineContextMenu'
import { TimelineLane } from './TimelineLane'
import { TimelinePlayhead } from './TimelinePlayhead'
import { TimelineRuler } from './TimelineRuler'
import { timelinePointerToTicks } from './timeline-ruler-model'
import { snapTimelineTicks, timelineSnapCandidates, type TimelineSnapResult } from './timeline-snap'
import { TimelineToolbar } from './TimelineToolbar'
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
  onViewportChange(viewport: TimelineViewportState): void
  onSeek(ticks: number): void
  onSelect(itemId: string | null): void
  onGesture(gesture: TimelineGesture): void
  onOpenProposal(): void
}>

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return target.matches('input, textarea, select, [contenteditable="true"]')
}

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

  const pointerTime = (clientX: number, excludedTicks: readonly number[] = []): TimelineSnapResult =>
    snapTimelineTicks({
      ticks: pointerTicks(clientX),
      candidateTicks: snapCandidates,
      excludedTicks,
      durationTicks: model.durationTicks,
      timescale: model.timescale,
      pixelsPerSecond: viewport.pixelsPerSecond,
    })

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

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isTypingTarget(event.target)) return
    if (event.key === 'Escape') {
      event.preventDefault()
      if (contextMenu) {
        setContextMenu(null)
      } else {
        onSelect(null)
      }
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItem && !busy) {
      const removalAction = event.currentTarget.querySelector<HTMLButtonElement>('[data-timeline-removal-action]')
      if (removalAction) {
        event.preventDefault()
        removalAction.focus()
        return
      }
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
    if (event.key.toLowerCase() === 's' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const canSplit = selectedItem?.kind === 'clip'
        && selectedItem.state === 'committed'
        && playheadTicks > selectedItem.startTicks
        && playheadTicks < selectedItem.startTicks + selectedItem.durationTicks
      if (canSplit && !busy) {
        event.preventDefault()
        onGesture({ type: 'split', atTicks: playheadTicks })
      }
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
        busy={busy}
        onZoomOut={() => changeZoom(viewport.pixelsPerSecond / 1.25)}
        onZoomIn={() => changeZoom(viewport.pixelsPerSecond * 1.25)}
        onFit={fit}
      />

      <div className="timeline-v1__viewport-grid">
        <div className="timeline-v1__headers" aria-hidden="true">
          <div className="timeline-v1__ruler-header">Time</div>
          {model.lanes.map((lane) => (
            <div key={lane.id} className={`timeline-v1__lane-header timeline-v1__lane-header--${lane.kind}`}>
              <strong>{lane.label}</strong>
              <span>{lane.kind}</span>
            </div>
          ))}
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
