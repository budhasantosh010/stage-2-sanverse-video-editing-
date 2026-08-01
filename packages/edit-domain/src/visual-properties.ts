import { capabilityProduces, VISUAL_PROPERTIES_PRIMITIVE_ID } from './capabilities.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { err, isRecord, ok, type Result } from './result.ts'
import { OPERATION_SCHEMA_VERSION } from './timeline-operations.ts'
import { validateMediaTime, type MediaTime } from './time.ts'

export const VISUAL_PROPERTIES_OPERATION_KIND = 'set-visual-properties'
export const VISUAL_ID_PATTERN =
  /^(?:operation_[a-z0-9]{8,64}|captions_[a-z0-9]{8,64}|title_[a-z0-9]{4,64}|callout_[a-z0-9]{4,64}|broll_[a-z0-9]{4,64})$/
const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/
export const MAX_VISUAL_TRACKS = 12
export const MAX_KEYFRAMES_PER_TRACK = 64

export const VISUAL_PROPERTIES = Object.freeze([
  'translate-x',
  'translate-y',
  'scale',
  'rotation',
  'opacity',
  'crop-top',
  'crop-right',
  'crop-bottom',
  'crop-left',
] as const)
export type VisualProperty = (typeof VISUAL_PROPERTIES)[number]

export type LinearEasing = Readonly<{ kind: 'linear' }>
export type CubicBezierEasing = Readonly<{
  kind: 'cubic-bezier'
  x1: number
  y1: number
  x2: number
  y2: number
}>
export type SpringEasing = Readonly<{
  kind: 'spring'
  mass: number
  stiffness: number
  damping: number
  velocity: number
}>
export type BounceEasing = Readonly<{ kind: 'bounce'; intensity: number }>
export type VisualEasing = LinearEasing | CubicBezierEasing | SpringEasing | BounceEasing

export type VisualKeyframe = Readonly<{
  /** Time relative to the start of the visual. */
  at: MediaTime
  value: number
  /** Curve used from this keyframe to the next one. */
  easing: VisualEasing
}>

export type VisualPropertyTrack = Readonly<{
  property: VisualProperty
  keyframes: readonly VisualKeyframe[]
}>

export type VisualTransform = Readonly<{
  /** Fractions of the frame, relative to the visual's authored position. */
  translateX: number
  translateY: number
  scale: number
  rotationDegrees: number
  opacity: number
}>

export type VisualCrop = Readonly<{ top: number; right: number; bottom: number; left: number }>
export type VisualMask = Readonly<{
  shape: 'none' | 'rectangle' | 'ellipse'
  /** Fraction of the smaller mask dimension. */
  feather: number
}>

export type VisualTransitionKind = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom'
export type VisualTransitionPhase = Readonly<{
  kind: VisualTransitionKind
  duration: MediaTime
  easing: VisualEasing
}>
export type VisualTransition = Readonly<{
  enter: VisualTransitionPhase
  exit: VisualTransitionPhase
}>

export type VisualEffect =
  | Readonly<{ kind: 'blur'; amount: number }>
  | Readonly<{ kind: 'brightness'; amount: number }>
  | Readonly<{ kind: 'contrast'; amount: number }>
  | Readonly<{ kind: 'saturation'; amount: number }>
  | Readonly<{ kind: 'grayscale'; amount: number }>

export type VisualProperties = Readonly<{
  transform: VisualTransform
  crop: VisualCrop
  layer: number
  mask: VisualMask
  tracks: readonly VisualPropertyTrack[]
  transition: VisualTransition
  effects: readonly VisualEffect[]
}>

export type SetVisualPropertiesOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: typeof VISUAL_PROPERTIES_OPERATION_KIND
  capabilityId: string
  visualId: string
  transform: VisualTransform
  crop: VisualCrop
  layer: number
  mask: VisualMask
  tracks: readonly VisualPropertyTrack[]
  transition: VisualTransition
  effects: readonly VisualEffect[]
  extensions: Extensions
}>

export const DEFAULT_VISUAL_PROPERTIES: VisualProperties = Object.freeze({
  transform: Object.freeze({
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotationDegrees: 0,
    opacity: 1,
  }),
  crop: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
  layer: 0,
  mask: Object.freeze({ shape: 'none', feather: 0 }),
  tracks: Object.freeze([]),
  transition: Object.freeze({
    enter: Object.freeze({
      kind: 'none',
      duration: Object.freeze({ ticks: 0, timescale: 1_440_000 }),
      easing: Object.freeze({ kind: 'linear' }),
    }),
    exit: Object.freeze({
      kind: 'none',
      duration: Object.freeze({ ticks: 0, timescale: 1_440_000 }),
      easing: Object.freeze({ kind: 'linear' }),
    }),
  }),
  effects: Object.freeze([]),
})

export type VisualPropertiesError = Readonly<{
  code: 'OPERATION_INVALID'
  issues: readonly {
    path: string
    code: 'TYPE_INVALID' | 'FIELD_REQUIRED' | 'FIELD_UNKNOWN' | 'VALUE_OUT_OF_RANGE' | 'CAPABILITY_UNKNOWN'
  }[]
}>
type Issue = VisualPropertiesError['issues'][number]

const OPERATION_KEYS = Object.freeze([
  'schemaVersion',
  'operationId',
  'kind',
  'capabilityId',
  'visualId',
  'transform',
  'crop',
  'layer',
  'mask',
  'tracks',
  'transition',
  'effects',
  'extensions',
])
const TRANSFORM_KEYS = Object.freeze(['translateX', 'translateY', 'scale', 'rotationDegrees', 'opacity'])
const CROP_KEYS = Object.freeze(['top', 'right', 'bottom', 'left'])
const MASK_KEYS = Object.freeze(['shape', 'feather'])
const TRACK_KEYS = Object.freeze(['property', 'keyframes'])
const KEYFRAME_KEYS = Object.freeze(['at', 'value', 'easing'])
const TRANSITION_KEYS = Object.freeze(['enter', 'exit'])
const TRANSITION_PHASE_KEYS = Object.freeze(['kind', 'duration', 'easing'])
const EFFECT_KEYS = Object.freeze(['kind', 'amount'])

const closedKeys = (value: Record<string, unknown>, keys: readonly string[], path: string, issues: Issue[]): void => {
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  }
}

const finiteBetween = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum

const propertyValueIsValid = (property: VisualProperty, value: unknown): value is number => {
  if (property === 'translate-x' || property === 'translate-y') return finiteBetween(value, -2, 2)
  if (property === 'scale') return finiteBetween(value, 0.01, 20)
  if (property === 'rotation') return finiteBetween(value, -3_600, 3_600)
  return finiteBetween(value, 0, 1)
}

const validateEasing = (input: unknown, path: string, issues: Issue[]): VisualEasing | null => {
  if (!isRecord(input) || typeof input.kind !== 'string') {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  if (input.kind === 'linear') {
    closedKeys(input, ['kind'], path, issues)
    return Object.freeze({ kind: 'linear' })
  }
  if (input.kind === 'cubic-bezier') {
    closedKeys(input, ['kind', 'x1', 'y1', 'x2', 'y2'], path, issues)
    if (
      !finiteBetween(input.x1, 0, 1) ||
      !finiteBetween(input.x2, 0, 1) ||
      !finiteBetween(input.y1, -2, 2) ||
      !finiteBetween(input.y2, -2, 2)
    ) {
      issues.push({ path, code: 'VALUE_OUT_OF_RANGE' })
      return null
    }
    return Object.freeze({
      kind: 'cubic-bezier',
      x1: input.x1,
      y1: input.y1,
      x2: input.x2,
      y2: input.y2,
    })
  }
  if (input.kind === 'spring') {
    closedKeys(input, ['kind', 'mass', 'stiffness', 'damping', 'velocity'], path, issues)
    if (
      !finiteBetween(input.mass, 0.01, 100) ||
      !finiteBetween(input.stiffness, 1, 1_000) ||
      !finiteBetween(input.damping, 0, 100) ||
      !finiteBetween(input.velocity, -100, 100)
    ) {
      issues.push({ path, code: 'VALUE_OUT_OF_RANGE' })
      return null
    }
    return Object.freeze({
      kind: 'spring',
      mass: input.mass,
      stiffness: input.stiffness,
      damping: input.damping,
      velocity: input.velocity,
    })
  }
  if (input.kind === 'bounce') {
    closedKeys(input, ['kind', 'intensity'], path, issues)
    if (!finiteBetween(input.intensity, 0, 1)) {
      issues.push({ path: `${path}.intensity`, code: 'VALUE_OUT_OF_RANGE' })
      return null
    }
    return Object.freeze({ kind: 'bounce', intensity: input.intensity })
  }
  issues.push({ path: `${path}.kind`, code: 'VALUE_OUT_OF_RANGE' })
  return null
}

const validateTracks = (input: unknown, path: string, issues: Issue[]): readonly VisualPropertyTrack[] => {
  if (!Array.isArray(input) || input.length > MAX_VISUAL_TRACKS) {
    issues.push({ path, code: 'VALUE_OUT_OF_RANGE' })
    return Object.freeze([])
  }
  const seen = new Set<VisualProperty>()
  const tracks: VisualPropertyTrack[] = []
  input.forEach((candidate, trackIndex) => {
    const trackPath = `${path}[${trackIndex}]`
    if (!isRecord(candidate)) {
      issues.push({ path: trackPath, code: 'TYPE_INVALID' })
      return
    }
    closedKeys(candidate, TRACK_KEYS, trackPath, issues)
    if (
      typeof candidate.property !== 'string' ||
      !(VISUAL_PROPERTIES as readonly string[]).includes(candidate.property)
    ) {
      issues.push({ path: `${trackPath}.property`, code: 'VALUE_OUT_OF_RANGE' })
      return
    }
    const property = candidate.property as VisualProperty
    if (seen.has(property)) issues.push({ path: `${trackPath}.property`, code: 'VALUE_OUT_OF_RANGE' })
    seen.add(property)
    if (
      !Array.isArray(candidate.keyframes) ||
      candidate.keyframes.length < 2 ||
      candidate.keyframes.length > MAX_KEYFRAMES_PER_TRACK
    ) {
      issues.push({ path: `${trackPath}.keyframes`, code: 'VALUE_OUT_OF_RANGE' })
      return
    }
    let previousTicks = -1
    const keyframes: VisualKeyframe[] = []
    candidate.keyframes.forEach((keyframe, keyframeIndex) => {
      const keyframePath = `${trackPath}.keyframes[${keyframeIndex}]`
      if (!isRecord(keyframe)) {
        issues.push({ path: keyframePath, code: 'TYPE_INVALID' })
        return
      }
      closedKeys(keyframe, KEYFRAME_KEYS, keyframePath, issues)
      const at = validateMediaTime(keyframe.at, `${keyframePath}.at`)
      if (!at.ok || at.value.ticks <= previousTicks) {
        issues.push({ path: `${keyframePath}.at`, code: 'VALUE_OUT_OF_RANGE' })
      } else {
        previousTicks = at.value.ticks
      }
      if (!propertyValueIsValid(property, keyframe.value)) {
        issues.push({ path: `${keyframePath}.value`, code: 'VALUE_OUT_OF_RANGE' })
      }
      const easing = validateEasing(keyframe.easing, `${keyframePath}.easing`, issues)
      if (at.ok && propertyValueIsValid(property, keyframe.value) && easing) {
        keyframes.push(Object.freeze({ at: at.value, value: keyframe.value, easing }))
      }
    })
    tracks.push(Object.freeze({ property, keyframes: Object.freeze(keyframes) }))
  })
  return Object.freeze(tracks)
}

const TRANSITION_KINDS: readonly VisualTransitionKind[] = Object.freeze([
  'none',
  'fade',
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-down',
  'zoom',
])

const validateTransitionPhase = (
  input: unknown,
  path: string,
  issues: Issue[],
): VisualTransitionPhase | null => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  closedKeys(input, TRANSITION_PHASE_KEYS, path, issues)
  if (typeof input.kind !== 'string' || !(TRANSITION_KINDS as readonly string[]).includes(input.kind)) {
    issues.push({ path: `${path}.kind`, code: 'VALUE_OUT_OF_RANGE' })
    return null
  }
  const duration = validateMediaTime(input.duration, `${path}.duration`)
  const durationTicks = duration.ok ? duration.value.ticks : -1
  if (
    !duration.ok ||
    durationTicks > 10 * 1_440_000 ||
    (input.kind === 'none' ? durationTicks !== 0 : durationTicks <= 0)
  ) {
    issues.push({ path: `${path}.duration`, code: 'VALUE_OUT_OF_RANGE' })
  }
  const easing = validateEasing(input.easing, `${path}.easing`, issues)
  if (!duration.ok || !easing) return null
  return Object.freeze({
    kind: input.kind as VisualTransitionKind,
    duration: duration.value,
    easing,
  })
}

const validateTransition = (input: unknown, path: string, issues: Issue[]): VisualTransition => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return DEFAULT_VISUAL_PROPERTIES.transition
  }
  closedKeys(input, TRANSITION_KEYS, path, issues)
  const enter = validateTransitionPhase(input.enter, `${path}.enter`, issues)
  const exit = validateTransitionPhase(input.exit, `${path}.exit`, issues)
  return enter && exit ? Object.freeze({ enter, exit }) : DEFAULT_VISUAL_PROPERTIES.transition
}

const validateEffects = (input: unknown, path: string, issues: Issue[]): readonly VisualEffect[] => {
  if (!Array.isArray(input) || input.length > 5) {
    issues.push({ path, code: 'VALUE_OUT_OF_RANGE' })
    return Object.freeze([])
  }
  const seen = new Set<string>()
  const effects: VisualEffect[] = []
  input.forEach((effect, index) => {
    const effectPath = `${path}[${index}]`
    if (!isRecord(effect)) {
      issues.push({ path: effectPath, code: 'TYPE_INVALID' })
      return
    }
    closedKeys(effect, EFFECT_KEYS, effectPath, issues)
    if (
      effect.kind !== 'blur' &&
      effect.kind !== 'brightness' &&
      effect.kind !== 'contrast' &&
      effect.kind !== 'saturation' &&
      effect.kind !== 'grayscale'
    ) {
      issues.push({ path: `${effectPath}.kind`, code: 'VALUE_OUT_OF_RANGE' })
      return
    }
    if (seen.has(effect.kind)) {
      issues.push({ path: `${effectPath}.kind`, code: 'VALUE_OUT_OF_RANGE' })
      return
    }
    seen.add(effect.kind)
    const valid =
      effect.kind === 'blur'
        ? finiteBetween(effect.amount, 0, 0.1)
        : effect.kind === 'brightness'
          ? finiteBetween(effect.amount, -1, 1)
          : effect.kind === 'contrast' || effect.kind === 'saturation'
            ? finiteBetween(effect.amount, 0, 4)
            : finiteBetween(effect.amount, 0, 1)
    if (!valid) {
      issues.push({ path: `${effectPath}.amount`, code: 'VALUE_OUT_OF_RANGE' })
      return
    }
    effects.push(Object.freeze({ kind: effect.kind, amount: effect.amount }) as VisualEffect)
  })
  return Object.freeze(effects)
}

export const validateVisualPropertiesOperation = (
  input: unknown,
  path = '$',
): Result<SetVisualPropertiesOperation, VisualPropertiesError> => {
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  closedKeys(input, OPERATION_KEYS, path, issues)
  if (input.schemaVersion !== OPERATION_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (input.kind !== VISUAL_PROPERTIES_OPERATION_KIND) {
    issues.push({ path: `${path}.kind`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) {
    issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (
    typeof input.capabilityId !== 'string' ||
    !capabilityProduces(input.capabilityId, VISUAL_PROPERTIES_OPERATION_KIND)
  ) {
    issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  }
  if (typeof input.visualId !== 'string' || !VISUAL_ID_PATTERN.test(input.visualId)) {
    issues.push({ path: `${path}.visualId`, code: 'VALUE_OUT_OF_RANGE' })
  }

  let transform: VisualTransform = DEFAULT_VISUAL_PROPERTIES.transform
  if (!isRecord(input.transform)) {
    issues.push({ path: `${path}.transform`, code: 'TYPE_INVALID' })
  } else {
    closedKeys(input.transform, TRANSFORM_KEYS, `${path}.transform`, issues)
    if (
      !finiteBetween(input.transform.translateX, -2, 2) ||
      !finiteBetween(input.transform.translateY, -2, 2) ||
      !finiteBetween(input.transform.scale, 0.01, 20) ||
      !finiteBetween(input.transform.rotationDegrees, -3_600, 3_600) ||
      !finiteBetween(input.transform.opacity, 0, 1)
    ) {
      issues.push({ path: `${path}.transform`, code: 'VALUE_OUT_OF_RANGE' })
    } else {
      transform = Object.freeze({
        translateX: input.transform.translateX,
        translateY: input.transform.translateY,
        scale: input.transform.scale,
        rotationDegrees: input.transform.rotationDegrees,
        opacity: input.transform.opacity,
      })
    }
  }

  let crop: VisualCrop = DEFAULT_VISUAL_PROPERTIES.crop
  if (!isRecord(input.crop)) {
    issues.push({ path: `${path}.crop`, code: 'TYPE_INVALID' })
  } else {
    const rawCrop = input.crop
    closedKeys(rawCrop, CROP_KEYS, `${path}.crop`, issues)
    const valid = CROP_KEYS.every((key) => finiteBetween(rawCrop[key], 0, 0.99))
    if (
      !valid ||
      Number(rawCrop.top) + Number(rawCrop.bottom) >= 1 ||
      Number(rawCrop.left) + Number(rawCrop.right) >= 1
    ) {
      issues.push({ path: `${path}.crop`, code: 'VALUE_OUT_OF_RANGE' })
    } else {
      crop = Object.freeze({
        top: rawCrop.top as number,
        right: rawCrop.right as number,
        bottom: rawCrop.bottom as number,
        left: rawCrop.left as number,
      })
    }
  }

  if (!Number.isSafeInteger(input.layer) || (input.layer as number) < -100 || (input.layer as number) > 100) {
    issues.push({ path: `${path}.layer`, code: 'VALUE_OUT_OF_RANGE' })
  }

  let mask: VisualMask = DEFAULT_VISUAL_PROPERTIES.mask
  if (!isRecord(input.mask)) {
    issues.push({ path: `${path}.mask`, code: 'TYPE_INVALID' })
  } else {
    closedKeys(input.mask, MASK_KEYS, `${path}.mask`, issues)
    if (
      (input.mask.shape !== 'none' && input.mask.shape !== 'rectangle' && input.mask.shape !== 'ellipse') ||
      !finiteBetween(input.mask.feather, 0, 0.5) ||
      (input.mask.shape === 'none' && input.mask.feather !== 0)
    ) {
      issues.push({ path: `${path}.mask`, code: 'VALUE_OUT_OF_RANGE' })
    } else {
      mask = Object.freeze({ shape: input.mask.shape, feather: input.mask.feather })
    }
  }

  const tracks = validateTracks(input.tracks, `${path}.tracks`, issues)
  const transition = validateTransition(input.transition, `${path}.transition`, issues)
  const effects = validateEffects(input.effects, `${path}.effects`, issues)
  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) issues.push({ path: `${path}.extensions`, code: 'VALUE_OUT_OF_RANGE' })
  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind: VISUAL_PROPERTIES_OPERATION_KIND,
    capabilityId: input.capabilityId as string,
    visualId: input.visualId as string,
    transform,
    crop,
    layer: input.layer as number,
    mask,
    tracks,
    transition,
    effects,
    extensions: extensions.ok ? extensions.value : emptyExtensions(),
  }))
}

export type VisualMotionState = Readonly<{
  transform: VisualTransform
  crop: VisualCrop
  tracks: readonly VisualPropertyTrack[]
}>

/**
 * Validate the transform/crop/keyframe subset shared by overlays and primary footage.
 *
 * This intentionally delegates to the complete visual-properties validator so
 * preview overlays and primary footage can never drift to different numeric,
 * crop, easing, or keyframe limits. The synthetic fields are fixed internal
 * values and never escape this function.
 */
export const validateVisualMotionState = (
  input: unknown,
  path = '$',
  options: Readonly<{
    allowedProperties?: readonly VisualProperty[]
    requireOpaque?: boolean
    maximumRelativeTicks?: number
  }> = {},
): Result<VisualMotionState, VisualPropertiesError> => {
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  const keys = ['transform', 'crop', 'tracks'] as const
  closedKeys(input, keys, path, issues)
  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })

  const validated = validateVisualPropertiesOperation({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: 'operation_motionvalidate',
    kind: VISUAL_PROPERTIES_OPERATION_KIND,
    capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID,
    visualId: 'title_motionvalidation',
    transform: input.transform,
    crop: input.crop,
    layer: 0,
    mask: DEFAULT_VISUAL_PROPERTIES.mask,
    tracks: input.tracks,
    transition: DEFAULT_VISUAL_PROPERTIES.transition,
    effects: [],
    extensions: emptyExtensions(),
  }, path)
  if (!validated.ok) return validated

  if (options.requireOpaque && validated.value.transform.opacity !== 1) {
    issues.push({ path: `${path}.transform.opacity`, code: 'VALUE_OUT_OF_RANGE' })
  }
  const allowed = options.allowedProperties
  if (allowed) {
    validated.value.tracks.forEach((track, index) => {
      if (!allowed.includes(track.property)) {
        issues.push({ path: `${path}.tracks[${index}].property`, code: 'VALUE_OUT_OF_RANGE' })
      }
    })
  }
  if (options.maximumRelativeTicks !== undefined) {
    validated.value.tracks.forEach((track, trackIndex) => {
      track.keyframes.forEach((keyframe, keyframeIndex) => {
        if (keyframe.at.ticks > options.maximumRelativeTicks!) {
          issues.push({
            path: `${path}.tracks[${trackIndex}].keyframes[${keyframeIndex}].at`,
            code: 'VALUE_OUT_OF_RANGE',
          })
        }
      })
    })
  }
  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })

  return ok(Object.freeze({
    transform: validated.value.transform,
    crop: validated.value.crop,
    tracks: validated.value.tracks,
  }))
}

const cubic = (a: number, b: number, t: number): number => {
  const inverse = 1 - t
  return 3 * inverse * inverse * t * a + 3 * inverse * t * t * b + t * t * t
}

const cubicBezierProgress = (progress: number, easing: CubicBezierEasing): number => {
  let low = 0
  let high = 1
  let parameter = progress
  for (let attempt = 0; attempt < 20; attempt += 1) {
    parameter = (low + high) / 2
    const x = cubic(easing.x1, easing.x2, parameter)
    if (Math.abs(x - progress) < 1e-7) break
    if (x < progress) low = parameter
    else high = parameter
  }
  return cubic(easing.y1, easing.y2, parameter)
}

const bounceOut = (progress: number): number => {
  const n = 7.5625
  const d = 2.75
  if (progress < 1 / d) return n * progress * progress
  if (progress < 2 / d) {
    const shifted = progress - 1.5 / d
    return n * shifted * shifted + 0.75
  }
  if (progress < 2.5 / d) {
    const shifted = progress - 2.25 / d
    return n * shifted * shifted + 0.9375
  }
  const shifted = progress - 2.625 / d
  return n * shifted * shifted + 0.984375
}

export const applyVisualEasing = (progress: number, easing: VisualEasing): number => {
  const t = Math.min(1, Math.max(0, progress))
  if (easing.kind === 'linear') return t
  if (easing.kind === 'cubic-bezier') return cubicBezierProgress(t, easing)
  if (easing.kind === 'bounce') {
    return t * (1 - easing.intensity) + bounceOut(t) * easing.intensity
  }

  const omega0 = Math.sqrt(easing.stiffness / easing.mass)
  const zeta = easing.damping / (2 * Math.sqrt(easing.stiffness * easing.mass))
  if (zeta >= 1) return 1 - Math.exp(-omega0 * t)
  const omegaD = omega0 * Math.sqrt(1 - zeta * zeta)
  const envelope = Math.exp(-zeta * omega0 * t)
  const response =
    1 -
    envelope *
      (Math.cos(omegaD * t) + ((zeta * omega0 - easing.velocity) / omegaD) * Math.sin(omegaD * t))
  return Math.min(2, Math.max(-1, response))
}

export const evaluatePropertyTrack = (
  track: VisualPropertyTrack,
  relativeTicks: number,
): number => {
  const frames = track.keyframes
  if (frames.length === 0) return 0
  if (relativeTicks <= frames[0].at.ticks) return frames[0].value
  const last = frames.at(-1) as VisualKeyframe
  if (relativeTicks >= last.at.ticks) return last.value
  for (let index = 0; index < frames.length - 1; index += 1) {
    const left = frames[index]
    const right = frames[index + 1]
    if (relativeTicks > right.at.ticks) continue
    const span = right.at.ticks - left.at.ticks
    const progress = span === 0 ? 1 : (relativeTicks - left.at.ticks) / span
    const eased = applyVisualEasing(progress, left.easing)
    return left.value + (right.value - left.value) * eased
  }
  return last.value
}

export type EvaluatedVisualProperties = Readonly<{
  transform: VisualTransform
  crop: VisualCrop
  layer: number
  mask: VisualMask
  effects: readonly VisualEffect[]
}>

/**
 * Resolve every animated property at one exact project tick.
 *
 * Both preview and export call this function. Reduced motion resolves tracks at
 * their final value and skips spatial transitions, so accessibility does not
 * produce a different authored end state.
 */
export const evaluateVisualProperties = (
  properties: VisualProperties,
  relativeTicks: number,
  durationTicks: number,
  reducedMotion = false,
): EvaluatedVisualProperties => {
  const at = reducedMotion ? Math.max(0, durationTicks) : Math.max(0, relativeTicks)
  const transform = { ...properties.transform }
  const crop = { ...properties.crop }
  for (const track of properties.tracks) {
    const value = evaluatePropertyTrack(track, at)
    if (track.property === 'translate-x') transform.translateX = value
    if (track.property === 'translate-y') transform.translateY = value
    if (track.property === 'scale') transform.scale = value
    if (track.property === 'rotation') transform.rotationDegrees = value
    if (track.property === 'opacity') transform.opacity = value
    if (track.property === 'crop-top') crop.top = value
    if (track.property === 'crop-right') crop.right = value
    if (track.property === 'crop-bottom') crop.bottom = value
    if (track.property === 'crop-left') crop.left = value
  }

  if (!reducedMotion) {
    const applyPhase = (phase: VisualTransitionPhase, progress: number, entering: boolean): void => {
      if (phase.kind === 'none') return
      const eased = applyVisualEasing(Math.min(1, Math.max(0, progress)), phase.easing)
      const visible = entering ? eased : 1 - eased
      if (phase.kind === 'fade') transform.opacity *= visible
      if (phase.kind === 'zoom') transform.scale *= 0.8 + 0.2 * visible
      if (phase.kind === 'slide-left') transform.translateX += entering ? -(1 - visible) : -eased
      if (phase.kind === 'slide-right') transform.translateX += entering ? 1 - visible : eased
      if (phase.kind === 'slide-up') transform.translateY += entering ? -(1 - visible) : -eased
      if (phase.kind === 'slide-down') transform.translateY += entering ? 1 - visible : eased
    }
    const enter = properties.transition.enter
    if (enter.duration.ticks > 0 && relativeTicks < enter.duration.ticks) {
      applyPhase(enter, relativeTicks / enter.duration.ticks, true)
    }
    const exit = properties.transition.exit
    const exitStart = durationTicks - exit.duration.ticks
    if (exit.duration.ticks > 0 && relativeTicks > exitStart) {
      applyPhase(exit, (relativeTicks - exitStart) / exit.duration.ticks, false)
    }
  }

  return Object.freeze({
    transform: Object.freeze(transform),
    crop: Object.freeze(crop),
    layer: properties.layer,
    mask: properties.mask,
    effects: properties.effects,
  })
}

/** Last accepted adjustment wins for each visual; Undo reveals the one before it. */
export const foldVisualPropertiesOperations = (
  operations: readonly SetVisualPropertiesOperation[],
): readonly SetVisualPropertiesOperation[] => {
  const byVisual = new Map<string, SetVisualPropertiesOperation>()
  for (const operation of operations) byVisual.set(operation.visualId, operation)
  return Object.freeze([...byVisual.values()])
}
