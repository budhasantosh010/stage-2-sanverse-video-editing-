import { creativeOperationOk, creativeOperationRefusal, creativeValidationOk, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import type { MotionPlanV1 } from '@sanverse/creative-direction'
import { assessMotionExpertPerformanceV15, evaluateMotionExpertWithinBudgetV15, type MotionExpertPerformanceBudgetV15 } from '@sanverse/motion-expert-runtime'
import { inspectExternalMotionAssetV1, materializeExternalMotionAssetV1, type ExternalMotionProvenanceV1 } from '@sanverse/motion-external-bridge'
import type { MotionExpertSpecV1, MotionSceneV1 } from '@sanverse/motion-graph'
import { applyMotionPlanAtomicV15 } from './atomic-motion-plan-v15.ts'
import { registerCreativeEngineV14ToolsV1 } from './v14-workflow-tools.ts'
import type { SanverseToolDefinitionV1, SanverseToolRegistryV1 } from './registry.ts'

const outputSchema=Object.freeze({type:'object',required:['ok'],additionalProperties:true})
const schema=(required:readonly string[])=>Object.freeze({type:'object',required:Object.freeze([...required]),additionalProperties:true})
const record=(input:unknown):input is Record<string,unknown>=>Boolean(input)&&typeof input==='object'&&!Array.isArray(input)
const requiredRecord=(keys:readonly string[])=>(input:unknown):CreativeValidationResultV1<Record<string,unknown>>=>record(input)&&keys.every(key=>key in input)?creativeValidationOk(input):({ok:false,refusal:Object.freeze({code:'INVALID_TOOL_INPUT',message:`Tool input requires: ${keys.join(', ')}.`})})
const register=<I,O>(registry:SanverseToolRegistryV1,definition:SanverseToolDefinitionV1<I,O>)=>{const result=registry.register(definition as SanverseToolDefinitionV1);if(!result.ok)throw new RangeError(`${result.refusal.code}: ${result.refusal.message}`)}
const op=<T,>(result:CreativeValidationResultV1<T>)=>result.ok?creativeOperationOk(result.value,1):creativeOperationRefusal(result.refusal.code,result.refusal.message,result.refusal.details)

export const CREATIVE_ENGINE_V15_TOOL_IDS=Object.freeze([
  'motion.apply-plan-atomic-v15',
  'expert.assess-performance-v15',
  'expert.evaluate-within-budget-v15',
  'external.inspect-three-webgl',
  'external.materialize-three-webgl',
  'external.inspect-aep',
  'external.materialize-aep',
  'external.inspect-mogrt',
  'external.materialize-mogrt',
] as const)

export const registerCreativeEngineV15ToolsV1=(registry:SanverseToolRegistryV1):SanverseToolRegistryV1=>{
  register(registry,{id:'motion.apply-plan-atomic-v15',version:1,level:'T1',inputSchema:schema(['scene','plan']),outputSchema,requiresSandbox:true,validateInput:requiredRecord(['scene','plan']),execute:(input)=>applyMotionPlanAtomicV15(input.scene as MotionSceneV1,input.plan as MotionPlanV1)})
  register(registry,{id:'expert.assess-performance-v15',version:1,level:'T0',inputSchema:schema(['spec']),outputSchema,requiresSandbox:false,validateInput:requiredRecord(['spec']),execute:(input)=>creativeOperationOk(assessMotionExpertPerformanceV15({spec:input.spec as MotionExpertSpecV1,...(input.measuredEvaluationMs===undefined?{}:{measuredEvaluationMs:Number(input.measuredEvaluationMs)})}),1)})
  register(registry,{id:'expert.evaluate-within-budget-v15',version:1,level:'T1',inputSchema:schema(['spec','tick','budget']),outputSchema,requiresSandbox:true,validateInput:requiredRecord(['spec','tick','budget']),execute:(input)=>op(evaluateMotionExpertWithinBudgetV15({spec:input.spec as MotionExpertSpecV1,tick:Number(input.tick),budget:input.budget as MotionExpertPerformanceBudgetV15,...(input.measuredEvaluationMs===undefined?{}:{measuredEvaluationMs:Number(input.measuredEvaluationMs)})}))})
  for(const sourceKind of ['three-webgl','aep','mogrt'] as const){
    register(registry,{id:`external.inspect-${sourceKind}`,version:1,level:'T0',inputSchema:schema(['assetId','source','provenance']),outputSchema,requiresSandbox:false,validateInput:requiredRecord(['assetId','source','provenance']),execute:(input)=>op(inspectExternalMotionAssetV1({assetId:String(input.assetId),sourceKind,bytes:String(input.source),provenance:input.provenance as ExternalMotionProvenanceV1}))})
    register(registry,{id:`external.materialize-${sourceKind}`,version:1,level:'T1',inputSchema:schema(['assetId','source','provenance']),outputSchema,requiresSandbox:true,validateInput:requiredRecord(['assetId','source','provenance']),execute:(input)=>{const source=String(input.source);const inspection=inspectExternalMotionAssetV1({assetId:String(input.assetId),sourceKind,bytes:source,provenance:input.provenance as ExternalMotionProvenanceV1});if(!inspection.ok)return creativeOperationRefusal(inspection.refusal.code,inspection.refusal.message,inspection.refusal.details);return op(materializeExternalMotionAssetV1(inspection.value,source))}})
  }
  return registry
}

export const createCreativeEngineV15ToolRegistryV1=(registry:SanverseToolRegistryV1):SanverseToolRegistryV1=>registerCreativeEngineV15ToolsV1(registerCreativeEngineV14ToolsV1(registry))
