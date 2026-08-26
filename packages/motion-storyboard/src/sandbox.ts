import { creativeOperationOk, creativeOperationRefusal, type CreativeOperationResultV1 } from '@sanverse/motion-contract'
import { createStoryboardV1, validateKeyVisualStateV1, validatePresentationSetupV1, validateStoryboardV1, type KeyVisualStateV1, type OwnerApprovalV1, type StoryboardPresentationSetupV1, type StoryboardStatusV1, type StoryboardV1 } from './contracts.ts'

export interface CreativeSandboxLocksV1 { readonly content:boolean; readonly style:boolean; readonly storyboard:boolean; readonly animatic:boolean; readonly motion:boolean }
export interface StoryboardSandboxTransactionLogV1 { readonly transactionId:string; readonly fromRevision:number; readonly toRevision:number; readonly operationTypes:readonly StoryboardSandboxOperationV1['type'][] }
export interface StoryboardSandboxV1 {
  readonly schemaVersion:'sanverse.storyboard-sandbox/v1'
  readonly id:string
  readonly baseProjectRevision:number
  readonly sandboxRevision:number
  readonly storyboard:StoryboardV1
  readonly locks:CreativeSandboxLocksV1
  readonly approvals:readonly OwnerApprovalV1[]
  readonly transactions:readonly StoryboardSandboxTransactionLogV1[]
}
export type StoryboardSandboxOperationV1 =
  | Readonly<{type:'add-state';state:KeyVisualStateV1;index?:number}>
  | Readonly<{type:'replace-state';stateId:string;state:KeyVisualStateV1}>
  | Readonly<{type:'remove-state';stateId:string}>
  | Readonly<{type:'set-setup';setup:StoryboardPresentationSetupV1}>
  | Readonly<{type:'set-status';status:StoryboardStatusV1}>
export interface StoryboardSandboxTransactionV1 { readonly transactionId:string; readonly expectedSandboxRevision:number; readonly operations:readonly StoryboardSandboxOperationV1[] }
export interface AppliedStoryboardSandboxTransactionV1 { readonly sandbox:StoryboardSandboxV1; readonly inverse:StoryboardSandboxTransactionV1 }

const id=(value:string):boolean=>value.trim().length>0&&value.length<=240
export const createStoryboardSandboxV1=(sandboxId:string,baseProjectRevision:number,storyboard:StoryboardV1):StoryboardSandboxV1=>{
  if(!id(sandboxId)||!Number.isSafeInteger(baseProjectRevision)||baseProjectRevision<0) throw new RangeError('Sandbox id/base project revision is invalid.')
  const valid=validateStoryboardV1(storyboard); if(!valid.ok) throw new RangeError(`${valid.refusal.code}: ${valid.refusal.message}`)
  return Object.freeze({schemaVersion:'sanverse.storyboard-sandbox/v1',id:sandboxId,baseProjectRevision,sandboxRevision:1,storyboard:valid.value,locks:Object.freeze({content:false,style:false,storyboard:false,animatic:false,motion:false}),approvals:Object.freeze([]),transactions:Object.freeze([])})
}

const changedStoryboard=(storyboard:StoryboardV1,changes:Partial<Pick<StoryboardV1,'setup'|'states'|'status'>>):StoryboardV1=>createStoryboardV1({ ...storyboard,...changes,revision:storyboard.revision+1,status:changes.status??'draft',ownerApprovalId:undefined })
const applyOne=(storyboard:StoryboardV1,operation:StoryboardSandboxOperationV1):{storyboard:StoryboardV1;inverse:StoryboardSandboxOperationV1}|{error:string}=>{
  if(operation.type==='add-state'){
    const valid=validateKeyVisualStateV1(operation.state); if(!valid.ok)return{error:valid.refusal.message}
    if(storyboard.states.some(state=>state.id===valid.value.id))return{error:`State already exists: ${valid.value.id}`}
    const index=operation.index??storyboard.states.length; if(!Number.isSafeInteger(index)||index<0||index>storyboard.states.length)return{error:'add-state index is invalid.'}
    const states=[...storyboard.states]; states.splice(index,0,valid.value)
    try{return{storyboard:changedStoryboard(storyboard,{states:Object.freeze(states)}),inverse:Object.freeze({type:'remove-state',stateId:valid.value.id})}}catch(error){return{error:error instanceof Error?error.message:'add-state failed.'}}
  }
  if(operation.type==='replace-state'){
    const index=storyboard.states.findIndex(state=>state.id===operation.stateId); if(index<0)return{error:`Unknown state: ${operation.stateId}`}
    const valid=validateKeyVisualStateV1(operation.state); if(!valid.ok)return{error:valid.refusal.message}
    if(valid.value.id!==operation.stateId)return{error:'replace-state cannot change stable state identity.'}
    const previous=storyboard.states[index]!; const states=[...storyboard.states]; states[index]=valid.value
    try{return{storyboard:changedStoryboard(storyboard,{states:Object.freeze(states)}),inverse:Object.freeze({type:'replace-state',stateId:previous.id,state:previous})}}catch(error){return{error:error instanceof Error?error.message:'replace-state failed.'}}
  }
  if(operation.type==='remove-state'){
    const index=storyboard.states.findIndex(state=>state.id===operation.stateId); if(index<0)return{error:`Unknown state: ${operation.stateId}`}
    const previous=storyboard.states[index]!; const states=storyboard.states.filter(state=>state.id!==operation.stateId)
    try{return{storyboard:changedStoryboard(storyboard,{states:Object.freeze(states)}),inverse:Object.freeze({type:'add-state',state:previous,index})}}catch(error){return{error:error instanceof Error?error.message:'remove-state failed.'}}
  }
  if(operation.type==='set-setup'){
    const valid=validatePresentationSetupV1(operation.setup); if(!valid.ok)return{error:valid.refusal.message}; const previous=storyboard.setup
    try{return{storyboard:changedStoryboard(storyboard,{setup:valid.value}),inverse:Object.freeze({type:'set-setup',setup:previous})}}catch(error){return{error:error instanceof Error?error.message:'set-setup failed.'}}
  }
  const previous=storyboard.status
  if(!['draft','qa','awaiting-owner','owner-approved','rejected'].includes(operation.status))return{error:'set-status value is invalid.'}
  try{return{storyboard:changedStoryboard(storyboard,{status:operation.status}),inverse:Object.freeze({type:'set-status',status:previous})}}catch(error){return{error:error instanceof Error?error.message:'set-status failed.'}}
}

export const applyStoryboardSandboxTransactionV1=(sandbox:StoryboardSandboxV1,transaction:StoryboardSandboxTransactionV1):CreativeOperationResultV1<AppliedStoryboardSandboxTransactionV1>=>{
  if(!id(transaction.transactionId)||transaction.operations.length===0)return creativeOperationRefusal('SANDBOX_TRANSACTION_INVALID','Storyboard sandbox transaction requires an id and at least one operation.')
  if(transaction.expectedSandboxRevision!==sandbox.sandboxRevision)return creativeOperationRefusal('STALE_SANDBOX_REVISION',`Expected sandbox revision ${transaction.expectedSandboxRevision}; current revision is ${sandbox.sandboxRevision}.`)
  if(sandbox.locks.storyboard)return creativeOperationRefusal('STORYBOARD_LOCKED','Storyboard is locked; unlock it before mutation.')
  let current=sandbox.storyboard; const inverse:StoryboardSandboxOperationV1[]=[]
  for(const operation of transaction.operations){ const result=applyOne(current,operation); if('error'in result)return creativeOperationRefusal('SANDBOX_TRANSACTION_FAILED',`Atomic storyboard transaction refused: ${result.error}`); current=result.storyboard; inverse.unshift(result.inverse) }
  const valid=validateStoryboardV1(current); if(!valid.ok)return creativeOperationRefusal('SANDBOX_TRANSACTION_FAILED',`Atomic storyboard transaction produced invalid state: ${valid.refusal.message}`)
  const nextRevision=sandbox.sandboxRevision+1
  const next:StoryboardSandboxV1=Object.freeze({...sandbox,sandboxRevision:nextRevision,storyboard:valid.value,approvals:Object.freeze(sandbox.approvals.filter(approval=>approval.scope!=='storyboard')),transactions:Object.freeze([...sandbox.transactions,Object.freeze({transactionId:transaction.transactionId,fromRevision:sandbox.sandboxRevision,toRevision:nextRevision,operationTypes:Object.freeze(transaction.operations.map(operation=>operation.type))})])})
  return creativeOperationOk(Object.freeze({sandbox:next,inverse:Object.freeze({transactionId:`${transaction.transactionId}:inverse`,expectedSandboxRevision:nextRevision,operations:Object.freeze(inverse)})}), nextRevision)
}

export const findStoryboardStateAtTickV1=(storyboard:StoryboardV1,tick:number,sourceId?:string):KeyVisualStateV1|null=>{
  if(!Number.isSafeInteger(tick)||tick<0)return null
  const candidates=storyboard.states.filter(state=>!sourceId||state.sourceFrameRef?.sourceId===sourceId)
  if(candidates.length===0)return null
  return [...candidates].sort((a,b)=>Math.abs(a.approximateTick-tick)-Math.abs(b.approximateTick-tick)||a.approximateTick-b.approximateTick)[0]??null
}
