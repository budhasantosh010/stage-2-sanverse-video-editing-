import { clamp01, lerp } from './math.ts'
import { easeOutCubic } from './easing.ts'

export const PRODUCT_STORY_PLACEMENTS = Object.freeze(['top-left','top-right','center-left','center','center-right','bottom-left','bottom-right'] as const)
export type ProductStoryPlacement = (typeof PRODUCT_STORY_PLACEMENTS)[number]

export interface ProductStorySafePlacementV1 {
  readonly left: number
  readonly top: number
  readonly anchorX: number
  readonly anchorY: number
  readonly maxWidth: number
  readonly maxHeight: number
}

export const resolveProductStorySafePlacement = (input: Readonly<{
  width: number
  height: number
  placement: ProductStoryPlacement
  safeOffset?: number
  widthFraction?: number
  heightFraction?: number
}>): ProductStorySafePlacementV1 => {
  const { width, height, placement } = input
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) throw new RangeError('Product-story composition dimensions must be finite and positive.')
  const safeOffset = input.safeOffset ?? Math.round(Math.min(width, height) * .055)
  if (!Number.isFinite(safeOffset) || safeOffset < 0 || safeOffset > Math.min(width, height) * .45) throw new RangeError('safeOffset must be finite and remain inside the composition.')
  const widthFraction = input.widthFraction ?? .42
  const heightFraction = input.heightFraction ?? .42
  if (!Number.isFinite(widthFraction) || widthFraction <= 0 || widthFraction > 1 || !Number.isFinite(heightFraction) || heightFraction <= 0 || heightFraction > 1) throw new RangeError('Product-story size fractions must live inside (0,1].')
  const horizontal = placement.endsWith('left') ? 0 : placement.endsWith('right') ? 1 : .5
  const vertical = placement.startsWith('top') ? 0 : placement.startsWith('bottom') ? 1 : .5
  const maxWidth = Math.max(1, width * widthFraction)
  const maxHeight = Math.max(1, height * heightFraction)
  const left = horizontal === 0 ? safeOffset : horizontal === 1 ? width - safeOffset - maxWidth : (width - maxWidth) / 2
  const top = vertical === 0 ? safeOffset : vertical === 1 ? height - safeOffset - maxHeight : (height - maxHeight) / 2
  return Object.freeze({ left, top, anchorX: horizontal, anchorY: vertical, maxWidth, maxHeight })
}

export interface PictureInPictureTransitionV1 {
  readonly opacity: number
  readonly scale: number
  readonly translateX: number
  readonly translateY: number
  readonly radius: number
}

export const pictureInPictureTransition = (progress: number, input: Readonly<{
  direction?: 'enter' | 'exit'
  travelX?: number
  travelY?: number
  startScale?: number
  endScale?: number
  radius?: number
}> = {}): PictureInPictureTransitionV1 => {
  const raw = clamp01(progress)
  const direction = input.direction ?? 'enter'
  const t = easeOutCubic(direction === 'enter' ? raw : 1 - raw)
  const startScale = input.startScale ?? .78
  const endScale = input.endScale ?? 1
  const travelX = input.travelX ?? 28
  const travelY = input.travelY ?? 22
  const radius = input.radius ?? 24
  return Object.freeze({
    opacity: t,
    scale: lerp(startScale, endScale, t),
    translateX: lerp(travelX, 0, t),
    translateY: lerp(travelY, 0, t),
    radius: Math.max(0, radius),
  })
}
