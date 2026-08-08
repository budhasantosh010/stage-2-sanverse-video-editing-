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
  lerp,
  normalizedProgress,
  sequenceProgress,
  springProgress,
  staggerProgress,
} from '@sanverse/motion-primitives'
import type { MotionExposureV1, MotionGraphBackedComponentModuleV1, MotionSceneV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene } from '@sanverse/motion-graph'
import { mergeMotionGraphNodeDecorationStyle, mergeMotionGraphNodeStyle, useMotionGraphPresentation } from '@sanverse/motion-native-runtime'
import { FULL_NATIVE_GRAPH_CAPABILITIES, graphGroup, graphPath, graphShape, graphText, responsiveGraphLayout } from '../graph-common.ts'
import { mConst, mEase, mLerp, mMultiply, mNumber, mOneMinus, mProgress, mReduced, mSequence, mSpring, mStagger, mSubtract } from '../graph-motion.ts'
import { SANVERSE_CLEAN_STYLE } from '../style-packs.ts'
import { isRecord, unknownFieldIssues, validationFailure, validationSuccess, valueIssue } from '../validation.ts'

export interface ChecklistCardItem {
  readonly id: string
  readonly label: string
  readonly state: 'complete' | 'pending'
}

export interface ChecklistCardProps {
  readonly eyebrow: string
  readonly title: string
  readonly items: readonly ChecklistCardItem[]
  readonly footer: string
}

export interface ChecklistCardStyle {
  readonly textColor: string
  readonly mutedColor: string
  readonly accentColor: string
  readonly surfaceColor: string
  readonly fontFamily: string
  readonly titleWeight: number
  readonly motionIntensity: number
}

export interface ChecklistCardLinePlan {
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

export interface ChecklistCardLayout {
  readonly kind: 'landscape' | 'portrait' | 'square'
  readonly cardWidth: number
  readonly cardHeight: number
  readonly maxHeight: number
  readonly padding: number
  readonly contentWidth: number
  readonly rowTextWidth: number
  readonly iconSize: number
  readonly rowGap: number
  readonly title: ChecklistCardLinePlan
  readonly items: readonly ChecklistCardLinePlan[]
  readonly eyebrowFontSize: number
  readonly footerFontSize: number
}

export interface ChecklistCardRowState {
  readonly index: number
  readonly opacity: number
  readonly translateX: number
  readonly checkProgress: number
  readonly checkScale: number
}

export interface ChecklistCardState {
  readonly normalizedProgress: number
  readonly phase: 'enter' | 'hold' | 'exit' | 'ended'
  readonly panelOpacity: number
  readonly titleOpacity: number
  readonly titleTranslateY: number
  readonly progressReveal: number
  readonly rows: readonly ChecklistCardRowState[]
  readonly layout: ChecklistCardLayout
}

export const checklistCardStyleFromPack = (pack: MotionStylePackV1): ChecklistCardStyle => ({
  textColor: pack.tokens.colors.text,
  mutedColor: pack.tokens.colors.textSecondary,
  accentColor: pack.tokens.colors.accent,
  surfaceColor: pack.tokens.colors.surface,
  fontFamily: pack.tokens.typography.bodyFont,
  titleWeight: pack.tokens.typography.headingWeight,
  motionIntensity: pack.tokens.motion.intensity,
})

export const DEFAULT_CHECKLIST_CARD_PROPS: ChecklistCardProps = Object.freeze({
  eyebrow: 'LAUNCH CHECKLIST',
  title: 'Ready before you publish',
  items: Object.freeze([
    Object.freeze({ id: 'hook', label: 'Hook is clear in the first five seconds', state: 'complete' as const }),
    Object.freeze({ id: 'visuals', label: 'Visual changes support the point', state: 'complete' as const }),
    Object.freeze({ id: 'cta', label: 'Call to action matches the viewer intent', state: 'pending' as const }),
  ]),
  footer: '2 of 3 ready',
})

export const DEFAULT_CHECKLIST_CARD_STYLE: ChecklistCardStyle = Object.freeze(checklistCardStyleFromPack(SANVERSE_CLEAN_STYLE))

const propsFields = ['eyebrow', 'title', 'items', 'footer'] as const
const itemFields = ['id', 'label', 'state'] as const
const styleFields = ['textColor', 'mutedColor', 'accentColor', 'surfaceColor', 'fontFamily', 'titleWeight', 'motionIntensity'] as const
const ITEM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/u

const validateBoundedString = (
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  allowEmpty = false,
) => {
  if (typeof value !== 'string') return valueIssue(path, 'TYPE_INVALID', `${path} must be a string.`)
  const length = value.trim().length
  if (!allowEmpty && length < minimum) return valueIssue(path, 'CONTENT_TOO_SMALL', `${path} cannot be empty.`)
  if (length > maximum) return valueIssue(path, 'CONTENT_TOO_LARGE', `${path} is limited to ${maximum} characters.`)
  return null
}

export const validateChecklistCardProps = (input: unknown): MotionValidationResultV1<ChecklistCardProps> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Checklist Card props must be an object.'))
  const issues = [...unknownFieldIssues(input, propsFields)]
  for (const issue of [
    validateBoundedString(input.eyebrow, '$.eyebrow', 0, 32, true),
    validateBoundedString(input.title, '$.title', 1, 80),
    validateBoundedString(input.footer, '$.footer', 0, 72, true),
  ]) if (issue) issues.push(issue)

  if (!Array.isArray(input.items)) issues.push(valueIssue('$.items', 'TYPE_INVALID', 'items must be an array.'))
  else {
    if (input.items.length < 1) issues.push(valueIssue('$.items', 'CONTENT_TOO_SMALL', 'Checklist Card needs at least one item.'))
    if (input.items.length > 6) issues.push(valueIssue('$.items', 'CONTENT_TOO_LARGE', 'Checklist Card supports at most six items.'))
    const ids = new Set<string>()
    input.items.forEach((rawItem, index) => {
      const path = `$.items[${index}]`
      if (!isRecord(rawItem)) {
        issues.push(valueIssue(path, 'TYPE_INVALID', 'Each checklist item must be an object.'))
        return
      }
      issues.push(...unknownFieldIssues(rawItem, itemFields).map((issue) => ({ ...issue, path: `${path}.${issue.path.slice(2)}` })))
      const id = rawItem.id
      if (typeof id !== 'string' || !ITEM_ID_PATTERN.test(id)) issues.push(valueIssue(`${path}.id`, 'VALUE_INVALID', 'Item id must use 1–32 lowercase letters, numbers, underscores or hyphens.'))
      else if (ids.has(id)) issues.push(valueIssue(`${path}.id`, 'VALUE_INVALID', `Item id ${id} is duplicated.`))
      else ids.add(id)
      const labelIssue = validateBoundedString(rawItem.label, `${path}.label`, 1, 72)
      if (labelIssue) issues.push(labelIssue)
      if (rawItem.state !== 'complete' && rawItem.state !== 'pending') issues.push(valueIssue(`${path}.state`, 'VALUE_INVALID', 'Item state must be complete or pending.'))
    })
  }

  if (issues.length > 0) return validationFailure(...issues)
  return validationSuccess(Object.freeze({
    eyebrow: input.eyebrow as string,
    title: input.title as string,
    items: Object.freeze((input.items as Record<string, unknown>[]).map((item) => Object.freeze({
      id: item.id as string,
      label: item.label as string,
      state: item.state as ChecklistCardItem['state'],
    }))),
    footer: input.footer as string,
  }))
}

export const validateChecklistCardStyle = (input: unknown): MotionValidationResultV1<ChecklistCardStyle> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Checklist Card style must be an object.'))
  const issues = [...unknownFieldIssues(input, styleFields)]
  for (const field of ['textColor', 'mutedColor', 'accentColor', 'surfaceColor', 'fontFamily'] as const) {
    if (typeof input[field] !== 'string' || !input[field].trim()) issues.push(valueIssue(`$.${field}`, 'TYPE_INVALID', `${field} must be a non-empty string.`))
  }
  if (typeof input.titleWeight !== 'number' || !Number.isFinite(input.titleWeight) || input.titleWeight < 100 || input.titleWeight > 900) issues.push(valueIssue('$.titleWeight', 'VALUE_OUT_OF_RANGE', 'titleWeight must be between 100 and 900.'))
  if (typeof input.motionIntensity !== 'number' || !Number.isFinite(input.motionIntensity) || input.motionIntensity < 0 || input.motionIntensity > 1) issues.push(valueIssue('$.motionIntensity', 'VALUE_OUT_OF_RANGE', 'motionIntensity must be inside [0, 1].'))
  if (issues.length > 0) return validationFailure(...issues)
  return validationSuccess(Object.freeze({
    textColor: input.textColor as string,
    mutedColor: input.mutedColor as string,
    accentColor: input.accentColor as string,
    surfaceColor: input.surfaceColor as string,
    fontFamily: input.fontFamily as string,
    titleWeight: input.titleWeight as number,
    motionIntensity: input.motionIntensity as number,
  }))
}

const validateContext = (context: MotionRenderContextV1): void => {
  if (!Number.isSafeInteger(context.localTicks) || context.localTicks < 0 || context.localTicks > context.durationTicks) throw new RangeError('localTicks must be an in-range non-negative safe integer.')
  if (!Number.isSafeInteger(context.durationTicks) || context.durationTicks <= 0) throw new RangeError('durationTicks must be a positive safe integer.')
  if (context.ticksPerSecond !== SANVERSE_TICKS_PER_SECOND) throw new RangeError('Checklist Card requires the canonical Sanverse tick authority.')
  const { width, height, fpsNumerator, fpsDenominator } = context.composition
  if (![width, height, fpsNumerator, fpsDenominator].every((value) => Number.isFinite(value) && value > 0)) throw new RangeError('Composition dimensions and FPS must be positive finite values.')
}

const fitLinePlan = (
  text: string,
  maxWidth: number,
  maxLines: number,
  preferredFontSize: number,
  minimumFontSize: number,
): MotionValidationResultV1<ChecklistCardLinePlan> => {
  const words = text.trim().split(/\s+/u).filter(Boolean)
  const fit = fitWordLines(words, { maxWidth, maxLines, preferredFontSize, minimumFontSize, fontSizeStep: 1, letterSpacingEm: -0.025, spaceWidthEm: 0.34 })
  if (!fit.ok) {
    const message = fit.reason === 'TOKEN_TOO_WIDE'
      ? `A word is too wide to fit at the minimum readable size of ${minimumFontSize}px.`
      : `This text needs ${String(fit.requiredLineCount ?? 'more')} lines but only ${maxLines} are allowed.`
    return validationFailure(valueIssue('$.text', 'CONTENT_IMPOSSIBLE', message))
  }
  return validationSuccess(Object.freeze({
    text,
    fontSize: fit.fontSize,
    minimumFontSize,
    lineHeight: fit.fontSize * 1.14,
    lines: Object.freeze(fit.lines.map((line) => Object.freeze({ startWordIndex: line.startTokenIndex, endWordIndexExclusive: line.endTokenIndexExclusive, estimatedWidth: line.estimatedWidth }))),
  }))
}

export const validateChecklistCardFit = (
  props: ChecklistCardProps,
  context: MotionRenderContextV1,
): MotionValidationResultV1<ChecklistCardLayout> => {
  validateContext(context)
  const { width, height } = context.composition
  const aspect = width / height
  const kind: ChecklistCardLayout['kind'] = aspect < 0.78 ? 'portrait' : aspect <= 1.12 ? 'square' : 'landscape'
  const shortSide = Math.min(width, height)
  const cardWidth = Math.round(kind === 'landscape' ? Math.min(width * 0.62, 1160) : kind === 'portrait' ? width * 0.84 : width * 0.80)
  const padding = Math.round(Math.max(34, Math.min(68, shortSide * 0.052)))
  const iconSize = Math.round(Math.max(34, Math.min(54, shortSide * 0.042)))
  const rowGap = Math.round(Math.max(12, Math.min(22, shortSide * 0.016)))
  const rowTextWidth = cardWidth - padding * 2 - iconSize - Math.round(shortSide * 0.028)
  const titleTextWidth = cardWidth - padding * 2
  const titlePreferred = Math.round(kind === 'portrait' ? 58 : kind === 'square' ? 62 : 66)
  const titleMinimum = kind === 'portrait' ? 38 : 42
  const itemPreferred = Math.round(kind === 'portrait' ? 36 : 38)
  const itemMinimum = 28

  const titleFit = fitLinePlan(props.title, titleTextWidth, 2, titlePreferred, titleMinimum)
  if (!titleFit.ok) return validationFailure({ ...titleFit.issues[0]!, path: '$.title' })

  const itemFits: ChecklistCardLinePlan[] = []
  for (let index = 0; index < props.items.length; index += 1) {
    const itemFit = fitLinePlan(props.items[index]!.label, rowTextWidth, 2, itemPreferred, itemMinimum)
    if (!itemFit.ok) return validationFailure({ ...itemFit.issues[0]!, path: `$.items[${index}].label` })
    itemFits.push(itemFit.value)
  }

  const eyebrowFontSize = Math.round(kind === 'portrait' ? 22 : 24)
  const footerFontSize = Math.round(kind === 'portrait' ? 24 : 26)
  const eyebrowHeight = props.eyebrow.trim() ? eyebrowFontSize * 1.2 + 16 : 0
  const titleHeight = titleFit.value.lines.length * titleFit.value.lineHeight
  const rowsHeight = itemFits.reduce((sum, itemFit) => sum + Math.max(iconSize + 8, itemFit.lines.length * itemFit.lineHeight + 8), 0)
  const footerHeight = props.footer.trim() ? footerFontSize * 1.2 + 26 : 0
  const cardHeight = Math.round(padding * 2 + eyebrowHeight + titleHeight + 34 + rowsHeight + rowGap * Math.max(0, props.items.length - 1) + footerHeight)
  const maxHeight = Math.round(height * (kind === 'portrait' ? 0.78 : 0.82))
  if (cardHeight > maxHeight) return validationFailure(valueIssue('$.items', 'CONTENT_IMPOSSIBLE', `Checklist needs ${cardHeight}px of height but this composition allows ${maxHeight}px at readable sizes.`))

  return validationSuccess(Object.freeze({
    kind,
    cardWidth,
    cardHeight,
    maxHeight,
    padding,
    contentWidth: titleTextWidth,
    rowTextWidth,
    iconSize,
    rowGap,
    title: titleFit.value,
    items: Object.freeze(itemFits),
    eyebrowFontSize,
    footerFontSize,
  }))
}

export const createChecklistCardScene = (props: ChecklistCardProps, style: ChecklistCardStyle, context: MotionRenderContextV1): MotionSceneV1 => {
  const fit = validateChecklistCardFit(props, context)
  if (!fit.ok) throw new RangeError(fit.issues[0]?.message ?? 'Checklist Card content cannot fit this composition.')
  const layout = fit.value
  const rootId = 'checklist.root'
  const surfaceId = 'checklist.surface'
  const titleGroupId = 'checklist.title-group'
  const eyebrowId = 'checklist.eyebrow'
  const titleId = 'checklist.title'
  const progressGroupId = 'checklist.progress'
  const progressTrackId = 'checklist.progress-track'
  const progressFillId = 'checklist.progress-fill'
  const progressCountId = 'checklist.progress-count'
  const rowsGroupId = 'checklist.rows'
  const footerId = 'checklist.footer'
  const rowGroupIds = props.items.map((item) => `checklist.row:${item.id}`)
  const checkboxIds = props.items.map((item) => `checklist.row:${item.id}.checkbox`)
  const checkmarkIds = props.items.map((item) => `checklist.row:${item.id}.checkmark`)
  const labelIds = props.items.map((item) => `checklist.row:${item.id}.label`)
  const root = graphGroup(rootId, 'Checklist Card', null, [surfaceId, titleGroupId, progressGroupId, rowsGroupId, footerId])
  const motionProgress = mProgress()
  const exit = mSequence(0.82, 1, motionProgress)
  const remain = mOneMinus(mEase('ease-in-cubic', exit))
  const titleReveal = mReduced(mEase('ease-out-cubic', mSequence(0, 0.10, motionProgress)), mEase('ease-out-cubic', mSequence(0, 0.22, motionProgress)))
  const panelReveal = mReduced(mEase('ease-out-cubic', mSequence(0, 0.08, motionProgress)), mEase('ease-out-cubic', mSequence(0, 0.16, motionProgress)))
  const progressReveal = mReduced(mEase('ease-out-cubic', mSequence(0, 0.14, motionProgress)), mEase('ease-out-cubic', mSequence(0.12, 0.46, motionProgress)))
  const surfaceBase = graphShape({ id: surfaceId, name: 'Surface', parentId: rootId, width: layout.cardWidth, height: layout.cardHeight, fillColor: style.surfaceColor, strokeColor: `${style.accentColor}28`, strokeWidth: 2, radius: Math.round(Math.min(context.composition.width, context.composition.height) * 0.032) })
  const surface = Object.freeze({ ...surfaceBase, opacity: mNumber(mMultiply(panelReveal, remain)) })
  const titleGroupBase = graphGroup(titleGroupId, 'Title', rootId, [eyebrowId, titleId])
  const titleGroup = Object.freeze({ ...titleGroupBase, opacity: mNumber(mMultiply(titleReveal, remain)), transform: Object.freeze({ ...titleGroupBase.transform, positionY: mNumber(mReduced(mConst(0), mSubtract(mLerp(mConst(22 * style.motionIntensity), mConst(0), titleReveal), mMultiply(mConst(12 * style.motionIntensity), exit)))) }) })
  const eyebrow = Object.freeze({ ...graphText({ id: eyebrowId, name: 'Eyebrow', parentId: titleGroupId, text: props.eyebrow, color: style.accentColor, fontFamily: style.fontFamily, fontSize: layout.eyebrowFontSize, fontWeight: 800 }), visible: constant(Boolean(props.eyebrow.trim())) })
  const title = graphText({ id: titleId, name: 'Title', parentId: titleGroupId, text: props.title, color: style.textColor, fontFamily: style.fontFamily, fontSize: layout.title.fontSize, fontWeight: style.titleWeight })
  const completedCount = props.items.filter((item) => item.state === 'complete').length
  const progress = graphGroup(progressGroupId, 'Progress', rootId, [progressTrackId, progressFillId, progressCountId])
  const progressTrack = graphShape({ id: progressTrackId, name: 'Progress Track', parentId: progressGroupId, shape: 'rounded-rectangle', width: layout.contentWidth, height: 7, fillColor: `${style.textColor}18`, strokeColor: 'transparent', strokeWidth: 0, radius: 999 })
  const progressFillBase = graphShape({ id: progressFillId, name: 'Progress Fill', parentId: progressGroupId, shape: 'rounded-rectangle', width: layout.contentWidth * (props.items.length === 0 ? 0 : completedCount / props.items.length), height: 7, fillColor: style.accentColor, strokeColor: 'transparent', strokeWidth: 0, radius: 999 })
  const progressFill = Object.freeze({ ...progressFillBase, transform: Object.freeze({ ...progressFillBase.transform, scaleX: mNumber(progressReveal) }) })
  const progressCount = graphText({ id: progressCountId, name: 'Progress Count', parentId: progressGroupId, text: `${completedCount}/${props.items.length}`, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: Math.round(layout.footerFontSize * 0.9), fontWeight: 700 })
  const rows = graphGroup(rowsGroupId, 'Rows', rootId, rowGroupIds)
  const rowWindow = mSequence(0.08, 0.48, motionProgress)
  const checkWindow = mSequence(0.24, 0.62, motionProgress)
  const rowNodes = Object.fromEntries(props.items.flatMap((item, index) => {
    const rowId = rowGroupIds[index]!
    const checkboxId = checkboxIds[index]!
    const checkmarkId = checkmarkIds[index]!
    const labelId = labelIds[index]!
    const reveal = mReduced(mEase('ease-out-cubic', mSequence(0, 0.14, motionProgress)), mEase('ease-out-cubic', mStagger(rowWindow, index, props.items.length, 0.54)))
    const checkProgress = item.state === 'complete'
      ? mReduced(mEase('ease-out-cubic', mSequence(0, 0.16, motionProgress)), mEase('ease-out-cubic', mStagger(checkWindow, index, props.items.length, 0.62)))
      : mConst(0)
    const rowDistance = 28 * lerp(0.45, 1.15, style.motionIntensity)
    const rowBase = graphGroup(rowId, `Row: ${item.id}`, rowsGroupId, [checkboxId, checkmarkId, labelId])
    const row = Object.freeze({ ...rowBase, opacity: mNumber(mMultiply(reveal, remain)), transform: Object.freeze({ ...rowBase.transform, positionX: mNumber(mReduced(mConst(0), mSubtract(mLerp(mConst(rowDistance), mConst(0), reveal), mMultiply(mConst(16 * style.motionIntensity), exit)))) }) })
    const checkScaleExpression = item.state === 'complete' ? mReduced(mConst(1), mLerp(mConst(0.78), mConst(1), mSpring(checkProgress, lerp(8.5, 5.8, style.motionIntensity), lerp(0.7, 1.05, style.motionIntensity)))) : mConst(1)
    const checkScale = mNumber(checkScaleExpression)
    const checkboxBase = graphShape({ id: checkboxId, name: `Checkbox: ${item.id}`, parentId: rowId, shape: 'ellipse', width: layout.iconSize, height: layout.iconSize, fillColor: item.state === 'complete' ? `${style.accentColor}18` : 'transparent', strokeColor: item.state === 'complete' ? style.accentColor : style.mutedColor, strokeWidth: 2.4, radius: layout.iconSize / 2 })
    const checkbox = Object.freeze({ ...checkboxBase, transform: Object.freeze({ ...checkboxBase.transform, scaleX: checkScale, scaleY: checkScale }) })
    const checkmarkBase = graphPath({ id: checkmarkId, name: `Checkmark: ${item.id}`, parentId: rowId, pathData: 'M11.5 20.5 17.2 26 29.2 13.8', fillColor: 'transparent', strokeColor: style.accentColor, strokeWidth: 3.2 })
    const checkmark = Object.freeze({ ...checkmarkBase, visible: constant(item.state === 'complete'), trimProgress: mNumber(checkProgress), transform: Object.freeze({ ...checkmarkBase.transform, scaleX: checkScale, scaleY: checkScale }) })
    const label = graphText({ id: labelId, name: `Label: ${item.id}`, parentId: rowId, text: item.label, color: item.state === 'complete' ? style.textColor : style.mutedColor, fontFamily: style.fontFamily, fontSize: layout.items[index]!.fontSize, fontWeight: item.state === 'complete' ? 650 : 520 })
    return [[row.id, row], [checkbox.id, checkbox], [checkmark.id, checkmark], [label.id, label]] as const
  }))
  const footerBase = graphText({ id: footerId, name: 'Footer', parentId: rootId, text: props.footer, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: layout.footerFontSize, fontWeight: 600 })
  const footer = Object.freeze({ ...footerBase, visible: constant(Boolean(props.footer.trim())) })
  const exposures: MotionExposureV1[] = [
    { id: 'checklist.eyebrow', label: 'Eyebrow', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'eyebrow' }, editor: { type: 'text' }, keyframeable: false },
    { id: 'checklist.title', label: 'Title', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'title' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: 'checklist.rows', label: 'Rows', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'items' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: 'checklist.completed', label: 'Completed rows', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'completedCount' }, editor: { type: 'slider' }, keyframeable: false, constraints: { minimum: 0, maximum: 6, step: 1 } },
    { id: 'checklist.footer', label: 'Footer', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'footer' }, editor: { type: 'text' }, keyframeable: false },
    { id: 'checklist.text-color', label: 'Text color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'textColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: 'checklist.accent-color', label: 'Accent color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'accentColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: 'checklist.radius', label: 'Roundness', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: surfaceId, property: 'shape.radius' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 120, step: 1 } },
    { id: 'checklist.surface-opacity', label: 'Surface opacity', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: surfaceId, property: 'opacity' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'checklist.border-width', label: 'Border width', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: surfaceId, property: 'shape.strokeWidth' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 12, step: 0.5 } },
    { id: 'checklist.position-x', label: 'Position X', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'transform.positionX' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: -500, maximum: 500, step: 1 } },
    { id: 'checklist.position-y', label: 'Position Y', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'transform.positionY' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: -500, maximum: 500, step: 1 } },
    { id: 'checklist.scale-x', label: 'Scale X', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'transform.scaleX' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0.25, maximum: 2, step: 0.01 } },
    { id: 'checklist.scale-y', label: 'Scale Y', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'transform.scaleY' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0.25, maximum: 2, step: 0.01 } },
    { id: 'checklist.rotation', label: 'Rotation', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'transform.rotationDeg' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: -180, maximum: 180, step: 1 } },
    { id: 'checklist.opacity', label: 'Overall opacity', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'opacity' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'checklist.motion-intensity', label: 'Motion intensity', group: 'Motion', level: 'designer', target: { kind: 'component', propertyId: 'motionIntensity' }, editor: { type: 'slider' }, keyframeable: false, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'checklist.parts', label: 'Row parts', group: 'Parts', level: 'advanced', target: { kind: 'part', semanticPartId: 'rows', property: 'opacity' }, editor: { type: 'readonly' }, keyframeable: true },
  ]
  const allRowNodes = [...rowGroupIds, ...checkboxIds, ...checkmarkIds, ...labelIds]
  return createMotionScene({
    componentId: 'sanverse.checklist-card', componentVersion: 1, rootNodeId: rootId,
    nodes: Object.freeze({ [root.id]: root, [surface.id]: surface, [titleGroup.id]: titleGroup, [eyebrow.id]: eyebrow, [title.id]: title, [progress.id]: progress, [progressTrack.id]: progressTrack, [progressFill.id]: progressFill, [progressCount.id]: progressCount, [rows.id]: rows, ...rowNodes, [footer.id]: footer }),
    semanticParts: Object.freeze([
      { id: 'surface', label: 'Surface', role: 'surface', nodeIds: Object.freeze([surfaceId]) },
      { id: 'title', label: 'Title', role: 'primary-text', nodeIds: Object.freeze([titleGroupId, eyebrowId, titleId]) },
      { id: 'progress', label: 'Progress', role: 'accent', nodeIds: Object.freeze([progressGroupId, progressTrackId, progressFillId, progressCountId]) },
      { id: 'rows', label: 'Rows', role: 'content-group', nodeIds: Object.freeze([rowsGroupId, ...allRowNodes]) },
      { id: 'checkboxes', label: 'Checkboxes', role: 'icon', nodeIds: Object.freeze(checkboxIds) },
      { id: 'checkmarks', label: 'Checkmarks', role: 'accent', nodeIds: Object.freeze(checkmarkIds) },
      { id: 'labels', label: 'Labels', role: 'secondary-text', nodeIds: Object.freeze(labelIds) },
      { id: 'footer', label: 'Footer', role: 'secondary-text', nodeIds: Object.freeze([footerId]) },
    ]),
    exposures: Object.freeze(exposures), layout: responsiveGraphLayout(), supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5']),
  })
}

export const evaluateChecklistCardState = (
  props: ChecklistCardProps,
  style: ChecklistCardStyle,
  context: MotionRenderContextV1,
): ChecklistCardState => {
  validateContext(context)
  const propsValidation = validateChecklistCardProps(props)
  if (!propsValidation.ok) throw new RangeError(propsValidation.issues[0]?.message ?? 'Invalid Checklist Card props.')
  const styleValidation = validateChecklistCardStyle(style)
  if (!styleValidation.ok) throw new RangeError(styleValidation.issues[0]?.message ?? 'Invalid Checklist Card style.')
  const fitValidation = validateChecklistCardFit(props, context)
  if (!fitValidation.ok) throw new RangeError(fitValidation.issues[0]?.message ?? 'Checklist Card content cannot fit this composition.')

  const progress = normalizedProgress(context.localTicks, context.durationTicks)
  const exit = sequenceProgress(progress, 0.82, 1)
  const titleWindow = sequenceProgress(progress, 0, 0.22)
  const rowWindow = sequenceProgress(progress, 0.08, 0.48)
  const checkWindow = sequenceProgress(progress, 0.24, 0.62)
  const exitFade = easeInCubic(exit)
  const intensity = style.motionIntensity
  const titleReveal = context.reducedMotion ? easeOutCubic(Math.min(1, progress / 0.10)) : easeOutCubic(titleWindow)

  const rows = props.items.map((item, index): ChecklistCardRowState => {
    const reveal = context.reducedMotion ? easeOutCubic(Math.min(1, progress / 0.14)) : easeOutCubic(staggerProgress({ progress: rowWindow, index, count: props.items.length, overlap: 0.54 }))
    const checkProgress = item.state === 'complete'
      ? context.reducedMotion
        ? easeOutCubic(Math.min(1, progress / 0.16))
        : easeOutCubic(staggerProgress({ progress: checkWindow, index, count: props.items.length, overlap: 0.62 }))
      : 0
    const checkScale = context.reducedMotion || item.state !== 'complete'
      ? 1
      : lerp(0.78, 1, springProgress({ progress: checkProgress, damping: lerp(8.5, 5.8, intensity), frequency: lerp(0.7, 1.05, intensity) }))
    return Object.freeze({
      index,
      opacity: reveal * (1 - exitFade),
      translateX: context.reducedMotion ? 0 : lerp(28 * lerp(0.45, 1.15, intensity), 0, reveal) - exit * 16 * intensity,
      checkProgress,
      checkScale,
    })
  })

  return Object.freeze({
    normalizedProgress: progress,
    phase: progress < 0.62 ? 'enter' : progress < 0.82 ? 'hold' : progress < 1 ? 'exit' : 'ended',
    panelOpacity: (context.reducedMotion ? easeOutCubic(Math.min(1, progress / 0.08)) : easeOutCubic(sequenceProgress(progress, 0, 0.16))) * (1 - exitFade),
    titleOpacity: titleReveal * (1 - exitFade),
    titleTranslateY: context.reducedMotion ? 0 : lerp(22 * intensity, 0, titleReveal) - exit * 12 * intensity,
    progressReveal: context.reducedMotion ? easeOutCubic(Math.min(1, progress / 0.14)) : easeOutCubic(sequenceProgress(progress, 0.12, 0.46)),
    rows: Object.freeze(rows),
    layout: fitValidation.value,
  })
}

const renderLinePlan = (plan: ChecklistCardLinePlan) => {
  const words = plan.text.trim().split(/\s+/u).filter(Boolean)
  return plan.lines.map((line, lineIndex) => (
    <span key={`line:${line.startWordIndex}:${line.endWordIndexExclusive}`} data-motion-line={lineIndex} style={{ display: 'block', whiteSpace: 'nowrap' }}>
      {words.slice(line.startWordIndex, line.endWordIndexExclusive).join(' ')}
    </span>
  ))
}

export function ChecklistCard({ props, style, context }: MotionComponentRenderPropsV1<ChecklistCardProps, ChecklistCardStyle>) {
  const state = evaluateChecklistCardState(props, style, context)
  const graph = useMotionGraphPresentation()
  const graphStyle = (nodeId: string, base: CSSProperties): CSSProperties => mergeMotionGraphNodeStyle(base, graph.scene?.nodes[nodeId] ?? null, graph.selectedNodeId === nodeId)
  const { width, height } = context.composition
  const completedCount = props.items.filter((item) => item.state === 'complete').length
  const surfaceNode = graph.scene?.nodes['checklist.surface']
  const surfaceShape = surfaceNode?.type === 'shape' ? surfaceNode : null
  const rootStyle = graphStyle('checklist.root', { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'hidden' })
  const cardStyle = mergeMotionGraphNodeDecorationStyle({
    width: state.layout.cardWidth,
    minHeight: state.layout.cardHeight,
    boxSizing: 'border-box',
    padding: state.layout.padding,
    borderRadius: surfaceShape?.radius ?? Math.round(Math.min(width, height) * 0.032),
    borderStyle: 'solid',
    borderWidth: surfaceShape?.strokeWidth ?? 2,
    borderColor: surfaceShape?.strokeColor ?? `${style.accentColor}28`,
    background: surfaceShape?.fillColor ?? style.surfaceColor,
    boxShadow: `0 ${Math.round(height * 0.018)}px ${Math.round(height * 0.06)}px rgba(0,0,0,.36)`,
    opacity: surfaceShape?.opacity ?? state.panelOpacity,
    color: style.textColor,
    fontFamily: style.fontFamily,
  }, surfaceShape, graph.selectedNodeId === 'checklist.surface')
  const titleGroupNode = graph.scene?.nodes['checklist.title-group']
  const titleGroup = titleGroupNode?.type === 'group' ? titleGroupNode : null
  const titleStyle = mergeMotionGraphNodeDecorationStyle({ opacity: titleGroup?.opacity ?? state.titleOpacity, transform: `translate3d(0, ${titleGroup?.transform.positionY ?? state.titleTranslateY}px, 0)` }, titleGroup, graph.selectedNodeId === 'checklist.title-group')
  const eyebrowNode = graph.scene?.nodes['checklist.eyebrow']
  const eyebrowText = eyebrowNode?.type === 'text' ? eyebrowNode : null
  const titleNode = graph.scene?.nodes['checklist.title']
  const titleText = titleNode?.type === 'text' ? titleNode : null
  const progressTrackNode = graph.scene?.nodes['checklist.progress-track']
  const progressTrackShape = progressTrackNode?.type === 'shape' ? progressTrackNode : null
  const progressFillNode = graph.scene?.nodes['checklist.progress-fill']
  const progressFillShape = progressFillNode?.type === 'shape' ? progressFillNode : null
  const progressCountNode = graph.scene?.nodes['checklist.progress-count']
  const progressCountText = progressCountNode?.type === 'text' ? progressCountNode : null

  return (
    <div data-motion-root="checklist-card" data-motion-node-id="checklist.root" data-motion-layout={state.layout.kind} style={rootStyle}>
      <section data-motion-node-id="checklist.surface" style={cardStyle}>
        <header data-motion-node-id="checklist.title-group" style={titleStyle}>
          {props.eyebrow.trim() ? <div data-motion-node-id="checklist.eyebrow" style={graphStyle('checklist.eyebrow', { color: eyebrowText?.fillColor ?? style.accentColor, fontSize: eyebrowText?.fontSize ?? state.layout.eyebrowFontSize, fontWeight: eyebrowText?.fontWeight ?? 800, letterSpacing: '.11em', marginBottom: 14 })}>{eyebrowText?.text ?? props.eyebrow}</div> : null}
          <div data-motion-node-id="checklist.title" data-motion-text="checklist-title" data-motion-font-size={state.layout.title.fontSize} style={graphStyle('checklist.title', { fontSize: titleText?.fontSize ?? state.layout.title.fontSize, lineHeight: `${state.layout.title.lineHeight}px`, fontWeight: titleText?.fontWeight ?? style.titleWeight, color: titleText?.fillColor, letterSpacing: '-.035em' })}>
            {renderLinePlan(state.layout.title)}
          </div>
          <div data-motion-node-id="checklist.progress" style={graphStyle('checklist.progress', { display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 })}>
            <div data-motion-node-id="checklist.progress-track" style={graphStyle('checklist.progress-track', { height: 7, flex: 1, overflow: 'hidden', borderRadius: progressTrackShape?.radius ?? 999, background: progressTrackShape?.fillColor ?? `${style.textColor}18` })}>
              <div data-motion-node-id="checklist.progress-fill" style={mergeMotionGraphNodeDecorationStyle({ width: `${props.items.length === 0 ? 0 : completedCount / props.items.length * 100}%`, height: '100%', background: progressFillShape?.fillColor ?? style.accentColor, transformOrigin: 'left center', transform: `scaleX(${progressFillShape?.transform.scaleX ?? state.progressReveal})` }, progressFillShape, graph.selectedNodeId === 'checklist.progress-fill')} />
            </div>
            <div data-motion-node-id="checklist.progress-count" style={graphStyle('checklist.progress-count', { color: progressCountText?.fillColor ?? style.mutedColor, fontSize: progressCountText?.fontSize ?? Math.round(state.layout.footerFontSize * 0.9), fontWeight: progressCountText?.fontWeight ?? 700 })}>{progressCountText?.text ?? `${completedCount}/${props.items.length}`}</div>
          </div>
        </header>

        <div data-motion-node-id="checklist.rows" style={graphStyle('checklist.rows', { display: 'grid', gap: state.layout.rowGap, marginTop: 28 })}>
          {props.items.map((item, index) => {
            const rowState = state.rows[index]!
            const linePlan = state.layout.items[index]!
            const rowId = `checklist.row:${item.id}`
            const rowNode = graph.scene?.nodes[rowId]
            const rowGroup = rowNode?.type === 'group' ? rowNode : null
            const checkboxId = `${rowId}.checkbox`
            const checkmarkId = `${rowId}.checkmark`
            const labelId = `${rowId}.label`
            const checkboxNode = graph.scene?.nodes[checkboxId]
            const checkboxShape = checkboxNode?.type === 'shape' ? checkboxNode : null
            const checkmarkNode = graph.scene?.nodes[checkmarkId]
            const checkmarkPath = checkmarkNode?.type === 'path' ? checkmarkNode : null
            const labelNode = graph.scene?.nodes[labelId]
            const labelText = labelNode?.type === 'text' ? labelNode : null
            return (
              <div key={item.id} data-motion-node-id={rowId} data-motion-row={index} data-motion-state={item.state} style={mergeMotionGraphNodeDecorationStyle({ display: 'grid', gridTemplateColumns: `${state.layout.iconSize}px 1fr`, gap: Math.round(state.layout.iconSize * 0.46), alignItems: 'center', opacity: rowGroup?.opacity ?? rowState.opacity, transform: `translate3d(${rowGroup?.transform.positionX ?? rowState.translateX}px, 0, 0)` }, rowGroup, graph.selectedNodeId === rowId)}>
                <svg width={state.layout.iconSize} height={state.layout.iconSize} viewBox="0 0 40 40" aria-hidden="true" style={{ transform: `scale(${checkboxShape?.transform.scaleX ?? rowState.checkScale})` }}>
                  <circle data-motion-node-id={checkboxId} cx="20" cy="20" r="17" fill={checkboxShape?.fillColor ?? (item.state === 'complete' ? `${style.accentColor}18` : 'transparent')} stroke={checkboxShape?.strokeColor ?? (item.state === 'complete' ? style.accentColor : style.mutedColor)} strokeWidth={checkboxShape?.strokeWidth ?? 2.4} opacity={item.state === 'complete' ? 1 : 0.55} style={mergeMotionGraphNodeDecorationStyle({}, checkboxShape, graph.selectedNodeId === checkboxId)} />
                  {item.state === 'complete' ? <path data-motion-node-id={checkmarkId} d={checkmarkPath?.pathData ?? 'M11.5 20.5 17.2 26 29.2 13.8'} fill="none" stroke={checkmarkPath?.strokeColor ?? style.accentColor} strokeWidth={checkmarkPath?.strokeWidth ?? 3.2} strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - (checkmarkPath?.trimProgress ?? rowState.checkProgress)} style={mergeMotionGraphNodeDecorationStyle({}, checkmarkPath, graph.selectedNodeId === checkmarkId)} /> : null}
                </svg>
                <div data-motion-node-id={labelId} data-motion-text={`checklist-item-${index}`} data-motion-font-size={linePlan.fontSize} style={graphStyle(labelId, { fontSize: labelText?.fontSize ?? linePlan.fontSize, lineHeight: `${linePlan.lineHeight}px`, color: labelText?.fillColor ?? (item.state === 'complete' ? style.textColor : style.mutedColor), fontWeight: labelText?.fontWeight ?? (item.state === 'complete' ? 650 : 520), letterSpacing: '-.018em' })}>
                  {renderLinePlan(linePlan)}
                </div>
              </div>
            )
          })}
        </div>

        {props.footer.trim() ? (() => {
          const footerNode = graph.scene?.nodes['checklist.footer']
          const footerText = footerNode?.type === 'text' ? footerNode : null
          return <footer data-motion-node-id="checklist.footer" style={graphStyle('checklist.footer', { marginTop: 28, paddingTop: 20, borderTop: `1px solid ${style.textColor}16`, color: footerText?.fillColor ?? style.mutedColor, fontSize: footerText?.fontSize ?? state.layout.footerFontSize, fontWeight: footerText?.fontWeight ?? 600, opacity: state.titleOpacity })}>{footerText?.text ?? props.footer}</footer>
        })() : null}
      </section>
    </div>
  )
}

export const CHECKLIST_CARD_DEFINITION = Object.freeze({
  id: 'sanverse.checklist-card',
  version: 1,
  name: 'Checklist Card',
  purpose: 'Show a short list of requirements, progress checks, launch steps or status items.',
  category: 'card',
  performanceClass: 'light',
  supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5'] as const),
  minDurationTicks: Math.round(SANVERSE_TICKS_PER_SECOND * 1.5),
  defaultDurationTicks: SANVERSE_TICKS_PER_SECOND * 5,
  maxDurationTicks: SANVERSE_TICKS_PER_SECOND * 12,
  events: Object.freeze([
    { name: 'enter-start', normalizedTime: 0 },
    { name: 'title-reveal', normalizedTime: 0.04 },
    { name: 'items-start', normalizedTime: 0.08 },
    { name: 'checks-start', normalizedTime: 0.24 },
    { name: 'settled', normalizedTime: 0.62 },
    { name: 'exit-start', normalizedTime: 0.82 },
  ]),
  contentLimits: Object.freeze([
    { field: 'title', description: 'Primary checklist title.', minimum: 1, maximum: 80, unit: 'characters' as const },
    { field: 'items', description: 'Checklist rows.', minimum: 1, maximum: 6, unit: 'items' as const },
    { field: 'items[].label', description: 'Text for one checklist row.', minimum: 1, maximum: 72, unit: 'characters' as const },
  ]),
  capabilities: FULL_NATIVE_GRAPH_CAPABILITIES,
} as const)

export const ChecklistCardModule: MotionGraphBackedComponentModuleV1<ChecklistCardProps, ChecklistCardStyle> = Object.freeze({
  definition: CHECKLIST_CARD_DEFINITION,
  defaultProps: DEFAULT_CHECKLIST_CARD_PROPS,
  defaultStyle: DEFAULT_CHECKLIST_CARD_STYLE,
  validateProps: validateChecklistCardProps,
  validateStyle: validateChecklistCardStyle,
  Component: ChecklistCard,
  createScene: createChecklistCardScene,
})
