import { createClosedLoopEngineV1, type ClosedLoopEngineV1, type ClosedLoopEngineStateV1, type VisualEvidenceV1 } from '@sanverse/motion-agent-tools'
import { createStoryboardV1, type OwnerApprovalScopeV1, type OwnerApprovalV1 } from '@sanverse/motion-storyboard'
import { projectCreativeCandidateV16, type CreativeProductionCandidateV16 } from './production-adapter.ts'

export interface CreativeProductionWorkflowV16 {
  readonly engine: ClosedLoopEngineV1
  readonly candidate: CreativeProductionCandidateV16
  readonly initialize: () => Readonly<{ ok: boolean; message: string }>
  readonly approve: (scope: OwnerApprovalScopeV1, approvedAt?: string) => Readonly<{ ok: boolean; message: string }>
  readonly advanceAfterStoryboardApproval: () => Readonly<{ ok: boolean; message: string }>
  readonly advanceAfterAnimaticApproval: () => Readonly<{ ok: boolean; message: string }>
  readonly prepareMotionReview: () => Promise<Readonly<{ ok: boolean; message: string }>>
  readonly state: () => ClosedLoopEngineStateV1
}

const messageOf = (value: { ok: boolean; refusal?: { message: string } }, success: string) => Object.freeze({
  ok: value.ok,
  message: value.ok ? success : value.refusal?.message ?? 'Creative workflow step failed.',
})

const approvalId = (candidate: CreativeProductionCandidateV16, scope: OwnerApprovalScopeV1, revision: number) =>
  `approval:${candidate.id}:${scope}:r${revision}`

export const createCreativeProductionWorkflowV16 = (candidate: CreativeProductionCandidateV16): CreativeProductionWorkflowV16 => {
  const renderContext = candidate.renderContext
  const renderer = Object.freeze({
    renderMotionReview: async (draft: { id: string; revision: number }): Promise<VisualEvidenceV1> => Object.freeze({
      canonicalReviewRef: `production-preview://${candidate.id}/motion/${draft.id}/r${draft.revision}`,
      posterRef: `production-preview://${candidate.id}/poster`,
      criticalFrameRefs: Object.freeze([
        `production-preview://${candidate.id}/tick/0`,
        `production-preview://${candidate.id}/tick/${Math.floor(candidate.source.durationTicks / 2)}`,
        `production-preview://${candidate.id}/tick/${candidate.source.durationTicks}`,
      ]),
      kvsAnchorFrameRefs: Object.freeze([
        `production-preview://${candidate.id}/kvs/opening`,
        `production-preview://${candidate.id}/kvs/payoff`,
      ]),
      entrancePayoffExitFrameRefs: Object.freeze([
        `production-preview://${candidate.id}/entrance`,
        `production-preview://${candidate.id}/payoff`,
        `production-preview://${candidate.id}/exit`,
      ]),
      sourceCompositeFrameRefs: Object.freeze([
        `production-preview://${candidate.id}/source-composite`,
      ]),
    }),
  })
  const engine = createClosedLoopEngineV1(Object.freeze({
    id: candidate.source.projectId,
    revision: candidate.source.projectRevision,
    scene: candidate.scene,
  }), renderer)

  const workflow: CreativeProductionWorkflowV16 = {
    engine,
    candidate,
    initialize: () => {
      // The storyboard/animatic clock is LOCAL to this selected Creative region.
      // Absolute source identity remains in sourceFrameRef. That prevents the
      // Motion Graph from being fed five-second source ticks for a three-second
      // local scene while still preserving the exact source frame provenance.
      const board = createStoryboardV1({
        id: `storyboard:${candidate.id}`,
        sourceRevision: candidate.source.projectRevision,
        setup: Object.freeze({
          schemaVersion: 'sanverse.storyboard-presentation-setup/v1' as const,
          sourceRegion: Object.freeze({ startTick: 0, endTick: candidate.source.durationTicks }),
          communicationGoal: `Present “${candidate.headline}” clearly over the source footage.`,
          presentationMode: 'overlay' as const,
          sourceTreatment: 'normal' as const,
          backgroundTreatment: 'source-video' as const,
          preserveSourceAudio: true,
          preserveSourceVideo: true,
          requiredCapabilities: Object.freeze([]),
        }),
        states: Object.freeze([
          Object.freeze({
            schemaVersion: 'sanverse.key-visual-state/v1' as const,
            id: `${candidate.id}:kvs:opening`,
            semanticPurpose: 'opening' as const,
            approximateTick: 0,
            presentationMode: 'overlay' as const,
            sourceTreatment: 'normal' as const,
            backgroundTreatment: 'source-video' as const,
            focusNodeIds: Object.freeze([candidate.selectedNodeId]),
            graphState: candidate.scene,
            sourceFrameRef: Object.freeze({
              schemaVersion: 'sanverse.source-frame-reference/v1' as const,
              sourceId: candidate.source.assetId,
              exactTick: 0,
            }),
          }),
          Object.freeze({
            schemaVersion: 'sanverse.key-visual-state/v1' as const,
            id: `${candidate.id}:kvs:payoff`,
            semanticPurpose: 'payoff' as const,
            approximateTick: candidate.source.durationTicks - 1,
            presentationMode: 'overlay' as const,
            sourceTreatment: 'normal' as const,
            backgroundTreatment: 'source-video' as const,
            focusNodeIds: Object.freeze([candidate.selectedNodeId]),
            graphState: candidate.scene,
            sourceFrameRef: Object.freeze({
              schemaVersion: 'sanverse.source-frame-reference/v1' as const,
              sourceId: candidate.source.assetId,
              exactTick: candidate.source.durationTicks - 1,
            }),
          }),
        ]),
        status: 'draft' as const,
        revision: 1,
      })
      const created = engine.createStoryboardSandbox(`sandbox:${candidate.id}`, board)
      if (!created.ok) return messageOf(created, '')
      const qa = engine.validateStoryboard({
        availableCapabilities: Object.freeze([]),
        availableSourceIds: Object.freeze([candidate.source.assetId]),
        requiredRatio: candidate.scene.supportedAspectRatios[0],
        compositionBounds: Object.freeze({ width: renderContext.composition.width, height: renderContext.composition.height }),
      })
      return messageOf(qa, 'Storyboard and KVS structural QA passed. Exact owner approval is still required.')
    },
    approve: (scope, approvedAt = new Date().toISOString()) => {
      const state = engine.getState()
      const target = scope === 'storyboard'
        ? state.storyboardSandbox?.storyboard
        : scope === 'animatic'
          ? state.animatic
          : state.motionDraft
      if (!target) return Object.freeze({ ok: false, message: `${scope} is not ready for approval.` })
      const approval: OwnerApprovalV1 = Object.freeze({
        schemaVersion: 'sanverse.owner-approval/v1',
        id: approvalId(candidate, scope, target.revision),
        scope,
        subjectId: target.id,
        subjectRevision: target.revision,
        status: 'owner-approved',
        approvedAt,
      })
      const approved = engine.recordOwnerApproval(approval)
      return messageOf(approved, `${scope} revision ${target.revision} received explicit owner approval.`)
    },
    advanceAfterStoryboardApproval: () => {
      const state = engine.getState()
      const board = state.storyboardSandbox?.storyboard
      if (!board || board.status !== 'owner-approved') return Object.freeze({ ok: false, message: 'Approve the exact Storyboard revision first.' })
      const midpoint = Math.floor(candidate.source.durationTicks / 2)
      const animatic = engine.buildAnimatic({
        id: `animatic:${candidate.id}`,
        timings: Object.freeze([
          { stateId: board.states[0]!.id, startTick: 0, endTick: midpoint },
          { stateId: board.states[1]!.id, startTick: midpoint, endTick: candidate.source.durationTicks },
        ]),
        sourceAudioRef: Object.freeze({ sourceId: candidate.source.assetId }),
      })
      if (!animatic.ok) return messageOf(animatic, '')
      const qa = engine.validateAnimatic({
        minimumReadableHoldTicks: 240_000,
        sourceRegion: board.setup.sourceRegion,
        ticksPerSecond: renderContext.ticksPerSecond,
      })
      return messageOf(qa, 'Animatic exact-tick QA passed. Exact owner approval is still required.')
    },
    advanceAfterAnimaticApproval: () => {
      const state = engine.getState()
      if (state.animatic?.status !== 'owner-approved') return Object.freeze({ ok: false, message: 'Approve the exact Animatic revision first.' })
      const plan = engine.buildMotionPlan({ id: `motion-plan:${candidate.id}` })
      if (!plan.ok) return messageOf(plan, '')
      const draft = engine.buildMotionDraft({ id: `motion-draft:${candidate.id}` })
      if (!draft.ok) return messageOf(draft, '')
      const projection = projectCreativeCandidateV16(Object.freeze({ ...candidate, scene: draft.value.scene }))
      const qa = engine.validateMotion({
        durationTicks: candidate.source.durationTicks,
        ticksPerSecond: renderContext.ticksPerSecond,
        composition: renderContext.composition,
        sampleTicks: Object.freeze([0, Math.floor(candidate.source.durationTicks / 2), candidate.source.durationTicks]),
        expectedSemanticNodeIds: Object.freeze([candidate.selectedNodeId]),
        availableCapabilities: Object.freeze([]),
        requiredCapabilities: Object.freeze([]),
      })
      return messageOf(qa, `Motion Forge produced one canonical Motion Graph draft with C3/C4/C5/C6 selection parity ${projection.c3HasSelection && projection.c4HasSelection && projection.c5HasSelection && projection.c6HasSelection ? 'PASS' : 'FAIL'}.`)
    },
    prepareMotionReview: async () => {
      const state = engine.getState()
      const draft = state.motionDraft
      if (!draft) return Object.freeze({ ok: false, message: 'Build Motion Forge output first.' })
      const review = await engine.renderReview({
        stage: 'motion',
        subjectId: draft.id,
        subjectRevision: draft.revision,
        startTick: 0,
        endTick: candidate.source.durationTicks,
        criticalTicks: Object.freeze([0, Math.floor(candidate.source.durationTicks / 2), candidate.source.durationTicks]),
      })
      return messageOf(review, 'Motion Review evidence now points at the production Creative preview for this exact draft revision.')
    },
    state: () => engine.getState(),
  }
  return Object.freeze(workflow)
}
