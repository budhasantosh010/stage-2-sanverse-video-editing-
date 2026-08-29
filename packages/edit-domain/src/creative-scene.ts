import { err, isRecord, ok, type Result } from './result.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { validateTimeRange, type TimeRange } from './time.ts'

export const CREATIVE_SCENE_OPERATION_KIND = 'add-creative-scene' as const
export const CREATIVE_SCENE_ID_PATTERN = /^creative_scene_[a-z0-9]{8,64}$/u
export const CREATIVE_ARTIFACT_ID_PATTERN = /^creativeart_[a-f0-9]{32,64}$/u
export const CREATIVE_ARTIFACT_SHA256_PATTERN = /^[a-f0-9]{64}$/u
export const CREATIVE_SCENE_PRESENTATION_MODES = Object.freeze(['overlay','split','picture-in-picture','full-screen-motion','tracked-attached','surface-embedded','subject-environment','bridge-takeover'] as const)
export type CreativeScenePresentationMode = (typeof CREATIVE_SCENE_PRESENTATION_MODES)[number]

export interface AddCreativeSceneOperation {
  readonly schemaVersion: 'sanverse.operation/v1'
  readonly operationId: string
  readonly kind: typeof CREATIVE_SCENE_OPERATION_KIND
  readonly capabilityId: string
  readonly sceneId: string
  readonly assetId: string
  readonly sourceInterval: TimeRange
  readonly artifactId: string
  readonly artifactSha256: string
  readonly presentationMode: CreativeScenePresentationMode
  readonly layer: number
  readonly extensions: Extensions
}

export type CreativeSceneOperationError = Readonly<{
  code: 'OPERATION_INVALID'
  issues: readonly Readonly<{ path: string; code: 'TYPE_INVALID'|'FIELD_REQUIRED'|'FIELD_UNKNOWN'|'VALUE_OUT_OF_RANGE' }>[]
}>

const KEYS = Object.freeze([
  'schemaVersion','operationId','kind','capabilityId','sceneId','assetId','sourceInterval','artifactId','artifactSha256','presentationMode','layer','extensions',
] as const)
const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/u

export const validateCreativeSceneOperation = (input: unknown, path = '$'): Result<AddCreativeSceneOperation, CreativeSceneOperationError> => {
  type Issue = CreativeSceneOperationError['issues'][number]
  const issues: Issue[] = []
  if (!isRecord(input)) return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  for (const key of KEYS) if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  for (const key of Object.keys(input)) if (!(KEYS as readonly string[]).includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  if (input.schemaVersion !== 'sanverse.operation/v1') issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  if (input.kind !== CREATIVE_SCENE_OPERATION_KIND) issues.push({ path: `${path}.kind`, code: 'VALUE_OUT_OF_RANGE' })
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  if (typeof input.capabilityId !== 'string' || input.capabilityId.trim().length === 0 || input.capabilityId.length > 240) issues.push({ path: `${path}.capabilityId`, code: 'VALUE_OUT_OF_RANGE' })
  if (typeof input.sceneId !== 'string' || !CREATIVE_SCENE_ID_PATTERN.test(input.sceneId)) issues.push({ path: `${path}.sceneId`, code: 'VALUE_OUT_OF_RANGE' })
  if (typeof input.assetId !== 'string' || input.assetId.trim().length === 0 || input.assetId.length > 128) issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
  const interval = validateTimeRange(input.sourceInterval, `${path}.sourceInterval`)
  if (!interval.ok) issues.push({ path: `${path}.sourceInterval`, code: 'VALUE_OUT_OF_RANGE' })
  if (typeof input.artifactId !== 'string' || !CREATIVE_ARTIFACT_ID_PATTERN.test(input.artifactId)) issues.push({ path: `${path}.artifactId`, code: 'VALUE_OUT_OF_RANGE' })
  if (typeof input.artifactSha256 !== 'string' || !CREATIVE_ARTIFACT_SHA256_PATTERN.test(input.artifactSha256)) issues.push({ path: `${path}.artifactSha256`, code: 'VALUE_OUT_OF_RANGE' })
  if (!CREATIVE_SCENE_PRESENTATION_MODES.includes(input.presentationMode as CreativeScenePresentationMode)) issues.push({ path: `${path}.presentationMode`, code: 'VALUE_OUT_OF_RANGE' })
  if (!Number.isSafeInteger(input.layer) || Number(input.layer) < 0 || Number(input.layer) > 100) issues.push({ path: `${path}.layer`, code: 'VALUE_OUT_OF_RANGE' })
  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) issues.push({ path: `${path}.extensions`, code: 'VALUE_OUT_OF_RANGE' })
  if (issues.length > 0 || !interval.ok || !extensions.ok) return err({ code: 'OPERATION_INVALID', issues })
  return ok(Object.freeze({
    schemaVersion: 'sanverse.operation/v1' as const,
    operationId: input.operationId as string,
    kind: CREATIVE_SCENE_OPERATION_KIND,
    capabilityId: input.capabilityId as string,
    sceneId: input.sceneId as string,
    assetId: input.assetId as string,
    sourceInterval: interval.value,
    artifactId: input.artifactId as string,
    artifactSha256: input.artifactSha256 as string,
    presentationMode: input.presentationMode as CreativeScenePresentationMode,
    layer: input.layer as number,
    extensions: extensions.value ?? emptyExtensions(),
  }))
}
