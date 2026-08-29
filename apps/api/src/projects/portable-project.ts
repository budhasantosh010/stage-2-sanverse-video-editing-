import { createHash } from 'node:crypto'

import {
  canonicalCreativeArtifactJsonV1,
  validateCreativeSceneArtifactV1,
  type CreativeSceneArtifactV1,
} from '@sanverse/render-contract/creative-scene-artifact'
import {
  COMPONENT_RECIPES,
  PROJECT_SCHEMA_VERSION,
  validateProject,
  type EditProject,
  type MediaAsset,
} from '@sanverse/edit-domain'

export type PortableCreativeArtifactV1 = Readonly<{
  artifactId: string
  sha256: string
  serialized: string
}>

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
  /** Immutable render authority referenced by add-creative-scene operations. */
  creativeArtifacts?: readonly PortableCreativeArtifactV1[]
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

const creativeArtifactRefs = (project: EditProject): ReadonlyMap<string, string> => {
  const refs = new Map<string, string>()
  const add = (operation: unknown): void => {
    if (typeof operation !== 'object' || operation === null || Array.isArray(operation)) return
    const candidate = operation as Record<string, unknown>
    if (candidate.kind !== 'add-creative-scene') return
    if (typeof candidate.artifactId !== 'string' || typeof candidate.artifactSha256 !== 'string') return
    const previous = refs.get(candidate.artifactId)
    if (previous !== undefined && previous !== candidate.artifactSha256) {
      throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'One Creative artifact ID is referenced with conflicting hashes.')
    }
    refs.set(candidate.artifactId, candidate.artifactSha256)
  }
  for (const record of project.changeSets) for (const operation of record.changeSet.operations) add(operation)
  for (const changeSet of project.redoStack) for (const operation of changeSet.operations) add(operation)
  return refs
}

const validatePortableCreativeArtifacts = (
  project: EditProject,
  records: readonly PortableCreativeArtifactV1[],
): readonly PortableCreativeArtifactV1[] => {
  const required = creativeArtifactRefs(project)
  const seen = new Set<string>()
  const normalized = records.map((record) => {
    if (!/^creativeart_[a-f0-9]{64}$/u.test(record.artifactId) || !/^[a-f0-9]{64}$/u.test(record.sha256) || record.artifactId !== `creativeart_${record.sha256}` || sha256(record.serialized) !== record.sha256) {
      throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'A Creative artifact record has an invalid content identity.')
    }
    if (seen.has(record.artifactId)) throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'A Creative artifact record is duplicated.')
    seen.add(record.artifactId)
    let parsed: unknown
    try { parsed = JSON.parse(record.serialized) as unknown } catch { throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'A Creative artifact record is not valid JSON.') }
    const validated = validateCreativeSceneArtifactV1(parsed)
    if (!validated.ok || validated.value.projectId !== project.projectId || !project.assets.some((asset) => asset.assetId === validated.value.source.assetId) || canonicalCreativeArtifactJsonV1(validated.value) !== record.serialized) {
      throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'A Creative artifact record is not canonical for this project.')
    }
    if (required.get(record.artifactId) !== record.sha256) throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'A Creative artifact is not referenced by the archived project with the same exact hash.')
    return Object.freeze({ artifactId: record.artifactId, sha256: record.sha256, serialized: record.serialized })
  }).sort((a, b) => a.artifactId.localeCompare(b.artifactId))
  if (required.size !== normalized.length || [...required.keys()].some((artifactId) => !seen.has(artifactId))) {
    throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'The project archive is missing one or more Creative artifacts referenced by project history.')
  }
  return Object.freeze(normalized)
}

export function buildPortableProjectArchive(
  project: EditProject,
  exportedAt = new Date().toISOString(),
  creativeArtifacts: readonly PortableCreativeArtifactV1[] = Object.freeze([]),
): PortableProjectArchive {
  const required = creativeArtifactRefs(project)
  const normalizedArtifacts = validatePortableCreativeArtifacts(project, creativeArtifacts.filter((record) => required.has(record.artifactId)))
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
    ...(normalizedArtifacts.length > 0 ? { creativeArtifacts: normalizedArtifacts } : {}),
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
  const allowedKeys = archive.creativeArtifacts === undefined
    ? ['compatibility', 'exportedAt', 'integrity', 'media', 'project', 'schemaVersion']
    : ['compatibility', 'creativeArtifacts', 'exportedAt', 'integrity', 'media', 'project', 'schemaVersion']
  if (
    JSON.stringify(keys) !== JSON.stringify(allowedKeys) ||
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
  if (archive.creativeArtifacts !== undefined) {
    if (!Array.isArray(archive.creativeArtifacts)) throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'The project archive Creative artifact manifest is invalid.')
    validatePortableCreativeArtifacts(parsedProject.value, archive.creativeArtifacts as PortableCreativeArtifactV1[])
  } else if (creativeArtifactRefs(parsedProject.value).size > 0) {
    throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'The project archive is missing Creative artifacts referenced by project history.')
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

function rewritePortableReferences(
  value: unknown,
  assetIds: ReadonlyMap<string, string>,
  artifactIds: ReadonlyMap<string, string>,
  artifactHashes: ReadonlyMap<string, string>,
): unknown {
  if (Array.isArray(value)) return value.map((item) => rewritePortableReferences(item, assetIds, artifactIds, artifactHashes))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (key === 'assetId' && typeof child === 'string') return [key, assetIds.get(child) ?? child]
    if (key === 'artifactId' && typeof child === 'string') return [key, artifactIds.get(child) ?? child]
    if (key === 'artifactSha256' && typeof child === 'string') return [key, artifactHashes.get(child) ?? child]
    return [key, rewritePortableReferences(child, assetIds, artifactIds, artifactHashes)]
  }))
}

export type RestoredPortableProjectV1 = Readonly<{
  project: EditProject
  creativeArtifacts: readonly PortableCreativeArtifactV1[]
}>

export function restorePortableProjectBundle(
  archiveValue: unknown,
  target: EditProject,
): RestoredPortableProjectV1 {
  const archive = validatePortableProjectArchive(archiveValue)
  const usedTargets = new Set<string>()
  const assetMapping = new Map<string, string>()
  for (const archivedAsset of archive.project.assets) {
    const match = target.assets.find((candidate) =>
      !usedTargets.has(candidate.assetId) &&
      candidate.sha256 === archivedAsset.sha256 &&
      candidate.byteLength === archivedAsset.byteLength &&
      candidate.mediaKind === archivedAsset.mediaKind,
    )
    if (!match) throw new PortableProjectError('PORTABLE_MEDIA_MISSING', 'Import the matching source media before restoring this project archive.')
    usedTargets.add(match.assetId)
    assetMapping.set(archivedAsset.assetId, match.assetId)
  }

  const artifactIdMapping = new Map<string, string>()
  const artifactHashMapping = new Map<string, string>()
  const rewrittenArtifacts: PortableCreativeArtifactV1[] = []
  for (const record of archive.creativeArtifacts ?? []) {
    const validated = validateCreativeSceneArtifactV1(JSON.parse(record.serialized) as unknown)
    if (!validated.ok) throw new PortableProjectError('PORTABLE_ARCHIVE_INVALID', 'The project archive contains an invalid Creative artifact.')
    const targetAssetId = assetMapping.get(validated.value.source.assetId)
    if (!targetAssetId) throw new PortableProjectError('PORTABLE_MEDIA_MISSING', 'A Creative artifact source file is missing from the restore target.')
    const rewrittenArtifact = Object.freeze({
      ...validated.value,
      projectId: target.projectId,
      source: Object.freeze({ ...validated.value.source, assetId: targetAssetId }),
    }) as CreativeSceneArtifactV1
    const revalidated = validateCreativeSceneArtifactV1(rewrittenArtifact)
    if (!revalidated.ok) throw new PortableProjectError('PORTABLE_PROJECT_UNSUPPORTED', 'A Creative artifact could not be rebound to the restored project.')
    const serialized = canonicalCreativeArtifactJsonV1(revalidated.value)
    const digest = sha256(serialized)
    const artifactId = `creativeart_${digest}`
    artifactIdMapping.set(record.artifactId, artifactId)
    artifactHashMapping.set(record.sha256, digest)
    rewrittenArtifacts.push(Object.freeze({ artifactId, sha256: digest, serialized }))
  }

  const rewritten = rewritePortableReferences(archive.project, assetMapping, artifactIdMapping, artifactHashMapping) as EditProject
  const candidate = {
    ...rewritten,
    projectId: target.projectId,
    assets: archive.project.assets.map((asset) => {
      const targetId = assetMapping.get(asset.assetId)
      return target.assets.find((candidateAsset) => candidateAsset.assetId === targetId)
    }),
  }
  const validated = validateProject(candidate)
  if (!validated.ok) {
    throw new PortableProjectError('PORTABLE_PROJECT_UNSUPPORTED', 'The project archive could not be restored against this media set.')
  }
  return Object.freeze({ project: validated.value, creativeArtifacts: Object.freeze(rewrittenArtifacts.sort((a, b) => a.artifactId.localeCompare(b.artifactId))) })
}

export function restorePortableProject(
  archiveValue: unknown,
  target: EditProject,
): EditProject {
  return restorePortableProjectBundle(archiveValue, target).project
}
