import { resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { serializeProject } from '@sanverse/edit-domain'
import {
  SANVERSE_ROOT,
  apiReady,
  readProductionProject,
  resolveProductionProjectId,
} from './sanverse-mcp-shared.ts'

const evidencePath = resolve(SANVERSE_ROOT, 'DOCS/evidence/2026-08-30-external-mcp-raw-video-v1/stdio-report.json')

const structured = (result: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> => {
  if ('structuredContent' in result && result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent as Record<string, unknown>
  throw new Error('STDIO tool response did not contain structuredContent.')
}
const valueOf = (result: Awaited<ReturnType<Client['callTool']>>, label: string): Record<string, unknown> => {
  const payload = structured(result)
  if (payload.ok !== true || !payload.value || typeof payload.value !== 'object') throw new Error(`${label} refused: ${JSON.stringify(payload)}`)
  return payload.value as Record<string, unknown>
}

const main = async () => {
  if (!(await apiReady())) throw new Error('Sanverse production API must be running before the STDIO audit.')
  const projectId = await resolveProductionProjectId()
  const before = await readProductionProject(projectId)
  const beforeSerialized = serializeProject(before)
  if (!beforeSerialized.ok) throw new Error('Could not serialize STDIO audit baseline project.')

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(SANVERSE_ROOT, 'scripts/sanverse-mcp-stdio.mjs')],
    cwd: SANVERSE_ROOT,
    stderr: 'pipe',
  })
  let stderr = ''
  transport.stderr?.on('data', (chunk) => { stderr += String(chunk) })
  const client = new Client({ name: 'sanverse-stdio-audit', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)
  try {
    const listed = await client.listTools()
    if (listed.tools.length !== 52) throw new Error(`Expected stable 52-tool raw-video + legacy surface over STDIO; found ${listed.tools.length}.`)
    valueOf(await client.callTool({ name: 'production.select_project', arguments: { projectId } }), 'select project')
    const selectedList = await client.listTools()
    if (selectedList.tools.length !== 52) throw new Error(`Selecting a project changed STDIO tool discovery from 52 to ${selectedList.tools.length}.`)
    const initial = valueOf(await client.callTool({ name: 'production.get_creative_context', arguments: {} }), 'initial context')
    const revision = Number(initial.productionRevision)
    const created = valueOf(await client.callTool({
      name: 'production.create_creative_sandbox',
      arguments: { _sanverse: { productionRevision: revision } },
    }), 'create sandbox')
    const sandboxId = String(created.sandboxId ?? '')
    if (!sandboxId) throw new Error('STDIO sandbox id missing.')
    valueOf(await client.callTool({
      name: 'production.set_sandbox_selected_opacity',
      arguments: { opacity: 0.68, _sanverse: { sandboxId, productionRevision: revision } },
    }), 'set sandbox opacity')
    const review = valueOf(await client.callTool({
      name: 'production.get_sandbox_review',
      arguments: { _sanverse: { sandboxId } },
    }), 'sandbox review')
    const selectedNode = review.selectedNode && typeof review.selectedNode === 'object' ? review.selectedNode as Record<string, unknown> : null
    if (!selectedNode || Number(selectedNode.opacity) !== 0.68 || typeof review.reviewRef !== 'string') throw new Error('STDIO review did not prove the sandbox opacity edit.')
    valueOf(await client.callTool({
      name: 'discard_sandbox',
      arguments: { _sanverse: { sandboxId, productionRevision: revision } },
    }), 'discard sandbox')
    const final = valueOf(await client.callTool({ name: 'production.get_creative_context', arguments: {} }), 'final context')
    if (Number(final.productionRevision) !== revision) throw new Error('STDIO sandbox cycle changed production revision.')

    const after = await readProductionProject(projectId)
    const afterSerialized = serializeProject(after)
    if (!afterSerialized.ok) throw new Error('Could not serialize STDIO audit project after run.')
    const masterUnchanged = after.revision === before.revision && afterSerialized.value === beforeSerialized.value
    if (!masterUnchanged) throw new Error('STDIO audit changed accepted production project state.')

    const report = Object.freeze({
      schemaVersion: 'sanverse.external-mcp-stdio-audit/v1',
      generatedAt: new Date().toISOString(),
      serverVersion: client.getServerVersion(),
      toolCount: listed.tools.length,
      projectId,
      baselineRevision: before.revision,
      reviewRef: String(review.reviewRef),
      masterUnchanged,
      stderrClean: !/error|exception|failed/i.test(stderr),
    })
    const { mkdir, writeFile } = await import('node:fs/promises')
    await mkdir(resolve(SANVERSE_ROOT, 'DOCS/evidence/2026-08-29-external-mcp-interop-v1'), { recursive: true })
    await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await transport.close()
  }
}

await main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
