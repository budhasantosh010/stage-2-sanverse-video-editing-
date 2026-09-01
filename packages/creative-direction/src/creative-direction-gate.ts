import type { MotionPresentationModeV1 } from '@sanverse/motion-contract'
import type { StyleLockRecommendationV1, VideoCreativeLanguageV1 } from './style-cohesion.ts'

export const BRAND_CONTEXT_SCHEMA_V1 = 'sanverse.brand-context/v1' as const
export const CREATIVE_DIRECTION_PROPOSAL_SCHEMA_V1 = 'sanverse.creative-direction-proposal/v1' as const
export const VIDEO_CREATIVE_LANGUAGE_DRAFT_SCHEMA_V1 = 'sanverse.video-creative-language-draft/v1' as const
export const APPROVED_STYLE_LOCK_SCHEMA_V1 = 'sanverse.approved-style-lock/v1' as const

export interface CreativeStyleSignalV1 {
  readonly id: string
  readonly motionIntensity?: number
  readonly overshoot?: number
  readonly density?: 'low' | 'medium' | 'high'
  readonly surface?: string
}

export interface BrandContextV1 {
  readonly schemaVersion: typeof BRAND_CONTEXT_SCHEMA_V1
  readonly id: string
  readonly projectId: string
  readonly sourceAssetId: string
  readonly ownerBrief?: string
  readonly palette?: readonly string[]
  readonly typeFamilies?: readonly string[]
  readonly traits: readonly string[]
  readonly logoAssetRefs: readonly string[]
  readonly referenceAssetRefs: readonly string[]
  readonly approvedAssetSignals: readonly CreativeStyleSignalV1[]
  readonly promotedAssetSignals: readonly CreativeStyleSignalV1[]
  readonly provenance: Readonly<{
    briefSources: readonly string[]
    assetRefs: readonly string[]
  }>
}

export interface CreativeVideoContextV1 {
  readonly talkingHead: boolean
  readonly informationDensity: 'low' | 'medium' | 'high'
  readonly negativeSpace: 'low' | 'medium' | 'high' | 'unknown'
  readonly subjectPriority: 'low' | 'medium' | 'high'
}

export interface VideoCreativeLanguageDraftV1 {
  readonly schemaVersion: typeof VIDEO_CREATIVE_LANGUAGE_DRAFT_SCHEMA_V1
  readonly preferredPresentationModes: readonly MotionPresentationModeV1[]
  readonly typographyLanguage: 'editorial' | 'interface' | 'expressive'
  readonly surfaceLanguage: 'flat' | 'soft-depth' | 'high-depth'
  readonly motionRhythm: 'calm' | 'balanced' | 'energetic'
  readonly transitionVocabulary: readonly ('cut' | 'fade' | 'slide' | 'scale' | 'mask')[]
  readonly densityPolicy: 'low' | 'medium' | 'high'
  readonly cameraPolicy: 'static' | 'restrained' | 'expressive'
  readonly paletteRoles: readonly string[]
  readonly easingFamily: readonly ('soft' | 'linear' | 'snappy')[]
  readonly overshootMax: number
  readonly allowedExceptions: VideoCreativeLanguageV1['allowedExceptions']
}

export type CreativeDirectionProposalStatusV1 = 'draft' | 'awaiting-owner' | 'owner-approved' | 'rejected'

export interface CreativeDirectionProposalV1 {
  readonly schemaVersion: typeof CREATIVE_DIRECTION_PROPOSAL_SCHEMA_V1
  readonly proposalId: string
  readonly projectId: string
  readonly projectRevision: number
  readonly sourcePacketId: string
  readonly brandContextId?: string
  readonly revision: number
  readonly status: CreativeDirectionProposalStatusV1
  readonly styleRecommendation: StyleLockRecommendationV1
  readonly creativeLanguageDraft: VideoCreativeLanguageDraftV1
  readonly reasons: readonly string[]
  readonly ownerApprovalId?: string
}

export interface ApprovedStyleLockV1 {
  readonly schemaVersion: typeof APPROVED_STYLE_LOCK_SCHEMA_V1
  readonly styleLockId: string
  readonly proposalId: string
  readonly proposalRevision: number
  readonly projectId: string
  readonly sourcePacketId: string
  readonly recommendation: StyleLockRecommendationV1
  readonly creativeLanguage: VideoCreativeLanguageV1
  readonly ownerApprovalId: string
  readonly locked: true
  readonly contentHash: string
}

export interface CreativeDirectionChangesV1 {
  readonly paletteRoles?: Partial<StyleLockRecommendationV1['visual']['paletteRoles']>
  readonly typeFamily?: string | null
  readonly radius?: number
  readonly stroke?: number
  readonly shadow?: number
  readonly depth?: number
  readonly texture?: StyleLockRecommendationV1['visual']['texture']
  readonly density?: StyleLockRecommendationV1['composition']['density']
  readonly alignment?: StyleLockRecommendationV1['composition']['alignment']
  readonly safeArea?: number
  readonly negativeSpacePreference?: StyleLockRecommendationV1['composition']['negativeSpacePreference']
  readonly subjectPriority?: StyleLockRecommendationV1['composition']['subjectPriority']
  readonly baseTiming?: StyleLockRecommendationV1['motion']['baseTiming']
  readonly primaryEase?: StyleLockRecommendationV1['motion']['primaryEase']
  readonly secondaryEase?: StyleLockRecommendationV1['motion']['secondaryEase']
  readonly overshootAllowance?: number
  readonly travelDistance?: number
  readonly staggerRhythm?: number
  readonly holdDiscipline?: StyleLockRecommendationV1['motion']['holdDiscipline']
  readonly cameraAggressiveness?: number
  readonly effectIntensity?: number
  readonly preferredPresentationModes?: readonly MotionPresentationModeV1[]
  readonly transitionVocabulary?: VideoCreativeLanguageDraftV1['transitionVocabulary']
  readonly typographyLanguage?: VideoCreativeLanguageDraftV1['typographyLanguage']
  readonly surfaceLanguage?: VideoCreativeLanguageDraftV1['surfaceLanguage']
}

export const buildVideoCreativeLanguageDraftV1 = (recommendation: StyleLockRecommendationV1): VideoCreativeLanguageDraftV1 => Object.freeze({
  schemaVersion: VIDEO_CREATIVE_LANGUAGE_DRAFT_SCHEMA_V1,
  preferredPresentationModes: Object.freeze<MotionPresentationModeV1[]>(['overlay', 'full-screen-motion', 'picture-in-picture']),
  typographyLanguage: 'editorial',
  surfaceLanguage: recommendation.visual.depth <= 0.05 ? 'flat' : recommendation.visual.depth >= 0.5 ? 'high-depth' : 'soft-depth',
  motionRhythm: recommendation.motion.baseTiming,
  transitionVocabulary: Object.freeze(['cut', 'fade', 'scale'] as const),
  densityPolicy: recommendation.composition.density,
  cameraPolicy: recommendation.motion.cameraAggressiveness > 0.45 ? 'expressive' : recommendation.motion.cameraAggressiveness > 0.1 ? 'restrained' : 'static',
  paletteRoles: Object.freeze(['background', 'surface', 'text', 'accent']),
  easingFamily: Object.freeze([...new Set([recommendation.motion.primaryEase, recommendation.motion.secondaryEase])]) as readonly ('soft'|'linear'|'snappy')[],
  overshootMax: recommendation.motion.overshootAllowance,
  allowedExceptions: Object.freeze([]),
})

export const compileVideoCreativeLanguageV1 = (input: Readonly<{ styleLockId: string; proposalRevision: number; draft: VideoCreativeLanguageDraftV1 }>): VideoCreativeLanguageV1 => Object.freeze({
  schemaVersion: 'sanverse.video-creative-language/v1',
  id: `language_${input.styleLockId.replace(/^stylelock_/u, '')}`,
  version: input.proposalRevision,
  styleLockId: input.styleLockId,
  preferredPresentationModes: Object.freeze([...input.draft.preferredPresentationModes]),
  typographyLanguage: input.draft.typographyLanguage,
  surfaceLanguage: input.draft.surfaceLanguage,
  motionRhythm: input.draft.motionRhythm,
  transitionVocabulary: Object.freeze([...input.draft.transitionVocabulary]),
  densityPolicy: input.draft.densityPolicy,
  cameraPolicy: input.draft.cameraPolicy,
  paletteRoles: Object.freeze([...input.draft.paletteRoles]),
  easingFamily: Object.freeze([...input.draft.easingFamily]),
  overshootMax: input.draft.overshootMax,
  allowedExceptions: Object.freeze([...input.draft.allowedExceptions]),
})

const assertDirectionChangesV1 = (changes: CreativeDirectionChangesV1): void => {
  const finite = (name:string,value:unknown,min:number,max:number):void => { if(value!==undefined&&(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)) throw new RangeError(`${name} must be between ${min} and ${max}.`) }
  finite('radius',changes.radius,0,256); finite('stroke',changes.stroke,0,32); finite('shadow',changes.shadow,0,1); finite('depth',changes.depth,0,1); finite('safeArea',changes.safeArea,0,0.45)
  finite('overshootAllowance',changes.overshootAllowance,0,0.4); finite('travelDistance',changes.travelDistance,0,640); finite('staggerRhythm',changes.staggerRhythm,0,4); finite('cameraAggressiveness',changes.cameraAggressiveness,0,1); finite('effectIntensity',changes.effectIntensity,0,1)
  if(changes.typeFamily!==undefined&&changes.typeFamily!==null&&(typeof changes.typeFamily!=='string'||!changes.typeFamily.trim()||changes.typeFamily.length>120)) throw new RangeError('typeFamily must be null or bounded non-empty text.')
  if(changes.paletteRoles){for(const [role,color] of Object.entries(changes.paletteRoles)) if(typeof color!=='string'||!/^#[a-f0-9]{6}$/iu.test(color)) throw new RangeError(`paletteRoles.${role} must be a six-digit hex color.`)}
  const enumValue=(name:string,value:unknown,allowed:readonly string[]):void=>{if(value!==undefined&&!allowed.includes(String(value)))throw new RangeError(`${name} is unsupported.`)}
  enumValue('texture',changes.texture,['none','subtle']); enumValue('density',changes.density,['low','medium','high']); enumValue('alignment',changes.alignment,['editorial','centered','adaptive']); enumValue('negativeSpacePreference',changes.negativeSpacePreference,['preserve','adaptive']); enumValue('subjectPriority',changes.subjectPriority,['low','medium','high']); enumValue('baseTiming',changes.baseTiming,['calm','balanced','energetic']); enumValue('primaryEase',changes.primaryEase,['soft','snappy']); enumValue('secondaryEase',changes.secondaryEase,['soft','linear']); enumValue('holdDiscipline',changes.holdDiscipline,['short','balanced','long']); enumValue('typographyLanguage',changes.typographyLanguage,['editorial','interface','expressive']); enumValue('surfaceLanguage',changes.surfaceLanguage,['flat','soft-depth','high-depth'])
  if(changes.preferredPresentationModes!==undefined&&(!Array.isArray(changes.preferredPresentationModes)||changes.preferredPresentationModes.length===0||new Set(changes.preferredPresentationModes).size!==changes.preferredPresentationModes.length||changes.preferredPresentationModes.some((value)=>!['overlay','full-screen-motion','picture-in-picture','isolated-graphic'].includes(String(value))))) throw new RangeError('preferredPresentationModes must contain unique supported presentation modes.')
  if(changes.transitionVocabulary!==undefined&&(!Array.isArray(changes.transitionVocabulary)||changes.transitionVocabulary.length===0||new Set(changes.transitionVocabulary).size!==changes.transitionVocabulary.length||changes.transitionVocabulary.some((value)=>!['cut','fade','slide','scale','mask'].includes(String(value))))) throw new RangeError('transitionVocabulary must contain unique supported transitions.')
}

export const applyCreativeDirectionChangesV1 = (
  proposal: CreativeDirectionProposalV1,
  changes: CreativeDirectionChangesV1,
): CreativeDirectionProposalV1 => {
  assertDirectionChangesV1(changes)
  const r = proposal.styleRecommendation
  const visual = Object.freeze({
    ...r.visual,
    paletteRoles: Object.freeze({ ...r.visual.paletteRoles, ...(changes.paletteRoles ?? {}) }),
    ...(changes.typeFamily === null ? { typeFamily: undefined } : changes.typeFamily !== undefined ? { typeFamily: changes.typeFamily } : {}),
    ...(changes.radius !== undefined ? { radius: changes.radius } : {}),
    ...(changes.stroke !== undefined ? { stroke: changes.stroke } : {}),
    ...(changes.shadow !== undefined ? { shadow: changes.shadow } : {}),
    ...(changes.depth !== undefined ? { depth: changes.depth } : {}),
    ...(changes.texture !== undefined ? { texture: changes.texture } : {}),
  }) as StyleLockRecommendationV1['visual']
  const motion = Object.freeze({
    ...r.motion,
    ...(changes.baseTiming !== undefined ? { baseTiming: changes.baseTiming } : {}),
    ...(changes.primaryEase !== undefined ? { primaryEase: changes.primaryEase } : {}),
    ...(changes.secondaryEase !== undefined ? { secondaryEase: changes.secondaryEase } : {}),
    ...(changes.overshootAllowance !== undefined ? { overshootAllowance: changes.overshootAllowance } : {}),
    ...(changes.travelDistance !== undefined ? { travelDistance: changes.travelDistance } : {}),
    ...(changes.staggerRhythm !== undefined ? { staggerRhythm: changes.staggerRhythm } : {}),
    ...(changes.holdDiscipline !== undefined ? { holdDiscipline: changes.holdDiscipline } : {}),
    ...(changes.cameraAggressiveness !== undefined ? { cameraAggressiveness: changes.cameraAggressiveness } : {}),
    ...(changes.effectIntensity !== undefined ? { effectIntensity: changes.effectIntensity } : {}),
  })
  const composition = Object.freeze({
    ...r.composition,
    ...(changes.density !== undefined ? { density: changes.density } : {}),
    ...(changes.alignment !== undefined ? { alignment: changes.alignment } : {}),
    ...(changes.safeArea !== undefined ? { safeArea: changes.safeArea } : {}),
    ...(changes.negativeSpacePreference !== undefined ? { negativeSpacePreference: changes.negativeSpacePreference } : {}),
    ...(changes.subjectPriority !== undefined ? { subjectPriority: changes.subjectPriority } : {}),
  })
  const recommendation: StyleLockRecommendationV1 = Object.freeze({ ...r, visual, motion, composition })
  const currentDraft = proposal.creativeLanguageDraft
  const draft: VideoCreativeLanguageDraftV1 = Object.freeze({
    ...buildVideoCreativeLanguageDraftV1(recommendation),
    preferredPresentationModes: Object.freeze(changes.preferredPresentationModes ? [...changes.preferredPresentationModes] : [...currentDraft.preferredPresentationModes]),
    transitionVocabulary: Object.freeze(changes.transitionVocabulary ? [...changes.transitionVocabulary] : [...currentDraft.transitionVocabulary]),
    typographyLanguage: changes.typographyLanguage ?? currentDraft.typographyLanguage,
    surfaceLanguage: changes.surfaceLanguage ?? currentDraft.surfaceLanguage,
    allowedExceptions: currentDraft.allowedExceptions,
  })
  return Object.freeze({ ...proposal, revision: proposal.revision + 1, status: 'awaiting-owner', styleRecommendation: recommendation, creativeLanguageDraft: draft, ownerApprovalId: undefined })
}

export const canonicalApprovedStyleContentV1 = (proposal: CreativeDirectionProposalV1): string => JSON.stringify({
  projectId: proposal.projectId,
  projectRevision: proposal.projectRevision,
  sourcePacketId: proposal.sourcePacketId,
  brandContextId: proposal.brandContextId ?? null,
  proposalId: proposal.proposalId,
  proposalRevision: proposal.revision,
  recommendation: proposal.styleRecommendation,
  creativeLanguageDraft: proposal.creativeLanguageDraft,
})
