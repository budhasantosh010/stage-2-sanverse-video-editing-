import type { Animatable } from './properties.ts'
import { constant } from './properties.ts'

export const MOTION_MASK_TYPES = ['rectangle', 'rounded-rectangle', 'ellipse'] as const
export type MotionMaskTypeV1 = (typeof MOTION_MASK_TYPES)[number]
export interface MotionMaskInstanceV1 {
  readonly id: string
  readonly type: MotionMaskTypeV1
  readonly enabled: boolean
  readonly invert: boolean
  readonly opacity: Animatable<number>
  readonly feather: Animatable<number>
  readonly expansion: Animatable<number>
  readonly x: Animatable<number>
  readonly y: Animatable<number>
  readonly width: Animatable<number>
  readonly height: Animatable<number>
  readonly radius: Animatable<number>
}
export const createDefaultMask = (id: string, type: MotionMaskTypeV1): MotionMaskInstanceV1 => Object.freeze({
  id, type, enabled: true, invert: false,
  opacity: constant(1), feather: constant(0), expansion: constant(0),
  x: constant(0), y: constant(0), width: constant(1), height: constant(1), radius: constant(type === 'rounded-rectangle' ? 0.08 : 0),
})
export interface ResolvedMotionMaskV1 {
  readonly id: string
  readonly type: MotionMaskTypeV1
  readonly enabled: boolean
  readonly invert: boolean
  readonly opacity: number
  readonly feather: number
  readonly expansion: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly radius: number
}
