import type { SpatialTarget, TimeRange } from '@sanverse/edit-domain'

/**
 * What to draw, with every decision already made.
 *
 * A render plan is renderer-neutral: it names no font file, no FFmpeg filter,
 * and no CSS rule. The browser preview and the FFmpeg export consume the same
 * plan, which is what makes "what you approved is what you exported" a
 * structural property rather than a hope.
 */
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
  schemaVersion: 'sanverse.render-plan/v1'
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
  nodes: readonly RenderNode[]
}>

export type RenderPlanIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'NODE_KIND_UNKNOWN'
  | 'NODE_OUTSIDE_COMPOSITION'

export type RenderPlanError = {
  readonly code: 'RENDER_PLAN_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: RenderPlanIssueCode }[]
}

export const RENDER_PLAN_SCHEMA_VERSION = 'sanverse.render-plan/v1'
export const MAX_RENDER_NODES = 512

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
  'nodes',
] as const

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
  type Issue = RenderPlanError['issues'][number]
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

  if (!Array.isArray(input.nodes)) {
    issues.push({ path: 'nodes', code: 'TYPE_INVALID' })
  } else if (input.nodes.length > MAX_RENDER_NODES) {
    issues.push({ path: 'nodes', code: 'VALUE_OUT_OF_RANGE' })
  } else {
    const duration = input.durationTicks as number
    input.nodes.forEach((node, index) => {
      const path = `nodes[${index}]`
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
      const interval = node.interval
      if (
        !isRecord(interval) ||
        !isRecord(interval.start) ||
        !isRecord(interval.duration) ||
        typeof interval.start.ticks !== 'number' ||
        typeof interval.duration.ticks !== 'number'
      ) {
        issues.push({ path: `${path}.interval`, code: 'TYPE_INVALID' })
      } else if (
        !Number.isSafeInteger(duration) ||
        interval.start.ticks < 0 ||
        interval.duration.ticks <= 0 ||
        interval.start.ticks + interval.duration.ticks > duration
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
