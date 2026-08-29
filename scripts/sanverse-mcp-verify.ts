import { spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { SANVERSE_MCP_HEALTH, SANVERSE_ROOT } from './sanverse-mcp-shared.ts'

const evidenceRoot = resolve(SANVERSE_ROOT, 'DOCS/evidence/2026-08-29-external-mcp-interop-v1')
const reportPath = resolve(evidenceRoot, 'interop-report.json')

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
  return Object.freeze({
    status: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  })
}

const version = (command: string) => {
  const result = exec(command, ['--version'], 15_000)
  return result.status === 0 ? result.stdout.trim() : null
}

const configured = () => {
  const codex = exec('codex', ['mcp', 'get', 'sanverse'], 20_000)
  const claude = exec('claude', ['mcp', 'get', 'sanverse'], 30_000)
  const opencode = exec('opencode', ['mcp', 'list'], 30_000)
  return Object.freeze({
    codex: codex.status === 0 && /sanverse/i.test(`${codex.stdout}\n${codex.stderr}`),
    claude: claude.status === 0 && /sanverse/i.test(`${claude.stdout}\n${claude.stderr}`),
    opencode: opencode.status === 0 && /sanverse/i.test(`${opencode.stdout}\n${opencode.stderr}`),
  })
}

const health = async () => {
  try {
    const response = await fetch(SANVERSE_MCP_HEALTH, { signal: AbortSignal.timeout(2500) })
    return Object.freeze({ connected: response.ok, payload: response.ok ? await response.json() as Record<string, unknown> : null })
  } catch {
    return Object.freeze({ connected: false, payload: null })
  }
}

const main = async () => {
  await mkdir(evidenceRoot, { recursive: true })
  const installations = Object.freeze({
    codex: version('codex'),
    claude: version('claude'),
    opencode: version('opencode'),
  })
  const config = configured()
  const endpoint = await health()
  const clients = Object.freeze({
    codex: Object.freeze({ installed: installations.codex !== null, version: installations.codex, configured: config.codex }),
    claude: Object.freeze({ installed: installations.claude !== null, version: installations.claude, configured: config.claude }),
    opencode: Object.freeze({ installed: installations.opencode !== null, version: installations.opencode, configured: config.opencode }),
  })
  const readyForUserValidation = endpoint.connected && Object.values(clients).every((client) => client.installed && client.configured)
  const report = Object.freeze({
    schemaVersion: 'sanverse.external-mcp-interop-report/v2',
    generatedAt: new Date().toISOString(),
    endpoint,
    clients,
    readyForUserValidation,
    modelOrProviderCallsRun: false,
    security: Object.freeze({ acceptedProjectWritesExposed: false, ownerApprovalHostOnly: true, credentialsIncluded: false }),
  })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (!readyForUserValidation) process.exitCode = 1
}

await main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
