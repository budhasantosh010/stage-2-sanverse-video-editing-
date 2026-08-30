import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { applyEdits, modify } from 'jsonc-parser'
import { SANVERSE_MCP_TOKEN_ENV, SANVERSE_ROOT } from './sanverse-mcp-shared.ts'

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
const launcherPath = resolve(SANVERSE_ROOT, 'scripts', 'sanverse-mcp-stdio.mjs')
const launcherCommand = process.execPath
const launcherArgs = Object.freeze([launcherPath])

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

const clearLegacyUserTokenEnv = () => {
  if (process.platform !== 'win32') {
    delete process.env[SANVERSE_MCP_TOKEN_ENV]
    return
  }
  const expression = `[Environment]::SetEnvironmentVariable('${SANVERSE_MCP_TOKEN_ENV}',$null,'User')`
  exec('powershell.exe', ['-NoProfile', '-Command', expression], { allowFailure: true })
  delete process.env[SANVERSE_MCP_TOKEN_ENV]
}

const removeOpenCodeEntry = async () => {
  if (!(await exists(configPaths.opencode))) return
  const raw = await readFile(configPaths.opencode, 'utf8')
  const edits = modify(raw, ['mcp', 'sanverse'], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' } })
  if (edits.length === 0) return
  await writeFile(configPaths.opencode, applyEdits(raw, edits), 'utf8')
}

const writeOpenCodeEntry = async () => {
  const raw = await exists(configPaths.opencode) ? await readFile(configPaths.opencode, 'utf8') : '{}\n'
  const entry = Object.freeze({
    type: 'local',
    command: Object.freeze([launcherCommand, ...launcherArgs]),
    enabled: true,
    timeout: 60_000,
  })
  const edits = modify(raw, ['mcp', 'sanverse'], entry, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' } })
  await mkdir(dirname(configPaths.opencode), { recursive: true })
  await writeFile(configPaths.opencode, applyEdits(raw, edits), 'utf8')
}

const removeClientEntries = async () => {
  if (detected('codex')) exec('codex', ['mcp', 'remove', 'sanverse'], { allowFailure: true })
  if (detected('claude')) {
    for (const scope of ['local', 'user', 'project']) exec('claude', ['mcp', 'remove', 'sanverse', '--scope', scope], { allowFailure: true })
  }
  await removeOpenCodeEntry()
}

const printPlan = () => {
  console.log('SANVERSE ZERO-SETUP LOCAL MCP — DRY RUN')
  console.log(`Launcher        ${launcherCommand} ${launcherPath}`)
  console.log('Transport       local STDIO (default for Codex, Claude Code, OpenCode)')
  console.log('Runtime         launcher auto-starts/reuses Sanverse API + web renderer')
  console.log('Credential      none for local STDIO')
  console.log('')
  console.log(`Codex           ${versionOf('codex')}`)
  console.log(`Claude Code     ${versionOf('claude')}`)
  console.log(`OpenCode        ${versionOf('opencode')}`)
  console.log('')
  console.log('Will configure only the MCP entry named "sanverse" for local STDIO.')
  console.log('No bearer token, user environment variable, model/provider, permission, or unrelated MCP setting will be added.')
  console.log('HTTP remains available as an explicit debugging/future-remote transport, but is not configured as the local-agent default.')
  console.log('Run with --apply to perform these changes, or --remove to remove only Sanverse connectivity.')
}

const applySetup = async () => {
  for (const client of ['codex', 'claude', 'opencode']) if (!detected(client)) throw new Error(`${client} is not installed; setup stopped before changing any client config.`)
  if (!(await exists(launcherPath))) throw new Error(`Sanverse STDIO launcher is missing at ${launcherPath}.`)
  const backup = await backupConfigs()
  try {
    await removeClientEntries()
    clearLegacyUserTokenEnv()
    exec('codex', ['mcp', 'add', 'sanverse', '--', launcherCommand, ...launcherArgs])
    exec('claude', ['mcp', 'add', '--transport', 'stdio', '--scope', 'user', 'sanverse', '--', launcherCommand, ...launcherArgs])
    await writeOpenCodeEntry()
    await mkdir(dirname(statePath), { recursive: true })
    await writeFile(statePath, `${JSON.stringify({
      schemaVersion: 'sanverse.mcp-client-setup/v2',
      configuredAt: new Date().toISOString(),
      transport: 'stdio',
      launcher: { command: launcherCommand, args: launcherArgs },
      runtime: 'auto-start-or-reuse-api-and-web',
      credentials: 'none-for-local-stdio',
      backupDir: backup.dir,
      clients: ['codex', 'claude', 'opencode'],
    }, null, 2)}\n`, 'utf8')
    console.log('SANVERSE ZERO-SETUP LOCAL MCP APPLIED')
    console.log(`Backups         ${backup.dir}`)
    console.log('Codex           local STDIO configured')
    console.log('Claude Code     user-scope local STDIO configured')
    console.log('OpenCode        local STDIO configured')
    console.log('Legacy Sanverse bearer-token environment variable removed.')
    console.log('No model/provider settings were modified. No manual Sanverse server terminal is required.')
  } catch (error) {
    for (const [name, backupPath] of Object.entries(backup.saved)) {
      const target = configPaths[name as keyof typeof configPaths]
      await mkdir(dirname(target), { recursive: true }).catch(() => undefined)
      await copyFile(backupPath, target).catch(() => undefined)
    }
    throw error
  }
}

const removeSetup = async () => {
  const backup = await backupConfigs()
  await removeClientEntries()
  clearLegacyUserTokenEnv()
  await rm(statePath, { force: true })
  console.log('SANVERSE MCP SETUP REMOVED')
  console.log(`Pre-remove backup ${backup.dir}`)
  console.log('Only the MCP entry named "sanverse" and the legacy Sanverse token environment variable were removed.')
}

if (!apply && !remove) printPlan()
else if (apply) await applySetup()
else await removeSetup()
