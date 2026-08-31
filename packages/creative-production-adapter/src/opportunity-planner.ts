import {
  buildCapabilityCatalogV1,
  rankCapabilitiesV1,
  recommendStyleLockV1,
  scoreSceneCohesionV1,
  validateMotionOpportunityV1,
  type CapabilityCatalogItemV1,
  type MotionOpportunityV1,
  type RankedCapabilityV1,
  type SceneCreativeSignatureV1,
  type StyleLockRecommendationV1,
  type VideoCreativeLanguageV1,
} from '@sanverse/creative-direction'
import { COMPONENT_RECIPES, type ComponentRecipe } from '@sanverse/edit-domain/component-recipes'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import type { MotionAspectRatio, MotionPresentationModeV1 } from '@sanverse/motion-contract'
import { getMotionLibraryCapabilityRecordsV1 } from '@sanverse/motion-library'
import type { SourceTranscriptV1, SourceUnderstandingObservationV1, SourceUnderstandingPacketV1 } from './external-orchestration.ts'

export const MOTION_OPPORTUNITY_MAP_SCHEMA_V1 = 'sanverse.motion-opportunity-map/v1' as const

export interface PlannedCapabilityRankingV1 extends RankedCapabilityV1 {
  readonly cohesionScore: number
  readonly combinedScore: number
  readonly cohesionLevel: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface PlannedRecipeMatchV1 {
  readonly recipeId: string
  readonly componentId: string
  readonly score: number
  readonly reason: string
}

export interface PlannedMotionOpportunityV1 {
  readonly opportunity: MotionOpportunityV1
  readonly evidence: Readonly<{
    sourcePacketId: string
    transcriptCueIds: readonly string[]
    observationIds: readonly string[]
  }>
  readonly planningProvenance: Readonly<{
    origin: 'agent-proposed' | 'semantic-auto' | 'fallback'
    originalStartTick: number
    originalEndTick: number
    normalizedStartTick: number
    normalizedEndTick: number
    repairNotes: readonly string[]
    score: number
  }>
  readonly selectedCapabilityId: string
  readonly capabilityRankings: readonly PlannedCapabilityRankingV1[]
  readonly recipeMatches: readonly PlannedRecipeMatchV1[]
}

export interface MotionOpportunityMapV1 {
  readonly schemaVersion: typeof MOTION_OPPORTUNITY_MAP_SCHEMA_V1
  readonly id: string
  readonly projectId: string
  readonly projectRevision: number
  readonly sourcePacketId: string
  /** Backward-compatible alias for requestedMax. */
  readonly targetCount: number
  readonly requestedMax: number
  readonly selectedCount: number
  readonly rejectedCandidates: readonly Readonly<{ id: string; code: string; message: string }>[]
  readonly styleLockId: string
  readonly styleRecommendation: StyleLockRecommendationV1
  readonly creativeLanguage: VideoCreativeLanguageV1
  readonly opportunities: readonly PlannedMotionOpportunityV1[]
  readonly planningRules: Readonly<{
    minimumOpportunityTicks: number
    overlapPolicy: 'non-overlapping-half-open'
    capabilityCatalogSource: 'b2-motion-library'
    recipeCatalogSource: 'edit-domain-component-recipes'
    agentCandidatesValidated: boolean
  }>
}

export type PlanMotionOpportunitiesResultV1 =
  | Readonly<{ ok: true; value: MotionOpportunityMapV1 }>
  | Readonly<{ ok: false; refusal: Readonly<{ code: string; message: string; details?: unknown }> }>

export interface PlanMotionOpportunitiesInputV1 {
  readonly packet: SourceUnderstandingPacketV1
  readonly transcript?: SourceTranscriptV1
  /** Backward compatible; interpreted as up-to-N. */
  readonly targetCount?: number
  readonly maxCount?: number
  readonly agentCandidates?: readonly MotionOpportunityV1[]
  readonly style?: Readonly<{
    palette?: readonly string[]
    typeFamily?: string
    traits?: readonly string[]
    motionIntensity?: number
    overshootAllowance?: number
    density?: 'low' | 'medium' | 'high'
  }>
}

const bounded = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
const tail = (value: string): string => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619) }
  return (hash >>> 0).toString(36).padStart(8, '0').slice(0, 12)
}
const overlap = (a: Readonly<{ sourceStartTick: number; sourceEndTick: number }>, b: Readonly<{ sourceStartTick: number; sourceEndTick: number }>) =>
  a.sourceStartTick < b.sourceEndTick && b.sourceStartTick < a.sourceEndTick
const ratioFor = (packet: SourceUnderstandingPacketV1): MotionAspectRatio => {
  const source = packet.sourceSegments.length > 0 ? packet : packet
  void source
  // Source packet V1 intentionally does not duplicate dimensions; raw-video projects
  // are currently normalized around the dominant production ratios. The active
  // project candidate builder performs the final exact composition check. Planning
  // uses 16:9 as the conservative desktop-video default until a dimensions field is
  // versioned into the packet rather than guessing a fake ratio per observation.
  return '16:9'
}

const importanceFor = (kind?: string): number => {
  if (kind === 'percentage' || kind === 'money' || kind === 'security' || kind === 'cta' || kind === 'comparison') return 4
  if (kind === 'feature' || kind === 'question' || kind === 'process' || kind === 'benefit') return 3
  if (kind === 'list') return 2
  return 1
}
const goalFor = (kind?: string): string => {
  if (kind === 'percentage') return 'percentage'
  if (kind === 'money') return 'money'
  if (kind === 'comparison') return 'comparison'
  if (kind === 'process' || kind === 'list') return 'process'
  if (kind === 'question') return 'question'
  if (kind === 'security') return 'security'
  if (kind === 'feature') return 'software-demo'
  if (kind === 'benefit') return 'statistic'
  if (kind === 'cta') return 'cta'
  return 'headline'
}
const presentationFor = (goal: string): MotionPresentationModeV1 =>
  goal === 'comparison' || goal === 'process' || goal === 'software-demo' || goal === 'security'
    ? 'full-screen-motion'
    : 'overlay'

const recipeGoalScore = (recipe: ComponentRecipe, goal: string): number => {
  const component = recipe.componentId.toLowerCase()
  if (goal === 'cta' && component.includes('title')) return 60
  if ((goal === 'percentage' || goal === 'money' || goal === 'statistic') && component.includes('title')) return 55
  if ((goal === 'question' || goal === 'headline') && component.includes('title')) return 50
  if ((goal === 'security' || goal === 'software-demo') && component.includes('callout')) return 45
  if (goal === 'process' && component.includes('callout')) return 40
  if (component.includes('captions')) return 10
  if (component.includes('nameplate')) return 8
  return 5
}

const styleLanguage = (input: PlanMotionOpportunitiesInputV1): PlanMotionOpportunitiesResultV1 extends never ? never : Readonly<{ recommendation: StyleLockRecommendationV1; language: VideoCreativeLanguageV1; styleLockId: string }> => {
  const durationSeconds = input.packet.sourceDurationTicks / PROJECT_TIMESCALE
  const speechSeconds = input.transcript?.cues.reduce((sum, cue) => sum + Math.max(0, cue.endTick - cue.startTick), 0) ?? 0
  const speechDensity = durationSeconds > 0 ? speechSeconds / input.packet.sourceDurationTicks : 0
  const cueRate = durationSeconds > 0 ? (input.transcript?.cues.length ?? 0) / durationSeconds : 0
  const informationDensity: 'low' | 'medium' | 'high' = cueRate > 0.65 ? 'high' : cueRate > 0.18 ? 'medium' : 'low'
  const talkingHead = input.packet.observations.some((item) => item.kind === 'speech-present') || Boolean(input.transcript?.cues.length)
  const palette = input.style?.palette?.length && input.style.palette.length >= 2
    ? input.style.palette
    : Object.freeze(['#0B0C10', '#FF7A1A', '#FFFFFF'])
  const recommended = recommendStyleLockV1({
    brand: Object.freeze({ palette, ...(input.style?.typeFamily ? { typeFamily: input.style.typeFamily } : {}), traits: Object.freeze([...(input.style?.traits ?? ['clean','editorial'])]) }),
    existingStyle: Object.freeze({
      ...(input.style?.motionIntensity === undefined ? {} : { motionIntensity: bounded(input.style.motionIntensity, 0, 1) }),
      ...(input.style?.overshootAllowance === undefined ? {} : { overshootAllowance: bounded(input.style.overshootAllowance, 0, 0.4) }),
      ...(input.style?.density ? { density: input.style.density } : {}),
    }),
    approvedAssetSignals: Object.freeze([]),
    promotedAssetSignals: Object.freeze([]),
    videoContext: Object.freeze({ talkingHead, informationDensity, negativeSpace: 'medium' as const, subjectPriority: talkingHead ? 'high' as const : 'medium' as const }),
    locked: false,
  })
  if (!recommended.ok) throw new Error(`${recommended.refusal.code}: ${recommended.refusal.message}`)
  const recommendation = recommended.value
  const styleLockId = `stylelock_${tail(`${input.packet.id}:${JSON.stringify(recommendation)}`)}`
  const language: VideoCreativeLanguageV1 = Object.freeze({
    schemaVersion: 'sanverse.video-creative-language/v1' as const,
    id: `language_${tail(`${input.packet.id}:${styleLockId}`)}`,
    version: 1,
    styleLockId,
    preferredPresentationModes: Object.freeze<MotionPresentationModeV1[]>(['overlay','full-screen-motion','picture-in-picture']),
    typographyLanguage: 'editorial' as const,
    surfaceLanguage: 'soft-depth' as const,
    motionRhythm: recommendation.motion.baseTiming,
    transitionVocabulary: Object.freeze(['cut','fade','scale'] as const),
    densityPolicy: recommendation.composition.density,
    cameraPolicy: recommendation.motion.cameraAggressiveness > 0.45 ? 'expressive' as const : recommendation.motion.cameraAggressiveness > 0.1 ? 'restrained' as const : 'static' as const,
    paletteRoles: Object.freeze(['background','surface','text','accent']),
    easingFamily: Object.freeze([...new Set([recommendation.motion.primaryEase, recommendation.motion.secondaryEase])]) as readonly ('soft'|'linear'|'snappy')[],
    overshootMax: recommendation.motion.overshootAllowance,
    allowedExceptions: Object.freeze([]),
  })
  void speechDensity
  return Object.freeze({ recommendation, language, styleLockId })
}

type CandidateWithProvenanceV1 = Readonly<{
  opportunity: MotionOpportunityV1
  origin: 'agent-proposed' | 'semantic-auto' | 'fallback'
  originalStartTick: number
  originalEndTick: number
  repairNotes: readonly string[]
  score: number
}>

type CandidateSelectionV1 = Readonly<{
  accepted: readonly CandidateWithProvenanceV1[]
  rejected: readonly Readonly<{ id: string; code: string; message: string }>[]
}>

const requestedMaxFor = (input: PlanMotionOpportunitiesInputV1): number => input.maxCount ?? input.targetCount ?? 10
const usefulnessScore = (observation: SourceUnderstandingObservationV1): number => Number(bounded((importanceFor(observation.semanticKind) / 4) * 0.55 + observation.confidence * 0.45, 0, 1).toFixed(4))

const semanticAutoOpportunities = (input: PlanMotionOpportunitiesInputV1, maxCount: number): readonly CandidateWithProvenanceV1[] => {
  const semantic = input.packet.observations
    .filter((item) => item.kind === 'semantic-moment')
    .map((item) => Object.freeze({ item, score: usefulnessScore(item) }))
    .filter((entry) => entry.score >= 0.56)
    .sort((a, b) => b.score - a.score || importanceFor(b.item.semanticKind) - importanceFor(a.item.semanticKind) || a.item.startTick - b.item.startTick || a.item.id.localeCompare(b.item.id))
  const outputs: CandidateWithProvenanceV1[] = []
  for (const [index, entry] of semantic.entries()) {
    if (outputs.length >= maxCount) break
    const observation = entry.item
    const matchingCues = input.transcript?.cues.filter((cue) => observation.transcriptCueIds.includes(cue.id)) ?? []
    // Semantic-moment timing is the source-range authority. Transcript cues are
    // supporting text evidence only: a plain transcript may be one whole-video
    // cue, and widening every semantic moment to that cue would make otherwise
    // distinct opportunities overlap the entire source.
    let sourceStartTick = Math.max(0, observation.startTick)
    let sourceEndTick = Math.min(input.packet.sourceDurationTicks, observation.endTick)
    if (sourceEndTick - sourceStartTick < PROJECT_TIMESCALE) {
      const missing = PROJECT_TIMESCALE - (sourceEndTick - sourceStartTick)
      const before = Math.min(sourceStartTick, Math.floor(missing / 2))
      sourceStartTick -= before
      sourceEndTick = Math.min(input.packet.sourceDurationTicks, sourceEndTick + (missing - before))
      if (sourceEndTick - sourceStartTick < PROJECT_TIMESCALE) sourceStartTick = Math.max(0, sourceEndTick - PROJECT_TIMESCALE)
    }
    const communicationGoal = goalFor(observation.semanticKind)
    const cueText = matchingCues.map((cue) => cue.text).join(' ').trim()
    const opportunity: MotionOpportunityV1 = Object.freeze({
      id: `opportunity_${tail(`${input.packet.id}:semantic:${observation.id}:${sourceStartTick}:${sourceEndTick}`)}`,
      sourceStartTick,
      sourceEndTick,
      communicationGoal,
      recommendedPresentationMode: presentationFor(communicationGoal),
      recommendedSourceTreatment: 'normal' as const,
      recommendedBackgroundTreatment: 'source-video' as const,
      preserveSourceAudio: true,
      preserveSourceVideo: true,
      suggestedPlacement: index % 2 === 0 ? 'protect-speaker-safe-area-right' : 'protect-speaker-safe-area-left',
      rationale: `${observation.semanticKind ?? observation.kind} evidence supports a ${communicationGoal} visual.${cueText ? ` Transcript: ${cueText.slice(0, 180)}` : ''}`,
      confidence: bounded(observation.confidence, 0, 1),
      requiredCapabilities: Object.freeze([]),
    })
    outputs.push(Object.freeze({ opportunity, origin: 'semantic-auto' as const, originalStartTick: observation.startTick, originalEndTick: observation.endTick, repairNotes: Object.freeze([]), score: entry.score }))
  }
  return Object.freeze(outputs)
}

const equalSliceFallback = (input: PlanMotionOpportunitiesInputV1, maxCount: number): readonly CandidateWithProvenanceV1[] => {
  const count = Math.max(1, Math.min(maxCount, Math.floor(input.packet.sourceDurationTicks / PROJECT_TIMESCALE), 4))
  const outputs: CandidateWithProvenanceV1[] = []
  for (let index = 0; index < count; index += 1) {
    const sourceStartTick = Math.floor(index * input.packet.sourceDurationTicks / count)
    const sourceEndTick = Math.floor((index + 1) * input.packet.sourceDurationTicks / count)
    const observations = input.packet.observations.filter((item) => item.startTick < sourceEndTick && sourceStartTick < item.endTick)
      .sort((left, right) => importanceFor(right.semanticKind) - importanceFor(left.semanticKind) || right.confidence - left.confidence || left.id.localeCompare(right.id))
    const strongest = observations[0]
    const communicationGoal = goalFor(strongest?.semanticKind)
    const opportunity: MotionOpportunityV1 = Object.freeze({
      id: `opportunity_${tail(`${input.packet.id}:fallback:${index}:${sourceStartTick}:${sourceEndTick}`)}`,
      sourceStartTick, sourceEndTick, communicationGoal,
      recommendedPresentationMode: presentationFor(communicationGoal), recommendedSourceTreatment: 'normal' as const, recommendedBackgroundTreatment: 'source-video' as const,
      preserveSourceAudio: true, preserveSourceVideo: true,
      suggestedPlacement: index % 2 === 0 ? 'protect-speaker-safe-area-right' : 'protect-speaker-safe-area-left',
      rationale: strongest ? `Fallback region retained strongest available ${strongest.semanticKind ?? strongest.kind} evidence.` : 'Last-resort deterministic fallback region; no stronger semantic moment exceeded the usefulness threshold.',
      confidence: strongest ? bounded(strongest.confidence, 0, 1) : 0.5,
      requiredCapabilities: Object.freeze([]),
    })
    outputs.push(Object.freeze({ opportunity, origin: 'fallback' as const, originalStartTick: sourceStartTick, originalEndTick: sourceEndTick, repairNotes: Object.freeze([]), score: strongest ? usefulnessScore(strongest) : 0.5 }))
  }
  return Object.freeze(outputs)
}

const transcriptGapFallbacks = (
  input: PlanMotionOpportunitiesInputV1,
  occupied: readonly CandidateWithProvenanceV1[],
  maxCount: number,
): readonly CandidateWithProvenanceV1[] => {
  if (!input.transcript || occupied.length >= maxCount) return Object.freeze([])
  const outputs: CandidateWithProvenanceV1[] = []
  for (const [index, cue] of input.transcript.cues.entries()) {
    if (occupied.length + outputs.length >= maxCount) break
    const candidateRange = Object.freeze({ sourceStartTick: cue.startTick, sourceEndTick: cue.endTick })
    if (occupied.some((entry) => overlap(entry.opportunity, candidateRange)) || outputs.some((entry) => overlap(entry.opportunity, candidateRange))) continue
    if (cue.endTick - cue.startTick < PROJECT_TIMESCALE) continue
    const opportunity: MotionOpportunityV1 = Object.freeze({
      id: `opportunity_${tail(`${input.packet.id}:transcript-fallback:${cue.id}:${cue.startTick}:${cue.endTick}`)}`,
      sourceStartTick: cue.startTick,
      sourceEndTick: cue.endTick,
      communicationGoal: 'headline',
      recommendedPresentationMode: 'overlay',
      recommendedSourceTreatment: 'normal',
      recommendedBackgroundTreatment: 'source-video',
      preserveSourceAudio: true,
      preserveSourceVideo: true,
      suggestedPlacement: index % 2 === 0 ? 'protect-speaker-safe-area-right' : 'protect-speaker-safe-area-left',
      rationale: `Transcript-backed fallback retained an uncovered spoken source region because fewer than ${maxCount} stronger semantic opportunities were available. Transcript: ${cue.text.slice(0, 180)}`,
      confidence: 0.5,
      requiredCapabilities: Object.freeze([]),
    })
    outputs.push(Object.freeze({ opportunity, origin: 'fallback' as const, originalStartTick: cue.startTick, originalEndTick: cue.endTick, repairNotes: Object.freeze(['filled-uncovered-transcript-region']), score: 0.5 }))
  }
  return Object.freeze(outputs)
}

const validateCandidatesIndividually = (input: PlanMotionOpportunitiesInputV1, candidates: readonly CandidateWithProvenanceV1[], maxCount: number): CandidateSelectionV1 => {
  const valid: CandidateWithProvenanceV1[] = []
  const rejected: Array<Readonly<{ id: string; code: string; message: string }>> = []
  for (const entry of candidates) {
    const candidate = entry.opportunity
    const result = validateMotionOpportunityV1(candidate)
    if (!result.ok) { rejected.push(Object.freeze({ id: candidate.id, code: result.refusal.code, message: result.refusal.message })); continue }
    if (result.value.sourceStartTick < 0 || result.value.sourceEndTick > input.packet.sourceDurationTicks) { rejected.push(Object.freeze({ id: candidate.id, code: 'OPPORTUNITY_OUTSIDE_SOURCE', message: 'Opportunity lies outside the analyzed source duration.' })); continue }
    if (result.value.sourceEndTick - result.value.sourceStartTick < PROJECT_TIMESCALE) { rejected.push(Object.freeze({ id: candidate.id, code: 'OPPORTUNITY_TOO_SHORT', message: 'Opportunity needs at least one second of source duration.' })); continue }
    valid.push(Object.freeze({ ...entry, opportunity: result.value }))
  }
  const ordered = valid.sort((a, b) => a.opportunity.sourceStartTick - b.opportunity.sourceStartTick || b.score - a.score || a.opportunity.id.localeCompare(b.opportunity.id))
  const accepted: CandidateWithProvenanceV1[] = []
  const maxRepairOverlapTicks = Math.floor(PROJECT_TIMESCALE * 0.25)
  for (const entry of ordered) {
    if (accepted.length >= maxCount) break
    const previous = accepted.at(-1)
    if (!previous || !overlap(previous.opportunity, entry.opportunity)) { accepted.push(entry); continue }
    const overlapTicks = previous.opportunity.sourceEndTick - entry.opportunity.sourceStartTick
    const repairedStart = previous.opportunity.sourceEndTick
    if (overlapTicks > 0 && overlapTicks <= maxRepairOverlapTicks && entry.opportunity.sourceEndTick - repairedStart >= PROJECT_TIMESCALE) {
      const repaired = Object.freeze({ ...entry.opportunity, sourceStartTick: repairedStart, rationale: `${entry.opportunity.rationale} Boundary trimmed ${overlapTicks} ticks to avoid a small overlap without moving the semantic moment.` })
      accepted.push(Object.freeze({ ...entry, opportunity: repaired, repairNotes: Object.freeze([...entry.repairNotes, `trimmed-start-by-${overlapTicks}-ticks-to-remove-overlap`]) }))
      continue
    }
    rejected.push(Object.freeze({ id: entry.opportunity.id, code: 'OPPORTUNITY_OVERLAP', message: `Candidate overlaps ${previous.opportunity.id}; repair would materially alter timing or leave less than one second.` }))
  }
  return Object.freeze({ accepted: Object.freeze(accepted), rejected: Object.freeze(rejected) })
}

const sourceEvidenceFor = (packet: SourceUnderstandingPacketV1, opportunity: MotionOpportunityV1) => {
  const observations = packet.observations.filter((item) => item.startTick < opportunity.sourceEndTick && opportunity.sourceStartTick < item.endTick)
  const transcriptCueIds = new Set<string>()
  for (const observation of observations) for (const cueId of observation.transcriptCueIds) transcriptCueIds.add(cueId)
  for (const segment of packet.sourceSegments) {
    if (segment.startTick < opportunity.sourceEndTick && opportunity.sourceStartTick < segment.endTick) for (const cueId of segment.transcriptCueIds) transcriptCueIds.add(cueId)
  }
  return Object.freeze({ sourcePacketId: packet.id, transcriptCueIds: Object.freeze([...transcriptCueIds].sort()), observationIds: Object.freeze(observations.map((item) => item.id).sort()) })
}

const sceneSignature = (language: VideoCreativeLanguageV1, opportunity: MotionOpportunityV1, sceneId: string): SceneCreativeSignatureV1 => Object.freeze({
  sceneId,
  paletteRoles: Object.freeze(['background','surface','text','accent']),
  typographyLanguage: language.typographyLanguage,
  surfaceLanguage: language.surfaceLanguage,
  motionRhythm: language.motionRhythm,
  easing: language.easingFamily[0] ?? 'soft',
  overshoot: Math.min(language.overshootMax, 0.08),
  density: language.densityPolicy,
  presentationMode: opportunity.recommendedPresentationMode,
  transition: 'cut' as const,
})

export const planMotionOpportunitiesV1 = (input: PlanMotionOpportunitiesInputV1): PlanMotionOpportunitiesResultV1 => {
  const requestedMax = requestedMaxFor(input)
  if (!Number.isSafeInteger(requestedMax) || requestedMax < 1 || requestedMax > 32) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'OPPORTUNITY_TARGET_INVALID', message: 'maxCount/targetCount must be an integer from 1 through 32.' }) })
  if (input.packet.sourceDurationTicks < PROJECT_TIMESCALE) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'OPPORTUNITY_TARGET_TOO_DENSE', message: 'The source is too short to contain a one-second motion opportunity.' }) })
  if (input.transcript && (input.transcript.projectId !== input.packet.projectId || input.transcript.sourceAssetId !== input.packet.sourceAssetId)) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'TRANSCRIPT_SOURCE_MISMATCH', message: 'The planning transcript does not belong to the analyzed source packet.' }) })
  let style: ReturnType<typeof styleLanguage>
  try { style = styleLanguage(input) }
  catch (error) { return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'STYLE_PLANNING_FAILED', message: error instanceof Error ? error.message : 'Style recommendation failed.' }) }) }

  const rawCandidates: readonly CandidateWithProvenanceV1[] = input.agentCandidates
    ? Object.freeze(input.agentCandidates.map((opportunity) => Object.freeze({ opportunity, origin: 'agent-proposed' as const, originalStartTick: opportunity.sourceStartTick, originalEndTick: opportunity.sourceEndTick, repairNotes: Object.freeze([]), score: bounded(opportunity.confidence, 0, 1) })))
    : (() => {
        const semantic = semanticAutoOpportunities(input, requestedMax)
        if (semantic.length === 0) return equalSliceFallback(input, requestedMax)
        return Object.freeze([...semantic, ...transcriptGapFallbacks(input, semantic, requestedMax)])
      })()
  let selected = validateCandidatesIndividually(input, rawCandidates, requestedMax)
  if (!input.agentCandidates && selected.accepted.length < requestedMax) {
    const fallbackSelection = validateCandidatesIndividually(input, equalSliceFallback(input, requestedMax), requestedMax)
    if (fallbackSelection.accepted.length > selected.accepted.length) selected = fallbackSelection
  }
  if (selected.accepted.length === 0) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'OPPORTUNITY_SOURCE_INVALID', message: 'No proposed or semantic opportunity survived source bounds, duration, overlap, and usefulness validation.', details: Object.freeze({ rejectedCandidates: selected.rejected }) }) })
  const ordered = [...selected.accepted].sort((a, b) => a.opportunity.sourceStartTick - b.opportunity.sourceStartTick || a.opportunity.id.localeCompare(b.opportunity.id))
  const ratio = ratioFor(input.packet)
  const library = getMotionLibraryCapabilityRecordsV1().map((item): CapabilityCatalogItemV1 => Object.freeze({ ...item }))
  const catalog = buildCapabilityCatalogV1({ sanverse: library })
  const planned: PlannedMotionOpportunityV1[] = []

  for (const entry of ordered) {
    const opportunity = entry.opportunity
    const ranked = rankCapabilitiesV1(catalog, {
      communicationGoal: opportunity.communicationGoal,
      presentationMode: opportunity.recommendedPresentationMode,
      ratio,
      styleTraits: Object.freeze(input.style?.traits ? [...input.style.traits] : ['clean','editorial']),
      requiredEditability: 'full',
      allowedLibraryScopes: Object.freeze(['sanverse']),
      requiredCapabilities: opportunity.requiredCapabilities,
    })
    if (ranked.length === 0) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'OPPORTUNITY_CAPABILITY_UNAVAILABLE', message: `No B2 Motion Library capability can satisfy ${opportunity.id}.`, details: Object.freeze({ presentationMode: opportunity.recommendedPresentationMode, communicationGoal: opportunity.communicationGoal }) }) })
    const capabilityRankings = Object.freeze(ranked.slice(0, 8).map((item): PlannedCapabilityRankingV1 => {
      const cohesion = scoreSceneCohesionV1(style.language, sceneSignature(style.language, opportunity, `${opportunity.id}:${item.capabilityId}`))
      const combinedScore = Number((item.score + cohesion.score * 20).toFixed(3))
      return Object.freeze({ ...item, cohesionScore: cohesion.score, cohesionLevel: cohesion.level, combinedScore })
    }).sort((a, b) => b.combinedScore - a.combinedScore || a.capabilityId.localeCompare(b.capabilityId)))
    const recipeMatches = Object.freeze(COMPONENT_RECIPES.map((recipe): PlannedRecipeMatchV1 => Object.freeze({
      recipeId: recipe.recipeId,
      componentId: recipe.componentId,
      score: recipeGoalScore(recipe, opportunity.communicationGoal),
      reason: `Existing production recipe ${recipe.recipeId} is scored against communication goal ${opportunity.communicationGoal}; it is advisory and does not replace the selected Motion Library scene.`,
    })).sort((a, b) => b.score - a.score || a.recipeId.localeCompare(b.recipeId)).slice(0, 3))
    planned.push(Object.freeze({
      opportunity,
      evidence: sourceEvidenceFor(input.packet, opportunity),
      planningProvenance: Object.freeze({
        origin: entry.origin,
        originalStartTick: entry.originalStartTick,
        originalEndTick: entry.originalEndTick,
        normalizedStartTick: opportunity.sourceStartTick,
        normalizedEndTick: opportunity.sourceEndTick,
        repairNotes: Object.freeze([...entry.repairNotes]),
        score: entry.score,
      }),
      selectedCapabilityId: capabilityRankings[0]!.capabilityId,
      capabilityRankings,
      recipeMatches,
    }))
  }

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      schemaVersion: MOTION_OPPORTUNITY_MAP_SCHEMA_V1,
      id: `opmap_${tail(`${input.packet.id}:${requestedMax}:${planned.map((item) => item.opportunity.id).join(':')}`)}`,
      projectId: input.packet.projectId,
      projectRevision: input.packet.projectRevision,
      sourcePacketId: input.packet.id,
      targetCount: requestedMax,
      requestedMax,
      selectedCount: planned.length,
      rejectedCandidates: selected.rejected,
      styleLockId: style.styleLockId,
      styleRecommendation: style.recommendation,
      creativeLanguage: style.language,
      opportunities: Object.freeze(planned),
      planningRules: Object.freeze({ minimumOpportunityTicks: PROJECT_TIMESCALE, overlapPolicy: 'non-overlapping-half-open' as const, capabilityCatalogSource: 'b2-motion-library' as const, recipeCatalogSource: 'edit-domain-component-recipes' as const, agentCandidatesValidated: Boolean(input.agentCandidates) }),
    }),
  })
}
