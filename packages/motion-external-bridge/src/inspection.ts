import { creativeRefusal, creativeValidationOk, type CreativeEditabilityV1, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { constant, createMotionScene, nodeBase, validateMotionScene, type MotionNodeV1, type MotionSceneV1 } from '@sanverse/motion-graph'
import { evaluateExternalRights, type ExternalMotionProvenanceV1, type ExternalMotionSourceKindV1, type ExternalRightsDecisionV1 } from './provenance.ts'

export type ExternalMaterializationKindV1 = 'canonical-scene' | 'external-runtime-asset'
export interface ExternalAssetMetadataV1 { readonly width?: number; readonly height?: number; readonly durationTicks?: number; readonly hasAlpha?: boolean; readonly codec?: string }
export interface ExternalAssetInspectionInputV1 { readonly assetId: string; readonly sourceKind: ExternalMotionSourceKindV1; readonly bytes: string | Uint8Array; readonly provenance: ExternalMotionProvenanceV1; readonly metadata?: ExternalAssetMetadataV1 }
export interface ExternalAssetInspectionV1 {
  readonly schemaVersion: 'sanverse.external-asset-inspection/v1'
  readonly assetId: string
  readonly sourceKind: ExternalMotionSourceKindV1
  readonly rightsDecision: ExternalRightsDecisionV1
  readonly editability: CreativeEditabilityV1
  readonly materialization: ExternalMaterializationKindV1
  readonly deterministic: boolean
  readonly directSeekSafe: boolean
  readonly contentHash: string
  readonly metadata: ExternalAssetMetadataV1
  readonly warnings: readonly string[]
}
export interface ExternalRuntimeAssetV1 {
  readonly schemaVersion: 'sanverse.external-runtime-asset/v1'
  readonly assetId: string
  readonly sourceKind: 'alpha-video'
  readonly contentHash: string
  readonly width: number
  readonly height: number
  readonly durationTicks: number
  readonly hasAlpha: true
  readonly codec: string
  readonly exactTickAuthority: true
}
export type ExternalMaterializationV1 = Readonly<{ kind:'canonical-scene'; scene:MotionSceneV1 }> | Readonly<{ kind:'external-runtime-asset'; asset:ExternalRuntimeAssetV1 }>

const fnv1a = (value: string | Uint8Array): string => {
  let hash=0x811c9dc5
  const bytes=typeof value==='string' ? new TextEncoder().encode(value) : value
  for(const byte of bytes){ hash^=byte; hash=Math.imul(hash,0x01000193) }
  return (hash>>>0).toString(16).padStart(8,'0')
}
const finitePositive=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0
const safeDuration=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>0
const safeId=(value:string):string=>value.replace(/[^a-zA-Z0-9._:-]+/gu,'-').slice(0,160)||'node'
const attribute=(raw:string,name:string):string|undefined=>new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']+)["']`,'iu').exec(raw)?.[1]
const numberAttr=(raw:string,name:string,fallback=0):number=>{ const parsed=Number(attribute(raw,name)); return Number.isFinite(parsed)?parsed:fallback }
const svgUnsupported=(source:string):string|null=>{
  const prohibited=[['script',/<script\b/iu],['foreignObject',/<foreignObject\b/iu],['external image',/<image\b[^>]*(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/|data:)/iu],['event handler',/\son[a-z]+\s*=/iu],['external use',/<use\b[^>]*(?:href|xlink:href)\s*=\s*["'](?!#)/iu]] as const
  for(const [label,pattern] of prohibited) if(pattern.test(source)) return label
  const tags=[...source.matchAll(/<\/?\s*([a-zA-Z][\w:-]*)\b/gu)].map(match=>match[1]!.toLowerCase())
  const allowed=new Set(['svg','g','rect','path'])
  const unsupported=tags.find(tag=>!allowed.has(tag))
  return unsupported ? `tag:${unsupported}` : null
}

type LottieValueV1 = Readonly<{ a?:number; k?:unknown }>
type LottieShapeV1 = Readonly<{ ty?:string; nm?:string; p?:LottieValueV1; s?:LottieValueV1; r?:LottieValueV1; c?:LottieValueV1; o?:LottieValueV1; w?:LottieValueV1; it?:readonly LottieShapeV1[] }>
type LottieLayerV1 = Readonly<{ ty?:number; nm?:string; ind?:number; shapes?:readonly LottieShapeV1[] }>
type LottieDocumentV1 = Readonly<{ v?:string; fr?:number; ip?:number; op?:number; w?:number; h?:number; layers?:readonly LottieLayerV1[] }>
const lottieConstant=(value:LottieValueV1|undefined):unknown=>value?.a===0||value?.a===undefined?value?.k:undefined
const parseLottieSubset=(source:string):CreativeValidationResultV1<LottieDocumentV1>=>{
  let parsed:unknown
  try{parsed=JSON.parse(source)}catch{return creativeRefusal('EXTERNAL_ASSET_INVALID','Lottie V1 source must be valid JSON.')}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return creativeRefusal('EXTERNAL_ASSET_INVALID','Lottie V1 root must be an object.')
  const document=parsed as LottieDocumentV1
  if(!finitePositive(document.w)||!finitePositive(document.h)||!finitePositive(document.fr)||typeof document.ip!=='number'||typeof document.op!=='number'||document.op<=document.ip||!Array.isArray(document.layers))return creativeRefusal('EXTERNAL_ASSET_INVALID','Lottie V1 requires finite width, height, frame rate, in/out points and layers.')
  const allowedShapes=new Set(['gr','rc','fl','st','tr'])
  const inspectShapes=(shapes:readonly LottieShapeV1[]):string|null=>{
    for(const shape of shapes){
      if(!shape||typeof shape!=='object'||!allowedShapes.has(String(shape.ty)))return `shape:${String(shape?.ty??'unknown')}`
      if(shape.ty==='gr'){
        if(!Array.isArray(shape.it))return 'group-without-items'
        const nested=inspectShapes(shape.it);if(nested)return nested
      }
      for(const property of [shape.p,shape.s,shape.r,shape.c,shape.o,shape.w])if(property?.a!==undefined&&property.a!==0)return 'animated-property'
    }
    return null
  }
  for(const layer of document.layers){
    if(layer.ty!==4)return creativeRefusal('EXTERNAL_ASSET_UNSUPPORTED_FEATURE',`Lottie V1 supports static shape layers only; layer ${layer.nm??layer.ind??'unknown'} has type ${String(layer.ty)}.`)
    if(!Array.isArray(layer.shapes))return creativeRefusal('EXTERNAL_ASSET_INVALID','Lottie shape layer requires shapes.')
    const unsupported=inspectShapes(layer.shapes);if(unsupported)return creativeRefusal('EXTERNAL_ASSET_UNSUPPORTED_FEATURE',`Lottie V1 refuses unsupported ${unsupported}; no approximation is rendered.`)
  }
  return creativeValidationOk(document)
}

export const inspectExternalMotionAssetV1=(input:ExternalAssetInspectionInputV1):CreativeValidationResultV1<ExternalAssetInspectionV1>=>{
  if(!input.assetId.trim()||input.assetId.length>240) return creativeRefusal('EXTERNAL_ASSET_INVALID','External assetId is required and bounded.')
  if(input.provenance.sourceKind!==input.sourceKind) return creativeRefusal('EXTERNAL_PROVENANCE_MISMATCH','Inspection sourceKind must match provenance sourceKind.')
  const rights=evaluateExternalRights(input.provenance)
  if(rights.decision==='BLOCKED') return creativeRefusal('EXTERNAL_RIGHTS_BLOCKED',rights.reasons.join(' '))
  if(input.sourceKind==='svg'){
    if(typeof input.bytes!=='string') return creativeRefusal('EXTERNAL_ASSET_INVALID','SVG V1 inspection requires source text.')
    const unsupported=svgUnsupported(input.bytes)
    if(unsupported) return creativeRefusal('EXTERNAL_ASSET_UNSUPPORTED_FEATURE',`SVG V1 refuses unsupported ${unsupported}; no approximation is rendered.`)
    if(!/<svg\b/iu.test(input.bytes)) return creativeRefusal('EXTERNAL_ASSET_INVALID','SVG source requires an <svg> root.')
    return creativeValidationOk(Object.freeze({ schemaVersion:'sanverse.external-asset-inspection/v1', assetId:input.assetId, sourceKind:'svg', rightsDecision:rights.decision, editability:'high', materialization:'canonical-scene', deterministic:true, directSeekSafe:true, contentHash:fnv1a(input.bytes), metadata:Object.freeze({...input.metadata}), warnings:Object.freeze([]) }))
  }
  if(input.sourceKind==='lottie'){
    if(typeof input.bytes!=='string')return creativeRefusal('EXTERNAL_ASSET_INVALID','Lottie V1 inspection requires JSON source text.')
    const parsed=parseLottieSubset(input.bytes);if(!parsed.ok)return parsed as CreativeValidationResultV1<ExternalAssetInspectionV1>
    const durationTicks=Math.round(((Number(parsed.value.op)-Number(parsed.value.ip))/Number(parsed.value.fr))*1_440_000)
    return creativeValidationOk(Object.freeze({schemaVersion:'sanverse.external-asset-inspection/v1',assetId:input.assetId,sourceKind:'lottie',rightsDecision:rights.decision,editability:'high',materialization:'canonical-scene',deterministic:true,directSeekSafe:true,contentHash:fnv1a(input.bytes),metadata:Object.freeze({width:parsed.value.w,height:parsed.value.h,durationTicks,...input.metadata}),warnings:Object.freeze(['Lottie V1 accepts only deterministic static shape layers; unsupported features fail closed.'])}))
  }
  if(input.sourceKind==='alpha-video'){
    const metadata=input.metadata??{}
    if(!finitePositive(metadata.width)||!finitePositive(metadata.height)||!safeDuration(metadata.durationTicks)||metadata.hasAlpha!==true||typeof metadata.codec!=='string'||!metadata.codec.trim()) return creativeRefusal('EXTERNAL_ASSET_INVALID','Alpha-video V1 requires width, height, positive durationTicks, hasAlpha=true and codec metadata.')
    return creativeValidationOk(Object.freeze({ schemaVersion:'sanverse.external-asset-inspection/v1', assetId:input.assetId, sourceKind:'alpha-video', rightsDecision:rights.decision, editability:'partial', materialization:'external-runtime-asset', deterministic:true, directSeekSafe:true, contentHash:fnv1a(input.bytes), metadata:Object.freeze({...metadata}), warnings:Object.freeze(['Alpha video stays a runtime asset; it is not falsely converted into editable vector nodes.']) }))
  }
  return creativeRefusal('EXTERNAL_ADAPTER_NOT_AVAILABLE',`No Closed-Loop V1 adapter is available for ${input.sourceKind}.`)
}

const svgScene=(inspection:ExternalAssetInspectionV1,source:string):CreativeValidationResultV1<ExternalMaterializationV1>=>{
  const rootTag=/<svg\b([^>]*)>/iu.exec(source)?.[1]??''
  const viewBox=(attribute(rootTag,'viewBox')??'0 0 100 100').trim().split(/[ ,]+/u).map(Number)
  if(viewBox.length!==4||viewBox.some(value=>!Number.isFinite(value))||viewBox[2]!<=0||viewBox[3]!<=0) return creativeRefusal('EXTERNAL_ASSET_INVALID','SVG viewBox must contain four finite values with positive width/height.')
  const [, , viewWidth, viewHeight]=viewBox as [number,number,number,number]
  const rootId=`${inspection.assetId}::root`
  const nodes:Record<string,MotionNodeV1>={}
  const childIds:string[]=[]
  let index=0
  const add=(id:string,node:MotionNodeV1)=>{ if(nodes[id]) throw new RangeError(`Duplicate SVG semantic id ${id}.`); nodes[id]=node; childIds.push(id) }
  try{
    for(const match of source.matchAll(/<(rect|path)\b([^>]*)\/?\s*>/giu)){
      const kind=match[1]!.toLowerCase(); const attrs=match[2]??''; const rawId=attribute(attrs,'id')??`${kind}-${index++}`; const id=`${inspection.assetId}::${safeId(rawId)}`
      if(kind==='rect'){
        const width=numberAttr(attrs,'width'); const height=numberAttr(attrs,'height'); if(width<=0||height<=0) return creativeRefusal('EXTERNAL_ASSET_INVALID',`SVG rect ${rawId} requires positive width and height.`)
        const x=numberAttr(attrs,'x'); const y=numberAttr(attrs,'y'); const rx=Math.max(0,numberAttr(attrs,'rx'))
        const base=nodeBase(id,rawId,rootId)
        add(id,Object.freeze({ ...base, type:'shape', shape:rx>0?'rounded-rectangle':'rectangle', transform:Object.freeze({...base.transform,positionX:constant((x+width/2)/viewWidth-.5),positionY:constant((y+height/2)/viewHeight-.5)}), width:constant(width/viewWidth),height:constant(height/viewHeight),fillColor:constant(attribute(attrs,'fill')??'#ffffff'),strokeColor:constant(attribute(attrs,'stroke')??'transparent'),strokeWidth:constant(Math.max(0,numberAttr(attrs,'stroke-width'))/Math.max(viewWidth,viewHeight)),radius:constant(Math.min(.5,rx/Math.max(1,Math.min(width,height)))) }))
      } else {
        const d=attribute(attrs,'d'); if(!d?.trim()) return creativeRefusal('EXTERNAL_ASSET_INVALID',`SVG path ${rawId} requires path data.`)
        if(/[^MmLlHhVvCcSsQqTtAaZz0-9eE+.,\-\s]/u.test(d)) return creativeRefusal('EXTERNAL_ASSET_UNSUPPORTED_FEATURE',`SVG path ${rawId} contains unsupported path syntax.`)
        const base=nodeBase(id,rawId,rootId)
        add(id,Object.freeze({ ...base,type:'path',pathData:d,fillColor:constant(attribute(attrs,'fill')??'transparent'),strokeColor:constant(attribute(attrs,'stroke')??'#ffffff'),strokeWidth:constant(Math.max(0,numberAttr(attrs,'stroke-width'))/Math.max(viewWidth,viewHeight)),trimProgress:constant(1) }))
      }
    }
  }catch(error){ return creativeRefusal('EXTERNAL_ASSET_INVALID',error instanceof Error?error.message:'SVG semantic identity failed.') }
  nodes[rootId]=Object.freeze({ ...nodeBase(rootId,'External SVG',null),type:'group',childIds:Object.freeze(childIds) })
  const scene=createMotionScene({ componentId:`external.${safeId(inspection.assetId)}`,componentVersion:1,rootNodeId:rootId,nodes:Object.freeze(nodes),semanticParts:Object.freeze(childIds.map((nodeId,i)=>Object.freeze({id:`${inspection.assetId}::part:${i}`,label:nodes[nodeId]?.name??nodeId,role:'decoration' as const,nodeIds:Object.freeze([nodeId])}))),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5'])})
  const validated=validateMotionScene(scene)
  if(!validated.ok) return creativeRefusal('EXTERNAL_MATERIALIZATION_INVALID','Materialized SVG did not satisfy MotionSceneV1.',validated.issues)
  return creativeValidationOk(Object.freeze({kind:'canonical-scene' as const,scene:validated.value}))
}

const lottieScene=(inspection:ExternalAssetInspectionV1,source:string):CreativeValidationResultV1<ExternalMaterializationV1>=>{
  const parsed=parseLottieSubset(source);if(!parsed.ok)return parsed as CreativeValidationResultV1<ExternalMaterializationV1>
  const document=parsed.value;const width=Number(document.w),height=Number(document.h);const rootId=`${inspection.assetId}::root`;const nodes:Record<string,MotionNodeV1>={};const childIds:string[]=[];let counter=0
  const color=(value:unknown,fallback:string):string=>{if(!Array.isArray(value)||value.length<3)return fallback;const channel=(v:unknown)=>Math.max(0,Math.min(255,Math.round(Number(v)*255))).toString(16).padStart(2,'0');return `#${channel(value[0])}${channel(value[1])}${channel(value[2])}`}
  const walk=(shapes:readonly LottieShapeV1[],layerName:string)=>{
    let fill='#ffffff',stroke='transparent',strokeWidth=0
    for(const shape of shapes){if(shape.ty==='fl')fill=color(lottieConstant(shape.c),fill);else if(shape.ty==='st'){stroke=color(lottieConstant(shape.c),'#ffffff');const raw=lottieConstant(shape.w);if(typeof raw==='number')strokeWidth=Math.max(0,raw)/Math.max(width,height)}}
    for(const shape of shapes){
      if(shape.ty==='gr'&&Array.isArray(shape.it)){walk(shape.it,shape.nm??layerName);continue}
      if(shape.ty!=='rc')continue
      const size=lottieConstant(shape.s),position=lottieConstant(shape.p),radius=lottieConstant(shape.r)
      if(!Array.isArray(size)||size.length<2||!Array.isArray(position)||position.length<2||!finitePositive(Number(size[0]))||!finitePositive(Number(size[1])))throw new RangeError(`Lottie rectangle ${shape.nm??counter} requires constant position and positive size.`)
      const rectWidth=Number(size[0]),rectHeight=Number(size[1]),x=Number(position[0]),y=Number(position[1]);if(!Number.isFinite(x)||!Number.isFinite(y))throw new RangeError('Lottie rectangle position must be finite.')
      const id=`${inspection.assetId}::${safeId(shape.nm??`${layerName}-rect-${counter++}`)}`;if(nodes[id])throw new RangeError(`Duplicate Lottie semantic id ${id}.`);const base=nodeBase(id,shape.nm??'Lottie rectangle',rootId)
      nodes[id]=Object.freeze({...base,type:'shape',shape:Number(radius)>0?'rounded-rectangle':'rectangle',transform:Object.freeze({...base.transform,positionX:constant(x/width-.5),positionY:constant(y/height-.5)}),width:constant(rectWidth/width),height:constant(rectHeight/height),fillColor:constant(fill),strokeColor:constant(stroke),strokeWidth:constant(strokeWidth),radius:constant(Math.min(.5,Math.max(0,Number(radius)||0)/Math.max(1,Math.min(rectWidth,rectHeight))))});childIds.push(id)
    }
  }
  try{for(const layer of document.layers??[])walk(layer.shapes??[],layer.nm??`layer-${layer.ind??0}`)}catch(error){return creativeRefusal('EXTERNAL_ASSET_INVALID',error instanceof Error?error.message:'Lottie materialization failed.')}
  if(childIds.length===0)return creativeRefusal('EXTERNAL_ASSET_UNSUPPORTED_FEATURE','Lottie V1 source contains no supported rectangle shapes to materialize.')
  nodes[rootId]=Object.freeze({...nodeBase(rootId,'External Lottie',null),type:'group',childIds:Object.freeze(childIds)})
  const scene=createMotionScene({componentId:`external.${safeId(inspection.assetId)}`,componentVersion:1,rootNodeId:rootId,nodes:Object.freeze(nodes),semanticParts:Object.freeze(childIds.map((nodeId,i)=>Object.freeze({id:`${inspection.assetId}::part:${i}`,label:nodes[nodeId]?.name??nodeId,role:'decoration' as const,nodeIds:Object.freeze([nodeId])}))),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5'])})
  const validated=validateMotionScene(scene);if(!validated.ok)return creativeRefusal('EXTERNAL_MATERIALIZATION_INVALID','Materialized Lottie did not satisfy MotionSceneV1.',validated.issues)
  return creativeValidationOk(Object.freeze({kind:'canonical-scene' as const,scene:validated.value}))
}

export const materializeExternalMotionAssetV1=(inspection:ExternalAssetInspectionV1,bytes:string|Uint8Array):CreativeValidationResultV1<ExternalMaterializationV1>=>{
  if(fnv1a(bytes)!==inspection.contentHash) return creativeRefusal('EXTERNAL_ASSET_CHANGED','External asset bytes changed after inspection.')
  if(inspection.materialization==='canonical-scene'){
    if(typeof bytes!=='string')return creativeRefusal('EXTERNAL_MATERIALIZATION_INVALID','Canonical V1 materialization requires inspected source text.')
    if(inspection.sourceKind==='svg')return svgScene(inspection,bytes)
    if(inspection.sourceKind==='lottie')return lottieScene(inspection,bytes)
    return creativeRefusal('EXTERNAL_MATERIALIZATION_INVALID',`Canonical V1 materialization does not support ${inspection.sourceKind}.`)
  }
  const meta=inspection.metadata
  if(inspection.sourceKind!=='alpha-video'||!finitePositive(meta.width)||!finitePositive(meta.height)||!safeDuration(meta.durationTicks)||meta.hasAlpha!==true||typeof meta.codec!=='string') return creativeRefusal('EXTERNAL_MATERIALIZATION_INVALID','External runtime asset metadata is incomplete.')
  return creativeValidationOk(Object.freeze({kind:'external-runtime-asset' as const,asset:Object.freeze({schemaVersion:'sanverse.external-runtime-asset/v1' as const,assetId:inspection.assetId,sourceKind:'alpha-video' as const,contentHash:inspection.contentHash,width:meta.width,height:meta.height,durationTicks:meta.durationTicks,hasAlpha:true as const,codec:meta.codec,exactTickAuthority:true as const})}))
}
