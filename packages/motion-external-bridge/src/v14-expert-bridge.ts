import { creativeRefusal, creativeValidationOk, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { createMotionScene, nodeBase, validateMotionExpertSpecV1, validateMotionScene, type MotionExpertNodeV1, type MotionExpertSpecV1, type MotionSceneV1 } from '@sanverse/motion-graph'

export type ExternalExpertSourceKindV14 = 'procedural' | 'shader'
export interface ExternalExpertBridgeDocumentV14 {
  readonly decision: 'expert-wrap'
  readonly sourceKind: ExternalExpertSourceKindV14
  readonly spec: MotionExpertSpecV1
  readonly reasons: readonly string[]
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every((key) => allowed.includes(key)) && allowed.every((key) => key in value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const safeSeed = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 2_147_483_647

export const inspectExternalExpertBridgeV14 = (sourceKind: ExternalExpertSourceKindV14, bytes: string | Uint8Array): CreativeValidationResultV1<ExternalExpertBridgeDocumentV14> => {
  if (typeof bytes !== 'string') return creativeRefusal('EXPERT_SOURCE_INVALID','Expert V1.4 external subsets require declarative JSON text; binary/runtime source is not executed.')
  if (bytes.length > 64_000) return creativeRefusal('EXPERT_SOURCE_TOO_LARGE','Expert V1.4 declarative source is bounded to 64 KB.')
  let parsed: unknown
  try { parsed = JSON.parse(bytes) } catch { return creativeRefusal('EXPERT_SOURCE_INVALID','Expert V1.4 source must be valid JSON.') }
  if (!record(parsed)) return creativeRefusal('EXPERT_SOURCE_INVALID','Expert V1.4 source root must be an object.')
  const expectedSchema = sourceKind === 'procedural' ? 'sanverse.procedural-subset/v1' : 'sanverse.shader-subset/v1'
  if (parsed.schemaVersion !== expectedSchema) return creativeRefusal('EXPERT_SOURCE_VERSION_UNSUPPORTED',`Expected ${expectedSchema}.`)
  if (!exactKeys(parsed,['schemaVersion','program','width','height','seed','parameters'])) return creativeRefusal('EXPERT_SOURCE_UNSAFE','Expert V1.4 source accepts only schemaVersion, program, width, height, seed and parameters. Arbitrary code/runtime/asset fields are refused.')
  if (!finite(parsed.width) || !finite(parsed.height) || !safeSeed(parsed.seed) || !record(parsed.parameters)) return creativeRefusal('EXPERT_SOURCE_INVALID','Expert V1.4 source requires finite dimensions, a bounded integer seed and parameter object.')
  const width = parsed.width
  const height = parsed.height
  const seed = parsed.seed
  let spec: MotionExpertSpecV1
  if (sourceKind === 'procedural') {
    if (parsed.program !== 'orbital-rings') return creativeRefusal('EXPERT_PROGRAM_UNSUPPORTED','Procedural V1.4 supports only orbital-rings.')
    const p = parsed.parameters
    if (!exactKeys(p,['ringCount','radius','thickness','wobble','speed'])) return creativeRefusal('EXPERT_SOURCE_UNSAFE','orbital-rings parameters must use the exact bounded contract.')
    const ringCount = Number(p.ringCount)
    spec = Object.freeze({ schemaVersion:'sanverse.motion-expert-node/v1',kind:'procedural',program:'orbital-rings',seed,width,height,maxPrimitives:Number.isSafeInteger(ringCount)?ringCount:0,parameters:Object.freeze({ringCount,radius:Number(p.radius),thickness:Number(p.thickness),wobble:Number(p.wobble),speed:Number(p.speed)}) })
  } else {
    if (parsed.program !== 'plasma-field') return creativeRefusal('EXPERT_PROGRAM_UNSUPPORTED','Shader V1.4 supports only plasma-field; arbitrary GLSL/WGSL is not executed.')
    const p = parsed.parameters
    if (!exactKeys(p,['frequency','amplitude','hueShift','scale'])) return creativeRefusal('EXPERT_SOURCE_UNSAFE','plasma-field parameters must use the exact bounded contract.')
    spec = Object.freeze({ schemaVersion:'sanverse.motion-expert-node/v1',kind:'shader',program:'plasma-field',seed,width,height,maxPrimitives:1,parameters:Object.freeze({frequency:Number(p.frequency),amplitude:Number(p.amplitude),hueShift:Number(p.hueShift),scale:Number(p.scale)}) })
  }
  const validated = validateMotionExpertSpecV1(spec)
  if (!validated.ok) return creativeRefusal('EXPERT_SOURCE_INVALID','External expert source violates the canonical Expert Motion bounds.',validated.issues)
  return creativeValidationOk(Object.freeze({ decision:'expert-wrap' as const,sourceKind,spec:validated.value,reasons:Object.freeze(['Declarative source maps to one bounded canonical Motion expert node; no external runtime, code, filesystem, network or time authority is retained.']) }))
}

export const materializeExternalExpertBridgeV14 = (assetId: string, sourceKind: ExternalExpertSourceKindV14, bytes: string | Uint8Array): CreativeValidationResultV1<MotionSceneV1> => {
  const inspected = inspectExternalExpertBridgeV14(sourceKind,bytes)
  if (!inspected.ok) return inspected as CreativeValidationResultV1<MotionSceneV1>
  const rootId = `${assetId}::root`
  const expertId = `${assetId}::expert`
  const expert: MotionExpertNodeV1 = Object.freeze({ ...nodeBase(expertId,sourceKind === 'procedural' ? 'Procedural Expert' : 'Shader Expert',rootId),type:'expert',expert:inspected.value.spec })
  const scene = createMotionScene({
    componentId:`external.${assetId.replace(/[^a-zA-Z0-9._:-]+/gu,'-').slice(0,160)||'expert'}`,
    componentVersion:1,
    rootNodeId:rootId,
    nodes:Object.freeze({
      [rootId]:Object.freeze({ ...nodeBase(rootId,'External Expert',null),type:'group' as const,childIds:Object.freeze([expertId]) }),
      [expertId]:expert,
    }),
    semanticParts:Object.freeze([{id:`${assetId}::expert-part`,label:'Expert visual',role:'decoration' as const,nodeIds:Object.freeze([expertId])}]),
    exposures:Object.freeze([]),
    layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),
    supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5']),
  })
  const validated = validateMotionScene(scene)
  return validated.ok ? creativeValidationOk(validated.value) : creativeRefusal('EXTERNAL_MATERIALIZATION_INVALID','Expert bridge produced an invalid canonical Motion scene.',validated.issues)
}
