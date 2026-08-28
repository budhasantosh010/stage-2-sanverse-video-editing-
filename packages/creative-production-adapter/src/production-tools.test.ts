import { describe, expect, it } from 'vitest'
import { testProject } from '@sanverse/edit-domain/test-fixtures'
import {
  createSanverseMcpServerV1,
  MCP_PROTOCOL_VERSION_META_KEY,
  MCP_PROTOCOL_VERSION_V1,
  SANVERSE_REVISION_META_KEY,
  SANVERSE_SANDBOX_META_KEY,
  type McpJsonRpcResponseV1,
} from '@sanverse/motion-mcp'
import { buildKineticHeadlineCandidateV16 } from './production-adapter.ts'
import { createCreativeProductionToolRegistryV16, CREATIVE_PRODUCTION_CONTEXT_TOOL_V16 } from './production-tools.ts'
import { createCreativeProductionWorkflowV16 } from './workflow.ts'

const resultOf = (response: McpJsonRpcResponseV1): Record<string, unknown> => 'result' in response && response.result && typeof response.result === 'object'
  ? response.result as Record<string, unknown>
  : {}
const structured = (response: McpJsonRpcResponseV1): Record<string, unknown> => {
  const result = resultOf(response)
  return result.structuredContent && typeof result.structuredContent === 'object'
    ? result.structuredContent as Record<string, unknown>
    : result
}
const meta = (extra: Record<string, unknown> = {}) => Object.freeze({
  [MCP_PROTOCOL_VERSION_META_KEY]: MCP_PROTOCOL_VERSION_V1,
  ...extra,
})

const fixture = () => {
  const project = testProject()
  const built = buildKineticHeadlineCandidateV16({ project, compositionTicks: 1_440_000, headline: 'MCP same project' })
  if (!built.ok) throw new Error(built.refusal.message)
  const workflow = createCreativeProductionWorkflowV16(built.value)
  const initialized = workflow.initialize()
  if (!initialized.ok) throw new Error(initialized.message)
  return { project, candidate: built.value, workflow }
}

describe('V1.6 production-backed MCP tool registry', () => {
  it('exposes the same UI workflow/project context and omits isolated apply/undo history tools', async () => {
    const { project, candidate, workflow } = fixture()
    let liveProject = project
    const registry = createCreativeProductionToolRegistryV16({ workflow, candidate, readProject: () => liveProject })
    const server = createSanverseMcpServerV1(registry)

    const list = await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: meta() } })
    const tools = Array.isArray(resultOf(list).tools) ? resultOf(list).tools as Array<Record<string, unknown>> : []
    const names = tools.map((tool) => String(tool.name))
    expect(names).toContain('get_project_context')
    expect(names).toContain(CREATIVE_PRODUCTION_CONTEXT_TOOL_V16)
    expect(names).toContain('motion.apply-plan-atomic-v15')
    expect(names).not.toContain('apply_approved_sandbox')
    expect(names).not.toContain('undo_last_creative_merge')

    const engineContext = await server.handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_project_context', arguments: {}, _meta: meta() } })
    expect(structured(engineContext)).toMatchObject({ ok: true, value: { acceptedProject: { id: project.projectId, revision: project.revision } } })

    const productionContext = await server.handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: CREATIVE_PRODUCTION_CONTEXT_TOOL_V16, arguments: {}, _meta: meta() } })
    expect(structured(productionContext)).toMatchObject({
      ok: true,
      value: {
        projectId: project.projectId,
        productionRevision: project.revision,
        candidateId: candidate.id,
        candidateBaseRevision: project.revision,
        stale: false,
        stages: { storyboard: 'draft' },
      },
    })

    expect(workflow.approve('storyboard', '2026-08-28T14:00:00.000Z')).toMatchObject({ ok: true })
    const afterUiApproval = await server.handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: CREATIVE_PRODUCTION_CONTEXT_TOOL_V16, arguments: {}, _meta: meta() } })
    expect(structured(afterUiApproval)).toMatchObject({ ok: true, value: { stages: { storyboard: 'owner-approved' } } })

    liveProject = Object.freeze({ ...project, revision: project.revision + 1 })
    const staleContext = await server.handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: CREATIVE_PRODUCTION_CONTEXT_TOOL_V16, arguments: {}, _meta: meta() } })
    expect(structured(staleContext)).toMatchObject({ ok: true, value: { productionRevision: project.revision + 1, stale: true } })
  })

  it('requires the live production revision on every mutating MCP tool and rejects stale project edits before touching the sandbox', async () => {
    const { project, candidate, workflow } = fixture()
    let liveProject = project
    const server = createSanverseMcpServerV1(createCreativeProductionToolRegistryV16({ workflow, candidate, readProject: () => liveProject }))
    const sandboxId = `sandbox:${candidate.id}`

    const missingRevision = await server.handle({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'discard_sandbox', arguments: {}, _meta: meta({ [SANVERSE_SANDBOX_META_KEY]: sandboxId }) },
    })
    expect(structured(missingRevision)).toMatchObject({ ok: false, refusal: { code: 'PRODUCTION_REVISION_CONTEXT_REQUIRED' } })
    expect(workflow.state().storyboardSandbox?.id).toBe(sandboxId)

    liveProject = Object.freeze({ ...project, revision: project.revision + 1 })
    const stale = await server.handle({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'discard_sandbox', arguments: {}, _meta: meta({ [SANVERSE_SANDBOX_META_KEY]: sandboxId, [SANVERSE_REVISION_META_KEY]: project.revision }) },
    })
    expect(structured(stale)).toMatchObject({ ok: false, refusal: { code: 'STALE_PRODUCTION_REVISION' } })
    expect(workflow.state().storyboardSandbox?.id).toBe(sandboxId)
  })
})