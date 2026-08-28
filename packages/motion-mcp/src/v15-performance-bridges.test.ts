import { describe,expect,it } from 'vitest'
import { CREATIVE_ENGINE_V15_TOOL_IDS,createSanverseToolRegistryV1,registerCreativeEngineV15ToolsV1 } from '@sanverse/motion-agent-tools'
import { createSanverseMcpServerV1,MCP_PROTOCOL_VERSION_META_KEY,MCP_PROTOCOL_VERSION_V1,SANVERSE_SANDBOX_META_KEY,type McpJsonRpcResponseV1 } from './server.ts'

const meta=(sandboxId?:string)=>Object.freeze({[MCP_PROTOCOL_VERSION_META_KEY]:MCP_PROTOCOL_VERSION_V1,...(sandboxId?{[SANVERSE_SANDBOX_META_KEY]:sandboxId}:{})})
const resultOf=(response:McpJsonRpcResponseV1):Record<string,unknown>=>('result'in response&&response.result&&typeof response.result==='object'?response.result as Record<string,unknown>:{})
const structured=(response:McpJsonRpcResponseV1):Record<string,unknown>=>{const result=resultOf(response);return result.structuredContent&&typeof result.structuredContent==='object'?result.structuredContent as Record<string,unknown>:result}
const registry=()=>registerCreativeEngineV15ToolsV1(createSanverseToolRegistryV1())

describe('Creative Engine V1.5 thin MCP batching/performance/bridge exposure',()=>{
  it('lists exactly the internal V1.5 registry surface without MCP-owned duplicates',async()=>{
    const toolsRegistry=registry(),server=createSanverseMcpServerV1(toolsRegistry,{version:'1.5.0'})
    const response=await server.handle({jsonrpc:'2.0',id:1,method:'tools/list',params:{_meta:meta()}})
    const tools=Array.isArray(resultOf(response).tools)?resultOf(response).tools as Array<Record<string,unknown>>:[]
    expect(tools.map(tool=>String(tool.name)).sort()).toEqual([...CREATIVE_ENGINE_V15_TOOL_IDS].sort())
    expect(toolsRegistry.list().map(tool=>tool.id).sort()).toEqual([...CREATIVE_ENGINE_V15_TOOL_IDS].sort())
  })

  it('preserves sandbox fencing for V1.5 materialization through generic tools/call',async()=>{
    const source=JSON.stringify({schemaVersion:'sanverse.three-subset/v1',width:1920,height:1080,durationTicks:1_440_000,objects:[{id:'card',geometry:'plane',material:'basic',color:'#fff',x:0,y:0,width:.3,height:.2}]})
    const provenance={schemaVersion:'sanverse.external-motion-provenance/v1',sourceKind:'three-webgl',sourceName:'owner fixture',rightsClass:'owner-authored',attributionRequired:false,reusableLibraryAllowed:true,projectUseAllowed:true,aiModificationAllowed:true,restrictions:[]}
    const server=createSanverseMcpServerV1(registry(),{version:'1.5.0'})
    const refused=await server.handle({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'external.materialize-three-webgl',arguments:{assetId:'three:mcp',source,provenance},_meta:meta()}})
    expect(structured(refused)).toMatchObject({ok:false,refusal:{code:'SANDBOX_CONTEXT_REQUIRED'}})
    const accepted=await server.handle({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'external.materialize-three-webgl',arguments:{assetId:'three:mcp',source,provenance},_meta:meta('sandbox:v15')}})
    expect(structured(accepted)).toMatchObject({ok:true,value:{kind:'canonical-scene'}})
  })
})
