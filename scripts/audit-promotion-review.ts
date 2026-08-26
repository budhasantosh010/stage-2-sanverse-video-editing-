import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverUrl = 'http://127.0.0.1:2010/promotion-review'
const debugPort = 9242
const debugUrl = `http://127.0.0.1:${debugPort}`
const outputRoot = resolve(root, 'motion/visual-baselines/promotion-v1.1')
const profileDir = resolve(root, 'tmp/promotion-review-edge-profile')
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
  const browser=spawn(edge,['--headless=new','--disable-gpu','--hide-scrollbars',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'--window-size=1440,1100','about:blank'],{cwd:root,stdio:'ignore',windowsHide:true})
  interface TargetInfo{webSocketDebuggerUrl?:string;type?:string}
  const target=await waitFor(async()=>{try{const list=await(await fetch(`${debugUrl}/json/list`)).json() as TargetInfo[];return list.find(candidate=>candidate.type==='page'&&candidate.webSocketDebuggerUrl)?.webSocketDebuggerUrl??null}catch{return null}},12_000)
  const ws=new WebSocket(target);let nextId=1;const pending=new Map<number,{resolve:(value:any)=>void;reject:(reason:unknown)=>void}>();let frameSink:((data:string)=>void)|null=null
  const send=(method:string,params:Record<string,unknown>={})=>new Promise<any>((resolveValue,reject)=>{const id=nextId++;pending.set(id,{resolve:resolveValue,reject});ws.send(JSON.stringify({id,method,params}))})
  ws.on('message',raw=>{const message=JSON.parse(String(raw)) as {id?:number;method?:string;params?:{data?:string;sessionId?:number};result?:unknown;error?:unknown};if(message.id!==undefined){const waiter=pending.get(message.id);if(waiter){pending.delete(message.id);message.error?waiter.reject(message.error):waiter.resolve(message.result)}return}if(message.method==='Page.screencastFrame'&&message.params?.data&&message.params.sessionId!==undefined){frameSink?.(message.params.data);void send('Page.screencastFrameAck',{sessionId:message.params.sessionId})}})
  await new Promise<void>((resolveOpen,reject)=>{if(ws.readyState===WebSocket.OPEN)resolveOpen();else{ws.once('open',()=>resolveOpen());ws.once('error',reject)}})
  await send('Page.enable');await send('Runtime.enable')
  const evaluate=async(expression:string)=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true});return result.result?.value}
  const capture=async(file:string,beyondViewport=false)=>{const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:beyondViewport,fromSurface:true});await writeFile(resolve(outputRoot,file),Buffer.from(shot.data,'base64'))}
  const frames:string[]=[]
  try{
    await send('Page.navigate',{url:serverUrl})
    await waitFor(async()=>await evaluate("Boolean(document.querySelector('[data-promotion-review=\"true\"]'))")?true:null,10_000)
    const initialQa=await evaluate("document.querySelector('[data-promotion-review=\"true\"]')?.getAttribute('data-promotion-qa')")
    const defaultParity=await evaluate("document.querySelector('[data-promotion-review=\"true\"]')?.getAttribute('data-default-parity')")
    if(initialQa!=='passed'||defaultParity!=='true')throw new Error(`Promotion review route loaded with qa=${initialQa} parity=${defaultParity}.`)
    await capture('project-a-and-default.png',true)
    await evaluate("document.querySelector('[data-promotion-preview=\"project-b\"]')?.scrollIntoView({block:'center'})")
    await sleep(60)
    frameSink=data=>frames.push(data)
    await send('Page.startScreencast',{format:'jpeg',quality:84,maxWidth:1440,maxHeight:1100,everyNthFrame:1})
    const started=Date.now()
    await waitFor(async()=>await evaluate("document.querySelector('[data-promotion-review=\"true\"]')?.getAttribute('data-promotion-full-playback') === 'true'")?true:null,12_000)
    const elapsedMs=Date.now()-started
    await sleep(180);await send('Page.stopScreencast');frameSink=null
    if(frames.length<5)throw new Error(`Promotion review completed but emitted only ${frames.length} screencast frames.`)
    const sampleCount=7,files:string[]=[]
    for(let sample=0;sample<sampleCount;sample+=1){const frameIndex=Math.round(sample*(frames.length-1)/Math.max(1,sampleCount-1));const file=`project-b-1x-${String(sample).padStart(2,'0')}.jpg`;files.push(file);await writeFile(resolve(outputRoot,file),Buffer.from(frames[frameIndex]!,'base64'))}
    await capture('promotion-review-full-page.png',true)
    const finalTick=Number(await evaluate("document.querySelector('[data-promotion-review=\"true\"]')?.getAttribute('data-promotion-current-tick')"))
    const durationTicks=Number(await evaluate("document.querySelector('[data-promotion-review=\"true\"]')?.getAttribute('data-promotion-duration-ticks')"))
    const projectBText=String(await evaluate("document.querySelector('[data-promotion-preview=\"project-b\"]')?.textContent ?? ''"))
    const sourceText=String(await evaluate("document.querySelector('[data-promotion-preview=\"source\"]')?.textContent ?? ''"))
    const promotedText=String(await evaluate("document.querySelector('[data-promotion-preview=\"promoted-default\"]')?.textContent ?? ''"))
    const semanticNodeVisible=Boolean(await evaluate("Boolean(document.querySelector('[data-promotion-preview=\"project-b\"] [data-motion-node-id=\"cost-card.value\"]'))"))
    const graphBacked=await evaluate("document.querySelector('[data-promotion-preview=\"project-b\"] [data-motion-component-id=\"sanverse.cost-value-card\"]')?.getAttribute('data-motion-graph-backed')")
    const origin=await evaluate("document.querySelector('[data-promotion-review=\"true\"]')?.getAttribute('data-origin')")
    const reuseStatus=await evaluate("document.querySelector('[data-promotion-review=\"true\"]')?.getAttribute('data-reuse-status')")
    const deepEditability=await evaluate("document.querySelector('[data-promotion-review=\"true\"]')?.getAttribute('data-deep-editability')")
    const adaptedContent=projectBText.includes('Retention compounds faster')&&projectBText.includes('82%')&&projectBText.includes('Same design language')
    const sourcePreserved=sourceText.includes('What one month buys you')&&!sourceText.includes('Retention compounds faster')
    const defaultPreserved=promotedText.includes('What one month buys you')&&!promotedText.includes('Retention compounds faster')
    if(finalTick!==durationTicks||!adaptedContent||!sourcePreserved||!defaultPreserved||!semanticNodeVisible||graphBacked!=='true'||origin!=='generated'||reuseStatus!=='promoted-reusable'||deepEditability!=='true')throw new Error(`Promotion browser evidence failed: final=${finalTick}/${durationTicks} adapted=${adaptedContent} source=${sourcePreserved} default=${defaultPreserved} semantic=${semanticNodeVisible} graph=${graphBacked} origin=${origin} reuse=${reuseStatus} edit=${deepEditability}`)
    const evidence={schemaVersion:'sanverse.promotion-reuse-browser-evidence/v1',recordedAt:new Date().toISOString(),route:'/promotion-review',speed:1,elapsedMs,capturedFrames:frames.length,samples:files,fullPlaybackVerified:true,finalTick,durationTicks,sourcePreview:true,promotedDefaultPreview:true,projectBPreview:true,adaptedContent,sourcePreserved,defaultPreserved,defaultParity:true,promotionQa:'passed',origin,reuseStatus,semanticNodeId:'cost-card.value',semanticNodeVisible,graphBacked,deepEditability,productionWebTouched:false}
    await writeFile(resolve(outputRoot,'runtime-evidence.json'),`${JSON.stringify(evidence,null,2)}\n`,'utf8')
    console.log(`PROMOTION_BROWSER fullPlayback=true elapsedMs=${elapsedMs} capturedFrames=${frames.length} finalTick=${finalTick} durationTicks=${durationTicks} adapted=${adaptedContent} sourcePreserved=${sourcePreserved} defaultPreserved=${defaultPreserved} semanticNodeVisible=${semanticNodeVisible} graphBacked=${graphBacked} origin=${origin} reuseStatus=${reuseStatus}`)
  } finally {frameSink=null;ws.close();browser.kill();if(startedServer)startedServer.kill()}
}
void main().catch(error=>{console.error(error);process.exitCode=1})
