import { describe, expect, it } from 'vitest'

import {
  createFolder,
  deleteFolder,
  EMPTY_MEDIA_ORGANIZATION,
  folderCounts,
  folderOfAsset,
  MAX_MEDIA_FOLDERS,
  moveAssetToFolder,
  moveAssetToRoot,
  parseMediaOrganization,
  renameFolder,
  type MediaOrganizationV1,
} from './media-organization.ts'

const ASSETS = ['asset_aaaaaaaa', 'asset_bbbbbbbb', 'asset_cccccccc']
const AT = '2026-08-03T10:00:00.000Z'

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

const withFolder = (name = 'B-roll', folderId = 'folder_brol0001'): MediaOrganizationV1 =>
  unwrap(createFolder(EMPTY_MEDIA_ORGANIZATION, { folderId, name, createdAt: AT }))

describe('media organization', () => {
  it('treats an absent file as every asset at the root', () => {
    expect(EMPTY_MEDIA_ORGANIZATION.folders).toHaveLength(0)
    expect(folderOfAsset(EMPTY_MEDIA_ORGANIZATION, ASSETS[0])).toBeNull()
    expect(folderCounts(EMPTY_MEDIA_ORGANIZATION, ASSETS)).toMatchObject({ root: 3 })
  })

  it('creates a folder and files one asset into it, leaving the others at the root', () => {
    const created = withFolder()
    const filed = unwrap(moveAssetToFolder(created, ASSETS[0], 'folder_brol0001', ASSETS))
    expect(folderOfAsset(filed, ASSETS[0])).toBe('folder_brol0001')
    expect(folderOfAsset(filed, ASSETS[1])).toBeNull()
    expect(folderCounts(filed, ASSETS)).toMatchObject({ root: 2, byFolder: { folder_brol0001: 1 } })
  })

  it('returns an asset to the root by removing one key, not by inventing a root folder', () => {
    const filed = unwrap(moveAssetToFolder(withFolder(), ASSETS[0], 'folder_brol0001', ASSETS))
    const back = unwrap(moveAssetToRoot(filed, ASSETS[0], ASSETS))
    expect(back.assetFolderAssignments).toEqual({})
    expect(back.folders).toHaveLength(1)
  })

  it('keeps every assignment when a folder is renamed, because identity is the id', () => {
    const filed = unwrap(moveAssetToFolder(withFolder(), ASSETS[0], 'folder_brol0001', ASSETS))
    const renamed = unwrap(renameFolder(filed, 'folder_brol0001', 'Cutaways'))
    expect(renamed.folders[0]).toMatchObject({ folderId: 'folder_brol0001', name: 'Cutaways' })
    expect(folderOfAsset(renamed, ASSETS[0])).toBe('folder_brol0001')
  })

  it('sends media back to the root when its folder is deleted, and deletes nothing else', () => {
    // A folder is a LABEL, not a container. Deleting a label must never be able
    // to delete the user's material.
    const filed = unwrap(moveAssetToFolder(withFolder(), ASSETS[0], 'folder_brol0001', ASSETS))
    const deleted = unwrap(deleteFolder(filed, 'folder_brol0001'))
    expect(deleted.folders).toHaveLength(0)
    expect(deleted.assetFolderAssignments).toEqual({})
    expect(folderCounts(deleted, ASSETS)).toMatchObject({ root: 3 })
  })

  it('refuses a duplicate name however it is spaced or capitalised', () => {
    const created = withFolder('B-roll')
    for (const clash of ['B-roll', 'b-roll', '  B-ROLL  ']) {
      const result = createFolder(created, { folderId: 'folder_other001', name: clash, createdAt: AT })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('FOLDER_NAME_DUPLICATE')
    }
    // Renaming a folder to its own name is not a clash with itself.
    expect(renameFolder(created, 'folder_brol0001', 'B-roll').ok).toBe(true)
  })

  it('refuses an empty or over-long name, an unknown folder, and an unknown asset', () => {
    const created = withFolder()
    expect(createFolder(created, { folderId: 'folder_blank001', name: '   ', createdAt: AT })).toMatchObject({ ok: false, error: { code: 'FOLDER_NAME_INVALID' } })
    expect(createFolder(created, { folderId: 'folder_long0001', name: 'x'.repeat(65), createdAt: AT })).toMatchObject({ ok: false, error: { code: 'FOLDER_NAME_INVALID' } })
    expect(renameFolder(created, 'folder_missing1', 'Anything')).toMatchObject({ ok: false, error: { code: 'FOLDER_UNKNOWN' } })
    expect(moveAssetToFolder(created, ASSETS[0], 'folder_missing1', ASSETS)).toMatchObject({ ok: false, error: { code: 'FOLDER_UNKNOWN' } })
    expect(moveAssetToFolder(created, 'asset_zzzzzzzz', 'folder_brol0001', ASSETS)).toMatchObject({ ok: false, error: { code: 'ASSET_UNKNOWN' } })
    expect(deleteFolder(created, 'folder_missing1')).toMatchObject({ ok: false, error: { code: 'FOLDER_UNKNOWN' } })
  })

  it('refuses more folders than one project may hold', () => {
    let organization = EMPTY_MEDIA_ORGANIZATION
    for (let index = 0; index < MAX_MEDIA_FOLDERS; index += 1) {
      organization = unwrap(createFolder(organization, {
        folderId: `folder_${index.toString().padStart(8, '0')}`,
        name: `Folder ${index}`,
        createdAt: AT,
      }))
    }
    expect(organization.folders).toHaveLength(MAX_MEDIA_FOLDERS)
    expect(createFolder(organization, { folderId: 'folder_toomany1', name: 'One more', createdAt: AT }))
      .toMatchObject({ ok: false, error: { code: 'FOLDER_LIMIT_REACHED' } })
  })

  it('never mutates the organization it was given', () => {
    const created = withFolder()
    const before = JSON.stringify(created)
    unwrap(moveAssetToFolder(created, ASSETS[0], 'folder_brol0001', ASSETS))
    unwrap(renameFolder(created, 'folder_brol0001', 'Renamed'))
    unwrap(deleteFolder(created, 'folder_brol0001'))
    expect(JSON.stringify(created)).toBe(before)
  })

  describe('reading a stored document', () => {
    const stored = (over: Record<string, unknown> = {}) => ({
      schemaVersion: 'sanverse.media-organization/v1',
      folders: [{ folderId: 'folder_brol0001', name: 'B-roll', createdAt: AT }],
      assetFolderAssignments: { [ASSETS[0]]: 'folder_brol0001' },
      ...over,
    })

    it('reads a valid document', () => {
      const parsed = unwrap(parseMediaOrganization(stored(), ASSETS))
      expect(parsed.folders).toHaveLength(1)
      expect(parsed.assetFolderAssignments).toEqual({ [ASSETS[0]]: 'folder_brol0001' })
    })

    it('refuses corruption rather than quietly replacing it with an empty filing', () => {
      // Silently emptying a damaged file tells the user their filing vanished.
      const refusals: unknown[] = [
        null,
        'not an object',
        stored({ schemaVersion: 'sanverse.media-organization/v2' }),
        stored({ glow: true }),
        stored({ folders: 'not a list' }),
        stored({ folders: [{ folderId: 'nope', name: 'B-roll', createdAt: AT }] }),
        stored({ folders: [{ folderId: 'folder_brol0001', name: '', createdAt: AT }] }),
        stored({ folders: [{ folderId: 'folder_brol0001', name: 'B-roll', createdAt: 'whenever' }] }),
        stored({ folders: [{ folderId: 'folder_brol0001', name: 'B-roll', createdAt: AT, colour: 'red' }] }),
        stored({
          folders: [
            { folderId: 'folder_brol0001', name: 'B-roll', createdAt: AT },
            { folderId: 'folder_brol0002', name: 'b-roll ', createdAt: AT },
          ],
        }),
        stored({ assetFolderAssignments: { [ASSETS[0]]: 'folder_missing1' } }),
        stored({ assetFolderAssignments: { 'not-an-asset': 'folder_brol0001' } }),
      ]
      for (const candidate of refusals) {
        expect(parseMediaOrganization(candidate, ASSETS).ok).toBe(false)
      }
    })

    it('drops an assignment whose asset has left the project instead of refusing everything', () => {
      // Assets can legitimately be removed. Refusing the whole document over one
      // stale pointer would lock the user out of all their filing.
      const parsed = unwrap(parseMediaOrganization(
        stored({ assetFolderAssignments: { [ASSETS[0]]: 'folder_brol0001', asset_ggggggggg: 'folder_brol0001' } }),
        ASSETS,
      ))
      expect(parsed.assetFolderAssignments).toEqual({ [ASSETS[0]]: 'folder_brol0001' })
      expect(parsed.folders).toHaveLength(1)
    })

    it('survives a round trip through JSON unchanged', () => {
      const filed = unwrap(moveAssetToFolder(withFolder(), ASSETS[0], 'folder_brol0001', ASSETS))
      const reread = unwrap(parseMediaOrganization(JSON.parse(JSON.stringify(filed)), ASSETS))
      expect(reread).toEqual(filed)
    })
  })
})
