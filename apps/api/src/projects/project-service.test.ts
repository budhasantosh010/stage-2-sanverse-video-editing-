import { describe, expect, it } from 'vitest'

import {
  ProjectIntakeError,
  createProjectIntakeService,
  type ProjectRepository,
  type StagedSource,
} from './project-repository.ts'

const ftyp = (brand = 'isom') => {
  const bytes = new Uint8Array(24)
  new DataView(bytes.buffer).setUint32(0, 24)
  bytes.set(new TextEncoder().encode('ftyp'), 4)
  bytes.set(new TextEncoder().encode(brand), 8)
  bytes.set(new TextEncoder().encode(`${brand}${brand}`), 16)
  return bytes
}

const chunks = async function* (...values: Uint8Array[]) {
  yield* values
}

function memoryRepository(): ProjectRepository & { published: unknown[]; aborted: number } {
  const repository = {
    published: [] as unknown[],
    aborted: 0,
    async stageSource(input: { projectId: string; body: AsyncIterable<Uint8Array> }) {
      const collected: Uint8Array[] = []
      try {
        for await (const chunk of input.body) collected.push(chunk)
      } catch (error) {
        repository.aborted += 1
        throw error
      }
      return { projectId: input.projectId, token: 'stage', byteLength: collected.reduce((n, c) => n + c.length, 0) }
    },
    async publishProject(_stage: StagedSource, manifest: unknown) {
      repository.published.push(manifest)
    },
    async abortStage() {
      repository.aborted += 1
    },
    async inspectMedia() {
      throw new Error('not used')
    },
    async openMedia() {
      throw new Error('not used')
    },
    async allocateExport() {
      throw new Error('not used')
    },
    async inspectExport() {
      throw new Error('not used')
    },
    async openExport() {
      throw new Error('not used')
    },
  }
  return repository
}

describe('project intake service', () => {
  it.each([
    ['wrong extension', 'clip.mov', 'video/mp4', ftyp()],
    ['unsafe name', '../clip.mp4', 'video/mp4', ftyp()],
    ['conflicting MIME', 'clip.mp4', 'video/webm', ftyp()],
    ['invalid signature', 'clip.mp4', 'video/mp4', new TextEncoder().encode('not an mp4')],
    ['non-MP4 brand', 'clip.mp4', 'video/mp4', ftyp('qt  ')],
    ['non-ASCII box type', 'clip.mp4', 'video/mp4', new Uint8Array([0,0,0,24,255,254,253,252,105,115,111,109,0,0,0,0,105,115,111,109,109,112,52,50])],
  ])('rejects %s without publishing', async (_case, filename, contentType, body) => {
    const repository = memoryRepository()
    const service = createProjectIntakeService({ repository, maxUploadBytes: 100, idGenerator: () => 'project_1234567890abcdef', now: () => new Date('2026-07-13T00:00:00.000Z') })

    await expect(service.create({ filename, contentType, contentLength: body.length, body: chunks(body) })).rejects.toBeInstanceOf(ProjectIntakeError)
    expect(repository.published).toHaveLength(0)
  })

  it.each([undefined, Number.NaN, 0, -1, 1.5, 101])('rejects missing, malformed, or over-limit declared length %s', async (contentLength) => {
    const repository = memoryRepository()
    const service = createProjectIntakeService({ repository, maxUploadBytes: 100, idGenerator: () => 'project_1234567890abcdef' })

    await expect(service.create({ filename: 'clip.mp4', contentType: '', contentLength, body: chunks(ftyp()) })).rejects.toBeInstanceOf(ProjectIntakeError)
    expect(repository.published).toHaveLength(0)
  })

  it('enforces the injected byte boundary at N and rejects N+1', async () => {
    const bytes = ftyp()
    const acceptedRepository = memoryRepository()
    const accepted = createProjectIntakeService({ repository: acceptedRepository, maxUploadBytes: bytes.length, idGenerator: () => 'project_1234567890abcdef' })
    await expect(accepted.create({ filename: 'clip.mp4', contentType: 'application/octet-stream', contentLength: bytes.length, body: chunks(bytes) })).resolves.toMatchObject({ sizeBytes: bytes.length })

    const rejectedRepository = memoryRepository()
    const rejected = createProjectIntakeService({ repository: rejectedRepository, maxUploadBytes: bytes.length, idGenerator: () => 'project_1234567890abcdef' })
    await expect(rejected.create({ filename: 'clip.mp4', contentType: 'video/mp4', contentLength: bytes.length, body: chunks(bytes, new Uint8Array([1])) })).rejects.toMatchObject({ code: 'SIZE_MISMATCH' })
    expect(rejectedRepository.published).toHaveLength(0)
    expect(rejectedRepository.aborted).toBe(1)
  })

  it('rejects an actual byte undershoot and cleans the stage', async () => {
    const repository = memoryRepository()
    const body = ftyp()
    const service = createProjectIntakeService({ repository, maxUploadBytes: 100, idGenerator: () => 'project_1234567890abcdef' })

    await expect(service.create({ filename: 'clip.mp4', contentType: 'video/mp4', contentLength: body.length + 1, body: chunks(body) })).rejects.toMatchObject({ code: 'SIZE_MISMATCH' })
    expect(repository.aborted).toBe(1)
  })

  it('publishes generated identity, timestamp, hash, and fixed media URL only after validation', async () => {
    const repository = memoryRepository()
    const body = ftyp()
    const service = createProjectIntakeService({ repository, maxUploadBytes: 100, idGenerator: () => 'project_1234567890abcdef', now: () => new Date('2026-07-13T01:02:03.000Z') })

    const result = await service.create({ filename: 'My%20Clip.mp4', contentType: undefined, contentLength: body.length, body: chunks(body.subarray(0, 7), body.subarray(7)) })

    expect(result).toMatchObject({ id: 'project_1234567890abcdef', originalFilename: 'My Clip.mp4', createdAt: '2026-07-13T01:02:03.000Z', sizeBytes: body.length, mediaUrl: '/api/projects/project_1234567890abcdef/media' })
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(repository.published).toEqual([expect.objectContaining({ id: result.id, sha256: result.sha256 })])
  })

  it('retries an opaque ID collision without reusing user input as a path', async () => {
    const repository = memoryRepository()
    let calls = 0
    repository.stageSource = async (input) => {
      if (input.projectId === 'project_collision0000000') throw Object.assign(new Error('collision'), { code: 'PROJECT_COLLISION' })
      for await (const _chunk of input.body) { /* consume */ }
      return { projectId: input.projectId, token: 'ok', byteLength: ftyp().length }
    }
    const service = createProjectIntakeService({ repository, maxUploadBytes: 100, idGenerator: () => (++calls === 1 ? 'project_collision0000000' : 'project_1234567890abcdef') })

    await expect(service.create({ filename: 'clip.mp4', contentType: 'video/mp4', contentLength: ftyp().length, body: chunks(ftyp()) })).resolves.toMatchObject({ id: 'project_1234567890abcdef' })
  })
})
