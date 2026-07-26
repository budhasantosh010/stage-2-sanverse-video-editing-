import { describe, expect, it } from 'vitest'

import { ms, stubMediaProbe } from '../test-fixtures.ts'
import { createProjectStateService } from './project-state-service.ts'
import type { ProjectManifest, ProjectRepository } from './project-repository.ts'

const PROJECT_ID = 'project_1234567890abcdef'

const MANIFEST: ProjectManifest = {
  id: PROJECT_ID,
  originalFilename: 'owner.mp4',
  createdAt: '2026-07-14T00:00:00.000Z',
  sizeBytes: 24,
  sha256: 'a'.repeat(64),
  mediaUrl: `/api/projects/${PROJECT_ID}/media`,
}

function repository(initial: string | null = null) {
  const writes: string[] = []
  let serialized = initial
  const repo = {
    async readProject() { return MANIFEST },
    async readProjectState() { return serialized },
    async saveProjectState(_projectId: string, value: string) {
      writes.push(value)
      serialized = value
    },
    async resolveMediaPaths() { return { sourcePath: 'source.mp4', trustedWorkDir: 'work' } },
  } as unknown as ProjectRepository
  return { repo, writes, current: () => serialized }
}

const service = (initial: string | null = null, probe = stubMediaProbe()) => {
  const store = repository(initial)
  return { ...store, service: createProjectStateService({ repository: store.repo, mediaProbe: probe }) }
}

const v1State = (startMs: number) => JSON.stringify({
  schemaVersion: 'sanverse.project/v1',
  projectId: PROJECT_ID,
  history: {
    accepted: [{
      schemaVersion: 'sanverse.action/v1',
      actionId: 'action-1',
      kind: 'add-nameplate',
      target: { x: 0.2, y: 0.3, sourceTimeMs: 1_000 },
      primaryText: 'Santosh',
      secondaryText: '',
      startMs,
      durationMs: 1_000,
    }],
    redoStack: [],
    issuedActionIds: ['action-1'],
  },
})

describe('opening a project', () => {
  it('builds a project from the real media when nothing is saved yet', async () => {
    const { service: subject, current } = service(null)
    const project = await subject.load(PROJECT_ID)

    expect(project.schemaVersion).toBe('sanverse.project/v2')
    expect(project.revision).toBe(0)
    // The engine now knows how long the video is, which v1 never did.
    expect(project.assets[0].duration).toEqual(ms(8_000))
    expect(project.composition.width).toBe(1280)
    // The domain holds an opaque reference, never a filesystem path.
    expect(project.assets[0].storageRef).not.toContain('source.mp4')
    expect(JSON.parse(current() ?? '{}').schemaVersion).toBe('sanverse.project/v2')
  })

  it('produces the same IDs on every reload rather than inventing new ones', async () => {
    const first = await service(null).service.load(PROJECT_ID)
    const second = await service(null).service.load(PROJECT_ID)
    expect(second.composition).toEqual(first.composition)
    expect(second.assets[0].assetId).toBe(first.assets[0].assetId)
  })

  it('upgrades a v1 project and writes the upgrade exactly once', async () => {
    const { service: subject, writes } = service(v1State(1_000))
    const project = await subject.load(PROJECT_ID)

    expect(project.changeSets).toHaveLength(1)
    expect(project.changeSets[0].blockedReason).toBeNull()
    expect(writes).toHaveLength(1)

    // Reopening the upgraded project does not rewrite it.
    await subject.load(PROJECT_ID)
    expect(writes).toHaveLength(1)
  })

  it('carries a v1 edit that no longer fits across as blocked rather than dropping it', async () => {
    // 4,980,000 ms into an 8-second video. v1 accepted, previewed, and saved
    // this, then failed at export.
    const { service: subject } = service(v1State(4_980_000))
    const project = await subject.load(PROJECT_ID)

    expect(project.changeSets).toHaveLength(1)
    expect(project.changeSets[0].blockedReason).not.toBeNull()
  })

  it('refuses unreadable or foreign saved state instead of guessing', async () => {
    await expect(service('{not json').service.load(PROJECT_ID))
      .rejects.toMatchObject({ code: 'PROJECT_STATE_UNREADABLE' })

    const foreign = JSON.stringify({
      schemaVersion: 'sanverse.project/v2',
      projectId: 'project_ffffffffffffffff',
    })
    await expect(service(foreign).service.load(PROJECT_ID))
      .rejects.toMatchObject({ code: 'PROJECT_STATE_INVALID' })
  })

  it('does not write anything when a migration fails', async () => {
    const brokenProbe = stubMediaProbe({ width: 0 })
    const { service: subject, writes } = service(v1State(1_000), brokenProbe)

    await expect(subject.load(PROJECT_ID)).rejects.toThrow()
    expect(writes).toHaveLength(0)
  })
})

describe('editing a project', () => {
  const changeSet = (baseRevision: number, changeSetId = 'changeset_aaaaaaaa') => ({
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId,
    baseRevision,
    operations: [{
      schemaVersion: 'sanverse.operation/v2',
      operationId: `operation_${changeSetId.slice(-8)}`,
      kind: 'add-nameplate',
      capabilityId: 'sanverse.nameplate.component/v1',
      clipId: 'clip_1234567890ab',
      sampledClipTime: ms(1_000),
      compositionInterval: { start: ms(1_000), duration: ms(2_000) },
      target: { coordinateSpace: 'composition-normalized', point: { x: 0.2, y: 0.3 }, anchor: 'center' },
      primaryText: 'Santosh',
      secondaryText: '',
      extensions: {},
    }],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })

  it('advances the revision and persists the result', async () => {
    const { service: subject, current } = service(null)
    await subject.load(PROJECT_ID)

    const project = await subject.accept(PROJECT_ID, changeSet(0))
    expect(project.revision).toBe(1)
    expect(JSON.parse(current() ?? '{}').revision).toBe(1)
  })

  it('rejects an edit built against a revision the project has moved past', async () => {
    const { service: subject } = service(null)
    await subject.accept(PROJECT_ID, changeSet(0))

    await expect(subject.accept(PROJECT_ID, changeSet(0, 'changeset_bbbbbbbb')))
      .rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
  })

  it('rejects an edit that does not fit the video without saving anything', async () => {
    const { service: subject, writes } = service(null)
    await subject.load(PROJECT_ID)
    const writesBefore = writes.length

    const beyondEnd = {
      ...changeSet(0),
      operations: [{ ...changeSet(0).operations[0], compositionInterval: { start: ms(9_000), duration: ms(1_000) } }],
    }
    await expect(subject.accept(PROJECT_ID, beyondEnd)).rejects.toMatchObject({ code: 'CHANGE_SET_REJECTED' })
    expect(writes).toHaveLength(writesBefore)
  })

  it('reports nothing to undo instead of failing obscurely', async () => {
    const { service: subject } = service(null)
    await expect(subject.undo(PROJECT_ID)).rejects.toMatchObject({ code: 'NOTHING_TO_UNDO' })
    await expect(subject.redo(PROJECT_ID)).rejects.toMatchObject({ code: 'NOTHING_TO_REDO' })
  })

  it('switches one edit off without disturbing the others', async () => {
    const { service: subject } = service(null)
    await subject.accept(PROJECT_ID, changeSet(0))
    const project = await subject.accept(PROJECT_ID, {
      ...changeSet(1, 'changeset_bbbbbbbb'),
      operations: [{ ...changeSet(1, 'changeset_bbbbbbbb').operations[0], compositionInterval: { start: ms(4_000), duration: ms(2_000) } }],
    })
    expect(project.changeSets).toHaveLength(2)

    const updated = await subject.setActive(PROJECT_ID, 'changeset_aaaaaaaa', false)
    expect(updated.changeSets[0].active).toBe(false)
    expect(updated.changeSets[1].active).toBe(true)

    await expect(subject.setActive(PROJECT_ID, 'changeset_zzzzzzzz', false))
      .rejects.toMatchObject({ code: 'CHANGE_SET_UNKNOWN' })
  })
})
