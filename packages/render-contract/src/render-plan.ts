import type { SpatialTarget, TimeRange } from '@sanverse/edit-domain'

/**
 * What to draw, with every decision already made.
 *
 * A render plan is renderer-neutral: it names no font file, no FFmpeg filter,
 * and no CSS rule. The browser preview and the FFmpeg export consume the same
 * plan, which is what makes "what you approved is what you exported" a
 * structural property rather than a hope.
 */

/**
 * One stretch of original footage that survived cutting, and where it now sits
 * in the finished video.
 *
 * Before cutting existed, the plan could assume the finished video was the
 * whole source file and describe only what was drawn on top. It cannot assume
 * that any more, so the pieces are stated explicitly. Both renderers read the
 * same list, which is what stops the preview and the export disagreeing about
 * where a cut landed.
 */
export type SourceSegmentNode = Readonly<{
  nodeId: string
  kind: 'source-segment'
  /** When this piece plays, in finished-video time. */
  interval: TimeRange
  assetId: string
  /** Where this piece starts inside the original footage. */
  sourceStartTicks: number
  /** Loudness change in decibels. 0 means untouched. */
  gainDb: number
  /** Silence-to-full ramp at the head of this piece, in ticks. */
  fadeInTicks: number
  /** Full-to-silence ramp at the tail of this piece, in ticks. */
  fadeOutTicks: number
}>

export type TextOverlayNode = Readonly<{
  nodeId: string
  kind: 'text-overlay'
  /** When it is on screen, in finished-video time. */
  interval: TimeRange
  target: SpatialTarget
  primaryText: string
  secondaryText: string
  styleId: string
}>

export type RenderNode = TextOverlayNode

export type RenderPlan = Readonly<{
  schemaVersion: 'sanverse.render-plan/v2'
  projectId: string
  /**
   * The revision this plan was compiled from. An export carries it, so a file
   * on disk can always be traced back to the exact project state that made it.
   */
  projectRevision: number
  compositionId: string
  width: number
  height: number
  /** Total length of the finished video, in project ticks. */
  durationTicks: number
  /** The footage the finished video is made of, earliest first. */
  segments: readonly SourceSegmentNode[]
  /** What is drawn on top of that footage. */
  overlays: readonly RenderNode[]
}>

export type RenderPlanIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'NODE_KIND_UNKNOWN'
  | 'NODE_OUTSIDE_COMPOSITION'
  | 'SEGMENTS_OVERLAP'
  | 'SEGMENTS_EMPTY'

export type RenderPlanError = {
  readonly code: 'RENDER_PLAN_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: RenderPlanIssueCode }[]
}

export const RENDER_PLAN_SCHEMA_VERSION = 'sanverse.render-plan/v2'
export const MAX_RENDER_NODES = 512
export const MAX_RENDER_SEGMENTS = 512

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const PLAN_KEYS = [
  'schemaVersion',
  'projectId',
  'projectRevision',
  'compositionId',
  'width',
  'height',
  'durationTicks',
  'segments',
  'overlays',
] as const

type Issue = RenderPlanError['issues'][number]

/** Reads `{ start: { ticks }, duration: { ticks } }` without trusting any of it. */
const readInterval = (value: unknown): { start: number; duration: number } | null => {
  if (!isRecord(value) || !isRecord(value.start) || !isRecord(value.duration)) return null
  const start = value.start.ticks
  const duration = value.duration.ticks
  if (typeof start !== 'number' || typeof duration !== 'number') return null
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(duration)) return null
  return { start, duration }
}

const validateSegments = (input: unknown, durationTicks: number, issues: Issue[]): void => {
  if (!Array.isArray(input)) {
    issues.push({ path: 'segments', code: 'TYPE_INVALID' })
    return
  }
  if (input.length === 0) {
    // A plan with no footage would export a file with no picture in it.
    issues.push({ path: 'segments', code: 'SEGMENTS_EMPTY' })
    return
  }
  if (input.length > MAX_RENDER_SEGMENTS) {
    issues.push({ path: 'segments', code: 'VALUE_OUT_OF_RANGE' })
    return
  }

  const spans: { start: number; end: number }[] = []
  input.forEach((segment, index) => {
    const path = `segments[${index}]`
    if (!isRecord(segment)) {
      issues.push({ path, code: 'TYPE_INVALID' })
      return
    }
    if (segment.kind !== 'source-segment') {
      issues.push({ path: `${path}.kind`, code: 'NODE_KIND_UNKNOWN' })
      return
    }
    if (typeof segment.nodeId !== 'string' || segment.nodeId.length === 0) {
      issues.push({ path: `${path}.nodeId`, code: 'VALUE_OUT_OF_RANGE' })
    }
    if (typeof segment.assetId !== 'string' || segment.assetId.length === 0) {
      issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
    }
    if (!Number.isSafeInteger(segment.sourceStartTicks) || (segment.sourceStartTicks as number) < 0) {
      issues.push({ path: `${path}.sourceStartTicks`, code: 'VALUE_OUT_OF_RANGE' })
    }
    if (typeof segment.gainDb !== 'number' || !Number.isFinite(segment.gainDb)) {
      issues.push({ path: `${path}.gainDb`, code: 'VALUE_OUT_OF_RANGE' })
    }

    const interval = readInterval(segment.interval)
    if (interval === null) {
      issues.push({ path: `${path}.interval`, code: 'TYPE_INVALID' })
      return
    }
    if (interval.start < 0 || interval.duration <= 0 || interval.start + interval.duration > durationTicks) {
      issues.push({ path: `${path}.interval`, code: 'NODE_OUTSIDE_COMPOSITION' })
      return
    }

    const fadeIn = segment.fadeInTicks
    const fadeOut = segment.fadeOutTicks
    if (
      !Number.isSafeInteger(fadeIn) || (fadeIn as number) < 0 ||
      !Number.isSafeInteger(fadeOut) || (fadeOut as number) < 0 ||
      (fadeIn as number) + (fadeOut as number) > interval.duration
    ) {
      issues.push({ path: `${path}.fadeInTicks`, code: 'VALUE_OUT_OF_RANGE' })
    }

    spans.push({ start: interval.start, end: interval.start + interval.duration })
  })

  // Two pieces of footage claiming the same instant has no defined picture.
  spans.sort((left, right) => left.start - right.start)
  for (let index = 1; index < spans.length; index += 1) {
    if (spans[index].start < spans[index - 1].end) {
      issues.push({ path: 'segments', code: 'SEGMENTS_OVERLAP' })
      break
    }
  }
}

/**
 * Validate a plan before a renderer acts on it.
 *
 * Renderers run this even though the compiler produced the plan, because a
 * renderer is a trust boundary: it may be fed a plan over a wire, from a file,
 * or from a future version.
 */
export const validateRenderPlan = (
  input: unknown,
): { readonly ok: true; readonly value: RenderPlan } | { readonly ok: false; readonly error: RenderPlanError } => {
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return { ok: false, error: { code: 'RENDER_PLAN_INVALID', issues: [{ path: '$', code: 'TYPE_INVALID' }] } }
  }
  for (const key of PLAN_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: key, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(PLAN_KEYS as readonly string[]).includes(key)) issues.push({ path: key, code: 'FIELD_UNKNOWN' })
  }
  if (input.schemaVersion !== RENDER_PLAN_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.projectId !== 'string' || input.projectId.length === 0) {
    issues.push({ path: 'projectId', code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.compositionId !== 'string' || input.compositionId.length === 0) {
    issues.push({ path: 'compositionId', code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!Number.isSafeInteger(input.projectRevision) || (input.projectRevision as number) < 0) {
    issues.push({ path: 'projectRevision', code: 'VALUE_OUT_OF_RANGE' })
  }
  for (const key of ['width', 'height', 'durationTicks'] as const) {
    if (!Number.isSafeInteger(input[key]) || (input[key] as number) <= 0) {
      issues.push({ path: key, code: 'VALUE_OUT_OF_RANGE' })
    }
  }

  const durationTicks = Number.isSafeInteger(input.durationTicks) ? (input.durationTicks as number) : -1
  if (durationTicks > 0) validateSegments(input.segments, durationTicks, issues)

  if (!Array.isArray(input.overlays)) {
    issues.push({ path: 'overlays', code: 'TYPE_INVALID' })
  } else if (input.overlays.length > MAX_RENDER_NODES) {
    issues.push({ path: 'overlays', code: 'VALUE_OUT_OF_RANGE' })
  } else {
    input.overlays.forEach((node, index) => {
      const path = `overlays[${index}]`
      if (!isRecord(node)) {
        issues.push({ path, code: 'TYPE_INVALID' })
        return
      }
      // An unrecognised node changes what the viewer sees, so it is refused,
      // never skipped.
      if (node.kind !== 'text-overlay') {
        issues.push({ path: `${path}.kind`, code: 'NODE_KIND_UNKNOWN' })
        return
      }
      if (typeof node.nodeId !== 'string' || node.nodeId.length === 0) {
        issues.push({ path: `${path}.nodeId`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (typeof node.primaryText !== 'string' || node.primaryText.length === 0) {
        issues.push({ path: `${path}.primaryText`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (typeof node.secondaryText !== 'string') {
        issues.push({ path: `${path}.secondaryText`, code: 'TYPE_INVALID' })
      }
      if (typeof node.styleId !== 'string' || node.styleId.length === 0) {
        issues.push({ path: `${path}.styleId`, code: 'VALUE_OUT_OF_RANGE' })
      }
      const interval = readInterval(node.interval)
      if (interval === null) {
        issues.push({ path: `${path}.interval`, code: 'TYPE_INVALID' })
      } else if (
        durationTicks <= 0 ||
        interval.start < 0 ||
        interval.duration <= 0 ||
        interval.start + interval.duration > durationTicks
      ) {
        // The check v1 only performed inside FFmpeg, after the edit had
        // already been previewed, accepted, and written to disk.
        issues.push({ path: `${path}.interval`, code: 'NODE_OUTSIDE_COMPOSITION' })
      }
      if (!isRecord(node.target) || !isRecord(node.target.point) || typeof node.target.anchor !== 'string') {
        issues.push({ path: `${path}.target`, code: 'TYPE_INVALID' })
      }
    })
  }

  if (issues.length > 0) return { ok: false, error: { code: 'RENDER_PLAN_INVALID', issues } }
  return { ok: true, value: Object.freeze(input as unknown as RenderPlan) }
}
