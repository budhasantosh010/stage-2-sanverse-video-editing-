import { creativeOperationOk,creativeOperationRefusal,type CreativeOperationResultV1,type MotionPresentationModeV1 } from '@sanverse/motion-contract'
import { validateMotionPlanV1,type MotionBeatPurposeV1,type MotionIntentV1,type MotionPlanV1,type SemanticMotionOperationV1 } from '@sanverse/creative-direction'
import type { MotionSceneV1 } from '@sanverse/motion-graph'

export const MOTION_RECIPE_ROLES_V1=Object.freeze(['PRIMARY_HERO','SUPPORTING_ITEMS','HEADLINE','PAYOFF_METRIC'] as const)
export type MotionRecipeRoleV1=(typeof MOTION_RECIPE_ROLES_V1)[number]
export interface MotionRoleDefinitionV1 { readonly role:MotionRecipeRoleV1; readonly description:string; readonly multiplicity:'one'|'one-or-more' }
export interface MotionIntentTemplateV1 { readonly type:SemanticMotionOperationV1; readonly roles:readonly MotionRecipeRoleV1[]; readonly parameters?:MotionIntentV1['parameters'] }
export interface MotionBeatTemplateV1 { readonly id:string; readonly purpose:MotionBeatPurposeV1; readonly startTick:number; readonly endTick:number; readonly roles:readonly MotionRecipeRoleV1[]; readonly intents:readonly MotionIntentTemplateV1[] }
export interface PromotedMotionRecipeV1 {
  readonly schemaVersion:'sanverse.promoted-motion-recipe/v1'
  readonly id:string
  readonly version:number
  readonly title:string
  readonly communicationGoals:readonly string[]
  readonly supportedPresentationModes:readonly MotionPresentationModeV1[]
  readonly requiredRoles:readonly MotionRoleDefinitionV1[]
  readonly optionalRoles:readonly MotionRoleDefinitionV1[]
  readonly beatTemplate:readonly MotionBeatTemplateV1[]
  readonly styleCompatibility:readonly string[]
  readonly requiredCapabilities:readonly string[]
  readonly lineage:Readonly<{sourceMotionPlanId:string;sourceMotionPlanRevision:number}>
}
export interface ExtractMotionRecipeInputV1 { readonly id:string; readonly title:string; readonly motionPlan:MotionPlanV1; readonly scene:MotionSceneV1; readonly communicationGoals:readonly string[]; readonly supportedPresentationModes:readonly MotionPresentationModeV1[] }
export interface BindMotionRecipeInputV1 { readonly recipeApplicationId:string; readonly storyboardId:string; readonly storyboardApprovedRevision:number; readonly animaticId:string; readonly animaticApprovedRevision:number; readonly roleBindings:Partial<Record<MotionRecipeRoleV1,readonly string[]>>; readonly startTickOffset?:number }

const id=(value:string)=>value.trim().length>0&&value.length<=240
const roleFor=(nodeId:string,purpose:MotionBeatPurposeV1,scene:MotionSceneV1):MotionRecipeRoleV1=>{
  const node=scene.nodes[nodeId];const key=`${nodeId} ${node?.name??''}`.toLowerCase()
  if(key.includes('headline')||key.includes('title')||purpose==='establish')return'HEADLINE'
  if(key.includes('metric')||key.includes('value')||purpose==='payoff')return'PAYOFF_METRIC'
  if(purpose==='build')return'SUPPORTING_ITEMS'
  return'PRIMARY_HERO'
}
const definition=(role:MotionRecipeRoleV1):MotionRoleDefinitionV1=>Object.freeze({role,description:role==='HEADLINE'?'Primary establishing text role.':role==='PAYOFF_METRIC'?'Numeric/value payoff role.':role==='SUPPORTING_ITEMS'?'One or more supporting visual items.':'Primary hero visual role.',multiplicity:role==='SUPPORTING_ITEMS'?'one-or-more':'one'})

export const extractMotionRecipeV1=(input:ExtractMotionRecipeInputV1):CreativeOperationResultV1<PromotedMotionRecipeV1>=>{
  if(!id(input.id)||!id(input.title))return creativeOperationRefusal('MOTION_RECIPE_INVALID','Recipe id/title are required.')
  const valid=validateMotionPlanV1(input.motionPlan);if(!valid.ok)return creativeOperationRefusal(valid.refusal.code,valid.refusal.message,valid.refusal.details)
  const nodeRole=new Map<string,MotionRecipeRoleV1>()
  for(const beat of input.motionPlan.beats)for(const nodeId of beat.nodeIds)nodeRole.set(nodeId,roleFor(nodeId,beat.purpose,input.scene))
  const beatTemplate=input.motionPlan.beats.map((beat,index):MotionBeatTemplateV1=>{
    const roles=[...new Set(beat.nodeIds.map(nodeId=>nodeRole.get(nodeId)??'PRIMARY_HERO'))]
    const intents=beat.operationIntents.map(intent=>Object.freeze({type:intent.type,roles:Object.freeze([...new Set(intent.nodeIds.map(nodeId=>nodeRole.get(nodeId)??'PRIMARY_HERO'))]),...(intent.parameters?{parameters:intent.parameters}:{})}))
    return Object.freeze({id:`beat-template:${index}`,purpose:beat.purpose,startTick:beat.startTick,endTick:beat.endTick,roles:Object.freeze(roles),intents:Object.freeze(intents)})
  })
  const used=new Set(beatTemplate.flatMap(beat=>beat.roles));const required=new Set<MotionRecipeRoleV1>(used)
  if(used.has('PAYOFF_METRIC'))required.add('PRIMARY_HERO')
  const requiredRoles=Object.freeze([...required].map(definition));const optionalRoles=Object.freeze(MOTION_RECIPE_ROLES_V1.filter(role=>!required.has(role)).map(definition))
  return creativeOperationOk(Object.freeze({schemaVersion:'sanverse.promoted-motion-recipe/v1',id:input.id,version:1,title:input.title,communicationGoals:Object.freeze([...input.communicationGoals]),supportedPresentationModes:Object.freeze([...input.supportedPresentationModes]),requiredRoles,optionalRoles,beatTemplate:Object.freeze(beatTemplate),styleCompatibility:Object.freeze(['semantic-style-roles']),requiredCapabilities:Object.freeze([]),lineage:Object.freeze({sourceMotionPlanId:input.motionPlan.id,sourceMotionPlanRevision:input.motionPlan.revision})}),1)
}

export const bindMotionRecipeV1=(recipe:PromotedMotionRecipeV1,input:BindMotionRecipeInputV1):CreativeOperationResultV1<MotionPlanV1>=>{
  if(!id(input.recipeApplicationId)||!id(input.storyboardId)||!id(input.animaticId)||!Number.isSafeInteger(input.storyboardApprovedRevision)||input.storyboardApprovedRevision<1||!Number.isSafeInteger(input.animaticApprovedRevision)||input.animaticApprovedRevision<1)return creativeOperationRefusal('MOTION_RECIPE_APPLICATION_INVALID','Recipe application identity/revisions are invalid.')
  const missing=recipe.requiredRoles.filter(role=>!(input.roleBindings[role.role]?.length));if(missing.length)return creativeOperationRefusal('MOTION_RECIPE_ROLE_BINDING_INCOMPLETE',`Missing required recipe role binding(s): ${missing.map(item=>item.role).join(', ')}.`)
  const offset=input.startTickOffset??0
  const beats=recipe.beatTemplate.map((template,index)=>{
    const nodeIds=Object.freeze([...new Set(template.roles.flatMap(role=>input.roleBindings[role]??[]))])
    const intents=template.intents.map((intent,intentIndex):MotionIntentV1=>Object.freeze({id:`${input.recipeApplicationId}:intent:${index}:${intentIndex}`,type:intent.type,nodeIds:Object.freeze([...new Set(intent.roles.flatMap(role=>input.roleBindings[role]??[]))]),startTick:template.startTick+offset,endTick:template.endTick+offset,...(intent.parameters?{parameters:intent.parameters}:{})}))
    return Object.freeze({id:`${input.recipeApplicationId}:beat:${index}`,purpose:template.purpose,startTick:template.startTick+offset,endTick:template.endTick+offset,nodeIds,operationIntents:Object.freeze(intents)})
  })
  const plan:MotionPlanV1=Object.freeze({id:input.recipeApplicationId,storyboardId:input.storyboardId,storyboardApprovedRevision:input.storyboardApprovedRevision,animaticId:input.animaticId,animaticApprovedRevision:input.animaticApprovedRevision,beats:Object.freeze(beats),revision:1})
  const valid=validateMotionPlanV1(plan);return valid.ok?creativeOperationOk(valid.value,1):creativeOperationRefusal(valid.refusal.code,valid.refusal.message,valid.refusal.details)
}
