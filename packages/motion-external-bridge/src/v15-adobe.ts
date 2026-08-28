import { creativeRefusal, creativeValidationOk, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { constant, createMotionScene, keyframed, nodeBase, validateMotionScene, type Animatable, type MotionExposureV1, type MotionNodeV1, type MotionNodePropertyNameV1, type MotionSceneV1 } from '@sanverse/motion-graph'

export const ADOBE_FEATURE_CLASSIFICATIONS_V15 = Object.freeze(['NATIVE','TRANSLATABLE','EXPERT','FLATTENABLE','UNSUPPORTED'] as const)
export type AdobeFeatureClassificationV15 = (typeof ADOBE_FEATURE_CLASSIFICATIONS_V15)[number]

export interface AdobeFeatureInspectionV15 {
  readonly path: string
  readonly feature: string
  readonly classification: AdobeFeatureClassificationV15
  readonly reason: string
}
export interface AdobeAssistedInspectionV15 {
  readonly schemaVersion: 'sanverse.adobe-assisted-inspection/v1'
  readonly sourceKind: 'aep'|'mogrt'
  readonly extractionRequired: boolean
  readonly deterministic: boolean
  readonly directSeekSafe: boolean
  readonly nativeMaterializationAvailable: boolean
  readonly features: readonly AdobeFeatureInspectionV15[]
  readonly controls: readonly Readonly<{id:string;type:'text'|'color'|'number'|'select'|'media';classification:AdobeFeatureClassificationV15}>[]
  readonly warnings: readonly string[]
}

type AdobeKeyframeV15=Readonly<{tick:number;value:number|string;interpolation?:'hold'|'linear'|'bezier'}>
type AdobeAnimValueV15=number|string|Readonly<{keyframes:readonly AdobeKeyframeV15[]}>
type AdobeLayerV15=Readonly<{
  id:string
  type:'text'|'shape'|'media'|'precomp'
  name?:string
  text?:AdobeAnimValueV15
  shape?:'rectangle'|'rounded-rectangle'|'ellipse'
  fill?:AdobeAnimValueV15
  x?:AdobeAnimValueV15
  y?:AdobeAnimValueV15
  scale?:AdobeAnimValueV15
  rotationDeg?:AdobeAnimValueV15
  opacity?:AdobeAnimValueV15
  width?:number
  height?:number
  mediaRef?:string
  masks?:readonly unknown[]
  mattes?:readonly unknown[]
  effects?:readonly Readonly<{name:string;parameters?:Readonly<Record<string,unknown>>}>[]
  expressions?:Readonly<Record<string,string>>
}>
type AdobeControlV15=Readonly<{id:string;label:string;type:'text'|'color'|'number'|'select'|'media';layerId:string;property:string;options?:readonly string[]}>
type AdobeExtractDocumentV15=Readonly<{
  schemaVersion:'sanverse.adobe-extract/v1'
  sourceKind:'aep'|'mogrt'
  width:number
  height:number
  durationTicks:number
  layers:readonly AdobeLayerV15[]
  controls?:readonly AdobeControlV15[]
}>

const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const bounded=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=240
const parse=(source:string,kind:'aep'|'mogrt'):CreativeValidationResultV1<AdobeExtractDocumentV15>=>{
  let raw:unknown
  try{raw=JSON.parse(source)}catch{return creativeRefusal('ADOBE_EXTRACTION_REQUIRED',`${kind.toUpperCase()} assisted import requires a sanverse.adobe-extract/v1 manifest produced by a trusted extractor; raw project/template bytes are never executed or guessed.`)}
  if(!record(raw)||raw.schemaVersion!=='sanverse.adobe-extract/v1'||raw.sourceKind!==kind||!finite(raw.width)||Number(raw.width)<=0||!finite(raw.height)||Number(raw.height)<=0||!Number.isSafeInteger(raw.durationTicks)||Number(raw.durationTicks)<=0||!Array.isArray(raw.layers)||raw.layers.length>512)return creativeRefusal('ADOBE_EXTRACT_INVALID','Adobe assisted manifest is outside the bounded extraction contract.')
  const ids=new Set<string>()
  for(const [index,layer] of raw.layers.entries()){
    if(!record(layer)||!bounded(layer.id)||ids.has(String(layer.id))||!['text','shape','media','precomp'].includes(String(layer.type)))return creativeRefusal('ADOBE_EXTRACT_INVALID',`Adobe layer ${index} is invalid or duplicated.`)
    ids.add(String(layer.id))
    if(layer.expressions!==undefined&&(!record(layer.expressions)||Object.values(layer.expressions).some(value=>typeof value!=='string'||value.length>2048)))return creativeRefusal('ADOBE_EXTRACT_INVALID',`Adobe expressions for ${String(layer.id)} are invalid.`)
  }
  if(raw.controls!==undefined&&(!Array.isArray(raw.controls)||raw.controls.length>128||raw.controls.some(control=>!record(control)||!bounded(control.id)||!bounded(control.label)||!['text','color','number','select','media'].includes(String(control.type))||!bounded(control.layerId)||!bounded(control.property))))return creativeRefusal('ADOBE_EXTRACT_INVALID','MOGRT/control metadata is outside the bounded contract.')
  return creativeValidationOk(raw as unknown as AdobeExtractDocumentV15)
}

const expressionClass=(source:string):AdobeFeatureInspectionV15=>{
  const trimmed=source.trim()
  if(/^value$/u.test(trimmed))return Object.freeze({path:'expression',feature:'expression:value',classification:'TRANSLATABLE',reason:'Identity expression has proven semantics and can be removed during materialization.'})
  if(/^clamp\(value\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\)$/u.test(trimmed))return Object.freeze({path:'expression',feature:'expression:clamp',classification:'TRANSLATABLE',reason:'Bounded clamp(value,min,max) has explicit deterministic semantics.'})
  return Object.freeze({path:'expression',feature:'expression:unknown',classification:'UNSUPPORTED',reason:'Unknown After Effects expression code is never executed blindly.'})
}

export const inspectAdobeAssistedBridgeV15=(sourceKind:'aep'|'mogrt',bytes:string|Uint8Array):AdobeAssistedInspectionV15=>{
  if(typeof bytes!=='string')return Object.freeze({schemaVersion:'sanverse.adobe-assisted-inspection/v1',sourceKind,extractionRequired:true,deterministic:false,directSeekSafe:false,nativeMaterializationAvailable:false,features:Object.freeze([{path:'$',feature:'binary-project',classification:'UNSUPPORTED' as const,reason:'Raw Adobe project/template bytes require trusted extraction before inspection.'}]),controls:Object.freeze([]),warnings:Object.freeze(['No Adobe runtime or expression engine is embedded in Sanverse.'])})
  const parsed=parse(bytes,sourceKind)
  if(!parsed.ok)return Object.freeze({schemaVersion:'sanverse.adobe-assisted-inspection/v1',sourceKind,extractionRequired:true,deterministic:false,directSeekSafe:false,nativeMaterializationAvailable:false,features:Object.freeze([{path:'$',feature:'unextracted-source',classification:'UNSUPPORTED' as const,reason:parsed.refusal.message}]),controls:Object.freeze([]),warnings:Object.freeze(['Run the supported extraction step first; the bridge does not guess raw AEP/MOGRT internals.'])})
  const document=parsed.value,features:AdobeFeatureInspectionV15[]=[]
  for(const [index,layer] of document.layers.entries()){
    const base=`layers[${index}]`
    const classification:AdobeFeatureClassificationV15=layer.type==='text'||layer.type==='shape'?'NATIVE':layer.type==='media'?'TRANSLATABLE':'FLATTENABLE'
    features.push(Object.freeze({path:`${base}.type`,feature:`layer:${layer.type}`,classification,reason:layer.type==='text'||layer.type==='shape'?'Layer maps to ordinary Motion Graph content.':layer.type==='media'?'Media remains a referenced production/project asset; it is not embedded blindly.':'Nested precomp requires flattening or a future proven translator.'}))
    if(layer.masks?.length)features.push(Object.freeze({path:`${base}.masks`,feature:'masks',classification:'TRANSLATABLE',reason:'Mask metadata is inspectable; only supported mask shapes can materialize natively.'}))
    if(layer.mattes?.length)features.push(Object.freeze({path:`${base}.mattes`,feature:'mattes',classification:'TRANSLATABLE',reason:'Matte metadata can map to canonical C8 when the extracted relationship is supported.'}))
    for(const [effectIndex,effect] of (layer.effects??[]).entries())features.push(Object.freeze({path:`${base}.effects[${effectIndex}]`,feature:`effect:${effect.name}`,classification:'FLATTENABLE',reason:'Arbitrary Adobe effects are not claimed as native without a proven semantic mapper.'}))
    for(const [property,expression] of Object.entries(layer.expressions??{})){const result=expressionClass(expression);features.push(Object.freeze({...result,path:`${base}.expressions.${property}`}))}
  }
  const controls=Object.freeze((document.controls??[]).map(control=>Object.freeze({id:control.id,type:control.type,classification:(control.type==='media'?'TRANSLATABLE':'NATIVE') as AdobeFeatureClassificationV15})))
  const unsupported=features.some(feature=>feature.classification==='UNSUPPORTED')
  const flatten=features.some(feature=>feature.classification==='FLATTENABLE')
  return Object.freeze({schemaVersion:'sanverse.adobe-assisted-inspection/v1',sourceKind,extractionRequired:false,deterministic:!unsupported,directSeekSafe:!unsupported,nativeMaterializationAvailable:!unsupported&&!flatten&&document.layers.every(layer=>layer.type==='text'||layer.type==='shape'),features:Object.freeze(features),controls,warnings:Object.freeze(['Assisted V1.5 support is extraction-driven and intentionally not universal Adobe compatibility.','Commercial/template redistribution rights remain separate from runtime/project-use rights.'])})
}

const propertyAnim=(value:AdobeAnimValueV15|undefined,fallback:number|string,duration:number):Animatable<number|string>=>{
  if(value===undefined)return constant(fallback)
  if(typeof value==='number'||typeof value==='string')return constant(value)
  const keys=value.keyframes
  if(!Array.isArray(keys)||keys.length===0)return constant(fallback)
  const mapped=keys.map((key,index)=>Object.freeze({id:`adobe:k${index}`,tick:key.tick,value:key.value,interpolation:key.interpolation??'linear'}))
  if(mapped.some((key,index)=>!Number.isSafeInteger(key.tick)||key.tick<0||key.tick>duration||(index>0&&key.tick<=mapped[index-1]!.tick)))throw new RangeError('Adobe extracted keyframes must use strictly increasing canonical ticks.')
  return keyframed(mapped)
}
const numAnim=(value:AdobeAnimValueV15|undefined,fallback:number,duration:number):Animatable<number>=>{const resolved=propertyAnim(value,fallback,duration);if(resolved.kind==='constant'&&typeof resolved.value!=='number')throw new RangeError('Adobe numeric property resolved to non-number.');if(resolved.kind==='keyframes'&&resolved.keyframes.some(key=>typeof key.value!=='number'))throw new RangeError('Adobe numeric keyframes must contain numbers.');return resolved as Animatable<number>}
const strAnim=(value:AdobeAnimValueV15|undefined,fallback:string,duration:number):Animatable<string>=>{const resolved=propertyAnim(value,fallback,duration);if(resolved.kind==='constant'&&typeof resolved.value!=='string')throw new RangeError('Adobe string property resolved to non-string.');if(resolved.kind==='keyframes'&&resolved.keyframes.some(key=>typeof key.value!=='string'))throw new RangeError('Adobe string keyframes must contain strings.');return resolved as Animatable<string>}

const propertyForControl=(layer:AdobeLayerV15,property:string):MotionNodePropertyNameV1|null=>{
  if(property==='text'&&layer.type==='text')return 'text.text'
  if(property==='fill')return layer.type==='text'?'text.fillColor':layer.type==='shape'?'shape.fillColor':null
  if(property==='x')return 'transform.positionX';if(property==='y')return 'transform.positionY';if(property==='scale')return 'transform.scaleX';if(property==='rotationDeg')return 'transform.rotationDeg';if(property==='opacity')return 'opacity'
  return null
}

export const materializeAdobeAssistedBridgeV15=(assetId:string,sourceKind:'aep'|'mogrt',bytes:string):CreativeValidationResultV1<MotionSceneV1>=>{
  const inspection=inspectAdobeAssistedBridgeV15(sourceKind,bytes)
  if(!inspection.nativeMaterializationAvailable)return creativeRefusal('ADOBE_NATIVE_MATERIALIZATION_UNAVAILABLE','Adobe assisted manifest contains unsupported/flattenable features; no silent approximation is allowed.',inspection)
  const parsed=parse(bytes,sourceKind);if(!parsed.ok)return parsed as CreativeValidationResultV1<MotionSceneV1>
  const doc=parsed.value,rootId=`${assetId}::root`,nodes:Record<string,MotionNodeV1>={},childIds:string[]=[]
  try{
    for(const layer of doc.layers){
      if(layer.type!=='text'&&layer.type!=='shape')return creativeRefusal('ADOBE_NATIVE_MATERIALIZATION_UNAVAILABLE',`Layer ${layer.id} requires non-native handling.`)
      for(const expression of Object.values(layer.expressions??{}))if(expressionClass(expression).classification==='UNSUPPORTED')return creativeRefusal('ADOBE_EXPRESSION_UNSUPPORTED',`Layer ${layer.id} contains an unknown expression.`)
      const id=`${assetId}::${layer.id}`,base=nodeBase(id,layer.name??layer.id,rootId),scale=numAnim(layer.scale,1,doc.durationTicks),transform=Object.freeze({...base.transform,positionX:numAnim(layer.x,0,doc.durationTicks),positionY:numAnim(layer.y,0,doc.durationTicks),scaleX:scale,scaleY:scale,rotationDeg:numAnim(layer.rotationDeg,0,doc.durationTicks)})
      if(layer.type==='text')nodes[id]=Object.freeze({...base,type:'text' as const,opacity:numAnim(layer.opacity,1,doc.durationTicks),transform,text:strAnim(layer.text,'',doc.durationTicks),fillColor:strAnim(layer.fill,'#ffffff',doc.durationTicks),fontFamily:'Inter',fontSize:constant(48),fontWeight:constant(600),textAlign:'left' as const})
      else nodes[id]=Object.freeze({...base,type:'shape' as const,opacity:numAnim(layer.opacity,1,doc.durationTicks),transform,shape:layer.shape??'rectangle',width:constant(layer.width??.25),height:constant(layer.height??.14),fillColor:strAnim(layer.fill,'#ffffff',doc.durationTicks),strokeColor:constant('transparent'),strokeWidth:constant(0),radius:constant(layer.shape === 'rounded-rectangle' ? 0.08 : 0)})
      childIds.push(id)
    }
  }catch(error){return creativeRefusal('ADOBE_NATIVE_MATERIALIZATION_INVALID',error instanceof Error?error.message:'Adobe native materialization failed.')}
  nodes[rootId]=Object.freeze({...nodeBase(rootId,'Adobe assisted import',null),type:'group' as const,childIds:Object.freeze(childIds)})
  const exposures:MotionExposureV1[]=[]
  for(const control of doc.controls??[]){const layer=doc.layers.find(candidate=>candidate.id===control.layerId);if(!layer)continue;const property=propertyForControl(layer,control.property);if(!property)continue;exposures.push(Object.freeze({id:`adobe:${control.id}`,label:control.label,group:control.property==='text'?'Content':'Style',level:'creator',target:Object.freeze({kind:'node' as const,nodeId:`${assetId}::${control.layerId}`,property}),editor:control.type==='select'?Object.freeze({type:'select' as const,options:Object.freeze((control.options??[]).map(value=>Object.freeze({label:value,value})))}):Object.freeze({type:(control.type==='number'?'number':control.type==='color'?'color':'text') as 'number'|'color'|'text'}),keyframeable:control.type!=='select'}))}
  const scene=createMotionScene({componentId:`external.${assetId.replace(/[^a-zA-Z0-9.-]+/gu,'-')}`,componentVersion:1,rootNodeId:rootId,nodes:Object.freeze(nodes),semanticParts:Object.freeze(childIds.map((nodeId,index)=>Object.freeze({id:`${assetId}::part:${index}`,label:nodeId,role:'decoration' as const,nodeIds:Object.freeze([nodeId])}))),exposures:Object.freeze(exposures),layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5'])})
  const valid=validateMotionScene(scene);return valid.ok?creativeValidationOk(valid.value):creativeRefusal('ADOBE_NATIVE_MATERIALIZATION_INVALID','Adobe assisted scene failed canonical Motion Graph validation.',valid.issues)
}
