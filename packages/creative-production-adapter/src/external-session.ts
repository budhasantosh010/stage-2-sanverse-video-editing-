import type { EditProject } from '@sanverse/edit-domain'
import type { SanverseToolRegistryV1, ToolExecutionContextV1 } from '@sanverse/motion-agent-tools'
import { buildKineticHeadlineCandidateV16, type CreativeProductionCandidateV16 } from './production-adapter.ts'
import { createCreativeProductionToolRegistryV16 } from './production-tools.ts'
import { createCreativeProductionWorkflowV16, type CreativeProductionWorkflowV16 } from './workflow.ts'

export interface CreativeProductionExternalSessionV1 {
  readonly sessionLabel: string
  readonly candidate: CreativeProductionCandidateV16
  readonly workflow: CreativeProductionWorkflowV16
  readonly registry: SanverseToolRegistryV1
  readonly readLiveProject: () => Promise<EditProject>
}

export interface CreativeProductionExternalSessionOptionsV1 {
  readonly sessionLabel: string
  readonly readProject: () => Promise<EditProject>
  readonly compositionTicks?: number
  readonly headline?: string
}

/**
 * One external MCP connection gets one existing Closed-Loop workflow instance.
 * That workflow owns only candidate/sandbox state. The accepted production
 * project is re-read through the caller-supplied canonical project authority
 * before every tool invocation, so a client connection can never become a
 * second persisted-project source of truth.
 */
export const createCreativeProductionExternalSessionV1 = async (
  options: CreativeProductionExternalSessionOptionsV1,
): Promise<CreativeProductionExternalSessionV1> => {
  let liveProject = await options.readProject()
  const shortLabel = options.sessionLabel.replace(/[^a-z0-9]/gi, '').slice(0, 10) || 'external'
  const firstVideoTick = liveProject.composition.tracks
    .filter((track) => track.kind === 'video')
    .flatMap((track) => track.clips)
    .filter((clip) => clip.enabled)
    .map((clip) => clip.compositionStart.ticks)
    .sort((left, right) => left - right)[0] ?? 0
  const built = buildKineticHeadlineCandidateV16({
    project: liveProject,
    compositionTicks: options.compositionTicks ?? firstVideoTick,
    headline: (options.headline ?? `MCP sandbox ${shortLabel}`).slice(0, 60),
    subhead: 'External interoperability proof',
  })
  if (!built.ok) throw new Error(`${built.refusal.code}: ${built.refusal.message}`)

  const candidate = built.value
  const workflow = createCreativeProductionWorkflowV16(candidate)
  const production = createCreativeProductionToolRegistryV16({ workflow, candidate, readProject: () => liveProject })
  const registry: SanverseToolRegistryV1 = Object.freeze({
    register: production.register,
    get: production.get,
    list: production.list,
    invoke: async (id: string, value: unknown, context: ToolExecutionContextV1 = Object.freeze({})) => {
      liveProject = await options.readProject()
      return production.invoke(id, value, context)
    },
  })

  return Object.freeze({
    sessionLabel: options.sessionLabel,
    candidate,
    workflow,
    registry,
    readLiveProject: async () => {
      liveProject = await options.readProject()
      return liveProject
    },
  })
}
