import type { MotionAspectRatio, MotionComponentDefinitionV1, MotionPerformanceClass } from '@sanverse/motion-contract'
import { MOTION_COMPONENT_CATALOG, MOTION_COMPONENT_MODULES } from './catalog.ts'
import { INITIAL_MOTION_STYLE_PACKS, SANVERSE_CLEAN_STYLE, CREATOR_ENERGETIC_STYLE, EDITORIAL_STYLE, TECH_UI_STYLE } from './style-packs.ts'
import type { MotionLibraryQualityTierV1, MotionLibraryReviewStatusV1, MotionQualityReviewV1 } from './library-review.ts'

export const MOTION_LIBRARY_CATEGORIES = Object.freeze([
  'typography', 'numbers-data', 'social-proof', 'software-product', 'explainers', 'diagrams', 'editorial-documentary', 'cta', 'annotations', 'transitions', 'wow-cinematic',
] as const)
export type MotionLibraryCategoryV1 = (typeof MOTION_LIBRARY_CATEGORIES)[number]

export const MOTION_COMMUNICATION_INTENTS = Object.freeze([
  'headline','emphasis','question','quote','definition','statistic','percentage','money','growth','comparison','social-proof','review','comment','testimonial','process','steps','workflow','decision','hierarchy','network','timeline','roadmap','product-demo','software-demo','notification','conversation','agent-activity','cta','subscribe','download','evidence','citation','cinematic-impact','premium-product','visual-hook','ranking','status','progress','security','code','terminal','intersection','breakdown','transition',
] as const)
export type MotionCommunicationIntentV1 = (typeof MOTION_COMMUNICATION_INTENTS)[number]

export const MOTION_USE_CONTEXTS = Object.freeze([
  'youtube-long-form','shorts','reels','talking-head','software-tutorial','product-demo','business','education','documentary','creator-commentary','social-media',
] as const)
export type MotionUseContextV1 = (typeof MOTION_USE_CONTEXTS)[number]

export const MOTION_FORMAT_USES = Object.freeze(['long-form','short-form','overlay','full-screen','picture-in-picture','screen-demo','hero','transition'] as const)
export type MotionFormatUseV1 = (typeof MOTION_FORMAT_USES)[number]

export const MOTION_VISUAL_TRAITS = Object.freeze(['minimal','clean','premium','cinematic','energetic','technical','editorial','playful','glass','dark','light','bold','restrained','data-driven','structured'] as const)
export type MotionVisualTraitV1 = (typeof MOTION_VISUAL_TRAITS)[number]

export const MOTION_MOTION_TRAITS = Object.freeze(['fade','slide','scale','stagger','count','draw','wipe','mask-reveal','type-reveal','spring','parallax','glow','depth','sequential','hold'] as const)
export type MotionMotionTraitV1 = (typeof MOTION_MOTION_TRAITS)[number]

export const MOTION_LIBRARY_MILESTONES = Object.freeze(['A0-A16','A17','A18','A19','A20','A21','unknown'] as const)
export type MotionLibraryMilestoneV1 = (typeof MOTION_LIBRARY_MILESTONES)[number]
export const MOTION_LIBRARY_BACKGROUNDS = Object.freeze(['dark','light','busy','neutral'] as const)
export type MotionLibraryBackgroundV1 = (typeof MOTION_LIBRARY_BACKGROUNDS)[number]

export interface MotionLibraryPreviewDefinitionV1 {
  readonly fixtureId: string
  readonly durationTicks: number
  readonly posterTick: number
  readonly ratio: '16:9'
  readonly stylePackId: string
  readonly backgroundPreset: MotionLibraryBackgroundV1
  readonly reducedMotion: false
  readonly previewHash: string
}

export interface MotionLibraryReviewSummaryV1 {
  readonly status: MotionLibraryReviewStatusV1
  readonly qualityTier: MotionLibraryQualityTierV1
  readonly fullPlaybackVerified: boolean
}

export interface MotionLibraryCatalogEntryV1 {
  readonly componentId: `sanverse.${string}`
  readonly displayName: string
  readonly shortDescription: string
  readonly primaryCategory: MotionLibraryCategoryV1
  readonly secondaryCategories: readonly MotionLibraryCategoryV1[]
  readonly communicationIntents: readonly MotionCommunicationIntentV1[]
  readonly recommendedContexts: readonly MotionUseContextV1[]
  readonly formats: readonly MotionFormatUseV1[]
  readonly visualTraits: readonly MotionVisualTraitV1[]
  readonly motionTraits: readonly MotionMotionTraitV1[]
  readonly introducedInMilestone: MotionLibraryMilestoneV1
  readonly aliases: readonly string[]
  readonly performanceClass: MotionPerformanceClass
  readonly preview: MotionLibraryPreviewDefinitionV1
  readonly review: MotionLibraryReviewSummaryV1
  readonly referenceLineage: readonly string[]
}

export interface MotionLibraryCollectionItemV1 {
  readonly componentId: `sanverse.${string}`
  readonly fixtureId?: string
  readonly variantId?: string
}
export interface MotionLibraryCollectionV1 {
  readonly id: string
  readonly displayName: string
  readonly description: string
  readonly provisional?: boolean
  readonly items: readonly MotionLibraryCollectionItemV1[]
}

const A17 = new Set([
  'sanverse.comment-highlight','sanverse.client-proof-strip','sanverse.social-proof-stack','sanverse.myth-fact','sanverse.problem-solution','sanverse.source-citation','sanverse.browser-demo','sanverse.chat-thread','sanverse.dashboard-snapshot','sanverse.search-results','sanverse.upload-status','sanverse.cursor-callout',
])
const A18 = new Set(['sanverse.keyword-slam','sanverse.three-beat-headline','sanverse.stacked-hook','sanverse.sentence-deconstruction','sanverse.punch-word-reveal','sanverse.poll-vote-result','sanverse.ranking-podium','sanverse.app-feature-spotlight','sanverse.keyboard-shortcut-callout'])
const A19 = new Set(['sanverse.decision-tree','sanverse.swimlane-process','sanverse.journey-map','sanverse.priority-matrix','sanverse.value-chain','sanverse.layer-stack-explainer','sanverse.ecosystem-regions-map','sanverse.dependency-map'])
const A20 = new Set(['sanverse.conversation-toast-stack','sanverse.floating-prompt-composer','sanverse.product-ui-story-scene','sanverse.agent-work-log','sanverse.scoped-access-comparison','sanverse.keyword-brand-lockup'])
const A21 = new Set(['sanverse.trend-line-chart','sanverse.donut-breakdown','sanverse.venn-intersection','sanverse.feature-comparison-table','sanverse.code-diff-spotlight','sanverse.terminal-command-story'])

const SOFTWARE = new Set(['sanverse.notification-card','sanverse.progress-status','sanverse.live-status','sanverse.browser-demo','sanverse.chat-thread','sanverse.dashboard-snapshot','sanverse.search-results','sanverse.upload-status','sanverse.cursor-callout','sanverse.keyboard-shortcut-callout','sanverse.app-feature-spotlight', ...A20])
const SOCIAL = new Set(['sanverse.quote-card','sanverse.testimonial-card','sanverse.review-card','sanverse.proof-stat-card','sanverse.comment-highlight','sanverse.client-proof-strip','sanverse.social-proof-stack'])
const DATA = new Set(['sanverse.cost-value-card','sanverse.single-metric','sanverse.metric-delta','sanverse.before-after','sanverse.ratio-card','sanverse.score-card','sanverse.stat-stack','sanverse.price-breakdown','sanverse.proof-stat-card','sanverse.poll-vote-result','sanverse.ranking-podium','sanverse.trend-line-chart','sanverse.donut-breakdown','sanverse.feature-comparison-table'])
const EDITORIAL = new Set(['sanverse.quote-card','sanverse.source-citation','sanverse.lower-third-title','sanverse.definition-title','sanverse.chapter-title'])
const EXPLAINERS = new Set(['sanverse.process-flow','sanverse.funnel-diagram','sanverse.hierarchy-diagram','sanverse.flywheel-diagram','sanverse.sequence-diagram','sanverse.myth-fact','sanverse.problem-solution', ...A19])
const WOW = new Set(['sanverse.kinetic-headline','sanverse.keyword-slam','sanverse.three-beat-headline','sanverse.stacked-hook','sanverse.sentence-deconstruction','sanverse.punch-word-reveal','sanverse.keyword-brand-lockup','sanverse.venn-intersection','sanverse.trend-line-chart'])
const OVERLAYS = new Set(['sanverse.lower-third-title','sanverse.timer-status-pill','sanverse.urgency-banner','sanverse.notification-card','sanverse.live-status','sanverse.comment-highlight','sanverse.cursor-callout','sanverse.conversation-toast-stack','sanverse.floating-prompt-composer'])
const SHORT_FORM = new Set([...A18, 'sanverse.kinetic-headline','sanverse.question-title','sanverse.highlight-title','sanverse.comment-highlight','sanverse.subscribe-cta','sanverse.follow-cta'])
const PRODUCT_STORY_REFERENCE = Object.freeze(['sanverse.conversation-toast-stack','sanverse.floating-prompt-composer','sanverse.product-ui-story-scene','sanverse.agent-work-log','sanverse.scoped-access-comparison','sanverse.keyword-brand-lockup'] as const)

const milestoneFor = (id: string): MotionLibraryMilestoneV1 => A21.has(id) ? 'A21' : A20.has(id) ? 'A20' : A19.has(id) ? 'A19' : A18.has(id) ? 'A18' : A17.has(id) ? 'A17' : 'A0-A16'
const unique = <T extends string>(values: readonly T[]): readonly T[] => Object.freeze([...new Set(values)])
const contains = (definition: MotionComponentDefinitionV1, fragment: string): boolean => `${definition.id} ${definition.name} ${definition.purpose}`.toLowerCase().includes(fragment)

const primaryCategoryFor = (definition: MotionComponentDefinitionV1): MotionLibraryCategoryV1 => {
  if (definition.id === 'sanverse.chapter-break') return 'transitions'
  if (definition.id === 'sanverse.cursor-callout') return 'annotations'
  if (WOW.has(definition.id) && (definition.id === 'sanverse.keyword-brand-lockup' || definition.id === 'sanverse.venn-intersection')) return 'wow-cinematic'
  if (SOFTWARE.has(definition.id)) return 'software-product'
  if (SOCIAL.has(definition.id)) return 'social-proof'
  if (DATA.has(definition.id) || definition.category === 'counter' || definition.category === 'timer') return 'numbers-data'
  if (A19.has(definition.id) || EXPLAINERS.has(definition.id)) return definition.category === 'diagram' ? 'diagrams' : 'explainers'
  if (EDITORIAL.has(definition.id)) return 'editorial-documentary'
  if (definition.category === 'diagram') return 'diagrams'
  if (definition.category === 'cta') return 'cta'
  if (definition.category === 'headline' || definition.category === 'typography' || definition.category === 'lower-third') return 'typography'
  if (definition.category === 'transition') return 'transitions'
  if (definition.category === 'accent') return 'annotations'
  if (definition.category === 'callout') return 'editorial-documentary'
  if (definition.category === 'comparison') return 'numbers-data'
  return 'explainers'
}

const secondaryCategoriesFor = (definition: MotionComponentDefinitionV1, primary: MotionLibraryCategoryV1): readonly MotionLibraryCategoryV1[] => unique([
  ...(DATA.has(definition.id) && primary !== 'numbers-data' ? ['numbers-data' as const] : []),
  ...(SOFTWARE.has(definition.id) && primary !== 'software-product' ? ['software-product' as const] : []),
  ...(WOW.has(definition.id) && primary !== 'wow-cinematic' ? ['wow-cinematic' as const] : []),
  ...(EDITORIAL.has(definition.id) && primary !== 'editorial-documentary' ? ['editorial-documentary' as const] : []),
  ...(EXPLAINERS.has(definition.id) && primary !== 'explainers' && primary !== 'diagrams' ? ['explainers' as const] : []),
])

const intentsFor = (definition: MotionComponentDefinitionV1): readonly MotionCommunicationIntentV1[] => {
  const values: MotionCommunicationIntentV1[] = []
  if (definition.category === 'headline' || definition.category === 'typography' || contains(definition, 'title')) values.push('headline')
  if (contains(definition, 'emphasis') || contains(definition, 'highlight') || contains(definition, 'slam') || contains(definition, 'punch')) values.push('emphasis')
  if (contains(definition, 'question')) values.push('question')
  if (contains(definition, 'quote')) values.push('quote')
  if (contains(definition, 'definition')) values.push('definition')
  if (DATA.has(definition.id) || contains(definition, 'stat')) values.push('statistic')
  if (contains(definition, 'percent') || contains(definition, 'poll') || contains(definition, 'donut') || contains(definition, 'ratio')) values.push('percentage')
  if (contains(definition, 'cost') || contains(definition, 'price') || contains(definition, 'money')) values.push('money')
  if (contains(definition, 'delta') || contains(definition, 'trend') || contains(definition, 'growth')) values.push('growth')
  if (contains(definition, 'comparison') || contains(definition, 'before') || contains(definition, 'pros') || contains(definition, 'myth') || contains(definition, 'solution') || contains(definition, 'versus') || contains(definition, 'vs ')) values.push('comparison')
  if (SOCIAL.has(definition.id)) values.push('social-proof')
  if (contains(definition, 'review')) values.push('review')
  if (contains(definition, 'comment')) values.push('comment')
  if (contains(definition, 'testimonial')) values.push('testimonial')
  if (contains(definition, 'process') || contains(definition, 'workflow') || contains(definition, 'journey') || contains(definition, 'sequence') || contains(definition, 'funnel') || contains(definition, 'flywheel')) values.push('process')
  if (contains(definition, 'step') || contains(definition, 'numbered') || contains(definition, 'agenda')) values.push('steps')
  if (contains(definition, 'workflow') || contains(definition, 'agent') || contains(definition, 'product-ui')) values.push('workflow')
  if (contains(definition, 'decision') || contains(definition, 'priority')) values.push('decision')
  if (contains(definition, 'hierarchy') || contains(definition, 'layer') || contains(definition, 'dependency')) values.push('hierarchy')
  if (contains(definition, 'network') || contains(definition, 'ecosystem')) values.push('network')
  if (contains(definition, 'timeline') || contains(definition, 'journey') || contains(definition, 'milestone')) values.push('timeline')
  if (contains(definition, 'roadmap')) values.push('roadmap')
  if (SOFTWARE.has(definition.id)) values.push('software-demo')
  if (A20.has(definition.id) || contains(definition, 'product')) values.push('product-demo')
  if (contains(definition, 'notification') || contains(definition, 'toast')) values.push('notification')
  if (contains(definition, 'chat') || contains(definition, 'conversation') || contains(definition, 'prompt')) values.push('conversation')
  if (contains(definition, 'agent')) values.push('agent-activity')
  if (definition.category === 'cta' || contains(definition, 'cta') || contains(definition, 'end card')) values.push('cta')
  if (contains(definition, 'subscribe')) values.push('subscribe')
  if (contains(definition, 'promo') || contains(definition, 'download')) values.push('download')
  if (contains(definition, 'source') || contains(definition, 'proof')) values.push('evidence')
  if (contains(definition, 'citation')) values.push('citation')
  if (WOW.has(definition.id)) values.push('visual-hook','cinematic-impact')
  if (A20.has(definition.id) || definition.id === 'sanverse.app-feature-spotlight') values.push('premium-product')
  if (contains(definition, 'ranking') || contains(definition, 'score') || contains(definition, 'podium')) values.push('ranking')
  if (contains(definition, 'status') || contains(definition, 'live')) values.push('status')
  if (contains(definition, 'progress') || contains(definition, 'upload')) values.push('progress')
  if (contains(definition, 'access') || contains(definition, 'security')) values.push('security')
  if (contains(definition, 'code')) values.push('code')
  if (contains(definition, 'terminal')) values.push('terminal')
  if (contains(definition, 'venn') || contains(definition, 'intersection')) values.push('intersection')
  if (contains(definition, 'breakdown') || contains(definition, 'funnel')) values.push('breakdown')
  if (definition.id === 'sanverse.chapter-break') values.push('transition')
  return unique(values.length > 0 ? values : ['headline'])
}

const contextsFor = (definition: MotionComponentDefinitionV1, primary: MotionLibraryCategoryV1): readonly MotionUseContextV1[] => unique([
  'youtube-long-form',
  ...(SHORT_FORM.has(definition.id) ? ['shorts' as const, 'reels' as const] : []),
  ...(OVERLAYS.has(definition.id) || primary === 'typography' || primary === 'social-proof' ? ['talking-head' as const] : []),
  ...(primary === 'software-product' ? ['software-tutorial' as const, 'product-demo' as const] : []),
  ...(primary === 'editorial-documentary' ? ['documentary' as const] : []),
  ...(primary === 'social-proof' || definition.category === 'cta' ? ['creator-commentary' as const, 'social-media' as const] : []),
  ...(primary === 'numbers-data' || primary === 'software-product' || primary === 'explainers' || primary === 'diagrams' ? ['business' as const, 'education' as const] : []),
])

const formatsFor = (definition: MotionComponentDefinitionV1, primary: MotionLibraryCategoryV1): readonly MotionFormatUseV1[] => unique([
  ...(OVERLAYS.has(definition.id) ? ['overlay' as const] : ['full-screen' as const]),
  ...(SHORT_FORM.has(definition.id) ? ['short-form' as const] : ['long-form' as const]),
  ...(primary === 'software-product' ? ['screen-demo' as const] : []),
  ...(definition.id === 'sanverse.browser-demo' || definition.id === 'sanverse.product-ui-story-scene' ? ['picture-in-picture' as const] : []),
  ...(WOW.has(definition.id) ? ['hero' as const] : []),
  ...(definition.id === 'sanverse.chapter-break' ? ['transition' as const] : []),
])

const visualTraitsFor = (definition: MotionComponentDefinitionV1, primary: MotionLibraryCategoryV1): readonly MotionVisualTraitV1[] => unique([
  'clean',
  ...(primary === 'numbers-data' ? ['technical' as const, 'data-driven' as const, 'structured' as const] : []),
  ...(primary === 'software-product' || primary === 'diagrams' ? ['technical' as const, 'structured' as const] : []),
  ...(primary === 'editorial-documentary' ? ['editorial' as const, 'restrained' as const] : []),
  ...(primary === 'wow-cinematic' || WOW.has(definition.id) ? ['premium' as const, 'cinematic' as const, 'bold' as const] : []),
  ...(SHORT_FORM.has(definition.id) ? ['energetic' as const, 'bold' as const] : []),
  ...(primary === 'social-proof' ? ['playful' as const] : []),
  ...(OVERLAYS.has(definition.id) ? ['minimal' as const] : []),
])

const motionTraitsFor = (definition: MotionComponentDefinitionV1): readonly MotionMotionTraitV1[] => {
  const eventNames = definition.events.map((event) => event.name.toLowerCase()).join(' ')
  return unique([
    'fade',
    ...(A18.has(definition.id) || A19.has(definition.id) || A20.has(definition.id) || A21.has(definition.id) ? ['slide' as const, 'scale' as const, 'stagger' as const] : []),
    ...(contains(definition, 'metric') || contains(definition, 'timer') || contains(definition, 'donut') ? ['count' as const] : []),
    ...(definition.category === 'diagram' || contains(definition, 'trend') || eventNames.includes('ring') ? ['draw' as const] : []),
    ...(eventNames.includes('type') || contains(definition, 'terminal') || contains(definition, 'prompt') ? ['type-reveal' as const] : []),
    ...(eventNames.includes('message') || eventNames.includes('row') || eventNames.includes('step') || eventNames.includes('beat') ? ['sequential' as const] : []),
    ...(WOW.has(definition.id) ? ['spring' as const] : []),
    ...(definition.events.some((event) => event.normalizedTime > 0.65 && event.normalizedTime < 0.95) ? ['hold' as const] : []),
  ])
}

const styleFor = (primary: MotionLibraryCategoryV1): string => primary === 'software-product' ? TECH_UI_STYLE.id : primary === 'editorial-documentary' ? EDITORIAL_STYLE.id : primary === 'wow-cinematic' ? CREATOR_ENERGETIC_STYLE.id : SANVERSE_CLEAN_STYLE.id
const backgroundFor = (primary: MotionLibraryCategoryV1, definition: MotionComponentDefinitionV1): MotionLibraryBackgroundV1 => OVERLAYS.has(definition.id) || primary === 'software-product' ? 'busy' : primary === 'editorial-documentary' ? 'light' : primary === 'wow-cinematic' ? 'dark' : 'neutral'
const posterTickFor = (definition: MotionComponentDefinitionV1): number => {
  const meaningful = definition.events.filter((event) => !/(exit|gone|outro|hide)/iu.test(event.name) && event.normalizedTime <= 0.9)
  const strongest = meaningful.at(-1)
  const normalized = Math.max(0.12, Math.min(0.88, strongest?.normalizedTime ?? 0.64))
  return Math.max(0, Math.min(definition.defaultDurationTicks, Math.round(definition.defaultDurationTicks * normalized)))
}

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const aliasesFor = (definition: MotionComponentDefinitionV1): readonly string[] => unique([
  definition.name.toLowerCase(),
  definition.id.replace(/^sanverse\./u, '').replace(/-/gu, ' '),
  ...(definition.id === 'sanverse.conversation-toast-stack' ? ['toast stack','conversation notifications'] : []),
  ...(definition.id === 'sanverse.product-ui-story-scene' ? ['product story','software workflow story'] : []),
  ...(definition.id === 'sanverse.scoped-access-comparison' ? ['permissions comparison','context boundaries'] : []),
  ...(definition.id === 'sanverse.kinetic-headline' ? ['semantic highlight','kinetic title'] : []),
])

const referenceLineageFor = (definition: MotionComponentDefinitionV1): readonly string[] => A20.has(definition.id) || definition.id === 'sanverse.kinetic-headline' ? Object.freeze(['product-storytelling-reference-pack']) : Object.freeze([])

const defaultReview: MotionLibraryReviewSummaryV1 = Object.freeze({ status: 'unreviewed', qualityTier: 'Experimental', fullPlaybackVerified: false })

const createEntry = (definition: MotionComponentDefinitionV1): MotionLibraryCatalogEntryV1 => {
  const primaryCategory = primaryCategoryFor(definition)
  const posterTick = posterTickFor(definition)
  const previewSeed = Object.freeze({ componentId: definition.id, componentVersion: definition.version, fixtureId: 'default', durationTicks: definition.defaultDurationTicks, posterTick, ratio: '16:9', stylePackId: styleFor(primaryCategory), backgroundPreset: backgroundFor(primaryCategory, definition), reducedMotion: false })
  return Object.freeze({
    componentId: definition.id,
    displayName: definition.name,
    shortDescription: definition.purpose,
    primaryCategory,
    secondaryCategories: secondaryCategoriesFor(definition, primaryCategory),
    communicationIntents: intentsFor(definition),
    recommendedContexts: contextsFor(definition, primaryCategory),
    formats: formatsFor(definition, primaryCategory),
    visualTraits: visualTraitsFor(definition, primaryCategory),
    motionTraits: motionTraitsFor(definition),
    introducedInMilestone: milestoneFor(definition.id),
    aliases: aliasesFor(definition),
    performanceClass: definition.performanceClass,
    preview: Object.freeze({ ...previewSeed, previewHash: fnv1a(JSON.stringify(previewSeed)) }),
    review: defaultReview,
    referenceLineage: referenceLineageFor(definition),
  })
}

export const MOTION_LIBRARY_CATALOG = Object.freeze(MOTION_COMPONENT_CATALOG.map(createEntry))
export const MOTION_LIBRARY_CATALOG_BY_ID: Readonly<Record<string, MotionLibraryCatalogEntryV1>> = Object.freeze(Object.fromEntries(MOTION_LIBRARY_CATALOG.map((entry) => [entry.componentId, entry])))

export interface MotionLibraryCatalogValidationIssueV1 { readonly path: string; readonly message: string }
export interface MotionLibraryCatalogValidationResultV1 { readonly ok: boolean; readonly issues: readonly MotionLibraryCatalogValidationIssueV1[] }

export const validateMotionLibraryCatalog = (entries: readonly MotionLibraryCatalogEntryV1[] = MOTION_LIBRARY_CATALOG): MotionLibraryCatalogValidationResultV1 => {
  const issues: MotionLibraryCatalogValidationIssueV1[] = []
  const publicIds = new Set(MOTION_COMPONENT_CATALOG.map((definition) => definition.id))
  const seen = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    const path = `catalog[${index}]`
    if (seen.has(entry.componentId)) issues.push({ path: `${path}.componentId`, message: 'duplicate Creative Library catalog entry.' })
    seen.add(entry.componentId)
    if (!publicIds.has(entry.componentId)) issues.push({ path: `${path}.componentId`, message: 'catalog entry has no public Motion component.' })
    if (!entry.displayName.trim()) issues.push({ path: `${path}.displayName`, message: 'displayName is required.' })
    if (!entry.shortDescription.trim()) issues.push({ path: `${path}.shortDescription`, message: 'shortDescription is required.' })
    if (!MOTION_LIBRARY_CATEGORIES.includes(entry.primaryCategory)) issues.push({ path: `${path}.primaryCategory`, message: 'primaryCategory is not in the closed taxonomy.' })
    if (entry.communicationIntents.length === 0 || entry.communicationIntents.some((value) => !MOTION_COMMUNICATION_INTENTS.includes(value))) issues.push({ path: `${path}.communicationIntents`, message: 'at least one valid communication intent is required.' })
    if (entry.recommendedContexts.length === 0 || entry.recommendedContexts.some((value) => !MOTION_USE_CONTEXTS.includes(value))) issues.push({ path: `${path}.recommendedContexts`, message: 'at least one valid recommended context is required.' })
    if (entry.formats.length === 0 || entry.formats.some((value) => !MOTION_FORMAT_USES.includes(value))) issues.push({ path: `${path}.formats`, message: 'at least one valid editorial format is required.' })
    if (entry.visualTraits.length === 0 || entry.visualTraits.some((value) => !MOTION_VISUAL_TRAITS.includes(value))) issues.push({ path: `${path}.visualTraits`, message: 'at least one valid visual trait is required.' })
    if (entry.motionTraits.length === 0 || entry.motionTraits.some((value) => !MOTION_MOTION_TRAITS.includes(value))) issues.push({ path: `${path}.motionTraits`, message: 'at least one valid motion trait is required.' })
    if (!MOTION_LIBRARY_MILESTONES.includes(entry.introducedInMilestone)) issues.push({ path: `${path}.introducedInMilestone`, message: 'milestone must be verified range or unknown.' })
    const definition = MOTION_COMPONENT_CATALOG.find((candidate) => candidate.id === entry.componentId)
    if (!definition) continue
    if (!MOTION_COMPONENT_MODULES[entry.componentId]) issues.push({ path: `${path}.componentId`, message: 'public component has no registered module.' })
    if (!definition.supportedAspectRatios.includes(entry.preview.ratio as MotionAspectRatio)) issues.push({ path: `${path}.preview.ratio`, message: 'canonical preview ratio is unsupported.' })
    if (!INITIAL_MOTION_STYLE_PACKS.some((pack) => pack.id === entry.preview.stylePackId)) issues.push({ path: `${path}.preview.stylePackId`, message: 'canonical style pack does not exist.' })
    if (entry.preview.durationTicks !== definition.defaultDurationTicks) issues.push({ path: `${path}.preview.durationTicks`, message: 'canonical preview duration must use the component default duration.' })
    if (!Number.isSafeInteger(entry.preview.posterTick) || entry.preview.posterTick < 0 || entry.preview.posterTick > entry.preview.durationTicks) issues.push({ path: `${path}.preview.posterTick`, message: 'poster tick must fall inside canonical preview duration.' })
    if (!entry.preview.fixtureId.trim()) issues.push({ path: `${path}.preview.fixtureId`, message: 'canonical fixture is required.' })
    if (!entry.preview.previewHash.trim()) issues.push({ path: `${path}.preview.previewHash`, message: 'preview hash is required.' })
  }
  for (const id of publicIds) if (!seen.has(id)) issues.push({ path: id, message: 'public Motion component is invisible in Creative Library catalog.' })
  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues) })
}

export interface MotionLibrarySearchOptionsV1 {
  readonly query?: string
  readonly category?: MotionLibraryCategoryV1
  readonly collectionId?: string
  readonly context?: MotionUseContextV1
  readonly milestone?: MotionLibraryMilestoneV1
  readonly reviewStatus?: MotionLibraryReviewStatusV1
  readonly qualityTier?: MotionLibraryQualityTierV1
  readonly performanceClass?: MotionPerformanceClass
  readonly format?: MotionFormatUseV1
  readonly sort?: 'recommended' | 'recent' | 'a-z' | 'milestone' | 'quality'
}

const normalize = (value: string): string => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/gu, ' ').trim()
const searchableText = (entry: MotionLibraryCatalogEntryV1): string => normalize([
  entry.displayName, entry.componentId, entry.shortDescription, ...entry.aliases, entry.primaryCategory, ...entry.secondaryCategories, ...entry.communicationIntents, ...entry.recommendedContexts, ...entry.visualTraits, ...entry.motionTraits, entry.introducedInMilestone,
].join(' '))

const queryScore = (entry: MotionLibraryCatalogEntryV1, query: string): number => {
  const q = normalize(query)
  if (!q) return 1
  const name = normalize(entry.displayName), id = normalize(entry.componentId), aliases = entry.aliases.map(normalize)
  if (name === q) return 1000
  if (name.startsWith(q)) return 800
  if (aliases.some((alias) => alias === q)) return 700
  if (aliases.some((alias) => alias.startsWith(q))) return 600
  if (entry.communicationIntents.some((intent) => normalize(intent) === q)) return 500
  if (normalize(entry.primaryCategory) === q) return 450
  if (entry.recommendedContexts.some((context) => normalize(context) === q)) return 400
  return searchableText(entry).includes(q) ? 100 : 0
}

const milestoneRank = (milestone: MotionLibraryMilestoneV1): number => ({ 'A0-A16': 1, A17: 17, A18: 18, A19: 19, A20: 20, A21: 21, unknown: 0 })[milestone]
const tierRank = (tier: MotionLibraryQualityTierV1): number => ({ S: 5, A: 4, B: 3, C: 2, Experimental: 1 })[tier]

export const withMotionLibraryReviews = (entries: readonly MotionLibraryCatalogEntryV1[], reviews: Readonly<Record<string, MotionQualityReviewV1>>): readonly MotionLibraryCatalogEntryV1[] => Object.freeze(entries.map((entry) => {
  const review = reviews[entry.componentId]
  return review ? Object.freeze({ ...entry, review: Object.freeze({ status: review.status, qualityTier: review.qualityTier, fullPlaybackVerified: review.fullPlaybackVerified }) }) : entry
}))

const item = (componentId: string, fixtureId?: string, variantId?: string): MotionLibraryCollectionItemV1 => Object.freeze({ componentId: componentId as `sanverse.${string}`, ...(fixtureId ? { fixtureId } : {}), ...(variantId ? { variantId } : {}) })
const itemsFrom = (entries: readonly MotionLibraryCatalogEntryV1[]): readonly MotionLibraryCollectionItemV1[] => Object.freeze(entries.map((entry) => item(entry.componentId)))
const collection = (id: string, displayName: string, description: string, items: readonly MotionLibraryCollectionItemV1[], provisional = false): MotionLibraryCollectionV1 => Object.freeze({ id, displayName, description, ...(provisional ? { provisional: true } : {}), items })

const LAUNCH_CORE_IDS = Object.freeze([
  'sanverse.kinetic-headline','sanverse.question-title','sanverse.lower-third-title','sanverse.single-metric','sanverse.metric-delta','sanverse.before-after','sanverse.pros-cons','sanverse.process-flow','sanverse.quote-card','sanverse.testimonial-card','sanverse.subscribe-cta','sanverse.end-card','sanverse.comment-highlight','sanverse.social-proof-stack','sanverse.source-citation','sanverse.browser-demo','sanverse.chat-thread','sanverse.dashboard-snapshot','sanverse.cursor-callout','sanverse.keyword-slam','sanverse.three-beat-headline','sanverse.poll-vote-result','sanverse.app-feature-spotlight','sanverse.decision-tree','sanverse.journey-map','sanverse.conversation-toast-stack','sanverse.floating-prompt-composer','sanverse.product-ui-story-scene','sanverse.agent-work-log','sanverse.scoped-access-comparison','sanverse.trend-line-chart','sanverse.donut-breakdown','sanverse.feature-comparison-table','sanverse.code-diff-spotlight','sanverse.terminal-command-story',
] as const)

export const getMotionLibraryCollections = (entries: readonly MotionLibraryCatalogEntryV1[] = MOTION_LIBRARY_CATALOG): readonly MotionLibraryCollectionV1[] => {
  const has = (predicate: (entry: MotionLibraryCatalogEntryV1) => boolean) => entries.filter(predicate)
  const collections: MotionLibraryCollectionV1[] = [
    collection('all-components','All Components','Every current public Plan-A component.',itemsFrom(entries)),
    collection('recently-added','Recently Added','Newest verified Plan-A components.',itemsFrom(has((entry) => entry.introducedInMilestone === 'A21'))),
    collection('youtube-essentials','YouTube Essentials','Broadly useful long-form creator graphics.',itemsFrom(has((entry) => entry.recommendedContexts.includes('youtube-long-form') && entry.primaryCategory !== 'transitions'))),
    collection('product-saas','Product / SaaS','Product, software and SaaS storytelling components.',itemsFrom(has((entry) => entry.primaryCategory === 'software-product' || A20.has(entry.componentId)))),
    collection('talking-head','Talking Head','Overlay and support graphics that work around a speaker.',itemsFrom(has((entry) => entry.recommendedContexts.includes('talking-head')))),
    collection('shorts-reels','Shorts / Reels','Fast creator components tagged for short-form.',itemsFrom(has((entry) => entry.recommendedContexts.includes('shorts') || entry.recommendedContexts.includes('reels')))),
    collection('software-demos','Software Demos','Screen-demo and software-tutorial communication jobs.',itemsFrom(has((entry) => entry.recommendedContexts.includes('software-tutorial') || entry.formats.includes('screen-demo')))),
    collection('explainers','Explainers','Structured explanatory components and diagrams.',itemsFrom(has((entry) => entry.primaryCategory === 'explainers' || entry.primaryCategory === 'diagrams'))),
    collection('wow-cinematic','WOW / Cinematic','High-impact hero and visual-hook components.',itemsFrom(has((entry) => entry.primaryCategory === 'wow-cinematic' || entry.secondaryCategories.includes('wow-cinematic')))),
    collection('product-storytelling-reference-pack','Product Storytelling Reference Pack','Reusable first-party components generalized from the product-storytelling reference exercise.',Object.freeze([
      ...PRODUCT_STORY_REFERENCE.map((id) => item(id)),
      item('sanverse.kinetic-headline','semantic-highlight','highlight-box'),
    ])),
    collection('sanverse-launch-core','Sanverse Launch Core','Provisional broadly useful launch-ready shortlist; owner may revise visually in the Library.',Object.freeze(LAUNCH_CORE_IDS.filter((id) => entries.some((entry) => entry.componentId === id)).map((id) => item(id))),true),
  ]
  for (const milestone of ['A0-A16','A17','A18','A19','A20','A21'] as const) collections.push(collection(`milestone-${milestone.toLowerCase()}`, milestone, `Components introduced in ${milestone}.`, itemsFrom(has((entry) => entry.introducedInMilestone === milestone))))
  collections.push(collection('needs-motion-review','Needs Motion Review','Unreviewed, in-review or needs-polish canonical motion.',itemsFrom(has((entry) => entry.review.status === 'unreviewed' || entry.review.status === 'in-review' || entry.review.status === 'needs-polish'))))
  collections.push(collection('motion-review-passed','Motion Review Passed','Canonical full-playback reviews marked passed.',itemsFrom(has((entry) => entry.review.status === 'passed'))))
  return Object.freeze(collections)
}

export const validateMotionLibraryCollections = (collections: readonly MotionLibraryCollectionV1[] = getMotionLibraryCollections()): MotionLibraryCatalogValidationResultV1 => {
  const issues: MotionLibraryCatalogValidationIssueV1[] = []
  const known = new Set(MOTION_LIBRARY_CATALOG.map((entry) => entry.componentId))
  const ids = new Set<string>()
  collections.forEach((candidate, collectionIndex) => {
    if (!candidate.id.trim() || ids.has(candidate.id)) issues.push({ path: `collections[${collectionIndex}].id`, message: 'collection id must be unique and non-empty.' })
    ids.add(candidate.id)
    const members = new Set<string>()
    candidate.items.forEach((member, itemIndex) => {
      if (!known.has(member.componentId)) issues.push({ path: `collections[${collectionIndex}].items[${itemIndex}]`, message: 'collection references an unknown component.' })
      const identity = `${member.componentId}:${member.fixtureId ?? 'default'}:${member.variantId ?? ''}`
      if (members.has(identity)) issues.push({ path: `collections[${collectionIndex}].items[${itemIndex}]`, message: 'duplicate collection item.' })
      members.add(identity)
      if (member.fixtureId !== undefined && !['default','semantic-highlight'].includes(member.fixtureId)) issues.push({ path: `collections[${collectionIndex}].items[${itemIndex}].fixtureId`, message: 'unknown library fixture override.' })
    })
  })
  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues) })
}

export const filterMotionLibraryCatalog = (entries: readonly MotionLibraryCatalogEntryV1[], options: MotionLibrarySearchOptionsV1): readonly MotionLibraryCatalogEntryV1[] => {
  const collectionIds = options.collectionId ? new Set(getMotionLibraryCollections(entries).find((candidate) => candidate.id === options.collectionId)?.items.map((member) => member.componentId) ?? []) : null
  const scored = entries.map((entry) => ({ entry, score: queryScore(entry, options.query ?? '') })).filter(({ entry, score }) => score > 0
    && (!options.category || entry.primaryCategory === options.category || entry.secondaryCategories.includes(options.category))
    && (!collectionIds || collectionIds.has(entry.componentId))
    && (!options.context || entry.recommendedContexts.includes(options.context))
    && (!options.milestone || entry.introducedInMilestone === options.milestone)
    && (!options.reviewStatus || entry.review.status === options.reviewStatus)
    && (!options.qualityTier || entry.review.qualityTier === options.qualityTier)
    && (!options.performanceClass || entry.performanceClass === options.performanceClass)
    && (!options.format || entry.formats.includes(options.format)))
  const sort = options.sort ?? 'recommended'
  scored.sort((a, b) => {
    if (sort === 'a-z') return a.entry.displayName.localeCompare(b.entry.displayName)
    if (sort === 'recent') return milestoneRank(b.entry.introducedInMilestone) - milestoneRank(a.entry.introducedInMilestone) || a.entry.displayName.localeCompare(b.entry.displayName)
    if (sort === 'milestone') return milestoneRank(a.entry.introducedInMilestone) - milestoneRank(b.entry.introducedInMilestone) || a.entry.displayName.localeCompare(b.entry.displayName)
    if (sort === 'quality') return tierRank(b.entry.review.qualityTier) - tierRank(a.entry.review.qualityTier) || a.entry.displayName.localeCompare(b.entry.displayName)
    return b.score - a.score || Number(b.entry.review.status === 'passed') - Number(a.entry.review.status === 'passed') || milestoneRank(b.entry.introducedInMilestone) - milestoneRank(a.entry.introducedInMilestone) || a.entry.displayName.localeCompare(b.entry.displayName)
  })
  return Object.freeze(scored.map(({ entry }) => entry))
}

export const getMotionDiscoveryCatalog = (reviews: Readonly<Record<string, MotionQualityReviewV1>> = Object.freeze({})) => Object.freeze(withMotionLibraryReviews(MOTION_LIBRARY_CATALOG, reviews).map((entry) => Object.freeze({
  componentId: entry.componentId,
  displayName: entry.displayName,
  primaryCategory: entry.primaryCategory,
  secondaryCategories: entry.secondaryCategories,
  communicationIntents: entry.communicationIntents,
  recommendedContexts: entry.recommendedContexts,
  formats: entry.formats,
  visualTraits: entry.visualTraits,
  motionTraits: entry.motionTraits,
  performanceClass: entry.performanceClass,
  qualityTier: entry.review.qualityTier,
  reviewStatus: entry.review.status,
})))

export const MOTION_LIBRARY_TAB_DEFINITIONS = Object.freeze([
  { id: 'all', label: 'ALL' },
  { id: 'youtube-essentials', label: 'YOUTUBE', collectionId: 'youtube-essentials' },
  { id: 'wow-cinematic', label: 'WOW', collectionId: 'wow-cinematic' },
  { id: 'typography', label: 'TYPOGRAPHY', category: 'typography' },
  { id: 'numbers-data', label: 'DATA', category: 'numbers-data' },
  { id: 'social-proof', label: 'SOCIAL', category: 'social-proof' },
  { id: 'software-product', label: 'UI / PRODUCT', category: 'software-product' },
  { id: 'explainers', label: 'EXPLAINERS', category: 'explainers' },
  { id: 'diagrams', label: 'DIAGRAMS', category: 'diagrams' },
  { id: 'editorial-documentary', label: 'EDITORIAL', category: 'editorial-documentary' },
  { id: 'cta', label: 'CTA', category: 'cta' },
  { id: 'annotations', label: 'ANNOTATIONS', category: 'annotations' },
  { id: 'transitions', label: 'TRANSITIONS', category: 'transitions' },
] satisfies readonly Readonly<{ id: string; label: string; category?: MotionLibraryCategoryV1; collectionId?: string }>[])
