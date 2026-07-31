import { DEFAULT_VISUAL_PROPERTIES } from '@sanverse/edit-domain'
import type { InspectorSelection } from '../inspector'
import type { CanvasSelectionResult, CanvasVisualSelection } from './canvas-contract'

const unsupported = (reason = 'This item does not have canvas controls yet.'): CanvasSelectionResult =>
  Object.freeze({ kind: 'unsupported', reason })

const committed = (
  selection: Extract<InspectorSelection, { kind: 'caption' | 'nameplate' | 'title' | 'callout' | 'media-overlay' }>,
  nodeId: string,
  kind: CanvasVisualSelection['kind'],
): CanvasSelectionResult => Object.freeze({
  kind: 'supported',
  selection: Object.freeze({
    timelineItemId: selection.timelineItemId,
    visualId: selection.visualId,
    nodeId,
    label: selection.label,
    kind,
    state: 'committed',
    projectRevision: selection.projectRevision,
    startTicks: selection.startTicks,
    durationTicks: selection.durationTicks,
    visualProperties: selection.visualProperties,
    supportsCrop: selection.kind === 'media-overlay',
    supportsRotation: true,
    supportsResize: true,
    blockedReason: null,
    proposalPoint: null,
  }),
})

export const resolveCanvasSelection = (
  selection: InspectorSelection,
  visibleNodeIds?: ReadonlySet<string>,
): CanvasSelectionResult => {
  if (selection.kind === 'nothing') return Object.freeze({ kind: 'none' })
  if (selection.kind === 'gap' || selection.kind === 'video' || selection.kind === 'dialogue' || selection.kind === 'music') {
    return unsupported()
  }
  if (selection.kind === 'blocked') return unsupported(selection.reason)
  if (selection.kind === 'proposal') {
    const operation = selection.operation
    if (!operation || operation.kind !== 'add-nameplate' || selection.proposalBaseRevision !== selection.projectRevision) {
      return unsupported(operation ? 'That proposal changed before it could be moved.' : 'This proposal has no canvas geometry.')
    }
    const nodeId = operation.operationId
    if (visibleNodeIds && !visibleNodeIds.has(nodeId)) {
      return unsupported('Move the playhead into this proposal to use canvas controls.')
    }
    return Object.freeze({
      kind: 'supported',
      selection: Object.freeze({
        timelineItemId: selection.timelineItemId,
        visualId: operation.operationId,
        nodeId,
        label: selection.label,
        kind: 'proposal',
        state: 'proposed',
        projectRevision: selection.projectRevision,
        startTicks: selection.startTicks,
        durationTicks: selection.durationTicks,
        visualProperties: DEFAULT_VISUAL_PROPERTIES,
        supportsCrop: false,
        supportsRotation: false,
        supportsResize: false,
        blockedReason: null,
        proposalPoint: operation.target.point,
      }),
    })
  }

  const nodeId = selection.kind === 'caption'
    ? `${selection.captionSet.captionSetId}.${selection.cue.cueId}`
    : selection.kind === 'nameplate'
      ? selection.operation.operationId
      : selection.kind === 'title'
        ? selection.operation.titleId
        : selection.kind === 'callout'
          ? selection.operation.calloutId
          : selection.operation.overlayId
  if (visibleNodeIds && !visibleNodeIds.has(nodeId)) {
    return unsupported('Move the playhead into this item to use canvas controls.')
  }
  return committed(selection, nodeId, selection.kind === 'caption' ? 'caption-set' : selection.kind)
}
