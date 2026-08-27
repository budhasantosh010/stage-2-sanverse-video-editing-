import { spawn } from 'node:child_process'
import { mkdir,rm,writeFile } from 'node:fs/promises'
import { dirname,resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const serverPort=2400+(process.pid%300),serverUrl=`http://127.0.0.1:${serverPort}/camera-depth-review`
const debugPort=9700+(process.pid%200),debugUrl=`http://127.0.0.1:${debugPort}`
const outputRoot=resolve(root,'motion/visual-baselines/camera-depth-v1.3')
const profileDir=resolve(root,`tmp/camera-depth-v13-edge-profile-${process.pid}`)
const edge=process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':process.env.CHROME_BIN??'google-chrome'
const sleep=(ms:number)=>new Promise(resolveDelay=>setTimeout(resolveDelay,ms))
const waitFor=async<T>(fn:()=>Promise<T|null>,timeoutMs:number):Promise<T>=>{const started=Date.now();while(Date.now()-started<timeoutMs){const value=await fn();if(value!==null)return value;await sleep(80)}throw new Error(`Timed out after ${timeoutMs}ms.`)}
const serverReady=async()=>{try{return(await fetch(serverUrl)).ok}catch{return false}}

const main=async()=>{
  await rm(outputRoot,{recursive:true,force:true});await mkdir(outputRoot,{recursive:true});await rm(profileDir,{recursive:true,force:true})
  let startedServer:ReturnType<typeof spawn>|null=null
  if(!(await serverReady())){const viteBin=resolve(root,'node_modules/vite/bin/vite.js');startedServer=spawn(process.execPath,[viteBin,'--host','127.0.0.1','--port',String(serverPort),'--strictPort'],{cwd:resolve(root,'apps/motion-lab'),stdio:'ignore',windowsHide:process.platform==='win32'});await waitFor(async()=>await serverReady()?true:null,15_000)}
  const browser=spawn(edge,['--headless=new','--disable-gpu','--hide-scrollbars',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'--window-size=1600,1000','about:blank'],{cwd:root,stdio:'ignore',windowsHide:true})
  interface TargetInfo{webSocketDebuggerUrl?:string;type?:string}
  const target=await waitFor(async()=>{try{const list=await(await fetch(`${debugUrl}/json/list`)).json() as TargetInfo[];return list.find(candidate=>candidate.type==='page'&&candidate.webSocketDebuggerUrl)?.webSocketDebuggerUrl??null}catch{return null}},12_000)
  const ws=new WebSocket(target);let nextId=1;const pending=new Map<number,{resolve:(value:any)=>void;reject:(reason:unknown)=>void}>();let frameSink:((data:string)=>void)|null=null
  const consoleErrors:string[]=[],networkFailures:string[]=[],badResponses:string[]=[]
  const send=(method:string,params:Record<string,unknown>={})=>new Promise<any>((resolveValue,reject)=>{const id=nextId++;pending.set(id,{resolve:resolveValue,reject});ws.send(JSON.stringify({id,method,params}))})
  ws.on('message',raw=>{const msg=JSON.parse(String(raw));if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id)!;pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);return}if(msg.method==='Page.screencastFrame'&&frameSink){frameSink(msg.params.data);void send('Page.screencastFrameAck',{sessionId:msg.params.sessionId})}if(msg.method==='Runtime.exceptionThrown')consoleErrors.push(String(msg.params?.exceptionDetails?.exception?.description??msg.params?.exceptionDetails?.text??'Runtime exception'));if(msg.method==='Log.entryAdded'&&msg.params?.entry?.level==='error')consoleErrors.push(String(msg.params.entry.text));if(msg.method==='Network.loadingFailed')networkFailures.push(String(msg.params?.errorText??'loading failed'));if(msg.method==='Network.responseReceived'&&Number(msg.params?.response?.status)>=400)badResponses.push(`${msg.params.response.status} ${msg.params.response.url}`)})
  await new Promise<void>((resolveOpen,reject)=>{ws.once('open',()=>resolveOpen());ws.once('error',reject)})
  await send('Page.enable');await send('Runtime.enable');await send('Log.enable');await send('Network.enable')
  const evaluate=async(expression:string)=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});return result.result?.value}
  const capture=async(file:string,beyondViewport=false)=>{const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:beyondViewport,fromSurface:true});await writeFile(resolve(outputRoot,file),Buffer.from(shot.data,'base64'))}
  const frames:string[]=[]
  try{
    await send('Page.navigate',{url:serverUrl})
    try{await waitFor(async()=>await evaluate("Boolean(document.querySelector('[data-camera-depth-review=\"true\"]'))")?true:null,8_000)}catch{const body=String(await evaluate("document.body?.innerText ?? ''"));throw new Error(`Camera/depth route did not render. console=${JSON.stringify(consoleErrors)} body=${body.slice(0,700)}`)}
    const startTick=Number(await evaluate("document.querySelector('[data-camera-depth-review=\"true\"]')?.getAttribute('data-camera-depth-current-tick')"))
    frameSink=data=>frames.push(data);await send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1600,maxHeight:1000,everyNthFrame:1});const started=Date.now()
    await waitFor(async()=>await evaluate("document.querySelector('[data-camera-depth-review=\"true\"]')?.getAttribute('data-camera-depth-full-playback') === 'true'")?true:null,12_000)
    const elapsedMs=Date.now()-started;await sleep(180);await send('Page.stopScreencast');frameSink=null
    if(frames.length<5)throw new Error(`Camera/depth review completed with only ${frames.length} screencast frames.`)
    const sampleFiles:string[]=[];for(let i=0;i<7;i++){const index=Math.round(i*(frames.length-1)/6),file=`camera-depth-1x-${String(i).padStart(2,'0')}.jpg`;sampleFiles.push(file);await writeFile(resolve(outputRoot,file),Buffer.from(frames[index]!,'base64'))}
    await capture('camera-depth-full-page.png',true)
    const finalTick=Number(await evaluate("document.querySelector('[data-camera-depth-review=\"true\"]')?.getAttribute('data-camera-depth-current-tick')")),durationTicks=Number(await evaluate("document.querySelector('[data-camera-depth-review=\"true\"]')?.getAttribute('data-camera-depth-duration-ticks')"))
    const c9Composed=await evaluate("document.querySelector('[data-camera-depth-review=\"true\"]')?.getAttribute('data-camera-depth-c9-composed') === 'true'")
    const declaredGraph=await evaluate("document.querySelector('[data-camera-depth-review=\"true\"]')?.getAttribute('data-camera-depth-graph-backed') === 'true'")
    const graphHost=await evaluate("document.querySelector('[data-camera-depth-review] [data-motion-component-id]')?.getAttribute('data-motion-graph-backed') === 'true'")
    const b8=String(await evaluate("document.querySelector('[data-camera-depth-review=\"true\"]')?.getAttribute('data-camera-depth-b8') ?? ''")),rive=String(await evaluate("document.querySelector('[data-camera-depth-review=\"true\"]')?.getAttribute('data-camera-depth-rive') ?? ''"))
    const transforms=await evaluate("Object.fromEntries([...document.querySelectorAll('[data-depth-layer]')].map(el=>[el.getAttribute('data-depth-layer'),el.style.transform]))") as Record<string,string>
    const layerCount=Object.keys(transforms).length,distinctTransforms=new Set(Object.values(transforms).filter(Boolean)).size
    const releaseBadResponses=badResponses.filter(item=>!item.includes('/favicon.ico')),releaseConsoleErrors=consoleErrors.filter(item=>!(item.includes('Failed to load resource')&&releaseBadResponses.length===0&&badResponses.some(response=>response.includes('/favicon.ico'))))
    const realTimeWindow=elapsedMs>=4_300&&elapsedMs<=7_500
    if(startTick>1_200_000||finalTick!==durationTicks||!realTimeWindow||!c9Composed||!declaredGraph||!graphHost||b8!=='restrained'||rive!=='native-materialize'||layerCount!==4||distinctTransforms<3||releaseConsoleErrors.length||networkFailures.length||releaseBadResponses.length)throw new Error(`V1.3 browser proof failed start=${startTick} final=${finalTick}/${durationTicks} elapsed=${elapsedMs} realTime=${realTimeWindow} c9=${c9Composed} declaredGraph=${declaredGraph} graphHost=${graphHost} b8=${b8} rive=${rive} layers=${layerCount} distinct=${distinctTransforms} transforms=${JSON.stringify(transforms)} console=${JSON.stringify(releaseConsoleErrors)} network=${JSON.stringify(networkFailures)} responses=${JSON.stringify(releaseBadResponses)}`)
    const evidence={schemaVersion:'sanverse.camera-depth-browser-evidence/v1',recordedAt:new Date().toISOString(),route:'/camera-depth-review',speed:1,elapsedMs,startTick,capturedFrames:frames.length,samples:sampleFiles,fullPlaybackVerified:true,finalTick,durationTicks,c9Composed,graphBacked:Boolean(declaredGraph&&graphHost),depthLayerCount:layerCount,distinctDepthTransforms:distinctTransforms,depthTransforms:transforms,b8PromotedPreference:b8,riveDecision:rive,consoleErrors:releaseConsoleErrors,networkFailures,badResponses:releaseBadResponses,ignoredBrowserNoise:badResponses.filter(item=>item.includes('/favicon.ico')),productionWebTouched:false}
    await writeFile(resolve(outputRoot,'runtime-evidence.json'),`${JSON.stringify(evidence,null,2)}\n`,'utf8')
    console.log(`CAMERA_DEPTH_BROWSER fullPlayback=true elapsedMs=${elapsedMs} startTick=${startTick} frames=${frames.length} final=${finalTick}/${durationTicks} c9=${c9Composed} graph=${Boolean(declaredGraph&&graphHost)} layers=${layerCount} distinct=${distinctTransforms} b8=${b8} rive=${rive} consoleErrors=${releaseConsoleErrors.length} networkFailures=${networkFailures.length}`)
  } finally {frameSink=null;ws.close();browser.kill();if(startedServer)startedServer.kill();await sleep(250);await rm(profileDir,{recursive:true,force:true}).catch(()=>{})}
}
void main().catch(error=>{console.error(error);process.exitCode=1})
