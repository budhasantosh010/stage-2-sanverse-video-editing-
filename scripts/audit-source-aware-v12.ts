import { spawn,spawnSync } from 'node:child_process'
import { mkdir,rm,unlink,writeFile } from 'node:fs/promises'
import { dirname,resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const serverPort=2100+(process.pid%300),serverUrl=`http://127.0.0.1:${serverPort}/source-aware-review`
const debugPort=9300+(process.pid%400),debugUrl=`http://127.0.0.1:${debugPort}`
const outputRoot=resolve(root,'motion/visual-baselines/source-aware-v1.2')
const profileDir=resolve(root,`tmp/source-aware-v12-edge-profile-${process.pid}`)
const videoPath=resolve(root,'motion/library-previews/v12-source-proof.webm')
const edge=process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':process.env.CHROME_BIN??'google-chrome'
const sleep=(ms:number)=>new Promise(resolveDelay=>setTimeout(resolveDelay,ms))
const waitFor=async<T>(fn:()=>Promise<T|null>,timeoutMs:number):Promise<T>=>{const started=Date.now();while(Date.now()-started<timeoutMs){const value=await fn();if(value!==null)return value;await sleep(80)}throw new Error(`Timed out after ${timeoutMs}ms.`)}
const serverReady=async()=>{try{return(await fetch(serverUrl)).ok}catch{return false}}
const generateVideo=()=>{const result=spawnSync('ffmpeg',['-y','-f','lavfi','-i','color=c=0x101018:s=1280x720:r=30:d=5','-vf',"drawbox=x=80+180*t:y=120+45*t:w=120:h=120:color=cyan:t=fill,drawbox=x=360:y=230:w=520:h=300:color=0x20283a:t=fill,drawbox=x=540+15*sin(2*PI*t/5):y=120:w=170:h=500:color=0xf0a050:t=fill",'-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','5','-pix_fmt','yuv420p',videoPath],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30_000});if(result.status!==0)throw new Error(`ffmpeg source proof failed: ${result.stderr||result.stdout}`)}

const main=async()=>{
  await mkdir(dirname(videoPath),{recursive:true});generateVideo();await rm(outputRoot,{recursive:true,force:true});await mkdir(outputRoot,{recursive:true});await rm(profileDir,{recursive:true,force:true})
  let startedServer:ReturnType<typeof spawn>|null=null
  if(!(await serverReady())){const viteBin=resolve(root,'node_modules/vite/bin/vite.js');startedServer=spawn(process.execPath,[viteBin,'--host','127.0.0.1','--port',String(serverPort),'--strictPort'],{cwd:resolve(root,'apps/motion-lab'),stdio:'ignore',windowsHide:process.platform==='win32'});await waitFor(async()=>await serverReady()?true:null,15_000)}
  const browser=spawn(edge,['--headless=new','--disable-gpu','--hide-scrollbars','--autoplay-policy=no-user-gesture-required',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'--window-size=1600,1000','about:blank'],{cwd:root,stdio:'ignore',windowsHide:true})
  interface TargetInfo{webSocketDebuggerUrl?:string;type?:string}
  const target=await waitFor(async()=>{try{const list=await(await fetch(`${debugUrl}/json/list`)).json() as TargetInfo[];return list.find(candidate=>candidate.type==='page'&&candidate.webSocketDebuggerUrl)?.webSocketDebuggerUrl??null}catch{return null}},12_000)
  const ws=new WebSocket(target);let nextId=1;const pending=new Map<number,{resolve:(value:any)=>void;reject:(reason:unknown)=>void}>();let frameSink:((data:string)=>void)|null=null
  const consoleErrors:string[]=[],networkFailures:string[]=[],badResponses:string[]=[]
  ws.on('message',raw=>{const msg=JSON.parse(String(raw));if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id)!;pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);return}if(msg.method==='Page.screencastFrame'&&frameSink){frameSink(msg.params.data);void send('Page.screencastFrameAck',{sessionId:msg.params.sessionId})}if(msg.method==='Runtime.exceptionThrown')consoleErrors.push(String(msg.params?.exceptionDetails?.exception?.description??msg.params?.exceptionDetails?.text??'Runtime exception'));if(msg.method==='Log.entryAdded'&&msg.params?.entry?.level==='error')consoleErrors.push(String(msg.params.entry.text));if(msg.method==='Network.loadingFailed')networkFailures.push(String(msg.params?.errorText??'loading failed'));if(msg.method==='Network.responseReceived'&&Number(msg.params?.response?.status)>=400)badResponses.push(`${msg.params.response.status} ${msg.params.response.url}`)})
  const send=(method:string,params:Record<string,unknown>={})=>new Promise<any>((resolveValue,reject)=>{const id=nextId++;pending.set(id,{resolve:resolveValue,reject});ws.send(JSON.stringify({id,method,params}))})
  await new Promise<void>((resolveOpen,reject)=>{ws.once('open',()=>resolveOpen());ws.once('error',reject)})
  await send('Page.enable');await send('Runtime.enable');await send('Log.enable');await send('Network.enable')
  const evaluate=async(expression:string)=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});return result.result?.value}
  const capture=async(file:string,beyondViewport=false)=>{const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:beyondViewport,fromSurface:true});await writeFile(resolve(outputRoot,file),Buffer.from(shot.data,'base64'))}
  const frames:string[]=[]
  try{
    await send('Page.navigate',{url:serverUrl})
    try{await waitFor(async()=>await evaluate("Boolean(document.querySelector('[data-source-aware-review=\"true\"]'))")?true:null,8_000)}catch{const body=String(await evaluate("document.body?.innerText ?? ''"));throw new Error(`Source-aware route did not render. console=${JSON.stringify(consoleErrors)} body=${body.slice(0,500)}`)}
    try{await waitFor(async()=>await evaluate("document.querySelector('[data-source-aware-review=\"true\"]')?.getAttribute('data-source-video-ready') === 'true'")?true:null,12_000)}catch{const states=await evaluate("[...document.querySelectorAll('[data-source-video]')].map(v=>({readyState:v.readyState,error:v.error?.message??null,src:v.currentSrc}))");throw new Error(`Source video never became ready. states=${JSON.stringify(states)} console=${JSON.stringify(consoleErrors)} network=${JSON.stringify(networkFailures)} responses=${JSON.stringify(badResponses)}`)}
    frameSink=data=>frames.push(data);await send('Page.startScreencast',{format:'jpeg',quality:86,maxWidth:1600,maxHeight:1000,everyNthFrame:1});const started=Date.now()
    await waitFor(async()=>await evaluate("document.querySelector('[data-source-aware-review=\"true\"]')?.getAttribute('data-source-aware-full-playback') === 'true'")?true:null,12_000)
    const elapsedMs=Date.now()-started;await sleep(180);await send('Page.stopScreencast');frameSink=null
    if(frames.length<5)throw new Error(`Source-aware review completed with only ${frames.length} screencast frames.`)
    const sampleFiles:string[]=[];for(let i=0;i<7;i++){const index=Math.round(i*(frames.length-1)/6),file=`source-aware-1x-${String(i).padStart(2,'0')}.jpg`;sampleFiles.push(file);await writeFile(resolve(outputRoot,file),Buffer.from(frames[index]!,'base64'))}
    await capture('source-aware-full-page.png',true)
    const finalTick=Number(await evaluate("document.querySelector('[data-source-aware-review=\"true\"]')?.getAttribute('data-source-aware-current-tick')")),durationTicks=Number(await evaluate("document.querySelector('[data-source-aware-review=\"true\"]')?.getAttribute('data-source-aware-duration-ticks')"))
    const currentTimes=await evaluate("[...document.querySelectorAll('[data-source-video]')].map(v=>v.currentTime)") as number[]
    const graphBacked=await evaluate("[...document.querySelectorAll('[data-source-aware-panel] [data-motion-component-id]')].every(el=>el.getAttribute('data-motion-graph-backed')==='true')")
    const semanticIds=await evaluate("[...document.querySelectorAll('[data-source-aware-panel] [data-motion-node-id=\"source-proof.root\"]')].length")
    const m5Transform=String(await evaluate("document.querySelector('[data-source-aware-panel=\"m5\"] [data-motion-node-id=\"source-proof.root\"]')?.style.transform ?? ''"))
    const m6Transform=String(await evaluate("document.querySelector('[data-source-aware-panel=\"m6\"] [data-motion-node-id=\"source-proof.root\"]')?.style.transform ?? ''"))
    const m7Mask=String(await evaluate("document.querySelector('[data-source-aware-panel=\"m7\"] [data-motion-node-id=\"source-proof.root\"]')?.style.maskImage || document.querySelector('[data-source-aware-panel=\"m7\"] [data-motion-node-id=\"source-proof.root\"]')?.style.webkitMaskImage || ''"))
    const m5=Boolean(m5Transform&&/translate3d|scale/u.test(m5Transform)),m6=m6Transform.includes('matrix3d('),m7=m7Mask.includes('data:image/svg+xml')
    const releaseBadResponses=badResponses.filter(item=>!item.includes('/favicon.ico')),releaseConsoleErrors=consoleErrors.filter(item=>!(item.includes('Failed to load resource')&&releaseBadResponses.length===0&&badResponses.some(response=>response.includes('/favicon.ico'))))
    if(finalTick!==durationTicks||!graphBacked||semanticIds!==3||!m5||!m6||!m7||currentTimes.some(value=>value<4.5)||releaseConsoleErrors.length||networkFailures.length||releaseBadResponses.length)throw new Error(`Source-aware browser proof failed final=${finalTick}/${durationTicks} graph=${graphBacked} semantic=${semanticIds} m5=${m5} m6=${m6} m7=${m7} video=${JSON.stringify(currentTimes)} console=${JSON.stringify(releaseConsoleErrors)} network=${JSON.stringify(networkFailures)} responses=${JSON.stringify(releaseBadResponses)}`)
    const evidence={schemaVersion:'sanverse.source-aware-browser-evidence/v1',recordedAt:new Date().toISOString(),route:'/source-aware-review',sourceFixture:'temporary VP9/WebM 1280x720 30fps 5s encoded by ffmpeg; not committed',speed:1,elapsedMs,capturedFrames:frames.length,samples:sampleFiles,fullPlaybackVerified:true,finalTick,durationTicks,sourceVideoCurrentTimes:currentTimes,graphBacked,semanticNodeId:'source-proof.root',semanticNodeCount:semanticIds,m5TrackedAttached:m5,m6SurfaceEmbedded:m6,m7SubjectEnvironment:m7,consoleErrors:releaseConsoleErrors,networkFailures,badResponses:releaseBadResponses,ignoredBrowserNoise:badResponses.filter(item=>item.includes('/favicon.ico')),productionWebTouched:false}
    await writeFile(resolve(outputRoot,'runtime-evidence.json'),`${JSON.stringify(evidence,null,2)}\n`,'utf8')
    console.log(`SOURCE_AWARE_BROWSER fullPlayback=true elapsedMs=${elapsedMs} frames=${frames.length} final=${finalTick}/${durationTicks} m5=${m5} m6=${m6} m7=${m7} graph=${graphBacked} videoMin=${Math.min(...currentTimes).toFixed(3)} consoleErrors=${consoleErrors.length} networkFailures=${networkFailures.length}`)
  } finally {frameSink=null;ws.close();browser.kill();if(startedServer)startedServer.kill();await unlink(videoPath).catch(()=>{});await sleep(250);await rm(profileDir,{recursive:true,force:true}).catch(()=>{})}
}
void main().catch(error=>{console.error(error);process.exitCode=1})
