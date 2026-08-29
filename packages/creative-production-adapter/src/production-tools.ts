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
import { evaluateScene } from '@sanverse/motion-graph'
import { projectCreativeCandidateV16, type CreativeProductionCandidateV16 } from './production-adapter.ts'
import type { CreativeProductionWorkflowV16 } from './workflow.ts'

export const CREATIVE_PRODUCTION_CONTEXT_TOOL_V16 = 'production.get_creative_context' as const
export const CREATIVE_PRODUCTION_CREATE_SANDBOX_TOOL_V16 = 'production.create_creative_sandbox' as const
export const CREATIVE_PRODUCTION_SANDBOX_REVIEW_TOOL_V16 = 'production.get_sandbox_review' as const
export const CREATIVE_PRODUCTION_SET_SANDBOX_OPACITY_TOOL_V16 = 'production.set_sandbox_selected_opacity' as const

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

  register(combined, Object.freeze({
    id: CREATIVE_PRODUCTION_CREATE_SANDBOX_TOOL_V16,
    version: 1 as const,
    level: 'T1' as const,
    inputSchema: Object.freeze({ type: 'object', additionalProperties: false }),
    outputSchema: Object.freeze({ type: 'object', required: ['ok'], additionalProperties: true }),
    requiresSandbox: false,
    validateInput: noInput,
    execute: () => {
      if (input.workflow.state().storyboardSandbox) {
        return creativeOperationRefusal('CREATIVE_SANDBOX_ALREADY_ACTIVE', 'This MCP session already has an active Creative sandbox. Discard it before creating another one.')
      }
      const initialized = input.workflow.initialize()
      if (!initialized.ok) return creativeOperationRefusal('CREATIVE_SANDBOX_CREATE_FAILED', initialized.message)
      const state = input.workflow.state()
      const sandbox = state.storyboardSandbox
      if (!sandbox) return creativeOperationRefusal('CREATIVE_SANDBOX_CREATE_FAILED', 'The Creative workflow did not expose the sandbox it created.')
      return Object.freeze({
        ok: true as const,
        value: Object.freeze({
          schemaVersion: 'sanverse.production-creative-sandbox/v1' as const,
          sandboxId: sandbox.id,
          sandboxRevision: sandbox.sandboxRevision,
          storyboardId: sandbox.storyboard.id,
          storyboardRevision: sandbox.storyboard.revision,
          stateIds: Object.freeze(sandbox.storyboard.states.map((state) => state.id)),
          selectedNodeId: input.candidate.selectedNodeId,
          candidateId: input.candidate.id,
          message: initialized.message,
        }),
        revision: input.readProject().revision,
      })
    },
  }))

  register(combined, Object.freeze({
    id: CREATIVE_PRODUCTION_SET_SANDBOX_OPACITY_TOOL_V16,
    version: 1 as const,
    level: 'T1' as const,
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: ['opacity'],
      properties: Object.freeze({ opacity: Object.freeze({ type: 'number', minimum: 0, maximum: 1 }) }),
    }),
    outputSchema: Object.freeze({ type: 'object', required: ['ok'], additionalProperties: true }),
    requiresSandbox: true,
    validateInput: (value: unknown) => {
      const opacity = value && typeof value === 'object' && !Array.isArray(value) ? Number((value as Record<string, unknown>).opacity) : Number.NaN
      return Number.isFinite(opacity) && opacity >= 0 && opacity <= 1
        ? ({ ok: true as const, value: Object.freeze({ opacity }) })
        : ({ ok: false as const, refusal: Object.freeze({ code: 'INVALID_TOOL_INPUT', message: 'opacity must be a finite number from 0 through 1.' }) })
    },
    execute: (value: unknown, context: ToolExecutionContextV1) => {
      const opacity = (value as Readonly<{ opacity: number }>).opacity
      const sandbox = input.workflow.state().storyboardSandbox
      if (!sandbox) return creativeOperationRefusal('STORYBOARD_SANDBOX_REQUIRED', 'No active Creative storyboard sandbox exists in this MCP session.')
      if (context.sandboxId !== sandbox.id) return creativeOperationRefusal('SANDBOX_CONTEXT_MISMATCH', `Tool context sandbox ${context.sandboxId ?? '<missing>'} does not match active sandbox ${sandbox.id}.`)
      const state = sandbox.storyboard.states[0]
      if (!state) return creativeOperationRefusal('STORYBOARD_STATE_NOT_FOUND', 'The active Creative storyboard has no editable state.')
      const revised = input.workflow.engine.reviseStoryboard(Object.freeze({
        transactionId: `interop-opacity:${sandbox.id}:r${sandbox.sandboxRevision}`,
        expectedSandboxRevision: sandbox.sandboxRevision,
        stateId: state.id,
        operations: Object.freeze([Object.freeze({
          operationId: `interop-opacity:${input.candidate.selectedNodeId}:r${sandbox.sandboxRevision}`,
          type: 'set-property' as const,
          target: Object.freeze({ nodeId: input.candidate.selectedNodeId, property: 'opacity' as const }),
          value: Object.freeze({ kind: 'constant' as const, value: opacity }),
        })]),
      }))
      if (!revised.ok) return revised
      return Object.freeze({
        ok: true as const,
        value: Object.freeze({
          sandboxId: revised.value.id,
          sandboxRevision: revised.value.sandboxRevision,
          storyboardRevision: revised.value.storyboard.revision,
          stateId: state.id,
          selectedNodeId: input.candidate.selectedNodeId,
          opacity,
        }),
        revision: revised.revision,
      })
    },
  }))
  register(combined, Object.freeze({
    id: CREATIVE_PRODUCTION_SANDBOX_REVIEW_TOOL_V16,
    version: 1 as const,
    level: 'T0' as const,
    inputSchema: Object.freeze({ type: 'object', additionalProperties: false }),
    outputSchema: Object.freeze({ type: 'object', required: ['ok'], additionalProperties: true }),
    requiresSandbox: true,
    validateInput: noInput,
    execute: (_value: unknown, context: ToolExecutionContextV1) => {
      const sandbox = input.workflow.state().storyboardSandbox
      if (!sandbox) return creativeOperationRefusal('STORYBOARD_SANDBOX_REQUIRED', 'No active Creative storyboard sandbox exists in this MCP session.')
      if (context.sandboxId !== sandbox.id) {
        return creativeOperationRefusal('SANDBOX_CONTEXT_MISMATCH', `Tool context sandbox ${context.sandboxId ?? '<missing>'} does not match active sandbox ${sandbox.id}.`)
      }
      const state = sandbox.storyboard.states[0]
      if (!state) return creativeOperationRefusal('STORYBOARD_STATE_NOT_FOUND', 'The active Creative storyboard has no reviewable state.')
      const frame = evaluateScene(state.graphState, Object.freeze({
        ...input.candidate.renderContext,
        localTicks: state.approximateTick,
      }))
      const selected = frame.nodes[input.candidate.selectedNodeId]
      return Object.freeze({
        ok: true as const,
        value: Object.freeze({
          schemaVersion: 'sanverse.production-sandbox-review/v1' as const,
          reviewRef: `production-preview://${input.candidate.id}/storyboard/${state.id}/r${sandbox.storyboard.revision}`,
          sandboxId: sandbox.id,
          sandboxRevision: sandbox.sandboxRevision,
          storyboardId: sandbox.storyboard.id,
          storyboardRevision: sandbox.storyboard.revision,
          stateId: state.id,
          exactTick: state.approximateTick,
          selectedNodeId: input.candidate.selectedNodeId,
          selectedNode: selected ?? null,
        }),
        revision: sandbox.sandboxRevision,
      })
    },
  }))

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
