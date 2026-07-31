import { describe, expect, it } from 'vitest'
import {
  acceptChangeSet,
  setChangeSetActive,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'
import {
  testMediaOverlay,
  testMultiAssetProject,
  testMusic,
  TEST_ASSET_ID,
  TEST_BROLL_ASSET_ID,
  TEST_MUSIC_ASSET_ID,
} from '@sanverse/edit-domain/test-fixtures'
import { buildMediaUsageIndex } from './media-usage'

const accept = (project: EditProject, id: string, operations: readonly EditOperation[]): EditProject => {
  const result = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: id,
    baseRevision: project.revision,
    operations,
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('media usage index', () => {
  it('counts primary footage, accepted overlays, music, and unused assets once per project', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_media001', [testMediaOverlay()])
    project = accept(project, 'changeset_music001', [testMusic()])
    const usage = buildMediaUsageIndex(project)
    expect(usage.get(TEST_ASSET_ID)).toMatchObject({ count: 1, kinds: ['primary-video'] })
    expect(usage.get(TEST_BROLL_ASSET_ID)).toMatchObject({ count: 1, kinds: ['media-overlay'] })
    expect(usage.get(TEST_MUSIC_ASSET_ID)).toMatchObject({ count: 1, kinds: ['music'] })
    expect([...usage.values()].find((entry) => entry.kinds.includes('unused'))).toBeDefined()
  })

  it('counts multiple accepted placements and excludes inactive records', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_media001', [testMediaOverlay()])
    project = accept(project, 'changeset_media002', [testMediaOverlay({ operationId: 'operation_broll002', overlayId: 'broll_0002' })])
    expect(buildMediaUsageIndex(project).get(TEST_BROLL_ASSET_ID)?.count).toBe(2)
    const inactive = setChangeSetActive(project, 'changeset_media002', false)
    if (!inactive.ok) throw new Error(JSON.stringify(inactive.error))
    expect(buildMediaUsageIndex(inactive.value).get(TEST_BROLL_ASSET_ID)?.count).toBe(1)
  })

  it('does not mutate project input', () => {
    const project = testMultiAssetProject()
    const before = JSON.stringify(project)
    buildMediaUsageIndex(project)
    expect(JSON.stringify(project)).toBe(before)
  })
})
