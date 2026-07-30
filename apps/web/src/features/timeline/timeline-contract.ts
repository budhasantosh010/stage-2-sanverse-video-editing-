import type { EditOperation, EditProject } from '@sanverse/edit-domain'

/**
 * Presentation rows, deliberately named lanes rather than tracks.
 *
 * `Track` already means a canonical composition object in the edit domain.
 * Captions, dialogue mirrors, and music are semantic rows assembled for the
 * editor, not new domain tracks, so calling them tracks would create two
 * meanings for one word and eventually two sources of truth.
 */
export type TimelineLaneKind =
  | 'overlay'
  | 'video'
  | 'caption'
  | 'dialogue'
  | 'music'

export type TimelineItemKind =
  | 'clip'
  | 'gap'
  | 'caption'
  | 'nameplate'
  | 'title'
  | 'callout'
  | 'media-overlay'
  | 'music'

export type TimelineItemState = 'committed' | 'proposed' | 'blocked'

export type TimelineItemView = Readonly<{
  id: string
  laneId: string
  kind: TimelineItemKind
  state: TimelineItemState

  label: string
  detail: string | null

  /** Finished-video time. Never source time and never floating seconds. */
  startTicks: number
  durationTicks: number

  enabled: boolean
  selected: boolean
  blockedReason: string | null

  clipId: string | null
  linkedClipId: string | null
  assetId: string | null
  operationId: string | null
  changeSetId: string | null

  /** Original-media time when this item refers to source footage. */
  sourceStartTicks: number | null
  sourceDurationTicks: number | null

  gainDb: number | null
  fadeInTicks: number | null
  fadeOutTicks: number | null

  /** Present only for detached proposal ghosts. */
  proposalId: string | null
  proposalBaseRevision: number | null
}>

export type TimelineLaneView = Readonly<{
  id: string
  kind: TimelineLaneKind
  label: string
  order: number
  items: readonly TimelineItemView[]
}>

export type TimelineDiagnosticCode =
  | 'PLACEMENT_UNAVAILABLE'
  | 'OPERATION_BLOCKED'
  | 'OPERATION_UNSUPPORTED'
  | 'ITEM_OUTSIDE_COMPOSITION'
  | 'ITEM_DURATION_INVALID'
  | 'DUPLICATE_PRESENTATION_ID'
  | 'PROPOSAL_STALE'
  | 'PROPOSAL_INVALID'

export type TimelineDiagnostic = Readonly<{
  code: TimelineDiagnosticCode
  message: string
  operationId: string | null
  changeSetId: string | null
}>

export type TimelineViewModel = Readonly<{
  compositionId: string
  projectId: string
  projectRevision: number
  timescale: number
  durationTicks: number

  lanes: readonly TimelineLaneView[]
  diagnostics: readonly TimelineDiagnostic[]

  /** Null when the requested selection does not exist in this projection. */
  selectedItemId: string | null
}>

/**
 * A detached proposal. It is never inserted into `EditProject`, never changes
 * accepted duration, and never becomes history merely because it is visible.
 */
export type PendingTimelineInput = Readonly<{
  proposalId: string
  baseRevision: number
  operations: readonly EditOperation[]
}>

export type BuildTimelineViewModelInput = Readonly<{
  project: EditProject
  selectedItemId: string | null
  pending: PendingTimelineInput | null
}>
