import { creativeOperationOk,creativeOperationRefusal,creativeRefusal,creativeValidationOk,type CreativeOperationResultV1,type CreativeValidationResultV1,type MotionExposureLevel } from '@sanverse/motion-contract'
import type { Animatable,MotionNodePropertyNameV1,MotionNodeV1,MotionSceneV1 } from '@sanverse/motion-graph'
import type { PromotionCandidateV1 } from './contracts.ts'

export const PROMOTION_PARAMETER_CATEGORIES_V1=Object.freeze(['content','media','style','layout','motion','behavior'] as const)
export type PromotionParameterCategoryV1=(typeof PROMOTION_PARAMETER_CATEGORIES_V1)[number]
export type PromotionParameterValueTypeV1='string'|'number'|'boolean'|'color'|'media'|'enum'|'duration'|'ratio'|'object'
export type PromotionParameterConfidenceV1='high'|'medium'|'low'
export type PromotionParameterStatusV1='proposed'|'accepted'|'rejected'|'edited'
export type PromotionBindingTransformV1='identity'|'semantic-color-role'|'numeric-scale'|'custom-supported-transform'
export interface PromotionBindingV1 { readonly nodeId:string; readonly propertyPath:string; readonly transform?:PromotionBindingTransformV1 }
export interface ParameterCandidateV1 {
  readonly id:string
  readonly category:PromotionParameterCategoryV1
  readonly proposedPublicPath:string
  readonly valueType:PromotionParameterValueTypeV1
  readonly defaultValue:unknown
  readonly sourceBindings:readonly PromotionBindingV1[]
  readonly constraints?:Readonly<Record<string,unknown>>
  readonly confidence:PromotionParameterConfidenceV1
  readonly rationale:string
  readonly affectedSemanticNodeIds:readonly string[]
  readonly status:PromotionParameterStatusV1
  readonly exposureLevel:MotionExposureLevel
}
export interface ParameterizationPlanV1 {
  readonly schemaVersion:'sanverse.parameterization-plan/v1'
  readonly id:string
  readonly candidateId:string
  readonly sourceRevision:number
  readonly parameters:readonly ParameterCandidateV1[]
  readonly frozenDesignProperties:readonly PromotionBindingV1[]
  readonly warnings:readonly string[]
  readonly revision:number
}

const id=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=240
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const constantValue=(value:Animatable<unknown>):unknown=>value.kind==='constant'?value.value:undefined
const stringConstant=(value:Animatable<string>):string|undefined=>value.kind==='constant'?value.value:undefined
const nonNeutralColor=(value:string):boolean=>{const normalized=value.trim().toUpperCase();if(!/^#[0-9A-F]{6}$/u.test(normalized))return false;const r=parseInt(normalized.slice(1,3),16),g=parseInt(normalized.slice(3,5),16),b=parseInt(normalized.slice(5,7),16);return Math.max(r,g,b)-Math.min(r,g,b)>28&&!(r>238&&g>238&&b>238)&&!(r<24&&g<24&&b<24)}
const pathForText=(node:MotionNodeV1):string=>{const key=`${node.id} ${node.name}`.toLowerCase();if(key.includes('headline')||key.includes('title'))return'content.headline';if(key.includes('metric')||key.includes('value'))return'content.metric';if(key.includes('label')||key.includes('support'))return'content.supporting-label';return`content.${node.id.replace(/[^a-z0-9]+/giu,'-').replace(/^-|-$/gu,'').toLowerCase()}`}
const candidate=(input:Omit<ParameterCandidateV1,'id'>):ParameterCandidateV1=>Object.freeze({id:`parameter:${input.proposedPublicPath}`,...input,sourceBindings:Object.freeze([...input.sourceBindings]),affectedSemanticNodeIds:Object.freeze([...input.affectedSemanticNodeIds]),...(input.constraints?{constraints:Object.freeze({...input.constraints})}:{})})
const graphPropertyBindings=(scene:MotionSceneV1):PromotionBindingV1[]=>{
  const values:PromotionBindingV1[]=[]
  for(const node of Object.values(scene.nodes)){
    const add=(propertyPath:string)=>values.push(Object.freeze({nodeId:node.id,propertyPath}))
    if(node.type==='shape'){add('shape.width');add('shape.height');add('shape.radius');if(node.masks.length)add('masks')}
    if(node.type==='text'){add('text.fontSize');add('text.fontWeight')}
    if(node.type==='path'){add('path.pathData');add('path.strokeWidth')}
    if(node.type==='image'){add('image.width');add('image.height');add('image.fit')}
  }
  return values
}
const motionBindings=(scene:MotionSceneV1):PromotionBindingV1[]=>{
  const bindings:PromotionBindingV1[]=[]
  const inspect=(nodeId:string,propertyPath:MotionNodePropertyNameV1,value:Animatable<unknown>)=>{if(value.kind==='keyframes'&&value.keyframes.length>=2&&value.keyframes.every(key=>typeof key.value==='number'))bindings.push(Object.freeze({nodeId,propertyPath,transform:'numeric-scale' as const}))}
  for(const node of Object.values(scene.nodes)){inspect(node.id,'transform.positionX',node.transform.positionX);inspect(node.id,'transform.positionY',node.transform.positionY);inspect(node.id,'transform.scaleX',node.transform.scaleX);inspect(node.id,'transform.scaleY',node.transform.scaleY);inspect(node.id,'transform.rotationDeg',node.transform.rotationDeg)}
  return bindings
}

export const proposeParameterizationPlanV1=(promotion:PromotionCandidateV1,scene:MotionSceneV1,planId:string):CreativeOperationResultV1<ParameterizationPlanV1>=>{
  if(!id(planId))return creativeOperationRefusal('INVALID_PARAMETERIZATION_PLAN','Parameterization plan id is required.')
  const parameters:ParameterCandidateV1[]=[];const usedPaths=new Set<string>()
  const push=(entry:ParameterCandidateV1)=>{if(!usedPaths.has(entry.proposedPublicPath)){usedPaths.add(entry.proposedPublicPath);parameters.push(entry)}}
  for(const node of Object.values(scene.nodes)){
    if(node.type==='text'){
      const text=stringConstant(node.text);if(text!==undefined&&text.trim())push(candidate({category:'content',proposedPublicPath:pathForText(node),valueType:'string',defaultValue:text,sourceBindings:[{nodeId:node.id,propertyPath:'text.text',transform:'identity'}],confidence:'high',rationale:`Visible text node "${node.id}" contains project-specific content.`,affectedSemanticNodeIds:[node.id],status:'accepted',exposureLevel:'creator'}))
      const color=stringConstant(node.fillColor);const key=`${node.id} ${node.name}`.toLowerCase();if(color&&nonNeutralColor(color)&&(key.includes('metric')||key.includes('accent')||key.includes('hero')))push(candidate({category:'style',proposedPublicPath:'style.accent',valueType:'color',defaultValue:color,sourceBindings:[{nodeId:node.id,propertyPath:'text.fillColor',transform:'semantic-color-role'}],confidence:'high',rationale:`Semantic highlight node "${node.id}" uses a non-neutral project color suitable for the accent role.`,affectedSemanticNodeIds:[node.id],status:'accepted',exposureLevel:'designer'}))
    }
    if(node.type==='shape'){
      const color=stringConstant(node.fillColor);const key=`${node.id} ${node.name}`.toLowerCase();if(color&&nonNeutralColor(color)&&(key.includes('accent')||key.includes('hero')))push(candidate({category:'style',proposedPublicPath:'style.accent',valueType:'color',defaultValue:color,sourceBindings:[{nodeId:node.id,propertyPath:'shape.fillColor',transform:'semantic-color-role'}],confidence:'high',rationale:`Semantic highlight surface "${node.id}" uses a reusable accent color role.`,affectedSemanticNodeIds:[node.id],status:'accepted',exposureLevel:'designer'}))
    }
    if(node.type==='image'&&node.source.trim())push(candidate({category:'media',proposedPublicPath:`media.${node.id==='media'?'hero-media':node.id.replace(/[^a-z0-9]+/giu,'-').toLowerCase()}`,valueType:'media',defaultValue:node.source,sourceBindings:[{nodeId:node.id,propertyPath:'image.source',transform:'identity'}],confidence:'high',rationale:`Image node "${node.id}" references project-specific media.`,affectedSemanticNodeIds:[node.id],status:'accepted',exposureLevel:'creator'}))
  }
  const motion=motionBindings(scene);if(motion.length>0)push(candidate({category:'motion',proposedPublicPath:'motion.intensity',valueType:'number',defaultValue:1,sourceBindings:motion,constraints:{minimum:.25,maximum:2,step:.05},confidence:'medium',rationale:'The approved scene contains meaningful transform keyframes whose amplitude can be scaled without changing choreography or timing.',affectedSemanticNodeIds:[...new Set(motion.map(item=>item.nodeId))],status:'proposed',exposureLevel:'advanced'}))
  const exposedBindings=new Set(parameters.flatMap(parameter=>parameter.sourceBindings.map(binding=>`${binding.nodeId}:${binding.propertyPath}`)))
  const frozen=graphPropertyBindings(scene).filter(binding=>!exposedBindings.has(`${binding.nodeId}:${binding.propertyPath}`))
  const plan:ParameterizationPlanV1=Object.freeze({schemaVersion:'sanverse.parameterization-plan/v1',id:planId,candidateId:promotion.id,sourceRevision:promotion.sourceSceneRevision,parameters:Object.freeze(parameters),frozenDesignProperties:Object.freeze(frozen),warnings:Object.freeze(parameters.some(parameter=>parameter.confidence==='low')?['Low-confidence parameter candidates require explicit review.']:[]),revision:1})
  const valid=validateParameterizationPlanV1(plan);return valid.ok?creativeOperationOk(valid.value,1):creativeOperationRefusal(valid.refusal.code,valid.refusal.message,valid.refusal.details)
}

export const validateParameterizationPlanV1=(input:unknown):CreativeValidationResultV1<ParameterizationPlanV1>=>{
  if(!record(input)||input.schemaVersion!=='sanverse.parameterization-plan/v1')return creativeRefusal('UNSUPPORTED_PARAMETERIZATION_PLAN_VERSION','Parameterization plan must use sanverse.parameterization-plan/v1.')
  if(!id(input.id)||!id(input.candidateId)||!Number.isSafeInteger(input.sourceRevision)||Number(input.sourceRevision)<1||!Number.isSafeInteger(input.revision)||Number(input.revision)<1||!Array.isArray(input.parameters)||!Array.isArray(input.frozenDesignProperties)||!Array.isArray(input.warnings))return creativeRefusal('INVALID_PARAMETERIZATION_PLAN','Parameterization plan identity/revisions/collections are invalid.')
  const paths=new Set<string>()
  for(const raw of input.parameters){if(!record(raw)||!id(raw.id)||!PROMOTION_PARAMETER_CATEGORIES_V1.includes(raw.category as PromotionParameterCategoryV1)||!id(raw.proposedPublicPath)||paths.has(String(raw.proposedPublicPath))||!['string','number','boolean','color','media','enum','duration','ratio','object'].includes(String(raw.valueType))||!['high','medium','low'].includes(String(raw.confidence))||!['proposed','accepted','rejected','edited'].includes(String(raw.status))||!['creator','designer','advanced'].includes(String(raw.exposureLevel))||!Array.isArray(raw.sourceBindings)||(raw.sourceBindings as unknown[]).length===0)return creativeRefusal('INVALID_PARAMETERIZATION_PLAN','Parameter candidate is invalid or duplicates a public path.');paths.add(String(raw.proposedPublicPath));for(const binding of raw.sourceBindings as unknown[]){if(!record(binding)||!id(binding.nodeId)||!id(binding.propertyPath))return creativeRefusal('INVALID_PARAMETER_BINDING','Parameter bindings must target semantic graph node IDs and property paths.')}}
  return creativeValidationOk(input as unknown as ParameterizationPlanV1)
}

export interface ParameterReviewEditV1 { readonly status:PromotionParameterStatusV1; readonly publicPath?:string }
export const reviewParameterCandidateV1=(plan:ParameterizationPlanV1,parameterId:string,edit:ParameterReviewEditV1):CreativeOperationResultV1<ParameterizationPlanV1>=>{
  const index=plan.parameters.findIndex(item=>item.id===parameterId);if(index<0)return creativeOperationRefusal('PROMOTION_PARAMETER_UNKNOWN',`Unknown parameter candidate ${parameterId}.`)
  if(!['proposed','accepted','rejected','edited'].includes(edit.status))return creativeOperationRefusal('INVALID_PARAMETER_REVIEW','Parameter review status is invalid.')
  const current=plan.parameters[index]!;const path=edit.publicPath??current.proposedPublicPath;if(!id(path))return creativeOperationRefusal('INVALID_PARAMETER_REVIEW','Edited public path is invalid.')
  const duplicate=plan.parameters.some((item,i)=>i!==index&&item.proposedPublicPath===path);if(duplicate)return creativeOperationRefusal('INVALID_PARAMETER_REVIEW','Edited public path would duplicate another parameter.')
  const parameters=plan.parameters.map((item,i)=>i===index?Object.freeze({...item,status:edit.status,proposedPublicPath:path}):item);const revision=plan.revision+1;return creativeOperationOk(Object.freeze({...plan,parameters:Object.freeze(parameters),revision}),revision)
}

export const serializeParameterizationPlanV1=(plan:ParameterizationPlanV1):string=>JSON.stringify(plan)
export const parseParameterizationPlanV1=(json:string):CreativeValidationResultV1<ParameterizationPlanV1>=>{try{return validateParameterizationPlanV1(JSON.parse(json))}catch{return creativeRefusal('INVALID_PARAMETERIZATION_PLAN_JSON','Parameterization plan JSON could not be parsed.')}}
