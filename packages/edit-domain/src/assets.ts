import { err, isRecord, ok, type Result } from './result.ts'
import { validateMediaTime, type MediaTime } from './time.ts'

/**
 * Immutable identity of one piece of source media.
 *
 * The domain stores no filesystem path. `storageRef` is an opaque,
 * application-controlled reference that only a storage adapter can resolve.
 * That is what allows the same engine to run against local disk today and
 * object storage later without changing a line of domain code.
 */
export type VideoAsset = Readonly<{
  schemaVersion: 'sanverse.asset/video/v1'
  assetId: string
  storageRef: string
  sha256: string
  byteLength: number
  duration: MediaTime
  width: number
  height: number
  frameRate: Readonly<{ numerator: number; denominator: number }> | null
  hasAudio: boolean
  /** Seconds lost when the probed duration was converted to project ticks. */
  durationResidualSeconds: number
}>

export type AssetIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'

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
  'duration',
  'width',
  'height',
  'frameRate',
  'hasAudio',
  'durationResidualSeconds',
] as const

export const validateVideoAsset = (input: unknown, path = '$'): Result<VideoAsset, AssetError> => {
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

  if (input.schemaVersion !== 'sanverse.asset/video/v1') {
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
  for (const key of ['width', 'height'] as const) {
    const value = input[key]
    if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > MAX_DIMENSION) {
      issues.push({ path: `${path}.${key}`, code: 'VALUE_OUT_OF_RANGE' })
    }
  }
  if (typeof input.hasAudio !== 'boolean') {
    issues.push({ path: `${path}.hasAudio`, code: 'TYPE_INVALID' })
  }
  if (typeof input.durationResidualSeconds !== 'number' || !Number.isFinite(input.durationResidualSeconds)) {
    issues.push({ path: `${path}.durationResidualSeconds`, code: 'TYPE_INVALID' })
  }

  const duration = validateMediaTime(input.duration, `${path}.duration`)
  if (!duration.ok) {
    issues.push({ path: `${path}.duration`, code: 'VALUE_OUT_OF_RANGE' })
  } else if (duration.value.ticks <= 0) {
    issues.push({ path: `${path}.duration`, code: 'VALUE_OUT_OF_RANGE' })
  }

  let frameRate: VideoAsset['frameRate'] = null
  if (input.frameRate !== null) {
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

  if (issues.length > 0) return err({ code: 'ASSET_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: 'sanverse.asset/video/v1',
    assetId: input.assetId as string,
    storageRef: input.storageRef as string,
    sha256: input.sha256 as string,
    byteLength: input.byteLength as number,
    duration: (duration as { ok: true; value: MediaTime }).value,
    width: input.width as number,
    height: input.height as number,
    frameRate,
    hasAudio: input.hasAudio as boolean,
    durationResidualSeconds: input.durationResidualSeconds as number,
  }))
}

export const findAsset = (
  assets: readonly VideoAsset[],
  assetId: string,
): VideoAsset | undefined => assets.find((asset) => asset.assetId === assetId)
