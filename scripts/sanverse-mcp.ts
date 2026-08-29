import { spawn, type ChildProcess } from 'node:child_process'
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createCreativeProductionExternalSessionV1 } from '@sanverse/creative-production-adapter'
import { connectSanverseStandardStdioV1, createSanverseStandardMcpHttpServerV1 } from '@sanverse/motion-mcp'
import {
  SANVERSE_API_URL,
  SANVERSE_MCP_ENDPOINT,
  SANVERSE_MCP_HEALTH,
  SANVERSE_MCP_PORT,
  SANVERSE_MCP_TOKEN_PATH,
  SANVERSE_ROOT,
  apiReady,
  ensureLocalMcpToken,
  healthSummary,
  readProductionProject,
  resolveProductionProjectId,
} from './sanverse-mcp-shared.ts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const command = process.argv[2] ?? 'dev'
const eventLogPath = join(SANVERSE_ROOT, '.sanverse-data', 'mcp', 'events.jsonl')
const recordToolCall = async (event: Readonly<Record<string, unknown>>) => {
  await mkdir(dirname(eventLogPath), { recursive: true })
  await appendFile(eventLogPath, `${JSON.stringify(event)}\n`, 'utf8')
}

const createRegistry = async (sessionLabel: string) => {
  const projectId = await resolveProductionProjectId()
  const compositionTicksRaw = process.env.SANVERSE_MCP_COMPOSITION_TICKS
  const compositionTicks = compositionTicksRaw === undefined ? undefined : Number(compositionTicksRaw)
  if (compositionTicks !== undefined && (!Number.isSafeInteger(compositionTicks) || compositionTicks < 0)) throw new Error('SANVERSE_MCP_COMPOSITION_TICKS must be a non-negative safe integer.')
  const session = await createCreativeProductionExternalSessionV1({
    sessionLabel,
    readProject: () => readProductionProject(projectId),
    ...(compositionTicks === undefined ? {} : { compositionTicks }),
  })
  return Object.freeze({ registry: session.registry, label: sessionLabel })
}

const npmInvocation = (): Readonly<{ command: string; args: readonly string[] }> => {
  if (process.platform !== 'win32') return Object.freeze({ command: 'npm', args: Object.freeze([]) })
  const npmExecPath = process.env.npm_execpath
  if (!npmExecPath) throw new Error('npm_execpath is unavailable. Start with `npm run sanverse:mcp:dev`.')
  return Object.freeze({ command: process.execPath, args: Object.freeze([npmExecPath]) })
}

const startApi = (): ChildProcess => {
  const npm = npmInvocation()
  return spawn(npm.command, [...npm.args, 'run', 'dev', '--workspace', '@sanverse/api'], {
    cwd: SANVERSE_ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: false,
    windowsHide: true,
  })
}

const waitForApi = async (timeoutMs = 30_000) => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await apiReady()) return
    await sleep(250)
  }
  throw new Error(`Sanverse API did not become ready at ${SANVERSE_API_URL}.`)
}

const healthReady = async (): Promise<boolean> => {
  try {
    const response = await fetch(SANVERSE_MCP_HEALTH, { signal: AbortSignal.timeout(1200) })
    return response.ok
  } catch {
    return false
  }
}

const runHttp = async (reuseExisting: boolean) => {
  if (reuseExisting && await healthReady()) {
    const health = await fetch(SANVERSE_MCP_HEALTH).then((response) => response.json())
    console.error('SANVERSE MCP already running; reusing existing loopback server.')
    console.error(`Endpoint        ${SANVERSE_MCP_ENDPOINT}`)
    console.error(`Health          ${JSON.stringify(health)}`)
    return null
  }
  const token = await ensureLocalMcpToken()
  const server = createSanverseStandardMcpHttpServerV1({ createRegistry, token, health: healthSummary, onToolCall: recordToolCall })
  await new Promise<void>((resolve, reject) => server.listen(SANVERSE_MCP_PORT, '127.0.0.1', resolve).once('error', reject))
  const health = await healthSummary()
  console.error('SANVERSE MCP')
  console.error('Transport       Streamable HTTP')
  console.error(`Endpoint        ${SANVERSE_MCP_ENDPOINT}`)
  console.error(`Health          ${String(health.status).toUpperCase()}`)
  console.error(`Project         ${health.projectConnected ? `CONNECTED (${health.projectId})` : 'NOT CONNECTED'}`)
  console.error(`Tools           ${health.toolCount}`)
  console.error('Writes          SANDBOX ONLY BY DEFAULT')
  console.error('Owner approval  HOST AUTHORITY ONLY')
  console.error(`Credential      local ignored file: ${SANVERSE_MCP_TOKEN_PATH}`)
  console.error('Ready for: Codex, Claude Code, OpenCode')
  return server
}

const runDev = async () => {
  let apiChild: ChildProcess | null = null
  if (!(await apiReady())) {
    console.error('Sanverse API is not running; starting the existing API authority once.')
    apiChild = startApi()
    await waitForApi()
  } else {
    console.error(`Reusing existing Sanverse API at ${SANVERSE_API_URL}.`)
  }
  const mcp = await runHttp(true)
  if (!mcp) return
  let stopping = false
  const stop = () => {
    if (stopping) return
    stopping = true
    mcp.close()
    if (apiChild && apiChild.exitCode === null) {
      if (process.platform === 'win32' && apiChild.pid) spawn('taskkill.exe', ['/pid', String(apiChild.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
      else apiChild.kill()
    }
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
  if (command === 'status') {
    console.log(JSON.stringify(await healthSummary(), null, 2))
    return
  }
  throw new Error(`Unknown Sanverse MCP command: ${command}`)
}

await main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
