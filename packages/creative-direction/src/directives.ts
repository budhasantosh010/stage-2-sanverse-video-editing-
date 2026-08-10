import type { CreativeDirectionTrackTypeV1 } from './tracks.ts'

export const CREATIVE_DIRECTIVE_SOURCES = Object.freeze(['human', 'ai', 'system'] as const)
export type CreativeDirectiveSourceV1 = (typeof CREATIVE_DIRECTIVE_SOURCES)[number]

export const CREATIVE_DIRECTIVE_PRIORITIES = Object.freeze(['required', 'preferred', 'suggestion'] as const)
export type CreativeDirectivePriorityV1 = (typeof CREATIVE_DIRECTIVE_PRIORITIES)[number]

export const CREATIVE_DIRECTIVE_STATUSES = Object.freeze(['draft', 'proposed', 'accepted', 'rejected', 'applied'] as const)
export type CreativeDirectiveStatusV1 = (typeof CREATIVE_DIRECTIVE_STATUSES)[number]

export const CREATIVE_MOTION_CHARACTERS = Object.freeze([
  'subtle', 'energetic', 'cinematic', 'snappy', 'premium', 'restrained', 'playful', 'technical',
] as const)
export type CreativeMotionCharacterV1 = (typeof CREATIVE_MOTION_CHARACTERS)[number]

export const CREATIVE_MOTION_ENTRANCES = Object.freeze([
  'none', 'fade-rise', 'scale-settle', 'sequential-stack', 'type-reveal', 'highlight-expand', 'window-scale-in',
] as const)
export type CreativeMotionEntranceV1 = (typeof CREATIVE_MOTION_ENTRANCES)[number]

export const CREATIVE_MOTION_EXITS = Object.freeze(['none', 'fade', 'soft-crossfade', 'shrink-away', 'slide-away'] as const)
export type CreativeMotionExitV1 = (typeof CREATIVE_MOTION_EXITS)[number]

export const CREATIVE_FOOTAGE_TREATMENTS = Object.freeze([
  'blur-background',
  'picture-in-picture',
  'dim-footage',
  'foreground-subject',
  'screen-focus',
  'full-screen-demo',
] as const)
export type CreativeFootageTreatmentV1 = (typeof CREATIVE_FOOTAGE_TREATMENTS)[number]

export const CREATIVE_TRANSITION_INTENTS = Object.freeze([
  'soft-crossfade', 'picture-in-picture-shrink', 'window-scale-in', 'callback-return', 'clean-cut',
] as const)
export type CreativeTransitionIntentV1 = (typeof CREATIVE_TRANSITION_INTENTS)[number]

export const CREATIVE_EMPHASIS_INTENTS = Object.freeze([
  'semantic-highlight', 'keyword-focus', 'important-entity', 'stat-focus', 'comparison-focus',
] as const)
export type CreativeEmphasisIntentV1 = (typeof CREATIVE_EMPHASIS_INTENTS)[number]

export const CREATIVE_CONSTRAINT_TYPES = Object.freeze([
  'do-not-cover-face',
  'preserve-subtitles',
  'no-flashy-graphics',
  'brand-safe-colors-only',
  'maximum-graphics',
  'keep-ui-readable',
  'custom',
] as const)
export type CreativeConstraintTypeV1 = (typeof CREATIVE_CONSTRAINT_TYPES)[number]

export const CREATIVE_PLACEMENT_INTENTS = Object.freeze([
  'auto', 'top-left', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-right',
] as const)
export type CreativePlacementIntentV1 = (typeof CREATIVE_PLACEMENT_INTENTS)[number]

export type CreativeDirectiveKindV1 =
  | 'style'
  | 'graphic'
  | 'motion'
  | 'footage'
  | 'transition'
  | 'emphasis'
  | 'note'
  | 'constraint'

export interface CreativeDirectiveBaseV1<Kind extends CreativeDirectiveKindV1, Track extends CreativeDirectionTrackTypeV1> {
  readonly id: string
  readonly kind: Kind
  readonly track: Track
  readonly startTicks: number
  readonly endTicks: number
  readonly source: CreativeDirectiveSourceV1
  readonly priority: CreativeDirectivePriorityV1
  readonly status: CreativeDirectiveStatusV1
  /** Stable B1 source-understanding observations that justify this directive. */
  readonly sourceObservationIds?: readonly string[]
}

export interface CreativeStyleDirectiveV1 extends CreativeDirectiveBaseV1<'style', 'STYLE'> {
  readonly styleIntent: string
  readonly motionCharacter?: CreativeMotionCharacterV1
  readonly density?: 'low' | 'medium' | 'high'
}

export interface CreativeGraphicContentV1 {
  readonly primaryText?: string
  readonly secondaryText?: string
  readonly items?: readonly string[]
  readonly fields?: Readonly<Record<string, string | number | boolean>>
}

export interface CreativeGraphicDirectiveV1 extends CreativeDirectiveBaseV1<'graphic', 'GRAPHICS'> {
  readonly communicationIntent: string
  readonly preferredFamily?: string
  readonly content: CreativeGraphicContentV1
  readonly styleIntent?: string
  readonly placementIntent?: CreativePlacementIntentV1
  readonly motionIntent?: CreativeMotionCharacterV1
}

export interface CreativeMotionDirectiveV1 extends CreativeDirectiveBaseV1<'motion', 'MOTION'> {
  readonly character: CreativeMotionCharacterV1
  readonly entranceCharacter?: CreativeMotionEntranceV1
  readonly exitCharacter?: CreativeMotionExitV1
  readonly intensity?: number
}

export interface CreativeFootageDirectiveV1 extends CreativeDirectiveBaseV1<'footage', 'FOOTAGE'> {
  readonly treatment: CreativeFootageTreatmentV1
  readonly placementIntent?: CreativePlacementIntentV1
  readonly intensity?: number
}

export interface CreativeTransitionDirectiveV1 extends CreativeDirectiveBaseV1<'transition', 'TRANSITION'> {
  readonly transitionIntent: CreativeTransitionIntentV1
  readonly intensity?: number
}

export interface CreativeEmphasisDirectiveV1 extends CreativeDirectiveBaseV1<'emphasis', 'EMPHASIS'> {
  readonly emphasisIntent: CreativeEmphasisIntentV1
  readonly targetText?: string
  readonly intensity?: number
}

export interface CreativeNoteDirectiveV1 extends CreativeDirectiveBaseV1<'note', 'NOTES'> {
  readonly text: string
}

export interface CreativeConstraintDirectiveV1 extends CreativeDirectiveBaseV1<'constraint', 'CONSTRAINTS'> {
  readonly constraint: CreativeConstraintTypeV1
  readonly maximumGraphics?: number
  readonly customText?: string
}

export type CreativeDirectiveV1 =
  | CreativeStyleDirectiveV1
  | CreativeGraphicDirectiveV1
  | CreativeMotionDirectiveV1
  | CreativeFootageDirectiveV1
  | CreativeTransitionDirectiveV1
  | CreativeEmphasisDirectiveV1
  | CreativeNoteDirectiveV1
  | CreativeConstraintDirectiveV1

export const CREATIVE_DIRECTIVE_KINDS = Object.freeze([
  'style', 'graphic', 'motion', 'footage', 'transition', 'emphasis', 'note', 'constraint',
] as const satisfies readonly CreativeDirectiveKindV1[])

const TRACK_BY_DIRECTIVE_KIND = Object.freeze({
  style: 'STYLE',
  graphic: 'GRAPHICS',
  motion: 'MOTION',
  footage: 'FOOTAGE',
  transition: 'TRANSITION',
  emphasis: 'EMPHASIS',
  note: 'NOTES',
  constraint: 'CONSTRAINTS',
} as const satisfies Readonly<Record<CreativeDirectiveKindV1, CreativeDirectionTrackTypeV1>>)

export const directiveTrackForKind = (kind: CreativeDirectiveKindV1): CreativeDirectionTrackTypeV1 => TRACK_BY_DIRECTIVE_KIND[kind]

export interface CreativeDirectiveSeedV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly source?: CreativeDirectiveSourceV1
  readonly priority?: CreativeDirectivePriorityV1
  readonly status?: CreativeDirectiveStatusV1
  readonly sourceObservationIds?: readonly string[]
}

const base = <Kind extends CreativeDirectiveKindV1>(kind: Kind, seed: CreativeDirectiveSeedV1) => Object.freeze({
  id: seed.id,
  kind,
  track: directiveTrackForKind(kind),
  startTicks: seed.startTicks,
  endTicks: seed.endTicks,
  source: seed.source ?? 'human',
  priority: seed.priority ?? 'preferred',
  status: seed.status ?? 'draft',
  ...(seed.sourceObservationIds?.length ? { sourceObservationIds: Object.freeze([...seed.sourceObservationIds]) } : {}),
})

export const createCreativeDirective = (kind: CreativeDirectiveKindV1, seed: CreativeDirectiveSeedV1): CreativeDirectiveV1 => {
  const common = base(kind, seed)
  if (kind === 'style') return Object.freeze({ ...common, kind, track: 'STYLE', styleIntent: 'clean-product-demo', motionCharacter: 'restrained', density: 'medium' })
  if (kind === 'graphic') return Object.freeze({ ...common, kind, track: 'GRAPHICS', communicationIntent: 'support-explanation', content: Object.freeze({ primaryText: 'New graphic' }), placementIntent: 'auto', motionIntent: 'restrained' })
  if (kind === 'motion') return Object.freeze({ ...common, kind, track: 'MOTION', character: 'restrained', entranceCharacter: 'fade-rise', exitCharacter: 'fade', intensity: 0.5 })
  if (kind === 'footage') return Object.freeze({ ...common, kind, track: 'FOOTAGE', treatment: 'screen-focus', intensity: 0.5 })
  if (kind === 'transition') return Object.freeze({ ...common, kind, track: 'TRANSITION', transitionIntent: 'soft-crossfade', intensity: 0.5 })
  if (kind === 'emphasis') return Object.freeze({ ...common, kind, track: 'EMPHASIS', emphasisIntent: 'semantic-highlight', intensity: 0.5 })
  if (kind === 'note') return Object.freeze({ ...common, kind, track: 'NOTES', text: 'Creative note' })
  return Object.freeze({ ...common, kind, track: 'CONSTRAINTS', constraint: 'keep-ui-readable' })
}

export const convertCreativeDirectiveKind = (directive: CreativeDirectiveV1, kind: CreativeDirectiveKindV1): CreativeDirectiveV1 => createCreativeDirective(kind, {
  id: directive.id,
  startTicks: directive.startTicks,
  endTicks: directive.endTicks,
  source: directive.source,
  priority: directive.priority,
  status: directive.status,
  sourceObservationIds: directive.sourceObservationIds,
})
