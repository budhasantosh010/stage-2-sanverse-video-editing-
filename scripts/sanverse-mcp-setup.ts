import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { applyEdits, modify } from 'jsonc-parser'
import {
  SANVERSE_MCP_ENDPOINT,
  SANVERSE_MCP_TOKEN_ENV,
  SANVERSE_MCP_TOKEN_PATH,
  SANVERSE_ROOT,
  ensureLocalMcpToken,
} from './sanverse-mcp-shared.ts'

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const remove = args.has('--remove')
if (apply && remove) throw new Error('Choose either --apply or --remove, not both.')

const home = process.env.USERPROFILE ?? process.env.HOME ?? ''
const configPaths = Object.freeze({
  codex: join(home, '.codex', 'config.toml'),
  claude: join(home, '.claude.json'),
  opencode: join(home, '.config', 'opencode', 'opencode.jsonc'),
})
const statePath = join(SANVERSE_ROOT, '.sanverse-data', 'mcp', 'setup-state.json')

interface ExecResult { readonly status: number; readonly stdout: string; readonly stderr: string }
const resolveWindowsShim = (command: string): string | null => {
  const result = spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true })
  if ((result.status ?? 1) !== 0) return null
  return (result.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).find((line) => /\.(cmd|bat)$/i.test(line)) ?? null
}
const exec = (command: string, commandArgs: readonly string[], options: { allowFailure?: boolean; env?: NodeJS.ProcessEnv } = {}): ExecResult => {
  const env = options.env ?? process.env
  const shim = process.platform === 'win32' ? resolveWindowsShim(command) : null
  const result = shim
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', shim, ...commandArgs], { cwd: SANVERSE_ROOT, encoding: 'utf8', shell: false, windowsHide: true, env })
    : spawnSync(command, [...commandArgs], { cwd: SANVERSE_ROOT, encoding: 'utf8', shell: false, windowsHide: true, env })
  const status = result.status ?? (result.error ? 1 : 0)
  if (status !== 0 && !options.allowFailure) throw new Error(`${command} ${commandArgs.join(' ')} failed: ${(result.stderr || result.stdout || result.error?.message || '').trim()}`)
  return Object.freeze({ status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' })
}

const detected = (name: string) => process.platform === 'win32'
  ? exec('where.exe', [name], { allowFailure: true }).status === 0
  : exec('which', [name], { allowFailure: true }).status === 0
const versionOf = (name: string) => detected(name) ? exec(name, ['--version'], { allowFailure: true }).stdout.trim() || 'installed' : 'not installed'

const exists = async (path: string) => { try { return (await stat(path)).isFile() } catch { return false } }
const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')

const backupConfigs = async () => {
  const dir = join(SANVERSE_ROOT, '.sanverse-data', 'mcp', 'config-backups', timestamp())
  await mkdir(dir, { recursive: true })
  const saved: Record<string, string> = {}
  for (const [name, path] of Object.entries(configPaths)) {
    if (!(await exists(path))) continue
    const destination = join(dir, `${name}-${basename(path)}`)
    await copyFile(path, destination)
    saved[name] = destination
  }
  return Object.freeze({ dir, saved: Object.freeze(saved) })
}

const getUserTokenEnv = (): string | null => {
  if (process.platform !== 'win32') return process.env[SANVERSE_MCP_TOKEN_ENV] ?? null
  const script = `[Environment]::GetEnvironmentVariable('${SANVERSE_MCP_TOKEN_ENV}','User')`
  const result = exec('powershell.exe', ['-NoProfile', '-Command', script], { allowFailure: true })
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null
}

const setUserTokenEnv = (value: string | null) => {
  if (process.platform !== 'win32') {
    if (value === null) delete process.env[SANVERSE_MCP_TOKEN_ENV]
    else process.env[SANVERSE_MCP_TOKEN_ENV] = value
    return
  }
  const escaped = value?.replace(/'/g, "''")
  const expression = value === null
    ? `[Environment]::SetEnvironmentVariable('${SANVERSE_MCP_TOKEN_ENV}',$null,'User')`
    : `[Environment]::SetEnvironmentVariable('${SANVERSE_MCP_TOKEN_ENV}','${escaped}','User')`
  exec('powershell.exe', ['-NoProfile', '-Command', expression])
  if (value === null) delete process.env[SANVERSE_MCP_TOKEN_ENV]
  else process.env[SANVERSE_MCP_TOKEN_ENV] = value
}

const removeOpenCodeEntry = async () => {
  if (!(await exists(configPaths.opencode))) return
  const raw = await readFile(configPaths.opencode, 'utf8')
  const edits = modify(raw, ['mcp', 'sanverse'], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' } })
  if (edits.length === 0) return
  await writeFile(configPaths.opencode, applyEdits(raw, edits), 'utf8')
}

const removeClientEntries = async () => {
  if (detected('codex')) exec('codex', ['mcp', 'remove', 'sanverse'], { allowFailure: true })
  if (detected('claude')) exec('claude', ['mcp', 'remove', 'sanverse', '--scope', 'local'], { allowFailure: true })
  await removeOpenCodeEntry()
}

const printPlan = () => {
  console.log('SANVERSE MCP SETUP — DRY RUN')
  console.log(`Endpoint        ${SANVERSE_MCP_ENDPOINT}`)
  console.log(`Credential      ${SANVERSE_MCP_TOKEN_PATH} (local/ignored; value is never printed)`)
  console.log('')
  console.log(`Codex           ${versionOf('codex')}`)
  console.log(`Claude Code     ${versionOf('claude')}`)
  console.log(`OpenCode        ${versionOf('opencode')}`)
  console.log('')
  console.log('Will configure only the MCP entry named "sanverse":')
  console.log('Codex           Streamable HTTP, user-private config, bearer token from SANVERSE_MCP_TOKEN')
  console.log('Claude Code     Streamable HTTP, local scope, Authorization header in private local config')
  console.log('OpenCode        Remote Streamable HTTP using the installed 1.x `mcp` config generation')
  console.log('No model/provider/permission/other-MCP setting will be changed.')
  console.log('Run with --apply to perform these changes, or --remove to remove only Sanverse connectivity.')
}

const applySetup = async () => {
  for (const client of ['codex', 'claude', 'opencode']) if (!detected(client)) throw new Error(`${client} is not installed; setup stopped before changing any client config.`)
  const token = await ensureLocalMcpToken()
  const previousUserToken = getUserTokenEnv()
  const backup = await backupConfigs()
  try {
    await removeClientEntries()
    setUserTokenEnv(token)
    const env = { ...process.env, [SANVERSE_MCP_TOKEN_ENV]: token }
    exec('codex', ['mcp', 'add', 'sanverse', '--url', SANVERSE_MCP_ENDPOINT, '--bearer-token-env-var', SANVERSE_MCP_TOKEN_ENV], { env })
    exec('claude', ['mcp', 'add', '--transport', 'http', '--scope', 'local', 'sanverse', SANVERSE_MCP_ENDPOINT, '--header', `Authorization: Bearer ${token}`], { env })
    exec('opencode', ['mcp', 'add', 'sanverse', '--url', SANVERSE_MCP_ENDPOINT, '--header', `Authorization=Bearer ${token}`], { env })
    await mkdir(dirname(statePath), { recursive: true })
    await writeFile(statePath, `${JSON.stringify({ schemaVersion: 'sanverse.mcp-client-setup/v1', configuredAt: new Date().toISOString(), endpoint: SANVERSE_MCP_ENDPOINT, backupDir: backup.dir, clients: ['codex', 'claude', 'opencode'] }, null, 2)}\n`, 'utf8')
    console.log('SANVERSE MCP SETUP APPLIED')
    console.log(`Backups         ${backup.dir}`)
    console.log('Codex           configured')
    console.log('Claude Code     configured (local scope)')
    console.log('OpenCode        configured')
    console.log('No model/provider settings were modified.')
  } catch (error) {
    for (const [name, backupPath] of Object.entries(backup.saved)) {
      const target = configPaths[name as keyof typeof configPaths]
      await copyFile(backupPath, target).catch(() => undefined)
    }
    setUserTokenEnv(previousUserToken)
    throw error
  }
}

const removeSetup = async () => {
  const backup = await backupConfigs()
  await removeClientEntries()
  const token = await ensureLocalMcpToken().catch(() => null)
  const currentUserToken = getUserTokenEnv()
  if (token && currentUserToken === token) setUserTokenEnv(null)
  await rm(statePath, { force: true })
  console.log('SANVERSE MCP SETUP REMOVED')
  console.log(`Pre-remove backup ${backup.dir}`)
  console.log('Only the MCP entry named "sanverse" and its matching user token environment variable were removed.')
}

if (!apply && !remove) printPlan()
else if (apply) await applySetup()
else await removeSetup()
