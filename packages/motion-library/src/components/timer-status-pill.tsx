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
  formatClockSeconds,
  normalizedProgress,
  sequenceProgress,
  springProgress,
} from '@sanverse/motion-primitives'
import type { MotionExposureV1, MotionGraphBackedComponentModuleV1, MotionSceneV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene, motionString } from '@sanverse/motion-graph'
import { mergeMotionGraphNodeDecorationStyle, mergeMotionGraphNodeStyle, useMotionGraphPresentation } from '@sanverse/motion-native-runtime'
import { FULL_NATIVE_GRAPH_CAPABILITIES, graphGroup, graphPath, graphShape, graphText, responsiveGraphLayout } from '../graph-common.ts'
import { mAdd, mConst, mEase, mMax, mMultiply, mNumber, mOneMinus, mProgress, mReduced, mSequence, mSin, mSpring } from '../graph-motion.ts'
import { SANVERSE_CLEAN_STYLE } from '../style-packs.ts'
import { isRecord, unknownFieldIssues, validationFailure, validationSuccess, valueIssue } from '../validation.ts'

export interface TimerStatusPillProps {
  readonly label: string
  readonly status: string
  readonly caption: string
  readonly mode: 'countdown' | 'countup'
  readonly totalSeconds: number
  readonly alwaysShowHours: boolean
}

export interface TimerStatusPillStyle {
  readonly textColor: string
  readonly mutedColor: string
  readonly accentColor: string
  readonly surfaceColor: string
  readonly fontFamily: string
  readonly numberFontFamily: string
  readonly labelWeight: number
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

export interface TimerStatusPillLayout {
  readonly kind: 'wide' | 'compact'
  readonly pillWidth: number
  readonly pillHeight: number
  readonly maxHeight: number
  readonly padding: number
  readonly ringSize: number
  readonly textWidth: number
  readonly label: TextPlan
  readonly status: TextPlan
  readonly caption: TextPlan | null
  readonly timerFontSize: number
  readonly timerMinimumFontSize: number
}

export interface TimerStatusPillState {
  readonly normalizedProgress: number
  readonly timerProgress: number
  readonly phase: 'enter' | 'running' | 'hold' | 'exit' | 'ended'
  readonly displayedSeconds: number
  readonly displayedClock: string
  readonly progressRing: number
  readonly opacity: number
  readonly translateY: number
  readonly scale: number
  readonly statusDotScale: number
  readonly statusDotOpacity: number
  readonly layout: TimerStatusPillLayout
}

export const timerStatusPillStyleFromPack = (pack: MotionStylePackV1): TimerStatusPillStyle => ({
  textColor: pack.tokens.colors.text,
  mutedColor: pack.tokens.colors.textSecondary,
  accentColor: pack.tokens.colors.accent,
  surfaceColor: pack.tokens.colors.surface,
  fontFamily: pack.tokens.typography.bodyFont,
  numberFontFamily: pack.tokens.typography.numericFont,
  labelWeight: pack.tokens.typography.headingWeight,
  numberWeight: Math.min(900, pack.tokens.typography.headingWeight + 80),
  motionIntensity: pack.tokens.motion.intensity,
})

export const DEFAULT_TIMER_STATUS_PILL_PROPS: TimerStatusPillProps = Object.freeze({
  label: 'RECORDING WINDOW',
  status: 'LIVE',
  caption: 'Time left for this section',
  mode: 'countdown',
  totalSeconds: 90,
  alwaysShowHours: false,
})

export const DEFAULT_TIMER_STATUS_PILL_STYLE: TimerStatusPillStyle = Object.freeze(timerStatusPillStyleFromPack(SANVERSE_CLEAN_STYLE))

const propsFields = ['label', 'status', 'caption', 'mode', 'totalSeconds', 'alwaysShowHours'] as const
const styleFields = ['textColor', 'mutedColor', 'accentColor', 'surfaceColor', 'fontFamily', 'numberFontFamily', 'labelWeight', 'numberWeight', 'motionIntensity'] as const

const boundedStringIssue = (value: unknown, path: string, maximum: number, required = true) => {
  if (typeof value !== 'string') return valueIssue(path, 'TYPE_INVALID', `${path} must be a string.`)
  if (required && !value.trim()) return valueIssue(path, 'CONTENT_TOO_SMALL', `${path} cannot be empty.`)
  if (value.length > maximum) return valueIssue(path, 'CONTENT_TOO_LARGE', `${path} is limited to ${maximum} characters.`)
  return null
}

export const validateTimerStatusPillProps = (input: unknown): MotionValidationResultV1<TimerStatusPillProps> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Timer / Status Pill props must be an object.'))
  const issues = [...unknownFieldIssues(input, propsFields)]
  for (const issue of [
    boundedStringIssue(input.label, '$.label', 32),
    boundedStringIssue(input.status, '$.status', 24),
    boundedStringIssue(input.caption, '$.caption', 56, false),
  ]) if (issue) issues.push(issue)
  if (input.mode !== 'countdown' && input.mode !== 'countup') issues.push(valueIssue('$.mode', 'VALUE_INVALID', 'mode must be countdown or countup.'))
  if (!Number.isSafeInteger(input.totalSeconds) || (input.totalSeconds as number) < 1 || (input.totalSeconds as number) > 359_999) issues.push(valueIssue('$.totalSeconds', 'VALUE_OUT_OF_RANGE', 'totalSeconds must be an integer from 1 to 359999 (99:59:59).'))
  if (typeof input.alwaysShowHours !== 'boolean') issues.push(valueIssue('$.alwaysShowHours', 'TYPE_INVALID', 'alwaysShowHours must be boolean.'))
  if (issues.length > 0) return validationFailure(...issues)
  return validationSuccess(Object.freeze({
    label: input.label as string,
    status: input.status as string,
    caption: input.caption as string,
    mode: input.mode as TimerStatusPillProps['mode'],
    totalSeconds: input.totalSeconds as number,
    alwaysShowHours: input.alwaysShowHours as boolean,
  }))
}

export const validateTimerStatusPillStyle = (input: unknown): MotionValidationResultV1<TimerStatusPillStyle> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Timer / Status Pill style must be an object.'))
  const issues = [...unknownFieldIssues(input, styleFields)]
  for (const field of ['textColor', 'mutedColor', 'accentColor', 'surfaceColor', 'fontFamily', 'numberFontFamily'] as const) {
    if (typeof input[field] !== 'string' || !input[field].trim()) issues.push(valueIssue(`$.${field}`, 'TYPE_INVALID', `${field} must be a non-empty string.`))
  }
  for (const field of ['labelWeight', 'numberWeight'] as const) {
    if (typeof input[field] !== 'number' || !Number.isFinite(input[field]) || input[field] < 100 || input[field] > 900) issues.push(valueIssue(`$.${field}`, 'VALUE_OUT_OF_RANGE', `${field} must be between 100 and 900.`))
  }
  if (typeof input.motionIntensity !== 'number' || !Number.isFinite(input.motionIntensity) || input.motionIntensity < 0 || input.motionIntensity > 1) issues.push(valueIssue('$.motionIntensity', 'VALUE_OUT_OF_RANGE', 'motionIntensity must be inside [0, 1].'))
  if (issues.length > 0) return validationFailure(...issues)
  return validationSuccess(Object.freeze({
    textColor: input.textColor as string,
    mutedColor: input.mutedColor as string,
    accentColor: input.accentColor as string,
    surfaceColor: input.surfaceColor as string,
    fontFamily: input.fontFamily as string,
    numberFontFamily: input.numberFontFamily as string,
    labelWeight: input.labelWeight as number,
    numberWeight: input.numberWeight as number,
    motionIntensity: input.motionIntensity as number,
  }))
}

const validateContext = (context: MotionRenderContextV1): void => {
  if (!Number.isSafeInteger(context.durationTicks) || context.durationTicks <= 0) throw new RangeError('durationTicks must be a positive safe integer.')
  if (!Number.isSafeInteger(context.localTicks) || context.localTicks < 0 || context.localTicks > context.durationTicks) throw new RangeError('localTicks must be an in-range safe integer.')
  if (context.ticksPerSecond !== SANVERSE_TICKS_PER_SECOND) throw new RangeError('Timer / Status Pill requires the canonical Sanverse tick authority.')
}

const fitText = (text: string, width: number, maxLines: number, preferred: number, minimum: number): MotionValidationResultV1<TextPlan> => {
  const words = text.trim().split(/\s+/u).filter(Boolean)
  const fit = fitWordLines(words, { maxWidth: width, maxLines, preferredFontSize: preferred, minimumFontSize: minimum, fontSizeStep: 1, letterSpacingEm: -0.02, spaceWidthEm: 0.34 })
  if (!fit.ok) return validationFailure(valueIssue('$.text', 'CONTENT_IMPOSSIBLE', fit.reason === 'TOKEN_TOO_WIDE' ? `Text contains a word too wide at ${minimum}px.` : `Text needs ${String(fit.requiredLineCount ?? 'more')} lines but only ${maxLines} are allowed.`))
  return validationSuccess(Object.freeze({
    text,
    fontSize: fit.fontSize,
    minimumFontSize: minimum,
    lineHeight: fit.fontSize * 1.12,
    lines: Object.freeze(fit.lines.map((line) => Object.freeze({ startWordIndex: line.startTokenIndex, endWordIndexExclusive: line.endTokenIndexExclusive, estimatedWidth: line.estimatedWidth }))),
  }))
}

export const validateTimerStatusPillFit = (props: TimerStatusPillProps, context: MotionRenderContextV1): MotionValidationResultV1<TimerStatusPillLayout> => {
  validateContext(context)
  const { width, height } = context.composition
  const kind: TimerStatusPillLayout['kind'] = width / height > 1.15 ? 'wide' : 'compact'
  const shortSide = Math.min(width, height)
  const pillWidth = Math.round(kind === 'wide' ? Math.min(width * 0.58, 980) : width * 0.78)
  const padding = Math.round(Math.max(30, Math.min(54, shortSide * 0.045)))
  const ringSize = Math.round(Math.max(82, Math.min(132, shortSide * 0.105)))
  const textWidth = kind === 'wide'
    ? pillWidth - padding * 2 - ringSize - Math.round(shortSide * 0.045)
    : pillWidth - padding * 2

  const labelFit = fitText(props.label, textWidth, 1, kind === 'wide' ? 31 : 28, 22)
  if (!labelFit.ok) return validationFailure({ ...labelFit.issues[0]!, path: '$.label' })
  const statusFit = fitText(props.status, Math.max(150, textWidth * 0.42), 1, kind === 'wide' ? 24 : 22, 18)
  if (!statusFit.ok) return validationFailure({ ...statusFit.issues[0]!, path: '$.status' })
  const captionFit = props.caption.trim()
    ? fitText(props.caption, textWidth, 2, kind === 'wide' ? 25 : 23, 18)
    : null
  if (captionFit && !captionFit.ok) return validationFailure({ ...captionFit.issues[0]!, path: '$.caption' })

  const timerText = formatClockSeconds(props.totalSeconds, { alwaysShowHours: props.alwaysShowHours })
  const timerWidth = kind === 'wide' ? textWidth : pillWidth - padding * 2
  const timerFit = fitText(timerText, timerWidth, 1, kind === 'wide' ? 88 : 74, 44)
  if (!timerFit.ok) return validationFailure(valueIssue('$.totalSeconds', 'CONTENT_IMPOSSIBLE', 'Formatted timer cannot fit at the minimum readable size.'))

  const compactTextHeight = labelFit.value.lineHeight + timerFit.value.lineHeight + (captionFit?.ok ? captionFit.value.lines.length * captionFit.value.lineHeight : 0) + statusFit.value.lineHeight + 40
  const pillHeight = Math.round(kind === 'wide'
    ? Math.max(ringSize + padding * 1.25, labelFit.value.lineHeight + timerFit.value.lineHeight + (captionFit?.ok ? captionFit.value.lines.length * captionFit.value.lineHeight : 0) + padding * 2 + 18)
    : ringSize + compactTextHeight + padding * 2 + 22)
  const maxHeight = Math.round(height * 0.72)
  if (pillHeight > maxHeight) return validationFailure(valueIssue('$', 'CONTENT_IMPOSSIBLE', `Timer pill needs ${pillHeight}px of height but this composition allows ${maxHeight}px at readable sizes.`))

  return validationSuccess(Object.freeze({
    kind,
    pillWidth,
    pillHeight,
    maxHeight,
    padding,
    ringSize,
    textWidth,
    label: labelFit.value,
    status: statusFit.value,
    caption: captionFit?.ok ? captionFit.value : null,
    timerFontSize: timerFit.value.fontSize,
    timerMinimumFontSize: timerFit.value.minimumFontSize,
  }))
}

export const createTimerStatusPillScene = (props: TimerStatusPillProps, style: TimerStatusPillStyle, context: MotionRenderContextV1): MotionSceneV1 => {
  const fit = validateTimerStatusPillFit(props, context)
  if (!fit.ok) throw new RangeError(fit.issues[0]?.message ?? 'Timer / Status Pill content cannot fit.')
  const layout = fit.value
  const ids = {
    root: 'timer.root', surface: 'timer.surface', progress: 'timer.progress', progressTrack: 'timer.progress.track', progressRing: 'timer.progress.ring', progressCenter: 'timer.progress.center',
    content: 'timer.content', label: 'timer.label', status: 'timer.status', statusSurface: 'timer.status.surface', statusDot: 'timer.status.dot', statusText: 'timer.status.text', timeValue: 'timer.timeValue', caption: 'timer.caption',
  } as const
  const root = graphGroup(ids.root, 'Timer / Status Pill', null, [ids.surface, ids.progress, ids.content])
  const motionProgress = mProgress()
  const timerProgress = mSequence(0.12, 0.72, motionProgress)
  const exit = mSequence(0.84, 1, motionProgress)
  const remain = mOneMinus(mEase('ease-in-cubic', exit))
  const reveal = mReduced(mEase('ease-out-cubic', mSequence(0, 0.08, motionProgress)), mEase('ease-out-cubic', mSequence(0, 0.16, motionProgress)))
  const settle = mReduced(mConst(1), mSpring(mSequence(0.08, 0.26, motionProgress), 7.4 - 1.8 * style.motionIntensity, 0.72 + 0.34 * style.motionIntensity))
  const pulse = mMultiply(mSin(mSequence(0.20, 0.84, motionProgress), 3), mConst(style.motionIntensity))
  const positivePulse = mMax(mConst(0), pulse)
  const surfaceBase = graphShape({ id: ids.surface, name: 'Surface', parentId: ids.root, width: layout.pillWidth, height: layout.pillHeight, fillColor: style.surfaceColor, strokeColor: `${style.accentColor}28`, strokeWidth: 2, radius: Math.min(999, Math.round(Math.min(context.composition.width, context.composition.height) * 0.08)) })
  const surfaceScale = mReduced(mConst(1), mAdd(mConst(0.94), mMultiply(mConst(0.06), settle)))
  const surface = Object.freeze({ ...surfaceBase, opacity: mNumber(mMultiply(reveal, remain)), transform: Object.freeze({ ...surfaceBase.transform, positionY: mNumber(mReduced(mConst(0), mAdd(mMultiply(mOneMinus(reveal), mConst(24 * style.motionIntensity)), mMultiply(exit, mConst(12 * style.motionIntensity))))), scaleX: mNumber(surfaceScale), scaleY: mNumber(surfaceScale) }) })
  const progress = graphGroup(ids.progress, 'Progress', ids.root, [ids.progressTrack, ids.progressRing, ids.progressCenter])
  const progressTrack = graphShape({ id: ids.progressTrack, name: 'Progress Track', parentId: ids.progress, shape: 'ellipse', width: layout.ringSize, height: layout.ringSize, fillColor: 'transparent', strokeColor: `${style.textColor}16`, strokeWidth: Math.max(7, Math.round(layout.ringSize * 0.075)), radius: layout.ringSize / 2 })
  const progressRingBase = graphPath({ id: ids.progressRing, name: 'Progress Ring', parentId: ids.progress, pathData: 'circle:50,50,41', fillColor: 'transparent', strokeColor: style.accentColor, strokeWidth: Math.max(7, Math.round(layout.ringSize * 0.075)) })
  const progressRing = Object.freeze({ ...progressRingBase, trimProgress: mNumber(timerProgress) })
  const progressCenter = graphShape({ id: ids.progressCenter, name: 'Progress Center', parentId: ids.progress, shape: 'ellipse', width: layout.ringSize * 0.1, height: layout.ringSize * 0.1, fillColor: style.accentColor, strokeColor: 'transparent', strokeWidth: 0, radius: layout.ringSize * 0.05 })
  const content = graphGroup(ids.content, 'Content', ids.root, [ids.label, ids.status, ids.timeValue, ids.caption])
  const label = graphText({ id: ids.label, name: 'Label', parentId: ids.content, text: props.label, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: layout.label.fontSize, fontWeight: style.labelWeight })
  const status = graphGroup(ids.status, 'Status', ids.content, [ids.statusSurface, ids.statusDot, ids.statusText])
  const statusSurface = graphShape({ id: ids.statusSurface, name: 'Status Surface', parentId: ids.status, width: 1, height: 1, fillColor: `${style.accentColor}12`, strokeColor: `${style.accentColor}35`, strokeWidth: 1, radius: 999 })
  const statusDotBase = graphShape({ id: ids.statusDot, name: 'Status Dot', parentId: ids.status, shape: 'ellipse', width: 10, height: 10, fillColor: style.accentColor, strokeColor: 'transparent', strokeWidth: 0, radius: 5 })
  const statusDotScale = mReduced(mConst(1), mAdd(mConst(1), mMultiply(positivePulse, mConst(0.12))))
  const statusDotOpacity = mMultiply(mReduced(mConst(1), mAdd(mConst(0.76), mMultiply(positivePulse, mConst(0.24)))), remain)
  const statusDot = Object.freeze({ ...statusDotBase, opacity: mNumber(statusDotOpacity), transform: Object.freeze({ ...statusDotBase.transform, scaleX: mNumber(statusDotScale), scaleY: mNumber(statusDotScale) }) })
  const statusText = graphText({ id: ids.statusText, name: 'Status Text', parentId: ids.status, text: props.status, color: style.accentColor, fontFamily: style.fontFamily, fontSize: layout.status.fontSize, fontWeight: 800 })
  const timeValueBase = graphText({ id: ids.timeValue, name: 'Time Value', parentId: ids.content, text: formatClockSeconds(props.totalSeconds, { alwaysShowHours: props.alwaysShowHours }), color: style.textColor, fontFamily: style.numberFontFamily, fontSize: layout.timerFontSize, fontWeight: style.numberWeight })
  const timeValue = Object.freeze({ ...timeValueBase, text: motionString({ kind: 'clock', totalSeconds: props.totalSeconds, mode: props.mode, start: 0.12, end: 0.72, alwaysShowHours: props.alwaysShowHours }) })
  const captionBase = graphText({ id: ids.caption, name: 'Caption', parentId: ids.content, text: props.caption, color: style.mutedColor, fontFamily: style.fontFamily, fontSize: layout.caption?.fontSize ?? 18, fontWeight: 520 })
  const caption = Object.freeze({ ...captionBase, visible: constant(Boolean(props.caption.trim())) })
  const exposures: MotionExposureV1[] = [
    { id: 'timer.label', label: 'Timer label', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'label' }, editor: { type: 'text' }, keyframeable: false },
    { id: 'timer.status', label: 'Status', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'status' }, editor: { type: 'text' }, keyframeable: false },
    { id: 'timer.caption', label: 'Caption', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'caption' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: 'timer.mode', label: 'Mode', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'mode' }, editor: { type: 'select', options: [{ label: 'Countdown', value: 'countdown' }, { label: 'Count up', value: 'countup' }] }, keyframeable: false },
    { id: 'timer.total-seconds', label: 'Total seconds', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'totalSeconds' }, editor: { type: 'number' }, keyframeable: false, constraints: { minimum: 1, maximum: 359999, step: 1 } },
    { id: 'timer.hours', label: 'Always show hours', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'alwaysShowHours' }, editor: { type: 'toggle' }, keyframeable: false },
    { id: 'timer.text-color', label: 'Text color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'textColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: 'timer.accent-color', label: 'Accent color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'accentColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: 'timer.radius', label: 'Roundness', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: ids.surface, property: 'shape.radius' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 220, step: 1 } },
    { id: 'timer.surface-opacity', label: 'Surface opacity', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: ids.surface, property: 'opacity' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'timer.border-width', label: 'Border width', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: ids.surface, property: 'shape.strokeWidth' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 12, step: 0.5 } },
    ...(['transform.positionX','transform.positionY','transform.scaleX','transform.scaleY','transform.rotationDeg','opacity'] as const).map((property, index) => ({ id: `timer.transform.${index}`, label: property, group: 'Transform' as const, level: 'designer' as const, target: { kind: 'node' as const, nodeId: ids.root, property }, editor: { type: 'slider' as const }, keyframeable: true, constraints: property === 'opacity' ? { minimum: 0, maximum: 1, step: 0.01 } : property.includes('scale') ? { minimum: 0.25, maximum: 2, step: 0.01 } : property.includes('rotation') ? { minimum: -180, maximum: 180, step: 1 } : { minimum: -500, maximum: 500, step: 1 } })),
    { id: 'timer.motion-intensity', label: 'Motion intensity', group: 'Motion', level: 'designer', target: { kind: 'component', propertyId: 'motionIntensity' }, editor: { type: 'slider' }, keyframeable: false, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'timer.parts', label: 'Semantic parts', group: 'Parts', level: 'advanced', target: { kind: 'part', semanticPartId: 'progress', property: 'opacity' }, editor: { type: 'readonly' }, keyframeable: true },
  ]
  return createMotionScene({
    componentId: 'sanverse.timer-status-pill', componentVersion: 1, rootNodeId: ids.root,
    nodes: Object.freeze({ [root.id]: root, [surface.id]: surface, [progress.id]: progress, [progressTrack.id]: progressTrack, [progressRing.id]: progressRing, [progressCenter.id]: progressCenter, [content.id]: content, [label.id]: label, [status.id]: status, [statusSurface.id]: statusSurface, [statusDot.id]: statusDot, [statusText.id]: statusText, [timeValue.id]: timeValue, [caption.id]: caption }),
    semanticParts: Object.freeze([
      { id: 'surface', label: 'Surface', role: 'surface', nodeIds: Object.freeze([ids.surface]) },
      { id: 'progress', label: 'Progress', role: 'icon', nodeIds: Object.freeze([ids.progress, ids.progressTrack, ids.progressRing, ids.progressCenter]) },
      { id: 'content', label: 'Content', role: 'content-group', nodeIds: Object.freeze([ids.content]) },
      { id: 'label', label: 'Label', role: 'primary-text', nodeIds: Object.freeze([ids.label]) },
      { id: 'status', label: 'Status', role: 'accent', nodeIds: Object.freeze([ids.status, ids.statusSurface, ids.statusDot, ids.statusText]) },
      { id: 'timeValue', label: 'Time Value', role: 'value', nodeIds: Object.freeze([ids.timeValue]) },
      { id: 'caption', label: 'Caption', role: 'secondary-text', nodeIds: Object.freeze([ids.caption]) },
    ]),
    exposures: Object.freeze(exposures), layout: responsiveGraphLayout(), supportedAspectRatios: Object.freeze(['16:9','9:16','1:1','4:5']),
  })
}

export const evaluateTimerStatusPillState = (
  props: TimerStatusPillProps,
  style: TimerStatusPillStyle,
  context: MotionRenderContextV1,
): TimerStatusPillState => {
  validateContext(context)
  const propsValidation = validateTimerStatusPillProps(props)
  if (!propsValidation.ok) throw new RangeError(propsValidation.issues[0]?.message ?? 'Invalid Timer / Status Pill props.')
  const styleValidation = validateTimerStatusPillStyle(style)
  if (!styleValidation.ok) throw new RangeError(styleValidation.issues[0]?.message ?? 'Invalid Timer / Status Pill style.')
  const fitValidation = validateTimerStatusPillFit(props, context)
  if (!fitValidation.ok) throw new RangeError(fitValidation.issues[0]?.message ?? 'Timer / Status Pill content cannot fit.')

  const progress = normalizedProgress(context.localTicks, context.durationTicks)
  const timerProgress = sequenceProgress(progress, 0.12, 0.72)
  const timerSteps = Math.floor(props.totalSeconds * timerProgress)
  const displayedSeconds = props.mode === 'countdown'
    ? Math.max(0, props.totalSeconds - timerSteps)
    : Math.min(props.totalSeconds, timerSteps)
  const exit = sequenceProgress(progress, 0.84, 1)
  const exitFade = easeInCubic(exit)
  const reveal = context.reducedMotion
    ? easeOutCubic(Math.min(1, progress / 0.08))
    : easeOutCubic(sequenceProgress(progress, 0, 0.16))
  const intensity = style.motionIntensity
  const settle = context.reducedMotion
    ? 1
    : springProgress({ progress: sequenceProgress(progress, 0.08, 0.26), damping: 7.4 - 1.8 * intensity, frequency: 0.72 + 0.34 * intensity })
  const pulsePhase = sequenceProgress(progress, 0.20, 0.84)
  const pulse = context.reducedMotion ? 0 : Math.sin(pulsePhase * Math.PI * 6) * intensity

  return Object.freeze({
    normalizedProgress: progress,
    timerProgress,
    phase: progress < 0.12 ? 'enter' : progress < 0.72 ? 'running' : progress < 0.84 ? 'hold' : progress < 1 ? 'exit' : 'ended',
    displayedSeconds,
    displayedClock: formatClockSeconds(displayedSeconds, { alwaysShowHours: props.alwaysShowHours }),
    progressRing: timerProgress,
    opacity: reveal * (1 - exitFade),
    translateY: context.reducedMotion ? 0 : (1 - reveal) * 24 * intensity + exit * 12 * intensity,
    scale: context.reducedMotion ? 1 : 0.94 + 0.06 * settle,
    statusDotScale: context.reducedMotion ? 1 : 1 + Math.max(0, pulse) * 0.12,
    statusDotOpacity: (context.reducedMotion ? 1 : 0.76 + Math.max(0, pulse) * 0.24) * (1 - exitFade),
    layout: fitValidation.value,
  })
}

const renderPlan = (plan: TextPlan) => {
  const words = plan.text.trim().split(/\s+/u).filter(Boolean)
  return plan.lines.map((line, index) => (
    <span key={`${line.startWordIndex}:${line.endWordIndexExclusive}`} data-motion-line={index} style={{ display: 'block', whiteSpace: 'nowrap' }}>
      {words.slice(line.startWordIndex, line.endWordIndexExclusive).join(' ')}
    </span>
  ))
}

export function TimerStatusPill({ props, style, context }: MotionComponentRenderPropsV1<TimerStatusPillProps, TimerStatusPillStyle>) {
  const state = evaluateTimerStatusPillState(props, style, context)
  const graph = useMotionGraphPresentation()
  const graphStyle = (nodeId: string, base: CSSProperties): CSSProperties => mergeMotionGraphNodeStyle(base, graph.scene?.nodes[nodeId] ?? null, graph.selectedNodeId === nodeId)
  const { width, height } = context.composition
  const ringStroke = Math.max(7, Math.round(state.layout.ringSize * 0.075))
  const textNode = (id: string) => { const node = graph.scene?.nodes[id]; return node?.type === 'text' ? node : null }
  const shapeNode = (id: string) => { const node = graph.scene?.nodes[id]; return node?.type === 'shape' ? node : null }
  const pathNode = (id: string) => { const node = graph.scene?.nodes[id]; return node?.type === 'path' ? node : null }
  const label = textNode('timer.label')
  const statusText = textNode('timer.status.text')
  const clock = textNode('timer.timeValue')
  const caption = textNode('timer.caption')
  const statusSurface = shapeNode('timer.status.surface')
  const statusDot = shapeNode('timer.status.dot')
  const progressTrack = shapeNode('timer.progress.track')
  const progressRing = pathNode('timer.progress.ring')
  const progressCenter = shapeNode('timer.progress.center')
  const surface = shapeNode('timer.surface')

  const textBlock = (
    <div data-motion-node-id="timer.content" style={graphStyle('timer.content', { minWidth: 0 })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div data-motion-node-id="timer.label" data-motion-text="timer-label" style={graphStyle('timer.label', { color: label?.fillColor ?? style.mutedColor, fontSize: label?.fontSize ?? state.layout.label.fontSize, lineHeight: `${state.layout.label.lineHeight}px`, fontWeight: label?.fontWeight ?? style.labelWeight, letterSpacing: '.035em' })}>
          {renderPlan(state.layout.label)}
        </div>
        <div data-motion-node-id="timer.status" data-motion-surface-node-id="timer.status.surface" style={graphStyle('timer.status', graphStyle('timer.status.surface', { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 11px', borderRadius: statusSurface?.radius ?? 999, borderStyle: 'solid', borderWidth: statusSurface?.strokeWidth ?? 1, borderColor: statusSurface?.strokeColor ?? `${style.accentColor}35`, background: statusSurface?.fillColor ?? `${style.accentColor}12` }))}>
          <span data-motion-node-id="timer.status.dot" aria-hidden="true" style={mergeMotionGraphNodeDecorationStyle({ width: statusDot?.width ?? 10, height: statusDot?.height ?? 10, borderRadius: '50%', background: statusDot?.fillColor ?? style.accentColor, boxShadow: `0 0 18px ${style.accentColor}70`, opacity: statusDot?.opacity ?? state.statusDotOpacity, transform: `scale(${statusDot?.transform.scaleX ?? state.statusDotScale})` }, statusDot, graph.selectedNodeId === 'timer.status.dot')} />
          <span data-motion-node-id="timer.status.text" data-motion-text="timer-status" style={graphStyle('timer.status.text', { color: statusText?.fillColor ?? style.accentColor, fontSize: statusText?.fontSize ?? state.layout.status.fontSize, lineHeight: 1, fontWeight: statusText?.fontWeight ?? 800, letterSpacing: '.08em' })}>{statusText?.text ?? props.status}</span>
        </div>
      </div>
      <div data-motion-node-id="timer.timeValue" data-motion-clock="true" style={graphStyle('timer.timeValue', { marginTop: 8, color: clock?.fillColor ?? style.textColor, fontFamily: style.numberFontFamily, fontSize: clock?.fontSize ?? state.layout.timerFontSize, lineHeight: 1, fontWeight: clock?.fontWeight ?? style.numberWeight, letterSpacing: '-.055em', whiteSpace: 'nowrap' })}>
        {clock?.text ?? state.displayedClock}
      </div>
      {state.layout.caption ? (
        <div data-motion-node-id="timer.caption" data-motion-text="timer-caption" style={graphStyle('timer.caption', { marginTop: 10, color: caption?.fillColor ?? style.mutedColor, fontSize: caption?.fontSize ?? state.layout.caption.fontSize, lineHeight: `${state.layout.caption.lineHeight}px`, fontWeight: caption?.fontWeight ?? 520 })}>
          {renderPlan(state.layout.caption)}
        </div>
      ) : null}
    </div>
  )

  const ring = (
    <svg data-motion-node-id="timer.progress" width={state.layout.ringSize} height={state.layout.ringSize} viewBox="0 0 100 100" aria-hidden="true" data-motion-progress-ring="true" style={graphStyle('timer.progress', {})}>
      <circle data-motion-node-id="timer.progress.track" cx="50" cy="50" r="41" fill="none" stroke={progressTrack?.strokeColor ?? `${style.textColor}16`} strokeWidth={(progressTrack?.strokeWidth ?? ringStroke) / state.layout.ringSize * 100} style={graphStyle('timer.progress.track', {})} />
      <circle data-motion-node-id="timer.progress.ring" cx="50" cy="50" r="41" fill="none" stroke={progressRing?.strokeColor ?? style.accentColor} strokeWidth={(progressRing?.strokeWidth ?? ringStroke) / state.layout.ringSize * 100} strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - (progressRing?.trimProgress ?? state.progressRing)} transform="rotate(-90 50 50)" style={mergeMotionGraphNodeDecorationStyle({}, progressRing, graph.selectedNodeId === 'timer.progress.ring')} />
      <circle data-motion-node-id="timer.progress.center" cx="50" cy="50" r="5" fill={progressCenter?.fillColor ?? style.accentColor} opacity={0.9} style={graphStyle('timer.progress.center', {})} />
    </svg>
  )

  const contentStyle: CSSProperties = state.layout.kind === 'wide'
    ? { display: 'grid', gridTemplateColumns: `${state.layout.ringSize}px 1fr`, gap: Math.round(state.layout.padding * 0.7), alignItems: 'center' }
    : { display: 'grid', justifyItems: 'center', gap: 18, textAlign: 'center' }
  const rootStyle = graphStyle('timer.root', { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', fontFamily: style.fontFamily })
  const surfaceStyle = mergeMotionGraphNodeDecorationStyle({ width: state.layout.pillWidth, minHeight: state.layout.pillHeight, boxSizing: 'border-box', padding: state.layout.padding, borderRadius: surface?.radius ?? Math.min(999, Math.round(Math.min(width, height) * 0.08)), borderStyle: 'solid', borderWidth: surface?.strokeWidth ?? 2, borderColor: surface?.strokeColor ?? `${style.accentColor}28`, background: surface?.fillColor ?? style.surfaceColor, boxShadow: `0 ${Math.round(height * 0.015)}px ${Math.round(height * 0.05)}px rgba(0,0,0,.32)`, color: style.textColor, opacity: surface?.opacity ?? state.opacity, transform: `translate3d(0,${surface?.transform.positionY ?? state.translateY}px,0) scale(${surface?.transform.scaleX ?? state.scale})` }, surface, graph.selectedNodeId === 'timer.surface')

  return (
    <div data-motion-root="timer-status-pill" data-motion-node-id="timer.root" data-motion-layout={state.layout.kind} style={rootStyle}>
      <section data-motion-node-id="timer.surface" style={surfaceStyle}>
        <div style={contentStyle}>
          {ring}
          {textBlock}
        </div>
      </section>
    </div>
  )
}

export const TIMER_STATUS_PILL_DEFINITION = Object.freeze({
  id: 'sanverse.timer-status-pill',
  version: 1,
  name: 'Timer / Status Pill',
  purpose: 'Show a bounded countdown/countup with live status and progress in an exact-seek-safe graphic.',
  category: 'timer',
  performanceClass: 'light',
  supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5'] as const),
  minDurationTicks: SANVERSE_TICKS_PER_SECOND,
  defaultDurationTicks: SANVERSE_TICKS_PER_SECOND * 5,
  maxDurationTicks: SANVERSE_TICKS_PER_SECOND * 30,
  events: Object.freeze([
    { name: 'enter-start', normalizedTime: 0 },
    { name: 'timer-start', normalizedTime: 0.12 },
    { name: 'timer-halfway', normalizedTime: 0.42 },
    { name: 'timer-end', normalizedTime: 0.72 },
    { name: 'settled', normalizedTime: 0.76 },
    { name: 'exit-start', normalizedTime: 0.84 },
  ]),
  contentLimits: Object.freeze([
    { field: 'label', description: 'Timer label.', minimum: 1, maximum: 32, unit: 'characters' as const },
    { field: 'status', description: 'Short status text.', minimum: 1, maximum: 24, unit: 'characters' as const },
    { field: 'totalSeconds', description: 'Timer semantic duration in seconds.', minimum: 1, maximum: 359_999, unit: 'seconds' as const },
  ]),
  capabilities: FULL_NATIVE_GRAPH_CAPABILITIES,
} as const)

export const TimerStatusPillModule: MotionGraphBackedComponentModuleV1<TimerStatusPillProps, TimerStatusPillStyle> = Object.freeze({
  definition: TIMER_STATUS_PILL_DEFINITION,
  defaultProps: DEFAULT_TIMER_STATUS_PILL_PROPS,
  defaultStyle: DEFAULT_TIMER_STATUS_PILL_STYLE,
  validateProps: validateTimerStatusPillProps,
  validateStyle: validateTimerStatusPillStyle,
  Component: TimerStatusPill,
  createScene: createTimerStatusPillScene,
})

