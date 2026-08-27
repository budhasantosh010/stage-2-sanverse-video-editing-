import { creativeOperationOk, creativeOperationRefusal, creativeValidationOk, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { evaluateMotionExpertAtTickV1, instantiateMotionExpertRecipeV1, type MotionExpertRecipeIdV1 } from '@sanverse/motion-expert-runtime'
import { inspectExternalMotionAssetV1, materializeExternalMotionAssetV1, type ExternalMotionProvenanceV1 } from '@sanverse/motion-external-bridge'
import type { MotionExpertSpecV1 } from '@sanverse/motion-graph'
import { createCreativeEngineV13ToolRegistryV1 } from './v13-workflow-tools.ts'
import type { ClosedLoopEngineV1 } from './closed-loop-engine.ts'
import type { PromotionReuseEngineV1 } from './promotion-reuse-engine.ts'
import type { SanverseToolDefinitionV1, SanverseToolRegistryV1 } from './registry.ts'

const outputSchema=Object.freeze({type:'object',required:['ok'],additionalProperties:true})
const schema=(required:readonly string[])=>Object.freeze({type:'object',required:Object.freeze([...required]),additionalProperties:true})
const record=(input:unknown):input is Record<string,unknown>=>Boolean(input)&&typeof input==='object'&&!Array.isArray(input)
const requiredRecord=(keys:readonly string[])=>(input:unknown):CreativeValidationResultV1<Record<string,unknown>>=>record(input)&&keys.every(key=>key in input)?creativeValidationOk(input):({ok:false,refusal:Object.freeze({code:'INVALID_TOOL_INPUT',message:`Tool input requires: ${keys.join(', ')}.`})})
const register=<I,O>(registry:SanverseToolRegistryV1,definition:SanverseToolDefinitionV1<I,O>)=>{const result=registry.register(definition as SanverseToolDefinitionV1);if(!result.ok)throw new RangeError(`${result.refusal.code}: ${result.refusal.message}`)}
const op=<T,>(result:CreativeValidationResultV1<T>)=>result.ok?creativeOperationOk(result.value,1):creativeOperationRefusal(result.refusal.code,result.refusal.message,result.refusal.details)

export const EXPERT_TOOL_IDS_V14=Object.freeze(['expert.instantiate-recipe','expert.evaluate-at-tick','external.inspect-procedural','external.materialize-procedural','external.inspect-shader','external.materialize-shader'] as const)
export const CREATIVE_ENGINE_V14_TOOL_IDS=EXPERT_TOOL_IDS_V14

export const registerCreativeEngineV14ToolsV1=(registry:SanverseToolRegistryV1):SanverseToolRegistryV1=>{
  register(registry,{id:'expert.instantiate-recipe',version:1,level:'T1',inputSchema:schema(['recipeId','width','height']),outputSchema,requiresSandbox:true,validateInput:requiredRecord(['recipeId','width','height']),execute:(input)=>op(instantiateMotionExpertRecipeV1({recipeId:String(input.recipeId) as MotionExpertRecipeIdV1,width:Number(input.width),height:Number(input.height),...(input.seed===undefined?{}:{seed:Number(input.seed)})}))})
  register(registry,{id:'expert.evaluate-at-tick',version:1,level:'T1',inputSchema:schema(['spec','tick']),outputSchema,requiresSandbox:true,validateInput:requiredRecord(['spec','tick']),execute:(input)=>op(evaluateMotionExpertAtTickV1({spec:input.spec as MotionExpertSpecV1,tick:Number(input.tick)}))})
  for(const sourceKind of ['procedural','shader'] as const){
    register(registry,{id:`external.inspect-${sourceKind}`,version:1,level:'T0',inputSchema:schema(['assetId','source','provenance']),outputSchema,requiresSandbox:false,validateInput:requiredRecord(['assetId','source','provenance']),execute:(input)=>op(inspectExternalMotionAssetV1({assetId:String(input.assetId),sourceKind,bytes:String(input.source),provenance:input.provenance as ExternalMotionProvenanceV1}))})
    register(registry,{id:`external.materialize-${sourceKind}`,version:1,level:'T1',inputSchema:schema(['assetId','source','provenance']),outputSchema,requiresSandbox:true,validateInput:requiredRecord(['assetId','source','provenance']),execute:(input)=>{const source=String(input.source);const inspection=inspectExternalMotionAssetV1({assetId:String(input.assetId),sourceKind,bytes:source,provenance:input.provenance as ExternalMotionProvenanceV1});if(!inspection.ok)return creativeOperationRefusal(inspection.refusal.code,inspection.refusal.message,inspection.refusal.details);return op(materializeExternalMotionAssetV1(inspection.value,source))}})
  }
  return registry
}

export const createCreativeEngineV14ToolRegistryV1=(closedLoop:ClosedLoopEngineV1,promotion:PromotionReuseEngineV1):SanverseToolRegistryV1=>registerCreativeEngineV14ToolsV1(createCreativeEngineV13ToolRegistryV1(closedLoop,promotion))
