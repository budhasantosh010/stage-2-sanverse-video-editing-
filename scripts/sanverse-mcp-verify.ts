import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SANVERSE_API_URL, SANVERSE_MCP_TOKEN_ENV, SANVERSE_ROOT, apiReady } from './sanverse-mcp-shared.ts'

const evidenceRoot = resolve(SANVERSE_ROOT, 'DOCS/evidence/2026-08-30-zero-setup-local-mcp-v1')
const reportPath = resolve(evidenceRoot, 'zero-setup-report.json')
const workspaceEvidenceRoot = resolve(SANVERSE_ROOT, 'DOCS/evidence/2026-08-30-zero-setup-workspace-import-v1')
const workspaceReportPath = resolve(workspaceEvidenceRoot, 'workspace-import-report.json')
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
  const requiredWorkspaceTools = Object.freeze(['source.list_workspace_inputs', 'production.import_source_video', 'source.attach_transcript', 'source.analyze_video'])
  const workspaceWorkflow = (clientName: string) => {
    const matching = events.filter((event) => event.clientName === clientName && typeof event.sessionLabel === 'string')
    const sessions = new Map<string, Record<string, unknown>[]>()
    for (const event of matching) {
      const key = String(event.sessionLabel)
      const bucket = sessions.get(key) ?? []
      bucket.push(event)
      sessions.set(key, bucket)
    }
    for (const [sessionLabel, sessionEvents] of [...sessions.entries()].reverse()) {
      if (!requiredWorkspaceTools.every((toolName) => sessionEvents.some((event) => event.toolName === toolName && event.ok === true))) continue
      const first = sessionEvents.find((event) => event.toolName === 'source.list_workspace_inputs')
      return Object.freeze({
        sessionLabel,
        clientName,
        clientVersion: String(first?.clientVersion ?? ''),
        tools: requiredWorkspaceTools,
        ok: true,
        at: String(first?.at ?? ''),
      })
    }
    return null
  }
  return Object.freeze({
    codex: safe(find('codex-mcp-client')),
    opencode: safe(find('opencode')),
    workspaceWorkflow: Object.freeze({ codex: workspaceWorkflow('codex-mcp-client'), opencode: workspaceWorkflow('opencode') }),
  })
}

const probeWorkspace = async (workspace: string, clientName: string) => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [launcherPath], cwd: workspace, stderr: 'pipe' })
  let stderr = ''
  transport.stderr?.on('data', (chunk) => { stderr += String(chunk) })
  const client = new Client({ name: clientName, version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)
  try {
    const tools = await client.listTools()
    const projectsResult = await client.callTool({ name: 'production.list_projects', arguments: {} })
    const structured = 'structuredContent' in projectsResult && projectsResult.structuredContent && typeof projectsResult.structuredContent === 'object'
      ? projectsResult.structuredContent as Record<string, unknown>
      : null
    const value = structured?.ok === true && structured.value && typeof structured.value === 'object' ? structured.value as Record<string, unknown> : null
    const projects = Array.isArray(value?.projects) ? value.projects : []
    const workspaceResult = await client.callTool({ name: 'source.list_workspace_inputs', arguments: {} })
    const workspaceStructured = 'structuredContent' in workspaceResult && workspaceResult.structuredContent && typeof workspaceResult.structuredContent === 'object'
      ? workspaceResult.structuredContent as Record<string, unknown>
      : null
    const workspaceValue = workspaceStructured?.ok === true && workspaceStructured.value && typeof workspaceStructured.value === 'object'
      ? workspaceStructured.value as Record<string, unknown>
      : null
    const files = Array.isArray(workspaceValue?.files) ? workspaceValue.files as Record<string, unknown>[] : []
    return Object.freeze({
      toolCount: tools.tools.length,
      projectCount: projects.length,
      relativePaths: Object.freeze(files.map((file) => String(file.relativePath ?? ''))),
      absolutePathLeaked: JSON.stringify(workspaceStructured).includes(workspace),
      stderrClean: !/exception|fatal/i.test(stderr),
    })
  } finally {
    await transport.close()
  }
}

const directStdioProbe = async () => {
  const root = resolve(SANVERSE_ROOT, '.sanverse-data', 'mcp')
  const workspaceA = resolve(root, 'zero setup verifier workspace A')
  const workspaceB = resolve(root, 'zero setup verifier workspace B')
  await Promise.all([mkdir(workspaceA, { recursive: true }), mkdir(workspaceB, { recursive: true })])
  await Promise.all([
    writeFile(resolve(workspaceA, 'alpha.srt'), '1\n00:00:00,000 --> 00:00:01,000\nWorkspace alpha.\n', 'utf8'),
    writeFile(resolve(workspaceB, 'beta.srt'), '1\n00:00:00,000 --> 00:00:01,000\nWorkspace beta.\n', 'utf8'),
  ])
  const [a, b] = await Promise.all([
    probeWorkspace(workspaceA, 'sanverse-zero-setup-verifier-a'),
    probeWorkspace(workspaceB, 'sanverse-zero-setup-verifier-b'),
  ])
  const workspaceInputDiscovered = a.relativePaths.includes('alpha.srt') && b.relativePaths.includes('beta.srt')
  const workspaceIsolation = !a.relativePaths.includes('beta.srt') && !b.relativePaths.includes('alpha.srt')
  return Object.freeze({
    toolCount: a.toolCount,
    projectCount: a.projectCount,
    workspaceInputDiscovered,
    workspaceIsolation,
    absolutePathLeaked: a.absolutePathLeaked || b.absolutePathLeaked,
    stderrClean: a.stderrClean && b.stderrClean,
  })
}

const main = async () => {
  await Promise.all([mkdir(evidenceRoot, { recursive: true }), mkdir(workspaceEvidenceRoot, { recursive: true })])
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
  const workspaceWorkflowComplete = clientProof.workspaceWorkflow.codex?.ok === true && clientProof.workspaceWorkflow.opencode?.ok === true
  const readyForUserValidation = stdio.toolCount === 53 && stdio.workspaceInputDiscovered && stdio.workspaceIsolation && !stdio.absolutePathLeaked && runtime.apiReady && runtime.webReady && !legacyUserTokenEnvironmentPresent && realClientProofComplete && workspaceWorkflowComplete && Object.values(clients).every((client) => client.installed && client.configuredForLocalStdio)
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
  const workspaceReport = Object.freeze({
    schemaVersion: 'sanverse.zero-setup-workspace-import-report/v1',
    generatedAt: report.generatedAt,
    toolCount: stdio.toolCount,
    workspaceInputDiscovered: stdio.workspaceInputDiscovered,
    workspaceIsolation: stdio.workspaceIsolation,
    absolutePathLeaked: stdio.absolutePathLeaked,
    codexWorkflow: clientProof.workspaceWorkflow.codex,
    opencodeWorkflow: clientProof.workspaceWorkflow.opencode,
    claudeStdioConfigured: clients.claude.configuredForLocalStdio,
    httpImplicitWorkspaceGrant: false,
    localStdioBearerTokenRequired: false,
    ready: readyForUserValidation,
  })
  await Promise.all([
    writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(workspaceReportPath, `${JSON.stringify(workspaceReport, null, 2)}\n`, 'utf8'),
  ])
  console.log(JSON.stringify(report, null, 2))
  if (!readyForUserValidation) process.exitCode = 1
}

await main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
