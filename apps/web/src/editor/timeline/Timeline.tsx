import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type WheelEvent } from 'react'

import type { TimelineGroupV1, TimelineMarkerV1, TimelineTrackId, TrackOutputState, MarkerColor } from '@sanverse/edit-domain'
import {
  EMPTY_SELECTION,
  applyMarquee,
  beginMarquee,
  cancelMarquee,
  extendSelection,
  fitTimelineToViewport,
  gapSnapTicks,
  itemIntersectsVisibleRange,
  marqueeAutoScrollPx,
  marqueeBounds,
  marqueeIsMeaningful,
  marqueeModeFor,
  parseGapItemId,
  selectAll,
  selectOnly,
  primarySelectedItemId,
  timelineContentWidthPx,
  ticksToPixels,
  toggleSelection,
  trackHeightPx,
  trackIdForLane,
  updateMarquee,
  visibleTickRange,
  zoomTimelineAtAnchor,
  type KeymapV1,
  type MarqueeSession,
  type MultiItemGesture,
  type PlacementMode,
  type TimelineGesture,
  type TimelineItemAction,
  type TimelineItemView,
  type TimelineSelectionV2,
  type TimelineViewModel,
  type TimelineViewportState,
  type TrackPresentationV1,
} from '../../features/timeline'
import {
  canonicalKeyBinding,
  commandForKey,
  displayKeyBinding,
  setTrackHeight as setTrackHeightIn,
  toggleTrackCollapsed as toggleTrackCollapsedIn,
} from '../../features/timeline'
import { markerAfter, markerBefore } from '@sanverse/edit-domain'
import type { MediaDragPayloadV1 } from '../../features/media'
import {
  ANALYSIS_PRIORITY,
  derivedMediaClipFor,
  planTimelineAnalysis,
  useMediaAnalysisController,
  type AssetFacts,
} from '../../features/media-analysis'
import { currentWindowWidthPx, laneDensity, laneHeightPx } from './timeline-lane-metrics'
import { TimelineContextActions } from './TimelineContextActions'
import { TimelineContextMenu } from './TimelineContextMenu'
import { TimelineLane } from './TimelineLane'
import { TimelineMarkers } from './TimelineMarkers'
import { TimelinePlayhead } from './TimelinePlayhead'
import { TimelineRuler } from './TimelineRuler'
import { TimelineTrackHeader } from './TimelineTrackHeader'
import { timelinePointerToTicks } from './timeline-ruler-model'
import { snapTimelineTicks, timelineSnapCandidates, type TimelineSnapResult } from './timeline-snap'
import { TimelineToolbar, type TimelineTool, type TimelineToolbarAction } from './TimelineToolbar'
import './Timeline.css'

export type TimelineProps = Readonly<{
  model: TimelineViewModel
  playheadTicks: number
  viewport: TimelineViewportState
  /** Everything picked, and where a Shift range measures from. */
  selection: TimelineSelectionV2
  /** Which things the user said move together. Part of the project; no render effect. */
  groups: readonly TimelineGroupV1[]
  /** The user's own notes. Part of the project; no render effect. */
  markers: readonly TimelineMarkerV1[]
  selectedMarkerId: string | null
  /** Row heights and folds. A browser setting: no revision, no Undo, no export change. */
  trackPresentation: TrackPresentationV1
  keymap: KeymapV1
  clipboardHasContent: boolean
  busy: boolean
  trimAmountTicks: number
  gainDb: number
  fadeInTicks: number
  fadeOutTicks: number
  advancedControls: ReactNode
  dragPreview?: MediaDragPayloadV1 | null
  onMediaDrop?: ((laneId: string, assetId: string, atTicks: number) => void) | null
  assetFacts?: Readonly<Record<string, AssetFacts>>
  lockedTrackIds: readonly string[]
  trackOutputs: TrackOutputState
  placementMode: PlacementMode
  snappingEnabled: boolean
  onToggleTrackLock(trackId: TimelineTrackId): void
  onToggleTrackOutput(trackId: TimelineTrackId): void
  onPlacementMode(mode: PlacementMode): void
  onToggleSnapping(): void
  onItemAction(itemId: string, action: TimelineItemAction): void
  /** Everything picked, moved or trimmed together, as ONE change set. */
  onMultiGesture(gesture: MultiItemGesture): void
  onViewportChange(viewport: TimelineViewportState): void
  onSeek(ticks: number): void
  onSelectionChange(selection: TimelineSelectionV2): void
  onGesture(gesture: TimelineGesture): void
  onAction(action: TimelineToolbarAction): void
  onSelectMarker(markerId: string | null): void
  onMoveMarker(markerId: string, toStartTicks: number): void
  onDeleteMarker(markerId: string): void
  onEditMarker(markerId: string, changes: Readonly<{ label?: string; note?: string; color?: MarkerColor }>): void
  onTrackPresentationChange(state: TrackPresentationV1): void
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

/** A stable empty object, so a project without files does not remount every lane. */
const EMPTY_ASSET_FACTS: Readonly<Record<string, AssetFacts>> = Object.freeze({})

const isMacPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')

export function Timeline({
  model,
  playheadTicks,
  viewport,
  selection,
  groups,
  markers,
  selectedMarkerId,
  trackPresentation,
  keymap,
  clipboardHasContent,
  busy,
  trimAmountTicks,
  gainDb,
  fadeInTicks,
  fadeOutTicks,
  advancedControls,
  dragPreview,
  onMediaDrop,
  assetFacts,
  lockedTrackIds,
  trackOutputs,
  placementMode,
  snappingEnabled,
  onToggleTrackLock,
  onToggleTrackOutput,
  onPlacementMode,
  onToggleSnapping,
  onItemAction,
  onMultiGesture,
  onViewportChange,
  onSeek,
  onSelectionChange,
  onGesture,
  onAction,
  onSelectMarker,
  onMoveMarker,
  onDeleteMarker,
  onEditMarker,
  onTrackPresentationChange,
  onOpenProposal,
}: TimelineProps) {
  const timelineRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const advancedDetailsRef = useRef<HTMLDetailsElement>(null)
  const [snapGuideTicks, setSnapGuideTicks] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<Readonly<{ itemId: string; x: number; y: number }> | null>(null)
  const [tool, setTool] = useState<TimelineTool>('select')
  const [marquee, setMarquee] = useState<MarqueeSession | null>(null)

  const allItems = useMemo(() => model.lanes.flatMap((lane) => lane.items), [model])
  const soleSelectedId = primarySelectedItemId(selection)
  const selectedItem = useMemo<TimelineItemView | null>(() => {
    if (!soleSelectedId) return null
    return allItems.find((item) => item.id === soleSelectedId) ?? null
  }, [allItems, soleSelectedId])
  const contextItem = contextMenu
    ? allItems.find((item) => item.id === contextMenu.itemId) ?? null
    : null

  /*
   * What the pointer may snap to.
   *
   * The edges of every clip, the playhead — and now both edges of every hole,
   * because "put this right at the end of the gap" is something a person
   * genuinely aims at, and without it the pointer sails past by a few frames
   * that the export shows even though the screen did not.
   */
  const snapCandidates = useMemo(() => [
    ...timelineSnapCandidates({ durationTicks: model.durationTicks, itemRanges: allItems }),
    ...gapSnapTicks(allItems),
    ...markers.map((marker) => marker.startTicks),
  ], [allItems, markers, model.durationTicks])

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

  /*
   * ────────────────────────────────────────────────────────────────────────
   *  The ONE place that decides which pictures and sound shapes are fetched.
   * ────────────────────────────────────────────────────────────────────────
   *
   * Every clip could ask for its own. A hundred clips asking would open a
   * hundred connections, ask for the same moment of the same recording once
   * per clip that shows it, and be unable to cancel anything — because no
   * single piece of code would know the user had scrolled away.
   */
  const analysis = useMediaAnalysisController()

  /*
   * How wide the WINDOW is — not how wide the timeline is.
   *
   * Row heights answer "is there room on this screen", and on a desktop the
   * timeline is only part of the screen: at 1440 pixels wide it commonly gets
   * 700 of them, sharing the rest with the preview and the inspector.
   */
  const [windowWidthPx, setWindowWidthPx] = useState(currentWindowWidthPx)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setWindowWidthPx(currentWindowWidthPx())
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const wanted = useMemo(() => {
    if (!assetFacts) return null
    const nearStart = Math.max(0, visibleRange.startTicks - overscanTicks)
    const nearEnd = visibleRange.endTicks + overscanTicks
    const clips: { clip: NonNullable<ReturnType<typeof derivedMediaClipFor>>; density: ReturnType<typeof laneDensity>; priority: number }[] = []

    for (const lane of model.lanes) {
      const density = laneDensity(lane.kind, windowWidthPx)
      if (density === 'minimal') continue
      for (const item of lane.items) {
        const onScreen = itemIntersectsVisibleRange({
          itemStartTicks: item.startTicks,
          itemDurationTicks: item.durationTicks,
          visibleStartTicks: visibleRange.startTicks,
          visibleEndTicks: visibleRange.endTicks,
        })
        const nearby = onScreen || itemIntersectsVisibleRange({
          itemStartTicks: item.startTicks,
          itemDurationTicks: item.durationTicks,
          visibleStartTicks: nearStart,
          visibleEndTicks: nearEnd,
        })
        if (!nearby) continue
        const clip = derivedMediaClipFor(item, lane.kind, assetFacts)
        if (clip === null) continue
        clips.push({
          clip,
          density,
          priority: item.selected
            ? ANALYSIS_PRIORITY.selected
            : onScreen ? ANALYSIS_PRIORITY.visible : ANALYSIS_PRIORITY.nearOverscan,
        })
      }
    }

    return planTimelineAnalysis({
      clips,
      timescale: model.timescale,
      pixelsPerSecond: viewport.pixelsPerSecond,
    })
  }, [
    assetFacts,
    model.lanes,
    model.timescale,
    overscanTicks,
    viewport.pixelsPerSecond,
    windowWidthPx,
    visibleRange.startTicks,
    visibleRange.endTicks,
  ])

  useEffect(() => {
    if (analysis === null || wanted === null) return
    const timer = setTimeout(() => analysis.setWanted(model.projectId, wanted.wanted), 90)
    return () => clearTimeout(timer)
  }, [analysis, wanted, model.projectId])

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

  /*
   * ────────────────────────────────────────────────────────────────────────
   *  Picking things
   * ────────────────────────────────────────────────────────────────────────
   *
   * Which modifier means what, decided in ONE place so a click on a clip, a
   * click in the marquee and a keyboard shortcut cannot disagree.
   */
  const selectItem = (
    itemId: string,
    modifiers?: Readonly<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>,
  ) => {
    if (!modifiers) {
      onSelectionChange(selectOnly(model, itemId, groups))
      return
    }
    if (modifiers.ctrlKey || modifiers.metaKey) {
      onSelectionChange(toggleSelection(model, selection, itemId, groups))
      return
    }
    if (modifiers.shiftKey) {
      onSelectionChange(extendSelection(model, selection, itemId, groups))
      return
    }
    onSelectionChange(selectOnly(model, itemId, groups))
  }

  /*
   * ────────────────────────────────────────────────────────────────────────
   *  Dragging a box round several things
   * ────────────────────────────────────────────────────────────────────────
   *
   * A box may only START on empty space. Pressing on a clip means move that
   * clip. One gesture cannot mean both, and deciding from how far the pointer
   * travelled would mean a small accidental wobble either moved a clip or
   * selected half the timeline, depending on luck.
   */
  const marqueeCaught = useMemo(
    () => marquee ? applyMarquee(model, marquee, groups) : null,
    [groups, marquee, model],
  )
  const marqueeRect = useMemo(() => {
    if (!marquee || !marqueeIsMeaningful(marquee)) return null
    const bounds = marqueeBounds(model, marquee)
    if (!bounds) return null
    return {
      leftPx: ticksToPixels(bounds.startTicks, model.timescale, viewport.pixelsPerSecond),
      widthPx: Math.max(
        1,
        ticksToPixels(bounds.endTicks - bounds.startTicks, model.timescale, viewport.pixelsPerSecond),
      ),
      firstLaneIndex: bounds.firstLaneIndex,
      lastLaneIndex: bounds.lastLaneIndex,
    }
  }, [marquee, model, viewport.pixelsPerSecond])

  const laneIdAt = (target: EventTarget | null): string | null => {
    if (!(target instanceof HTMLElement)) return null
    return target.closest<HTMLElement>('[data-lane-id]')?.dataset.laneId ?? null
  }

  const endMarquee = (commit: boolean) => {
    if (!marquee) return
    onSelectionChange(commit ? applyMarquee(model, marquee, groups) : cancelMarquee(marquee))
    setMarquee(null)
  }

  /**
   * Why each action cannot be used right now, in words.
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
  const nothingPicked = selection.itemIds.length === 0
  const lockedReason = selectedLocked
    ? `${selectedTrackId} is locked. Unlock it to change anything on it.`
    : null
  const selectedGap = selectedItem !== null && selectedItem.kind === 'gap'
    ? parseGapItemId(selectedItem.id)
    : null
  const grouped = selection.itemIds.some((itemId) =>
    groups.some((group) => group.memberItemIds.includes(itemId)))

  const disabledReasons: Readonly<Record<TimelineToolbarAction, string | null>> = {
    split: !selectedItem
      ? 'Choose something on the timeline first.'
      : lockedReason ?? (!playheadInsideSelection ? 'Move the playhead inside the selected item first.' : null),
    lift: nothingPicked ? 'Choose something on the timeline first.' : lockedReason,
    'ripple-delete': !selectedItem
      ? 'Choose something on the timeline first.'
      : lockedReason ?? (selectedItem.laneId === 'lane:overlay'
        // Closing the gap would re-pin every later clip to earlier footage,
        // which moves them onto different moments of the recording.
        ? 'B-roll is pinned to a moment of your footage, so closing the gap would move later clips. Use Delete.'
        : null),
    copy: nothingPicked ? 'Choose something on the timeline first.' : null,
    cut: nothingPicked ? 'Choose something on the timeline first.' : lockedReason,
    paste: clipboardHasContent ? null : 'There is nothing to paste yet. Copy something first.',
    duplicate: nothingPicked ? 'Choose something on the timeline first.' : lockedReason,
    group: selection.itemIds.length < 2
      ? 'Pick at least two things to make them move together.'
      : null,
    ungroup: grouped ? null : 'Nothing you have picked is part of a group.',
    'add-marker': null,
    'close-gap': selectedGap === null
      ? 'Choose an empty space on the video track first.'
      : lockedTrackIds.includes('V1') ? 'Track V1 is locked. Unlock it to change anything on it.' : null,
    transition: !selectedItem || selectedItem.kind !== 'clip' || selectedItem.clipId === null
      ? 'Choose a piece of the main video first.'
      : lockedReason,
    // Honest, and it says what is missing rather than pretending.
    speed: 'Changing how fast a clip plays is not built yet.',
  }

  const isMac = isMacPlatform()
  const shortcutFor = (action: TimelineToolbarAction): string | undefined => {
    const command = action === 'lift' ? 'delete' : action === 'split' ? 'split' : action
    const binding = keymap.bindings[command as keyof typeof keymap.bindings]
    return binding ? displayKeyBinding(binding, isMac) : undefined
  }
  const shortcuts: Partial<Record<TimelineToolbarAction, string>> = Object.fromEntries(
    (Object.keys(disabledReasons) as TimelineToolbarAction[])
      .map((action) => [action, shortcutFor(action)]),
  )

  /**
   * Do the thing, on whichever family the picked item belongs to.
   *
   * Everything that is not simply "one item, one edit" is handed upwards, where
   * the planners live. This function knows which button was pressed; it does not
   * know how a B-roll clip is pinned to footage, and it must not learn.
   */
  const runToolbarAction = (action: TimelineToolbarAction) => {
    if (disabledReasons[action] !== null || busy) return
    if (action !== 'split' && action !== 'lift' && action !== 'ripple-delete') {
      onAction(action)
      return
    }
    if (action === 'lift' && selection.itemIds.length > 1) {
      // Several things deleted together is one change set, planned upstairs.
      onAction('lift')
      return
    }
    if (!selectedItem) return
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

  /**
   * One item was dragged. If it was part of a group of picked things, the WHOLE
   * group moves by the same amount, as one change set.
   *
   * The delta is worked out here, from what the item reported, rather than every
   * item reporting its own destination — so the spacing between them is
   * preserved by construction rather than by arithmetic that could drift.
   */
  const routeItemAction = (itemId: string, action: TimelineItemAction) => {
    const many = selection.itemIds.length > 1 && selection.itemIds.includes(itemId)
    const item = allItems.find((candidate) => candidate.id === itemId)
    if (!many || !item) {
      onItemAction(itemId, action)
      return
    }
    if (action.type === 'move') {
      onMultiGesture({ type: 'move', deltaTicks: action.toStartTicks - item.startTicks })
      return
    }
    if (action.type === 'trim-start') {
      onMultiGesture({ type: 'trim-start', deltaTicks: action.toStartTicks - item.startTicks })
      return
    }
    if (action.type === 'trim-end') {
      onMultiGesture({
        type: 'trim-end',
        deltaTicks: action.toEndTicks - (item.startTicks + item.durationTicks),
      })
      return
    }
    // Split and delete of a whole selection are handled by the toolbar path.
    onItemAction(itemId, action)
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
   * Every shortcut now comes from the user's own keymap rather than being
   * written here, so somebody who chose "Close to Premiere Pro" gets Ctrl+K for
   * a cut without any of this code knowing that. See
   * `timeline-keyboard-presets.ts`.
   *
   * Nothing here fires while the user is typing — see `isTypingTarget`.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isTypingTarget(event.target)) return

    if (event.key === 'Escape') {
      event.preventDefault()
      // In order: cancel what is happening, then close what is open, then let
      // go of what is chosen. Escape never creates anything and never undoes.
      if (marquee) endMarquee(false)
      else if (contextMenu) setContextMenu(null)
      else onSelectionChange(EMPTY_SELECTION)
      return
    }

    const binding = canonicalKeyBinding({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
    })
    const command = commandForKey(keymap, binding)

    // Alt with an arrow nudges the picked items rather than the playhead, and
    // is checked BEFORE the keymap so a rebound arrow cannot swallow it.
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && event.altKey) {
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      event.preventDefault()
      if (busy || selection.itemIds.length === 0) return
      if (selection.itemIds.length > 1) {
        onMultiGesture({ type: 'move', deltaTicks: direction * FRAME_TICKS })
        return
      }
      if (selectedItem) {
        onItemAction(selectedItem.id, {
          type: 'move',
          toStartTicks: Math.max(0, selectedItem.startTicks + direction * FRAME_TICKS),
        })
      }
      return
    }

    if (command === null) return
    event.preventDefault()

    switch (command) {
      case 'select-all':
        onSelectionChange(selectAll(model))
        return
      case 'clear-selection':
        onSelectionChange(EMPTY_SELECTION)
        return
      case 'toggle-snapping':
        onToggleSnapping()
        return
      case 'zoom-in':
        changeZoom(viewport.pixelsPerSecond * 1.25)
        return
      case 'zoom-out':
        changeZoom(viewport.pixelsPerSecond / 1.25)
        return
      case 'fit':
        fit()
        return
      case 'go-to-start':
        onSeek(0)
        return
      case 'go-to-end':
        onSeek(model.durationTicks)
        return
      case 'nudge-left':
        onSeek(Math.max(0, playheadTicks - FRAME_TICKS))
        return
      case 'nudge-right':
        onSeek(Math.min(model.durationTicks, playheadTicks + FRAME_TICKS))
        return
      case 'next-marker': {
        // Navigation only: it moves the playhead and changes nothing.
        const next = markerAfter(markers, playheadTicks)
        if (next) {
          onSeek(next.startTicks)
          onSelectMarker(next.markerId)
        }
        return
      }
      case 'previous-marker': {
        const previous = markerBefore(markers, playheadTicks)
        if (previous) {
          onSeek(previous.startTicks)
          onSelectMarker(previous.markerId)
        }
        return
      }
      case 'split':
        runToolbarAction('split')
        return
      case 'delete':
        runToolbarAction('lift')
        return
      case 'ripple-delete':
        runToolbarAction('ripple-delete')
        return
      case 'copy':
      case 'cut':
      case 'paste':
      case 'duplicate':
      case 'group':
      case 'ungroup':
      case 'add-marker':
      case 'close-gap':
        runToolbarAction(command)
        return
      case 'paste-insert':
        // Deliberately routed through the same guard as the button, so a
        // shortcut can never do something the button would have refused.
        if (disabledReasons.paste === null && !busy) onAction('paste')
        return
      default:
        return
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
      data-timeline-tool={tool}
      data-testid="timeline-v1"
    >
      <TimelineToolbar
        durationTicks={model.durationTicks}
        timescale={model.timescale}
        viewport={viewport}
        selectedSummary={selectedItem ? `${selectedItem.label} · ${selectedItem.kind}` : null}
        selectedCount={selection.itemIds.length}
        disabledReasons={disabledReasons}
        shortcuts={shortcuts}
        tool={tool}
        snappingEnabled={snappingEnabled}
        placementMode={placementMode}
        busy={busy}
        onTool={setTool}
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
                heightPx={trackHeightPx(trackPresentation, trackId, laneHeightPx(lane.kind, windowWidthPx))}
                collapsed={trackPresentation.collapsed.includes(trackId)}
                onToggleLock={() => onToggleTrackLock(trackId)}
                onToggleOutput={() => onToggleTrackOutput(trackId)}
                onToggleCollapsed={() => onTrackPresentationChange(
                  toggleTrackCollapsedIn(trackPresentation, trackId),
                )}
                onHeight={(height) => onTrackPresentationChange(
                  setTrackHeightIn(trackPresentation, trackId, height),
                )}
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
            <TimelineMarkers
              markers={markers}
              timescale={model.timescale}
              pixelsPerSecond={viewport.pixelsPerSecond}
              durationTicks={model.durationTicks}
              selectedMarkerId={selectedMarkerId}
              busy={busy}
              onSelectMarker={onSelectMarker}
              onSeek={onSeek}
              onMoveMarker={onMoveMarker}
              onDeleteMarker={onDeleteMarker}
              onEditMarker={onEditMarker}
              pointerTicks={(clientX) => pointerTime(clientX).ticks}
            />
            <TimelineRuler
              durationTicks={model.durationTicks}
              timescale={model.timescale}
              viewport={viewport}
              visibleRange={visibleRange}
              onSeek={onSeek}
            />
            <div
              className="timeline-v1__lanes"
              onPointerDown={(event) => {
                // A box only starts on empty space, and only with the Select
                // tool. Anywhere else the press belongs to the thing under it.
                if (tool !== 'select' || busy) return
                if (!(event.target instanceof HTMLElement)) return
                if (!event.target.classList.contains('timeline-v1__lane')) return
                const laneId = laneIdAt(event.target)
                if (!laneId) return
                // See the note in TimelineMarkers: worth having, not worth
                // failing over.
                try {
                  event.currentTarget.setPointerCapture(event.pointerId)
                } catch {
                  // The box still follows the pointer inside the timeline.
                }
                setMarquee(beginMarquee({
                  atTicks: pointerTicks(event.clientX),
                  laneId,
                  mode: marqueeModeFor(event),
                  baseSelection: selection,
                }))
              }}
              onPointerMove={(event) => {
                if (!marquee) return
                const laneId = laneIdAt(event.target) ?? marquee.currentLaneId
                setMarquee(updateMarquee(marquee, pointerTicks(event.clientX), laneId))
                // Dragging against an edge scrolls the timeline, so a box can
                // reach past what is currently on screen.
                const element = viewportRef.current
                if (!element) return
                const rect = element.getBoundingClientRect()
                const scrollBy = marqueeAutoScrollPx({
                  pointerXInViewportPx: event.clientX - rect.left,
                  viewportWidthPx: rect.width,
                })
                if (scrollBy !== 0) element.scrollLeft += scrollBy
              }}
              onPointerUp={(event) => {
                if (!marquee) return
                try {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                } catch {
                  // It was never taken.
                }
                endMarquee(true)
              }}
              onPointerCancel={() => endMarquee(false)}
            >
              {model.lanes.map((lane) => (
                <TimelineLane
                  key={lane.id}
                  lane={lane}
                  assetFacts={assetFacts ?? EMPTY_ASSET_FACTS}
                  muted={trackOutputs[trackIdForLane(lane.id)] === false}
                  layoutWidthPx={windowWidthPx}
                  heightPx={trackHeightPx(
                    trackPresentation,
                    trackIdForLane(lane.id),
                    laneHeightPx(lane.kind, windowWidthPx),
                  )}
                  marqueeActive={marquee !== null}
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
                  onSelect={selectItem}
                  onClearSelection={() => onSelectionChange(EMPTY_SELECTION)}
                  onSeek={onSeek}
                  onGesture={onGesture}
                  onItemAction={routeItemAction}
                  onOpenProposal={onOpenProposal}
                  onContextMenu={openContextMenu}
                />
              ))}
              {marqueeRect ? (
                <div
                  className="timeline-v1__marquee"
                  data-testid="timeline-marquee"
                  aria-hidden="true"
                  style={{
                    left: `${marqueeRect.leftPx}px`,
                    width: `${marqueeRect.widthPx}px`,
                    top: `${marqueeRect.firstLaneIndex * 100 / Math.max(1, model.lanes.length)}%`,
                    height: `${(marqueeRect.lastLaneIndex - marqueeRect.firstLaneIndex + 1) * 100 / Math.max(1, model.lanes.length)}%`,
                  }}
                />
              ) : null}
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

      {/*
        What a box is about to take, said in words as well as drawn, because a
        rectangle on screen tells a screen-reader user nothing at all.
      */}
      {/*
        What a box is about to take, said in words as well as drawn, because a
        rectangle on screen tells a screen-reader user nothing at all.

        It speaks ONLY while a box is being dragged. How many things are picked
        is already said once, in the toolbar; saying it twice would have a
        screen reader read the same sentence from two places.
      */}
      <p className="timeline-v1__marquee-status" role="status" aria-live="polite">
        {marqueeCaught && marquee && marqueeIsMeaningful(marquee)
          ? `${marqueeCaught.itemIds.length} things inside the box`
          : ''}
      </p>

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
        onCloseGap={() => runToolbarAction('close-gap')}
        closeGapDisabledReason={disabledReasons['close-gap']}
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
          disabledReasons={disabledReasons}
          onAction={(action) => {
            runToolbarAction(action)
            setContextMenu(null)
          }}
          onGesture={onGesture}
          onSeek={onSeek}
          onOpenProposal={onOpenProposal}
          onClose={() => {
            setContextMenu(null)
            // Focus goes back to where it came from. A menu that closes and
            // leaves the keyboard nowhere strands somebody who cannot use a
            // mouse to pick it back up.
            timelineRef.current
              ?.querySelector<HTMLElement>(`[data-timeline-item-id="${contextMenu.itemId}"]`)
              ?.focus()
          }}
        />
      ) : null}
    </section>
  )
}
