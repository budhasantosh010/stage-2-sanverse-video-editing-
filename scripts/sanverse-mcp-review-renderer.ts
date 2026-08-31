import { createHash } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import {
  buildCreativeSceneReviewArtifactV1,
  canonicalCreativeArtifactJsonV1,
  type CreativeReviewV1,
  type CreativeRunV1,
  type CreativeSceneBatchV1,
} from '@sanverse/creative-production-adapter'
import { putProductionCreativeArtifact } from './sanverse-mcp-shared.ts'
import { writeCreativeReviewArtifactV1 } from './sanverse-mcp-creative-run-store.ts'

const WEB_URL = (process.env.SANVERSE_WEB_URL ?? 'http://127.0.0.1:2000').replace(/\/$/u, '')
const sleep = (ms: number): Promise<void> => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex')

const reservePort = async (): Promise<number> => await new Promise<number>((resolvePort, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') { server.close(); reject(new Error('Could not reserve review browser debug port.')); return }
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
    socket.addEventListener('error', () => reject(new Error('Could not connect to review browser.')), { once: true })
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
    if (socket.readyState !== WebSocket.OPEN) { reject(new Error('Review browser connection closed.')); return }
    const id = nextId++
    pending.set(id, { resolve: resolveCommand, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async <T = unknown>(expression: string): Promise<T> => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(String(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Review browser evaluation failed.'))
    return result.result?.value as T
  }
  return Object.freeze({ send, evaluate, close: () => socket.close() })
}

const waitForTarget = async (port: number, browser: ChildProcess): Promise<string> => {
  const started = Date.now()
  while (Date.now() - started < 20_000) {
    if (browser.exitCode !== null) throw new Error('Review browser exited before DevTools became ready.')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(750) })
      if (response.ok) {
        const targets = await response.json() as Array<{ type?: string; webSocketDebuggerUrl?: string }>
        const page = targets.find((item) => item.type === 'page' && typeof item.webSocketDebuggerUrl === 'string')
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
      }
    } catch { /* browser is still starting */ }
    await sleep(80)
  }
  throw new Error('Review browser did not expose DevTools in time.')
}

const waitReady = async (cdp: CdpClient): Promise<void> => {
  const started = Date.now()
  while (Date.now() - started < 15_000) {
    const state = await cdp.evaluate<{ ready: boolean; error: string | null }>(`(()=>({ready:Boolean(document.querySelector('[data-creative-frame-ready="true"]')),error:document.querySelector('[data-creative-frame-error="true"]')?.textContent??null}))()`)
    if (state.error) throw new Error(state.error)
    if (state.ready) return
    await sleep(40)
  }
  throw new Error('Creative review page did not become ready.')
}

const captureTick = async (cdp: CdpClient, tick: number, width: number, height: number): Promise<Uint8Array> => {
  const accepted = await cdp.evaluate<boolean>(`window.__sanverseSetCreativeTick?.(${tick})===true`)
  if (!accepted) throw new Error(`Creative review page refused exact tick ${tick}.`)
  await cdp.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
  const observed = await cdp.evaluate<number>(`Number(document.querySelector('[data-creative-frame-ready="true"]')?.getAttribute('data-creative-frame-tick'))`)
  if (observed !== tick) throw new Error(`Creative review page settled on ${observed} instead of ${tick}.`)
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { x: 0, y: 0, width, height, scale: 1 } })
  const bytes = Buffer.from(String(shot.data), 'base64')
  if (bytes.byteLength < 64) throw new Error('Creative review renderer produced an empty frame.')
  return new Uint8Array(bytes)
}

export const materializeCreativeReviewEvidenceV1 = async (input: Readonly<{
  run: CreativeRunV1
  review: CreativeReviewV1
  batch: CreativeSceneBatchV1
}>): Promise<CreativeReviewV1> => {
  const workflow = input.batch.getWorkflow(input.review.sceneId)
  if (!workflow) throw new Error('CREATIVE_REVIEW_STALE: review scene is no longer part of the active batch.')
  const built = buildCreativeSceneReviewArtifactV1(workflow, input.review.scope)
  if (!built.ok) throw new Error(`${built.refusal.code}: ${built.refusal.message}`)
  const serialized = canonicalCreativeArtifactJsonV1(built.value)
  const stored = await putProductionCreativeArtifact({ projectId: input.run.projectId, serialized })
  if (stored.ref.sha256 !== sha256(serialized)) throw new Error('CREATIVE_REVIEW_ARTIFACT_HASH_MISMATCH: staged review artifact hash is inconsistent.')

  const width = built.value.source.width
  const height = built.value.source.height
  const duration = built.value.source.durationTicks
  const ticks = Object.freeze([
    Object.freeze({ key: 'opening', tick: 0, label: 'Opening frame' }),
    Object.freeze({ key: 'middle', tick: Math.floor(duration / 2), label: 'Middle frame' }),
    Object.freeze({ key: 'payoff', tick: Math.max(0, duration - 1), label: 'Payoff frame' }),
  ])
  const port = await reservePort()
  const profileDir = await mkdtemp(join(tmpdir(), 'sanverse-review-browser-'))
  const browser = spawn(browserExecutable(), [
    '--headless=new', '--hide-scrollbars', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--disable-extensions', '--disable-sync', '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb', '--force-device-scale-factor=1',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true })
  let cdp: CdpClient | null = null
  try {
    cdp = await connectCdp(await waitForTarget(port, browser))
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height })
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
    const baseUrl = `${WEB_URL}/render/creative-scene?projectId=${encodeURIComponent(input.run.projectId)}&artifactId=${encodeURIComponent(stored.ref.artifactId)}&sha256=${encodeURIComponent(stored.ref.sha256)}&tick=0&surface=preview`
    await cdp.send('Page.navigate', { url: baseUrl })
    await waitReady(cdp)
    await cdp.evaluate(`document.fonts?.ready ?? Promise.resolve()`)
    const artifacts = [] as Array<CreativeReviewV1['artifacts'][number]>
    for (const item of ticks) {
      const bytes = await captureTick(cdp, item.tick, width, height)
      const artifactId = `${input.review.scope}-${item.key}.png`
      const written = await writeCreativeReviewArtifactV1({ projectId: input.run.projectId, runId: input.run.runId, reviewId: input.review.reviewId, artifactId, bytes })
      artifacts.push(Object.freeze({
        artifactId,
        kind: 'image' as const,
        label: item.label,
        mimeType: 'image/png' as const,
        byteLength: written.byteLength,
        sha256: written.sha256,
        resourceUri: `sanverse://creative-run/${input.run.runId}/reviews/${input.review.reviewId}/${artifactId}`,
        safeUrl: `${WEB_URL}/render/creative-scene?projectId=${encodeURIComponent(input.run.projectId)}&artifactId=${encodeURIComponent(stored.ref.artifactId)}&sha256=${encodeURIComponent(stored.ref.sha256)}&tick=${item.tick}&surface=preview`,
      }))
    }
    const evidenceHash = sha256(JSON.stringify({
      runId: input.run.runId,
      reviewId: input.review.reviewId,
      sceneId: input.review.sceneId,
      scope: input.review.scope,
      requestRef: input.review.requestRef,
      subjectId: input.review.subjectId,
      subjectRevision: input.review.subjectRevision,
      renderArtifactSha256: stored.ref.sha256,
      artifacts: artifacts.map((artifact) => ({ artifactId: artifact.artifactId, sha256: artifact.sha256 })),
    }))
    return Object.freeze({ ...input.review, evidenceHash, artifacts: Object.freeze(artifacts), updatedAt: new Date().toISOString() })
  } finally {
    cdp?.close()
    if (browser.exitCode === null) browser.kill()
    await rm(profileDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
