import type {
  AddNameplateOperation,
  CaptionCue,
  CaptionSet,
  Clip,
  EditOperation,
  MediaAsset,
  ResolvedOverlayOperation,
  SetClipTransitionOperation,
  VisualProperties,
} from '@sanverse/edit-domain'

import type {
  TimelineItemKind,
  TimelineItemState,
  TimelineLaneKind,
} from '../../features/timeline'

export type InspectorEmptyReason =
  | 'NOTHING_SELECTED'
  | 'SELECTION_UNKNOWN'
  | 'SELECTION_STALE'
  | 'TARGET_UNRESOLVED'

export type InspectorSelectionBase = Readonly<{
  timelineItemId: string
  timelineItemKind: TimelineItemKind
  laneKind: TimelineLaneKind
  state: TimelineItemState | 'read-only'
  label: string
  startTicks: number
  durationTicks: number
  projectRevision: number
}>

export type InspectorNothingSelection = Readonly<{
  kind: 'nothing'
  state: 'read-only'
  projectRevision: number
  reason: InspectorEmptyReason
}>

export type InspectorGapSelection = InspectorSelectionBase & Readonly<{
  kind: 'gap'
  state: 'read-only'
}>

export type InspectorBlockedSelection = InspectorSelectionBase & Readonly<{
  kind: 'blocked'
  state: 'blocked'
  originalKind: TimelineItemKind
  reason: string
  operationId: string | null
  changeSetId: string | null
}>

export type InspectorProposalSelection = InspectorSelectionBase & Readonly<{
  kind: 'proposal'
  state: 'proposed'
  proposalId: string
  proposalBaseRevision: number
  operation: EditOperation | null
}>

export type InspectorClipSelectionBase = InspectorSelectionBase & Readonly<{
  clip: Clip
  asset: MediaAsset
  assetLabel: string
  nextClipId: string | null
  transition: SetClipTransitionOperation | null
}>

export type InspectorVideoClipSelection = InspectorClipSelectionBase & Readonly<{
  kind: 'video'
  state: 'committed'
}>

export type InspectorDialogueSelection = InspectorClipSelectionBase & Readonly<{
  kind: 'dialogue'
  state: 'committed'
}>

export type InspectorVisualFields = Readonly<{
  visualId: string
  visualProperties: VisualProperties
}>

export type InspectorCaptionSelection = InspectorSelectionBase & InspectorVisualFields & Readonly<{
  kind: 'caption'
  state: 'committed'
  captionSet: CaptionSet
  cue: CaptionCue
  asset: MediaAsset
  assetLabel: string
}>

export type InspectorNameplateSelection = InspectorSelectionBase & InspectorVisualFields & Readonly<{
  kind: 'nameplate'
  state: 'committed'
  operation: AddNameplateOperation
  asset: MediaAsset
  assetLabel: string
  textEditable: false
}>

export type InspectorTitleSelection = InspectorSelectionBase & InspectorVisualFields & Readonly<{
  kind: 'title'
  state: 'committed'
  operation: Extract<ResolvedOverlayOperation, { kind: 'add-title' }>
  asset: MediaAsset
  assetLabel: string
}>

export type InspectorCalloutSelection = InspectorSelectionBase & InspectorVisualFields & Readonly<{
  kind: 'callout'
  state: 'committed'
  operation: Extract<ResolvedOverlayOperation, { kind: 'add-callout' }>
  asset: MediaAsset
  assetLabel: string
}>

export type InspectorMediaOverlaySelection = InspectorSelectionBase & InspectorVisualFields & Readonly<{
  kind: 'media-overlay'
  state: 'committed'
  operation: Extract<ResolvedOverlayOperation, { kind: 'add-media-overlay' }>
  asset: MediaAsset
  assetLabel: string
}>

export type InspectorMusicSelection = InspectorSelectionBase & Readonly<{
  kind: 'music'
  state: 'committed'
  operation: Extract<ResolvedOverlayOperation, { kind: 'add-music' }>
  asset: MediaAsset
  assetLabel: string
}>

export type InspectorSelection =
  | InspectorNothingSelection
  | InspectorGapSelection
  | InspectorBlockedSelection
  | InspectorProposalSelection
  | InspectorVideoClipSelection
  | InspectorDialogueSelection
  | InspectorCaptionSelection
  | InspectorNameplateSelection
  | InspectorTitleSelection
  | InspectorCalloutSelection
  | InspectorMediaOverlaySelection
  | InspectorMusicSelection
