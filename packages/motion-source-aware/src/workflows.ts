import { creativeOperationOk,creativeOperationRefusal,type CreativeOperationResultV1,type MotionCompositionV1 } from '@sanverse/motion-contract'
import { applyMotionOperations,constant,createDefaultMask,evaluateScene,type MotionGraphOperationV1,type MotionSceneV1,type ResolvedMotionSceneV1 } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { validateMotionTrackV1,validateTrackBindingV1,type MotionTrackV1,type TrackBindingV1 } from './contracts.ts'
import { runTrackQaV1 } from './qa.ts'
import { evaluateMotionTrackV1,compileTrackBindingAtTickV1 } from './tracking.ts'
import { projectSurfaceQuadV1,runSurfaceQaV1 } from './surface.ts'
import { materializeSubjectMatteToMaskV1,runSubjectQaV1,validateCanonicalSubjectMatteV1,type CanonicalSubjectMatteV1 } from './subject.ts'

export type SourceAwarePresentationModeV1='tracked-attached'|'surface-embedded'|'subject-environment'
export interface SourceAwareReviewFrameV1 {
  readonly schemaVersion:'sanverse.source-aware-review-frame/v1'
  readonly mode:SourceAwarePresentationModeV1
  readonly tick:number
  readonly scene:MotionSceneV1
  readonly resolvedScene:ResolvedMotionSceneV1
  readonly operations:readonly MotionGraphOperationV1[]
  readonly semanticNodeIds:readonly string[]
  readonly qaFindings:readonly Readonly<{code:string;message:string}>[]
}

const validTick=(tick:number)=>Number.isSafeInteger(tick)&&tick>=0
const context=(tick:number,durationTicks:number,composition:MotionCompositionV1)=>Object.freeze({localTicks:tick,durationTicks:Math.max(1,durationTicks),ticksPerSecond:SANVERSE_TICKS_PER_SECOND,composition,reducedMotion:false})
const finish=(mode:SourceAwarePresentationModeV1,tick:number,scene:MotionSceneV1,operations:readonly MotionGraphOperationV1[],composition:MotionCompositionV1,qaFindings:readonly Readonly<{code:string;message:string}>[]):CreativeOperationResultV1<SourceAwareReviewFrameV1>=>creativeOperationOk(Object.freeze({schemaVersion:'sanverse.source-aware-review-frame/v1',mode,tick,scene,resolvedScene:evaluateScene(scene,context(tick,Math.max(tick+1,1),composition)),operations:Object.freeze([...operations]),semanticNodeIds:Object.freeze(Object.keys(scene.nodes)),qaFindings:Object.freeze([...qaFindings])}),1)

export interface TrackedAttachmentReviewInputV1 { readonly scene:MotionSceneV1; readonly track:MotionTrackV1; readonly binding:TrackBindingV1; readonly tick:number; readonly composition:MotionCompositionV1 }
export const renderTrackedAttachmentAtTickV1=(input:TrackedAttachmentReviewInputV1):CreativeOperationResultV1<SourceAwareReviewFrameV1>=>{
  if(!validTick(input.tick))return creativeOperationRefusal('SOURCE_AWARE_TICK_INVALID','Tracked attachment requires a non-negative exact tick.')
  const trackValid=validateMotionTrackV1(input.track);if(!trackValid.ok)return creativeOperationRefusal(trackValid.refusal.code,trackValid.refusal.message,trackValid.refusal.details)
  const bindingValid=validateTrackBindingV1(input.binding);if(!bindingValid.ok)return creativeOperationRefusal(bindingValid.refusal.code,bindingValid.refusal.message,bindingValid.refusal.details)
  if(input.binding.followMode==='surface')return creativeOperationRefusal('TRACK_BINDING_MODE_INVALID','M5 tracked-attached does not accept the surface follow mode.')
  if(input.track.target.kind==='surface')return creativeOperationRefusal('TRACK_TARGET_MODE_INVALID','M5 tracked-attached requires point/object/subject tracking rather than a surface quad.')
  const qa=runTrackQaV1(input.track)
  if(!qa.ok)return creativeOperationRefusal('TRACK_QA_FAILED','Tracked attachment refuses a track with unresolved QA findings.',qa.findings)
  let operations:readonly MotionGraphOperationV1[]
  try{operations=compileTrackBindingAtTickV1(input.scene,input.track,input.binding,input.tick,input.composition)}catch(error){return creativeOperationRefusal('TRACK_BINDING_FAILED',error instanceof Error?error.message:'Track binding failed.')}
  const applied=applyMotionOperations(input.scene,operations,{durationTicks:Math.max(1,input.track.sourceEndTick)})
  if(!applied.ok)return creativeOperationRefusal('TRACK_BINDING_FAILED',applied.error.message,applied.error)
  return finish('tracked-attached',input.tick,applied.scene,operations,input.composition,qa.findings)
}

export interface SurfaceEmbeddedReviewInputV1 { readonly scene:MotionSceneV1; readonly track:MotionTrackV1; readonly binding:TrackBindingV1; readonly nodeSize:Readonly<{width:number;height:number}>; readonly tick:number; readonly composition:MotionCompositionV1 }
export const renderSurfaceEmbeddedAtTickV1=(input:SurfaceEmbeddedReviewInputV1):CreativeOperationResultV1<SourceAwareReviewFrameV1>=>{
  if(!validTick(input.tick))return creativeOperationRefusal('SOURCE_AWARE_TICK_INVALID','Surface embedding requires a non-negative exact tick.')
  const trackValid=validateMotionTrackV1(input.track);if(!trackValid.ok)return creativeOperationRefusal(trackValid.refusal.code,trackValid.refusal.message,trackValid.refusal.details)
  const bindingValid=validateTrackBindingV1(input.binding);if(!bindingValid.ok)return creativeOperationRefusal(bindingValid.refusal.code,bindingValid.refusal.message,bindingValid.refusal.details)
  if(input.track.target.kind!=='surface'||input.binding.followMode!=='surface')return creativeOperationRefusal('SURFACE_BINDING_REQUIRED','M6 surface-embedded requires a surface track and surface binding.')
  if(input.binding.trackId!==input.track.id||!input.scene.nodes[input.binding.nodeId])return creativeOperationRefusal('SURFACE_BINDING_INVALID','Surface binding must reference the supplied track and an existing graph node.')
  if(input.binding.offset.scaleX!==1||input.binding.offset.scaleY!==1||input.binding.offset.rotation!==0)return creativeOperationRefusal('SURFACE_OFFSET_UNSUPPORTED','V1.2 surface embedding supports deterministic X/Y user offset only; scale/rotation offsets remain normal graph motion.')
  const trackQa=runTrackQaV1(input.track)
  const surfaceSamples=input.track.samples.flatMap(sample=>sample.surfaceCorners?[Object.freeze({tick:sample.tick,corners:sample.surfaceCorners,confidence:sample.confidence})]:[])
  const surfaceQa=runSurfaceQaV1(surfaceSamples)
  if(!trackQa.ok||surfaceQa.length>0)return creativeOperationRefusal('SURFACE_QA_FAILED','Surface embedding refuses unresolved tracking/surface QA findings.',Object.freeze([...trackQa.findings,...surfaceQa]))
  const sample=evaluateMotionTrackV1(input.track,input.tick)
  if(!sample.surfaceCorners)return creativeOperationRefusal('SURFACE_SAMPLE_MISSING','Surface track has no quad at the requested tick.')
  const dx=input.binding.offset.x/input.composition.width,dy=input.binding.offset.y/input.composition.height
  const shifted=Object.freeze({topLeft:{x:sample.surfaceCorners.topLeft.x+dx,y:sample.surfaceCorners.topLeft.y+dy},topRight:{x:sample.surfaceCorners.topRight.x+dx,y:sample.surfaceCorners.topRight.y+dy},bottomRight:{x:sample.surfaceCorners.bottomRight.x+dx,y:sample.surfaceCorners.bottomRight.y+dy},bottomLeft:{x:sample.surfaceCorners.bottomLeft.x+dx,y:sample.surfaceCorners.bottomLeft.y+dy}})
  let matrix:string
  try{matrix=projectSurfaceQuadV1(input.nodeSize,shifted,input.composition).cssMatrix3d}catch(error){return creativeOperationRefusal('SURFACE_PROJECTION_FAILED',error instanceof Error?error.message:'Surface projection failed.')}
  const operations:readonly MotionGraphOperationV1[]=Object.freeze([
    Object.freeze({operationId:`surface:${input.binding.id}:${input.tick}:anchor-x`,type:'set-property',target:Object.freeze({nodeId:input.binding.nodeId,property:'transform.anchorX' as const}),value:constant(0)}),
    Object.freeze({operationId:`surface:${input.binding.id}:${input.tick}:anchor-y`,type:'set-property',target:Object.freeze({nodeId:input.binding.nodeId,property:'transform.anchorY' as const}),value:constant(0)}),
    Object.freeze({operationId:`surface:${input.binding.id}:${input.tick}:perspective`,type:'set-property',target:Object.freeze({nodeId:input.binding.nodeId,property:'transform.perspectiveMatrix3d' as const}),value:constant(matrix)}),
  ])
  const applied=applyMotionOperations(input.scene,operations,{durationTicks:Math.max(1,input.track.sourceEndTick)})
  if(!applied.ok)return creativeOperationRefusal('SURFACE_BINDING_FAILED',applied.error.message,applied.error)
  return finish('surface-embedded',input.tick,applied.scene,operations,input.composition,Object.freeze([...trackQa.findings,...surfaceQa]))
}

export interface SubjectEnvironmentReviewInputV1 { readonly scene:MotionSceneV1; readonly matte:CanonicalSubjectMatteV1; readonly nodeId:string; readonly maskId:string; readonly tick:number; readonly composition:MotionCompositionV1 }
export const renderSubjectEnvironmentAtTickV1=(input:SubjectEnvironmentReviewInputV1):CreativeOperationResultV1<SourceAwareReviewFrameV1>=>{
  if(!validTick(input.tick))return creativeOperationRefusal('SOURCE_AWARE_TICK_INVALID','Subject/environment review requires a non-negative exact tick.')
  const matteValid=validateCanonicalSubjectMatteV1(input.matte);if(!matteValid.ok)return creativeOperationRefusal(matteValid.refusal.code,matteValid.refusal.message,matteValid.refusal.details)
  if(!input.scene.nodes[input.nodeId])return creativeOperationRefusal('SUBJECT_ENVIRONMENT_NODE_MISSING',`Unknown environment node ${input.nodeId}.`)
  const qa=runSubjectQaV1(input.matte)
  if(qa.length>0)return creativeOperationRefusal('SUBJECT_MATTE_QA_FAILED','Subject/environment refuses an unresolved matte QA finding.',qa)
  const base=Object.freeze({...createDefaultMask(input.maskId,'rounded-rectangle'),invert:true})
  const mask=materializeSubjectMatteToMaskV1(input.matte,base)
  const operation:MotionGraphOperationV1=Object.freeze({operationId:`subject:${input.matte.id}:${input.maskId}:add`,type:'add-mask',nodeId:input.nodeId,mask})
  const applied=applyMotionOperations(input.scene,[operation],{durationTicks:Math.max(1,input.matte.samples.at(-1)?.tick??input.tick+1)})
  if(!applied.ok)return creativeOperationRefusal('SUBJECT_ENVIRONMENT_BINDING_FAILED',applied.error.message,applied.error)
  return finish('subject-environment',input.tick,applied.scene,[operation],input.composition,qa)
}
