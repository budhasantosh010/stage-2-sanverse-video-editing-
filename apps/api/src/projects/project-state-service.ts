import {
  acceptChangeSet,
  createProject,
  redoChangeSet,
  serializeProject,
  setChangeSetActive,
  undoChangeSet,
  validateProject,
  type EditProject,
} from '@sanverse/edit-domain'
import { upgradeSavedProject } from '@sanverse/edit-domain/migrations/upgrade-project'

import type { MediaProbePort } from '../media/media-probe.ts'
import type { ProjectRepository } from './project-repository.ts'

export type ProjectStateErrorCode =
  | 'PROJECT_STATE_INVALID'
  | 'PROJECT_STATE_UNREADABLE'
  | 'MIGRATION_FAILED'
  | 'CHANGE_SET_REJECTED'
  | 'REVISION_CONFLICT'
  | 'NOTHING_TO_UNDO'
  | 'NOTHING_TO_REDO'
  | 'CHANGE_SET_UNKNOWN'

export class ProjectStateError extends Error {
  readonly code: ProjectStateErrorCode
  readonly detail: unknown

  constructor(code: ProjectStateErrorCode, message: string, detail?: unknown) {
    super(message)
    this.code = code
    this.detail = detail
    this.name = 'ProjectStateError'
  }
}

/** Stable IDs derived from the project ID, so a reload never invents new ones. */
const derivedIds = (projectId: string) => {
  const seed = projectId.replace(/^project_/, '').slice(0, 16).padEnd(16, '0')
  return {
    assetId: `asset_${seed.slice(0, 12)}`,
    compositionId: `composition_${seed.slice(0, 12)}`,
    trackId: `track_${seed.slice(0, 12)}`,
    clipId: `clip_${seed.slice(0, 12)}`,
  }
}

export function createProjectStateService(options: {
  readonly repository: ProjectRepository
  readonly mediaProbe: MediaProbePort
}) {
  const { repository, mediaProbe } = options

  const describeAsset = async (projectId: string) => {
    const manifest = await repository.readProject(projectId)
    const paths = await repository.resolveMediaPaths(projectId)
    const probe = await mediaProbe.probe({ path: paths.sourcePath, cwd: paths.trustedWorkDir })
    const ids = derivedIds(projectId)
    return {
      ids,
      asset: {
        schemaVersion: 'sanverse.asset/media/v1' as const,
        mediaKind: 'video' as const,
        assetId: ids.assetId,
        // Opaque to the domain. Only the storage adapter knows it means a file.
        storageRef: `project:${projectId}/source`,
        sha256: manifest.sha256,
        byteLength: manifest.sizeBytes,
        duration: probe.duration,
        width: probe.width,
        height: probe.height,
        frameRate: probe.frameRate,
        hasAudio: probe.hasAudio,
        durationResidualSeconds: probe.durationResidualSeconds,
      },
    }
  }

  const persist = async (projectId: string, project: EditProject): Promise<EditProject> => {
    const serialized = serializeProject(project)
    if (!serialized.ok) {
      throw new ProjectStateError('PROJECT_STATE_INVALID', 'The project could not be serialized.', serialized.error)
    }
    await repository.saveProjectState(projectId, serialized.value)
    return project
  }

  /**
   * Read the project, creating or migrating it if needed.
   *
   * Migration writes only after the migrated project has passed the same
   * validator that guards every ordinary read, so a migration can never leave
   * a file the app cannot open. If anything fails, the original file is
   * untouched and still opens in the previous version.
   */
  const load = async (projectId: string): Promise<EditProject> => {
    const serialized = await repository.readProjectState(projectId)

    if (serialized === null) {
      const { ids, asset } = await describeAsset(projectId)
      const created = createProject({ projectId, asset, ...ids })
      if (!created.ok) {
        throw new ProjectStateError('PROJECT_STATE_INVALID', 'A new project could not be created.', created.error)
      }
      return persist(projectId, created.value)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(serialized)
    } catch {
      throw new ProjectStateError('PROJECT_STATE_UNREADABLE', 'Saved project JSON is invalid.')
    }

    // One ladder handles every saved version, including "already current".
    // The service therefore never has to know which version is on disk, and a
    // future version cannot be forgotten at one of several call sites.
    const { ids, asset } = await describeAsset(projectId)
    const upgraded = upgradeSavedProject({ saved: parsed, asset, projectId, ...ids })
    if (!upgraded.ok) {
      const code = (upgraded.error as { code?: string }).code
      // A file that claims a version but does not hold that version's shape is
      // a corrupt file, not a failed upgrade, and saying so is the difference
      // between "your project is damaged" and "this app could not upgrade it".
      if (code === 'PROJECT_INVALID' || code === 'PROJECT_ID_MISMATCH' || code === 'V2_PROJECT_INVALID') {
        throw new ProjectStateError('PROJECT_STATE_INVALID', 'Saved project contract is invalid.', upgraded.error)
      }
      throw new ProjectStateError('MIGRATION_FAILED', 'This project could not be upgraded.', upgraded.error)
    }
    if (upgraded.value.project.projectId !== projectId) {
      throw new ProjectStateError('PROJECT_STATE_INVALID', 'Saved project contract is invalid.')
    }
    // An upgraded file is written back once, so the slower path runs only on
    // the first open after an update rather than on every load.
    if (upgraded.value.report.changed) return persist(projectId, upgraded.value.project)
    return upgraded.value.project
  }

  const failFromDomain = (error: { code?: string }): never => {
    if (error.code === 'REVISION_CONFLICT') {
      throw new ProjectStateError('REVISION_CONFLICT', 'The project changed while this edit was being prepared.', error)
    }
    if (error.code === 'NOTHING_TO_UNDO') throw new ProjectStateError('NOTHING_TO_UNDO', 'There is nothing to undo.')
    if (error.code === 'NOTHING_TO_REDO') throw new ProjectStateError('NOTHING_TO_REDO', 'There is nothing to redo.')
    if (error.code === 'CHANGE_SET_UNKNOWN') {
      throw new ProjectStateError('CHANGE_SET_UNKNOWN', 'That edit is not part of this project.')
    }
    throw new ProjectStateError('CHANGE_SET_REJECTED', 'This edit could not be applied.', error)
  }

  return {
    load,

    /**
     * The server, not the browser, decides whether an edit is allowed and what
     * the resulting revision is. A client cannot claim a revision it does not
     * have, and two clients racing cannot both win.
     */
    async accept(projectId: string, changeSet: unknown): Promise<EditProject> {
      const current = await load(projectId)
      const next = acceptChangeSet(current, changeSet)
      if (!next.ok) failFromDomain(next.error as { code?: string })
      return persist(projectId, (next as { ok: true; value: EditProject }).value)
    },

    async undo(projectId: string): Promise<EditProject> {
      const next = undoChangeSet(await load(projectId))
      if (!next.ok) failFromDomain(next.error as { code?: string })
      return persist(projectId, (next as { ok: true; value: EditProject }).value)
    },

    async redo(projectId: string): Promise<EditProject> {
      const next = redoChangeSet(await load(projectId))
      if (!next.ok) failFromDomain(next.error as { code?: string })
      return persist(projectId, (next as { ok: true; value: EditProject }).value)
    },

    async setActive(projectId: string, changeSetId: string, active: boolean): Promise<EditProject> {
      const next = setChangeSetActive(await load(projectId), changeSetId, active)
      if (!next.ok) failFromDomain(next.error as { code?: string })
      return persist(projectId, (next as { ok: true; value: EditProject }).value)
    },
  }
}

export type ProjectStateService = ReturnType<typeof createProjectStateService>
