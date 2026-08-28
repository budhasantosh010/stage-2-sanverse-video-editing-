import type { EditProject } from '@sanverse/edit-domain'
import { creativeOperationRefusal, type CreativeOperationResultV1 } from '@sanverse/motion-contract'
import {
  createClosedLoopToolRegistryV1,
  createCreativeEngineV15ToolRegistryV1,
  createSanverseToolRegistryV1,
  type SanverseToolDefinitionV1,
  type SanverseToolRegistryV1,
  type ToolExecutionContextV1,
} from '@sanverse/motion-agent-tools'
import { projectCreativeCandidateV16, type CreativeProductionCandidateV16 } from './production-adapter.ts'
import type { CreativeProductionWorkflowV16 } from './workflow.ts'

export const CREATIVE_PRODUCTION_CONTEXT_TOOL_V16 = 'production.get_creative_context' as const

const INTERNAL_PRODUCTION_MUTATION_TOOLS = new Set([
  'apply_approved_sandbox',
  'undo_last_creative_merge',
])

const register = (registry: SanverseToolRegistryV1, definition: SanverseToolDefinitionV1) => {
  const result = registry.register(definition)
  if (!result.ok) throw new RangeError(`${result.refusal.code}: ${result.refusal.message}`)
}

const noInput = (input: unknown) => input === undefined || input === null || (typeof input === 'object' && !Array.isArray(input) && Object.keys(input as object).length === 0)
  ? ({ ok: true as const, value: Object.freeze({}) })
  : ({ ok: false as const, refusal: Object.freeze({ code: 'INVALID_TOOL_INPUT', message: 'This tool does not accept input fields.' }) })

const productionRevisionRefusal = (
  candidate: CreativeProductionCandidateV16,
  current: EditProject,
  context: ToolExecutionContextV1,
): CreativeOperationResultV1<never> | null => {
  if (current.projectId !== candidate.source.projectId) {
    return creativeOperationRefusal('PRODUCTION_PROJECT_MISMATCH', `Creative sandbox project ${candidate.source.projectId} does not match live production project ${current.projectId}.`)
  }
  if (current.revision !== candidate.source.projectRevision) {
    return creativeOperationRefusal('STALE_PRODUCTION_REVISION', `Creative sandbox was created from production revision ${candidate.source.projectRevision}, but the live project is revision ${current.revision}. Rebuild the Creative sandbox before modifying it.`)
  }
  if (!Number.isSafeInteger(context.revision) || context.revision !== current.revision) {
    return creativeOperationRefusal('PRODUCTION_REVISION_CONTEXT_REQUIRED', `Mutating Creative tools require io.sanverse/revision=${current.revision} from the live production project.`)
  }
  return null
}

/**
 * Build the production-facing tool registry over the exact workflow engine used
 * by the UI. MCP remains a protocol adapter over this registry and therefore
 * owns no project, sandbox, approval, Motion Graph or Undo state.
 *
 * The isolated Closed-Loop apply/undo tools are intentionally omitted here:
 * production acceptance belongs to EditProject's server-authoritative change
 * set/history path, so exposing those tools would create a second accepted
 * project history inside the production editor.
 */
export const createCreativeProductionToolRegistryV16 = (input: Readonly<{
  workflow: CreativeProductionWorkflowV16
  candidate: CreativeProductionCandidateV16
  readProject: () => EditProject
}>): SanverseToolRegistryV1 => {
  const closedLoop = createClosedLoopToolRegistryV1(input.workflow.engine)
  const combined = createSanverseToolRegistryV1()

  for (const summary of closedLoop.list()) {
    if (INTERNAL_PRODUCTION_MUTATION_TOOLS.has(summary.id)) continue
    const definition = closedLoop.get(summary.id)
    if (definition) register(combined, definition)
  }
  createCreativeEngineV15ToolRegistryV1(combined)

  const production = createSanverseToolRegistryV1()
  for (const summary of combined.list()) {
    const definition = combined.get(summary.id)
    if (!definition) continue
    register(production, Object.freeze({
      ...definition,
      execute: async (value: unknown, context: ToolExecutionContextV1) => {
        if (definition.level === 'T1' || definition.level === 'T2') {
          const refusal = productionRevisionRefusal(input.candidate, input.readProject(), context)
          if (refusal) return refusal
        }
        return definition.execute(value, context)
      },
    }) as SanverseToolDefinitionV1)
  }

  register(production, Object.freeze({
    id: CREATIVE_PRODUCTION_CONTEXT_TOOL_V16,
    version: 1 as const,
    level: 'T0' as const,
    inputSchema: Object.freeze({ type: 'object', additionalProperties: false }),
    outputSchema: Object.freeze({ type: 'object', required: ['ok'], additionalProperties: true }),
    requiresSandbox: false,
    validateInput: noInput,
    execute: () => {
      const current = input.readProject()
      const workflowState = input.workflow.state()
      const projection = projectCreativeCandidateV16(input.candidate)
      return Object.freeze({
        ok: true as const,
        value: Object.freeze({
          schemaVersion: 'sanverse.production-creative-context/v1.6' as const,
          projectId: current.projectId,
          productionRevision: current.revision,
          candidateId: input.candidate.id,
          candidateBaseRevision: input.candidate.source.projectRevision,
          stale: current.projectId !== input.candidate.source.projectId || current.revision !== input.candidate.source.projectRevision,
          source: Object.freeze({
            clipId: input.candidate.source.clipId,
            assetId: input.candidate.source.assetId,
            compositionTicks: input.candidate.source.compositionTicks,
            sourceStartTicks: input.candidate.source.sourceStartTicks,
            sourceEndTicks: input.candidate.source.sourceEndTicks,
          }),
          selectedNodeId: input.candidate.selectedNodeId,
          projection,
          stages: Object.freeze({
            storyboard: workflowState.storyboardSandbox?.storyboard.status ?? null,
            animatic: workflowState.animatic?.status ?? null,
            motion: workflowState.motionDraft?.status ?? null,
            reviewReady: Boolean(workflowState.visualEvidence),
          }),
        }),
        revision: current.revision,
      })
    },
  }))

  return production
}
