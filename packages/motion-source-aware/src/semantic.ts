import { creativeOperationOk,creativeOperationRefusal,creativeValidationOk,type CreativeOperationResultV1,type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import type { MotionPointV1 } from '@sanverse/motion-primitives'
import { applyTrackRepairV1,type TrackRepairOperationV1 } from './qa.ts'
import { validateMotionTrackV1,validateTrackBindingV1,type MotionTrackV1,type TrackBindingV1,type TrackFollowModeV1,type TrackOffsetV1,type TrackSampleV1,type TrackTargetV1 } from './contracts.ts'
import { validateCanonicalSubjectMatteV1,type CanonicalSubjectMatteV1 } from './subject.ts'

export type SourceAwareStoryboardModeV1='M5'|'M6'|'M7'
export interface SourceAwareStoryboardSetupV1 {
  readonly schemaVersion:'sanverse.source-aware-storyboard-setup/v1'
  readonly id:string
  readonly mode:SourceAwareStoryboardModeV1
  readonly sourceId:string
  readonly graphicNodeId:string
  readonly trackId?:string
  readonly bindingId?:string
  readonly matteId?:string
  readonly targetLabel:string
  readonly attachment?:'upper-left'|'upper-right'|'lower-left'|'lower-right'|'center'|'surface'
  readonly followMode?:TrackFollowModeV1
}
const id=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=240
export const validateSourceAwareStoryboardSetupV1=(input:unknown):CreativeValidationResultV1<SourceAwareStoryboardSetupV1>=>{
  if(!input||typeof input!=='object'||Array.isArray(input)||(input as SourceAwareStoryboardSetupV1).schemaVersion!=='sanverse.source-aware-storyboard-setup/v1')return creativeOperationRefusal('SOURCE_AWARE_SETUP_VERSION','Source-aware storyboard setup must use sanverse.source-aware-storyboard-setup/v1.') as CreativeValidationResultV1<SourceAwareStoryboardSetupV1>
  const value=input as SourceAwareStoryboardSetupV1
  if(!id(value.id)||!id(value.sourceId)||!id(value.graphicNodeId)||!id(value.targetLabel)||!['M5','M6','M7'].includes(value.mode))return creativeOperationRefusal('SOURCE_AWARE_SETUP_INVALID','Source-aware storyboard setup identity/mode is invalid.') as CreativeValidationResultV1<SourceAwareStoryboardSetupV1>
  if((value.mode==='M5'||value.mode==='M6')&&(!id(value.trackId)||!id(value.bindingId)))return creativeOperationRefusal('SOURCE_AWARE_SETUP_TRACK_REQUIRED',`${value.mode} requires canonical track and binding ids.`) as CreativeValidationResultV1<SourceAwareStoryboardSetupV1>
  if(value.mode==='M6'&&value.followMode!=='surface')return creativeOperationRefusal('SOURCE_AWARE_SETUP_SURFACE_REQUIRED','M6 requires surface follow mode.') as CreativeValidationResultV1<SourceAwareStoryboardSetupV1>
  if(value.mode==='M7'&&!id(value.matteId))return creativeOperationRefusal('SOURCE_AWARE_SETUP_MATTE_REQUIRED','M7 requires a canonical subject matte id.') as CreativeValidationResultV1<SourceAwareStoryboardSetupV1>
  return creativeValidationOk(Object.freeze({...value}))
}

export type TrackingControlOperationV1=
  | Readonly<{type:'tracking.attach';track:MotionTrackV1;binding:TrackBindingV1}>
  | Readonly<{type:'tracking.detach'}>
  | Readonly<{type:'tracking.set-target';target:TrackTargetV1}>
  | Readonly<{type:'tracking.set-follow-mode';followMode:TrackFollowModeV1}>
  | Readonly<{type:'tracking.set-offset';offset:TrackOffsetV1}>
  | Readonly<{type:'tracking.set-anchor';anchor:MotionPointV1}>
  | Readonly<{type:'tracking.set-smoothing-policy';smoothingPolicy:'none'|'canonical-curve'}>
  | Readonly<{type:'tracking.correct-sample';sample:TrackSampleV1}>
export interface TrackingAttachmentStateV1 {readonly attached:boolean;readonly track:MotionTrackV1;readonly binding:TrackBindingV1}
export const applyTrackingControlV1=(state:TrackingAttachmentStateV1,operation:TrackingControlOperationV1):CreativeOperationResultV1<TrackingAttachmentStateV1>=>{
  const trackValid=validateMotionTrackV1(state.track),bindingValid=validateTrackBindingV1(state.binding);if(!trackValid.ok)return creativeOperationRefusal(trackValid.refusal.code,trackValid.refusal.message,trackValid.refusal.details);if(!bindingValid.ok)return creativeOperationRefusal(bindingValid.refusal.code,bindingValid.refusal.message,bindingValid.refusal.details)
  if(operation.type==='tracking.detach')return creativeOperationOk(Object.freeze({...state,attached:false}),1)
  if(operation.type==='tracking.attach'){const t=validateMotionTrackV1(operation.track),b=validateTrackBindingV1(operation.binding);if(!t.ok)return creativeOperationRefusal(t.refusal.code,t.refusal.message,t.refusal.details);if(!b.ok)return creativeOperationRefusal(b.refusal.code,b.refusal.message,b.refusal.details);if(b.value.trackId!==t.value.id)return creativeOperationRefusal('TRACK_BINDING_TRACK_MISMATCH','Attachment binding must reference the supplied track.');return creativeOperationOk(Object.freeze({attached:true,track:t.value,binding:b.value}),1)}
  if(operation.type==='tracking.set-target')return creativeOperationOk(Object.freeze({...state,track:Object.freeze({...state.track,target:Object.freeze({...operation.target})})}),1)
  if(operation.type==='tracking.set-follow-mode')return creativeOperationOk(Object.freeze({...state,binding:Object.freeze({...state.binding,followMode:operation.followMode})}),1)
  if(operation.type==='tracking.set-offset'){const next=Object.freeze({...state.binding,offset:Object.freeze({...operation.offset})});const valid=validateTrackBindingV1(next);return valid.ok?creativeOperationOk(Object.freeze({...state,binding:valid.value}),1):creativeOperationRefusal(valid.refusal.code,valid.refusal.message,valid.refusal.details)}
  if(operation.type==='tracking.set-anchor'){const next=Object.freeze({...state.binding,anchor:Object.freeze({...operation.anchor})});const valid=validateTrackBindingV1(next);return valid.ok?creativeOperationOk(Object.freeze({...state,binding:valid.value}),1):creativeOperationRefusal(valid.refusal.code,valid.refusal.message,valid.refusal.details)}
  if(operation.type==='tracking.set-smoothing-policy')return creativeOperationOk(Object.freeze({...state,binding:Object.freeze({...state.binding,smoothingPolicy:operation.smoothingPolicy})}),1)
  const repaired=applyTrackRepairV1(state.track,Object.freeze({type:'manual-correction',sample:operation.sample}) satisfies TrackRepairOperationV1);return repaired.ok?creativeOperationOk(Object.freeze({...state,track:repaired.value}),1):repaired as CreativeOperationResultV1<TrackingAttachmentStateV1>
}

export type SurfaceControlOperationV1=
  | Readonly<{type:'surface.attach';track:MotionTrackV1;binding:TrackBindingV1}>
  | Readonly<{type:'surface.set-quad';tick:number;sample:TrackSampleV1}>
  | Readonly<{type:'surface.fit';fit:'stretch'|'contain'|'cover'}>
  | Readonly<{type:'surface.set-opacity';opacity:number}>
  | Readonly<{type:'surface.set-mask';maskId:string|null}>
  | Readonly<{type:'surface.correct-track';repair:TrackRepairOperationV1}>
export interface SurfaceAttachmentStateV1 {readonly attached:boolean;readonly track:MotionTrackV1;readonly binding:TrackBindingV1;readonly fit:'stretch';readonly opacity:number;readonly maskId:string|null}
export const applySurfaceControlV1=(state:SurfaceAttachmentStateV1,operation:SurfaceControlOperationV1):CreativeOperationResultV1<SurfaceAttachmentStateV1>=>{
  if(operation.type==='surface.attach'){const t=validateMotionTrackV1(operation.track),b=validateTrackBindingV1(operation.binding);if(!t.ok)return creativeOperationRefusal(t.refusal.code,t.refusal.message,t.refusal.details);if(!b.ok)return creativeOperationRefusal(b.refusal.code,b.refusal.message,b.refusal.details);if(t.value.target.kind!=='surface'||b.value.followMode!=='surface')return creativeOperationRefusal('SURFACE_ATTACHMENT_INVALID','Surface attachment requires a surface track and surface follow mode.');return creativeOperationOk(Object.freeze({...state,attached:true,track:t.value,binding:b.value}),1)}
  if(operation.type==='surface.fit'){if(operation.fit!=='stretch')return creativeOperationRefusal('SURFACE_FIT_UNSUPPORTED','V1.2 native surface projection supports exact stretch-to-quad fit only; contain/cover require an explicit crop/matte strategy.');return creativeOperationOk(state,1)}
  if(operation.type==='surface.set-opacity'){if(!Number.isFinite(operation.opacity)||operation.opacity<0||operation.opacity>1)return creativeOperationRefusal('SURFACE_OPACITY_INVALID','Surface opacity must be between 0 and 1.');return creativeOperationOk(Object.freeze({...state,opacity:operation.opacity}),1)}
  if(operation.type==='surface.set-mask')return creativeOperationOk(Object.freeze({...state,maskId:operation.maskId}),1)
  const repair=operation.type==='surface.set-quad'?Object.freeze({type:'manual-correction' as const,sample:Object.freeze({...operation.sample,tick:operation.tick})}):operation.repair
  const next=applyTrackRepairV1(state.track,repair);return next.ok?creativeOperationOk(Object.freeze({...state,track:next.value}),1):next as CreativeOperationResultV1<SurfaceAttachmentStateV1>
}

export type SubjectControlOperationV1=Readonly<{type:'subject.isolate'}>|Readonly<{type:'subject.set-matte';matte:CanonicalSubjectMatteV1}>
export interface SubjectEnvironmentStateV1 {readonly isolated:boolean;readonly matte:CanonicalSubjectMatteV1}
export const applySubjectControlV1=(state:SubjectEnvironmentStateV1,operation:SubjectControlOperationV1):CreativeOperationResultV1<SubjectEnvironmentStateV1>=>{
  const current=validateCanonicalSubjectMatteV1(state.matte);if(!current.ok)return creativeOperationRefusal(current.refusal.code,current.refusal.message,current.refusal.details)
  if(operation.type==='subject.isolate')return creativeOperationOk(Object.freeze({...state,isolated:true}),1)
  const next=validateCanonicalSubjectMatteV1(operation.matte);return next.ok?creativeOperationOk(Object.freeze({isolated:true,matte:next.value}),1):creativeOperationRefusal(next.refusal.code,next.refusal.message,next.refusal.details)
}
