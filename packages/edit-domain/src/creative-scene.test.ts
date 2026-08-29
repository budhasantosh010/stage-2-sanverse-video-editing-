import { describe, expect, it } from 'vitest'
import { CREATIVE_SCENE_PRIMITIVE_ID } from './capabilities.ts'
import { validateCreativeSceneOperation } from './creative-scene.ts'
import { acceptChangeSetAtomic, createProject, deserializeProject, redoChangeSet, serializeProject, undoChangeSet } from './project.ts'
import { mediaTime } from './time.ts'

const asset = Object.freeze({
  schemaVersion: 'sanverse.asset/media/v1' as const,
  mediaKind: 'video' as const,
  assetId: 'asset_1234567890ab',
  storageRef: 'project:project_1234567890abcdef/source',
  sha256: 'a'.repeat(64),
  byteLength: 4096,
  duration: mediaTime(28_800_000),
  width: 1920,
  height: 1080,
  frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
  hasAudio: true,
  durationResidualSeconds: 0,
})

const project = () => {
  const made = createProject({ projectId: 'project_1234567890abcdef', asset, compositionId: 'composition_1234567890ab', trackId: 'track_1234567890ab', clipId: 'clip_1234567890ab' })
  if (!made.ok) throw new Error(JSON.stringify(made.error))
  return made.value
}

const operation = (index: number) => Object.freeze({
  schemaVersion: 'sanverse.operation/v1' as const,
  operationId: `operation_scene000${index}`,
  kind: 'add-creative-scene' as const,
  capabilityId: CREATIVE_SCENE_PRIMITIVE_ID,
  sceneId: `creative_scene_scene000${index}`,
  assetId: asset.assetId,
  sourceInterval: Object.freeze({ start: mediaTime(index * 2_880_000), duration: mediaTime(2_880_000) }),
  artifactId: `creativeart_${String(index + 1).repeat(64).slice(0, 64)}`,
  artifactSha256: String(index + 1).repeat(64).slice(0, 64),
  presentationMode: 'overlay' as const,
  layer: 20 + index,
  extensions: Object.freeze({}),
})

describe('generic Creative Scene edit operation', () => {
  it('is a closed, source-anchored render-affecting operation with a registered capability', () => {
    expect(validateCreativeSceneOperation(operation(0))).toMatchObject({ ok: true, value: { kind: 'add-creative-scene', capabilityId: CREATIVE_SCENE_PRIMITIVE_ID } })
    expect(validateCreativeSceneOperation({ ...operation(0), artifactSha256: 'bad' })).toMatchObject({ ok: false })
    expect(validateCreativeSceneOperation({ ...operation(0), presentationMode: 'tracked-attached' })).toMatchObject({ ok: true })
  })

  it('accepts multiple scenes as one ChangeSet and one Undo/Redo removes/restores the whole batch', () => {
    const base = project()
    const changeSet = Object.freeze({
      schemaVersion: 'sanverse.change-set/v1' as const,
      changeSetId: 'changeset_creativescenes01',
      baseRevision: base.revision,
      operations: Object.freeze([operation(0), operation(1), operation(2)]),
      provenance: Object.freeze({ source: 'ai' as const, requestId: 'request:creative-scenes' }),
      extensions: Object.freeze({}),
    })
    const accepted = acceptChangeSetAtomic(base, changeSet)
    expect(accepted.status).toBe('accepted')
    if (accepted.status !== 'accepted') return
    expect(accepted.project.revision).toBe(1)
    expect(accepted.project.changeSets).toHaveLength(1)
    expect(accepted.project.changeSets[0]!.changeSet.operations).toHaveLength(3)

    const serialized = serializeProject(accepted.project)
    expect(serialized.ok).toBe(true)
    if (!serialized.ok) return
    const reopened = deserializeProject(serialized.value)
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    expect(reopened.value.changeSets[0]!.changeSet.operations.map((item) => item.kind)).toEqual(['add-creative-scene','add-creative-scene','add-creative-scene'])

    const undone = undoChangeSet(reopened.value)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(undone.value.changeSets).toHaveLength(0)
    expect(undone.value.redoStack).toHaveLength(1)
    const redone = redoChangeSet(undone.value)
    expect(redone.ok).toBe(true)
    if (!redone.ok) return
    expect(redone.value.changeSets).toHaveLength(1)
    expect(redone.value.changeSets[0]!.changeSet.operations).toHaveLength(3)
  })

  it('refuses a Creative scene whose source span has been removed instead of silently relocating it', () => {
    const base = project()
    const invalid = { ...operation(0), sourceInterval: Object.freeze({ start: mediaTime(27_360_000), duration: mediaTime(2_880_000) }) }
    const accepted = acceptChangeSetAtomic(base, Object.freeze({ schemaVersion:'sanverse.change-set/v1' as const, changeSetId:'changeset_badscene0001', baseRevision:0, operations:Object.freeze([invalid]), provenance:Object.freeze({source:'ai' as const,requestId:null}), extensions:Object.freeze({}) }))
    expect(accepted.status).toBe('blocked')
  })
})
