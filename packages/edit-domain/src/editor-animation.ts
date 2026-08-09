import {
  clipCompositionDurationTicks,
  clipTimeToComposition,
  clipTimeToSource,
  compositionTimeToClip,
  isFreezeClip,
  sourceTimeToClip,
  type Clip,
} from './composition.ts'
import {
  FOOTAGE_MOTION_PROPERTIES,
  type SetFootageMotionOperation,
} from './footage-motion.ts'
import { mediaTime, type TimeRange } from './time.ts'
import {
  MAX_KEYFRAMES_PER_TRACK,
  MAX_VISUAL_TRACKS,
  VISUAL_PROPERTIES,
  type SetVisualPropertiesOperation,
  type VisualCrop,
  type VisualEasing,
  type VisualKeyframe,
  type VisualProperties,
  type VisualProperty,
  type VisualPropertyTrack,
  type VisualTransform,
} from './visual-properties.ts'

export type EditorAnimationOwnerKindV1 = 'primary-footage-motion' | 'visual-properties'

export type EditorAnimationTargetKindV1 =
  | 'primary-footage'
  | 'caption'
  | 'nameplate'
  | 'title'
  | 'callout'
  | 'media-overlay'
  | 'freeze'
  | 'dialogue'
  | 'music'

export type EditorAnimationPropertyIdV1 = VisualProperty
export type EditorAnimationTimeBasisV1 = 'source-relative' | 'visual-relative'
export type EditorAnimationInterpolationKindV1 = VisualEasing['kind']
export type EditorAnimationUnitV1 = 'frame-fraction' | 'ratio' | 'degrees' | 'fraction'

export type EditorAnimationTargetRefV1 =
  | Readonly<{
      kind: 'primary-footage-motion'
      motionId: string
      assetId: string
      selectedPlacementClipId: string
    }>
  | Readonly<{
      kind: 'visual-properties'
      visualId: string
    }>

export type EditorKeyframeAddressV1 = Readonly<{
  target: EditorAnimationTargetRefV1
  property: EditorAnimationPropertyIdV1
  canonicalAtTicks: number
}>

export type EditorKeyframeSelectionV1 = Readonly<{
  addresses: readonly EditorKeyframeAddressV1[]
  anchor: EditorKeyframeAddressV1 | null
}>

export const EMPTY_EDITOR_KEYFRAME_SELECTION: EditorKeyframeSelectionV1 = Object.freeze({
  addresses: Object.freeze([]),
  anchor: null,
})

export type EditorAnimationPropertyCapabilityV1 = Readonly<{
  property: EditorAnimationPropertyIdV1
  label: string
  unit: EditorAnimationUnitV1
  minimum: number
  maximum: number
  keyframeable: true
  graphable: true
  allowedInterpolations: readonly EditorAnimationInterpolationKindV1[]
  ownerKind: EditorAnimationOwnerKindV1
  timeBasis: EditorAnimationTimeBasisV1
  staticValue: number
  laneFormat: 'percent' | 'degrees'
  graphFormat: 'percent' | 'degrees'
}>

const INTERPOLATIONS: readonly EditorAnimationInterpolationKindV1[] = Object.freeze([
  'linear',
  'cubic-bezier',
  'spring',
  'bounce',
])

const LABELS: Readonly<Record<VisualProperty, string>> = Object.freeze({
  'translate-x': 'Position X',
  'translate-y': 'Position Y',
  scale: 'Scale',
  rotation: 'Rotation',
  opacity: 'Opacity',
  'crop-top': 'Crop Top',
  'crop-right': 'Crop Right',
  'crop-bottom': 'Crop Bottom',
  'crop-left': 'Crop Left',
})

const propertyBounds = (property: VisualProperty): Readonly<{ minimum: number; maximum: number; unit: EditorAnimationUnitV1; format: 'percent' | 'degrees' }> => {
  if (property === 'translate-x' || property === 'translate-y') {
    return Object.freeze({ minimum: -2, maximum: 2, unit: 'frame-fraction', format: 'percent' })
  }
  if (property === 'scale') {
    return Object.freeze({ minimum: 0.01, maximum: 20, unit: 'ratio', format: 'percent' })
  }
  if (property === 'rotation') {
    return Object.freeze({ minimum: -3_600, maximum: 3_600, unit: 'degrees', format: 'degrees' })
  }
  return Object.freeze({ minimum: 0, maximum: property.startsWith('crop-') ? 0.99 : 1, unit: 'fraction', format: 'percent' })
}

export const visualPropertyBaseValue = (
  state: Readonly<{ transform: VisualTransform; crop: VisualCrop }>,
  property: VisualProperty,
): number => {
  if (property === 'translate-x') return state.transform.translateX
  if (property === 'translate-y') return state.transform.translateY
  if (property === 'scale') return state.transform.scale
  if (property === 'rotation') return state.transform.rotationDegrees
  if (property === 'opacity') return state.transform.opacity
  if (property === 'crop-top') return state.crop.top
  if (property === 'crop-right') return state.crop.right
  if (property === 'crop-bottom') return state.crop.bottom
  return state.crop.left
}

export const withVisualPropertyBaseValue = <T extends Readonly<{ transform: VisualTransform; crop: VisualCrop }>>(
  state: T,
  property: VisualProperty,
  value: number,
): T => {
  if (property === 'translate-x') return Object.freeze({ ...state, transform: Object.freeze({ ...state.transform, translateX: value }) }) as T
  if (property === 'translate-y') return Object.freeze({ ...state, transform: Object.freeze({ ...state.transform, translateY: value }) }) as T
  if (property === 'scale') return Object.freeze({ ...state, transform: Object.freeze({ ...state.transform, scale: value }) }) as T
  if (property === 'rotation') return Object.freeze({ ...state, transform: Object.freeze({ ...state.transform, rotationDegrees: value }) }) as T
  if (property === 'opacity') return Object.freeze({ ...state, transform: Object.freeze({ ...state.transform, opacity: value }) }) as T
  if (property === 'crop-top') return Object.freeze({ ...state, crop: Object.freeze({ ...state.crop, top: value }) }) as T
  if (property === 'crop-right') return Object.freeze({ ...state, crop: Object.freeze({ ...state.crop, right: value }) }) as T
  if (property === 'crop-bottom') return Object.freeze({ ...state, crop: Object.freeze({ ...state.crop, bottom: value }) }) as T
  return Object.freeze({ ...state, crop: Object.freeze({ ...state.crop, left: value }) }) as T
}

const defaultStaticValue = (property: VisualProperty): number => {
  if (property === 'scale' || property === 'opacity') return 1
  return 0
}

const visualTargetKinds: readonly EditorAnimationTargetKindV1[] = Object.freeze([
  'caption', 'nameplate', 'title', 'callout', 'media-overlay',
])

export const animationCapabilitiesForTarget = (
  targetKind: EditorAnimationTargetKindV1,
  staticState?: Readonly<{ transform: VisualTransform; crop: VisualCrop }>,
): readonly EditorAnimationPropertyCapabilityV1[] => {
  const ownerKind: EditorAnimationOwnerKindV1 | null = targetKind === 'primary-footage'
    ? 'primary-footage-motion'
    : visualTargetKinds.includes(targetKind)
      ? 'visual-properties'
      : null
  if (!ownerKind) return Object.freeze([])
  const properties = ownerKind === 'primary-footage-motion' ? FOOTAGE_MOTION_PROPERTIES : VISUAL_PROPERTIES
  return Object.freeze(properties.map((property) => {
    const bounds = propertyBounds(property)
    return Object.freeze({
      property,
      label: LABELS[property],
      unit: bounds.unit,
      minimum: bounds.minimum,
      maximum: bounds.maximum,
      keyframeable: true as const,
      graphable: true as const,
      allowedInterpolations: INTERPOLATIONS,
      ownerKind,
      timeBasis: ownerKind === 'primary-footage-motion' ? 'source-relative' as const : 'visual-relative' as const,
      staticValue: staticState ? visualPropertyBaseValue(staticState, property) : defaultStaticValue(property),
      laneFormat: bounds.format,
      graphFormat: bounds.format,
    })
  }))
}

export const animationCapabilityForProperty = (
  targetKind: EditorAnimationTargetKindV1,
  property: EditorAnimationPropertyIdV1,
  staticState?: Readonly<{ transform: VisualTransform; crop: VisualCrop }>,
): EditorAnimationPropertyCapabilityV1 | null =>
  animationCapabilitiesForTarget(targetKind, staticState).find((candidate) => candidate.property === property) ?? null

export type EditorAnimationTimeContextV1 =
  | Readonly<{
      kind: 'primary-footage-motion'
      clip: Clip
      motionSourceInterval: TimeRange
    }>
  | Readonly<{
      kind: 'visual-properties'
      compositionStartTicks: number
      durationTicks: number
    }>

const wholeTick = (value: number): boolean => Number.isSafeInteger(value) && value >= 0

export const projectAnimationKeyframeToCompositionTicks = (
  context: EditorAnimationTimeContextV1,
  canonicalAtTicks: number,
): number | null => {
  if (!wholeTick(canonicalAtTicks)) return null
  if (context.kind === 'visual-properties') {
    if (canonicalAtTicks > context.durationTicks) return null
    return context.compositionStartTicks + canonicalAtTicks
  }
  if (isFreezeClip(context.clip)) return null
  if (canonicalAtTicks > context.motionSourceInterval.duration.ticks) return null
  const sourceTicks = context.motionSourceInterval.start.ticks + canonicalAtTicks
  const clipStart = context.clip.sourceRange.start.ticks
  const clipEnd = clipStart + context.clip.sourceRange.duration.ticks
  if (sourceTicks < clipStart || sourceTicks > clipEnd) return null
  const local = sourceTimeToClip(context.clip, mediaTime(sourceTicks))
  const clipDuration = clipCompositionDurationTicks(context.clip)
  if (local.ticks < 0 || local.ticks > clipDuration) return null
  return clipTimeToComposition(context.clip, local).ticks
}

export const compositionTicksToAnimationKeyframeTicks = (
  context: EditorAnimationTimeContextV1,
  compositionTicks: number,
): number | null => {
  if (!wholeTick(compositionTicks)) return null
  if (context.kind === 'visual-properties') {
    const relative = compositionTicks - context.compositionStartTicks
    return relative >= 0 && relative <= context.durationTicks ? relative : null
  }
  if (isFreezeClip(context.clip)) return null
  const clipDuration = clipCompositionDurationTicks(context.clip)
  const local = compositionTimeToClip(context.clip, mediaTime(compositionTicks))
  if (local.ticks < 0 || local.ticks > clipDuration) return null
  const source = clipTimeToSource(context.clip, local)
  const relative = source.ticks - context.motionSourceInterval.start.ticks
  return relative >= 0 && relative <= context.motionSourceInterval.duration.ticks ? relative : null
}

export type EditorAnimationVisibleRangeV1 = Readonly<{ startTicks: number; endTicks: number }>

export const animationVisibleRangeForPlacement = (
  context: EditorAnimationTimeContextV1,
): EditorAnimationVisibleRangeV1 | null => {
  if (context.kind === 'visual-properties') {
    return Object.freeze({ startTicks: 0, endTicks: Math.max(0, context.durationTicks) })
  }
  if (isFreezeClip(context.clip)) return null
  const motionStart = context.motionSourceInterval.start.ticks
  const motionEnd = motionStart + context.motionSourceInterval.duration.ticks
  const clipStart = context.clip.sourceRange.start.ticks
  const clipEnd = clipStart + context.clip.sourceRange.duration.ticks
  const overlapStart = Math.max(motionStart, clipStart)
  const overlapEnd = Math.min(motionEnd, clipEnd)
  if (overlapEnd < overlapStart) return null
  return Object.freeze({ startTicks: overlapStart - motionStart, endTicks: overlapEnd - motionStart })
}

export const animationKeyframesVisibleInPlacement = (
  context: EditorAnimationTimeContextV1,
  track: VisualPropertyTrack,
): readonly Readonly<{ keyframe: VisualKeyframe; compositionTicks: number }>[] => Object.freeze(
  track.keyframes.flatMap((keyframe) => {
    const compositionTicks = projectAnimationKeyframeToCompositionTicks(context, keyframe.at.ticks)
    return compositionTicks === null ? [] : [Object.freeze({ keyframe, compositionTicks })]
  }),
)

export type EditorAnimationRefusalCodeV1 =
  | 'ANIMATION_TARGET_MISSING'
  | 'PROPERTY_NOT_ANIMATABLE'
  | 'TRACK_LIMIT_REACHED'
  | 'KEYFRAME_LIMIT_REACHED'
  | 'KEYFRAME_TIME_DUPLICATE'
  | 'KEYFRAME_TIME_OUT_OF_RANGE'
  | 'KEYFRAME_VALUE_OUT_OF_RANGE'
  | 'KEYFRAME_SELECTION_EMPTY'
  | 'KEYFRAME_SELECTION_INCOMPATIBLE'
  | 'KEYFRAME_MOVE_OUT_OF_RANGE'
  | 'KEYFRAME_MOVE_COLLISION'
  | 'EASING_NOT_SUPPORTED'
  | 'TARGET_LOCKED'
  | 'SOURCE_MAPPING_INVALID'
  | 'TARGET_CHANGED'
  | 'PROJECT_STALE'
  | 'MINIMUM_KEYFRAMES_REQUIRED'
  | 'PASTE_PROPERTY_INCOMPATIBLE'
  | 'PASTE_TIME_OUT_OF_RANGE'

export type EditorAnimationRefusalV1 = Readonly<{
  code: EditorAnimationRefusalCodeV1
  message: string
  property: EditorAnimationPropertyIdV1 | null
  canonicalAtTicks: number | null
}>

export type EditorAnimationTrackStateV1 = Readonly<{
  targetKind: EditorAnimationTargetKindV1
  durationTicks: number
  transform: VisualTransform
  crop: VisualCrop
  tracks: readonly VisualPropertyTrack[]
  locked?: boolean
}>

export type EditorAnimationTrackPlanV1 =
  | Readonly<{ ok: true; state: EditorAnimationTrackStateV1; selectedTicks: readonly number[] }>
  | Readonly<{ ok: false; refusal: EditorAnimationRefusalV1 }>

const refusal = (
  code: EditorAnimationRefusalCodeV1,
  message: string,
  property: EditorAnimationPropertyIdV1 | null = null,
  canonicalAtTicks: number | null = null,
): EditorAnimationTrackPlanV1 => Object.freeze({
  ok: false,
  refusal: Object.freeze({ code, message, property, canonicalAtTicks }),
})

const success = (
  state: EditorAnimationTrackStateV1,
  selectedTicks: readonly number[] = Object.freeze([]),
): EditorAnimationTrackPlanV1 => Object.freeze({ ok: true, state: Object.freeze(state), selectedTicks: Object.freeze([...selectedTicks]) })

const trackFor = (state: EditorAnimationTrackStateV1, property: VisualProperty): VisualPropertyTrack | null =>
  state.tracks.find((track) => track.property === property) ?? null

const sortedTracks = (tracks: readonly VisualPropertyTrack[]): readonly VisualPropertyTrack[] => Object.freeze(
  [...tracks].sort((left, right) => VISUAL_PROPERTIES.indexOf(left.property) - VISUAL_PROPERTIES.indexOf(right.property)),
)

const replaceTrack = (
  state: EditorAnimationTrackStateV1,
  property: VisualProperty,
  track: VisualPropertyTrack | null,
): EditorAnimationTrackStateV1 => Object.freeze({
  ...state,
  tracks: sortedTracks([
    ...state.tracks.filter((candidate) => candidate.property !== property),
    ...(track ? [track] : []),
  ]),
})

const validatePlannerTarget = (
  state: EditorAnimationTrackStateV1,
  property: VisualProperty,
): EditorAnimationTrackPlanV1 | null => {
  if (state.locked) return refusal('TARGET_LOCKED', 'Unlock this track before editing animation.', property)
  const capability = animationCapabilityForProperty(state.targetKind, property, state)
  if (!capability) return refusal('PROPERTY_NOT_ANIMATABLE', `${LABELS[property]} is not animatable for this item.`, property)
  if (!wholeTick(state.durationTicks) || state.durationTicks < 1) {
    return refusal('ANIMATION_TARGET_MISSING', 'This item does not expose a valid animation interval.', property)
  }
  return null
}

const validateValue = (
  state: EditorAnimationTrackStateV1,
  property: VisualProperty,
  value: number,
): EditorAnimationTrackPlanV1 | null => {
  const capability = animationCapabilityForProperty(state.targetKind, property, state)
  if (!capability) return refusal('PROPERTY_NOT_ANIMATABLE', `${LABELS[property]} is not animatable for this item.`, property)
  if (!Number.isFinite(value) || value < capability.minimum || value > capability.maximum) {
    return refusal('KEYFRAME_VALUE_OUT_OF_RANGE', `${capability.label} must stay between ${capability.minimum} and ${capability.maximum}.`, property)
  }
  return null
}

const cloneFrame = (frame: VisualKeyframe, changes: Partial<{ atTicks: number; value: number; easing: VisualEasing }> = {}): VisualKeyframe => Object.freeze({
  at: mediaTime(changes.atTicks ?? frame.at.ticks),
  value: changes.value ?? frame.value,
  easing: changes.easing ?? frame.easing,
})

const linear: VisualEasing = Object.freeze({ kind: 'linear' })

export const planAddEditorKeyframe = (input: Readonly<{
  state: EditorAnimationTrackStateV1
  property: VisualProperty
  canonicalAtTicks: number
  easing?: VisualEasing
}>): EditorAnimationTrackPlanV1 => {
  const invalidTarget = validatePlannerTarget(input.state, input.property)
  if (invalidTarget) return invalidTarget
  if (!wholeTick(input.canonicalAtTicks) || input.canonicalAtTicks > input.state.durationTicks) {
    return refusal('KEYFRAME_TIME_OUT_OF_RANGE', 'Move the playhead inside this animation before adding a keyframe.', input.property, input.canonicalAtTicks)
  }
  const existing = trackFor(input.state, input.property)
  if (existing?.keyframes.some((frame) => frame.at.ticks === input.canonicalAtTicks)) {
    return refusal('KEYFRAME_TIME_DUPLICATE', 'A keyframe already exists at this time.', input.property, input.canonicalAtTicks)
  }
  if (!existing && input.state.tracks.length >= MAX_VISUAL_TRACKS) {
    return refusal('TRACK_LIMIT_REACHED', 'This item already has the maximum number of animated properties.', input.property)
  }
  if (existing && existing.keyframes.length >= MAX_KEYFRAMES_PER_TRACK) {
    return refusal('KEYFRAME_LIMIT_REACHED', 'This property already has the maximum number of keyframes.', input.property)
  }
  const value = visualPropertyBaseValue(input.state, input.property)
  const easing = input.easing ?? linear
  const valueFailure = validateValue(input.state, input.property, value)
  if (valueFailure) return valueFailure
  const seed = existing?.keyframes ?? Object.freeze([
    Object.freeze({ at: mediaTime(0), value, easing: linear }),
    Object.freeze({ at: mediaTime(input.state.durationTicks), value, easing: linear }),
  ])
  const keyframes = [...seed, Object.freeze({ at: mediaTime(input.canonicalAtTicks), value, easing })]
    .filter((frame, index, frames) => frames.findIndex((candidate) => candidate.at.ticks === frame.at.ticks) === index)
    .sort((left, right) => left.at.ticks - right.at.ticks)
  if (keyframes.length < 2) return refusal('MINIMUM_KEYFRAMES_REQUIRED', 'Animation needs at least two keyframes.', input.property)
  const next = replaceTrack(input.state, input.property, Object.freeze({ property: input.property, keyframes: Object.freeze(keyframes) }))
  return success(next, [input.canonicalAtTicks])
}

export const planDeleteEditorKeyframes = (input: Readonly<{
  state: EditorAnimationTrackStateV1
  property: VisualProperty
  canonicalAtTicks: readonly number[]
}>): EditorAnimationTrackPlanV1 => {
  const invalidTarget = validatePlannerTarget(input.state, input.property)
  if (invalidTarget) return invalidTarget
  if (input.canonicalAtTicks.length === 0) return refusal('KEYFRAME_SELECTION_EMPTY', 'Select at least one keyframe to delete.', input.property)
  const track = trackFor(input.state, input.property)
  if (!track) return refusal('ANIMATION_TARGET_MISSING', 'This property is not animated.', input.property)
  const selected = new Set(input.canonicalAtTicks)
  if ([...selected].some((tick) => !track.keyframes.some((frame) => frame.at.ticks === tick))) {
    return refusal('TARGET_CHANGED', 'The selected keyframe changed. The selection was refreshed.', input.property)
  }
  const remaining = track.keyframes.filter((frame) => !selected.has(frame.at.ticks))
  if (remaining.length < 2) {
    return refusal('MINIMUM_KEYFRAMES_REQUIRED', 'Animation needs at least two keyframes. Use Remove Animation to remove the whole track.', input.property)
  }
  return success(replaceTrack(input.state, input.property, Object.freeze({ property: input.property, keyframes: Object.freeze(remaining) })))
}

export const planRemoveAnimationTrack = (input: Readonly<{
  state: EditorAnimationTrackStateV1
  property: VisualProperty
}>): EditorAnimationTrackPlanV1 => {
  const invalidTarget = validatePlannerTarget(input.state, input.property)
  if (invalidTarget) return invalidTarget
  if (!trackFor(input.state, input.property)) return refusal('ANIMATION_TARGET_MISSING', 'This property is not animated.', input.property)
  return success(replaceTrack(input.state, input.property, null))
}

export type EditorKeyframeMoveV1 = Readonly<{
  property: VisualProperty
  fromTicks: number
  toTicks: number
}>

export const planMoveEditorKeyframes = (input: Readonly<{
  state: EditorAnimationTrackStateV1
  moves: readonly EditorKeyframeMoveV1[]
}>): EditorAnimationTrackPlanV1 => {
  if (input.moves.length === 0) return refusal('KEYFRAME_SELECTION_EMPTY', 'Select at least one keyframe to move.')
  if (input.state.locked) return refusal('TARGET_LOCKED', 'Unlock this track before editing animation.')
  const byProperty = new Map<VisualProperty, EditorKeyframeMoveV1[]>()
  for (const move of input.moves) {
    const invalidTarget = validatePlannerTarget(input.state, move.property)
    if (invalidTarget) return invalidTarget
    if (!wholeTick(move.toTicks) || move.toTicks > input.state.durationTicks) {
      return refusal('KEYFRAME_MOVE_OUT_OF_RANGE', 'That move would place a keyframe outside the animation interval.', move.property, move.toTicks)
    }
    const list = byProperty.get(move.property) ?? []
    list.push(move)
    byProperty.set(move.property, list)
  }
  let next = input.state
  for (const [property, moves] of byProperty) {
    const track = trackFor(next, property)
    if (!track) return refusal('ANIMATION_TARGET_MISSING', 'This property is not animated.', property)
    const moveByFrom = new Map(moves.map((move) => [move.fromTicks, move]))
    if (moveByFrom.size !== moves.length) return refusal('KEYFRAME_SELECTION_INCOMPATIBLE', 'The same keyframe cannot be moved twice in one gesture.', property)
    if ([...moveByFrom.keys()].some((tick) => !track.keyframes.some((frame) => frame.at.ticks === tick))) {
      return refusal('TARGET_CHANGED', 'A selected keyframe changed before the move completed.', property)
    }
    const finalTicks = track.keyframes.map((frame) => moveByFrom.get(frame.at.ticks)?.toTicks ?? frame.at.ticks)
    if (new Set(finalTicks).size !== finalTicks.length) {
      return refusal('KEYFRAME_MOVE_COLLISION', 'Two keyframes cannot occupy the same time.', property)
    }
    const keyframes = track.keyframes
      .map((frame) => cloneFrame(frame, { atTicks: moveByFrom.get(frame.at.ticks)?.toTicks }))
      .sort((left, right) => left.at.ticks - right.at.ticks)
    next = replaceTrack(next, property, Object.freeze({ property, keyframes: Object.freeze(keyframes) }))
  }
  return success(next, input.moves.map((move) => move.toTicks))
}

export type EditorKeyframeValueUpdateV1 = Readonly<{
  property: VisualProperty
  canonicalAtTicks: number
  value: number
}>

export const planSetEditorKeyframeValues = (input: Readonly<{
  state: EditorAnimationTrackStateV1
  updates: readonly EditorKeyframeValueUpdateV1[]
}>): EditorAnimationTrackPlanV1 => {
  if (input.updates.length === 0) return refusal('KEYFRAME_SELECTION_EMPTY', 'Select at least one keyframe to edit.')
  if (input.state.locked) return refusal('TARGET_LOCKED', 'Unlock this track before editing animation.')
  const byProperty = new Map<VisualProperty, EditorKeyframeValueUpdateV1[]>()
  for (const update of input.updates) {
    const invalidTarget = validatePlannerTarget(input.state, update.property)
    if (invalidTarget) return invalidTarget
    const invalidValue = validateValue(input.state, update.property, update.value)
    if (invalidValue) return invalidValue
    const list = byProperty.get(update.property) ?? []
    list.push(update)
    byProperty.set(update.property, list)
  }
  let next = input.state
  for (const [property, updates] of byProperty) {
    const track = trackFor(next, property)
    if (!track) return refusal('ANIMATION_TARGET_MISSING', 'This property is not animated.', property)
    const byTick = new Map(updates.map((update) => [update.canonicalAtTicks, update]))
    if ([...byTick.keys()].some((tick) => !track.keyframes.some((frame) => frame.at.ticks === tick))) {
      return refusal('TARGET_CHANGED', 'A selected keyframe changed before the value edit completed.', property)
    }
    const keyframes = track.keyframes.map((frame) => cloneFrame(frame, { value: byTick.get(frame.at.ticks)?.value }))
    next = replaceTrack(next, property, Object.freeze({ property, keyframes: Object.freeze(keyframes) }))
  }
  return success(next, input.updates.map((update) => update.canonicalAtTicks))
}

export const planSetEditorKeyframeEasing = (input: Readonly<{
  state: EditorAnimationTrackStateV1
  property: VisualProperty
  canonicalAtTicks: readonly number[]
  easing: VisualEasing
}>): EditorAnimationTrackPlanV1 => {
  const invalidTarget = validatePlannerTarget(input.state, input.property)
  if (invalidTarget) return invalidTarget
  if (input.canonicalAtTicks.length === 0) return refusal('KEYFRAME_SELECTION_EMPTY', 'Select at least one keyframe to change interpolation.', input.property)
  const capability = animationCapabilityForProperty(input.state.targetKind, input.property, input.state)
  if (!capability?.allowedInterpolations.includes(input.easing.kind)) {
    return refusal('EASING_NOT_SUPPORTED', 'This interpolation is not supported for the selected property.', input.property)
  }
  const track = trackFor(input.state, input.property)
  if (!track) return refusal('ANIMATION_TARGET_MISSING', 'This property is not animated.', input.property)
  const selected = new Set(input.canonicalAtTicks)
  const lastTick = track.keyframes.at(-1)?.at.ticks
  if ([...selected].some((tick) => tick === lastTick)) {
    return refusal('EASING_NOT_SUPPORTED', 'Interpolation applies from a keyframe to the next; the final keyframe has no outgoing segment.', input.property)
  }
  if ([...selected].some((tick) => !track.keyframes.some((frame) => frame.at.ticks === tick))) {
    return refusal('TARGET_CHANGED', 'A selected keyframe changed before interpolation was applied.', input.property)
  }
  const keyframes = track.keyframes.map((frame) => cloneFrame(frame, { easing: selected.has(frame.at.ticks) ? input.easing : undefined }))
  return success(replaceTrack(input.state, input.property, Object.freeze({ property: input.property, keyframes: Object.freeze(keyframes) })), input.canonicalAtTicks)
}

export type EditorKeyframeClipboardV1 = Readonly<{
  schemaVersion: 'sanverse.editor-keyframe-clipboard/v1'
  sourceProperty: EditorAnimationPropertyIdV1
  keyframes: readonly Readonly<{
    offsetTicks: number
    value: number
    easing: VisualEasing
  }>[]
}>

export const createEditorKeyframeClipboard = (input: Readonly<{
  track: VisualPropertyTrack
  canonicalAtTicks: readonly number[]
}>): EditorKeyframeClipboardV1 | null => {
  const selected = input.track.keyframes.filter((frame) => input.canonicalAtTicks.includes(frame.at.ticks))
  if (selected.length === 0) return null
  const first = selected[0].at.ticks
  return Object.freeze({
    schemaVersion: 'sanverse.editor-keyframe-clipboard/v1',
    sourceProperty: input.track.property,
    keyframes: Object.freeze(selected.map((frame) => Object.freeze({
      offsetTicks: frame.at.ticks - first,
      value: frame.value,
      easing: frame.easing,
    }))),
  })
}

export const planPasteEditorKeyframes = (input: Readonly<{
  state: EditorAnimationTrackStateV1
  property: VisualProperty
  clipboard: EditorKeyframeClipboardV1
  anchorTicks: number
}>): EditorAnimationTrackPlanV1 => {
  const invalidTarget = validatePlannerTarget(input.state, input.property)
  if (invalidTarget) return invalidTarget
  if (input.clipboard.sourceProperty !== input.property) {
    return refusal('PASTE_PROPERTY_INCOMPATIBLE', 'Keyframes can only be pasted into the same property.', input.property)
  }
  if (!wholeTick(input.anchorTicks)) return refusal('PASTE_TIME_OUT_OF_RANGE', 'Paste time is outside this animation.', input.property, input.anchorTicks)
  const pasted = input.clipboard.keyframes.map((frame) => Object.freeze({
    atTicks: input.anchorTicks + frame.offsetTicks,
    value: frame.value,
    easing: frame.easing,
  }))
  if (pasted.some((frame) => frame.atTicks < 0 || frame.atTicks > input.state.durationTicks)) {
    return refusal('PASTE_TIME_OUT_OF_RANGE', 'The pasted keyframes would extend outside this animation.', input.property)
  }
  if (pasted.length > MAX_KEYFRAMES_PER_TRACK) return refusal('KEYFRAME_LIMIT_REACHED', 'The pasted selection is too large.', input.property)
  for (const frame of pasted) {
    const invalidValue = validateValue(input.state, input.property, frame.value)
    if (invalidValue) return invalidValue
  }
  const existing = trackFor(input.state, input.property)
  const merged = new Map<number, VisualKeyframe>()
  existing?.keyframes.forEach((frame) => merged.set(frame.at.ticks, frame))
  pasted.forEach((frame) => merged.set(frame.atTicks, Object.freeze({ at: mediaTime(frame.atTicks), value: frame.value, easing: frame.easing })))
  const keyframes = [...merged.values()].sort((left, right) => left.at.ticks - right.at.ticks)
  if (keyframes.length < 2) return refusal('MINIMUM_KEYFRAMES_REQUIRED', 'Animation needs at least two keyframes.', input.property)
  if (keyframes.length > MAX_KEYFRAMES_PER_TRACK) return refusal('KEYFRAME_LIMIT_REACHED', 'This property would exceed the keyframe limit.', input.property)
  if (!existing && input.state.tracks.length >= MAX_VISUAL_TRACKS) return refusal('TRACK_LIMIT_REACHED', 'This item already has the maximum number of animated properties.', input.property)
  return success(
    replaceTrack(input.state, input.property, Object.freeze({ property: input.property, keyframes: Object.freeze(keyframes) })),
    pasted.map((frame) => frame.atTicks),
  )
}

export const planSetStaticAnimatedProperty = (input: Readonly<{
  state: EditorAnimationTrackStateV1
  property: VisualProperty
  value: number
}>): EditorAnimationTrackPlanV1 => {
  const invalidTarget = validatePlannerTarget(input.state, input.property)
  if (invalidTarget) return invalidTarget
  const invalidValue = validateValue(input.state, input.property, input.value)
  if (invalidValue) return invalidValue
  if (trackFor(input.state, input.property)) {
    return refusal('KEYFRAME_SELECTION_INCOMPATIBLE', 'This property is animated. Edit a keyframe or remove the animation first.', input.property)
  }
  return success(withVisualPropertyBaseValue(input.state, input.property, input.value))
}

export const editorAnimationStateFromFootageMotion = (
  operation: SetFootageMotionOperation,
  locked = false,
): EditorAnimationTrackStateV1 => Object.freeze({
  targetKind: 'primary-footage',
  durationTicks: operation.sourceInterval.duration.ticks,
  transform: operation.transform,
  crop: operation.crop,
  tracks: operation.tracks,
  locked,
})

export const editorAnimationStateFromVisualProperties = (
  targetKind: Exclude<EditorAnimationTargetKindV1, 'primary-footage' | 'freeze' | 'dialogue' | 'music'>,
  operation: SetVisualPropertiesOperation,
  durationTicks: number,
  locked = false,
): EditorAnimationTrackStateV1 => Object.freeze({
  targetKind,
  durationTicks,
  transform: operation.transform,
  crop: operation.crop,
  tracks: operation.tracks,
  locked,
})

export const rebuildFootageMotionOperationWithAnimation = (input: Readonly<{
  operation: SetFootageMotionOperation
  nextState: EditorAnimationTrackStateV1
  operationId: string
}>): SetFootageMotionOperation => Object.freeze({
  ...input.operation,
  operationId: input.operationId,
  transform: input.nextState.transform,
  crop: input.nextState.crop,
  tracks: input.nextState.tracks,
})

export const rebuildVisualPropertiesOperationWithAnimation = (input: Readonly<{
  operation: SetVisualPropertiesOperation
  nextState: EditorAnimationTrackStateV1
  operationId: string
}>): SetVisualPropertiesOperation => Object.freeze({
  ...input.operation,
  operationId: input.operationId,
  transform: input.nextState.transform,
  crop: input.nextState.crop,
  tracks: input.nextState.tracks,
})

export const editorAnimationStateFromVisualValue = (input: Readonly<{
  targetKind: Exclude<EditorAnimationTargetKindV1, 'primary-footage' | 'freeze' | 'dialogue' | 'music'>
  properties: VisualProperties
  durationTicks: number
  locked?: boolean
}>): EditorAnimationTrackStateV1 => Object.freeze({
  targetKind: input.targetKind,
  durationTicks: input.durationTicks,
  transform: input.properties.transform,
  crop: input.properties.crop,
  tracks: input.properties.tracks,
  locked: input.locked ?? false,
})
