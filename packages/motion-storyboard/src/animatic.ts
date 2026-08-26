import { creativeOperationOk, creativeOperationRefusal, type CreativeOperationResultV1 } from '@sanverse/motion-contract'
import { validateOwnerApprovalV1, type OwnerApprovalV1, type StoryboardV1 } from './contracts.ts'

export interface AnimaticStateTimingV1 { readonly stateId: string; readonly startTick: number; readonly endTick: number }
export type AnimaticStatusV1 = 'draft' | 'qa' | 'awaiting-owner' | 'owner-approved'
export interface AnimaticAudioReferenceV1 { readonly sourceId: string; readonly assetRef?: string }
export interface AnimaticV1 {
  readonly id: string
  readonly storyboardId: string
  readonly storyboardApprovedRevision: number
  readonly timings: readonly AnimaticStateTimingV1[]
  readonly sourceAudioRef?: AnimaticAudioReferenceV1
  readonly revision: number
  readonly status: AnimaticStatusV1
}

export const ANIMATIC_CHEAP_TRANSITIONS_V1 = Object.freeze(['hold','cut','simple-crossfade-placeholder'] as const)
export type AnimaticCheapTransitionV1 = (typeof ANIMATIC_CHEAP_TRANSITIONS_V1)[number]

export type AnimaticOperationV1 =
  | Readonly<{ type:'animatic.set-state-timing'; stateId:string; startTick:number; endTick:number }>
  | Readonly<{ type:'animatic.extend-hold'; stateId:string; deltaTicks:number }>
  | Readonly<{ type:'animatic.compress-state'; stateId:string; deltaTicks:number }>
  | Readonly<{ type:'animatic.shift-state'; stateId:string; deltaTicks:number }>
  | Readonly<{ type:'animatic.align-to-source-word'; stateId:string; sourceStartTick:number; sourceEndTick:number }>
  | Readonly<{ type:'animatic.align-to-source-phrase'; stateId:string; sourceStartTick:number; sourceEndTick:number }>

export interface AnimaticTransactionV1 { readonly transactionId:string; readonly expectedRevision:number; readonly operations:readonly AnimaticOperationV1[] }
export interface AppliedAnimaticTransactionV1 { readonly animatic:AnimaticV1; readonly inverse:AnimaticTransactionV1 }

export interface AnimaticQaFindingV1 { readonly code:'STATE_ORDER'|'GAP'|'ILLEGAL_OVERLAP'|'READABLE_HOLD'|'SOURCE_BOUNDS'|'SPEECH_VISUAL_ALIGNMENT'|'EXCESSIVE_STATE_DENSITY'; readonly severity:'warning'|'error'; readonly message:string; readonly stateIds:readonly string[] }
export interface AnimaticQaReportV1 { readonly ok:boolean; readonly findings:readonly AnimaticQaFindingV1[] }
export interface AnimaticSourceAlignmentV1 { readonly stateId:string; readonly startTick:number; readonly endTick:number }
export interface AnimaticQaOptionsV1 { readonly minimumReadableHoldTicks:number; readonly sourceRegion:Readonly<{startTick:number;endTick:number}>; readonly sourceAlignments?:readonly AnimaticSourceAlignmentV1[]; readonly maximumStatesPerSecond?:number; readonly ticksPerSecond?:number }

export interface AnimaticOwnerCommentV1 { readonly id:string; readonly startTick:number; readonly endTick:number; readonly comment:string }
export interface AnimaticReviewModelV1 { readonly animaticId:string; readonly revision:number; readonly sourceAudioRef?:AnimaticAudioReferenceV1; readonly visualHolds:readonly Readonly<{stateId:string;startTick:number;endTick:number}>[]; readonly controls:readonly ['play','pause','scrub','loop']; readonly comments:readonly AnimaticOwnerCommentV1[] }
export interface ApprovedAnimaticV1 { readonly animatic:AnimaticV1; readonly approval:OwnerApprovalV1 }

const validId=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=240
const validRange=(start:number,end:number):boolean=>Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>start

export const validateAnimaticV1=(animatic:AnimaticV1,storyboard?:StoryboardV1):readonly string[]=>{
  const issues:string[]=[]
  if(!validId(animatic.id)||!validId(animatic.storyboardId)||!Number.isSafeInteger(animatic.storyboardApprovedRevision)||animatic.storyboardApprovedRevision<1||!Number.isSafeInteger(animatic.revision)||animatic.revision<1)issues.push('Animatic identity/revisions are invalid.')
  if(!['draft','qa','awaiting-owner','owner-approved'].includes(animatic.status))issues.push('Animatic status is invalid.')
  const ids=new Set<string>()
  for(const timing of animatic.timings){ if(!validId(timing.stateId)||!validRange(timing.startTick,timing.endTick))issues.push(`Invalid timing: ${timing.stateId}`); if(ids.has(timing.stateId))issues.push(`Duplicate state timing: ${timing.stateId}`); ids.add(timing.stateId) }
  if(storyboard){
    if(animatic.storyboardId!==storyboard.id||animatic.storyboardApprovedRevision!==storyboard.revision||storyboard.status!=='owner-approved')issues.push('Animatic must target the exact owner-approved storyboard revision.')
    const stateIds=new Set(storyboard.states.map((state)=>state.id)); for(const timing of animatic.timings)if(!stateIds.has(timing.stateId))issues.push(`Animatic timing references unknown storyboard state: ${timing.stateId}`)
  }
  return Object.freeze(issues)
}

export const createAnimaticV1=(input:Omit<AnimaticV1,'status'|'revision'>,storyboard:StoryboardV1):AnimaticV1=>{
  const value:AnimaticV1=Object.freeze({...input,timings:Object.freeze([...input.timings]),status:'draft',revision:1})
  const issues=validateAnimaticV1(value,storyboard); if(issues.length)throw new RangeError(issues.join(' ')); return value
}

const operationForPrevious=(current:AnimaticStateTimingV1,previous:AnimaticStateTimingV1):AnimaticOperationV1=>Object.freeze({type:'animatic.set-state-timing',stateId:current.stateId,startTick:previous.startTick,endTick:previous.endTick})
const transformTiming=(timing:AnimaticStateTimingV1,operation:AnimaticOperationV1):AnimaticStateTimingV1|{error:string}=>{
  if(operation.type==='animatic.set-state-timing'||operation.type==='animatic.align-to-source-word'||operation.type==='animatic.align-to-source-phrase'){
    const startTick=operation.type==='animatic.set-state-timing'?operation.startTick:operation.sourceStartTick; const endTick=operation.type==='animatic.set-state-timing'?operation.endTick:operation.sourceEndTick
    if(!validRange(startTick,endTick))return{error:'Animatic timing range is invalid.'}; return Object.freeze({...timing,startTick,endTick})
  }
  if(!Number.isSafeInteger(operation.deltaTicks))return{error:'Animatic deltaTicks must be a safe integer.'}
  if(operation.type==='animatic.extend-hold'){const endTick=timing.endTick+operation.deltaTicks;if(!validRange(timing.startTick,endTick))return{error:'Extended hold would produce an invalid timing.'};return Object.freeze({...timing,endTick})}
  if(operation.type==='animatic.compress-state'){const endTick=timing.endTick-Math.abs(operation.deltaTicks);if(!validRange(timing.startTick,endTick))return{error:'Compressed state would produce an invalid timing.'};return Object.freeze({...timing,endTick})}
  const startTick=timing.startTick+operation.deltaTicks,endTick=timing.endTick+operation.deltaTicks;if(!validRange(startTick,endTick))return{error:'Shifted state would produce an invalid timing.'};return Object.freeze({...timing,startTick,endTick})
}

export const applyAnimaticTransactionV1=(animatic:AnimaticV1,transaction:AnimaticTransactionV1):CreativeOperationResultV1<AppliedAnimaticTransactionV1>=>{
  if(!validId(transaction.transactionId)||transaction.operations.length===0)return creativeOperationRefusal('ANIMATIC_TRANSACTION_INVALID','Animatic transaction needs an id and at least one operation.')
  if(transaction.expectedRevision!==animatic.revision)return creativeOperationRefusal('STALE_ANIMATIC_REVISION',`Expected animatic revision ${transaction.expectedRevision}; current revision is ${animatic.revision}.`)
  if(animatic.status==='owner-approved')return creativeOperationRefusal('ANIMATIC_LOCKED','Owner-approved animatic timing cannot be mutated in place.')
  const timings=[...animatic.timings]; const inverse:AnimaticOperationV1[]=[]
  for(const operation of transaction.operations){const index=timings.findIndex((item)=>item.stateId===operation.stateId);if(index<0)return creativeOperationRefusal('ANIMATIC_STATE_NOT_FOUND',`Unknown animatic state: ${operation.stateId}`);const previous=timings[index]!;const next=transformTiming(previous,operation);if('error'in next)return creativeOperationRefusal('ANIMATIC_TRANSACTION_FAILED',next.error);timings[index]=next;inverse.unshift(operationForPrevious(next,previous))}
  const revision=animatic.revision+1; const next:AnimaticV1=Object.freeze({...animatic,timings:Object.freeze(timings),revision,status:'draft'})
  const issues=validateAnimaticV1(next);if(issues.length)return creativeOperationRefusal('ANIMATIC_TRANSACTION_FAILED',issues.join(' '))
  return creativeOperationOk(Object.freeze({animatic:next,inverse:Object.freeze({transactionId:`${transaction.transactionId}:inverse`,expectedRevision:revision,operations:Object.freeze(inverse)})}),revision)
}

const qaFinding=(code:AnimaticQaFindingV1['code'],severity:AnimaticQaFindingV1['severity'],message:string,stateIds:readonly string[]):AnimaticQaFindingV1=>Object.freeze({code,severity,message,stateIds:Object.freeze([...stateIds])})
export const runAnimaticQaV1=(animatic:AnimaticV1,storyboard:StoryboardV1,options:AnimaticQaOptionsV1):AnimaticQaReportV1=>{
  const findings:AnimaticQaFindingV1[]=[]; const storyboardOrder=new Map(storyboard.states.map((state,index)=>[state.id,index])); let previous:AnimaticStateTimingV1|null=null; let priorOrder=-1
  for(const timing of animatic.timings){const order=storyboardOrder.get(timing.stateId);if(order===undefined||order<priorOrder)findings.push(qaFinding('STATE_ORDER','error',`${timing.stateId} is out of storyboard order.`,[timing.stateId]));if(order!==undefined)priorOrder=order
    if(previous){if(timing.startTick>previous.endTick)findings.push(qaFinding('GAP','error',`Gap between ${previous.stateId} and ${timing.stateId}.`,[previous.stateId,timing.stateId]));if(timing.startTick<previous.endTick)findings.push(qaFinding('ILLEGAL_OVERLAP','error',`Illegal overlap between ${previous.stateId} and ${timing.stateId}.`,[previous.stateId,timing.stateId]))}
    if(timing.endTick-timing.startTick<options.minimumReadableHoldTicks)findings.push(qaFinding('READABLE_HOLD','warning',`${timing.stateId} hold is shorter than the readable minimum.`,[timing.stateId]))
    if(timing.startTick<options.sourceRegion.startTick||timing.endTick>options.sourceRegion.endTick)findings.push(qaFinding('SOURCE_BOUNDS','error',`${timing.stateId} timing falls outside the source region.`,[timing.stateId]))
    const alignment=options.sourceAlignments?.find((item)=>item.stateId===timing.stateId);if(alignment&&Math.min(timing.endTick,alignment.endTick)<=Math.max(timing.startTick,alignment.startTick))findings.push(qaFinding('SPEECH_VISUAL_ALIGNMENT','warning',`${timing.stateId} does not overlap its source speech timing.`,[timing.stateId])); previous=timing }
  const tps=options.ticksPerSecond??1_440_000,maxDensity=options.maximumStatesPerSecond??4,duration=Math.max(1,options.sourceRegion.endTick-options.sourceRegion.startTick)/tps;if(animatic.timings.length/duration>maxDensity)findings.push(qaFinding('EXCESSIVE_STATE_DENSITY','warning','Animatic has excessive state density for the source duration.',animatic.timings.map((item)=>item.stateId)))
  return Object.freeze({ok:findings.every((item)=>item.severity!=='error'),findings:Object.freeze(findings)})
}

export const buildAnimaticReviewModelV1=(animatic:AnimaticV1,comments:readonly AnimaticOwnerCommentV1[]=[]):AnimaticReviewModelV1=>Object.freeze({animaticId:animatic.id,revision:animatic.revision,...(animatic.sourceAudioRef?{sourceAudioRef:animatic.sourceAudioRef}:{}),visualHolds:Object.freeze(animatic.timings.map((item)=>Object.freeze({...item}))),controls:Object.freeze(['play','pause','scrub','loop'] as const),comments:Object.freeze([...comments])})

export const approveAnimaticV1=(animatic:AnimaticV1,approval:OwnerApprovalV1,qa:AnimaticQaReportV1):CreativeOperationResultV1<ApprovedAnimaticV1>=>{
  if(!qa.ok)return creativeOperationRefusal('ANIMATIC_QA_FAILED','Animatic cannot be owner-approved while deterministic QA has errors.',qa.findings)
  const valid=validateOwnerApprovalV1(approval);if(!valid.ok)return creativeOperationRefusal(valid.refusal.code,valid.refusal.message,valid.refusal.details)
  if(approval.scope!=='animatic'||approval.subjectId!==animatic.id||approval.subjectRevision!==animatic.revision)return creativeOperationRefusal('APPROVAL_REVISION_MISMATCH','Animatic approval must target the exact current timing revision.')
  const approved=Object.freeze({...animatic,status:'owner-approved' as const});return creativeOperationOk(Object.freeze({animatic:approved,approval:valid.value}),animatic.revision)
}
