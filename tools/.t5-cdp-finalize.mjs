import fs from 'node:fs/promises'
import path from 'node:path'

const evidenceDir = process.argv[2]
await fs.mkdir(evidenceDir, { recursive: true })
const pages = await (await fetch('http://127.0.0.1:9225/json/list')).json()
const page = pages.find((x) => x.type === 'page' && x.url.includes('127.0.0.1:2000'))
if (!page) throw new Error('No Sanverse Edge page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let id = 1
const pending = new Map()
const runtimeErrors = []
const consoleErrors = []
const failedHttp = []
const loadingFailed = []
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const entry = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) entry.reject(new Error(`${entry.method}: ${JSON.stringify(message.error)}`))
    else entry.resolve(message.result)
    return
  }
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails?.text ?? 'runtime exception')
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '))
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) failedHttp.push({ status: message.params.response.status, url: message.params.response.url })
  if (message.method === 'Network.loadingFailed') loadingFailed.push({ errorText: message.params.errorText, canceled: !!message.params.canceled, type: message.params.type })
}
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const messageId = id++
  pending.set(messageId, { resolve, reject, method })
  ws.send(JSON.stringify({ id: messageId, method, params }))
})
const evaluate = async (expression) => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
  if (result.exceptionDetails) throw new Error(`Evaluation failed: ${result.exceptionDetails.text}`)
  return result.result.value
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (expression, timeout, label) => {
  const end = Date.now() + timeout
  let last = null
  while (Date.now() < end) {
    try { last = await evaluate(expression); if (last) return last } catch {}
    await sleep(200)
  }
  throw new Error(`Timed out waiting for ${label}; last=${JSON.stringify(last)}`)
}
const clickText = async (text) => {
  const clicked = await evaluate(`(()=>{const e=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!e)return false;e.click();return true})()`)
  if (!clicked) throw new Error(`Missing clickable text: ${text}`)
}
await call('Runtime.enable')
await call('Page.enable')
await call('Network.enable')
await waitFor(`document.readyState==='complete'`, 15000, 'page ready')
if (!(await evaluate(`document.querySelectorAll('video').length===1`))) {
  const reopened = await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith('Open sanverse-t5-primary-30s.mp4'));if(!b)return false;b.click();return true})()`)
  if (!reopened) throw new Error('Recent project button missing')
  await waitFor(`document.querySelectorAll('video').length===1`, 30000, 'recent project open')
}
if (!(await evaluate(`!!document.querySelector('[data-project-revision]')`))) await clickText('Studio')
await waitFor(`!!document.querySelector('[data-project-revision]')`, 30000, 'Studio timeline')
await waitFor(`document.querySelectorAll('video').length===1`, 30000, 'one native video')
await sleep(800)
const state = await evaluate(`(()=>{
  const timeline=document.querySelector('[data-project-revision]');
  const tracks=[...document.querySelectorAll('[data-track-display-id]')].map(h=>({label:h.dataset.trackDisplayId,id:h.dataset.trackId,role:h.dataset.trackRole,locked:h.dataset.trackLocked,sync:h.dataset.trackSyncLock,targeted:h.dataset.trackTargeted,output:h.dataset.trackOutput,collapsed:h.dataset.trackCollapsed,text:h.textContent.trim()}));
  const generic=tracks.find(t=>t.role==='generic-video');
  const dialogueHeader=document.querySelector('[data-track-role="dialogue"]');
  const dialogueMode=dialogueHeader?.querySelector('[data-track-waveform-mode]')?.value??null;
  const dialogueGain=dialogueHeader?.querySelector('[data-track-gain]')?.value??null;
  const dialoguePan=dialogueHeader?.querySelector('[data-track-pan]')?.value??null;
  const videoCount=document.querySelectorAll('video').length;
  return {revision:Number(timeline?.dataset.projectRevision??-1),tracks,generic,dialogueMode,dialogueGain,dialoguePan,videoCount,innerWidth,scrollWidth:document.documentElement.scrollWidth,exportDisabled:document.querySelector('button[aria-label="Export video"]')?.disabled??null,waveformCanvases:[...document.querySelectorAll('canvas[data-channel-display-mode]')].map(c=>c.dataset.channelDisplayMode)};
})()`)
if (state.revision !== 13) throw new Error(`Expected persisted revision 13, got ${state.revision}`)
if (state.videoCount !== 1) throw new Error(`Expected one native video, got ${state.videoCount}`)
if (!state.generic?.id?.startsWith('track_') || !state.generic.text.includes('Cutaways T5')) throw new Error(`Generic stable track/rename missing: ${JSON.stringify(state.generic)}`)
if (state.generic.sync !== 'off' || state.generic.targeted !== 'yes' || state.generic.locked !== 'no') throw new Error(`Generic T5 workspace/policy state wrong: ${JSON.stringify(state.generic)}`)
if (state.dialogueMode !== 'separate') throw new Error(`Waveform preference did not persist: ${state.dialogueMode}`)
if (Number(state.dialogueGain) !== -3 || Number(state.dialoguePan) !== 20) throw new Error(`Audio mix state did not persist: gain=${state.dialogueGain}, pan=${state.dialoguePan}`)
const kinds = Object.groupBy(state.tracks, (track) => track.role.includes('video') ? 'video' : track.role === 'captions' ? 'caption' : 'audio')
if ((kinds.video?.length ?? 0) !== 3 || (kinds.caption?.length ?? 0) !== 1 || (kinds.audio?.length ?? 0) !== 3) throw new Error(`Unexpected persisted track counts: ${JSON.stringify(kinds)}`)
if (state.exportDisabled) throw new Error('Export should be enabled after accepted T5 edits')
await evaluate(`document.querySelector('button[aria-label="Export video"]')?.click()`)
await waitFor(`document.querySelector('[aria-label="Export status"]')?.textContent.includes('Export ready')===true`, 180000, 'real export ready')
const exportInfo = await evaluate(`(()=>{const s=document.querySelector('[aria-label="Export status"]');const a=s?.querySelector('a[download]');return {text:s?.textContent??'',href:a?.href??null}})()`)
if (!exportInfo.href) throw new Error('Export download URL missing')
const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
await fs.writeFile(path.join(evidenceDir, 't5-export-ready-1440x900.png'), Buffer.from(screenshot.data, 'base64'))
const report = { browser: (await (await fetch('http://127.0.0.1:9225/json/version')).json()).Browser, persistedState: state, exportInfo, runtimeErrors, consoleErrors, failedHttp, loadingFailed }
await fs.writeFile(path.join(evidenceDir, 't5-browser-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
ws.close()
