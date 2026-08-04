import { useEffect, useMemo, useRef, useState } from 'react'
import type { AddNameplateOperation, EditProject, TimelineOperation } from '@sanverse/edit-domain'
import {
  DEFAULT_CAPTION_STYLE_ID,
  DEFAULT_TITLE_STYLE_ID,
  activeOverlayOperations,
  type EditOperation,
  type MediaAsset,
  PROJECT_TIMESCALE,
  TICKS_PER_MILLISECOND as TICKS_PER_MS,
  clipAtCompositionTime,
  compositionDuration,
  effectiveComposition,
  effectiveFootageMotions,
  isTimelineOperation,
  mediaTime,
  toMilliseconds,
  createIdFactory,
  activeTrackOutputs,
  OPERATION_SCHEMA_VERSION,
  type SetFootageMotionOperation,
} from '@sanverse/edit-domain'
import { TRACK_OUTPUT_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import { proposalPlacement } from '../../app/app-state'
import type { ConversationState, PendingProposal, ProposalRepair, StudioState } from '../../app/app-state'
import { ChatComposer } from '../../features/conversation/ChatComposer'
import type { IntentContextInput } from '../../features/conversation/conversation-client'
import { NameplateRepair } from '../../features/proposal-repair/NameplateRepair'
import { describeOperation } from '../../features/history/describe-operation'
import {
  TIMELINE_LOCK_SCHEMA_VERSION,
  adaptTimelineGesture,
  buildTimelineViewModel,
  laneSpans,
  planTimelineItemAction,
  planTimelinePlacement,
  readTimelineLockState,
  trackIdForLane,
  writeTimelineLockState,
  type PlacementMode,
  type TimelineGesture,
  type TimelineItemAction,
  type TimelineTrackId,
  type TimelineViewportState,
} from '../../features/timeline'
import {
  advancePlayback,
  isUncutPassthrough,
  nextVisibleTick,
  playbackSegments,
  sourceTimeFor,
  type PlaybackSegment,
} from '../../features/render-plan/segment-playback'
import {
  captionCssVariables,
  compilePreviewPlan,
  millisecondsToTicks,
  nameplateCssVariables,
  segmentVideoOpacityAt,
  visibleCallouts,
  visibleCaptions,
  visibleMediaOverlays,
  visibleTitles,
  titleCssVariables,
  visualCssStyleAt,
  visualCssStyleFromPropertiesAt,
  visibleNameplates,
  withPendingProposal,
} from '../../features/render-plan/render-plan-preview'
import {
  drawFootageMotionFrame,
  footageMotionAtCompositionTime,
  footageMotionDrawnToken,
  forgetFootageMotionFrame,
} from '../../features/render-plan/footage-motion-preview'
import {
  FootageMotionInspector,
  buildFootageMotionOperation,
  createWideFootageMotionDraft,
  footageMotionDraftFromOperation,
  type FootageMotionDraft,
} from '../../features/footage-motion/FootageMotionInspector'
import { PrimaryFootageCanvasControls } from '../../features/footage-motion/PrimaryFootageCanvasControls'
import { formatExportElapsed, type ProjectExportState } from '../../features/project-export/project-export'
import { ExportProgressStatus } from '../../features/project-export/ExportProgressStatus'
import { HAVE_CURRENT_DATA } from '../../features/render-plan/media-readiness'
import {
  monitorBaseFrameMessage,
  type MonitorBaseFrameState,
} from '../../editor/monitor/monitor-base-frame'
import {
  motionCanvasFrameToken,
  resolveMonitorBaseLayer,
  showsGapLayer,
  showsMotionCanvas,
} from '../../editor/monitor/monitor-base-layer'
import { NameplateComposer } from '../../features/nameplate/NameplateComposer'
import { NameplateOverlay } from '../../features/nameplate/NameplateOverlay'
import { CaptionOverlay } from '../../features/captions/CaptionOverlay'
import { AddOverlayPanel } from '../../features/overlays/AddOverlayPanel'
import { OverlayRepairPanel } from '../../features/overlays/OverlayRepairPanel'
import { CalloutOverlay, MediaOverlay, TitleOverlay } from '../../features/overlays/OverlayLayers'
import {
  AssistChangeStrip,
  AssistProposalPanel,
  buildAssistChangeItems,
} from '../../editor/assist'
import {
  Inspector,
  requestInspectorSelectionChange,
  resolveInspectorSelection,
} from '../../editor/inspector'
import {
  CanvasInteractionLayer,
  resolveCanvasSelection,
  useSharedVisualDraft,
  type CanvasHitTarget,
} from '../../editor/canvas'
import { Timeline, reconcileTimelineSelection } from '../../editor/timeline'
import { MediaBin } from '../../editor/media'
import {
  MonitorSafeAreas,
  SanverseEditorMonitor,
  frameStepTicks,
  resolveMonitorContentRect,
  type MonitorFitMode,
} from '../../editor/monitor'
import {
  WorkspacePresetMenu,
  StudioWorkspacePanel,
  type StudioWorkspace,
} from '../../editor/workspace'
import {
  StudioLayoutV2,
  STUDIO_LAYOUT_PRESETS,
  adaptStudioLayoutToViewport,
  defaultStudioLayoutV2,
  loadStudioLayoutV2,
  saveStudioLayoutV2,
  STUDIO_BREAKPOINTS,
  subscribeStudioResponsiveMode,
  useStudioResponsiveMode,
  type StudioLayoutV2State,
} from '../../editor/layout-v2'
import {
  buildAddAsBrollOperation,
  buildAddAsMusicOperation,
  buildMediaBinViewModel,
  createMediaActionIds,
  deriveAssetDisplayLabels,
  EMPTY_MEDIA_PRESENTATION,
  probeMediaAssetStatuses,
  type MediaAssetSource,
  type MediaPresentationState,
  type MediaSourceProbe,
  type MediaStatus,
  MEDIA_DRAG_ENABLED,
  MEDIA_DRAG_MIME,
  parseMediaDragPayload,
  type MediaDragPayloadV1,
} from '../../features/media'
import { useMediaOrganization } from '../../features/media/use-media-organization'
import {
  formatPointTargetTime,
  type CapturedPointTarget,
} from '../../features/point-target/point-target'
import './StudioScreen.css'
import type { EditorWorkspace } from '../../editor/EditorShell'

const EMPTY_ASSET_ORIGINAL_NAMES: Readonly<Record<string, string>> = Object.freeze({})

export type StudioScreenProps = {
  embedded?: boolean
  workspace?: EditorWorkspace
  studioWorkspace?: StudioWorkspace
  project: StudioState['project']
  proposal: PendingProposal | null
  conversation: ConversationState
  conversationDraft?: string
  onConversationDraftChange?(draft: string): void
  editProject: EditProject
  editError: string | null
  assetOriginalNames?: Readonly<Record<string, string>>
  onProposal(proposal: AddNameplateOperation): void
  onDiscardProposal(): void
  onAcceptProposal(): void
  onRepairProposal(repair: ProposalRepair): void
  /** Apply one cut immediately. The server decides the resulting revision. */
  onTimelineEdit(operation: TimelineOperation): void
  /**
   * Hand a transcript file's text to the server and adopt what comes back.
   * Resolves to a plain sentence when it could not be used, or null on success.
   */
  onAddCaptions(transcript: string): Promise<string | null>
  /**
   * Accept one new title, callout, B-roll clip, or piece of music.
   * Resolves to a plain sentence when it could not be used, or null on success.
   */
  onCreateOverlay(operation: EditOperation): Promise<string | null>
  /**
   * Several operations as ONE change set, and therefore one Undo.
   *
   * Inserting a clip and pushing four others along is one thing the user did,
   * so it is one thing the server accepts and one thing Undo takes back. Sending
   * five separate change sets would leave four of them applied if the fifth
   * were refused, which is the exact half-finished state Gate C0 removed.
   */
  onApplyOperations(operations: readonly EditOperation[], changeSetId: string): Promise<string | null>
  /** Put one file on the project's shelf, and say what it turned out to be. */
  onUploadAsset(file: File): Promise<MediaAsset | string>
  /** Where each extra file can be fetched from, for the preview. */
  assetUrl(assetId: string): string
  /** App-owned availability check. Media UI never calls project APIs directly. */
  probeAssetSource?: MediaSourceProbe
  onSendMessage(message: string, context: IntentContextInput): void
  onUndo(): void
  onRedo(): void
  exportState: ProjectExportState
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  onExport(): void
  onBack(): void
  onWorkspaceChange?(workspace: EditorWorkspace): void
  onStudioWorkspaceChange?(workspace: StudioWorkspace): void
}

const EXPORT_DESCRIPTION = 'studio-export-description'
const KEYBOARD_POINT_STEP = 0.05

/**
 * Every media event that can change what the base picture layer is doing.
 *
 * Playback readiness is never inferred from toolbar state. A button says what
 * the user asked for; these say what the element actually did, and the gap
 * between the two is where an unexplained black frame lives.
 */
const MEDIA_READINESS_EVENTS = [
  'loadstart',
  'loadedmetadata',
  'loadeddata',
  'canplay',
  'canplaythrough',
  'play',
  'playing',
  'waiting',
  'pause',
  'seeking',
  'seeked',
  'ended',
  'stalled',
  'suspend',
  'error',
] as const

function createClipId() {
  const bytes = new Uint32Array(2)
  globalThis.crypto.getRandomValues(bytes)
  return `clip_${Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('')}`.slice(0, 24)
}

function createOperationId() {
  const bytes = new Uint32Array(4)
  globalThis.crypto.getRandomValues(bytes)
  return `operation_${Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('')}`.slice(0, 42)
}

function createChangeSetId() {
  const bytes = new Uint32Array(4)
  globalThis.crypto.getRandomValues(bytes)
  return `changeset_${Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('')}`.slice(0, 42)
}

function createMotionId() {
  const bytes = new Uint32Array(4)
  globalThis.crypto.getRandomValues(bytes)
  return `motion_${Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('')}`.slice(0, 39)
}

type NormalizedPoint = Pick<CapturedPointTarget, 'x' | 'y'>

function clampNormalized(value: number) {
  return Math.min(1, Math.max(0, value))
}

function roundCssPercentage(value: number) {
  return Number(value.toFixed(6))
}

function formatDuration(durationMs: number) {
  const seconds = durationMs / 1_000
  const value = Number.isInteger(seconds)
    ? String(seconds)
    : seconds.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `${value} ${seconds === 1 ? 'second' : 'seconds'}`
}

function videoLayoutDimensions(video: HTMLVideoElement) {
  return video.videoWidth > 0 && video.videoHeight > 0
    ? { width: video.videoWidth, height: video.videoHeight }
    : { width: 16, height: 9 }
}

function monitorGeometry(video: HTMLVideoElement, fitMode: MonitorFitMode) {
  const elementBox = video.getBoundingClientRect()
  const dimensions = videoLayoutDimensions(video)
  return resolveMonitorContentRect({
    stageRect: { left: elementBox.left, top: elementBox.top, width: elementBox.width, height: elementBox.height },
    sourceWidth: dimensions.width,
    sourceHeight: dimensions.height,
    fitMode,
  })
}

function projectPointOntoVideoElement(point: NormalizedPoint, video: HTMLVideoElement, fitMode: MonitorFitMode) {
  const elementBox = video.getBoundingClientRect()
  const geometry = monitorGeometry(video, fitMode)
  if (!geometry || elementBox.width <= 0 || elementBox.height <= 0) return null
  const contentBox = geometry.displayedContentRect

  return {
    left: roundCssPercentage(
      ((contentBox.left - elementBox.left + point.x * contentBox.width) / elementBox.width) *
        100,
    ),
    top: roundCssPercentage(
      ((contentBox.top - elementBox.top + point.y * contentBox.height) / elementBox.height) * 100,
    ),
  }
}

function getVideoContentLayerStyle(video: HTMLVideoElement, fitMode: MonitorFitMode) {
  const elementBox = video.getBoundingClientRect()
  const geometry = monitorGeometry(video, fitMode)
  if (!geometry || elementBox.width <= 0 || elementBox.height <= 0) return null
  const contentBox = geometry.displayedContentRect

  return {
    left: `${roundCssPercentage(((contentBox.left - elementBox.left) / elementBox.width) * 100)}%`,
    top: `${roundCssPercentage(((contentBox.top - elementBox.top) / elementBox.height) * 100)}%`,
    width: `${roundCssPercentage((contentBox.width / elementBox.width) * 100)}%`,
    height: `${roundCssPercentage((contentBox.height / elementBox.height) * 100)}%`,
  }
}

export function StudioScreen({
  embedded = false,
  workspace = 'studio',
  studioWorkspace = 'edit',
  project,
  proposal,
  conversation,
  conversationDraft: controlledConversationDraft,
  onConversationDraftChange,
  editProject,
  editError,
  assetOriginalNames = EMPTY_ASSET_ORIGINAL_NAMES,
  onProposal,
  onDiscardProposal,
  onAcceptProposal,
  onRepairProposal,
  onTimelineEdit,
  onAddCaptions: onAddCaptionsText,
  onCreateOverlay,
  onApplyOperations,
  onUploadAsset,
  assetUrl,
  probeAssetSource,
  onSendMessage,
  onUndo,
  onRedo,
  exportState,
  saveState,
  onExport,
  onBack,
  onWorkspaceChange,
  onStudioWorkspaceChange,
}: StudioScreenProps) {
  const draftRequest = project.draftRequest.trim()
  const [hasPreviewError, setHasPreviewError] = useState(false)
  const [isPointMode, setIsPointMode] = useState(false)
  // True when Point is being used to move an existing proposal rather than to
  // start a new one, so capturing a point repairs instead of replacing.
  const [isMovingProposalPoint, setIsMovingProposalPoint] = useState(false)
  const [pointTarget, setPointTarget] = useState<CapturedPointTarget | null>(null)
  const [draftPoint, setDraftPoint] = useState<NormalizedPoint>({ x: 0.5, y: 0.5 })
  /**
   * The media drag currently in the air, so lanes can show whether they will
   * take it BEFORE the user lets go.
   *
   * Read from a document-level `dragstart` in the bubble phase: the row that
   * started the drag has already written the payload by then, and `getData` is
   * only permitted during `dragstart` and `drop` — never during `dragover`,
   * which is exactly when a lane needs to know. So it is captured once, here.
   *
   * This is presentation state and nothing else. It creates no operation, no
   * request, and no history entry, and it is cleared whether the drag ends in
   * a drop or is abandoned.
   */
  const [mediaDragInFlight, setMediaDragInFlight] = useState<MediaDragPayloadV1 | null>(null)

  useEffect(() => {
    if (!MEDIA_DRAG_ENABLED) return
    const begin = (event: DragEvent) => {
      const payload = parseMediaDragPayload(event.dataTransfer?.getData(MEDIA_DRAG_MIME))
      if (payload) setMediaDragInFlight(payload)
    }
    const end = () => setMediaDragInFlight(null)
    document.addEventListener('dragstart', begin)
    document.addEventListener('dragend', end)
    document.addEventListener('drop', end)
    return () => {
      document.removeEventListener('dragstart', begin)
      document.removeEventListener('dragend', end)
      document.removeEventListener('drop', end)
    }
  }, [])

  /**
   * Locked lanes. Presentation state on purpose: a padlock protects the track
   * from you and changes nothing about the exported file, so it must not move
   * the revision. If it did, clicking a padlock would be an Undo step and would
   * change the export key, re-encoding an identical video for a minute and a
   * half. Hiding a track is the opposite and belongs in the project.
   */
  const [lockedTrackIds, setLockedTrackIds] = useState<readonly TimelineTrackId[]>([])

  /**
   * How a drop lands, and whether edges snap. Both are workspace preferences,
   * not project data: they change what the NEXT gesture does and nothing about
   * the video as it stands.
   */
  const [timelinePlacementMode, setTimelinePlacementMode] = useState<PlacementMode>('normal')
  const [snappingEnabled, setSnappingEnabled] = useState(true)

  /**
   * Which tracks reach the finished video. Read from the project rather than
   * held separately, so the switch on screen and the switch the exporter obeys
   * are the same fact.
   */
  const trackOutputs = useMemo(() => activeTrackOutputs(editProject), [editProject])

  // Padlocks are remembered per project in this browser. They are read once
  // when a project opens, and never sent to the server: they are about this
  // person's mouse, not about the video.
  useEffect(() => {
    setLockedTrackIds(readTimelineLockState(editProject.projectId).lockedTrackIds)
  }, [editProject.projectId])

  const [videoLayoutRevision, setVideoLayoutRevision] = useState(0)
  /** The same number, readable from inside the decoder's frame callback. */
  const videoLayoutRevisionRef = useRef(0)
  const [pointError, setPointError] = useState<string | null>(null)
  const [playheadMs, setPlayheadMs] = useState(0)
  const [monitorFitMode, setMonitorFitMode] = useState<MonitorFitMode>('fit')
  const [monitorGuides, setMonitorGuides] = useState(false)
  const [monitorPlaying, setMonitorPlaying] = useState(false)
  const [monitorMuted, setMonitorMuted] = useState(false)
  const [monitorVolume, setMonitorVolume] = useState(1)
  /** True while the finished video is sitting on a deliberately empty stretch. */
  const [isShowingHole, setIsShowingHole] = useState(false)
  /**
   * What the element itself reports, read from real media events rather than
   * inferred from a toolbar button. Toolbar state says what the user asked for;
   * these say what the media is actually doing, and the difference between the
   * two is exactly where an unexplained black frame lives.
   */
  const [videoReadiness, setVideoReadiness] = useState({
    readyState: 0,
    seeking: false,
    hasPresentedFrame: false,
  })
  // Playback state the media effect needs but must not re-subscribe for. The
  // effect is attached once, so what it reads has to arrive through refs.
  const segmentsRef = useRef<readonly PlaybackSegment[]>([])
  const segmentIndexRef = useRef(0)
  const totalTicksRef = useRef(0)
  const inHoleRef = useRef(false)
  const playheadTicksRef = useRef(0)
  const holePlaybackRef = useRef<Readonly<{
    enter(fromTicks: number, untilTicks: number): void
    leave(): void
  }> | null>(null)
  const [proposalResult, setProposalResult] = useState<string | null>(null)
  const [selectedAssistChangeId, setSelectedAssistChangeId] = useState<string | null>(null)
  const [internalConversationDraft, setInternalConversationDraft] = useState('')
  const conversationDraft = controlledConversationDraft ?? internalConversationDraft
  const setConversationDraft = onConversationDraftChange ?? setInternalConversationDraft
  const [compactSidePanel, setCompactSidePanel] = useState<'media' | 'inspector' | null>(null)
  const [selectedTimelineItemId, setSelectedTimelineItemId] = useState<string | null>(null)
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<string | null>(null)
  // Media presentation lives HERE, not inside the Media panel, because the panel
  // is unmounted whenever the user switches workspace. Held here it survives —
  // search text, filter, sort and chosen folder all come back unchanged.
  const [mediaPresentation, setMediaPresentation] = useState<MediaPresentationState>(EMPTY_MEDIA_PRESENTATION)
  const mediaOrganization = useMediaOrganization(project.id)
  const [mediaSourceStatuses, setMediaSourceStatuses] = useState<Readonly<Record<string, MediaStatus>>>({})
  const [pendingPlacedTimelineItemId, setPendingPlacedTimelineItemId] = useState<string | null>(null)
  const [inspectorSectionDirty, setInspectorSectionDirty] = useState(false)
  const [footageMotionDraft, setFootageMotionDraft] = useState<FootageMotionDraft | null>(null)
  const [footageMotionBaseline, setFootageMotionBaseline] = useState<string | null>(null)
  const [pendingTimelineSelection, setPendingTimelineSelection] = useState<Readonly<{ itemId: string | null }> | null>(null)
  const [canvasCropMode, setCanvasCropMode] = useState(false)
  const [proposalCanvasPoint, setProposalCanvasPoint] = useState<NormalizedPoint | null>(null)
  const [canvasNarrow, setCanvasNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 600)
  const [timelineViewport, setTimelineViewport] = useState<TimelineViewportState>(() => Object.freeze({
    pixelsPerSecond: 100,
    scrollLeftPx: 0,
    viewportWidthPx: 0,
  }))
  /** A plain sentence explaining why a timeline edit was not made. */
  const [timelineNotice, setTimelineNotice] = useState<string | null>(null)
  const [trimSeconds, setTrimSeconds] = useState(1)
  const [clipGainDb, setClipGainDb] = useState(0)
  const [fadeInSeconds, setFadeInSeconds] = useState(0)
  const [fadeOutSeconds, setFadeOutSeconds] = useState(0)
  /**
   * The token of the frame the motion canvas is actually holding.
   *
   * Kept in state, not a ref, because the resolver runs during render and has
   * to re-run the moment a draw lands — a ref would update silently and the
   * canvas would stay hidden until something else happened to re-render.
   */
  const [drawnFrameToken, setDrawnFrameToken] = useState<string | null>(null)
  /**
   * The same value, readable from inside the decoder's frame callback.
   *
   * The playback loop draws many times a second. It uses this to notice the one
   * transition that matters — nothing drawn, then something drawn — and calls
   * `setDrawnFrameToken` exactly once for it. Calling React on every decoded
   * frame would re-render the whole Studio at video rate.
   */
  const drawnFrameTokenRef = useRef<string | null>(null)
  const [captionsNotice, setCaptionsNotice] = useState<string | null>(null)
  const [captionsBusy, setCaptionsBusy] = useState(false)
  /**
   * One subscription for the whole Studio, not one resize listener per panel.
   *
   * It also cannot go stale: `useSyncExternalStore` re-reads the real width on
   * every notification, so there is no copy of the mode sitting in state waiting
   * to be forgotten. That staleness was FAIL-047.
   */
  const responsiveMode = useStudioResponsiveMode()
  const [workspaceLayout, setWorkspaceLayout] = useState<StudioLayoutV2State>(() => {
    const currentViewport = typeof window === 'undefined'
      ? Object.freeze({ width: 1440, height: 900 })
      : Object.freeze({ width: window.innerWidth, height: window.innerHeight })
    const loaded = loadStudioLayoutV2(typeof window === 'undefined' ? null : window.localStorage, currentViewport)
    return Object.freeze({ ...loaded, activeWorkspace: studioWorkspace })
  })
  const isAiPanelCollapsed = workspace === 'studio' && workspaceLayout.aiMode === 'collapsed'
  const videoRef = useRef<HTMLVideoElement>(null)
  const footageMotionCanvasRef = useRef<HTMLCanvasElement>(null)
  const footagePlanRef = useRef<ReturnType<typeof compilePreviewPlan>>(null)
  const reducedMotionRef = useRef(false)
  const videoContentLayerRef = useRef<HTMLDivElement>(null)
  const inspectorRegionRef = useRef<HTMLElement>(null)
  const pointModeButtonRef = useRef<HTMLButtonElement>(null)
  const pointLayerRef = useRef<HTMLButtonElement>(null)
  const proposalSummaryRef = useRef<HTMLDivElement>(null)
  const proposalResultRef = useRef<HTMLParagraphElement>(null)
  const exportResultRef = useRef<HTMLElement>(null)
  const pendingProposalResolutionRef = useRef<'accepted' | 'discarded' | null>(null)
  const geometryRefreshFrameRef = useRef<number | null>(null)
  const layoutWriteCountRef = useRef(0)

  const viewport = () => typeof window === 'undefined'
    ? Object.freeze({ width: 1440, height: 900 })
    : Object.freeze({ width: window.innerWidth, height: window.innerHeight })

  const requestGeometryRefresh = () => {
    if (geometryRefreshFrameRef.current !== null) return
    geometryRefreshFrameRef.current = requestAnimationFrame(() => {
      geometryRefreshFrameRef.current = null
      setVideoLayoutRevision((revision) => {
        videoLayoutRevisionRef.current = revision + 1
        return revision + 1
      })
    })
  }

  const persistWorkspaceLayout = (next: StudioLayoutV2State) => {
    if (typeof window === 'undefined') return
    if (saveStudioLayoutV2(window.localStorage, next)) layoutWriteCountRef.current += 1
  }

  const updateWorkspaceLayout = (patch: Partial<Omit<StudioLayoutV2State, 'schemaVersion'>>, persist = false) => {
    setWorkspaceLayout((current) => {
      const next = adaptStudioLayoutToViewport(Object.freeze({ ...current, ...patch }), viewport())
      if (persist) persistWorkspaceLayout(next)
      return next
    })
    requestGeometryRefresh()
  }

  const setAiOpen = (open: boolean) => {
    updateWorkspaceLayout({ aiMode: open ? 'expanded' : 'collapsed' }, true)
  }

  useEffect(() => {
    const update = () => {
      setCanvasNarrow(window.innerWidth <= STUDIO_BREAKPOINTS.mobile)
      setWorkspaceLayout((current) => adaptStudioLayoutToViewport(current, viewport()))
      requestGeometryRefresh()
    }
    update()
    // The mode itself comes from `useStudioResponsiveMode`. This subscription
    // exists only for the geometry refresh and the narrow-canvas flag, and it
    // deliberately uses the SAME subscriber so the two cannot observe different
    // events and therefore different widths.
    return subscribeStudioResponsiveMode(update)
  }, [])

  useEffect(() => {
    setWorkspaceLayout((current) => {
      if (current.activeWorkspace === studioWorkspace) return current
      const next = Object.freeze({ ...current, activeWorkspace: studioWorkspace })
      persistWorkspaceLayout(next)
      return next
    })
    requestGeometryRefresh()
  }, [studioWorkspace])

  useEffect(() => () => {
    if (geometryRefreshFrameRef.current !== null) cancelAnimationFrame(geometryRefreshFrameRef.current)
  }, [])

  useEffect(() => {
    const refresh = () => requestGeometryRefresh()
    document.addEventListener('fullscreenchange', refresh)
    return () => document.removeEventListener('fullscreenchange', refresh)
  }, [])

  useEffect(() => {
    setProposalCanvasPoint(null)
    if (!proposal) setCanvasCropMode(false)
  }, [proposal])

  useEffect(() => {
    if (isPointMode) pointLayerRef.current?.focus()
  }, [isPointMode])

  useEffect(() => {
    if (proposal) proposalSummaryRef.current?.focus()
  }, [proposal])

  useEffect(() => {
    if (proposal) {
      setProposalResult(null)
      return
    }

    const resolution = pendingProposalResolutionRef.current
    if (!resolution) return
    pendingProposalResolutionRef.current = null
    setProposalResult(
      resolution === 'accepted'
        ? 'Proposal accepted.'
        : 'Proposal discarded. Accepted history was not changed.',
    )
  }, [proposal])

  useEffect(() => {
    if (proposalResult) proposalResultRef.current?.focus()
  }, [proposalResult])

  // Export is at the top of the screen and its result is at the bottom, so
  // pressing Export used to look like it had done nothing at all. The result
  // is brought to the user instead of the user having to go looking for it.
  useEffect(() => {
    if (exportState.status === 'idle') return
    const target = exportResultRef.current
    if (!target) return
    target.scrollIntoView?.({ block: 'start' })
    const panel = target.closest<HTMLElement>('.studio-screen__ai-panel-content')
    if (panel) panel.scrollTop = Math.max(0, target.offsetTop - 8)
    if (exportState.status === 'ready' || exportState.status === 'error') target.focus?.()
  }, [exportState.status])

  useEffect(() => {
    if (editError) pendingProposalResolutionRef.current = null
  }, [editError])

  useEffect(() => {
    playheadTicksRef.current = Math.max(0, millisecondsToTicks(playheadMs))
  }, [playheadMs])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const refreshProjection = requestGeometryRefresh
    const drawFootageMotion = (compositionTicks: number) => {
      const canvas = footageMotionCanvasRef.current
      const plan = footagePlanRef.current
      if (!canvas || !plan) return
      const drew = drawFootageMotionFrame({
        canvas,
        video,
        plan,
        compositionTicks,
        reducedMotion: reducedMotionRef.current,
        geometryVersion: videoLayoutRevisionRef.current,
      })
      // One React update on the transition into "the canvas holds something
      // real", not one per decoded frame. While playing, the resolver accepts a
      // real frame of the current source without demanding an exact token
      // match, so React never has to keep pace with the decoder.
      if (drew && drawnFrameTokenRef.current === null) {
        const token = footageMotionDrawnToken(canvas)
        drawnFrameTokenRef.current = token
        setDrawnFrameToken(token)
      }
    }
    const hideFootageMotion = () => {
      const canvas = footageMotionCanvasRef.current
      if (canvas) forgetFootageMotionFrame(canvas)
      drawnFrameTokenRef.current = null
      setDrawnFrameToken(null)
    }

    let holeFrameId: number | null = null
    const leaveHole = () => {
      if (holeFrameId !== null) cancelAnimationFrame(holeFrameId)
      holeFrameId = null
      inHoleRef.current = false
      setIsShowingHole(false)
    }

    /**
     * Sit on black for a stretch that was deliberately left empty.
     *
     * The recording has nothing to play here, so the element is paused and the
     * playhead is advanced by the clock instead. Without this the preview would
     * skip straight over the gap and run shorter than the exported file, which
     * is the preview disagreeing with the export — the exact failure this whole
     * design exists to prevent.
     */
    const enterHole = (fromTicks: number, untilTicks: number) => {
      if (inHoleRef.current) return
      inHoleRef.current = true
      setIsShowingHole(true)
      hideFootageMotion()
      const resumePlaying = !video.paused
      video.pause()
      const startedAt = performance.now()
      const step = () => {
        if (stopped) return
        const nowTicks = fromTicks + (performance.now() - startedAt) * TICKS_PER_MS
        if (nowTicks >= untilTicks) {
          leaveHole()
          const target = sourceTimeFor(segmentsRef.current, untilTicks)
          if (!target) {
            setPlayheadMs(untilTicks / TICKS_PER_MS)
            return
          }
          segmentIndexRef.current = target.segmentIndex
          video.currentTime = target.sourceTicks / PROJECT_TIMESCALE
          setPlayheadMs(untilTicks / TICKS_PER_MS)
          if (resumePlaying) void video.play().catch(() => undefined)
          return
        }
        setPlayheadMs(nowTicks / TICKS_PER_MS)
        holeFrameId = requestAnimationFrame(step)
      }
      holeFrameId = requestAnimationFrame(step)
    }

    /**
     * Turn "where the recording is" into "where the finished video is".
     *
     * Before the first cut these are the same number and nothing happens. After
     * a cut they are not, and this is the only place that knows the difference.
     */
    const updatePlayhead = (currentTime: number) => {
      if (!Number.isFinite(currentTime) || currentTime < 0) {
        setPlayheadMs(-1)
        hideFootageMotion()
        return
      }
      const segments = segmentsRef.current
      if (segments.length === 0 || isUncutPassthrough(segments)) {
        const compositionTicks = Math.round(currentTime * PROJECT_TIMESCALE)
        setPlayheadMs(compositionTicks / TICKS_PER_MS)
        drawFootageMotion(compositionTicks)
        return
      }
      if (inHoleRef.current) return

      const action = advancePlayback(
        segments,
        segmentIndexRef.current,
        Math.round(currentTime * PROJECT_TIMESCALE),
        totalTicksRef.current,
      )
      switch (action.kind) {
        case 'show':
          segmentIndexRef.current = action.segmentIndex
          setPlayheadMs(action.compositionTicks / TICKS_PER_MS)
          drawFootageMotion(action.compositionTicks)
          return
        case 'seek':
          segmentIndexRef.current = action.segmentIndex
          video.currentTime = action.sourceTicks / PROJECT_TIMESCALE
          setPlayheadMs(action.compositionTicks / TICKS_PER_MS)
          drawFootageMotion(action.compositionTicks)
          return
        case 'hole':
          hideFootageMotion()
          enterHole(action.compositionTicks, action.untilTicks)
          return
        case 'ended':
          video.pause()
          setPlayheadMs(action.compositionTicks / TICKS_PER_MS)
          hideFootageMotion()
          return
        default:
          return
      }
    }
    const refreshPlayhead = () => updatePlayhead(video.currentTime)
    const hasVideoFrameCallback = typeof video.requestVideoFrameCallback === 'function'
    let videoFrameCallbackId: number | null = null
    let stopped = false
    holePlaybackRef.current = Object.freeze({ enter: enterHole, leave: leaveHole })
    const resumeTimelineHole = () => {
      if (!inHoleRef.current) return
      video.pause()
      const fromTicks = playheadTicksRef.current
      const untilTicks = nextVisibleTick(segmentsRef.current, fromTicks)
      if (untilTicks === null || untilTicks <= fromTicks) return
      inHoleRef.current = false
      enterHole(fromTicks, untilTicks)
    }
    const requestNextVideoFrame = () => {
      if (typeof video.requestVideoFrameCallback !== 'function') return
      videoFrameCallbackId = video.requestVideoFrameCallback((_now, metadata) => {
        if (stopped) return
        updatePlayhead(metadata.mediaTime)
        requestNextVideoFrame()
      })
    }
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refreshProjection)

    observer?.observe(video)
    window.addEventListener('scroll', refreshProjection, { passive: true })
    video.addEventListener('loadedmetadata', refreshProjection)
    video.addEventListener('resize', refreshProjection)

    // Media events are always listened to, even when frame callbacks are
    // available. A browser can expose requestVideoFrameCallback and still never
    // fire it — a background tab, a decoder that never presents a frame — and
    // with no fallback the preview would silently show nothing at all while
    // looking perfectly healthy. Frame callbacks give exact timing when they
    // work; these events guarantee the preview is never simply blank.
    video.addEventListener('loadedmetadata', refreshPlayhead)
    video.addEventListener('timeupdate', refreshPlayhead)
    video.addEventListener('seeked', refreshPlayhead)
    video.addEventListener('play', resumeTimelineHole)
    const syncPlayback = () => setMonitorPlaying(!video.paused)
    const syncVolume = () => {
      setMonitorMuted(video.muted)
      setMonitorVolume(video.volume)
    }
    video.addEventListener('play', syncPlayback)
    video.addEventListener('pause', syncPlayback)
    video.addEventListener('ended', syncPlayback)
    video.addEventListener('volumechange', syncVolume)

    /**
     * Read readiness from the element on every media event.
     *
     * `hasPresentedFrame` is sticky for the life of one source: once a real
     * frame has been shown, a later dip in readyState means "seeking", not
     * "nothing to show", and the previous frame is kept on screen rather than
     * being replaced by black.
     */
    const syncReadiness = () => {
      setVideoReadiness((current) => {
        const readyState = video.readyState
        const seeking = video.seeking
        const hasPresentedFrame = current.hasPresentedFrame || readyState >= HAVE_CURRENT_DATA
        if (
          current.readyState === readyState &&
          current.seeking === seeking &&
          current.hasPresentedFrame === hasPresentedFrame
        ) return current
        return { readyState, seeking, hasPresentedFrame }
      })
    }
    // A new source has no frames of its own, so nothing may be retained from
    // the previous one.
    const resetReadiness = () => setVideoReadiness({ readyState: 0, seeking: false, hasPresentedFrame: false })
    for (const name of MEDIA_READINESS_EVENTS) video.addEventListener(name, syncReadiness)
    video.addEventListener('emptied', resetReadiness)
    syncReadiness()
    syncPlayback()
    syncVolume()
    if (hasVideoFrameCallback) requestNextVideoFrame()

    return () => {
      stopped = true
      leaveHole()
      holePlaybackRef.current = null
      if (
        videoFrameCallbackId !== null &&
        typeof video.cancelVideoFrameCallback === 'function'
      ) {
        video.cancelVideoFrameCallback(videoFrameCallbackId)
      }
      observer?.disconnect()
      window.removeEventListener('scroll', refreshProjection)
      video.removeEventListener('loadedmetadata', refreshProjection)
      video.removeEventListener('resize', refreshProjection)
      video.removeEventListener('loadedmetadata', refreshPlayhead)
      video.removeEventListener('timeupdate', refreshPlayhead)
      video.removeEventListener('seeked', refreshPlayhead)
      video.removeEventListener('play', resumeTimelineHole)
      video.removeEventListener('play', syncPlayback)
      video.removeEventListener('pause', syncPlayback)
      video.removeEventListener('ended', syncPlayback)
      video.removeEventListener('volumechange', syncVolume)
      for (const name of MEDIA_READINESS_EVENTS) video.removeEventListener(name, syncReadiness)
      video.removeEventListener('emptied', resetReadiness)
    }
  }, [])

  const video = videoRef.current
  const markerPosition = pointTarget && video ? projectPointOntoVideoElement(pointTarget, video, monitorFitMode) : null
  const draftPosition = isPointMode && video ? projectPointOntoVideoElement(draftPoint, video, monitorFitMode) : null
  const videoContentLayerStyle = video ? getVideoContentLayerStyle(video, monitorFitMode) : null

  // The preview is compiled from the project by the same compiler the exporter
  // uses. A pending proposal is layered on top without touching saved state.
  // The footage as it now stands: what was imported, plus every accepted cut.
  const composition = effectiveComposition(editProject)

  // What the video is MADE OF depends only on the saved project: a pending
  // nameplate changes what is drawn, never which footage plays. Deriving the
  // stretches from the saved project alone keeps playback steady while the user
  // is still typing into a proposal.
  const footagePlan = useMemo(() => compilePreviewPlan(editProject), [editProject])
  const previewSegments = useMemo(
    () => (footagePlan ? playbackSegments(footagePlan) : []),
    [footagePlan],
  )

  const previewProposalOperation = proposal && proposalCanvasPoint
    ? Object.freeze({
        ...proposal.operation,
        target: Object.freeze({ ...proposal.operation.target, point: proposalCanvasPoint }),
      })
    : proposal?.operation ?? null
  const previewPlan = compilePreviewPlan(
    previewProposalOperation ? withPendingProposal(editProject, previewProposalOperation) : editProject,
  )
  const playheadPreviewTicks = millisecondsToTicks(playheadMs)
  const previewNodes = previewPlan ? visibleNameplates(previewPlan, playheadPreviewTicks) : []
  const previewCaptions = previewPlan ? visibleCaptions(previewPlan, playheadPreviewTicks) : []
  const previewTitles = previewPlan ? visibleTitles(previewPlan, playheadPreviewTicks) : []
  const previewCallouts = previewPlan ? visibleCallouts(previewPlan, playheadPreviewTicks) : []
  const previewMedia = previewPlan ? visibleMediaOverlays(previewPlan, playheadPreviewTicks) : []
  const assetKinds = new Map(editProject.assets.map((asset) => [asset.assetId, asset.mediaKind]))
  const contentBox = video ? monitorGeometry(video, monitorFitMode)?.displayedContentRect ?? null : null
  const previewScale = contentBox && composition.width > 0 ? contentBox.width / composition.width : 0
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const transitionSegment = footagePlan?.segments.find(
    (segment) =>
      playheadPreviewTicks >= segment.interval.start.ticks &&
      playheadPreviewTicks < segment.interval.start.ticks + segment.interval.duration.ticks,
  )
  const transitionOpacity = transitionSegment
    ? segmentVideoOpacityAt(transitionSegment, playheadPreviewTicks, reducedMotion)
    : 1
  const nameplateVariables = nameplateCssVariables(composition.width, composition.height, previewScale)
  // Only one caption is ever on screen, so one set of variables is enough. Two
  // caption sets with different looks would need one layer each; that arrives
  // with multi-asset projects, not before.
  const captionVariables = captionCssVariables(
    previewCaptions[0]?.styleId ?? DEFAULT_CAPTION_STYLE_ID,
    composition.width,
    composition.height,
    previewScale,
  )

  // One title is ever on screen at a time for the same reason, so one set of
  // variables is enough here too.
  const titleVariables = titleCssVariables(
    previewTitles[0]?.styleId ?? DEFAULT_TITLE_STYLE_ID,
    composition.width,
    composition.height,
    previewScale,
  )

  const acceptedRecords = editProject.changeSets
  const acceptedOverlays = activeOverlayOperations(editProject)
  const acceptedCount = acceptedRecords.length
  const firstClipId = composition.tracks[0]?.clips[0]?.clipId ?? ''
  const isRendering = exportState.status === 'rendering'
  const canExport = acceptedCount > 0 && !proposal && !isRendering
  const assistChanges = useMemo(
    () => buildAssistChangeItems({ project: editProject, proposal }),
    [editProject, proposal],
  )

  const compositionDurationTicks = compositionDuration(composition).ticks

  // The media effect is attached once and reads these through refs, so they are
  // refreshed here rather than by re-subscribing every listener on every cut.
  useEffect(() => {
    segmentsRef.current = previewSegments
    totalTicksRef.current = compositionDurationTicks
    if (segmentIndexRef.current >= previewSegments.length) segmentIndexRef.current = 0
  }, [previewSegments, compositionDurationTicks])

  const playheadTicks = Math.min(
    compositionDurationTicks,
    Math.max(0, millisecondsToTicks(playheadMs)),
  )
  // A direct project edit while a proposal is pending would move the footage
  // the proposal is anchored to, so both surfaces share one fail-closed policy.
  const timelineBusy = Boolean(proposal) || isRendering
  const assetLabels = useMemo(() => deriveAssetDisplayLabels({
    project: editProject,
    primaryDisplayName: project.name,
    originalNames: assetOriginalNames,
  }), [assetOriginalNames, editProject, project.name])
  const primaryAssetId = editProject.composition.tracks
    .find((track) => track.kind === 'video')?.clips[0]?.assetId ?? null
  const mediaSourceEntries = useMemo(() => Object.freeze(editProject.assets.map((asset) => Object.freeze({
    assetId: asset.assetId,
    url: asset.assetId === primaryAssetId ? project.mediaUrl : assetUrl(asset.assetId),
    originalName: assetOriginalNames[asset.assetId] ?? (asset.assetId === primaryAssetId ? project.name : null),
  }))), [assetOriginalNames, assetUrl, editProject.assets, primaryAssetId, project.mediaUrl, project.name])
  const mediaSourceProbeKey = mediaSourceEntries.map((source) => `${source.assetId}:${source.url}`).join('|')
  useEffect(() => {
    if (!probeAssetSource) return
    let cancelled = false
    void probeMediaAssetStatuses(mediaSourceEntries, probeAssetSource).then((statuses) => {
      if (!cancelled) setMediaSourceStatuses(statuses)
    })
    return () => { cancelled = true }
  }, [mediaSourceEntries, mediaSourceProbeKey, probeAssetSource])
  const mediaAssetSources = useMemo(() => Object.freeze(Object.fromEntries(
    mediaSourceEntries.map((source) => [source.assetId, Object.freeze({
      url: source.url,
      originalName: source.originalName,
      status: probeAssetSource ? mediaSourceStatuses[source.assetId] ?? 'checking' : 'available',
    } satisfies MediaAssetSource)]),
  )), [mediaSourceEntries, mediaSourceStatuses, probeAssetSource])
  const mediaModel = useMemo(() => buildMediaBinViewModel({
    project: editProject,
    primaryDisplayName: project.name,
    originalNames: assetOriginalNames,
    assetSources: mediaAssetSources,
    selectedAssetId: selectedMediaAssetId,
  }), [assetOriginalNames, editProject, mediaAssetSources, project.name, selectedMediaAssetId])
  const primaryVideoAsset = editProject.assets.find((asset) => asset.assetId === primaryAssetId && asset.mediaKind === 'video')
  const primaryMediaStatus = primaryAssetId ? mediaAssetSources[primaryAssetId]?.status ?? 'checking' : 'missing'
  const monitorSourceStatus = primaryMediaStatus === 'available'
    ? 'Local source available'
    : primaryMediaStatus === 'checking'
      ? 'Checking local source'
      : 'Local source missing'
  const pendingTimelineInput = useMemo(
    () => proposal
      ? Object.freeze({
          proposalId: proposal.operation.operationId,
          baseRevision: editProject.revision,
          operations: Object.freeze([proposal.operation]),
        })
      : null,
    [editProject.revision, proposal],
  )
  const timelineModel = useMemo(
    () => buildTimelineViewModel({
      project: editProject,
      selectedItemId: selectedTimelineItemId,
      pending: pendingTimelineInput,
      assetLabels,
    }),
    [assetLabels, editProject, pendingTimelineInput, selectedTimelineItemId],
  )
  const inspectorSelection = useMemo(
    () => resolveInspectorSelection({
      project: editProject,
      timeline: timelineModel,
      selectedTimelineItemId,
      pending: pendingTimelineInput,
      assetLabels,
    }),
    [assetLabels, editProject, pendingTimelineInput, selectedTimelineItemId, timelineModel],
  )
  const selectedVideoSelection = inspectorSelection.kind === 'video' ? inspectorSelection : null
  const acceptedFootageMotions = useMemo(() => effectiveFootageMotions(editProject), [editProject])
  const selectedSourceTime = selectedVideoSelection &&
    playheadTicks >= selectedVideoSelection.clip.compositionStart.ticks &&
    playheadTicks < selectedVideoSelection.clip.compositionStart.ticks + selectedVideoSelection.clip.sourceRange.duration.ticks
      ? mediaTime(
          selectedVideoSelection.clip.sourceRange.start.ticks +
          playheadTicks -
          selectedVideoSelection.clip.compositionStart.ticks,
        )
      : null
  const acceptedFootageMotion = useMemo(() => {
    if (!selectedVideoSelection) return null
    const sourceStart = selectedVideoSelection.clip.sourceRange.start.ticks
    const sourceEnd = sourceStart + selectedVideoSelection.clip.sourceRange.duration.ticks
    const matching = acceptedFootageMotions.filter((motion) =>
      motion.assetId === selectedVideoSelection.clip.assetId &&
      motion.sourceInterval.start.ticks < sourceEnd &&
      motion.sourceInterval.start.ticks + motion.sourceInterval.duration.ticks > sourceStart,
    )
    return matching.find((motion) =>
      selectedSourceTime &&
      selectedSourceTime.ticks >= motion.sourceInterval.start.ticks &&
      selectedSourceTime.ticks < motion.sourceInterval.start.ticks + motion.sourceInterval.duration.ticks,
    ) ?? matching[0] ?? null
  }, [acceptedFootageMotions, selectedSourceTime, selectedVideoSelection])
  const footageMotionDirty = Boolean(
    footageMotionDraft &&
    footageMotionBaseline !== null &&
    JSON.stringify(footageMotionDraft) !== footageMotionBaseline,
  )
  const inspectorDirty = inspectorSectionDirty || footageMotionDirty

  useEffect(() => {
    if (!selectedVideoSelection) {
      setFootageMotionDraft(null)
      setFootageMotionBaseline(null)
      return
    }
    if (footageMotionDirty) return
    const next = acceptedFootageMotion
      ? footageMotionDraftFromOperation(acceptedFootageMotion)
      : createWideFootageMotionDraft(
          createMotionId(),
          selectedVideoSelection.clip.assetId,
          selectedVideoSelection.clip.sourceRange,
        )
    setFootageMotionDraft(next)
    setFootageMotionBaseline(JSON.stringify(next))
  }, [acceptedFootageMotion, footageMotionDirty, selectedVideoSelection?.clip.clipId])

  const footageDisplayPlan = useMemo(() => {
    if (!footagePlan || !footageMotionDraft || !selectedVideoSelection) return footagePlan
    if (!acceptedFootageMotion && !footageMotionDirty) return footagePlan
    const draftNode = Object.freeze({
      motionId: footageMotionDraft.motionId,
      sourceInterval: footageMotionDraft.sourceInterval,
      transform: footageMotionDraft.transform,
      crop: footageMotionDraft.crop,
      tracks: footageMotionDraft.tracks,
    })
    const draftStart = footageMotionDraft.sourceInterval.start.ticks
    const draftEnd = draftStart + footageMotionDraft.sourceInterval.duration.ticks
    return Object.freeze({
      ...footagePlan,
      segments: Object.freeze(footagePlan.segments.map((segment) => {
        const segmentSourceStart = segment.sourceStartTicks
        const segmentSourceEnd = segmentSourceStart + segment.interval.duration.ticks
        const intersects =
          segment.assetId === footageMotionDraft.assetId &&
          draftStart < segmentSourceEnd &&
          draftEnd > segmentSourceStart
        if (!intersects) return segment
        return Object.freeze({
          ...segment,
          footageMotions: Object.freeze([
            ...segment.footageMotions.filter((motion) => motion.motionId !== footageMotionDraft.motionId),
            draftNode,
          ]),
        })
      })),
    })
  }, [acceptedFootageMotion, footageMotionDirty, footageMotionDraft, footagePlan, selectedVideoSelection])

  const activeFootageMotion = footageDisplayPlan
    ? footageMotionAtCompositionTime(footageDisplayPlan, playheadPreviewTicks, reducedMotion)
    : null

  /**
   * The frame this render is ASKING the canvas to hold.
   *
   * `videoLayoutRevision` is the geometry version: a panel resize changes the
   * canvas size, so a frame drawn at the old size is no longer the frame being
   * asked for and must be redrawn before it is trusted.
   */
  const requestedFrameToken = activeFootageMotion
    ? motionCanvasFrameToken({
      assetId: activeFootageMotion.segment.assetId,
      sourceTicks: activeFootageMotion.sourceTicks,
      compositionTicks: playheadPreviewTicks,
      motionId: activeFootageMotion.motion.motionId ?? null,
      geometryVersion: videoLayoutRevision,
    })
    : null

  useEffect(() => {
    footagePlanRef.current = footageDisplayPlan
    reducedMotionRef.current = reducedMotion
    const canvas = footageMotionCanvasRef.current
    const videoElement = videoRef.current
    if (!canvas || !videoElement || !footageDisplayPlan) {
      drawnFrameTokenRef.current = null
      setDrawnFrameToken(null)
      return
    }
    drawFootageMotionFrame({
      canvas,
      video: videoElement,
      plan: footageDisplayPlan,
      compositionTicks: playheadPreviewTicks,
      reducedMotion,
      geometryVersion: videoLayoutRevision,
    })
    const drawn = footageMotionDrawnToken(canvas)
    drawnFrameTokenRef.current = drawn
    setDrawnFrameToken(drawn)
  }, [footageDisplayPlan, playheadPreviewTicks, reducedMotion, requestedFrameToken, videoLayoutRevision])

  /**
   * One named answer for what the base picture is, and the ONLY thing allowed
   * to decide it.
   *
   * The pointer is deliberately not an input. The preview used to depend on
   * hover — the motion canvas was made transparent while the pointer was over
   * the video and opaque black the moment it left — so moving the mouse away
   * blacked out the footage. See `monitor-base-layer.ts` for the full story.
   */
  const baseLayer = resolveMonitorBaseLayer({
    hasSource: project.mediaUrl.length > 0,
    readyState: videoReadiness.readyState,
    seeking: videoReadiness.seeking,
    mediaError: hasPreviewError ? 'Preview unavailable' : null,
    // The ONLY input allowed to produce 'gap': the canonical composition
    // mapping reported a stretch with no active source segment.
    inCanonicalGap: isShowingHole,
    hasPresentedFrame: videoReadiness.hasPresentedFrame,
    motionActive: activeFootageMotion !== null,
    requestedFrameToken,
    drawnFrameToken,
    playing: monitorPlaying,
  })
  /**
   * The status word is DERIVED from the layer rather than computed a second
   * time. Two independent calculations of "what is the preview doing" is
   * exactly how a monitor ends up saying "No media at this time" over a picture
   * that is playing.
   */
  const baseFrameState: MonitorBaseFrameState =
    baseLayer.kind === 'error' ? 'error'
      : baseLayer.kind === 'gap' ? 'gap'
        : baseLayer.kind === 'loading' ? 'loading'
          : videoReadiness.seeking ? 'seeking'
            : 'ready'
  const baseFrameMessage = monitorBaseFrameMessage(baseFrameState)

  const canvasVisibleNodes = [
    ...previewNodes,
    ...previewCaptions,
    ...previewTitles,
    ...previewCallouts,
    ...previewMedia,
  ]
  const visibleCanvasNodeIds = new Set(canvasVisibleNodes.map((node) => node.nodeId))
  const canvasSelectionResult = resolveCanvasSelection(inspectorSelection, visibleCanvasNodeIds)
  const visualDraftController = useSharedVisualDraft(canvasSelectionResult)
  const canvasTargets: readonly CanvasHitTarget[] = canvasVisibleNodes.flatMap((node) => {
    const item = timelineModel.lanes
      .flatMap((lane) => lane.items)
      .find((candidate) =>
        candidate.state !== 'blocked' &&
        candidate.visualId !== null &&
        (candidate.visualId === node.nodeId || node.nodeId.startsWith(`${candidate.visualId}.`)),
      )
    if (!item || item.kind === 'clip' || item.kind === 'gap' || item.kind === 'music') return []
    const visual = previewPlan?.visuals.find((candidate) => candidate.nodeIds.includes(node.nodeId))
    return [Object.freeze({
      timelineItemId: item.id,
      nodeId: node.nodeId,
      label: item.label,
      layer: visual?.layer ?? 0,
      state: item.state === 'proposed' ? 'proposed' as const : 'committed' as const,
    })]
  })
  const canvasBusy = isRendering || Boolean(
    proposal &&
    canvasSelectionResult.kind === 'supported' &&
    canvasSelectionResult.selection.state === 'committed',
  )
  const motionStyle = (node: Parameters<typeof visualCssStyleAt>[1]) => {
    if (!previewPlan) return undefined
    if (
      canvasSelectionResult.kind === 'supported' &&
      canvasSelectionResult.selection.state === 'committed' &&
      canvasSelectionResult.selection.nodeId === node.nodeId &&
      visualDraftController.draft
    ) {
      return visualCssStyleFromPropertiesAt(
        Object.freeze({
          visualId: canvasSelectionResult.selection.visualId,
          nodeIds: Object.freeze([node.nodeId]),
          ...visualDraftController.draft.value,
        }),
        node,
        playheadPreviewTicks,
        composition.width,
        composition.height,
        reducedMotion,
      )
    }
    return visualCssStyleAt(
      previewPlan,
      node,
      playheadPreviewTicks,
      composition.width,
      composition.height,
      reducedMotion,
    )
  }

  const requestTimelineSelection = (nextItemId: string | null) => {
    const decision = requestInspectorSelectionChange(
      selectedTimelineItemId,
      nextItemId,
      inspectorDirty,
    )
    if (decision.kind === 'confirm') {
      setPendingTimelineSelection(Object.freeze({ itemId: decision.nextItemId }))
      return
    }
    setPendingTimelineSelection(null)
    setSelectedTimelineItemId(decision.nextItemId)
  }

  const discardInspectorDraftAndContinue = () => {
    const nextItemId = pendingTimelineSelection?.itemId ?? null
    setInspectorSectionDirty(false)
    setFootageMotionDraft(null)
    setFootageMotionBaseline(null)
    setPendingTimelineSelection(null)
    setSelectedTimelineItemId(nextItemId)
  }

  useEffect(() => {
    if (selectedMediaAssetId && !editProject.assets.some((asset) => asset.assetId === selectedMediaAssetId)) {
      setSelectedMediaAssetId(null)
    }
  }, [editProject.assets, selectedMediaAssetId])

  useEffect(() => {
    if (!pendingPlacedTimelineItemId) return
    const exists = timelineModel.lanes.some((lane) => lane.items.some((item) => item.id === pendingPlacedTimelineItemId))
    if (!exists) return
    requestTimelineSelection(pendingPlacedTimelineItemId)
    setPendingPlacedTimelineItemId(null)
  }, [pendingPlacedTimelineItemId, timelineModel])

  const importMediaFiles = async (files: readonly File[]): Promise<string | null> => {
    for (const file of files) {
      const uploaded = await onUploadAsset(file)
      if (typeof uploaded === 'string') return uploaded
      setSelectedMediaAssetId(uploaded.assetId)
    }
    return null
  }

  const addMediaAsBroll = async (assetId: string): Promise<string | null> => {
    const asset = editProject.assets.find((candidate) => candidate.assetId === assetId)
    if (!asset) return 'That media is no longer in this project.'
    const built = buildAddAsBrollOperation({
      project: editProject,
      expectedRevision: editProject.revision,
      asset,
      playheadMs,
      ids: createMediaActionIds(),
    })
    if (!built.ok) return built.message
    const failure = await onCreateOverlay(built.operation)
    if (!failure) setPendingPlacedTimelineItemId(built.timelineItemId)
    return failure
  }

  const addMediaAsMusic = async (assetId: string): Promise<string | null> => {
    const asset = editProject.assets.find((candidate) => candidate.assetId === assetId)
    if (!asset) return 'That media is no longer in this project.'
    const built = buildAddAsMusicOperation({
      project: editProject,
      expectedRevision: editProject.revision,
      asset,
      playheadMs,
      ids: createMediaActionIds(),
    })
    if (!built.ok) return built.message
    const failure = await onCreateOverlay(built.operation)
    if (!failure) setPendingPlacedTimelineItemId(built.timelineItemId)
    return failure
  }

  useEffect(() => {
    const reconciled = reconcileTimelineSelection(timelineModel, selectedTimelineItemId)
    if (reconciled !== selectedTimelineItemId) {
      setInspectorSectionDirty(false)
      setFootageMotionDraft(null)
      setFootageMotionBaseline(null)
      setPendingTimelineSelection(null)
      setSelectedTimelineItemId(reconciled)
    }
  }, [selectedTimelineItemId, timelineModel])

  function seekCompositionTicks(requestedTicks: number) {
    const nextTicks = Math.min(
      compositionDurationTicks,
      Math.max(0, Number.isFinite(requestedTicks) ? Math.round(requestedTicks) : 0),
    )
    setPlayheadMs(nextTicks / TICKS_PER_MS)
    playheadTicksRef.current = nextTicks

    const videoElement = videoRef.current
    if (!videoElement) return
    holePlaybackRef.current?.leave()

    if (nextTicks >= compositionDurationTicks) {
      videoElement.pause()
      return
    }

    const target = sourceTimeFor(previewSegments, nextTicks)
    if (!target) {
      videoElement.pause()
      inHoleRef.current = true
      setIsShowingHole(true)
      return
    }

    inHoleRef.current = false
    setIsShowingHole(false)
    segmentIndexRef.current = target.segmentIndex
    videoElement.currentTime = target.sourceTicks / PROJECT_TIMESCALE
  }

  function toggleMonitorPlayback() {
    const videoElement = videoRef.current
    if (!videoElement) return
    if (videoElement.paused) void videoElement.play()
    else videoElement.pause()
  }

  function stepMonitorFrame(direction: -1 | 1) {
    videoRef.current?.pause()
    seekCompositionTicks(playheadTicksRef.current + direction * frameStepTicks(primaryVideoAsset?.frameRate ?? null))
  }

  function setMonitorMutedState(muted: boolean) {
    const videoElement = videoRef.current
    if (videoElement) videoElement.muted = muted
    setMonitorMuted(muted)
  }

  function setMonitorVolumeState(volume: number) {
    const next = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0))
    const videoElement = videoRef.current
    if (videoElement) videoElement.volume = next
    setMonitorVolume(next)
  }

  async function applyFootageMotion(operation: SetFootageMotionOperation): Promise<string | null> {
    const error = await onCreateOverlay(operation)
    if (!error) {
      const next = footageMotionDraftFromOperation(operation)
      setFootageMotionDraft(next)
      setFootageMotionBaseline(JSON.stringify(next))
    }
    return error
  }

  function commitFootageMotionGesture(nextDraft: FootageMotionDraft) {
    void applyFootageMotion(buildFootageMotionOperation(nextDraft, createOperationId()))
  }

  function seekSelectedSourceTime(sourceTime: ReturnType<typeof mediaTime>) {
    if (!selectedVideoSelection) return
    const sourceOffset = sourceTime.ticks - selectedVideoSelection.clip.sourceRange.start.ticks
    if (sourceOffset < 0 || sourceOffset > selectedVideoSelection.clip.sourceRange.duration.ticks) return
    seekCompositionTicks(selectedVideoSelection.clip.compositionStart.ticks + sourceOffset)
  }

  function timelineRefusalMessage(code: string, fallback: string): string {
    switch (code) {
      case 'PROPOSAL_PENDING':
        return 'Accept or reject the pending proposal before changing the timeline.'
      case 'EXPORT_IN_PROGRESS':
        return 'Export is running. Wait for it to finish before changing the project.'
      case 'CLIP_UNKNOWN':
        return 'That section no longer exists. The timeline has been refreshed.'
      case 'GESTURE_OUT_OF_RANGE':
        return fallback || 'That edit would fall outside the current section.'
      case 'NO_TARGET':
        return fallback || 'There is no editable section at that moment.'
      default:
        return fallback || 'That timeline edit could not be applied. Nothing changed.'
    }
  }

  /**
   * A file was let go over a lane.
   *
   * The planner decides — the same function a future AI request will call — so
   * dragging a logo onto the intro and typing "put the logo over the intro"
   * cannot produce different results. Pointer movement up to this moment
   * created nothing: no operation, no request, no history. This one release
   * creates exactly one change set, or one refusal that says why.
   */
  function handleMediaDrop(laneId: string, assetId: string, atTicks: number) {
    const changeSetId = createChangeSetId()
    const plan = planTimelinePlacement({
      project: editProject,
      assetId,
      targetLaneId: laneId,
      atTicks,
      placementMode: timelinePlacementMode,
      includeLinkedAudio: false,
      trackState: { lockedTrackIds: lockedTrackIds },
      proposalPending: Boolean(proposal),
      exportInProgress: isRendering,
      expectedRevision: editProject.revision,
      idFactory: createIdFactory(changeSetId),
    }, {
      // What is already on the target lane, named, so Insert knows which clips
      // to push along and Overwrite knows which to cut back.
      spans: laneSpans(editProject, trackIdForLane(laneId) === 'A2' ? 'A2' : 'V2'),
    })
    if (!plan.ok) {
      setTimelineNotice(plan.error.message)
      return
    }
    setTimelineNotice(null)
    void (async () => {
      const failure = await onApplyOperations(plan.value.operations, changeSetId)
      if (failure) setTimelineNotice(failure)
    })()
  }

  /**
   * One whole gesture on one item already on the timeline.
   *
   * Called exactly once, when the user lets go or presses the key — never while
   * a pointer is moving. Everything it produces goes into one change set, so a
   * split that becomes two operations is still one Undo.
   */
  function handleTimelineItemAction(itemId: string, action: TimelineItemAction) {
    const changeSetId = createChangeSetId()
    const plan = planTimelineItemAction({
      project: editProject,
      itemId,
      action,
      lockedTrackIds,
      pendingProposalExists: Boolean(proposal),
      exportInProgress: isRendering,
      expectedRevision: editProject.revision,
      ids: createIdFactory(changeSetId),
    })
    if (!plan.ok) {
      setTimelineNotice(plan.refusal.message)
      return
    }
    setTimelineNotice(null)
    void (async () => {
      const failure = await onApplyOperations(plan.operations, changeSetId)
      if (failure) setTimelineNotice(failure)
    })()
  }

  /**
   * A padlock. Presentation only: no operation, no revision, no Undo entry, and
   * the exported file is byte-for-byte what it would have been without it.
   */
  function handleToggleTrackLock(trackId: TimelineTrackId) {
    setLockedTrackIds((current) => {
      const next = current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [...current, trackId]
      writeTimelineLockState(editProject.projectId, Object.freeze({
        schemaVersion: TIMELINE_LOCK_SCHEMA_VERSION,
        lockedTrackIds: Object.freeze(next),
      }))
      return Object.freeze(next)
    })
  }

  /**
   * Keeping a track out of the finished video. The opposite of a padlock: this
   * IS an edit, so it takes a revision, a slot in Undo, and a new export.
   */
  function handleToggleTrackOutput(trackId: TimelineTrackId) {
    const changeSetId = createChangeSetId()
    const factory = createIdFactory(changeSetId)
    const operation = {
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: factory.operation(0),
      kind: 'set-track-output' as const,
      capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
      trackId,
      outputEnabled: !trackOutputs[trackId],
      extensions: {},
    }
    setTimelineNotice(null)
    void (async () => {
      const failure = await onApplyOperations([operation as never], changeSetId)
      if (failure) setTimelineNotice(failure)
    })()
  }

  function handleTimelineGesture(gesture: TimelineGesture) {
    const result = adaptTimelineGesture({
      project: editProject,
      gesture,
      createOperationId,
      createClipId,
      pendingProposalExists: Boolean(proposal),
      exportInProgress: isRendering,
    })
    if (!result.ok) {
      setTimelineNotice(timelineRefusalMessage(result.error.code, result.error.message))
      return
    }
    if (!isTimelineOperation(result.value)) {
      setTimelineNotice('That timeline action produced an unsupported edit. Nothing changed.')
      return
    }
    setTimelineNotice(null)
    onTimelineEdit(result.value)
  }

  /** Keep the proven controls as a temporary fallback, but route them through P1-A. */
  function runTimelineEdit(
    action:
      | 'split'
      | 'remove'
      | 'remove-gap'
      | 'hide'
      | 'show'
      | 'trim-start'
      | 'trim-end'
      | 'move-earlier'
      | 'move-later'
      | 'audio',
  ) {
    const clip = clipAtCompositionTime(composition, {
      ticks: playheadTicks,
      timescale: PROJECT_TIMESCALE,
    })
    if (action === 'split') {
      handleTimelineGesture({ type: 'split', atTicks: playheadTicks })
      return
    }
    if (action === 'remove' || action === 'remove-gap') {
      handleTimelineGesture({
        type: action === 'remove' ? 'remove-ripple' : 'remove-gap',
        atTicks: playheadTicks,
      })
      return
    }
    if (!clip) {
      setTimelineNotice('There is no editable section at this moment.')
      return
    }
    if (action === 'hide' || action === 'show') {
      handleTimelineGesture({ type: 'set-enabled', clipId: clip.clipId, enabled: action === 'show' })
      return
    }
    if (action === 'trim-start' || action === 'trim-end') {
      handleTimelineGesture({
        type: action,
        clipId: clip.clipId,
        deltaTicks: Math.max(1, Math.round(trimSeconds * PROJECT_TIMESCALE)),
      })
      return
    }
    if (action === 'move-earlier' || action === 'move-later') {
      handleTimelineGesture({ type: action, clipId: clip.clipId })
      return
    }
    handleTimelineGesture({
      type: 'set-audio',
      clipId: clip.clipId,
      gainDb: clipGainDb,
      fadeInTicks: Math.max(0, Math.round(fadeInSeconds * PROJECT_TIMESCALE)),
      fadeOutTicks: Math.max(0, Math.round(fadeOutSeconds * PROJECT_TIMESCALE)),
    })
  }

  /**
   * Read a transcript file and let the server turn it into captions.
   *
   * The browser reads the file only to get its text; it does no parsing, no
   * line breaking, and no timing. All of that happens once, on the server, so
   * the captions that were saved and the captions being previewed are the same
   * captions by construction.
   */
  async function onAddCaptions(file: File): Promise<void> {
    if (captionsBusy || timelineBusy) return
    setCaptionsBusy(true)
    setCaptionsNotice(null)
    try {
      const text = await file.text()
      const failure = await onAddCaptionsText(text)
      setCaptionsNotice(failure ?? 'Captions added.')
    } catch {
      setCaptionsNotice('That file could not be read.')
    } finally {
      setCaptionsBusy(false)
    }
  }

  const proposalPlaced = proposal ? proposalPlacement(editProject, proposal.operation) : null
  const proposalStartMs = proposalPlaced ? proposalPlaced.startTicks / TICKS_PER_MS : 0
  const proposalDurationMs = proposalPlaced ? proposalPlaced.durationTicks / TICKS_PER_MS : 0

  function seekAssistChange(ticks: number) {
    seekCompositionTicks(ticks)
  }

  /**
   * Everything the assistant is allowed to know about what the user is doing.
   * Built here because this screen is the only place that knows where the
   * playhead is and whether the user pointed.
   */
  function buildIntentContext(): IntentContextInput {
    return {
      clipId: firstClipId,
      sampledClipTimeTicks: pointTarget ? millisecondsToTicks(pointTarget.timeMs) : null,
      point: pointTarget ? { x: pointTarget.x, y: pointTarget.y } : null,
      playheadTicks: millisecondsToTicks(Math.max(0, playheadMs)),
      compositionDurationTicks,
      compositionWidth: composition.width,
      compositionHeight: composition.height,
    }
  }

  function cancelPointMode() {
    pointModeButtonRef.current?.focus()
    setIsPointMode(false)
    setIsMovingProposalPoint(false)
    setPointError(null)
  }

  function enterPointMode() {
    videoRef.current?.pause()
    setDraftPoint({ x: 0.5, y: 0.5 })
    setPointError(null)
    setIsPointMode(true)
  }

  function startMovingProposalPoint() {
    if (isMovingProposalPoint) {
      cancelPointMode()
      return
    }
    setIsMovingProposalPoint(true)
    enterPointMode()
  }

  function completePointCapture(target: CapturedPointTarget) {
    // Moving an existing proposal keeps everything else about it. Only a fresh
    // point replaces the target and clears the pending proposal.
    if (isMovingProposalPoint && proposal) {
      onRepairProposal({ point: { x: target.x, y: target.y } })
      setIsMovingProposalPoint(false)
      setPointError(null)
      setIsPointMode(false)
      pointModeButtonRef.current?.focus()
      return
    }

    setPointTarget(target)
    if (proposal) onDiscardProposal()
    setPlayheadMs(target.timeMs)
    setPointError(null)
    setIsPointMode(false)
    pointModeButtonRef.current?.focus()
  }

  function capturePoint(clientX: number, clientY: number) {
    const video = videoRef.current
    if (!video) return

    const geometry = monitorGeometry(video, monitorFitMode)
    if (!geometry || video.videoWidth <= 0 || video.videoHeight <= 0 || !Number.isFinite(video.currentTime)) {
      setPointError('The video is not ready for pointing yet.')
      return
    }
    const content = geometry.displayedContentRect
    const visibleLeft = Math.max(geometry.stageRect.left, content.left)
    const visibleTop = Math.max(geometry.stageRect.top, content.top)
    const visibleRight = Math.min(geometry.stageRect.left + geometry.stageRect.width, content.left + content.width)
    const visibleBottom = Math.min(geometry.stageRect.top + geometry.stageRect.height, content.top + content.height)
    if (clientX < visibleLeft || clientX > visibleRight || clientY < visibleTop || clientY > visibleBottom) {
      setPointError('Choose a point inside the visible video.')
      return
    }
    completePointCapture(Object.freeze({
      x: clampNormalized((clientX - content.left) / content.width),
      y: clampNormalized((clientY - content.top) / content.height),
      timeMs: Math.max(0, Math.round(video.currentTime * 1_000)),
    }))
  }

  function handleAcceptProposal() {
    pendingProposalResolutionRef.current = 'accepted'
    onAcceptProposal()
  }

  function handleDiscardProposal() {
    pendingProposalResolutionRef.current = 'discarded'
    onDiscardProposal()
  }

  function handlePointModeKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (!isPointMode) return

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelPointMode()
      return
    }

    if (event.target !== pointLayerRef.current) return

    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      pointModeButtonRef.current?.focus()
      return
    }

    const movement = {
      ArrowLeft: { x: -KEYBOARD_POINT_STEP, y: 0 },
      ArrowRight: { x: KEYBOARD_POINT_STEP, y: 0 },
      ArrowUp: { x: 0, y: -KEYBOARD_POINT_STEP },
      ArrowDown: { x: 0, y: KEYBOARD_POINT_STEP },
    }[event.key]

    if (movement) {
      event.preventDefault()
      setDraftPoint((point) => ({
        x: clampNormalized(point.x + movement.x),
        y: clampNormalized(point.y + movement.y),
      }))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const currentTimeSeconds = videoRef.current?.currentTime
      if (
        currentTimeSeconds === undefined ||
        !Number.isFinite(currentTimeSeconds) ||
        currentTimeSeconds < 0
      ) {
        setPointError('The current video time is unavailable.')
        return
      }

      completePointCapture({
        ...draftPoint,
        timeMs: Math.round(currentTimeSeconds * 1000),
      })
    }
  }

  const advancedTimelineControls = (
    <div className="studio-screen__legacy-timeline-controls">
      <div className="studio-screen__track-actions">
        <button type="button" disabled={timelineBusy} onClick={() => runTimelineEdit('split')}>
          Cut here
        </button>
        <button type="button" disabled={timelineBusy} onClick={() => runTimelineEdit('remove')}>
          Remove this section
        </button>
        <button type="button" disabled={timelineBusy} onClick={() => runTimelineEdit('hide')}>
          Hide this section
        </button>
        <button type="button" disabled={timelineBusy} onClick={() => runTimelineEdit('show')}>
          Bring it back
        </button>
      </div>
      <details className="studio-screen__section-adjustments">
        <summary>Adjust section at playhead</summary>
        <div className="studio-screen__section-adjustment-grid">
          <label>
            Seconds to remove
            <input
              aria-label="Seconds to remove"
              type="number"
              min="0.1"
              step="0.1"
              value={trimSeconds}
              onChange={(event) => setTrimSeconds(Number(event.currentTarget.value))}
            />
          </label>
          <div className="studio-screen__track-actions">
            <button type="button" disabled={timelineBusy} onClick={() => runTimelineEdit('trim-start')}>
              Shorten the start
            </button>
            <button type="button" disabled={timelineBusy} onClick={() => runTimelineEdit('trim-end')}>
              Shorten the end
            </button>
            <button type="button" disabled={timelineBusy} onClick={() => runTimelineEdit('remove-gap')}>
              Remove and leave empty space
            </button>
          </div>
          <div className="studio-screen__track-actions">
            <button type="button" disabled={timelineBusy} onClick={() => runTimelineEdit('move-earlier')}>
              Move earlier
            </button>
            <button type="button" disabled={timelineBusy} onClick={() => runTimelineEdit('move-later')}>
              Move later
            </button>
          </div>
          <label>
            Loudness change (dB)
            <input
              aria-label="Loudness change"
              type="number"
              min="-60"
              max="24"
              step="1"
              value={clipGainDb}
              onChange={(event) => setClipGainDb(Number(event.currentTarget.value))}
            />
          </label>
          <label>
            Fade in (seconds)
            <input
              aria-label="Fade in seconds"
              type="number"
              min="0"
              step="0.1"
              value={fadeInSeconds}
              onChange={(event) => setFadeInSeconds(Number(event.currentTarget.value))}
            />
          </label>
          <label>
            Fade out (seconds)
            <input
              aria-label="Fade out seconds"
              type="number"
              min="0"
              step="0.1"
              value={fadeOutSeconds}
              onChange={(event) => setFadeOutSeconds(Number(event.currentTarget.value))}
            />
          </label>
          <button type="button" disabled={timelineBusy} onClick={() => runTimelineEdit('audio')}>
            Apply sound
          </button>
        </div>
      </details>

      <div className="studio-screen__captions">
        <h3>Captions and overlays</h3>
        <p>
          Add captions, titles, callouts, B-roll, images or music. These proven controls remain
          available while Timeline V1 becomes the primary editing surface.
        </p>
        <AddOverlayPanel
          editProject={editProject}
          playheadMs={playheadMs}
          busy={timelineBusy || captionsBusy}
          onCreate={onCreateOverlay}
          onUploadAsset={onUploadAsset}
        />
        {acceptedOverlays.length > 0 ? (
          <div className="studio-screen__overlay-repairs" aria-label="Things added to the video">
            <h4>Things you added</h4>
            {acceptedOverlays.map((item) => (
              <OverlayRepairPanel
                key={
                  item.kind === 'add-title'
                    ? item.titleId
                    : item.kind === 'add-callout'
                      ? item.calloutId
                      : item.kind === 'add-media-overlay'
                        ? item.overlayId
                        : item.musicId
                }
                editProject={editProject}
                item={item}
                playheadMs={playheadMs}
                busy={timelineBusy || captionsBusy}
                onRepair={onCreateOverlay}
              />
            ))}
          </div>
        ) : null}
        <label className="studio-screen__captions-picker">
          <span>Add captions from a transcript file</span>
          <input
            type="file"
            accept="application/json,.json"
            disabled={timelineBusy || captionsBusy}
            data-testid="caption-file-input"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void onAddCaptions(file)
            }}
          />
        </label>
        {captionsNotice ? (
          <p className="studio-screen__track-notice" role="status">
            {captionsNotice}
          </p>
        ) : null}
      </div>
    </div>
  )

  const conversationPanel = (
        <aside
          className="studio-screen__conversation"
          aria-label={workspace === 'studio' ? 'AI edit panel' : 'Conversation'}
        >
          <div className="studio-screen__panel-heading">
            <div>
              <span className="studio-screen__section-index">{workspace === 'assist' ? '02' : '04'}</span>
              <h2>{workspace === 'assist' ? 'Ask Sanverse' : 'AI edits'}</h2>
            </div>
            <div className="studio-screen__panel-heading-actions">
              {workspace === 'studio' && isAiPanelCollapsed && proposal ? (
                <span
                  className="studio-screen__pending-indicator"
                  role="status"
                  aria-label="Pending AI proposal"
                >
                  1 pending
                </span>
              ) : null}
              <span className="studio-screen__unavailable-tag">
                {workspace === 'assist' ? 'Nothing applies without Accept' : 'Preview mode'}
              </span>
            </div>
          </div>

          <div
            id="studio-ai-panel-content"
            className="studio-screen__ai-panel-content"
          >
          <ChatComposer
            conversation={conversation}
            canSend={!proposal}
            disabledReason={
              proposal ? 'Accept or reject the pending proposal before asking for another edit.' : null
            }
            onSend={(message) => onSendMessage(message, buildIntentContext())}
            draft={conversationDraft}
            onDraftChange={setConversationDraft}
          />

          <section className="studio-screen__draft" aria-labelledby="studio-draft-label">
            <h3 id="studio-draft-label">Draft — not executed</h3>
            {draftRequest ? (
              <p>{draftRequest}</p>
            ) : (
              <p className="studio-screen__empty-copy">No draft request yet.</p>
            )}
          </section>

          <AssistProposalPanel
            proposal={proposal}
            conversation={conversation}
            editError={editError}
            placedStartMs={proposalStartMs}
            durationMs={proposalDurationMs}
            summaryRef={proposalSummaryRef}
            onAccept={handleAcceptProposal}
            onReject={handleDiscardProposal}
            onOpenStudio={() => onWorkspaceChange?.('studio')}
            showOpenStudio={workspace === 'assist'}
          >
            {proposal ? (
              <NameplateRepair
                placedStartMs={proposalStartMs}
                proposal={proposal.operation}
                playheadMs={Math.max(0, playheadMs)}
                isMovingPoint={isMovingProposalPoint}
                onRepair={onRepairProposal}
                onMovePoint={startMovingProposalPoint}
              />
            ) : null}
          </AssistProposalPanel>

          {proposalResult ? (
            <p
              ref={proposalResultRef}
              className="studio-screen__proposal-result"
              role="status"
              aria-label="Proposal result"
              tabIndex={-1}
            >
              {proposalResult}
            </p>
          ) : null}

          {workspace === 'studio' ? <section className="studio-screen__history" aria-labelledby="studio-history-label">
            <h3 id="studio-history-label">History</h3>
            {acceptedCount > 0 ? (
              <ol className="studio-screen__history-list">
                {acceptedRecords.map((record) => (
                  <li key={record.changeSet.changeSetId}>
                    {record.changeSet.operations.map(describeOperation).join(', ')}
                    {record.blockedReason ? <span className="studio-screen__history-blocked"> · needs attention</span> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="studio-screen__empty-copy">No accepted edits.</p>
            )}
            {!embedded ? <div className="studio-screen__history-actions">
              <button
                type="button"
                aria-label="Undo edit"
                disabled={Boolean(proposal) || acceptedCount === 0}
                onClick={onUndo}
              >
                Undo
              </button>
              <button
                type="button"
                aria-label="Redo edit"
                disabled={Boolean(proposal) || editProject.redoStack.length === 0}
                onClick={onRedo}
              >
                Redo
              </button>
            </div> : null}
            {!embedded && saveState === 'saving' ? <p className="studio-screen__save-status" role="status" aria-label="Project save status">Saving locally…</p> : null}
            {!embedded && saveState === 'saved' ? <p className="studio-screen__save-status" role="status" aria-label="Project save status">Saved locally</p> : null}
            {!embedded && saveState === 'error' ? <p className="studio-screen__save-error" role="alert">This edit is open, but it could not be saved locally.</p> : null}
          </section> : null}

          <section
            ref={exportResultRef}
            className="studio-screen__export-result"
            aria-labelledby="studio-export-label"
            tabIndex={-1}
          >
            <h3 id="studio-export-label">Export</h3>
            <p id={EXPORT_DESCRIPTION} className="studio-screen__empty-copy">
              {acceptedCount === 0
                ? 'Accept at least one edit before exporting.'
                : proposal
                  ? 'Accept or discard the pending proposal before exporting.'
                  : 'Your accepted edits are ready to render.'}
            </p>
            {exportState.status === 'rendering' ? (
              <ExportProgressStatus phase={exportState.phase} startedAt={exportState.startedAt} />
            ) : null}
            {exportState.status === 'timed-out' ? (
              <div className="studio-screen__export-error" role="alert">
                <p>
                  The export is still running after {formatExportElapsed(exportState.elapsedMs)} and
                  has not finished. Your accepted edits are safe. It may still complete — retry to
                  reconnect to the same export.
                </p>
                <button type="button" onClick={onExport}>Retry export</button>
              </div>
            ) : null}
            {exportState.status === 'error' ? (
              <div className="studio-screen__export-error" role="alert">
                <p>{exportState.message}</p>
                <button type="button" onClick={onExport}>Retry export</button>
              </div>
            ) : null}
            {exportState.status === 'ready' ? (
              <div className="studio-screen__export-ready" role="status" aria-label="Export status">
                <strong>Export ready</strong>
                <span>{exportState.result.width} × {exportState.result.height} · {Math.round(exportState.result.durationMs / 1000)}s</span>
                <a href={exportState.result.mediaUrl} download="sanverse-edited.mp4">Download MP4</a>
              </div>
            ) : null}
          </section>

          </div>
        </aside>
  )

  const leftDockLabel = studioWorkspace === 'edit'
    ? 'Media'
    : studioWorkspace === 'effects'
      ? 'Effects'
      : studioWorkspace === 'color'
        ? 'Color'
        : 'Audio'
  const visualToolSupported = ['caption', 'nameplate', 'title', 'callout', 'media-overlay'].includes(inspectorSelection.kind)
  const audioToolSupported = ['video', 'dialogue', 'music'].includes(inspectorSelection.kind)
  const toolSupported = studioWorkspace === 'edit'
    || (studioWorkspace === 'effects' && (visualToolSupported || inspectorSelection.kind === 'video'))
    || (studioWorkspace === 'color' && visualToolSupported)
    || (studioWorkspace === 'audio' && audioToolSupported)

  const applyPreset = (preset: Exclude<StudioLayoutV2State['preset'], 'custom'>) => {
    const next = adaptStudioLayoutToViewport(STUDIO_LAYOUT_PRESETS[preset], viewport())
    setWorkspaceLayout(next)
    persistWorkspaceLayout(next)
    if (next.activeWorkspace !== studioWorkspace) onStudioWorkspaceChange?.(next.activeWorkspace)
    requestGeometryRefresh()
  }

  const resetLayout = () => {
    const next = adaptStudioLayoutToViewport(defaultStudioLayoutV2(), viewport())
    setWorkspaceLayout(next)
    persistWorkspaceLayout(next)
    if (studioWorkspace !== 'edit') onStudioWorkspaceChange?.('edit')
    requestGeometryRefresh()
  }

  const commitLayoutValue = (patch: Partial<Omit<StudioLayoutV2State, 'schemaVersion'>>) => {
    setWorkspaceLayout((current) => {
      const next = Object.freeze({ ...current, ...patch, preset: 'custom' as const })
      persistWorkspaceLayout(next)
      return next
    })
    requestGeometryRefresh()
  }

  return (
    <main
      id={`studio-workspace-panel-${studioWorkspace}`}
      role={workspace === 'studio' ? 'tabpanel' : undefined}
      aria-labelledby={workspace === 'studio' ? `studio-workspace-tab-${studioWorkspace}` : undefined}
      className={`studio-screen studio-screen--${workspace}`}
      data-studio-workspace={studioWorkspace}
      data-left-collapsed={workspaceLayout.mediaCollapsed}
      data-right-collapsed={workspaceLayout.toolCollapsed}
      onKeyDown={handlePointModeKeyDown}
    >
      <a className="skip-link" href="#studio-primary">Skip to video editor</a>
      {!embedded ? <header className="studio-screen__topbar">
        <button className="studio-screen__back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Back to Home
        </button>

        <div className="studio-screen__project" aria-label="Selected project">
          <span className="studio-screen__project-label">Current project</span>
          <strong title={project.name}>{project.name}</strong>
        </div>

        <button
          className="studio-screen__export"
          type="button"
          disabled={!canExport}
          aria-label={isRendering ? 'Exporting video' : canExport ? 'Export video' : 'Export unavailable'}
          aria-describedby={!canExport && !isRendering ? EXPORT_DESCRIPTION : undefined}
          onClick={onExport}
        >
          {isRendering ? 'Exporting…' : 'Export'}
        </button>
      </header> : null}

      {workspace === 'studio' ? (
        <div className="studio-screen__workspace-toolbar" aria-label="Workspace layout controls">
          <WorkspacePresetMenu value={workspaceLayout.preset} onApply={applyPreset} onReset={resetLayout} />
          <div className="studio-screen__dock-visibility">
            {!embedded ? (
              <>
                <button type="button" aria-label="Undo edit" disabled={Boolean(proposal) || acceptedCount === 0} onClick={onUndo}>Undo</button>
                <button type="button" aria-label="Redo edit" disabled={Boolean(proposal) || editProject.redoStack.length === 0} onClick={onRedo}>Redo</button>
              </>
            ) : null}
            <button
              type="button"
              aria-pressed={!workspaceLayout.mediaCollapsed}
              aria-label={`${workspaceLayout.mediaCollapsed ? 'Show' : 'Hide'} ${leftDockLabel} dock`}
              onClick={() => commitLayoutValue({ mediaCollapsed: !workspaceLayout.mediaCollapsed })}
            >
              {workspaceLayout.mediaCollapsed ? `Show ${leftDockLabel}` : `Hide ${leftDockLabel}`}
            </button>
            <button
              type="button"
              aria-pressed={!workspaceLayout.toolCollapsed}
              aria-label={`${workspaceLayout.toolCollapsed ? 'Show' : 'Hide'} Tool dock`}
              onClick={() => commitLayoutValue({ toolCollapsed: !workspaceLayout.toolCollapsed })}
            >
              {workspaceLayout.toolCollapsed ? 'Show Tool' : 'Hide Tool'}
            </button>
          </div>
        </div>
      ) : null}

      <StudioLayoutV2
        layout={workspaceLayout}
        responsiveMode={responsiveMode}
        aiOpen={!isAiPanelCollapsed}
        pendingProposal={Boolean(proposal)}
        compactControls={(
          <div className="studio-screen__compact-panel-switcher" aria-label="Studio side panels">
            <button
              type="button"
              aria-controls="studio-left-dock"
              aria-expanded={compactSidePanel === 'media'}
              onClick={() => setCompactSidePanel((current) => current === 'media' ? null : 'media')}
            >
              {compactSidePanel === 'media' ? `Hide ${leftDockLabel}` : `Show ${leftDockLabel}`}
            </button>
            <button
              type="button"
              aria-controls="studio-inspector-region"
              aria-expanded={compactSidePanel === 'inspector'}
              onClick={() => setCompactSidePanel((current) => current === 'inspector' ? null : 'inspector')}
            >
              {compactSidePanel === 'inspector' ? 'Hide Tool' : 'Show Tool'}
            </button>
          </div>
        )}
        ai={conversationPanel}
        onAiOpenChange={setAiOpen}
        onLayoutChange={(next) => {
          setWorkspaceLayout(next)
          persistWorkspaceLayout(next)
          requestGeometryRefresh()
        }}
        preview={(<>
        <section
          id="studio-primary"
          className="studio-screen__canvas"
          aria-label={workspace === 'studio' ? 'Program canvas' : 'Video canvas'}
          tabIndex={-1}
        >
          <SanverseEditorMonitor
            sourceStatus={monitorSourceStatus}
            fitMode={monitorFitMode}
            guides={monitorGuides}
            pointActive={isPointMode}
            pointSelected={Boolean(pointTarget)}
            playing={monitorPlaying}
            currentTicks={playheadTicks}
            durationTicks={compositionDurationTicks}
            frameRate={primaryVideoAsset?.frameRate ?? null}
            muted={monitorMuted}
            volume={monitorVolume}
            pointButtonRef={pointModeButtonRef}
            onTogglePoint={isPointMode ? cancelPointMode : enterPointMode}
            onFitModeChange={(mode) => { setMonitorFitMode(mode); requestGeometryRefresh() }}
            onGuidesChange={setMonitorGuides}
            onTogglePlayback={toggleMonitorPlayback}
            onStepFrame={stepMonitorFrame}
            onSeek={seekCompositionTicks}
            onMutedChange={setMonitorMutedState}
            onVolumeChange={setMonitorVolumeState}
          >
          <div className="studio-screen__video-frame">
            <div className="studio-screen__video-surface">
              <video
                ref={videoRef}
                className="studio-screen__video"
                preload="metadata"
                src={project.mediaUrl}
                aria-label={`Preview of ${project.name}`}
                style={{ opacity: transitionOpacity }}
                onError={() => setHasPreviewError(true)}
              >
                Your browser does not support video playback.
              </video>
              {/*
                Visibility comes from ONE place: the base-layer resolver.

                `data-visible` rather than the `hidden` attribute on purpose.
                The stylesheet sets `display: block` on this class, and an author
                rule beats the browser's own `[hidden] { display: none }` — so
                `hidden` was being set and silently ignored, leaving a canvas
                that had never drawn a frame sitting over healthy video as an
                opaque black rectangle. That is the black preview the owner
                recorded. See `monitor-base-layer.ts`.
              */}
              {videoContentLayerStyle ? (
                <canvas
                  ref={footageMotionCanvasRef}
                  className="studio-screen__footage-motion-canvas"
                  data-testid="footage-motion-canvas"
                  data-visible={showsMotionCanvas(baseLayer) ? 'true' : 'false'}
                  style={{ ...videoContentLayerStyle, opacity: transitionOpacity }}
                  aria-hidden="true"
                />
              ) : null}

              {/*
                A stretch that was removed but left in place is black in the
                exported file, so it is black here too. Covering the element
                rather than hiding it keeps the layout, the point marker, and
                the overlay positions exactly where they were.

                Driven only by the base-frame state, so a pause, a seek, a
                waiting canvas, a panel resize, or a loading source can never
                paint this. If it is black here, the exported file is black too.
              */}
              {showsGapLayer(baseLayer) ? (
                <div className="studio-screen__video-hole" data-testid="video-hole" aria-hidden="true" />
              ) : null}

              {/*
                Say which of the four black states this is, rather than leaving
                the user to guess whether the preview is broken.
              */}
              {baseFrameMessage ? (
                <p
                  className="studio-screen__base-frame-status"
                  data-testid="base-frame-status"
                  data-state={baseFrameState}
                  role="status"
                  aria-label="Preview status"
                >
                  {baseFrameMessage}
                </p>
              ) : null}

              {videoContentLayerStyle ? (
                <div
                  ref={videoContentLayerRef}
                  className="studio-screen__video-content-layer"
                  data-testid="video-content-layer"
                  style={{ ...videoContentLayerStyle, ...nameplateVariables, ...captionVariables, ...titleVariables }}
                >
                  <MonitorSafeAreas visible={monitorGuides} />
                  {previewMedia.map((node) => (
                    <MediaOverlay
                      key={node.nodeId}
                      node={node}
                      sourceUrl={assetUrl(node.assetId)}
                      isStill={assetKinds.get(node.assetId) === 'image'}
                      ticks={playheadPreviewTicks}
                      compositionWidth={composition.width}
                      compositionHeight={composition.height}
                      scale={previewScale}
                      visualStyle={motionStyle(node)}
                    />
                  ))}
                  {previewCallouts.map((node) => (
                    <CalloutOverlay
                      key={node.nodeId}
                      node={node}
                      compositionWidth={composition.width}
                      compositionHeight={composition.height}
                      scale={previewScale}
                      visualStyle={motionStyle(node)}
                    />
                  ))}
                  {previewTitles.map((node) => (
                    <TitleOverlay
                      key={node.nodeId}
                      node={node}
                      compositionWidth={composition.width}
                      compositionHeight={composition.height}
                      scale={previewScale}
                      visualStyle={motionStyle(node)}
                    />
                  ))}
                  {previewNodes.map((node) => (
                    <NameplateOverlay
                      key={node.nodeId}
                      node={node}
                      compositionWidth={composition.width}
                      compositionHeight={composition.height}
                      scale={previewScale}
                      visualStyle={motionStyle(node)}
                    />
                  ))}
                  {previewCaptions.map((node) => (
                    <CaptionOverlay
                      key={node.nodeId}
                      node={node}
                      compositionWidth={composition.width}
                      compositionHeight={composition.height}
                      scale={previewScale}
                      visualStyle={motionStyle(node)}
                    />
                  ))}
                  {workspace === 'studio' && !isPointMode && selectedVideoSelection && footageMotionDraft && selectedSourceTime ? (
                    <PrimaryFootageCanvasControls
                      draft={footageMotionDraft}
                      sourceTime={selectedSourceTime}
                      setDraft={setFootageMotionDraft}
                      busy={canvasBusy || timelineBusy}
                      narrow={canvasNarrow}
                      cropMode={canvasCropMode}
                      onCropModeChange={setCanvasCropMode}
                      onCommit={commitFootageMotionGesture}
                      onPausePlayback={() => videoRef.current?.pause()}
                      onFocusInspector={() => inspectorRegionRef.current?.focus()}
                    />
                  ) : null}
                  {workspace === 'studio' && !isPointMode && !selectedVideoSelection ? (
                    <CanvasInteractionLayer
                      contentLayerRef={videoContentLayerRef}
                      selectionResult={canvasSelectionResult}
                      targets={canvasTargets}
                      draftController={visualDraftController}
                      busy={canvasBusy}
                      narrow={canvasNarrow}
                      cropMode={canvasCropMode}
                      onCropModeChange={setCanvasCropMode}
                      onSelectTimelineItem={requestTimelineSelection}
                      onApply={onCreateOverlay}
                      onProposalPreviewPoint={setProposalCanvasPoint}
                      onProposalPointCommit={(point) => {
                        setProposalCanvasPoint(null)
                        if (proposal) onRepairProposal({ point })
                      }}
                      onPausePlayback={() => videoRef.current?.pause()}
                      onFocusInspector={() => inspectorRegionRef.current?.focus()}
                    />
                  ) : null}
                </div>
              ) : null}

              {markerPosition ? (
                <>
                  <span
                    className="studio-screen__point-marker"
                    role="img"
                    aria-label="Selected point"
                    style={{ left: `${markerPosition.left}%`, top: `${markerPosition.top}%` }}
                  />
                  {pointTarget ? <p className="studio-screen__point-selection" role="status">Here · {formatPointTargetTime(pointTarget.timeMs)}</p> : null}
                </>
              ) : null}

              {isPointMode ? (
                <>
                  <button
                    ref={pointLayerRef}
                    className="studio-screen__point-layer"
                    type="button"
                    aria-label="Choose a point on the visible video"
                    aria-describedby="point-mode-guidance"
                    onClick={(event) => capturePoint(event.clientX, event.clientY)}
                  />
                  {draftPosition ? (
                    <span
                      className="studio-screen__point-cursor"
                      role="img"
                      aria-label="Point cursor"
                      style={{ left: `${draftPosition.left}%`, top: `${draftPosition.top}%` }}
                    />
                  ) : null}
                  <p id="point-mode-guidance" className="studio-screen__point-guidance" role="status" aria-label="Point guidance" aria-live="polite">
                    Click or use Arrow keys to place the cursor · Enter confirms · Esc cancels
                  </p>
                </>
              ) : null}
            </div>
          </div>
          </SanverseEditorMonitor>
          {pointTarget ? (
            <NameplateComposer
              target={pointTarget}
              composition={composition}
              createOperationId={createOperationId}
              onProposal={onProposal}
            />
          ) : null}
          {pointError ? <p role="alert" className="studio-screen__point-error">{pointError}</p> : null}
          {hasPreviewError ? (
            <p role="alert">
              This video could not be played. It may be unavailable right now, or in a format
              this browser cannot show. Reload to try again, or go back to Home to choose
              another video.
            </p>
          ) : null}
        </section>
        </>)}
        media={(<>

        <section
          id="studio-left-dock"
          className={`studio-screen__media${compactSidePanel === 'media' ? ' studio-screen__side-region--compact-open' : ''}`}
          aria-label={`${leftDockLabel} dock`}
          hidden={workspace !== 'studio'}
        >
          {studioWorkspace === 'edit' ? (
            <MediaBin
              model={mediaModel}
              selectedAssetId={selectedMediaAssetId}
              busy={timelineBusy}
              presentation={mediaPresentation}
              organization={mediaOrganization}
              onPresentationChange={setMediaPresentation}
              onSelect={setSelectedMediaAssetId}
              onImport={importMediaFiles}
              onAddAsBroll={addMediaAsBroll}
              onAddAsMusic={addMediaAsMusic}
            />
          ) : (
            <StudioWorkspacePanel
              workspace={studioWorkspace}
              selection={inspectorSelection}
              visualDraftController={visualDraftController}
            />
          )}
        </section>
        </>)}
        tool={(<>
          <section
            ref={inspectorRegionRef}
            id="studio-inspector-region"
            className={`studio-screen__inspector${compactSidePanel === 'inspector' ? ' studio-screen__side-region--compact-open' : ''}`}
            aria-label="Inspector"
            tabIndex={-1}
            hidden={workspace !== 'studio'}
          >
            <div className="studio-screen__workspace-tool-heading">
              <span className="studio-screen__section-index">03</span>
              <h2>{studioWorkspace === 'edit' ? 'Inspector' : studioWorkspace === 'effects' ? 'Effect controls' : studioWorkspace === 'color' ? 'Color controls' : 'Audio controls'}</h2>
            </div>
            {toolSupported ? <>
            {selectedVideoSelection && footageMotionDraft && studioWorkspace !== 'color' && studioWorkspace !== 'audio' ? (
              <FootageMotionInspector
                draft={footageMotionDraft}
                accepted={acceptedFootageMotion}
                sourceTime={selectedSourceTime}
                busy={timelineBusy}
                setDraft={setFootageMotionDraft}
                onApply={applyFootageMotion}
                onSeekSourceTime={seekSelectedSourceTime}
              />
            ) : null}
            <Inspector
              selection={inspectorSelection}
              assets={editProject.assets}
              busy={timelineBusy}
              proposalActionsBusy={isRendering}
              playheadTicks={playheadTicks}
              pendingSelectionChange={pendingTimelineSelection
                ? {
                    nextLabel: pendingTimelineSelection.itemId
                      ? timelineModel.lanes
                          .flatMap((lane) => lane.items)
                          .find((item) => item.id === pendingTimelineSelection.itemId)?.label ?? 'the selected item'
                      : 'nothing selected',
                  }
                : null}
              onDirtyChange={setInspectorSectionDirty}
              onStaySelection={() => setPendingTimelineSelection(null)}
              onDiscardSelection={discardInspectorDraftAndContinue}
              onAcceptProposal={onAcceptProposal}
              onRejectProposal={onDiscardProposal}
              onOpenProposal={() => onWorkspaceChange?.('assist')}
              onSeek={seekCompositionTicks}
              onApply={onCreateOverlay}
              visualDraftController={visualDraftController}
              onRequestCanvasCrop={() => setCanvasCropMode(true)}
            />
            </> : (
              <div className="studio-screen__workspace-truth" role="status">
                <strong>{studioWorkspace === 'color' ? 'Color adjustment is not available for this item yet.' : studioWorkspace === 'audio' ? 'Select V1, A1 or A2 to use current audio controls.' : 'This item does not support visual effects yet.'}</strong>
                {studioWorkspace === 'color' && inspectorSelection.kind === 'video' ? <p>Primary-video color controls are coming in the Creator Color milestone.</p> : null}
              </div>
            )}
          </section>
        </>)}
        timeline={(<>
      {workspace === 'assist' ? (
        <AssistChangeStrip
          items={assistChanges}
          selectedId={selectedAssistChangeId}
          onSelect={setSelectedAssistChangeId}
          onSeek={seekAssistChange}
          onOpenStudio={() => onWorkspaceChange?.('studio')}
        />
      ) : <>
        <section
          className="studio-screen__time-strip"
          aria-label="Timeline workspace"
        >
        {/*
          The heading used to be a numbered section title with a slogan under
          it, which is how a progress report looks rather than how an editor
          looks. The Timeline is the thing the user came here to use, so it now
          starts with its own controls and the label is small enough to read
          past. It is kept for screen readers, which still need to be told which
          region they have landed in.
        */}
        <h2 className="studio-screen__time-strip-heading">Timeline</h2>
        <Timeline
          model={timelineModel}
          playheadTicks={playheadTicks}
          viewport={timelineViewport}
          selectedItemId={selectedTimelineItemId}
          busy={timelineBusy}
          trimAmountTicks={Math.max(1, Math.round(trimSeconds * PROJECT_TIMESCALE))}
          gainDb={clipGainDb}
          fadeInTicks={Math.max(0, Math.round(fadeInSeconds * PROJECT_TIMESCALE))}
          fadeOutTicks={Math.max(0, Math.round(fadeOutSeconds * PROJECT_TIMESCALE))}
          advancedControls={advancedTimelineControls}
          dragPreview={mediaDragInFlight}
          onMediaDrop={MEDIA_DRAG_ENABLED ? handleMediaDrop : null}
          lockedTrackIds={lockedTrackIds}
          trackOutputs={trackOutputs}
          placementMode={timelinePlacementMode}
          snappingEnabled={snappingEnabled}
          onToggleTrackLock={handleToggleTrackLock}
          onToggleTrackOutput={handleToggleTrackOutput}
          onPlacementMode={setTimelinePlacementMode}
          onToggleSnapping={() => setSnappingEnabled((current) => !current)}
          onItemAction={handleTimelineItemAction}
          onViewportChange={setTimelineViewport}
          onSeek={seekCompositionTicks}
          onSelect={requestTimelineSelection}
          onGesture={handleTimelineGesture}
          onOpenProposal={() => {
            commitLayoutValue({ toolCollapsed: false })
            requestAnimationFrame(() => inspectorRegionRef.current?.focus())
          }}
        />
        {timelineNotice ? (
          <p className="studio-screen__track-notice" role="status">
            {timelineNotice}
          </p>
        ) : null}
        </section>
      </>}
        </>)}
      />
    </main>
  )
}
