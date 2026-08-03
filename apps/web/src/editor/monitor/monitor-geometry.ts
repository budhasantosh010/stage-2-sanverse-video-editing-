import type { MonitorFitMode } from './monitor-contract'

export type MonitorRect = Readonly<{ left: number; top: number; width: number; height: number }>

export type MonitorGeometry = Readonly<{
  stageRect: MonitorRect
  displayedContentRect: MonitorRect
  visibleSourceRect: Readonly<{ x: number; y: number; width: number; height: number }>
  letterbox: Readonly<{ top: number; right: number; bottom: number; left: number }>
  previewCropMapping: Readonly<{ x: number; y: number; width: number; height: number }>
  effectiveScale: number
  panOffset: Readonly<{ x: number; y: number }>
}>

const valid = (value: number): boolean => Number.isFinite(value) && value > 0

export function resolveMonitorContentRect(input: Readonly<{
  stageRect: MonitorRect
  sourceWidth: number
  sourceHeight: number
  fitMode: MonitorFitMode
}>): MonitorGeometry | null {
  const { stageRect, sourceWidth, sourceHeight, fitMode } = input
  if (![stageRect.left, stageRect.top].every(Number.isFinite) || !valid(stageRect.width) || !valid(stageRect.height) || !valid(sourceWidth) || !valid(sourceHeight)) return null

  const containScale = Math.min(stageRect.width / sourceWidth, stageRect.height / sourceHeight)
  const coverScale = Math.max(stageRect.width / sourceWidth, stageRect.height / sourceHeight)
  const scale = fitMode === 'actual' ? 1 : fitMode === 'fill' ? coverScale : containScale
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  const left = stageRect.left + (stageRect.width - width) / 2
  const top = stageRect.top + (stageRect.height - height) / 2
  const visibleLeft = Math.max(stageRect.left, left)
  const visibleTop = Math.max(stageRect.top, top)
  const visibleRight = Math.min(stageRect.left + stageRect.width, left + width)
  const visibleBottom = Math.min(stageRect.top + stageRect.height, top + height)
  const sourceX = Math.max(0, (visibleLeft - left) / scale)
  const sourceY = Math.max(0, (visibleTop - top) / scale)
  const visibleSourceWidth = Math.max(0, visibleRight - visibleLeft) / scale
  const visibleSourceHeight = Math.max(0, visibleBottom - visibleTop) / scale
  const visibleSourceRect = Object.freeze({ x: sourceX, y: sourceY, width: visibleSourceWidth, height: visibleSourceHeight })

  return Object.freeze({
    stageRect: Object.freeze({ ...stageRect }),
    displayedContentRect: Object.freeze({ left, top, width, height }),
    visibleSourceRect,
    letterbox: Object.freeze({
      top: Math.max(0, top - stageRect.top),
      right: Math.max(0, stageRect.left + stageRect.width - (left + width)),
      bottom: Math.max(0, stageRect.top + stageRect.height - (top + height)),
      left: Math.max(0, left - stageRect.left),
    }),
    previewCropMapping: Object.freeze({
      x: sourceX / sourceWidth,
      y: sourceY / sourceHeight,
      width: visibleSourceWidth / sourceWidth,
      height: visibleSourceHeight / sourceHeight,
    }),
    effectiveScale: scale,
    panOffset: Object.freeze({ x: 0, y: 0 }),
  })
}
