import {
  FOOTAGE_MOTION_CAPABILITY_ID,
  VISUAL_PROPERTIES_PRIMITIVE_ID,
  validateFootageMotionOperation,
  validateVisualPropertiesOperation,
  type SpatialTarget,
  type TimeRange,
  type VisualCrop,
  type VisualProperties,
  type VisualPropertyTrack,
  type VisualTransform,
} from '@sanverse/edit-domain'

/**
 * What to draw, with every decision already made.
 *
 * A render plan is renderer-neutral: it names no font file, no FFmpeg filter,
 * and no CSS rule. The browser preview and the FFmpeg export consume the same
 * plan, which is what makes "what you approved is what you exported" a
 * structural property rather than a hope.
 */

export type FootageMotionNode = Readonly<{
  motionId: string
  /** Half-open interval on the immutable source asset timeline. */
  sourceInterval: TimeRange
  transform: VisualTransform
  crop: VisualCrop
  tracks: readonly VisualPropertyTrack[]
}>

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
  /**
   * Whether the picture of this piece is drawn, and whether its sound is heard.
   *
   * These are two switches rather than one because a user turning off the V1
   * track wants black where the picture was, WITHOUT losing the voice, and a
   * user muting A1 wants the picture to carry on. The piece keeps its place on
   * the timeline either way: a switched-off picture leaves black for exactly as
   * long as the footage lasted, so switching it back on restores the same video
   * frame for frame rather than shifting everything after it.
   *
   * A piece with both switched off is still listed. Removing it here would let
   * the plan's own duration shrink, and the finished video would get shorter
   * every time somebody toggled a track.
   */
  videoEnabled: boolean
  audioEnabled: boolean
  /** Source-anchored primary-footage motion that intersects this piece. */
  footageMotions: readonly FootageMotionNode[]
  /** Loudness change in decibels. 0 means untouched. */
  gainDb: number
  /** Silence-to-full ramp at the head of this piece, in ticks. */
  fadeInTicks: number
  /** Full-to-silence ramp at the tail of this piece, in ticks. */
  fadeOutTicks: number
  /** Picture-only ramps created by an explicit adjacent-clip transition. */
  videoFadeInTicks: number
  videoFadeOutTicks: number
  /** Additional sound ramps for that transition; zero when audio stays cut. */
  transitionAudioFadeInTicks: number
  transitionAudioFadeOutTicks: number
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

/**
 * One caption on screen.
 *
 * A separate node kind from `text-overlay` on purpose. A caption is not "a text
 * overlay that happens to be at the bottom": it carries one to three stacked
 * lines instead of a primary/secondary pair, it has no user-chosen position,
 * and it is drawn with its own style. Reusing the nameplate node would have
 * forced every renderer to branch on the style id to work out which set of
 * rules applied, and a branch like that is exactly where the preview and the
 * export drift apart.
 */
export type CaptionOverlayNode = Readonly<{
  nodeId: string
  kind: 'caption-overlay'
  /** When it is on screen, in finished-video time. */
  interval: TimeRange
  /** One to three lines, top to bottom. Never contains a newline. */
  lines: readonly string[]
  styleId: string
}>

/** Big words over the picture. */
export type TitleOverlayNode = Readonly<{
  nodeId: string
  kind: 'title-overlay'
  interval: TimeRange
  headline: string
  /** Empty when only the headline is shown. */
  subhead: string
  placement: 'center' | 'lower-third'
  styleId: string
}>

/** A rectangle drawn around part of the picture, with an optional label. */
export type CalloutOverlayNode = Readonly<{
  nodeId: string
  kind: 'callout-overlay'
  interval: TimeRange
  /** Fractions of the frame: 0,0 is the top left, 1,1 the bottom right. */
  region: Readonly<{ x: number; y: number; width: number; height: number }>
  /** Empty when only the rectangle is drawn. */
  label: string
  styleId: string
}>

/**
 * A second video or a still picture laid on top of the footage.
 *
 * `assetId` names a DIFFERENT file from the footage underneath, which is why
 * the plan now carries a list of sources: a renderer has to open more than one
 * file to make this frame.
 */
export type MediaOverlayNode = Readonly<{
  nodeId: string
  kind: 'media-overlay'
  interval: TimeRange
  assetId: string
  /** Where inside the overlay clip to start. Always 0 for a still picture. */
  sourceStartTicks: number
  region: Readonly<{ x: number; y: number; width: number; height: number }>
  opacity: number
  useOverlayAudio: boolean
}>

/**
 * Music under the finished video.
 *
 * Kept OUT of `overlays` because an overlay is something drawn on the picture,
 * and music is not drawn at all. Putting it in the same list would force every
 * renderer to check "is this one actually visible?" before drawing, and a check
 * like that is exactly where a preview and an export drift apart.
 *
 * Its interval is measured on the FINISHED video, not on any piece of footage.
 */
export type MusicNode = Readonly<{
  nodeId: string
  kind: 'music'
  interval: TimeRange
  assetId: string
  sourceStartTicks: number
  gainDb: number
  fadeInTicks: number
  fadeOutTicks: number
}>

export type RenderNode =
  | TextOverlayNode
  | CaptionOverlayNode
  | TitleOverlayNode
  | CalloutOverlayNode
  | MediaOverlayNode

/** One file a renderer must open to produce this video. */
export type RenderSource = Readonly<{
  assetId: string
  mediaKind: 'video' | 'image' | 'audio'
}>

/** One authored visual state bound to the concrete nodes produced after cuts. */
export type VisualPropertiesNode = VisualProperties & Readonly<{
  visualId: string
  nodeIds: readonly string[]
}>

export type RenderPlan = Readonly<{
  schemaVersion: typeof RENDER_PLAN_SCHEMA_VERSION
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
  /**
   * Every file the renderer must open, footage first.
   *
   * Listed here rather than left implicit because a plan used to describe one
   * video file and now describes several. A renderer that guessed would open
   * the wrong file the first time B-roll appeared.
   */
  sources: readonly RenderSource[]
  /** The footage the finished video is made of, earliest first. */
  segments: readonly SourceSegmentNode[]
  /** What is drawn on top of that footage. */
  overlays: readonly RenderNode[]
  /** Transform, crop, layer, mask, and time-varying properties for drawn nodes. */
  visuals: readonly VisualPropertiesNode[]
  /** What is heard under it. Empty when there is no music. */
  music: readonly MusicNode[]
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
  | 'SOURCE_UNKNOWN'
  | 'DUPLICATE_SOURCE'

export type RenderPlanError = {
  readonly code: 'RENDER_PLAN_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: RenderPlanIssueCode }[]
}

/**
 * v6 to v7: every piece of footage now says whether its picture is drawn and
 * whether its sound is heard, so that switching a track off changes the file
 * that comes out.
 *
 * The version moves because the export key is built from it. Without that, a
 * user who muted the dialogue and pressed Export would be handed the cached
 * file from before the mute, and would have no way to tell.
 */
export const RENDER_PLAN_SCHEMA_VERSION = 'sanverse.render-plan/v7'
/**
 * Raised from 512 because captions produce one node per line of speech. A
 * ten-minute talk is roughly 200 cues before cutting, and a cut through a cue
 * splits it in two, so the ceiling has to leave real headroom above that.
 */
export const MAX_RENDER_NODES = 4_096
export const MAX_RENDER_SEGMENTS = 512
/** Files one export may open. Matches the project's own asset ceiling. */
export const MAX_RENDER_SOURCES = 64
export const MAX_MUSIC_NODES = 16
export const MAX_CAPTION_LINES_PER_NODE = 3

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
  'sources',
  'segments',
  'overlays',
  'visuals',
  'music',
] as const

type Issue = RenderPlanError['issues'][number]

/** A rectangle must be a real rectangle, wholly on the picture. */
const isRegionOnPicture = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== 4) return false
  for (const key of ['x', 'y', 'width', 'height']) {
    const number = value[key]
    if (typeof number !== 'number' || !Number.isFinite(number)) return false
  }
  const x = value.x as number
  const y = value.y as number
  const width = value.width as number
  const height = value.height as number
  return x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1 && y + height <= 1
}

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
    if (!Array.isArray(segment.footageMotions)) {
      issues.push({ path: `${path}.footageMotions`, code: 'TYPE_INVALID' })
    } else {
      const segmentSourceStart = Number.isSafeInteger(segment.sourceStartTicks)
        ? segment.sourceStartTicks as number
        : -1
      const intervalCandidate = readInterval(segment.interval)
      const segmentSourceEnd = intervalCandidate === null
        ? -1
        : segmentSourceStart + intervalCandidate.duration
      segment.footageMotions.forEach((motion, motionIndex) => {
        const motionPath = `${path}.footageMotions[${motionIndex}]`
        if (!isRecord(motion)) {
          issues.push({ path: motionPath, code: 'TYPE_INVALID' })
          return
        }
        const motionKeys = ['motionId', 'sourceInterval', 'transform', 'crop', 'tracks']
        if (
          Object.keys(motion).some((key) => !motionKeys.includes(key)) ||
          motionKeys.some((key) => !Object.hasOwn(motion, key))
        ) {
          issues.push({ path: motionPath, code: 'FIELD_UNKNOWN' })
          return
        }
        const validated = validateFootageMotionOperation({
          schemaVersion: 'sanverse.operation/v3',
          operationId: `operation_render${String(index).padStart(4, '0')}${String(motionIndex).padStart(2, '0')}`,
          kind: 'set-footage-motion',
          capabilityId: FOOTAGE_MOTION_CAPABILITY_ID,
          motionId: motion.motionId,
          assetId: segment.assetId,
          sourceInterval: motion.sourceInterval,
          transform: motion.transform,
          crop: motion.crop,
          tracks: motion.tracks,
          extensions: {},
        }, motionPath)
        if (!validated.ok) {
          validated.error.issues.forEach((issue) => issues.push({
            path: issue.path,
            code: issue.code === 'TYPE_INVALID' ? 'TYPE_INVALID' : 'VALUE_OUT_OF_RANGE',
          }))
          return
        }
        const motionRange = readInterval(motion.sourceInterval)
        if (
          motionRange === null ||
          segmentSourceStart < 0 ||
          segmentSourceEnd <= segmentSourceStart ||
          motionRange.start >= segmentSourceEnd ||
          motionRange.start + motionRange.duration <= segmentSourceStart
        ) {
          issues.push({ path: `${motionPath}.sourceInterval`, code: 'NODE_OUTSIDE_COMPOSITION' })
        }
      })
    }
    if (typeof segment.gainDb !== 'number' || !Number.isFinite(segment.gainDb)) {
      issues.push({ path: `${path}.gainDb`, code: 'VALUE_OUT_OF_RANGE' })
    }
    // Stated, never assumed. A missing switch would let a renderer guess, and
    // the two renderers would eventually guess differently.
    if (typeof segment.videoEnabled !== 'boolean') {
      issues.push({ path: `${path}.videoEnabled`, code: 'TYPE_INVALID' })
    }
    if (typeof segment.audioEnabled !== 'boolean') {
      issues.push({ path: `${path}.audioEnabled`, code: 'TYPE_INVALID' })
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
    const transitionFades = [
      segment.videoFadeInTicks,
      segment.videoFadeOutTicks,
      segment.transitionAudioFadeInTicks,
      segment.transitionAudioFadeOutTicks,
    ]
    if (
      transitionFades.some((value) => !Number.isSafeInteger(value) || (value as number) < 0) ||
      (segment.videoFadeInTicks as number) + (segment.videoFadeOutTicks as number) > interval.duration ||
      (segment.transitionAudioFadeInTicks as number) +
        (segment.transitionAudioFadeOutTicks as number) > interval.duration
    ) {
      issues.push({ path: `${path}.videoFadeInTicks`, code: 'VALUE_OUT_OF_RANGE' })
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

  // Every file the renderer will open, declared up front. An overlay naming a
  // file that is not on this list is refused rather than skipped: skipping it
  // would export a video missing something the user approved.
  const sourceIds = new Set<string>()
  if (!Array.isArray(input.sources)) {
    issues.push({ path: 'sources', code: 'TYPE_INVALID' })
  } else if (input.sources.length === 0 || input.sources.length > MAX_RENDER_SOURCES) {
    issues.push({ path: 'sources', code: 'VALUE_OUT_OF_RANGE' })
  } else {
    input.sources.forEach((source, index) => {
      const path = `sources[${index}]`
      if (!isRecord(source)) {
        issues.push({ path, code: 'TYPE_INVALID' })
        return
      }
      const keys = Object.keys(source)
      if (keys.length !== 2 || !Object.hasOwn(source, 'assetId') || !Object.hasOwn(source, 'mediaKind')) {
        issues.push({ path, code: 'FIELD_UNKNOWN' })
        return
      }
      if (typeof source.assetId !== 'string' || source.assetId.length === 0) {
        issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
        return
      }
      if (source.mediaKind !== 'video' && source.mediaKind !== 'image' && source.mediaKind !== 'audio') {
        issues.push({ path: `${path}.mediaKind`, code: 'VALUE_OUT_OF_RANGE' })
        return
      }
      if (sourceIds.has(source.assetId)) {
        issues.push({ path: `${path}.assetId`, code: 'DUPLICATE_SOURCE' })
        return
      }
      sourceIds.add(source.assetId)
    })
  }

  const durationTicks = Number.isSafeInteger(input.durationTicks) ? (input.durationTicks as number) : -1
  if (durationTicks > 0) validateSegments(input.segments, durationTicks, issues)
  if (Array.isArray(input.segments)) {
    input.segments.forEach((segment, index) => {
      if (isRecord(segment) && typeof segment.assetId === 'string' && !sourceIds.has(segment.assetId)) {
        issues.push({ path: `segments[${index}].assetId`, code: 'SOURCE_UNKNOWN' })
      }
    })
  }

  if (!Array.isArray(input.music)) {
    issues.push({ path: 'music', code: 'TYPE_INVALID' })
  } else if (input.music.length > MAX_MUSIC_NODES) {
    issues.push({ path: 'music', code: 'VALUE_OUT_OF_RANGE' })
  } else {
    input.music.forEach((node, index) => {
      const path = `music[${index}]`
      if (!isRecord(node) || node.kind !== 'music') {
        issues.push({ path: `${path}.kind`, code: 'NODE_KIND_UNKNOWN' })
        return
      }
      if (typeof node.nodeId !== 'string' || node.nodeId.length === 0) {
        issues.push({ path: `${path}.nodeId`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (typeof node.assetId !== 'string' || !sourceIds.has(node.assetId)) {
        issues.push({ path: `${path}.assetId`, code: 'SOURCE_UNKNOWN' })
      }
      if (!Number.isSafeInteger(node.sourceStartTicks) || (node.sourceStartTicks as number) < 0) {
        issues.push({ path: `${path}.sourceStartTicks`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (typeof node.gainDb !== 'number' || !Number.isFinite(node.gainDb)) {
        issues.push({ path: `${path}.gainDb`, code: 'VALUE_OUT_OF_RANGE' })
      }
      const interval = readInterval(node.interval)
      if (interval === null) {
        issues.push({ path: `${path}.interval`, code: 'TYPE_INVALID' })
        return
      }
      if (
        durationTicks <= 0 ||
        interval.start < 0 ||
        interval.duration <= 0 ||
        interval.start + interval.duration > durationTicks
      ) {
        issues.push({ path: `${path}.interval`, code: 'NODE_OUTSIDE_COMPOSITION' })
        return
      }
      const fadeIn = node.fadeInTicks
      const fadeOut = node.fadeOutTicks
      if (
        !Number.isSafeInteger(fadeIn) || (fadeIn as number) < 0 ||
        !Number.isSafeInteger(fadeOut) || (fadeOut as number) < 0 ||
        (fadeIn as number) + (fadeOut as number) > interval.duration
      ) {
        issues.push({ path: `${path}.fadeInTicks`, code: 'VALUE_OUT_OF_RANGE' })
      }
    })
  }

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
      const KINDS = ['text-overlay', 'caption-overlay', 'title-overlay', 'callout-overlay', 'media-overlay']
      if (typeof node.kind !== 'string' || !KINDS.includes(node.kind)) {
        issues.push({ path: `${path}.kind`, code: 'NODE_KIND_UNKNOWN' })
        return
      }
      if (typeof node.nodeId !== 'string' || node.nodeId.length === 0) {
        issues.push({ path: `${path}.nodeId`, code: 'VALUE_OUT_OF_RANGE' })
      }
      // A media overlay is a file, not a look, so it carries no style id.
      if (node.kind !== 'media-overlay' && (typeof node.styleId !== 'string' || node.styleId.length === 0)) {
        issues.push({ path: `${path}.styleId`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (node.kind === 'title-overlay') {
        if (typeof node.headline !== 'string' || node.headline.length === 0) {
          issues.push({ path: `${path}.headline`, code: 'VALUE_OUT_OF_RANGE' })
        }
        if (typeof node.subhead !== 'string') {
          issues.push({ path: `${path}.subhead`, code: 'TYPE_INVALID' })
        }
        if (node.placement !== 'center' && node.placement !== 'lower-third') {
          issues.push({ path: `${path}.placement`, code: 'VALUE_OUT_OF_RANGE' })
        }
      }
      if (node.kind === 'callout-overlay' || node.kind === 'media-overlay') {
        if (!isRegionOnPicture(node.region)) {
          issues.push({ path: `${path}.region`, code: 'VALUE_OUT_OF_RANGE' })
        }
      }
      if (node.kind === 'callout-overlay' && typeof node.label !== 'string') {
        issues.push({ path: `${path}.label`, code: 'TYPE_INVALID' })
      }
      if (node.kind === 'media-overlay') {
        if (typeof node.assetId !== 'string' || !sourceIds.has(node.assetId)) {
          issues.push({ path: `${path}.assetId`, code: 'SOURCE_UNKNOWN' })
        }
        if (!Number.isSafeInteger(node.sourceStartTicks) || (node.sourceStartTicks as number) < 0) {
          issues.push({ path: `${path}.sourceStartTicks`, code: 'VALUE_OUT_OF_RANGE' })
        }
        if (typeof node.opacity !== 'number' || !(node.opacity > 0) || node.opacity > 1) {
          issues.push({ path: `${path}.opacity`, code: 'VALUE_OUT_OF_RANGE' })
        }
        if (typeof node.useOverlayAudio !== 'boolean') {
          issues.push({ path: `${path}.useOverlayAudio`, code: 'TYPE_INVALID' })
        }
      }
      if (node.kind === 'caption-overlay') {
        if (
          !Array.isArray(node.lines) ||
          node.lines.length === 0 ||
          node.lines.length > MAX_CAPTION_LINES_PER_NODE ||
          node.lines.some((line) => typeof line !== 'string' || line.length === 0 || /[\r\n]/.test(line))
        ) {
          issues.push({ path: `${path}.lines`, code: 'VALUE_OUT_OF_RANGE' })
        }
      }
      if (node.kind === 'text-overlay') {
        if (typeof node.primaryText !== 'string' || node.primaryText.length === 0) {
          issues.push({ path: `${path}.primaryText`, code: 'VALUE_OUT_OF_RANGE' })
        }
        if (typeof node.secondaryText !== 'string') {
          issues.push({ path: `${path}.secondaryText`, code: 'TYPE_INVALID' })
        }
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
      if (node.kind === 'text-overlay') {
        if (!isRecord(node.target) || !isRecord(node.target.point) || typeof node.target.anchor !== 'string') {
          issues.push({ path: `${path}.target`, code: 'TYPE_INVALID' })
        }
      }
    })
  }

  if (!Array.isArray(input.visuals)) {
    issues.push({ path: 'visuals', code: 'TYPE_INVALID' })
  } else if (input.visuals.length > MAX_RENDER_NODES) {
    issues.push({ path: 'visuals', code: 'VALUE_OUT_OF_RANGE' })
  } else {
    const overlayIds = new Set(
      Array.isArray(input.overlays)
        ? input.overlays.filter(isRecord).map((node) => node.nodeId).filter((id): id is string => typeof id === 'string')
        : [],
    )
    const claimedNodes = new Set<string>()
    const seenVisualIds = new Set<string>()
    input.visuals.forEach((visual, index) => {
      const path = `visuals[${index}]`
      if (!isRecord(visual)) {
        issues.push({ path, code: 'TYPE_INVALID' })
        return
      }
      const keys = ['visualId', 'nodeIds', 'transform', 'crop', 'layer', 'mask', 'tracks', 'transition', 'effects']
      if (Object.keys(visual).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(visual, key))) {
        issues.push({ path, code: 'FIELD_UNKNOWN' })
        return
      }
      if (typeof visual.visualId !== 'string' || seenVisualIds.has(visual.visualId)) {
        issues.push({ path: `${path}.visualId`, code: 'VALUE_OUT_OF_RANGE' })
      } else {
        seenVisualIds.add(visual.visualId)
      }
      if (
        !Array.isArray(visual.nodeIds) ||
        visual.nodeIds.length === 0 ||
        visual.nodeIds.some((nodeId) =>
          typeof nodeId !== 'string' || !overlayIds.has(nodeId) || claimedNodes.has(nodeId)
        )
      ) {
        issues.push({ path: `${path}.nodeIds`, code: 'VALUE_OUT_OF_RANGE' })
      } else {
        visual.nodeIds.forEach((nodeId) => claimedNodes.add(nodeId as string))
      }
      const checked = validateVisualPropertiesOperation({
        schemaVersion: 'sanverse.operation/v3',
        operationId: 'operation_plancheck',
        kind: 'set-visual-properties',
        capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID,
        visualId: visual.visualId,
        transform: visual.transform,
        crop: visual.crop,
        layer: visual.layer,
        mask: visual.mask,
        tracks: visual.tracks,
        transition: visual.transition,
        effects: visual.effects,
        extensions: {},
      }, path)
      if (!checked.ok) {
        checked.error.issues.forEach((issue) =>
          issues.push({ path: issue.path, code: 'VALUE_OUT_OF_RANGE' }),
        )
      }
    })
  }

  if (issues.length > 0) return { ok: false, error: { code: 'RENDER_PLAN_INVALID', issues } }
  return { ok: true, value: Object.freeze(input as unknown as RenderPlan) }
}
