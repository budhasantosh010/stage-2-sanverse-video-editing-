import type { CSSProperties } from 'react'
import type {
  MotionComponentRenderPropsV1,
  MotionRenderContextV1,
  MotionStylePackV1,
  MotionValidationResultV1,
} from '@sanverse/motion-contract'
import {
  SANVERSE_TICKS_PER_SECOND,
  easeInCubic,
  easeOutCubic,
  fitWordLines,
  formatCompactNumber,
  interpolateNumber,
  lerp,
  normalizedProgress,
  sequenceProgress,
  springProgress,
} from '@sanverse/motion-primitives'
import type { MotionExposureV1, MotionGraphBackedComponentModuleV1, MotionSceneV1, ResolvedMotionSceneV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene, motionString } from '@sanverse/motion-graph'
import { mergeMotionGraphNodeDecorationStyle, mergeMotionGraphNodeStyle, useMotionGraphPresentation } from '@sanverse/motion-native-runtime'
import { FULL_NATIVE_GRAPH_CAPABILITIES, graphGroup, graphShape, graphText, responsiveGraphLayout } from '../graph-common.ts'
import { mConst, mEase, mLerp, mMultiply, mNumber, mOneMinus, mProgress, mReduced, mSequence, mSpring, mSubtract } from '../graph-motion.ts'
import { SANVERSE_CLEAN_STYLE } from '../style-packs.ts'
import { isRecord, unknownFieldIssues, validationFailure, validationSuccess, valueIssue } from '../validation.ts'

export interface CostValueMetric {
  readonly label: string
  readonly value: number
  readonly prefix: string
  readonly suffix: string
  readonly note: string
}

export interface CostValueCardProps {
  readonly eyebrow: string
  readonly title: string
  readonly cost: CostValueMetric
  readonly value: CostValueMetric
  readonly footer: string
}

export interface CostValueCardStyle {
  readonly textColor: string
  readonly mutedColor: string
  readonly accentColor: string
  readonly costColor: string
  readonly surfaceColor: string
  readonly fontFamily: string
  readonly titleWeight: number
  readonly numberWeight: number
  readonly motionIntensity: number
}

interface TextPlan {
  readonly text: string
  readonly fontSize: number
  readonly minimumFontSize: number
  readonly lineHeight: number
  readonly lines: readonly Readonly<{
    readonly startWordIndex: number
    readonly endWordIndexExclusive: number
    readonly estimatedWidth: number
  }>[]
}

export interface CostValueCardLayout {
  readonly kind: 'horizontal' | 'stacked'
  readonly cardWidth: number
  readonly cardHeight: number
  readonly maxHeight: number
  readonly padding: number
  readonly contentWidth: number
  readonly metricWidth: number
  readonly metricInnerWidth: number
  readonly gap: number
  readonly title: TextPlan
  readonly costLabel: TextPlan
  readonly valueLabel: TextPlan
  readonly costNumber: TextPlan
  readonly valueNumber: TextPlan
  readonly noteFontSize: number
  readonly eyebrowFontSize: number
  readonly footerFontSize: number
}

export interface CostValueCardState {
  readonly normalizedProgress: number
  readonly phase: 'enter' | 'hold' | 'exit' | 'ended'
  readonly panelOpacity: number
  readonly titleOpacity: number
  readonly titleTranslateY: number
  readonly costOpacity: number
  readonly costTranslate: number
  readonly valueOpacity: number
  readonly valueTranslate: number
  readonly arrowOpacity: number
  readonly arrowScale: number
  readonly costCountProgress: number
  readonly valueCountProgress: number
  readonly displayedCostValue: number
  readonly displayedValueValue: number
  readonly layout: CostValueCardLayout
}

export const costValueCardStyleFromPack = (pack: MotionStylePackV1): CostValueCardStyle => ({
  textColor: pack.tokens.colors.text,
  mutedColor: pack.tokens.colors.textSecondary,
  accentColor: pack.tokens.colors.accent,
  costColor: pack.tokens.colors.danger,
  surfaceColor: pack.tokens.colors.surface,
  fontFamily: pack.tokens.typography.bodyFont,
  titleWeight: pack.tokens.typography.headingWeight,
  numberWeight: Math.min(900, pack.tokens.typography.headingWeight + 60),
  motionIntensity: pack.tokens.motion.intensity,
})

export const DEFAULT_COST_VALUE_CARD_PROPS: CostValueCardProps = Object.freeze({
  eyebrow: 'COST VS VALUE',
  title: 'What one month buys you',
  cost: Object.freeze({ label: 'Manual editing cost', value: 2_400, prefix: '$', suffix: '', note: 'Time + repetitive work' }),
  value: Object.freeze({ label: 'Workflow value created', value: 24_000, prefix: '$', suffix: '', note: 'More output from the same month' }),
  footer: '10× more value from the workflow',
})

export const DEFAULT_COST_VALUE_CARD_STYLE: CostValueCardStyle = Object.freeze(costValueCardStyleFromPack(SANVERSE_CLEAN_STYLE))

const propsFields = ['eyebrow', 'title', 'cost', 'value', 'footer'] as const
const metricFields = ['label', 'value', 'prefix', 'suffix', 'note'] as const
const styleFields = ['textColor', 'mutedColor', 'accentColor', 'costColor', 'surfaceColor', 'fontFamily', 'titleWeight', 'numberWeight', 'motionIntensity'] as const

const boundedStringIssue = (value: unknown, path: string, maximum: number, required = true) => {
  if (typeof value !== 'string') return valueIssue(path, 'TYPE_INVALID', `${path} must be a string.`)
  if (required && !value.trim()) return valueIssue(path, 'CONTENT_TOO_SMALL', `${path} cannot be empty.`)
  if (value.length > maximum) return valueIssue(path, 'CONTENT_TOO_LARGE', `${path} is limited to ${maximum} characters.`)
  return null
}

const validateMetric = (input: unknown, path: string): readonly ReturnType<typeof valueIssue>[] => {
  if (!isRecord(input)) return [valueIssue(path, 'TYPE_INVALID', 'Metric must be an object.')]
  const issues = unknownFieldIssues(input, metricFields).map((issue) => ({ ...issue, path: `${path}.${issue.path.slice(2)}` }))
  for (const issue of [
    boundedStringIssue(input.label, `${path}.label`, 48),
    boundedStringIssue(input.prefix, `${path}.prefix`, 4, false),
    boundedStringIssue(input.suffix, `${path}.suffix`, 12, false),
    boundedStringIssue(input.note, `${path}.note`, 64, false),
  ]) if (issue) issues.push(issue)
  if (typeof input.value !== 'number' || !Number.isFinite(input.value)) issues.push(valueIssue(`${path}.value`, 'TYPE_INVALID', 'Metric value must be finite.'))
  else if (input.value < 0 || input.value > 1_000_000_000_000) issues.push(valueIssue(`${path}.value`, 'VALUE_OUT_OF_RANGE', 'Metric value must be between 0 and 1 trillion.'))
  return issues
}

export const validateCostValueCardProps = (input: unknown): MotionValidationResultV1<CostValueCardProps> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Cost / Value Card props must be an object.'))
  const issues = [...unknownFieldIssues(input, propsFields)]
  for (const issue of [
    boundedStringIssue(input.eyebrow, '$.eyebrow', 32, false),
    boundedStringIssue(input.title, '$.title', 80),
    boundedStringIssue(input.footer, '$.footer', 80, false),
  ]) if (issue) issues.push(issue)
  issues.push(...validateMetric(input.cost, '$.cost'))
  issues.push(...validateMetric(input.value, '$.value'))
  if (issues.length > 0) return validationFailure(...issues)
  const cost = input.cost as Record<string, unknown>
  const value = input.value as Record<string, unknown>
  return validationSuccess(Object.freeze({
    eyebrow: input.eyebrow as string,
    title: input.title as string,
    cost: Object.freeze({ label: cost.label as string, value: cost.value as number, prefix: cost.prefix as string, suffix: cost.suffix as string, note: cost.note as string }),
    value: Object.freeze({ label: value.label as string, value: value.value as number, prefix: value.prefix as string, suffix: value.suffix as string, note: value.note as string }),
    footer: input.footer as string,
  }))
}

export const validateCostValueCardStyle = (input: unknown): MotionValidationResultV1<CostValueCardStyle> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Cost / Value Card style must be an object.'))
  const issues = [...unknownFieldIssues(input, styleFields)]
  for (const field of ['textColor', 'mutedColor', 'accentColor', 'costColor', 'surfaceColor', 'fontFamily'] as const) {
    if (typeof input[field] !== 'string' || !input[field].trim()) issues.push(valueIssue(`$.${field}`, 'TYPE_INVALID', `${field} must be a non-empty string.`))
  }
  for (const field of ['titleWeight', 'numberWeight'] as const) {
    if (typeof input[field] !== 'number' || !Number.isFinite(input[field]) || input[field] < 100 || input[field] > 900) issues.push(valueIssue(`$.${field}`, 'VALUE_OUT_OF_RANGE', `${field} must be between 100 and 900.`))
  }
  if (typeof input.motionIntensity !== 'number' || !Number.isFinite(input.motionIntensity) || input.motionIntensity < 0 || input.motionIntensity > 1) issues.push(valueIssue('$.motionIntensity', 'VALUE_OUT_OF_RANGE', 'motionIntensity must be inside [0, 1].'))
  if (issues.length > 0) return validationFailure(...issues)
  return validationSuccess(Object.freeze({
    textColor: input.textColor as string,
    mutedColor: input.mutedColor as string,
    accentColor: input.accentColor as string,
    costColor: input.costColor as string,
    surfaceColor: input.surfaceColor as string,
    fontFamily: input.fontFamily as string,
    titleWeight: input.titleWeight as number,
    numberWeight: input.numberWeight as number,
    motionIntensity: input.motionIntensity as number,
  }))
}

const validateContext = (context: MotionRenderContextV1): void => {
  if (!Number.isSafeInteger(context.durationTicks) || context.durationTicks <= 0) throw new RangeError('durationTicks must be a positive safe integer.')
  if (!Number.isSafeInteger(context.localTicks) || context.localTicks < 0 || context.localTicks > context.durationTicks) throw new RangeError('localTicks must be an in-range safe integer.')
  if (context.ticksPerSecond !== SANVERSE_TICKS_PER_SECOND) throw new RangeError('Cost / Value Card requires the canonical Sanverse tick authority.')
}

const fitText = (text: string, width: number, maxLines: number, preferred: number, minimum: number): MotionValidationResultV1<TextPlan> => {
  const words = text.trim().split(/\s+/u).filter(Boolean)
  const fit = fitWordLines(words, { maxWidth: width, maxLines, preferredFontSize: preferred, minimumFontSize: minimum, fontSizeStep: 1, letterSpacingEm: -0.03, spaceWidthEm: 0.34 })
  if (!fit.ok) return validationFailure(valueIssue('$.text', 'CONTENT_IMPOSSIBLE', fit.reason === 'TOKEN_TOO_WIDE' ? `Text contains a word too wide at ${minimum}px.` : `Text needs ${String(fit.requiredLineCount ?? 'more')} lines but only ${maxLines} are allowed.`))
  return validationSuccess(Object.freeze({
    text,
    fontSize: fit.fontSize,
    minimumFontSize: minimum,
    lineHeight: fit.fontSize * 1.12,
    lines: Object.freeze(fit.lines.map((line) => Object.freeze({ startWordIndex: line.startTokenIndex, endWordIndexExclusive: line.endTokenIndexExclusive, estimatedWidth: line.estimatedWidth }))),
  }))
}

const metricDisplayText = (metric: CostValueMetric, value = metric.value): string => `${metric.prefix}${formatCompactNumber(value, 1)}${metric.suffix}`

export const validateCostValueCardFit = (props: CostValueCardProps, context: MotionRenderContextV1): MotionValidationResultV1<CostValueCardLayout> => {
  validateContext(context)
  const { width, height } = context.composition
  const kind: CostValueCardLayout['kind'] = width / height > 1.18 ? 'horizontal' : 'stacked'
  const shortSide = Math.min(width, height)
  const cardWidth = Math.round(kind === 'horizontal' ? Math.min(width * 0.76, 1320) : width * 0.84)
  const padding = Math.round(Math.max(34, Math.min(64, shortSide * 0.05)))
  const contentWidth = cardWidth - padding * 2
  const gap = Math.round(Math.max(22, Math.min(44, shortSide * 0.035)))
  const metricWidth = kind === 'horizontal' ? Math.floor((contentWidth - gap) / 2) : contentWidth
  const metricInnerWidth = metricWidth - Math.round(shortSide * 0.055)

  const titleFit = fitText(props.title, contentWidth, 2, Math.round(kind === 'horizontal' ? 64 : 56), kind === 'horizontal' ? 40 : 36)
  if (!titleFit.ok) return validationFailure({ ...titleFit.issues[0]!, path: '$.title' })
  const costLabel = fitText(props.cost.label, metricInnerWidth, 2, kind === 'horizontal' ? 30 : 28, 22)
  if (!costLabel.ok) return validationFailure({ ...costLabel.issues[0]!, path: '$.cost.label' })
  const valueLabel = fitText(props.value.label, metricInnerWidth, 2, kind === 'horizontal' ? 30 : 28, 22)
  if (!valueLabel.ok) return validationFailure({ ...valueLabel.issues[0]!, path: '$.value.label' })
  const costNumber = fitText(metricDisplayText(props.cost), metricInnerWidth, 1, kind === 'horizontal' ? 92 : 76, 46)
  if (!costNumber.ok) return validationFailure({ ...costNumber.issues[0]!, path: '$.cost.value' })
  const valueNumber = fitText(metricDisplayText(props.value), metricInnerWidth, 1, kind === 'horizontal' ? 92 : 76, 46)
  if (!valueNumber.ok) return validationFailure({ ...valueNumber.issues[0]!, path: '$.value.value' })

  const eyebrowFontSize = Math.round(kind === 'horizontal' ? 23 : 21)
  const noteFontSize = Math.round(kind === 'horizontal' ? 24 : 22)
  const footerFontSize = Math.round(kind === 'horizontal' ? 26 : 23)
  const headerHeight = (props.eyebrow.trim() ? eyebrowFontSize * 1.2 + 12 : 0) + titleFit.value.lines.length * titleFit.value.lineHeight + 30
  const metricHeight = Math.max(
    costLabel.value.lines.length * costLabel.value.lineHeight + costNumber.value.lineHeight + noteFontSize * 1.25 + 68,
    valueLabel.value.lines.length * valueLabel.value.lineHeight + valueNumber.value.lineHeight + noteFontSize * 1.25 + 68,
  )
  const footerHeight = props.footer.trim() ? footerFontSize * 1.2 + 30 : 0
  const bodyHeight = kind === 'horizontal' ? metricHeight : metricHeight * 2 + gap
  const cardHeight = Math.round(padding * 2 + headerHeight + bodyHeight + footerHeight)
  const maxHeight = Math.round(height * 0.82)
  if (cardHeight > maxHeight) return validationFailure(valueIssue('$', 'CONTENT_IMPOSSIBLE', `Card needs ${cardHeight}px of height but this composition allows ${maxHeight}px at readable sizes.`))

  return validationSuccess(Object.freeze({ kind, cardWidth, cardHeight, maxHeight, padding, contentWidth, metricWidth, metricInnerWidth, gap, title: titleFit.value, costLabel: costLabel.value, valueLabel: valueLabel.value, costNumber: costNumber.value, valueNumber: valueNumber.value, noteFontSize, eyebrowFontSize, footerFontSize }))
}

export const createCostValueCardScene = (props: CostValueCardProps, style: CostValueCardStyle, context: MotionRenderContextV1): MotionSceneV1 => {
  const fit = validateCostValueCardFit(props, context)
  if (!fit.ok) throw new RangeError(fit.issues[0]?.message ?? 'Cost / Value Card content cannot fit.')
  const layout = fit.value
  const ids = {
    root: 'cost-card.root', surface: 'cost-card.surface', titleGroup: 'cost-card.title-group', eyebrow: 'cost-card.eyebrow', title: 'cost-card.title', comparison: 'cost-card.comparison',
    cost: 'cost-card.cost', costSurface: 'cost-card.cost.surface', costLabel: 'cost-card.cost.label', costNumber: 'cost-card.cost.number', costNote: 'cost-card.cost.note',
    direction: 'cost-card.direction-indicator',
    value: 'cost-card.value', valueSurface: 'cost-card.value.surface', valueLabel: 'cost-card.value.label', valueNumber: 'cost-card.value.number', valueNote: 'cost-card.value.note', footer: 'cost-card.footer',
  } as const
  const root = graphGroup(ids.root, 'Cost / Value Card', null, [ids.surface, ids.titleGroup, ids.comparison, ids.footer])
  const motionProgress = mProgress()
  const exit = mSequence(0.82, 1, motionProgress)
  const remain = mOneMinus(mEase('ease-in-cubic', exit))
  const panelReveal = mReduced(mEase('ease-out-cubic', mSequence(0, 0.08, motionProgress)), mEase('ease-out-cubic', mSequence(0, 0.14, motionProgress)))
  const titleReveal = mReduced(mEase('ease-out-cubic', mSequence(0, 0.10, motionProgress)), mEase('ease-out-cubic', mSequence(0.02, 0.20, motionProgress)))
  const costReveal = mReduced(mEase('ease-out-cubic', mSequence(0, 0.12, motionProgress)), mEase('ease-out-cubic', mSequence(0.12, 0.34, motionProgress)))
  const valueReveal = mReduced(mEase('ease-out-cubic', mSequence(0, 0.14, motionProgress)), mEase('ease-out-cubic', mSequence(0.24, 0.48, motionProgress)))
  const arrowReveal = mReduced(mEase('ease-out-cubic', mSequence(0, 0.14, motionProgress)), mEase('ease-out-cubic', mSequence(0.24, 0.42, motionProgress)))
  const directionDistance = 34 * lerp(0.45, 1.15, style.motionIntensity)
  const surfaceBase = graphShape({ id: ids.surface, name: 'Surface', parentId: ids.root, width: layout.cardWidth, height: layout.cardHeight, fillColor: style.surfaceColor, strokeColor: `${style.accentColor}22`, strokeWidth: 2, radius: Math.round(Math.min(context.composition.width, context.composition.height) * 0.034) })
  const surface = Object.freeze({ ...surfaceBase, opacity: mNumber(mMultiply(panelReveal, remain)) })
  const titleGroupBase = graphGroup(ids.titleGroup, 'Title', ids.root, [ids.eyebrow, ids.title])
  const titleGroup = Object.freeze({ ...titleGroupBase, opacity: mNumber(mMultiply(titleReveal, remain)), transform: Object.freeze({ ...titleGroupBase.transform, positionY: mNumber(mReduced(mConst(0), mLerp(mConst(20 * style.motionIntensity), mConst(0), titleReveal))) }) })
  const eyebrowBase = graphText({ id: ids.eyebrow, name: 'Eyebrow', parentId: ids.titleGroup, text: props.eyebrow, color: style.accentColor, fontFamily: style.fontFamily, fontSize: layout.eyebrowFontSize, fontWeight: 800 })
  const eyebrow = Object.freeze({ ...eyebrowBase, visible: constant(Boolean(props.eyebrow.trim())) })
  const title = graphText({ id: ids.title, name: 'Title', parentId: ids.titleGroup, text: props.title, color: style.textColor, fontFamily: style.fontFamily, fontSize: layout.title.fontSize, fontWeight: style.titleWeight })
  const comparison = graphGroup(ids.comparison, 'Comparison', ids.root, [ids.cost, ids.direction, ids.value])
  const costTranslate = mReduced(mConst(0), mSubtract(mLerp(mConst(directionDistance), mConst(0), costReveal), mMultiply(mConst(12 * style.motionIntensity), exit)))
  const costGroupBase = graphGroup(ids.cost, 'Cost', ids.comparison, [ids.costSurface, ids.costLabel, ids.costNumber, ids.costNote])
  const costGroup = Object.freeze({ ...costGroupBase, opacity: mNumber(mMultiply(costReveal, remain)), transform: Object.freeze({ ...costGroupBase.transform, positionX: layout.kind === 'horizontal' ? mNumber(mMultiply(mConst(-1), costTranslate)) : constant(0), positionY: layout.kind === 'stacked' ? mNumber(costTranslate) : constant(0) }) })
  const costSurface = graphShape({ id: ids.costSurface, name: 'Cost Surface', parentId: ids.cost, width: layout.metricWidth, height: 1, fillColor: `${style.costColor}0c`, strokeColor: `${style.costColor}38`, strokeWidth: 1.5, radius: Math.round(layout.padding * 0.42) })
  const costLabel = graphText({ id: ids.costLabel, name: 'Cost Label', parentId: ids.cost, text: props.cost.label, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: layout.costLabel.fontSize, fontWeight: 650 })
  const costNumberBase = graphText({ id: ids.costNumber, name: 'Cost Value', parentId: ids.cost, text: metricDisplayText(props.cost), color: style.costColor, fontFamily: style.fontFamily, fontSize: layout.costNumber.fontSize, fontWeight: style.numberWeight })
  const costNumber = Object.freeze({ ...costNumberBase, text: motionString({ kind: 'compact-number', from: 0, to: props.cost.value, start: 0.18, end: 0.46, easing: 'ease-out-cubic', prefix: props.cost.prefix, suffix: props.cost.suffix, decimals: 1, rounding: 'integer', reducedMotionFinal: true }) })
  const costNoteBase = graphText({ id: ids.costNote, name: 'Cost Note', parentId: ids.cost, text: props.cost.note, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: layout.noteFontSize, fontWeight: 520 })
  const costNote = Object.freeze({ ...costNoteBase, visible: constant(Boolean(props.cost.note.trim())) })
  const directionBase = graphText({ id: ids.direction, name: 'Direction Indicator', parentId: ids.comparison, text: layout.kind === 'horizontal' ? '→' : '↓', color: style.accentColor, fontFamily: style.fontFamily, fontSize: layout.kind === 'horizontal' ? 54 : 44, fontWeight: 800, textAlign: 'center' })
  const arrowScale = mReduced(mConst(1), mLerp(mConst(0.8), mConst(1), mSpring(arrowReveal, lerp(8.4, 5.6, style.motionIntensity), lerp(0.7, 1.08, style.motionIntensity))))
  const direction = Object.freeze({ ...directionBase, opacity: mNumber(mMultiply(arrowReveal, remain)), transform: Object.freeze({ ...directionBase.transform, scaleX: mNumber(arrowScale), scaleY: mNumber(arrowScale) }) })
  const valueTranslate = mReduced(mConst(0), mSubtract(mLerp(mConst(directionDistance), mConst(0), valueReveal), mMultiply(mConst(12 * style.motionIntensity), exit)))
  const valueGroupBase = graphGroup(ids.value, 'Value', ids.comparison, [ids.valueSurface, ids.valueLabel, ids.valueNumber, ids.valueNote])
  const valueGroup = Object.freeze({ ...valueGroupBase, opacity: mNumber(mMultiply(valueReveal, remain)), transform: Object.freeze({ ...valueGroupBase.transform, positionX: layout.kind === 'horizontal' ? mNumber(valueTranslate) : constant(0), positionY: layout.kind === 'stacked' ? mNumber(valueTranslate) : constant(0) }) })
  const valueSurface = graphShape({ id: ids.valueSurface, name: 'Value Surface', parentId: ids.value, width: layout.metricWidth, height: 1, fillColor: `${style.accentColor}0c`, strokeColor: `${style.accentColor}38`, strokeWidth: 1.5, radius: Math.round(layout.padding * 0.42) })
  const valueLabel = graphText({ id: ids.valueLabel, name: 'Value Label', parentId: ids.value, text: props.value.label, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: layout.valueLabel.fontSize, fontWeight: 650 })
  const valueNumberBase = graphText({ id: ids.valueNumber, name: 'Value Number', parentId: ids.value, text: metricDisplayText(props.value), color: style.accentColor, fontFamily: style.fontFamily, fontSize: layout.valueNumber.fontSize, fontWeight: style.numberWeight })
  const valueNumber = Object.freeze({ ...valueNumberBase, text: motionString({ kind: 'compact-number', from: 0, to: props.value.value, start: 0.30, end: 0.60, easing: 'ease-out-cubic', prefix: props.value.prefix, suffix: props.value.suffix, decimals: 1, rounding: 'integer', reducedMotionFinal: true }) })
  const valueNoteBase = graphText({ id: ids.valueNote, name: 'Value Note', parentId: ids.value, text: props.value.note, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: layout.noteFontSize, fontWeight: 520 })
  const valueNote = Object.freeze({ ...valueNoteBase, visible: constant(Boolean(props.value.note.trim())) })
  const footerBase = graphText({ id: ids.footer, name: 'Footer', parentId: ids.root, text: props.footer, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: layout.footerFontSize, fontWeight: 650 })
  const footer = Object.freeze({ ...footerBase, visible: constant(Boolean(props.footer.trim())), opacity: mNumber(mMultiply(valueReveal, remain)) })
  const exposures: MotionExposureV1[] = [
    ...(['eyebrow','title','cost.label','cost.value','cost.prefix','cost.note','value.label','value.value','value.prefix','value.note','footer'] as const).map((propertyId) => ({ id: `cost-card.${propertyId}`, label: propertyId.replaceAll('.', ' '), group: 'Content' as const, level: 'creator' as const, target: { kind: 'component' as const, propertyId }, editor: { type: propertyId.includes('note') || propertyId === 'title' ? 'textarea' as const : propertyId.endsWith('value') ? 'number' as const : 'text' as const }, keyframeable: false })),
    { id: 'cost-card.text-color', label: 'Text color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'textColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: 'cost-card.accent-color', label: 'Accent color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'accentColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: 'cost-card.cost-color', label: 'Cost color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'costColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: 'cost-card.radius', label: 'Roundness', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: ids.surface, property: 'shape.radius' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 120, step: 1 } },
    { id: 'cost-card.surface-opacity', label: 'Surface opacity', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: ids.surface, property: 'opacity' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'cost-card.border-width', label: 'Border width', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: ids.surface, property: 'shape.strokeWidth' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 12, step: 0.5 } },
    ...(['transform.positionX','transform.positionY','transform.scaleX','transform.scaleY','transform.rotationDeg','opacity'] as const).map((property, index) => ({ id: `cost-card.transform.${index}`, label: property, group: 'Transform' as const, level: 'designer' as const, target: { kind: 'node' as const, nodeId: ids.root, property }, editor: { type: 'slider' as const }, keyframeable: true, constraints: property === 'opacity' ? { minimum: 0, maximum: 1, step: 0.01 } : property.includes('scale') ? { minimum: 0.25, maximum: 2, step: 0.01 } : property.includes('rotation') ? { minimum: -180, maximum: 180, step: 1 } : { minimum: -500, maximum: 500, step: 1 } })),
    { id: 'cost-card.motion-intensity', label: 'Motion intensity', group: 'Motion', level: 'designer', target: { kind: 'component', propertyId: 'motionIntensity' }, editor: { type: 'slider' }, keyframeable: false, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'cost-card.parts', label: 'Semantic parts', group: 'Parts', level: 'advanced', target: { kind: 'part', semanticPartId: 'comparison', property: 'opacity' }, editor: { type: 'readonly' }, keyframeable: true },
  ]
  return createMotionScene({
    componentId: 'sanverse.cost-value-card', componentVersion: 1, rootNodeId: ids.root,
    nodes: Object.freeze({ [root.id]: root, [surface.id]: surface, [titleGroup.id]: titleGroup, [eyebrow.id]: eyebrow, [title.id]: title, [comparison.id]: comparison, [costGroup.id]: costGroup, [costSurface.id]: costSurface, [costLabel.id]: costLabel, [costNumber.id]: costNumber, [costNote.id]: costNote, [direction.id]: direction, [valueGroup.id]: valueGroup, [valueSurface.id]: valueSurface, [valueLabel.id]: valueLabel, [valueNumber.id]: valueNumber, [valueNote.id]: valueNote, [footer.id]: footer }),
    semanticParts: Object.freeze([
      { id: 'surface', label: 'Surface', role: 'surface', nodeIds: Object.freeze([ids.surface]) },
      { id: 'title', label: 'Title', role: 'primary-text', nodeIds: Object.freeze([ids.titleGroup, ids.eyebrow, ids.title]) },
      { id: 'comparison', label: 'Comparison', role: 'content-group', nodeIds: Object.freeze([ids.comparison]) },
      { id: 'cost', label: 'Cost', role: 'value', nodeIds: Object.freeze([ids.cost, ids.costSurface, ids.costLabel, ids.costNumber, ids.costNote]) },
      { id: 'directionIndicator', label: 'Direction Indicator', role: 'icon', nodeIds: Object.freeze([ids.direction]) },
      { id: 'value', label: 'Value', role: 'value', nodeIds: Object.freeze([ids.value, ids.valueSurface, ids.valueLabel, ids.valueNumber, ids.valueNote]) },
      { id: 'footer', label: 'Footer', role: 'secondary-text', nodeIds: Object.freeze([ids.footer]) },
    ]),
    exposures: Object.freeze(exposures), layout: responsiveGraphLayout(), supportedAspectRatios: Object.freeze(['16:9','9:16','1:1','4:5']),
  })
}

export const evaluateCostValueCardState = (props: CostValueCardProps, style: CostValueCardStyle, context: MotionRenderContextV1): CostValueCardState => {
  validateContext(context)
  const propsValidation = validateCostValueCardProps(props)
  if (!propsValidation.ok) throw new RangeError(propsValidation.issues[0]?.message ?? 'Invalid Cost / Value Card props.')
  const styleValidation = validateCostValueCardStyle(style)
  if (!styleValidation.ok) throw new RangeError(styleValidation.issues[0]?.message ?? 'Invalid Cost / Value Card style.')
  const fitValidation = validateCostValueCardFit(props, context)
  if (!fitValidation.ok) throw new RangeError(fitValidation.issues[0]?.message ?? 'Cost / Value Card content cannot fit.')

  const progress = normalizedProgress(context.localTicks, context.durationTicks)
  const exit = sequenceProgress(progress, 0.82, 1)
  const exitFade = easeInCubic(exit)
  const panelReveal = context.reducedMotion ? easeOutCubic(Math.min(1, progress / 0.08)) : easeOutCubic(sequenceProgress(progress, 0, 0.14))
  const titleReveal = context.reducedMotion ? easeOutCubic(Math.min(1, progress / 0.10)) : easeOutCubic(sequenceProgress(progress, 0.02, 0.20))
  const costReveal = context.reducedMotion ? easeOutCubic(Math.min(1, progress / 0.12)) : easeOutCubic(sequenceProgress(progress, 0.12, 0.34))
  const valueReveal = context.reducedMotion ? easeOutCubic(Math.min(1, progress / 0.14)) : easeOutCubic(sequenceProgress(progress, 0.24, 0.48))
  const arrowReveal = context.reducedMotion ? easeOutCubic(Math.min(1, progress / 0.14)) : easeOutCubic(sequenceProgress(progress, 0.24, 0.42))
  const countCost = context.reducedMotion ? 1 : easeOutCubic(sequenceProgress(progress, 0.18, 0.46))
  const countValue = context.reducedMotion ? 1 : easeOutCubic(sequenceProgress(progress, 0.30, 0.60))
  const intensity = style.motionIntensity
  const directionDistance = 34 * lerp(0.45, 1.15, intensity)
  const arrowScale = context.reducedMotion ? 1 : lerp(0.8, 1, springProgress({ progress: arrowReveal, damping: lerp(8.4, 5.6, intensity), frequency: lerp(0.7, 1.08, intensity) }))

  return Object.freeze({
    normalizedProgress: progress,
    phase: progress < 0.60 ? 'enter' : progress < 0.82 ? 'hold' : progress < 1 ? 'exit' : 'ended',
    panelOpacity: panelReveal * (1 - exitFade),
    titleOpacity: titleReveal * (1 - exitFade),
    titleTranslateY: context.reducedMotion ? 0 : lerp(20 * intensity, 0, titleReveal),
    costOpacity: costReveal * (1 - exitFade),
    costTranslate: context.reducedMotion ? 0 : lerp(directionDistance, 0, costReveal) - exit * 12 * intensity,
    valueOpacity: valueReveal * (1 - exitFade),
    valueTranslate: context.reducedMotion ? 0 : lerp(directionDistance, 0, valueReveal) - exit * 12 * intensity,
    arrowOpacity: arrowReveal * (1 - exitFade),
    arrowScale,
    costCountProgress: countCost,
    valueCountProgress: countValue,
    displayedCostValue: interpolateNumber(0, props.cost.value, countCost, 'integer'),
    displayedValueValue: interpolateNumber(0, props.value.value, countValue, 'integer'),
    layout: fitValidation.value,
  })
}

const renderTextPlan = (plan: TextPlan) => {
  const words = plan.text.trim().split(/\s+/u).filter(Boolean)
  return plan.lines.map((line, index) => (
    <span key={`${line.startWordIndex}:${line.endWordIndexExclusive}`} data-motion-line={index} style={{ display: 'block', whiteSpace: 'nowrap' }}>
      {words.slice(line.startWordIndex, line.endWordIndexExclusive).join(' ')}
    </span>
  ))
}

const resolveGraphTextPlan = (
  text: string | undefined,
  fallback: TextPlan,
  width: number,
  maxLines: number,
  preferred: number,
  minimum: number,
  path: string,
): TextPlan => {
  if (text === undefined || text === fallback.text) return fallback
  const fit = fitText(text, width, maxLines, preferred, minimum)
  if (!fit.ok) throw new RangeError(`${path} cannot fit the graph-edited text within the component's responsive bounds.`)
  return fit.value
}

const metricPanel = (
  kind: 'cost' | 'value',
  metric: CostValueMetric,
  labelPlan: TextPlan,
  numberPlan: TextPlan,
  displayedValue: number,
  opacity: number,
  translate: number,
  color: string,
  style: CostValueCardStyle,
  layout: CostValueCardLayout,
  scene: ResolvedMotionSceneV1 | null,
  graphStyle: (nodeId: string, base: CSSProperties) => CSSProperties,
) => {
  const groupId = `cost-card.${kind}`
  const surfaceId = `${groupId}.surface`
  const labelId = `${groupId}.label`
  const numberId = `${groupId}.${kind === 'cost' ? 'number' : 'number'}`
  const noteId = `${groupId}.note`
  const surfaceNode = scene?.nodes[surfaceId]
  const surface = surfaceNode?.type === 'shape' ? surfaceNode : null
  const labelNode = scene?.nodes[labelId]
  const label = labelNode?.type === 'text' ? labelNode : null
  const numberNode = scene?.nodes[numberId]
  const number = numberNode?.type === 'text' ? numberNode : null
  const noteNode = scene?.nodes[noteId]
  const note = noteNode?.type === 'text' ? noteNode : null
  const groupNode = scene?.nodes[groupId]
  const group = groupNode?.type === 'group' ? groupNode : null
  const resolvedLabelPlan = resolveGraphTextPlan(label?.text, labelPlan, layout.metricInnerWidth, 2, layout.kind === 'horizontal' ? 30 : 28, 22, labelId)
  const resolvedLabelFontSize = Math.min(label?.fontSize ?? resolvedLabelPlan.fontSize, resolvedLabelPlan.fontSize)
  const noteText = note?.text ?? metric.note
  const resolvedTranslateX = group?.transform.positionX ?? (layout.kind === 'horizontal' ? (kind === 'cost' ? -translate : translate) : 0)
  const resolvedTranslateY = group?.transform.positionY ?? (layout.kind === 'stacked' ? translate : 0)
  const basePanelStyle: CSSProperties = {
    padding: Math.round(layout.padding * 0.58),
    borderRadius: surface?.radius ?? Math.round(layout.padding * 0.42),
    borderStyle: 'solid',
    borderWidth: surface?.strokeWidth ?? 1.5,
    borderColor: surface?.strokeColor ?? `${color}38`,
    background: surface?.fillColor ?? `${color}0c`,
    opacity: group?.opacity ?? opacity,
    transform: layout.kind === 'horizontal'
      ? `translate3d(${resolvedTranslateX}px,0,0)`
      : `translate3d(0,${resolvedTranslateY}px,0)`,
  }
  const surfaceStyle = mergeMotionGraphNodeDecorationStyle(basePanelStyle, surface, false)
  const panelStyle = mergeMotionGraphNodeDecorationStyle(surfaceStyle, group, false)
  return (
    <div data-motion-node-id={groupId} data-motion-surface-node-id={surfaceId} data-motion-metric={kind} style={panelStyle}>
      <div data-motion-node-id={labelId} data-motion-text={`${kind}-label`} style={graphStyle(labelId, { color: label?.fillColor ?? style.mutedColor, fontSize: resolvedLabelFontSize, lineHeight: `${resolvedLabelPlan.lineHeight}px`, fontWeight: label?.fontWeight ?? 650 })}>
        {renderTextPlan(resolvedLabelPlan)}
      </div>
      <div data-motion-node-id={numberId} data-motion-number={kind} style={graphStyle(numberId, { marginTop: 10, color: number?.fillColor ?? color, fontSize: number?.fontSize ?? numberPlan.fontSize, lineHeight: `${numberPlan.lineHeight}px`, fontWeight: number?.fontWeight ?? style.numberWeight, letterSpacing: '-.045em', whiteSpace: 'nowrap' })}>
        {number?.text ?? metricDisplayText(metric, displayedValue)}
      </div>
      {noteText.trim() ? <div data-motion-node-id={noteId} style={graphStyle(noteId, { marginTop: 10, color: note?.fillColor ?? style.mutedColor, fontSize: note?.fontSize ?? layout.noteFontSize, lineHeight: 1.25 })}>{noteText}</div> : null}
    </div>
  )
}

export function CostValueCard({ props, style, context }: MotionComponentRenderPropsV1<CostValueCardProps, CostValueCardStyle>) {
  const state = evaluateCostValueCardState(props, style, context)
  const graph = useMotionGraphPresentation()
  const graphStyle = (nodeId: string, base: CSSProperties): CSSProperties => mergeMotionGraphNodeStyle(base, graph.scene?.nodes[nodeId] ?? null, graph.selectedNodeId === nodeId)
  const { width, height } = context.composition
  const bodyStyle: CSSProperties = state.layout.kind === 'horizontal'
    ? { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: state.layout.gap, alignItems: 'center' }
    : { display: 'grid', gridTemplateRows: 'auto auto auto', gap: state.layout.gap, alignItems: 'center' }
  const surfaceNode = graph.scene?.nodes['cost-card.surface']
  const surface = surfaceNode?.type === 'shape' ? surfaceNode : null
  const eyebrowNode = graph.scene?.nodes['cost-card.eyebrow']
  const eyebrow = eyebrowNode?.type === 'text' ? eyebrowNode : null
  const titleNode = graph.scene?.nodes['cost-card.title']
  const title = titleNode?.type === 'text' ? titleNode : null
  const directionNode = graph.scene?.nodes['cost-card.direction-indicator']
  const direction = directionNode?.type === 'text' ? directionNode : null
  const footerNode = graph.scene?.nodes['cost-card.footer']
  const footer = footerNode?.type === 'text' ? footerNode : null
  const rootStyle = graphStyle('cost-card.root', { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', fontFamily: style.fontFamily })
  const cardStyle = mergeMotionGraphNodeDecorationStyle({ width: state.layout.cardWidth, minHeight: state.layout.cardHeight, boxSizing: 'border-box', padding: state.layout.padding, borderRadius: surface?.radius ?? Math.round(Math.min(width, height) * 0.034), borderStyle: 'solid', borderWidth: surface?.strokeWidth ?? 2, borderColor: surface?.strokeColor ?? `${style.accentColor}22`, background: surface?.fillColor ?? style.surfaceColor, boxShadow: `0 ${Math.round(height * 0.018)}px ${Math.round(height * 0.06)}px rgba(0,0,0,.36)`, opacity: surface?.opacity ?? state.panelOpacity, color: style.textColor }, surface, graph.selectedNodeId === 'cost-card.surface')
  const titleGroupNode = graph.scene?.nodes['cost-card.title-group']
  const titleGroup = titleGroupNode?.type === 'group' ? titleGroupNode : null
  const eyebrowText = eyebrow?.text ?? props.eyebrow
  const titlePlan = resolveGraphTextPlan(title?.text, state.layout.title, state.layout.contentWidth, 2, state.layout.kind === 'horizontal' ? 64 : 56, state.layout.kind === 'horizontal' ? 40 : 36, 'cost-card.title')
  const titleFontSize = Math.min(title?.fontSize ?? titlePlan.fontSize, titlePlan.fontSize)
  const footerText = footer?.text ?? props.footer

  return (
    <div data-motion-root="cost-value-card" data-motion-node-id="cost-card.root" data-motion-layout={state.layout.kind} style={rootStyle}>
      <section data-motion-node-id="cost-card.surface" style={cardStyle}>
        <header data-motion-node-id="cost-card.title-group" style={mergeMotionGraphNodeDecorationStyle({ opacity: titleGroup?.opacity ?? state.titleOpacity, transform: `translate3d(0,${titleGroup?.transform.positionY ?? state.titleTranslateY}px,0)` }, titleGroup, graph.selectedNodeId === 'cost-card.title-group')}>
          {eyebrowText.trim() ? <div data-motion-node-id="cost-card.eyebrow" style={graphStyle('cost-card.eyebrow', { color: eyebrow?.fillColor ?? style.accentColor, fontSize: eyebrow?.fontSize ?? state.layout.eyebrowFontSize, fontWeight: eyebrow?.fontWeight ?? 800, letterSpacing: '.11em', marginBottom: 12 })}>{eyebrowText}</div> : null}
          <div data-motion-node-id="cost-card.title" data-motion-text="cost-value-title" style={graphStyle('cost-card.title', { fontSize: titleFontSize, lineHeight: `${titlePlan.lineHeight}px`, fontWeight: title?.fontWeight ?? style.titleWeight, color: title?.fillColor, letterSpacing: '-.035em' })}>
            {renderTextPlan(titlePlan)}
          </div>
        </header>

        <div data-motion-node-id="cost-card.comparison" style={graphStyle('cost-card.comparison', { ...bodyStyle, marginTop: 30 })}>
          {metricPanel('cost', props.cost, state.layout.costLabel, state.layout.costNumber, state.displayedCostValue, state.costOpacity, state.costTranslate, style.costColor, style, state.layout, graph.scene, graphStyle)}
          <div aria-hidden="true" data-motion-node-id="cost-card.direction-indicator" data-motion-arrow="true" style={mergeMotionGraphNodeDecorationStyle({ color: direction?.fillColor ?? style.accentColor, fontSize: direction?.fontSize ?? (state.layout.kind === 'horizontal' ? 54 : 44), lineHeight: 1, fontWeight: direction?.fontWeight ?? 800, textAlign: 'center', opacity: direction?.opacity ?? state.arrowOpacity, transform: `scale(${direction?.transform.scaleX ?? state.arrowScale})` }, direction, graph.selectedNodeId === 'cost-card.direction-indicator')}>
            {direction?.text ?? (state.layout.kind === 'horizontal' ? '→' : '↓')}
          </div>
          {metricPanel('value', props.value, state.layout.valueLabel, state.layout.valueNumber, state.displayedValueValue, state.valueOpacity, state.valueTranslate, style.accentColor, style, state.layout, graph.scene, graphStyle)}
        </div>

        {footerText.trim() ? <footer data-motion-node-id="cost-card.footer" style={mergeMotionGraphNodeDecorationStyle({ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${style.textColor}16`, color: footer?.fillColor ?? style.mutedColor, fontSize: footer?.fontSize ?? state.layout.footerFontSize, fontWeight: footer?.fontWeight ?? 650, opacity: footer?.opacity ?? state.valueOpacity }, footer, graph.selectedNodeId === 'cost-card.footer')}>{footerText}</footer> : null}
      </section>
    </div>
  )
}

export const COST_VALUE_CARD_DEFINITION = Object.freeze({
  id: 'sanverse.cost-value-card',
  version: 1,
  name: 'Cost / Value Card',
  purpose: 'Compare a cost, input or baseline against the value or outcome it creates.',
  category: 'comparison',
  performanceClass: 'light',
  supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5'] as const),
  minDurationTicks: Math.round(SANVERSE_TICKS_PER_SECOND * 1.5),
  defaultDurationTicks: SANVERSE_TICKS_PER_SECOND * 5,
  maxDurationTicks: SANVERSE_TICKS_PER_SECOND * 12,
  events: Object.freeze([
    { name: 'enter-start', normalizedTime: 0 },
    { name: 'cost-reveal', normalizedTime: 0.12 },
    { name: 'count-start', normalizedTime: 0.18 },
    { name: 'value-reveal', normalizedTime: 0.24 },
    { name: 'count-end', normalizedTime: 0.60 },
    { name: 'settled', normalizedTime: 0.60 },
    { name: 'exit-start', normalizedTime: 0.82 },
  ]),
  contentLimits: Object.freeze([
    { field: 'title', description: 'Primary comparison title.', minimum: 1, maximum: 80, unit: 'characters' as const },
    { field: 'cost.value', description: 'Finite non-negative baseline value.', minimum: 0, maximum: 1_000_000_000_000, unit: 'values' as const },
    { field: 'value.value', description: 'Finite non-negative outcome value.', minimum: 0, maximum: 1_000_000_000_000, unit: 'values' as const },
  ]),
  capabilities: FULL_NATIVE_GRAPH_CAPABILITIES,
} as const)

export const CostValueCardModule: MotionGraphBackedComponentModuleV1<CostValueCardProps, CostValueCardStyle> = Object.freeze({
  definition: COST_VALUE_CARD_DEFINITION,
  defaultProps: DEFAULT_COST_VALUE_CARD_PROPS,
  defaultStyle: DEFAULT_COST_VALUE_CARD_STYLE,
  validateProps: validateCostValueCardProps,
  validateStyle: validateCostValueCardStyle,
  Component: CostValueCard,
  createScene: createCostValueCardScene,
})

