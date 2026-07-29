import { createHash } from 'node:crypto'

import {
  COMPONENT_RECIPES,
  PROJECT_SCHEMA_VERSION,
  validateProject,
  type EditProject,
  type MediaAsset,
} from '@sanverse/edit-domain'

export type PortableProjectArchive = Readonly<{
  schemaVersion: 'sanverse.portable-project/v1'
  exportedAt: string
  project: EditProject
  media: readonly Readonly<{
    assetId: string
    mediaKind: MediaAsset['mediaKind']
    byteLength: number
    sha256: string
    portableRef: string
  }>[]
  compatibility: Readonly<{
    projectSchemaVersion: string
    componentVersions: readonly string[]
  }>
  integrity: Readonly<{ algorithm: 'sha256'; archiveSha256: string }>
}>

export class PortableProjectError extends Error {
  readonly code:
    | 'PORTABLE_ARCHIVE_INVALID'
    | 'PORTABLE_ARCHIVE_CORRUPT'
    | 'PORTABLE_MEDIA_MISSING'
    | 'PORTABLE_PROJECT_UNSUPPORTED'
  constructor(code: PortableProjectError['code'], message: string) {
    super(message)
    this.code = code
    this.name = 'PortableProjectError'
  }
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')
const canonicalPayload = (archive: Omit<PortableProjectArchive, 'integrity'>): string => JSON.stringify(archive)

export function buildPortableProjectArchive(project: EditProject, exportedAt = new Date().toISOString()): PortableProjectArchive {
  const payload = {
    schemaVersion: 'sanverse.portable-project/v1' as const,
    exportedAt,
    project,
    media: project.assets.map((asset) => Object.freeze({
      assetId: asset.assetId,
      mediaKind: asset.mediaKind,
      byteLength: asset.byteLength,
      sha256: asset.sha256,
      portableRef: `sha256:${asset.sha256}`,
    })),
    compatibility: Object.freeze({
      projectSchemaVersion: PROJECT_SCHEMA_VERSION,
      componentVersions: COMPONENT_RECIPES.map((recipe) =>
        `${recipe.recipeId}@${recipe.version}:${recipe.componentId}@${recipe.componentVersion}`,
      ),
    }),
  }
  return Object.freeze({
    ...payload,
    integrity: Object.freeze({ algorithm: 'sha256' as const, archiveSha256: sha256(canonicalPayload(payload)) }),
  })
}

export function validatePortableProjectArchive(value: unknown): PortableProjectArchive {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'The project archive is not valid.')
  }
  const archive = value as Record<string, unknown>
  const keys = Object.keys(archive).sort()
  if (
    JSON.stringify(keys) !== JSON.stringify(['compatibility', 'exportedAt', 'integrity', 'media', 'project', 'schemaVersion']) ||
    archive.schemaVersion !== 'sanverse.portable-project/v1' ||
    typeof archive.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(archive.exportedAt)) ||
    !Array.isArray(archive.media) ||
    typeof archive.compatibility !== 'object' ||
    archive.compatibility === null ||
    typeof archive.integrity !== 'object' ||
    archive.integrity === null
  ) {
    throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'The project archive is not valid.')
  }
  const parsedProject = validateProject(archive.project)
  if (!parsedProject.ok) {
    throw new PortableProjectError('PORTABLE_PROJECT_UNSUPPORTED', 'The project archive uses invalid or unsupported edit actions.')
  }
  const media = archive.media as Record<string, unknown>[]
  if (media.length !== parsedProject.value.assets.length || media.some((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return true
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(['assetId', 'byteLength', 'mediaKind', 'portableRef', 'sha256'])) return true
    const asset = parsedProject.value.assets.find((candidate) => candidate.assetId === entry.assetId)
    return !asset ||
      entry.mediaKind !== asset.mediaKind ||
      entry.byteLength !== asset.byteLength ||
      entry.sha256 !== asset.sha256 ||
      entry.portableRef !== `sha256:${asset.sha256}`
  })) {
    throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'The project archive media manifest is invalid.')
  }
  const integrity = archive.integrity as Record<string, unknown>
  if (integrity.algorithm !== 'sha256' || typeof integrity.archiveSha256 !== 'string') {
    throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'The project archive integrity record is invalid.')
  }
  const { integrity: _integrity, ...payload } = archive
  if (sha256(canonicalPayload(payload as Omit<PortableProjectArchive, 'integrity'>)) !== integrity.archiveSha256) {
    throw new PortableProjectError('PORTABLE_ARCHIVE_CORRUPT', 'The project archive failed its integrity check.')
  }
  return value as PortableProjectArchive
}

function rewriteAssetReferences(value: unknown, assetIds: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteAssetReferences(item, assetIds))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (key === 'assetId' && typeof child === 'string') return [key, assetIds.get(child) ?? child]
    return [key, rewriteAssetReferences(child, assetIds)]
  }))
}

export function restorePortableProject(
  archiveValue: unknown,
  target: EditProject,
): EditProject {
  const archive = validatePortableProjectArchive(archiveValue)
  const usedTargets = new Set<string>()
  const mapping = new Map<string, string>()
  for (const archivedAsset of archive.project.assets) {
    const match = target.assets.find((candidate) =>
      !usedTargets.has(candidate.assetId) &&
      candidate.sha256 === archivedAsset.sha256 &&
      candidate.byteLength === archivedAsset.byteLength &&
      candidate.mediaKind === archivedAsset.mediaKind,
    )
    if (!match) throw new PortableProjectError('PORTABLE_MEDIA_MISSING', 'Import the matching source media before restoring this project archive.')
    usedTargets.add(match.assetId)
    mapping.set(archivedAsset.assetId, match.assetId)
  }
  const rewritten = rewriteAssetReferences(archive.project, mapping) as EditProject
  const candidate = {
    ...rewritten,
    projectId: target.projectId,
    assets: archive.project.assets.map((asset) => {
      const targetId = mapping.get(asset.assetId)
      return target.assets.find((candidateAsset) => candidateAsset.assetId === targetId)
    }),
  }
  const validated = validateProject(candidate)
  if (!validated.ok) {
    throw new PortableProjectError('PORTABLE_PROJECT_UNSUPPORTED', 'The project archive could not be restored against this media set.')
  }
  return validated.value
}
