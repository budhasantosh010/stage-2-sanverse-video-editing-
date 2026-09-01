import {
  createClosedLoopEngineV1,
  type ClosedLoopEngineV1,
  type ClosedLoopEngineStateV1,
  type VisualEvidenceV1,
} from '@sanverse/motion-agent-tools'
import type { EditProject } from '@sanverse/edit-domain'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import type { MotionComponentModuleV1, MotionRenderContextV1 } from '@sanverse/motion-contract'
import { applyMotionOperations, constant, type MotionGraphBackedComponentModuleV1, type MotionGraphOperationV1, type MotionSceneV1 } from '@sanverse/motion-graph'
import { MOTION_COMPONENT_MODULES } from '@sanverse/motion-library'
import {
  createStoryboardV1,
  validateOwnerApprovalV1,
  type OwnerApprovalScopeV1,
  type OwnerApprovalV1,
  type StoryboardSandboxOperationV1,
  type StoryboardStateTargetV1,
  type StoryboardStyleConstraintV1,
} from '@sanverse/motion-storyboard'
import { resolveCreativeProductionSourceV16, type CreativeProductionSourceContextV16 } from './production-adapter.ts'
import type { MotionOpportunityMapV1, PlannedMotionOpportunityV1 } from './opportunity-planner.ts'

export const CREATIVE_SCENE_BATCH_SCHEMA_V1 = 'sanverse.creative-scene-batch/v1' as const

export interface GenericCreativeSceneCandidateV1 {
  readonly schemaVersion: 'sanverse.generic-creative-scene-candidate/v1'
  readonly id: string
  readonly opportunityId: string
  readonly componentId: string
  readonly componentVersion: number
  readonly source: CreativeProductionSourceContextV16
  readonly props: unknown
  readonly style: unknown
  readonly scene: MotionSceneV1
  readonly renderContext: MotionRenderContextV1
  readonly selectedNodeId: string
  readonly semanticNodeIds: readonly string[]
  readonly authoringMetadata: Readonly<{
    schemaVersion: 'sanverse.creative-scene-authoring-metadata/v1'
    sourceBoundText: string
    defaultContentFingerprints: readonly string[]
    styleConstraint: StoryboardStyleConstraintV1
  }>
}

export interface CreativeSceneWorkflowV1 {
  readonly sceneId: string
  readonly planned: PlannedMotionOpportunityV1
  readonly candidate: GenericCreativeSceneCandidateV1
  readonly styleLockId: string
  readonly creativeLanguageId: string
  readonly engine: ClosedLoopEngineV1
  readonly initialize: () => Readonly<{ ok: boolean; message: string }>
  readonly reviseStoryboardOpacity: (opacity: number, expectedSandboxRevision: number) => Readonly<{ ok: boolean; message: string }>
  readonly reviseStoryboardContent: (input: Readonly<{ text?: string; fontSize?: number; expectedSandboxRevision: number }>) => Readonly<{ ok: boolean; message: string }>
  readonly inspectStoryboard: () => Readonly<{ ok: boolean; message: string; value?: unknown }>
  readonly applyStoryboardGraphOperations: (input: Readonly<{ transactionId: string; expectedSandboxRevision: number; targets: StoryboardStateTargetV1; operations: readonly MotionGraphOperationV1[] }>) => Readonly<{ ok: boolean; message: string; value?: unknown }>
  readonly applyStoryboardDesign: (input: Readonly<{ transactionId: string; expectedSandboxRevision: number; graphEdits?: readonly Readonly<{ stateId: string; operations: readonly MotionGraphOperationV1[] }>[]; sandboxOperations?: readonly StoryboardSandboxOperationV1[] }>) => Readonly<{ ok: boolean; message: string; value?: unknown }>
  readonly reopenStoryboard: (expectedSandboxRevision: number) => Readonly<{ ok: boolean; message: string; value?: unknown }>
  readonly advanceAfterStoryboardApproval: () => Readonly<{ ok: boolean; message: string }>
  readonly advanceAfterAnimaticApproval: () => Readonly<{ ok: boolean; message: string }>
  readonly prepareMotionReview: () => Promise<Readonly<{ ok: boolean; message: string }>>
  readonly recordResolvedOwnerApproval: (approval: OwnerApprovalV1) => Readonly<{ ok: boolean; message: string }>
  readonly state: () => ClosedLoopEngineStateV1
}

export interface HostApprovalRequestV1 {
  readonly schemaVersion: 'sanverse.host-approval-request/v1'
  readonly requestRef: string
  readonly batchId: string
  readonly sceneId: string
  readonly scope: OwnerApprovalScopeV1
  readonly subjectId: string
  readonly subjectRevision: number
  readonly issuedAt: string
}

export type HostApprovalResolverV1 = (request: HostApprovalRequestV1) => Promise<OwnerApprovalV1 | null>

export interface CreativeSceneBatchSnapshotV1 {
  readonly schemaVersion: typeof CREATIVE_SCENE_BATCH_SCHEMA_V1
  readonly id: string
  readonly opportunityMapId: string
  readonly projectId: string
  readonly projectRevision: number
  readonly scenes: readonly Readonly<{
    sceneId: string
    opportunityId: string
    componentId: string
    sourceStartTick: number
    sourceEndTick: number
    selectedNodeId: string
    storyboard: Readonly<{ id: string; revision: number; status: string; sandboxRevision: number }> | null
    animatic: Readonly<{ id: string; revision: number; status: string }> | null
    motion: Readonly<{ id: string; revision: number; status: string; reviewReady: boolean }> | null
  }>[]
  readonly pendingApprovalRequests: readonly HostApprovalRequestV1[]
  readonly readyForProductionApply: boolean
}

export interface PersistedCreativeSceneWorkflowV1 {
  readonly schemaVersion: 'sanverse.persisted-creative-scene-workflow/v1'
  readonly sceneId: string
  readonly candidate: GenericCreativeSceneCandidateV1
  readonly engineState: ClosedLoopEngineStateV1
}

export interface PersistedCreativeSceneBatchV1 {
  readonly schemaVersion: 'sanverse.persisted-creative-scene-batch/v1'
  readonly id: string
  readonly projectId: string
  readonly projectRevision: number
  readonly opportunityMapId: string
  readonly workflows: readonly PersistedCreativeSceneWorkflowV1[]
  readonly pendingApprovalRequests: readonly HostApprovalRequestV1[]
}

export interface CreativeSceneBatchV1 {
  readonly id: string
  readonly projectId: string
  readonly projectRevision: number
  readonly opportunityMap: MotionOpportunityMapV1
  readonly sceneIds: readonly string[]
  readonly getWorkflow: (sceneId: string) => CreativeSceneWorkflowV1 | null
  readonly snapshot: () => CreativeSceneBatchSnapshotV1
  readonly serialize: () => PersistedCreativeSceneBatchV1
  readonly requestOwnerReviews: (scope: OwnerApprovalScopeV1, now?: string) => Readonly<{ ok: boolean; message: string; requests?: readonly HostApprovalRequestV1[] }>
  readonly resolveOwnerApproval: (requestRef: string, resolver: HostApprovalResolverV1) => Promise<Readonly<{ ok: boolean; message: string; approved?: boolean }>>
  readonly advanceAll: (stage: 'animatic' | 'motion') => Promise<Readonly<{ ok: boolean; message: string }>>
  readonly reviseSceneOpacity: (sceneId: string, opacity: number, expectedSandboxRevision: number) => Readonly<{ ok: boolean; message: string }>
  readonly reviseSceneStoryboard: (sceneId: string, input: Readonly<{ text?: string; fontSize?: number; expectedSandboxRevision: number }>) => Readonly<{ ok: boolean; message: string }>
  readonly excludeScene: (sceneId: string) => Readonly<{ ok: boolean; message: string }>
}

export type CreateCreativeSceneBatchResultV1 =
  | Readonly<{ ok: true; value: CreativeSceneBatchV1 }>
  | Readonly<{ ok: false; refusal: Readonly<{ code: string; message: string; details?: unknown }> }>

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const tail = (value: string): string => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619) }
  return (hash >>> 0).toString(36).padStart(8, '0').slice(0, 12)
}
const messageOf = (value: { ok: boolean; refusal?: { message: string } }, success: string) => Object.freeze({ ok: value.ok, message: value.ok ? success : value.refusal?.message ?? 'Creative workflow step failed.' })
const currentTarget = (state: ClosedLoopEngineStateV1, scope: OwnerApprovalScopeV1) => scope === 'storyboard'
  ? state.storyboardSandbox?.storyboard ?? null
  : scope === 'animatic'
    ? state.animatic
    : state.motionDraft

const isGraphBacked = (module: MotionComponentModuleV1<unknown, unknown>): module is MotionGraphBackedComponentModuleV1<unknown, unknown> =>
  typeof (module as Partial<MotionGraphBackedComponentModuleV1<unknown, unknown>>).createScene === 'function'

const clampText = (value: string, max: number): string => value.trim().slice(0, max)
const CONTENT_PROP_KEYS = new Set(['text','headline','title','label','eyebrow','value','subtitle','subhead','description'])
const defaultContentFingerprints = (value: unknown): readonly string[] => {
  if (!record(value)) return Object.freeze([])
  return Object.freeze([...new Set(Object.entries(value).filter(([key, entry]) => CONTENT_PROP_KEYS.has(key) && typeof entry === 'string').map(([, entry]) => String(entry).trim()).filter((entry) => entry.length >= 2))])
}
type AdaptPropsResultV1 = Readonly<{ ok: true; value: unknown; defaultFingerprints: readonly string[]; sourceBoundViaProps: boolean }> | Readonly<{ ok: false; message: string }>
const adaptProps = (module: MotionComponentModuleV1<unknown, unknown>, text: string): AdaptPropsResultV1 => {
  if (!record(module.defaultProps)) return Object.freeze({ ok: false as const, message: `Component ${module.definition.id} has no object-shaped authorable props; refusing silent default-content fallback.` })
  const candidate: Record<string, unknown> = { ...module.defaultProps }
  const short = clampText(text, 48)
  const medium = clampText(text, 90)
  let bound = false
  for (const key of ['text','headline','title','label','eyebrow','value']) if (typeof candidate[key] === 'string') { candidate[key] = key === 'value' ? short : medium; bound = true }
  for (const key of ['subtitle','subhead','description']) if (typeof candidate[key] === 'string') { candidate[key] = clampText(text, 120); bound = true }
  if (bound) {
    const validated = module.validateProps(candidate)
    if (validated.ok) return Object.freeze({ ok: true as const, value: validated.value, defaultFingerprints: defaultContentFingerprints(module.defaultProps), sourceBoundViaProps: true })
    // The default instance may be used only as a structural template. The caller
    // must immediately bind source content through the canonical Motion Graph
    // before this candidate can escape construction.
    const defaults = module.validateProps(module.defaultProps)
    if (!defaults.ok) return Object.freeze({ ok: false as const, message: `Component ${module.definition.id} rejected source-bound props and has no valid structural default template.` })
    return Object.freeze({ ok: true as const, value: defaults.value, defaultFingerprints: defaultContentFingerprints(module.defaultProps), sourceBoundViaProps: false })
  }
  const defaults = module.validateProps(module.defaultProps)
  if (!defaults.ok) return Object.freeze({ ok: false as const, message: `Component ${module.definition.id} default props are invalid, so it cannot be safely materialized for canonical graph binding.` })
  return Object.freeze({ ok: true as const, value: defaults.value, defaultFingerprints: defaultContentFingerprints(module.defaultProps), sourceBoundViaProps: false })
}

const selectedNodes = (scene: MotionSceneV1): readonly string[] => {
  const semantic = scene.semanticParts.flatMap((part) => part.nodeIds).filter((id) => Boolean(scene.nodes[id]))
  return Object.freeze(semantic.length > 0 ? [...new Set(semantic)] : [scene.rootNodeId])
}
const storyboardStyleConstraint = (map: MotionOpportunityMapV1): StoryboardStyleConstraintV1 => {
  const palette = map.styleRecommendation.visual.paletteRoles
  const typeFamily = map.styleRecommendation.visual.typeFamily
  return Object.freeze({
    schemaVersion: 'sanverse.storyboard-style-constraint/v1' as const,
    styleLockId: map.styleLockId,
    hard: Object.freeze({ allowedColors: Object.freeze([...new Set([palette.background, palette.surface, palette.text, palette.accent])]), ...(typeFamily ? { allowedFontFamilies: Object.freeze([typeFamily]) } : {}) }),
    soft: Object.freeze({ preferredPresentationModes: Object.freeze([...map.creativeLanguage.preferredPresentationModes]), maximumRadius: Math.max(map.styleRecommendation.visual.radius * 2, map.styleRecommendation.visual.radius + 8), maximumNodesPerState: 96 }),
  })
}
const constantStringValue = (value: unknown): string | null => record(value) && value.kind === 'constant' && typeof value.value === 'string' ? value.value : null
const styleConstraintForScene = (base: StoryboardStyleConstraintV1, scene: MotionSceneV1): StoryboardStyleConstraintV1 => {
  const colors = new Set(base.hard.allowedColors ?? [])
  const fonts = new Set(base.hard.allowedFontFamilies ?? [])
  for (const node of Object.values(scene.nodes)) {
    if (node.type === 'text') { fonts.add(node.fontFamily); const fill=constantStringValue(node.fillColor); if(fill)colors.add(fill) }
    if (node.type === 'shape' || node.type === 'path') { const fill=constantStringValue(node.fillColor),stroke=constantStringValue(node.strokeColor); if(fill&&fill!=='transparent')colors.add(fill);if(stroke&&stroke!=='transparent')colors.add(stroke) }
  }
  return Object.freeze({ ...base, hard:Object.freeze({ allowedColors:Object.freeze([...colors]), ...(fonts.size>0?{allowedFontFamilies:Object.freeze([...fonts])}:{}) }) })
}

export const buildGenericCreativeSceneCandidateV1 = (input: Readonly<{
  project: EditProject
  planned: PlannedMotionOpportunityV1
  styleConstraint: StoryboardStyleConstraintV1
  contentText?: string
}>): CreateCreativeSceneBatchResultV1 extends never ? never : Readonly<{ ok: true; value: GenericCreativeSceneCandidateV1 } | { ok: false; refusal: Readonly<{ code: string; message: string }> }> => {
  const opportunity = input.planned.opportunity
  const rankedIds = input.planned.capabilityRankings.map((item) => item.capabilityId)
  for (const componentId of rankedIds) {
    const module = (MOTION_COMPONENT_MODULES as Readonly<Record<string, MotionComponentModuleV1<unknown, unknown>>>)[componentId]
    if (!module || !isGraphBacked(module)) continue
    const requestedDuration = opportunity.sourceEndTick - opportunity.sourceStartTick
    const desiredDuration = Math.min(requestedDuration, module.definition.maxDurationTicks)
    if (desiredDuration < module.definition.minDurationTicks) continue
    const source = resolveCreativeProductionSourceV16({ project: input.project, compositionTicks: opportunity.sourceStartTick, preferredDurationTicks: desiredDuration })
    if (!source.ok) continue
    if (source.value.durationTicks < module.definition.minDurationTicks) continue
    const renderContext: MotionRenderContextV1 = Object.freeze({
      localTicks: 0,
      durationTicks: source.value.durationTicks,
      ticksPerSecond: PROJECT_TIMESCALE,
      composition: Object.freeze({ ...source.value.composition }),
      reducedMotion: false,
    })
    const text = input.contentText?.trim() || opportunity.communicationGoal
    const props = adaptProps(module, text)
    if (!props.ok) continue
    const styleValid = module.validateStyle(module.defaultStyle)
    if (!styleValid.ok) continue
    let scene: MotionSceneV1
    try { scene = module.createScene(props.value, styleValid.value, renderContext) }
    catch { continue }
    const unresolvedDefaults = new Set(props.defaultFingerprints.filter((fingerprint) => fingerprint !== text))
    const textNodes = Object.values(scene.nodes).filter((node) => node.type === 'text')
    const defaultTextNodes = textNodes.filter((node) => {
      const value = constantStringValue(node.text)
      return value !== null && unresolvedDefaults.has(value.trim())
    })
    const graphBindTargets = props.sourceBoundViaProps ? defaultTextNodes : (defaultTextNodes.length > 0 ? defaultTextNodes : textNodes.slice(0, 1))
    if (graphBindTargets.length > 0) {
      const bound = applyMotionOperations(scene, Object.freeze(graphBindTargets.map((node, index) => Object.freeze({
        operationId:`source-bind:${node.id}:${index}`,
        type:'set-property' as const,
        target:Object.freeze({nodeId:node.id,property:'text.text' as const}),
        value:constant(clampText(text,120)),
      }))))
      if (!bound.ok) continue
      scene = bound.scene
    } else if (!props.sourceBoundViaProps && unresolvedDefaults.size > 0) continue
    const stillDefault = Object.values(scene.nodes).some((node) => node.type === 'text' && (() => { const value=constantStringValue(node.text); return value !== null && unresolvedDefaults.has(value.trim()) })())
    if (stillDefault) continue
    const semanticNodeIds = selectedNodes(scene)
    const selectedNodeId = semanticNodeIds[0] ?? scene.rootNodeId
    return Object.freeze({
      ok: true as const,
      value: Object.freeze({
        schemaVersion: 'sanverse.generic-creative-scene-candidate/v1' as const,
        id: `creative_scene_${tail(`${input.project.projectId}:${input.project.revision}:${opportunity.id}:${componentId}`)}`,
        opportunityId: opportunity.id,
        componentId,
        componentVersion: module.definition.version,
        source: source.value,
        props: props.value,
        style: styleValid.value,
        scene,
        renderContext,
        selectedNodeId,
        semanticNodeIds,
        authoringMetadata: Object.freeze({ schemaVersion: 'sanverse.creative-scene-authoring-metadata/v1' as const, sourceBoundText: text, defaultContentFingerprints: props.defaultFingerprints.filter((fingerprint) => fingerprint !== text), styleConstraint: styleConstraintForScene(input.styleConstraint, scene) }),
      }),
    })
  }
  return Object.freeze({ ok: false as const, refusal: Object.freeze({ code: 'SCENE_CAPABILITY_UNBUILDABLE', message: `None of the ranked Motion Library capabilities could build a canonical scene for ${opportunity.id}.` }) })
}

export const createCreativeSceneWorkflowV1 = (input: Readonly<{
  planned: PlannedMotionOpportunityV1
  candidate: GenericCreativeSceneCandidateV1
  styleLockId: string
  creativeLanguageId: string
  restoredState?: ClosedLoopEngineStateV1
}>): CreativeSceneWorkflowV1 => {
  const { planned, candidate } = input
  const opportunity = planned.opportunity
  const renderer = Object.freeze({
    renderMotionReview: async (draft: { id: string; revision: number }): Promise<VisualEvidenceV1> => Object.freeze({
      canonicalReviewRef: `production-preview://${candidate.id}/motion/${draft.id}/r${draft.revision}`,
      posterRef: `production-preview://${candidate.id}/poster`,
      criticalFrameRefs: Object.freeze([0, Math.floor(candidate.source.durationTicks / 2), Math.max(0, candidate.source.durationTicks - 1)].map((tick) => `production-preview://${candidate.id}/tick/${tick}`)),
      kvsAnchorFrameRefs: Object.freeze([`production-preview://${candidate.id}/kvs/opening`,`production-preview://${candidate.id}/kvs/payoff`]),
      entrancePayoffExitFrameRefs: Object.freeze([`production-preview://${candidate.id}/entrance`,`production-preview://${candidate.id}/payoff`,`production-preview://${candidate.id}/exit`]),
      sourceCompositeFrameRefs: Object.freeze([`production-preview://${candidate.id}/source-composite`]),
    }),
  })
  const engine = createClosedLoopEngineV1(Object.freeze({ id: candidate.source.projectId, revision: candidate.source.projectRevision, scene: candidate.scene }), renderer, input.restoredState)
  const storyboardQaContext = () => Object.freeze({
    availableCapabilities: Object.freeze([candidate.componentId, ...opportunity.requiredCapabilities]),
    availableSourceIds: Object.freeze([candidate.source.assetId]),
    requiredRatio: candidate.scene.supportedAspectRatios[0],
    compositionBounds: Object.freeze({ width: candidate.renderContext.composition.width, height: candidate.renderContext.composition.height }),
    styleConstraint: candidate.authoringMetadata.styleConstraint,
    defaultContentFingerprints: candidate.authoringMetadata.defaultContentFingerprints,
  })
  const workflow: CreativeSceneWorkflowV1 = {
    sceneId: candidate.id,
    planned,
    candidate,
    styleLockId: input.styleLockId,
    creativeLanguageId: input.creativeLanguageId,
    engine,
    initialize: () => {
      if (input.restoredState) return Object.freeze({ ok: true, message: 'Restored persisted Creative scene workflow state.' })
      const board = createStoryboardV1({
        id: `storyboard:${candidate.id}`,
        sourceRevision: candidate.source.projectRevision,
        setup: Object.freeze({
          schemaVersion: 'sanverse.storyboard-presentation-setup/v1' as const,
          sourceRegion: Object.freeze({ startTick: 0, endTick: candidate.source.durationTicks }),
          communicationGoal: opportunity.communicationGoal,
          presentationMode: opportunity.recommendedPresentationMode,
          sourceTreatment: opportunity.recommendedSourceTreatment,
          backgroundTreatment: opportunity.recommendedBackgroundTreatment,
          styleLockId: input.styleLockId,
          preserveSourceAudio: opportunity.preserveSourceAudio,
          preserveSourceVideo: opportunity.preserveSourceVideo,
          requiredCapabilities: Object.freeze([...opportunity.requiredCapabilities]),
        }),
        states: Object.freeze([
          Object.freeze({
            schemaVersion: 'sanverse.key-visual-state/v1' as const,
            id: `${candidate.id}:kvs:opening`,
            semanticPurpose: 'opening' as const,
            approximateTick: 0,
            presentationMode: opportunity.recommendedPresentationMode,
            sourceTreatment: opportunity.recommendedSourceTreatment,
            backgroundTreatment: opportunity.recommendedBackgroundTreatment,
            focusNodeIds: Object.freeze([candidate.selectedNodeId]),
            graphState: candidate.scene,
            // Storyboard/KVS time is local to this Creative region. The exact absolute
            // source span remains canonical on candidate.source; sourceFrameRef is
            // therefore the local frame coordinate used by Storyboard/Animatic QA.
            sourceFrameRef: Object.freeze({ schemaVersion: 'sanverse.source-frame-reference/v1' as const, sourceId: candidate.source.assetId, exactTick: 0 }),
          }),
          Object.freeze({
            schemaVersion: 'sanverse.key-visual-state/v1' as const,
            id: `${candidate.id}:kvs:payoff`,
            semanticPurpose: 'payoff' as const,
            approximateTick: Math.max(0, candidate.source.durationTicks - 1),
            presentationMode: opportunity.recommendedPresentationMode,
            sourceTreatment: opportunity.recommendedSourceTreatment,
            backgroundTreatment: opportunity.recommendedBackgroundTreatment,
            focusNodeIds: Object.freeze([candidate.selectedNodeId]),
            graphState: candidate.scene,
            sourceFrameRef: Object.freeze({ schemaVersion: 'sanverse.source-frame-reference/v1' as const, sourceId: candidate.source.assetId, exactTick: Math.max(0, candidate.source.durationTicks - 1) }),
          }),
        ]),
        status: 'draft' as const,
        revision: 1,
      })
      const created = engine.createStoryboardSandbox(`sandbox:${candidate.id}`, board)
      if (!created.ok) return messageOf(created, '')
      const qa = engine.validateStoryboard(storyboardQaContext())
      return messageOf(qa, 'Storyboard structural QA passed; owner approval remains required for this exact revision.')
    },
    reviseStoryboardOpacity: (opacity, expectedSandboxRevision) => {
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) return Object.freeze({ ok: false, message: 'opacity must be between 0 and 1.' })
      const sandbox = engine.getState().storyboardSandbox
      if (!sandbox) return Object.freeze({ ok: false, message: 'Storyboard sandbox is not initialized.' })
      const state = sandbox.storyboard.states[0]
      if (!state) return Object.freeze({ ok: false, message: 'Storyboard has no editable state.' })
      const revised = engine.reviseStoryboard(Object.freeze({
        transactionId: `scene-opacity:${candidate.id}:r${expectedSandboxRevision}`,
        expectedSandboxRevision,
        stateId: state.id,
        operations: Object.freeze([Object.freeze({
          operationId: `scene-opacity:${candidate.selectedNodeId}:r${expectedSandboxRevision}`,
          type: 'set-property' as const,
          target: Object.freeze({ nodeId: candidate.selectedNodeId, property: 'opacity' as const }),
          value: Object.freeze({ kind: 'constant' as const, value: opacity }),
        })]),
      }))
      if (!revised.ok) return messageOf(revised, '')
      const qa = engine.validateStoryboard(storyboardQaContext())
      return messageOf(qa, `Storyboard revised to sandbox revision ${revised.value.sandboxRevision}; prior approval no longer applies.`)
    },
    reviseStoryboardContent: ({ text, fontSize, expectedSandboxRevision }) => {
      const hasText = typeof text === 'string' && text.trim().length > 0 && text.length <= 240
      const hasFontSize = typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize >= 8 && fontSize <= 320
      if (!hasText && !hasFontSize) return Object.freeze({ ok: false, message: 'Provide bounded text and/or a fontSize from 8 through 320.' })
      const sandbox = engine.getState().storyboardSandbox
      if (!sandbox) return Object.freeze({ ok: false, message: 'Storyboard sandbox is not initialized.' })
      const state = sandbox.storyboard.states[0]
      if (!state) return Object.freeze({ ok: false, message: 'Storyboard has no editable state.' })
      const textNode = Object.values(state.graphState.nodes).find((node) => node.type === 'text')
      if (!textNode) return Object.freeze({ ok: false, message: 'This Storyboard has no text node that can receive the requested localized content revision.' })
      const operations = [] as Array<Readonly<Record<string, unknown>>>
      if (hasText) operations.push(Object.freeze({ operationId: `scene-text:${textNode.id}:r${expectedSandboxRevision}`, type: 'set-property' as const, target: Object.freeze({ nodeId: textNode.id, property: 'text.text' as const }), value: Object.freeze({ kind: 'constant' as const, value: text!.trim() }) }))
      if (hasFontSize) operations.push(Object.freeze({ operationId: `scene-font-size:${textNode.id}:r${expectedSandboxRevision}`, type: 'set-property' as const, target: Object.freeze({ nodeId: textNode.id, property: 'text.fontSize' as const }), value: Object.freeze({ kind: 'constant' as const, value: fontSize! }) }))
      const revised = engine.reviseStoryboard(Object.freeze({ transactionId: `scene-content:${candidate.id}:r${expectedSandboxRevision}`, expectedSandboxRevision, stateId: state.id, operations: Object.freeze(operations) }) as never)
      if (!revised.ok) return messageOf(revised, '')
      const qa = engine.validateStoryboard(storyboardQaContext())
      return messageOf(qa, `Storyboard content revised to sandbox revision ${revised.value.sandboxRevision}; prior approval no longer applies.`)
    },
    inspectStoryboard: () => {
      const state = engine.getState()
      const sandbox = state.storyboardSandbox
      if (!sandbox) return Object.freeze({ ok: false, message: 'Storyboard sandbox is not initialized.' })
      return Object.freeze({ ok: true, message: 'Canonical Storyboard authoring state.', value: Object.freeze({
        sceneId: candidate.id,
        sandboxId: sandbox.id,
        sandboxRevision: sandbox.sandboxRevision,
        locked: sandbox.locks.storyboard,
        styleConstraint: candidate.authoringMetadata.styleConstraint,
        defaultContentFingerprints: candidate.authoringMetadata.defaultContentFingerprints,
        storyboard: Object.freeze({ id: sandbox.storyboard.id, revision: sandbox.storyboard.revision, status: sandbox.storyboard.status, setup: sandbox.storyboard.setup, states: Object.freeze(sandbox.storyboard.states.map((item) => Object.freeze({ id: item.id, semanticPurpose: item.semanticPurpose, approximateTick: item.approximateTick, presentationMode: item.presentationMode, sourceTreatment: item.sourceTreatment, backgroundTreatment: item.backgroundTreatment, focusNodeIds: item.focusNodeIds, graphState: item.graphState }))) }),
        qa: state.storyboardQa,
      }) })
    },
    applyStoryboardGraphOperations: ({ transactionId, expectedSandboxRevision, targets, operations }) => {
      const sandbox = engine.getState().storyboardSandbox
      if (!sandbox) return Object.freeze({ ok: false, message: 'Storyboard sandbox is not initialized.' })
      let states = sandbox.storyboard.states
      if (targets.mode === 'state') states = states.filter((item) => targets.stateIds.includes(item.id))
      else if (targets.mode === 'all-states-containing-node') states = states.filter((item) => Boolean(item.graphState.nodes[targets.nodeId]))
      if (states.length === 0) return Object.freeze({ ok: false, message: 'No Storyboard states matched the requested graph target.' })
      const revised = engine.reviseStoryboardGraphs(Object.freeze({ transactionId, expectedSandboxRevision, edits: Object.freeze(states.map((item) => Object.freeze({ stateId: item.id, operations }))) }))
      if (!revised.ok) return messageOf(revised, '')
      const qa = engine.validateStoryboard(storyboardQaContext())
      const inspection = workflow.inspectStoryboard()
      const affectedNodeIds = Object.freeze([...new Set(operations.flatMap((operation) => {
        const raw = operation as unknown as Record<string, unknown>
        const ids: string[] = []
        const add = (value: unknown): void => { if (typeof value === 'string' && value.trim()) ids.push(value) }
        add(raw.nodeId); add(raw.parentId); add(raw.rootNodeId); add(raw.duplicateId)
        if (raw.target && typeof raw.target === 'object' && !Array.isArray(raw.target)) add((raw.target as Record<string, unknown>).nodeId)
        if (raw.node && typeof raw.node === 'object' && !Array.isArray(raw.node)) add((raw.node as Record<string, unknown>).id)
        if (Array.isArray(raw.nodeIds)) raw.nodeIds.forEach(add)
        return ids
      }))].sort())
      return Object.freeze({ ok: true, message: `Applied ${operations.length} canonical Motion Graph operation(s) across ${states.length} Storyboard state(s); sandbox revision is ${revised.value.sandboxRevision}.`, value: Object.freeze({ sandboxRevision: revised.value.sandboxRevision, storyboardRevision: revised.value.storyboard.revision, affectedStateIds: Object.freeze(states.map((state) => state.id)), affectedNodeIds, qa: qa.ok ? qa.value : null, storyboard: inspection.ok ? inspection.value : null }) })
    },
    applyStoryboardDesign: ({ transactionId, expectedSandboxRevision, graphEdits, sandboxOperations }) => {
      const revised = engine.applyStoryboardDesign(Object.freeze({ transactionId, expectedSandboxRevision, ...(graphEdits ? { graphEdits } : {}), ...(sandboxOperations ? { sandboxOperations } : {}) }))
      if (!revised.ok) return messageOf(revised, '')
      const qa = engine.validateStoryboard(storyboardQaContext())
      const inspection = workflow.inspectStoryboard()
      const affectedStateIds = Object.freeze([...new Set([...(graphEdits ?? []).map((edit) => edit.stateId), ...(sandboxOperations ?? []).flatMap((operation) => operation.type === 'add-state' ? [operation.state.id] : 'stateId' in operation ? [operation.stateId] : [])])].sort())
      const affectedNodeIds = Object.freeze([...new Set((graphEdits ?? []).flatMap((edit) => edit.operations.flatMap((operation) => {
        const raw = operation as unknown as Record<string, unknown>
        const ids: string[] = []
        const add = (value: unknown): void => { if (typeof value === 'string' && value.trim()) ids.push(value) }
        add(raw.nodeId); add(raw.parentId); add(raw.rootNodeId); add(raw.duplicateId)
        if (raw.target && typeof raw.target === 'object' && !Array.isArray(raw.target)) add((raw.target as Record<string, unknown>).nodeId)
        if (raw.node && typeof raw.node === 'object' && !Array.isArray(raw.node)) add((raw.node as Record<string, unknown>).id)
        if (Array.isArray(raw.nodeIds)) raw.nodeIds.forEach(add)
        return ids
      })))].sort())
      return Object.freeze({ ok: true, message: `Atomic Storyboard design transaction committed at sandbox revision ${revised.value.sandboxRevision}; prior approval no longer applies.`, value: Object.freeze({ sandboxRevision: revised.value.sandboxRevision, storyboardRevision: revised.value.storyboard.revision, affectedStateIds, affectedNodeIds, qa: qa.ok ? qa.value : null, storyboard: inspection.ok ? inspection.value : null }) })
    },
    reopenStoryboard: (expectedSandboxRevision) => {
      const reopened = engine.reopenStoryboard(expectedSandboxRevision)
      if (!reopened.ok) return messageOf(reopened, '')
      const qa = engine.validateStoryboard(storyboardQaContext())
      const inspection = workflow.inspectStoryboard()
      return Object.freeze({ ok: true, message: `Storyboard reopened for authoring at sandbox revision ${reopened.value.sandboxRevision}; all downstream approval lineage was invalidated.`, value: Object.freeze({ sandboxRevision: reopened.value.sandboxRevision, storyboardRevision: reopened.value.storyboard.revision, qa: qa.ok ? qa.value : null, storyboard: inspection.ok ? inspection.value : null }) })
    },
    advanceAfterStoryboardApproval: () => {
      const state = engine.getState()
      const board = state.storyboardSandbox?.storyboard
      if (!board || board.status !== 'owner-approved') return Object.freeze({ ok: false, message: 'Approve the exact Storyboard revision first.' })
      const midpoint = Math.max(1, Math.floor(candidate.source.durationTicks / 2))
      const animatic = engine.buildAnimatic({
        id: `animatic:${candidate.id}`,
        timings: Object.freeze([
          { stateId: board.states[0]!.id, startTick: 0, endTick: midpoint },
          { stateId: board.states[1]!.id, startTick: midpoint, endTick: candidate.source.durationTicks },
        ]),
        sourceAudioRef: Object.freeze({ sourceId: candidate.source.assetId }),
      })
      if (!animatic.ok) return messageOf(animatic, '')
      const qa = engine.validateAnimatic({ minimumReadableHoldTicks: Math.min(240_000, Math.floor(candidate.source.durationTicks / 4)), sourceRegion: board.setup.sourceRegion, ticksPerSecond: candidate.renderContext.ticksPerSecond })
      return messageOf(qa, 'Animatic exact-tick QA passed; owner approval remains required for this exact revision.')
    },
    advanceAfterAnimaticApproval: () => {
      const state = engine.getState()
      if (state.animatic?.status !== 'owner-approved') return Object.freeze({ ok: false, message: 'Approve the exact Animatic revision first.' })
      const plan = engine.buildMotionPlan({ id: `motion-plan:${candidate.id}`, styleLockId: input.styleLockId })
      if (!plan.ok) return messageOf(plan, '')
      const draft = engine.buildMotionDraft({ id: `motion-draft:${candidate.id}` })
      if (!draft.ok) return messageOf(draft, '')
      const qa = engine.validateMotion({
        durationTicks: candidate.source.durationTicks,
        ticksPerSecond: candidate.renderContext.ticksPerSecond,
        composition: candidate.renderContext.composition,
        sampleTicks: Object.freeze([0, Math.floor(candidate.source.durationTicks / 3), Math.floor(candidate.source.durationTicks * 2 / 3), Math.max(0, candidate.source.durationTicks - 1)]),
        expectedSemanticNodeIds: Object.freeze([candidate.selectedNodeId]),
        availableCapabilities: Object.freeze([candidate.componentId, ...opportunity.requiredCapabilities]),
        requiredCapabilities: Object.freeze([...opportunity.requiredCapabilities]),
      })
      return messageOf(qa, 'Motion Forge produced a canonical Motion Graph draft; canonical review evidence is still required before owner approval.')
    },
    prepareMotionReview: async () => {
      const draft = engine.getState().motionDraft
      if (!draft) return Object.freeze({ ok: false, message: 'Build Motion output first.' })
      const review = await engine.renderReview({ stage: 'motion', subjectId: draft.id, subjectRevision: draft.revision, startTick: 0, endTick: candidate.source.durationTicks, criticalTicks: Object.freeze([0, Math.floor(candidate.source.durationTicks / 2), Math.max(0, candidate.source.durationTicks - 1)]) })
      return messageOf(review, 'Canonical Motion review evidence is ready for this exact draft revision.')
    },
    recordResolvedOwnerApproval: (approval) => messageOf(engine.recordOwnerApproval(approval), `${approval.scope} revision ${approval.subjectRevision} received host-resolved owner approval.`),
    state: () => engine.getState(),
  }
  return Object.freeze(workflow)
}

const sceneSummary = (workflow: CreativeSceneWorkflowV1) => {
  const state = workflow.state()
  const sandbox = state.storyboardSandbox
  return Object.freeze({
    sceneId: workflow.sceneId,
    opportunityId: workflow.planned.opportunity.id,
    componentId: workflow.candidate.componentId,
    sourceStartTick: workflow.planned.opportunity.sourceStartTick,
    sourceEndTick: workflow.planned.opportunity.sourceEndTick,
    selectedNodeId: workflow.candidate.selectedNodeId,
    storyboard: sandbox ? Object.freeze({ id: sandbox.storyboard.id, revision: sandbox.storyboard.revision, status: sandbox.storyboard.status, sandboxRevision: sandbox.sandboxRevision }) : null,
    animatic: state.animatic ? Object.freeze({ id: state.animatic.id, revision: state.animatic.revision, status: state.animatic.status }) : null,
    motion: state.motionDraft ? Object.freeze({ id: state.motionDraft.id, revision: state.motionDraft.revision, status: state.motionDraft.status, reviewReady: Boolean(state.visualEvidence) }) : null,
  })
}

export const createCreativeSceneBatchV1 = (input: Readonly<{
  project: EditProject
  opportunityMap: MotionOpportunityMapV1
  transcriptTextByOpportunityId?: Readonly<Record<string, string>>
  restored?: PersistedCreativeSceneBatchV1
}>): CreateCreativeSceneBatchResultV1 => {
  if (input.project.projectId !== input.opportunityMap.projectId || input.project.revision !== input.opportunityMap.projectRevision) return Object.freeze({ ok: false as const, refusal: Object.freeze({ code: 'OPPORTUNITY_MAP_STALE', message: 'The opportunity map must target the exact current production project revision.' }) })
  const batchId = input.restored?.id ?? `scenebatch_${tail(`${input.project.projectId}:${input.project.revision}:${input.opportunityMap.id}`)}`
  if (input.restored && (input.restored.projectId !== input.project.projectId || input.restored.projectRevision !== input.project.revision || input.restored.opportunityMapId !== input.opportunityMap.id)) return Object.freeze({ ok: false as const, refusal: Object.freeze({ code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Persisted scene batch identity/revision does not match the current project and opportunity map.' }) })
  const workflows = new Map<string, CreativeSceneWorkflowV1>()
  const pending = new Map<string, HostApprovalRequestV1>((input.restored?.pendingApprovalRequests ?? []).map((request) => [request.requestRef, request]))
  const restoredBySceneId = new Map((input.restored?.workflows ?? []).map((item) => [item.sceneId, item]))
  const styleConstraint = storyboardStyleConstraint(input.opportunityMap)
  for (const planned of input.opportunityMap.opportunities) {
    const deterministic = buildGenericCreativeSceneCandidateV1({ project: input.project, planned, styleConstraint, contentText: input.transcriptTextByOpportunityId?.[planned.opportunity.id] })
    if (!deterministic.ok) return Object.freeze({ ok: false as const, refusal: deterministic.refusal })
    const restored = restoredBySceneId.get(deterministic.value.id)
    const restoredCandidate = restored?.candidate
    const candidate: GenericCreativeSceneCandidateV1 = restoredCandidate
      ? Object.freeze({ ...restoredCandidate, authoringMetadata: restoredCandidate.authoringMetadata ?? deterministic.value.authoringMetadata })
      : deterministic.value
    if (restored && (candidate.id !== deterministic.value.id || candidate.opportunityId !== planned.opportunity.id || candidate.source.projectId !== input.project.projectId || candidate.source.projectRevision !== input.project.revision)) return Object.freeze({ ok: false as const, refusal: Object.freeze({ code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: `Persisted scene ${restored.sceneId} does not match deterministic project/opportunity identity.` }) })
    const workflow = createCreativeSceneWorkflowV1({ planned, candidate, styleLockId: input.opportunityMap.styleLockId, creativeLanguageId: input.opportunityMap.creativeLanguage.id, ...(restored ? { restoredState: restored.engineState } : {}) })
    const initialized = workflow.initialize()
    if (!initialized.ok) return Object.freeze({ ok: false as const, refusal: Object.freeze({ code: restored ? 'CREATIVE_RUN_REHYDRATION_FAILED' : 'SCENE_STORYBOARD_INITIALIZATION_FAILED', message: initialized.message, details: Object.freeze({ opportunityId: planned.opportunity.id, componentId: candidate.componentId }) }) })
    workflows.set(workflow.sceneId, workflow)
  }
  if (input.restored && restoredBySceneId.size !== workflows.size) return Object.freeze({ ok: false as const, refusal: Object.freeze({ code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Persisted scene count does not match deterministic opportunity-map scene count.' }) })
  const invalidateStaleRequests = () => {
    for (const [ref, request] of pending) {
      const workflow = workflows.get(request.sceneId)
      const target = workflow ? currentTarget(workflow.state(), request.scope) : null
      if (!target || target.id !== request.subjectId || target.revision !== request.subjectRevision) pending.delete(ref)
    }
  }
  const snapshot = (): CreativeSceneBatchSnapshotV1 => {
    invalidateStaleRequests()
    const scenes = Object.freeze([...workflows.values()].map(sceneSummary).sort((a, b) => a.sourceStartTick - b.sourceStartTick || a.sceneId.localeCompare(b.sceneId)))
    return Object.freeze({
      schemaVersion: CREATIVE_SCENE_BATCH_SCHEMA_V1,
      id: batchId,
      opportunityMapId: input.opportunityMap.id,
      projectId: input.project.projectId,
      projectRevision: input.project.revision,
      scenes,
      pendingApprovalRequests: Object.freeze([...pending.values()].sort((a, b) => a.sceneId.localeCompare(b.sceneId))),
      readyForProductionApply: scenes.length > 0 && scenes.every((scene) => scene.motion?.status === 'owner-approved' && scene.motion.reviewReady),
    })
  }
  const batch: CreativeSceneBatchV1 = {
    id: batchId,
    projectId: input.project.projectId,
    projectRevision: input.project.revision,
    opportunityMap: input.opportunityMap,
    get sceneIds() { return Object.freeze([...workflows.keys()]) },
    getWorkflow: (sceneId) => workflows.get(sceneId) ?? null,
    snapshot,
    serialize: () => Object.freeze({
      schemaVersion: 'sanverse.persisted-creative-scene-batch/v1' as const,
      id: batchId,
      projectId: input.project.projectId,
      projectRevision: input.project.revision,
      opportunityMapId: input.opportunityMap.id,
      workflows: Object.freeze([...workflows.values()].map((workflow) => Object.freeze({
        schemaVersion: 'sanverse.persisted-creative-scene-workflow/v1' as const,
        sceneId: workflow.sceneId,
        candidate: workflow.candidate,
        engineState: workflow.state(),
      })).sort((a, b) => a.sceneId.localeCompare(b.sceneId))),
      pendingApprovalRequests: Object.freeze([...pending.values()].sort((a, b) => a.requestRef.localeCompare(b.requestRef))),
    }),
    requestOwnerReviews: (scope, now = new Date().toISOString()) => {
      invalidateStaleRequests()
      const requests: HostApprovalRequestV1[] = []
      for (const workflow of workflows.values()) {
        const target = currentTarget(workflow.state(), scope)
        if (target && 'status' in target && target.status === 'owner-approved') continue
        const packet = workflow.engine.requestOwnerReview(scope)
        if (!packet.ok) return Object.freeze({ ok: false, message: `${workflow.sceneId}: ${packet.refusal.message}` })
        if (!packet.value.qaPassed) {
          const state = workflow.state()
          const findings = scope === 'storyboard' ? state.storyboardQa?.findings : scope === 'animatic' ? state.animaticQa?.findings : state.motionQa?.findings
          const blocking = findings?.find((item) => 'severity' in item ? item.severity === 'error' : true) ?? findings?.[0]
          const detail = blocking ? ` ${blocking.code}: ${blocking.message}` : ''
          return Object.freeze({ ok: false, message: `${workflow.sceneId}: ${scope} QA has not passed for the exact revision.${detail}` })
        }
        if (scope === 'motion' && !packet.value.evidence) return Object.freeze({ ok: false, message: `${workflow.sceneId}: canonical motion review evidence is required before owner review.` })
        const requestRef = `approvalreq_${tail(`${batchId}:${workflow.sceneId}:${scope}:${packet.value.subjectId}:${packet.value.subjectRevision}`)}`
        const existing = pending.get(requestRef)
        const request = existing ?? Object.freeze({
          schemaVersion: 'sanverse.host-approval-request/v1' as const,
          requestRef,
          batchId,
          sceneId: workflow.sceneId,
          scope,
          subjectId: packet.value.subjectId,
          subjectRevision: packet.value.subjectRevision,
          issuedAt: now,
        })
        pending.set(requestRef, request)
        requests.push(request)
      }
      return Object.freeze({ ok: true, message: `Issued ${requests.length} host approval request(s) for exact ${scope} revisions.`, requests: Object.freeze(requests) })
    },
    resolveOwnerApproval: async (requestRef, resolver) => {
      invalidateStaleRequests()
      const request = pending.get(requestRef)
      if (!request) return Object.freeze({ ok: false, message: 'Approval request is unknown or stale; request review for the current exact revision.' })
      const workflow = workflows.get(request.sceneId)
      if (!workflow) return Object.freeze({ ok: false, message: 'Approval request scene is unavailable.' })
      const target = currentTarget(workflow.state(), request.scope)
      if (!target || target.id !== request.subjectId || target.revision !== request.subjectRevision) { pending.delete(requestRef); return Object.freeze({ ok: false, message: 'Approval request became stale because the scene revision changed.' }) }
      const approval = await resolver(request)
      if (!approval) return Object.freeze({ ok: true, approved: false, message: 'Host resolver has no owner approval for this exact request yet.' })
      const valid = validateOwnerApprovalV1(approval)
      if (!valid.ok) return Object.freeze({ ok: false, message: `Host resolver returned an invalid approval: ${valid.refusal.message}` })
      if (approval.scope !== request.scope || approval.subjectId !== request.subjectId || approval.subjectRevision !== request.subjectRevision) return Object.freeze({ ok: false, message: 'Host resolver approval does not match the exact scope/subject/revision of the issued request.' })
      if (approval.id.includes('*') || approval.subjectId.includes('*')) return Object.freeze({ ok: false, message: 'Wildcard approvals are never accepted.' })
      const recorded = workflow.recordResolvedOwnerApproval(approval)
      if (!recorded.ok) return Object.freeze({ ok: false, message: recorded.message })
      pending.delete(requestRef)
      return Object.freeze({ ok: true, approved: true, message: recorded.message })
    },
    advanceAll: async (stage) => {
      invalidateStaleRequests()
      if (stage === 'animatic') {
        let built = 0
        for (const workflow of workflows.values()) {
          if (workflow.state().animatic) continue
          const result = workflow.advanceAfterStoryboardApproval()
          if (!result.ok) return Object.freeze({ ok: false, message: `${workflow.sceneId}: ${result.message}` })
          built += 1
        }
        return Object.freeze({ ok: true, message: `Built and structurally validated ${built} new animatic(s); already-advanced scenes were left untouched.` })
      }
      let built = 0
      let reviewed = 0
      for (const workflow of workflows.values()) {
        if (!workflow.state().motionDraft) {
          const result = workflow.advanceAfterAnimaticApproval()
          if (!result.ok) return Object.freeze({ ok: false, message: `${workflow.sceneId}: ${result.message}` })
          built += 1
        }
        if (!workflow.state().visualEvidence) {
          const review = await workflow.prepareMotionReview()
          if (!review.ok) return Object.freeze({ ok: false, message: `${workflow.sceneId}: ${review.message}` })
          reviewed += 1
        }
      }
      return Object.freeze({ ok: true, message: `Built ${built} new Motion draft(s) and prepared ${reviewed} new review packet(s); already-advanced scenes were left untouched.` })
    },
    reviseSceneOpacity: (sceneId, opacity, expectedSandboxRevision) => {
      invalidateStaleRequests()
      const workflow = workflows.get(sceneId)
      if (!workflow) return Object.freeze({ ok: false, message: 'Scene is not part of this batch.' })
      const result = workflow.reviseStoryboardOpacity(opacity, expectedSandboxRevision)
      invalidateStaleRequests()
      return result
    },
    reviseSceneStoryboard: (sceneId, revisionInput) => {
      invalidateStaleRequests()
      const workflow = workflows.get(sceneId)
      if (!workflow) return Object.freeze({ ok: false, message: 'Scene is not part of this batch.' })
      const result = workflow.reviseStoryboardContent(revisionInput)
      invalidateStaleRequests()
      return result
    },
    excludeScene: (sceneId) => {
      const workflow = workflows.get(sceneId)
      if (!workflow) return Object.freeze({ ok: false, message: 'Scene is not part of this batch.' })
      workflows.delete(sceneId)
      for (const [ref, request] of pending) if (request.sceneId === sceneId) pending.delete(ref)
      return Object.freeze({ ok: true, message: `Scene ${sceneId} is excluded from later stages; other scenes are unchanged.` })
    },
  }
  return Object.freeze({ ok: true as const, value: Object.freeze(batch) })
}
