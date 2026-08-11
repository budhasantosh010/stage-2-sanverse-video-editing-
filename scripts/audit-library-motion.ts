import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'
import { MOTION_LIBRARY_CATALOG } from '@sanverse/motion-library'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverUrl = 'http://127.0.0.1:2010'
const debugPort = 9237
const debugUrl = `http://127.0.0.1:${debugPort}`
const outputRoot = resolve(root, 'tmp/l1-motion-audit')
const profileDir = resolve(root, 'tmp/l1-audit-edge-profile')
const edge = process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : process.env.CHROME_BIN ?? 'google-chrome'
const only = process.argv.includes('--component') ? process.argv[process.argv.indexOf('--component') + 1] : undefined
const from = process.argv.includes('--from') ? Math.max(0, Number(process.argv[process.argv.indexOf('--from') + 1] ?? 0)) : 0
const limit = process.argv.includes('--limit') ? Math.max(1, Number(process.argv[process.argv.indexOf('--limit') + 1] ?? 10)) : Number.POSITIVE_INFINITY
const fullSelection = only ? MOTION_LIBRARY_CATALOG.filter((entry) => entry.componentId === (only.startsWith('sanverse.') ? only : `sanverse.${only}`)) : MOTION_LIBRARY_CATALOG
const selected = only ? fullSelection : fullSelection.slice(from, from + limit)
if (!selected.length) throw new Error('No components selected for motion audit.')

const sleep = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
const serverReady = async () => { try { return (await fetch(`${serverUrl}/library`)).ok } catch { return false } }
const waitFor = async <T>(fn: () => Promise<T | null>, timeoutMs: number): Promise<T> => { const started = Date.now(); while (Date.now() - started < timeoutMs) { const value = await fn(); if (value !== null) return value; await sleep(80) } throw new Error(`Timed out after ${timeoutMs}ms.`) }

let startedServer: ReturnType<typeof spawn> | null = null
if (!(await serverReady())) {
  startedServer = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','dev','--workspace=@sanverse/motion-lab','--','--host','127.0.0.1','--port','2010','--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true })
  await waitFor(async () => await serverReady() ? true : null, 12_000)
}
await mkdir(outputRoot, { recursive: true })
await rm(profileDir, { recursive: true, force: true })
const browser = spawn(edge, ['--headless=new','--disable-gpu','--hide-scrollbars',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'--window-size=960,540','about:blank'], { cwd: root, stdio: 'ignore', windowsHide: true })

interface TargetInfo { webSocketDebuggerUrl?: string; type?: string }
const target = await waitFor(async () => { try { const list = await (await fetch(`${debugUrl}/json/list`)).json() as TargetInfo[]; return list.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? null } catch { return null } }, 12_000)
const ws = new WebSocket(target)
let nextId = 1
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>()
let frameSink: ((data: string) => void) | null = null
ws.on('message', (raw) => {
  const message = JSON.parse(String(raw)) as { id?: number; method?: string; params?: { data?: string; sessionId?: number }; result?: unknown; error?: unknown }
  if (message.id !== undefined) { const waiter = pending.get(message.id); if (waiter) { pending.delete(message.id); message.error ? waiter.reject(message.error) : waiter.resolve(message.result) } return }
  if (message.method === 'Page.screencastFrame' && message.params?.data && message.params.sessionId !== undefined) { frameSink?.(message.params.data); void send('Page.screencastFrameAck', { sessionId: message.params.sessionId }) }
})
const send = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolveValue, reject) => { const id = nextId++; pending.set(id, { resolve: resolveValue, reject }); ws.send(JSON.stringify({ id, method, params })) })
await new Promise<void>((resolveOpen, reject) => { if (ws.readyState === WebSocket.OPEN) resolveOpen(); else { ws.once('open', () => resolveOpen()); ws.once('error', reject) } })
await send('Page.enable'); await send('Runtime.enable')
const evaluate = async (expression: string) => { const result = await send('Runtime.evaluate', { expression, returnByValue: true }); return result.result?.value }

const evidence: Array<{ componentId: string; durationTicks: number; elapsedMs: number; capturedFrames: number; fullPlaybackVerified: boolean }> = []
try {
  for (const [index, entry] of selected.entries()) {
    const url = `${serverUrl}/library/audit/${encodeURIComponent(entry.componentId)}`
    await send('Page.navigate', { url })
    await waitFor(async () => await evaluate(`Boolean(document.querySelector('[data-library-player="${entry.componentId}"]'))`) ? true : null, 8_000)
    const frames: string[] = []
    frameSink = (data) => frames.push(data)
    await send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 960, maxHeight: 540, everyNthFrame: 1 })
    const started = Date.now()
    const timeoutMs = Math.ceil(entry.preview.durationTicks / 1_440_000 * 1000) + 8_000
    await waitFor(async () => await evaluate(`document.querySelector('[data-library-player="${entry.componentId}"]')?.getAttribute('data-library-full-playback') === 'true'`) ? true : null, timeoutMs)
    const elapsedMs = Date.now() - started
    await sleep(120)
    await send('Page.stopScreencast')
    frameSink = null
    if (frames.length < 4) throw new Error(`${entry.componentId} completed but emitted only ${frames.length} screencast frames.`)
    const componentDir = resolve(outputRoot, entry.componentId)
    await mkdir(componentDir, { recursive: true })
    const sampleCount = Math.min(9, frames.length)
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const frameIndex = Math.round(sample * (frames.length - 1) / Math.max(1, sampleCount - 1))
      await writeFile(resolve(componentDir, `frame-${String(sample).padStart(2,'0')}.jpg`), Buffer.from(frames[frameIndex]!, 'base64'))
    }
    evidence.push({ componentId: entry.componentId, durationTicks: entry.preview.durationTicks, elapsedMs, capturedFrames: frames.length, fullPlaybackVerified: true })
    console.log(`MOTION_AUDIT ${index + 1}/${selected.length} ${entry.componentId} durationMs=${Math.round(entry.preview.durationTicks / 1440)} elapsedMs=${elapsedMs} frames=${frames.length}`)
  }
} finally {
  frameSink = null
  ws.close()
  browser.kill()
  if (startedServer) startedServer.kill()
}
const evidenceName = only ? `runtime-evidence-${selected[0]!.componentId}.json` : `runtime-evidence-${from}-${from + selected.length - 1}.json`
await writeFile(resolve(outputRoot, evidenceName), `${JSON.stringify({ schemaVersion: 'sanverse.motion-library-runtime-audit/v1', recordedAt: new Date().toISOString(), from, count: evidence.length, entries: evidence }, null, 2)}\n`, 'utf8')
console.log(`MOTION_AUDIT_SUMMARY reviewed=${evidence.length} expected=${selected.length} allFullPlayback=${evidence.every((entry) => entry.fullPlaybackVerified)} evidence=${evidenceName}`)
