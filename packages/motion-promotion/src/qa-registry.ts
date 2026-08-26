import { creativeOperationOk,creativeOperationRefusal,creativeRefusal,creativeValidationOk,type CreativeOperationResultV1,type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { evaluateScene,validateMotionScene,type MotionNodeV1,type MotionSceneV1 } from '@sanverse/motion-graph'
import type { CapabilityReuseStatusV1,PromotedCapabilityLineageV1,PromotionDependencyV1,PromotionReusePermissionV1,PromotionSourceV1 } from './contracts.ts'
import type { ProductizedPromotedCapabilityV1 } from './productization.ts'

export interface PromotionQaFindingV1 { readonly code:string; readonly severity:'error'|'warning'; readonly message:string; readonly nodeIds?:readonly string[]; readonly tick?:number }
export interface PromotionQaReportV1 { readonly schemaVersion:'sanverse.promotion-qa/v1'; readonly ok:boolean; readonly findings:readonly PromotionQaFindingV1[]; readonly checkedAt:string }
export interface PromotionQaInputV1 { readonly source:PromotionSourceV1; readonly capability:ProductizedPromotedCapabilityV1; readonly defaultInstance:MotionSceneV1; readonly replacementInstance:MotionSceneV1; readonly durationTicks:number; readonly ticksPerSecond:number; readonly composition:Readonly<{width:number;height:number;fpsNumerator:number;fpsDenominator:number}>; readonly sampleTicks:readonly number[] }
export interface PromotionRightsAssessmentV1 { readonly permission:PromotionReusePermissionV1; readonly dependencyIds:readonly string[]; readonly attributions:readonly string[]; readonly restrictions:readonly string[] }
export interface PromotionRegistrationConfirmationV1 { readonly schemaVersion:'sanverse.promotion-registration-confirmation/v1'; readonly id:string; readonly candidateId:string; readonly candidateRevision:number; readonly authority:'owner'|'system-policy'; readonly confirmedAt:string }
export interface PromotionReviewArtifactsV1 { readonly posterRef:string; readonly reviewRef:string }
export interface RegisteredPromotedCapabilityV1 extends Omit<ProductizedPromotedCapabilityV1,'reuseStatus'> { readonly reuseStatus:'promoted-reusable'; readonly qa:PromotionQaReportV1; readonly registrationConfirmation:PromotionRegistrationConfirmationV1; readonly reviewArtifacts:PromotionReviewArtifactsV1 }
export interface PromotionRegistryV1 { readonly schemaVersion:'sanverse.promotion-registry/v1'; readonly revision:number; readonly entries:readonly RegisteredPromotedCapabilityV1[] }
export interface RegisteredPromotionResultV1 { readonly registry:PromotionRegistryV1; readonly entry:RegisteredPromotedCapabilityV1 }

const stable=(value:unknown):string=>JSON.stringify(value,(_,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry)
const id=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=240
const finding=(code:string,message:string,nodeIds?:readonly string[],tick?:number):PromotionQaFindingV1=>Object.freeze({code,severity:'error',message,...(nodeIds?{nodeIds:Object.freeze([...nodeIds])}:{}),...(tick!==undefined?{tick}:{})})
const propertySnapshot=(node:MotionNodeV1,path:string):string|undefined=>{
  if(path==='shape.radius'&&node.type==='shape')return stable(node.radius);if(path==='shape.width'&&node.type==='shape')return stable(node.width);if(path==='shape.height'&&node.type==='shape')return stable(node.height)
  if(path==='text.fontSize'&&node.type==='text')return stable(node.fontSize);if(path==='text.fontWeight'&&node.type==='text')return stable(node.fontWeight)
  if(path==='image.width'&&node.type==='image')return stable(node.width);if(path==='image.height'&&node.type==='image')return stable(node.height);if(path==='image.fit'&&node.type==='image')return stable(node.fit)
  if(path==='path.pathData'&&node.type==='path')return stable(node.pathData);if(path==='path.strokeWidth'&&node.type==='path')return stable(node.strokeWidth);if(path==='masks')return stable(node.masks)
  return undefined
}

export const aggregatePromotionRightsV1=(dependencies:readonly PromotionDependencyV1[]):PromotionRightsAssessmentV1=>{
  const rank:Record<PromotionReusePermissionV1,number>={global:0,'project-only':1,blocked:2};let permission:PromotionReusePermissionV1='global'
  for(const dependency of dependencies)if(rank[dependency.reusePermission]>rank[permission])permission=dependency.reusePermission
  return Object.freeze({permission,dependencyIds:Object.freeze(dependencies.map(item=>item.id)),attributions:Object.freeze(dependencies.flatMap(item=>item.attribution?[item.attribution]:[])),restrictions:Object.freeze(dependencies.flatMap(item=>item.runtimeRestriction?[item.runtimeRestriction]:[]))})
}

export const runPromotionQaV1=(input:PromotionQaInputV1):PromotionQaReportV1=>{
  const findings:PromotionQaFindingV1[]=[]
  const sourceGraph=validateMotionScene(input.source.scene);if(!sourceGraph.ok)findings.push(finding('PROMOTION_SOURCE_GRAPH_INVALID','Approved source graph is invalid.'))
  const defaultGraph=validateMotionScene(input.defaultInstance);if(!defaultGraph.ok)findings.push(finding('PROMOTION_DEFAULT_GRAPH_INVALID','Promoted default instance is invalid.'))
  const replacementGraph=validateMotionScene(input.replacementInstance);if(!replacementGraph.ok)findings.push(finding('PROMOTION_REPLACEMENT_GRAPH_INVALID','Replacement-content/style instance is invalid.'))
  if(input.capability.lineage.motionApprovalId!==input.source.motionApproval.id||input.capability.lineage.sourceSceneRevision!==input.source.sourceSceneRevision)findings.push(finding('PROMOTION_LINEAGE_APPROVAL_MISMATCH','Promoted lineage does not point at the exact approved source revision.'))
  for(const parameter of input.capability.template.parameters)for(const binding of parameter.bindings){const node=input.capability.template.canonicalGraph.nodes[binding.nodeId];if(!node)findings.push(finding('PROMOTION_BINDING_BROKEN',`Parameter ${parameter.publicPath} references missing node ${binding.nodeId}.`,[binding.nodeId]));else if(binding.propertyPath==='image.source'&&node.type!=='image')findings.push(finding('PROMOTION_BINDING_BROKEN',`Media binding ${binding.nodeId} is not an image node.`,[binding.nodeId]))}
  for(const frozen of input.capability.template.frozenDesignProperties){const sourceNode=input.source.scene.nodes[frozen.nodeId],replacementNode=input.replacementInstance.nodes[frozen.nodeId];if(!sourceNode||!replacementNode){findings.push(finding('PROMOTION_FROZEN_PROPERTY_MISSING',`Frozen property node ${frozen.nodeId} is missing.`,[frozen.nodeId]));continue}const before=propertySnapshot(sourceNode,frozen.propertyPath),after=propertySnapshot(replacementNode,frozen.propertyPath);if(before!==undefined&&after!==before)findings.push(finding('PROMOTION_FROZEN_PROPERTY_CHANGED',`Frozen design property ${frozen.nodeId}.${frozen.propertyPath} changed during reuse.`,[frozen.nodeId]))}
  for(const dependency of input.source.dependencies)if(dependency.reusePermission==='global'&&!dependency.runtimeAssetOwned)findings.push(finding('PROMOTION_RUNTIME_ASSET_NOT_OWNED',`Reusable dependency ${dependency.id} is not owned by the promoted capability.`))
  const sameIds=Object.keys(input.source.scene.nodes).sort().join('|')===Object.keys(input.defaultInstance.nodes).sort().join('|');if(!sameIds)findings.push(finding('PROMOTION_SEMANTIC_IDS_CHANGED','Default promoted instance does not preserve source semantic node IDs.'))
  for(const tick of input.sampleTicks){if(!Number.isSafeInteger(tick)||tick<0||tick>input.durationTicks){findings.push(finding('PROMOTION_QA_TICK_INVALID',`QA tick ${tick} is outside duration.`,undefined,tick));continue}const context={localTicks:tick,durationTicks:input.durationTicks,ticksPerSecond:input.ticksPerSecond,composition:input.composition,reducedMotion:false} as const;try{const source=evaluateScene(input.source.scene,context),promoted=evaluateScene(input.defaultInstance,context);if(stable(source.nodes)!==stable(promoted.nodes))findings.push(finding('PROMOTION_VISUAL_REAPPROVAL_REQUIRED',`Promoted default visual differs from approved source at tick ${tick}.`,undefined,tick));const direct=evaluateScene(input.defaultInstance,context);evaluateScene(input.defaultInstance,{...context,localTicks:input.durationTicks});const backward=evaluateScene(input.defaultInstance,context);evaluateScene(input.defaultInstance,{...context,localTicks:0});const repeated=evaluateScene(input.defaultInstance,context);if(stable(direct)!==stable(backward)||stable(backward)!==stable(repeated))findings.push(finding('PROMOTION_DIRECT_SEEK_FAILED',`Promoted instance differs across direct/backward/repeated seek at tick ${tick}.`,undefined,tick))}catch(error){findings.push(finding('PROMOTION_DETERMINISM_FAILED',error instanceof Error?error.message:'Promotion exact-tick evaluation failed.',undefined,tick))}}
  return Object.freeze({schemaVersion:'sanverse.promotion-qa/v1',ok:findings.length===0,findings:Object.freeze(findings),checkedAt:'2026-08-26T00:00:00.000Z'})
}

export const validatePromotedCapabilityLineageV1=(input:unknown):CreativeValidationResultV1<PromotedCapabilityLineageV1>=>{
  if(!input||typeof input!=='object'||Array.isArray(input))return creativeRefusal('INVALID_PROMOTION_LINEAGE','Promotion lineage must be an object.')
  const value=input as Record<string,unknown>;if(value.schemaVersion!=='sanverse.promoted-capability-lineage/v1')return creativeRefusal('UNSUPPORTED_PROMOTION_LINEAGE_VERSION','Promotion lineage must use sanverse.promoted-capability-lineage/v1.')
  if(!['curated','external','generated'].includes(String(value.sourceOrigin))||!id(value.sourceProjectId)||!id(value.sourceSceneId)||!Number.isSafeInteger(value.sourceSceneRevision)||Number(value.sourceSceneRevision)<1||!id(value.motionApprovalId)||!id(value.promotionCandidateId)||!Number.isSafeInteger(value.promotionRevision)||Number(value.promotionRevision)<1||typeof value.promotedAt!=='string'||Number.isNaN(Date.parse(String(value.promotedAt)))||!Array.isArray(value.dependencyIds))return creativeRefusal('INVALID_PROMOTION_LINEAGE','Promotion lineage identity/revisions/approval/timestamp are invalid.')
  return creativeValidationOk(input as PromotedCapabilityLineageV1)
}
export const serializePromotedCapabilityLineageV1=(lineage:PromotedCapabilityLineageV1):string=>JSON.stringify(lineage)
export const parsePromotedCapabilityLineageV1=(json:string):CreativeValidationResultV1<PromotedCapabilityLineageV1>=>{try{return validatePromotedCapabilityLineageV1(JSON.parse(json))}catch{return creativeRefusal('INVALID_PROMOTION_LINEAGE_JSON','Promotion lineage JSON could not be parsed.')}}

export const createPromotionRegistryV1=():PromotionRegistryV1=>Object.freeze({schemaVersion:'sanverse.promotion-registry/v1',revision:1,entries:Object.freeze([])})
const validateConfirmation=(confirmation:PromotionRegistrationConfirmationV1,capability:ProductizedPromotedCapabilityV1):CreativeOperationResultV1<PromotionRegistrationConfirmationV1>=>{
  if(confirmation.schemaVersion!=='sanverse.promotion-registration-confirmation/v1'||!id(confirmation.id)||!id(confirmation.candidateId)||!Number.isSafeInteger(confirmation.candidateRevision)||confirmation.candidateRevision<1||!['owner','system-policy'].includes(confirmation.authority)||typeof confirmation.confirmedAt!=='string'||Number.isNaN(Date.parse(confirmation.confirmedAt)))return creativeOperationRefusal('PROMOTION_CONFIRMATION_INVALID','Promotion registration confirmation is invalid.')
  if(confirmation.candidateId!==capability.lineage.promotionCandidateId||confirmation.candidateRevision!==capability.lineage.promotionRevision)return creativeOperationRefusal('PROMOTION_CONFIRMATION_STALE','Promotion confirmation must target the exact promotion candidate revision being registered.')
  return creativeOperationOk(confirmation,confirmation.candidateRevision)
}

export const registerPromotedCapabilityV1=(registry:PromotionRegistryV1,capability:ProductizedPromotedCapabilityV1,qa:PromotionQaReportV1,confirmation:PromotionRegistrationConfirmationV1,artifacts:PromotionReviewArtifactsV1):CreativeOperationResultV1<RegisteredPromotionResultV1>=>{
  if(!qa.ok)return creativeOperationRefusal('PROMOTION_QA_FAILED','Promotion QA must pass before Library registration.',qa.findings)
  const confirmationResult=validateConfirmation(confirmation,capability);if(!confirmationResult.ok)return confirmationResult as CreativeOperationResultV1<RegisteredPromotionResultV1>
  if(!id(artifacts.posterRef)||!id(artifacts.reviewRef))return creativeOperationRefusal('PROMOTION_REVIEW_ARTIFACT_REQUIRED','Promotion registration requires poster and canonical review artifacts before public state changes.')
  const rights=aggregatePromotionRightsV1(capability.dependencies);if(rights.permission!=='global')return creativeOperationRefusal('PROMOTION_RIGHTS_RESTRICTED',`Promotion cannot become globally reusable while dependency permission is ${rights.permission}.`,rights)
  if(registry.entries.some(entry=>entry.id===capability.id&&entry.version===capability.version))return creativeOperationRefusal('PROMOTION_VERSION_ALREADY_REGISTERED',`Capability ${capability.id} version ${capability.version} is already registered.`)
  const lineageValid=validatePromotedCapabilityLineageV1(capability.lineage);if(!lineageValid.ok)return creativeOperationRefusal(lineageValid.refusal.code,lineageValid.refusal.message,lineageValid.refusal.details)
  const entry:RegisteredPromotedCapabilityV1=Object.freeze({...capability,reuseStatus:'promoted-reusable' as const,qa,registrationConfirmation:Object.freeze({...confirmation}),reviewArtifacts:Object.freeze({...artifacts}),lineage:Object.freeze({...capability.lineage,dependencyIds:Object.freeze([...capability.lineage.dependencyIds])}),dependencies:Object.freeze([...capability.dependencies])})
  const next:PromotionRegistryV1=Object.freeze({...registry,revision:registry.revision+1,entries:Object.freeze([...registry.entries,entry])})
  return creativeOperationOk(Object.freeze({registry:next,entry}),next.revision)
}
