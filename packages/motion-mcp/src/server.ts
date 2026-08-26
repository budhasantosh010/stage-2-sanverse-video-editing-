import { createServer, type IncomingMessage, type Server as NodeHttpServer, type ServerResponse } from 'node:http'
import type { OwnerApprovalV1 } from '@sanverse/motion-storyboard'
import type { SanverseToolRegistryV1, ToolExecutionContextV1 } from '@sanverse/motion-agent-tools'

export const MCP_PROTOCOL_VERSION_V1='2026-07-28' as const
export const MCP_PROTOCOL_VERSION_META_KEY='io.modelcontextprotocol/protocolVersion' as const
export const MCP_CLIENT_INFO_META_KEY='io.modelcontextprotocol/clientInfo' as const
export const MCP_SERVER_INFO_META_KEY='io.modelcontextprotocol/serverInfo' as const
export const SANVERSE_SANDBOX_META_KEY='io.sanverse/sandboxId' as const
export const SANVERSE_REVISION_META_KEY='io.sanverse/revision' as const
export const SANVERSE_OWNER_APPROVAL_PROOF_META_KEY='io.sanverse/ownerApprovalProof' as const

export type McpJsonRpcIdV1=string|number|null
export interface McpJsonRpcRequestV1 { readonly jsonrpc:'2.0'; readonly id?:McpJsonRpcIdV1; readonly method:string; readonly params?:Readonly<Record<string,unknown>> }
export interface McpJsonRpcErrorV1 { readonly code:number; readonly message:string; readonly data?:unknown }
export type McpJsonRpcResponseV1=Readonly<{jsonrpc:'2.0';id:McpJsonRpcIdV1;result:unknown}>|Readonly<{jsonrpc:'2.0';id:McpJsonRpcIdV1;error:McpJsonRpcErrorV1}>
export interface McpTransportHeadersV1 { readonly protocolVersion?:string; readonly method?:string; readonly name?:string; readonly requireHeaders?:boolean }
export interface McpOwnerApprovalResolutionContextV1 { readonly toolName:string; readonly sandboxId?:string; readonly arguments:Readonly<Record<string,unknown>> }
export interface McpOwnerApprovalResolverV1 { readonly resolve:(proof:string,context:McpOwnerApprovalResolutionContextV1)=>OwnerApprovalV1|null|Promise<OwnerApprovalV1|null> }
export interface SanverseMcpServerOptionsV1 { readonly name?:string; readonly version?:string; readonly ownerApprovalResolver?:McpOwnerApprovalResolverV1 }
export interface SanverseMcpServerV1 { readonly protocolVersion:typeof MCP_PROTOCOL_VERSION_V1; readonly handle:(request:McpJsonRpcRequestV1,headers?:McpTransportHeadersV1)=>Promise<McpJsonRpcResponseV1> }
export interface SanverseMcpHttpServerOptionsV1 { readonly path?:string; readonly maxBodyBytes?:number }

const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const rpcError=(id:McpJsonRpcIdV1,code:number,message:string,data?:unknown):McpJsonRpcResponseV1=>Object.freeze({jsonrpc:'2.0' as const,id,error:Object.freeze({code,message,...(data===undefined?{}:{data})})})
const rpcResult=(id:McpJsonRpcIdV1,result:unknown):McpJsonRpcResponseV1=>Object.freeze({jsonrpc:'2.0' as const,id,result})
const title=(id:string)=>id.split('_').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ')
const ownerRequestState=(name:string,sandboxId?:string):string=>Buffer.from(JSON.stringify({v:1,name,sandboxId:sandboxId??null}),'utf8').toString('base64url')
const serverInfo=(name:string,version:string)=>Object.freeze({[MCP_SERVER_INFO_META_KEY]:Object.freeze({name,version})})
const withServerMeta=(value:Record<string,unknown>,name:string,version:string)=>Object.freeze({...value,_meta:Object.freeze({...serverInfo(name,version),...(record(value._meta)?value._meta:{})})})
const protocolVersion=(params:Readonly<Record<string,unknown>>|undefined):string|undefined=>record(params?._meta)?String(params!._meta![MCP_PROTOCOL_VERSION_META_KEY]??'')||undefined:undefined
const toolContext=(params:Readonly<Record<string,unknown>>|undefined):ToolExecutionContextV1=>{
  const meta=record(params?._meta)?params!._meta as Record<string,unknown>:{}
  const sandboxId=typeof meta[SANVERSE_SANDBOX_META_KEY]==='string'?String(meta[SANVERSE_SANDBOX_META_KEY]):undefined
  const revision=Number.isSafeInteger(meta[SANVERSE_REVISION_META_KEY])?Number(meta[SANVERSE_REVISION_META_KEY]):undefined
  return Object.freeze({...(sandboxId?{sandboxId}:{}),...(revision!==undefined?{revision}:{}),availableCapabilities:Object.freeze([])})
}
const operationCallResult=(result:unknown,name:string,version:string)=>withServerMeta({resultType:'complete',content:Object.freeze([{type:'text',text:JSON.stringify(result)}]),structuredContent:record(result)?result:Object.freeze({value:result}),isError:record(result)&&result.ok===false},name,version)

export const createSanverseMcpServerV1=(registry:SanverseToolRegistryV1,options:SanverseMcpServerOptionsV1={}):SanverseMcpServerV1=>{
  const name=options.name??'sanverse-creative-engine'
  const version=options.version??'1.0.0'
  const handle=async(request:McpJsonRpcRequestV1,headers:McpTransportHeadersV1={}):Promise<McpJsonRpcResponseV1>=>{
    const id=request.id??null
    if(request.jsonrpc!=='2.0'||typeof request.method!=='string'||!request.method.trim())return rpcError(id,-32600,'Invalid Request')
    if(request.method==='initialize'||request.method==='notifications/initialized')return rpcError(id,-32601,'Method not found: the Sanverse MCP V1 server is modern/stateless and does not implement initialize.')
    const params=record(request.params)?request.params:undefined
    if(headers.requireHeaders){
      if(!headers.method||headers.method!==request.method)return rpcError(id,-32600,'Mcp-Method header must exactly match the JSON-RPC method.')
      if(!headers.protocolVersion||headers.protocolVersion!==MCP_PROTOCOL_VERSION_V1)return rpcError(id,-32001,`Unsupported MCP protocol version. Expected ${MCP_PROTOCOL_VERSION_V1}.`)
      if(request.method==='tools/call'&&(!headers.name||headers.name!==String(params?.name??'')))return rpcError(id,-32600,'Mcp-Name header must exactly match tools/call params.name.')
    }
    if(request.method!=='server/discover'){
      const requestedVersion=protocolVersion(params)
      if(requestedVersion!==MCP_PROTOCOL_VERSION_V1)return rpcError(id,-32001,`Unsupported MCP protocol version. Expected ${MCP_PROTOCOL_VERSION_V1}.`)
    }
    if(request.method==='server/discover')return rpcResult(id,withServerMeta({resultType:'complete',supportedVersions:Object.freeze([MCP_PROTOCOL_VERSION_V1]),capabilities:Object.freeze({tools:Object.freeze({})}),instructions:'Sanverse Creative Engine Closed-Loop V1. Owner approvals are explicit, exact-revision, and cannot be inferred or forged by a tool caller.',ttlMs:0,cacheScope:'private'},name,version))
    if(request.method==='tools/list'){
      const tools=Object.freeze(registry.list().map(tool=>Object.freeze({name:tool.id,title:title(tool.id),description:`Sanverse ${tool.level} Closed-Loop V1 tool.`,inputSchema:tool.inputSchema,outputSchema:tool.outputSchema,_meta:Object.freeze({'io.sanverse/toolLevel':tool.level,'io.sanverse/requiresSandbox':tool.requiresSandbox,'io.sanverse/requiresOwnerApproval':tool.requiresOwnerApproval})})))
      return rpcResult(id,withServerMeta({resultType:'complete',tools,ttlMs:0,cacheScope:'private'},name,version))
    }
    if(request.method==='tools/call'){
      const toolName=typeof params?.name==='string'?params.name:''
      if(!toolName)return rpcError(id,-32602,'tools/call requires params.name.')
      const definition=registry.get(toolName)
      if(!definition)return rpcResult(id,operationCallResult(Object.freeze({ok:false,refusal:Object.freeze({code:'TOOL_NOT_FOUND',message:`Unknown Sanverse tool: ${toolName}.`})}),name,version))
      const argumentsValue=record(params?.arguments)?params!.arguments as Record<string,unknown>:{}
      const context=toolContext(params)
      if(definition.requiresOwnerApproval){
        const requestState=ownerRequestState(toolName,context.sandboxId)
        const inputResponses=record(params?.inputResponses)?params!.inputResponses as Record<string,unknown>:{}
        if(params?.requestState!==requestState||inputResponses.ownerApproval!==true){
          return rpcResult(id,withServerMeta({resultType:'input_required',inputRequests:Object.freeze({ownerApproval:Object.freeze({type:'elicitation',message:'Confirm explicit owner approval for this exact Sanverse revision. This confirmation does not itself create approval authority.',schema:Object.freeze({type:'boolean'})})}),requestState},name,version))
        }
        const meta=record(params?._meta)?params!._meta as Record<string,unknown>:{}
        const proof=typeof meta[SANVERSE_OWNER_APPROVAL_PROOF_META_KEY]==='string'?String(meta[SANVERSE_OWNER_APPROVAL_PROOF_META_KEY]):''
        if(!proof||!options.ownerApprovalResolver)return rpcResult(id,operationCallResult(Object.freeze({ok:false,refusal:Object.freeze({code:'OWNER_APPROVAL_PROOF_REQUIRED',message:'A host-resolved opaque owner-approval proof is required; client-supplied approval JSON is not authority.'})}),name,version))
        const approval=await options.ownerApprovalResolver.resolve(proof,Object.freeze({toolName,...(context.sandboxId?{sandboxId:context.sandboxId}:{}),arguments:Object.freeze({...argumentsValue})}))
        if(!approval)return rpcResult(id,operationCallResult(Object.freeze({ok:false,refusal:Object.freeze({code:'OWNER_APPROVAL_PROOF_INVALID',message:'The host could not resolve this owner-approval proof.'})}),name,version))
        const result=await registry.invoke(toolName,Object.freeze({...argumentsValue,approval}),context)
        return rpcResult(id,operationCallResult(result,name,version))
      }
      const result=await registry.invoke(toolName,argumentsValue,context)
      return rpcResult(id,operationCallResult(result,name,version))
    }
    return rpcError(id,-32601,`Method not found: ${request.method}`)
  }
  return Object.freeze({protocolVersion:MCP_PROTOCOL_VERSION_V1,handle})
}

const collectBody=async(request:IncomingMessage,maxBodyBytes:number):Promise<string>=>new Promise((resolve,reject)=>{let body='';let bytes=0;request.setEncoding('utf8');request.on('data',(chunk:string)=>{bytes+=Buffer.byteLength(chunk);if(bytes>maxBodyBytes){reject(new RangeError('MCP request body is too large.'));request.destroy();return}body+=chunk});request.on('end',()=>resolve(body));request.on('error',reject)})
const sendJson=(response:ServerResponse,status:number,payload:unknown)=>{const body=JSON.stringify(payload);response.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'});response.end(body)}
export const createSanverseMcpNodeHttpServerV1=(server:SanverseMcpServerV1,options:SanverseMcpHttpServerOptionsV1={}):NodeHttpServer=>{
  const path=options.path??'/mcp',maxBodyBytes=options.maxBodyBytes??1_048_576
  return createServer(async(request,response)=>{
    if(request.url!==path){sendJson(response,404,{error:'Not found'});return}
    if(request.method!=='POST'){response.setHeader('allow','POST');sendJson(response,405,{error:'Method not allowed'});return}
    try{
      const body=await collectBody(request,maxBodyBytes);const parsed=JSON.parse(body) as McpJsonRpcRequestV1
      const result=await server.handle(parsed,Object.freeze({protocolVersion:typeof request.headers['mcp-protocol-version']==='string'?request.headers['mcp-protocol-version']:undefined,method:typeof request.headers['mcp-method']==='string'?request.headers['mcp-method']:undefined,name:typeof request.headers['mcp-name']==='string'?request.headers['mcp-name']:undefined,requireHeaders:true}))
      sendJson(response,200,result)
    }catch(error){sendJson(response,400,rpcError(null,-32700,error instanceof Error?error.message:'Parse error'))}
  })
}
