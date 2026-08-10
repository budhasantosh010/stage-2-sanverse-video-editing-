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
  enterHoldExit,
  lerp,
  normalizedProgress,
  springProgress,
  wordRevealProgress,
} from '@sanverse/motion-primitives'
import type { MotionExposureV1, MotionGraphBackedComponentModuleV1, MotionSceneV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene, keyframed } from '@sanverse/motion-graph'
import { mergeMotionGraphNodeDecorationStyle, mergeMotionGraphNodeStyle, useMotionGraphPresentation } from '@sanverse/motion-native-runtime'
import { FULL_NATIVE_GRAPH_CAPABILITIES, graphGroup, graphShape, graphText, responsiveGraphLayout, stableWordNodeIds } from '../graph-common.ts'
import { mAdd, mConst, mEase, mLerp, mMax, mMultiply, mNumber, mOneMinus, mProgress, mReduced, mSequence, mSpring, mStagger, mSubtract } from '../graph-motion.ts'
import { SANVERSE_CLEAN_STYLE } from '../style-packs.ts'
import { isRecord, unknownFieldIssues, validationFailure, validationSuccess, valueIssue } from '../validation.ts'

export interface KineticHeadlineProps {
  readonly text: string
  readonly emphasisIndices: readonly number[]
  readonly alignment: 'left' | 'center' | 'right'
  readonly maxLines: 1 | 2 | 3
  /** A20 variant: preserve the original accent-text default or draw a semantic highlight box. */
  readonly emphasisTreatment?: 'accent-text' | 'highlight-box'
}

export interface KineticHeadlineStyle {
  readonly textColor: string
  readonly accentColor: string
  readonly fontFamily: string
  readonly fontWeight: number
  readonly background: 'none' | 'soft-panel'
  readonly motionIntensity: number
}

export interface KineticHeadlineWordState {
  readonly word: string
  readonly index: number
  readonly emphasized: boolean
  readonly opacity: number
  readonly translateY: number
  readonly scale: number
}

export interface KineticHeadlineState {
  readonly normalizedProgress: number
  readonly phase: 'enter' | 'settle' | 'hold' | 'exit' | 'ended'
  readonly layout: Readonly<{
    readonly kind: 'landscape' | 'portrait' | 'square'
    readonly maxWidth: number
    readonly fontSize: number
    readonly minimumFontSize: number
    readonly lineHeight: number
    readonly horizontalPadding: number
    readonly verticalPadding: number
    readonly lines: readonly Readonly<{
      readonly startWordIndex: number
      readonly endWordIndexExclusive: number
      readonly estimatedWidth: number
    }>[]
  }>
  readonly panelOpacity: number
  readonly words: readonly KineticHeadlineWordState[]
}

export const tokenizeHeadline = (text: string): readonly string[] => text.trim().split(/\s+/u).filter(Boolean)

export const kineticHeadlineStyleFromPack = (pack: MotionStylePackV1): KineticHeadlineStyle => ({
  textColor: pack.tokens.colors.text,
  accentColor: pack.tokens.colors.accent,
  fontFamily: pack.tokens.typography.displayFont,
  fontWeight: pack.tokens.typography.headingWeight,
  background: 'soft-panel',
  motionIntensity: pack.tokens.motion.intensity,
})

export const DEFAULT_KINETIC_HEADLINE_PROPS: KineticHeadlineProps = Object.freeze({
  text: 'Build videos 10× faster',
  emphasisIndices: Object.freeze([2]),
  alignment: 'center',
  maxLines: 2,
})

export const DEFAULT_KINETIC_HEADLINE_STYLE: KineticHeadlineStyle = Object.freeze(
  kineticHeadlineStyleFromPack(SANVERSE_CLEAN_STYLE),
)

const propsFields = ['text', 'emphasisIndices', 'alignment', 'maxLines', 'emphasisTreatment'] as const
const styleFields = ['textColor', 'accentColor', 'fontFamily', 'fontWeight', 'background', 'motionIntensity'] as const

export const validateKineticHeadlineProps = (input: unknown): MotionValidationResultV1<KineticHeadlineProps> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Headline props must be an object.'))
  const issues = [...unknownFieldIssues(input, propsFields)]

  const text = input.text
  if (typeof text !== 'string') issues.push(valueIssue('$.text', 'TYPE_INVALID', 'text must be a string.'))
  else if (!text.trim()) issues.push(valueIssue('$.text', 'CONTENT_TOO_SMALL', 'text cannot be empty or whitespace.'))
  else if (text.length > 180) issues.push(valueIssue('$.text', 'CONTENT_TOO_LARGE', 'Headline text is limited to 180 characters in V1.'))

  const words = typeof text === 'string' ? tokenizeHeadline(text) : []
  const emphasisInput = input.emphasisIndices
  if (!Array.isArray(emphasisInput)) issues.push(valueIssue('$.emphasisIndices', 'TYPE_INVALID', 'emphasisIndices must be an array.'))
  else {
    const seen = new Set<number>()
    emphasisInput.forEach((candidate, index) => {
      if (!Number.isSafeInteger(candidate)) issues.push(valueIssue(`$.emphasisIndices[${index}]`, 'TYPE_INVALID', 'Emphasis indices must be integers.'))
      else if ((candidate as number) < 0 || (candidate as number) >= words.length) issues.push(valueIssue(`$.emphasisIndices[${index}]`, 'VALUE_OUT_OF_RANGE', `Emphasis index ${String(candidate)} does not name a word.`))
      else if (seen.has(candidate as number)) issues.push(valueIssue(`$.emphasisIndices[${index}]`, 'VALUE_INVALID', `Emphasis index ${String(candidate)} is duplicated.`))
      else seen.add(candidate as number)
    })
  }

  if (input.alignment !== 'left' && input.alignment !== 'center' && input.alignment !== 'right') issues.push(valueIssue('$.alignment', 'VALUE_INVALID', 'alignment must be left, center or right.'))
  if (input.maxLines !== 1 && input.maxLines !== 2 && input.maxLines !== 3) issues.push(valueIssue('$.maxLines', 'VALUE_INVALID', 'maxLines must be 1, 2 or 3.'))
  if (input.emphasisTreatment !== undefined && input.emphasisTreatment !== 'accent-text' && input.emphasisTreatment !== 'highlight-box') issues.push(valueIssue('$.emphasisTreatment', 'VALUE_INVALID', 'emphasisTreatment must be accent-text or highlight-box.'))
  if (issues.length > 0) return validationFailure(...issues)

  return validationSuccess(Object.freeze({
    text: text as string,
    emphasisIndices: Object.freeze([...(emphasisInput as number[])]),
    alignment: input.alignment as KineticHeadlineProps['alignment'],
    maxLines: input.maxLines as KineticHeadlineProps['maxLines'],
    ...(input.emphasisTreatment !== undefined ? { emphasisTreatment: input.emphasisTreatment as KineticHeadlineProps['emphasisTreatment'] } : {}),
  }))
}

export const validateKineticHeadlineStyle = (input: unknown): MotionValidationResultV1<KineticHeadlineStyle> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Headline style must be an object.'))
  const issues = [...unknownFieldIssues(input, styleFields)]
  for (const field of ['textColor', 'accentColor', 'fontFamily'] as const) {
    if (typeof input[field] !== 'string' || !input[field].trim()) issues.push(valueIssue(`$.${field}`, 'TYPE_INVALID', `${field} must be a non-empty string.`))
  }
  if (typeof input.fontWeight !== 'number' || !Number.isFinite(input.fontWeight) || input.fontWeight < 100 || input.fontWeight > 900) issues.push(valueIssue('$.fontWeight', 'VALUE_OUT_OF_RANGE', 'fontWeight must be between 100 and 900.'))
  if (input.background !== 'none' && input.background !== 'soft-panel') issues.push(valueIssue('$.background', 'VALUE_INVALID', 'background must be none or soft-panel.'))
  if (typeof input.motionIntensity !== 'number' || !Number.isFinite(input.motionIntensity) || input.motionIntensity < 0 || input.motionIntensity > 1) issues.push(valueIssue('$.motionIntensity', 'VALUE_OUT_OF_RANGE', 'motionIntensity must be inside [0, 1].'))
  if (issues.length > 0) return validationFailure(...issues)

  return validationSuccess(Object.freeze({
    textColor: input.textColor as string,
    accentColor: input.accentColor as string,
    fontFamily: input.fontFamily as string,
    fontWeight: input.fontWeight as number,
    background: input.background as KineticHeadlineStyle['background'],
    motionIntensity: input.motionIntensity as number,
  }))
}

const validateContext = (context: MotionRenderContextV1): void => {
  if (!Number.isSafeInteger(context.localTicks) || context.localTicks < 0) throw new RangeError('localTicks must be a non-negative safe integer.')
  if (!Number.isSafeInteger(context.durationTicks) || context.durationTicks <= 0) throw new RangeError('durationTicks must be a positive safe integer.')
  if (context.localTicks > context.durationTicks) throw new RangeError('localTicks cannot exceed durationTicks.')
  if (context.ticksPerSecond !== SANVERSE_TICKS_PER_SECOND) throw new RangeError('Kinetic Headline requires the canonical Sanverse tick authority.')
  const { width, height, fpsNumerator, fpsDenominator } = context.composition
  if (![width, height, fpsNumerator, fpsDenominator].every((value) => Number.isFinite(value) && value > 0)) throw new RangeError('Composition dimensions and FPS must be positive finite values.')
}

const headlineGeometry = (context: MotionRenderContextV1) => {
  const { width, height } = context.composition
  const aspect = width / height
  const kind: KineticHeadlineState['layout']['kind'] = aspect < 0.78 ? 'portrait' : aspect <= 1.12 ? 'square' : 'landscape'
  const horizontalPadding = width * (kind === 'portrait' ? 0.10 : 0.075)
  const verticalPadding = height * 0.075
  const maxWidth = width - horizontalPadding * 2
  const preferredFontSize = Math.round(kind === 'portrait' ? Math.min(142, height * 0.072) : kind === 'square' ? Math.min(156, height * 0.088) : Math.min(168, height * 0.116))
  const minimumFontSize = kind === 'portrait' ? 50 : 58
  return { kind, horizontalPadding, verticalPadding, maxWidth, preferredFontSize, minimumFontSize }
}

export const validateKineticHeadlineFit = (
  props: KineticHeadlineProps,
  context: MotionRenderContextV1,
): MotionValidationResultV1<KineticHeadlineState['layout']> => {
  validateContext(context)
  const geometry = headlineGeometry(context)
  const words = tokenizeHeadline(props.text)
  const fit = fitWordLines(words, {
    maxWidth: geometry.maxWidth,
    maxLines: props.maxLines,
    preferredFontSize: geometry.preferredFontSize,
    minimumFontSize: geometry.minimumFontSize,
    fontSizeStep: 2,
    letterSpacingEm: -0.045,
    spaceWidthEm: 0.34,
  })

  if (!fit.ok) {
    const message = fit.reason === 'TOKEN_TOO_WIDE'
      ? `Word ${String((fit.tokenIndex ?? 0) + 1)} is too wide to fit at the minimum readable headline size.`
      : `This headline needs ${String(fit.requiredLineCount ?? 'more')} lines at the minimum readable size, but maxLines is ${String(props.maxLines)}.`
    return validationFailure(valueIssue('$.text', 'CONTENT_IMPOSSIBLE', message))
  }

  return validationSuccess(Object.freeze({
    kind: geometry.kind,
    maxWidth: geometry.maxWidth,
    fontSize: fit.fontSize,
    minimumFontSize: geometry.minimumFontSize,
    lineHeight: fit.fontSize * (geometry.kind === 'portrait' ? 1.04 : 1),
    horizontalPadding: geometry.horizontalPadding,
    verticalPadding: geometry.verticalPadding,
    lines: Object.freeze(fit.lines.map((line) => Object.freeze({
      startWordIndex: line.startTokenIndex,
      endWordIndexExclusive: line.endTokenIndexExclusive,
      estimatedWidth: line.estimatedWidth,
    }))),
  }))
}

export const deriveHeadlineLayout = (context: MotionRenderContextV1, props: KineticHeadlineProps): KineticHeadlineState['layout'] => {
  const fit = validateKineticHeadlineFit(props, context)
  if (!fit.ok) throw new RangeError(fit.issues[0]?.message ?? 'Headline content cannot fit this composition.')
  return fit.value
}

export const createKineticHeadlineScene = (props: KineticHeadlineProps, style: KineticHeadlineStyle, context: MotionRenderContextV1): MotionSceneV1 => {
  const layout = deriveHeadlineLayout(context, props)
  const words = tokenizeHeadline(props.text)
  const wordIds = stableWordNodeIds('kinetic-headline', words)
  const backgroundId = 'kinetic-headline.background'
  const textGroupId = 'kinetic-headline.text-group'
  const panelWidth = Math.min(layout.maxWidth + context.composition.width * 0.045, context.composition.width * 0.91)
  const panelHeight = Math.min(context.composition.height * (layout.kind === 'portrait' ? 0.22 : 0.27), context.composition.height * 0.42)
  const root = graphGroup('kinetic-headline.root', 'Kinetic Headline', null, [backgroundId, textGroupId])
  const progress = mProgress()
  const enter = mSequence(0, 0.18, progress)
  const settleWindow = mSequence(0.18, 0.30, progress)
  const exit = mSequence(0.80, 1, progress)
  const exitFade = mEase('ease-in-cubic', exit)
  const remain = mOneMinus(exitFade)
  const reducedReveal = mEase('ease-out-cubic', mSequence(0, 0.14, progress))
  const backgroundBase = graphShape({ id: backgroundId, name: 'Background', parentId: root.id, width: panelWidth, height: panelHeight, fillColor: 'rgba(8,8,8,.78)', strokeColor: `${style.accentColor}24`, strokeWidth: 2, radius: Math.max(28, Math.min(context.composition.width, context.composition.height) * 0.036) })
  const background = Object.freeze({
    ...backgroundBase,
    visible: constant(style.background === 'soft-panel'),
    opacity: style.background === 'none' ? constant(0) : mNumber(mReduced(
      mMultiply(reducedReveal, remain, mConst(0.9)),
      mMultiply(mEase('ease-out-cubic', enter), remain, mConst(0.94)),
    )),
  })
  const textGroup = graphGroup(textGroupId, 'Headline Text', root.id, wordIds)
  const semanticHighlight = props.emphasisTreatment === 'highlight-box'
  const wordNodes = Object.fromEntries(words.map((word, index) => {
    const emphasized = props.emphasisIndices.includes(index)
    const base = graphText({ id: wordIds[index]!, name: `Word ${index + 1}: ${word}`, parentId: textGroupId, text: word, color: emphasized && !semanticHighlight ? style.accentColor : style.textColor, fontFamily: style.fontFamily, fontSize: layout.fontSize, fontWeight: style.fontWeight, textAlign: props.alignment })
    const wordEnter = mEase('ease-out-cubic', mStagger(enter, index, words.length, 0.58))
    const opacity = mNumber(mReduced(mMultiply(reducedReveal, remain), mMultiply(wordEnter, remain)))
    const distance = 34 * lerp(0.45, 1.2, style.motionIntensity)
    const translateY = mNumber(mReduced(mConst(0), mSubtract(mLerp(mConst(distance), mConst(0), wordEnter), mMultiply(mConst(18 * style.motionIntensity), exit))))
    const settle = mSpring(settleWindow, lerp(8.6, 5.6, style.motionIntensity), lerp(0.72, 1.08, style.motionIntensity))
    const overshoot = emphasized ? mMultiply(mMax(mConst(0), mSubtract(settle, mConst(1))), mConst(0.18 * style.motionIntensity)) : mConst(0)
    const scale = mNumber(mReduced(mConst(1), mAdd(mLerp(mConst(0.96), mConst(1), wordEnter), overshoot)))
    if (semanticHighlight && emphasized) {
      const startTick = Math.round(context.durationTicks * Math.min(0.12 + index * 0.035, 0.28))
      const settleTick = Math.round(context.durationTicks * Math.min(0.28 + index * 0.035, 0.44))
      const highlightedOpacity = context.reducedMotion ? constant(1) : keyframed([
        { id: `${wordIds[index]}:highlight-hidden`, tick: 0, value: 0, interpolation: 'hold' },
        { id: `${wordIds[index]}:highlight-start`, tick: startTick, value: 0, interpolation: 'bezier', bezier: { inX: 0.7, inY: 1, outX: 0.2, outY: 0.84 } },
        { id: `${wordIds[index]}:highlight-visible`, tick: settleTick, value: 1, interpolation: 'linear' },
      ])
      const highlightScale = context.reducedMotion ? constant(1) : keyframed([
        { id: `${wordIds[index]}:highlight-scale-small`, tick: 0, value: 0.72, interpolation: 'hold' },
        { id: `${wordIds[index]}:highlight-scale-start`, tick: startTick, value: 0.72, interpolation: 'bezier', bezier: { inX: 0.7, inY: 1, outX: 0.18, outY: 0.9 } },
        { id: `${wordIds[index]}:highlight-scale-settled`, tick: settleTick, value: 1, interpolation: 'linear' },
      ])
      const node = Object.freeze({ ...base, opacity: highlightedOpacity, transform: Object.freeze({ ...base.transform, positionY: constant(0), scaleX: highlightScale, scaleY: constant(1) }) })
      return [node.id, node]
    }
    const node = Object.freeze({ ...base, opacity, transform: Object.freeze({ ...base.transform, positionY: translateY, scaleX: scale, scaleY: scale }) })
    return [node.id, node]
  }))
  const exposures: MotionExposureV1[] = [
    { id: 'headline.text', label: 'Headline text', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'text' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: 'headline.emphasis', label: 'Emphasis words', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'emphasisIndices' }, editor: { type: 'text' }, keyframeable: false },
    { id: 'headline.emphasis-treatment', label: 'Emphasis treatment', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'emphasisTreatment' }, editor: { type: 'select', options: [{ label: 'Accent text', value: 'accent-text' }, { label: 'Highlight box', value: 'highlight-box' }] }, keyframeable: false },
    { id: 'headline.max-lines', label: 'Maximum lines', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'maxLines' }, editor: { type: 'select', options: [{ label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 }] }, keyframeable: false },
    { id: 'headline.text-color', label: 'Text color', group: 'Style', level: 'creator', target: { kind: 'part', semanticPartId: 'headline', property: 'text.fillColor' }, editor: { type: 'color' }, keyframeable: true },
    { id: 'headline.accent-color', label: 'Accent color', group: 'Style', level: 'creator', target: { kind: 'part', semanticPartId: 'emphasis', property: 'text.fillColor' }, editor: { type: 'color' }, keyframeable: true },
    { id: 'headline.alignment', label: 'Alignment', group: 'Layout', level: 'designer', target: { kind: 'component', propertyId: 'alignment' }, editor: { type: 'select', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] }, keyframeable: false },
    { id: 'headline.radius', label: 'Panel roundness', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: backgroundId, property: 'shape.radius' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 120, step: 1 } },
    { id: 'headline.panel-opacity', label: 'Panel opacity', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: backgroundId, property: 'opacity' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'headline.border-width', label: 'Border width', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: backgroundId, property: 'shape.strokeWidth' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 12, step: 0.5 } },
    { id: 'headline.position-x', label: 'Position X', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: root.id, property: 'transform.positionX' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: -500, maximum: 500, step: 1 } },
    { id: 'headline.position-y', label: 'Position Y', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: root.id, property: 'transform.positionY' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: -500, maximum: 500, step: 1 } },
    { id: 'headline.scale-x', label: 'Scale X', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: root.id, property: 'transform.scaleX' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0.25, maximum: 2, step: 0.01 } },
    { id: 'headline.scale-y', label: 'Scale Y', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: root.id, property: 'transform.scaleY' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0.25, maximum: 2, step: 0.01 } },
    { id: 'headline.rotation', label: 'Rotation', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: root.id, property: 'transform.rotationDeg' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: -180, maximum: 180, step: 1 } },
    { id: 'headline.opacity', label: 'Overall opacity', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: root.id, property: 'opacity' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'headline.motion-intensity', label: 'Motion intensity', group: 'Motion', level: 'designer', target: { kind: 'component', propertyId: 'motionIntensity' }, editor: { type: 'slider' }, keyframeable: false, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'headline.word-effects', label: 'Word effects', group: 'Effects', level: 'advanced', target: { kind: 'part', semanticPartId: 'headline', property: 'opacity' }, editor: { type: 'readonly' }, keyframeable: true },
  ]
  return createMotionScene({
    componentId: 'sanverse.kinetic-headline', componentVersion: 1, rootNodeId: root.id,
    nodes: Object.freeze({ [root.id]: root, [background.id]: background, [textGroup.id]: textGroup, ...wordNodes }),
    semanticParts: Object.freeze([
      { id: 'background', label: 'Background', role: 'surface', nodeIds: Object.freeze([background.id]) },
      { id: 'headline', label: 'Headline', role: 'primary-text', nodeIds: Object.freeze([textGroup.id, ...wordIds]) },
      { id: 'emphasis', label: 'Emphasis', role: 'accent', nodeIds: Object.freeze(props.emphasisIndices.map((index) => wordIds[index]).filter((id): id is string => Boolean(id))) },
    ]),
    exposures: Object.freeze(exposures), layout: responsiveGraphLayout(), supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5']),
  })
}

export const evaluateKineticHeadlineState = (props: KineticHeadlineProps, style: KineticHeadlineStyle, context: MotionRenderContextV1): KineticHeadlineState => {
  validateContext(context)
  const propsValidation = validateKineticHeadlineProps(props)
  if (!propsValidation.ok) throw new RangeError(propsValidation.issues[0]?.message ?? 'Invalid Kinetic Headline props.')
  const styleValidation = validateKineticHeadlineStyle(style)
  if (!styleValidation.ok) throw new RangeError(styleValidation.issues[0]?.message ?? 'Invalid Kinetic Headline style.')

  const progress = normalizedProgress(context.localTicks, context.durationTicks)
  const phases = enterHoldExit({ progress })
  const words = tokenizeHeadline(props.text)
  const emphasis = new Set(props.emphasisIndices)
  const intensity = style.motionIntensity
  const exitFade = easeInCubic(phases.exit)
  const reducedReveal = easeOutCubic(Math.min(1, progress / 0.14))
  const panelOpacity = style.background === 'none' ? 0 : context.reducedMotion ? reducedReveal * (1 - exitFade) * 0.9 : easeOutCubic(phases.enter) * (1 - exitFade) * 0.94

  const wordStates = words.map((word, index): KineticHeadlineWordState => {
    const emphasized = emphasis.has(index)
    if (context.reducedMotion) return Object.freeze({ word, index, emphasized, opacity: reducedReveal * (1 - exitFade), translateY: 0, scale: 1 })

    const staggered = wordRevealProgress(phases.enter, index, words.length)
    const enter = easeOutCubic(staggered)
    const settle = springProgress({ progress: phases.settle, damping: lerp(8.6, 5.6, intensity), frequency: lerp(0.72, 1.08, intensity) })
    const overshoot = emphasized ? Math.max(0, settle - 1) * 0.18 * intensity : 0
    return Object.freeze({
      word,
      index,
      emphasized,
      opacity: enter * (1 - exitFade),
      translateY: lerp(34 * lerp(0.45, 1.2, intensity), 0, enter) - 18 * intensity * phases.exit,
      scale: lerp(0.96, 1, enter) + overshoot,
    })
  })

  return Object.freeze({ normalizedProgress: progress, phase: phases.phase, layout: deriveHeadlineLayout(context, props), panelOpacity, words: Object.freeze(wordStates) })
}

export function KineticHeadline({ props, style, context }: MotionComponentRenderPropsV1<KineticHeadlineProps, KineticHeadlineStyle>) {
  const state = evaluateKineticHeadlineState(props, style, context)
  const graph = useMotionGraphPresentation()
  const graphStyle = (nodeId: string, base: CSSProperties): CSSProperties => mergeMotionGraphNodeStyle(base, graph.scene?.nodes[nodeId] ?? null, graph.selectedNodeId === nodeId)
  const { width, height } = context.composition
  const wordIds = stableWordNodeIds('kinetic-headline', state.words.map((word) => word.word))
  const justifyContent = props.alignment === 'left' ? 'flex-start' : props.alignment === 'right' ? 'flex-end' : 'center'
  const rootStyle = graphStyle('kinetic-headline.root', { position: 'absolute', inset: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent, padding: `${state.layout.verticalPadding}px ${state.layout.horizontalPadding}px`, overflow: 'hidden', fontFamily: style.fontFamily })
  const textStyle = graphStyle('kinetic-headline.text-group', { position: 'relative', zIndex: 2, width: state.layout.maxWidth, color: style.textColor, fontSize: state.layout.fontSize, lineHeight: `${state.layout.lineHeight}px`, fontWeight: style.fontWeight, letterSpacing: '-0.045em', textAlign: props.alignment })
  const panelWidth = Math.min(state.layout.maxWidth + width * 0.045, width * 0.91)
  const backgroundNode = graph.scene?.nodes['kinetic-headline.background']
  const panelShape = backgroundNode?.type === 'shape' ? backgroundNode : null
  const panelStyle = mergeMotionGraphNodeDecorationStyle({ position:'absolute', width:panelWidth, minHeight:Math.min(height*(state.layout.kind==='portrait'?0.22:0.27),height*0.42), left:props.alignment==='left'?state.layout.horizontalPadding*0.7:props.alignment==='center'?'50%':undefined, right:props.alignment==='right'?state.layout.horizontalPadding*0.7:undefined, top:'50%', transform:props.alignment==='center'?'translate(-50%, -50%)':'translateY(-50%)', borderRadius:panelShape?.radius ?? Math.max(28,Math.min(width,height)*0.036), borderStyle:'solid', borderWidth:panelShape?.strokeWidth ?? 2, borderColor:panelShape?.strokeColor ?? `${style.accentColor}24`, background:panelShape?.fillColor ?? 'rgba(8,8,8,.78)', boxShadow:`0 ${Math.round(height*0.018)}px ${Math.round(height*0.065)}px rgba(0,0,0,.34)`, opacity:backgroundNode?.opacity ?? state.panelOpacity }, backgroundNode ?? null, graph.selectedNodeId === 'kinetic-headline.background')

  return <div data-motion-root="kinetic-headline" data-motion-layout={state.layout.kind} style={rootStyle}>
    {style.background === 'soft-panel' ? <div aria-hidden="true" data-motion-node-id="kinetic-headline.background" style={panelStyle} /> : null}
    <div data-motion-node-id="kinetic-headline.text-group" data-motion-text="headline" data-motion-max-lines={props.maxLines} data-motion-font-size={state.layout.fontSize} style={textStyle}>
      {state.layout.lines.map((line, lineIndex) => (
        <span
          key={`line:${line.startWordIndex}:${line.endWordIndexExclusive}`}
          data-motion-line={lineIndex}
          data-motion-estimated-width={line.estimatedWidth}
          style={{ display: 'block', whiteSpace: 'nowrap' }}
        >
          {state.words.slice(line.startWordIndex, line.endWordIndexExclusive).map((word, wordOffset, lineWords) => {
            const nodeId = wordIds[word.index]!
            const node = graph.scene?.nodes[nodeId]
            const textNode = node?.type === 'text' ? node : null
            const transform = textNode
              ? `translate3d(${textNode.transform.positionX === 0 ? '0' : `${textNode.transform.positionX}px`}, ${textNode.transform.positionY}px, 0)${textNode.transform.rotationDeg === 0 ? '' : ` rotate(${textNode.transform.rotationDeg}deg)`} ${textNode.transform.scaleX === textNode.transform.scaleY ? `scale(${textNode.transform.scaleX})` : `scale(${textNode.transform.scaleX}, ${textNode.transform.scaleY})`}`
              : `translate3d(0, ${word.translateY}px, 0) scale(${word.scale})`
            const semanticHighlight = props.emphasisTreatment === 'highlight-box' && word.emphasized
            const wordStyle = mergeMotionGraphNodeDecorationStyle({ display:'inline-block', color:textNode?.fillColor ?? (word.emphasized?style.accentColor:style.textColor), fontSize:textNode?.fontSize, fontWeight:textNode?.fontWeight, opacity:textNode?.opacity ?? word.opacity, transform, transformOrigin:'50% 70%', ...(semanticHighlight ? { padding:'0.04em 0.18em 0.07em', margin:'0 -0.03em', borderRadius:'0.16em', background:`${style.accentColor}38`, boxShadow:`inset 0 0 0 0.035em ${style.accentColor}88` } : {}) }, textNode, graph.selectedNodeId === nodeId)
            return (
              <span key={`${word.index}:${word.word}`}>
                <span data-motion-node-id={nodeId} data-motion-word={word.index} data-motion-emphasis={word.emphasized ? 'true' : 'false'} style={wordStyle}>{textNode?.text ?? word.word}</span>
                {wordOffset < lineWords.length - 1 ? ' ' : null}
              </span>
            )
          })}
        </span>
      ))}
    </div>
  </div>
}

export const KINETIC_HEADLINE_DEFINITION = Object.freeze({
  id: 'sanverse.kinetic-headline', version: 1, name: 'Kinetic Headline', purpose: 'Emphasize a hook, key takeaway, strong phrase or section transition.', category: 'headline', performanceClass: 'light',
  supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5'] as const),
  minDurationTicks: SANVERSE_TICKS_PER_SECOND, defaultDurationTicks: SANVERSE_TICKS_PER_SECOND * 3, maxDurationTicks: SANVERSE_TICKS_PER_SECOND * 12,
  events: Object.freeze([{ name:'enter-start',normalizedTime:0 },{ name:'reveal-start',normalizedTime:0.03 },{ name:'reveal-peak',normalizedTime:0.18 },{ name:'settled',normalizedTime:0.30 },{ name:'exit-start',normalizedTime:0.80 },{ name:'exit-peak',normalizedTime:0.94 }]),
  contentLimits: Object.freeze([{ field:'text',description:'Visible headline copy.',minimum:1,maximum:180,unit:'characters' as const },{ field:'maxLines',description:'Maximum intended line count.',minimum:1,maximum:3,unit:'lines' as const }]),
  capabilities: FULL_NATIVE_GRAPH_CAPABILITIES,
} as const)

export const KineticHeadlineModule: MotionGraphBackedComponentModuleV1<KineticHeadlineProps, KineticHeadlineStyle> = Object.freeze({ definition: KINETIC_HEADLINE_DEFINITION, defaultProps: DEFAULT_KINETIC_HEADLINE_PROPS, defaultStyle: DEFAULT_KINETIC_HEADLINE_STYLE, validateProps: validateKineticHeadlineProps, validateStyle: validateKineticHeadlineStyle, Component: KineticHeadline, createScene: createKineticHeadlineScene })
