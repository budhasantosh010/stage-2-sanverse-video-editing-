import {
  BACKGROUND_TREATMENTS_V1, MOTION_PRESENTATION_MODES_V1, SOURCE_TREATMENTS_V1,
  creativeRefusal, creativeValidationOk, validateCreativeTickRangeV1,
  type BackgroundTreatmentV1, type CreativeValidationResultV1, type MotionPresentationModeV1, type SourceTreatmentV1,
} from '@sanverse/motion-contract'
import { validateMotionScene, type MotionSceneV1 } from '@sanverse/motion-graph'

export type KeyVisualPurposeV1 = 'opening'|'establish'|'build'|'explain'|'hero'|'payoff'|'resolve'|'end'|'custom'
export type StoryboardStatusV1 = 'draft'|'qa'|'awaiting-owner'|'owner-approved'|'rejected'
export type OwnerApprovalScopeV1 = 'creative-direction'|'storyboard'|'animatic'|'motion'

export interface StoryboardPresentationSetupV1 {
  readonly schemaVersion: 'sanverse.storyboard-presentation-setup/v1'
  readonly sourceRegion: Readonly<{ startTick: number; endTick: number }>
  readonly communicationGoal: string
  readonly presentationMode: MotionPresentationModeV1
  readonly sourceTreatment: SourceTreatmentV1
  readonly backgroundTreatment: BackgroundTreatmentV1
  readonly styleLockId?: string
  readonly contentLockId?: string
  readonly preserveSourceAudio: boolean
  readonly preserveSourceVideo: boolean
  readonly requiredCapabilities: readonly string[]
}

export interface SourceFrameReferenceV1 {
  readonly schemaVersion: 'sanverse.source-frame-reference/v1'
  readonly sourceId: string
  readonly exactTick: number
  readonly assetRef?: string
}

export interface KeyVisualStateV1 {
  readonly schemaVersion: 'sanverse.key-visual-state/v1'
  readonly id: string
  readonly semanticPurpose: KeyVisualPurposeV1
  readonly approximateTick: number
  readonly presentationMode: MotionPresentationModeV1
  readonly sourceTreatment: SourceTreatmentV1
  readonly backgroundTreatment: BackgroundTreatmentV1
  readonly focusNodeIds: readonly string[]
  readonly graphState: MotionSceneV1
  readonly sourceFrameRef?: SourceFrameReferenceV1
  readonly previousStateId?: string
  readonly nextStateId?: string
  readonly notes?: string
}

export interface StoryboardV1 {
  readonly schemaVersion: 'sanverse.storyboard/v1'
  readonly id: string
  readonly sourceRevision: string | number
  readonly setup: StoryboardPresentationSetupV1
  readonly states: readonly KeyVisualStateV1[]
  readonly status: StoryboardStatusV1
  readonly revision: number
  readonly ownerApprovalId?: string
}

export interface OwnerApprovalV1 {
  readonly schemaVersion: 'sanverse.owner-approval/v1'
  readonly id: string
  readonly scope: OwnerApprovalScopeV1
  readonly subjectId: string
  readonly subjectRevision: number
  readonly status: 'owner-approved'
  readonly approvedAt: string
  readonly notes?: readonly string[]
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const id = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240
const nonNegativeTick = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

export const validatePresentationSetupV1 = (input: unknown): CreativeValidationResultV1<StoryboardPresentationSetupV1> => {
  if (!record(input) || input.schemaVersion !== 'sanverse.storyboard-presentation-setup/v1') return creativeRefusal('UNSUPPORTED_STORYBOARD_SETUP_VERSION','Storyboard setup must use sanverse.storyboard-presentation-setup/v1.')
  if (!validateCreativeTickRangeV1(input.sourceRegion).ok) return creativeRefusal('INVALID_SOURCE_REGION','Storyboard source region is invalid.')
  if (typeof input.communicationGoal !== 'string' || !input.communicationGoal.trim()) return creativeRefusal('INVALID_STORYBOARD_SETUP','communicationGoal is required.')
  if (!MOTION_PRESENTATION_MODES_V1.includes(input.presentationMode as MotionPresentationModeV1)) return creativeRefusal('UNSUPPORTED_PRESENTATION_MODE','presentationMode is unsupported.')
  if (!SOURCE_TREATMENTS_V1.includes(input.sourceTreatment as SourceTreatmentV1)) return creativeRefusal('INVALID_SOURCE_TREATMENT','sourceTreatment is unsupported.')
  if (!BACKGROUND_TREATMENTS_V1.includes(input.backgroundTreatment as BackgroundTreatmentV1)) return creativeRefusal('INVALID_BACKGROUND_TREATMENT','backgroundTreatment is unsupported.')
  if (typeof input.preserveSourceAudio !== 'boolean' || typeof input.preserveSourceVideo !== 'boolean' || !Array.isArray(input.requiredCapabilities) || !input.requiredCapabilities.every((item) => typeof item === 'string')) return creativeRefusal('INVALID_STORYBOARD_SETUP','preserve flags and requiredCapabilities are invalid.')
  return creativeValidationOk(input as unknown as StoryboardPresentationSetupV1)
}

export const validateKeyVisualStateV1 = (input: unknown): CreativeValidationResultV1<KeyVisualStateV1> => {
  if (!record(input) || input.schemaVersion !== 'sanverse.key-visual-state/v1' || !id(input.id) || !nonNegativeTick(input.approximateTick)) return creativeRefusal('INVALID_KEY_VISUAL_STATE','KVS identity/tick/version is invalid.')
  if (!['opening','establish','build','explain','hero','payoff','resolve','end','custom'].includes(String(input.semanticPurpose))) return creativeRefusal('INVALID_KEY_VISUAL_STATE','KVS semanticPurpose is unsupported.')
  if (!MOTION_PRESENTATION_MODES_V1.includes(input.presentationMode as MotionPresentationModeV1) || !SOURCE_TREATMENTS_V1.includes(input.sourceTreatment as SourceTreatmentV1) || !BACKGROUND_TREATMENTS_V1.includes(input.backgroundTreatment as BackgroundTreatmentV1)) return creativeRefusal('INVALID_KEY_VISUAL_STATE','KVS presentation/source/background treatment is invalid.')
  if (!Array.isArray(input.focusNodeIds) || !input.focusNodeIds.every(id)) return creativeRefusal('INVALID_KEY_VISUAL_STATE','KVS focusNodeIds are invalid.')
  const graph = validateMotionScene(input.graphState)
  if (!graph.ok) return creativeRefusal('INVALID_GRAPH_SNAPSHOT','KVS graphState is not a valid canonical MotionSceneV1.', graph.issues)
  if ((input.focusNodeIds as string[]).some((nodeId) => !graph.value.nodes[nodeId])) return creativeRefusal('BROKEN_SEMANTIC_ID','KVS focus node does not exist in graphState.')
  return creativeValidationOk(input as unknown as KeyVisualStateV1)
}

export const validateStoryboardV1 = (input: unknown): CreativeValidationResultV1<StoryboardV1> => {
  if (!record(input) || input.schemaVersion !== 'sanverse.storyboard/v1' || !id(input.id) || !Number.isSafeInteger(input.revision) || Number(input.revision) < 1) return creativeRefusal('INVALID_STORYBOARD','Storyboard identity/version/revision is invalid.')
  const setup = validatePresentationSetupV1(input.setup)
  if (!setup.ok) return setup as CreativeValidationResultV1<StoryboardV1>
  if (!Array.isArray(input.states) || input.states.length === 0) return creativeRefusal('INVALID_STORYBOARD','Storyboard requires at least one KVS.')
  const seen = new Set<string>(); let priorTick = -1
  for (const raw of input.states) {
    const state = validateKeyVisualStateV1(raw)
    if (!state.ok) return state as CreativeValidationResultV1<StoryboardV1>
    if (seen.has(state.value.id)) return creativeRefusal('DUPLICATE_STATE_ID','Storyboard state IDs must be unique.')
    if (state.value.approximateTick < priorTick) return creativeRefusal('INVALID_STATE_ORDER','Storyboard states must be ordered by approximateTick.')
    seen.add(state.value.id); priorTick = state.value.approximateTick
  }
  if (!['draft','qa','awaiting-owner','owner-approved','rejected'].includes(String(input.status))) return creativeRefusal('INVALID_STORYBOARD_STATUS','Storyboard status is invalid.')
  return creativeValidationOk(input as unknown as StoryboardV1)
}

export const createStoryboardV1 = (input: Omit<StoryboardV1,'schemaVersion'>): StoryboardV1 => {
  const value: StoryboardV1 = Object.freeze({ schemaVersion: 'sanverse.storyboard/v1', ...input, states: Object.freeze([...input.states]) })
  const validated = validateStoryboardV1(value)
  if (!validated.ok) throw new RangeError(`${validated.refusal.code}: ${validated.refusal.message}`)
  return validated.value
}

export const validateOwnerApprovalV1 = (input: unknown): CreativeValidationResultV1<OwnerApprovalV1> => {
  if (!record(input) || input.schemaVersion !== 'sanverse.owner-approval/v1') return creativeRefusal('UNSUPPORTED_APPROVAL_VERSION','Approval must use sanverse.owner-approval/v1.')
  if (!id(input.id) || !id(input.subjectId) || !['creative-direction','storyboard','animatic','motion'].includes(String(input.scope)) || input.status !== 'owner-approved') return creativeRefusal('INVALID_APPROVAL','Approval identity/scope/status is invalid.')
  if (!Number.isSafeInteger(input.subjectRevision) || Number(input.subjectRevision) < 1) return creativeRefusal('INVALID_APPROVAL','Approval must target an exact positive subject revision.')
  if (typeof input.approvedAt !== 'string' || Number.isNaN(Date.parse(input.approvedAt))) return creativeRefusal('INVALID_APPROVAL','approvedAt must be an ISO-compatible timestamp.')
  if (input.notes !== undefined && (!Array.isArray(input.notes) || !input.notes.every((note) => typeof note === 'string'))) return creativeRefusal('INVALID_APPROVAL','Approval notes must be strings.')
  return creativeValidationOk(input as unknown as OwnerApprovalV1)
}
