import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverUrl = 'http://127.0.0.1:2010/closed-loop-review'
const debugPort = 9241
const debugUrl = `http://127.0.0.1:${debugPort}`
const outputRoot = resolve(root, 'motion/visual-baselines/closed-loop-v1')
const profileDir = resolve(root, 'tmp/closed-loop-review-edge-profile')
const edge = process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : process.env.CHROME_BIN ?? 'google-chrome'
const sleep = (ms:number)=>new Promise(resolveDelay=>setTimeout(resolveDelay,ms))
const serverReady = async()=>{try{return (await fetch(serverUrl)).ok}catch{return false}}
const waitFor = async<T>(fn:()=>Promise<T|null>,timeoutMs:number):Promise<T>=>{const started=Date.now();while(Date.now()-started<timeoutMs){const value=await fn();if(value!==null)return value;await sleep(80)}throw new Error(`Timed out after ${timeoutMs}ms.`)}

const main=async()=>{
let startedServer:ReturnType<typeof spawn>|null=null
if(!(await serverReady())){
  startedServer=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev','--workspace=@sanverse/motion-lab','--','--host','127.0.0.1','--port','2010','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:process.platform==='win32'})
  await waitFor(async()=>await serverReady()?true:null,15_000)
}
await rm(outputRoot,{recursive:true,force:true});await mkdir(outputRoot,{recursive:true});await rm(profileDir,{recursive:true,force:true})
const browser=spawn(edge,['--headless=new','--disable-gpu','--hide-scrollbars',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'--window-size=1440,900','about:blank'],{cwd:root,stdio:'ignore',windowsHide:true})
interface TargetInfo{webSocketDebuggerUrl?:string;type?:string}
const target=await waitFor(async()=>{try{const list=await(await fetch(`${debugUrl}/json/list`)).json() as TargetInfo[];return list.find(candidate=>candidate.type==='page'&&candidate.webSocketDebuggerUrl)?.webSocketDebuggerUrl??null}catch{return null}},12_000)
const ws=new WebSocket(target);let nextId=1;const pending=new Map<number,{resolve:(value:any)=>void;reject:(reason:unknown)=>void}>();let frameSink:((data:string)=>void)|null=null
ws.on('message',raw=>{const message=JSON.parse(String(raw)) as {id?:number;method?:string;params?:{data?:string;sessionId?:number};result?:unknown;error?:unknown};if(message.id!==undefined){const waiter=pending.get(message.id);if(waiter){pending.delete(message.id);message.error?waiter.reject(message.error):waiter.resolve(message.result)}return}if(message.method==='Page.screencastFrame'&&message.params?.data&&message.params.sessionId!==undefined){frameSink?.(message.params.data);void send('Page.screencastFrameAck',{sessionId:message.params.sessionId})}})
const send=(method:string,params:Record<string,unknown>={})=>new Promise<any>((resolveValue,reject)=>{const id=nextId++;pending.set(id,{resolve:resolveValue,reject});ws.send(JSON.stringify({id,method,params}))})
await new Promise<void>((resolveOpen,reject)=>{if(ws.readyState===WebSocket.OPEN)resolveOpen();else{ws.once('open',()=>resolveOpen());ws.once('error',reject)}})
await send('Page.enable');await send('Runtime.enable')
const evaluate=async(expression:string)=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true});return result.result?.value}
const frames:string[]=[]
try{
  await send('Page.navigate',{url:serverUrl})
  await waitFor(async()=>await evaluate("Boolean(document.querySelector('[data-closed-loop-review=\"true\"]'))")?true:null,10_000)
  frameSink=data=>frames.push(data)
  await send('Page.startScreencast',{format:'jpeg',quality:82,maxWidth:1440,maxHeight:900,everyNthFrame:1})
  const started=Date.now()
  await waitFor(async()=>await evaluate("document.querySelector('[data-closed-loop-review=\"true\"]')?.getAttribute('data-closed-loop-full-playback') === 'true'")?true:null,12_000)
  const elapsedMs=Date.now()-started
  await sleep(180);await send('Page.stopScreencast');frameSink=null
  if(frames.length<5)throw new Error(`Closed-Loop review completed but emitted only ${frames.length} screencast frames.`)
  const sampleCount=7
  const files:string[]=[]
  for(let sample=0;sample<sampleCount;sample+=1){const frameIndex=Math.round(sample*(frames.length-1)/Math.max(1,sampleCount-1));const file=`closed-loop-1x-${String(sample).padStart(2,'0')}.jpg`;files.push(file);await writeFile(resolve(outputRoot,file),Buffer.from(frames[frameIndex]!,'base64'))}
  const finalTick=Number(await evaluate("document.querySelector('[data-closed-loop-review=\"true\"]')?.getAttribute('data-closed-loop-current-tick')"))
  const durationTicks=Number(await evaluate("document.querySelector('[data-closed-loop-review=\"true\"]')?.getAttribute('data-closed-loop-duration-ticks')"))
  const semanticNodeVisible=Boolean(await evaluate("Boolean(document.querySelector('[data-motion-node-id=\"cost-card.value\"]'))"))
  const graphBacked=await evaluate("document.querySelector('[data-motion-component-id=\"sanverse.cost-value-card\"]')?.getAttribute('data-motion-graph-backed')")
  const evidence={schemaVersion:'sanverse.closed-loop-browser-evidence/v1',recordedAt:new Date().toISOString(),route:'/closed-loop-review',speed:1,elapsedMs,capturedFrames:frames.length,samples:files,fullPlaybackVerified:true,finalTick,durationTicks,semanticNodeId:'cost-card.value',semanticNodeVisible,graphBacked,productionWebTouched:false}
  await writeFile(resolve(outputRoot,'runtime-evidence.json'),`${JSON.stringify(evidence,null,2)}\n`,'utf8')
  console.log(`CLOSED_LOOP_BROWSER fullPlayback=true elapsedMs=${elapsedMs} capturedFrames=${frames.length} finalTick=${finalTick} durationTicks=${durationTicks} semanticNodeVisible=${semanticNodeVisible} graphBacked=${graphBacked}`)
}finally{frameSink=null;ws.close();browser.kill();if(startedServer)startedServer.kill()}
}
void main().catch(error=>{console.error(error);process.exitCode=1})
