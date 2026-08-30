import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SANVERSE_API_URL, SANVERSE_MCP_TOKEN_ENV, SANVERSE_ROOT, apiReady } from './sanverse-mcp-shared.ts'

const evidenceRoot = resolve(SANVERSE_ROOT, 'DOCS/evidence/2026-08-30-zero-setup-local-mcp-v1')
const reportPath = resolve(evidenceRoot, 'zero-setup-report.json')
const eventLogPath = resolve(SANVERSE_ROOT, '.sanverse-data', 'mcp', 'events.jsonl')
const launcherPath = resolve(SANVERSE_ROOT, 'scripts', 'sanverse-mcp-stdio.mjs')
const webUrl = (process.env.SANVERSE_WEB_URL ?? 'http://127.0.0.1:2000').replace(/\/$/u, '')

const resolveWindowsShim = (command: string): string | null => {
  if (process.platform !== 'win32') return null
  const located = spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true })
  if ((located.status ?? 1) !== 0) return null
  return (located.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).find((line) => /\.(cmd|bat)$/i.test(line)) ?? null
}

const exec = (command: string, commandArgs: readonly string[], timeout = 30_000) => {
  const shim = resolveWindowsShim(command)
  const actualCommand = shim ? (process.env.ComSpec ?? 'cmd.exe') : command
  const actualArgs = shim ? ['/d', '/s', '/c', shim, ...commandArgs] : [...commandArgs]
  const result = spawnSync(actualCommand, actualArgs, {
    cwd: SANVERSE_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout,
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
  })
  return Object.freeze({ status: result.status ?? (result.error ? 1 : 0), stdout: result.stdout ?? '', stderr: result.stderr ?? '' })
}

const version = (command: string) => {
  const result = exec(command, ['--version'], 15_000)
  return result.status === 0 ? result.stdout.trim() : null
}

const configured = () => {
  const codex = exec('codex', ['mcp', 'get', 'sanverse'], 20_000)
  const claude = exec('claude', ['mcp', 'get', 'sanverse'], 30_000)
  const opencode = exec('opencode', ['mcp', 'list'], 90_000)
  const codexText = `${codex.stdout}\n${codex.stderr}`
  const claudeText = `${claude.stdout}\n${claude.stderr}`
  const opencodeText = `${opencode.stdout}\n${opencode.stderr}`
  return Object.freeze({
    codex: codex.status === 0 && /sanverse/i.test(codexText) && /stdio/i.test(codexText) && /sanverse-mcp-stdio\.mjs/i.test(codexText) && !/bearer_token_env_var:\s+SANVERSE_MCP_TOKEN/i.test(codexText),
    claude: claude.status === 0 && /sanverse/i.test(claudeText) && /stdio/i.test(claudeText) && /sanverse-mcp-stdio\.mjs/i.test(claudeText) && !/Authorization:\s*Bearer/i.test(claudeText),
    opencode: opencode.status === 0 && /sanverse/i.test(opencodeText) && /connected/i.test(opencodeText) && /sanverse-mcp-stdio\.mjs/i.test(opencodeText),
  })
}

const webReady = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${webUrl}/render/creative-scene`, { signal: AbortSignal.timeout(2500) })
    return response.ok
  } catch {
    return false
  }
}

const userTokenEnvPresent = (): boolean => {
  if (process.platform !== 'win32') return false
  const expression = `[Environment]::GetEnvironmentVariable('${SANVERSE_MCP_TOKEN_ENV}','User')`
  const result = exec('powershell.exe', ['-NoProfile', '-Command', expression], 15_000)
  return result.status === 0 && Boolean(result.stdout.trim())
}

const readClientProof = async () => {
  const source = await readFile(eventLogPath, 'utf8').catch(() => '')
  const events = source.split(/\r?\n/u).filter(Boolean).map((line) => {
    try { return JSON.parse(line) as Record<string, unknown> } catch { return null }
  }).filter((event): event is Record<string, unknown> => event !== null)
  const find = (clientName: string) => [...events].reverse().find((event) => event.clientName === clientName && event.toolName === 'production.list_projects' && event.ok === true)
  const safe = (event: Record<string, unknown> | undefined) => event ? Object.freeze({
    clientName: String(event.clientName),
    clientVersion: String(event.clientVersion ?? ''),
    toolName: String(event.toolName),
    ok: event.ok === true,
    at: String(event.at ?? ''),
  }) : null
  return Object.freeze({ codex: safe(find('codex-mcp-client')), opencode: safe(find('opencode')) })
}

const directStdioProbe = async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [launcherPath], cwd: SANVERSE_ROOT, stderr: 'pipe' })
  let stderr = ''
  transport.stderr?.on('data', (chunk) => { stderr += String(chunk) })
  const client = new Client({ name: 'sanverse-zero-setup-verifier', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)
  try {
    const tools = await client.listTools()
    const projectsResult = await client.callTool({ name: 'production.list_projects', arguments: {} })
    const structured = 'structuredContent' in projectsResult && projectsResult.structuredContent && typeof projectsResult.structuredContent === 'object'
      ? projectsResult.structuredContent as Record<string, unknown>
      : null
    const value = structured?.ok === true && structured.value && typeof structured.value === 'object' ? structured.value as Record<string, unknown> : null
    const projects = Array.isArray(value?.projects) ? value.projects : []
    return Object.freeze({ toolCount: tools.tools.length, projectCount: projects.length, stderrClean: !/exception|fatal/i.test(stderr) })
  } finally {
    await transport.close()
  }
}

const main = async () => {
  await mkdir(evidenceRoot, { recursive: true })
  const installations = Object.freeze({ codex: version('codex'), claude: version('claude'), opencode: version('opencode') })
  const stdio = await directStdioProbe()
  const config = configured()
  const clientProof = await readClientProof()
  const runtime = Object.freeze({ apiReady: await apiReady(), webReady: await webReady(), apiUrl: SANVERSE_API_URL.replace(/127\.0\.0\.1/u, 'loopback'), webUrl: webUrl.replace(/127\.0\.0\.1/u, 'loopback') })
  const clients = Object.freeze({
    codex: Object.freeze({ installed: installations.codex !== null, version: installations.codex, configuredForLocalStdio: config.codex }),
    claude: Object.freeze({ installed: installations.claude !== null, version: installations.claude, configuredForLocalStdio: config.claude }),
    opencode: Object.freeze({ installed: installations.opencode !== null, version: installations.opencode, configuredForLocalStdio: config.opencode }),
  })
  const legacyUserTokenEnvironmentPresent = userTokenEnvPresent()
  const realClientProofComplete = clientProof.codex?.ok === true && clientProof.opencode?.ok === true
  const readyForUserValidation = stdio.toolCount === 52 && runtime.apiReady && runtime.webReady && !legacyUserTokenEnvironmentPresent && realClientProofComplete && Object.values(clients).every((client) => client.installed && client.configuredForLocalStdio)
  const report = Object.freeze({
    schemaVersion: 'sanverse.zero-setup-local-mcp-report/v1',
    generatedAt: new Date().toISOString(),
    transport: 'stdio',
    launcher: 'scripts/sanverse-mcp-stdio.mjs',
    runtime,
    stdio,
    clients,
    clientProof,
    ownerAcceptedClaudeConfigurationOnly: true,
    legacyUserTokenEnvironmentPresent,
    readyForUserValidation,
    modelOrProviderCallsRun: true,
    security: Object.freeze({ acceptedProjectWritesExposed: false, ownerApprovalHostOnly: true, bearerTokenRequiredForLocalStdio: false, credentialsIncluded: false }),
  })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (!readyForUserValidation) process.exitCode = 1
}

await main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
