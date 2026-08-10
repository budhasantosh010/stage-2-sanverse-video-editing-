import type { CreativeComponentPlacementV1 } from '@sanverse/creative-direction'
import type { MotionCompositionV1, MotionRenderContextV1 } from '@sanverse/motion-contract'
import type { MotionSceneV1 } from '@sanverse/motion-graph'
import {
  FAMILY_COMPONENT_MODULES_BY_ID,
  KineticHeadlineModule,
  MOTION_REFERENCE_COMPOSITIONS,
  tokenizeHeadline,
} from '@sanverse/motion-library'
import type { FamilyComponentProps, KineticHeadlineProps } from '@sanverse/motion-library'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'

const kineticEmphasisIndices = (placement: CreativeComponentPlacementV1, text: string): readonly number[] => {
  const phrase = typeof placement.content.fields?.emphasis === 'string' ? placement.content.fields.emphasis.trim() : ''
  if (!phrase) return Object.freeze([])
  const words = tokenizeHeadline(text)
  const phraseWords = tokenizeHeadline(phrase)
  if (phraseWords.length === 0) return Object.freeze([])
  const normalized = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  for (let start = 0; start <= words.length - phraseWords.length; start += 1) {
    if (phraseWords.every((word, offset) => normalized(words[start + offset] ?? '') === normalized(word))) {
      return Object.freeze(Array.from({ length: phraseWords.length }, (_, offset) => start + offset))
    }
  }
  return Object.freeze([])
}

export interface CreativePlacementMotionPreviewV1 {
  readonly placementId: string
  readonly componentId: string
  /** Exact B0 region remains preserved even when local component motion is shorter. */
  readonly sourceStartTicks: number
  readonly sourceEndTicks: number
  readonly context: MotionRenderContextV1
  readonly scene: MotionSceneV1
}

/**
 * Maps exact edit/source time into the component's local authored-motion clock.
 * This is a proportional projection only; it does not create another clock.
 */
export const sourceTickToPlacementLocalTicks = (preview: CreativePlacementMotionPreviewV1, sourceTick: number): number => {
  if (!Number.isSafeInteger(sourceTick) || sourceTick < preview.sourceStartTicks || sourceTick > preview.sourceEndTicks) throw new RangeError('sourceTick must be an exact tick inside the placement source region.')
  const sourceDurationTicks = preview.sourceEndTicks - preview.sourceStartTicks
  if (sourceDurationTicks <= 0) throw new RangeError('Creative placement source duration must be positive.')
  const normalized = (sourceTick - preview.sourceStartTicks) / sourceDurationTicks
  return Math.round(normalized * preview.context.durationTicks)
}

/** Reverse projection used by trace/evidence surfaces. */
export const placementLocalTicksToSourceTick = (preview: CreativePlacementMotionPreviewV1, localTicks: number): number => {
  if (!Number.isSafeInteger(localTicks) || localTicks < 0 || localTicks > preview.context.durationTicks) throw new RangeError('localTicks must be an exact tick inside the component local duration.')
  const sourceDurationTicks = preview.sourceEndTicks - preview.sourceStartTicks
  if (sourceDurationTicks <= 0) throw new RangeError('Creative placement source duration must be positive.')
  return Math.round(preview.sourceStartTicks + (localTicks / preview.context.durationTicks) * sourceDurationTicks)
}

const localPreviewDurationTicks = (requestedTicks: number, definition: Readonly<{ minDurationTicks: number; defaultDurationTicks: number; maxDurationTicks: number }>): number =>
  requestedTicks >= definition.minDurationTicks && requestedTicks <= definition.maxDurationTicks ? requestedTicks : definition.defaultDurationTicks

const previewContext = (durationTicks: number, composition: MotionCompositionV1, localTicks: number): MotionRenderContextV1 => Object.freeze({
  localTicks: Math.max(0, Math.min(durationTicks, localTicks)),
  durationTicks,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition,
  reducedMotion: false,
})

export const createCreativePlacementMotionPreview = (
  placement: CreativeComponentPlacementV1,
  composition: MotionCompositionV1 = MOTION_REFERENCE_COMPOSITIONS['16:9'],
  localTicks = 0,
): CreativePlacementMotionPreviewV1 => {
  const componentId = placement.selectedComponentId
  if (!componentId) throw new RangeError(`Creative placement ${placement.id} is unresolved.`)
  const regionDurationTicks = placement.endTicks - placement.startTicks
  if (!Number.isSafeInteger(regionDurationTicks) || regionDurationTicks <= 0) throw new RangeError(`Creative placement ${placement.id} has an invalid duration.`)
  if (componentId === KineticHeadlineModule.definition.id) {
    const durationTicks = localPreviewDurationTicks(regionDurationTicks, KineticHeadlineModule.definition)
    const context = previewContext(durationTicks, composition, localTicks)
    const text = placement.content.primaryText?.trim() || KineticHeadlineModule.defaultProps.text
    const props: KineticHeadlineProps = Object.freeze({
      ...KineticHeadlineModule.defaultProps,
      text,
      emphasisIndices: kineticEmphasisIndices(placement, text),
      emphasisTreatment: placement.communicationIntent === 'semantic-highlight-statement' ? 'highlight-box' : KineticHeadlineModule.defaultProps.emphasisTreatment,
    })
    return Object.freeze({ placementId: placement.id, componentId, sourceStartTicks: placement.startTicks, sourceEndTicks: placement.endTicks, context, scene: KineticHeadlineModule.createScene(props, KineticHeadlineModule.defaultStyle, context) })
  }
  const module = FAMILY_COMPONENT_MODULES_BY_ID[componentId]
  if (!module) throw new RangeError(`Motion Lab bridge has no graph-native module for ${componentId}.`)
  const durationTicks = localPreviewDurationTicks(regionDurationTicks, module.definition)
  const context = previewContext(durationTicks, composition, localTicks)
  const placementIntent = placement.placementIntent === 'auto' ? module.defaultProps.placement : placement.placementIntent
  const brandLockup = componentId === 'sanverse.keyword-brand-lockup'
  const semanticValue = placement.content.fields?.value
  const props: FamilyComponentProps = Object.freeze({
    ...module.defaultProps,
    ...(!brandLockup && placement.content.primaryText ? { title: placement.content.primaryText } : {}),
    ...(brandLockup && placement.content.primaryText ? { value: placement.content.primaryText } : {}),
    ...(!brandLockup && (typeof semanticValue === 'string' || typeof semanticValue === 'number') ? { value: String(semanticValue) } : {}),
    ...(placement.content.secondaryText ? { subtitle: placement.content.secondaryText } : {}),
    ...(placement.content.items ? { items: Object.freeze([...placement.content.items]) } : {}),
    ...(placementIntent ? { placement: placementIntent } : {}),
  })
  const validation = module.validateProps(props)
  if (!validation.ok) throw new RangeError(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
  return Object.freeze({ placementId: placement.id, componentId, sourceStartTicks: placement.startTicks, sourceEndTicks: placement.endTicks, context, scene: module.createScene(validation.value, module.defaultStyle, context) })
}

export const creativePlacementMotionLabUrl = (placement: CreativeComponentPlacementV1): string | null => {
  if (!placement.selectedComponentId) return null
  const params = new URLSearchParams({ component: placement.selectedComponentId.replace(/^sanverse\./u, ''), level: 'compositor', ratio: '16:9', creativePlacement: placement.id })
  if (placement.selectedComponentId === KineticHeadlineModule.definition.id && placement.content.primaryText) {
    params.set('text', placement.content.primaryText)
    const emphasis = kineticEmphasisIndices(placement, placement.content.primaryText)
    if (emphasis.length > 0) params.set('emphasis', emphasis.join(','))
    if (placement.communicationIntent === 'semantic-highlight-statement') params.set('treatment', 'highlight-box')
  } else {
    if (placement.content.primaryText && placement.selectedComponentId !== 'sanverse.keyword-brand-lockup') params.set('storyTitle', placement.content.primaryText)
    if (placement.content.secondaryText) params.set('storySubtitle', placement.content.secondaryText)
    if (placement.content.items?.length) params.set('storyItems', placement.content.items.join('\n'))
    if (placement.placementIntent !== 'auto') params.set('storyPlacement', placement.placementIntent)
    const semanticValue = placement.content.fields?.value
    if (placement.selectedComponentId === 'sanverse.keyword-brand-lockup' && placement.content.primaryText) params.set('storyValue', placement.content.primaryText)
    else if (typeof semanticValue === 'string' || typeof semanticValue === 'number') params.set('storyValue', String(semanticValue))
  }
  return `/?${params.toString()}`
}
