import { describe, expect, it } from 'vitest'

import { addAsset, type EditProject } from '@sanverse/edit-domain'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import { testProject } from '@sanverse/edit-domain/test-fixtures'

import {
  createMediaOrganizationService,
  MediaOrganizationServiceError,
  parseCommand,
} from './media-organization-service.ts'

const PROJECT_ID = 'project_1234567890abcdef'

/** The one file this service owns, held in memory. */
function fakeStore(initial: string | null = null) {
  let stored = initial
  return {
    stored: () => stored,
    repository: {
      async readMediaOrganization() { return stored },
      async saveMediaOrganization(_projectId: string, value: string) { stored = value },
    },
  }
}

function serviceFor(project: EditProject, initial: string | null = null) {
  const store = fakeStore(initial)
  let folderCount = 0
  const service = createMediaOrganizationService({
    repository: store.repository,
    loadProject: async () => project,
    createFolderId: () => `folder_${(folderCount += 1).toString().padStart(8, '0')}`,
    now: () => new Date('2026-08-03T10:00:00.000Z'),
  })
  return { service, store }
}

/** A project holding the primary footage plus one extra picture. */
function projectWithTwoAssets(): EditProject {
  const base = testProject()
  const added = addAsset(base, {
    schemaVersion: 'sanverse.asset/media/v1',
    assetId: 'asset_picture001',
    mediaKind: 'image',
    storageRef: `project/${base.projectId}/assets/asset_picture001`,
    byteLength: 2_812,
    sha256: 'd'.repeat(64),
    duration: null,
    width: 800,
    height: 600,
    frameRate: null,
    hasAudio: false,
    durationResidualSeconds: 0,
  })
  if (!added.ok) throw new Error(JSON.stringify(added.error))
  return added.value
}

describe('media organization service', () => {
  it('treats an absent file as every asset at the root and writes nothing', async () => {
    const { service, store } = serviceFor(projectWithTwoAssets())
    const organization = await service.load(PROJECT_ID)
    expect(organization.folders).toEqual([])
    expect(organization.assetFolderAssignments).toEqual({})
    // A project that never made a folder needs no file and no migration.
    expect(store.stored()).toBeNull()
  })

  it('creates a folder, files an asset, and persists it durably as JSON', async () => {
    const { service, store } = serviceFor(projectWithTwoAssets())
    await service.apply(PROJECT_ID, { kind: 'create-folder', name: 'B-roll' })
    const filed = await service.apply(PROJECT_ID, {
      kind: 'move-asset-to-folder',
      assetId: 'asset_picture001',
      folderId: 'folder_00000001',
    })
    expect(filed.assetFolderAssignments).toEqual({ asset_picture001: 'folder_00000001' })

    // Durable: what a fresh service reads back is exactly what was stored.
    const written = store.stored()
    expect(written).not.toBeNull()
    const reopened = serviceFor(projectWithTwoAssets(), written)
    expect(await reopened.service.load(PROJECT_ID)).toEqual(filed)
  })

  it('returns an asset to the root, and returns assets to the root when a folder is deleted', async () => {
    const { service } = serviceFor(projectWithTwoAssets())
    await service.apply(PROJECT_ID, { kind: 'create-folder', name: 'B-roll' })
    await service.apply(PROJECT_ID, { kind: 'move-asset-to-folder', assetId: 'asset_picture001', folderId: 'folder_00000001' })

    const toRoot = await service.apply(PROJECT_ID, { kind: 'move-asset-to-root', assetId: 'asset_picture001' })
    expect(toRoot.assetFolderAssignments).toEqual({})

    await service.apply(PROJECT_ID, { kind: 'move-asset-to-folder', assetId: 'asset_picture001', folderId: 'folder_00000001' })
    const deleted = await service.apply(PROJECT_ID, { kind: 'delete-folder', folderId: 'folder_00000001' })
    expect(deleted.folders).toEqual([])
    // The label went; the media did not.
    expect(deleted.assetFolderAssignments).toEqual({})
  })

  it('changes nothing about the project, the revision, the history, or the render', async () => {
    // The load-bearing guarantee of ADR-MEDIA-ORGANIZATION-V1: filing media is
    // not a decision about the video, so it must be invisible to everything
    // that decides what gets exported.
    const project = projectWithTwoAssets()
    const before = {
      revision: project.revision,
      changeSets: project.changeSets.length,
      redo: project.redoStack.length,
      serialized: JSON.stringify(project),
      plan: JSON.stringify(compileProjectToRenderPlan(project)),
    }

    const { service } = serviceFor(project)
    await service.apply(PROJECT_ID, { kind: 'create-folder', name: 'B-roll' })
    await service.apply(PROJECT_ID, { kind: 'move-asset-to-folder', assetId: 'asset_picture001', folderId: 'folder_00000001' })
    await service.apply(PROJECT_ID, { kind: 'rename-folder', folderId: 'folder_00000001', name: 'Cutaways' })
    await service.apply(PROJECT_ID, { kind: 'move-asset-to-root', assetId: 'asset_picture001' })
    await service.apply(PROJECT_ID, { kind: 'delete-folder', folderId: 'folder_00000001' })

    expect(project.revision).toBe(before.revision)
    expect(project.changeSets).toHaveLength(before.changeSets)
    expect(project.redoStack).toHaveLength(before.redo)
    expect(JSON.stringify(project)).toBe(before.serialized)
    // Byte-identical render plan after all five commands.
    expect(JSON.stringify(compileProjectToRenderPlan(project))).toBe(before.plan)
  })

  it('refuses a corrupt file rather than quietly replacing it with an empty filing', async () => {
    for (const corrupt of ['{not json', JSON.stringify({ schemaVersion: 'sanverse.media-organization/v2' })]) {
      const { service, store } = serviceFor(projectWithTwoAssets(), corrupt)
      await expect(service.load(PROJECT_ID)).rejects.toBeInstanceOf(MediaOrganizationServiceError)
      // The bytes stay on disk so the user's folders can still be recovered.
      expect(store.stored()).toBe(corrupt)
    }
  })

  it('refuses a duplicate folder name and an unknown folder or asset', async () => {
    const { service } = serviceFor(projectWithTwoAssets())
    await service.apply(PROJECT_ID, { kind: 'create-folder', name: 'B-roll' })

    await expect(service.apply(PROJECT_ID, { kind: 'create-folder', name: ' b-roll ' }))
      .rejects.toMatchObject({ code: 'FOLDER_NAME_DUPLICATE' })
    await expect(service.apply(PROJECT_ID, { kind: 'rename-folder', folderId: 'folder_missing1', name: 'x' }))
      .rejects.toMatchObject({ code: 'FOLDER_UNKNOWN' })
    await expect(service.apply(PROJECT_ID, { kind: 'move-asset-to-folder', assetId: 'asset_notthere1', folderId: 'folder_00000001' }))
      .rejects.toMatchObject({ code: 'ASSET_UNKNOWN' })
  })

  it('refuses a command shape it does not recognise instead of coercing it', async () => {
    for (const bad of [null, 'create-folder', [], {}, { kind: 'delete-everything' }, { kind: 'create-folder' }]) {
      expect(() => parseCommand(bad)).toThrow(MediaOrganizationServiceError)
    }
    expect(parseCommand({ kind: 'create-folder', name: 'B-roll' })).toEqual({ kind: 'create-folder', name: 'B-roll' })
    // Extra keys are ignored by construction: only named fields are read, so a
    // command can never smuggle a field the domain does not know about.
    expect(parseCommand({ kind: 'move-asset-to-root', assetId: 'asset_picture001', folderId: 'x' }))
      .toEqual({ kind: 'move-asset-to-root', assetId: 'asset_picture001' })
  })
})
