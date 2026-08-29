import { createHash } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createCreativeProductionExternalOrchestrationSessionV1 } from '@sanverse/creative-production-adapter'
import { connectSanverseStandardStdioV1, createSanverseStandardMcpHttpServerV1, importLocalVideoThroughProductionApiV1, parseImportRootsV1 } from '@sanverse/motion-mcp'
import {
  SANVERSE_API_URL,
  SANVERSE_MCP_ENDPOINT,
  SANVERSE_MCP_HEALTH,
  SANVERSE_MCP_PORT,
  SANVERSE_MCP_TOKEN_PATH,
  SANVERSE_ROOT,
  acceptProductionChangeSet,
  apiReady,
  cancelProductionExportJob,
  createProductionExport,
  ensureLocalMcpToken,
  healthSummary,
  listProductionProjects,
  putProductionCreativeArtifact,
  readProductionCreativeArtifact,
  readProductionExportJob,
  readProductionProject,
  redoProductionProject,
  undoProductionProject,
} from './sanverse-mcp-shared.ts'
import { resolveHostOwnerApprovalRefV1 } from './sanverse-mcp-approval-authority.ts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const command = process.argv[2] ?? 'dev'
const SANVERSE_WEB_URL = (process.env.SANVERSE_WEB_URL ?? 'http://127.0.0.1:2000').replace(/\/$/u, '')
const eventLogPath = join(SANVERSE_ROOT, '.sanverse-data', 'mcp', 'events.jsonl')
const recordToolCall = async (event: Readonly<Record<string, unknown>>) => {
  await mkdir(dirname(eventLogPath), { recursive: true })
  await appendFile(eventLogPath, `${JSON.stringify(event)}\n`, 'utf8')
}

const sha256Text = async (text: string) => createHash('sha256').update(text).digest('hex')

const createRegistry = async (sessionLabel: string) => {
  const session = await createCreativeProductionExternalOrchestrationSessionV1({
    sessionLabel,
    listProjects: listProductionProjects,
    readProject: readProductionProject,
    importSourceVideo: async ({ localPath }) => {
      const imported = await importLocalVideoThroughProductionApiV1({ localPath, roots: parseImportRootsV1(), apiUrl: SANVERSE_API_URL })
      const manifest = imported.manifest as { id?: unknown; sha256?: unknown; originalFilename?: unknown }
      if (typeof manifest.id !== 'string' || typeof manifest.sha256 !== 'string' || typeof manifest.originalFilename !== 'string') throw new Error('Production intake returned an invalid project manifest.')
      const project = await readProductionProject(manifest.id)
      return Object.freeze({ project, sourceSha256: manifest.sha256, originalFilename: manifest.originalFilename })
    },
    sha256Text,
    putCreativeArtifact: putProductionCreativeArtifact,
    readCreativeArtifact: readProductionCreativeArtifact,
    acceptChangeSet: acceptProductionChangeSet,
    undoProject: undoProductionProject,
    redoProject: redoProductionProject,
    createExport: createProductionExport,
    readExportJob: readProductionExportJob,
    cancelExportJob: cancelProductionExportJob,
    resolveOwnerApprovalRef: resolveHostOwnerApprovalRefV1,
  })
  return Object.freeze({ registry: session.registry, label: sessionLabel })
}

const health = async () => {
  try {
    const probe = await createRegistry('health-probe')
    return healthSummary(probe.registry.list().length)
  } catch {
    return healthSummary(0)
  }
}

const npmInvocation = (): Readonly<{ command: string; args: readonly string[] }> => {
  if (process.platform !== 'win32') return Object.freeze({ command: 'npm', args: Object.freeze([]) })
  const npmExecPath = process.env.npm_execpath
  if (!npmExecPath) throw new Error('npm_execpath is unavailable. Start with `npm run sanverse:mcp:dev`.')
  return Object.freeze({ command: process.execPath, args: Object.freeze([npmExecPath]) })
}

const startWorkspaceDev = (workspace: '@sanverse/api' | '@sanverse/web'): ChildProcess => {
  const npm = npmInvocation()
  return spawn(npm.command, [...npm.args, 'run', 'dev', '--workspace', workspace], { cwd: SANVERSE_ROOT, stdio: ['ignore', 'inherit', 'inherit'], shell: false, windowsHide: true })
}

const webReady = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${SANVERSE_WEB_URL}/render/creative-scene`, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

const waitUntil = async (label: string, check: () => Promise<boolean>, timeoutMs = 30_000) => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await check()) return
    await sleep(250)
  }
  throw new Error(`${label} did not become ready.`)
}

const stopChild = (child: ChildProcess | null): void => {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32' && child.pid) spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
  else child.kill()
}

const healthReady = async (): Promise<boolean> => {
  try { return (await fetch(SANVERSE_MCP_HEALTH, { signal: AbortSignal.timeout(1200) })).ok } catch { return false }
}

const runHttp = async (reuseExisting: boolean) => {
  if (reuseExisting && await healthReady()) {
    const existing = await fetch(SANVERSE_MCP_HEALTH).then((response) => response.json())
    console.error('SANVERSE MCP already running; reusing existing loopback server.')
    console.error(`Endpoint        ${SANVERSE_MCP_ENDPOINT}`)
    console.error(`Health          ${JSON.stringify(existing)}`)
    return null
  }
  const token = await ensureLocalMcpToken()
  const server = createSanverseStandardMcpHttpServerV1({ createRegistry, token, health, onToolCall: recordToolCall })
  await new Promise<void>((resolve, reject) => server.listen(SANVERSE_MCP_PORT, '127.0.0.1', resolve).once('error', reject))
  const status = await health()
  console.error('SANVERSE MCP')
  console.error('Transport       Streamable HTTP')
  console.error(`Endpoint        ${SANVERSE_MCP_ENDPOINT}`)
  console.error(`Health          ${String(status.status).toUpperCase()}`)
  console.error(`Projects        ${status.projectCount ?? 0} available; selection is session-local`)
  console.error(`Tools           ${status.toolCount}`)
  console.error('Writes          SANDBOX FIRST; PRODUCTION APPLY REQUIRES EXACT OWNER-GATED BATCH')
  console.error('Owner approval  HOST AUTHORITY ONLY')
  console.error(`Credential      local ignored file: ${SANVERSE_MCP_TOKEN_PATH}`)
  console.error('Ready for: Codex, Claude Code, OpenCode')
  return server
}

const runDev = async () => {
  let apiChild: ChildProcess | null = null
  let webChild: ChildProcess | null = null
  if (!(await apiReady())) {
    console.error('Sanverse API is not running; starting the existing API authority once.')
    apiChild = startWorkspaceDev('@sanverse/api')
    await waitUntil(`Sanverse API at ${SANVERSE_API_URL}`, apiReady)
  } else console.error(`Reusing existing Sanverse API at ${SANVERSE_API_URL}.`)
  if (!(await webReady())) {
    console.error('Sanverse web renderer is not running; starting the existing production web surface once for preview/export parity.')
    webChild = startWorkspaceDev('@sanverse/web')
    await waitUntil(`Sanverse web renderer at ${SANVERSE_WEB_URL}`, webReady)
  } else console.error(`Reusing existing Sanverse web renderer at ${SANVERSE_WEB_URL}.`)
  const mcp = await runHttp(true)
  if (!mcp) {
    stopChild(apiChild)
    stopChild(webChild)
    return
  }
  let stopping = false
  const stop = () => {
    if (stopping) return
    stopping = true
    mcp.close()
    stopChild(apiChild)
    stopChild(webChild)
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

const runStdio = async () => {
  if (!(await apiReady())) throw new Error(`Sanverse API is not running at ${SANVERSE_API_URL}. Start it with npm run dev or npm run sanverse:mcp:dev.`)
  console.error('Sanverse MCP STDIO connected to the existing production API. stdout is reserved for MCP framing.')
  await connectSanverseStandardStdioV1(createRegistry, { onToolCall: recordToolCall })
}

const main = async () => {
  if (command === 'dev') { await runDev(); return }
  if (command === 'http') {
    if (!(await apiReady())) throw new Error(`Sanverse API is not running at ${SANVERSE_API_URL}. Use sanverse:mcp:dev to start/reuse it.`)
    await runHttp(false)
    return
  }
  if (command === 'stdio') { await runStdio(); return }
  if (command === 'status') { console.log(JSON.stringify(await health(), null, 2)); return }
  throw new Error(`Unknown Sanverse MCP command: ${command}`)
}

await main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
