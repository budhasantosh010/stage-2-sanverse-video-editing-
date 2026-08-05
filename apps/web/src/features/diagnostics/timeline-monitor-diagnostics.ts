/**
 * One snapshot of everything the preview used to decide what to put on screen.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * The owner recorded a screen where the monitor said "No media at this time"
 * over footage that was plainly there. Working out why took reading the code
 * backwards from the message to the compiler, because nothing on screen said
 * which of the twenty-odd values feeding that decision was the wrong one.
 *
 * This is that list of values, gathered in one place, so the next time something
 * looks wrong the answer is visible instead of deduced. It is the difference
 * between "the preview is broken" and "the preview thinks the file is missing,
 * and here is the file it is asking for".
 *
 * ── WHAT IT IS NOT ALLOWED TO DO ─────────────────────────────────────────────
 *
 * 1. It never reaches a real user. It is built only when the app is running in
 *    development, and hidden even then until it is asked for.
 * 2. It changes nothing. It reads; it never writes, never seeks, never loads,
 *    and never makes a revision. A diagnostic that moves the thing it is
 *    measuring is worse than none.
 * 3. It shows no file paths and no real addresses. `sourceIdentity` reduces a
 *    URL to the last part of its path, so it can be compared — "is the element
 *    pointed at the file we asked for?" — without printing where anybody's
 *    files live. A screenshot of a diagnostic panel gets pasted into chats.
 * 4. It never serializes the project. Doing that every frame would make the
 *    editor slow in exactly the situation somebody is trying to measure.
 */

import type { PrimarySourceDecisionV1 } from '../render-plan/primary-source'
import type { SaveStateV1 } from '../save/save-state'

export type MonitorBaseLayerKind =
  | 'native-video'
  | 'motion-canvas'
  | 'gap'
  | 'loading'
  | 'error'

export type TimelineMonitorDiagnosticsV1 = Readonly<{
  projectId: string
  /** The revision the screen is showing. Not the one being saved. */
  acceptedRevision: number

  compositionTicks: number
  playheadTicks: number

  timelineItemId: string | null

  /** The whole decision, verbatim, including which of the four gaps it is. */
  primaryDecision: PrimarySourceDecisionV1

  activeClipId: string | null
  activeAssetId: string | null
  sourceTicks: number | null
  localTicks: number | null

  v1OutputEnabled: boolean
  clipEnabled: boolean | null
  assetAvailable: boolean | null

  /** The last part of the path only — never the address itself. */
  currentVideoSrcIdentity: string | null
  requestedVideoSrcIdentity: string | null
  videoReadyState: number
  videoNetworkState: number

  monitorBaseLayer: MonitorBaseLayerKind
  gapReason: PrimarySourceDecisionV1 extends { kind: 'gap' } ? never : string | null

  /** Goes up by one every time the element is pointed at a different file. */
  sourceSwitchGeneration: number

  selectedItemIds: readonly string[]

  proposalBaseRevision: number | null
  proposalStatus: string | null

  saveStatus: SaveStateV1['status']
  lastPersistedRevision: number
}>

/**
 * Reduce an address to something safe to look at.
 *
 * `/api/projects/project_1ad7.../assets/asset_bbbb` becomes `asset_bbbb`. That
 * is enough to answer the only question worth asking — is the element pointed at
 * the file we asked for? — and it names no folder on anybody's computer.
 * Diagnostic panels get screenshotted and pasted into chats.
 */
export const sourceIdentity = (url: string | null | undefined): string | null => {
  if (!url) return null
  const withoutQuery = url.split('?')[0] ?? ''
  const lastPart = withoutQuery.split('/').filter(Boolean).at(-1) ?? null
  return lastPart && lastPart.length <= 128 ? lastPart : null
}

/** Whether diagnostics may be built at all. Production is always no. */
export const diagnosticsAreAvailable = (mode: string | undefined): boolean =>
  mode === 'development' || mode === 'test'

export type BuildDiagnosticsInput = Readonly<{
  projectId: string
  acceptedRevision: number
  compositionTicks: number
  playheadTicks: number
  timelineItemId: string | null
  primaryDecision: PrimarySourceDecisionV1
  v1OutputEnabled: boolean
  currentVideoSrc: string | null
  requestedVideoSrc: string | null
  videoReadyState: number
  videoNetworkState: number
  monitorBaseLayer: MonitorBaseLayerKind
  sourceSwitchGeneration: number
  selectedItemIds: readonly string[]
  proposalBaseRevision: number | null
  proposalStatus: string | null
  saveState: SaveStateV1
}>

export const buildTimelineMonitorDiagnostics = (
  input: BuildDiagnosticsInput,
): TimelineMonitorDiagnosticsV1 => {
  const decision = input.primaryDecision
  const active = decision.kind === 'active' ? decision : null

  return Object.freeze({
    projectId: input.projectId,
    acceptedRevision: input.acceptedRevision,
    compositionTicks: input.compositionTicks,
    playheadTicks: input.playheadTicks,
    timelineItemId: input.timelineItemId,
    primaryDecision: decision,
    activeClipId: active?.clipId ?? null,
    activeAssetId: active?.assetId ?? null,
    sourceTicks: active?.sourceTicks ?? null,
    localTicks: active?.localTicks ?? null,
    v1OutputEnabled: input.v1OutputEnabled,
    // Each of these three is null when the gap happened for a DIFFERENT reason —
    // saying "false" would claim we checked and it was off, when the check never
    // ran. "We did not get that far" and "we got there and it was off" are
    // different facts, and confusing them is what made the original bug hard.
    clipEnabled: decision.kind === 'active' ? true
      : decision.reason === 'CLIP_DISABLED' ? false
      : null,
    assetAvailable: decision.kind === 'active' ? true
      : decision.reason === 'ASSET_MISSING' ? false
      : null,
    currentVideoSrcIdentity: sourceIdentity(input.currentVideoSrc),
    requestedVideoSrcIdentity: sourceIdentity(input.requestedVideoSrc),
    videoReadyState: input.videoReadyState,
    videoNetworkState: input.videoNetworkState,
    monitorBaseLayer: input.monitorBaseLayer,
    gapReason: (decision.kind === 'gap' ? decision.reason : null) as never,
    sourceSwitchGeneration: input.sourceSwitchGeneration,
    selectedItemIds: Object.freeze([...input.selectedItemIds]),
    proposalBaseRevision: input.proposalBaseRevision,
    proposalStatus: input.proposalStatus,
    saveStatus: input.saveState.status,
    lastPersistedRevision: input.saveState.persistedRevision,
  })
}

/**
 * The snapshot as text, ready to paste into a bug report.
 *
 * Two spaces of indentation and stable key order, so two snapshots taken a
 * moment apart can be compared line by line and the one value that changed
 * stands out.
 */
export const diagnosticsAsText = (diagnostics: TimelineMonitorDiagnosticsV1): string =>
  JSON.stringify(diagnostics, null, 2)

/**
 * The one-line version, for when something is obviously wrong and the question
 * is only "wrong how?".
 */
export const diagnosticsSummary = (diagnostics: TimelineMonitorDiagnosticsV1): string => {
  const decision = diagnostics.primaryDecision
  const where = `${(diagnostics.playheadTicks / 1_440_000).toFixed(2)}s`
  return decision.kind === 'active'
    ? `${where}: ${decision.clipId} from ${decision.assetId} at ${(decision.sourceTicks / 1_440_000).toFixed(2)}s`
    : `${where}: nothing, because ${decision.reason}`
}
