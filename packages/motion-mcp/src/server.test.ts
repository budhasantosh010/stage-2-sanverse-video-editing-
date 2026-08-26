import { afterEach,describe,expect,it } from 'vitest'
import { CLOSED_LOOP_TOOL_IDS_V1,createClosedLoopEngineV1,createClosedLoopToolRegistryV1,createSanverseToolRegistryV1 } from '@sanverse/motion-agent-tools'
import type { OwnerApprovalV1 } from '@sanverse/motion-storyboard'
import { createSanverseMcpNodeHttpServerV1,createSanverseMcpServerV1,MCP_PROTOCOL_VERSION_META_KEY,MCP_PROTOCOL_VERSION_V1,SANVERSE_OWNER_APPROVAL_PROOF_META_KEY,SANVERSE_SANDBOX_META_KEY,type McpJsonRpcResponseV1 } from './server.ts'
import type { Server as NodeHttpServer } from 'node:http'

const servers:NodeHttpServer[]=[]
afterEach(async()=>{await Promise.all(servers.splice(0).map(server=>new Promise<void>(resolve=>server.close(()=>resolve()))))})
const meta=(extra:Record<string,unknown>={})=>Object.freeze({[MCP_PROTOCOL_VERSION_META_KEY]:MCP_PROTOCOL_VERSION_V1,...extra})
const resultOf=(response:McpJsonRpcResponseV1):Record<string,unknown>=>('result'in response&&response.result&&typeof response.result==='object'?response.result as Record<string,unknown>:{})
const structured=(response:McpJsonRpcResponseV1):Record<string,unknown>=>{const result=resultOf(response);return result.structuredContent&&typeof result.structuredContent==='object'?result.structuredContent as Record<string,unknown>:result}

describe('Sanverse MCP V1 — 2026-07-28 stateless adapter',()=>{
  it('implements server/discover without initialize and exposes deterministic cacheable tools/list',async()=>{
    const registry=createSanverseToolRegistryV1()
    registry.register({id:'get_project_context',version:1,level:'T0',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},requiresSandbox:false,validateInput:()=>({ok:true,value:{}}),execute:()=>({ok:true,value:{projectRevision:7},revision:7})})
    const server=createSanverseMcpServerV1(registry)
    const discover=await server.handle({jsonrpc:'2.0',id:1,method:'server/discover'})
    expect(discover).toMatchObject({jsonrpc:'2.0',id:1,result:{resultType:'complete',supportedVersions:[MCP_PROTOCOL_VERSION_V1],capabilities:{tools:{}},ttlMs:0,cacheScope:'private',_meta:{'io.modelcontextprotocol/serverInfo':{name:'sanverse-creative-engine',version:'1.0.0'}}}})
    expect(await server.handle({jsonrpc:'2.0',id:2,method:'initialize',params:{}})).toMatchObject({error:{code:-32601}})
    const list=await server.handle({jsonrpc:'2.0',id:3,method:'tools/list',params:{_meta:meta()}})
    expect(list).toMatchObject({result:{resultType:'complete',ttlMs:0,cacheScope:'private',tools:[{name:'get_project_context',inputSchema:{type:'object'},_meta:{'io.sanverse/toolLevel':'T0'}}]}})
  })

  it('exposes the actual Closed-Loop V1 registry through MCP rather than a parallel tool surface',async()=>{
    const engine=createClosedLoopEngineV1({id:'project:mcp-integration',revision:11,scene:{} as never})
    const registry=createClosedLoopToolRegistryV1(engine)
    const server=createSanverseMcpServerV1(registry)
    const list=await server.handle({jsonrpc:'2.0',id:1,method:'tools/list',params:{_meta:meta()}})
    const listed=Array.isArray(resultOf(list).tools)?resultOf(list).tools as Array<Record<string,unknown>>:[]
    expect(listed.map(tool=>tool.name).sort()).toEqual([...CLOSED_LOOP_TOOL_IDS_V1].sort())
    const context=await server.handle({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'get_project_context',arguments:{},_meta:meta()}})
    expect(structured(context)).toMatchObject({ok:true,value:{acceptedProject:{id:'project:mcp-integration',revision:11}},revision:11})
  })

  it('routes only through registry invocation and carries explicit sandbox context',async()=>{
    const registry=createSanverseToolRegistryV1()
    registry.register({id:'revise_storyboard',version:1,level:'T1',inputSchema:{type:'object'},outputSchema:{type:'object'},requiresSandbox:true,validateInput:(input)=>({ok:true,value:input}),execute:(input,context)=>({ok:true,value:{input,sandboxId:context.sandboxId},revision:4})})
    const server=createSanverseMcpServerV1(registry)
    const missing=await server.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'revise_storyboard',arguments:{edit:'x'},_meta:meta()}})
    expect(structured(missing)).toMatchObject({ok:false,refusal:{code:'SANDBOX_CONTEXT_REQUIRED'}})
    const called=await server.handle({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'revise_storyboard',arguments:{edit:'x'},_meta:meta({[SANVERSE_SANDBOX_META_KEY]:'sandbox:1'})}})
    expect(structured(called)).toMatchObject({ok:true,value:{input:{edit:'x'},sandboxId:'sandbox:1'},revision:4})
    const unknown=await server.handle({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'made_up_tool',arguments:{},_meta:meta()}})
    expect(structured(unknown)).toMatchObject({ok:false,refusal:{code:'TOOL_NOT_FOUND'}})
  })

  it('cannot forge owner approval from tool arguments, inputResponses, or guessed requestState',async()=>{
    let approved=false
    const registry=createSanverseToolRegistryV1()
    registry.register({id:'record_owner_approval',version:1,level:'T2',inputSchema:{type:'object'},outputSchema:{type:'object'},requiresSandbox:true,requiresOwnerApproval:true,validateInput:(input)=>({ok:true,value:input as Record<string,unknown>}),execute:(input)=>{const approval=(input as Record<string,unknown>).approval as OwnerApprovalV1|undefined;if(approval?.id!=='approval:host')return{ok:false,refusal:{code:'FORGED_APPROVAL',message:'not host approval'}};approved=true;return{ok:true,value:{approved:true},revision:5}}})
    const hostApproval:OwnerApprovalV1={schemaVersion:'sanverse.owner-approval/v1',id:'approval:host',scope:'storyboard',subjectId:'storyboard:1',subjectRevision:2,status:'owner-approved',approvedAt:'2026-08-26T00:00:00.000Z'}
    const server=createSanverseMcpServerV1(registry,{ownerApprovalResolver:{resolve:(proof)=>proof==='host-proof'?hostApproval:null}})
    const forged={schemaVersion:'sanverse.owner-approval/v1',id:'approval:forged',scope:'storyboard',subjectId:'storyboard:1',subjectRevision:999,status:'owner-approved',approvedAt:'2026-08-26T00:00:00.000Z'}
    const first=await server.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'record_owner_approval',arguments:{approval:forged},_meta:meta({[SANVERSE_SANDBOX_META_KEY]:'sandbox:1'})}})
    expect(resultOf(first)).toMatchObject({resultType:'input_required',inputRequests:{ownerApproval:{type:'elicitation'}},requestState:expect.any(String)})
    expect(approved).toBe(false)
    const requestState=String(resultOf(first).requestState)
    const noProof=await server.handle({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'record_owner_approval',arguments:{approval:forged},requestState,inputResponses:{ownerApproval:true},_meta:meta({[SANVERSE_SANDBOX_META_KEY]:'sandbox:1'})}})
    expect(structured(noProof)).toMatchObject({ok:false,refusal:{code:'OWNER_APPROVAL_PROOF_REQUIRED'}});expect(approved).toBe(false)
    const badProof=await server.handle({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'record_owner_approval',arguments:{approval:forged},requestState,inputResponses:{ownerApproval:true},_meta:meta({[SANVERSE_SANDBOX_META_KEY]:'sandbox:1',[SANVERSE_OWNER_APPROVAL_PROOF_META_KEY]:'fake-proof'})}})
    expect(structured(badProof)).toMatchObject({ok:false,refusal:{code:'OWNER_APPROVAL_PROOF_INVALID'}});expect(approved).toBe(false)
    const valid=await server.handle({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'record_owner_approval',arguments:{approval:forged},requestState,inputResponses:{ownerApproval:true},_meta:meta({[SANVERSE_SANDBOX_META_KEY]:'sandbox:1',[SANVERSE_OWNER_APPROVAL_PROOF_META_KEY]:'host-proof'})}})
    expect(structured(valid)).toMatchObject({ok:true,value:{approved:true}});expect(approved).toBe(true)
  })

  it('serves a real localhost HTTP /mcp call and enforces modern routing headers',async()=>{
    const registry=createSanverseToolRegistryV1();registry.register({id:'get_project_context',version:1,level:'T0',inputSchema:{type:'object'},outputSchema:{type:'object'},requiresSandbox:false,validateInput:()=>({ok:true,value:{}}),execute:()=>({ok:true,value:{revision:7},revision:7})})
    const http=createSanverseMcpNodeHttpServerV1(createSanverseMcpServerV1(registry));servers.push(http)
    await new Promise<void>((resolve,reject)=>http.listen(0,'127.0.0.1',()=>resolve()).once('error',reject))
    const address=http.address();if(!address||typeof address==='string')throw new Error('Expected TCP address.')
    const body={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_project_context',arguments:{},_meta:meta()}}
    const response=await fetch(`http://127.0.0.1:${address.port}/mcp`,{method:'POST',headers:{'content-type':'application/json','MCP-Protocol-Version':MCP_PROTOCOL_VERSION_V1,'Mcp-Method':'tools/call','Mcp-Name':'get_project_context'},body:JSON.stringify(body)})
    expect(response.status).toBe(200);const payload=await response.json() as McpJsonRpcResponseV1;expect(structured(payload)).toMatchObject({ok:true,value:{revision:7}})
    const mismatched=await fetch(`http://127.0.0.1:${address.port}/mcp`,{method:'POST',headers:{'content-type':'application/json','MCP-Protocol-Version':MCP_PROTOCOL_VERSION_V1,'Mcp-Method':'tools/list','Mcp-Name':'get_project_context'},body:JSON.stringify(body)})
    expect(await mismatched.json()).toMatchObject({error:{code:-32600,message:expect.stringContaining('Mcp-Method')}})
  })
})
