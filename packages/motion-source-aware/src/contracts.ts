import { creativeRefusal,creativeValidationOk,type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import type { MotionPointV1 } from '@sanverse/motion-primitives'

export const TRACK_TARGET_KINDS_V1=Object.freeze(['point','object','subject','surface'] as const)
export type TrackTargetKindV1=(typeof TRACK_TARGET_KINDS_V1)[number]
export interface TrackTargetV1 { readonly kind:TrackTargetKindV1; readonly label:string; readonly semanticNodeId?:string }
export interface SurfaceCornersV1 { readonly topLeft:MotionPointV1; readonly topRight:MotionPointV1; readonly bottomRight:MotionPointV1; readonly bottomLeft:MotionPointV1 }
export interface TrackSampleV1 { readonly tick:number; readonly x:number; readonly y:number; readonly scaleX?:number; readonly scaleY?:number; readonly rotation?:number; readonly visibility:number; readonly confidence:number; readonly surfaceCorners?:SurfaceCornersV1 }
export interface TrackInterpolationV1 { readonly mode:'hold'|'linear'|'canonical-curve'; readonly curve?:'ease-in-cubic'|'ease-out-cubic'|'ease-in-out-cubic' }
export interface TrackMetadataV1 { readonly coordinateSpace:'normalized-source'; readonly provider:string; readonly materializedAt:string; readonly sourceHash?:string }
export interface MotionTrackV1 { readonly schemaVersion:'sanverse.motion-track/v1'; readonly id:string; readonly sourceId:string; readonly sourceStartTick:number; readonly sourceEndTick:number; readonly target:TrackTargetV1; readonly samples:readonly TrackSampleV1[]; readonly interpolation:TrackInterpolationV1; readonly status:'valid'|'partial'|'low-confidence'|'lost'; readonly metadata:TrackMetadataV1 }
export type TrackFollowModeV1='position'|'position+scale'|'position+rotation'|'full-transform'|'surface'
export interface TrackOffsetV1 { readonly x:number; readonly y:number; readonly scaleX:number; readonly scaleY:number; readonly rotation:number }
export interface TrackBindingV1 { readonly schemaVersion:'sanverse.track-binding/v1'; readonly id:string; readonly trackId:string; readonly nodeId:string; readonly followMode:TrackFollowModeV1; readonly offset:TrackOffsetV1; readonly anchor:MotionPointV1; readonly smoothingPolicy:'none'|'canonical-curve' }
export interface ResolvedTrackSampleV1 { readonly tick:number; readonly x:number; readonly y:number; readonly scaleX:number; readonly scaleY:number; readonly rotation:number; readonly visibility:number; readonly confidence:number; readonly surfaceCorners?:SurfaceCornersV1 }

const record=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v)
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)
const tick=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0
const id=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=240
const point=(v:unknown):v is MotionPointV1=>record(v)&&finite(v.x)&&finite(v.y)&&v.x>=-2&&v.x<=3&&v.y>=-2&&v.y<=3
export const validateMotionTrackV1=(input:unknown):CreativeValidationResultV1<MotionTrackV1>=>{
  if(!record(input)||input.schemaVersion!=='sanverse.motion-track/v1')return creativeRefusal('UNSUPPORTED_TRACK_VERSION','Track must use sanverse.motion-track/v1.')
  if(!id(input.id)||!id(input.sourceId)||!tick(input.sourceStartTick)||!tick(input.sourceEndTick)||input.sourceEndTick<input.sourceStartTick)return creativeRefusal('INVALID_TRACK','Track identity/range is invalid.')
  if(!record(input.target)||!TRACK_TARGET_KINDS_V1.includes(input.target.kind as TrackTargetKindV1)||!id(input.target.label))return creativeRefusal('INVALID_TRACK_TARGET','Track target is invalid.')
  if(!Array.isArray(input.samples)||input.samples.length===0)return creativeRefusal('INVALID_TRACK_SAMPLES','Track requires materialized samples.')
  let previous=-1
  for(const raw of input.samples as unknown[]){if(!record(raw)||!tick(raw.tick)||raw.tick<previous||raw.tick<input.sourceStartTick||raw.tick>input.sourceEndTick||!finite(raw.x)||!finite(raw.y)||!finite(raw.visibility)||raw.visibility<0||raw.visibility>1||!finite(raw.confidence)||raw.confidence<0||raw.confidence>1)return creativeRefusal('INVALID_TRACK_SAMPLES','Track samples must be ordered exact ticks with finite normalized position/visibility/confidence.');previous=raw.tick;if(raw.surfaceCorners!==undefined){if(!record(raw.surfaceCorners))return creativeRefusal('INVALID_TRACK_SURFACE','Surface corners are invalid.');const corners=raw.surfaceCorners;if(!point(corners.topLeft)||!point(corners.topRight)||!point(corners.bottomRight)||!point(corners.bottomLeft))return creativeRefusal('INVALID_TRACK_SURFACE','Surface corners are invalid.')}}
  if(!record(input.interpolation)||!['hold','linear','canonical-curve'].includes(String(input.interpolation.mode)))return creativeRefusal('INVALID_TRACK_INTERPOLATION','Track interpolation is unsupported.')
  return creativeValidationOk(input as unknown as MotionTrackV1)
}

export const validateTrackBindingV1=(input:unknown):CreativeValidationResultV1<TrackBindingV1>=>{
  if(!record(input)||input.schemaVersion!=='sanverse.track-binding/v1')return creativeRefusal('UNSUPPORTED_TRACK_BINDING_VERSION','Track binding must use sanverse.track-binding/v1.')
  if(!id(input.id)||!id(input.trackId)||!id(input.nodeId)||!['position','position+scale','position+rotation','full-transform','surface'].includes(String(input.followMode)))return creativeRefusal('INVALID_TRACK_BINDING','Track binding identity/follow mode is invalid.')
  if(!record(input.offset)||![input.offset.x,input.offset.y,input.offset.scaleX,input.offset.scaleY,input.offset.rotation].every(finite)||Number(input.offset.scaleX)<=0||Number(input.offset.scaleY)<=0)return creativeRefusal('INVALID_TRACK_BINDING','Track binding offset must contain finite X/Y/rotation and positive scale values.')
  if(!point(input.anchor)||!['none','canonical-curve'].includes(String(input.smoothingPolicy)))return creativeRefusal('INVALID_TRACK_BINDING','Track binding anchor/smoothing policy is invalid.')
  return creativeValidationOk(input as unknown as TrackBindingV1)
}
