import { err, isRecord, ok, type Result } from './result.ts'
import {
  COORDINATE_SPACES,
  type CoordinateSpace,
  type NormalizedPoint,
} from './geometry.ts'
import { validateMediaTime, type MediaTime } from './time.ts'

/**
 * A mark the user drew on the picture to say "this one".
 *
 * An annotation is NOT an edit. It changes nothing, renders nothing, and can
 * never reach the exported file. It exists so that the sentence "make this
 * bigger" has a knowable meaning, by carrying the thing the word "this" was
 * pointing at.
 *
 * This separation is the whole point, and it is enforced structurally rather
 * than by discipline:
 *
 *   an EDIT                              an ANNOTATION
 *   ─────────────────────────────        ─────────────────────────────
 *   names a capabilityId                 has no capabilityId at all
 *   is an EditOperation                  is not, and its kind is absent
 *                                        from EXECUTABLE_OPERATION_KINDS
 *   goes into a change set               travels with a request
 *   appears in the undo history          never appears there
 *   is compiled into a render node       is never seen by the compiler
 *   changes the exported file            cannot change the exported file
 *
 * A user who circles a microphone and types "remove that noise" has drawn a
 * circle that must never appear in the finished video. The only way a mark can
 * become something visible is if the user separately approves a real edit — a
 * callout, say — that happens to describe the same region. Converting is an
 * explicit, separate, approvable act, never a side effect of pointing.
 */
export const ANNOTATION_SCHEMA_VERSION = 'sanverse.annotation/v1'

export const ANNOTATION_SHAPES = ['point', 'circle', 'box', 'arrow', 'freehand'] as const
export type AnnotationShape = (typeof ANNOTATION_SHAPES)[number]

export const ANNOTATION_ID_PATTERN = /^annotation_[a-z0-9]{8,64}$/

/** Longest freehand stroke kept. Beyond this the stroke is refused, never thinned. */
export const MAX_FREEHAND_POINTS = 512
export const MAX_ANNOTATION_NOTE_LENGTH = 280
/** Most marks one request may carry, so one gesture cannot flood a provider prompt. */
export const MAX_ANNOTATIONS_PER_REQUEST = 16

/**
 * How many points each shape must carry, exactly.
 *
 * Stated as data rather than as branches in the validator so that adding a
 * shape cannot silently skip its arity check.
 */
export const SHAPE_POINT_COUNTS: Readonly<Record<AnnotationShape, Readonly<{ min: number; max: number }>>> =
  Object.freeze({
    // Where the user tapped.
    point: Object.freeze({ min: 1, max: 1 }),
    // Centre first, then a point on the rim. Two points rather than a centre
    // and a radius, because a radius would need a unit and normalized x and y
    // are not the same length on a non-square frame.
    circle: Object.freeze({ min: 2, max: 2 }),
    // Two opposite corners, in any order.
    box: Object.freeze({ min: 2, max: 2 }),
    // Tail first, then head. The order carries the meaning, so it is preserved.
    arrow: Object.freeze({ min: 2, max: 2 }),
    // Every sampled point of the stroke, in the order it was drawn.
    freehand: Object.freeze({ min: 2, max: MAX_FREEHAND_POINTS }),
  })

export type Annotation = Readonly<{
  schemaVersion: typeof ANNOTATION_SCHEMA_VERSION
  annotationId: string
  shape: AnnotationShape
  /** Which picture the numbers are measured against. Never assumed. */
  coordinateSpace: CoordinateSpace
  /** Positions in 0..1, in the order drawn. */
  points: readonly NormalizedPoint[]
  /** Which piece of original footage was on screen when the mark was made. */
  assetId: string
  /**
   * When, on that footage's own timeline.
   *
   * Anchored to the source for the same reason every edit is (ADR-005): a mark
   * made at 00:08 of the recording still means 00:08 of the recording after
   * four seconds are cut off the front.
   */
  sourceTime: MediaTime
  /** Optional words the user attached to this specific mark. */
  note: string
}>

export type AnnotationIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'SHAPE_UNKNOWN'
  | 'WRONG_POINT_COUNT'
  | 'NOTE_TOO_LONG'
  | 'TOO_MANY_ANNOTATIONS'
  | 'DUPLICATE_ANNOTATION_ID'

export type AnnotationError = {
  readonly code: 'ANNOTATION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: AnnotationIssueCode }[]
}

const ANNOTATION_KEYS = [
  'schemaVersion',
  'annotationId',
  'shape',
  'coordinateSpace',
  'points',
  'assetId',
  'sourceTime',
  'note',
] as const

type Issue = AnnotationError['issues'][number]

const readPoint = (value: unknown, path: string, issues: Issue[]): NormalizedPoint | null => {
  if (!isRecord(value)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  const keys = Object.keys(value)
  if (keys.length !== 2 || !Object.hasOwn(value, 'x') || !Object.hasOwn(value, 'y')) {
    issues.push({ path, code: 'FIELD_UNKNOWN' })
    return null
  }
  let valid = true
  for (const axis of ['x', 'y'] as const) {
    const candidate = value[axis]
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      issues.push({ path: `${path}.${axis}`, code: 'TYPE_INVALID' })
      valid = false
    } else if (candidate < 0 || candidate > 1) {
      // A mark outside the picture is refused rather than clamped. Clamping
      // would move the thing the user pointed at, which is the one piece of
      // information a mark exists to carry.
      issues.push({ path: `${path}.${axis}`, code: 'VALUE_OUT_OF_RANGE' })
      valid = false
    }
  }
  if (!valid) return null
  return Object.freeze({ x: value.x as number, y: value.y as number })
}

export const validateAnnotation = (input: unknown, path = '$'): Result<Annotation, AnnotationError> => {
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'ANNOTATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  for (const key of ANNOTATION_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(ANNOTATION_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }

  if (input.schemaVersion !== ANNOTATION_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.annotationId !== 'string' || !ANNOTATION_ID_PATTERN.test(input.annotationId)) {
    issues.push({ path: `${path}.annotationId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.assetId !== 'string' || input.assetId.trim().length === 0) {
    issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!COORDINATE_SPACES.includes(input.coordinateSpace as CoordinateSpace)) {
    issues.push({ path: `${path}.coordinateSpace`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.note !== 'string') {
    issues.push({ path: `${path}.note`, code: 'TYPE_INVALID' })
  } else if ([...input.note].length > MAX_ANNOTATION_NOTE_LENGTH) {
    issues.push({ path: `${path}.note`, code: 'NOTE_TOO_LONG' })
  }

  const shapeKnown = ANNOTATION_SHAPES.includes(input.shape as AnnotationShape)
  if (!shapeKnown) issues.push({ path: `${path}.shape`, code: 'SHAPE_UNKNOWN' })

  const points: NormalizedPoint[] = []
  if (!Array.isArray(input.points)) {
    issues.push({ path: `${path}.points`, code: 'TYPE_INVALID' })
  } else {
    if (shapeKnown) {
      const arity = SHAPE_POINT_COUNTS[input.shape as AnnotationShape]
      if (input.points.length < arity.min || input.points.length > arity.max) {
        issues.push({ path: `${path}.points`, code: 'WRONG_POINT_COUNT' })
      }
    }
    input.points.forEach((raw, index) => {
      const point = readPoint(raw, `${path}.points[${index}]`, issues)
      if (point) points.push(point)
    })
  }

  const sourceTime = validateMediaTime(input.sourceTime, `${path}.sourceTime`)
  if (!sourceTime.ok) issues.push({ path: `${path}.sourceTime`, code: 'VALUE_OUT_OF_RANGE' })

  if (issues.length > 0) return err({ code: 'ANNOTATION_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: ANNOTATION_SCHEMA_VERSION,
    annotationId: input.annotationId as string,
    shape: input.shape as AnnotationShape,
    coordinateSpace: input.coordinateSpace as CoordinateSpace,
    points: Object.freeze(points),
    assetId: input.assetId as string,
    sourceTime: (sourceTime as { ok: true; value: MediaTime }).value,
    note: input.note as string,
  }))
}

export const validateAnnotations = (
  input: unknown,
  path = '$',
): Result<readonly Annotation[], AnnotationError> => {
  if (!Array.isArray(input)) {
    return err({ code: 'ANNOTATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  if (input.length > MAX_ANNOTATIONS_PER_REQUEST) {
    return err({ code: 'ANNOTATION_INVALID', issues: [{ path, code: 'TOO_MANY_ANNOTATIONS' }] })
  }
  const annotations: Annotation[] = []
  const seen = new Set<string>()
  const issues: Issue[] = []
  input.forEach((raw, index) => {
    const annotation = validateAnnotation(raw, `${path}[${index}]`)
    if (!annotation.ok) {
      issues.push(...annotation.error.issues)
      return
    }
    if (seen.has(annotation.value.annotationId)) {
      issues.push({ path: `${path}[${index}].annotationId`, code: 'DUPLICATE_ANNOTATION_ID' })
      return
    }
    seen.add(annotation.value.annotationId)
    annotations.push(annotation.value)
  })
  if (issues.length > 0) return err({ code: 'ANNOTATION_INVALID', issues })
  return ok(Object.freeze(annotations))
}

/** Smallest upright rectangle containing every point of a mark, in 0..1. */
export const annotationBounds = (
  annotation: Annotation,
): Readonly<{ x: number; y: number; width: number; height: number }> => {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const point of annotation.points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  if (annotation.shape === 'circle' && annotation.points.length === 2) {
    // The rim point is one point ON the circle, so the circle also extends the
    // same distance the other way. Taking the drawn points' bounds alone would
    // report a box half the size of the shape the user actually saw.
    const [centre, rim] = annotation.points
    const radiusX = Math.abs(rim.x - centre.x)
    const radiusY = Math.abs(rim.y - centre.y)
    minX = Math.max(0, centre.x - radiusX)
    maxX = Math.min(1, centre.x + radiusX)
    minY = Math.max(0, centre.y - radiusY)
    maxY = Math.min(1, centre.y + radiusY)
  }
  return Object.freeze({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
}

/** Ninths of the frame, named the way a person would say them. */
const horizontalWord = (x: number): string => (x < 1 / 3 ? 'left' : x < 2 / 3 ? 'middle' : 'right')
const verticalWord = (y: number): string => (y < 1 / 3 ? 'top' : y < 2 / 3 ? 'middle' : 'bottom')

const placeWords = (x: number, y: number): string => {
  const vertical = verticalWord(y)
  const horizontal = horizontalWord(x)
  if (vertical === 'middle' && horizontal === 'middle') return 'the middle of the picture'
  if (vertical === 'middle') return `the ${horizontal} of the picture`
  if (horizontal === 'middle') return `the ${vertical} of the picture`
  return `the ${vertical} ${horizontal} of the picture`
}

/**
 * The mark, said in ordinary words.
 *
 * This is what a person reads in the history and what a language model is told,
 * so both are looking at the same sentence. Handing a model raw coordinates and
 * a person a sentence would let the two disagree about what was pointed at
 * without anyone being able to see it.
 */
export const describeAnnotation = (annotation: Annotation): string => {
  const bounds = annotationBounds(annotation)
  const centreX = bounds.x + bounds.width / 2
  const centreY = bounds.y + bounds.height / 2
  const where = placeWords(centreX, centreY)
  switch (annotation.shape) {
    case 'point':
      return `pointed at ${where}`
    case 'circle':
      return `circled something in ${where}`
    case 'box':
      return `drew a box around ${where}`
    case 'arrow': {
      const [tail, head] = annotation.points
      return `drew an arrow from ${placeWords(tail.x, tail.y)} to ${placeWords(head.x, head.y)}`
    }
    case 'freehand':
      return `drew a line across ${where}`
  }
}
