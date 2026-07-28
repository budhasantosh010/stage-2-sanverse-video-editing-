import { err, isRecord, ok, type Result } from './result.ts'
import { validateMediaTime, type MediaTime } from './time.ts'

/**
 * Immutable identity of one piece of source media.
 *
 * The domain stores no filesystem path. `storageRef` is an opaque,
 * application-controlled reference that only a storage adapter can resolve.
 * That is what allows the same engine to run against local disk today and
 * object storage later without changing a line of domain code.
 *
 * THREE KINDS, ONE SHAPE
 *
 * A project used to hold exactly one video. Now it can hold several videos, the
 * pictures a user drops in as B-roll, and a piece of music. Those three things
 * genuinely differ, and the differences are stated in the type rather than left
 * for each reader to remember:
 *
 *   ┌─────────┬──────────────┬───────────┬────────────────────────────────┐
 *   │ kind    │ has a length │ has a size│ what it is for                 │
 *   ├─────────┼──────────────┼───────────┼────────────────────────────────┤
 *   │ video   │ yes          │ yes       │ the footage the video is made  │
 *   │         │              │           │ of, and B-roll laid over it    │
 *   │ image   │ NO           │ yes       │ a picture laid over the footage│
 *   │ audio   │ yes          │ NO        │ music laid under everything    │
 *   └─────────┴──────────────┴───────────┴────────────────────────────────┘
 *
 * A still picture has no length of its own — it is one frame that could be held
 * for a second or an hour. Rather than invent a fake duration and let some
 * later reader trust it, `duration` is null and the operation that puts the
 * picture on screen is the one that says how long it stays. A piece of music
 * has no width or height for the same reason, so those are null.
 *
 * Every field is present on every kind. Nothing is optional, so a reader can
 * never be unsure whether a missing field means "none" or "not written yet".
 */
export const ASSET_SCHEMA_VERSION = 'sanverse.asset/media/v1'

export const MEDIA_KINDS = ['video', 'image', 'audio'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

type AssetCore = Readonly<{
  schemaVersion: typeof ASSET_SCHEMA_VERSION
  assetId: string
  storageRef: string
  sha256: string
  byteLength: number
  /** Seconds lost when the probed duration was converted to project ticks. */
  durationResidualSeconds: number
}>

export type VideoAsset = AssetCore & Readonly<{
  mediaKind: 'video'
  duration: MediaTime
  width: number
  height: number
  frameRate: Readonly<{ numerator: number; denominator: number }> | null
  hasAudio: boolean
}>

export type ImageAsset = AssetCore & Readonly<{
  mediaKind: 'image'
  /** A still picture has no length of its own. */
  duration: null
  width: number
  height: number
  frameRate: null
  hasAudio: false
}>

export type AudioAsset = AssetCore & Readonly<{
  mediaKind: 'audio'
  duration: MediaTime
  /** Sound has no picture. */
  width: null
  height: null
  frameRate: null
  hasAudio: true
}>

export type MediaAsset = VideoAsset | ImageAsset | AudioAsset

export type AssetIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'MEDIA_KIND_UNKNOWN'
  | 'FIELD_NOT_ALLOWED_FOR_KIND'

export type AssetError = {
  readonly code: 'ASSET_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: AssetIssueCode }[]
}

export const ASSET_ID_PATTERN = /^asset_[a-z0-9]{8,64}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const MAX_DIMENSION = 16_384

const ASSET_KEYS = [
  'schemaVersion',
  'assetId',
  'storageRef',
  'sha256',
  'byteLength',
  'mediaKind',
  'duration',
  'width',
  'height',
  'frameRate',
  'hasAudio',
  'durationResidualSeconds',
] as const

/**
 * Which fields carry a real value for each kind, and which must be null.
 *
 * Written as data rather than as branches, so adding a kind cannot silently
 * skip a rule, and so a reader can see all three kinds at once.
 */
const KIND_RULES: Readonly<Record<MediaKind, Readonly<{
  duration: 'required' | 'null'
  size: 'required' | 'null'
  frameRate: 'optional' | 'null'
  hasAudio: 'either' | false | true
}>>> = Object.freeze({
  video: Object.freeze({ duration: 'required', size: 'required', frameRate: 'optional', hasAudio: 'either' }),
  image: Object.freeze({ duration: 'null', size: 'required', frameRate: 'null', hasAudio: false }),
  audio: Object.freeze({ duration: 'required', size: 'null', frameRate: 'null', hasAudio: true }),
} as const)

export const validateMediaAsset = (input: unknown, path = '$'): Result<MediaAsset, AssetError> => {
  type Issue = AssetError['issues'][number]
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'ASSET_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }

  for (const key of ASSET_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(ASSET_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }

  if (input.schemaVersion !== ASSET_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.assetId !== 'string' || !ASSET_ID_PATTERN.test(input.assetId)) {
    issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.storageRef !== 'string' || input.storageRef.trim().length === 0 || input.storageRef.length > 512) {
    issues.push({ path: `${path}.storageRef`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.sha256 !== 'string' || !SHA256_PATTERN.test(input.sha256)) {
    issues.push({ path: `${path}.sha256`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!Number.isSafeInteger(input.byteLength) || (input.byteLength as number) <= 0) {
    issues.push({ path: `${path}.byteLength`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.durationResidualSeconds !== 'number' || !Number.isFinite(input.durationResidualSeconds)) {
    issues.push({ path: `${path}.durationResidualSeconds`, code: 'TYPE_INVALID' })
  }

  const mediaKind = input.mediaKind as MediaKind
  if (!MEDIA_KINDS.includes(mediaKind)) {
    // Refused, never defaulted to 'video'. A file the system does not recognise
    // must not be quietly treated as footage.
    return err({ code: 'ASSET_INVALID', issues: [...issues, { path: `${path}.mediaKind`, code: 'MEDIA_KIND_UNKNOWN' }] })
  }
  const rules = KIND_RULES[mediaKind]

  let duration: MediaTime | null = null
  if (rules.duration === 'null') {
    if (input.duration !== null) issues.push({ path: `${path}.duration`, code: 'FIELD_NOT_ALLOWED_FOR_KIND' })
  } else {
    const parsed = validateMediaTime(input.duration, `${path}.duration`)
    if (!parsed.ok || parsed.value.ticks <= 0) {
      issues.push({ path: `${path}.duration`, code: 'VALUE_OUT_OF_RANGE' })
    } else {
      duration = parsed.value
    }
  }

  for (const key of ['width', 'height'] as const) {
    const value = input[key]
    if (rules.size === 'null') {
      if (value !== null) issues.push({ path: `${path}.${key}`, code: 'FIELD_NOT_ALLOWED_FOR_KIND' })
    } else if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > MAX_DIMENSION) {
      issues.push({ path: `${path}.${key}`, code: 'VALUE_OUT_OF_RANGE' })
    }
  }

  let frameRate: VideoAsset['frameRate'] = null
  if (rules.frameRate === 'null') {
    if (input.frameRate !== null) issues.push({ path: `${path}.frameRate`, code: 'FIELD_NOT_ALLOWED_FOR_KIND' })
  } else if (input.frameRate !== null) {
    if (!isRecord(input.frameRate)) {
      issues.push({ path: `${path}.frameRate`, code: 'TYPE_INVALID' })
    } else {
      const { numerator, denominator } = input.frameRate
      const keys = Object.keys(input.frameRate)
      if (
        keys.length !== 2 ||
        !Number.isSafeInteger(numerator) || (numerator as number) <= 0 ||
        !Number.isSafeInteger(denominator) || (denominator as number) <= 0
      ) {
        issues.push({ path: `${path}.frameRate`, code: 'VALUE_OUT_OF_RANGE' })
      } else {
        frameRate = Object.freeze({ numerator: numerator as number, denominator: denominator as number })
      }
    }
  }

  if (typeof input.hasAudio !== 'boolean') {
    issues.push({ path: `${path}.hasAudio`, code: 'TYPE_INVALID' })
  } else if (rules.hasAudio !== 'either' && input.hasAudio !== rules.hasAudio) {
    issues.push({ path: `${path}.hasAudio`, code: 'FIELD_NOT_ALLOWED_FOR_KIND' })
  }

  if (issues.length > 0) return err({ code: 'ASSET_INVALID', issues })

  const core = {
    schemaVersion: ASSET_SCHEMA_VERSION as typeof ASSET_SCHEMA_VERSION,
    assetId: input.assetId as string,
    storageRef: input.storageRef as string,
    sha256: input.sha256 as string,
    byteLength: input.byteLength as number,
    durationResidualSeconds: input.durationResidualSeconds as number,
  }

  if (mediaKind === 'image') {
    return ok(Object.freeze({
      ...core,
      mediaKind: 'image' as const,
      duration: null,
      width: input.width as number,
      height: input.height as number,
      frameRate: null,
      hasAudio: false as const,
    }))
  }
  if (mediaKind === 'audio') {
    return ok(Object.freeze({
      ...core,
      mediaKind: 'audio' as const,
      duration: duration as MediaTime,
      width: null,
      height: null,
      frameRate: null,
      hasAudio: true as const,
    }))
  }
  return ok(Object.freeze({
    ...core,
    mediaKind: 'video' as const,
    duration: duration as MediaTime,
    width: input.width as number,
    height: input.height as number,
    frameRate,
    hasAudio: input.hasAudio as boolean,
  }))
}

/**
 * The narrower check for footage specifically.
 *
 * Kept as its own function because most of the system only ever wants a video:
 * a composition is made of footage, and putting a piece of music on the picture
 * track has no meaning. Callers that say `validateVideoAsset` get a compile-time
 * `VideoAsset`, so they can read `.duration` and `.width` without a null check
 * that would otherwise appear at dozens of call sites.
 */
export const validateVideoAsset = (input: unknown, path = '$'): Result<VideoAsset, AssetError> => {
  const asset = validateMediaAsset(input, path)
  if (!asset.ok) return asset
  if (asset.value.mediaKind !== 'video') {
    return err({ code: 'ASSET_INVALID', issues: [{ path: `${path}.mediaKind`, code: 'FIELD_NOT_ALLOWED_FOR_KIND' }] })
  }
  return ok(asset.value)
}

export const isVideoAsset = (asset: MediaAsset): asset is VideoAsset => asset.mediaKind === 'video'
export const isImageAsset = (asset: MediaAsset): asset is ImageAsset => asset.mediaKind === 'image'
export const isAudioAsset = (asset: MediaAsset): asset is AudioAsset => asset.mediaKind === 'audio'

/** True when this kind of media can be laid on top of the picture. */
export const isVisualAsset = (asset: MediaAsset): asset is VideoAsset | ImageAsset =>
  asset.mediaKind === 'video' || asset.mediaKind === 'image'

export const findAsset = (
  assets: readonly MediaAsset[],
  assetId: string,
): MediaAsset | undefined => assets.find((asset) => asset.assetId === assetId)

export const findVideoAsset = (
  assets: readonly MediaAsset[],
  assetId: string,
): VideoAsset | undefined => {
  const asset = findAsset(assets, assetId)
  return asset !== undefined && asset.mediaKind === 'video' ? asset : undefined
}
