import { afterEach, describe, expect, it } from 'vitest'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { CreativeRunV1 } from '@sanverse/creative-production-adapter'
import { SANVERSE_ROOT } from './sanverse-mcp-shared.ts'
import {
  listCreativeRunFilesV1,
  readCreativeReviewArtifactV1,
  readCreativeRunFileV1,
  writeCreativeReviewArtifactV1,
  writeCreativeRunFileV1,
} from './sanverse-mcp-creative-run-store.ts'

const projectId = 'project_aaaaaaaaaaaaaaaa'
const runId = 'run_aaaaaaaa'
const projectRoot = resolve(SANVERSE_ROOT, '.sanverse-data', 'projects', projectId)

const run = (): CreativeRunV1 => Object.freeze({
  schemaVersion: 'sanverse.creative-run/v1' as const,
  runId,
  projectId,
  baseProjectRevision: 0,
  sourceAssetId: 'asset_aaaaaaaaaaaaaaaa',
  stage: 'source-analysis' as const,
  createdAt: '2026-08-31T07:00:00.000Z',
  updatedAt: '2026-08-31T07:00:00.000Z',
  sceneIds: Object.freeze([]),
  reviews: Object.freeze([]),
  extensions: Object.freeze({}),
})

afterEach(async () => { await rm(projectRoot, { recursive: true, force: true }) })

describe('project-local Creative Run store', () => {
  it('atomically round-trips a validated run and bounded review artifact with SHA-256 metadata', async () => {
    await writeCreativeRunFileV1(run())
    await expect(readCreativeRunFileV1({ projectId, runId })).resolves.toEqual(run())
    await expect(listCreativeRunFilesV1(projectId)).resolves.toEqual([run()])

    const bytes = new TextEncoder().encode('review-frame-bytes')
    const stored = await writeCreativeReviewArtifactV1({ projectId, runId, reviewId: 'review_aaaaaaaa', artifactId: 'frame-opening.png', bytes })
    expect(stored).toMatchObject({ byteLength: bytes.byteLength, sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) })
    await expect(readCreativeReviewArtifactV1({ projectId, runId, reviewId: 'review_aaaaaaaa', artifactId: 'frame-opening.png' })).resolves.toEqual(bytes)
  })

  it('fails closed when persisted run bytes are corrupted instead of rehydrating guessed state', async () => {
    await writeCreativeRunFileV1(run())
    const path = resolve(projectRoot, 'creative-runs', runId, 'run.json')
    expect((await readFile(path, 'utf8')).length).toBeGreaterThan(0)
    await writeFile(path, '{not-json', 'utf8')
    await expect(readCreativeRunFileV1({ projectId, runId })).rejects.toThrow('CREATIVE_RUN_REHYDRATION_FAILED')
  })
})
