import type { CSSProperties } from 'react'
import type { MotionComponentDefinitionV1, MotionComponentRenderPropsV1, MotionRenderContextV1, MotionStylePackV1, MotionValidationResultV1 } from '@sanverse/motion-contract'
import type { MotionExposureV1, MotionGraphBackedComponentModuleV1, MotionSceneV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene, keyframed } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND, easeInCubic, easeOutCubic, normalizedProgress, resolveProductStorySafePlacement, sequenceProgress, staggerProgress } from '@sanverse/motion-primitives'
import { mergeMotionGraphNodeStyle, useMotionGraphPresentation } from '@sanverse/motion-native-runtime'
import { FULL_NATIVE_GRAPH_CAPABILITIES, graphGroup, graphShape, graphText, responsiveGraphLayout } from '../graph-common.ts'
import { mConst, mEase, mMultiply, mNumber, mOneMinus, mProgress, mReduced, mSequence, mStagger } from '../graph-motion.ts'
import { SANVERSE_CLEAN_STYLE } from '../style-packs.ts'
import { isRecord, unknownFieldIssues, validationFailure, validationSuccess, valueIssue } from '../validation.ts'
import { A19_HIERARCHY_CONFIGS, a19HierarchyItemLimit, createA19HierarchyScene, isA19HierarchyConfig, renderA19HierarchyComponent, validateA19HierarchyProps } from './a19-hierarchy-explainers.tsx'

export type FamilyKind = 'title' | 'value' | 'list' | 'status' | 'diagram' | 'quote' | 'cta'

export const FAMILY_PLACEMENT_INTENTS = Object.freeze(['top-left','top-right','center-left','center','center-right','bottom-left','bottom-right'] as const)
export type FamilyPlacementIntent = (typeof FAMILY_PLACEMENT_INTENTS)[number]

export interface FamilyComponentProps {
  readonly eyebrow: string
  readonly title: string
  readonly subtitle: string
  readonly value: string
  readonly items: readonly string[]
  /** Optional semantic placement used by product-storytelling overlays. */
  readonly placement?: FamilyPlacementIntent
  /** Composition-space safe inset in pixels for footage-aware placement. */
  readonly safeOffset?: number
}

export interface FamilyComponentStyle {
  readonly textColor: string
  readonly mutedColor: string
  readonly accentColor: string
  readonly surfaceColor: string
  readonly dangerColor: string
  readonly successColor: string
  readonly fontFamily: string
  readonly titleWeight: number
  readonly bodyWeight: number
  readonly radius: number
  readonly motionIntensity: number
}

export interface FamilyVariantConfig {
  readonly id: `sanverse.${string}`
  readonly name: string
  readonly purpose: string
  readonly family: FamilyKind
  readonly variant: string
  readonly eyebrow: string
  readonly title: string
  readonly subtitle: string
  readonly value: string
  readonly items: readonly string[]
  readonly defaultPlacement?: FamilyPlacementIntent
  readonly defaultSafeOffset?: number
  readonly minDurationSeconds?: number
  readonly defaultDurationSeconds?: number
  readonly maxDurationSeconds?: number
  readonly events?: readonly Readonly<{ name: string; normalizedTime: number }>[]
}

export interface FamilyComponentState {
  readonly progress: number
  readonly phase: 'enter' | 'hold' | 'exit' | 'ended'
  readonly layout: 'wide' | 'compact'
  readonly reveal: number
  readonly itemReveals: readonly number[]
}

export const familyComponentStyleFromPack = (pack: MotionStylePackV1): FamilyComponentStyle => Object.freeze({
  textColor: pack.tokens.colors.text,
  mutedColor: pack.tokens.colors.textSecondary,
  accentColor: pack.tokens.colors.accent,
  surfaceColor: pack.tokens.colors.surface,
  dangerColor: pack.tokens.colors.danger,
  successColor: pack.tokens.colors.success,
  fontFamily: pack.tokens.typography.bodyFont,
  titleWeight: pack.tokens.typography.headingWeight,
  bodyWeight: pack.tokens.typography.bodyWeight,
  radius: pack.tokens.shape.radiusMedium,
  motionIntensity: pack.tokens.motion.intensity,
})

export const DEFAULT_FAMILY_STYLE = familyComponentStyleFromPack(SANVERSE_CLEAN_STYLE)

const bounded = (value: unknown, min: number, max: number): value is string => typeof value === 'string' && value.trim().length >= min && value.length <= max

export const validateFamilyComponentProps = (input: unknown): MotionValidationResultV1<FamilyComponentProps> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Family component props must be an object.'))
  const issues = [...unknownFieldIssues(input, ['eyebrow', 'title', 'subtitle', 'value', 'items', 'placement', 'safeOffset'])]
  if (!bounded(input.eyebrow, 0, 32)) issues.push(valueIssue('$.eyebrow', 'VALUE_INVALID', 'eyebrow is limited to 32 characters.'))
  if (!bounded(input.title, 1, 96)) issues.push(valueIssue('$.title', 'VALUE_INVALID', 'title must contain 1–96 characters.'))
  if (!bounded(input.subtitle, 0, 140)) issues.push(valueIssue('$.subtitle', 'VALUE_INVALID', 'subtitle is limited to 140 characters.'))
  if (!bounded(input.value, 0, 48)) issues.push(valueIssue('$.value', 'VALUE_INVALID', 'value is limited to 48 characters.'))
  if (!Array.isArray(input.items) || input.items.length > 6 || input.items.some((item) => !bounded(item, 1, 72))) issues.push(valueIssue('$.items', 'VALUE_INVALID', 'items must contain 0–6 strings of 1–72 characters.'))
  if (input.placement !== undefined && (typeof input.placement !== 'string' || !FAMILY_PLACEMENT_INTENTS.includes(input.placement as FamilyPlacementIntent))) issues.push(valueIssue('$.placement', 'VALUE_INVALID', 'placement must be one of the supported semantic safe-placement intents.'))
  if (input.safeOffset !== undefined && (typeof input.safeOffset !== 'number' || !Number.isFinite(input.safeOffset) || input.safeOffset < 0 || input.safeOffset > 240)) issues.push(valueIssue('$.safeOffset', 'VALUE_INVALID', 'safeOffset must be a finite composition-space inset inside [0,240].'))
  if (issues.length > 0) return validationFailure(...issues)
  return validationSuccess(Object.freeze({ eyebrow: input.eyebrow as string, title: input.title as string, subtitle: input.subtitle as string, value: input.value as string, items: Object.freeze([...(input.items as string[])]), ...(input.placement !== undefined ? { placement: input.placement as FamilyPlacementIntent } : {}), ...(input.safeOffset !== undefined ? { safeOffset: input.safeOffset as number } : {}) }))
}

export const validateFamilyComponentStyle = (input: unknown): MotionValidationResultV1<FamilyComponentStyle> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Family component style must be an object.'))
  const allowed = ['textColor', 'mutedColor', 'accentColor', 'surfaceColor', 'dangerColor', 'successColor', 'fontFamily', 'titleWeight', 'bodyWeight', 'radius', 'motionIntensity']
  const issues = [...unknownFieldIssues(input, allowed)]
  for (const key of ['textColor', 'mutedColor', 'accentColor', 'surfaceColor', 'dangerColor', 'successColor', 'fontFamily'] as const) if (typeof input[key] !== 'string' || !input[key]) issues.push(valueIssue(`$.${key}`, 'VALUE_INVALID', `${key} must be a non-empty string.`))
  for (const key of ['titleWeight', 'bodyWeight'] as const) if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < 100 || input[key] > 1000) issues.push(valueIssue(`$.${key}`, 'VALUE_INVALID', `${key} must be inside [100,1000].`))
  if (typeof input.radius !== 'number' || !Number.isFinite(input.radius) || input.radius < 0 || input.radius > 160) issues.push(valueIssue('$.radius', 'VALUE_INVALID', 'radius must be inside [0,160].'))
  if (typeof input.motionIntensity !== 'number' || !Number.isFinite(input.motionIntensity) || input.motionIntensity < 0 || input.motionIntensity > 1) issues.push(valueIssue('$.motionIntensity', 'VALUE_INVALID', 'motionIntensity must be inside [0,1].'))
  if (issues.length > 0) return validationFailure(...issues)
  return validationSuccess(Object.freeze(input as unknown as FamilyComponentStyle))
}

const validateContext = (context: MotionRenderContextV1) => {
  if (!Number.isSafeInteger(context.localTicks) || context.localTicks < 0 || context.localTicks > context.durationTicks) throw new RangeError('localTicks must be an exact tick inside duration.')
  if (!Number.isSafeInteger(context.durationTicks) || context.durationTicks <= 0) throw new RangeError('durationTicks must be positive.')
  if (context.ticksPerSecond !== SANVERSE_TICKS_PER_SECOND) throw new RangeError('Family components require the canonical Sanverse tick authority.')
}

export const evaluateFamilyComponentState = (props: FamilyComponentProps, context: MotionRenderContextV1): FamilyComponentState => {
  validateContext(context)
  const validation = validateFamilyComponentProps(props)
  if (!validation.ok) throw new RangeError(validation.issues[0]?.message ?? 'Invalid family props.')
  const progress = normalizedProgress(context.localTicks, context.durationTicks)
  const exit = easeInCubic(sequenceProgress(progress, 0.84, 1))
  const reveal = context.reducedMotion ? 1 : easeOutCubic(sequenceProgress(progress, 0.02, 0.30))
  const itemWindow = sequenceProgress(progress, 0.12, 0.54)
  const itemReveals = props.items.map((_, index) => context.reducedMotion ? 1 : easeOutCubic(staggerProgress({ progress: itemWindow, index, count: Math.max(1, props.items.length), overlap: 0.55 })))
  return Object.freeze({ progress, phase: progress < 0.56 ? 'enter' : progress < 0.84 ? 'hold' : progress < 1 ? 'exit' : 'ended', layout: context.composition.width / context.composition.height > 1.15 ? 'wide' : 'compact', reveal: reveal * (1 - exit), itemReveals: Object.freeze(itemReveals.map((value) => value * (1 - exit))) })
}

const nodePrefix = (config: FamilyVariantConfig) => `family.${config.id.replace(/^sanverse\./u, '')}`

export const A18_KEYFRAME_CREATOR_COMPONENT_IDS = Object.freeze([
  'sanverse.keyword-slam',
  'sanverse.three-beat-headline',
  'sanverse.stacked-hook',
  'sanverse.sentence-deconstruction',
  'sanverse.punch-word-reveal',
  'sanverse.poll-vote-result',
  'sanverse.ranking-podium',
  'sanverse.app-feature-spotlight',
  'sanverse.keyboard-shortcut-callout',
] as const)
const A18_KEYFRAME_CREATOR_IDS = new Set<string>(A18_KEYFRAME_CREATOR_COMPONENT_IDS)
export const A20_PRODUCT_STORY_COMPONENT_IDS = Object.freeze([
  'sanverse.conversation-toast-stack',
  'sanverse.floating-prompt-composer',
  'sanverse.product-ui-story-scene',
  'sanverse.agent-work-log',
  'sanverse.scoped-access-comparison',
  'sanverse.keyword-brand-lockup',
] as const)
const A20_PRODUCT_STORY_IDS = new Set<string>(A20_PRODUCT_STORY_COMPONENT_IDS)
export const A21_CREATOR_WOW_COMPONENT_IDS = Object.freeze([
  'sanverse.trend-line-chart',
  'sanverse.donut-breakdown',
  'sanverse.venn-intersection',
  'sanverse.feature-comparison-table',
  'sanverse.code-diff-spotlight',
  'sanverse.terminal-command-story',
] as const)
const A21_CREATOR_WOW_IDS = new Set<string>(A21_CREATOR_WOW_COMPONENT_IDS)
const isKeyframeNativeFamily = (config: FamilyVariantConfig): boolean => A18_KEYFRAME_CREATOR_IDS.has(config.id) || A20_PRODUCT_STORY_IDS.has(config.id) || A21_CREATOR_WOW_IDS.has(config.id)
const durationTicksForConfig = (config: FamilyVariantConfig, field: 'min' | 'default' | 'max'): number => {
  const seconds = field === 'min' ? (config.minDurationSeconds ?? 1) : field === 'default' ? (config.defaultDurationSeconds ?? 4) : (config.maxDurationSeconds ?? 16)
  return Math.round(SANVERSE_TICKS_PER_SECOND * seconds)
}
const tickAt = (context: MotionRenderContextV1, progress: number): number => Math.round(context.durationTicks * progress)
const revealTrack = (id: string, context: MotionRenderContextV1, start: number, peak = Math.min(start + 0.18, 0.78)) => context.reducedMotion
  ? constant(1)
  : keyframed([
      { id: `${id}:hidden`, tick: tickAt(context, 0), value: 0, interpolation: 'hold' as const },
      { id: `${id}:enter`, tick: tickAt(context, start), value: 0, interpolation: 'bezier' as const, bezier: { inX: 0.7, inY: 1, outX: 0.2, outY: 0.82 } },
      { id: `${id}:shown`, tick: tickAt(context, peak), value: 1, interpolation: 'linear' as const },
      { id: `${id}:exit`, tick: tickAt(context, 0.92), value: 1, interpolation: 'linear' as const },
      { id: `${id}:gone`, tick: tickAt(context, 1), value: 0, interpolation: 'linear' as const },
    ])
const translateYTrack = (id: string, context: MotionRenderContextV1, start: number, amount: number) => context.reducedMotion
  ? constant(0)
  : keyframed([
      { id: `${id}:offset`, tick: tickAt(context, 0), value: amount, interpolation: 'hold' as const },
      { id: `${id}:enter`, tick: tickAt(context, start), value: amount, interpolation: 'bezier' as const, bezier: { inX: 0.72, inY: 1, outX: 0.2, outY: 0.84 } },
      { id: `${id}:settled`, tick: tickAt(context, Math.min(start + 0.20, 0.78)), value: 0, interpolation: 'linear' as const },
    ])
const scaleTrack = (id: string, context: MotionRenderContextV1, start: number, from = 0.78, overshoot = 1.08) => context.reducedMotion
  ? constant(1)
  : keyframed([
      { id: `${id}:small`, tick: tickAt(context, 0), value: from, interpolation: 'hold' as const },
      { id: `${id}:enter`, tick: tickAt(context, start), value: from, interpolation: 'bezier' as const, bezier: { inX: 0.7, inY: 1, outX: 0.18, outY: 0.9 } },
      { id: `${id}:overshoot`, tick: tickAt(context, Math.min(start + 0.14, 0.74)), value: overshoot, interpolation: 'bezier' as const, bezier: { inX: 0.78, inY: 1.12, outX: 0.3, outY: 1.08 } },
      { id: `${id}:settled`, tick: tickAt(context, Math.min(start + 0.24, 0.82)), value: 1, interpolation: 'linear' as const },
    ])

export const createFamilyScene = (config: FamilyVariantConfig, props: FamilyComponentProps, style: FamilyComponentStyle, context: MotionRenderContextV1): MotionSceneV1 => {
  validateContext(context)
  const keyframeNative = isKeyframeNativeFamily(config)
  if (keyframeNative && (context.durationTicks < durationTicksForConfig(config, 'min') || context.durationTicks > durationTicksForConfig(config, 'max'))) throw new RangeError(`${config.id} duration is outside its supported keyframe-authoring window.`)
  const prefix = nodePrefix(config)
  const rootId = `${prefix}.root`
  const surfaceId = `${prefix}.surface`
  const contentId = `${prefix}.content`
  const eyebrowId = `${prefix}.eyebrow`
  const titleId = `${prefix}.title`
  const subtitleId = `${prefix}.subtitle`
  const valueId = `${prefix}.value`
  const accentId = `${prefix}.accent`
  const itemsId = `${prefix}.items`
  const itemIds = props.items.map((_, index) => `${prefix}.item:${index + 1}`)
  const root = graphGroup(rootId, config.name, null, [surfaceId, accentId, contentId])
  const short = Math.min(context.composition.width, context.composition.height)
  const surfaceBase = graphShape({ id: surfaceId, name: 'Surface', parentId: rootId, width: Math.round(context.composition.width * 0.76), height: Math.round(context.composition.height * 0.56), fillColor: style.surfaceColor, strokeColor: `${style.accentColor}28`, strokeWidth: 2, radius: style.radius })
  const surface = keyframeNative ? Object.freeze({ ...surfaceBase, opacity: revealTrack(`${prefix}:surface`, context, 0.02, 0.14) }) : surfaceBase
  const accentBase = graphShape({ id: accentId, name: 'Accent', parentId: rootId, width: Math.round(short * 0.16), height: Math.max(6, Math.round(short * 0.012)), fillColor: style.accentColor, strokeColor: 'transparent', strokeWidth: 0, radius: 999 })
  const accent = keyframeNative ? Object.freeze({ ...accentBase, opacity: revealTrack(`${prefix}:accent`, context, 0.10, 0.24), transform: Object.freeze({ ...accentBase.transform, scaleX: scaleTrack(`${prefix}:accent-scale`, context, 0.10, 0.35, 1), scaleY: constant(1) }) }) : accentBase
  const contentBase = graphGroup(contentId, 'Content', rootId, [eyebrowId, titleId, subtitleId, valueId, itemsId])
  const reveal = mReduced(mConst(1), mEase('ease-out-cubic', mSequence(0.02, 0.30, mProgress())))
  const remain = mOneMinus(mEase('ease-in-cubic', mSequence(0.84, 1, mProgress())))
  const content = keyframeNative ? contentBase : Object.freeze({ ...contentBase, opacity: mNumber(mMultiply(reveal, remain)), transform: Object.freeze({ ...contentBase.transform, positionY: mNumber(mReduced(mConst(0), mMultiply(mConst(26 * style.motionIntensity), mOneMinus(reveal)))) }) })
  const eyebrowBase = graphText({ id: eyebrowId, name: 'Eyebrow', parentId: contentId, text: props.eyebrow, color: style.accentColor, fontFamily: style.fontFamily, fontSize: Math.round(short * 0.025), fontWeight: 800 })
  const eyebrow = Object.freeze({ ...eyebrowBase, visible: constant(Boolean(props.eyebrow.trim())), ...(keyframeNative ? { opacity: revealTrack(`${prefix}:eyebrow`, context, 0.04, 0.16), transform: Object.freeze({ ...eyebrowBase.transform, positionY: translateYTrack(`${prefix}:eyebrow-y`, context, 0.04, 18 * style.motionIntensity) }) } : {}) })
  const titleBase = graphText({ id: titleId, name: 'Title', parentId: contentId, text: props.title, color: style.textColor, fontFamily: style.fontFamily, fontSize: Math.round(short * 0.064), fontWeight: style.titleWeight })
  const title = keyframeNative ? Object.freeze({ ...titleBase, opacity: revealTrack(`${prefix}:title`, context, 0.10, 0.28), transform: Object.freeze({ ...titleBase.transform, positionY: translateYTrack(`${prefix}:title-y`, context, 0.10, 34 * style.motionIntensity), scaleX: scaleTrack(`${prefix}:title-sx`, context, 0.10, 0.92, 1.04), scaleY: scaleTrack(`${prefix}:title-sy`, context, 0.10, 0.92, 1.04) }) }) : titleBase
  const subtitleBase = graphText({ id: subtitleId, name: 'Subtitle', parentId: contentId, text: props.subtitle, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: Math.round(short * 0.027), fontWeight: style.bodyWeight })
  const subtitle = Object.freeze({ ...subtitleBase, visible: constant(Boolean(props.subtitle.trim())), ...(keyframeNative ? { opacity: revealTrack(`${prefix}:subtitle`, context, 0.22, 0.40), transform: Object.freeze({ ...subtitleBase.transform, positionY: translateYTrack(`${prefix}:subtitle-y`, context, 0.22, 22 * style.motionIntensity) }) } : {}) })
  const valueBase = graphText({ id: valueId, name: 'Value', parentId: contentId, text: props.value, color: style.accentColor, fontFamily: style.fontFamily, fontSize: Math.round(short * 0.085), fontWeight: style.titleWeight })
  const value = Object.freeze({ ...valueBase, visible: constant(Boolean(props.value.trim())), ...(keyframeNative ? { opacity: revealTrack(`${prefix}:value`, context, 0.28, 0.46), transform: Object.freeze({ ...valueBase.transform, positionY: translateYTrack(`${prefix}:value-y`, context, 0.28, 26 * style.motionIntensity), scaleX: scaleTrack(`${prefix}:value-sx`, context, 0.28, 0.72, 1.10), scaleY: scaleTrack(`${prefix}:value-sy`, context, 0.28, 0.72, 1.10) }) } : {}) })
  const items = graphGroup(itemsId, 'Items', contentId, itemIds)
  const itemNodes = Object.fromEntries(props.items.map((item, index) => {
    const base = graphText({ id: itemIds[index]!, name: `Item ${index + 1}`, parentId: itemsId, text: item, color: style.textColor, fontFamily: style.fontFamily, fontSize: Math.round(short * 0.027), fontWeight: style.bodyWeight })
    if (keyframeNative) {
      const start = Math.min(0.18 + index * 0.11, 0.58)
      return [base.id, Object.freeze({ ...base, opacity: revealTrack(`${prefix}:item:${index + 1}`, context, start, Math.min(start + 0.16, 0.78)), transform: Object.freeze({ ...base.transform, positionY: translateYTrack(`${prefix}:item:${index + 1}:y`, context, start, 30 * style.motionIntensity), scaleX: scaleTrack(`${prefix}:item:${index + 1}:sx`, context, start, 0.88, 1.03), scaleY: scaleTrack(`${prefix}:item:${index + 1}:sy`, context, start, 0.88, 1.03) }) })]
    }
    const itemReveal = mReduced(mConst(1), mEase('ease-out-cubic', mStagger(mSequence(0.12, 0.54, mProgress()), index, Math.max(1, props.items.length), 0.55)))
    return [base.id, Object.freeze({ ...base, opacity: mNumber(mMultiply(itemReveal, remain)) })]
  }))
  const exposures: MotionExposureV1[] = [
    { id: `${prefix}.eyebrow`, label: 'Eyebrow', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'eyebrow' }, editor: { type: 'text' }, keyframeable: false },
    { id: `${prefix}.title`, label: 'Title', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'title' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: `${prefix}.subtitle`, label: 'Subtitle', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'subtitle' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: `${prefix}.value`, label: 'Value / CTA', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'value' }, editor: { type: 'text' }, keyframeable: false },
    { id: `${prefix}.items`, label: 'Items · one per line', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'items' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: `${prefix}.placement`, label: 'Safe placement', group: 'Layout', level: 'creator', target: { kind: 'component', propertyId: 'placement' }, editor: { type: 'select', options: FAMILY_PLACEMENT_INTENTS.map((placement) => ({ label: placement.replace(/-/gu, ' '), value: placement })) }, keyframeable: false },
    { id: `${prefix}.safe-offset`, label: 'Safe offset', group: 'Layout', level: 'designer', target: { kind: 'component', propertyId: 'safeOffset' }, editor: { type: 'slider' }, keyframeable: false, constraints: { minimum: 0, maximum: 240, step: 1 } },
    { id: `${prefix}.text-color`, label: 'Text color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'textColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: `${prefix}.accent-color`, label: 'Accent color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'accentColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: `${prefix}.radius`, label: 'Surface roundness', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: surfaceId, property: 'shape.radius' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 120, step: 1 } },
    { id: `${prefix}.position-x`, label: 'Position X', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'transform.positionX' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: -500, maximum: 500, step: 1 } },
    { id: `${prefix}.position-y`, label: 'Position Y', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'transform.positionY' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: -500, maximum: 500, step: 1 } },
    { id: `${prefix}.opacity`, label: 'Overall opacity', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'opacity' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: `${prefix}.parts`, label: 'Semantic parts', group: 'Parts', level: 'advanced', target: { kind: 'part', semanticPartId: 'content', property: 'opacity' }, editor: { type: 'readonly' }, keyframeable: true },
  ]
  return createMotionScene({
    componentId: config.id, componentVersion: 1, rootNodeId: rootId,
    nodes: Object.freeze({ [root.id]: root, [surface.id]: surface, [accent.id]: accent, [content.id]: content, [eyebrow.id]: eyebrow, [title.id]: title, [subtitle.id]: subtitle, [value.id]: value, [items.id]: items, ...itemNodes }),
    semanticParts: Object.freeze([
      { id: 'surface', label: 'Surface', role: 'surface', nodeIds: Object.freeze([surfaceId, accentId]) },
      { id: 'content', label: 'Content', role: 'content-group', nodeIds: Object.freeze([contentId, eyebrowId, titleId, subtitleId, valueId, itemsId, ...itemIds]) },
      { id: 'primaryText', label: 'Primary text', role: 'primary-text', nodeIds: Object.freeze([titleId, valueId]) },
      { id: 'items', label: 'Items', role: 'secondary-text', nodeIds: Object.freeze(itemIds) },
    ]),
    exposures: Object.freeze(exposures), layout: responsiveGraphLayout(), supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5']),
  })
}

const categoryForFamily = (family: FamilyKind): MotionComponentDefinitionV1['category'] => family === 'title' ? 'typography' : family === 'value' ? 'comparison' : family === 'list' ? 'card' : family === 'status' ? 'ui' : family === 'diagram' ? 'diagram' : family === 'quote' ? 'callout' : 'cta'
const familySurfaceVisible = (family: FamilyKind, variant: string) => !(family === 'title' && ['minimal', 'chapter', 'highlight'].includes(variant))
const alignmentFor = (config: FamilyVariantConfig): 'left' | 'center' => ['lower-third', 'definition', 'label', 'metric-delta', 'price-breakdown', 'agenda', 'feature-stack', 'notification', 'sequence', 'testimonial', 'review', 'comment', 'client-strip', 'citation', 'dashboard', 'browser', 'chat', 'search', 'upload'].includes(config.variant) ? 'left' : 'center'

const renderFamilyVisual = (config: FamilyVariantConfig, props: FamilyComponentProps, style: FamilyComponentStyle, state: FamilyComponentState, graphStyle: (id: string, base: CSSProperties) => CSSProperties, graphScene: ReturnType<typeof useMotionGraphPresentation>['scene']) => {
  const prefix = nodePrefix(config)
  const titleStyle: CSSProperties = { color: style.textColor, fontSize: state.layout === 'wide' ? 68 : 52, lineHeight: 1.02, fontWeight: style.titleWeight, letterSpacing: '-.04em' }
  const subtitleStyle: CSSProperties = { color: style.mutedColor, fontSize: state.layout === 'wide' ? 28 : 24, lineHeight: 1.3, fontWeight: style.bodyWeight }
  const valueStyle: CSSProperties = { color: style.accentColor, fontSize: state.layout === 'wide' ? 84 : 66, lineHeight: 1, fontWeight: style.titleWeight, letterSpacing: '-.05em' }
  const eyebrow = props.eyebrow.trim() ? <div data-motion-node-id={`${prefix}.eyebrow`} style={graphStyle(`${prefix}.eyebrow`, { color: style.accentColor, fontSize: 20, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' })}>{props.eyebrow}</div> : null
  const title = <div data-motion-node-id={`${prefix}.title`} style={graphStyle(`${prefix}.title`, titleStyle)}>{props.title}</div>
  const subtitle = props.subtitle.trim() ? <div data-motion-node-id={`${prefix}.subtitle`} style={graphStyle(`${prefix}.subtitle`, subtitleStyle)}>{props.subtitle}</div> : null
  const value = props.value.trim() ? <div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, valueStyle)}>{props.value}</div> : null
  const item = (text: string, index: number, extra: CSSProperties = {}) => <div key={`${text}:${index}`} data-motion-node-id={`${prefix}.item:${index + 1}`} style={graphStyle(`${prefix}.item:${index + 1}`, { color: style.textColor, fontSize: state.layout === 'wide' ? 26 : 22, lineHeight: 1.22, fontWeight: style.bodyWeight, ...extra })}>{text}</div>
  const parsedRows = props.items.map((entry) => entry.split('·').map((part) => part.trim()))
  const numericRows = parsedRows.map((parts, index) => ({ label: parts[0] ?? props.items[index] ?? '', value: Number.parseFloat(parts.at(-1) ?? ''), parts, index })).filter((row) => Number.isFinite(row.value))

  if (config.variant === 'trend-line-chart') {
    const values = numericRows.length ? numericRows : props.items.map((entry, index) => ({ label: entry, value: index + 1, parts: [entry], index }))
    const minimum = values.reduce((current, row) => Math.min(current, row.value), values[0]?.value ?? 0)
    const maximum = values.reduce((current, row) => Math.max(current, row.value), values[0]?.value ?? 1)
    const span = Math.max(1e-6, maximum - minimum)
    const points = values.map((row, index) => ({ ...row, x: values.length <= 1 ? 50 : 8 + index * 84 / (values.length - 1), y: 82 - ((row.value - minimum) / span) * 64 }))
    return <div style={{ display: 'grid', gap: 14, textAlign: 'left' }}>{eyebrow}<div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end' }}><div>{title}{subtitle}</div>{value}</div><div style={{ position: 'relative', minHeight: state.layout === 'wide' ? 260 : 320, borderRadius: Math.max(14, style.radius), border: `1px solid ${style.textColor}18`, background: `linear-gradient(180deg, ${style.accentColor}0d, ${style.textColor}03)`, overflow: 'hidden' }}><svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 18, width: 'calc(100% - 36px)', height: 'calc(100% - 36px)' }}><polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={style.accentColor} strokeWidth="2.2" vectorEffect="non-scaling-stroke" /><polyline points={`8,90 ${points.map((point) => `${point.x},${point.y}`).join(' ')} 92,90`} fill={`${style.accentColor}14`} stroke="none" /></svg>{points.map((point) => <div key={`${point.label}:${point.index}`} data-motion-node-id={`${prefix}.item:${point.index + 1}`} style={graphStyle(`${prefix}.item:${point.index + 1}`, { position: 'absolute', left: `${point.x}%`, top: `${point.y}%`, translate: '-50% -50%', display: 'grid', justifyItems: 'center', gap: 4 })}><span style={{ width: 13, height: 13, borderRadius: '50%', background: style.surfaceColor, border: `3px solid ${style.accentColor}`, boxShadow: `0 0 0 4px ${style.accentColor}18` }} /><strong style={{ color: style.textColor, fontSize: state.layout === 'wide' ? 18 : 16, fontVariantNumeric: 'tabular-nums' }}>{point.value}</strong><small style={{ color: style.mutedColor, fontSize: 13, whiteSpace: 'nowrap' }}>{point.label}</small></div>)}</div></div>
  }
  if (config.variant === 'donut-breakdown') {
    const values = numericRows.length ? numericRows : props.items.map((entry, index) => ({ label: entry, value: 1, parts: [entry], index }))
    const total = Math.max(1e-6, values.reduce((sum, row) => sum + Math.max(0, row.value), 0))
    let cursor = 0
    const segments = values.map((row, index) => { const start = cursor; cursor += Math.max(0, row.value) / total * 360; return `${index % 2 === 0 ? style.accentColor : index % 3 === 0 ? style.successColor : style.mutedColor} ${start}deg ${cursor}deg` })
    return <div style={{ display: 'grid', gap: 16, textAlign: 'left' }}>{eyebrow}{title}{subtitle}<div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? 'minmax(240px,.8fr) 1fr' : '1fr', gap: 22, alignItems: 'center' }}><div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { width: state.layout === 'wide' ? 260 : 220, aspectRatio: '1', justifySelf: 'center', borderRadius: '50%', background: `conic-gradient(${segments.join(',')})`, display: 'grid', placeItems: 'center', boxShadow: `inset 0 0 0 ${state.layout === 'wide' ? 62 : 52}px ${style.surfaceColor}` })}><div style={{ display: 'grid', textAlign: 'center' }}><strong style={{ color: style.textColor, fontSize: state.layout === 'wide' ? 42 : 34 }}>{props.value || '100%'}</strong><small style={{ color: style.mutedColor, fontSize: 14 }}>TOTAL</small></div></div><div style={{ display: 'grid', gap: 10 }}>{values.map((row, index) => item(`${row.label} · ${row.value}`, row.index, { padding: '11px 13px', borderRadius: 10, borderLeft: `5px solid ${index % 2 === 0 ? style.accentColor : index % 3 === 0 ? style.successColor : style.mutedColor}`, background: `${style.textColor}07`, fontVariantNumeric: 'tabular-nums' }))}</div></div></div>
  }
  if (config.variant === 'venn-intersection') {
    const labels = props.items.slice(0, 3)
    return <div style={{ display: 'grid', gap: 14, textAlign: 'center' }}>{eyebrow}{title}{subtitle}<div style={{ position: 'relative', minHeight: state.layout === 'wide' ? 300 : 390, marginTop: 6 }}><div data-motion-node-id={`${prefix}.item:1`} style={graphStyle(`${prefix}.item:1`, { position: 'absolute', left: state.layout === 'wide' ? '24%' : '10%', top: state.layout === 'wide' ? '15%' : '8%', width: state.layout === 'wide' ? '38%' : '58%', aspectRatio: '1', borderRadius: '50%', border: `2px solid ${style.accentColor}99`, background: `${style.accentColor}24`, display: 'grid', placeItems: 'center', paddingRight: '28%', color: style.textColor, fontWeight: 850, fontSize: state.layout === 'wide' ? 27 : 22 })}>{labels[0] ?? 'Human judgment'}</div><div data-motion-node-id={`${prefix}.item:2`} style={graphStyle(`${prefix}.item:2`, { position: 'absolute', right: state.layout === 'wide' ? '24%' : '10%', top: state.layout === 'wide' ? '15%' : '8%', width: state.layout === 'wide' ? '38%' : '58%', aspectRatio: '1', borderRadius: '50%', border: `2px solid ${style.successColor}99`, background: `${style.successColor}20`, display: 'grid', placeItems: 'center', paddingLeft: '28%', color: style.textColor, fontWeight: 850, fontSize: state.layout === 'wide' ? 27 : 22 })}>{labels[1] ?? 'Automation'}</div><div data-motion-node-id={`${prefix}.item:3`} style={graphStyle(`${prefix}.item:3`, { position: 'absolute', left: '50%', top: state.layout === 'wide' ? '48%' : '42%', translate: '-50% -50%', zIndex: 4, maxWidth: '32%', padding: '10px 14px', borderRadius: 999, background: style.surfaceColor, border: `2px solid ${style.textColor}35`, color: style.accentColor, fontWeight: 900, fontSize: state.layout === 'wide' ? 22 : 18 })}>{labels[2] ?? props.value ?? 'SYSTEM'}</div></div>{value}</div>
  }
  if (config.variant === 'feature-comparison-table') {
    return <div style={{ display: 'grid', gap: 14, textAlign: 'left' }}>{eyebrow}{title}{subtitle}<div style={{ display: 'grid', gap: 6 }}><div style={{ display: 'grid', gridTemplateColumns: '1.25fr .75fr .75fr', gap: 6, color: style.mutedColor, fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}><span>Feature</span><span>Manual</span><span style={{ color: style.accentColor }}>System</span></div>{parsedRows.map((parts, index) => <div key={`table:${index}`} data-motion-node-id={`${prefix}.item:${index + 1}`} style={graphStyle(`${prefix}.item:${index + 1}`, { display: 'grid', gridTemplateColumns: '1.25fr .75fr .75fr', alignItems: 'stretch', borderRadius: 10, overflow: 'hidden', background: `${style.textColor}06`, border: `1px solid ${style.textColor}14` })}><strong style={{ padding: '12px 14px', color: style.textColor, fontSize: state.layout === 'wide' ? 19 : 16 }}>{parts[0] ?? ''}</strong><span style={{ padding: '12px 14px', color: style.mutedColor, borderLeft: `1px solid ${style.textColor}10`, fontSize: state.layout === 'wide' ? 18 : 15 }}>{parts[1] ?? '—'}</span><span style={{ padding: '12px 14px', color: style.accentColor, borderLeft: `1px solid ${style.textColor}10`, fontSize: state.layout === 'wide' ? 18 : 15, fontWeight: 850 }}>{parts[2] || props.value || '✓'}</span></div>)}</div>{value}</div>
  }
  if (config.variant === 'code-diff-spotlight') {
    return <div style={{ display: 'grid', gap: 13, textAlign: 'left' }}>{eyebrow}<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end' }}><div>{title}<div style={{ color: style.mutedColor, font: '15px Consolas, monospace' }}>{props.subtitle}</div></div>{value}</div><div style={{ display: 'grid', gap: 3, padding: state.layout === 'wide' ? 18 : 14, borderRadius: Math.max(12, style.radius), background: '#090b0e', border: `1px solid ${style.textColor}18`, boxShadow: '0 18px 55px rgba(0,0,0,.28)' }}>{props.items.map((entry, index) => { const added = entry.trim().startsWith('+'); const removed = entry.trim().startsWith('-'); return item(entry, index, { padding: '8px 10px', borderRadius: 6, background: added ? `${style.successColor}15` : removed ? `${style.dangerColor}15` : 'transparent', color: added ? style.successColor : removed ? style.dangerColor : style.textColor, fontFamily: 'Consolas, monospace', fontSize: state.layout === 'wide' ? 18 : 15, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })})}</div></div>
  }
  if (config.variant === 'terminal-command-story') {
    return <div style={{ display: 'grid', gap: 13, textAlign: 'left' }}>{eyebrow}<div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { display: 'flex', gap: 7, alignItems: 'center', color: style.mutedColor, font: `${state.layout === 'wide' ? 15 : 19}px Consolas, monospace` })}><span style={{ color: style.dangerColor }}>●</span><span style={{ color: '#ffd166' }}>●</span><span style={{ color: style.successColor }}>●</span><span style={{ marginLeft: 8 }}>{props.subtitle || 'terminal'}</span></div><div style={{ padding: state.layout === 'wide' ? '18px 20px' : '20px', borderRadius: Math.max(12, style.radius), background: '#07090c', border: `1px solid ${style.textColor}18`, boxShadow: '0 18px 55px rgba(0,0,0,.28)', display: 'grid', gap: state.layout === 'wide' ? 8 : 12 }}><div data-motion-node-id={`${prefix}.title`} style={graphStyle(`${prefix}.title`, { color: style.textColor, font: `${state.layout === 'wide' ? 21 : 27}px/1.35 Consolas, monospace`, overflowWrap: 'anywhere' })}><span style={{ color: style.accentColor }}>$ </span>{props.title}</div>{props.items.map((entry, index) => item(entry, index, { padding: state.layout === 'wide' ? '3px 0' : '5px 0', color: index === props.items.length - 1 ? style.successColor : style.mutedColor, fontFamily: 'Consolas, monospace', fontSize: state.layout === 'wide' ? 17 : 21, overflowWrap: 'anywhere' }))}</div><div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, { justifySelf: 'start', padding: '8px 12px', borderRadius: 999, color: style.successColor, border: `1px solid ${style.successColor}45`, background: `${style.successColor}0d`, font: `800 ${state.layout === 'wide' ? 13 : 18}px Consolas, monospace` })}>{props.value || 'exit 0'}</div></div>
  }

  if (config.variant === 'conversation-toast-stack') {
    return <div style={{ display: 'grid', gap: 12, textAlign: 'left' }}>{eyebrow}<div style={{ display: 'grid', gap: 10 }}>{props.items.slice(0, 4).map((entry, index) => item(entry, index, { display: 'block', padding: state.layout === 'wide' ? '16px 18px' : '18px 20px', marginLeft: state.layout === 'wide' ? index * 18 : index * 7, borderRadius: Math.max(14, style.radius), border: `1px solid ${style.textColor}20`, background: index === 0 ? `${style.accentColor}16` : `${style.textColor}0b`, boxShadow: '0 12px 30px rgba(0,0,0,.18)', fontSize: state.layout === 'wide' ? 23 : 25, lineHeight: 1.25, overflowWrap: 'break-word' }))}</div><div style={{ display: 'grid', gap: 5 }}>{title}{subtitle}</div></div>
  }
  if (config.variant === 'floating-prompt-composer') {
    return <div style={{ display: 'grid', gap: 14, textAlign: 'left' }}>{eyebrow}<div data-motion-node-id={`${prefix}.title`} style={graphStyle(`${prefix}.title`, { minHeight: state.layout === 'wide' ? 132 : 176, padding: '20px 22px', borderRadius: Math.max(16, style.radius), border: `1px solid ${style.textColor}24`, background: `${style.textColor}08`, color: style.textColor, fontSize: state.layout === 'wide' ? 30 : 26, lineHeight: 1.35, fontWeight: 650 })}>{props.title}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{props.items.map((entry, index) => item(entry, index, { padding: '8px 12px', borderRadius: 999, border: `1px solid ${style.accentColor}3d`, background: `${style.accentColor}0d`, color: style.accentColor, fontSize: state.layout === 'wide' ? 18 : 16, fontWeight: 750 }))}</div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><div data-motion-node-id={`${prefix}.subtitle`} style={graphStyle(`${prefix}.subtitle`, { color: style.mutedColor, fontSize: 17 })}>{props.subtitle}</div><div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, { padding: '10px 16px', borderRadius: 999, background: style.accentColor, color: '#080808', fontSize: 17, fontWeight: 900 })}>{props.value || 'SEND'}</div></div></div>
  }
  if (config.variant === 'product-ui-story') {
    return <div style={{ display: 'grid', gap: 12, textAlign: 'left' }}><div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: `${style.textColor}0a`, border: `1px solid ${style.textColor}18`, color: style.mutedColor, fontSize: 15 })}><span style={{ color: style.dangerColor }}>●</span><span style={{ color: '#ffd166' }}>●</span><span style={{ color: style.successColor }}>●</span><strong style={{ marginLeft: 8, color: style.textColor }}>Workspace</strong><span style={{ marginLeft: 'auto' }}>{props.value || 'LIVE'}</span></div><div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? '180px 1fr' : '1fr', gap: 12 }}><div style={{ display: 'grid', gap: 8, alignContent: 'start', padding: 12, borderRadius: Math.max(12, style.radius * .75), background: `${style.textColor}07`, border: `1px solid ${style.textColor}12` }}>{eyebrow}{props.items.slice(0, 2).map((entry, index) => item(entry, index, { padding: '9px 10px', borderRadius: 8, background: index === 0 ? `${style.accentColor}16` : 'transparent', color: index === 0 ? style.accentColor : style.mutedColor, fontSize: 17 }))}</div><div style={{ display: 'grid', gap: 12, padding: state.layout === 'wide' ? 18 : 14, borderRadius: Math.max(14, style.radius), border: `1px solid ${style.accentColor}24`, background: `${style.surfaceColor}` }}>{title}{subtitle}<div style={{ display: 'grid', gap: 8 }}>{props.items.slice(2).map((entry, index) => item(entry, index + 2, { padding: '11px 12px', borderRadius: 9, border: `1px solid ${style.textColor}14`, background: `${style.textColor}06`, fontSize: state.layout === 'wide' ? 19 : 17 }))}</div></div></div></div>
  }
  if (config.variant === 'agent-work-log') {
    return <div style={{ display: 'grid', gap: 14, textAlign: 'left' }}>{eyebrow}<div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 12 }}><div>{title}{subtitle}</div><div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, { color: style.successColor, fontSize: 18, fontWeight: 900, letterSpacing: '.08em' })}>{props.value}</div></div><div style={{ display: 'grid', gap: 9 }}>{props.items.map((entry, index) => item(entry, index, { padding: '12px 14px', borderRadius: 10, border: `1px solid ${index === props.items.length - 1 ? style.successColor : style.textColor}25`, background: index === props.items.length - 1 ? `${style.successColor}0d` : `${style.textColor}06`, fontFamily: 'Consolas, monospace', fontSize: state.layout === 'wide' ? 19 : 17 }))}</div></div>
  }
  if (config.variant === 'scoped-access') {
    const left = props.items[0] ?? 'Legal · contracts + policy'
    const right = props.items[1] ?? 'Engineering · code + issues'
    return <div style={{ display: 'grid', gap: 16, textAlign: 'center' }}>{eyebrow}{title}{subtitle}<div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? '1fr auto 1fr' : '1fr', gap: 12, alignItems: 'stretch' }}><div data-motion-node-id={`${prefix}.item:1`} style={graphStyle(`${prefix}.item:1`, { display: 'grid', alignContent: 'center', gap: 10, minHeight: 130, padding: 18, borderRadius: Math.max(14, style.radius), border: `1px solid ${style.accentColor}45`, background: `${style.accentColor}0b`, color: style.textColor, fontSize: state.layout === 'wide' ? 25 : 21, lineHeight: 1.25, fontWeight: 800 })}>{left}</div><div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { alignSelf: 'center', color: style.mutedColor, fontSize: 30, fontWeight: 900 })}>≠</div><div data-motion-node-id={`${prefix}.item:2`} style={graphStyle(`${prefix}.item:2`, { display: 'grid', alignContent: 'center', gap: 10, minHeight: 130, padding: 18, borderRadius: Math.max(14, style.radius), border: `1px solid ${style.successColor}45`, background: `${style.successColor}0b`, color: style.textColor, fontSize: state.layout === 'wide' ? 25 : 21, lineHeight: 1.25, fontWeight: 800 })}>{right}</div></div><div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, { color: style.accentColor, fontSize: state.layout === 'wide' ? 22 : 19, fontWeight: 850 })}>{props.value}</div></div>
  }
  if (config.variant === 'keyword-brand-lockup') {
    return <div style={{ display: 'grid', gap: 16, justifyItems: 'center', textAlign: 'center' }}>{eyebrow}<div data-motion-node-id={`${prefix}.title`} style={graphStyle(`${prefix}.title`, { color: style.mutedColor, fontSize: state.layout === 'wide' ? 38 : 31, fontWeight: 750, letterSpacing: '-.02em' })}>{props.title}</div><div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { width: state.layout === 'wide' ? 160 : 110, height: 5, borderRadius: 999, background: style.accentColor })} /><div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, { color: style.textColor, fontSize: state.layout === 'wide' ? 92 : 66, lineHeight: .92, fontWeight: 950, letterSpacing: '-.06em', textTransform: 'uppercase' })}>{props.value}</div><div data-motion-node-id={`${prefix}.subtitle`} style={graphStyle(`${prefix}.subtitle`, { color: style.mutedColor, fontSize: state.layout === 'wide' ? 23 : 20 })}>{props.subtitle}</div></div>
  }

  if (config.family === 'title') {
    if (config.variant === 'keyword-slam') {
      return <div style={{ display: 'grid', gap: 14, textAlign: 'center', justifyItems: 'center' }}>{eyebrow}<div style={{ maxWidth: '92%' }}>{title}</div><div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, { color: style.accentColor, fontSize: state.layout === 'wide' ? 132 : 86, lineHeight: .88, fontWeight: 950, letterSpacing: '-.07em', textTransform: 'uppercase', overflowWrap: 'anywhere' })}>{props.value}</div>{subtitle}<div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { width: state.layout === 'wide' ? 190 : 120, height: 8, borderRadius: 999, background: style.accentColor })} /></div>
    }
    if (config.variant === 'three-beat') {
      return <div style={{ display: 'grid', gap: 14, textAlign: 'center' }}>{eyebrow}{title}<div style={{ color: style.mutedColor, fontSize: state.layout === 'wide' ? 24 : 20 }}>{props.subtitle}</div><div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? 'repeat(3, minmax(0,1fr))' : '1fr', gap: 12 }}>{props.items.slice(0, 3).map((entry, index) => item(entry, index, { padding: state.layout === 'wide' ? '22px 18px' : '15px 16px', borderRadius: style.radius, border: `1px solid ${style.accentColor}${index === 1 ? '88' : '35'}`, background: index === 1 ? `${style.accentColor}16` : `${style.textColor}08`, fontSize: state.layout === 'wide' ? 34 : 27, fontWeight: 850, textAlign: 'center' }))}</div>{value}</div>
    }
    if (config.variant === 'stacked-hook') {
      const lines = [props.title, props.subtitle, props.value].filter(Boolean)
      return <div style={{ display: 'grid', gap: 10, textAlign: 'left' }}>{eyebrow}{lines.map((line, index) => <div key={`${line}:${index}`} data-motion-node-id={index === 0 ? `${prefix}.title` : index === 1 ? `${prefix}.subtitle` : `${prefix}.value`} style={graphStyle(index === 0 ? `${prefix}.title` : index === 1 ? `${prefix}.subtitle` : `${prefix}.value`, { padding: '12px 16px', borderLeft: `6px solid ${index === 1 ? style.accentColor : `${style.textColor}33`}`, background: index === 1 ? `${style.accentColor}10` : `${style.textColor}06`, color: index === 1 ? style.accentColor : style.textColor, fontSize: state.layout === 'wide' ? 58 - index * 5 : 64 - index * 7, fontWeight: index === 1 ? 900 : style.titleWeight, lineHeight: 1.02, overflowWrap: 'anywhere' })}>{line}</div>)}</div>
    }
    if (config.variant === 'sentence-deconstruction') {
      return <div style={{ display: 'grid', gap: 18, textAlign: 'center' }}>{eyebrow}{title}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>{props.items.map((entry, index) => item(entry, index, { padding: '11px 15px', borderRadius: 999, background: index % 2 === 0 ? `${style.accentColor}14` : `${style.textColor}0a`, border: `1px solid ${index % 2 === 0 ? style.accentColor : style.textColor}35`, color: index % 2 === 0 ? style.accentColor : style.textColor, fontWeight: 800 }))}</div>{subtitle}<div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { width: 9, height: 9, borderRadius: '50%', background: style.accentColor })} /></div>
    }
    if (config.variant === 'punch-word') {
      return <div style={{ display: 'grid', gap: 14, textAlign: 'center', justifyItems: 'center' }}>{eyebrow}{title}<div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, { padding: state.layout === 'wide' ? '18px 30px' : '14px 22px', borderRadius: style.radius, background: style.accentColor, color: '#080808', fontSize: state.layout === 'wide' ? 86 : 62, lineHeight: .9, fontWeight: 950, letterSpacing: '-.06em', textTransform: 'uppercase', overflowWrap: 'anywhere' })}>{props.value}</div>{subtitle}</div>
    }
    const isSplit = config.variant === 'split'
    const isQuestion = config.variant === 'question'
    const isLower = config.variant === 'lower-third'
    return <div style={{ display: 'grid', gap: isLower ? 12 : 18, maxWidth: isLower ? '72%' : '92%', marginLeft: isLower ? 0 : 'auto', marginRight: isLower ? 'auto' : 'auto', textAlign: isLower ? 'left' : 'center' }}>{eyebrow}{isQuestion ? <div style={{ color: style.accentColor, fontSize: 56, fontWeight: 900 }}>?</div> : null}<div style={isSplit ? { display: 'grid', gridTemplateColumns: state.layout === 'wide' ? '1fr auto 1fr' : '1fr', gap: 14, alignItems: 'center' } : undefined}>{title}{isSplit ? <span style={{ color: style.accentColor, fontSize: 42 }}>×</span> : null}{isSplit ? <div style={subtitleStyle}>{props.value || props.subtitle}</div> : null}</div>{!isSplit ? subtitle : null}<div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { width: config.variant === 'highlight' ? '60%' : 110, height: config.variant === 'underline' ? 8 : 5, borderRadius: 999, background: style.accentColor, margin: isLower ? '2px 0 0' : '2px auto 0' })} /></div>
  }
  if (config.family === 'value') {
    const compare = config.variant === 'before-after'
    if (config.variant === 'poll-result') {
      return <div style={{ display: 'grid', gap: 16, textAlign: 'left' }}>{eyebrow}{title}{subtitle}<div style={{ display: 'grid', gap: 10 }}>{props.items.slice(0, 4).map((entry, index) => { const parts = entry.split('·'); const label = parts[0]?.trim() ?? entry; const percent = parts[1]?.trim() ?? ''; const numeric = Number.parseFloat(percent); const width = Number.isFinite(numeric) ? `${Math.max(0, Math.min(100, numeric))}%` : `${Math.max(24, 92 - index * 18)}%`; return <div key={`${entry}:${index}`} data-motion-node-id={`${prefix}.item:${index + 1}`} style={graphStyle(`${prefix}.item:${index + 1}`, { display: 'grid', gap: 6, padding: '10px 12px', borderRadius: style.radius * .7, border: `1px solid ${style.textColor}1d`, background: `${style.textColor}06` })}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: style.textColor, fontSize: state.layout === 'wide' ? 23 : 20, fontWeight: 750 }}><span>{label}</span><strong style={{ color: index === 0 ? style.accentColor : style.mutedColor }}>{percent}</strong></div><div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: `${style.textColor}12` }}><div style={{ width, height: '100%', borderRadius: 999, background: index === 0 ? style.accentColor : `${style.textColor}55` }} /></div></div> })}</div>{value}</div>
    }
    if (config.variant === 'myth-fact' || config.variant === 'problem-solution') {
      const left = props.items[0] ?? 'Problem'
      const right = props.items[1] ?? props.value
      return <div style={{ display: 'grid', gap: 18, textAlign: 'center' }}>{eyebrow}{title}{subtitle}<div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? '1fr auto 1fr' : '1fr', gap: 14, alignItems: 'stretch' }}><div data-motion-node-id={`${prefix}.item:1`} style={graphStyle(`${prefix}.item:1`, { padding: 20, borderRadius: style.radius, border: `1px solid ${style.dangerColor}55`, background: `${style.dangerColor}0c`, color: style.textColor, fontSize: state.layout === 'wide' ? 28 : 23, fontWeight: style.bodyWeight, lineHeight: 1.22 })}>{left}</div><div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { alignSelf: 'center', color: style.accentColor, fontSize: 38, fontWeight: 900 })}>→</div><div data-motion-node-id={`${prefix}.item:2`} style={graphStyle(`${prefix}.item:2`, { padding: 20, borderRadius: style.radius, border: `1px solid ${style.successColor}55`, background: `${style.successColor}0c`, color: style.textColor, fontSize: state.layout === 'wide' ? 28 : 23, fontWeight: style.bodyWeight, lineHeight: 1.22 })}>{right}</div></div>{value ? <div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, { color: style.accentColor, fontSize: state.layout === 'wide' ? 30 : 24, fontWeight: 900, letterSpacing: '.08em' })}>{props.value}</div> : null}</div>
    }
    if (config.variant === 'dashboard') {
      return <div style={{ display: 'grid', gap: 18, textAlign: 'left' }}>{eyebrow}<div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? '1fr auto' : '1fr', gap: 16, alignItems: 'end' }}><div>{title}{subtitle}</div>{value}</div><div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? `repeat(${Math.max(1, props.items.length)}, minmax(0, 1fr))` : '1fr', gap: 10 }}>{props.items.map((entry, index) => item(entry, index, { padding: '14px 16px', borderRadius: style.radius * .7, border: `1px solid ${style.accentColor}2e`, background: `${style.textColor}08`, fontVariantNumeric: 'tabular-nums' }))}</div></div>
    }
    return <div style={{ display: 'grid', gap: 18, textAlign: alignmentFor(config) }}>{eyebrow}{title}{compare ? <div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? '1fr auto 1fr' : '1fr', gap: 18, alignItems: 'center' }}><div style={{ ...valueStyle, color: style.dangerColor }}>{props.items[0] ?? 'Before'}</div><div style={{ color: style.accentColor, fontSize: 44 }}>→</div><div style={{ ...valueStyle, color: style.successColor }}>{props.value}</div></div> : value}{subtitle}{props.items.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: alignmentFor(config) === 'left' ? 'flex-start' : 'center' }}>{props.items.slice(compare ? 1 : 0).map((entry, index) => item(entry, compare ? index + 1 : index, { padding: '10px 14px', borderRadius: 999, background: `${style.textColor}0d` }))}</div> : null}</div>
  }
  if (config.family === 'list') {
    const tags = config.variant === 'tag-cloud'
    const two = config.variant === 'pros-cons'
    if (config.variant === 'browser') {
      return <div style={{ display: 'grid', gap: 14, textAlign: 'left' }}><div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { display: 'flex', alignItems: 'center', gap: 8, minHeight: 38, padding: '8px 12px', borderRadius: 10, background: `${style.textColor}0b`, border: `1px solid ${style.textColor}18`, color: style.mutedColor, fontSize: 18 })}><span style={{ color: style.dangerColor }}>●</span><span style={{ color: '#ffd166' }}>●</span><span style={{ color: style.successColor }}>●</span><span style={{ marginLeft: 8, flex: 1, padding: '5px 10px', borderRadius: 8, background: `${style.textColor}08`, fontFamily: 'Consolas, monospace', fontSize: 16 }}>{props.subtitle}</span></div>{eyebrow}{title}<div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? `repeat(${Math.max(1, props.items.length)}, minmax(0, 1fr))` : '1fr', gap: 10 }}>{props.items.map((entry, index) => item(entry, index, { padding: '16px', borderRadius: style.radius * .65, border: `1px solid ${style.accentColor}33`, background: `${style.accentColor}08` }))}</div></div>
    }
    if (config.variant === 'chat') {
      return <div style={{ display: 'grid', gap: 14, textAlign: 'left' }}>{eyebrow}{title}{subtitle}<div style={{ display: 'grid', gap: 10 }}>{props.items.map((entry, index) => item(entry, index, { justifySelf: index % 2 === 0 ? 'end' : 'start', maxWidth: '82%', padding: '13px 16px', borderRadius: index % 2 === 0 ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: index % 2 === 0 ? `${style.accentColor}22` : `${style.textColor}0d`, border: `1px solid ${index % 2 === 0 ? style.accentColor : style.textColor}28` }))}</div></div>
    }
    if (config.variant === 'search') {
      return <div style={{ display: 'grid', gap: 14, textAlign: 'left' }}>{eyebrow}<div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { padding: '13px 16px', borderRadius: 999, border: `1px solid ${style.textColor}24`, background: `${style.textColor}08`, color: style.textColor, fontSize: state.layout === 'wide' ? 28 : 23, fontWeight: 650 })}>⌕&nbsp;&nbsp;{props.title}</div><div style={{ color: style.mutedColor, fontSize: 18 }}>{props.subtitle}</div><div style={{ display: 'grid', gap: 8 }}>{props.items.map((entry, index) => item(`${index + 1}. ${entry}`, index, { padding: '11px 0', borderBottom: `1px solid ${style.textColor}12` }))}</div></div>
    }
    if (config.variant === 'ranking-podium') {
      const ranked = props.items.slice(0, 3)
      const order = ranked.length === 3 ? [ranked[1]!, ranked[0]!, ranked[2]!] : ranked
      return <div style={{ display: 'grid', gap: 16, textAlign: 'center' }}>{eyebrow}{title}{subtitle}<div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? `repeat(${Math.max(1, order.length)}, minmax(0,1fr))` : '1fr', gap: 10, alignItems: 'end' }}>{order.map((entry, visualIndex) => { const originalIndex = ranked.indexOf(entry); const place = originalIndex + 1; const height = state.layout === 'wide' ? 100 + (4 - place) * 34 : 'auto'; return <div key={entry} data-motion-node-id={`${prefix}.item:${originalIndex + 1}`} style={graphStyle(`${prefix}.item:${originalIndex + 1}`, { minHeight: height, display: 'grid', alignContent: 'center', gap: 6, padding: '16px 14px', borderRadius: `${style.radius}px ${style.radius}px 8px 8px`, background: place === 1 ? `${style.accentColor}1e` : `${style.textColor}09`, border: `1px solid ${place === 1 ? style.accentColor : style.textColor}36`, color: style.textColor })}><strong style={{ color: place === 1 ? style.accentColor : style.mutedColor, fontSize: 26 }}>#{place}</strong><span style={{ fontSize: state.layout === 'wide' ? 24 : 21, fontWeight: 800 }}>{entry.replace(/^#\d+\s*/u, '')}</span></div> })}</div>{value}</div>
    }
    if (config.variant === 'app-feature') {
      return <div style={{ display: 'grid', gap: 16, textAlign: 'left' }}><div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { width: 54, height: 54, display: 'grid', placeItems: 'center', borderRadius: 14, background: `${style.accentColor}18`, border: `1px solid ${style.accentColor}55`, color: style.accentColor, fontSize: 26, fontWeight: 900 })}>✦</div>{eyebrow}{title}{subtitle}<div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? `repeat(${Math.max(1, props.items.length)}, minmax(0,1fr))` : '1fr', gap: 10 }}>{props.items.map((entry, index) => item(entry, index, { padding: '13px 15px', borderRadius: style.radius * .7, background: `${style.textColor}07`, border: `1px solid ${style.accentColor}28` }))}</div>{value}</div>
    }
    return <div style={{ display: 'grid', gap: 18, textAlign: alignmentFor(config) }}>{eyebrow}{title}{subtitle}{tags ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{props.items.map((entry, index) => item(entry, index, { padding: '10px 16px', border: `1px solid ${style.accentColor}55`, borderRadius: 999, background: `${style.accentColor}0c` }))}</div> : two ? <div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? '1fr 1fr' : '1fr', gap: 14 }}>{props.items.map((entry, index) => item(entry, index, { padding: 16, borderRadius: style.radius * .7, border: `1px solid ${index % 2 === 0 ? style.successColor : style.dangerColor}44` }))}</div> : <div style={{ display: 'grid', gap: 10 }}>{props.items.map((entry, index) => item(`${config.variant === 'numbered' || config.variant === 'steps' ? `${index + 1}. ` : '• '}${entry}`, index, { padding: '8px 0' }))}</div>}</div>
  }
  if (config.family === 'status') {
    const progress = config.variant === 'progress'
    const urgent = config.variant === 'urgency'
    if (config.variant === 'upload') {
      return <div style={{ display: 'grid', gap: 16, textAlign: 'left' }}>{eyebrow}<div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? '1fr auto' : '1fr', gap: 14, alignItems: 'end' }}><div>{title}{subtitle}</div>{value}</div><div style={{ height: 16, borderRadius: 999, background: `${style.textColor}14`, overflow: 'hidden' }}><div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { width: props.value || '72%', height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${style.accentColor}, ${style.successColor})` })} /></div>{props.items.map((entry, index) => item(entry, index, { color: style.mutedColor, fontSize: state.layout === 'wide' ? 20 : 18 }))}</div>
    }
    if (config.variant === 'cursor') {
      return <div style={{ display: 'grid', gap: 16, textAlign: 'center', justifyItems: 'center' }}>{eyebrow}<div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { color: style.accentColor, fontSize: state.layout === 'wide' ? 68 : 54, lineHeight: .9, filter: `drop-shadow(0 8px 18px ${style.accentColor}55)` })}>↖</div><div style={{ padding: '16px 20px', borderRadius: style.radius, border: `2px solid ${style.accentColor}66`, background: `${style.accentColor}0b` }}>{title}</div>{value}{subtitle}{props.items.map((entry, index) => item(entry, index, { color: style.mutedColor }))}</div>
    }
    if (config.variant === 'keyboard-shortcut') {
      return <div style={{ display: 'grid', gap: 16, textAlign: 'center', justifyItems: 'center' }}>{eyebrow}{title}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'center' }}>{props.items.slice(0, 4).map((entry, index) => item(entry, index, { minWidth: state.layout === 'wide' ? 74 : 62, padding: '14px 16px', borderRadius: 12, border: `1px solid ${style.textColor}38`, borderBottomWidth: 5, background: `${style.textColor}0c`, fontFamily: 'Consolas, monospace', fontSize: state.layout === 'wide' ? 31 : 25, fontWeight: 900, textAlign: 'center' }))}</div><div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, { color: style.accentColor, fontSize: state.layout === 'wide' ? 30 : 24, fontWeight: 900, letterSpacing: '.06em' })}>{props.value}</div>{subtitle}</div>
    }
    return <div style={{ display: 'grid', gap: 18, textAlign: alignmentFor(config) }}>{eyebrow}<div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: alignmentFor(config) === 'left' ? 'flex-start' : 'center' }}><span style={{ width: 14, height: 14, borderRadius: '50%', background: urgent ? style.dangerColor : style.accentColor, boxShadow: `0 0 24px ${urgent ? style.dangerColor : style.accentColor}88` }} />{title}</div>{value}{subtitle}{progress ? <div style={{ height: 14, borderRadius: 999, background: `${style.textColor}14`, overflow: 'hidden' }}><div style={{ width: props.value || '68%', height: '100%', background: style.accentColor }} /></div> : null}</div>
  }
  if (config.family === 'diagram') {
    const funnel = config.variant === 'funnel'
    const flywheel = config.variant === 'flywheel'
    return <div style={{ display: 'grid', gap: 22, textAlign: 'center' }}>{eyebrow}{title}{subtitle}<div style={flywheel ? { display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' } : { display: 'grid', gridTemplateColumns: state.layout === 'wide' && !funnel ? `repeat(${Math.max(1, props.items.length)}, minmax(0,1fr))` : '1fr', gap: 12, alignItems: 'center' }}>{props.items.map((entry, index) => <div key={entry} style={{ display: 'contents' }}>{item(entry, index, { padding: 16, borderRadius: flywheel ? 999 : style.radius, background: `${style.accentColor}${funnel ? (18 + index * 10).toString(16).padStart(2, '0') : '10'}`, border: `1px solid ${style.accentColor}44` })}{!flywheel && !funnel && index < props.items.length - 1 ? <span style={{ color: style.accentColor, fontSize: 28 }}>→</span> : null}</div>)}</div></div>
  }
  if (config.family === 'quote') {
    if (config.variant === 'comment') {
      return <div style={{ display: 'grid', gap: 14, textAlign: 'left' }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: '50%', background: style.accentColor, color: '#070707', fontWeight: 900 })}>C</div><div>{eyebrow}<div style={{ color: style.mutedColor, fontSize: 16 }}>{props.subtitle}</div></div></div>{title}<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{value}{props.items.map((entry, index) => item(entry, index, { color: style.mutedColor, fontSize: 18 }))}</div></div>
    }
    if (config.variant === 'client-strip') {
      return <div style={{ display: 'grid', gap: 18, textAlign: 'left' }}>{eyebrow}{title}{subtitle}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{props.items.map((entry, index) => item(entry, index, { padding: '12px 16px', borderRadius: 12, border: `1px solid ${style.textColor}20`, background: `${style.textColor}08`, fontWeight: 800, letterSpacing: '.04em' }))}</div>{value ? <div style={{ color: style.accentColor, fontSize: 18, fontWeight: 900, letterSpacing: '.08em' }}>{props.value}</div> : null}</div>
    }
    if (config.variant === 'social-proof') {
      return <div style={{ display: 'grid', gap: 18, textAlign: 'center' }}>{eyebrow}{title}<div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, valueStyle)}>{props.value}</div>{subtitle}<div style={{ display: 'grid', gridTemplateColumns: state.layout === 'wide' ? `repeat(${Math.max(1, props.items.length)}, minmax(0, 1fr))` : '1fr', gap: 10 }}>{props.items.map((entry, index) => item(entry, index, { padding: '14px 16px', borderRadius: style.radius * .7, border: `1px solid ${style.accentColor}35`, background: `${style.accentColor}09` }))}</div></div>
    }
    if (config.variant === 'citation') {
      return (
        <div style={{ display: 'grid', gap: 13, textAlign: 'left' }}>
          {eyebrow}
          <div
            data-motion-node-id={`${prefix}.accent`}
            style={graphStyle(`${prefix}.accent`, {
              width: 8,
              height: 54,
              borderRadius: 999,
              background: style.accentColor,
            })}
          />
          {title}
          <div style={{ color: style.mutedColor, fontSize: state.layout === 'wide' ? 22 : 19 }}>{props.subtitle}</div>
          <div
            data-motion-node-id={`${prefix}.value`}
            style={graphStyle(`${prefix}.value`, {
              padding: '11px 14px',
              borderRadius: 10,
              background: `${style.textColor}08`,
              color: style.accentColor,
              fontFamily: 'Consolas, monospace',
              fontSize: state.layout === 'wide' ? 19 : 16,
              overflowWrap: 'anywhere',
            })}
          >
            {props.value}
          </div>
          {props.items.map((entry, index) => item(entry, index, { color: style.mutedColor, fontSize: 18 }))}
        </div>
      )
    }
    return <div style={{ display: 'grid', gap: 18, textAlign: alignmentFor(config) }}><div style={{ color: style.accentColor, fontSize: 86, lineHeight: .6, fontFamily: 'Georgia, serif' }}>“</div>{title}{subtitle}{value ? <div style={{ color: style.accentColor, fontSize: 22, fontWeight: 800 }}>{props.value}</div> : null}{props.items.map((entry, index) => item(entry, index, { color: style.mutedColor }))}</div>
  }
  return <div style={{ display: 'grid', gap: 18, textAlign: 'center', justifyItems: 'center' }}>{eyebrow}{title}{subtitle}{value ? <div data-motion-node-id={`${prefix}.value`} style={graphStyle(`${prefix}.value`, { padding: '14px 24px', borderRadius: 999, background: style.accentColor, color: '#080808', fontSize: 24, fontWeight: 900 })}>{props.value}</div> : null}{props.items.length ? <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>{props.items.map((entry, index) => item(entry, index, { color: style.mutedColor }))}</div> : null}</div>
}

const createFamilyComponent = (config: FamilyVariantConfig): MotionGraphBackedComponentModuleV1<FamilyComponentProps, FamilyComponentStyle> => {
  const hierarchyHeavy = isA19HierarchyConfig(config)
  const defaultProps: FamilyComponentProps = Object.freeze({
    eyebrow: config.eyebrow,
    title: config.title,
    subtitle: config.subtitle,
    value: config.value,
    items: Object.freeze([...config.items]),
    ...(A20_PRODUCT_STORY_IDS.has(config.id) ? { placement: config.defaultPlacement ?? 'center', safeOffset: config.defaultSafeOffset ?? 64 } : {}),
  })
  const definition: MotionComponentDefinitionV1 = Object.freeze({
    id: config.id, version: 1, name: config.name, purpose: config.purpose, category: categoryForFamily(config.family), performanceClass: config.family === 'diagram' || config.family === 'list' ? 'medium' : 'light',
    supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5'] as const),
    minDurationTicks: durationTicksForConfig(config, 'min'), defaultDurationTicks: durationTicksForConfig(config, 'default'), maxDurationTicks: durationTicksForConfig(config, 'max'),
    events: Object.freeze(config.events ?? [{ name: 'enter-start', normalizedTime: 0 }, { name: 'content-reveal', normalizedTime: 0.08 }, { name: 'settled', normalizedTime: 0.56 }, { name: 'exit-start', normalizedTime: 0.84 }]),
    contentLimits: Object.freeze([{ field: 'title', description: 'Primary visible title.', minimum: 1, maximum: 96, unit: 'characters' as const }, { field: 'items', description: hierarchyHeavy ? 'Structured hierarchy rows.' : 'Optional supporting items.', minimum: hierarchyHeavy ? 2 : 0, maximum: a19HierarchyItemLimit(config), unit: 'items' as const }]),
    capabilities: FULL_NATIVE_GRAPH_CAPABILITIES,
  })
  const Component = ({ props, style, context }: MotionComponentRenderPropsV1<FamilyComponentProps, FamilyComponentStyle>) => {
    const graph = useMotionGraphPresentation()
    if (hierarchyHeavy) return renderA19HierarchyComponent(config, props, style, context, graph.scene)
    const state = evaluateFamilyComponentState(props, context)
    const graphStyle = (id: string, base: CSSProperties): CSSProperties => mergeMotionGraphNodeStyle(base, graph.scene?.nodes[id] ?? null, graph.selectedNodeId === id)
    const prefix = nodePrefix(config)
    const short = Math.min(context.composition.width, context.composition.height)
    const surface = graph.scene?.nodes[`${prefix}.surface`]
    const shape = surface?.type === 'shape' ? surface : null
    const graphBacked = Boolean(graph.scene)
    const localTransform = context.reducedMotion ? undefined : `translate3d(0, ${(1 - state.reveal) * 26 * style.motionIntensity}px, 0)`
    const productStory = A20_PRODUCT_STORY_IDS.has(config.id)
    const largeProductScene = config.variant === 'product-ui-story' || config.variant === 'scoped-access'
    const placement = productStory ? resolveProductStorySafePlacement({
      width: context.composition.width,
      height: context.composition.height,
      placement: props.placement ?? config.defaultPlacement ?? 'center',
      safeOffset: props.safeOffset ?? config.defaultSafeOffset ?? Math.round(short * .055),
      widthFraction: state.layout === 'wide' ? (largeProductScene ? .68 : .44) : .84,
      heightFraction: state.layout === 'wide' ? .72 : .68,
    }) : null
    const rootBase: CSSProperties = productStory
      ? { position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: style.fontFamily }
      : { position: 'absolute', inset: 0, display: 'grid', placeItems: config.variant === 'lower-third' ? 'end start' : 'center', padding: Math.round(short * 0.075), overflow: 'hidden', fontFamily: style.fontFamily }
    const surfaceBaseStyle: CSSProperties = productStory && placement
      ? { position: 'absolute', left: placement.left, top: placement.top, width: placement.maxWidth, maxHeight: placement.maxHeight, minHeight: Math.min(placement.maxHeight, state.layout === 'wide' ? (largeProductScene ? 380 : 320) : (config.variant === 'product-ui-story' ? 620 : 520)) }
      : { position: 'relative', width: state.layout === 'wide' ? '72%' : '86%', maxWidth: 1380, minHeight: config.family === 'title' ? '28%' : '42%' }
    return <div data-motion-root="family-component" data-motion-family={config.family} data-motion-variant={config.variant} data-motion-module-id={config.id} data-motion-node-id={`${prefix}.root`} style={graphStyle(`${prefix}.root`, rootBase)}>
      <section data-motion-node-id={`${prefix}.surface`} style={graphStyle(`${prefix}.surface`, { ...surfaceBaseStyle, display: 'grid', alignContent: 'center', overflow: 'hidden', padding: config.variant === 'lower-third' ? Math.round(short * .045) : productStory ? Math.round(short * .038) : Math.round(short * .06), borderRadius: shape?.radius ?? style.radius, border: familySurfaceVisible(config.family, config.variant) ? `2px solid ${style.accentColor}22` : '0', background: familySurfaceVisible(config.family, config.variant) ? (shape?.fillColor ?? style.surfaceColor) : 'transparent', boxShadow: familySurfaceVisible(config.family, config.variant) ? '0 24px 70px rgba(0,0,0,.28)' : 'none' })}>
        <div data-motion-node-id={`${prefix}.content`} style={graphStyle(`${prefix}.content`, { opacity: graphBacked ? 1 : state.reveal, transform: graphBacked ? undefined : localTransform })}>
          {renderFamilyVisual(config, props, style, state, graphStyle, graph.scene)}
        </div>
      </section>
    </div>
  }
  return Object.freeze({
    definition,
    defaultProps,
    defaultStyle: DEFAULT_FAMILY_STYLE,
    validateProps: (input: unknown) => hierarchyHeavy ? validateA19HierarchyProps(config, input) : validateFamilyComponentProps(input),
    validateStyle: validateFamilyComponentStyle,
    Component,
    createScene: (props: FamilyComponentProps, style: FamilyComponentStyle, context: MotionRenderContextV1) => hierarchyHeavy ? createA19HierarchyScene(config, props, style, context) : createFamilyScene(config, props, style, context),
  })
}

const configs = Object.freeze([
  // Typography / title — 9 additions + Kinetic Headline = 10.
  { id:'sanverse.section-title', name:'Section Title', purpose:'Open a new section with a strong labeled title.', family:'title', variant:'section', eyebrow:'SECTION 02', title:'Why this changes everything', subtitle:'A clear transition into the next idea.', value:'', items:[] },
  { id:'sanverse.question-title', name:'Question Title', purpose:'Frame a section around one explicit viewer question.', family:'title', variant:'question', eyebrow:'THE QUESTION', title:'What happens next?', subtitle:'Turn the next beat into a curiosity gap.', value:'', items:[] },
  { id:'sanverse.split-title', name:'Split Title', purpose:'Contrast two short ideas in a split title composition.', family:'title', variant:'split', eyebrow:'CONTRAST', title:'Manual work', subtitle:'', value:'Automated system', items:[] },
  { id:'sanverse.lower-third-title', name:'Lower Third Title', purpose:'Identify a speaker, concept or segment without taking over the frame.', family:'title', variant:'lower-third', eyebrow:'SANVERSE', title:'Motion Graph', subtitle:'Deterministic first-party compositor primitives.', value:'', items:[] },
  { id:'sanverse.chapter-title', name:'Chapter Title', purpose:'Mark a chapter break with restrained hierarchy.', family:'title', variant:'chapter', eyebrow:'CHAPTER 3', title:'Build the system', subtitle:'', value:'', items:[] },
  { id:'sanverse.definition-title', name:'Definition Title', purpose:'Introduce a term and its compact definition.', family:'title', variant:'definition', eyebrow:'DEFINITION', title:'Compounding content', subtitle:'One reusable knowledge base feeding many platform-specific outputs.', value:'', items:[] },
  { id:'sanverse.stat-title', name:'Stat Title', purpose:'Lead with one statistic and explain its meaning.', family:'title', variant:'stat', eyebrow:'THE NUMBER', title:'10× faster', subtitle:'Without multiplying editing hours.', value:'', items:[] },
  { id:'sanverse.label-title', name:'Label Title', purpose:'Pair a small categorical label with a concise heading.', family:'title', variant:'label', eyebrow:'SYSTEM', title:'One source of truth', subtitle:'', value:'', items:[] },
  { id:'sanverse.highlight-title', name:'Highlight Title', purpose:'Underline one short takeaway with a bold accent sweep.', family:'title', variant:'highlight', eyebrow:'KEY TAKEAWAY', title:'Consistency wins', subtitle:'Only after the format is repeatable.', value:'', items:[] },
  // Value / comparison — 7 additions + Cost/Value = 8.
  { id:'sanverse.single-metric', name:'Single Metric', purpose:'Present one large metric with context.', family:'value', variant:'single-metric', eyebrow:'OUTPUT', title:'Videos published', subtitle:'This month across all channels.', value:'48', items:['+18 vs last month'] },
  { id:'sanverse.metric-delta', name:'Metric Delta', purpose:'Show a metric and the direction of change.', family:'value', variant:'metric-delta', eyebrow:'REPLY RATE', title:'Qualified replies', subtitle:'After the ICP filter changed.', value:'+42%', items:['Baseline 11%'] },
  { id:'sanverse.before-after', name:'Before / After', purpose:'Compare a visible before state with an improved outcome.', family:'value', variant:'before-after', eyebrow:'BEFORE → AFTER', title:'Editing time per video', subtitle:'Same output quality, less repetitive work.', value:'45 min', items:['4 hours','Saved 3h 15m'] },
  { id:'sanverse.ratio-card', name:'Ratio Card', purpose:'Explain a ratio or conversion relationship.', family:'value', variant:'ratio', eyebrow:'LEVERAGE', title:'Content multiplier', subtitle:'One recording session to many outputs.', value:'1 : 12', items:['Long-form','Shorts','LinkedIn'] },
  { id:'sanverse.score-card', name:'Score Card', purpose:'Show one bounded score with supporting dimensions.', family:'value', variant:'score', eyebrow:'VIDEO SCORE', title:'Overall execution', subtitle:'Topic + title + thumbnail + script.', value:'8.7 / 10', items:['Hook 9.2','Editing 8.4','Delivery 8.5'] },
  { id:'sanverse.stat-stack', name:'Stat Stack', purpose:'Stack several compact numbers under one claim.', family:'value', variant:'stat-stack', eyebrow:'THIS WEEK', title:'System output', subtitle:'Everything from one knowledge base.', value:'31 assets', items:['4 videos','15 shorts','12 posts'] },
  { id:'sanverse.price-breakdown', name:'Price Breakdown', purpose:'Break a price or package into visible value components.', family:'value', variant:'price-breakdown', eyebrow:'PACKAGE', title:'Growth system', subtitle:'What the monthly investment contains.', value:'$2.4K', items:['Research','Creation','Iteration','Reporting'] },
  // Lists / cards / steps — 7 additions + Checklist = 8.
  { id:'sanverse.bullet-list', name:'Bullet List', purpose:'Present a concise unordered list.', family:'list', variant:'bullets', eyebrow:'WHAT MATTERS', title:'Three growth levers', subtitle:'Keep the viewer focused on the decision.', value:'', items:['Better topic selection','Stronger packaging','Faster iteration'] },
  { id:'sanverse.numbered-list', name:'Numbered List', purpose:'Present a ranked or ordered list.', family:'list', variant:'numbered', eyebrow:'TOP 4', title:'Highest-leverage changes', subtitle:'Do these in order.', value:'', items:['Fix the hook','Clarify the promise','Cut dead time','Strengthen the CTA'] },
  { id:'sanverse.step-list', name:'Step List', purpose:'Explain a short sequential process.', family:'list', variant:'steps', eyebrow:'PROCESS', title:'From signal to published post', subtitle:'A repeatable operating loop.', value:'', items:['Research signal','Draft angle','Create asset','Publish and learn'] },
  { id:'sanverse.pros-cons', name:'Pros / Cons', purpose:'Show balanced positives and tradeoffs in one card.', family:'list', variant:'pros-cons', eyebrow:'TRADEOFF', title:'Automating the workflow', subtitle:'Useful only when the process is understood.', value:'', items:['+ Faster output','− Setup time','+ Consistent format','− Needs review'] },
  { id:'sanverse.agenda-card', name:'Agenda Card', purpose:'Preview the sections of an explainer or presentation.', family:'list', variant:'agenda', eyebrow:'TODAY', title:'What we will cover', subtitle:'Three questions, one answer.', value:'', items:['Why this matters','How it works','What to do next'] },
  { id:'sanverse.tag-cloud', name:'Tag Cloud', purpose:'Show a compact cluster of themes, skills or categories.', family:'list', variant:'tag-cloud', eyebrow:'SIGNALS', title:'What the system watches', subtitle:'', value:'', items:['Hooks','Topics','Retention','Packaging','Comments','Conversions'] },
  { id:'sanverse.feature-stack', name:'Feature Stack', purpose:'Stack product or system capabilities with concise labels.', family:'list', variant:'feature-stack', eyebrow:'PLATFORM', title:'Everything in one operating system', subtitle:'', value:'', items:['Research engine','Content creation','Approval loop','Performance learning'] },
  // Status / urgency — 5 additions + Timer = 6.
  { id:'sanverse.urgency-banner', name:'Urgency Banner', purpose:'Call attention to a deadline or high-priority condition.', family:'status', variant:'urgency', eyebrow:'DEADLINE', title:'24 hours left', subtitle:'The registration window closes tomorrow.', value:'ACT NOW', items:[] },
  { id:'sanverse.progress-status', name:'Progress Status', purpose:'Show completion status with a bounded progress bar.', family:'status', variant:'progress', eyebrow:'BUILD STATUS', title:'Motion library', subtitle:'Five proof components are complete.', value:'68%', items:[] },
  { id:'sanverse.notification-card', name:'Notification Card', purpose:'Surface one important system notification.', family:'status', variant:'notification', eyebrow:'NEW SIGNAL', title:'Topic crossed the outlier threshold', subtitle:'Review the source before the next batch.', value:'REVIEW', items:[] },
  { id:'sanverse.milestone-status', name:'Milestone Status', purpose:'Mark a completed or upcoming project milestone.', family:'status', variant:'milestone', eyebrow:'MILESTONE', title:'Proof gate passed', subtitle:'Ready for horizontal expansion.', value:'COMPLETE', items:[] },
  { id:'sanverse.live-status', name:'Live Status', purpose:'Display a compact live/on-air system state.', family:'status', variant:'live', eyebrow:'LIVE', title:'Research agent running', subtitle:'Collecting new platform signals.', value:'ONLINE', items:[] },
  // Diagrams / process — 5 additions + Team/Network = 6.
  { id:'sanverse.process-flow', name:'Process Flow', purpose:'Show a short left-to-right or stacked process.', family:'diagram', variant:'process', eyebrow:'WORKFLOW', title:'Signal to output', subtitle:'Each stage hands deterministic context to the next.', value:'', items:['Research','Plan','Create','Publish'] },
  { id:'sanverse.funnel-diagram', name:'Funnel Diagram', purpose:'Show narrowing stages in a funnel.', family:'diagram', variant:'funnel', eyebrow:'FUNNEL', title:'From audience to buyer', subtitle:'', value:'', items:['Reach','Attention','Trust','Action'] },
  { id:'sanverse.hierarchy-diagram', name:'Hierarchy Diagram', purpose:'Show a compact hierarchy of layers or responsibilities.', family:'diagram', variant:'hierarchy', eyebrow:'SYSTEM', title:'Knowledge hierarchy', subtitle:'', value:'', items:['Global knowledge','Platform playbook','Format rules','Final asset'] },
  { id:'sanverse.flywheel-diagram', name:'Flywheel Diagram', purpose:'Show a repeating compounding loop.', family:'diagram', variant:'flywheel', eyebrow:'FLYWHEEL', title:'Publish → learn → improve', subtitle:'Every cycle feeds the next.', value:'', items:['Research','Create','Publish','Measure','Iterate'] },
  { id:'sanverse.sequence-diagram', name:'Sequence Diagram', purpose:'Show a deterministic ordered handoff between actors.', family:'diagram', variant:'sequence', eyebrow:'HANDOFF', title:'Creator system sequence', subtitle:'', value:'', items:['Input','Research agent','Creation agent','Human review','Distribution'] },
  // MOTION-A19 — hierarchy-heavy explainer pack. These use custom nested graph scenes behind the same Family editing shell.
  ...A19_HIERARCHY_CONFIGS,
  // Quote / testimonial / proof — 4.
  { id:'sanverse.quote-card', name:'Quote Card', purpose:'Present one attributed quote with strong typography.', family:'quote', variant:'quote', eyebrow:'QUOTE', title:'The system should remove repeated work, not human judgment.', subtitle:'', value:'— Operating principle', items:[] },
  { id:'sanverse.testimonial-card', name:'Testimonial Card', purpose:'Present a customer testimonial with attribution.', family:'quote', variant:'testimonial', eyebrow:'CUSTOMER', title:'We finally know what to publish every week.', subtitle:'The process is clearer and the team moves faster.', value:'— Client feedback', items:[] },
  { id:'sanverse.review-card', name:'Review Card', purpose:'Present a compact review or recommendation.', family:'quote', variant:'review', eyebrow:'REVIEW', title:'Clear, useful, and surprisingly easy to run.', subtitle:'★★★★★', value:'Verified user', items:[] },
  { id:'sanverse.proof-stat-card', name:'Proof Stat Card', purpose:'Combine a proof statement with one supporting statistic.', family:'quote', variant:'proof-stat', eyebrow:'PROOF', title:'The workflow shipped consistently for four straight weeks.', subtitle:'No missed publishing days.', value:'28 / 28', items:[] },
  // CTA / transition / promo — 6.
  { id:'sanverse.subscribe-cta', name:'Subscribe CTA', purpose:'Ask viewers to subscribe with one clear reason.', family:'cta', variant:'subscribe', eyebrow:'NEXT STEP', title:'Build the system with me', subtitle:'Weekly breakdowns of AI, content and business systems.', value:'SUBSCRIBE', items:[] },
  { id:'sanverse.follow-cta', name:'Follow CTA', purpose:'Ask viewers to follow on a platform with a concise promise.', family:'cta', variant:'follow', eyebrow:'MORE SIGNALS', title:'Follow for the operating notes', subtitle:'Short lessons between long-form videos.', value:'FOLLOW', items:[] },
  { id:'sanverse.next-video-cta', name:'Next Video CTA', purpose:'Bridge directly into a recommended next video.', family:'cta', variant:'next-video', eyebrow:'WATCH NEXT', title:'Now see how the research engine works', subtitle:'The next piece explains the signal layer.', value:'NEXT VIDEO →', items:[] },
  { id:'sanverse.promo-card', name:'Promo Card', purpose:'Promote a product, newsletter or resource without a full-screen ad.', family:'cta', variant:'promo', eyebrow:'FREE RESOURCE', title:'The creator operating system', subtitle:'Templates, workflows and weekly updates.', value:'GET IT FREE', items:['No spam','Actionable only'] },
  { id:'sanverse.chapter-break', name:'Chapter Break', purpose:'Create a clean transition between major sections.', family:'cta', variant:'chapter-break', eyebrow:'UP NEXT', title:'From architecture to execution', subtitle:'', value:'', items:[] },
  { id:'sanverse.end-card', name:'End Card', purpose:'Close a video with one next action and supporting destinations.', family:'cta', variant:'end-card', eyebrow:'THANKS FOR WATCHING', title:'Keep building', subtitle:'One next video. One useful resource.', value:'WATCH NEXT', items:['Newsletter','Community'] },
  // Plan A continuation — 12 uncovered creator/social/editorial/software scenarios.
  { id:'sanverse.comment-highlight', name:'Comment Highlight', purpose:'Highlight one social comment with author context and lightweight reaction proof.', family:'quote', variant:'comment', eyebrow:'COMMENT', title:'This is the first workflow that actually made our publishing week feel simple.', subtitle:'@creator_ops · 2h', value:'♥ 1.2K', items:['Pinned by creator','Reply'] },
  { id:'sanverse.client-proof-strip', name:'Client Proof Strip', purpose:'Show a compact row of client or team names as social proof without copying proprietary logo artwork.', family:'quote', variant:'client-strip', eyebrow:'TRUSTED BY', title:'Teams building repeatable content systems', subtitle:'Original text marks only — no imported commercial logos.', value:'5 TEAMS', items:['Northstar','Flowline','Orbit','Atlas','Signal'] },
  { id:'sanverse.social-proof-stack', name:'Social Proof Stack', purpose:'Combine several distinct social proof signals in one concise hierarchy.', family:'quote', variant:'social-proof', eyebrow:'SOCIAL PROOF', title:'Creators are shipping more consistently', subtitle:'Different proof types reinforce the same claim.', value:'12.4K followers', items:['4.9★ average rating','28-day publish streak','+42% qualified replies'] },
  { id:'sanverse.myth-fact', name:'Myth vs Fact', purpose:'Correct a common belief with an explicit myth-versus-fact comparison.', family:'value', variant:'myth-fact', eyebrow:'MYTH → FACT', title:'Automation removes human judgment', subtitle:'Good systems remove repeated work while protecting the decisions that matter.', value:'FACT', items:['MYTH · More automation means less human input','FACT · Better automation protects human judgment'] },
  { id:'sanverse.problem-solution', name:'Problem → Solution', purpose:'Move from a concrete pain to a clear resolution in one comparison graphic.', family:'value', variant:'problem-solution', eyebrow:'PROBLEM → SOLUTION', title:'Content takes too long to repeat', subtitle:'Keep the judgment. Remove the repeated setup.', value:'45 min', items:['PROBLEM · 4h manual setup','SOLUTION · 45m guided workflow'] },
  { id:'sanverse.source-citation', name:'Source / Citation Card', purpose:'Attribute a claim to a source with publisher, date and reference detail.', family:'quote', variant:'citation', eyebrow:'SOURCE', title:'The state of AI-enabled work', subtitle:'McKinsey & Company · 2026', value:'mckinsey.com/featured-insights', items:['Referenced in section 3'] },
  { id:'sanverse.browser-demo', name:'Browser Demo', purpose:'Frame a software or website explanation inside an original browser-window graphic.', family:'list', variant:'browser', eyebrow:'BROWSER DEMO', title:'Research workspace', subtitle:'app.sanverse.ai/research', value:'', items:['Outlier topics','Saved sources','Publish queue'] },
  { id:'sanverse.chat-thread', name:'Chat Thread', purpose:'Show a short deterministic conversation between a creator and an assistant or teammate.', family:'list', variant:'chat', eyebrow:'REVIEW THREAD', title:'Creator + AI', subtitle:'Editing plan discussion', value:'', items:['YOU · Make the hook sharper','AI · Tightened the first 8 seconds','YOU · Keep the proof line'] },
  { id:'sanverse.dashboard-snapshot', name:'Dashboard Snapshot', purpose:'Show one primary software metric with several supporting dashboard KPIs.', family:'value', variant:'dashboard', eyebrow:'DASHBOARD', title:'Channel growth', subtitle:'Qualified views this month', value:'+42%', items:['Views · 128K','CTR · 7.8%','Watch · 6:14'] },
  { id:'sanverse.search-results', name:'Search Results', purpose:'Show a query with a concise ranked set of software or web search results.', family:'list', variant:'search', eyebrow:'SEARCH', title:'AI workflow automation', subtitle:'3 relevant results', value:'', items:['Best AI workflow tools for creator teams','How creators automate research without losing judgment','Case study · 4× weekly output'] },
  { id:'sanverse.upload-status', name:'Upload Status', purpose:'Show file upload progress with filename, transfer state and supporting detail.', family:'status', variant:'upload', eyebrow:'UPLOAD', title:'Episode 12.mp4', subtitle:'Uploading master file · 1.8 GB of 2.5 GB', value:'72%', items:['Encoding starts automatically after upload'] },
  { id:'sanverse.cursor-callout', name:'Cursor Callout', purpose:'Point to one software UI target with a labeled cursor-style emphasis.', family:'status', variant:'cursor', eyebrow:'CLICK HERE', title:'Choose the winning format', subtitle:'This row drove the highest retention in the current batch.', value:'OUTLIER 8.9', items:['Highest 30-second retention'] },
  // MOTION-A20 — premium product-storytelling pack. Six new semantic jobs; headline/lower-third/browser/PIP ideas reuse existing capabilities.
  { id:'sanverse.conversation-toast-stack', name:'Floating Conversation Toast Stack', purpose:'Stage several lightweight conversation notifications as a sequential product-story hook.', family:'list', variant:'conversation-toast-stack', eyebrow:'INBOX', title:'The workflow changed in one message', subtitle:'Conversation notifications stack without becoming a full chat thread.', value:'', items:['Maya · Can the agent review launch notes?','System · Access granted to Product Space','Agent · Drafting the release summary'], defaultPlacement:'top-right', defaultSafeOffset:72, minDurationSeconds:1.5, defaultDurationSeconds:4.5, maxDurationSeconds:12, events:[{name:'message-1',normalizedTime:.12},{name:'message-2',normalizedTime:.28},{name:'message-3',normalizedTime:.44},{name:'settled',normalizedTime:.68},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.floating-prompt-composer', name:'Floating Prompt Composer', purpose:'Show a focused AI/product prompt composer with context chips and a clear send action.', family:'list', variant:'floating-prompt-composer', eyebrow:'ASK THE WORKSPACE', title:'Summarize the launch feedback and draft three reply options.', subtitle:'Uses only the selected project context.', value:'SEND', items:['Launch notes','Customer feedback','Roadmap'], defaultPlacement:'center-right', defaultSafeOffset:72, minDurationSeconds:1.5, defaultDurationSeconds:5, maxDurationSeconds:12, events:[{name:'composer-open',normalizedTime:.08},{name:'type-reveal',normalizedTime:.18},{name:'context-chip-1',normalizedTime:.32},{name:'context-chip-2',normalizedTime:.42},{name:'send-ready',normalizedTime:.58},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.product-ui-story-scene', name:'Product UI Story Scene', purpose:'Tell a software workflow as a structured evolving application scene instead of a static screenshot.', family:'list', variant:'product-ui-story', eyebrow:'PROJECT SPACE', title:'Launch review', subtitle:'The agent turns scattered feedback into an actionable brief.', value:'SYNCED', items:['Overview','Sources','Reading 12 feedback notes','Grouping repeated requests','Draft brief ready'], defaultPlacement:'center', defaultSafeOffset:64, minDurationSeconds:1.5, defaultDurationSeconds:7, maxDurationSeconds:12, events:[{name:'window-open',normalizedTime:.06},{name:'source-focus',normalizedTime:.20},{name:'ui-content-append',normalizedTime:.34},{name:'scroll-to-focus',normalizedTime:.50},{name:'workflow-ready',normalizedTime:.70},{name:'exit-start',normalizedTime:.94}] },
  { id:'sanverse.agent-work-log', name:'Agent Work Log', purpose:'Combine agent messages, tasks, statuses and completion into one compact progress story.', family:'list', variant:'agent-work-log', eyebrow:'AGENT WORK LOG', title:'Preparing launch brief', subtitle:'Each row is an addressable step, not fake terminal output.', value:'COMPLETE', items:['01 · Reading source notes · done','02 · Extracting requests · done','03 · Checking conflicts · done','04 · Drafting summary · done'], defaultPlacement:'center-left', defaultSafeOffset:72, minDurationSeconds:1.5, defaultDurationSeconds:6, maxDurationSeconds:12, events:[{name:'agent-working',normalizedTime:.10},{name:'task-1',normalizedTime:.22},{name:'task-2',normalizedTime:.34},{name:'task-3',normalizedTime:.46},{name:'agent-complete',normalizedTime:.68},{name:'exit-start',normalizedTime:.94}] },
  { id:'sanverse.scoped-access-comparison', name:'Scoped Access Comparison', purpose:'Compare two permission or knowledge contexts and make their boundaries visually explicit.', family:'value', variant:'scoped-access', eyebrow:'SCOPED ACCESS', title:'Same agent. Different context.', subtitle:'Each workspace exposes only what that team has approved.', value:'BOUNDARIES PRESERVED', items:['LEGAL · contracts + policy + approvals','ENGINEERING · code + issues + technical docs'], defaultPlacement:'center', defaultSafeOffset:72, minDurationSeconds:1.5, defaultDurationSeconds:5.5, maxDurationSeconds:12, events:[{name:'left-context',normalizedTime:.14},{name:'right-context',normalizedTime:.34},{name:'boundary-emphasis',normalizedTime:.52},{name:'comparison-ready',normalizedTime:.68},{name:'exit-start',normalizedTime:.94}] },
  { id:'sanverse.keyword-brand-lockup', name:'Keyword-to-Brand Lockup', purpose:'Resolve a final semantic keyword into an original brand/product lockup for a clean outro.', family:'cta', variant:'keyword-brand-lockup', eyebrow:'THE RESULT', title:'One trusted workspace becomes', subtitle:'Original fixture identity · no copied commercial branding.', value:'NORTHSTAR', items:[], defaultPlacement:'center', defaultSafeOffset:72, minDurationSeconds:1.5, defaultDurationSeconds:4, maxDurationSeconds:12, events:[{name:'keyword',normalizedTime:.12},{name:'lockup-build',normalizedTime:.34},{name:'brand-lockup',normalizedTime:.58},{name:'settled',normalizedTime:.72},{name:'exit-start',normalizedTime:.94}] },
  // MOTION-A18 — keyframe-native short-form creator pack. Existing pre-A18 components stay on their established motion paths.
  { id:'sanverse.keyword-slam', name:'Keyword Slam', purpose:'Isolate one decisive keyword as the temporal payoff to a short setup line.', family:'title', variant:'keyword-slam', eyebrow:'THE LEVER', title:'The format lives or dies on', subtitle:'One word carries the promise.', value:'RETENTION', items:[], minDurationSeconds:.75, defaultDurationSeconds:2, maxDurationSeconds:8, events:[{name:'setup',normalizedTime:.10},{name:'keyword-slam',normalizedTime:.28},{name:'settled',normalizedTime:.56},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.three-beat-headline', name:'Three-Beat Headline', purpose:'Deliver a hook as three explicit sequential beats with a final payoff.', family:'title', variant:'three-beat', eyebrow:'3-BEAT HOOK', title:'Three beats. One promise.', subtitle:'Each beat advances the viewer instead of repeating the same headline.', value:'THEN PROVE IT', items:['STOP THE SCROLL','OPEN A LOOP','PAY IT OFF'], minDurationSeconds:.75, defaultDurationSeconds:2, maxDurationSeconds:8, events:[{name:'beat-1',normalizedTime:.18},{name:'beat-2',normalizedTime:.29},{name:'beat-3',normalizedTime:.40},{name:'settled',normalizedTime:.62},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.stacked-hook', name:'Stacked Hook', purpose:'Build a short-form hook from three stacked escalating lines rather than one flat headline.', family:'title', variant:'stacked-hook', eyebrow:'STACKED HOOK', title:'You do not need more content.', subtitle:'You need a format people finish.', value:'Then repeat the winner.', items:[], minDurationSeconds:.75, defaultDurationSeconds:2, maxDurationSeconds:8, events:[{name:'line-1',normalizedTime:.10},{name:'line-2',normalizedTime:.22},{name:'line-3',normalizedTime:.34},{name:'settled',normalizedTime:.58},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.sentence-deconstruction', name:'Sentence Deconstruction', purpose:'Break one claim into semantic fragments so an explainer can inspect the sentence piece by piece.', family:'title', variant:'sentence-deconstruction', eyebrow:'BREAK IT DOWN', title:'Consistency is a system problem', subtitle:'The fragments reveal what the sentence actually claims.', value:'', items:['CONSISTENCY','IS A','SYSTEM','PROBLEM'], minDurationSeconds:.75, defaultDurationSeconds:2.4, maxDurationSeconds:8, events:[{name:'claim',normalizedTime:.10},{name:'fragment-1',normalizedTime:.18},{name:'fragment-2',normalizedTime:.29},{name:'fragment-3',normalizedTime:.40},{name:'settled',normalizedTime:.64},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.punch-word-reveal', name:'Punch Word Reveal', purpose:'Reveal one punch word as a separate full-strength beat after a readable setup sentence.', family:'title', variant:'punch-word', eyebrow:'PUNCH WORD', title:'The part everyone skips is', subtitle:'That is where the decision happens.', value:'PACKAGING', items:[], minDurationSeconds:.75, defaultDurationSeconds:1.8, maxDurationSeconds:8, events:[{name:'setup',normalizedTime:.10},{name:'punch-word',normalizedTime:.28},{name:'settled',normalizedTime:.55},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.poll-vote-result', name:'Poll / Vote Result', purpose:'Show a question with ranked vote percentages and a visually dominant winning option.', family:'value', variant:'poll-result', eyebrow:'POLL RESULT', title:'Which hook would you click?', subtitle:'Audience vote · 1,284 responses', value:'WINNER · OPTION A', items:['A · 62%','B · 24%','C · 14%'], minDurationSeconds:.75, defaultDurationSeconds:2.2, maxDurationSeconds:8, events:[{name:'question',normalizedTime:.08},{name:'option-1',normalizedTime:.18},{name:'option-2',normalizedTime:.29},{name:'option-3',normalizedTime:.40},{name:'winner',normalizedTime:.52},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.ranking-podium', name:'Ranking Podium', purpose:'Show a top-three result with explicit first/second/third hierarchy rather than a generic ordered list.', family:'list', variant:'ranking-podium', eyebrow:'TOP 3', title:'What moved retention most', subtitle:'Ranked from the current batch.', value:'WINNER · HOOK', items:['#1 Hook','#2 Title','#3 Thumbnail'], minDurationSeconds:.75, defaultDurationSeconds:2.2, maxDurationSeconds:8, events:[{name:'rank-3',normalizedTime:.18},{name:'rank-2',normalizedTime:.29},{name:'rank-1',normalizedTime:.40},{name:'winner',normalizedTime:.52},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.app-feature-spotlight', name:'App Feature Spotlight', purpose:'Focus attention on one software capability with supporting product details, distinct from a whole browser demo.', family:'list', variant:'app-feature', eyebrow:'FEATURE SPOTLIGHT', title:'Outlier Topic Radar', subtitle:'One focused feature, not the whole dashboard.', value:'LIVE SIGNALS', items:['Cross-channel outliers','Saved evidence','Reusable topic score'], minDurationSeconds:.75, defaultDurationSeconds:2.4, maxDurationSeconds:8, events:[{name:'feature-icon',normalizedTime:.08},{name:'feature-name',normalizedTime:.18},{name:'detail-1',normalizedTime:.29},{name:'detail-2',normalizedTime:.40},{name:'settled',normalizedTime:.62},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.keyboard-shortcut-callout', name:'Keyboard Shortcut Callout', purpose:'Teach one software keyboard shortcut with explicit keycaps and action label.', family:'status', variant:'keyboard-shortcut', eyebrow:'SHORTCUT', title:'Open Command Search', subtitle:'Keep the tutorial moving without a full browser recreation.', value:'SEARCH COMMANDS', items:['CTRL','K'], minDurationSeconds:.75, defaultDurationSeconds:1.8, maxDurationSeconds:8, events:[{name:'action',normalizedTime:.10},{name:'key-1',normalizedTime:.22},{name:'key-2',normalizedTime:.33},{name:'settled',normalizedTime:.55},{name:'exit-start',normalizedTime:.92}] },
  // MOTION-A21 — creator utility + advanced visual explanation gaps after the full 83-component audit.
  { id:'sanverse.trend-line-chart', name:'Trend Line Chart', purpose:'Explain a numeric trend across ordered time/category points with a real connected line rather than a dashboard KPI snapshot.', family:'value', variant:'trend-line-chart', eyebrow:'TREND', title:'Retention climbed after the hook changed', subtitle:'Ordered measurements make direction and acceleration visible.', value:'+26%', items:['Week 1 · 42','Week 2 · 49','Week 3 · 58','Week 4 · 68'], minDurationSeconds:1, defaultDurationSeconds:3.2, maxDurationSeconds:10, events:[{name:'axis-ready',normalizedTime:.08},{name:'point-1',normalizedTime:.18},{name:'point-2',normalizedTime:.30},{name:'point-3',normalizedTime:.42},{name:'trend-revealed',normalizedTime:.58},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.donut-breakdown', name:'Donut Breakdown', purpose:'Show part-to-whole composition with a compact donut and explicit legend values.', family:'value', variant:'donut-breakdown', eyebrow:'BREAKDOWN', title:'Where the editing time goes', subtitle:'The whole is visible at once; each slice remains addressable.', value:'100%', items:['Story · 38','Motion · 27','B-roll · 21','Polish · 14'], minDurationSeconds:1, defaultDurationSeconds:3.2, maxDurationSeconds:10, events:[{name:'ring-build',normalizedTime:.10},{name:'slice-1',normalizedTime:.20},{name:'slice-2',normalizedTime:.32},{name:'slice-3',normalizedTime:.44},{name:'breakdown-ready',normalizedTime:.58},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.venn-intersection', name:'Venn Intersection', purpose:'Explain the useful overlap between two sets or ideas instead of merely comparing them side by side.', family:'diagram', variant:'venn-intersection', eyebrow:'THE OVERLAP', title:'Where creator leverage actually lives', subtitle:'Two strengths become one operating advantage.', value:'LEVERAGE', items:['Human judgment','Automation','Repeatable system'], minDurationSeconds:1, defaultDurationSeconds:3, maxDurationSeconds:10, events:[{name:'set-left',normalizedTime:.12},{name:'set-right',normalizedTime:.26},{name:'intersection',normalizedTime:.44},{name:'takeaway',normalizedTime:.58},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.feature-comparison-table', name:'Feature Comparison Table', purpose:'Compare several options against the same criteria in a compact structured table.', family:'list', variant:'feature-comparison-table', eyebrow:'SIDE BY SIDE', title:'Manual workflow vs creator system', subtitle:'The same criteria stay aligned row by row.', value:'SYSTEM WINS', items:['Research · 90 min · 15 min','Packaging · manual · assisted','Editing · 4 hr · 45 min','Learning loop · ad hoc · tracked'], minDurationSeconds:1, defaultDurationSeconds:3.4, maxDurationSeconds:10, events:[{name:'headers',normalizedTime:.08},{name:'row-1',normalizedTime:.18},{name:'row-2',normalizedTime:.30},{name:'row-3',normalizedTime:.42},{name:'comparison-ready',normalizedTime:.58},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.code-diff-spotlight', name:'Code Diff Spotlight', purpose:'Show a small before/after code change with added and removed lines as the explanation itself.', family:'list', variant:'code-diff-spotlight', eyebrow:'CODE DIFF', title:'One state source replaces two', subtitle:'selection.ts', value:'+2 −1', items:['- const localSelection = createSelection()','+ const selection = sharedSelection','+ publish only when stable IDs change'], minDurationSeconds:1, defaultDurationSeconds:3, maxDurationSeconds:10, events:[{name:'file-name',normalizedTime:.08},{name:'removed-line',normalizedTime:.20},{name:'added-line-1',normalizedTime:.32},{name:'added-line-2',normalizedTime:.44},{name:'diff-ready',normalizedTime:.58},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.terminal-command-story', name:'Terminal Command Story', purpose:'Teach one real command and its bounded output/result without pretending an agent work log is a terminal.', family:'list', variant:'terminal-command-story', eyebrow:'TERMINAL', title:'npm run test --workspace=@sanverse/motion-graph', subtitle:'sanverse-dev', value:'exit 0', items:['RUN  v3.2.7','10 files passed','131 tests passed','Done in 4.05s'], minDurationSeconds:1, defaultDurationSeconds:3, maxDurationSeconds:10, events:[{name:'prompt',normalizedTime:.08},{name:'command',normalizedTime:.18},{name:'output-1',normalizedTime:.30},{name:'output-2',normalizedTime:.42},{name:'success',normalizedTime:.58},{name:'exit-start',normalizedTime:.92}] },
] satisfies readonly FamilyVariantConfig[])

export const FAMILY_VARIANT_CONFIGS = configs
export const FAMILY_COMPONENT_MODULES = Object.freeze(configs.map((config) => createFamilyComponent(config)))
export const FAMILY_COMPONENT_DEFINITIONS = Object.freeze(FAMILY_COMPONENT_MODULES.map((module) => module.definition))
export const FAMILY_COMPONENT_MODULES_BY_ID = Object.freeze(Object.fromEntries(FAMILY_COMPONENT_MODULES.map((module) => [module.definition.id, module])) as Readonly<Record<string, MotionGraphBackedComponentModuleV1<FamilyComponentProps, FamilyComponentStyle>>>)
