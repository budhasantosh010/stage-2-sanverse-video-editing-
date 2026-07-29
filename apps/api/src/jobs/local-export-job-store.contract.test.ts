import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { testProject } from '@sanverse/edit-domain/test-fixtures'
import { createLocalExportJobStore } from './local-export-job-store.ts'

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
