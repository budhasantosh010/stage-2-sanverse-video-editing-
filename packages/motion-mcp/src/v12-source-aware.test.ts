import { describe,expect,it } from 'vitest'
import { createSanverseToolRegistryV1,registerCreativeEngineV12ToolsV1,SOURCE_AWARE_TOOL_IDS_V12 } from '@sanverse/motion-agent-tools'
import { createSanverseMcpServerV1,MCP_PROTOCOL_VERSION_META_KEY,MCP_PROTOCOL_VERSION_V1,type McpJsonRpcResponseV1 } from './server.ts'

const meta=()=>Object.freeze({[MCP_PROTOCOL_VERSION_META_KEY]:MCP_PROTOCOL_VERSION_V1})
const resultOf=(response:McpJsonRpcResponseV1):Record<string,unknown>=>('result'in response&&response.result&&typeof response.result==='object'?response.result as Record<string,unknown>:{})
const structured=(response:McpJsonRpcResponseV1):Record<string,unknown>=>{const result=resultOf(response);return result.structuredContent&&typeof result.structuredContent==='object'?result.structuredContent as Record<string,unknown>:result}
const provenance=Object.freeze({schemaVersion:'sanverse.external-motion-provenance/v1' as const,sourceKind:'react-svg' as const,sourceName:'owner fixture',rightsClass:'owner-authored' as const,attributionRequired:false,reusableLibraryAllowed:true,projectUseAllowed:true,aiModificationAllowed:true,restrictions:Object.freeze([])})

describe('Creative Engine V1.2 thin MCP exposure',()=>{
  it('lists the exact already-registered V1.2 internal tools without MCP-owned duplicates',async()=>{const registry=registerCreativeEngineV12ToolsV1(createSanverseToolRegistryV1()),server=createSanverseMcpServerV1(registry,{version:'1.2.0'}),response=await server.handle({jsonrpc:'2.0',id:1,method:'tools/list',params:{_meta:meta()}}),tools=Array.isArray(resultOf(response).tools)?resultOf(response).tools as Array<Record<string,unknown>>:[];expect(tools.map(tool=>String(tool.name)).sort()).toEqual([...SOURCE_AWARE_TOOL_IDS_V12].sort());expect(registry.list().map(tool=>tool.id).sort()).toEqual([...SOURCE_AWARE_TOOL_IDS_V12].sort())})
  it('calls the same rights-gated external materializer through generic tools/call',async()=>{const registry=registerCreativeEngineV12ToolsV1(createSanverseToolRegistryV1()),server=createSanverseMcpServerV1(registry,{version:'1.2.0'}),source='export const Card=()=> (<svg viewBox="0 0 100 100"><rect id="card" x="10" y="10" width="80" height="80" fill="#111111"/></svg>)',response=await server.handle({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'external.materialize_supported',arguments:{assetId:'mcp-react-card',sourceKind:'react-svg',source,provenance},_meta:meta()}});expect(structured(response)).toMatchObject({ok:true,value:{kind:'canonical-scene',scene:{componentId:'external.mcp-react-card'}}})})
})
