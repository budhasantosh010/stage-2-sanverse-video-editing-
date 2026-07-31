import type { VisualProperties, VisualProperty } from '@sanverse/edit-domain'

export type CanvasPoint = Readonly<{ x: number; y: number }>
export type CanvasRect = Readonly<{ x: number; y: number; width: number; height: number }>

export type CanvasVisualKind = 'nameplate' | 'caption-set' | 'title' | 'callout' | 'media-overlay' | 'proposal'

export type CanvasVisualSelection = Readonly<{
  timelineItemId: string
  visualId: string
  nodeId: string
  label: string
  kind: CanvasVisualKind
  state: 'committed' | 'proposed'
  projectRevision: number
  startTicks: number
  durationTicks: number
  visualProperties: VisualProperties
  supportsCrop: boolean
  supportsRotation: boolean
  supportsResize: boolean
  blockedReason: string | null
  proposalPoint: CanvasPoint | null
}>

export type CanvasHitTarget = Readonly<{
  timelineItemId: string
  nodeId: string
  label: string
  layer: number
  state: 'committed' | 'proposed'
}>

export type CanvasSelectionResult =
  | Readonly<{ kind: 'supported'; selection: CanvasVisualSelection }>
  | Readonly<{ kind: 'unsupported'; reason: string }>
  | Readonly<{ kind: 'none' }>

export type CanvasGuide = Readonly<{
  axis: 'x' | 'y'
  positionPx: number
  label: 'Frame edge' | 'Frame center' | 'Safe area'
}>

export type CanvasInteractionMode = 'move' | 'resize' | 'rotate' | 'crop'
export type CanvasResizeCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'
export type CanvasCropEdge = 'top' | 'right' | 'bottom' | 'left'

export type CanvasInteractionSession = Readonly<{
  mode: CanvasInteractionMode
  pointerId: number | null
  startClient: CanvasPoint
  startRect: CanvasRect
  startProperties: VisualProperties
  currentProperties: VisualProperties
  resizeCorner: CanvasResizeCorner | null
  cropEdge: CanvasCropEdge | null
  guides: readonly CanvasGuide[]
}>

export type SharedVisualDraft = Readonly<{
  selectionKey: string
  projectRevision: number
  authoritative: VisualProperties
  value: VisualProperties
  dirty: boolean
  interaction: CanvasInteractionMode | null
  notice: string | null
}>

export type SharedVisualDraftController = Readonly<{
  draft: SharedVisualDraft | null
  update(value: VisualProperties): void
  reset(): void
  beginInteraction(mode: CanvasInteractionMode): boolean
  endInteraction(): void
  reportNotice(message: string | null): void
  markApplied(): void
}>

export const propertyTrackExists = (
  properties: VisualProperties,
  property: VisualProperty,
): boolean => properties.tracks.some((track) => track.property === property)
