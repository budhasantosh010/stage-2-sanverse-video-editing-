import assert from 'node:assert/strict'
import test from 'node:test'

import { testProject } from '@sanverse/edit-domain/test-fixtures'
import {
  PortableProjectError,
  buildPortableProjectArchive,
  restorePortableProject,
  validatePortableProjectArchive,
} from './portable-project.ts'

test('portable archive verifies integrity and restores against matching media', () => {
  const project = testProject()
  const archive = buildPortableProjectArchive(project, '2026-07-29T00:00:00.000Z')
  assert.equal(validatePortableProjectArchive(archive).project.projectId, project.projectId)
  assert.deepEqual(restorePortableProject(archive, project), project)
})

test('portable archive rejects corruption, unknown fields, and missing media', () => {
  const project = testProject()
  const archive = buildPortableProjectArchive(project, '2026-07-29T00:00:00.000Z')
  const corrupted = structuredClone(archive) as Record<string, unknown>
  corrupted.exportedAt = '2026-07-29T00:00:01.000Z'
  assert.throws(() => validatePortableProjectArchive(corrupted), PortableProjectError)

  const traversal = { ...archive, path: '../source.mp4' }
  assert.throws(() => validatePortableProjectArchive(traversal), PortableProjectError)

  const missing = {
    ...structuredClone(project),
    assets: project.assets.map((asset) => ({ ...asset, sha256: 'f'.repeat(64) })),
  }
  assert.throws(
    () => restorePortableProject(archive, missing),
    (error: unknown) => error instanceof PortableProjectError && error.code === 'PORTABLE_MEDIA_MISSING',
  )
})
