import { createHash } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'

import type { MotionGraphBackedComponentModuleV1, MotionSceneV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene, nodeBase } from '@sanverse/motion-graph'
import { MOTION_COMPONENT_MODULES } from '@sanverse/motion-library'
import { canonicalCreativeArtifactJsonV1, type CreativeSceneArtifactV1 } from '@sanverse/render-contract/creative-scene-artifact'
import { listProductionProjects, putProductionCreativeArtifact, readProductionProject, SANVERSE_ROOT } from './sanverse-mcp-shared.ts'

const WEB_URL = (process.env.SANVERSE_RENDER_AUDIT_WEB_URL ?? 'http://127.0.0.1:2100').replace(/\/$/u, '')
const evidenceRoot = join(SANVERSE_ROOT, '.sanverse-data', 'motion-graph-renderer-audit')
const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex')
const sleep = (ms: number): Promise<void> => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

const reservePort = async (): Promise<number> => await new Promise<number>((resolvePort, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') { server.close(); reject(new Error('Could not reserve renderer-audit browser port.')); return }
    server.close((error) => error ? reject(error) : resolvePort(address.port))
  })
})

const browserExecutable = (): string => process.env.SANVERSE_BROWSER_EXECUTABLE?.trim() || (process.platform === 'win32'
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : 'google-chrome')

interface CdpClient {
  send(method: string, params?: Readonly<Record<string, unknown>>): Promise<any>
  evaluate<T = unknown>(expression: string): Promise<T>
  close(): void
}

const connectCdp = async (webSocketUrl: string): Promise<CdpClient> => {
  const socket = new WebSocket(webSocketUrl)
  await new Promise<void>((resolveOpen, reject) => {
    socket.addEventListener('open', () => resolveOpen(), { once: true })
    socket.addEventListener('error', () => reject(new Error('Could not connect to renderer-audit browser.')), { once: true })
  })
  let nextId = 1
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>()
  socket.addEventListener('message', (event) => {
    let message: any
    try { message = JSON.parse(String(event.data)) } catch { return }
    if (typeof message.id !== 'number') return
    const item = pending.get(message.id)
    if (!item) return
    pending.delete(message.id)
    if (message.error) item.reject(new Error(String(message.error.message ?? 'CDP command failed.')))
    else item.resolve(message.result)
  })
  const send = (method: string, params: Readonly<Record<string, unknown>> = Object.freeze({})): Promise<any> => new Promise((resolveCommand, reject) => {
    if (socket.readyState !== WebSocket.OPEN) { reject(new Error('Renderer-audit browser connection closed.')); return }
    const id = nextId++
    pending.set(id, { resolve: resolveCommand, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async <T = unknown>(expression: string): Promise<T> => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(String(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Renderer-audit browser evaluation failed.'))
    return result.result?.value as T
  }
  return Object.freeze({ send, evaluate, close: () => socket.close() })
}

const waitForTarget = async (port: number, browser: ChildProcess): Promise<string> => {
  const started = Date.now()
  while (Date.now() - started < 20_000) {
    if (browser.exitCode !== null) throw new Error('Renderer-audit browser exited before DevTools became ready.')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(750) })
      if (response.ok) {
        const targets = await response.json() as Array<{ type?: string; webSocketDebuggerUrl?: string }>
        const page = targets.find((item) => item.type === 'page' && typeof item.webSocketDebuggerUrl === 'string')
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
      }
    } catch { /* browser still starting */ }
    await sleep(80)
  }
  throw new Error('Renderer-audit browser did not expose DevTools in time.')
}

const waitReady = async (cdp: CdpClient): Promise<void> => {
  const started = Date.now()
  while (Date.now() - started < 15_000) {
    const state = await cdp.evaluate<{ ready:boolean; error:string|null }>(`(()=>({ready:Boolean(document.querySelector('[data-creative-frame-ready="true"]')),error:document.querySelector('[data-creative-frame-error="true"]')?.textContent??null}))()`)
    if (state.error) throw new Error(state.error)
    if (state.ready) return
    await sleep(40)
  }
  throw new Error('Renderer-audit Creative frame did not become ready.')
}

const capture = async (cdp: CdpClient, path: string): Promise<Buffer> => {
  const shot = await cdp.send('Page.captureScreenshot', { format:'png', fromSurface:true, captureBeyondViewport:false })
  const bytes = Buffer.from(String(shot.data), 'base64')
  if (bytes.byteLength < 64) throw new Error('Renderer-audit screenshot was empty.')
  await writeFile(path, bytes)
  return bytes
}

const projects = await listProductionProjects()
const projectId = projects[0]?.id
if (!projectId) throw new Error('Renderer audit requires one existing production-backed project.')
const before = await readProductionProject(projectId)
const sourceAsset = before.assets.find((asset) => asset.mediaKind === 'video')
if (!sourceAsset) throw new Error('Renderer audit project has no video source asset.')

const module = MOTION_COMPONENT_MODULES['sanverse.floating-value-cloud'] as unknown as MotionGraphBackedComponentModuleV1<any, any>
if (!module?.createScene) throw new Error('Renderer audit component is not graph-backed.')
const width = 1280, height = 720, durationTicks = 2_880_000
const context = Object.freeze({ localTicks:720_000, durationTicks, ticksPerSecond:1_440_000, composition:Object.freeze({ width, height, fpsNumerator:30, fpsDenominator:1 }), reducedMotion:false })
const baseScene = module.createScene(module.defaultProps, module.defaultStyle, context)
const root = baseScene.nodes[baseScene.rootNodeId]
if (!root || root.type !== 'group') throw new Error('Renderer audit baseline root is not a group.')
const leftBase = nodeBase('audit.custom.magenta', 'Audit Magenta Ellipse', root.id)
const rightBase = nodeBase('audit.custom.cyan', 'Audit Cyan Card', root.id)
const textBase = nodeBase('audit.custom.text', 'Audit Text', root.id)
const magenta = Object.freeze({ ...leftBase, type:'shape' as const, shape:'ellipse' as const, width:constant(260), height:constant(180), fillColor:constant('#ff00aa'), strokeColor:constant('#ffffff'), strokeWidth:constant(8), radius:constant(90), transform:Object.freeze({ ...leftBase.transform, positionX:constant(-310), positionY:constant(40) }) })
const cyan = Object.freeze({ ...rightBase, type:'shape' as const, shape:'rounded-rectangle' as const, width:constant(290), height:constant(170), fillColor:constant('#00ddff'), strokeColor:constant('#ffffff'), strokeWidth:constant(8), radius:constant(34), transform:Object.freeze({ ...rightBase.transform, positionX:constant(310), positionY:constant(40) }) })
const label = Object.freeze({ ...textBase, type:'text' as const, text:constant('GRAPH NODES'), fillColor:constant('#ffffff'), fontFamily:'Inter, sans-serif', fontSize:constant(54), fontWeight:constant(900), textAlign:'center' as const, transform:Object.freeze({ ...textBase.transform, positionY:constant(-190) }) })
const scene: MotionSceneV1 = createMotionScene({ ...baseScene, nodes:Object.freeze({ ...baseScene.nodes, [root.id]:Object.freeze({ ...root, childIds:Object.freeze([...root.childIds, magenta.id, cyan.id, label.id]) }), [magenta.id]:magenta, [cyan.id]:cyan, [label.id]:label }), semanticParts:Object.freeze([...baseScene.semanticParts, Object.freeze({ id:'audit.custom', label:'Renderer Audit Custom Nodes', role:'content-group' as const, nodeIds:Object.freeze([magenta.id, cyan.id, label.id]) })]) })
const styleHash = hash('renderer-audit-style-lock')
const artifact: CreativeSceneArtifactV1 = Object.freeze({
  schemaVersion:'sanverse.creative-scene-artifact/v1', projectId, productionBaseRevision:before.revision, sceneId:'creative_scene_renderaudit01', opportunityId:'opportunity:renderer-audit', componentId:module.definition.id, componentVersion:module.definition.version,
  source:Object.freeze({ assetId:sourceAsset.assetId, sourceStartTick:0, sourceEndTick:durationTicks, durationTicks, width, height, fpsNumerator:30, fpsDenominator:1 }),
  presentation:Object.freeze({ mode:'overlay', sourceTreatment:'normal', backgroundTreatment:'source-video', preserveSourceAudio:true, preserveSourceVideo:true }),
  component:Object.freeze({ props:module.defaultProps, style:module.defaultStyle }),
  motion:Object.freeze({ motionPlanId:'motion-plan:renderer-audit', motionDraftId:'motion-draft:renderer-audit', motionDraftRevision:1, motionOwnerApprovalId:null, scene, selectedNodeId:magenta.id, semanticNodeIds:Object.freeze([magenta.id, cyan.id, label.id]) }),
  governance:Object.freeze({ artifactPurpose:'review', styleLockId:'stylelock_renderer_audit', styleLockContentHash:styleHash, creativeDirectionRevision:1, creativeLanguageId:'creative-language:renderer-audit', cohesionScore:1, requiredCapabilities:Object.freeze([]), structuralQaPassed:true, reviewEvidence:Object.freeze({ canonicalReviewRef:'review://renderer-audit', posterRef:'review://renderer-audit/poster', criticalFrameRefs:Object.freeze([]), kvsAnchorFrameRefs:Object.freeze([]), entrancePayoffExitFrameRefs:Object.freeze([]), sourceCompositeFrameRefs:Object.freeze([]) }) }),
})
const staged = await putProductionCreativeArtifact({ projectId, serialized:canonicalCreativeArtifactJsonV1(artifact) })
await mkdir(evidenceRoot, { recursive:true })
const browserPort = await reservePort()
const profileDir = await mkdtemp(join(tmpdir(), 'sanverse-graph-render-audit-'))
const browser = spawn(browserExecutable(), ['--headless=new','--hide-scrollbars','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-extensions','--disable-sync','--no-first-run','--no-default-browser-check','--force-color-profile=srgb','--force-device-scale-factor=1',`--remote-debugging-port=${browserPort}`,`--user-data-dir=${profileDir}`,'about:blank'], { stdio:'ignore', windowsHide:true })
let cdp:CdpClient|null=null
try {
  cdp = await connectCdp(await waitForTarget(browserPort, browser))
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:1, mobile:false, screenWidth:width, screenHeight:height })
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color:{ r:0,g:0,b:0,a:0 } })
  const hashes:Record<string,string> = {}
  let domProof:unknown = null
  const sourceAssetVersion = sourceAsset.sha256.toLowerCase().slice(0,16)
  if (!/^[a-f0-9]{16}$/u.test(sourceAssetVersion)) throw new Error('Renderer audit source asset checksum/version is unavailable.')
  for (const surface of ['preview','export'] as const) {
    const sourceQuery = `&sourceVisible=1&sourceAssetId=${encodeURIComponent(sourceAsset.assetId)}&sourceAssetVersion=${sourceAssetVersion}&sourceStartTick=0&sourceTreatment=normal`
    const url = `${WEB_URL}/render/creative-scene?projectId=${encodeURIComponent(projectId)}&artifactId=${encodeURIComponent(staged.ref.artifactId)}&sha256=${encodeURIComponent(staged.ref.sha256)}&tick=720000&surface=${surface}${sourceQuery}`
    await cdp.send('Page.navigate', { url }); await waitReady(cdp); await cdp.evaluate(`document.fonts?.ready ?? Promise.resolve()`); await cdp.evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`)
    const proof = await cdp.evaluate(`(()=>{const ids=['audit.custom.magenta','audit.custom.cyan','audit.custom.text'];return {surface:document.querySelector('[data-creative-scene-surface]')?.getAttribute('data-creative-scene-surface'),supplement:Boolean(document.querySelector('[data-motion-graph-supplement-surface="true"]')),nodes:ids.map(id=>{const e=document.querySelector('[data-motion-generic-node-id="'+id+'"]');return {id,present:Boolean(e),type:e?.getAttribute('data-motion-generic-node-type')??null,style:e?{background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,width:getComputedStyle(e).width,height:getComputedStyle(e).height,visibility:getComputedStyle(e).visibility}:null}})}})()`)
    if (!proof.supplement || proof.nodes.some((node:any)=>!node.present || node.style?.visibility !== 'visible')) throw new Error(`${surface} omitted one or more authored Motion Graph nodes.`)
    if (surface === 'preview') domProof = proof
    const bytes = await capture(cdp, join(evidenceRoot, `${surface}.png`)); hashes[surface] = hash(bytes)
  }
  if (hashes.preview !== hashes.export) throw new Error('Renderer audit preview/export pixels differ for the same custom Motion Graph artifact/tick.')
  const after = await readProductionProject(projectId)
  if (after.revision !== before.revision) throw new Error(`Renderer audit mutated production revision ${before.revision} -> ${after.revision}.`)
  const result = Object.freeze({ schemaVersion:'sanverse.motion-graph-supplement-renderer-audit/v1', projectId, productionRevision:before.revision, artifactId:staged.ref.artifactId, artifactSha256:staged.ref.sha256, componentId:module.definition.id, localTick:720000, authoredNodeIds:Object.freeze([magenta.id, cyan.id, label.id]), domProof, previewSha256:hashes.preview, exportSha256:hashes.export, previewExportExactPixelEquality:true, productionMutation:false })
  await writeFile(join(evidenceRoot, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(result, null, 2))
} finally {
  cdp?.close(); if (browser.exitCode === null) browser.kill(); await rm(profileDir,{recursive:true,force:true}).catch(()=>undefined)
}
