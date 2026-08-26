import { CAPABILITY_ORIGINS_V1,creativeOperationOk,creativeOperationRefusal,creativeRefusal,creativeValidationOk,type CapabilityOriginV1,type CapabilityReuseStatusV1,type CreativeOperationResultV1,type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { validateMotionScene,type MotionSceneV1 } from '@sanverse/motion-graph'
import { validateOwnerApprovalV1,type OwnerApprovalV1 } from '@sanverse/motion-storyboard'
import type { MotionPlanV1 } from '@sanverse/creative-direction'

export const PROMOTION_TARGET_KINDS_V1=Object.freeze(['component','scene','motion-recipe','effect','preset'] as const)
export type PromotionTargetKindV1=(typeof PROMOTION_TARGET_KINDS_V1)[number]
export { CAPABILITY_ORIGINS_V1,CAPABILITY_REUSE_STATUSES_V1 } from '@sanverse/motion-contract'
export type { CapabilityOriginV1,CapabilityReuseStatusV1 } from '@sanverse/motion-contract'
export type PromotionCandidateStatusV1='draft'|'analyzing'|'awaiting-review'|'approved-for-productization'|'productizing'|'complete'|'rejected'
export type PromotionWorkspaceStatusV1='draft'|'review'|'validated'|'ready-to-register'
export type PromotionReusePermissionV1='global'|'project-only'|'blocked'

export interface PromotionDependencyV1 { readonly id:string; readonly origin:'sanverse'|'external'|'generated'|'project'; readonly reusePermission:PromotionReusePermissionV1; readonly runtimeAssetOwned:boolean; readonly attribution?:string; readonly runtimeRestriction?:string }
export interface PromotionVisualReviewEvidenceV1 { readonly canonicalReviewRef:string; readonly posterRef:string; readonly criticalFrameRefs:readonly string[] }
export interface PromotionSourceV1 {
  readonly schemaVersion:'sanverse.promotion-source/v1'
  readonly sourceProjectId:string
  readonly sourceProjectRevision:number|string
  readonly sourceSceneId:string
  readonly sourceSceneRevision:number
  readonly scene:MotionSceneV1
  readonly sourceStoryboardId?:string
  readonly sourceStoryboardRevision?:number
  readonly sourceAnimaticId?:string
  readonly sourceAnimaticRevision?:number
  readonly sourceMotionPlanId?:string
  readonly sourceMotionPlanRevision?:number
  readonly motionPlan?:MotionPlanV1
  readonly motionApproval:OwnerApprovalV1
  readonly structuralQaPassed:boolean
  readonly visualReviewEvidence:PromotionVisualReviewEvidenceV1
  readonly origin:CapabilityOriginV1
  readonly dependencies:readonly PromotionDependencyV1[]
}

export interface PromotedCapabilityLineageV1 {
  readonly schemaVersion:'sanverse.promoted-capability-lineage/v1'
  readonly sourceOrigin:CapabilityOriginV1
  readonly sourceProjectId:string
  readonly sourceProjectRevision:number|string
  readonly sourceSceneId:string
  readonly sourceSceneRevision:number
  readonly storyboardId?:string
  readonly storyboardRevision?:number
  readonly animaticId?:string
  readonly animaticRevision?:number
  readonly motionPlanId?:string
  readonly motionPlanRevision?:number
  readonly motionApprovalId:string
  readonly promotionCandidateId:string
  readonly promotionRevision:number
  readonly parameterizationPlanId?:string
  readonly promotedAt:string
  readonly dependencyIds:readonly string[]
}

export interface PromotionCandidateV1 {
  readonly schemaVersion:'sanverse.promotion-candidate/v1'
  readonly id:string
  readonly sourceProjectId:string
  readonly sourceProjectRevision:number|string
  readonly sourceSceneId:string
  readonly sourceSceneRevision:number
  readonly sourceStoryboardId?:string
  readonly sourceStoryboardRevision?:number
  readonly sourceAnimaticId?:string
  readonly sourceAnimaticRevision?:number
  readonly sourceMotionPlanId?:string
  readonly sourceMotionPlanRevision?:number
  readonly sourceOwnerApprovalId:string
  readonly requestedTargetKinds:readonly PromotionTargetKindV1[]
  readonly status:PromotionCandidateStatusV1
  readonly revision:number
  readonly origin:CapabilityOriginV1
  readonly reuseStatus:'promotion-candidate'
}

export interface PromotionWorkspaceV1 {
  readonly schemaVersion:'sanverse.promotion-workspace/v1'
  readonly id:string
  readonly candidateId:string
  readonly baseCandidateRevision:number
  readonly parameterizationPlanId?:string
  readonly targetKind?:PromotionTargetKindV1
  readonly revision:number
  readonly status:PromotionWorkspaceStatusV1
  readonly appliedIdempotencyKeys:readonly string[]
}

export type PromotionTransactionOperationV1=
  | Readonly<{type:'promotion.set-target-kind';targetKind:PromotionTargetKindV1}>
  | Readonly<{type:'promotion.set-parameterization-plan';parameterizationPlanId:string}>
  | Readonly<{type:'promotion.set-status';status:PromotionWorkspaceStatusV1}>
export interface PromotionTransactionV1 { readonly schemaVersion:'sanverse.promotion-transaction/v1'; readonly id:string; readonly idempotencyKey:string; readonly baseRevision:number; readonly operations:readonly PromotionTransactionOperationV1[] }
export interface AppliedPromotionTransactionV1 { readonly workspace:PromotionWorkspaceV1; readonly inverseWorkspace:PromotionWorkspaceV1; readonly idempotentReplay:boolean }

const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const id=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=240
const validRevision=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=1
const candidateStatuses:readonly PromotionCandidateStatusV1[]=Object.freeze(['draft','analyzing','awaiting-review','approved-for-productization','productizing','complete','rejected'])
const workspaceStatuses:readonly PromotionWorkspaceStatusV1[]=Object.freeze(['draft','review','validated','ready-to-register'])

export const validatePromotionSourceV1=(source:unknown):CreativeValidationResultV1<PromotionSourceV1>=>{
  if(!record(source)||source.schemaVersion!=='sanverse.promotion-source/v1')return creativeRefusal('UNSUPPORTED_PROMOTION_SOURCE_VERSION','Promotion source must use sanverse.promotion-source/v1.')
  if(!id(source.sourceProjectId)||(!Number.isSafeInteger(source.sourceProjectRevision)&&typeof source.sourceProjectRevision!=='string')||!id(source.sourceSceneId)||!validRevision(source.sourceSceneRevision))return creativeRefusal('PROMOTION_SOURCE_NOT_FOUND','Promotion source project/scene identity is invalid.')
  const graph=validateMotionScene(source.scene);if(!graph.ok)return creativeRefusal('PROMOTION_SOURCE_GRAPH_INVALID','Promotion source scene is not a valid canonical MotionSceneV1.',graph.issues)
  const approval=validateOwnerApprovalV1(source.motionApproval);if(!approval.ok)return creativeRefusal('PROMOTION_SOURCE_NOT_APPROVED','Promotion requires a valid existing OwnerApprovalV1(scope = motion).',approval.refusal)
  if(approval.value.scope!=='motion'||approval.value.subjectId!==source.sourceSceneId)return creativeRefusal('PROMOTION_SOURCE_NOT_APPROVED','Promotion source approval must be a motion approval for the exact source scene/motion draft identity.')
  if(approval.value.subjectRevision!==source.sourceSceneRevision)return creativeRefusal('PROMOTION_SOURCE_APPROVAL_STALE',`Approval targets source revision ${approval.value.subjectRevision}; current source revision is ${source.sourceSceneRevision}.`)
  if(source.structuralQaPassed!==true)return creativeRefusal('PROMOTION_SOURCE_QA_FAILED','Promotion requires structural QA to have passed for the exact approved source revision.')
  if(!record(source.visualReviewEvidence)||!id(source.visualReviewEvidence.canonicalReviewRef)||!id(source.visualReviewEvidence.posterRef)||!Array.isArray(source.visualReviewEvidence.criticalFrameRefs)||source.visualReviewEvidence.criticalFrameRefs.length===0||!(source.visualReviewEvidence.criticalFrameRefs as unknown[]).every(id))return creativeRefusal('PROMOTION_SOURCE_VISUAL_EVIDENCE_REQUIRED','Promotion requires canonical review, poster and critical-frame evidence for the approved source revision.')
  if(!CAPABILITY_ORIGINS_V1.includes(source.origin as CapabilityOriginV1)||!Array.isArray(source.dependencies))return creativeRefusal('PROMOTION_SOURCE_INVALID','Promotion source origin/dependencies are invalid.')
  return creativeValidationOk(source as unknown as PromotionSourceV1)
}

export const validatePromotionCandidateV1=(input:unknown):CreativeValidationResultV1<PromotionCandidateV1>=>{
  if(!record(input)||input.schemaVersion!=='sanverse.promotion-candidate/v1')return creativeRefusal('UNSUPPORTED_PROMOTION_CANDIDATE_VERSION','Promotion candidate must use sanverse.promotion-candidate/v1.')
  if(!id(input.id)||!id(input.sourceProjectId)||!id(input.sourceSceneId)||!validRevision(input.sourceSceneRevision)||!validRevision(input.revision)||!id(input.sourceOwnerApprovalId))return creativeRefusal('INVALID_PROMOTION_CANDIDATE','Promotion candidate identity/revisions are invalid.')
  if(!Array.isArray(input.requestedTargetKinds)||input.requestedTargetKinds.length===0||!(input.requestedTargetKinds as unknown[]).every(kind=>PROMOTION_TARGET_KINDS_V1.includes(kind as PromotionTargetKindV1)))return creativeRefusal('INVALID_PROMOTION_CANDIDATE','Promotion candidate requires one or more supported target kinds.')
  if(!candidateStatuses.includes(input.status as PromotionCandidateStatusV1)||!CAPABILITY_ORIGINS_V1.includes(input.origin as CapabilityOriginV1)||input.reuseStatus!=='promotion-candidate')return creativeRefusal('INVALID_PROMOTION_CANDIDATE','Promotion candidate status/origin/reuse status is invalid.')
  return creativeValidationOk(input as unknown as PromotionCandidateV1)
}

export const createPromotionCandidateV1=(source:PromotionSourceV1,requestedTargetKinds:readonly PromotionTargetKindV1[],candidateId:string):CreativeOperationResultV1<PromotionCandidateV1>=>{
  const valid=validatePromotionSourceV1(source);if(!valid.ok)return creativeOperationRefusal(valid.refusal.code,valid.refusal.message,valid.refusal.details)
  if(!id(candidateId)||requestedTargetKinds.length===0||requestedTargetKinds.some(kind=>!PROMOTION_TARGET_KINDS_V1.includes(kind)))return creativeOperationRefusal('INVALID_PROMOTION_CANDIDATE','Candidate id/target kinds are invalid.')
  const candidate:PromotionCandidateV1=Object.freeze({schemaVersion:'sanverse.promotion-candidate/v1',id:candidateId,sourceProjectId:source.sourceProjectId,sourceProjectRevision:source.sourceProjectRevision,sourceSceneId:source.sourceSceneId,sourceSceneRevision:source.sourceSceneRevision,...(source.sourceStoryboardId?{sourceStoryboardId:source.sourceStoryboardId}:{}),...(source.sourceStoryboardRevision?{sourceStoryboardRevision:source.sourceStoryboardRevision}:{}),...(source.sourceAnimaticId?{sourceAnimaticId:source.sourceAnimaticId}:{}),...(source.sourceAnimaticRevision?{sourceAnimaticRevision:source.sourceAnimaticRevision}:{}),...(source.sourceMotionPlanId?{sourceMotionPlanId:source.sourceMotionPlanId}:{}),...(source.sourceMotionPlanRevision?{sourceMotionPlanRevision:source.sourceMotionPlanRevision}:{}),sourceOwnerApprovalId:source.motionApproval.id,requestedTargetKinds:Object.freeze([...new Set(requestedTargetKinds)]),status:'draft',revision:1,origin:source.origin,reuseStatus:'promotion-candidate'})
  return creativeOperationOk(candidate,1)
}

export const createPromotionWorkspaceV1=(workspaceId:string,candidate:PromotionCandidateV1):PromotionWorkspaceV1=>{if(!id(workspaceId))throw new RangeError('Promotion workspace id is required.');return Object.freeze({schemaVersion:'sanverse.promotion-workspace/v1',id:workspaceId,candidateId:candidate.id,baseCandidateRevision:candidate.revision,revision:1,status:'draft',appliedIdempotencyKeys:Object.freeze([])})}

export const applyPromotionTransactionV1=(workspace:PromotionWorkspaceV1,transaction:PromotionTransactionV1):CreativeOperationResultV1<AppliedPromotionTransactionV1>=>{
  if(!record(transaction)||transaction.schemaVersion!=='sanverse.promotion-transaction/v1'||!id(transaction.id)||!id(transaction.idempotencyKey)||!validRevision(transaction.baseRevision)||!Array.isArray(transaction.operations)||transaction.operations.length===0)return creativeOperationRefusal('INVALID_PROMOTION_TRANSACTION','Promotion transaction is invalid.')
  if(workspace.appliedIdempotencyKeys.includes(transaction.idempotencyKey))return creativeOperationOk(Object.freeze({workspace,inverseWorkspace:workspace,idempotentReplay:true}),workspace.revision)
  if(transaction.baseRevision!==workspace.revision)return creativeOperationRefusal('STALE_PROMOTION_REVISION',`Expected promotion workspace revision ${transaction.baseRevision}; current revision is ${workspace.revision}.`)
  let targetKind=workspace.targetKind,parameterizationPlanId=workspace.parameterizationPlanId,status=workspace.status
  for(const operation of transaction.operations){
    if(operation.type==='promotion.set-target-kind'){if(!PROMOTION_TARGET_KINDS_V1.includes(operation.targetKind))return creativeOperationRefusal('INVALID_PROMOTION_TRANSACTION','Unsupported promotion target kind.');targetKind=operation.targetKind}
    else if(operation.type==='promotion.set-parameterization-plan'){if(!id(operation.parameterizationPlanId))return creativeOperationRefusal('INVALID_PROMOTION_TRANSACTION','parameterizationPlanId is invalid.');parameterizationPlanId=operation.parameterizationPlanId}
    else if(operation.type==='promotion.set-status'){if(!workspaceStatuses.includes(operation.status))return creativeOperationRefusal('INVALID_PROMOTION_TRANSACTION','Promotion workspace status is invalid.');status=operation.status}
    else return creativeOperationRefusal('INVALID_PROMOTION_TRANSACTION','Promotion transaction contains an unsupported operation.')
  }
  const revision=workspace.revision+1
  const next:PromotionWorkspaceV1=Object.freeze({...workspace,...(targetKind?{targetKind}:{}),...(parameterizationPlanId?{parameterizationPlanId}:{}),status,revision,appliedIdempotencyKeys:Object.freeze([...workspace.appliedIdempotencyKeys,transaction.idempotencyKey])})
  return creativeOperationOk(Object.freeze({workspace:next,inverseWorkspace:workspace,idempotentReplay:false}),revision)
}

export const discardPromotionWorkspaceV1=(source:PromotionSourceV1,_workspace:PromotionWorkspaceV1):MotionSceneV1=>source.scene

export const serializePromotionCandidateV1=(candidate:PromotionCandidateV1):string=>JSON.stringify(candidate)
export const parsePromotionCandidateV1=(json:string):CreativeValidationResultV1<PromotionCandidateV1>=>{try{return validatePromotionCandidateV1(JSON.parse(json))}catch{return creativeRefusal('INVALID_PROMOTION_CANDIDATE_JSON','Promotion candidate JSON could not be parsed.')}}
