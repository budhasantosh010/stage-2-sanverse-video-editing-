import { spawn } from 'node:child_process'
import { mkdir,rm,writeFile } from 'node:fs/promises'
import { dirname,resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const serverPort=2800+(process.pid%300),serverUrl=`http://127.0.0.1:${serverPort}/performance-review`
const debugPort=10100+(process.pid%80),debugUrl=`http://127.0.0.1:${debugPort}`
const outputRoot=resolve(root,'motion/visual-baselines/performance-v1.5')
const profileDir=resolve(root,`tmp/performance-v15-edge-profile-${process.pid}`)
const edge=process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':process.env.CHROME_BIN??'google-chrome'
const sleep=(ms:number)=>new Promise(resolveDelay=>setTimeout(resolveDelay,ms))
const waitFor=async<T>(fn:()=>Promise<T|null>,timeoutMs:number):Promise<T>=>{const started=Date.now();while(Date.now()-started<timeoutMs){const value=await fn();if(value!==null)return value;await sleep(80)}throw new Error(`Timed out after ${timeoutMs}ms.`)}
const serverReady=async()=>{try{return(await fetch(serverUrl)).ok}catch{return false}}

const main=async()=>{
  await rm(outputRoot,{recursive:true,force:true});await mkdir(outputRoot,{recursive:true});await rm(profileDir,{recursive:true,force:true})
  let startedServer:ReturnType<typeof spawn>|null=null
  if(!(await serverReady())){const viteBin=resolve(root,'node_modules/vite/bin/vite.js');startedServer=spawn(process.execPath,[viteBin,'--host','127.0.0.1','--port',String(serverPort),'--strictPort'],{cwd:resolve(root,'apps/motion-lab'),stdio:'ignore',windowsHide:process.platform==='win32'});await waitFor(async()=>await serverReady()?true:null,20_000)}
  const browser=spawn(edge,['--headless=new','--hide-scrollbars',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'--window-size=1720,1200','--force-device-scale-factor=1','about:blank'],{cwd:root,stdio:'ignore',windowsHide:true})
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
  const captureElement=async(selector:string)=>{const rect=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);if(!rect)throw new Error(`Missing element ${selector}`);const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,clip:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,scale:1}});return String(shot.data)}
  const frames:string[]=[]
  try{
    await send('Page.navigate',{url:serverUrl})
    try{await waitFor(async()=>await evaluate("Boolean(document.querySelector('[data-v15-performance-review=\"true\"]'))")?true:null,25_000)}catch{const body=String(await evaluate("document.body?.innerText ?? ''"));throw new Error(`V1.5 performance route did not render. console=${JSON.stringify(consoleErrors)} body=${body.slice(0,1200)}`)}
    const startTick=Number(await evaluate("document.querySelector('[data-v15-performance-review=\"true\"]')?.getAttribute('data-v15-current-tick')"))
    frameSink=data=>frames.push(data);await send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1720,maxHeight:1200,everyNthFrame:1});const started=Date.now()
    await waitFor(async()=>await evaluate("document.querySelector('[data-v15-performance-review=\"true\"]')?.getAttribute('data-v15-full-playback') === 'true'")?true:null,20_000)
    const elapsedMs=Date.now()-started;await sleep(240);await send('Page.stopScreencast');frameSink=null
    if(frames.length<20)throw new Error(`V1.5 stress review completed with only ${frames.length} screencast frames.`)
    const sampleFiles:string[]=[];for(let i=0;i<7;i++){const index=Math.round(i*(frames.length-1)/6),file=`performance-1x-${String(i).padStart(2,'0')}.jpg`;sampleFiles.push(file);await writeFile(resolve(outputRoot,file),Buffer.from(frames[index]!,'base64'))}
    await capture('performance-full-page.png',true)
    const attr=async(name:string)=>String(await evaluate(`document.querySelector('[data-v15-performance-review="true"]')?.getAttribute(${JSON.stringify(name)}) ?? ''`))
    const finalTick=Number(await attr('data-v15-current-tick')),durationTicks=Number(await attr('data-v15-duration-ticks')),playbackRate=Number(await attr('data-v15-playback-rate'))
    const nodeCount=Number(await attr('data-v15-node-count')),animatedProperties=Number(await attr('data-v15-animated-properties')),maskCount=Number(await attr('data-v15-mask-count')),frameCount=Number(await attr('data-v15-frame-count'))
    const directSeek=(await attr('data-v15-direct-seek'))==='true',trackingSeek=(await attr('data-v15-tracking-seek'))==='true',cameraSeek=(await attr('data-v15-camera-seek'))==='true',graphParity=(await attr('data-v15-parity'))==='true',longProject=(await attr('data-v15-long-project'))==='true',expertBudget=(await attr('data-v15-expert-budget'))==='true',staticGates=(await attr('data-v15-static-gates'))==='true',resources=Number(await attr('data-v15-resources'))
    const evalP95Ms=Number(await attr('data-v15-frame-eval-p95-ms')),evalMaxMs=Number(await attr('data-v15-frame-eval-max-ms'))
    const previewPng=await captureElement('[data-v15-text-surface="preview"]'),exportPng=await captureElement('[data-v15-text-surface="export"]'),textPixelParity=previewPng===exportPng
    await writeFile(resolve(outputRoot,'text-preview.png'),Buffer.from(previewPng,'base64'));await writeFile(resolve(outputRoot,'text-export.png'),Buffer.from(exportPng,'base64'))
    const releaseBadResponses=badResponses.filter(item=>!item.includes('/favicon.ico')),releaseConsoleErrors=consoleErrors.filter(item=>!(item.includes('Failed to load resource')&&releaseBadResponses.length===0&&badResponses.some(response=>response.includes('/favicon.ico'))))
    const realTimeWindow=elapsedMs>=8_500&&elapsedMs<=14_500
    const performanceBudgetOk=Number.isFinite(evalP95Ms)&&evalP95Ms<=50&&Number.isFinite(evalMaxMs)&&evalMaxMs<=500
    if(startTick>2_000_000||finalTick!==durationTicks||playbackRate!==1||!realTimeWindow||nodeCount<504||animatedProperties<2_000||maskCount<20||frameCount<20||!directSeek||!trackingSeek||!cameraSeek||!graphParity||!textPixelParity||!longProject||resources!==0||!expertBudget||!staticGates||!performanceBudgetOk||releaseConsoleErrors.length||networkFailures.length||releaseBadResponses.length)throw new Error(`V1.5 browser proof failed start=${startTick} final=${finalTick}/${durationTicks} rate=${playbackRate} elapsed=${elapsedMs} nodes=${nodeCount} animated=${animatedProperties} masks=${maskCount} frames=${frameCount} direct=${directSeek} tracking=${trackingSeek} camera=${cameraSeek} graphParity=${graphParity} textPixels=${textPixelParity} longProject=${longProject} resources=${resources} expert=${expertBudget} p95=${evalP95Ms} max=${evalMaxMs} console=${JSON.stringify(releaseConsoleErrors)} network=${JSON.stringify(networkFailures)} responses=${JSON.stringify(releaseBadResponses)}`)
    const evidence={schemaVersion:'sanverse.performance-browser-evidence/v1',recordedAt:new Date().toISOString(),route:'/performance-review',speed:1,elapsedMs,startTick,capturedFrames:frames.length,renderedFrameCount:frameCount,samples:sampleFiles,fullPlaybackVerified:true,finalTick,durationTicks,nodeCount,animatedProperties,maskCount,directSeekSafe:directSeek,trackingDirectSeekSafe:trackingSeek,cameraDirectSeekSafe:cameraSeek,graphPreviewExportParity:graphParity,textPixelParity,longProjectReliability:longProject,resourceLeaks:resources,expertBudgetPassed:expertBudget,preparedFrameEvaluationP95Ms:evalP95Ms,preparedFrameEvaluationMaxMs:evalMaxMs,performanceBudgetOk,consoleErrors:releaseConsoleErrors,networkFailures,badResponses:releaseBadResponses,ignoredBrowserNoise:badResponses.filter(item=>item.includes('/favicon.ico')),productionWebTouched:false}
    await writeFile(resolve(outputRoot,'runtime-evidence.json'),`${JSON.stringify(evidence,null,2)}\n`,'utf8')
    console.log(`V15_PERFORMANCE_BROWSER fullPlayback=true elapsedMs=${elapsedMs} startTick=${startTick} frames=${frames.length}/${frameCount} final=${finalTick}/${durationTicks} nodes=${nodeCount} animated=${animatedProperties} masks=${maskCount} direct=${directSeek} tracking=${trackingSeek} camera=${cameraSeek} graphParity=${graphParity} textPixels=${textPixelParity} resources=${resources} expert=${expertBudget} p95Ms=${evalP95Ms} maxMs=${evalMaxMs} consoleErrors=${releaseConsoleErrors.length} networkFailures=${networkFailures.length}`)
  } finally {frameSink=null;ws.close();browser.kill();if(startedServer)startedServer.kill();await sleep(300);await rm(profileDir,{recursive:true,force:true}).catch(()=>{})}
}
void main().catch(error=>{console.error(error);process.exitCode=1})
