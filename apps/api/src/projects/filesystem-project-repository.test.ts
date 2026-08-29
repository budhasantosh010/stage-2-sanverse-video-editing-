import { chmod, link, mkdtemp, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { createFilesystemProjectRepository, writeAll } from './filesystem-project-repository.ts'

async function* body(bytes: Uint8Array) { yield bytes }

async function collect(body: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  for await (const chunk of body) chunks.push(chunk)
  return new Uint8Array(Buffer.concat(chunks))
}

function manifest(id: string) {
  return { id, originalFilename: 'owner.mp4', createdAt: '2026-07-13T00:00:00.000Z', sizeBytes: 4, sha256: 'a'.repeat(64), mediaUrl: `/api/projects/${id}/media` }
}

describe('filesystem project repository', () => {
  it('retries partial file writes until every source byte is stored', async () => {
    const calls: Array<{ offset: number; length: number }> = []
    const handle = {
      async write(_buffer: Uint8Array, offset: number, length: number) {
        calls.push({ offset, length })
        return { bytesWritten: Math.min(2, length), buffer: _buffer }
      },
    }

    await writeAll(handle, new Uint8Array([1, 2, 3, 4, 5]))
    expect(calls).toEqual([
      { offset: 0, length: 5 },
      { offset: 2, length: 3 },
      { offset: 4, length: 1 },
    ])
  })

  it('fails closed when a file write makes no progress', async () => {
    const handle = { async write(buffer: Uint8Array) { return { bytesWritten: 0, buffer } } }
    await expect(writeAll(handle, new Uint8Array([1]))).rejects.toThrow(/no progress/i)
  })

  it('publishes source and manifest together, preserves bytes, and prevents overwrite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sanverse-repo-'))
    const repository = createFilesystemProjectRepository(root)
    const bytes = new Uint8Array([1, 2, 3, 4])
    const stage = await repository.stageSource({ projectId: 'project_1234567890abcdef', body: body(bytes) })

    await expect(repository.inspectMedia('project_1234567890abcdef')).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
    await repository.publishProject(stage, { id: stage.projectId, originalFilename: 'owner.mp4', createdAt: '2026-07-13T00:00:00.000Z', sizeBytes: 4, sha256: 'hash', mediaUrl: '/api/projects/project_1234567890abcdef/media' })

    const projectDir = join(root, 'projects', stage.projectId)
    expect(new Uint8Array(await readFile(join(projectDir, 'source.mp4')))).toEqual(bytes)
    expect(JSON.parse(await readFile(join(projectDir, 'project.json'), 'utf8'))).toMatchObject({ id: stage.projectId, originalFilename: 'owner.mp4' })
    expect((await stat(join(projectDir, 'source.mp4'))).mode & 0o222).toBe(0)
    await expect(repository.stageSource({ projectId: stage.projectId, body: body(bytes) })).rejects.toMatchObject({ code: 'PROJECT_COLLISION' })
  })

  it('rejects traversal IDs and cleans an aborted staging directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sanverse-repo-'))
    const repository = createFilesystemProjectRepository(root)
    await expect(repository.openMedia('../outside')).rejects.toMatchObject({ code: 'INVALID_PROJECT_ID' })

    const stage = await repository.stageSource({ projectId: 'project_1234567890abcdef', body: body(new Uint8Array([1])) })
    await repository.abortStage(stage)
    await expect(repository.publishProject(stage, manifest(stage.projectId))).rejects.toBeTruthy()
  })

  it('supports full reads, valid ranges, and rejects invalid ranges', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sanverse-repo-'))
    const repository = createFilesystemProjectRepository(root)
    const bytes = new Uint8Array([10, 20, 30, 40, 50])
    const stage = await repository.stageSource({ projectId: 'project_1234567890abcdef', body: body(bytes) })
    await repository.publishProject(stage, manifest(stage.projectId))

    await expect(repository.inspectMedia(stage.projectId)).resolves.toEqual({ size: 5 })
    const full = await repository.openMedia(stage.projectId)
    expect(full).toMatchObject({ size: 5, start: 0, end: 4 })
    await full.close()
    await expect(full.close()).resolves.toBeUndefined()

    const ranged = await repository.openMedia(stage.projectId, { start: 1, end: 3 })
    expect(ranged).toMatchObject({ size: 5, start: 1, end: 3 })
    await ranged.close()
    await expect(repository.openMedia(stage.projectId, { start: 5, end: 6 })).rejects.toMatchObject({ code: 'INVALID_RANGE' })
  })

  it('allocates an export only inside its published project and serves the finished bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sanverse-repo-'))
    const repository = createFilesystemProjectRepository(root)
    const projectId = 'project_1234567890abcdef'
    const exportId = 'export_1234567890abcdef'
    const stage = await repository.stageSource({ projectId, body: body(new Uint8Array([1, 2, 3, 4])) })
    await repository.publishProject(stage, manifest(projectId))

    const paths = await repository.allocateExport(projectId, exportId)
    expect(paths.sourcePath).toBe(join(root, 'projects', projectId, 'source.mp4'))
    expect(paths.outputPath).toBe(join(root, 'projects', projectId, 'exports', `${exportId}.mp4`))
    expect(paths.trustedWorkDir).toBe(join(root, 'projects', projectId))

    await writeFile(paths.outputPath, new Uint8Array([9, 8, 7]))
    await expect(repository.inspectExport(projectId, exportId)).resolves.toEqual({ size: 3 })
    const opened = await repository.openExport(projectId, exportId, { start: 1, end: 2 })
    expect(opened).toMatchObject({ size: 3, start: 1, end: 2 })
    await opened.close()
    await expect(repository.allocateExport('../outside', exportId)).rejects.toMatchObject({ code: 'INVALID_PROJECT_ID' })
    await expect(repository.openExport(projectId, '../outside')).rejects.toMatchObject({ code: 'INVALID_EXPORT_ID' })
  })

  it('lists published projects and atomically persists canonical project state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sanverse-repo-'))
    const repository = createFilesystemProjectRepository(root)
    const olderId = 'project_1111111111111111'
    const newerId = 'project_2222222222222222'
    for (const [projectId, createdAt] of [
      [olderId, '2026-07-13T00:00:00.000Z'],
      [newerId, '2026-07-14T00:00:00.000Z'],
    ] as const) {
      const stage = await repository.stageSource({ projectId, body: body(new Uint8Array([1, 2, 3, 4])) })
      await repository.publishProject(stage, { ...manifest(projectId), createdAt })
    }

    await expect(repository.listProjects()).resolves.toEqual([
      expect.objectContaining({ id: newerId }),
      expect.objectContaining({ id: olderId }),
    ])
    await expect(repository.readProjectState(newerId)).resolves.toBeNull()

    const state = JSON.stringify({ schemaVersion: 'sanverse.project/v1', projectId: newerId, history: { accepted: [], redoStack: [], issuedActionIds: [] } })
    await repository.saveProjectState(newerId, state)
    await expect(repository.readProjectState(newerId)).resolves.toBe(state)
  })

  it('stores Creative artifacts by immutable content hash, deduplicates identical bytes, and detects tampering', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sanverse-repo-'))
    const repository = createFilesystemProjectRepository(root)
    const projectId = 'project_1234567890abcdef'
    const stage = await repository.stageSource({ projectId, body: body(new Uint8Array([1, 2, 3, 4])) })
    await repository.publishProject(stage, manifest(projectId))

    const serialized = JSON.stringify({ schemaVersion: 'sanverse.creative-scene-artifact/v1', sceneId: 'creative_scene_12345678', value: 1 })
    const first = await repository.putCreativeArtifact!(projectId, serialized)
    const second = await repository.putCreativeArtifact!(projectId, serialized)
    expect(second).toEqual(first)
    expect(first.artifactId).toBe(`creativeart_${first.sha256}`)
    expect(await repository.readCreativeArtifact!(projectId, first.artifactId)).toEqual(first)
    expect(await repository.listCreativeArtifacts!(projectId)).toEqual([{ artifactId: first.artifactId, sha256: first.sha256, byteLength: first.byteLength }])

    const artifactPath = join(root, 'projects', projectId, 'creative-artifacts', `${first.artifactId}.json`)
    await chmod(artifactPath, 0o600)
    await writeFile(artifactPath, JSON.stringify({ schemaVersion: 'sanverse.creative-scene-artifact/v1', sceneId: 'creative_scene_12345678', value: 2 }))
    await expect(repository.readCreativeArtifact!(projectId, first.artifactId)).rejects.toMatchObject({ code: 'CREATIVE_ARTIFACT_HASH_MISMATCH' })
  })

  it('refuses multiply linked Creative artifact files rather than trusting path names alone', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sanverse-repo-'))
    const repository = createFilesystemProjectRepository(root)
    const projectId = 'project_1234567890abcdef'
    const stage = await repository.stageSource({ projectId, body: body(new Uint8Array([1, 2, 3, 4])) })
    await repository.publishProject(stage, manifest(projectId))
    const record = await repository.putCreativeArtifact!(projectId, JSON.stringify({ schemaVersion: 'sanverse.creative-scene-artifact/v1', sceneId: 'creative_scene_12345678' }))
    const artifactPath = join(root, 'projects', projectId, 'creative-artifacts', `${record.artifactId}.json`)
    await link(artifactPath, `${artifactPath}.link`)
    await expect(repository.readCreativeArtifact!(projectId, record.artifactId)).rejects.toMatchObject({ code: 'CREATIVE_ARTIFACT_NOT_FOUND' })
  })

  it('streams export bytes from the validated open file when its pathname is replaced', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sanverse-repo-'))
    const repository = createFilesystemProjectRepository(root)
    const projectId = 'project_1234567890abcdef'
    const exportId = 'export_1234567890abcdef'
    const stage = await repository.stageSource({ projectId, body: body(new Uint8Array([1])) })
    await repository.publishProject(stage, manifest(projectId))
    const { outputPath } = await repository.allocateExport(projectId, exportId)
    const originalBytes = new Uint8Array([9, 8, 7])
    await writeFile(outputPath, originalBytes)

    const opened = await repository.openExport(projectId, exportId)
    await rename(outputPath, `${outputPath}.replaced`)
    await writeFile(outputPath, new Uint8Array([1, 2, 3]))

    await expect(collect(opened.body)).resolves.toEqual(originalBytes)
  })

  it('rejects empty and multiply linked export files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sanverse-repo-'))
    const repository = createFilesystemProjectRepository(root)
    const projectId = 'project_1234567890abcdef'
    const stage = await repository.stageSource({ projectId, body: body(new Uint8Array([1])) })
    await repository.publishProject(stage, manifest(projectId))

    const empty = await repository.allocateExport(projectId, 'export_0000000000000000')
    await writeFile(empty.outputPath, new Uint8Array())
    await expect(repository.openExport(projectId, 'export_0000000000000000')).rejects.toMatchObject({ code: 'EXPORT_NOT_FOUND' })

    const linked = await repository.allocateExport(projectId, 'export_1111111111111111')
    await writeFile(linked.outputPath, new Uint8Array([1]))
    await link(linked.outputPath, `${linked.outputPath}.link`)
    await expect(repository.openExport(projectId, 'export_1111111111111111')).rejects.toMatchObject({ code: 'EXPORT_NOT_FOUND' })
  })
})
