import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webUrl = 'http://127.0.0.1:2000'
const apiUrl = 'http://127.0.0.1:2001'
const debugPort = 10200 + (process.pid % 80)
const debugUrl = `http://127.0.0.1:${debugPort}`
const outputRoot = resolve(root, 'DOCS/evidence/2026-08-28-creative-engine-v16-production')
const screenshotRoot = resolve(outputRoot, 'screenshots')
const tempRoot = resolve(root, 'tmp/creative-engine-v16-browser')
const dataRoot = resolve(tempRoot, 'data')
const sourceFile = resolve(tempRoot, 'v16-production-source.mp4')
const exportedFile = resolve(tempRoot, 'v16-production-export.mp4')
const edge = process.platform === 'win32'
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : process.env.CHROME_BIN ?? 'google-chrome'

const sleep = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
const waitFor = async <T>(fn: () => Promise<T | null>, timeoutMs: number, label: string): Promise<T> => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await fn()
    if (value !== null) return value
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms.`)
}
const ready = async (url: string) => { try { return (await fetch(url)).ok } catch { return false } }
const json = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return await response.json() as T
}

const main = async () => {
  await rm(tempRoot, { recursive: true, force: true })
  await mkdir(tempRoot, { recursive: true })
  await mkdir(screenshotRoot, { recursive: true })

  const ffmpeg = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=6',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast',
    '-c:a', 'aac', '-b:a', '96k', '-shortest', sourceFile,
  ], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60_000 })
  if (ffmpeg.status !== 0) throw new Error(`Could not create browser source media: ${ffmpeg.stderr}`)

  const npmExecPath = process.env.npm_execpath
  if (!npmExecPath) throw new Error('Run this audit through npm so npm_execpath is available.')
  const common = { cwd: root, stdio: 'ignore' as const, windowsHide: true }
  const api = spawn(process.execPath, [npmExecPath, 'run', 'dev', '--workspace', 'apps/api'], {
    ...common,
    env: { ...process.env, SANVERSE_DATA_DIR: dataRoot },
  })
  const web = spawn(process.execPath, [npmExecPath, 'run', 'dev', '--workspace', 'apps/web'], common)
  let browser: ReturnType<typeof spawn> | null = null
  let ws: WebSocket | null = null

  try {
    await waitFor(async () => await ready(`${apiUrl}/api/projects`) ? true : null, 30_000, 'local API')
    await waitFor(async () => await ready(webUrl) ? true : null, 30_000, 'production web')

    const bytes = await readFile(sourceFile)
    const createdResponse = await fetch(`${apiUrl}/api/projects`, {
      method: 'POST',
      headers: { 'X-Sanverse-Filename': encodeURIComponent('v16-production-source.mp4'), 'Content-Type': 'video/mp4' },
      body: bytes,
    })
    if (!createdResponse.ok) throw new Error(`Project intake failed: ${createdResponse.status} ${await createdResponse.text()}`)
    const created = await createdResponse.json() as { id: string; originalFilename: string }
    const projectId = created.id

    const profileDir = resolve(tempRoot, `edge-profile-${process.pid}`)
    browser = spawn(edge, [
      '--headless=new', '--hide-scrollbars', `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`, '--window-size=1440,900', '--force-device-scale-factor=1', 'about:blank',
    ], { cwd: root, stdio: 'ignore', windowsHide: true })

    interface TargetInfo { webSocketDebuggerUrl?: string; type?: string }
    const target = await waitFor(async () => {
      try {
        const list = await (await fetch(`${debugUrl}/json/list`)).json() as TargetInfo[]
        return list.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? null
      } catch { return null }
    }, 15_000, 'Edge CDP target')

    ws = new WebSocket(target)
    let nextId = 1
    const pending = new Map<number, { resolve: (value: any) => void; reject: (reason: unknown) => void }>()
    const consoleErrors: string[] = []
    const networkFailures: string[] = []
    const badResponses: string[] = []
    const exportNetwork: Array<Record<string, unknown>> = []
    const requestUrls = new Map<string,string>()
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolveValue, reject) => {
      const id = nextId++
      pending.set(id, { resolve: resolveValue, reject })
      ws!.send(JSON.stringify({ id, method, params }))
    })
    ws.on('message', (raw) => {
      const message = JSON.parse(String(raw))
      if (message.id && pending.has(message.id)) {
        const item = pending.get(message.id)!
        pending.delete(message.id)
        message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result)
        return
      }
      if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(String(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text ?? 'Runtime exception'))
      if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') consoleErrors.push(String(message.params.entry.text))
      if (message.method === 'Network.requestWillBeSent') {
        const url = String(message.params?.request?.url ?? '')
        const requestId = String(message.params?.requestId ?? '')
        requestUrls.set(requestId, url)
        if (url.includes('/exports') || url.includes('/export-jobs')) exportNetwork.push({ event: 'request', method: message.params?.request?.method, url })
      }
      if (message.method === 'Network.loadingFailed') {
        const requestId = String(message.params?.requestId ?? '')
        const url = requestUrls.get(requestId) ?? ''
        networkFailures.push(`${String(message.params?.errorText ?? 'loading failed')} ${url}`.trim())
        if (url.includes('/exports') || url.includes('/export-jobs')) exportNetwork.push({ event: 'failed', error: message.params?.errorText, url })
      }
      if (message.method === 'Network.responseReceived') {
        const url = String(message.params?.response?.url ?? '')
        if (url.includes('/exports') || url.includes('/export-jobs')) exportNetwork.push({ event: 'response', status: message.params?.response?.status, url })
        if (Number(message.params?.response?.status) >= 400) badResponses.push(`${message.params.response.status} ${url}`)
      }
    })
    await new Promise<void>((resolveOpen, reject) => { ws!.once('open', resolveOpen); ws!.once('error', reject) })
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable')

    const evaluate = async <T = unknown>(expression: string): Promise<T> => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (result.exceptionDetails) throw new Error(String(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Browser evaluation failed.'))
      return result.result?.value as T
    }
    const click = async (label: string) => {
      const clicked = await evaluate<boolean>(`(()=>{const wanted=${JSON.stringify(label)};const nodes=[...document.querySelectorAll('button,[role="tab"],a')];const matches=n=>((n.getAttribute('aria-label')||n.textContent||'').trim()===wanted||(n.textContent||'').trim()===wanted);const el=nodes.find(n=>matches(n)&&!(n instanceof HTMLButtonElement&&n.disabled));if(!el)return false;el.click();return true})()`)
      if (!clicked) throw new Error(`Could not click enabled ${label}. body=${String(await evaluate('document.body?.innerText ?? ""')).slice(0,1200)}`)
    }
    const bodyHas = async (text: string) => (await evaluate<string>('document.body?.innerText ?? ""')).includes(text)
    const waitEnabled = async (label: string, timeoutMs = 10_000) => waitFor(async () => await evaluate<boolean>(`Boolean([...document.querySelectorAll('button')].find(n=>(n.textContent||'').trim()===${JSON.stringify(label)} && !(n instanceof HTMLButtonElement && n.disabled)))`) ? true : null, timeoutMs, `${label} enabled`)
    const capture = async (name: string) => {
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      await writeFile(resolve(screenshotRoot, name), Buffer.from(shot.data, 'base64'))
    }
    const setViewport = async (width: number, height: number) => {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      await sleep(250)
    }
    const projectState = async () => {
      const payload = await json<{ project: any }>(`${apiUrl}/api/projects/${projectId}`)
      return payload.project
    }

    await send('Page.navigate', { url: webUrl })
    await waitFor(async () => await bodyHas('Recent projects') ? true : null, 20_000, 'Home')
    await waitFor(async () => await bodyHas('Open v16-production-source.mp4') ? true : null, 20_000, 'recent project')
    await click('Open v16-production-source.mp4')
    await waitFor(async () => await bodyHas('Studio') && (await evaluate<number>('document.querySelectorAll("video").length')) === 1 ? true : null, 20_000, 'Studio source')
    await click('Studio workspace')
    await waitFor(async () => await bodyHas('Creative') ? true : null, 10_000, 'Studio workspaces')
    await click('Creative')
    await waitFor(async () => await bodyHas('CREATIVE ENGINE V1.6') ? true : null, 10_000, 'Creative workspace')

    const createState = await evaluate<any>(`(()=>{const el=[...document.querySelectorAll('button')].find(n=>(n.textContent||'').trim()==='Create Creative draft');const video=document.querySelector('video');return el?{disabled:Boolean(el.disabled),videoTime:video?.currentTime??null,body:(document.body?.innerText??'').slice(0,1800)}:null})()`)
    if (!createState || createState.disabled) throw new Error(`Creative draft button unavailable: ${JSON.stringify(createState)}`)
    await click('Create Creative draft')
    try {
      await waitFor(async () => await bodyHas('Deep motion controls') ? true : null, 10_000, 'Creative draft')
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)} body=${String(await evaluate('document.body?.innerText ?? ""')).slice(0,2200)}`)
    }
    await click('C5 Curves')
    await waitFor(async () => await evaluate("Boolean([...document.querySelectorAll('button')].find(n=>(n.textContent||'').trim()==='snappy'))") ? true : null, 10_000, 'C5 controls')
    await click('snappy')
    await waitFor(async () => await bodyHas('Previous approvals were discarded') ? true : null, 10_000, 'C5 approval reset')
    await capture('01-creative-c5-edited.png')

    for (const label of ['Approve Storyboard', 'Build Animatic', 'Approve Animatic', 'Build Motion']) {
      await waitEnabled(label)
      await click(label)
    }
    await waitEnabled('Prepare Review')
    await click('Prepare Review')
    await waitFor(async () => await bodyHas('review ready') ? true : null, 20_000, 'Motion Review')
    await waitEnabled('Approve Motion')
    await click('Approve Motion')
    await waitEnabled('Apply to production')
    await click('Apply to production')
    await waitFor(async () => (await projectState()).revision === 1 ? true : null, 30_000, 'Creative production apply')
    const accepted = await projectState()
    const creativeRecord = accepted.changeSets.at(-1)
    if (!creativeRecord || creativeRecord.changeSet.operations.length !== 2 || creativeRecord.changeSet.operations[0]?.kind !== 'add-title' || creativeRecord.changeSet.operations[1]?.kind !== 'set-visual-properties') {
      throw new Error(`Creative production history is not one two-operation change set: ${JSON.stringify(creativeRecord)}`)
    }
    if (creativeRecord.changeSet.provenance?.source !== 'ai' || !creativeRecord.changeSet.extensions?.['sanverse.creative/lineage']) throw new Error('Creative lineage/provenance missing from accepted production history.')
    await capture('02-creative-applied.png')

    await click('Undo edit')
    await waitFor(async () => (await projectState()).revision === 2 ? true : null, 20_000, 'Creative Undo')
    const undone = await projectState()
    if (undone.changeSets.some((record: any) => record.changeSet.changeSetId === creativeRecord.changeSet.changeSetId) || undone.redoStack.length !== 1) throw new Error('One Undo did not remove the complete Creative change set.')
    await click('Redo edit')
    await waitFor(async () => (await projectState()).revision === 3 ? true : null, 20_000, 'Creative Redo')
    const redone = await projectState()
    if (!redone.changeSets.some((record: any) => record.changeSet.changeSetId === creativeRecord.changeSet.changeSetId)) throw new Error('One Redo did not restore the Creative change set.')

    const responsive: Array<Record<string, unknown>> = []
    for (const [width, height, name] of [[1440,900,'desktop'],[1024,768,'tablet'],[390,844,'mobile']] as const) {
      await setViewport(width, height)
      let state = await evaluate<any>(`(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,videoCount:document.querySelectorAll('video').length,creativeVisible:(document.body?.innerText??'').includes('CREATIVE ENGINE V1.6'),selectedCreative:[...document.querySelectorAll('[role="tab"]')].some(el=>el.textContent?.trim()==='Creative'&&el.getAttribute('aria-selected')==='true'),showCreative:[...document.querySelectorAll('button')].some(el=>(el.textContent||'').trim()==='Show Creative')}))()`)
      if (state.horizontalOverflow || state.videoCount !== 1 || !state.selectedCreative) throw new Error(`Responsive Creative authority failure at ${width}x${height}: ${JSON.stringify(state)}`)
      let compactReachable = state.creativeVisible
      if (!state.creativeVisible && state.showCreative) {
        await click('Show Creative')
        await waitFor(async () => await bodyHas('CREATIVE ENGINE V1.6') ? true : null, 10_000, `compact Creative ${name}`)
        compactReachable = true
        state = await evaluate<any>(`(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,videoCount:document.querySelectorAll('video').length,creativeVisible:(document.body?.innerText??'').includes('CREATIVE ENGINE V1.6'),selectedCreative:[...document.querySelectorAll('[role="tab"]')].some(el=>el.textContent?.trim()==='Creative'&&el.getAttribute('aria-selected')==='true'),showCreative:[...document.querySelectorAll('button')].some(el=>(el.textContent||'').trim()==='Show Creative')}))()`)
      }
      if (!compactReachable || !state.creativeVisible) throw new Error(`Responsive Creative reachability failure at ${width}x${height}: ${JSON.stringify(state)}`)
      responsive.push({ name, ...state, compactReachable })
      await capture(`03-${name}-${width}x${height}.png`)
    }
    await setViewport(1440, 900)

    await send('Page.reload', { ignoreCache: true })
    await waitFor(async () => await bodyHas('Recent projects') ? true : null, 20_000, 'Home after reload')
    await waitFor(async () => await bodyHas('Open v16-production-source.mp4') ? true : null, 20_000, 'saved project after reload')
    await click('Open v16-production-source.mp4')
    await waitFor(async () => (await evaluate<number>('document.querySelectorAll("video").length')) === 1 ? true : null, 20_000, 'reopened saved source')
    const reopened = await projectState()
    if (reopened.revision !== 3 || !reopened.changeSets.some((record: any) => record.changeSet.changeSetId === creativeRecord.changeSet.changeSetId)) throw new Error('Accepted Creative result did not survive reopen.')
    await click('Studio workspace')
    await waitFor(async () => await bodyHas('Creative') ? true : null, 10_000, 'Studio after reopen')
    await click('Creative')
    await waitFor(async () => await bodyHas('CREATIVE ENGINE V1.6') ? true : null, 10_000, 'Creative after reopen')

    const exportControl = await evaluate<any>(`(()=>{const el=document.querySelector('.editor-shell__actions button[aria-label="Export video"]');const all=[...document.querySelectorAll('button')].filter(n=>(n.getAttribute('aria-label')||'').includes('Export')).map(n=>({className:n.className,aria:n.getAttribute('aria-label'),disabled:n.disabled,text:(n.textContent||'').trim(),display:getComputedStyle(n).display,visibility:getComputedStyle(n).visibility}));if(!(el instanceof HTMLButtonElement))return {ready:false,all};el.scrollIntoView({block:'center',inline:'center'});const r=el.getBoundingClientRect();return {ready:!el.disabled,aria:el.getAttribute('aria-label'),text:(el.textContent||'').trim(),display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility,x:r.left+r.width/2,y:r.top+r.height/2,all}})()`)
    if (!exportControl?.ready) throw new Error(`The visible EditorShell export button was not enabled after reopening the accepted Creative result. control=${JSON.stringify(exportControl)} body=${String(await evaluate('document.body?.innerText ?? ""')).slice(-1800)}`)
    const exactExportClick = await evaluate<any>(`(()=>{const el=document.querySelector('.editor-shell__actions button[aria-label="Export video"]');if(!(el instanceof HTMLButtonElement)||el.disabled)return {clicked:false};el.click();return {clicked:true,aria:el.getAttribute('aria-label'),text:(el.textContent||'').trim()}})()`)
    if (!exactExportClick?.clicked) throw new Error(`Exact EditorShell export click failed: ${JSON.stringify(exactExportClick)}`)
    await waitFor(async () => await evaluate<boolean>(`Boolean(document.querySelector('.editor-shell__actions button[aria-label="Exporting video"]'))`) ? true : null, 5_000, 'export UI start')
    const exportOutcome = await waitFor(async () => await evaluate<string | null>(`(()=>{if((document.body?.innerText??'').includes('Export ready'))return 'ready';const error=document.querySelector('.studio-screen__export-error');return error?'error:'+(error.textContent||'').trim():null})()`), 15_000, 'production export outcome')
    if (exportOutcome.startsWith('error:')) throw new Error(`Production export UI failed: ${exportOutcome.slice(6)} exportNetwork=${JSON.stringify(exportNetwork)} console=${JSON.stringify(consoleErrors)} network=${JSON.stringify(networkFailures)} responses=${JSON.stringify(badResponses)}`)
    const href = await evaluate<string>(`document.querySelector('a[download="sanverse-edited.mp4"]')?.getAttribute('href') ?? ''`)
    if (!href) throw new Error('Export download URL missing.')
    const exportResponse = await fetch(new URL(href, webUrl))
    if (!exportResponse.ok) throw new Error(`Export download failed: ${exportResponse.status}`)
    await writeFile(exportedFile, Buffer.from(await exportResponse.arrayBuffer()))
    const exportBytes = (await stat(exportedFile)).size
    const exportSha256 = createHash('sha256').update(await readFile(exportedFile)).digest('hex')
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', exportedFile], { encoding: 'utf8', windowsHide: true, timeout: 30_000 })
    if (probe.status !== 0) throw new Error(`Export ffprobe failed: ${probe.stderr}`)
    const probeJson = JSON.parse(probe.stdout)
    const videoStream = probeJson.streams?.find((stream: any) => stream.codec_type === 'video')
    if (!videoStream || Number(videoStream.width) !== 640 || Number(videoStream.height) !== 360) throw new Error(`Export dimensions wrong: ${JSON.stringify(videoStream)}`)
    await capture('04-export-ready.png')

    const diskProjectPath = resolve(dataRoot, 'projects', projectId, 'edit-project.json')
    const diskProject = JSON.parse(await readFile(diskProjectPath, 'utf8'))
    if (diskProject.revision !== 3 || !diskProject.changeSets.some((record: any) => record.changeSet.changeSetId === creativeRecord.changeSet.changeSetId)) throw new Error('On-disk production state does not contain the reopened Creative result.')

    const releaseBadResponses = badResponses.filter((item) => !item.includes('/favicon.ico'))
    const releaseConsoleErrors = consoleErrors.filter((item) => !(item.includes('Failed to load resource') && releaseBadResponses.length === 0 && badResponses.some((response) => response.includes('/favicon.ico'))))
    const releaseNetworkFailures = networkFailures.filter((item) => !item.includes('net::ERR_ABORTED'))
    if (releaseConsoleErrors.length || releaseNetworkFailures.length || releaseBadResponses.length) throw new Error(`Browser errors: console=${JSON.stringify(releaseConsoleErrors)} network=${JSON.stringify(releaseNetworkFailures)} responses=${JSON.stringify(releaseBadResponses)}`)

    const evidence = {
      schemaVersion: 'sanverse.creative-production-browser-evidence/v1.6',
      recordedAt: new Date().toISOString(),
      browser: 'Microsoft Edge headless via native CDP',
      url: webUrl,
      projectId,
      source: { filename: created.originalFilename, syntheticRealMp4: true, width: 640, height: 360, durationSeconds: 6, committed: false },
      workflow: {
        sourceLoaded: true,
        creativeWorkspace: true,
        c5ManualEdit: 'snappy',
        staleApprovalsDiscardedAfterC5Edit: true,
        storyboardReapproved: true,
        animaticReapproved: true,
        motionReviewPrepared: true,
        motionReapproved: true,
        oneAtomicProductionChangeSet: true,
        operations: creativeRecord.changeSet.operations.map((operation: any) => operation.kind),
        lineagePresent: true,
        revisionAfterApply: 1,
        revisionAfterUndo: 2,
        revisionAfterRedo: 3,
        persistedAfterReload: true,
      },
      responsive,
      export: { href, localTemporaryPath: exportedFile, committed: false, bytes: exportBytes, sha256: exportSha256, probe: probeJson },
      disk: { editProjectPath: diskProjectPath, revision: diskProject.revision, creativeChangeSetPresent: true },
      consoleErrors: releaseConsoleErrors,
      networkFailures: releaseNetworkFailures,
      badResponses: releaseBadResponses,
      ignoredBrowserNoise: badResponses.filter((item) => item.includes('/favicon.ico')),
      screenshots: ['01-creative-c5-edited.png','02-creative-applied.png','03-desktop-1440x900.png','03-tablet-1024x768.png','03-mobile-390x844.png','04-export-ready.png'],
    }
    await writeFile(resolve(outputRoot, 'browser-report.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    console.log(`V16_PRODUCTION_BROWSER project=${projectId} apply=1 undo=2 redo=3 reopen=true responsive=3 exportBytes=${exportBytes} sha256=${exportSha256} consoleErrors=${releaseConsoleErrors.length} networkFailures=${releaseNetworkFailures.length} badResponses=${releaseBadResponses.length}`)
  } finally {
    ws?.close()
    browser?.kill()
    api.kill()
    web.kill()
    await sleep(500)
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1 })
