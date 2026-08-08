import type { CSSProperties } from 'react'
import type { MotionComponentDefinitionV1, MotionComponentRenderPropsV1, MotionRenderContextV1, MotionStylePackV1, MotionValidationResultV1 } from '@sanverse/motion-contract'
import type { MotionExposureV1, MotionGraphBackedComponentModuleV1, MotionSceneV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND, easeInCubic, easeOutCubic, normalizedProgress, sequenceProgress, staggerProgress } from '@sanverse/motion-primitives'
import { mergeMotionGraphNodeStyle, useMotionGraphPresentation } from '@sanverse/motion-native-runtime'
import { FULL_NATIVE_GRAPH_CAPABILITIES, graphGroup, graphShape, graphText, responsiveGraphLayout } from '../graph-common.ts'
import { mConst, mEase, mMultiply, mNumber, mOneMinus, mProgress, mReduced, mSequence, mStagger } from '../graph-motion.ts'
import { SANVERSE_CLEAN_STYLE } from '../style-packs.ts'
import { isRecord, unknownFieldIssues, validationFailure, validationSuccess, valueIssue } from '../validation.ts'

export type FamilyKind = 'title' | 'value' | 'list' | 'status' | 'diagram' | 'quote' | 'cta'

export interface FamilyComponentProps {
  readonly eyebrow: string
  readonly title: string
  readonly subtitle: string
  readonly value: string
  readonly items: readonly string[]
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
  const issues = [...unknownFieldIssues(input, ['eyebrow', 'title', 'subtitle', 'value', 'items'])]
  if (!bounded(input.eyebrow, 0, 32)) issues.push(valueIssue('$.eyebrow', 'VALUE_INVALID', 'eyebrow is limited to 32 characters.'))
  if (!bounded(input.title, 1, 96)) issues.push(valueIssue('$.title', 'VALUE_INVALID', 'title must contain 1–96 characters.'))
  if (!bounded(input.subtitle, 0, 140)) issues.push(valueIssue('$.subtitle', 'VALUE_INVALID', 'subtitle is limited to 140 characters.'))
  if (!bounded(input.value, 0, 48)) issues.push(valueIssue('$.value', 'VALUE_INVALID', 'value is limited to 48 characters.'))
  if (!Array.isArray(input.items) || input.items.length > 6 || input.items.some((item) => !bounded(item, 1, 72))) issues.push(valueIssue('$.items', 'VALUE_INVALID', 'items must contain 0–6 strings of 1–72 characters.'))
  if (issues.length > 0) return validationFailure(...issues)
  return validationSuccess(Object.freeze({ eyebrow: input.eyebrow as string, title: input.title as string, subtitle: input.subtitle as string, value: input.value as string, items: Object.freeze([...(input.items as string[])]) }))
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

export const createFamilyScene = (config: FamilyVariantConfig, props: FamilyComponentProps, style: FamilyComponentStyle, context: MotionRenderContextV1): MotionSceneV1 => {
  validateContext(context)
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
  const surface = graphShape({ id: surfaceId, name: 'Surface', parentId: rootId, width: Math.round(context.composition.width * 0.76), height: Math.round(context.composition.height * 0.56), fillColor: style.surfaceColor, strokeColor: `${style.accentColor}28`, strokeWidth: 2, radius: style.radius })
  const accent = graphShape({ id: accentId, name: 'Accent', parentId: rootId, width: Math.round(short * 0.16), height: Math.max(6, Math.round(short * 0.012)), fillColor: style.accentColor, strokeColor: 'transparent', strokeWidth: 0, radius: 999 })
  const contentBase = graphGroup(contentId, 'Content', rootId, [eyebrowId, titleId, subtitleId, valueId, itemsId])
  const reveal = mReduced(mConst(1), mEase('ease-out-cubic', mSequence(0.02, 0.30, mProgress())))
  const remain = mOneMinus(mEase('ease-in-cubic', mSequence(0.84, 1, mProgress())))
  const content = Object.freeze({ ...contentBase, opacity: mNumber(mMultiply(reveal, remain)), transform: Object.freeze({ ...contentBase.transform, positionY: mNumber(mReduced(mConst(0), mMultiply(mConst(26 * style.motionIntensity), mOneMinus(reveal)))) }) })
  const eyebrow = Object.freeze({ ...graphText({ id: eyebrowId, name: 'Eyebrow', parentId: contentId, text: props.eyebrow, color: style.accentColor, fontFamily: style.fontFamily, fontSize: Math.round(short * 0.025), fontWeight: 800 }), visible: constant(Boolean(props.eyebrow.trim())) })
  const title = graphText({ id: titleId, name: 'Title', parentId: contentId, text: props.title, color: style.textColor, fontFamily: style.fontFamily, fontSize: Math.round(short * 0.064), fontWeight: style.titleWeight })
  const subtitle = Object.freeze({ ...graphText({ id: subtitleId, name: 'Subtitle', parentId: contentId, text: props.subtitle, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: Math.round(short * 0.027), fontWeight: style.bodyWeight }), visible: constant(Boolean(props.subtitle.trim())) })
  const value = Object.freeze({ ...graphText({ id: valueId, name: 'Value', parentId: contentId, text: props.value, color: style.accentColor, fontFamily: style.fontFamily, fontSize: Math.round(short * 0.085), fontWeight: style.titleWeight }), visible: constant(Boolean(props.value.trim())) })
  const items = graphGroup(itemsId, 'Items', contentId, itemIds)
  const itemNodes = Object.fromEntries(props.items.map((item, index) => {
    const base = graphText({ id: itemIds[index]!, name: `Item ${index + 1}`, parentId: itemsId, text: item, color: style.textColor, fontFamily: style.fontFamily, fontSize: Math.round(short * 0.027), fontWeight: style.bodyWeight })
    const itemReveal = mReduced(mConst(1), mEase('ease-out-cubic', mStagger(mSequence(0.12, 0.54, mProgress()), index, Math.max(1, props.items.length), 0.55)))
    return [base.id, Object.freeze({ ...base, opacity: mNumber(mMultiply(itemReveal, remain)) })]
  }))
  const exposures: MotionExposureV1[] = [
    { id: `${prefix}.eyebrow`, label: 'Eyebrow', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'eyebrow' }, editor: { type: 'text' }, keyframeable: false },
    { id: `${prefix}.title`, label: 'Title', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'title' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: `${prefix}.subtitle`, label: 'Subtitle', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'subtitle' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: `${prefix}.value`, label: 'Value / CTA', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'value' }, editor: { type: 'text' }, keyframeable: false },
    { id: `${prefix}.items`, label: 'Items · one per line', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'items' }, editor: { type: 'textarea' }, keyframeable: false },
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

  if (config.family === 'title') {
    const isSplit = config.variant === 'split'
    const isQuestion = config.variant === 'question'
    const isLower = config.variant === 'lower-third'
    return <div style={{ display: 'grid', gap: isLower ? 12 : 18, maxWidth: isLower ? '72%' : '92%', marginLeft: isLower ? 0 : 'auto', marginRight: isLower ? 'auto' : 'auto', textAlign: isLower ? 'left' : 'center' }}>{eyebrow}{isQuestion ? <div style={{ color: style.accentColor, fontSize: 56, fontWeight: 900 }}>?</div> : null}<div style={isSplit ? { display: 'grid', gridTemplateColumns: state.layout === 'wide' ? '1fr auto 1fr' : '1fr', gap: 14, alignItems: 'center' } : undefined}>{title}{isSplit ? <span style={{ color: style.accentColor, fontSize: 42 }}>×</span> : null}{isSplit ? <div style={subtitleStyle}>{props.value || props.subtitle}</div> : null}</div>{!isSplit ? subtitle : null}<div data-motion-node-id={`${prefix}.accent`} style={graphStyle(`${prefix}.accent`, { width: config.variant === 'highlight' ? '60%' : 110, height: config.variant === 'underline' ? 8 : 5, borderRadius: 999, background: style.accentColor, margin: isLower ? '2px 0 0' : '2px auto 0' })} /></div>
  }
  if (config.family === 'value') {
    const compare = config.variant === 'before-after'
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
  const defaultProps: FamilyComponentProps = Object.freeze({ eyebrow: config.eyebrow, title: config.title, subtitle: config.subtitle, value: config.value, items: Object.freeze([...config.items]) })
  const definition: MotionComponentDefinitionV1 = Object.freeze({
    id: config.id, version: 1, name: config.name, purpose: config.purpose, category: categoryForFamily(config.family), performanceClass: config.family === 'diagram' || config.family === 'list' ? 'medium' : 'light',
    supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5'] as const),
    minDurationTicks: SANVERSE_TICKS_PER_SECOND, defaultDurationTicks: SANVERSE_TICKS_PER_SECOND * 4, maxDurationTicks: SANVERSE_TICKS_PER_SECOND * 16,
    events: Object.freeze([{ name: 'enter-start', normalizedTime: 0 }, { name: 'content-reveal', normalizedTime: 0.08 }, { name: 'settled', normalizedTime: 0.56 }, { name: 'exit-start', normalizedTime: 0.84 }]),
    contentLimits: Object.freeze([{ field: 'title', description: 'Primary visible title.', minimum: 1, maximum: 96, unit: 'characters' as const }, { field: 'items', description: 'Optional supporting items.', minimum: 0, maximum: 6, unit: 'items' as const }]),
    capabilities: FULL_NATIVE_GRAPH_CAPABILITIES,
  })
  const Component = ({ props, style, context }: MotionComponentRenderPropsV1<FamilyComponentProps, FamilyComponentStyle>) => {
    const state = evaluateFamilyComponentState(props, context)
    const graph = useMotionGraphPresentation()
    const graphStyle = (id: string, base: CSSProperties): CSSProperties => mergeMotionGraphNodeStyle(base, graph.scene?.nodes[id] ?? null, graph.selectedNodeId === id)
    const prefix = nodePrefix(config)
    const short = Math.min(context.composition.width, context.composition.height)
    const align = alignmentFor(config)
    const surface = graph.scene?.nodes[`${prefix}.surface`]
    const shape = surface?.type === 'shape' ? surface : null
    const graphBacked = Boolean(graph.scene)
    const localTransform = context.reducedMotion ? undefined : `translate3d(0, ${(1 - state.reveal) * 26 * style.motionIntensity}px, 0)`
    return <div data-motion-root="family-component" data-motion-family={config.family} data-motion-variant={config.variant} data-motion-module-id={config.id} data-motion-node-id={`${prefix}.root`} style={graphStyle(`${prefix}.root`, { position: 'absolute', inset: 0, display: 'grid', placeItems: config.variant === 'lower-third' ? 'end start' : 'center', padding: Math.round(short * 0.075), overflow: 'hidden', fontFamily: style.fontFamily })}>
      <section data-motion-node-id={`${prefix}.surface`} style={graphStyle(`${prefix}.surface`, { position: 'relative', width: state.layout === 'wide' ? '72%' : '86%', maxWidth: 1380, minHeight: config.family === 'title' ? '28%' : '42%', display: 'grid', alignContent: 'center', padding: config.variant === 'lower-third' ? Math.round(short * .045) : Math.round(short * .06), borderRadius: shape?.radius ?? style.radius, border: familySurfaceVisible(config.family, config.variant) ? `2px solid ${style.accentColor}22` : '0', background: familySurfaceVisible(config.family, config.variant) ? (shape?.fillColor ?? style.surfaceColor) : 'transparent', boxShadow: familySurfaceVisible(config.family, config.variant) ? '0 24px 70px rgba(0,0,0,.28)' : 'none' })}>
        <div data-motion-node-id={`${prefix}.content`} style={graphStyle(`${prefix}.content`, { opacity: graphBacked ? 1 : state.reveal, transform: graphBacked ? undefined : localTransform })}>
          {renderFamilyVisual(config, props, style, state, graphStyle, graph.scene)}
        </div>
      </section>
    </div>
  }
  return Object.freeze({ definition, defaultProps, defaultStyle: DEFAULT_FAMILY_STYLE, validateProps: validateFamilyComponentProps, validateStyle: validateFamilyComponentStyle, Component, createScene: (props: FamilyComponentProps, style: FamilyComponentStyle, context: MotionRenderContextV1) => createFamilyScene(config, props, style, context) })
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
] satisfies readonly FamilyVariantConfig[])

export const FAMILY_VARIANT_CONFIGS = configs
export const FAMILY_COMPONENT_MODULES = Object.freeze(configs.map((config) => createFamilyComponent(config)))
export const FAMILY_COMPONENT_DEFINITIONS = Object.freeze(FAMILY_COMPONENT_MODULES.map((module) => module.definition))
export const FAMILY_COMPONENT_MODULES_BY_ID = Object.freeze(Object.fromEntries(FAMILY_COMPONENT_MODULES.map((module) => [module.definition.id, module])) as Readonly<Record<string, MotionGraphBackedComponentModuleV1<FamilyComponentProps, FamilyComponentStyle>>>)
