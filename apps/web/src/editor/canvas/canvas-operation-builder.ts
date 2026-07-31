import type { VisualProperties, VisualProperty } from '@sanverse/edit-domain'
import { buildVisualPropertiesOperation, type InspectorOperationBuildResult } from '../inspector/inspector-operations'
import type { CanvasInteractionMode, CanvasVisualSelection } from './canvas-contract'
import { propertyTrackExists } from './canvas-contract'

const propertiesForMode = (mode: CanvasInteractionMode): readonly VisualProperty[] => {
  if (mode === 'move') return ['translate-x', 'translate-y']
  if (mode === 'resize') return ['scale']
  if (mode === 'rotate') return ['rotation']
  return ['crop-top', 'crop-right', 'crop-bottom', 'crop-left']
}

export const canvasAnimatedPropertyConflict = (
  selection: CanvasVisualSelection,
  mode: CanvasInteractionMode,
): string | null => propertiesForMode(mode).some((property) => propertyTrackExists(selection.visualProperties, property))
  ? 'This property is animated. Edit its keyframe in the Inspector.'
  : null

export const buildCanvasVisualOperation = (
  selection: CanvasVisualSelection,
  properties: VisualProperties,
  operationId: string,
): InspectorOperationBuildResult => {
  if (selection.state !== 'committed') {
    return Object.freeze({ ok: false, message: 'Pending proposal movement is not an accepted project edit.' })
  }
  return buildVisualPropertiesOperation({
    visualId: selection.visualId,
    visualProperties: selection.visualProperties,
    projectRevision: selection.projectRevision,
  }, properties, operationId)
}
