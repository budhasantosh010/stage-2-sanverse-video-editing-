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

  /** Explicit canonical identities used by Inspector; never parsed from labels. */
  captionSetId: string | null
  cueId: string | null
  visualId: string | null

  /** Original-media time when this item refers to source footage. */
  sourceStartTicks: number | null
  sourceDurationTicks: number | null

  gainDb: number | null
  fadeInTicks: number | null
  fadeOutTicks: number | null
  /**
   * Where this piece's sound sits between the speakers, in hundredths of a
   * percent: -10000 hard left, 0 centred, +10000 hard right. Null for anything
   * that has no sound of its own.
   */
  pan: number | null
  /**
   * WHAT THE SMALL BADGE ON THE CLIP SAYS, ready to draw.
   *
   * Worked out here rather than in the component, for the same reason every
   * other label is: the timeline picture is a pure function of the project, so
   * a test can read what the user will see without rendering anything.
   *
   * Null means the piece is at normal speed, forwards, with its pitch kept —
   * which is every piece nobody has touched — and nothing is drawn over it.
   * Badges cost screen space that belongs to the filmstrip.
   */
  speedBadge: string | null

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

  /**
   * Everything picked, sorted, with anything no longer here already dropped.
   *
   * This is the truth. `selectedItemId` below is worked out from it.
   */
  selectedItemIds: readonly string[]
  /**
   * The ONE item, when exactly one thing is picked. Null otherwise — including
   * when four things are picked.
   *
   * The panels that can only deal with one thing at a time read this. Reading
   * the first of four instead would show somebody the settings of a clip they
   * did not choose and let them change it, which is worse than showing nothing.
   */
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
  /** Everything picked. One item is a list of one; nothing picked is empty. */
  selectedItemIds: readonly string[]
  pending: PendingTimelineInput | null
  /** Derived display names only. They are never persisted into EditProject. */
  assetLabels?: Readonly<Record<string, string>>
}>
