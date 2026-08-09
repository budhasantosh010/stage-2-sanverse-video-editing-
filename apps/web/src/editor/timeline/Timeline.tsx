import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type WheelEvent } from 'react'

import {
  EMPTY_EDITOR_KEYFRAME_SELECTION,
  type EditorAnimationTrackStateV1,
  type EditorKeyframeClipboardV1,
  type EditorKeyframeSelectionV1,
  type TimelineGroupV1,
  type TimelineMarkerV1,
  type TimelineTrackId,
  type TrackOutputState,
  type MarkerColor,
} from '@sanverse/edit-domain'
import {
  EMPTY_SELECTION,
  EMPTY_DYNAMIC_TRIM,
  applyMarquee,
  beginDynamicTrim,
  beginMarquee,
  cancelMarquee,
  extendSelection,
  frameDeltaToTicks,
  calculateHorizontalZoomScroll,
  effectiveTrackHeightPx,
  fitTimelineToViewport,
  fitTrackHeights,
  gapSnapTicks,
  itemIntersectsVisibleRange,
  marqueeAutoScrollPx,
  marqueeBounds,
  marqueeIsMeaningful,
  marqueeModeFor,
  parseGapItemId,
  pixelsToTicks,
  selectAll,
  selectOnly,
  primarySelectedItemId,
  timelineContentWidthPx,
  ticksToPixels,
  toggleSelection,
  trackIdForLane,
  updateMarquee,
  visibleTickRange,
  nextHorizontalZoom,
  verticalZoom as createVerticalZoom,
  DEFAULT_VERTICAL_ZOOM_BASIS_POINTS,
  VERTICAL_ZOOM_STEP_BASIS_POINTS,
  type KeymapV1,
  type MarqueeSession,
  type MultiItemGesture,
  type PlacementMode,
  type PrecisionFrameRateV1,
  type PrecisionTrimPlan,
  type PrecisionTrimRequestV1,
  type TimelineEditPointRefV1,
  type TimelineGesture,
  type TimelineItemAction,
  type TimelineItemView,
  type ShuttleKeyV1,
  type TimelinePrecisionToolV1,
  type TimelineSelectionV2,
  type TimelineShuttleStateV1,
  updateDynamicTrim,
  type TimelineViewModel,
  type TimelineViewportState,
  type TimelineVerticalZoomV1,
  type TrackPresentationV1,
  DEFAULT_TIMELINE_ANIMATION_PRESENTATION,
  animationPresentationForTarget,
  animationTargetExpanded,
  readTimelineAnimationPresentation,
  reconcileEditorKeyframeSelection,
  writeTimelineAnimationPresentation,
  type TimelineAnimationPresentationV1,
  type TimelineAnimationSubjectV1,
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
  mediaAnalysisKeyId,
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
import { TimelineToolbar, type TimelinePrecisionCommand, type TimelineTool, type TimelineToolbarAction } from './TimelineToolbar'
import { TimelineSpeedPanel } from './TimelineSpeedPanel'
import { TimelineTransitionPanel } from './TimelineTransitionPanel'
import { TimelineLinkedAudioPanel, type TimelineLinkedAudioSubject } from './TimelineLinkedAudioPanel'
import { TimelineFreezePanel } from './TimelineFreezePanel'
import { TimelinePrecisionPopover, type NumericPrecisionIntentV1 } from './TimelinePrecisionPopover'
import { TimelineTrimView } from './TimelineTrimView'
import { TimelineAnimationLanes } from './TimelineAnimationLanes'
import { TimelinePropertyGraphView } from './TimelinePropertyGraphView'
import { planTimelineTrimViewFrames } from './timeline-trim-view-plan'
import type { TimelineTransitionSubject, TransitionAudioV1, TransitionStyleV1 } from '../../features/timeline/timeline-transition-plan'
import type { RateStretchPreview } from './TimelineRateStretchHandle'
import { NORMAL_PLAYBACK_RATE, type RationalPlaybackRateV1 } from '@sanverse/edit-domain/clip-time'
import './Timeline.css'

export type TimelineProps = Readonly<{
  model: TimelineViewModel
  playheadTicks: number
  frameRate?: PrecisionFrameRateV1
  viewport: TimelineViewportState
  /** Everything picked, and where a Shift range measures from. */
  selection: TimelineSelectionV2
  /** The one currently editable animation target. Presentation only until a planner commits. */
  animationSubject?: TimelineAnimationSubjectV1 | null
  /** Timeline items that contain accepted editor-owned animation, for compact badges. */
  animatedItemIds?: readonly string[]
  /** One keyframe selection authority shared by Timeline, Graph and Inspector adapters. */
  keyframeSelection?: EditorKeyframeSelectionV1
  onKeyframeSelectionChange?(selection: EditorKeyframeSelectionV1): void
  /** Detached animation state used by Preview during pointer movement. */
  onAnimationDraft?(state: EditorAnimationTrackStateV1 | null): void
  /** One complete planner result; the Studio adapter converts this to the existing accepted operation. */
  onAnimationCommit?(state: EditorAnimationTrackStateV1): void
  /** Which things the user said move together. Part of the project; no render effect. */
  groups: readonly TimelineGroupV1[]
  /** The user's own notes. Part of the project; no render effect. */
  markers: readonly TimelineMarkerV1[]
  selectedMarkerId: string | null
  /** Row heights and folds. A browser setting: no revision, no Undo, no export change. */
  trackPresentation: TrackPresentationV1
  /** One global multiplier over the stored base heights. Presentation only. */
  verticalZoom?: TimelineVerticalZoomV1
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
  /**
   * What the Speed panel needs to know about the picked piece, or null when
   * nothing suitable is picked. Supplied from above rather than worked out
   * here, because only the screen holding the project can answer it.
   */
  speedSubject: Readonly<{
    clipLabel: string
    currentRate: RationalPlaybackRateV1
    direction?: 'forward' | 'reverse'
    maintainAudioPitch: boolean
    currentDurationTicks: number
    sourceDurationTicks: number
  }> | null
  /** One sentence describing what a speed/direction would do. Comes from the one planner. */
  onSpeedPreview(rate: RationalPlaybackRateV1, maintainAudioPitch: boolean, direction: 'forward' | 'reverse'): string
  onSpeedChoose(rate: RationalPlaybackRateV1, maintainAudioPitch: boolean, direction: 'forward' | 'reverse'): void
  /** The exact T3 planner result used by both the detached ghost and release. */
  onPrecisionPreview?(request: PrecisionTrimRequestV1): PrecisionTrimPlan
  onPrecisionCommit?(plan: Extract<PrecisionTrimPlan, { ok: true }>): void
  shuttleState?: TimelineShuttleStateV1
  onShuttleKey?(key: ShuttleKeyV1): void
  audioScrubbingEnabled?: boolean
  onAudioScrubbingChange?(enabled: boolean): void
  onRateStretchPreview?(targetDurationTicks: number): RateStretchPreview
  onRateStretchCommit?(targetDurationTicks: number): void
  transitionSubject?: TimelineTransitionSubject | null
  onTransitionApply?(style: TransitionStyleV1, durationTicks: number, audio: TransitionAudioV1): void
  linkedAudioSubject?: TimelineLinkedAudioSubject | null
  onLinkedAudioApply?(leadTicks: number, tailTicks: number): void
  freezeClipLabel?: string | null
  freezeUnavailableReason?: string | null
  onFreezeApply?(durationTicks: number): void
  onSelectMarker(markerId: string | null): void
  onMoveMarker(markerId: string, toStartTicks: number): void
  onDeleteMarker(markerId: string): void
  onEditMarker(markerId: string, changes: Readonly<{ label?: string; note?: string; color?: MarkerColor }>): void
  onTrackPresentationChange(state: TrackPresentationV1): void
  onVerticalZoomChange?(state: TimelineVerticalZoomV1): void
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

const DEFAULT_VERTICAL_ZOOM = createVerticalZoom(DEFAULT_VERTICAL_ZOOM_BASIS_POINTS)
const IGNORE_VERTICAL_ZOOM = (_state: TimelineVerticalZoomV1): void => undefined
const NO_RATE_STRETCH_PREVIEW = (_targetDurationTicks: number): RateStretchPreview => Object.freeze({
  ok: false,
  message: 'Rate Stretch is unavailable for this selection.',
})
const IGNORE_RATE_STRETCH = (_targetDurationTicks: number): void => undefined
const NO_PRECISION_PREVIEW = (_request: PrecisionTrimRequestV1): PrecisionTrimPlan => Object.freeze({
  ok: false,
  refusal: Object.freeze({
    code: 'ITEM_TYPE_UNSUPPORTED' as const,
    message: 'Precision trimming is unavailable for this selection.',
    blockingItemId: null,
    requestedTicks: null,
    availableTicks: null,
  }),
})
const IGNORE_PRECISION_COMMIT = (_plan: Extract<PrecisionTrimPlan, { ok: true }>): void => undefined
const IGNORE_KEYFRAME_SELECTION = (_selection: EditorKeyframeSelectionV1): void => undefined
const IGNORE_ANIMATION_DRAFT = (_state: EditorAnimationTrackStateV1 | null): void => undefined
const IGNORE_ANIMATION_COMMIT = (_state: EditorAnimationTrackStateV1): void => undefined

/** A stable empty object, so a project without files does not remount every lane. */
const EMPTY_ASSET_FACTS: Readonly<Record<string, AssetFacts>> = Object.freeze({})

const isMacPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')

export function Timeline({
  model,
  playheadTicks,
  frameRate = Object.freeze({ numerator: 30, denominator: 1 }),
  viewport,
  selection,
  animationSubject = null,
  animatedItemIds = Object.freeze([]),
  keyframeSelection = EMPTY_EDITOR_KEYFRAME_SELECTION,
  onKeyframeSelectionChange = IGNORE_KEYFRAME_SELECTION,
  onAnimationDraft = IGNORE_ANIMATION_DRAFT,
  onAnimationCommit = IGNORE_ANIMATION_COMMIT,
  groups,
  markers,
  selectedMarkerId,
  trackPresentation,
  verticalZoom = DEFAULT_VERTICAL_ZOOM,
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
  speedSubject,
  onSpeedPreview,
  onSpeedChoose,
  onPrecisionPreview = NO_PRECISION_PREVIEW,
  onPrecisionCommit = IGNORE_PRECISION_COMMIT,
  shuttleState = Object.freeze({ direction: 0, rate: 0 }),
  onShuttleKey = () => undefined,
  audioScrubbingEnabled = false,
  onAudioScrubbingChange = () => undefined,
  onRateStretchPreview = NO_RATE_STRETCH_PREVIEW,
  onRateStretchCommit = IGNORE_RATE_STRETCH,
  transitionSubject = null,
  onTransitionApply = () => undefined,
  linkedAudioSubject = null,
  onLinkedAudioApply = () => undefined,
  freezeClipLabel = null,
  freezeUnavailableReason = null,
  onFreezeApply = () => undefined,
  onSelectMarker,
  onMoveMarker,
  onDeleteMarker,
  onEditMarker,
  onTrackPresentationChange,
  onVerticalZoomChange = IGNORE_VERTICAL_ZOOM,
  onOpenProposal,
}: TimelineProps) {
  const timelineRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewportGridRef = useRef<HTMLDivElement>(null)
  const horizontalZoomFrameRef = useRef<number | null>(null)
  const pendingHorizontalZoomRef = useRef<number | null>(null)
  const verticalZoomFrameRef = useRef<number | null>(null)
  const pendingVerticalZoomRef = useRef<number | null>(null)
  const verticalAnchorFrameRef = useRef<number | null>(null)
  const advancedDetailsRef = useRef<HTMLDetailsElement>(null)
  const [snapGuideTicks, setSnapGuideTicks] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<Readonly<{ itemId: string; x: number; y: number }> | null>(null)
  const [tool, setTool] = useState<TimelineTool>('select')
  const [marquee, setMarquee] = useState<MarqueeSession | null>(null)
  const [animationPresentation, setAnimationPresentation] = useState<TimelineAnimationPresentationV1>(() =>
    readTimelineAnimationPresentation(model.projectId),
  )
  const [animationClipboard, setAnimationClipboard] = useState<EditorKeyframeClipboardV1 | null>(null)
  const [animationNotice, setAnimationNotice] = useState<string | null>(null)
  const [pendingAnimationExpandItemId, setPendingAnimationExpandItemId] = useState<string | null>(null)
  /**
   * Whether the Speed panel is showing. Kept here, next to the button that
   * opens it, because it is a view state and nothing else: no operation, no
   * revision, nothing saved. Same reasoning as the More menu.
   */
  const [speedPanelOpen, setSpeedPanelOpen] = useState(false)
  const [transitionPanelOpen, setTransitionPanelOpen] = useState(false)
  const [linkedAudioPanelOpen, setLinkedAudioPanelOpen] = useState(false)
  const [freezePanelOpen, setFreezePanelOpen] = useState(false)
  const frameTicks = Math.max(1, Math.abs(frameDeltaToTicks(1, model.timescale, frameRate)))
  const [precisionTool, setPrecisionTool] = useState<TimelinePrecisionToolV1>('standard-trim')
  const [precisionDraft, setPrecisionDraft] = useState<PrecisionTrimPlan | null>(null)
  const [selectedEditPoints, setSelectedEditPoints] = useState<readonly TimelineEditPointRefV1[]>(Object.freeze([]))
  const [dynamicTrim, setDynamicTrim] = useState(EMPTY_DYNAMIC_TRIM)
  const [dynamicTrimPlan, setDynamicTrimPlan] = useState<PrecisionTrimPlan | null>(null)
  const [rateStretchActive, setRateStretchActive] = useState(false)

  useEffect(() => () => {
    if (horizontalZoomFrameRef.current !== null) cancelAnimationFrame(horizontalZoomFrameRef.current)
    if (verticalZoomFrameRef.current !== null) cancelAnimationFrame(verticalZoomFrameRef.current)
    if (verticalAnchorFrameRef.current !== null) cancelAnimationFrame(verticalAnchorFrameRef.current)
  }, [])

  useEffect(() => {
    setAnimationPresentation(readTimelineAnimationPresentation(model.projectId))
    setAnimationClipboard(null)
    setAnimationNotice(null)
  }, [model.projectId])

  useEffect(() => {
    if (!pendingAnimationExpandItemId || animationSubject?.itemId !== pendingAnimationExpandItemId) return
    const next = animationPresentationForTarget(animationPresentation, animationSubject.target, true)
    setAnimationPresentation(next)
    writeTimelineAnimationPresentation(model.projectId, next)
    setPendingAnimationExpandItemId(null)
  }, [animationPresentation, animationSubject, model.projectId, pendingAnimationExpandItemId])

  useEffect(() => {
    const reconciled = reconcileEditorKeyframeSelection(keyframeSelection, animationSubject)
    if (reconciled.addresses.length !== keyframeSelection.addresses.length ||
        reconciled.addresses.some((address, index) => address.canonicalAtTicks !== keyframeSelection.addresses[index]?.canonicalAtTicks || address.property !== keyframeSelection.addresses[index]?.property)) {
      onKeyframeSelectionChange(reconciled)
    }
  }, [animationSubject, keyframeSelection, onKeyframeSelectionChange])

  const changeAnimationPresentation = (next: TimelineAnimationPresentationV1) => {
    setAnimationPresentation(next)
    writeTimelineAnimationPresentation(model.projectId, next)
  }

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
  const trimViewFrames = useMemo(() => {
    if (!assetFacts || !precisionDraft?.ok) return Object.freeze([])
    return planTimelineTrimViewFrames({ model, assetFacts, plan: precisionDraft })
  }, [assetFacts, model, precisionDraft])

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

    const base = planTimelineAnalysis({
      clips,
      timescale: model.timescale,
      pixelsPerSecond: viewport.pixelsPerSecond,
    })
    if (trimViewFrames.length === 0) return base
    const precisionIds = new Set(trimViewFrames.map((frame) => frame.keyId))
    return Object.freeze({
      wanted: Object.freeze([
        ...trimViewFrames.map((frame) => Object.freeze({ key: frame.key, priority: ANALYSIS_PRIORITY.selected })),
        ...base.wanted.filter((entry) => !precisionIds.has(mediaAnalysisKeyId(entry.key))),
      ]),
      truncated: base.truncated,
    })
  }, [
    assetFacts,
    model.lanes,
    model.timescale,
    overscanTicks,
    trimViewFrames,
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
  const clipIdForItemId = (itemId: string | null): string | null => {
    if (itemId === null) return null
    for (const lane of model.lanes) {
      const item = lane.items.find((candidate) => candidate.id === itemId)
      if (item?.clipId) return item.clipId
    }
    return null
  }

  const previewPrecisionRequest = (request: PrecisionTrimRequestV1): PrecisionTrimPlan => {
    if (request.mode === 'roll' && selectedEditPoints.length > 1) {
      const draggedSelected = selectedEditPoints.some((point) =>
        clipIdForItemId(point.leftItemId) === request.leftClipId
        && clipIdForItemId(point.rightItemId) === request.rightClipId)
      if (draggedSelected) {
        const editPoints = selectedEditPoints.flatMap((point) => {
          const leftClipId = clipIdForItemId(point.leftItemId)
          const rightClipId = clipIdForItemId(point.rightItemId)
          return leftClipId && rightClipId ? [Object.freeze({ leftClipId, rightClipId })] : []
        })
        if (editPoints.length === selectedEditPoints.length) {
          return onPrecisionPreview(Object.freeze({ mode: 'multi-roll', editPoints: Object.freeze(editPoints), deltaTicks: request.deltaTicks }))
        }
      }
    }
    return onPrecisionPreview(request)
  }

  const dynamicPointRequest = (deltaTicks: number): PrecisionTrimRequestV1 | null => {
    if (selectedEditPoints.length !== 1 || deltaTicks === 0) return null
    const point = selectedEditPoints[0]
    const leftClipId = clipIdForItemId(point.leftItemId)
    const rightClipId = clipIdForItemId(point.rightItemId)
    if (!leftClipId || !rightClipId) return null
    return Object.freeze({ mode: 'roll' as const, leftClipId, rightClipId, deltaTicks })
  }

  const previewDynamicDelta = (deltaTicks: number) => {
    const request = dynamicPointRequest(deltaTicks)
    if (!request) return
    const plan = previewPrecisionRequest(request)
    setDynamicTrimPlan(plan)
    setDynamicTrim((current) => updateDynamicTrim(
      current,
      deltaTicks,
      plan.ok,
      plan.ok ? `Roll preview: ${deltaTicks > 0 ? '+' : ''}${deltaTicks} ticks` : plan.refusal.message,
    ))
  }

  const toggleDynamicTrim = () => {
    if (dynamicTrim.active) {
      setDynamicTrim(EMPTY_DYNAMIC_TRIM)
      setDynamicTrimPlan(null)
      onShuttleKey('K')
      return
    }
    if (selectedEditPoints.length !== 1) return
    const point = selectedEditPoints[0]
    const key = `${point.trackId}:${point.leftItemId ?? ''}:${point.rightItemId ?? ''}:${point.compositionTicks}`
    onShuttleKey('K')
    onSeek(point.compositionTicks)
    setDynamicTrim(beginDynamicTrim(key, point.compositionTicks))
    setDynamicTrimPlan(null)
  }

  const commitDynamicTrim = () => {
    if (!dynamicTrim.active || !dynamicTrimPlan?.ok) return
    onPrecisionCommit(dynamicTrimPlan)
    setDynamicTrim(EMPTY_DYNAMIC_TRIM)
    setDynamicTrimPlan(null)
    onShuttleKey('K')
  }

  // Dynamic Trim deliberately owns no second transport. J/K/L moves Studio's
  // one composition playhead; while a detached trim session is active, that
  // movement is translated into the exact same Roll planner used by pointer
  // drags. Enter accepts one plan. Escape accepts nothing.
  useEffect(() => {
    if (!dynamicTrim.active || dynamicTrim.originalCompositionTicks === null) return
    const deltaTicks = playheadTicks - dynamicTrim.originalCompositionTicks
    if (deltaTicks === 0 || deltaTicks === dynamicTrim.previewDeltaTicks) return
    const request = dynamicPointRequest(deltaTicks)
    if (!request) return
    const plan = previewPrecisionRequest(request)
    setDynamicTrimPlan(plan)
    setDynamicTrim((current) => current.active
      ? updateDynamicTrim(
          current,
          deltaTicks,
          plan.ok,
          plan.ok ? `Roll preview: ${deltaTicks > 0 ? '+' : ''}${deltaTicks} ticks` : plan.refusal.message,
        )
      : current)
    // The planner callbacks describe the mounted editor authority. Only the
    // explicit playhead/session values should advance this detached preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicTrim.active, dynamicTrim.originalCompositionTicks, dynamicTrim.previewDeltaTicks, playheadTicks])

  const selectEditPoint = (
    editPoint: TimelineEditPointRefV1,
    modifiers: Readonly<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>,
  ) => {
    const same = (candidate: TimelineEditPointRefV1) =>
      candidate.trackId === editPoint.trackId
      && candidate.leftItemId === editPoint.leftItemId
      && candidate.rightItemId === editPoint.rightItemId
      && candidate.compositionTicks === editPoint.compositionTicks
    if (modifiers.ctrlKey || modifiers.metaKey) {
      setSelectedEditPoints((current) => current.some(same)
        ? Object.freeze(current.filter((candidate) => !same(candidate)))
        : Object.freeze([...current, editPoint]))
      return
    }
    setSelectedEditPoints(Object.freeze([editPoint]))
  }

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
    transition: transitionSubject === null
      ? 'Choose a main-video piece that has another piece directly after it.'
      : lockedReason,
    'linked-audio': linkedAudioSubject === null
      ? 'Choose a main-video or dialogue piece that contains linked sound.'
      : lockedReason,
    freeze: freezeUnavailableReason ?? lockedReason,
    // Speed works on a piece of the MAIN video. B-roll, pictures and music are
    // not pieces of the video's own body — they are laid on top of it — and
    // retiming them needs a different mechanism, so this says so plainly
    // instead of accepting the click and doing nothing.
    speed: !selectedItem || selectedItem.kind !== 'clip' || selectedItem.clipId === null
      ? 'Choose a piece of the main video first. B-roll, pictures and music cannot be sped up yet.'
      : lockedReason,
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
    if (action === 'speed' || action === 'transition' || action === 'linked-audio' || action === 'freeze') {
      // Opening and closing a panel is not an edit. No operation, no change
      // set, no revision, no Undo step — exactly like folding a row away.
      if (action === 'speed') {
        setSpeedPanelOpen((wasOpen) => !wasOpen)
        setTransitionPanelOpen(false)
        setLinkedAudioPanelOpen(false)
      } else if (action === 'transition') {
        setTransitionPanelOpen((wasOpen) => !wasOpen)
        setSpeedPanelOpen(false)
        setLinkedAudioPanelOpen(false)
        setFreezePanelOpen(false)
      } else if (action === 'linked-audio') {
        setLinkedAudioPanelOpen((wasOpen) => !wasOpen)
        setSpeedPanelOpen(false)
        setTransitionPanelOpen(false)
        setFreezePanelOpen(false)
      } else {
        setFreezePanelOpen((wasOpen) => !wasOpen)
        setSpeedPanelOpen(false)
        setTransitionPanelOpen(false)
        setLinkedAudioPanelOpen(false)
      }
      return
    }
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
    const viewportWidth = Math.max(0, viewport.viewportWidthPx)
    const playheadVisible = playheadLeftPx >= viewport.scrollLeftPx
      && playheadLeftPx <= viewport.scrollLeftPx + viewportWidth
    const pointerAnchor = Number.isFinite(anchorViewportX)
      ? Math.min(viewportWidth, Math.max(0, anchorViewportX as number))
      : null
    const anchorX = pointerAnchor ?? (playheadVisible
      ? playheadLeftPx - viewport.scrollLeftPx
      : viewportWidth / 2)
    const anchorTicks = pointerAnchor !== null
      ? pixelsToTicks(viewport.scrollLeftPx + pointerAnchor, model.timescale, viewport.pixelsPerSecond)
      : playheadVisible
        ? Math.min(model.durationTicks, Math.max(0, playheadTicks))
        : pixelsToTicks(viewport.scrollLeftPx + viewportWidth / 2, model.timescale, viewport.pixelsPerSecond)

    onViewportChange(Object.freeze({
      pixelsPerSecond: nextPixelsPerSecond,
      scrollLeftPx: calculateHorizontalZoomScroll({
        previousPixelsPerSecond: viewport.pixelsPerSecond,
        nextPixelsPerSecond,
        previousScrollLeft: viewport.scrollLeftPx,
        viewportWidth,
        anchorTicks,
        anchorViewportX: anchorX,
        compositionDurationTicks: model.durationTicks,
      }),
      viewportWidthPx: viewportWidth,
    }))
  }

  const scheduleHorizontalZoom = (nextPixelsPerSecond: number) => {
    pendingHorizontalZoomRef.current = nextPixelsPerSecond
    if (horizontalZoomFrameRef.current !== null) return
    horizontalZoomFrameRef.current = requestAnimationFrame(() => {
      horizontalZoomFrameRef.current = null
      const pending = pendingHorizontalZoomRef.current
      pendingHorizontalZoomRef.current = null
      if (pending !== null) changeZoom(pending)
    })
  }

  const changeVerticalZoom = (nextBasisPoints: number) => {
    const anchor = selectedTrackId
      ? timelineRef.current?.querySelector<HTMLElement>(`[data-track-id="${selectedTrackId}"]`)
      : viewportGridRef.current
    const beforeRect = anchor?.getBoundingClientRect()
    const beforeCenter = beforeRect ? beforeRect.top + beforeRect.height / 2 : null
    onVerticalZoomChange(createVerticalZoom(nextBasisPoints))

    if (beforeCenter === null || typeof window === 'undefined') return
    if (verticalAnchorFrameRef.current !== null) cancelAnimationFrame(verticalAnchorFrameRef.current)
    verticalAnchorFrameRef.current = requestAnimationFrame(() => {
      verticalAnchorFrameRef.current = requestAnimationFrame(() => {
        verticalAnchorFrameRef.current = null
        const afterAnchor = selectedTrackId
          ? timelineRef.current?.querySelector<HTMLElement>(`[data-track-id="${selectedTrackId}"]`)
          : viewportGridRef.current
        const afterRect = afterAnchor?.getBoundingClientRect()
        if (!afterRect || typeof window.scrollBy !== 'function') return
        const afterCenter = afterRect.top + afterRect.height / 2
        if (Math.abs(afterCenter - beforeCenter) > 0.5) window.scrollBy(0, afterCenter - beforeCenter)
      })
    })
  }

  const scheduleVerticalZoom = (nextBasisPoints: number) => {
    pendingVerticalZoomRef.current = nextBasisPoints
    if (verticalZoomFrameRef.current !== null) return
    verticalZoomFrameRef.current = requestAnimationFrame(() => {
      verticalZoomFrameRef.current = null
      const pending = pendingVerticalZoomRef.current
      pendingVerticalZoomRef.current = null
      if (pending !== null) changeVerticalZoom(pending)
    })
  }

  const fitTimeline = () => {
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

  const fitTracks = () => {
    const currentHeight = viewportGridRef.current?.clientHeight ?? 0
    const availableEffectiveHeight = Math.max(120, currentHeight - 24)
    const availableBaseHeight = Math.round(
      availableEffectiveHeight * DEFAULT_VERTICAL_ZOOM_BASIS_POINTS / verticalZoom.scaleBasisPoints,
    )
    onTrackPresentationChange(fitTrackHeights(trackPresentation, availableBaseHeight))
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

  const commitPrecisionRequest = (request: PrecisionTrimRequestV1): boolean => {
    if (busy) return false
    const plan = onPrecisionPreview(request)
    if (!plan.ok) return false
    onPrecisionCommit(plan)
    return true
  }

  const trimSelectionToPlayhead = (mode: 'standard-trim' | 'ripple-trim', edge: 'start' | 'end'): boolean => {
    if (!selectedItem || selectedItem.kind !== 'clip' || selectedItem.clipId === null) return false
    const start = selectedItem.startTicks
    const end = start + selectedItem.durationTicks
    if (playheadTicks <= start || playheadTicks >= end) return false
    const deltaTicks = edge === 'start' ? playheadTicks - start : playheadTicks - end
    return commitPrecisionRequest(Object.freeze({ mode, clipId: selectedItem.clipId, edge, deltaTicks }))
  }

  const extendNearestEditToPlayhead = (): boolean => {
    const video = model.lanes.find((lane) => lane.kind === 'video')
    if (!video) return false
    const clips = [...video.items]
      .filter((item) => item.kind === 'clip' && item.clipId !== null && item.state === 'committed')
      .sort((a, b) => a.startTicks - b.startTicks || a.id.localeCompare(b.id))
    const cuts = clips.flatMap((left, index) => {
      const right = clips[index + 1]
      if (!right || left.startTicks + left.durationTicks !== right.startTicks) return []
      return [Object.freeze({ left, right, ticks: right.startTicks })]
    })
    const nearest = cuts
      .map((cut) => Object.freeze({ ...cut, distance: Math.abs(cut.ticks - playheadTicks) }))
      .sort((a, b) => a.distance - b.distance || a.ticks - b.ticks)[0]
    if (!nearest || nearest.ticks === playheadTicks) return false
    const editPoint = Object.freeze({
      trackId: video.id,
      leftItemId: nearest.left.id,
      rightItemId: nearest.right.id,
      compositionTicks: nearest.ticks,
    }) satisfies TimelineEditPointRefV1
    setSelectedEditPoints(Object.freeze([editPoint]))
    return commitPrecisionRequest(Object.freeze({
      mode: 'roll',
      leftClipId: nearest.left.clipId as string,
      rightClipId: nearest.right.clipId as string,
      deltaTicks: playheadTicks - nearest.ticks,
    }))
  }

  const runPrecisionCommand = (command: TimelinePrecisionCommand) => {
    switch (command) {
      case 'trim-start-playhead':
        trimSelectionToPlayhead('standard-trim', 'start')
        return
      case 'trim-end-playhead':
        trimSelectionToPlayhead('standard-trim', 'end')
        return
      case 'ripple-trim-start-playhead':
        trimSelectionToPlayhead('ripple-trim', 'start')
        return
      case 'ripple-trim-end-playhead':
        trimSelectionToPlayhead('ripple-trim', 'end')
        return
      case 'extend-edit':
        extendNearestEditToPlayhead()
    }
  }

  const applyNumericPrecision = (intent: NumericPrecisionIntentV1): string | null => {
    let request: PrecisionTrimRequestV1 | null = null
    if (precisionTool === 'roll') {
      if (selectedEditPoints.length !== 1) return 'Select one Roll edit point first.'
      const point = selectedEditPoints[0]
      const leftClipId = clipIdForItemId(point.leftItemId)
      const rightClipId = clipIdForItemId(point.rightItemId)
      if (!leftClipId || !rightClipId) return 'That edit point is no longer available.'
      request = Object.freeze({ mode: 'roll', leftClipId, rightClipId, deltaTicks: intent.resolvedTicks })
    } else if (precisionTool === 'slip' || precisionTool === 'slide') {
      if (!selectedItem?.clipId) return 'Select one main-video piece first.'
      const deltaTicks = intent.field === 'composition-start'
        ? intent.resolvedTicks - selectedItem.startTicks
        : intent.resolvedTicks
      request = Object.freeze({ mode: precisionTool, clipId: selectedItem.clipId, deltaTicks })
    } else if (precisionTool === 'standard-trim' || precisionTool === 'ripple-trim') {
      if (!selectedItem?.clipId) return 'Select one main-video piece first.'
      const currentEnd = selectedItem.startTicks + selectedItem.durationTicks
      const edge = intent.field === 'composition-start' ? 'start' as const : 'end' as const
      const deltaTicks = intent.field === 'composition-start'
        ? intent.resolvedTicks - selectedItem.startTicks
        : intent.field === 'composition-end'
          ? intent.resolvedTicks - currentEnd
          : intent.resolvedTicks
      request = Object.freeze({ mode: precisionTool, clipId: selectedItem.clipId, edge, deltaTicks })
    } else {
      return 'Rate Stretch keeps its own exact speed controls in the existing Speed panel.'
    }
    if (request.deltaTicks === 0) return 'That value would not change the edit.'
    const plan = previewPrecisionRequest(request)
    if (!plan.ok) return plan.refusal.message
    onPrecisionCommit(plan)
    return null
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
      if (dynamicTrim.active) {
        setDynamicTrim(EMPTY_DYNAMIC_TRIM)
        setDynamicTrimPlan(null)
        onShuttleKey('K')
      } else if (marquee) endMarquee(false)
      else if (contextMenu) setContextMenu(null)
      else onSelectionChange(EMPTY_SELECTION)
      return
    }

    if (dynamicTrim.active && event.key === 'Enter') {
      event.preventDefault()
      commitDynamicTrim()
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
        onMultiGesture({ type: 'move', deltaTicks: direction * frameTicks })
        return
      }
      if (selectedItem) {
        onItemAction(selectedItem.id, {
          type: 'move',
          toStartTicks: Math.max(0, selectedItem.startTicks + direction * frameTicks),
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
        changeZoom(nextHorizontalZoom(viewport.pixelsPerSecond, 1))
        return
      case 'zoom-out':
        changeZoom(nextHorizontalZoom(viewport.pixelsPerSecond, -1))
        return
      case 'fit':
        fitTimeline()
        return
      case 'go-to-start':
        onSeek(0)
        return
      case 'go-to-end':
        onSeek(model.durationTicks)
        return
      case 'tool-standard-trim':
      case 'tool-ripple-trim':
      case 'tool-roll':
      case 'tool-slip':
      case 'tool-slide':
      case 'tool-rate-stretch': {
        const next: TimelinePrecisionToolV1 = command === 'tool-standard-trim'
          ? 'standard-trim'
          : command === 'tool-ripple-trim'
            ? 'ripple-trim'
            : command === 'tool-roll'
              ? 'roll'
              : command === 'tool-slip'
                ? 'slip'
                : command === 'tool-slide'
                  ? 'slide'
                  : 'rate-stretch'
        setPrecisionTool(next)
        setRateStretchActive(next === 'rate-stretch')
        setTool('trim')
        return
      }
      case 'trim-start-playhead':
        trimSelectionToPlayhead('standard-trim', 'start')
        return
      case 'trim-end-playhead':
        trimSelectionToPlayhead('standard-trim', 'end')
        return
      case 'ripple-trim-start-playhead':
        trimSelectionToPlayhead('ripple-trim', 'start')
        return
      case 'ripple-trim-end-playhead':
        trimSelectionToPlayhead('ripple-trim', 'end')
        return
      case 'extend-edit':
        extendNearestEditToPlayhead()
        return
      case 'shuttle-reverse':
        onShuttleKey('J')
        return
      case 'shuttle-stop':
        onShuttleKey('K')
        return
      case 'shuttle-forward':
        onShuttleKey('L')
        return
      case 'dynamic-trim':
        toggleDynamicTrim()
        return
      case 'toggle-audio-scrubbing':
        onAudioScrubbingChange(!audioScrubbingEnabled)
        return
      case 'nudge-left':
        if (dynamicTrim.active) previewDynamicDelta(dynamicTrim.previewDeltaTicks - frameTicks)
        else onSeek(Math.max(0, playheadTicks - frameTicks))
        return
      case 'nudge-right':
        if (dynamicTrim.active) previewDynamicDelta(dynamicTrim.previewDeltaTicks + frameTicks)
        else onSeek(Math.min(model.durationTicks, playheadTicks + frameTicks))
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
        verticalZoom={verticalZoom}
        selectedSummary={selectedItem ? `${selectedItem.label} · ${selectedItem.kind}` : null}
        selectedCount={selection.itemIds.length}
        disabledReasons={disabledReasons}
        shortcuts={shortcuts}
        tool={tool}
        precisionTool={precisionTool}
        snappingEnabled={snappingEnabled}
        placementMode={placementMode}
        busy={busy}
        onTool={setTool}
        onPrecisionTool={(next) => {
          setPrecisionTool(next)
          setRateStretchActive(next === 'rate-stretch')
          setTool('trim')
        }}
        onPrecisionCommand={runPrecisionCommand}
        onAction={runToolbarAction}
        onToggleSnapping={onToggleSnapping}
        onPlacementMode={onPlacementMode}
        onZoomOut={() => changeZoom(nextHorizontalZoom(viewport.pixelsPerSecond, -1))}
        onZoomIn={() => changeZoom(nextHorizontalZoom(viewport.pixelsPerSecond, 1))}
        onHorizontalZoom={scheduleHorizontalZoom}
        onReduceTrackHeight={() => changeVerticalZoom(verticalZoom.scaleBasisPoints - VERTICAL_ZOOM_STEP_BASIS_POINTS)}
        onIncreaseTrackHeight={() => changeVerticalZoom(verticalZoom.scaleBasisPoints + VERTICAL_ZOOM_STEP_BASIS_POINTS)}
        onVerticalZoom={scheduleVerticalZoom}
        onFitTimeline={fitTimeline}
        onFitTracks={fitTracks}
        onResetVerticalZoom={() => changeVerticalZoom(DEFAULT_VERTICAL_ZOOM_BASIS_POINTS)}
      />

      <div className="timeline-v1__precision-status" role="group" aria-label="Precision trim playback">
        <button
          type="button"
          className="timeline-v1__precision-status-button"
          aria-pressed={dynamicTrim.active}
          disabled={!dynamicTrim.active && selectedEditPoints.length !== 1}
          title={dynamicTrim.active ? 'Leave Dynamic Trim without changing the project.' : 'Select one Roll edit point, then enter Dynamic Trim.'}
          onClick={toggleDynamicTrim}
        >
          Dynamic Trim
        </button>
        <button
          type="button"
          className="timeline-v1__precision-status-button"
          aria-pressed={audioScrubbingEnabled}
          onClick={() => onAudioScrubbingChange(!audioScrubbingEnabled)}
        >
          Audio Scrubbing
        </button>
        <TimelinePrecisionPopover
          item={selectedItem}
          editPoint={selectedEditPoints.length === 1 ? selectedEditPoints[0] : null}
          precisionTool={precisionTool}
          timescale={model.timescale}
          durationTicks={model.durationTicks}
          frameRate={frameRate}
          busy={busy}
          onApply={applyNumericPrecision}
        />
        <output className="timeline-v1__precision-status-output" aria-live="polite">
          {dynamicTrim.active
            ? `Dynamic Trim ${dynamicTrim.state}${dynamicTrim.message ? ` — ${dynamicTrim.message}` : ''}. Enter commits; Escape cancels.`
            : shuttleState.direction === 0
              ? 'Shuttle stopped'
              : `Shuttle ${shuttleState.direction < 0 ? 'backwards' : 'forwards'} ${shuttleState.rate}x`}
        </output>
      </div>

      {precisionDraft?.ok ? (
        <TimelineTrimView
          frames={trimViewFrames}
          timescale={model.timescale}
          mode={precisionDraft.feedback.mode}
          deltaTicks={precisionDraft.feedback.appliedDeltaTicks}
        />
      ) : null}

      <TimelineSpeedPanel
        open={speedPanelOpen}
        clipLabel={speedSubject?.clipLabel ?? null}
        unavailableReason={speedSubject === null ? disabledReasons.speed : null}
        currentRate={speedSubject?.currentRate ?? NORMAL_PLAYBACK_RATE}
        direction={speedSubject?.direction ?? 'forward'}
        maintainAudioPitch={speedSubject?.maintainAudioPitch ?? true}
        currentDurationTicks={speedSubject?.currentDurationTicks ?? 0}
        sourceDurationTicks={speedSubject?.sourceDurationTicks ?? 0}
        timescale={model.timescale}
        busy={busy}
        rateStretchActive={rateStretchActive}
        onRateStretchActive={(active) => {
          setRateStretchActive(active)
          if (active) {
            setPrecisionTool('rate-stretch')
            setTool('trim')
          } else if (precisionTool === 'rate-stretch') {
            setPrecisionTool('standard-trim')
          }
        }}
        previewFor={onSpeedPreview}
        onChoose={(rate, keepPitch, direction) => {
          onSpeedChoose(rate, keepPitch, direction)
          setSpeedPanelOpen(false)
        }}
        onClose={() => setSpeedPanelOpen(false)}
      />

      <TimelineTransitionPanel
        open={transitionPanelOpen}
        subject={transitionSubject}
        busy={busy}
        onApply={(style, durationTicks, audio) => {
          onTransitionApply(style, durationTicks, audio)
          setTransitionPanelOpen(false)
        }}
        onClose={() => setTransitionPanelOpen(false)}
      />

      <TimelineLinkedAudioPanel
        open={linkedAudioPanelOpen}
        subject={linkedAudioSubject}
        busy={busy}
        onApply={(leadTicks, tailTicks) => {
          onLinkedAudioApply(leadTicks, tailTicks)
          setLinkedAudioPanelOpen(false)
        }}
        onClose={() => setLinkedAudioPanelOpen(false)}
      />

      <TimelineFreezePanel
        open={freezePanelOpen}
        clipLabel={freezeClipLabel}
        unavailableReason={freezeUnavailableReason}
        busy={busy}
        onApply={(durationTicks) => {
          onFreezeApply(durationTicks)
          setFreezePanelOpen(false)
        }}
        onClose={() => setFreezePanelOpen(false)}
      />

      {animationSubject ? (
        <div className="timeline-animation__target-bar" role="group" aria-label="Selected item animation">
          <button
            type="button"
            aria-pressed={animationTargetExpanded(animationPresentation, animationSubject.target)}
            aria-label={animationTargetExpanded(animationPresentation, animationSubject.target) ? 'Collapse Animation' : 'Expand Animation'}
            title={animationSubject.sourceAnchored ? 'Source animation — follows this footage wherever this source range is used.' : 'Show editor animation for this item.'}
            onClick={() => changeAnimationPresentation(animationPresentationForTarget(
              animationPresentation,
              animationSubject.target,
              !animationTargetExpanded(animationPresentation, animationSubject.target),
            ))}
          >
            <span aria-hidden="true">◇</span>
            {animationTargetExpanded(animationPresentation, animationSubject.target) ? 'Collapse Animation' : 'Expand Animation'}
          </button>
          <span>{animationSubject.label}</span>
          {animationSubject.state.tracks.length > 0 ? <span>{animationSubject.state.tracks.length} animated propert{animationSubject.state.tracks.length === 1 ? 'y' : 'ies'}</span> : <span>No animation yet</span>}
          <button
            type="button"
            aria-pressed={animationPresentation.graphOpen}
            disabled={animationSubject.state.tracks.length === 0}
            onClick={() => changeAnimationPresentation(Object.freeze({ ...animationPresentation, graphOpen: !animationPresentation.graphOpen }))}
          >
            {animationPresentation.graphOpen ? 'Close Graph' : 'Open Graph'}
          </button>
        </div>
      ) : null}
      {animationNotice ? <p className="timeline-animation__notice" role="status">{animationNotice}</p> : null}

      <div ref={viewportGridRef} className="timeline-v1__viewport-grid">
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
                heightPx={effectiveTrackHeightPx(
                  trackPresentation,
                  verticalZoom,
                  trackId,
                  laneHeightPx(lane.kind, windowWidthPx),
                )}
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
                  projectId={model.projectId}
                  assetFacts={assetFacts ?? EMPTY_ASSET_FACTS}
                  muted={trackOutputs[trackIdForLane(lane.id)] === false}
                  layoutWidthPx={windowWidthPx}
                  heightPx={effectiveTrackHeightPx(
                    trackPresentation,
                    verticalZoom,
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
                  rateStretchActive={rateStretchActive && soleSelectedId !== null && lane.kind === 'video'}
                  frameTicks={frameTicks}
                  precisionTool={precisionTool}
                  selectedEditPoints={selectedEditPoints}
                  onEditPointSelect={selectEditPoint}
                  onPrecisionPreview={previewPrecisionRequest}
                  onPrecisionDraft={setPrecisionDraft}
                  onPrecisionCommit={onPrecisionCommit}
                  onRateStretchPreview={onRateStretchPreview}
                  onRateStretchCommit={onRateStretchCommit}
                  pointerTicks={pointerTicks}
                  pointerTime={pointerTime}
                  onSnapGuide={setSnapGuideTicks}
                  onSelect={selectItem}
                  animatedItemIds={animatedItemIds}
                  onAnimationBadgeClick={(itemId) => {
                    setPendingAnimationExpandItemId(itemId)
                    selectItem(itemId)
                  }}
                  onClearSelection={() => onSelectionChange(EMPTY_SELECTION)}
                  onSeek={onSeek}
                  onGesture={onGesture}
                  onItemAction={routeItemAction}
                  onOpenProposal={onOpenProposal}
                  onContextMenu={openContextMenu}
                />
              ))}
              {animationSubject && animationTargetExpanded(animationPresentation, animationSubject.target) ? (
                <TimelineAnimationLanes
                  subject={animationSubject}
                  presentation={animationPresentation}
                  selection={keyframeSelection}
                  clipboard={animationClipboard}
                  visibleRange={visibleRange}
                  overscanTicks={overscanTicks}
                  pixelsPerSecond={viewport.pixelsPerSecond}
                  timescale={model.timescale}
                  playheadTicks={playheadTicks}
                  frameTicks={frameTicks}
                  frameRate={frameRate}
                  compositionDurationTicks={model.durationTicks}
                  busy={busy}
                  onPresentationChange={changeAnimationPresentation}
                  onSelectionChange={onKeyframeSelectionChange}
                  onClipboardChange={setAnimationClipboard}
                  onDraft={onAnimationDraft}
                  onCommit={onAnimationCommit}
                  onSeek={onSeek}
                  onNotice={(message) => {
                    setAnimationNotice(message)
                    if (message) setContextMenu(null)
                  }}
                />
              ) : null}
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

      {animationSubject && animationPresentation.graphOpen ? (
        <TimelinePropertyGraphView
          subject={animationSubject}
          presentation={animationPresentation}
          selection={keyframeSelection}
          busy={busy}
          onPresentationChange={changeAnimationPresentation}
          onSelectionChange={onKeyframeSelectionChange}
          onDraft={onAnimationDraft}
          onCommit={onAnimationCommit}
          onNotice={setAnimationNotice}
        />
      ) : null}

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
