import { err, isRecord, ok, type Result } from './result.ts'

export type NormalizedPoint = Readonly<{ x: number; y: number }>

export const ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const

export type Anchor = (typeof ANCHORS)[number]

/**
 * Which picture a normalized point is measured against.
 *
 * `composition-normalized` is a position on the finished frame. A nameplate is
 * a graphic laid on the final video, so it uses this.
 *
 * `source-normalized` is a position on the original footage. Anything stuck to
 * filmed content — "circle that microphone", object tracking — uses this.
 *
 * The two are numerically identical only while output dimensions equal source
 * dimensions. They diverge the first time a portrait crop is made from
 * landscape source, which is why the space is always stated and never assumed.
 */
export type CoordinateSpace = 'source-normalized' | 'composition-normalized'

export const COORDINATE_SPACES: readonly CoordinateSpace[] = ['source-normalized', 'composition-normalized']

export type SpatialTarget = Readonly<{
  coordinateSpace: CoordinateSpace
  point: NormalizedPoint
  anchor: Anchor
}>

/**
 * Owner decision 2026-07-27: a click means "put the middle of the nameplate
 * here", because that is what pointing at a spot implies. The v1 code placed
 * the top-left corner there, which nobody chose.
 */
export const DEFAULT_NAMEPLATE_ANCHOR: Anchor = 'center'

export type GeometryIssueCode = 'TYPE_INVALID' | 'FIELD_REQUIRED' | 'FIELD_UNKNOWN' | 'VALUE_OUT_OF_RANGE'

export type GeometryError = {
  readonly code: 'GEOMETRY_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: GeometryIssueCode }[]
}

const TARGET_KEYS = ['coordinateSpace', 'point', 'anchor'] as const

export const validateSpatialTarget = (input: unknown, path = '$'): Result<SpatialTarget, GeometryError> => {
  type Issue = GeometryError['issues'][number]
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'GEOMETRY_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  for (const key of TARGET_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(TARGET_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }
  if (!COORDINATE_SPACES.includes(input.coordinateSpace as CoordinateSpace)) {
    issues.push({ path: `${path}.coordinateSpace`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!ANCHORS.includes(input.anchor as Anchor)) {
    issues.push({ path: `${path}.anchor`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!isRecord(input.point)) {
    issues.push({ path: `${path}.point`, code: 'TYPE_INVALID' })
  } else {
    const keys = Object.keys(input.point)
    if (keys.length !== 2 || !Object.hasOwn(input.point, 'x') || !Object.hasOwn(input.point, 'y')) {
      issues.push({ path: `${path}.point`, code: 'FIELD_UNKNOWN' })
    }
    for (const axis of ['x', 'y'] as const) {
      const value = input.point[axis]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ path: `${path}.point.${axis}`, code: 'TYPE_INVALID' })
      } else if (value < 0 || value > 1) {
        issues.push({ path: `${path}.point.${axis}`, code: 'VALUE_OUT_OF_RANGE' })
      }
    }
  }
  if (issues.length > 0) return err({ code: 'GEOMETRY_INVALID', issues })
  const point = input.point as { x: number; y: number }
  return ok(Object.freeze({
    coordinateSpace: input.coordinateSpace as CoordinateSpace,
    point: Object.freeze({ x: point.x, y: point.y }),
    anchor: input.anchor as Anchor,
  }))
}

export type Box = Readonly<{ x: number; y: number; width: number; height: number }>

/** Fraction of a box's own size that sits left of / above the anchor point. */
export const anchorFractions = (anchor: Anchor): Readonly<{ x: number; y: number }> => {
  const [vertical, horizontal] = anchor.split('-') as [string, string]
  const x = horizontal === 'left' ? 0 : horizontal === 'right' ? 1 : 0.5
  const y = vertical === 'top' ? 0 : vertical === 'bottom' ? 1 : 0.5
  return Object.freeze({ x, y })
}

/**
 * Place a box of a known size so that its anchor lands on the target point,
 * then keep it inside the frame minus a safe margin.
 *
 * Owner decision 2026-07-27: near an edge the box is clamped fully inside the
 * safe area rather than being allowed to hang off. A nameplate half outside the
 * frame is never what the user meant, and on some platforms it is cropped.
 */
export const layoutAnchoredBox = (input: {
  readonly point: NormalizedPoint
  readonly anchor: Anchor
  readonly boxWidth: number
  readonly boxHeight: number
  readonly frameWidth: number
  readonly frameHeight: number
  readonly safeMargin: number
}): Box => {
  const fractions = anchorFractions(input.anchor)
  const rawX = input.point.x * input.frameWidth - input.boxWidth * fractions.x
  const rawY = input.point.y * input.frameHeight - input.boxHeight * fractions.y

  const minX = input.safeMargin
  const minY = input.safeMargin
  const maxX = input.frameWidth - input.safeMargin - input.boxWidth
  const maxY = input.frameHeight - input.safeMargin - input.boxHeight

  // When the box is wider than the safe area, centre it rather than invert the
  // clamp, so `max < min` never produces a nonsense position.
  const x = maxX < minX ? Math.round((input.frameWidth - input.boxWidth) / 2) : Math.round(Math.min(Math.max(rawX, minX), maxX))
  const y = maxY < minY ? Math.round((input.frameHeight - input.boxHeight) / 2) : Math.round(Math.min(Math.max(rawY, minY), maxY))

  return Object.freeze({ x, y, width: input.boxWidth, height: input.boxHeight })
}
