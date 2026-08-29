import { describe, expect, it } from 'vitest'
import { testProject } from '@sanverse/edit-domain/test-fixtures'
import { createCreativeProductionExternalSessionV1 } from './external-session.ts'
import {
  CREATIVE_PRODUCTION_CONTEXT_TOOL_V16,
  CREATIVE_PRODUCTION_CREATE_SANDBOX_TOOL_V16,
  CREATIVE_PRODUCTION_SANDBOX_REVIEW_TOOL_V16,
  CREATIVE_PRODUCTION_SET_SANDBOX_OPACITY_TOOL_V16,
} from './production-tools.ts'

const invoke = async (session: Awaited<ReturnType<typeof createCreativeProductionExternalSessionV1>>, id: string, input: unknown = {}, context: { sandboxId?: string; revision?: number } = {}) =>
  session.registry.invoke(id, input, Object.freeze({ ...context, availableCapabilities: Object.freeze([]) }))

describe('external production MCP session', () => {
  it('refreshes canonical production state, creates/edits/reviews/discards only its sandbox, and leaves accepted project unchanged', async () => {
    const original = testProject()
    let live = original
    const session = await createCreativeProductionExternalSessionV1({ sessionLabel: 'codex-smoke-001', readProject: async () => live })
    expect(session.registry.list()).toHaveLength(34)

    const context = await invoke(session, CREATIVE_PRODUCTION_CONTEXT_TOOL_V16)
    expect(context).toMatchObject({ ok: true, value: { projectId: original.projectId, productionRevision: 0, stale: false } })

    const missingRevision = await invoke(session, CREATIVE_PRODUCTION_CREATE_SANDBOX_TOOL_V16)
    expect(missingRevision).toMatchObject({ ok: false, refusal: { code: 'PRODUCTION_REVISION_CONTEXT_REQUIRED' } })
    const created = await invoke(session, CREATIVE_PRODUCTION_CREATE_SANDBOX_TOOL_V16, {}, { revision: 0 })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const sandboxId = String((created.value as { sandboxId: string }).sandboxId)
    const sandboxRevision = Number((created.value as { sandboxRevision: number }).sandboxRevision)
    const stateId = String((created.value as { stateIds: string[] }).stateIds[0])
    expect(sandboxId).toContain('sandbox:creative_')

    const before = await invoke(session, CREATIVE_PRODUCTION_SANDBOX_REVIEW_TOOL_V16, {}, { sandboxId })
    expect(before.ok).toBe(true)
    if (!before.ok) return
    const beforeOpacity = Number(((before.value as { selectedNode: { opacity?: number } }).selectedNode).opacity)

    const revised = await invoke(session, CREATIVE_PRODUCTION_SET_SANDBOX_OPACITY_TOOL_V16, { opacity: beforeOpacity === 0.72 ? 0.62 : 0.72 }, { sandboxId, revision: 0 })
    expect(revised).toMatchObject({ ok: true, value: { sandboxId, opacity: beforeOpacity === 0.72 ? 0.62 : 0.72 } })
    const reviewed = await invoke(session, CREATIVE_PRODUCTION_SANDBOX_REVIEW_TOOL_V16, {}, { sandboxId })
    expect(reviewed.ok).toBe(true)
    if (!reviewed.ok) return
    expect(Number(((reviewed.value as { selectedNode: { opacity?: number } }).selectedNode).opacity)).not.toBe(beforeOpacity)
    expect(live).toBe(original)
    expect(live.revision).toBe(0)

    const discarded = await invoke(session, 'discard_sandbox', {}, { sandboxId, revision: 0 })
    expect(discarded).toMatchObject({ ok: true })
    expect(session.workflow.state().storyboardSandbox).toBeNull()
    expect(live).toBe(original)
    expect(live.revision).toBe(0)
  })

  it('gives concurrent clients separate sandbox identity and refuses stale accepted-project revisions', async () => {
    const original = testProject()
    let live = original
    const readProject = async () => live
    const [codex, claude] = await Promise.all([
      createCreativeProductionExternalSessionV1({ sessionLabel: 'codex-concurrent', readProject }),
      createCreativeProductionExternalSessionV1({ sessionLabel: 'claude-concurrent', readProject }),
    ])
    const codexCreated = await invoke(codex, CREATIVE_PRODUCTION_CREATE_SANDBOX_TOOL_V16, {}, { revision: 0 })
    const claudeCreated = await invoke(claude, CREATIVE_PRODUCTION_CREATE_SANDBOX_TOOL_V16, {}, { revision: 0 })
    expect(codexCreated.ok && claudeCreated.ok).toBe(true)
    if (!codexCreated.ok || !claudeCreated.ok) return
    const codexSandbox = String((codexCreated.value as { sandboxId: string }).sandboxId)
    const claudeSandbox = String((claudeCreated.value as { sandboxId: string }).sandboxId)
    expect(codexSandbox).not.toBe(claudeSandbox)

    const crossRead = await invoke(codex, CREATIVE_PRODUCTION_SANDBOX_REVIEW_TOOL_V16, {}, { sandboxId: claudeSandbox })
    expect(crossRead).toMatchObject({ ok: false, refusal: { code: 'SANDBOX_CONTEXT_MISMATCH' } })

    live = Object.freeze({ ...original, revision: 1 })
    const stale = await invoke(codex, 'discard_sandbox', {}, { sandboxId: codexSandbox, revision: 0 })
    expect(stale).toMatchObject({ ok: false, refusal: { code: 'STALE_PRODUCTION_REVISION' } })
    expect(codex.workflow.state().storyboardSandbox?.id).toBe(codexSandbox)
  })
})

