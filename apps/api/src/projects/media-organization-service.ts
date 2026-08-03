import { randomBytes } from 'node:crypto'

import {
  createFolder,
  deleteFolder,
  EMPTY_MEDIA_ORGANIZATION,
  moveAssetToFolder,
  moveAssetToRoot,
  parseMediaOrganization,
  renameFolder,
  type MediaOrganizationError,
  type MediaOrganizationV1,
} from '@sanverse/edit-domain/media-organization'
import type { EditProject } from '@sanverse/edit-domain'

import type { ProjectRepository } from './project-repository.ts'

/**
 * Run one validated organization command and store the result.
 *
 * Every command goes through the same domain rules the browser uses, so a
 * hand-made HTTP request cannot create a state the UI could not. Nothing here
 * touches `EditProject`: no operation, no change set, no revision, no undo
 * entry, and nothing that can reach the render compiler.
 * See DOCS/decisions/ADR-MEDIA-ORGANIZATION-V1.md.
 */

export type MediaOrganizationCommand =
  | { readonly kind: 'create-folder'; readonly name: string }
  | { readonly kind: 'rename-folder'; readonly folderId: string; readonly name: string }
  | { readonly kind: 'move-asset-to-folder'; readonly assetId: string; readonly folderId: string }
  | { readonly kind: 'move-asset-to-root'; readonly assetId: string }
  | { readonly kind: 'delete-folder'; readonly folderId: string }

const COMMAND_KINDS = [
  'create-folder',
  'rename-folder',
  'move-asset-to-folder',
  'move-asset-to-root',
  'delete-folder',
] as const

export class MediaOrganizationServiceError extends Error {
  readonly code: MediaOrganizationError['code']

  constructor(error: MediaOrganizationError) {
    super(error.message)
    this.name = 'MediaOrganizationServiceError'
    this.code = error.code
  }
}

const invalid = (message: string): MediaOrganizationServiceError =>
  new MediaOrganizationServiceError({ code: 'ORGANIZATION_INVALID', message })

/** Closed key set: an unrecognised command shape is refused, never coerced. */
export function parseCommand(payload: unknown): MediaOrganizationCommand {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw invalid('A media organization command is required.')
  }
  const value = payload as Record<string, unknown>
  const kind = value.kind
  if (typeof kind !== 'string' || !(COMMAND_KINDS as readonly string[]).includes(kind)) {
    throw invalid('That media organization command is not recognised.')
  }
  const text = (key: string): string => {
    const candidate = value[key]
    if (typeof candidate !== 'string') throw invalid(`The command is missing ${key}.`)
    return candidate
  }
  switch (kind) {
    case 'create-folder':
      return { kind, name: text('name') }
    case 'rename-folder':
      return { kind, folderId: text('folderId'), name: text('name') }
    case 'move-asset-to-folder':
      return { kind, assetId: text('assetId'), folderId: text('folderId') }
    case 'move-asset-to-root':
      return { kind, assetId: text('assetId') }
    default:
      return { kind: 'delete-folder', folderId: text('folderId') }
  }
}

export function createMediaOrganizationService({
  repository,
  loadProject,
  createFolderId = () => `folder_${randomBytes(8).toString('hex')}`,
  now = () => new Date(),
}: {
  repository: Pick<ProjectRepository, 'readMediaOrganization' | 'saveMediaOrganization'>
  loadProject: (projectId: string) => Promise<EditProject>
  createFolderId?: () => string
  now?: () => Date
}) {
  const read = async (projectId: string, knownAssetIds: readonly string[]): Promise<MediaOrganizationV1> => {
    const stored = await repository.readMediaOrganization(projectId)
    // Absent is not an error. It means every asset is at the root, which is
    // exactly right for a project that has never had a folder.
    if (stored === null) return EMPTY_MEDIA_ORGANIZATION
    let parsed: unknown
    try {
      parsed = JSON.parse(stored)
    } catch {
      throw invalid('The saved media organization could not be read.')
    }
    const result = parseMediaOrganization(parsed, knownAssetIds)
    // Corruption is refused, not silently replaced with an empty filing: the
    // bytes stay on disk so the user's folders can still be recovered.
    if (!result.ok) throw new MediaOrganizationServiceError(result.error)
    return result.value
  }

  return {
    async load(projectId: string): Promise<MediaOrganizationV1> {
      const project = await loadProject(projectId)
      return read(projectId, project.assets.map((asset) => asset.assetId))
    },

    async apply(projectId: string, command: MediaOrganizationCommand): Promise<MediaOrganizationV1> {
      const project = await loadProject(projectId)
      const assetIds = project.assets.map((asset) => asset.assetId)
      const current = await read(projectId, assetIds)

      const result = (() => {
        switch (command.kind) {
          case 'create-folder':
            return createFolder(current, {
              folderId: createFolderId(),
              name: command.name,
              createdAt: now().toISOString(),
            })
          case 'rename-folder':
            return renameFolder(current, command.folderId, command.name)
          case 'move-asset-to-folder':
            return moveAssetToFolder(current, command.assetId, command.folderId, assetIds)
          case 'move-asset-to-root':
            return moveAssetToRoot(current, command.assetId, assetIds)
          default:
            return deleteFolder(current, command.folderId)
        }
      })()

      if (!result.ok) throw new MediaOrganizationServiceError(result.error)
      await repository.saveMediaOrganization(projectId, `${JSON.stringify(result.value)}\n`)
      return result.value
    },
  }
}

export type MediaOrganizationService = ReturnType<typeof createMediaOrganizationService>
