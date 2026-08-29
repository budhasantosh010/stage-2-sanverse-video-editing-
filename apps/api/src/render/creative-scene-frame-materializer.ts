import { createHash } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import type { CreativeSceneOverlayNode } from '@sanverse/render-contract'

export type CreativeSceneFrameSequenceV1 = Readonly<{
  nodeId: string
  frameDirectory: string
  framePattern: string
  frameCount: number
  ticksPerFrame: number
  firstFrameSha256: string
  lastFrameSha256: string
}>

export type CreativeSceneFrameMaterializeRequestV1 = Readonly<{
  projectId: string
  width: number
  height: number
  frameRate: Readonly<{ numerator: number; denominator: number }>
  scenes: readonly CreativeSceneOverlayNode[]
  outputRoot: string
  signal?: AbortSignal
}>

export interface CreativeSceneFrameMaterializerPortV1 {
  readonly materialize: (request: CreativeSceneFrameMaterializeRequestV1) => Promise<readonly CreativeSceneFrameSequenceV1[]>
}

export class CreativeSceneFrameMaterializerErrorV1 extends Error {
  readonly code: 'CREATIVE_RENDERER_UNAVAILABLE' | 'CREATIVE_RENDERER_INVALID' | 'CREATIVE_RENDERER_FAILED' | 'CREATIVE_RENDERER_CANCELLED'
  constructor(code: CreativeSceneFrameMaterializerErrorV1['code'], message: string) { super(message); this.code = code; this.name = 'CreativeSceneFrameMaterializerErrorV1' }
}

const sleep = (ms: number): Promise<void> => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_CANCELLED', 'Creative frame rendering was cancelled.')
}
const safeNodeId = (value: string): string => value.replace(/[^a-z0-9._-]+/giu, '_').slice(0, 120)
const hashBytes = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

export const creativeFrameTicksV1 = (
  durationTicks: number,
  frameRate: Readonly<{ numerator: number; denominator: number }>,
): Readonly<{ ticksPerFrame: number; ticks: readonly number[] }> => {
  if (!Number.isSafeInteger(durationTicks) || durationTicks <= 0 || !Number.isSafeInteger(frameRate.numerator) || !Number.isSafeInteger(frameRate.denominator) || frameRate.numerator <= 0 || frameRate.denominator <= 0) {
    throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_INVALID', 'Creative frame timing is invalid.')
  }
  const numerator = PROJECT_TIMESCALE * frameRate.denominator
  if (!Number.isSafeInteger(numerator) || numerator % frameRate.numerator !== 0) throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_INVALID', 'The source frame rate cannot be represented exactly by the canonical Sanverse tick clock.')
  const ticksPerFrame = numerator / frameRate.numerator
  const ticks: number[] = []
  for (let tick = 0; tick < durationTicks; tick += ticksPerFrame) ticks.push(tick)
  if (ticks.length === 0) ticks.push(0)
  return Object.freeze({ ticksPerFrame, ticks: Object.freeze(ticks) })
}

const reservePort = async (): Promise<number> => await new Promise<number>((resolvePort, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') { server.close(); reject(new Error('Could not reserve a browser debug port.')); return }
    const port = address.port
    server.close((error) => error ? reject(error) : resolvePort(port))
  })
})

const browserExecutable = (): string => process.env.SANVERSE_BROWSER_EXECUTABLE?.trim() || (process.platform === 'win32'
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : 'google-chrome')

interface CdpClientV1 {
  readonly send: (method: string, params?: Readonly<Record<string, unknown>>) => Promise<any>
  readonly evaluate: <T = unknown>(expression: string) => Promise<T>
  readonly close: () => void
}

const connectCdp = async (webSocketUrl: string): Promise<CdpClientV1> => {
  const socket = new WebSocket(webSocketUrl)
  await new Promise<void>((resolveOpen, reject) => {
    socket.addEventListener('open', () => resolveOpen(), { once: true })
    socket.addEventListener('error', () => reject(new Error('Could not connect to the browser renderer.')), { once: true })
  })
  let nextId = 1
  const pending = new Map<number, Readonly<{ resolve: (value: any) => void; reject: (error: Error) => void }>>()
  socket.addEventListener('message', (event) => {
    let message: any
    try { message = JSON.parse(String(event.data)) } catch { return }
    if (typeof message.id !== 'number') return
    const item = pending.get(message.id)
    if (!item) return
    pending.delete(message.id)
    if (message.error) item.reject(new Error(String(message.error.message ?? 'Browser renderer command failed.')))
    else item.resolve(message.result)
  })
  const send = (method: string, params: Readonly<Record<string, unknown>> = Object.freeze({})): Promise<any> => new Promise((resolveCommand, reject) => {
    if (socket.readyState !== WebSocket.OPEN) { reject(new Error('Browser renderer connection closed.')); return }
    const id = nextId++
    pending.set(id, Object.freeze({ resolve: resolveCommand, reject }))
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async <T = unknown>(expression: string): Promise<T> => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(String(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Browser renderer evaluation failed.'))
    return result.result?.value as T
  }
  return Object.freeze({ send, evaluate, close: () => socket.close() })
}

const waitForTarget = async (port: number, browser: ChildProcess, signal?: AbortSignal): Promise<string> => {
  const started = Date.now()
  while (Date.now() - started < 15_000) {
    throwIfAborted(signal)
    if (browser.exitCode !== null) throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_UNAVAILABLE', 'The local browser renderer exited before becoming ready.')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(750) })
      if (response.ok) {
        const targets = await response.json() as Array<{ type?: string; webSocketDebuggerUrl?: string }>
        const target = targets.find((candidate) => candidate.type === 'page' && typeof candidate.webSocketDebuggerUrl === 'string')
        if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl
      }
    } catch { /* browser is still starting */ }
    await sleep(80)
  }
  throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_UNAVAILABLE', 'The local browser renderer did not become ready.')
}

export const createLocalCreativeSceneFrameMaterializerV1 = (options: Readonly<{
  webUrl?: string
  executable?: string
}> = Object.freeze({})): CreativeSceneFrameMaterializerPortV1 => Object.freeze({
  materialize: async (request: CreativeSceneFrameMaterializeRequestV1) => {
    if (request.scenes.length === 0) return Object.freeze([])
    throwIfAborted(request.signal)
    const port = await reservePort()
    // Keep Edge's disposable profile out of the project/export tree. Long Windows
    // worktree + project + render UUID paths can exceed what Edge accepts for
    // --user-data-dir even though Node/FFmpeg can still access the frame files.
    // The profile is cache-only process state, never project/render authority.
    const profileDir = await mkdtemp(join(tmpdir(), 'sanverse-creative-browser-'))
    const executable = options.executable ?? browserExecutable()
    const browser = spawn(executable, [
      '--headless=new', '--hide-scrollbars', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
      '--disable-extensions', '--disable-sync', '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb', '--force-device-scale-factor=1',
      `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank',
    ], { stdio: 'ignore', windowsHide: true })
    const abort = () => { if (browser.exitCode === null) browser.kill() }
    request.signal?.addEventListener('abort', abort, { once: true })
    let cdp: CdpClientV1 | null = null
    try {
      cdp = await connectCdp(await waitForTarget(port, browser, request.signal))
      await cdp.send('Page.enable')
      await cdp.send('Runtime.enable')
      await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
      const webUrl = (options.webUrl ?? process.env.SANVERSE_WEB_URL ?? 'http://127.0.0.1:2000').replace(/\/$/u, '')
      const sequences: CreativeSceneFrameSequenceV1[] = []
      for (const scene of request.scenes) {
        throwIfAborted(request.signal)
        const timing = creativeFrameTicksV1(scene.interval.duration.ticks, request.frameRate)
        const frameDirectory = resolve(request.outputRoot, `creative-${safeNodeId(scene.nodeId)}`)
        await mkdir(frameDirectory, { recursive: false })
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: request.width, height: request.height, deviceScaleFactor: 1, mobile: false, screenWidth: request.width, screenHeight: request.height })
        const url = `${webUrl}/render/creative-scene?projectId=${encodeURIComponent(request.projectId)}&artifactId=${encodeURIComponent(scene.artifactId)}&sha256=${encodeURIComponent(scene.artifactSha256)}&tick=0`
        await cdp.send('Page.navigate', { url })
        const readyStarted = Date.now()
        let ready = false
        while (Date.now() - readyStarted < 15_000) {
          throwIfAborted(request.signal)
          const state = await cdp.evaluate<{ ready: boolean; error: string | null }>(`(()=>({ready:Boolean(document.querySelector('[data-creative-frame-ready="true"]')),error:document.querySelector('[data-creative-frame-error="true"]')?.textContent??null}))()`)
          if (state.error) throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_INVALID', state.error)
          if (state.ready) { ready = true; break }
          await sleep(40)
        }
        if (!ready) throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_UNAVAILABLE', 'Creative frame page did not become ready.')
        await cdp.evaluate(`document.fonts?.ready ?? Promise.resolve()`)
        const rect = await cdp.evaluate<{ width: number; height: number }>(`(()=>{const el=document.querySelector('[data-creative-frame-ready="true"]');if(!el)return {width:0,height:0};const r=el.getBoundingClientRect();return {width:r.width,height:r.height}})()`)
        if (Math.round(rect.width) !== request.width || Math.round(rect.height) !== request.height) throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_INVALID', 'Creative artifact dimensions do not match the production composition.')
        let firstHash = ''
        let lastHash = ''
        for (const [index, tick] of timing.ticks.entries()) {
          throwIfAborted(request.signal)
          const accepted = await cdp.evaluate<boolean>(`window.__sanverseSetCreativeTick?.(${tick})===true`)
          if (!accepted) throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_INVALID', `Creative renderer refused exact tick ${tick}.`)
          await cdp.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
          const observedTick = await cdp.evaluate<number>(`Number(document.querySelector('[data-creative-frame-ready="true"]')?.getAttribute('data-creative-frame-tick'))`)
          if (observedTick !== tick) throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_FAILED', 'Creative renderer did not settle on the requested exact tick.')
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { x: 0, y: 0, width: request.width, height: request.height, scale: 1 } })
          const bytes = Buffer.from(String(shot.data), 'base64')
          if (bytes.byteLength < 64) throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_FAILED', 'Creative renderer produced an empty frame.')
          const hash = hashBytes(bytes)
          if (index === 0) firstHash = hash
          if (index === timing.ticks.length - 1) lastHash = hash
          await writeFile(resolve(frameDirectory, `frame-${String(index).padStart(6, '0')}.png`), bytes, { flag: 'wx', mode: 0o600 })
        }
        sequences.push(Object.freeze({ nodeId: scene.nodeId, frameDirectory, framePattern: resolve(frameDirectory, 'frame-%06d.png'), frameCount: timing.ticks.length, ticksPerFrame: timing.ticksPerFrame, firstFrameSha256: firstHash, lastFrameSha256: lastHash }))
      }
      return Object.freeze(sequences)
    } catch (error) {
      if (error instanceof CreativeSceneFrameMaterializerErrorV1) throw error
      throw new CreativeSceneFrameMaterializerErrorV1('CREATIVE_RENDERER_FAILED', error instanceof Error ? error.message : 'Creative frame rendering failed.')
    } finally {
      cdp?.close()
      request.signal?.removeEventListener('abort', abort)
      if (browser.exitCode === null) browser.kill()
      await rm(profileDir, { recursive: true, force: true }).catch(() => undefined)
    }
  },
})
