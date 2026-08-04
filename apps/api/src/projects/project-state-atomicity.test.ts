import { describe, expect, it } from 'vitest'

import { stubMediaProbe } from '../test-fixtures.ts'
import { createProjectStateService, ProjectStateError } from './project-state-service.ts'
import type { ProjectManifest, ProjectRepository } from './project-repository.ts'

/**
 * Gate C0.5 — the server writes the whole edit or none of it.
 *
 * The disk is the thing a user actually keeps. A refused compound edit that
 * left half of itself in the file would survive a restart, and no Undo would
 * remove it, because the project never recorded it as something that happened.
 */

const PROJECT_ID = 'project_1234567890abcdef'
const ASSET_ID = 'asset_1234567890ab'
const CLIP_ID = 'clip_1234567890ab'

const MANIFEST: ProjectManifest = {
  id: PROJECT_ID,
  originalFilename: 'owner.mp4',
  createdAt: '2026-07-14T00:00:00.000Z',
  sizeBytes: 24,
  sha256: 'a'.repeat(64),
  mediaUrl: `/api/projects/${PROJECT_ID}/media`,
}

/** @param failWrite when true, every save throws — the disk-full case. */
const service = (failWrite = false) => {
  const writes: string[] = []
  let stored: string | null = null
  const repo = {
    async readProject() { return MANIFEST },
    async readProjectState() { return stored },
    async saveProjectState(_projectId: string, value: string) {
      if (failWrite) throw new Error('disk is full')
      writes.push(value)
      stored = value
    },
    async resolveMediaPaths() { return { sourcePath: 'source.mp4', trustedWorkDir: 'work' } },
  } as unknown as ProjectRepository
  return {
    writes,
    /** What a restart would read back. */
    onDisk: () => (stored === null ? null : JSON.parse(stored) as { revision: number; changeSets: unknown[] }),
    subject: createProjectStateService({ repository: repo, mediaProbe: stubMediaProbe() }),
  }
}

const TICKS_PER_SECOND = 1_440_000
const time = (seconds: number) => ({ ticks: seconds * TICKS_PER_SECOND, timescale: TICKS_PER_SECOND })

const trim = (operationId: string, seconds: number) => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'trim-clip',
  capabilityId: 'sanverse.timeline.trim.primitive/v1',
  clipId: CLIP_ID,
  trimStart: time(seconds),
  trimEnd: time(0),
  ripple: true,
  extensions: {},
})

const titleOnMissingAsset = (operationId: string) => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'add-title',
  capabilityId: 'sanverse.title.component/v1',
  titleId: 'title_0001',
  assetId: 'asset_zzzzzzzzzz',
  sourceInterval: { start: time(0), duration: time(1) },
  headline: 'This cannot land',
  subhead: '',
  placement: 'center',
  styleId: 'sanverse.title.boxed/v1',
  extensions: {},
})

/**
 * A title on source seconds 3-4. Deliberately clear of the 1-second cut used
 * beside it: a change set whose own cut removes the footage its own title sits
 * on is self-contradictory, and the evaluator refuses it on purpose.
 */
const validTitle = (operationId: string) => ({
  ...titleOnMissingAsset(operationId),
  assetId: ASSET_ID,
  sourceInterval: { start: time(3), duration: time(1) },
  headline: 'This one can',
})

const changeSet = (changeSetId: string, baseRevision: number, operations: readonly unknown[]) => ({
  schemaVersion: 'sanverse.change-set/v1',
  changeSetId,
  baseRevision,
  operations,
  provenance: { source: 'direct', requestId: null },
  extensions: {},
})

const rejected = async (run: () => Promise<unknown>): Promise<ProjectStateError> => {
  try {
    await run()
  } catch (error) {
    if (error instanceof ProjectStateError) return error
    throw error
  }
  throw new Error('expected the edit to be refused')
}

describe('the server applies a compound edit whole or not at all', () => {
  it('writes nothing when the second operation of a mixed edit refuses', async () => {
    const { subject, writes, onDisk } = service()
    const opened = await subject.load(PROJECT_ID)
    const writesAfterOpen = writes.length
    const revisionAfterOpen = opened.revision

    const error = await rejected(() => subject.accept(
      PROJECT_ID,
      changeSet('changeset_mixed001', revisionAfterOpen, [
        trim('operation_cut000001', 1),
        titleOnMissingAsset('operation_title0001'),
      ]),
    ))

    expect(error.code).toBe('CHANGE_SET_REJECTED')
    expect(writes).toHaveLength(writesAfterOpen)
    expect(onDisk()?.revision).toBe(revisionAfterOpen)
    expect(onDisk()?.changeSets).toHaveLength(0)
  })

  it('says which operation refused, so the message can name the thing that failed', async () => {
    const { subject } = service()
    const opened = await subject.load(PROJECT_ID)

    const error = await rejected(() => subject.accept(
      PROJECT_ID,
      changeSet('changeset_mixed002', opened.revision, [
        trim('operation_cut000001', 1),
        titleOnMissingAsset('operation_title0001'),
      ]),
    ))

    expect((error.detail as { failedOperationIndex?: number }).failedOperationIndex).toBe(1)
  })

  it('K — a stale base revision is refused and nothing is written', async () => {
    const { subject, writes, onDisk } = service()
    const opened = await subject.load(PROJECT_ID)
    const writesAfterOpen = writes.length

    const error = await rejected(() => subject.accept(
      PROJECT_ID,
      changeSet('changeset_stale001', opened.revision + 5, [trim('operation_cut000001', 1)]),
    ))

    expect(error.code).toBe('REVISION_CONFLICT')
    expect(writes).toHaveLength(writesAfterOpen)
    expect(onDisk()?.revision).toBe(opened.revision)
  })

  it('L — a write failure is never reported as an accepted edit', async () => {
    const { subject } = service(true)

    await expect(subject.load(PROJECT_ID)).rejects.toThrow('disk is full')
  })

  it('M — one accepted two-operation edit is one revision and one history entry', async () => {
    const { subject, writes, onDisk } = service()
    const opened = await subject.load(PROJECT_ID)
    const writesAfterOpen = writes.length

    const next = await subject.accept(
      PROJECT_ID,
      changeSet('changeset_both0001', opened.revision, [
        trim('operation_cut000001', 1),
        validTitle('operation_title0001'),
      ]),
    )

    expect(next.revision).toBe(opened.revision + 1)
    expect(next.changeSets).toHaveLength(1)
    expect(next.changeSets[0].changeSet.operations).toHaveLength(2)
    // Exactly one write: the whole project, once, not one write per operation.
    expect(writes).toHaveLength(writesAfterOpen + 1)
    expect(onDisk()?.revision).toBe(opened.revision + 1)
  })

  it('survives a restart with exactly what was accepted and nothing that was refused', async () => {
    const { subject, onDisk } = service()
    const opened = await subject.load(PROJECT_ID)

    await subject.accept(
      PROJECT_ID,
      changeSet('changeset_kept00001', opened.revision, [trim('operation_cut000001', 2)]),
    )
    await rejected(() => subject.accept(
      PROJECT_ID,
      changeSet('changeset_lost00001', opened.revision + 1, [
        trim('operation_cut000002', 3),
        titleOnMissingAsset('operation_title0001'),
      ]),
    ))

    const afterRestart = onDisk()
    expect(afterRestart?.changeSets).toHaveLength(1)
    expect(afterRestart?.revision).toBe(opened.revision + 1)

    // And a genuine reload agrees with the file.
    const reloaded = await subject.load(PROJECT_ID)
    expect(reloaded.changeSets).toHaveLength(1)
    expect(reloaded.changeSets[0].changeSet.changeSetId).toBe('changeset_kept00001')
  })

  it('N — one Undo removes both halves of a compound edit and one Redo restores both', async () => {
    const { subject } = service()
    const opened = await subject.load(PROJECT_ID)

    await subject.accept(
      PROJECT_ID,
      changeSet('changeset_both0002', opened.revision, [
        trim('operation_cut000001', 1),
        validTitle('operation_title0001'),
      ]),
    )

    const undone = await subject.undo(PROJECT_ID)
    expect(undone.changeSets).toHaveLength(0)

    const redone = await subject.redo(PROJECT_ID)
    expect(redone.changeSets).toHaveLength(1)
    expect(redone.changeSets[0].changeSet.operations).toHaveLength(2)
  })
})
