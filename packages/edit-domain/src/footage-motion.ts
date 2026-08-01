import { capabilityProduces, FOOTAGE_MOTION_PRIMITIVE_ID } from './capabilities.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { err, isRecord, ok, type Result } from './result.ts'
import { OPERATION_SCHEMA_VERSION } from './timeline-operations.ts'
import {
  ZERO_TIME,
  mediaTime,
  rangeContains,
  rangesOverlap,
  validateTimeRange,
  type MediaTime,
  type TimeRange,
} from './time.ts'
import {
  DEFAULT_VISUAL_PROPERTIES,
  evaluateVisualProperties,
  validateVisualMotionState,
  type VisualCrop,
  type VisualProperty,
  type VisualPropertyTrack,
  type VisualTransform,
} from './visual-properties.ts'

export const FOOTAGE_MOTION_OPERATION_KIND = 'set-footage-motion'
export const FOOTAGE_MOTION_CAPABILITY_ID = FOOTAGE_MOTION_PRIMITIVE_ID
export const FOOTAGE_MOTION_ID_PATTERN = /^motion_[a-z0-9]{8,64}$/
const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/

export const FOOTAGE_MOTION_PROPERTIES: readonly VisualProperty[] = Object.freeze([
  'translate-x',
  'translate-y',
  'scale',
  'rotation',
  'crop-top',
  'crop-right',
  'crop-bottom',
  'crop-left',
])

export const DEFAULT_FOOTAGE_MOTION_STATE = Object.freeze({
  transform: DEFAULT_VISUAL_PROPERTIES.transform,
  crop: DEFAULT_VISUAL_PROPERTIES.crop,
  tracks: Object.freeze([]) as readonly VisualPropertyTrack[],
})

export type SetFootageMotionOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: typeof FOOTAGE_MOTION_OPERATION_KIND
  capabilityId: string
  motionId: string
  assetId: string
  sourceInterval: TimeRange
  transform: VisualTransform
  crop: VisualCrop
  tracks: readonly VisualPropertyTrack[]
  extensions: Extensions
}>

export type FootageMotionError = Readonly<{
  code: 'OPERATION_INVALID'
  issues: readonly {
    path: string
    code:
      | 'TYPE_INVALID'
      | 'FIELD_REQUIRED'
      | 'FIELD_UNKNOWN'
      | 'VALUE_OUT_OF_RANGE'
      | 'CAPABILITY_UNKNOWN'
  }[]
}>

type Issue = FootageMotionError['issues'][number]

const OPERATION_KEYS = Object.freeze([
  'schemaVersion',
  'operationId',
  'kind',
  'capabilityId',
  'motionId',
  'assetId',
  'sourceInterval',
  'transform',
  'crop',
  'tracks',
  'extensions',
])

const closedKeys = (
  input: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  issues: Issue[],
): void => {
  for (const key of keys) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  }
}

/** Structural validation. Asset/composition and overlap checks happen in project evaluation. */
export const validateFootageMotionOperation = (
  input: unknown,
  path = '$',
): Result<SetFootageMotionOperation, FootageMotionError> => {
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  closedKeys(input, OPERATION_KEYS, path, issues)
  if (input.schemaVersion !== OPERATION_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (input.kind !== FOOTAGE_MOTION_OPERATION_KIND) {
    issues.push({ path: `${path}.kind`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) {
    issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (
    typeof input.capabilityId !== 'string' ||
    !capabilityProduces(input.capabilityId, FOOTAGE_MOTION_OPERATION_KIND)
  ) {
    issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  }
  if (typeof input.motionId !== 'string' || !FOOTAGE_MOTION_ID_PATTERN.test(input.motionId)) {
    issues.push({ path: `${path}.motionId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.assetId !== 'string' || input.assetId.trim().length === 0) {
    issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
  }

  const sourceInterval = validateTimeRange(input.sourceInterval, `${path}.sourceInterval`)
  if (!sourceInterval.ok) issues.push({ path: `${path}.sourceInterval`, code: 'VALUE_OUT_OF_RANGE' })

  const visual = validateVisualMotionState({
    transform: input.transform,
    crop: input.crop,
    tracks: input.tracks,
  }, path, {
    allowedProperties: FOOTAGE_MOTION_PROPERTIES,
    requireOpaque: true,
    maximumRelativeTicks: sourceInterval.ok ? sourceInterval.value.duration.ticks : undefined,
  })
  if (!visual.ok) {
    visual.error.issues.forEach((issue) => issues.push({ path: issue.path, code: issue.code }))
  }

  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) {
    extensions.error.issues.forEach((issue) =>
      issues.push({ path: `${path}.extensions.${issue.path}`, code: 'VALUE_OUT_OF_RANGE' }),
    )
  }

  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })
  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind: FOOTAGE_MOTION_OPERATION_KIND,
    capabilityId: input.capabilityId as string,
    motionId: input.motionId as string,
    assetId: input.assetId as string,
    sourceInterval: (sourceInterval as { ok: true; value: TimeRange }).value,
    transform: (visual as { ok: true; value: { transform: VisualTransform } }).value.transform,
    crop: (visual as { ok: true; value: { crop: VisualCrop } }).value.crop,
    tracks: (visual as { ok: true; value: { tracks: readonly VisualPropertyTrack[] } }).value.tracks,
    extensions: extensions.ok ? extensions.value : emptyExtensions(),
  }))
}

export const isDefaultFootageMotion = (motion: SetFootageMotionOperation): boolean =>
  motion.transform.translateX === 0 &&
  motion.transform.translateY === 0 &&
  motion.transform.scale === 1 &&
  motion.transform.rotationDegrees === 0 &&
  motion.transform.opacity === 1 &&
  motion.crop.top === 0 &&
  motion.crop.right === 0 &&
  motion.crop.bottom === 0 &&
  motion.crop.left === 0 &&
  motion.tracks.length === 0

export const footageMotionsOverlap = (
  left: SetFootageMotionOperation,
  right: SetFootageMotionOperation,
): boolean =>
  left.motionId !== right.motionId &&
  left.assetId === right.assetId &&
  rangesOverlap(left.sourceInterval, right.sourceInterval)

/** Latest complete repair wins. Default repairs remove the motion from effective projection. */
export const foldFootageMotionOperations = (
  operations: readonly SetFootageMotionOperation[],
): readonly SetFootageMotionOperation[] => {
  const latest = new Map<string, { operation: SetFootageMotionOperation; order: number }>()
  operations.forEach((operation, order) => latest.set(operation.motionId, { operation, order }))
  return Object.freeze(
    [...latest.values()]
      .sort((left, right) => left.order - right.order || left.operation.motionId.localeCompare(right.operation.motionId))
      .map((entry) => entry.operation)
      .filter((operation) => !isDefaultFootageMotion(operation)),
  )
}

export type EvaluatedFootageMotion = Readonly<{
  active: boolean
  transform: VisualTransform
  crop: VisualCrop
}>

export const DEFAULT_EVALUATED_FOOTAGE_MOTION: EvaluatedFootageMotion = Object.freeze({
  active: false,
  transform: DEFAULT_VISUAL_PROPERTIES.transform,
  crop: DEFAULT_VISUAL_PROPERTIES.crop,
})

/** Evaluate one exact source tick. Outside the half-open interval, return wide/default. */
export const evaluateFootageMotionAt = (input: Readonly<{
  motion: Pick<SetFootageMotionOperation, 'sourceInterval' | 'transform' | 'crop' | 'tracks'>
  sourceTime: MediaTime
  reducedMotion?: boolean
}>): EvaluatedFootageMotion => {
  if (!rangeContains(input.motion.sourceInterval, input.sourceTime)) {
    return DEFAULT_EVALUATED_FOOTAGE_MOTION
  }
  const relativeTicks = input.sourceTime.ticks - input.motion.sourceInterval.start.ticks
  const evaluated = evaluateVisualProperties(Object.freeze({
    transform: input.motion.transform,
    crop: input.motion.crop,
    layer: 0,
    mask: DEFAULT_VISUAL_PROPERTIES.mask,
    tracks: input.motion.tracks,
    transition: DEFAULT_VISUAL_PROPERTIES.transition,
    effects: Object.freeze([]),
  }), relativeTicks, input.motion.sourceInterval.duration.ticks, input.reducedMotion ?? false)
  return Object.freeze({ active: true, transform: evaluated.transform, crop: evaluated.crop })
}

export const footageMotionAtSourceTime = (
  motions: readonly SetFootageMotionOperation[],
  assetId: string,
  sourceTime: MediaTime,
): SetFootageMotionOperation | undefined =>
  motions.find((motion) => motion.assetId === assetId && rangeContains(motion.sourceInterval, sourceTime))

export const resetFootageMotionOperation = (input: Readonly<{
  operationId: string
  motionId: string
  assetId: string
  sourceInterval: TimeRange
}>): SetFootageMotionOperation => Object.freeze({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: input.operationId,
  kind: FOOTAGE_MOTION_OPERATION_KIND,
  capabilityId: FOOTAGE_MOTION_PRIMITIVE_ID,
  motionId: input.motionId,
  assetId: input.assetId,
  sourceInterval: input.sourceInterval,
  transform: DEFAULT_VISUAL_PROPERTIES.transform,
  crop: DEFAULT_VISUAL_PROPERTIES.crop,
  tracks: Object.freeze([]),
  extensions: emptyExtensions(),
})

export const relativeMotionTime = (
  motion: SetFootageMotionOperation,
  sourceTime: MediaTime,
): MediaTime => mediaTime(Math.max(ZERO_TIME.ticks, sourceTime.ticks - motion.sourceInterval.start.ticks))
