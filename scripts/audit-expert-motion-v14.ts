import { spawn } from 'node:child_process'
import { mkdir,rm,writeFile } from 'node:fs/promises'
import { dirname,resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const serverPort=2500+(process.pid%300),serverUrl=`http://127.0.0.1:${serverPort}/expert-motion-review`
const debugPort=9900+(process.pid%80),debugUrl=`http://127.0.0.1:${debugPort}`
const outputRoot=resolve(root,'motion/visual-baselines/expert-motion-v1.4')
const profileDir=resolve(root,`tmp/expert-motion-v14-edge-profile-${process.pid}`)
const edge=process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':process.env.CHROME_BIN??'google-chrome'
const sleep=(ms:number)=>new Promise(resolveDelay=>setTimeout(resolveDelay,ms))
const waitFor=async<T>(fn:()=>Promise<T|null>,timeoutMs:number):Promise<T>=>{const started=Date.now();while(Date.now()-started<timeoutMs){const value=await fn();if(value!==null)return value;await sleep(80)}throw new Error(`Timed out after ${timeoutMs}ms.`)}
const serverReady=async()=>{try{return(await fetch(serverUrl)).ok}catch{return false}}

const main=async()=>{
  await rm(outputRoot,{recursive:true,force:true});await mkdir(outputRoot,{recursive:true});await rm(profileDir,{recursive:true,force:true})
  let startedServer:ReturnType<typeof spawn>|null=null
  if(!(await serverReady())){const viteBin=resolve(root,'node_modules/vite/bin/vite.js');startedServer=spawn(process.execPath,[viteBin,'--host','127.0.0.1','--port',String(serverPort),'--strictPort'],{cwd:resolve(root,'apps/motion-lab'),stdio:'ignore',windowsHide:process.platform==='win32'});await waitFor(async()=>await serverReady()?true:null,15_000)}
  const browser=spawn(edge,['--headless=new','--disable-gpu','--hide-scrollbars',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'--window-size=1680,1050','about:blank'],{cwd:root,stdio:'ignore',windowsHide:true})
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
    try{await waitFor(async()=>await evaluate("Boolean(document.querySelector('[data-expert-motion-review=\"true\"]'))")?true:null,8_000)}catch{const body=String(await evaluate("document.body?.innerText ?? ''"));throw new Error(`Expert Motion route did not render. console=${JSON.stringify(consoleErrors)} body=${body.slice(0,900)}`)}
    const startTick=Number(await evaluate("document.querySelector('[data-expert-motion-review=\"true\"]')?.getAttribute('data-expert-current-tick')"))
    frameSink=data=>frames.push(data);await send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1680,maxHeight:1050,everyNthFrame:1});const started=Date.now()
    await waitFor(async()=>await evaluate("document.querySelector('[data-expert-motion-review=\"true\"]')?.getAttribute('data-expert-full-playback') === 'true'")?true:null,12_000)
    const elapsedMs=Date.now()-started;await sleep(180);await send('Page.stopScreencast');frameSink=null
    if(frames.length<5)throw new Error(`Expert Motion review completed with only ${frames.length} screencast frames.`)
    const sampleFiles:string[]=[];for(let i=0;i<7;i++){const index=Math.round(i*(frames.length-1)/6),file=`expert-motion-1x-${String(i).padStart(2,'0')}.jpg`;sampleFiles.push(file);await writeFile(resolve(outputRoot,file),Buffer.from(frames[index]!,'base64'))}
    await capture('expert-motion-full-page.png',true)
    const finalTick=Number(await evaluate("document.querySelector('[data-expert-motion-review=\"true\"]')?.getAttribute('data-expert-current-tick')")),durationTicks=Number(await evaluate("document.querySelector('[data-expert-motion-review=\"true\"]')?.getAttribute('data-expert-duration-ticks')")),playbackRate=Number(await evaluate("document.querySelector('[data-expert-motion-review=\"true\"]')?.getAttribute('data-expert-playback-rate')"))
    const graphBacked=await evaluate("document.querySelector('[data-expert-motion-review=\"true\"]')?.getAttribute('data-expert-graph-backed') === 'true'"),directSeek=await evaluate("document.querySelector('[data-expert-motion-review=\"true\"]')?.getAttribute('data-expert-direct-seek') === 'true'"),qa=String(await evaluate("document.querySelector('[data-expert-motion-review=\"true\"]')?.getAttribute('data-expert-qa') ?? ''")),c3Count=Number(await evaluate("document.querySelector('[data-expert-motion-review=\"true\"]')?.getAttribute('data-expert-c3-count')")),c6Count=Number(await evaluate("document.querySelector('[data-expert-motion-review=\"true\"]')?.getAttribute('data-expert-c6-count')"))
    const programs=await evaluate("[...document.querySelectorAll('[data-motion-expert-surface]')].map(el=>el.getAttribute('data-motion-expert-program'))") as string[],surfaceCount=programs.length
    const ringCount=Number(await evaluate("document.querySelectorAll('[data-expert-proof=\"procedural\"] [data-expert-primitive=\"ring\"]').length")),particleCount=Number(await evaluate("document.querySelectorAll('[data-expert-proof=\"particles\"] [data-expert-primitive=\"particle\"]').length")),shaderTick=Number(await evaluate("document.querySelector('[data-expert-proof=\"shader\"] [data-expert-shader]')?.getAttribute('data-expert-shader-tick')")),shaderSeed=Number(await evaluate("document.querySelector('[data-expert-proof=\"shader\"] [data-expert-shader]')?.getAttribute('data-expert-shader-seed')"))
    const releaseBadResponses=badResponses.filter(item=>!item.includes('/favicon.ico')),releaseConsoleErrors=consoleErrors.filter(item=>!(item.includes('Failed to load resource')&&releaseBadResponses.length===0&&badResponses.some(response=>response.includes('/favicon.ico'))))
    const realTimeWindow=elapsedMs>=4_300&&elapsedMs<=7_500,programSet=[...programs].sort().join('|')==='orbital-rings|plasma-field|radial-burst'
    if(startTick>1_200_000||finalTick!==durationTicks||playbackRate!==1||!realTimeWindow||!graphBacked||!directSeek||qa!=='PASS'||c3Count!==3||c6Count!==3||surfaceCount!==3||!programSet||ringCount!==8||particleCount!==72||shaderTick!==durationTicks||shaderSeed!==303||releaseConsoleErrors.length||networkFailures.length||releaseBadResponses.length)throw new Error(`V1.4 browser proof failed start=${startTick} final=${finalTick}/${durationTicks} rate=${playbackRate} elapsed=${elapsedMs} realTime=${realTimeWindow} graph=${graphBacked} direct=${directSeek} qa=${qa} c3=${c3Count} c6=${c6Count} surfaces=${surfaceCount} programs=${programs.join(',')} rings=${ringCount} particles=${particleCount} shaderTick=${shaderTick} seed=${shaderSeed} console=${JSON.stringify(releaseConsoleErrors)} network=${JSON.stringify(networkFailures)} responses=${JSON.stringify(releaseBadResponses)}`)
    const evidence={schemaVersion:'sanverse.expert-motion-browser-evidence/v1',recordedAt:new Date().toISOString(),route:'/expert-motion-review',speed:1,elapsedMs,startTick,capturedFrames:frames.length,samples:sampleFiles,fullPlaybackVerified:true,finalTick,durationTicks,graphBacked:Boolean(graphBacked),directSeekSafe:Boolean(directSeek),qaStatus:qa,c3ExpertNodeCount:c3Count,c6ExpertNodeCount:c6Count,expertSurfaceCount:surfaceCount,programs,proceduralRingCount:ringCount,particleCount,shaderUniformTick:shaderTick,shaderSeed,consoleErrors:releaseConsoleErrors,networkFailures,badResponses:releaseBadResponses,ignoredBrowserNoise:badResponses.filter(item=>item.includes('/favicon.ico')),productionWebTouched:false}
    await writeFile(resolve(outputRoot,'runtime-evidence.json'),`${JSON.stringify(evidence,null,2)}\n`,'utf8')
    console.log(`EXPERT_MOTION_BROWSER fullPlayback=true elapsedMs=${elapsedMs} startTick=${startTick} frames=${frames.length} final=${finalTick}/${durationTicks} graph=${Boolean(graphBacked)} direct=${Boolean(directSeek)} qa=${qa} c3=${c3Count} c6=${c6Count} surfaces=${surfaceCount} rings=${ringCount} particles=${particleCount} shaderTick=${shaderTick} seed=${shaderSeed} consoleErrors=${releaseConsoleErrors.length} networkFailures=${networkFailures.length}`)
  } finally {frameSink=null;ws.close();browser.kill();if(startedServer)startedServer.kill();await sleep(250);await rm(profileDir,{recursive:true,force:true}).catch(()=>{})}
}
void main().catch(error=>{console.error(error);process.exitCode=1})
