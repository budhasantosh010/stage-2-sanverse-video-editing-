import type { Animatable, MotionNodeId } from './properties.ts'
import { constant } from './properties.ts'
import type { MotionBlendModeV1, MotionEffectInstanceV1, ResolvedMotionEffectV1 } from './effects.ts'
import type { MotionMaskInstanceV1, ResolvedMotionMaskV1 } from './masks.ts'

export interface MotionTransformV1 {
  readonly positionX: Animatable<number>
  readonly positionY: Animatable<number>
  readonly scaleX: Animatable<number>
  readonly scaleY: Animatable<number>
  readonly rotationDeg: Animatable<number>
  readonly anchorX: Animatable<number>
  readonly anchorY: Animatable<number>
}
export const identityTransform = (): MotionTransformV1 => Object.freeze({ positionX: constant(0), positionY: constant(0), scaleX: constant(1), scaleY: constant(1), rotationDeg: constant(0), anchorX: constant(0.5), anchorY: constant(0.5) })

export interface MotionNodeBaseV1 {
  readonly id: MotionNodeId
  readonly name: string
  readonly parentId: MotionNodeId | null
  readonly visible: Animatable<boolean>
  readonly opacity: Animatable<number>
  readonly transform: MotionTransformV1
  readonly blendMode: MotionBlendModeV1
  readonly effects: readonly MotionEffectInstanceV1[]
  readonly masks: readonly MotionMaskInstanceV1[]
}
export interface MotionGroupNodeV1 extends MotionNodeBaseV1 { readonly type: 'group'; readonly childIds: readonly MotionNodeId[]; readonly componentInstance?: Readonly<{ componentId: string; version: number; instanceId: string }> }
export interface MotionTextNodeV1 extends MotionNodeBaseV1 { readonly type: 'text'; readonly text: Animatable<string>; readonly fillColor: Animatable<string>; readonly fontFamily: string; readonly fontSize: Animatable<number>; readonly fontWeight: Animatable<number>; readonly textAlign: 'left' | 'center' | 'right' }
export interface MotionShapeNodeV1 extends MotionNodeBaseV1 { readonly type: 'shape'; readonly shape: 'rectangle' | 'rounded-rectangle' | 'ellipse'; readonly width: Animatable<number>; readonly height: Animatable<number>; readonly fillColor: Animatable<string>; readonly strokeColor: Animatable<string>; readonly strokeWidth: Animatable<number>; readonly radius: Animatable<number> }
export interface MotionPathNodeV1 extends MotionNodeBaseV1 { readonly type: 'path'; readonly pathData: string; readonly fillColor: Animatable<string>; readonly strokeColor: Animatable<string>; readonly strokeWidth: Animatable<number>; readonly trimProgress: Animatable<number> }
export interface MotionImageNodeV1 extends MotionNodeBaseV1 { readonly type: 'image'; readonly source: string; readonly width: Animatable<number>; readonly height: Animatable<number>; readonly fit: 'contain' | 'cover' | 'fill'; readonly imageOpacity: Animatable<number> }
export type MotionNodeV1 = MotionGroupNodeV1 | MotionTextNodeV1 | MotionShapeNodeV1 | MotionPathNodeV1 | MotionImageNodeV1

export interface ResolvedMotionTransformV1 { readonly positionX: number; readonly positionY: number; readonly scaleX: number; readonly scaleY: number; readonly rotationDeg: number; readonly anchorX: number; readonly anchorY: number }
export interface ResolvedMotionNodeBaseV1 { readonly id: MotionNodeId; readonly name: string; readonly parentId: MotionNodeId | null; readonly visible: boolean; readonly opacity: number; readonly transform: ResolvedMotionTransformV1; readonly blendMode: MotionBlendModeV1; readonly effects: readonly ResolvedMotionEffectV1[]; readonly masks: readonly ResolvedMotionMaskV1[] }
export interface ResolvedMotionGroupNodeV1 extends ResolvedMotionNodeBaseV1 { readonly type: 'group'; readonly childIds: readonly MotionNodeId[] }
export interface ResolvedMotionTextNodeV1 extends ResolvedMotionNodeBaseV1 { readonly type: 'text'; readonly text: string; readonly fillColor: string; readonly fontFamily: string; readonly fontSize: number; readonly fontWeight: number; readonly textAlign: 'left' | 'center' | 'right' }
export interface ResolvedMotionShapeNodeV1 extends ResolvedMotionNodeBaseV1 { readonly type: 'shape'; readonly shape: MotionShapeNodeV1['shape']; readonly width: number; readonly height: number; readonly fillColor: string; readonly strokeColor: string; readonly strokeWidth: number; readonly radius: number }
export interface ResolvedMotionPathNodeV1 extends ResolvedMotionNodeBaseV1 { readonly type: 'path'; readonly pathData: string; readonly fillColor: string; readonly strokeColor: string; readonly strokeWidth: number; readonly trimProgress: number }
export interface ResolvedMotionImageNodeV1 extends ResolvedMotionNodeBaseV1 { readonly type: 'image'; readonly source: string; readonly width: number; readonly height: number; readonly fit: MotionImageNodeV1['fit']; readonly imageOpacity: number }
export type ResolvedMotionNodeV1 = ResolvedMotionGroupNodeV1 | ResolvedMotionTextNodeV1 | ResolvedMotionShapeNodeV1 | ResolvedMotionPathNodeV1 | ResolvedMotionImageNodeV1

export const nodeBase = (id: string, name: string, parentId: string | null): Pick<MotionNodeBaseV1, 'id' | 'name' | 'parentId' | 'visible' | 'opacity' | 'transform' | 'blendMode' | 'effects' | 'masks'> => ({ id, name, parentId, visible: constant(true), opacity: constant(1), transform: identityTransform(), blendMode: 'normal', effects: Object.freeze([]), masks: Object.freeze([]) })
