import type { VisualCrop, VisualProperties, VisualTransform } from '@sanverse/edit-domain'
import type {
  CanvasCropEdge,
  CanvasPoint,
  CanvasRect,
  CanvasResizeCorner,
} from './canvas-contract'

const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0
const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))

export const computeVideoContentRect = (
  elementRect: CanvasRect,
  intrinsicWidth: number,
  intrinsicHeight: number,
): CanvasRect | null => {
  if (
    !finitePositive(elementRect.width) ||
    !finitePositive(elementRect.height) ||
    !finitePositive(intrinsicWidth) ||
    !finitePositive(intrinsicHeight)
  ) return null

  const elementAspect = elementRect.width / elementRect.height
  const contentAspect = intrinsicWidth / intrinsicHeight
  if (elementAspect > contentAspect) {
    const height = elementRect.height
    const width = height * contentAspect
    return Object.freeze({
      x: elementRect.x + (elementRect.width - width) / 2,
      y: elementRect.y,
      width,
      height,
    })
  }
  const width = elementRect.width
  const height = width / contentAspect
  return Object.freeze({
    x: elementRect.x,
    y: elementRect.y + (elementRect.height - height) / 2,
    width,
    height,
  })
}

export const clientPointToNormalized = (
  point: CanvasPoint,
  contentRect: CanvasRect,
): CanvasPoint | null => {
  if (!finitePositive(contentRect.width) || !finitePositive(contentRect.height)) return null
  const x = (point.x - contentRect.x) / contentRect.width
  const y = (point.y - contentRect.y) / contentRect.height
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null
  return Object.freeze({ x, y })
}

export const normalizedPointToClient = (
  point: CanvasPoint,
  contentRect: CanvasRect,
): CanvasPoint | null => {
  if (!finitePositive(contentRect.width) || !finitePositive(contentRect.height)) return null
  if (![point.x, point.y].every(Number.isFinite)) return null
  return Object.freeze({
    x: contentRect.x + point.x * contentRect.width,
    y: contentRect.y + point.y * contentRect.height,
  })
}

export const clientRectToNormalized = (
  rect: CanvasRect,
  contentRect: CanvasRect,
): CanvasRect | null => {
  if (!finitePositive(contentRect.width) || !finitePositive(contentRect.height)) return null
  const values = [rect.x, rect.y, rect.width, rect.height]
  if (!values.every(Number.isFinite) || rect.width < 0 || rect.height < 0) return null
  return Object.freeze({
    x: (rect.x - contentRect.x) / contentRect.width,
    y: (rect.y - contentRect.y) / contentRect.height,
    width: rect.width / contentRect.width,
    height: rect.height / contentRect.height,
  })
}

export const moveTransformByClientDelta = (
  transform: VisualTransform,
  delta: CanvasPoint,
  contentRect: CanvasRect,
  constrainAxis = false,
): VisualTransform | null => {
  if (!finitePositive(contentRect.width) || !finitePositive(contentRect.height)) return null
  if (![delta.x, delta.y].every(Number.isFinite)) return null
  let dx = delta.x
  let dy = delta.y
  if (constrainAxis) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0
    else dx = 0
  }
  return Object.freeze({
    ...transform,
    translateX: clamp(transform.translateX + dx / contentRect.width, -2, 2),
    translateY: clamp(transform.translateY + dy / contentRect.height, -2, 2),
  })
}

const cornerPoint = (rect: CanvasRect, corner: CanvasResizeCorner): CanvasPoint => {
  if (corner === 'top-left') return Object.freeze({ x: rect.x, y: rect.y })
  if (corner === 'top-right') return Object.freeze({ x: rect.x + rect.width, y: rect.y })
  if (corner === 'bottom-right') return Object.freeze({ x: rect.x + rect.width, y: rect.y + rect.height })
  return Object.freeze({ x: rect.x, y: rect.y + rect.height })
}

const oppositeCorner = (rect: CanvasRect, corner: CanvasResizeCorner): CanvasPoint => {
  if (corner === 'top-left') return cornerPoint(rect, 'bottom-right')
  if (corner === 'top-right') return cornerPoint(rect, 'bottom-left')
  if (corner === 'bottom-right') return cornerPoint(rect, 'top-left')
  return cornerPoint(rect, 'top-right')
}

export const resizeUniformFromCorner = (input: Readonly<{
  properties: VisualProperties
  startRect: CanvasRect
  corner: CanvasResizeCorner
  currentClient: CanvasPoint
  contentRect: CanvasRect
  fromCenter: boolean
}>): VisualProperties | null => {
  const { properties, startRect, corner, currentClient, contentRect, fromCenter } = input
  if (
    !finitePositive(startRect.width) ||
    !finitePositive(startRect.height) ||
    !finitePositive(contentRect.width) ||
    !finitePositive(contentRect.height) ||
    ![currentClient.x, currentClient.y].every(Number.isFinite)
  ) return null

  const center = Object.freeze({ x: startRect.x + startRect.width / 2, y: startRect.y + startRect.height / 2 })
  const fixed = fromCenter ? center : oppositeCorner(startRect, corner)
  const startCorner = cornerPoint(startRect, corner)
  const startDistance = Math.hypot(startCorner.x - fixed.x, startCorner.y - fixed.y)
  const currentDistance = Math.hypot(currentClient.x - fixed.x, currentClient.y - fixed.y)
  if (!finitePositive(startDistance) || !Number.isFinite(currentDistance)) return null
  const ratio = currentDistance / startDistance
  const scale = clamp(properties.transform.scale * ratio, 0.01, 20)
  const appliedRatio = scale / properties.transform.scale

  let translateX = properties.transform.translateX
  let translateY = properties.transform.translateY
  if (!fromCenter) {
    const newCenter = Object.freeze({
      x: fixed.x + (center.x - fixed.x) * appliedRatio,
      y: fixed.y + (center.y - fixed.y) * appliedRatio,
    })
    translateX = clamp(translateX + (newCenter.x - center.x) / contentRect.width, -2, 2)
    translateY = clamp(translateY + (newCenter.y - center.y) / contentRect.height, -2, 2)
  }

  return Object.freeze({
    ...properties,
    transform: Object.freeze({ ...properties.transform, scale, translateX, translateY }),
  })
}

const degrees = (radians: number): number => radians * 180 / Math.PI
const angleAt = (center: CanvasPoint, point: CanvasPoint): number => degrees(Math.atan2(point.y - center.y, point.x - center.x))

export const rotateFromClientPoint = (input: Readonly<{
  startRotationDegrees: number
  center: CanvasPoint
  startClient: CanvasPoint
  currentClient: CanvasPoint
  snap15: boolean
}>): number | null => {
  const values = [
    input.startRotationDegrees,
    input.center.x,
    input.center.y,
    input.startClient.x,
    input.startClient.y,
    input.currentClient.x,
    input.currentClient.y,
  ]
  if (!values.every(Number.isFinite)) return null
  let next = input.startRotationDegrees + angleAt(input.center, input.currentClient) - angleAt(input.center, input.startClient)
  if (input.snap15) next = Math.round(next / 15) * 15
  else {
    const cardinal = [0, 90, 180, 270, 360, -90, -180, -270, -360]
      .find((target) => Math.abs(next - target) <= 3)
    next = cardinal ?? Math.round(next)
  }
  return clamp(next, -3_600, 3_600)
}

export const cropFromClientDelta = (input: Readonly<{
  crop: VisualCrop
  edge: CanvasCropEdge
  deltaPx: number
  visualSizePx: number
}>): VisualCrop | null => {
  if (!Number.isFinite(input.deltaPx) || !finitePositive(input.visualSizePx)) return null
  const amount = input.deltaPx / input.visualSizePx
  const next = { ...input.crop }
  if (input.edge === 'left') next.left = clamp(next.left + amount, 0, 0.99)
  if (input.edge === 'right') next.right = clamp(next.right - amount, 0, 0.99)
  if (input.edge === 'top') next.top = clamp(next.top + amount, 0, 0.99)
  if (input.edge === 'bottom') next.bottom = clamp(next.bottom - amount, 0, 0.99)
  if (next.left + next.right >= 1 || next.top + next.bottom >= 1) return null
  return Object.freeze(next)
}

export const rectCenter = (rect: CanvasRect): CanvasPoint => Object.freeze({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
})
