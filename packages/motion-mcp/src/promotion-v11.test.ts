import { describe,expect,it } from 'vitest'
import { constant,createMotionScene,nodeBase } from '@sanverse/motion-graph'
import type { PromotionSourceV1 } from '@sanverse/motion-promotion'
import { CLOSED_LOOP_TOOL_IDS_V1,createClosedLoopEngineV1,createCreativeEngineV11ToolRegistryV1,createPromotionReuseEngineV1,PROMOTION_REUSE_TOOL_IDS_V1 } from '@sanverse/motion-agent-tools'
import { createSanverseMcpServerV1,MCP_PROTOCOL_VERSION_META_KEY,MCP_PROTOCOL_VERSION_V1,SANVERSE_OWNER_APPROVAL_PROOF_META_KEY,SANVERSE_SANDBOX_META_KEY,type McpJsonRpcResponseV1 } from './server.ts'

const meta=(extra:Record<string,unknown>={})=>Object.freeze({[MCP_PROTOCOL_VERSION_META_KEY]:MCP_PROTOCOL_VERSION_V1,...extra})
const resultOf=(response:McpJsonRpcResponseV1):Record<string,unknown>=>('result'in response&&response.result&&typeof response.result==='object'?response.result as Record<string,unknown>:{})
const structured=(response:McpJsonRpcResponseV1):Record<string,unknown>=>{const result=resultOf(response);return result.structuredContent&&typeof result.structuredContent==='object'?result.structuredContent as Record<string,unknown>:result}
const scene=()=>createMotionScene({componentId:'generated.mcp-promotion-proof',componentVersion:1,rootNodeId:'root',nodes:Object.freeze({root:Object.freeze({...nodeBase('root','Root',null),type:'group' as const,childIds:Object.freeze(['headline'])}),headline:Object.freeze({...nodeBase('headline','Headline','root'),type:'text' as const,text:constant('Approved source'),fillColor:constant('#fff'),fontFamily:'Inter',fontSize:constant(64),fontWeight:constant(800),textAlign:'center' as const})}),semanticParts:Object.freeze([{id:'part:headline',label:'Headline',role:'primary-text' as const,nodeIds:Object.freeze(['headline'])}]),exposures:Object.freeze([{id:'headline.content',label:'Headline',group:'Content' as const,level:'creator' as const,target:{kind:'node' as const,nodeId:'headline',property:'text.text' as const},editor:{type:'text' as const},keyframeable:false}]),layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9'] as const)})
const source=(approvalRevision:number):PromotionSourceV1=>Object.freeze({schemaVersion:'sanverse.promotion-source/v1',sourceProjectId:'project:a',sourceProjectRevision:4,sourceSceneId:'motion:a',sourceSceneRevision:2,scene:scene(),motionApproval:Object.freeze({schemaVersion:'sanverse.owner-approval/v1',id:'approval:a',scope:'motion',subjectId:'motion:a',subjectRevision:approvalRevision,status:'owner-approved',approvedAt:'2026-08-26T09:00:00.000Z'}),structuralQaPassed:true,visualReviewEvidence:Object.freeze({canonicalReviewRef:'review://a/1x',posterRef:'frame://a/poster',criticalFrameRefs:Object.freeze(['frame://a/critical'])}),origin:'generated',dependencies:Object.freeze([])})

describe('MCP V1 extension for Creative Engine V1.1',()=>{
  it('exposes the actual combined Closed-Loop + promotion/reuse registry with no MCP-specific promotion state',async()=>{
    const base=scene(),closedLoop=createClosedLoopEngineV1({id:'host',revision:1,scene:base}),promotion=createPromotionReuseEngineV1(source(2),{id:'project:b',revision:1,scene:base})
    const registry=createCreativeEngineV11ToolRegistryV1(closedLoop,promotion),server=createSanverseMcpServerV1(registry)
    const list=await server.handle({jsonrpc:'2.0',id:1,method:'tools/list',params:{_meta:meta()}})
    const listed=Array.isArray(resultOf(list).tools)?resultOf(list).tools as Array<Record<string,unknown>>:[]
    expect(listed.map(tool=>tool.name).sort()).toEqual([...CLOSED_LOOP_TOOL_IDS_V1,...PROMOTION_REUSE_TOOL_IDS_V1].sort())
    expect(listed.some(tool=>tool.name==='promotion.register')).toBe(true)
    expect(listed.some(tool=>tool.name==='capability.instantiate')).toBe(true)
  })

  it('cannot replace the host-bound approved source with fake MCP approval JSON',async()=>{
    const base=scene(),closedLoop=createClosedLoopEngineV1({id:'host',revision:1,scene:base}),promotion=createPromotionReuseEngineV1(source(1),{id:'project:b',revision:1,scene:base})
    const server=createSanverseMcpServerV1(createCreativeEngineV11ToolRegistryV1(closedLoop,promotion))
    const response=await server.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'promotion.create_candidate',arguments:{candidateId:'candidate:forged',workspaceId:'workspace:forged',targetKinds:['scene'],motionApproval:{schemaVersion:'sanverse.owner-approval/v1',id:'client-forged',scope:'motion',subjectId:'motion:a',subjectRevision:2,status:'owner-approved',approvedAt:'2026-08-26T09:00:00.000Z'}},_meta:meta()}})
    expect(structured(response)).toMatchObject({ok:false,refusal:{code:'PROMOTION_SOURCE_APPROVAL_STALE'}})
    expect(promotion.getState().candidate).toBeNull()
  })

  it('requires host-resolved proof before MCP can call the Project-B reuse approval tool',async()=>{
    const base=scene(),closedLoop=createClosedLoopEngineV1({id:'host',revision:1,scene:base}),promotion=createPromotionReuseEngineV1(source(2),{id:'project:b',revision:1,scene:base})
    const server=createSanverseMcpServerV1(createCreativeEngineV11ToolRegistryV1(closedLoop,promotion))
    const forged={schemaVersion:'sanverse.owner-approval/v1',id:'client-forged',scope:'motion',subjectId:'reuse:b',subjectRevision:999,status:'owner-approved',approvedAt:'2026-08-26T09:00:00.000Z'}
    const first=await server.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'capability.record_owner_approval',arguments:{approval:forged},_meta:meta({[SANVERSE_SANDBOX_META_KEY]:'reuse:b'})}})
    expect(resultOf(first)).toMatchObject({resultType:'input_required',requestState:expect.any(String)})
    const requestState=String(resultOf(first).requestState)
    const noProof=await server.handle({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'capability.record_owner_approval',arguments:{approval:forged},requestState,inputResponses:{ownerApproval:true},_meta:meta({[SANVERSE_SANDBOX_META_KEY]:'reuse:b'})}})
    expect(structured(noProof)).toMatchObject({ok:false,refusal:{code:'OWNER_APPROVAL_PROOF_REQUIRED'}})
    const fakeProof=await createSanverseMcpServerV1(createCreativeEngineV11ToolRegistryV1(closedLoop,promotion),{ownerApprovalResolver:{resolve:()=>null}}).handle({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'capability.record_owner_approval',arguments:{approval:forged},requestState,inputResponses:{ownerApproval:true},_meta:meta({[SANVERSE_SANDBOX_META_KEY]:'reuse:b',[SANVERSE_OWNER_APPROVAL_PROOF_META_KEY]:'fake'})}})
    expect(structured(fakeProof)).toMatchObject({ok:false,refusal:{code:'OWNER_APPROVAL_PROOF_INVALID'}})
  })
})
