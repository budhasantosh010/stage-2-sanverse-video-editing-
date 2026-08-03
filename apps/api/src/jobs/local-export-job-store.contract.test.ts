import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'

import { testProject } from '@sanverse/edit-domain/test-fixtures'
import {
  createLocalExportJobStore,
  EXPORT_RENDERING_PROGRESS,
  EXPORT_VERIFYING_PROGRESS,
  exportJobPhase,
} from './local-export-job-store.ts'

test('the reported phase comes from real milestones, never from an invented percentage', () => {
  assert.equal(exportJobPhase({ status: 'queued', progress: 0 }), 'queued')
  assert.equal(exportJobPhase({ status: 'running', progress: 0.05 }), 'rendering')
  assert.equal(exportJobPhase({ status: 'running', progress: EXPORT_RENDERING_PROGRESS }), 'rendering')
  // Verification begins exactly when FFmpeg exits 0, so a stall after this
  // point is attributable to checking the file rather than to encoding.
  assert.equal(exportJobPhase({ status: 'running', progress: EXPORT_VERIFYING_PROGRESS }), 'verifying')
  assert.equal(exportJobPhase({ status: 'succeeded', progress: 1 }), 'done')
  assert.equal(exportJobPhase({ status: 'failed', progress: 1 }), 'done')
  assert.equal(exportJobPhase({ status: 'cancelled', progress: 1 }), 'done')
})

test('a public job always states its phase and never leaks the project snapshot or key', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sanverse-jobs-public-'))
  try {
    const store = createLocalExportJobStore(root)
    const { job } = await store.create({
      jobId: 'job_3333333333333333',
      project: testProject(),
      exportId: 'export_3333333333333333',
      idempotencyKey: 'c'.repeat(64),
    })
    const published = store.publicJob(job)
    assert.equal(published.phase, 'queued')
    assert.equal('projectSnapshot' in published, false)
    assert.equal('idempotencyKey' in published, false)

    const running = await store.update(job.jobId, { status: 'running', progress: EXPORT_VERIFYING_PROGRESS })
    assert.equal(store.publicJob(running).phase, 'verifying')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('export jobs persist, deduplicate, and recover running work as queued', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sanverse-jobs-'))
  try {
    const input = {
      jobId: 'job_1234567890abcdef',
      project: testProject(),
      exportId: 'export_1234567890abcdef',
      idempotencyKey: 'a'.repeat(64),
    }
    const first = createLocalExportJobStore(root)
    assert.equal((await first.create(input)).created, true)
    assert.equal((await first.create({ ...input, jobId: 'job_fedcba0987654321' })).created, false)
    const concurrentKey = 'b'.repeat(64)
    const concurrent = await Promise.all([
      first.create({ ...input, jobId: 'job_1111111111111111', exportId: 'export_1111111111111111', idempotencyKey: concurrentKey }),
      first.create({ ...input, jobId: 'job_2222222222222222', exportId: 'export_2222222222222222', idempotencyKey: concurrentKey }),
    ])
    assert.equal(concurrent.filter((result) => result.created).length, 1)
    await first.update(input.jobId, { status: 'running', progress: 0.4, attempts: 1 })

    const restarted = createLocalExportJobStore(root)
    const recovered = await restarted.recoverRunnable()
    const recoveredOriginal = recovered.find((job) => job.jobId === input.jobId)
    assert.ok(recoveredOriginal)
    assert.equal(recoveredOriginal.status, 'queued')
    assert.equal(recoveredOriginal.progress, 0)
    assert.equal(recoveredOriginal.attempts, 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
