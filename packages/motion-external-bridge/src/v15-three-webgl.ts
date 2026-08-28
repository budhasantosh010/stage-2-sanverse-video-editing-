import { creativeRefusal, creativeValidationOk, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { constant, createMotionScene, keyframed, nodeBase, validateMotionScene, type MotionNodeV1, type MotionSceneV1 } from '@sanverse/motion-graph'

export const THREE_CONVERSION_STRATEGIES_V15 = Object.freeze(['NATIVE_MATERIALIZE','EXPERT_3D_OR_CUSTOM_NODE','FLATTEN','REJECT'] as const)
export type ThreeConversionStrategyV15 = (typeof THREE_CONVERSION_STRATEGIES_V15)[number]

export interface ThreeWebglInspectionV15 {
  readonly schemaVersion: 'sanverse.three-webgl-inspection/v1'
  readonly strategy: ThreeConversionStrategyV15
  readonly deterministic: boolean
  readonly directSeekSafe: boolean
  readonly sceneObjects: number
  readonly geometryKinds: readonly string[]
  readonly materialKinds: readonly string[]
  readonly textureCount: number
  readonly cameraCount: number
  readonly lightCount: number
  readonly animationClipCount: number
  readonly customShaderCount: number
  readonly runtimeDependencies: readonly string[]
  readonly networkRequired: boolean
  readonly wallClockUsed: boolean
  readonly uncontrolledRandomUsed: boolean
  readonly reasons: readonly string[]
}

type ThreeSubsetKeyframeV15 = Readonly<{ tick:number; x?:number; y?:number; scale?:number; rotationDeg?:number; opacity?:number }>
type ThreeSubsetObjectV15 = Readonly<{
  id:string
  geometry:'plane'|'circle'
  material:'basic'|'lambert'
  color:string
  x:number
  y:number
  width:number
  height:number
  z?:number
  opacity?:number
  textureHash?:string
  keyframes?:readonly ThreeSubsetKeyframeV15[]
}>
type ThreeSubsetDocumentV15 = Readonly<{
  schemaVersion:'sanverse.three-subset/v1'
  width:number
  height:number
  durationTicks:number
  objects:readonly ThreeSubsetObjectV15[]
  cameras?:readonly Readonly<{id:string;kind:'perspective'|'orthographic'}>[]
  lights?:readonly Readonly<{id:string;kind:'ambient'|'directional'|'point'}>[]
}>

const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const safePositive=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>0
const boundedId=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=180
const safeColor=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=128

const sourceInspection=(source:string):ThreeWebglInspectionV15=>{
  const dependencies=[...new Set([...source.matchAll(/(?:from\s+|require\s*\(\s*)['"]([^'"]+)['"]/gu)].map(match=>match[1]!).filter(Boolean))]
  const network=/(?:fetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\/|\/\/[^\s'"`]+)/u.test(source)
  const wallClock=/(?:Date\.now|performance\.now|requestAnimationFrame|setInterval|setTimeout)/u.test(source)
  const random=/Math\.random/u.test(source)
  const customShaders=(source.match(/\b(?:ShaderMaterial|RawShaderMaterial|glsl|wgsl)\b/gu)??[]).length
  const geometryKinds=[...new Set([...source.matchAll(/\b([A-Z][A-Za-z0-9]*(?:Geometry|BufferGeometry))\b/gu)].map(match=>match[1]!))]
  const materialKinds=[...new Set([...source.matchAll(/\b(Mesh[A-Z][A-Za-z0-9]*Material|ShaderMaterial|RawShaderMaterial)\b/gu)].map(match=>match[1]!))]
  const sceneObjects=(source.match(/\bnew\s+THREE\.(?:Mesh|Group|Sprite|Points)\b/gu)??[]).length
  const cameras=(source.match(/\bnew\s+THREE\.(?:PerspectiveCamera|OrthographicCamera)\b/gu)??[]).length
  const lights=(source.match(/\bnew\s+THREE\.(?:AmbientLight|DirectionalLight|PointLight|SpotLight)\b/gu)??[]).length
  const animations=(source.match(/\b(?:AnimationClip|AnimationMixer)\b/gu)??[]).length
  const textures=(source.match(/\b(?:TextureLoader|DataTexture|CanvasTexture|VideoTexture)\b/gu)??[]).length
  const unsafe=network||wallClock||random
  const reasons:string[]=[]
  if(network)reasons.push('External network behavior is not permitted inside canonical render execution.')
  if(wallClock)reasons.push('Wall-clock/requestAnimationFrame timing is not canonical exact-tick authority.')
  if(random)reasons.push('Math.random is uncontrolled and cannot satisfy deterministic random seek.')
  if(customShaders)reasons.push('Custom shader source is not automatically accepted by the bounded V1.4 shader runtime.')
  reasons.push('Arbitrary Three/WebGL source is inspected but never executed by the bridge.')
  return Object.freeze({schemaVersion:'sanverse.three-webgl-inspection/v1',strategy:unsafe?'REJECT':'FLATTEN',deterministic:false,directSeekSafe:false,sceneObjects,geometryKinds:Object.freeze(geometryKinds),materialKinds:Object.freeze(materialKinds),textureCount:textures,cameraCount:cameras,lightCount:lights,animationClipCount:animations,customShaderCount:customShaders,runtimeDependencies:Object.freeze(dependencies),networkRequired:network,wallClockUsed:wallClock,uncontrolledRandomUsed:random,reasons:Object.freeze(reasons)})
}

const parseSubset=(source:string):CreativeValidationResultV1<ThreeSubsetDocumentV15>=>{
  let parsed:unknown
  try{parsed=JSON.parse(source)}catch{return creativeRefusal('THREE_SUBSET_INVALID','Three/WebGL native materialization requires sanverse.three-subset/v1 JSON or a separately classified source.')}
  if(!record(parsed)||parsed.schemaVersion!=='sanverse.three-subset/v1'||!finite(parsed.width)||!finite(parsed.height)||Number(parsed.width)<=0||Number(parsed.height)<=0||!safePositive(parsed.durationTicks)||!Array.isArray(parsed.objects)||parsed.objects.length>512)return creativeRefusal('THREE_SUBSET_INVALID','Three subset requires finite dimensions, positive durationTicks and at most 512 objects.')
  const ids=new Set<string>()
  for(const [index,raw] of parsed.objects.entries()){
    if(!record(raw)||!boundedId(raw.id)||ids.has(String(raw.id))||!['plane','circle'].includes(String(raw.geometry))||!['basic','lambert'].includes(String(raw.material))||!safeColor(raw.color)||!finite(raw.x)||!finite(raw.y)||!finite(raw.width)||!finite(raw.height)||Number(raw.width)<=0||Number(raw.height)<=0)return creativeRefusal('THREE_SUBSET_INVALID',`Three subset object ${index} is outside the bounded native contract.`)
    ids.add(String(raw.id))
    if(raw.textureHash!==undefined&&(!boundedId(raw.textureHash)||/[:/\\]/u.test(String(raw.textureHash))))return creativeRefusal('THREE_SUBSET_INVALID',`Three subset texture ${index} must be an opaque content hash, never a path/URL.`)
    if(raw.keyframes!==undefined){
      if(!Array.isArray(raw.keyframes)||raw.keyframes.length>128)return creativeRefusal('THREE_SUBSET_INVALID',`Three subset object ${index} has too many keyframes.`)
      let previous=-1
      for(const key of raw.keyframes){if(!record(key)||!Number.isSafeInteger(key.tick)||Number(key.tick)<0||Number(key.tick)>Number(parsed.durationTicks)||Number(key.tick)<=previous||['x','y','scale','rotationDeg','opacity'].some(name=>key[name]!==undefined&&!finite(key[name])))return creativeRefusal('THREE_SUBSET_INVALID',`Three subset object ${index} has invalid exact-tick keyframes.`);previous=Number(key.tick)}
    }
  }
  return creativeValidationOk(parsed as unknown as ThreeSubsetDocumentV15)
}

export const inspectThreeWebglV15=(bytes:string|Uint8Array):ThreeWebglInspectionV15=>{
  if(typeof bytes!=='string')return Object.freeze({schemaVersion:'sanverse.three-webgl-inspection/v1',strategy:'REJECT',deterministic:false,directSeekSafe:false,sceneObjects:0,geometryKinds:Object.freeze([]),materialKinds:Object.freeze([]),textureCount:0,cameraCount:0,lightCount:0,animationClipCount:0,customShaderCount:0,runtimeDependencies:Object.freeze([]),networkRequired:false,wallClockUsed:false,uncontrolledRandomUsed:false,reasons:Object.freeze(['Binary Three/WebGL payloads cannot be executed or guessed by the assisted V1.5 bridge.'])})
  const parsed=parseSubset(bytes)
  if(!parsed.ok)return sourceInspection(bytes)
  const document=parsed.value
  const hasDepth=document.objects.some(object=>Math.abs(object.z??0)>1e-9)
  const textureCount=document.objects.filter(object=>Boolean(object.textureHash)).length
  const cameraCount=document.cameras?.length??0,lightCount=document.lights?.length??0
  const strategy:ThreeConversionStrategyV15=hasDepth||textureCount>0||cameraCount>0||lightCount>0?'FLATTEN':'NATIVE_MATERIALIZE'
  return Object.freeze({schemaVersion:'sanverse.three-webgl-inspection/v1',strategy,deterministic:true,directSeekSafe:true,sceneObjects:document.objects.length,geometryKinds:Object.freeze([...new Set(document.objects.map(object=>object.geometry))]),materialKinds:Object.freeze([...new Set(document.objects.map(object=>object.material))]),textureCount,cameraCount,lightCount,animationClipCount:document.objects.filter(object=>(object.keyframes?.length??0)>0).length,customShaderCount:0,runtimeDependencies:Object.freeze([]),networkRequired:false,wallClockUsed:false,uncontrolledRandomUsed:false,reasons:Object.freeze(strategy==='NATIVE_MATERIALIZE'?['Bounded plane/circle subset maps losslessly to native Motion Graph shapes and exact-tick keyframes.']:['Depth, textures, camera or lighting exceed the native V1.5 bridge; flatten or a future explicitly supported 3D expert runtime is required.'])})
}

const anim=(keys:readonly ThreeSubsetKeyframeV15[]|undefined,property:'x'|'y'|'scale'|'rotationDeg'|'opacity',fallback:number,duration:number)=>{
  if(!keys?.some(key=>key[property]!==undefined))return constant(fallback)
  const values:Array<Readonly<{id:string;tick:number;value:number;interpolation:'linear'|'hold'}>>=keys.filter(key=>key[property]!==undefined).map((key,index)=>Object.freeze({id:`three:${property}:${index}`,tick:key.tick,value:Number(key[property]),interpolation:'linear' as const}))
  if(values[0]?.tick!==0)values.unshift(Object.freeze({id:`three:${property}:base`,tick:0,value:fallback,interpolation:'linear' as const}))
  if(values.at(-1)?.tick!==duration)values.push(Object.freeze({id:`three:${property}:end`,tick:duration,value:values.at(-1)?.value??fallback,interpolation:'hold' as const}))
  return keyframed(values)
}

export const materializeThreeWebglSubsetV15=(assetId:string,bytes:string):CreativeValidationResultV1<MotionSceneV1>=>{
  const inspection=inspectThreeWebglV15(bytes)
  if(inspection.strategy!=='NATIVE_MATERIALIZE')return creativeRefusal('THREE_NATIVE_MATERIALIZATION_UNAVAILABLE',inspection.reasons.join(' '),inspection)
  const parsed=parseSubset(bytes);if(!parsed.ok)return parsed as CreativeValidationResultV1<MotionSceneV1>
  const doc=parsed.value,rootId=`${assetId}::root`,nodes:Record<string,MotionNodeV1>={},childIds:string[]=[]
  for(const object of doc.objects){const id=`${assetId}::${object.id}`,base=nodeBase(id,object.id,rootId),scale=anim(object.keyframes,'scale',1,doc.durationTicks);nodes[id]=Object.freeze({...base,type:'shape' as const,shape:object.geometry==='circle'?'ellipse' as const:'rectangle' as const,opacity:anim(object.keyframes,'opacity',object.opacity??1,doc.durationTicks),transform:Object.freeze({...base.transform,positionX:anim(object.keyframes,'x',object.x,doc.durationTicks),positionY:anim(object.keyframes,'y',object.y,doc.durationTicks),scaleX:scale,scaleY:scale,rotationDeg:anim(object.keyframes,'rotationDeg',0,doc.durationTicks)}),width:constant(object.width),height:constant(object.height),fillColor:constant(object.color),strokeColor:constant('transparent'),strokeWidth:constant(0),radius:constant(object.geometry === 'circle' ? 0.5 : 0)});childIds.push(id)}
  nodes[rootId]=Object.freeze({...nodeBase(rootId,'Three/WebGL native subset',null),type:'group' as const,childIds:Object.freeze(childIds)})
  const scene=createMotionScene({componentId:`external.${assetId.replace(/[^a-zA-Z0-9.-]+/gu,'-')}`,componentVersion:1,rootNodeId:rootId,nodes:Object.freeze(nodes),semanticParts:Object.freeze(childIds.map((nodeId,index)=>Object.freeze({id:`${assetId}::part:${index}`,label:nodeId,role:'decoration' as const,nodeIds:Object.freeze([nodeId])}))),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5'])})
  const valid=validateMotionScene(scene);return valid.ok?creativeValidationOk(valid.value):creativeRefusal('THREE_NATIVE_MATERIALIZATION_INVALID','Three subset did not satisfy canonical MotionSceneV1.',valid.issues)
}
