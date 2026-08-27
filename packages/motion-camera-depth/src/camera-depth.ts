import { creativeOperationOk,creativeOperationRefusal,type CreativeOperationResultV1,type MotionCompositionV1,type MotionRenderContextV1 } from '@sanverse/motion-contract'
import { applyMotionOperations,constant,evaluateAnimatable,evaluateScene,type Animatable,type MotionGraphOperationV1,type MotionKeyframeV1,type MotionSceneV1 } from '@sanverse/motion-graph'

export type CameraNumericAnimatableV1=Extract<Animatable<number>,Readonly<{kind:'constant'}>|Readonly<{kind:'keyframes'}>>
export interface CameraRigV1 {
  readonly schemaVersion:'sanverse.camera-rig/v1'
  readonly id:string
  readonly durationTicks:number
  readonly positionX:CameraNumericAnimatableV1
  readonly positionY:CameraNumericAnimatableV1
  readonly zoom:CameraNumericAnimatableV1
}
export interface DepthBindingV1 {
  readonly schemaVersion:'sanverse.depth-binding/v1'
  readonly id:string
  readonly nodeId:string
  /** 0 = camera-neutral plane, 1 = normal camera response, >1 = stronger foreground response. */
  readonly depth:number
}
export interface ResolvedCameraStateV1 { readonly tick:number; readonly positionX:number; readonly positionY:number; readonly zoom:number }
export interface CameraDepthQaFindingV1 { readonly code:'CAMERA_INPUT_INVALID'|'DEPTH_BINDING_INVALID'|'DEPTH_NODE_MISSING'; readonly message:string; readonly bindingId?:string }
export interface CameraDepthFrameV1 {
  readonly schemaVersion:'sanverse.camera-depth-frame/v1'
  readonly tick:number
  readonly camera:ResolvedCameraStateV1
  readonly scene:MotionSceneV1
  readonly operations:readonly MotionGraphOperationV1[]
  readonly semanticNodeIds:readonly string[]
  readonly qaFindings:readonly CameraDepthQaFindingV1[]
}

const validId=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=240
const validTick=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0
const validNumber=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const keyframes=(value:CameraNumericAnimatableV1):readonly MotionKeyframeV1<number>[]=>value.kind==='keyframes'?value.keyframes:[]
const validAnimatable=(value:unknown,durationTicks:number,minimum:number,maximum:number):value is CameraNumericAnimatableV1=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  const candidate=value as CameraNumericAnimatableV1
  if(candidate.kind==='constant')return validNumber(candidate.value)&&candidate.value>=minimum&&candidate.value<=maximum
  if(candidate.kind!=='keyframes'||candidate.keyframes.length===0)return false
  let previous=-1
  for(const key of candidate.keyframes){if(!validId(key.id)||!validTick(key.tick)||key.tick>durationTicks||key.tick<=previous||!validNumber(key.value)||key.value<minimum||key.value>maximum||!['hold','linear','bezier'].includes(key.interpolation))return false;previous=key.tick}
  return true
}
export const validateCameraRigV1=(input:unknown):CreativeOperationResultV1<CameraRigV1>=>{
  if(!input||typeof input!=='object'||Array.isArray(input))return creativeOperationRefusal('CAMERA_INPUT_INVALID','Camera rig must be an object.')
  const rig=input as CameraRigV1
  if(rig.schemaVersion!=='sanverse.camera-rig/v1'||!validId(rig.id)||!Number.isSafeInteger(rig.durationTicks)||rig.durationTicks<=0)return creativeOperationRefusal('CAMERA_INPUT_INVALID','Camera rig requires the V1 schema, bounded id and positive exact durationTicks.')
  if(!validAnimatable(rig.positionX,rig.durationTicks,-20_000,20_000)||!validAnimatable(rig.positionY,rig.durationTicks,-20_000,20_000)||!validAnimatable(rig.zoom,rig.durationTicks,.25,4))return creativeOperationRefusal('CAMERA_INPUT_INVALID','Camera pan must stay within ±20,000px and zoom within 0.25–4 using constant/keyframed exact-tick values only.')
  return creativeOperationOk(Object.freeze({...rig,positionX:Object.freeze({...rig.positionX,...(rig.positionX.kind==='keyframes'?{keyframes:Object.freeze([...keyframes(rig.positionX)])}:{})}) as CameraNumericAnimatableV1,positionY:Object.freeze({...rig.positionY,...(rig.positionY.kind==='keyframes'?{keyframes:Object.freeze([...keyframes(rig.positionY)])}:{})}) as CameraNumericAnimatableV1,zoom:Object.freeze({...rig.zoom,...(rig.zoom.kind==='keyframes'?{keyframes:Object.freeze([...keyframes(rig.zoom)])}:{})}) as CameraNumericAnimatableV1}),1)
}
export const validateDepthBindingsV1=(scene:MotionSceneV1,bindings:readonly DepthBindingV1[]):CreativeOperationResultV1<readonly DepthBindingV1[]>=>{
  const ids=new Set<string>(),nodes=new Set<string>()
  for(const binding of bindings){
    if(binding.schemaVersion!=='sanverse.depth-binding/v1'||!validId(binding.id)||!validId(binding.nodeId)||!validNumber(binding.depth)||binding.depth<0||binding.depth>2)return creativeOperationRefusal('DEPTH_BINDING_INVALID','Depth binding requires V1 schema, bounded ids and depth from 0 through 2.')
    if(ids.has(binding.id)||nodes.has(binding.nodeId))return creativeOperationRefusal('DEPTH_BINDING_INVALID','Depth binding ids and node assignments must be unique.')
    if(!scene.nodes[binding.nodeId])return creativeOperationRefusal('DEPTH_NODE_MISSING',`Depth binding references unknown node ${binding.nodeId}.`)
    ids.add(binding.id);nodes.add(binding.nodeId)
  }
  return creativeOperationOk(Object.freeze(bindings.map(binding=>Object.freeze({...binding}))),1)
}
const context=(tick:number,rig:CameraRigV1,composition:MotionCompositionV1):MotionRenderContextV1=>Object.freeze({localTicks:tick,durationTicks:rig.durationTicks,ticksPerSecond:1_440_000,composition,reducedMotion:false})
export const evaluateCameraRigV1=(rig:CameraRigV1,tick:number,composition:MotionCompositionV1):CreativeOperationResultV1<ResolvedCameraStateV1>=>{
  const valid=validateCameraRigV1(rig);if(!valid.ok)return valid as CreativeOperationResultV1<ResolvedCameraStateV1>
  if(!validTick(tick)||tick>rig.durationTicks)return creativeOperationRefusal('CAMERA_TICK_INVALID','Camera evaluation requires an exact tick inside the rig duration.')
  try{const ctx=context(tick,rig,composition);return creativeOperationOk(Object.freeze({tick,positionX:evaluateAnimatable(rig.positionX,ctx),positionY:evaluateAnimatable(rig.positionY,ctx),zoom:evaluateAnimatable(rig.zoom,ctx)}),1)}catch(error){return creativeOperationRefusal('CAMERA_EVALUATION_FAILED',error instanceof Error?error.message:'Camera evaluation failed.')}
}
export interface CameraDepthRenderInputV1 { readonly scene:MotionSceneV1; readonly rig:CameraRigV1; readonly bindings:readonly DepthBindingV1[]; readonly tick:number; readonly composition:MotionCompositionV1 }
export const renderCameraDepthAtTickV1=(input:CameraDepthRenderInputV1):CreativeOperationResultV1<CameraDepthFrameV1>=>{
  const camera=evaluateCameraRigV1(input.rig,input.tick,input.composition);if(!camera.ok)return camera as CreativeOperationResultV1<CameraDepthFrameV1>
  const bindings=validateDepthBindingsV1(input.scene,input.bindings);if(!bindings.ok)return bindings as CreativeOperationResultV1<CameraDepthFrameV1>
  const resolved=evaluateScene(input.scene,context(input.tick,input.rig,input.composition));const operations:MotionGraphOperationV1[]=[]
  for(const binding of bindings.value){const node=resolved.nodes[binding.nodeId]!;const cameraScale=1+(camera.value.zoom-1)*binding.depth;const px=node.transform.positionX-camera.value.positionX*binding.depth;const py=node.transform.positionY-camera.value.positionY*binding.depth;operations.push(Object.freeze({operationId:`camera:${input.rig.id}:${binding.id}:${input.tick}:x`,type:'set-property',target:Object.freeze({nodeId:binding.nodeId,property:'transform.positionX' as const}),value:constant(px)}),Object.freeze({operationId:`camera:${input.rig.id}:${binding.id}:${input.tick}:y`,type:'set-property',target:Object.freeze({nodeId:binding.nodeId,property:'transform.positionY' as const}),value:constant(py)}),Object.freeze({operationId:`camera:${input.rig.id}:${binding.id}:${input.tick}:sx`,type:'set-property',target:Object.freeze({nodeId:binding.nodeId,property:'transform.scaleX' as const}),value:constant(node.transform.scaleX*cameraScale)}),Object.freeze({operationId:`camera:${input.rig.id}:${binding.id}:${input.tick}:sy`,type:'set-property',target:Object.freeze({nodeId:binding.nodeId,property:'transform.scaleY' as const}),value:constant(node.transform.scaleY*cameraScale)}))}
  const applied=applyMotionOperations(input.scene,operations,{durationTicks:input.rig.durationTicks});if(!applied.ok)return creativeOperationRefusal('CAMERA_GRAPH_APPLY_FAILED',applied.error.message,applied.error)
  return creativeOperationOk(Object.freeze({schemaVersion:'sanverse.camera-depth-frame/v1',tick:input.tick,camera:camera.value,scene:applied.scene,operations:Object.freeze(operations),semanticNodeIds:Object.freeze(Object.keys(applied.scene.nodes)),qaFindings:Object.freeze([])}),1)
}
