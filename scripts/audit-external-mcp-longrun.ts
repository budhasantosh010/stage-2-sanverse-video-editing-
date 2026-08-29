import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { serializeProject } from '@sanverse/edit-domain'
import {
  SANVERSE_API_URL,
  SANVERSE_MCP_ENDPOINT,
  SANVERSE_MCP_HEALTH,
  SANVERSE_ROOT,
  apiReady,
  readLocalMcpToken,
  readProductionProject,
} from './sanverse-mcp-shared.ts'

const cycles = Number(process.env.SANVERSE_MCP_LONGRUN_CYCLES ?? 50)
if (!Number.isSafeInteger(cycles) || cycles < 1 || cycles > 500) throw new Error('SANVERSE_MCP_LONGRUN_CYCLES must be an integer from 1 through 500.')

const evidenceRoot = resolve(SANVERSE_ROOT, 'DOCS/evidence/2026-08-29-external-mcp-interop-v1')
const tempRoot = resolve(SANVERSE_ROOT, 'tmp/external-mcp-longrun-v1')
const sourceFile = resolve(tempRoot, 'longrun-source.mp4')
const reportPath = resolve(evidenceRoot, 'longrun-report.json')

const ffmpeg = (args: readonly string[]) => spawnSync('ffmpeg', [...args], {
  cwd: SANVERSE_ROOT,
  encoding: 'utf8',
  windowsHide: true,
  timeout: 60_000,
})

const structured = (result: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> => {
  if ('structuredContent' in result && result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent as Record<string, unknown>
  throw new Error('Sanverse MCP tool response did not contain structuredContent.')
}

const okValue = (result: Awaited<ReturnType<Client['callTool']>>, label: string): Record<string, unknown> => {
  const payload = structured(result)
  if (payload.ok !== true || !payload.value || typeof payload.value !== 'object') throw new Error(`${label} refused or returned an invalid payload: ${JSON.stringify(payload)}`)
  return payload.value as Record<string, unknown>
}

const health = async (): Promise<Record<string, unknown>> => {
  const response = await fetch(SANVERSE_MCP_HEALTH, { signal: AbortSignal.timeout(2500) })
  if (!response.ok) throw new Error(`MCP health failed with ${response.status}.`)
  return await response.json() as Record<string, unknown>
}

const createSyntheticProject = async () => {
  if (!(await apiReady())) throw new Error(`Sanverse API is unavailable at ${SANVERSE_API_URL}. Start npm run sanverse:mcp:dev first.`)
  await rm(tempRoot, { recursive: true, force: true })
  await mkdir(tempRoot, { recursive: true })
  const generated = ffmpeg([
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=4',
    '-f', 'lavfi', '-i', 'sine=frequency=260:sample_rate=48000:duration=4',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast',
    '-c:a', 'aac', '-b:a', '96k', '-shortest', sourceFile,
  ])
  if (generated.status !== 0) throw new Error(`Could not create synthetic long-run media: ${generated.stderr}`)
  const bytes = await readFile(sourceFile)
  const response = await fetch(`${SANVERSE_API_URL}/api/projects`, {
    method: 'POST',
    headers: { 'X-Sanverse-Filename': encodeURIComponent('external-mcp-longrun-v1.mp4'), 'Content-Type': 'video/mp4' },
    body: bytes,
  })
  if (!response.ok) throw new Error(`Long-run project intake failed: ${response.status} ${await response.text()}`)
  const created = await response.json() as { id: string }
  const project = await readProductionProject(created.id)
  const serialized = serializeProject(project)
  if (!serialized.ok) throw new Error('Could not serialize long-run project baseline.')
  return Object.freeze({ projectId: created.id, revision: project.revision, serialized: serialized.value })
}

const main = async () => {
  await mkdir(evidenceRoot, { recursive: true })
  const token = await readLocalMcpToken()
  const beforeHealth = await health()
  const project = await createSyntheticProject()
  const started = Date.now()
  let calls = 0
  let reviews = 0

  for (let index = 0; index < cycles; index += 1) {
    const transport = new StreamableHTTPClientTransport(new URL(SANVERSE_MCP_ENDPOINT), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    })
    const client = new Client({ name: 'sanverse-longrun-audit', version: '1.0.0' }, { capabilities: {} })
    await client.connect(transport)
    try {
      const initial = okValue(await client.callTool({ name: 'production.get_creative_context', arguments: {} }), 'initial context'); calls += 1
      const revision = Number(initial.productionRevision)
      if (revision !== project.revision) throw new Error(`Cycle ${index}: expected production revision ${project.revision}, got ${revision}.`)

      const created = okValue(await client.callTool({
        name: 'production.create_creative_sandbox',
        arguments: { _sanverse: { productionRevision: revision } },
      }), 'create sandbox'); calls += 1
      const sandboxId = String(created.sandboxId ?? '')
      if (!sandboxId) throw new Error(`Cycle ${index}: sandbox id missing.`)

      const opacity = index % 2 === 0 ? 0.64 : 0.76
      okValue(await client.callTool({
        name: 'production.set_sandbox_selected_opacity',
        arguments: { opacity, _sanverse: { sandboxId, productionRevision: revision } },
      }), 'set opacity'); calls += 1

      const reviewed = okValue(await client.callTool({
        name: 'production.get_sandbox_review',
        arguments: { _sanverse: { sandboxId } },
      }), 'sandbox review'); calls += 1
      const selectedNode = reviewed.selectedNode && typeof reviewed.selectedNode === 'object' ? reviewed.selectedNode as Record<string, unknown> : null
      if (!selectedNode || Number(selectedNode.opacity) !== opacity || typeof reviewed.reviewRef !== 'string') throw new Error(`Cycle ${index}: review did not prove opacity ${opacity}.`)
      reviews += 1

      okValue(await client.callTool({
        name: 'discard_sandbox',
        arguments: { _sanverse: { sandboxId, productionRevision: revision } },
      }), 'discard sandbox'); calls += 1

      const final = okValue(await client.callTool({ name: 'production.get_creative_context', arguments: {} }), 'final context'); calls += 1
      if (Number(final.productionRevision) !== revision) throw new Error(`Cycle ${index}: production revision changed during sandbox-only run.`)
    } finally {
      await transport.terminateSession().catch(() => undefined)
      await transport.close().catch(() => undefined)
    }
  }

  const afterProject = await readProductionProject(project.projectId)
  const afterSerialized = serializeProject(afterProject)
  if (!afterSerialized.ok) throw new Error('Could not serialize long-run project after audit.')
  const afterHealth = await health()
  const masterUnchanged = afterProject.revision === project.revision && afterSerialized.value === project.serialized
  const activeSessions = Number(afterHealth.activeSessions)
  if (!masterUnchanged) throw new Error('Long-run audit changed accepted production project state.')
  if (activeSessions !== 0) throw new Error(`Long-run audit leaked MCP sessions: ${activeSessions} remain active.`)

  const report = Object.freeze({
    schemaVersion: 'sanverse.external-mcp-longrun/v1',
    generatedAt: new Date().toISOString(),
    cycles,
    calls,
    reviews,
    elapsedMs: Date.now() - started,
    projectId: project.projectId,
    baselineRevision: project.revision,
    masterUnchanged,
    activeSessionsAfter: activeSessions,
    healthBefore: beforeHealth,
    healthAfter: afterHealth,
    rawVideoBenchmarkRun: false,
  })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
}

await main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
