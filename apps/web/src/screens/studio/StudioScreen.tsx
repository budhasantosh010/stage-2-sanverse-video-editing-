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
  compositionDuration,
  effectiveComposition,
  toMilliseconds,
} from '@sanverse/edit-domain'
import { proposalPlacement } from '../../app/app-state'
import type { ConversationState, PendingProposal, ProposalRepair, StudioState } from '../../app/app-state'
import { ChatComposer } from '../../features/conversation/ChatComposer'
import type { IntentContextInput } from '../../features/conversation/conversation-client'
import { NameplateRepair } from '../../features/proposal-repair/NameplateRepair'
import { describeOperation } from '../../features/history/describe-operation'
import {
  buildMoveAtPlayhead,
  buildRemoveAtPlayhead,
  buildSetAudioAtPlayhead,
  buildSetEnabledAtPlayhead,
  buildSplitAtPlayhead,
  buildTrimAtPlayhead,
  timelineBlocks,
} from '../../features/timeline/timeline-edits'
import {
  advancePlayback,
  isUncutPassthrough,
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
  visibleNameplates,
  withPendingProposal,
} from '../../features/render-plan/render-plan-preview'
import type { ProjectExportState } from '../../features/project-export/project-export'
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
  capturePointTarget,
  formatPointTargetTime,
  getRenderedVideoContentBox,
  type CapturedPointTarget,
} from '../../features/point-target/point-target'
import './StudioScreen.css'
import type { EditorWorkspace } from '../../editor/EditorShell'

export type StudioScreenProps = {
  embedded?: boolean
  workspace?: EditorWorkspace
  project: StudioState['project']
  proposal: PendingProposal | null
  conversation: ConversationState
  editProject: EditProject
  editError: string | null
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
  /** Put one file on the project's shelf, and say what it turned out to be. */
  onUploadAsset(file: File): Promise<MediaAsset | string>
  /** Where each extra file can be fetched from, for the preview. */
  assetUrl(assetId: string): string
  onSendMessage(message: string, context: IntentContextInput): void
  onUndo(): void
  onRedo(): void
  exportState: ProjectExportState
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  onExport(): void
  onBack(): void
  onWorkspaceChange?(workspace: EditorWorkspace): void
}

const EXPORT_DESCRIPTION = 'studio-export-description'
const KEYBOARD_POINT_STEP = 0.05

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

function projectPointOntoVideoElement(point: NormalizedPoint, video: HTMLVideoElement) {
  const elementBox = video.getBoundingClientRect()
  const contentBox = getRenderedVideoContentBox(elementBox, video.videoWidth, video.videoHeight)
  if (!contentBox) return null

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

function getVideoContentLayerStyle(video: HTMLVideoElement) {
  const elementBox = video.getBoundingClientRect()
  const contentBox = getRenderedVideoContentBox(elementBox, video.videoWidth, video.videoHeight)
  if (!contentBox) return null

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
  project,
  proposal,
  conversation,
  editProject,
  editError,
  onProposal,
  onDiscardProposal,
  onAcceptProposal,
  onRepairProposal,
  onTimelineEdit,
  onAddCaptions: onAddCaptionsText,
  onCreateOverlay,
  onUploadAsset,
  assetUrl,
  onSendMessage,
  onUndo,
  onRedo,
  exportState,
  saveState,
  onExport,
  onBack,
  onWorkspaceChange,
}: StudioScreenProps) {
  const draftRequest = project.draftRequest.trim()
  const [hasPreviewError, setHasPreviewError] = useState(false)
  const [isPointMode, setIsPointMode] = useState(false)
  // True when Point is being used to move an existing proposal rather than to
  // start a new one, so capturing a point repairs instead of replacing.
  const [isMovingProposalPoint, setIsMovingProposalPoint] = useState(false)
  const [pointTarget, setPointTarget] = useState<CapturedPointTarget | null>(null)
  const [draftPoint, setDraftPoint] = useState<NormalizedPoint>({ x: 0.5, y: 0.5 })
  const [, setVideoLayoutRevision] = useState(0)
  const [pointError, setPointError] = useState<string | null>(null)
  const [playheadMs, setPlayheadMs] = useState(0)
  /** True while the finished video is sitting on a deliberately empty stretch. */
  const [isShowingHole, setIsShowingHole] = useState(false)
  // Playback state the media effect needs but must not re-subscribe for. The
  // effect is attached once, so what it reads has to arrive through refs.
  const segmentsRef = useRef<readonly PlaybackSegment[]>([])
  const segmentIndexRef = useRef(0)
  const totalTicksRef = useRef(0)
  const inHoleRef = useRef(false)
  const [proposalResult, setProposalResult] = useState<string | null>(null)
  const [selectedAssistChangeId, setSelectedAssistChangeId] = useState<string | null>(null)
  const [isAiPanelCollapsed, setIsAiPanelCollapsed] = useState(false)
  const [compactSidePanel, setCompactSidePanel] = useState<'media' | 'inspector' | null>(null)
  /** A plain sentence explaining why a cut was not made. */
  const [timelineNotice, setTimelineNotice] = useState<string | null>(null)
  const [trimSeconds, setTrimSeconds] = useState(1)
  const [clipGainDb, setClipGainDb] = useState(0)
  const [fadeInSeconds, setFadeInSeconds] = useState(0)
  const [fadeOutSeconds, setFadeOutSeconds] = useState(0)
  const [captionsNotice, setCaptionsNotice] = useState<string | null>(null)
  const [captionsBusy, setCaptionsBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pointModeButtonRef = useRef<HTMLButtonElement>(null)
  const pointLayerRef = useRef<HTMLButtonElement>(null)
  const proposalSummaryRef = useRef<HTMLDivElement>(null)
  const proposalResultRef = useRef<HTMLParagraphElement>(null)
  const exportResultRef = useRef<HTMLElement>(null)
  const pendingProposalResolutionRef = useRef<'accepted' | 'discarded' | null>(null)

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
    target.scrollIntoView?.({ block: 'nearest' })
    if (exportState.status === 'ready' || exportState.status === 'error') target.focus?.()
  }, [exportState.status])

  useEffect(() => {
    if (editError) pendingProposalResolutionRef.current = null
  }, [editError])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const refreshProjection = () => setVideoLayoutRevision((revision) => revision + 1)

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
        return
      }
      const segments = segmentsRef.current
      if (segments.length === 0 || isUncutPassthrough(segments)) {
        setPlayheadMs(Math.round(currentTime * 1000))
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
          return
        case 'seek':
          segmentIndexRef.current = action.segmentIndex
          video.currentTime = action.sourceTicks / PROJECT_TIMESCALE
          setPlayheadMs(action.compositionTicks / TICKS_PER_MS)
          return
        case 'hole':
          enterHole(action.compositionTicks, action.untilTicks)
          return
        case 'ended':
          video.pause()
          setPlayheadMs(action.compositionTicks / TICKS_PER_MS)
          return
        default:
          return
      }
    }
    const refreshPlayhead = () => updatePlayhead(video.currentTime)
    const hasVideoFrameCallback = typeof video.requestVideoFrameCallback === 'function'
    let videoFrameCallbackId: number | null = null
    let stopped = false
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
    if (hasVideoFrameCallback) requestNextVideoFrame()

    return () => {
      stopped = true
      leaveHole()
      if (
        videoFrameCallbackId !== null &&
        typeof video.cancelVideoFrameCallback === 'function'
      ) {
        video.cancelVideoFrameCallback(videoFrameCallbackId)
      }
      observer?.disconnect()
      video.removeEventListener('loadedmetadata', refreshProjection)
      video.removeEventListener('resize', refreshProjection)
      video.removeEventListener('loadedmetadata', refreshPlayhead)
      video.removeEventListener('timeupdate', refreshPlayhead)
      video.removeEventListener('seeked', refreshPlayhead)
    }
  }, [])

  const video = videoRef.current
  const markerPosition = pointTarget && video ? projectPointOntoVideoElement(pointTarget, video) : null
  const draftPosition = isPointMode && video ? projectPointOntoVideoElement(draftPoint, video) : null
  const videoContentLayerStyle = video ? getVideoContentLayerStyle(video) : null

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

  const previewPlan = compilePreviewPlan(
    proposal ? withPendingProposal(editProject, proposal.operation) : editProject,
  )
  const playheadPreviewTicks = millisecondsToTicks(playheadMs)
  const previewNodes = previewPlan ? visibleNameplates(previewPlan, playheadPreviewTicks) : []
  const previewCaptions = previewPlan ? visibleCaptions(previewPlan, playheadPreviewTicks) : []
  const previewTitles = previewPlan ? visibleTitles(previewPlan, playheadPreviewTicks) : []
  const previewCallouts = previewPlan ? visibleCallouts(previewPlan, playheadPreviewTicks) : []
  const previewMedia = previewPlan ? visibleMediaOverlays(previewPlan, playheadPreviewTicks) : []
  const assetKinds = new Map(editProject.assets.map((asset) => [asset.assetId, asset.mediaKind]))
  const contentBox = video ? getRenderedVideoContentBox(video.getBoundingClientRect(), video.videoWidth, video.videoHeight) : null
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
  const motionStyle = (node: Parameters<typeof visualCssStyleAt>[1]) =>
    previewPlan
      ? visualCssStyleAt(
          previewPlan,
          node,
          playheadPreviewTicks,
          composition.width,
          composition.height,
          reducedMotion,
        )
      : undefined
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
  const selectedInspectorChange = assistChanges.find(
    (item) => item.id === selectedAssistChangeId,
  ) ?? null

  const compositionDurationTicks = compositionDuration(composition).ticks

  // The media effect is attached once and reads these through refs, so they are
  // refreshed here rather than by re-subscribing every listener on every cut.
  useEffect(() => {
    segmentsRef.current = previewSegments
    totalTicksRef.current = compositionDurationTicks
    if (segmentIndexRef.current >= previewSegments.length) segmentIndexRef.current = 0
  }, [previewSegments, compositionDurationTicks])

  // Where the pending proposal actually lands on screen. After a cut this is
  // not a number stored on the proposal; it has to be worked out from the
  // footage that survived, and every place that shows a time uses this one
  // value so the panel and the summary can never disagree.
  const timelineSections = timelineBlocks(composition, compositionDurationTicks)
  const playheadTicks = Math.max(0, millisecondsToTicks(playheadMs))
  const playheadPercent =
    compositionDurationTicks > 0
      ? Math.min(100, (playheadTicks / compositionDurationTicks) * 100)
      : 0
  // A cut while a proposal is pending would move the footage the proposal is
  // anchored to, so the two are kept apart rather than racing.
  const timelineBusy = Boolean(proposal) || isRendering

  /**
   * Make one cut, at the playhead, and let the server decide the result.
   *
   * A cut is applied immediately rather than proposed for approval: unlike a
   * nameplate there is nothing to word or position, the preview shows the
   * result at once, and one Undo takes it back. A refusal is shown as a plain
   * sentence and nothing is sent.
   */
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
    if (timelineBusy) return
    let result
    if (action === 'split') {
      result = buildSplitAtPlayhead(composition, playheadTicks, createOperationId, createClipId)
    } else if (action === 'remove' || action === 'remove-gap') {
      result = buildRemoveAtPlayhead(composition, playheadTicks, createOperationId, action === 'remove')
    } else if (action === 'hide' || action === 'show') {
      result = buildSetEnabledAtPlayhead(composition, playheadTicks, action === 'show', createOperationId)
    } else if (action === 'trim-start' || action === 'trim-end') {
      result = buildTrimAtPlayhead(
        composition,
        playheadTicks,
        action === 'trim-start' ? 'start' : 'end',
        trimSeconds * PROJECT_TIMESCALE,
        true,
        createOperationId,
      )
    } else if (action === 'move-earlier' || action === 'move-later') {
      result = buildMoveAtPlayhead(
        composition,
        playheadTicks,
        action === 'move-earlier' ? 'earlier' : 'later',
        createOperationId,
      )
    } else {
      result = buildSetAudioAtPlayhead(
        composition,
        playheadTicks,
        clipGainDb,
        fadeInSeconds * PROJECT_TIMESCALE,
        fadeOutSeconds * PROJECT_TIMESCALE,
        createOperationId,
      )
    }

    if (!result.ok) {
      setTimelineNotice(result.refusal.reason)
      return
    }
    setTimelineNotice(null)
    onTimelineEdit(result.operation)
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
    const nextMs = Math.max(0, ticks / TICKS_PER_MS)
    setPlayheadMs(nextMs)
    if (videoRef.current) videoRef.current.currentTime = nextMs / 1_000
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

    const elementBox = video.getBoundingClientRect()
    const result = capturePointTarget({
      clientX,
      clientY,
      elementBox,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      currentTimeSeconds: video.currentTime,
    })

    if (!result.ok) {
      setPointError(result.error)
      return
    }

    completePointCapture(result.value)
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

  return (
    <main className={`studio-screen studio-screen--${workspace}`} onKeyDown={handlePointModeKeyDown}>
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

      <div className="studio-screen__workspace">
        <section
          id="studio-primary"
          className="studio-screen__canvas"
          aria-label={workspace === 'studio' ? 'Program canvas' : 'Video canvas'}
          tabIndex={-1}
        >
          <div className="studio-screen__canvas-heading">
            <div>
              <span className="studio-screen__section-index">01</span>
              <h1>{workspace === 'assist' ? 'Your video' : 'Video preview'}</h1>
            </div>
            <span className="studio-screen__local-badge">Local source</span>
          </div>

          <div className="studio-screen__video-frame">
            <div className="studio-screen__video-surface">
              <video
                ref={videoRef}
                className="studio-screen__video"
                controls
                preload="metadata"
                src={project.mediaUrl}
                aria-label={`Preview of ${project.name}`}
                style={{ opacity: transitionOpacity }}
                onError={() => setHasPreviewError(true)}
              >
                Your browser does not support video playback.
              </video>

              {/*
                A stretch that was removed but left in place is black in the
                exported file, so it is black here too. Covering the element
                rather than hiding it keeps the layout, the point marker, and
                the overlay positions exactly where they were.
              */}
              {isShowingHole ? (
                <div className="studio-screen__video-hole" data-testid="video-hole" aria-hidden="true" />
              ) : null}

              {videoContentLayerStyle ? (
                <div
                  className="studio-screen__video-content-layer"
                  data-testid="video-content-layer"
                  style={{ ...videoContentLayerStyle, ...nameplateVariables, ...captionVariables, ...titleVariables }}
                >
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
                </div>
              ) : null}

              {markerPosition ? (
                <span
                  className="studio-screen__point-marker"
                  role="img"
                  aria-label="Selected point"
                  style={{ left: `${markerPosition.left}%`, top: `${markerPosition.top}%` }}
                />
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
                </>
              ) : null}
            </div>
          </div>
          <div className="studio-screen__point-tools">
            <button
              ref={pointModeButtonRef}
              className="studio-screen__point-action"
              type="button"
              aria-label={isPointMode ? 'Cancel Point mode' : 'Enter Point mode'}
              aria-pressed={isPointMode}
              onClick={isPointMode ? cancelPointMode : enterPointMode}
            >
              {isPointMode ? 'Cancel' : 'Point'}
            </button>
            <p id="point-mode-guidance" role="status" aria-label="Point guidance" aria-live="polite">
              {isPointMode
                ? 'Click or use Arrow keys to place the cursor. Press Enter to choose or Escape to cancel.'
                : pointTarget
                  ? `Here · ${formatPointTargetTime(pointTarget.timeMs)}`
                  : 'Pause anywhere, then choose Point to mark an exact place.'}
            </p>
          </div>
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

        <div
          className="studio-screen__compact-panel-switcher"
          aria-label="Studio side panels"
          hidden={workspace !== 'studio'}
        >
          <button
            type="button"
            aria-controls="studio-media-region"
            aria-expanded={compactSidePanel === 'media'}
            onClick={() => setCompactSidePanel((current) => current === 'media' ? null : 'media')}
          >
            Media
          </button>
          <button
            type="button"
            aria-controls="studio-inspector-region"
            aria-expanded={compactSidePanel === 'inspector'}
            onClick={() => setCompactSidePanel((current) => current === 'inspector' ? null : 'inspector')}
          >
            Inspector
          </button>
        </div>

        <section
          id="studio-media-region"
          className={`studio-screen__media${compactSidePanel === 'media' ? ' studio-screen__side-region--compact-open' : ''}`}
          aria-label="Project media"
          hidden={workspace !== 'studio'}
        >
          <div className="studio-screen__region-heading">
            <div>
              <span className="studio-screen__section-index">01</span>
              <h2>Media</h2>
            </div>
            <span>{editProject.assets.length}</span>
          </div>
          {editProject.assets.length > 0 ? (
            <ul className="studio-screen__asset-list" aria-label="Project assets">
              {editProject.assets.map((asset, index) => (
                <li key={asset.assetId}>
                  <div className="studio-screen__asset-name">
                    <span aria-hidden="true">
                      {asset.mediaKind === 'video' ? 'V' : asset.mediaKind === 'image' ? 'I' : 'A'}
                    </span>
                    <strong title={index === 0 ? project.name : asset.assetId}>
                      {index === 0
                        ? project.name
                        : `${asset.mediaKind === 'video' ? 'Video' : asset.mediaKind === 'image' ? 'Image' : 'Audio'} ${index + 1}`}
                    </strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Type</dt>
                      <dd>{asset.mediaKind === 'video' ? 'Video' : asset.mediaKind === 'image' ? 'Image' : 'Audio'}</dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd>{asset.duration ? formatDuration(toMilliseconds(asset.duration)) : 'Still image'}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>Local</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="studio-screen__empty-copy">No project assets available.</p>
          )}
        </section>

        <div className="studio-screen__right-rail">
          <section
            id="studio-inspector-region"
            className={`studio-screen__inspector${compactSidePanel === 'inspector' ? ' studio-screen__side-region--compact-open' : ''}`}
            aria-label="Inspector"
            hidden={workspace !== 'studio'}
          >
            <div className="studio-screen__region-heading">
              <div>
                <span className="studio-screen__section-index">03</span>
                <h2>Inspector</h2>
              </div>
              <span>Read only</span>
            </div>
            {selectedInspectorChange ? (
              <dl className="studio-screen__inspector-facts">
                <div>
                  <dt>Type</dt>
                  <dd>{selectedInspectorChange.operationKind}</dd>
                </div>
                <div>
                  <dt>Timing</dt>
                  <dd>
                    {selectedInspectorChange.startTicks === null
                      ? 'Not timed'
                      : formatPointTargetTime(
                          Math.round(selectedInspectorChange.startTicks / (PROJECT_TIMESCALE / 1_000)),
                        )}
                  </dd>
                </div>
                <div>
                  <dt>Enabled</dt>
                  <dd>{selectedInspectorChange.status === 'blocked' ? 'Needs attention' : 'Yes'}</dd>
                </div>
                <div>
                  <dt>Summary</dt>
                  <dd>{selectedInspectorChange.label}</dd>
                </div>
              </dl>
            ) : pointTarget ? (
              <dl className="studio-screen__inspector-facts">
                <div><dt>Type</dt><dd>Point target</dd></div>
                <div><dt>Timing</dt><dd>{formatPointTargetTime(pointTarget.timeMs)}</dd></div>
                <div><dt>Enabled</dt><dd>Yes</dd></div>
                <div>
                  <dt>Summary</dt>
                  <dd>{`${Math.round(pointTarget.x * 100)}% across, ${Math.round(pointTarget.y * 100)}% down`}</dd>
                </div>
              </dl>
            ) : (
              <div className="studio-screen__inspector-empty">
                <strong>Nothing selected</strong>
                <p>Select a change in Assist or choose Point on the video to inspect its current context.</p>
              </div>
            )}
          </section>

        <aside
          className={`studio-screen__conversation${workspace === 'studio' && isAiPanelCollapsed ? ' studio-screen__conversation--collapsed' : ''}`}
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
              {workspace === 'studio' ? (
                <button
                  className="studio-screen__ai-toggle"
                  type="button"
                  aria-controls="studio-ai-panel-content"
                  aria-expanded={!isAiPanelCollapsed}
                  aria-label={isAiPanelCollapsed ? 'Expand AI panel' : 'Collapse AI panel'}
                  onClick={() => setIsAiPanelCollapsed((current) => !current)}
                >
                  {isAiPanelCollapsed ? 'Open' : 'Hide'}
                </button>
              ) : null}
            </div>
          </div>

          <div
            id="studio-ai-panel-content"
            className="studio-screen__ai-panel-content"
            hidden={workspace === 'studio' && isAiPanelCollapsed}
          >
          <ChatComposer
            conversation={conversation}
            canSend={!proposal}
            disabledReason={
              proposal ? 'Accept or reject the pending proposal before asking for another edit.' : null
            }
            onSend={(message) => onSendMessage(message, buildIntentContext())}
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
              <p className="studio-screen__export-progress" role="status" aria-label="Export status">Rendering and verifying your MP4…</p>
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
        </div>
      </div>

      {workspace === 'assist' ? (
        <AssistChangeStrip
          items={assistChanges}
          selectedId={selectedAssistChangeId}
          onSelect={setSelectedAssistChangeId}
          onSeek={seekAssistChange}
          onOpenStudio={() => onWorkspaceChange?.('studio')}
        />
      ) : <section
        className="studio-screen__time-strip"
        aria-label="Timeline workspace"
      >
        <div className="studio-screen__time-strip-heading">
          <div>
            <span className="studio-screen__section-index">05</span>
            <h2>Timeline</h2>
          </div>
          <p>
            Direct controls over the current project
          </p>
        </div>
        <div className="studio-screen__track" data-testid="timeline-track">
          {timelineSections.map((block) => (
            <div
              key={block.clipId}
              className={
                block.enabled
                  ? 'studio-screen__track-block'
                  : 'studio-screen__track-block studio-screen__track-block--hidden'
              }
              style={{ left: `${block.leftPercent}%`, width: `${block.widthPercent}%` }}
              data-testid="timeline-section"
              data-clip-id={block.clipId}
            >
              <span>{block.enabled ? 'Section' : 'Hidden'}</span>
            </div>
          ))}
          <div
            className="studio-screen__track-playhead"
            data-testid="timeline-playhead"
            style={{ left: `${playheadPercent}%` }}
            aria-hidden="true"
          />
        </div>

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
          <summary>Adjust this section</summary>
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
        {timelineNotice ? (
          <p className="studio-screen__track-notice" role="status">
            {timelineNotice}
          </p>
        ) : null}

        <div className="studio-screen__captions">
          <h3>Captions</h3>
          <p>
            Choose the transcript file for this video. Nothing is sent anywhere — the
            words are read on this machine and turned into readable lines for you.
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
                // The picker is cleared straight away so choosing the same file
                // twice still fires, which is what a user expects after a
                // failure they have just fixed.
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
      </section>}
    </main>
  )
}
