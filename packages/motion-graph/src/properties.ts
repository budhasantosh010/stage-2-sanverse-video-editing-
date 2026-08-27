import type { MotionAspectRatio } from '@sanverse/motion-contract'

export type MotionNodeId = string
export type MotionPropertyPrimitiveV1 = number | string | boolean

export interface ConstantValueV1<T> { readonly kind: 'constant'; readonly value: T }

export type MotionEasingIdV1 = 'linear' | 'ease-in-cubic' | 'ease-out-cubic' | 'ease-in-out-cubic'

export type MotionScalarExpressionV1 =
  | Readonly<{ kind: 'constant'; value: number }>
  | Readonly<{ kind: 'progress' }>
  | Readonly<{ kind: 'sequence'; input: MotionScalarExpressionV1; start: number; end: number }>
  | Readonly<{ kind: 'ease'; easing: MotionEasingIdV1; input: MotionScalarExpressionV1 }>
  | Readonly<{ kind: 'spring'; input: MotionScalarExpressionV1; damping: number; frequency: number }>
  | Readonly<{ kind: 'back-out'; input: MotionScalarExpressionV1; overshoot: number }>
  | Readonly<{ kind: 'stagger'; input: MotionScalarExpressionV1; index: number; count: number; overlap: number }>
  | Readonly<{ kind: 'sin'; input: MotionScalarExpressionV1; cycles: number }>
  | Readonly<{ kind: 'clamp01'; input: MotionScalarExpressionV1 }>
  | Readonly<{ kind: 'max'; a: MotionScalarExpressionV1; b: MotionScalarExpressionV1 }>
  | Readonly<{ kind: 'min'; a: MotionScalarExpressionV1; b: MotionScalarExpressionV1 }>
  | Readonly<{ kind: 'add'; values: readonly MotionScalarExpressionV1[] }>
  | Readonly<{ kind: 'multiply'; values: readonly MotionScalarExpressionV1[] }>
  | Readonly<{ kind: 'subtract'; a: MotionScalarExpressionV1; b: MotionScalarExpressionV1 }>
  | Readonly<{ kind: 'lerp'; from: MotionScalarExpressionV1; to: MotionScalarExpressionV1; progress: MotionScalarExpressionV1 }>
  | Readonly<{ kind: 'if-reduced-motion'; reduced: MotionScalarExpressionV1; normal: MotionScalarExpressionV1 }>

export type MotionNumberDriverV1 =
  | Readonly<{ kind: 'interpolation'; from: number; to: number; start: number; end: number; easing: MotionEasingIdV1 }>
  | Readonly<{ kind: 'spring'; from: number; to: number; start: number; end: number; damping: number; frequency: number }>
  | Readonly<{ kind: 'stagger'; from: number; to: number; start: number; end: number; index: number; count: number; overlap: number; easing: MotionEasingIdV1 }>
  | Readonly<{ kind: 'pulse'; base: number; amplitude: number; start: number; end: number; cycles: number; positiveOnly: boolean }>
  | Readonly<{ kind: 'formula'; expression: MotionScalarExpressionV1 }>

export type MotionBooleanDriverV1 = Readonly<{ kind: 'boolean-step'; before: boolean; after: boolean; at: number }>
export type MotionStringDriverV1 =
  | Readonly<{ kind: 'compact-number'; from: number; to: number; start: number; end: number; easing: MotionEasingIdV1; prefix: string; suffix: string; decimals: number; rounding: 'integer' | 'none'; reducedMotionFinal?: boolean }>
  | Readonly<{ kind: 'clock'; totalSeconds: number; mode: 'countdown' | 'countup'; start: number; end: number; alwaysShowHours: boolean }>
export type MotionDriverV1 = MotionNumberDriverV1 | MotionBooleanDriverV1 | MotionStringDriverV1

export interface MotionDrivenValueV1<T> { readonly kind: 'motion'; readonly valueType: 'number' | 'boolean' | 'string'; readonly driver: MotionDriverV1 }

/**
 * Bezier handles are normalized to one keyframe segment. `out*` is the
 * outgoing control point owned by this keyframe. `in*` is the incoming
 * control point used when this keyframe is the right side of a segment.
 * X is normalized time and must stay in [0,1]. Y is normalized value and may
 * overshoot within the bounded C2 validation range.
 */
export interface MotionBezierHandlesV1 { readonly inX: number; readonly inY: number; readonly outX: number; readonly outY: number }
/** @deprecated C2 canonical name is MotionBezierHandlesV1. */
export type KeyframeBezierV1 = MotionBezierHandlesV1

export type MotionKeyframeInterpolationV1 = 'hold' | 'linear' | 'bezier'
export interface MotionKeyframeV1<T> {
  readonly id: string
  readonly tick: number
  readonly value: T
  readonly interpolation: MotionKeyframeInterpolationV1
  readonly bezier?: MotionBezierHandlesV1
}
/** @deprecated C2 canonical name is MotionKeyframeV1. */
export type KeyframeV1<T> = MotionKeyframeV1<T>
export interface KeyframedValueV1<T> { readonly kind: 'keyframes'; readonly keyframes: readonly MotionKeyframeV1<T>[] }

export type MotionNodePropertyNameV1 =
  | 'visible'
  | 'opacity'
  | 'transform.positionX'
  | 'transform.positionY'
  | 'transform.scaleX'
  | 'transform.scaleY'
  | 'transform.rotationDeg'
  | 'transform.anchorX'
  | 'transform.anchorY'
  | 'transform.perspectiveMatrix3d'
  | 'text.text'
  | 'text.fillColor'
  | 'text.fontSize'
  | 'text.fontWeight'
  | 'shape.width'
  | 'shape.height'
  | 'shape.fillColor'
  | 'shape.strokeColor'
  | 'shape.strokeWidth'
  | 'shape.radius'
  | 'path.fillColor'
  | 'path.strokeColor'
  | 'path.strokeWidth'
  | 'path.trimProgress'
  | 'image.width'
  | 'image.height'
  | 'image.opacity'

export interface MotionNodePropertyPathV1 { readonly nodeId: MotionNodeId; readonly property: MotionNodePropertyNameV1 }
export interface MotionBindingV1 {
  readonly source: MotionNodePropertyPathV1
  readonly map?: Readonly<{ scale: number; offset: number; clampMin?: number; clampMax?: number }>
}
export interface BoundValueV1<T> { readonly kind: 'binding'; readonly binding: MotionBindingV1 }

export type Animatable<T> = ConstantValueV1<T> | MotionDrivenValueV1<T> | KeyframedValueV1<T> | BoundValueV1<T>
export const constant = <T>(value: T): ConstantValueV1<T> => Object.freeze({ kind: 'constant', value })
export const motionNumber = (driver: MotionNumberDriverV1): MotionDrivenValueV1<number> => Object.freeze({ kind: 'motion', valueType: 'number', driver })
export const motionBoolean = (driver: MotionBooleanDriverV1): MotionDrivenValueV1<boolean> => Object.freeze({ kind: 'motion', valueType: 'boolean', driver })
export const motionString = (driver: MotionStringDriverV1): MotionDrivenValueV1<string> => Object.freeze({ kind: 'motion', valueType: 'string', driver })
export const keyframed = <T,>(keyframes: readonly MotionKeyframeV1<T>[]): KeyframedValueV1<T> => Object.freeze({
  kind: 'keyframes',
  keyframes: Object.freeze([...keyframes].sort((a, b) => a.tick - b.tick).map((keyframe) => Object.freeze({ ...keyframe, ...(keyframe.bezier ? { bezier: Object.freeze({ ...keyframe.bezier }) } : {}) }))),
})

export interface MotionPropertyPathV1Node { readonly kind: 'node'; readonly nodeId: MotionNodeId; readonly property: MotionNodePropertyNameV1 }
export interface MotionPropertyPathV1Part { readonly kind: 'part'; readonly semanticPartId: string; readonly property: MotionNodePropertyNameV1 }
export interface MotionPropertyPathV1Component { readonly kind: 'component'; readonly propertyId: string }
export interface MotionPropertyPathV1Effect { readonly kind: 'effect'; readonly nodeId: MotionNodeId; readonly effectId: string; readonly parameter: string }
export type MotionMaskNumericPropertyNameV1 = 'opacity' | 'feather' | 'expansion' | 'x' | 'y' | 'width' | 'height' | 'radius'
export interface MotionPropertyPathV1Mask { readonly kind: 'mask'; readonly nodeId: MotionNodeId; readonly maskId: string; readonly property: MotionMaskNumericPropertyNameV1 }
export type MotionPropertyPathV1 = MotionPropertyPathV1Node | MotionPropertyPathV1Part | MotionPropertyPathV1Component | MotionPropertyPathV1Effect | MotionPropertyPathV1Mask
export type MotionKeyframeTargetV1 = MotionPropertyPathV1Node | MotionPropertyPathV1Effect | MotionPropertyPathV1Mask

export interface MotionLayoutOwnershipV1 {
  readonly target: MotionNodePropertyPathV1
  readonly owner: 'layout' | 'manual'
  readonly reason?: string
}
export interface MotionFormatOverrideV1 {
  readonly ratio: MotionAspectRatio
  readonly target: MotionNodePropertyPathV1
  readonly value: MotionPropertyPrimitiveV1
}
export interface MotionLayoutMetadataV1 {
  readonly mode: 'responsive' | 'manual'
  readonly ownership: readonly MotionLayoutOwnershipV1[]
  readonly formatOverrides: readonly MotionFormatOverrideV1[]
}