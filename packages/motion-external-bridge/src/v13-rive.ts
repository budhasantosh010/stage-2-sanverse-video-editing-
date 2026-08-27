import { creativeRefusal,creativeValidationOk,type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { constant,createMotionScene,keyframed,nodeBase,validateMotionScene,type Animatable,type MotionKeyframeV1,type MotionNodeV1,type MotionSceneV1 } from '@sanverse/motion-graph'

export type RiveBridgeDecisionV1='native-materialize'|'reject-runtime-required'
export interface RiveSubsetKeyframeV1 { readonly id:string; readonly tick:number; readonly value:number; readonly interpolation:'hold'|'linear'|'bezier'; readonly easing?:readonly [number,number,number,number] }
export interface RiveSubsetShapeV1 {
  readonly id:string
  readonly name?:string
  readonly type:'rect'
  readonly x:number
  readonly y:number
  readonly width:number
  readonly height:number
  readonly fill:string
  readonly radius?:number
  readonly opacity?:number
  readonly xKeyframes?:readonly RiveSubsetKeyframeV1[]
  readonly yKeyframes?:readonly RiveSubsetKeyframeV1[]
  readonly opacityKeyframes?:readonly RiveSubsetKeyframeV1[]
}
export interface RiveSubsetDocumentV1 {
  readonly schemaVersion:'sanverse.rive-subset/v1'
  readonly artboardId:string
  readonly width:number
  readonly height:number
  readonly durationTicks:number
  readonly stateMachines:readonly []
  readonly shapes:readonly RiveSubsetShapeV1[]
}
export interface RiveBridgeInspectionV1 {
  readonly schemaVersion:'sanverse.rive-bridge-inspection/v1'
  readonly decision:RiveBridgeDecisionV1
  readonly deterministic:boolean
  readonly directSeekSafe:boolean
  readonly editability:'high'|'none'
  readonly reasons:readonly string[]
  readonly document?:RiveSubsetDocumentV1
}

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const positive=(value:unknown):value is number=>finite(value)&&value>0
const bounded=(value:unknown,max=240):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max
const safeTick=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0
const color=(value:unknown):value is string=>typeof value==='string'&&/^(?:#[0-9a-f]{3,8}|transparent)$/iu.test(value)
const keyframesValid=(keys:unknown,durationTicks:number,minimum:number,maximum:number):keys is readonly RiveSubsetKeyframeV1[]=>{
  if(keys===undefined)return true
  if(!Array.isArray(keys)||keys.length===0||keys.length>512)return false
  let previous=-1
  for(const key of keys){
    if(!key||typeof key!=='object'||Array.isArray(key))return false
    const candidate=key as RiveSubsetKeyframeV1
    if(!bounded(candidate.id)||!safeTick(candidate.tick)||candidate.tick>durationTicks||candidate.tick<=previous||!finite(candidate.value)||candidate.value<minimum||candidate.value>maximum||!['hold','linear','bezier'].includes(candidate.interpolation))return false
    if(candidate.easing!==undefined&&(!Array.isArray(candidate.easing)||candidate.easing.length!==4||candidate.easing.some(value=>!finite(value))))return false
    previous=candidate.tick
  }
  return true
}
const parseJson=(source:string):CreativeValidationResultV1<unknown>=>{try{return creativeValidationOk(JSON.parse(source))}catch{return creativeRefusal('RIVE_SOURCE_INVALID','Rive V1 source must be sanverse.rive-subset/v1 JSON exported from the bounded adapter. Raw .riv binary is not silently decoded.') }}

export const inspectRiveBridgeV1=(source:string|Uint8Array):CreativeValidationResultV1<RiveBridgeInspectionV1>=>{
  if(source instanceof Uint8Array)return creativeValidationOk(Object.freeze({schemaVersion:'sanverse.rive-bridge-inspection/v1',decision:'reject-runtime-required',deterministic:false,directSeekSafe:false,editability:'none',reasons:Object.freeze(['Raw .riv binary requires an external Rive runtime. V1.3 does not claim that runtime as Sanverse render authority. Export the bounded deterministic subset or keep the asset unsupported.'])}))
  const parsed=parseJson(source);if(!parsed.ok)return parsed as CreativeValidationResultV1<RiveBridgeInspectionV1>
  if(!parsed.value||typeof parsed.value!=='object'||Array.isArray(parsed.value))return creativeRefusal('RIVE_SOURCE_INVALID','Rive subset root must be an object.')
  const document=parsed.value as RiveSubsetDocumentV1
  if(document.schemaVersion!=='sanverse.rive-subset/v1'||!bounded(document.artboardId)||!positive(document.width)||!positive(document.height)||!Number.isSafeInteger(document.durationTicks)||document.durationTicks<=0)return creativeRefusal('RIVE_SOURCE_INVALID','Rive subset requires the V1 schema, bounded artboard id, positive dimensions and exact positive durationTicks.')
  if(!Array.isArray(document.stateMachines)||document.stateMachines.length!==0)return creativeRefusal('RIVE_STATE_MACHINE_UNSUPPORTED','Rive state machines, events and autonomous runtime inputs are outside the deterministic V1.3 subset.')
  if(!Array.isArray(document.shapes)||document.shapes.length===0||document.shapes.length>256)return creativeRefusal('RIVE_SOURCE_INVALID','Rive subset requires 1–256 supported shapes.')
  const ids=new Set<string>()
  for(const shape of document.shapes){
    if(!shape||typeof shape!=='object'||shape.type!=='rect'||!bounded(shape.id)||ids.has(shape.id)||!finite(shape.x)||!finite(shape.y)||!positive(shape.width)||!positive(shape.height)||!color(shape.fill)||!finite(shape.opacity??1)||(shape.opacity??1)<0||(shape.opacity??1)>1||!finite(shape.radius??0)||(shape.radius??0)<0)return creativeRefusal('RIVE_SOURCE_INVALID','Rive V1 shapes require unique ids, rectangle geometry, bounded color/opacity and finite coordinates.')
    if(!keyframesValid(shape.xKeyframes,document.durationTicks,-100_000,100_000)||!keyframesValid(shape.yKeyframes,document.durationTicks,-100_000,100_000)||!keyframesValid(shape.opacityKeyframes,document.durationTicks,0,1))return creativeRefusal('RIVE_ANIMATION_UNSUPPORTED','Rive V1 accepts only bounded exact-tick x/y/opacity keyframes with hold/linear/bezier interpolation.')
    ids.add(shape.id)
  }
  const frozen=Object.freeze({...document,stateMachines:Object.freeze([]),shapes:Object.freeze(document.shapes.map(shape=>Object.freeze({...shape,...(shape.xKeyframes?{xKeyframes:Object.freeze(shape.xKeyframes.map((key:RiveSubsetKeyframeV1)=>Object.freeze({...key})))}:{}),...(shape.yKeyframes?{yKeyframes:Object.freeze(shape.yKeyframes.map((key:RiveSubsetKeyframeV1)=>Object.freeze({...key})))}:{}),...(shape.opacityKeyframes?{opacityKeyframes:Object.freeze(shape.opacityKeyframes.map((key:RiveSubsetKeyframeV1)=>Object.freeze({...key})))}:{})})))}) as RiveSubsetDocumentV1
  return creativeValidationOk(Object.freeze({schemaVersion:'sanverse.rive-bridge-inspection/v1',decision:'native-materialize',deterministic:true,directSeekSafe:true,editability:'high',reasons:Object.freeze(['Deterministic subset contains no state machines, events, clocks, network access or runtime-owned state.','Supported exact-tick vector properties materialize into ordinary Motion Graph nodes/keyframes.']),document:frozen}))
}

const normalizedKeys=(keys:readonly RiveSubsetKeyframeV1[]|undefined,normalize:(value:number)=>number,fallback:number):Animatable<number>=>keys&&keys.length?keyframed(keys.map(key=>Object.freeze({id:key.id,tick:key.tick,value:normalize(key.value),interpolation:key.interpolation,...(key.easing?{easing:key.easing}:{})}) as MotionKeyframeV1<number>)):constant(normalize(fallback))
export const materializeRiveSubsetV1=(assetId:string,source:string):CreativeValidationResultV1<MotionSceneV1>=>{
  const inspection=inspectRiveBridgeV1(source);if(!inspection.ok)return inspection as CreativeValidationResultV1<MotionSceneV1>
  if(inspection.value.decision!=='native-materialize'||!inspection.value.document)return creativeRefusal('RIVE_RUNTIME_REQUIRED','This Rive source requires a runtime wrapper that V1.3 intentionally does not provide.')
  const document=inspection.value.document,rootId=`${assetId}::root`,nodes:Record<string,MotionNodeV1>={},children:string[]=[]
  for(const shape of document.shapes){
    const nodeId=`${assetId}::${shape.id}`,base=nodeBase(nodeId,shape.name??shape.id,rootId)
    const xNorm=(value:number)=>value/document.width-.5,yNorm=(value:number)=>value/document.height-.5
    nodes[nodeId]=Object.freeze({...base,type:'shape' as const,shape:(shape.radius??0)>0?'rounded-rectangle' as const:'rectangle' as const,transform:Object.freeze({...base.transform,positionX:normalizedKeys(shape.xKeyframes,xNorm,shape.x),positionY:normalizedKeys(shape.yKeyframes,yNorm,shape.y)}),opacity:normalizedKeys(shape.opacityKeyframes,value=>value,shape.opacity??1),width:constant(shape.width/document.width),height:constant(shape.height/document.height),fillColor:constant(shape.fill),strokeColor:constant('transparent'),strokeWidth:constant(0),radius:constant(Math.min(.5,(shape.radius??0)/Math.max(1,Math.min(shape.width,shape.height))))})
    children.push(nodeId)
  }
  nodes[rootId]=Object.freeze({...nodeBase(rootId,'Rive subset',null),type:'group' as const,childIds:Object.freeze(children)})
  const scene=createMotionScene({componentId:`external.${assetId}`,componentVersion:1,rootNodeId:rootId,nodes:Object.freeze(nodes),semanticParts:Object.freeze(children.map((nodeId,index)=>Object.freeze({id:`${assetId}::part:${index}`,label:nodes[nodeId]?.name??nodeId,role:'decoration' as const,nodeIds:Object.freeze([nodeId])}))),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5'])})
  const valid=validateMotionScene(scene);return valid.ok?creativeValidationOk(valid.value):creativeRefusal('RIVE_MATERIALIZATION_INVALID','Rive subset did not materialize to a valid MotionSceneV1.',valid.issues)
}
