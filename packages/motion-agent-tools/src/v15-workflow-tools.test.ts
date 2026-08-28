import { describe,expect,it } from 'vitest'
import { instantiateMotionExpertRecipeV1 } from '@sanverse/motion-expert-runtime'
import { createSanverseToolRegistryV1 } from './registry.ts'
import { CREATIVE_ENGINE_V15_TOOL_IDS,registerCreativeEngineV15ToolsV1 } from './v15-workflow-tools.ts'

const provenance=(sourceKind:'three-webgl'|'aep'|'mogrt')=>({schemaVersion:'sanverse.external-motion-provenance/v1' as const,sourceKind,sourceName:'owner fixture',rightsClass:'owner-authored' as const,attributionRequired:false,reusableLibraryAllowed:true,projectUseAllowed:true,aiModificationAllowed:true,restrictions:Object.freeze([])})

describe('Creative Engine V1.5 internal tool surface',()=>{
  it('registers the bounded V1.5 batching/performance/bridge tools in the canonical registry',()=>{
    const registry=registerCreativeEngineV15ToolsV1(createSanverseToolRegistryV1())
    expect(registry.list().map(tool=>tool.id).sort()).toEqual([...CREATIVE_ENGINE_V15_TOOL_IDS].sort())
    expect(registry.list().filter(tool=>tool.level==='T1').every(tool=>tool.requiresSandbox)).toBe(true)
  })

  it('keeps budgeted expert evaluation sandboxed while read-only assessment remains T0',async()=>{
    const spec=instantiateMotionExpertRecipeV1({recipeId:'expert.radial-payoff',width:640,height:360,seed:9})
    expect(spec.ok).toBe(true);if(!spec.ok)return
    const registry=registerCreativeEngineV15ToolsV1(createSanverseToolRegistryV1())
    const assessed=await registry.invoke('expert.assess-performance-v15',{spec:spec.value})
    expect(assessed).toMatchObject({ok:true,value:{kind:'particles',classification:expect.any(String)}})
    const missing=await registry.invoke('expert.evaluate-within-budget-v15',{spec:spec.value,tick:720_000,budget:{maxClass:'EXTREME'}})
    expect(missing).toMatchObject({ok:false,refusal:{code:'SANDBOX_CONTEXT_REQUIRED'}})
    const accepted=await registry.invoke('expert.evaluate-within-budget-v15',{spec:spec.value,tick:720_000,budget:{maxClass:'EXTREME'}},{sandboxId:'sandbox:v15'})
    expect(accepted).toMatchObject({ok:true,value:{frame:{tick:720_000},performance:{kind:'particles'}}})
  })

  it('routes truthful Three/WebGL inspection/materialization through the same registry and sandbox fence',async()=>{
    const source=JSON.stringify({schemaVersion:'sanverse.three-subset/v1',width:1920,height:1080,durationTicks:1_440_000,objects:[{id:'card',geometry:'plane',material:'basic',color:'#fff',x:0,y:0,width:.4,height:.2}]})
    const registry=registerCreativeEngineV15ToolsV1(createSanverseToolRegistryV1())
    const inspected=await registry.invoke('external.inspect-three-webgl',{assetId:'three:v15',source,provenance:provenance('three-webgl')})
    expect(inspected).toMatchObject({ok:true,value:{sourceKind:'three-webgl',materialization:'canonical-scene'}})
    expect(await registry.invoke('external.materialize-three-webgl',{assetId:'three:v15',source,provenance:provenance('three-webgl')})).toMatchObject({ok:false,refusal:{code:'SANDBOX_CONTEXT_REQUIRED'}})
    const materialized=await registry.invoke('external.materialize-three-webgl',{assetId:'three:v15',source,provenance:provenance('three-webgl')},{sandboxId:'sandbox:v15'})
    expect(materialized).toMatchObject({ok:true,value:{kind:'canonical-scene'}})
  })
})
