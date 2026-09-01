import {
  assessPresentationModeCapabilitiesV1,
  assessSourceTreatmentCapabilitiesV1,
  creativeOperationOk,
  creativeOperationRefusal,
  type CreativeOperationResultV1,
  type MotionAspectRatio,
} from '@sanverse/motion-contract'
import {
  applyMotionOperations,
  validateMotionAuthoringBudgetV1,
  validateMotionScene,
  type MotionGraphOperationV1,
  type MotionSceneV1,
} from '@sanverse/motion-graph'
import { validateOwnerApprovalV1, type KeyVisualStateV1, type OwnerApprovalV1, type StoryboardV1 } from './contracts.ts'
import {
  applyStoryboardSandboxTransactionV1,
  type AppliedStoryboardSandboxTransactionV1,
  type StoryboardSandboxOperationV1,
  type StoryboardSandboxV1,
} from './sandbox.ts'

export interface StoryboardTransitionInspectionV1 {
  readonly fromStateId: string
  readonly toStateId: string
  readonly fromTick: number
  readonly toTick: number
  readonly addedFocusNodeIds: readonly string[]
  readonly removedFocusNodeIds: readonly string[]
  readonly presentationModeChanged: boolean
  readonly sourceTreatmentChanged: boolean
  readonly backgroundTreatmentChanged: boolean
}

export interface ReviseStoryboardStateGraphInputV1 {
  readonly transactionId: string
  readonly expectedSandboxRevision: number
  readonly stateId: string
  readonly operations: readonly MotionGraphOperationV1[]
}

export interface StoryboardGraphStateEditV1 {
  readonly stateId: string
  readonly operations: readonly MotionGraphOperationV1[]
}

export interface ReviseStoryboardGraphsInputV1 {
  readonly transactionId: string
  readonly expectedSandboxRevision: number
  readonly edits: readonly StoryboardGraphStateEditV1[]
}

export type StoryboardStateTargetV1 =
  | Readonly<{ mode: 'state'; stateIds: readonly string[] }>
  | Readonly<{ mode: 'all-states' }>
  | Readonly<{ mode: 'all-states-containing-node'; nodeId: string }>

export interface ApplyStoryboardGraphOperationsInputV1 {
  readonly transactionId: string
  readonly expectedSandboxRevision: number
  readonly targets: StoryboardStateTargetV1
  readonly operations: readonly MotionGraphOperationV1[]
}

export interface ApplyStoryboardDesignTransactionInputV1 {
  readonly transactionId: string
  readonly expectedSandboxRevision: number
  readonly graphEdits?: readonly StoryboardGraphStateEditV1[]
  readonly sandboxOperations?: readonly StoryboardSandboxOperationV1[]
}

export interface RefineStoryboardTransitionInputV1 {
  readonly transactionId: string
  readonly expectedSandboxRevision: number
  readonly fromStateId: string
  readonly toStateId: string
  readonly stateId: string
  readonly approximateTick: number
  readonly operations: readonly MotionGraphOperationV1[]
  readonly notes?: string
}

export type StoryboardQaSeverityV1 = 'warning' | 'error'
export type StoryboardQaCodeV1 =
  | 'INVALID_STATE_ORDER'
  | 'DUPLICATE_STATE_ID'
  | 'BROKEN_SEMANTIC_NODE_ID'
  | 'MISSING_MEDIA'
  | 'OVERFLOW'
  | 'UNSAFE_BOUNDS'
  | 'INVALID_SOURCE_FRAME'
  | 'UNSUPPORTED_PRESENTATION_CAPABILITY'
  | 'INVALID_SOURCE_TREATMENT'
  | 'INCONSISTENT_FOCUS_IDS'
  | 'BAD_GRAPH_SNAPSHOT'
  | 'INVALID_RATIO'
  | 'STYLE_HARD_CONSTRAINT'
  | 'STYLE_SOFT_DEVIATION'
  | 'DEFAULT_CONTENT_UNBOUND'

export interface StoryboardQaFindingV1 {
  readonly code: StoryboardQaCodeV1
  readonly severity: StoryboardQaSeverityV1
  readonly message: string
  readonly stateIds: readonly string[]
  readonly nodeIds: readonly string[]
}

export interface StoryboardStyleConstraintV1 {
  readonly schemaVersion: 'sanverse.storyboard-style-constraint/v1'
  readonly styleLockId: string
  readonly hard: Readonly<{
    allowedColors?: readonly string[]
    allowedFontFamilies?: readonly string[]
  }>
  readonly soft: Readonly<{
    preferredPresentationModes?: readonly string[]
    maximumRadius?: number
    maximumNodesPerState?: number
  }>
}

export interface StoryboardStructuralQaContextV1 {
  readonly availableCapabilities: readonly string[]
  readonly availableSourceIds?: readonly string[]
  readonly availableAssetRefs?: readonly string[]
  readonly requiredRatio?: MotionAspectRatio
  readonly compositionBounds?: Readonly<{ width: number; height: number }>
  readonly styleConstraint?: StoryboardStyleConstraintV1
  /** Component/default strings which must not survive into an authored Storyboard. */
  readonly defaultContentFingerprints?: readonly string[]
}

export interface StoryboardStructuralQaReportV1 {
  readonly ok: boolean
  readonly findings: readonly StoryboardQaFindingV1[]
}

const finding = (code: StoryboardQaCodeV1, message: string, stateIds: readonly string[] = [], nodeIds: readonly string[] = [], severity: StoryboardQaSeverityV1 = 'error'): StoryboardQaFindingV1 => Object.freeze({ code, severity, message, stateIds: Object.freeze([...stateIds]), nodeIds: Object.freeze([...nodeIds]) })
const constantNumber = (value: unknown): number | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return record.kind === 'constant' && typeof record.value === 'number' && Number.isFinite(record.value) ? record.value : null
}
const constantString = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return record.kind === 'constant' && typeof record.value === 'string' ? record.value : null
}
const normalizedStyleString = (value: string): string => value.trim().toLowerCase()

export const inspectStoryboardTransitionV1 = (storyboard: StoryboardV1, fromStateId: string, toStateId: string): CreativeOperationResultV1<StoryboardTransitionInspectionV1> => {
  const fromIndex = storyboard.states.findIndex((state) => state.id === fromStateId)
  const toIndex = storyboard.states.findIndex((state) => state.id === toStateId)
  if (fromIndex < 0 || toIndex < 0) return creativeOperationRefusal('STORYBOARD_STATE_NOT_FOUND', 'Both transition state IDs must exist.')
  if (toIndex <= fromIndex) return creativeOperationRefusal('INVALID_TRANSITION_ORDER', 'toStateId must follow fromStateId in storyboard order.')
  const from = storyboard.states[fromIndex]!
  const to = storyboard.states[toIndex]!
  const fromFocus = new Set(from.focusNodeIds)
  const toFocus = new Set(to.focusNodeIds)
  return creativeOperationOk(Object.freeze({
    fromStateId,
    toStateId,
    fromTick: from.approximateTick,
    toTick: to.approximateTick,
    addedFocusNodeIds: Object.freeze(to.focusNodeIds.filter((id) => !fromFocus.has(id))),
    removedFocusNodeIds: Object.freeze(from.focusNodeIds.filter((id) => !toFocus.has(id))),
    presentationModeChanged: from.presentationMode !== to.presentationMode,
    sourceTreatmentChanged: from.sourceTreatment !== to.sourceTreatment,
    backgroundTreatmentChanged: from.backgroundTreatment !== to.backgroundTreatment,
  }), storyboard.revision)
}

const applyGraphOperations = (scene: MotionSceneV1, operations: readonly MotionGraphOperationV1[]) => applyMotionOperations(scene, operations)
const STORYBOARD_AUTHORING_MAX_STATES = 24
const STORYBOARD_AUTHORING_MAX_OPERATIONS = 512

export const reviseStoryboardGraphsV1 = (sandbox: StoryboardSandboxV1, input: ReviseStoryboardGraphsInputV1): CreativeOperationResultV1<AppliedStoryboardSandboxTransactionV1> => {
  if (input.expectedSandboxRevision !== sandbox.sandboxRevision) return creativeOperationRefusal('STALE_SANDBOX_REVISION', `Expected sandbox revision ${input.expectedSandboxRevision}; current revision is ${sandbox.sandboxRevision}.`)
  if (sandbox.locks.storyboard) return creativeOperationRefusal('STORYBOARD_LOCKED', 'Storyboard is owner-approved and locked; reopen it before design mutation.')
  if (input.edits.length === 0) return creativeOperationRefusal('STORYBOARD_GRAPH_EDIT_EMPTY', 'At least one Storyboard graph edit is required.')
  if (input.edits.length > STORYBOARD_AUTHORING_MAX_STATES) return creativeOperationRefusal('AUTHORING_BUDGET_EXCEEDED', `A Storyboard authoring transaction may target at most ${STORYBOARD_AUTHORING_MAX_STATES} states.`)
  const stateIds = input.edits.map((edit) => edit.stateId)
  if (new Set(stateIds).size !== stateIds.length) return creativeOperationRefusal('STORYBOARD_GRAPH_EDIT_INVALID', 'Each Storyboard state may appear at most once in one graph transaction; combine its canonical operations first.')
  const operationCount = input.edits.reduce((sum, edit) => sum + edit.operations.length, 0)
  if (operationCount === 0) return creativeOperationRefusal('STORYBOARD_GRAPH_EDIT_EMPTY', 'At least one canonical Motion Graph operation is required.')
  if (operationCount > STORYBOARD_AUTHORING_MAX_OPERATIONS) return creativeOperationRefusal('AUTHORING_BUDGET_EXCEEDED', `A Storyboard authoring transaction may contain at most ${STORYBOARD_AUTHORING_MAX_OPERATIONS} graph operations.`)
  const replacements: StoryboardSandboxOperationV1[] = []
  for (const edit of input.edits) {
    if (edit.operations.length === 0) return creativeOperationRefusal('STORYBOARD_GRAPH_EDIT_EMPTY', `State ${edit.stateId} has no graph operations.`)
    const state = sandbox.storyboard.states.find((candidate) => candidate.id === edit.stateId)
    if (!state) return creativeOperationRefusal('STORYBOARD_STATE_NOT_FOUND', `Unknown state: ${edit.stateId}`)
    const result = applyGraphOperations(state.graphState, edit.operations)
    if (!result.ok) return creativeOperationRefusal('STORYBOARD_GRAPH_EDIT_REFUSED', `State ${state.id}: ${result.error.message}`, result.error)
    const budget = validateMotionAuthoringBudgetV1(result.scene)
    if (!budget.ok) return creativeOperationRefusal('AUTHORING_BUDGET_EXCEEDED', `State ${state.id}: ${budget.findings.join(' ')}`, budget)
    replacements.push(Object.freeze({ type: 'replace-state' as const, stateId: state.id, state: Object.freeze({ ...state, graphState: result.scene }) }))
  }
  return applyStoryboardSandboxTransactionV1(sandbox, Object.freeze({ transactionId: input.transactionId, expectedSandboxRevision: input.expectedSandboxRevision, operations: Object.freeze(replacements) }))
}

export const reviseStoryboardStateGraphV1 = (sandbox: StoryboardSandboxV1, input: ReviseStoryboardStateGraphInputV1): CreativeOperationResultV1<AppliedStoryboardSandboxTransactionV1> => reviseStoryboardGraphsV1(sandbox, Object.freeze({
  transactionId: input.transactionId,
  expectedSandboxRevision: input.expectedSandboxRevision,
  edits: Object.freeze([{ stateId: input.stateId, operations: input.operations }]),
}))

export const applyStoryboardGraphOperationsV1 = (sandbox: StoryboardSandboxV1, input: ApplyStoryboardGraphOperationsInputV1): CreativeOperationResultV1<AppliedStoryboardSandboxTransactionV1> => {
  let states: readonly KeyVisualStateV1[]
  if (input.targets.mode === 'state') {
    if (input.targets.stateIds.length === 0 || new Set(input.targets.stateIds).size !== input.targets.stateIds.length) return creativeOperationRefusal('STORYBOARD_STATE_TARGET_INVALID', 'state target needs one or more unique stateIds.')
    const requested = new Set(input.targets.stateIds)
    states = sandbox.storyboard.states.filter((state) => requested.has(state.id))
    if (states.length !== requested.size) return creativeOperationRefusal('STORYBOARD_STATE_NOT_FOUND', 'One or more requested Storyboard states do not exist.')
  } else if (input.targets.mode === 'all-states') states = sandbox.storyboard.states
  else {
    const nodeId=input.targets.nodeId
    if (!nodeId.trim()) return creativeOperationRefusal('STORYBOARD_STATE_TARGET_INVALID', 'all-states-containing-node requires nodeId.')
    states = sandbox.storyboard.states.filter((state) => Boolean(state.graphState.nodes[nodeId]))
    if (states.length === 0) return creativeOperationRefusal('STORYBOARD_STATE_NOT_FOUND', `No Storyboard state contains node ${nodeId}.`)
  }
  return reviseStoryboardGraphsV1(sandbox, Object.freeze({ transactionId: input.transactionId, expectedSandboxRevision: input.expectedSandboxRevision, edits: Object.freeze(states.map((state) => Object.freeze({ stateId: state.id, operations: input.operations }))) }))
}

export const applyStoryboardDesignTransactionV1 = (sandbox: StoryboardSandboxV1, input: ApplyStoryboardDesignTransactionInputV1): CreativeOperationResultV1<AppliedStoryboardSandboxTransactionV1> => {
  if (input.expectedSandboxRevision !== sandbox.sandboxRevision) return creativeOperationRefusal('STALE_SANDBOX_REVISION', `Expected sandbox revision ${input.expectedSandboxRevision}; current revision is ${sandbox.sandboxRevision}.`)
  if (sandbox.locks.storyboard) return creativeOperationRefusal('STORYBOARD_LOCKED', 'Storyboard is owner-approved and locked; reopen it before design mutation.')
  const graphEdits = input.graphEdits ?? []
  const sandboxOperations = input.sandboxOperations ?? []
  if (graphEdits.length === 0 && sandboxOperations.length === 0) return creativeOperationRefusal('SANDBOX_TRANSACTION_INVALID', 'Design transaction requires graph and/or Storyboard sandbox operations.')
  if (sandboxOperations.length > STORYBOARD_AUTHORING_MAX_OPERATIONS) return creativeOperationRefusal('AUTHORING_BUDGET_EXCEEDED', `A design transaction may contain at most ${STORYBOARD_AUTHORING_MAX_OPERATIONS} Storyboard operations.`)
  const graphResult = graphEdits.length > 0 ? reviseStoryboardGraphsV1(sandbox, Object.freeze({ transactionId: `${input.transactionId}:graph-compile`, expectedSandboxRevision: input.expectedSandboxRevision, edits: graphEdits })) : null
  if (graphResult && !graphResult.ok) return graphResult
  const graphOperations = graphResult?.value.sandbox.storyboard.states.map((state) => {
    const original = sandbox.storyboard.states.find((candidate) => candidate.id === state.id)
    return original && original.graphState !== state.graphState ? Object.freeze({ type: 'replace-state' as const, stateId: state.id, state }) : null
  }).filter((operation): operation is Extract<StoryboardSandboxOperationV1, { type: 'replace-state' }> => Boolean(operation)) ?? []
  const touchedStateIds = new Set(graphOperations.map((operation) => operation.stateId))
  for (const operation of sandboxOperations) if ((operation.type === 'replace-state' || operation.type === 'remove-state') && touchedStateIds.has(operation.stateId)) return creativeOperationRefusal('SANDBOX_TRANSACTION_INVALID', `State ${operation.stateId} cannot be graph-edited and separately replaced/removed in the same design transaction.`)
  return applyStoryboardSandboxTransactionV1(sandbox, Object.freeze({ transactionId: input.transactionId, expectedSandboxRevision: input.expectedSandboxRevision, operations: Object.freeze([...graphOperations, ...sandboxOperations]) }))
}

export const refineStoryboardTransitionV1 = (sandbox: StoryboardSandboxV1, input: RefineStoryboardTransitionInputV1): CreativeOperationResultV1<AppliedStoryboardSandboxTransactionV1> => {
  if (input.expectedSandboxRevision !== sandbox.sandboxRevision) return creativeOperationRefusal('STALE_SANDBOX_REVISION', `Expected sandbox revision ${input.expectedSandboxRevision}; current revision is ${sandbox.sandboxRevision}.`)
  if (!input.stateId.trim() || sandbox.storyboard.states.some((state) => state.id === input.stateId)) return creativeOperationRefusal('DUPLICATE_STATE_ID', 'Refined transition state requires a new stable state id.')
  const fromIndex = sandbox.storyboard.states.findIndex((state) => state.id === input.fromStateId)
  const toIndex = sandbox.storyboard.states.findIndex((state) => state.id === input.toStateId)
  if (fromIndex < 0 || toIndex < 0 || toIndex <= fromIndex) return creativeOperationRefusal('INVALID_TRANSITION_ORDER', 'Refinement requires existing ordered from/to states.')
  const from = sandbox.storyboard.states[fromIndex]!
  const to = sandbox.storyboard.states[toIndex]!
  if (!Number.isSafeInteger(input.approximateTick) || input.approximateTick <= from.approximateTick || input.approximateTick >= to.approximateTick) return creativeOperationRefusal('INVALID_TRANSITION_TICK', 'Refined KVS tick must fall strictly between the neighboring KVS ticks.')
  const result = applyGraphOperations(from.graphState, input.operations)
  if (!result.ok) return creativeOperationRefusal('STORYBOARD_GRAPH_EDIT_REFUSED', result.error.message, result.error)
  const nextState: KeyVisualStateV1 = Object.freeze({
    ...from,
    id: input.stateId,
    semanticPurpose: 'custom',
    approximateTick: input.approximateTick,
    graphState: result.scene,
    previousStateId: from.id,
    nextStateId: to.id,
    ...(input.notes ? { notes: input.notes } : {}),
  })
  return applyStoryboardSandboxTransactionV1(sandbox, Object.freeze({
    transactionId: input.transactionId,
    expectedSandboxRevision: input.expectedSandboxRevision,
    operations: Object.freeze([{ type: 'add-state' as const, state: nextState, index: fromIndex + 1 }]),
  }))
}

export const runStoryboardStructuralQaV1 = (storyboard: StoryboardV1, context: StoryboardStructuralQaContextV1): StoryboardStructuralQaReportV1 => {
  const findings: StoryboardQaFindingV1[] = []
  const seen = new Set<string>()
  let priorTick = -1
  const sourceIds = new Set(context.availableSourceIds ?? [])
  const assetRefs = new Set(context.availableAssetRefs ?? [])
  const styleConstraint = context.styleConstraint
  if (styleConstraint && storyboard.setup.styleLockId !== styleConstraint.styleLockId) findings.push(finding('STYLE_HARD_CONSTRAINT', `Storyboard styleLockId must remain ${styleConstraint.styleLockId}.`))
  const allowedColors = new Set((styleConstraint?.hard.allowedColors ?? []).map(normalizedStyleString))
  const allowedFonts = new Set((styleConstraint?.hard.allowedFontFamilies ?? []).map(normalizedStyleString))
  const defaultFingerprints = new Set((context.defaultContentFingerprints ?? []).map((value) => value.trim()).filter(Boolean))
  for (const state of storyboard.states) {
    if (seen.has(state.id)) findings.push(finding('DUPLICATE_STATE_ID', `Duplicate state id: ${state.id}`, [state.id]))
    seen.add(state.id)
    if (state.approximateTick < priorTick) findings.push(finding('INVALID_STATE_ORDER', `${state.id} is earlier than the preceding state.`, [state.id]))
    priorTick = state.approximateTick
    const graph = validateMotionScene(state.graphState)
    if (!graph.ok) findings.push(finding('BAD_GRAPH_SNAPSHOT', `${state.id} contains an invalid MotionSceneV1 snapshot.`, [state.id]))
    const missingFocus = state.focusNodeIds.filter((nodeId) => !state.graphState.nodes[nodeId])
    if (missingFocus.length > 0) {
      findings.push(finding('BROKEN_SEMANTIC_NODE_ID', `${state.id} references missing semantic focus nodes.`, [state.id], missingFocus))
      findings.push(finding('INCONSISTENT_FOCUS_IDS', `${state.id} focus IDs do not resolve in its graph snapshot.`, [state.id], missingFocus))
    }
    const presentation = assessPresentationModeCapabilitiesV1(state.presentationMode, context.availableCapabilities)
    if (!presentation.supported) findings.push(finding('UNSUPPORTED_PRESENTATION_CAPABILITY', `${state.id} needs unsupported presentation capabilities: ${presentation.unsupportedCapabilities.join(', ')}.`, [state.id]))
    const sourceTreatment = assessSourceTreatmentCapabilitiesV1(state.sourceTreatment, context.availableCapabilities)
    if (!sourceTreatment.supported) findings.push(finding('INVALID_SOURCE_TREATMENT', `${state.id} needs unsupported source-treatment capabilities: ${sourceTreatment.unsupportedCapabilities.join(', ')}.`, [state.id]))
    if (context.requiredRatio && !state.graphState.supportedAspectRatios.includes(context.requiredRatio)) findings.push(finding('INVALID_RATIO', `${state.id} does not support ${context.requiredRatio}.`, [state.id]))
    if (styleConstraint?.soft.preferredPresentationModes?.length && !styleConstraint.soft.preferredPresentationModes.includes(state.presentationMode)) findings.push(finding('STYLE_SOFT_DEVIATION', `${state.id} uses presentation mode ${state.presentationMode}, outside the preferred style vocabulary.`, [state.id], [], 'warning'))
    if (styleConstraint?.soft.maximumNodesPerState !== undefined && Object.keys(state.graphState.nodes).length > styleConstraint.soft.maximumNodesPerState) findings.push(finding('STYLE_SOFT_DEVIATION', `${state.id} exceeds the preferred node-density budget of ${styleConstraint.soft.maximumNodesPerState}.`, [state.id], [], 'warning'))
    const hardStyleNodes: string[] = []
    const defaultContentNodes: string[] = []
    const softRadiusNodes: string[] = []
    for (const node of Object.values(state.graphState.nodes)) {
      if (node.type === 'text') {
        if (allowedFonts.size > 0 && !allowedFonts.has(normalizedStyleString(node.fontFamily))) hardStyleNodes.push(node.id)
        const textValue = constantString(node.text)
        if (textValue !== null && defaultFingerprints.has(textValue.trim())) defaultContentNodes.push(node.id)
      }
      const colors = node.type === 'text' ? [constantString(node.fillColor)] : node.type === 'shape' || node.type === 'path' ? [constantString(node.fillColor), constantString(node.strokeColor)] : []
      if (allowedColors.size > 0 && colors.some((color) => color !== null && normalizedStyleString(color) !== 'transparent' && !allowedColors.has(normalizedStyleString(color)))) hardStyleNodes.push(node.id)
      if (node.type === 'shape' && styleConstraint?.soft.maximumRadius !== undefined) {
        const radius = constantNumber(node.radius)
        if (radius !== null && radius > styleConstraint.soft.maximumRadius) softRadiusNodes.push(node.id)
      }
    }
    if (hardStyleNodes.length > 0) findings.push(finding('STYLE_HARD_CONSTRAINT', `${state.id} violates hard palette/type-family constraints from the active Style Lock.`, [state.id], [...new Set(hardStyleNodes)]))
    if (softRadiusNodes.length > 0) findings.push(finding('STYLE_SOFT_DEVIATION', `${state.id} exceeds the preferred surface-radius guidance.`, [state.id], softRadiusNodes, 'warning'))
    if (defaultContentNodes.length > 0) findings.push(finding('DEFAULT_CONTENT_UNBOUND', `${state.id} still contains component/demo default content instead of authored source-bound content.`, [state.id], defaultContentNodes))
    if (state.sourceFrameRef) {
      if (state.sourceFrameRef.exactTick < storyboard.setup.sourceRegion.startTick || state.sourceFrameRef.exactTick > storyboard.setup.sourceRegion.endTick) findings.push(finding('INVALID_SOURCE_FRAME', `${state.id} source frame is outside the storyboard source region.`, [state.id]))
      if ((context.availableSourceIds && !sourceIds.has(state.sourceFrameRef.sourceId)) || (state.sourceFrameRef.assetRef && context.availableAssetRefs && !assetRefs.has(state.sourceFrameRef.assetRef))) findings.push(finding('MISSING_MEDIA', `${state.id} references unavailable source media.`, [state.id]))
    }
    if (context.compositionBounds) {
      const unsafe: string[] = []
      const overflow: string[] = []
      for (const node of Object.values(state.graphState.nodes)) {
        const x = constantNumber(node.transform.positionX)
        const y = constantNumber(node.transform.positionY)
        if ((x !== null && Math.abs(x) > context.compositionBounds.width * 4) || (y !== null && Math.abs(y) > context.compositionBounds.height * 4)) unsafe.push(node.id)
        if (node.type === 'shape' || node.type === 'image') {
          const width = constantNumber(node.width)
          const height = constantNumber(node.height)
          if ((width !== null && width > context.compositionBounds.width * 2) || (height !== null && height > context.compositionBounds.height * 2)) overflow.push(node.id)
        }
      }
      if (unsafe.length > 0) findings.push(finding('UNSAFE_BOUNDS', `${state.id} has nodes far outside safe composition bounds.`, [state.id], unsafe))
      if (overflow.length > 0) findings.push(finding('OVERFLOW', `${state.id} has nodes larger than the allowed overflow envelope.`, [state.id], overflow, 'warning'))
    }
  }
  return Object.freeze({ ok: findings.every((item) => item.severity !== 'error'), findings: Object.freeze(findings) })
}

export const approveStoryboardSandboxV1 = (sandbox: StoryboardSandboxV1, approval: OwnerApprovalV1, qa: StoryboardStructuralQaReportV1): CreativeOperationResultV1<StoryboardSandboxV1> => {
  if (!qa.ok) return creativeOperationRefusal('STORYBOARD_QA_FAILED', 'Storyboard cannot be owner-approved while structural QA has errors.', qa.findings)
  const valid = validateOwnerApprovalV1(approval)
  if (!valid.ok) return creativeOperationRefusal(valid.refusal.code, valid.refusal.message, valid.refusal.details)
  if (approval.scope !== 'storyboard' || approval.subjectId !== sandbox.storyboard.id || approval.subjectRevision !== sandbox.storyboard.revision) return creativeOperationRefusal('APPROVAL_REVISION_MISMATCH', 'Storyboard approval must target the exact current storyboard id and revision.')
  const nextRevision = sandbox.sandboxRevision + 1
  const storyboard: StoryboardV1 = Object.freeze({ ...sandbox.storyboard, status: 'owner-approved', ownerApprovalId: approval.id })
  const next: StoryboardSandboxV1 = Object.freeze({
    ...sandbox,
    sandboxRevision: nextRevision,
    storyboard,
    locks: Object.freeze({ ...sandbox.locks, storyboard: true }),
    approvals: Object.freeze([...sandbox.approvals.filter((item) => item.scope !== 'storyboard'), valid.value]),
  })
  return creativeOperationOk(next, nextRevision)
}

export const reopenStoryboardSandboxV1 = (sandbox: StoryboardSandboxV1, expectedSandboxRevision: number): CreativeOperationResultV1<StoryboardSandboxV1> => {
  if (expectedSandboxRevision !== sandbox.sandboxRevision) return creativeOperationRefusal('STALE_SANDBOX_REVISION', `Expected sandbox revision ${expectedSandboxRevision}; current revision is ${sandbox.sandboxRevision}.`)
  const nextRevision = sandbox.sandboxRevision + 1
  const storyboard: StoryboardV1 = Object.freeze({ ...sandbox.storyboard, revision: sandbox.storyboard.revision + 1, status: 'draft', ownerApprovalId: undefined })
  const next: StoryboardSandboxV1 = Object.freeze({
    ...sandbox,
    sandboxRevision: nextRevision,
    storyboard,
    locks: Object.freeze({ ...sandbox.locks, storyboard: false }),
    approvals: Object.freeze(sandbox.approvals.filter((item) => item.scope !== 'storyboard')),
  })
  return creativeOperationOk(next, nextRevision)
}
