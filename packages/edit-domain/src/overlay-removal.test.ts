import { describe, expect, it } from 'vitest'

import {
  MUSIC_PRIMITIVE_ID,
  OVERLAY_REMOVE_PRIMITIVE_ID,
  TITLE_PRIMITIVE_ID,
} from './capabilities.ts'
import { validateOperation } from './operations.ts'
import { isRemovableOverlayId, validateOverlayOperation } from './overlay-operations.ts'
import {
  acceptChangeSet,
  activeOverlayOperations,
  redoChangeSet,
  undoChangeSet,
  type EditProject,
} from './project.ts'
import {
  changeSetOf,
  ms,
  testCallout,
  testMediaOverlay,
  testMultiAssetProject,
  testMusic,
  testTitle,
} from './test-fixtures.ts'

const remove = (overlayId: string, operationId = 'operation_remove001'): Record<string, unknown> => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'remove-overlay',
  capabilityId: OVERLAY_REMOVE_PRIMITIVE_ID,
  overlayId,
  extensions: {},
})

const accept = (
  project: EditProject,
  changeSetId: string,
  operations: readonly unknown[],
): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const idsOn = (project: EditProject): string[] =>
  activeOverlayOperations(project).map((operation) =>
    operation.kind === 'add-title'
      ? operation.titleId
      : operation.kind === 'add-callout'
        ? operation.calloutId
        : operation.kind === 'add-media-overlay'
          ? operation.overlayId
          : operation.musicId,
  )

describe('P1-F.1A C1.13 taking one thing off the video', () => {
  it('accepts the four identifier shapes it can act on, and nothing else', () => {
    for (const id of ['title_0001', 'callout_0001', 'broll_0001', 'music_0001']) {
      expect(isRemovableOverlayId(id)).toBe(true)
    }
    for (const id of ['clip_aaaaaaaa', 'asset_aaaaaaaa', 'captions_aaaaaaaa', 'broll_', '', null]) {
      expect(isRemovableOverlayId(id)).toBe(false)
    }
  })

  it('refuses to name a piece of footage, so Delete can never mean a cut by accident', () => {
    const result = validateOverlayOperation(remove('clip_aaaaaaaa'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.path.endsWith('.overlayId'))).toBe(true)
  })

  it('refuses an unknown key and a capability that cannot produce it', () => {
    expect(validateOverlayOperation({ ...remove('broll_0001'), ripple: true }).ok).toBe(false)
    expect(validateOverlayOperation({ ...remove('broll_0001'), capabilityId: TITLE_PRIMITIVE_ID }).ok).toBe(false)
  })

  it('does not ask for footage it has nothing to do with', () => {
    // A removal names the thing it removes. Demanding an assetId would have
    // meant inventing one at the only place a user presses Delete.
    const result = validateOverlayOperation(remove('title_0001'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.hasOwn(result.value, 'assetId')).toBe(false)
  })

  it('takes each of the four kinds off the video and leaves the other three alone', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_addall0001', [
      testTitle(), testCallout(), testMediaOverlay(), testMusic(),
    ])
    expect(idsOn(project).sort()).toEqual(['broll_0001', 'callout_0001', 'music_0001', 'title_0001'])

    const withoutBroll = accept(project, 'changeset_removeone1', [remove('broll_0001')])
    expect(idsOn(withoutBroll).sort()).toEqual(['callout_0001', 'music_0001', 'title_0001'])

    const withoutMusic = accept(withoutBroll, 'changeset_removetwo1', [remove('music_0001', 'operation_remove002')])
    expect(idsOn(withoutMusic).sort()).toEqual(['callout_0001', 'title_0001'])
  })

  it('is one Undo, and Redo takes it off again', () => {
    let project = accept(testMultiAssetProject(), 'changeset_addbroll01', [testMediaOverlay()])
    project = accept(project, 'changeset_removeone1', [remove('broll_0001')])
    expect(idsOn(project)).toEqual([])

    const undone = undoChangeSet(project)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(idsOn(undone.value)).toEqual(['broll_0001'])

    const redone = redoChangeSet(undone.value)
    expect(redone.ok).toBe(true)
    if (!redone.ok) return
    expect(idsOn(redone.value)).toEqual([])
  })

  it('cannot be undone by a repair that happens to come after it', () => {
    // A `set-` naming something that is gone finds nothing to repair. Only Undo
    // brings a deleted item back, which is the only rule a user can predict.
    let project = accept(testMultiAssetProject(), 'changeset_addtitle01', [testTitle()])
    project = accept(project, 'changeset_removeandr', [
      remove('title_0001'),
      {
        ...testTitle(),
        operationId: 'operation_settitle01',
        kind: 'set-title',
        capabilityId: TITLE_PRIMITIVE_ID,
        headline: 'Back from the dead',
      },
    ])
    expect(idsOn(project)).toEqual([])
  })

  it('removing something that is not there changes nothing and is not an error', () => {
    // Replaying history after an earlier change set was switched off reaches
    // this legitimately, so it cannot be treated as a fault.
    const project = accept(testMultiAssetProject(), 'changeset_removeghos', [remove('broll_9999')])
    expect(idsOn(project)).toEqual([])
    expect(project.changeSets[0].blockedReason).toBeNull()
  })

  it('travels through the one operation validator every caller uses', () => {
    const result = validateOperation(remove('callout_0001'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.kind).toBe('remove-overlay')
  })
})

describe('P1-F.1A C1.11 giving music a length', () => {
  const music = (overrides: Record<string, unknown>) => ({ ...testMusic(), ...overrides })

  it('reads a project saved before music could have a length, and calls it unbounded', () => {
    const { durationTicks: _omitted, ...withoutLength } = testMusic()
    const result = validateOverlayOperation(withoutLength)
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.kind !== 'add-music') return
    expect(result.value.durationTicks).toBeNull()
  })

  it('treats an explicit null the same as an absent one', () => {
    const result = validateOverlayOperation(music({ durationTicks: null }))
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.kind !== 'add-music') return
    expect(result.value.durationTicks).toBeNull()
  })

  it('keeps a length that was asked for', () => {
    const result = validateOverlayOperation(music({ durationTicks: ms(9_000) }))
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.kind !== 'add-music') return
    expect(result.value.durationTicks?.ticks).toBe(ms(9_000).ticks)
  })

  it('refuses a length of nothing, which would be an item you can see but never hear', () => {
    expect(validateOverlayOperation(music({ durationTicks: ms(0) })).ok).toBe(false)
    expect(validateOverlayOperation(music({ durationTicks: { ticks: -1, timescale: 1_440_000 } })).ok).toBe(false)
  })

  it('still refuses an unknown key, so the contract has not been opened up', () => {
    expect(validateOverlayOperation(music({ loopForever: true })).ok).toBe(false)
  })

  it('carries a length through acceptance and lets a repair change it', () => {
    let project = accept(testMultiAssetProject(), 'changeset_addmusic01', [music({ durationTicks: ms(9_000) })])
    const first = activeOverlayOperations(project)[0]
    expect(first.kind === 'add-music' && first.durationTicks?.ticks).toBe(ms(9_000).ticks)

    project = accept(project, 'changeset_trimmusic1', [
      {
        ...music({ durationTicks: ms(4_000) }),
        operationId: 'operation_setmusic01',
        kind: 'set-music',
        capabilityId: MUSIC_PRIMITIVE_ID,
      },
    ])
    const repaired = activeOverlayOperations(project)[0]
    expect(repaired.kind === 'add-music' && repaired.durationTicks?.ticks).toBe(ms(4_000).ticks)
  })
})
