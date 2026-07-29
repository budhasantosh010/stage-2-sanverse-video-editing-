import { err, isRecord, ok, type Result } from './result.ts'
import { capabilityProduces } from './capabilities.ts'
import { COORDINATE_SPACES, type CoordinateSpace } from './geometry.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { OPERATION_SCHEMA_VERSION } from './timeline-operations.ts'
import { validateMediaTime, validateTimeRange, type MediaTime, type TimeRange } from './time.ts'

/**
 * The four things a user can put ON the video, beyond a nameplate and captions.
 *
 *   add-title           big words over the picture — "Chapter 1", a hook, a
 *                       sign-off. Not a separate black card: a black card would
 *                       be new footage, and that is a cut, not an overlay.
 *   add-callout         a rectangle drawn around part of the picture, with an
 *                       optional label — "look at this bit".
 *   add-media-overlay   a second video or a still picture laid on top of the
 *                       footage. This is what "B-roll" means.
 *   add-music           a piece of music under the whole finished video.
 *
 * THE ONE PLACE THIS FAMILY DISAGREES WITH EVERY OTHER EDIT
 *
 * Everything drawn on the picture is anchored to the ORIGINAL FOOTAGE (ADR-005),
 * so cutting four seconds off the front moves it with the moment it belongs to.
 * Titles, callouts, and B-roll all follow that rule, because each of them is
 * about a moment of filmed content.
 *
 * Music is deliberately different, and the reason matters:
 *
 *   ANCHORED TO FOOTAGE                  ANCHORED TO THE FINISHED VIDEO
 *   (title, callout, B-roll)             (music only)
 *   ───────────────────────────          ───────────────────────────────
 *   "the bit where I hold up the         "a bed under the whole thing"
 *    product"
 *   cut that bit out → the overlay       cut a bit out → the music keeps
 *   goes with it                         playing straight through
 *
 * If music were anchored to footage, cutting ten seconds out of the middle
 * would cut ten seconds out of the song, and the listener would hear an obvious
 * jump. Music is not attached to a filmed moment; it is attached to the finished
 * piece. So it stores composition time and says so.
 */

export const OVERLAY_OPERATION_KINDS = [
  'add-title',
  'set-title',
  'add-callout',
  'set-callout',
  'add-media-overlay',
  'set-media-overlay',
  'add-music',
  'set-music',
] as const

export type OverlayOperationKind = (typeof OVERLAY_OPERATION_KINDS)[number]

export const isOverlayOperationKind = (kind: string): kind is OverlayOperationKind =>
  (OVERLAY_OPERATION_KINDS as readonly string[]).includes(kind)

export const TITLE_ID_PATTERN = /^title_[a-z0-9]{4,64}$/
export const CALLOUT_ID_PATTERN = /^callout_[a-z0-9]{4,64}$/
export const MEDIA_OVERLAY_ID_PATTERN = /^broll_[a-z0-9]{4,64}$/
export const MUSIC_ID_PATTERN = /^music_[a-z0-9]{4,64}$/

export const MAX_HEADLINE_LENGTH = 60
export const MAX_SUBHEAD_LENGTH = 90
export const MAX_CALLOUT_LABEL_LENGTH = 60

/** Where a title sits. Two choices, because a third would be a decision nobody asked for. */
export const TITLE_PLACEMENTS = ['center', 'lower-third'] as const
export type TitlePlacement = (typeof TITLE_PLACEMENTS)[number]

export const TITLE_STYLE_IDS = Object.freeze(['sanverse.title.plain/v1', 'sanverse.title.boxed/v1'] as const)
export type TitleStyleId = (typeof TITLE_STYLE_IDS)[number]
export const DEFAULT_TITLE_STYLE_ID: TitleStyleId = 'sanverse.title.boxed/v1'

export const CALLOUT_STYLE_IDS = Object.freeze(['sanverse.callout.outline/v1'] as const)
export type CalloutStyleId = (typeof CALLOUT_STYLE_IDS)[number]
export const DEFAULT_CALLOUT_STYLE_ID: CalloutStyleId = 'sanverse.callout.outline/v1'

/**
 * Loudness bounds for music, matching the bounds a clip's own sound uses, so a
 * user cannot make one louder than the system will ever allow the other.
 */
export const MIN_MUSIC_GAIN_DB = -60
export const MAX_MUSIC_GAIN_DB = 12
/**
 * What a talking-head video's music sits at by default.
 *
 * -18 dB is roughly "clearly there, never competing with a voice". Chosen as a
 * default rather than left at 0 because music at full level over speech is the
 * single most common way a first-time editor ruins a video, and the product
 * standard is that no editing knowledge should be required.
 */
export const DEFAULT_MUSIC_GAIN_DB = -18

/** A rectangle on the picture, as fractions of the frame. */
export type NormalizedRect = Readonly<{
  coordinateSpace: CoordinateSpace
  x: number
  y: number
  width: number
  height: number
}>

const RECT_KEYS = ['coordinateSpace', 'x', 'y', 'width', 'height'] as const
/** Below this a rectangle is a line, not a region anyone can see. */
const MIN_RECT_SIDE = 0.01

type RectIssue = { readonly path: string; readonly code: OverlayIssueCode }

const readRect = (input: unknown, path: string, issues: RectIssue[]): NormalizedRect | null => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  for (const key of RECT_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(RECT_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }
  if (!COORDINATE_SPACES.includes(input.coordinateSpace as CoordinateSpace)) {
    issues.push({ path: `${path}.coordinateSpace`, code: 'VALUE_OUT_OF_RANGE' })
  }
  let valid = true
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const value = input[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ path: `${path}.${key}`, code: 'TYPE_INVALID' })
      valid = false
    }
  }
  if (!valid) return null
  const x = input.x as number
  const y = input.y as number
  const width = input.width as number
  const height = input.height as number
  // A region must be a real region, entirely on the picture. Refused rather
  // than trimmed to fit, because trimming would silently move the thing the
  // user drew a box around.
  if (
    x < 0 || y < 0 ||
    width < MIN_RECT_SIDE || height < MIN_RECT_SIDE ||
    x + width > 1 || y + height > 1
  ) {
    issues.push({ path, code: 'REGION_OFF_PICTURE' })
    return null
  }
  return Object.freeze({ coordinateSpace: input.coordinateSpace as CoordinateSpace, x, y, width, height })
}

export type AddTitleOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'add-title'
  capabilityId: string
  titleId: string
  /** Which footage this is pinned to, and when on that footage's own clock. */
  assetId: string
  sourceInterval: TimeRange
  headline: string
  /** May be empty, in which case only the headline is drawn. */
  subhead: string
  placement: TitlePlacement
  styleId: TitleStyleId
  extensions: Extensions
}>

export type AddCalloutOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'add-callout'
  capabilityId: string
  calloutId: string
  assetId: string
  sourceInterval: TimeRange
  region: NormalizedRect
  /** May be empty, in which case only the rectangle is drawn. */
  label: string
  styleId: CalloutStyleId
  extensions: Extensions
}>

export type AddMediaOverlayOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'add-media-overlay'
  capabilityId: string
  overlayId: string
  /** The B-roll video or picture being laid on top. */
  overlayAssetId: string
  /** The footage it is pinned to, and when on that footage's own clock. */
  assetId: string
  sourceInterval: TimeRange
  /**
   * Where inside the B-roll to start playing. Always zero for a still picture,
   * which has nowhere to start.
   */
  overlaySourceStart: MediaTime
  /**
   * The box it is drawn inside. The overlay keeps its own shape and is centred
   * in this box, so a tall phone clip dropped into a wide box is never squashed.
   * Filling the box instead would distort the picture, which no user asks for
   * and nobody notices until the export.
   */
  region: NormalizedRect
  /** 0 is invisible, 1 is solid. */
  opacity: number
  /**
   * Whether the B-roll's own sound is heard. Default false: dropping in a clip
   * and suddenly hearing two people talk at once is never the intent.
   */
  useOverlayAudio: boolean
  extensions: Extensions
}>

export type AddMusicOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'add-music'
  capabilityId: string
  musicId: string
  /** The audio asset. */
  assetId: string
  /**
   * When the music starts, measured on the FINISHED video — not on any piece of
   * footage. See the note at the top of this file for why music alone is
   * anchored this way.
   */
  compositionStart: MediaTime
  /** Where in the song to begin. */
  sourceStart: MediaTime
  gainDb: number
  fadeIn: MediaTime
  fadeOut: MediaTime
  extensions: Extensions
}>

/**
 * A repair carries the complete new state, never a patch. That makes one
 * accepted repair one Undo and prevents two callers from disagreeing about
 * what an omitted field means.
 */
export type SetTitleOperation = Readonly<Omit<AddTitleOperation, 'kind'> & { kind: 'set-title' }>
export type SetCalloutOperation = Readonly<Omit<AddCalloutOperation, 'kind'> & { kind: 'set-callout' }>
export type SetMediaOverlayOperation = Readonly<Omit<AddMediaOverlayOperation, 'kind'> & { kind: 'set-media-overlay' }>
export type SetMusicOperation = Readonly<Omit<AddMusicOperation, 'kind'> & { kind: 'set-music' }>

export type OverlayOperation =
  | AddTitleOperation
  | SetTitleOperation
  | AddCalloutOperation
  | SetCalloutOperation
  | AddMediaOverlayOperation
  | SetMediaOverlayOperation
  | AddMusicOperation
  | SetMusicOperation

export type ResolvedOverlayOperation =
  | AddTitleOperation
  | AddCalloutOperation
  | AddMediaOverlayOperation
  | AddMusicOperation

export type OverlayIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'OPERATION_KIND_UNKNOWN'
  | 'CAPABILITY_UNKNOWN'
  | 'TEXT_TOO_LONG'
  | 'REGION_OFF_PICTURE'
  | 'OVERLAY_ASSET_SAME_AS_FOOTAGE'
  | 'GAIN_OUT_OF_RANGE'

export type OverlayOperationError = {
  readonly code: 'OPERATION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: OverlayIssueCode }[]
}

type Issue = OverlayOperationError['issues'][number]

const KEYS: Readonly<Record<OverlayOperationKind, readonly string[]>> = Object.freeze({
  'add-title': Object.freeze([
    'schemaVersion', 'operationId', 'kind', 'capabilityId', 'titleId', 'assetId',
    'sourceInterval', 'headline', 'subhead', 'placement', 'styleId', 'extensions',
  ]),
  'set-title': Object.freeze([
    'schemaVersion', 'operationId', 'kind', 'capabilityId', 'titleId', 'assetId',
    'sourceInterval', 'headline', 'subhead', 'placement', 'styleId', 'extensions',
  ]),
  'add-callout': Object.freeze([
    'schemaVersion', 'operationId', 'kind', 'capabilityId', 'calloutId', 'assetId',
    'sourceInterval', 'region', 'label', 'styleId', 'extensions',
  ]),
  'set-callout': Object.freeze([
    'schemaVersion', 'operationId', 'kind', 'capabilityId', 'calloutId', 'assetId',
    'sourceInterval', 'region', 'label', 'styleId', 'extensions',
  ]),
  'add-media-overlay': Object.freeze([
    'schemaVersion', 'operationId', 'kind', 'capabilityId', 'overlayId', 'overlayAssetId',
    'assetId', 'sourceInterval', 'overlaySourceStart', 'region', 'opacity', 'useOverlayAudio', 'extensions',
  ]),
  'set-media-overlay': Object.freeze([
    'schemaVersion', 'operationId', 'kind', 'capabilityId', 'overlayId', 'overlayAssetId',
    'assetId', 'sourceInterval', 'overlaySourceStart', 'region', 'opacity', 'useOverlayAudio', 'extensions',
  ]),
  'add-music': Object.freeze([
    'schemaVersion', 'operationId', 'kind', 'capabilityId', 'musicId', 'assetId',
    'compositionStart', 'sourceStart', 'gainDb', 'fadeIn', 'fadeOut', 'extensions',
  ]),
  'set-music': Object.freeze([
    'schemaVersion', 'operationId', 'kind', 'capabilityId', 'musicId', 'assetId',
    'compositionStart', 'sourceStart', 'gainDb', 'fadeIn', 'fadeOut', 'extensions',
  ]),
})

const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/

const checkShared = (input: Record<string, unknown>, kind: OverlayOperationKind, path: string, issues: Issue[]): void => {
  for (const key of KEYS[kind]) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!KEYS[kind].includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  }
  if (input.schemaVersion !== OPERATION_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) {
    issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.capabilityId !== 'string' || !capabilityProduces(input.capabilityId, kind)) {
    issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  }
  if (typeof input.assetId !== 'string' || input.assetId.trim().length === 0) {
    issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
  }
}

const readText = (
  value: unknown,
  path: string,
  max: number,
  required: boolean,
  issues: Issue[],
): string => {
  if (typeof value !== 'string') {
    issues.push({ path, code: 'TYPE_INVALID' })
    return ''
  }
  if (required && value.trim().length === 0) {
    issues.push({ path, code: 'VALUE_OUT_OF_RANGE' })
    return ''
  }
  if ([...value].length > max) {
    issues.push({ path, code: 'TEXT_TOO_LONG' })
    return ''
  }
  // A newline inside a single line would let one field become two on screen,
  // which the renderers measure differently. Refused, never stripped.
  if (/[\r\n]/.test(value)) {
    issues.push({ path, code: 'VALUE_OUT_OF_RANGE' })
    return ''
  }
  return value
}

export const validateOverlayOperation = (
  input: unknown,
  path = '$',
): Result<OverlayOperation, OverlayOperationError> => {
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  const kind = input.kind
  if (typeof kind !== 'string' || !isOverlayOperationKind(kind)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.kind`, code: 'OPERATION_KIND_UNKNOWN' }] })
  }

  const issues: Issue[] = []
  checkShared(input, kind, path, issues)
  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) {
    for (const issue of extensions.error.issues) {
      issues.push({ path: `${path}.extensions.${issue.path}`, code: 'VALUE_OUT_OF_RANGE' })
    }
  }
  const readExtensions = () => (extensions.ok ? extensions.value : emptyExtensions())

  if (kind === 'add-music' || kind === 'set-music') {
    // Music is the one kind with no source interval, because it is not pinned
    // to a moment of footage at all.
    if (typeof input.musicId !== 'string' || !MUSIC_ID_PATTERN.test(input.musicId)) {
      issues.push({ path: `${path}.musicId`, code: 'VALUE_OUT_OF_RANGE' })
    }
    const compositionStart = validateMediaTime(input.compositionStart, `${path}.compositionStart`)
    if (!compositionStart.ok) issues.push({ path: `${path}.compositionStart`, code: 'VALUE_OUT_OF_RANGE' })
    const sourceStart = validateMediaTime(input.sourceStart, `${path}.sourceStart`)
    if (!sourceStart.ok) issues.push({ path: `${path}.sourceStart`, code: 'VALUE_OUT_OF_RANGE' })
    const fadeIn = validateMediaTime(input.fadeIn, `${path}.fadeIn`)
    if (!fadeIn.ok) issues.push({ path: `${path}.fadeIn`, code: 'VALUE_OUT_OF_RANGE' })
    const fadeOut = validateMediaTime(input.fadeOut, `${path}.fadeOut`)
    if (!fadeOut.ok) issues.push({ path: `${path}.fadeOut`, code: 'VALUE_OUT_OF_RANGE' })
    const gainDb = input.gainDb
    if (
      typeof gainDb !== 'number' || !Number.isFinite(gainDb) ||
      gainDb < MIN_MUSIC_GAIN_DB || gainDb > MAX_MUSIC_GAIN_DB
    ) {
      issues.push({ path: `${path}.gainDb`, code: 'GAIN_OUT_OF_RANGE' })
    }
    if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })
    return ok(Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: input.operationId as string,
      kind,
      capabilityId: input.capabilityId as string,
      musicId: input.musicId as string,
      assetId: input.assetId as string,
      compositionStart: (compositionStart as { ok: true; value: MediaTime }).value,
      sourceStart: (sourceStart as { ok: true; value: MediaTime }).value,
      gainDb: gainDb as number,
      fadeIn: (fadeIn as { ok: true; value: MediaTime }).value,
      fadeOut: (fadeOut as { ok: true; value: MediaTime }).value,
      extensions: readExtensions(),
    }))
  }

  const sourceInterval = validateTimeRange(input.sourceInterval, `${path}.sourceInterval`)
  if (!sourceInterval.ok || sourceInterval.value.duration.ticks <= 0) {
    issues.push({ path: `${path}.sourceInterval`, code: 'VALUE_OUT_OF_RANGE' })
  }
  const interval = sourceInterval.ok ? sourceInterval.value : null

  if (kind === 'add-title' || kind === 'set-title') {
    if (typeof input.titleId !== 'string' || !TITLE_ID_PATTERN.test(input.titleId)) {
      issues.push({ path: `${path}.titleId`, code: 'VALUE_OUT_OF_RANGE' })
    }
    const headline = readText(input.headline, `${path}.headline`, MAX_HEADLINE_LENGTH, true, issues)
    const subhead = readText(input.subhead, `${path}.subhead`, MAX_SUBHEAD_LENGTH, false, issues)
    if (!TITLE_PLACEMENTS.includes(input.placement as TitlePlacement)) {
      issues.push({ path: `${path}.placement`, code: 'VALUE_OUT_OF_RANGE' })
    }
    if (!TITLE_STYLE_IDS.includes(input.styleId as TitleStyleId)) {
      issues.push({ path: `${path}.styleId`, code: 'VALUE_OUT_OF_RANGE' })
    }
    if (issues.length > 0 || interval === null) return err({ code: 'OPERATION_INVALID', issues })
    return ok(Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: input.operationId as string,
      kind,
      capabilityId: input.capabilityId as string,
      titleId: input.titleId as string,
      assetId: input.assetId as string,
      sourceInterval: interval,
      headline,
      subhead,
      placement: input.placement as TitlePlacement,
      styleId: input.styleId as TitleStyleId,
      extensions: readExtensions(),
    }))
  }

  if (kind === 'add-callout' || kind === 'set-callout') {
    if (typeof input.calloutId !== 'string' || !CALLOUT_ID_PATTERN.test(input.calloutId)) {
      issues.push({ path: `${path}.calloutId`, code: 'VALUE_OUT_OF_RANGE' })
    }
    const label = readText(input.label, `${path}.label`, MAX_CALLOUT_LABEL_LENGTH, false, issues)
    if (!CALLOUT_STYLE_IDS.includes(input.styleId as CalloutStyleId)) {
      issues.push({ path: `${path}.styleId`, code: 'VALUE_OUT_OF_RANGE' })
    }
    const region = readRect(input.region, `${path}.region`, issues)
    if (issues.length > 0 || interval === null || region === null) {
      return err({ code: 'OPERATION_INVALID', issues })
    }
    return ok(Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: input.operationId as string,
      kind,
      capabilityId: input.capabilityId as string,
      calloutId: input.calloutId as string,
      assetId: input.assetId as string,
      sourceInterval: interval,
      region,
      label,
      styleId: input.styleId as CalloutStyleId,
      extensions: readExtensions(),
    }))
  }

  // add-media-overlay or set-media-overlay
  if (typeof input.overlayId !== 'string' || !MEDIA_OVERLAY_ID_PATTERN.test(input.overlayId)) {
    issues.push({ path: `${path}.overlayId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.overlayAssetId !== 'string' || input.overlayAssetId.trim().length === 0) {
    issues.push({ path: `${path}.overlayAssetId`, code: 'VALUE_OUT_OF_RANGE' })
  } else if (input.overlayAssetId === input.assetId) {
    // Laying footage on top of itself is never what anyone means, and it would
    // make the renderer read the same file as two inputs at two different times.
    issues.push({ path: `${path}.overlayAssetId`, code: 'OVERLAY_ASSET_SAME_AS_FOOTAGE' })
  }
  const overlaySourceStart = validateMediaTime(input.overlaySourceStart, `${path}.overlaySourceStart`)
  if (!overlaySourceStart.ok) issues.push({ path: `${path}.overlaySourceStart`, code: 'VALUE_OUT_OF_RANGE' })
  const opacity = input.opacity
  if (typeof opacity !== 'number' || !Number.isFinite(opacity) || opacity <= 0 || opacity > 1) {
    issues.push({ path: `${path}.opacity`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.useOverlayAudio !== 'boolean') {
    issues.push({ path: `${path}.useOverlayAudio`, code: 'TYPE_INVALID' })
  }
  const region = readRect(input.region, `${path}.region`, issues)
  if (issues.length > 0 || interval === null || region === null) {
    return err({ code: 'OPERATION_INVALID', issues })
  }
  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind,
    capabilityId: input.capabilityId as string,
    overlayId: input.overlayId as string,
    overlayAssetId: input.overlayAssetId as string,
    assetId: input.assetId as string,
    sourceInterval: interval,
    overlaySourceStart: (overlaySourceStart as { ok: true; value: MediaTime }).value,
    region,
    opacity: opacity as number,
    useOverlayAudio: input.useOverlayAudio as boolean,
    extensions: readExtensions(),
  }))
}

/**
 * Replay accepted overlay additions and repairs into the four items that exist
 * now. A repair whose original is inactive contributes nothing; it can never
 * invent a new title, callout, B-roll clip, or music bed.
 */
export const foldOverlayOperations = (
  operations: readonly OverlayOperation[],
): readonly ResolvedOverlayOperation[] => {
  const items = new Map<string, ResolvedOverlayOperation>()

  for (const operation of operations) {
    switch (operation.kind) {
      case 'add-title':
        if (!items.has(operation.titleId)) items.set(operation.titleId, operation)
        break
      case 'set-title': {
        const current = items.get(operation.titleId)
        if (current?.kind === 'add-title') {
          items.set(operation.titleId, Object.freeze({ ...operation, kind: 'add-title' }))
        }
        break
      }
      case 'add-callout':
        if (!items.has(operation.calloutId)) items.set(operation.calloutId, operation)
        break
      case 'set-callout': {
        const current = items.get(operation.calloutId)
        if (current?.kind === 'add-callout') {
          items.set(operation.calloutId, Object.freeze({ ...operation, kind: 'add-callout' }))
        }
        break
      }
      case 'add-media-overlay':
        if (!items.has(operation.overlayId)) items.set(operation.overlayId, operation)
        break
      case 'set-media-overlay': {
        const current = items.get(operation.overlayId)
        if (current?.kind === 'add-media-overlay') {
          items.set(operation.overlayId, Object.freeze({ ...operation, kind: 'add-media-overlay' }))
        }
        break
      }
      case 'add-music':
        if (!items.has(operation.musicId)) items.set(operation.musicId, operation)
        break
      case 'set-music': {
        const current = items.get(operation.musicId)
        if (current?.kind === 'add-music') {
          items.set(operation.musicId, Object.freeze({ ...operation, kind: 'add-music' }))
        }
        break
      }
    }
  }

  return Object.freeze([...items.values()])
}
