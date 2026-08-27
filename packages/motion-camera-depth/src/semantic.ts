import { creativeOperationOk,creativeOperationRefusal,type CreativeOperationResultV1 } from '@sanverse/motion-contract'
import { constant,keyframed,type MotionKeyframeV1,type MotionSceneV1 } from '@sanverse/motion-graph'
import { validateCameraRigV1,validateDepthBindingsV1,type CameraNumericAnimatableV1,type CameraRigV1,type DepthBindingV1 } from './camera-depth.ts'

export type CameraRigPropertyV1='positionX'|'positionY'|'zoom'
export interface CameraDepthControlStateV1 {
  readonly schemaVersion:'sanverse.camera-depth-control-state/v1'
  readonly rig:CameraRigV1
  readonly bindings:readonly DepthBindingV1[]
}
export type CameraDepthControlOperationV1=
  | Readonly<{type:'camera.set-position';x:number;y:number}>
  | Readonly<{type:'camera.set-zoom';zoom:number}>
  | Readonly<{type:'camera.set-keyframe';property:CameraRigPropertyV1;keyframe:MotionKeyframeV1<number>}>
  | Readonly<{type:'camera.remove-keyframe';property:CameraRigPropertyV1;keyframeId:string}>
  | Readonly<{type:'depth.set';binding:DepthBindingV1}>
  | Readonly<{type:'depth.remove';nodeId:string}>
  | Readonly<{type:'depth.distribute';nodeIds:readonly string[];minimumDepth:number;maximumDepth:number}>

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const bounded=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=240
const keyValueAllowed=(property:CameraRigPropertyV1,value:number)=>property==='zoom'?value>=.25&&value<=4:value>=-20_000&&value<=20_000
const cloneAnimatable=(value:CameraNumericAnimatableV1):CameraNumericAnimatableV1=>value.kind==='constant'?constant(value.value):keyframed(value.keyframes.map(key=>Object.freeze({...key})))
const freezeState=(rig:CameraRigV1,bindings:readonly DepthBindingV1[]):CameraDepthControlStateV1=>Object.freeze({schemaVersion:'sanverse.camera-depth-control-state/v1',rig:Object.freeze({...rig,positionX:cloneAnimatable(rig.positionX),positionY:cloneAnimatable(rig.positionY),zoom:cloneAnimatable(rig.zoom)}),bindings:Object.freeze(bindings.map(binding=>Object.freeze({...binding})))})
const validateState=(state:CameraDepthControlStateV1,scene?:MotionSceneV1):CreativeOperationResultV1<CameraDepthControlStateV1>=>{
  if(!state||state.schemaVersion!=='sanverse.camera-depth-control-state/v1')return creativeOperationRefusal('CAMERA_CONTROL_STATE_INVALID','Camera/depth control state requires sanverse.camera-depth-control-state/v1.')
  const rig=validateCameraRigV1(state.rig);if(!rig.ok)return rig as CreativeOperationResultV1<CameraDepthControlStateV1>
  if(!Array.isArray(state.bindings))return creativeOperationRefusal('DEPTH_BINDING_INVALID','Camera/depth bindings must be an array.')
  if(scene){const bindings=validateDepthBindingsV1(scene,state.bindings);if(!bindings.ok)return bindings as CreativeOperationResultV1<CameraDepthControlStateV1>;return creativeOperationOk(freezeState(rig.value,bindings.value),1)}
  const ids=new Set<string>(),nodes=new Set<string>()
  for(const binding of state.bindings){if(binding.schemaVersion!=='sanverse.depth-binding/v1'||!bounded(binding.id)||!bounded(binding.nodeId)||!finite(binding.depth)||binding.depth<0||binding.depth>2||ids.has(binding.id)||nodes.has(binding.nodeId))return creativeOperationRefusal('DEPTH_BINDING_INVALID','Camera/depth bindings require unique bounded ids/nodes and depth from 0 through 2.');ids.add(binding.id);nodes.add(binding.nodeId)}
  return creativeOperationOk(freezeState(rig.value,state.bindings),1)
}
const setRigProperty=(rig:CameraRigV1,property:CameraRigPropertyV1,value:CameraNumericAnimatableV1):CameraRigV1=>Object.freeze({...rig,[property]:value}) as CameraRigV1
const upsertKey=(value:CameraNumericAnimatableV1,keyframe:MotionKeyframeV1<number>):CameraNumericAnimatableV1=>{
  const existing=value.kind==='keyframes'?[...value.keyframes]:[]
  const index=existing.findIndex(key=>key.id===keyframe.id||key.tick===keyframe.tick)
  if(index>=0)existing[index]=Object.freeze({...keyframe});else existing.push(Object.freeze({...keyframe}))
  existing.sort((a,b)=>a.tick-b.tick||a.id.localeCompare(b.id))
  return keyframed(existing)
}
export const applyCameraDepthControlV1=(state:CameraDepthControlStateV1,operation:CameraDepthControlOperationV1,scene?:MotionSceneV1):CreativeOperationResultV1<CameraDepthControlStateV1>=>{
  const valid=validateState(state,scene);if(!valid.ok)return valid
  let rig=valid.value.rig,bindings=[...valid.value.bindings]
  if(operation.type==='camera.set-position'){
    if(!finite(operation.x)||!finite(operation.y)||!keyValueAllowed('positionX',operation.x)||!keyValueAllowed('positionY',operation.y))return creativeOperationRefusal('CAMERA_POSITION_INVALID','Camera position must be finite and stay within ±20,000px.')
    rig=Object.freeze({...rig,positionX:constant(operation.x),positionY:constant(operation.y)})
  }else if(operation.type==='camera.set-zoom'){
    if(!finite(operation.zoom)||!keyValueAllowed('zoom',operation.zoom))return creativeOperationRefusal('CAMERA_ZOOM_INVALID','Camera zoom must stay within 0.25–4.')
    rig=setRigProperty(rig,'zoom',constant(operation.zoom))
  }else if(operation.type==='camera.set-keyframe'){
    const key=operation.keyframe
    if(!['positionX','positionY','zoom'].includes(operation.property)||!bounded(key.id)||!Number.isSafeInteger(key.tick)||key.tick<0||key.tick>rig.durationTicks||!finite(key.value)||!keyValueAllowed(operation.property,key.value)||!['hold','linear','bezier'].includes(key.interpolation))return creativeOperationRefusal('CAMERA_KEYFRAME_INVALID','Camera keyframe must use a supported property, exact bounded tick/value and hold/linear/bezier interpolation.')
    rig=setRigProperty(rig,operation.property,upsertKey(rig[operation.property],key))
  }else if(operation.type==='camera.remove-keyframe'){
    if(!['positionX','positionY','zoom'].includes(operation.property)||!bounded(operation.keyframeId))return creativeOperationRefusal('CAMERA_KEYFRAME_INVALID','Camera keyframe removal requires a supported property and bounded keyframe id.')
    const current=rig[operation.property];if(current.kind!=='keyframes')return creativeOperationRefusal('CAMERA_KEYFRAME_NOT_FOUND','Camera property has no keyframes to remove.')
    const remaining=current.keyframes.filter(key=>key.id!==operation.keyframeId);if(remaining.length===current.keyframes.length)return creativeOperationRefusal('CAMERA_KEYFRAME_NOT_FOUND',`Camera keyframe ${operation.keyframeId} was not found.`);if(remaining.length===0)return creativeOperationRefusal('CAMERA_KEYFRAME_LAST_REQUIRED','Removing the last keyframe would leave the camera property without exact-tick authority.')
    rig=setRigProperty(rig,operation.property,keyframed(remaining))
  }else if(operation.type==='depth.set'){
    if(!scene)return creativeOperationRefusal('DEPTH_SCENE_REQUIRED','Depth changes require the candidate MotionSceneV1 so node references can fail closed.')
    const next=bindings.filter(binding=>binding.nodeId!==operation.binding.nodeId&&binding.id!==operation.binding.id);next.push(operation.binding);const checked=validateDepthBindingsV1(scene,next);if(!checked.ok)return checked as CreativeOperationResultV1<CameraDepthControlStateV1>;bindings=[...checked.value]
  }else if(operation.type==='depth.remove'){
    if(!bounded(operation.nodeId))return creativeOperationRefusal('DEPTH_BINDING_INVALID','Depth removal requires a bounded node id.');const next=bindings.filter(binding=>binding.nodeId!==operation.nodeId);if(next.length===bindings.length)return creativeOperationRefusal('DEPTH_BINDING_NOT_FOUND',`No depth binding exists for ${operation.nodeId}.`);bindings=next
  }else{
    if(!scene)return creativeOperationRefusal('DEPTH_SCENE_REQUIRED','Depth distribution requires the candidate MotionSceneV1 so every node reference can fail closed.')
    if(!Array.isArray(operation.nodeIds)||operation.nodeIds.length<2||new Set(operation.nodeIds).size!==operation.nodeIds.length||!finite(operation.minimumDepth)||!finite(operation.maximumDepth)||operation.minimumDepth<0||operation.maximumDepth>2||operation.maximumDepth<operation.minimumDepth)return creativeOperationRefusal('DEPTH_DISTRIBUTION_INVALID','Depth distribution requires at least two unique nodes and an ordered 0–2 depth range.')
    const span=operation.maximumDepth-operation.minimumDepth,generated=operation.nodeIds.map((nodeId,index):DepthBindingV1=>Object.freeze({schemaVersion:'sanverse.depth-binding/v1',id:`depth:${nodeId}`,nodeId,depth:operation.minimumDepth+span*(index/(operation.nodeIds.length-1))}));const preserved=bindings.filter(binding=>!operation.nodeIds.includes(binding.nodeId));const checked=validateDepthBindingsV1(scene,[...preserved,...generated]);if(!checked.ok)return checked as CreativeOperationResultV1<CameraDepthControlStateV1>;bindings=[...checked.value]
  }
  const next=freezeState(rig,bindings),checked=validateState(next,scene);return checked.ok?creativeOperationOk(checked.value,1):checked
}
