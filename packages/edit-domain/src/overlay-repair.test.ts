import { describe, expect, it } from 'vitest'

import {
  CALLOUT_PRIMITIVE_ID,
  MEDIA_OVERLAY_PRIMITIVE_ID,
  MUSIC_PRIMITIVE_ID,
  TITLE_PRIMITIVE_ID,
} from './capabilities.ts'
import {
  acceptChangeSet,
  activeOverlayOperations,
  undoChangeSet,
} from './project.ts'
import { validateOperation } from './operations.ts'
import {
  changeSetOf,
  testCallout,
  testMediaOverlay,
  testMultiAssetProject,
  testMusic,
  testTitle,
} from './test-fixtures.ts'

const setTitle = (headline = 'Repaired title') => ({
  ...testTitle(),
  operationId: 'operation_settitle01',
  kind: 'set-title',
  capabilityId: TITLE_PRIMITIVE_ID,
  headline,
})

const setCallout = () => ({
  ...testCallout(),
  operationId: 'operation_setcall01',
  kind: 'set-callout',
  capabilityId: CALLOUT_PRIMITIVE_ID,
  label: 'Repaired label',
  region: {
    coordinateSpace: 'composition-normalized',
    x: 0.1,
    y: 0.2,
    width: 0.4,
    height: 0.3,
  },
})

const setMediaOverlay = () => ({
  ...testMediaOverlay(),
  operationId: 'operation_setbroll1',
  kind: 'set-media-overlay',
  capabilityId: MEDIA_OVERLAY_PRIMITIVE_ID,
  opacity: 0.5,
  region: {
    coordinateSpace: 'composition-normalized',
    x: 0.2,
    y: 0.1,
    width: 0.5,
    height: 0.5,
  },
})

const setMusic = () => ({
  ...testMusic(),
  operationId: 'operation_setmusic1',
  kind: 'set-music',
  capabilityId: MUSIC_PRIMITIVE_ID,
  gainDb: -24,
})

const accept = (
  project: ReturnType<typeof testMultiAssetProject>,
  changeSetId: string,
  operations: readonly unknown[],
) => {
  const result = acceptChangeSet(
    project,
    changeSetOf(changeSetId, project.revision, operations as never),
  )
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('repairing accepted overlays', () => {
  it.each([
    ['title', setTitle()],
    ['callout', setCallout()],
    ['B-roll', setMediaOverlay()],
    ['music', setMusic()],
  ])('accepts a closed full replacement operation for %s', (_family, operation) => {
    expect(validateOperation(operation)).toMatchObject({ ok: true })
  })

  it('folds each repair over the matching accepted item without creating a duplicate', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_additems1', [
      testTitle(),
      testCallout(),
      testMediaOverlay(),
      testMusic(),
    ])
    project = accept(project, 'changeset_repair001', [
      setTitle(),
      setCallout(),
      setMediaOverlay(),
      setMusic(),
    ])

    const active = activeOverlayOperations(project)
    expect(active).toHaveLength(4)
    expect(active.find((operation) => operation.kind === 'add-title')).toMatchObject({
      headline: 'Repaired title',
    })
    expect(active.find((operation) => operation.kind === 'add-callout')).toMatchObject({
      label: 'Repaired label',
      region: { x: 0.1, y: 0.2, width: 0.4, height: 0.3 },
    })
    expect(active.find((operation) => operation.kind === 'add-media-overlay')).toMatchObject({
      opacity: 0.5,
      region: { x: 0.2, y: 0.1, width: 0.5, height: 0.5 },
    })
    expect(active.find((operation) => operation.kind === 'add-music')).toMatchObject({
      gainDb: -24,
    })
  })

  it('makes one repair exactly one Undo', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_addtitle1', [testTitle({ headline: 'Original title' })])
    project = accept(project, 'changeset_settitle1', [setTitle()])

    expect(activeOverlayOperations(project)[0]).toMatchObject({ headline: 'Repaired title' })

    const undone = undoChangeSet(project)
    if (!undone.ok) throw new Error(`undo failed: ${JSON.stringify(undone.error)}`)
    expect(activeOverlayOperations(undone.value)[0]).toMatchObject({ headline: 'Original title' })
  })

  it('ignores a repair whose original item is inactive instead of inventing one', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_settitle1', [setTitle()])
    expect(activeOverlayOperations(project)).toEqual([])
  })

  it('refuses unknown fields instead of silently stripping them', () => {
    expect(validateOperation({ ...setTitle(), fontSize: 100 })).toMatchObject({ ok: false })
  })
})
