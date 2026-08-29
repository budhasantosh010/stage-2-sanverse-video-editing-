import { createHash } from 'node:crypto'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import type { EditProject } from '@sanverse/edit-domain'
import { SANVERSE_API_URL, SANVERSE_ROOT } from './sanverse-mcp-shared.ts'

const fixtureRoot = resolve(process.env.SANVERSE_RAW_VIDEO_E2E_ROOT ?? join(SANVERSE_ROOT, '.sanverse-data', 'raw-video-e2e'))
const auditResultPath = join(fixtureRoot, 'audit-result.json')
const sourcePath = join(fixtureRoot, 'fixture-video.mp4')
const finalExportPath = join(fixtureRoot, 'audit-export.mp4')
const evidenceRoot = join(fixtureRoot, 'parity')
const evidencePath = join(fixtureRoot, 'parity-result.json')
const webUrl = (process.env.SANVERSE_WEB_URL ?? 'http://127.0.0.1:2000').replace(/\/$/u, '')
const FINAL_SSIM_FLOOR = 0.96

const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
const sleep = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
const localFetch = async (url: string, attempts = 5): Promise<Response> => {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await fetch(url, { signal: AbortSignal.timeout(3000) }) }
    catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(100 * attempt)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Local fetch failed for ${url}.`)
}

const reservePort = async (): Promise<number> => await new Promise<number>((resolvePort, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') { server.close(); reject(new Error('Could not reserve browser debug port.')); return }
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
    socket.addEventListener('error', () => reject(new Error('Could not connect to parity browser.')), { once: true })
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
    if (socket.readyState !== WebSocket.OPEN) { reject(new Error('Parity browser connection closed.')); return }
    const id = nextId++
    pending.set(id, { resolve: resolveCommand, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async <T = unknown>(expression: string): Promise<T> => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(String(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Browser evaluation failed.'))
    return result.result?.value as T
  }
  return { send, evaluate, close: () => socket.close() }
}

const waitForTarget = async (port: number, browser: ChildProcess): Promise<string> => {
  const started = Date.now()
  while (Date.now() - started < 20_000) {
    if (browser.exitCode !== null) throw new Error('Parity browser exited before DevTools became ready.')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(750) })
      if (response.ok) {
        const targets = await response.json() as Array<{ type?: string; webSocketDebuggerUrl?: string }>
        const page = targets.find((item) => item.type === 'page' && typeof item.webSocketDebuggerUrl === 'string')
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
      }
    } catch { /* still starting */ }
    await sleep(80)
  }
  throw new Error('Parity browser did not expose DevTools in time.')
}

const runFfmpeg = (args: readonly string[]): void => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8', windowsHide: true })
  if ((result.status ?? 1) !== 0) throw new Error(`ffmpeg failed: ${(result.stderr || result.stdout || '').trim()}`)
}

const compareSsim = (expected: string, actual: string): number => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-i', expected, '-i', actual, '-lavfi', 'ssim', '-f', 'null', '-'], { encoding: 'utf8', windowsHide: true })
  if ((result.status ?? 1) !== 0) throw new Error(`ffmpeg SSIM failed: ${(result.stderr || result.stdout || '').trim()}`)
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const match = /All:([0-9.]+)/u.exec(text)
  if (!match) throw new Error('Could not parse FFmpeg SSIM output.')
  return Number(match[1])
}

const waitReady = async (cdp: CdpClient): Promise<void> => {
  const started = Date.now()
  while (Date.now() - started < 15_000) {
    const state = await cdp.evaluate<{ ready: boolean; error: string | null }>(`(()=>({ready:Boolean(document.querySelector('[data-creative-frame-ready="true"]')),error:document.querySelector('[data-creative-frame-error="true"]')?.textContent??null}))()`)
    if (state.error) throw new Error(state.error)
    if (state.ready) return
    await sleep(40)
  }
  throw new Error('Creative parity page did not become ready.')
}

const settleTick = async (cdp: CdpClient, tick: number): Promise<void> => {
  const accepted = await cdp.evaluate<boolean>(`window.__sanverseSetCreativeTick?.(${tick})===true`)
  if (!accepted) throw new Error(`Creative parity page refused tick ${tick}.`)
  await cdp.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
  const observed = await cdp.evaluate<number>(`Number(document.querySelector('[data-creative-frame-ready="true"]')?.getAttribute('data-creative-frame-tick'))`)
  if (observed !== tick) throw new Error(`Creative parity page settled on ${observed} instead of ${tick}.`)
}

const capture = async (cdp: CdpClient): Promise<Buffer> => {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
  const bytes = Buffer.from(String(shot.data), 'base64')
  if (bytes.byteLength < 64) throw new Error('Creative parity screenshot was empty.')
  return bytes
}

const auditResult = JSON.parse(await readFile(auditResultPath, 'utf8')) as { projectId: string; export: { path: string } }
const projectResponse = await localFetch(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(auditResult.projectId)}`)
if (!projectResponse.ok) throw new Error(`Could not read E2E project (${projectResponse.status}).`)
const project = (await projectResponse.json() as { project: EditProject }).project
const operations = project.changeSets
  .flatMap((record) => record.changeSet.operations)
  .filter((operation): operation is Extract<typeof operation, { kind: 'add-creative-scene' }> => operation.kind === 'add-creative-scene')
  .sort((a, b) => a.sourceInterval.start.ticks - b.sourceInterval.start.ticks)
if (operations.length < 3) throw new Error('Parity audit requires at least three accepted Creative scenes.')

await rm(evidenceRoot, { recursive: true, force: true })
await mkdir(evidenceRoot, { recursive: true })
const port = await reservePort()
const profileDir = await mkdtemp(join(tmpdir(), 'sanverse-parity-browser-'))
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
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  const sceneEvidence: Array<Record<string, unknown>> = []
  let minimumSsim = 1

  for (const operation of operations.slice(0, 3)) {
    const artifactResponse = await localFetch(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(auditResult.projectId)}/creative-artifacts/${encodeURIComponent(operation.artifactId)}`)
    if (!artifactResponse.ok) throw new Error(`Could not read Creative artifact ${operation.artifactId}.`)
    const artifactPayload = await artifactResponse.json() as { artifact: { source: { width: number; height: number; durationTicks: number; fpsNumerator: number; fpsDenominator: number } } }
    const source = artifactPayload.artifact.source
    const ticksPerFrameNumerator = PROJECT_TIMESCALE * source.fpsDenominator
    if (ticksPerFrameNumerator % source.fpsNumerator !== 0) throw new Error('Creative parity frame clock is not exact.')
    const ticksPerFrame = ticksPerFrameNumerator / source.fpsNumerator
    const lastTick = Math.floor((source.durationTicks - 1) / ticksPerFrame) * ticksPerFrame
    const quarterFrame = Math.floor((lastTick / ticksPerFrame) * 0.25)
    const halfFrame = Math.floor((lastTick / ticksPerFrame) * 0.5)
    const threeQuarterFrame = Math.floor((lastTick / ticksPerFrame) * 0.75)
    const criticalTicks = [0, quarterFrame * ticksPerFrame, halfFrame * ticksPerFrame, threeQuarterFrame * ticksPerFrame, lastTick]
    const sceneDir = join(evidenceRoot, operation.sceneId)
    await mkdir(sceneDir, { recursive: true })
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: source.width, height: source.height, deviceScaleFactor: 1, mobile: false, screenWidth: source.width, screenHeight: source.height })

    const hashesBySurface = new Map<'preview' | 'export', Map<number, string>>()
    for (const surface of ['preview', 'export'] as const) {
      const url = `${webUrl}/render/creative-scene?projectId=${encodeURIComponent(auditResult.projectId)}&artifactId=${encodeURIComponent(operation.artifactId)}&sha256=${encodeURIComponent(operation.artifactSha256)}&tick=0&surface=${surface}`
      await cdp.send('Page.navigate', { url })
      await waitReady(cdp)
      await cdp.evaluate(`document.fonts?.ready ?? Promise.resolve()`)
      const hashes = new Map<number, string>()
      for (const tick of criticalTicks) {
        await settleTick(cdp, tick)
        const bytes = await capture(cdp)
        hashes.set(tick, hash(bytes))
        await writeFile(join(sceneDir, `${surface}-${String(tick).padStart(8, '0')}.png`), bytes)
      }
      hashesBySurface.set(surface, hashes)
    }

    for (const tick of criticalTicks) {
      if (hashesBySurface.get('preview')!.get(tick) !== hashesBySurface.get('export')!.get(tick)) {
        throw new Error(`${operation.sceneId} preview/export pixels differ at exact tick ${tick}.`)
      }
    }

    const targetTick = criticalTicks[2]!
    await settleTick(cdp, criticalTicks[4]!)
    await settleTick(cdp, targetTick)
    const backwardHash = hash(await capture(cdp))
    await settleTick(cdp, criticalTicks[1]!)
    await settleTick(cdp, criticalTicks[3]!)
    await settleTick(cdp, targetTick)
    const randomHash = hash(await capture(cdp))
    const directHash = hashesBySurface.get('export')!.get(targetTick)!
    if (backwardHash !== directHash || randomHash !== directHash) throw new Error(`${operation.sceneId} direct/backward/random seek pixels differ at tick ${targetTick}.`)

    const frameComparisons: Array<Record<string, unknown>> = []
    for (const tick of criticalTicks) {
      const absoluteTick = operation.sourceInterval.start.ticks + tick
      const seconds = (absoluteTick / PROJECT_TIMESCALE).toFixed(9)
      const overlayPath = join(sceneDir, `export-${String(tick).padStart(8, '0')}.png`)
      const sourceFrame = join(sceneDir, `source-${String(tick).padStart(8, '0')}.png`)
      const expectedFrame = join(sceneDir, `expected-${String(tick).padStart(8, '0')}.png`)
      const actualFrame = join(sceneDir, `final-${String(tick).padStart(8, '0')}.png`)
      runFfmpeg(['-y', '-i', sourcePath, '-ss', seconds, '-frames:v', '1', sourceFrame])
      runFfmpeg(['-y', '-i', sourceFrame, '-i', overlayPath, '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto', '-frames:v', '1', expectedFrame])
      runFfmpeg(['-y', '-i', finalExportPath, '-ss', seconds, '-frames:v', '1', actualFrame])
      const ssim = compareSsim(expectedFrame, actualFrame)
      minimumSsim = Math.min(minimumSsim, ssim)
      if (ssim < FINAL_SSIM_FLOOR) throw new Error(`${operation.sceneId} final MP4 SSIM ${ssim.toFixed(6)} is below ${FINAL_SSIM_FLOOR} at tick ${tick}.`)
      frameComparisons.push(Object.freeze({ localTick: tick, absoluteTick, previewExportSha256: hashesBySurface.get('export')!.get(tick), finalMp4Ssim: ssim }))
    }

    sceneEvidence.push(Object.freeze({
      sceneId: operation.sceneId,
      artifactId: operation.artifactId,
      artifactSha256: operation.artifactSha256,
      startTick: operation.sourceInterval.start.ticks,
      durationTicks: operation.sourceInterval.duration.ticks,
      ticksPerFrame,
      criticalTicks: Object.freeze(criticalTicks),
      previewExportExactPixelEquality: true,
      directBackwardRandomSeekExactPixelEquality: true,
      frameComparisons: Object.freeze(frameComparisons),
    }))
  }

  const evidence = Object.freeze({
    schemaVersion: 'sanverse.creative-scene-parity-evidence/v1',
    projectId: auditResult.projectId,
    sceneCount: sceneEvidence.length,
    criticalTicksPerScene: 5,
    previewExportExactPixelEquality: true,
    directBackwardRandomSeekExactPixelEquality: true,
    finalMp4SsimFloor: FINAL_SSIM_FLOOR,
    minimumFinalMp4Ssim: minimumSsim,
    scenes: Object.freeze(sceneEvidence),
  })
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  cdp?.close()
  if (browser.exitCode === null) browser.kill()
  await rm(profileDir, { recursive: true, force: true }).catch(() => undefined)
}
