/**
 * How the user has filed their own media. NOT part of the project.
 *
 * Putting a file into a folder changes not one pixel and not one millisecond of
 * the exported video, so it is not a decision about the video and it does not
 * belong in `EditProject`. It lives beside the project as a sidecar, exactly as
 * a transcript does (ADR-006), for three reasons spelled out in
 * `DOCS/decisions/ADR-MEDIA-ORGANIZATION-V1.md`:
 *
 *   1. Undo must walk back through editing decisions, not through folder names.
 *   2. The export key is sha256(projectId : revision : renderPlanVersion), so a
 *      folder rename bumping the revision would re-render an identical video.
 *   3. Data the render compiler must ignore should not be in its input.
 *
 * These rules live in the domain, with no I/O and no framework, so the server
 * that writes the file and the browser that shows it cannot disagree about what
 * is legal.
 */

import { err, ok, type Result } from './result.ts'

export const MEDIA_ORGANIZATION_SCHEMA_VERSION = 'sanverse.media-organization/v1'

export const MEDIA_FOLDER_ID_PATTERN = /^folder_[a-z0-9]{8,64}$/
export const ASSET_ID_PATTERN = /^asset_[a-z0-9]{8,64}$/

export const MAX_MEDIA_FOLDERS = 32
export const MAX_MEDIA_FOLDER_NAME_LENGTH = 64

export type MediaFolderV1 = Readonly<{
  folderId: string
  name: string
  createdAt: string
}>

export type MediaOrganizationV1 = Readonly<{
  schemaVersion: typeof MEDIA_ORGANIZATION_SCHEMA_VERSION
  folders: readonly MediaFolderV1[]
  /**
   * assetId -> folderId. An asset with no entry is at the root.
   *
   * The root is deliberately implicit: "move back to the root" is removing one
   * key, rather than a second concept that could disagree with this one.
   */
  assetFolderAssignments: Readonly<Record<string, string>>
}>

export type MediaOrganizationErrorCode =
  | 'ORGANIZATION_INVALID'
  | 'FOLDER_UNKNOWN'
  | 'FOLDER_NAME_INVALID'
  | 'FOLDER_NAME_DUPLICATE'
  | 'FOLDER_LIMIT_REACHED'
  | 'ASSET_UNKNOWN'

export type MediaOrganizationError = Readonly<{
  code: MediaOrganizationErrorCode
  /** Plain enough to show a non-technical user without translation. */
  message: string
}>

const fail = (code: MediaOrganizationErrorCode, message: string): MediaOrganizationError =>
  Object.freeze({ code, message })

/** An absent file is not an error. It is every asset at the root. */
export const EMPTY_MEDIA_ORGANIZATION: MediaOrganizationV1 = Object.freeze({
  schemaVersion: MEDIA_ORGANIZATION_SCHEMA_VERSION,
  folders: Object.freeze([]),
  assetFolderAssignments: Object.freeze({}),
})

const ORGANIZATION_KEYS = ['schemaVersion', 'folders', 'assetFolderAssignments'] as const
const FOLDER_KEYS = ['folderId', 'name', 'createdAt'] as const

const hasOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key))

/** Trimmed and case-folded, so "B-roll" and "b-roll " cannot both exist. */
export const normalizeFolderName = (name: string): string => name.trim().toLocaleLowerCase()

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

/**
 * Read an organisation document, refusing anything it does not fully understand.
 *
 * `knownAssetIds` lets loading drop assignments whose asset has left the
 * project. That single softening is deliberate: assets can legitimately be
 * removed, a pointer to a removed one is not corruption, and refusing the whole
 * document would lock the user out of all their filing because of one gone file.
 * Everything else is refused rather than repaired, because silently replacing a
 * damaged file with an empty one tells the user their filing "just vanished".
 */
export const parseMediaOrganization = (
  input: unknown,
  knownAssetIds?: readonly string[],
): Result<MediaOrganizationV1, MediaOrganizationError> => {
  if (!isPlainObject(input)) {
    return err(fail('ORGANIZATION_INVALID', 'The media organization file is not readable.'))
  }
  if (!hasOnlyKeys(input, ORGANIZATION_KEYS)) {
    return err(fail('ORGANIZATION_INVALID', 'The media organization file contains something this version does not understand.'))
  }
  if (input.schemaVersion !== MEDIA_ORGANIZATION_SCHEMA_VERSION) {
    return err(fail('ORGANIZATION_INVALID', 'The media organization file was written by a different version.'))
  }
  if (!Array.isArray(input.folders) || input.folders.length > MAX_MEDIA_FOLDERS) {
    return err(fail('ORGANIZATION_INVALID', 'The media organization file has an unreadable folder list.'))
  }

  const folders: MediaFolderV1[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  for (const candidate of input.folders) {
    if (!isPlainObject(candidate) || !hasOnlyKeys(candidate, FOLDER_KEYS)) {
      return err(fail('ORGANIZATION_INVALID', 'A folder in the media organization file is unreadable.'))
    }
    const { folderId, name, createdAt } = candidate
    if (
      typeof folderId !== 'string' || !MEDIA_FOLDER_ID_PATTERN.test(folderId) ||
      typeof name !== 'string' || !isIsoTimestamp(createdAt)
    ) {
      return err(fail('ORGANIZATION_INVALID', 'A folder in the media organization file is unreadable.'))
    }
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed.length > MAX_MEDIA_FOLDER_NAME_LENGTH) {
      return err(fail('ORGANIZATION_INVALID', 'A folder name in the media organization file is not usable.'))
    }
    if (seenIds.has(folderId)) {
      return err(fail('ORGANIZATION_INVALID', 'The media organization file names the same folder twice.'))
    }
    const normalized = normalizeFolderName(trimmed)
    if (seenNames.has(normalized)) {
      return err(fail('ORGANIZATION_INVALID', 'The media organization file has two folders with the same name.'))
    }
    seenIds.add(folderId)
    seenNames.add(normalized)
    folders.push(Object.freeze({ folderId, name: trimmed, createdAt }))
  }

  if (!isPlainObject(input.assetFolderAssignments)) {
    return err(fail('ORGANIZATION_INVALID', 'The media organization file has unreadable folder assignments.'))
  }
  const assignments: Record<string, string> = {}
  for (const [assetId, folderId] of Object.entries(input.assetFolderAssignments)) {
    if (!ASSET_ID_PATTERN.test(assetId) || typeof folderId !== 'string') {
      return err(fail('ORGANIZATION_INVALID', 'The media organization file has unreadable folder assignments.'))
    }
    if (!seenIds.has(folderId)) {
      return err(fail('ORGANIZATION_INVALID', 'The media organization file files something into a folder that does not exist.'))
    }
    // The one deliberate softening — see the doc comment above.
    if (knownAssetIds && !knownAssetIds.includes(assetId)) continue
    assignments[assetId] = folderId
  }

  return ok(Object.freeze({
    schemaVersion: MEDIA_ORGANIZATION_SCHEMA_VERSION,
    folders: Object.freeze(folders),
    assetFolderAssignments: Object.freeze(assignments),
  }))
}

const validateNewName = (
  organization: MediaOrganizationV1,
  name: string,
  exceptFolderId?: string,
): MediaOrganizationError | null => {
  const trimmed = name.trim()
  if (trimmed.length === 0) return fail('FOLDER_NAME_INVALID', 'Give the folder a name.')
  if (trimmed.length > MAX_MEDIA_FOLDER_NAME_LENGTH) {
    return fail('FOLDER_NAME_INVALID', `Keep the folder name to ${MAX_MEDIA_FOLDER_NAME_LENGTH} characters or fewer.`)
  }
  const normalized = normalizeFolderName(trimmed)
  const clash = organization.folders.some(
    (folder) => folder.folderId !== exceptFolderId && normalizeFolderName(folder.name) === normalized,
  )
  if (clash) return fail('FOLDER_NAME_DUPLICATE', 'A folder with that name already exists.')
  return null
}

export const createFolder = (
  organization: MediaOrganizationV1,
  input: Readonly<{ folderId: string; name: string; createdAt: string }>,
): Result<MediaOrganizationV1, MediaOrganizationError> => {
  if (!MEDIA_FOLDER_ID_PATTERN.test(input.folderId)) {
    return err(fail('ORGANIZATION_INVALID', 'The folder identifier is not valid.'))
  }
  if (organization.folders.length >= MAX_MEDIA_FOLDERS) {
    return err(fail('FOLDER_LIMIT_REACHED', `A project can hold ${MAX_MEDIA_FOLDERS} folders.`))
  }
  if (organization.folders.some((folder) => folder.folderId === input.folderId)) {
    return err(fail('ORGANIZATION_INVALID', 'That folder identifier is already in use.'))
  }
  const invalid = validateNewName(organization, input.name)
  if (invalid) return err(invalid)
  return ok(Object.freeze({
    ...organization,
    folders: Object.freeze([
      ...organization.folders,
      Object.freeze({ folderId: input.folderId, name: input.name.trim(), createdAt: input.createdAt }),
    ]),
  }))
}

export const renameFolder = (
  organization: MediaOrganizationV1,
  folderId: string,
  name: string,
): Result<MediaOrganizationV1, MediaOrganizationError> => {
  if (!organization.folders.some((folder) => folder.folderId === folderId)) {
    return err(fail('FOLDER_UNKNOWN', 'That folder no longer exists.'))
  }
  const invalid = validateNewName(organization, name, folderId)
  if (invalid) return err(invalid)
  // Identity never changes, so every assignment keeps pointing at this folder.
  return ok(Object.freeze({
    ...organization,
    folders: Object.freeze(organization.folders.map((folder) =>
      folder.folderId === folderId ? Object.freeze({ ...folder, name: name.trim() }) : folder,
    )),
  }))
}

export const moveAssetToFolder = (
  organization: MediaOrganizationV1,
  assetId: string,
  folderId: string,
  knownAssetIds: readonly string[],
): Result<MediaOrganizationV1, MediaOrganizationError> => {
  if (!knownAssetIds.includes(assetId)) {
    return err(fail('ASSET_UNKNOWN', 'That media is not part of this project.'))
  }
  if (!organization.folders.some((folder) => folder.folderId === folderId)) {
    return err(fail('FOLDER_UNKNOWN', 'That folder no longer exists.'))
  }
  return ok(Object.freeze({
    ...organization,
    assetFolderAssignments: Object.freeze({ ...organization.assetFolderAssignments, [assetId]: folderId }),
  }))
}

export const moveAssetToRoot = (
  organization: MediaOrganizationV1,
  assetId: string,
  knownAssetIds: readonly string[],
): Result<MediaOrganizationV1, MediaOrganizationError> => {
  if (!knownAssetIds.includes(assetId)) {
    return err(fail('ASSET_UNKNOWN', 'That media is not part of this project.'))
  }
  const { [assetId]: _removed, ...rest } = organization.assetFolderAssignments
  return ok(Object.freeze({ ...organization, assetFolderAssignments: Object.freeze(rest) }))
}

/**
 * Remove a folder. Its media returns to the root.
 *
 * A folder is a LABEL, not a container. Deleting a label must never be able to
 * delete the user's material, so nothing is removed but the label itself.
 */
export const deleteFolder = (
  organization: MediaOrganizationV1,
  folderId: string,
): Result<MediaOrganizationV1, MediaOrganizationError> => {
  if (!organization.folders.some((folder) => folder.folderId === folderId)) {
    return err(fail('FOLDER_UNKNOWN', 'That folder no longer exists.'))
  }
  const assignments: Record<string, string> = {}
  for (const [assetId, assigned] of Object.entries(organization.assetFolderAssignments)) {
    if (assigned !== folderId) assignments[assetId] = assigned
  }
  return ok(Object.freeze({
    schemaVersion: organization.schemaVersion,
    folders: Object.freeze(organization.folders.filter((folder) => folder.folderId !== folderId)),
    assetFolderAssignments: Object.freeze(assignments),
  }))
}

/** Which folder an asset is in, or null for the root. */
export const folderOfAsset = (organization: MediaOrganizationV1, assetId: string): string | null =>
  organization.assetFolderAssignments[assetId] ?? null

/** How many assets are filed in each folder, plus how many are at the root. */
export const folderCounts = (
  organization: MediaOrganizationV1,
  assetIds: readonly string[],
): Readonly<{ root: number; byFolder: Readonly<Record<string, number>> }> => {
  const byFolder: Record<string, number> = {}
  for (const folder of organization.folders) byFolder[folder.folderId] = 0
  let root = 0
  for (const assetId of assetIds) {
    const folderId = organization.assetFolderAssignments[assetId]
    if (folderId === undefined || byFolder[folderId] === undefined) root += 1
    else byFolder[folderId] += 1
  }
  return Object.freeze({ root, byFolder: Object.freeze(byFolder) })
}
