import { creativeOperationRefusal, creativeValidationOk, type CreativeOperationResultV1, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import type { OwnerApprovalV1 } from '@sanverse/motion-storyboard'
import type { LocalizedRepairProposalV1, VisualQaFindingV1 } from './quality-lifecycle.ts'
import { createSanverseToolRegistryV1, type SanverseToolDefinitionV1, type SanverseToolRegistryV1, type ToolExecutionContextV1 } from './registry.ts'
import type { ClosedLoopEngineV1, ClosedLoopReviewRequestV1 } from './closed-loop-engine.ts'

const objectSchema=Object.freeze({type:'object',additionalProperties:true})
const outputSchema=Object.freeze({type:'object',required:['ok'],additionalProperties:true})
const record=(input:unknown):CreativeValidationResultV1<Record<string,unknown>>=>input!==null&&typeof input==='object'&&!Array.isArray(input)?creativeValidationOk(input as Record<string,unknown>):({ok:false,refusal:Object.freeze({code:'INVALID_TOOL_INPUT',message:'Tool input must be an object.'})})
const noInput=(input:unknown):CreativeValidationResultV1<Record<string,never>>=>input===undefined||input===null||(typeof input==='object'&&!Array.isArray(input)&&Object.keys(input as object).length===0)?creativeValidationOk(Object.freeze({})):({ok:false,refusal:Object.freeze({code:'INVALID_TOOL_INPUT',message:'This tool does not accept input fields.'})})
const sandboxMismatch=(engine:ClosedLoopEngineV1,context:ToolExecutionContextV1):CreativeOperationResultV1<never>|null=>{const active=engine.getState().storyboardSandbox?.id;if(!active)return creativeOperationRefusal('STORYBOARD_SANDBOX_REQUIRED','No active Closed-Loop storyboard sandbox exists.');return context.sandboxId===active?null:creativeOperationRefusal('SANDBOX_CONTEXT_MISMATCH',`Tool context sandbox ${context.sandboxId??'<missing>'} does not match active sandbox ${active}.`)}
const register=<I,O>(registry:SanverseToolRegistryV1,definition:SanverseToolDefinitionV1<I,O>)=>{const result=registry.register(definition as SanverseToolDefinitionV1);if(!result.ok)throw new RangeError(`${result.refusal.code}: ${result.refusal.message}`)}

export const CLOSED_LOOP_TOOL_IDS_V1=Object.freeze([
  'get_project_context','create_storyboard_sandbox','revise_storyboard','validate_storyboard','build_animatic','revise_animatic','validate_animatic','build_motion_plan','revise_motion','validate_motion','render_review','set_visual_findings','request_owner_review','record_owner_approval','apply_approved_sandbox','undo_last_creative_merge','discard_sandbox',
] as const)

export const createClosedLoopToolRegistryV1=(engine:ClosedLoopEngineV1):SanverseToolRegistryV1=>{
  const registry=createSanverseToolRegistryV1()
  register(registry,{id:'get_project_context',version:1,level:'T0',inputSchema:Object.freeze({type:'object',additionalProperties:false}),outputSchema,requiresSandbox:false,validateInput:noInput,execute:()=>({ok:true,value:engine.getState(),revision:engine.getState().acceptedProject.revision})})
  register(registry,{id:'create_storyboard_sandbox',version:1,level:'T1',inputSchema:objectSchema,outputSchema,requiresSandbox:false,validateInput:record,execute:(input)=>engine.createStoryboardSandbox(String(input.sandboxId??''),input.storyboard as never)})
  register(registry,{id:'revise_storyboard',version:1,level:'T1',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.reviseStoryboard(input as never)})
  register(registry,{id:'validate_storyboard',version:1,level:'T0',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.validateStoryboard(input as never)})
  register(registry,{id:'build_animatic',version:1,level:'T1',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.buildAnimatic(input as never)})
  register(registry,{id:'revise_animatic',version:1,level:'T1',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.reviseAnimatic(input as never)})
  register(registry,{id:'validate_animatic',version:1,level:'T0',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.validateAnimatic(input as never)})
  register(registry,{id:'build_motion_plan',version:1,level:'T1',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.buildMotionPlan(input as never)})
  register<Record<string,unknown>,unknown>(registry,{id:'revise_motion',version:1,level:'T1',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>{const mismatch=sandboxMismatch(engine,context);if(mismatch)return mismatch;const action=String(input.action??'');if(action==='build')return engine.buildMotionDraft({id:String(input.id??'')});if(action==='repair')return engine.repairMotion(input.proposal as LocalizedRepairProposalV1);return creativeOperationRefusal('INVALID_MOTION_REVISION_ACTION','revise_motion action must be build or repair.')}})
  register(registry,{id:'validate_motion',version:1,level:'T0',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.validateMotion(input as never)})
  register(registry,{id:'render_review',version:1,level:'T0',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.renderReview(input as unknown as ClosedLoopReviewRequestV1)})
  register(registry,{id:'set_visual_findings',version:1,level:'T1',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.setVisualFindings(Object.freeze([...(Array.isArray(input.findings)?input.findings:[])]) as readonly VisualQaFindingV1[])})
  register(registry,{id:'request_owner_review',version:1,level:'T1',inputSchema:objectSchema,outputSchema,requiresSandbox:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.requestOwnerReview(String(input.stage??'') as never)})
  register(registry,{id:'record_owner_approval',version:1,level:'T2',inputSchema:objectSchema,outputSchema,requiresSandbox:true,requiresOwnerApproval:true,validateInput:record,execute:(input,context)=>sandboxMismatch(engine,context)??engine.recordOwnerApproval(input.approval as OwnerApprovalV1)})
  register(registry,{id:'apply_approved_sandbox',version:1,level:'T2',inputSchema:Object.freeze({type:'object',additionalProperties:false}),outputSchema,requiresSandbox:true,requiresOwnerApproval:false,validateInput:noInput,execute:(_input,context)=>sandboxMismatch(engine,context)??engine.applyApprovedSandbox()})
  register(registry,{id:'undo_last_creative_merge',version:1,level:'T2',inputSchema:Object.freeze({type:'object',additionalProperties:false}),outputSchema,requiresSandbox:false,validateInput:noInput,execute:()=>engine.undoLastCreativeMerge()})
  register(registry,{id:'discard_sandbox',version:1,level:'T2',inputSchema:Object.freeze({type:'object',additionalProperties:false}),outputSchema,requiresSandbox:true,validateInput:noInput,execute:(_input,context)=>sandboxMismatch(engine,context)??engine.discardSandbox()})
  return registry
}
