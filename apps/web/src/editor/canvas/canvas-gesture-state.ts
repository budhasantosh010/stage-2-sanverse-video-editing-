import type { VisualProperties } from '@sanverse/edit-domain'
import type {
  CanvasCropEdge,
  CanvasInteractionMode,
  CanvasInteractionSession,
  CanvasPoint,
  CanvasRect,
  CanvasResizeCorner,
} from './canvas-contract'

export const beginCanvasInteraction = (input: Readonly<{
  mode: CanvasInteractionMode
  pointerId: number | null
  startClient: CanvasPoint
  startRect: CanvasRect
  properties: VisualProperties
  resizeCorner?: CanvasResizeCorner | null
  cropEdge?: CanvasCropEdge | null
}>): CanvasInteractionSession | null => {
  const values = [input.startClient.x, input.startClient.y, input.startRect.x, input.startRect.y, input.startRect.width, input.startRect.height]
  if (!values.every(Number.isFinite) || input.startRect.width <= 0 || input.startRect.height <= 0) return null
  return Object.freeze({
    mode: input.mode,
    pointerId: input.pointerId,
    startClient: input.startClient,
    startRect: input.startRect,
    startProperties: input.properties,
    currentProperties: input.properties,
    resizeCorner: input.resizeCorner ?? null,
    cropEdge: input.cropEdge ?? null,
    guides: Object.freeze([]),
  })
}

export const updateCanvasInteraction = (
  session: CanvasInteractionSession,
  properties: VisualProperties,
  guides = session.guides,
): CanvasInteractionSession => Object.freeze({
  ...session,
  currentProperties: properties,
  guides: Object.freeze([...guides]),
})
