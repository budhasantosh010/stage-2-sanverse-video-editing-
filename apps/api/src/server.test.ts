import { once } from 'node:events'
import { request } from 'node:http'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import type { EditProject } from '@sanverse/edit-domain'

import { stubMediaProbe } from './test-fixtures.ts'
import { createSanverseServer } from './server.ts'
import type { ProjectRepository } from './projects/project-repository.ts'

const servers: Array<ReturnType<typeof createSanverseServer>> = []
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))) })

function mp4(): Uint8Array {
  return new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109,109,112,52,50])
}

async function call(port: number, options: { method?: string; path?: string; headers?: Record<string, string>; body?: Uint8Array }) {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: Uint8Array }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method: options.method, path: options.path, headers: options.headers }, async (res) => {
      const chunks: Buffer[] = []
      for await (const chunk of res) chunks.push(Buffer.from(chunk))
      resolve({ status: res.statusCode ?? 0, headers: res.headers, body: new Uint8Array(Buffer.concat(chunks)) })
    })
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

function readRepository(bytes: Uint8Array, bodyFactory: () => AsyncIterable<Uint8Array> = async function* () { yield bytes }) {
  const inspectCalls: string[] = []
  const openCalls: Array<{ projectId: string; range?: { start: number; end: number } }> = []
  const closeCalls: Array<'media' | 'export'> = []
  const repository: ProjectRepository = {
    async stageSource() { throw new Error('not used') },
    async stageAsset() { throw new Error('not used') },
    async resolveAssetPath() { throw new Error('not used') },
    async openAsset() { throw new Error('not used') },
    async publishProject() { throw new Error('not used') },
    async abortStage() { throw new Error('not used') },
    async inspectMedia(projectId) {
      inspectCalls.push(projectId)
      return { size: bytes.length }
    },
    async openMedia(projectId, range) {
      openCalls.push({ projectId, range })
      const start = range?.start ?? 0
      const end = range?.end ?? bytes.length - 1
      return { body: bodyFactory(), close: async () => { closeCalls.push('media') }, size: bytes.length, start, end }
    },
    async listProjects() { return [] },
    async readProject() { throw new Error('not used') },
    async readProjectState() { return null },
    async saveProjectState() { throw new Error('not used') },
    async resolveMediaPaths(projectId) {
      return { sourcePath: `C:\safe\${projectId}\source.mp4`, trustedWorkDir: `C:\safe\${projectId}` }
    },
    async allocateExport(projectId, exportId) {
      return { sourcePath: `C:\\safe\\${projectId}\\source.mp4`, outputPath: `C:\\safe\\${projectId}\\exports\\${exportId}.mp4`, trustedWorkDir: `C:\\safe\\${projectId}` }
    },
    async inspectExport() { return { size: bytes.length } },
    async openExport(_projectId, _exportId, range) {
      const start = range?.start ?? 0
      const end = range?.end ?? bytes.length - 1
      return {
        body: async function* () { yield bytes.subarray(start, end + 1) }(),
        close: async () => { closeCalls.push('export') },
        size: bytes.length,
        start,
        end,
      }
    },
  }
  return { repository, inspectCalls, openCalls, closeCalls }
}

async function listen(server: ReturnType<typeof createSanverseServer>): Promise<number> {
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing address')
  return address.port
}

const PROJECT_ID = 'project_1234567890abcdef'

const MANIFEST = {
  id: PROJECT_ID,
  originalFilename: 'owner.mp4',
  createdAt: '2026-07-14T00:00:00.000Z',
  sizeBytes: 24,
  sha256: 'a'.repeat(64),
  mediaUrl: `/api/projects/${PROJECT_ID}/media`,
}

const EXPORT_OUTPUT_PATH = (exportId: string) => `C:\\safe\\${PROJECT_ID}\\exports\\${exportId}.mp4`

/** An in-memory stand-in for the one file that holds a project's edits. */
function savedProjectState(initial: string | null = null) {
  let serialized = initial
  return {
    serialized: () => serialized,
    repository: {
      async listProjects() { return [MANIFEST] },
      async readProject() { return MANIFEST },
      async readProjectState() { return serialized },
      async saveProjectState(_projectId: string, value: string) { serialized = value },
    } satisfies Partial<ProjectRepository>,
  }
}

const ms = (milliseconds: number) => ({ ticks: milliseconds * 1_440, timescale: 1_440_000 })

const changeSet = (baseRevision: number, changeSetId = 'changeset_aaaaaaaa') => ({
  schemaVersion: 'sanverse.change-set/v1',
  changeSetId,
  baseRevision,
  operations: [{
    schemaVersion: 'sanverse.operation/v3',
    operationId: `operation_${changeSetId.slice(-8)}`,
    kind: 'add-nameplate',
    capabilityId: 'sanverse.nameplate.component/v1',
    assetId: 'asset_1234567890ab',
    sourceInterval: { start: ms(1_000), duration: ms(5_000) },
    target: { coordinateSpace: 'composition-normalized', point: { x: 0.2, y: 0.3 }, anchor: 'center' },
    primaryText: 'Santosh',
    secondaryText: 'Founder',
    extensions: {},
  }],
  provenance: { source: 'direct', requestId: null },
  extensions: {},
})

async function sendJson(port: number, method: string, path: string, payload: unknown) {
  const body = new TextEncoder().encode(JSON.stringify(payload))
  return call(port, {
    method,
    path,
    headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
    body,
  })
}

describe('local API boundary', () => {
  it('binds loopback, rejects cross-origin requests, creates a project, and serves ranges', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'sanverse-api-'))
    const server = createSanverseServer({ dataRoot, maxUploadBytes: 100 })
    servers.push(server)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    expect(address.address).toBe('127.0.0.1')

    const rejected = await call(address.port, { method: 'POST', path: '/api/projects', headers: { origin: 'https://evil.example', 'content-length': String(mp4().length), 'x-sanverse-filename': 'clip.mp4', 'content-type': 'video/mp4' }, body: mp4() })
    expect(rejected.status).toBe(403)
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined()

    const created = await call(address.port, { method: 'POST', path: '/api/projects', headers: { 'content-length': String(mp4().length), 'x-sanverse-filename': 'My%20Clip.mp4', 'content-type': 'video/mp4' }, body: mp4() })
    expect(created.status).toBe(201)
    const project = JSON.parse(new TextDecoder().decode(created.body))
    expect(project).toMatchObject({ originalFilename: 'My Clip.mp4' })

    const ranged = await call(address.port, { path: project.mediaUrl, headers: { range: 'bytes=4-7' } })
    expect(ranged.status).toBe(206)
    expect(ranged.headers['content-range']).toBe(`bytes 4-7/${mp4().length}`)
    expect([...ranged.body]).toEqual([102,116,121,112])

    const invalid = await call(address.port, { path: project.mediaUrl, headers: { range: 'bytes=999-' } })
    expect(invalid.status).toBe(416)
    expect(invalid.headers['content-range']).toBe(`bytes */${mp4().length}`)
  })

  it('clamps an oversized range end and opens exactly one media iterable', async () => {
    const source = mp4()
    const spy = readRepository(source, async function* () { yield source.subarray(4) })
    const port = await listen(createSanverseServer({ dataRoot: 'unused', maxUploadBytes: 100, repository: spy.repository }))

    const response = await call(port, { path: '/api/projects/project_1234567890abcdef/media', headers: { range: 'bytes=4-999' } })

    expect(response.status).toBe(206)
    expect(response.headers['content-range']).toBe(`bytes 4-${source.length - 1}/${source.length}`)
    expect(spy.inspectCalls).toEqual(['project_1234567890abcdef'])
    expect(spy.openCalls).toEqual([{ projectId: 'project_1234567890abcdef', range: { start: 4, end: source.length - 1 } }])
    expect(spy.closeCalls).toEqual(['media'])
  })

  it('closes opened media when response metadata fails before streaming starts', async () => {
    let closeCalls = 0
    const spy = readRepository(mp4())
    spy.repository.openMedia = async () => ({
      body: async function* () { yield mp4() }(),
      close: async () => { closeCalls += 1 },
      size: mp4().length,
      start: 0,
      get end(): number { throw new Error('response metadata failed') },
    })
    const port = await listen(createSanverseServer({ dataRoot: 'unused', maxUploadBytes: 100, repository: spy.repository }))

    const response = await call(port, { path: '/api/projects/project_1234567890abcdef/media' })

    expect(response.status).toBe(500)
    expect(closeCalls).toBe(1)
  })

  it('cancels the media iterable when the client closes during backpressure', async () => {
    let returned = false
    let finishPending: (() => void) | undefined
    const body = {
      [Symbol.asyncIterator]() {
        let first = true
        return {
          async next() {
            if (first) {
              first = false
              return { done: false as const, value: new Uint8Array(256 * 1024) }
            }
            await new Promise<void>((resolve) => { finishPending = resolve })
            return { done: true as const, value: undefined }
          },
          async return() {
            returned = true
            finishPending?.()
            return { done: true as const, value: undefined }
          },
        }
      },
    }
    const spy = readRepository(new Uint8Array(512 * 1024), () => body)
    const port = await listen(createSanverseServer({ dataRoot: 'unused', maxUploadBytes: 100, repository: spy.repository }))

    await new Promise<void>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port, path: '/api/projects/project_1234567890abcdef/media' }, (res) => {
        res.once('data', () => res.destroy())
        res.once('close', resolve)
      })
      req.once('error', reject)
      req.end()
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(returned).toBe(true)
  })

  it('terminates a started response when its media iterable throws', async () => {
    const source = mp4()
    const spy = readRepository(source, async function* () {
      yield source.subarray(0, 4)
      throw new Error('media read failed')
    })
    const port = await listen(createSanverseServer({ dataRoot: 'unused', maxUploadBytes: 100, repository: spy.repository }))

    const result = await new Promise<{ status: number; aborted: boolean }>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port, path: '/api/projects/project_1234567890abcdef/media' }, (res) => {
        res.resume()
        res.once('aborted', () => resolve({ status: res.statusCode ?? 0, aborted: true }))
        res.once('end', () => resolve({ status: res.statusCode ?? 0, aborted: false }))
      })
      req.once('error', reject)
      req.end()
    })

    expect(result).toEqual({ status: 200, aborted: true })
  })

  it('requires a strict filename header and content length', async () => {
    const server = createSanverseServer({ dataRoot: await mkdtemp(join(tmpdir(), 'sanverse-api-')), maxUploadBytes: 100 })
    servers.push(server)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing address')

    expect((await call(address.port, { method: 'POST', path: '/api/projects', headers: { 'content-length': String(mp4().length) }, body: mp4() })).status).toBe(400)
  })

  it('renders the saved project through controlled paths and serves the export', async () => {
    const rendered = new TextEncoder().encode('rendered-mp4')
    const spy = readRepository(rendered)
    const exportCalls: Array<{ project: EditProject; outputPath: string }> = []
    const renderService = {
      async exportProject(input: { project: EditProject; outputPath: string }) {
        exportCalls.push(input)
        return { outputPath: input.outputPath, width: 1280, height: 720, durationMs: 8_000, hasAudio: true, sha256: 'b'.repeat(64), projectRevision: input.project.revision }
      },
    }
    const exportId = 'export_1234567890abcdef'
    const state = savedProjectState()
    const port = await listen(createSanverseServer({
      dataRoot: 'unused',
      maxUploadBytes: 100,
      repository: { ...spy.repository, ...state.repository },
      mediaProbe: stubMediaProbe(),
      renderService,
      exportIdGenerator: () => exportId,
    }))

    // No edit list is sent. The server compiles what it has stored, so a
    // tampered or stale client cannot cause an export that differs from the
    // project the user approved.
    const created = await call(port, { method: 'POST', path: `/api/projects/${PROJECT_ID}/exports` })
    expect(created.status).toBe(201)
    expect(JSON.parse(new TextDecoder().decode(created.body))).toMatchObject({
      id: exportId,
      mediaUrl: `/api/projects/${PROJECT_ID}/exports/${exportId}/media`,
      sha256: 'b'.repeat(64),
    })
    expect(exportCalls).toHaveLength(1)
    expect(exportCalls[0].outputPath).toBe(EXPORT_OUTPUT_PATH(exportId))

    const media = await call(port, { path: `/api/projects/${PROJECT_ID}/exports/${exportId}/media`, headers: { range: 'bytes=0-7' } })
    expect(media.status).toBe(206)
    expect(new TextDecoder().decode(media.body)).toBe('rendered')
  })

  it('returns a safe actionable code when the operating system blocks the renderer process', async () => {
    const spy = readRepository(new TextEncoder().encode('unused'))
    const renderService = {
      async exportProject() {
        throw Object.assign(new Error('raw operating system detail must stay local'), { code: 'RENDER_PROCESS_BLOCKED' })
      },
    }
    const state = savedProjectState()
    const port = await listen(createSanverseServer({
      dataRoot: 'unused',
      maxUploadBytes: 100,
      repository: { ...spy.repository, ...state.repository },
      mediaProbe: stubMediaProbe(),
      renderService,
      exportIdGenerator: () => 'export_1234567890abcdef',
    }))

    const response = await call(port, { method: 'POST', path: `/api/projects/${PROJECT_ID}/exports` })

    expect(response.status).toBe(503)
    expect(JSON.parse(new TextDecoder().decode(response.body))).toEqual({
      error: 'The local renderer process was blocked from starting.',
      code: 'RENDER_PROCESS_BLOCKED',
    })
    expect(new TextDecoder().decode(response.body)).not.toContain('raw operating system detail')
  })

  it('creates, edits, undoes, and reopens a project with the server owning the revision', async () => {
    const spy = readRepository(mp4())
    const state = savedProjectState()
    const port = await listen(createSanverseServer({
      dataRoot: 'unused',
      maxUploadBytes: 100,
      repository: { ...spy.repository, ...state.repository },
      mediaProbe: stubMediaProbe(),
    }))

    const listed = await call(port, { path: '/api/projects' })
    expect(listed.status).toBe(200)
    expect(JSON.parse(new TextDecoder().decode(listed.body))).toEqual({ projects: [MANIFEST] })

    // Opening a project with no saved state builds one from the real media, so
    // the engine finally knows how long the video actually is.
    const opened = await call(port, { path: `/api/projects/${PROJECT_ID}` })
    const openedBody = JSON.parse(new TextDecoder().decode(opened.body))
    expect(openedBody).toMatchObject({ ...MANIFEST, project: { schemaVersion: 'sanverse.project/v4', revision: 0 } })
    expect(openedBody.project.composition.width).toBe(1280)

    const accepted = await sendJson(port, 'POST', `/api/projects/${PROJECT_ID}/change-sets`, { changeSet: changeSet(0) })
    expect(accepted.status).toBe(201)
    expect(JSON.parse(new TextDecoder().decode(accepted.body)).project.revision).toBe(1)

    // A change set built against a revision that has moved on fails closed
    // rather than overwriting newer work.
    const stale = await sendJson(port, 'POST', `/api/projects/${PROJECT_ID}/change-sets`, { changeSet: changeSet(0, 'changeset_bbbbbbbb') })
    expect(stale.status).toBe(409)
    expect(JSON.parse(new TextDecoder().decode(stale.body)).code).toBe('REVISION_CONFLICT')

    const undone = await call(port, { method: 'POST', path: `/api/projects/${PROJECT_ID}/undo` })
    expect(undone.status).toBe(200)
    expect(JSON.parse(new TextDecoder().decode(undone.body)).project.changeSets).toHaveLength(0)

    const redone = await call(port, { method: 'POST', path: `/api/projects/${PROJECT_ID}/redo` })
    expect(redone.status).toBe(200)
    expect(JSON.parse(new TextDecoder().decode(redone.body)).project.changeSets).toHaveLength(1)

    const switchedOff = await sendJson(port, 'PUT', `/api/projects/${PROJECT_ID}/change-sets/changeset_aaaaaaaa/active`, { active: false })
    expect(switchedOff.status).toBe(200)
    expect(JSON.parse(new TextDecoder().decode(switchedOff.body)).project.changeSets[0].active).toBe(false)

    const reopened = await call(port, { path: `/api/projects/${PROJECT_ID}` })
    expect(JSON.parse(new TextDecoder().decode(reopened.body)).project.changeSets[0].active).toBe(false)
    expect(JSON.parse(state.serialized() ?? '{}').schemaVersion).toBe('sanverse.project/v4')
  })

  it('upgrades a saved v1 project on open without losing or moving an edit', async () => {
    const spy = readRepository(mp4())
    const state = savedProjectState(JSON.stringify({
      schemaVersion: 'sanverse.project/v1',
      projectId: PROJECT_ID,
      history: {
        accepted: [{ schemaVersion: 'sanverse.action/v1', actionId: 'action-1', kind: 'add-nameplate', target: { x: 0.2, y: 0.3, sourceTimeMs: 1_000 }, primaryText: 'Santosh', secondaryText: '', startMs: 1_000, durationMs: 5_000 }],
        redoStack: [],
        issuedActionIds: ['action-1'],
      },
    }))
    const port = await listen(createSanverseServer({
      dataRoot: 'unused',
      maxUploadBytes: 100,
      repository: { ...spy.repository, ...state.repository },
      mediaProbe: stubMediaProbe(),
    }))

    const opened = await call(port, { path: `/api/projects/${PROJECT_ID}` })
    const project = JSON.parse(new TextDecoder().decode(opened.body)).project
    expect(project.schemaVersion).toBe('sanverse.project/v4')
    expect(project.changeSets).toHaveLength(1)
    expect(project.changeSets[0].changeSet.operations[0].primaryText).toBe('Santosh')
    // v1 put the corner on the clicked point. Migrating to the new centre
    // default would shift a nameplate in a video the owner already approved.
    expect(project.changeSets[0].changeSet.operations[0].target.anchor).toBe('top-left')
    expect(JSON.parse(state.serialized() ?? '{}').schemaVersion).toBe('sanverse.project/v4')
  })

  it('returns a pending AI proposal without changing the saved project', async () => {
    const spy = readRepository(mp4())
    const state = savedProjectState()
    const port = await listen(createSanverseServer({
      dataRoot: 'unused',
      maxUploadBytes: 100,
      repository: { ...spy.repository, ...state.repository },
      mediaProbe: stubMediaProbe(),
    }))

    // Opening the project creates and saves revision 0.
    await call(port, { path: `/api/projects/${PROJECT_ID}` })
    const before = state.serialized()

    const response = await sendJson(port, 'POST', `/api/projects/${PROJECT_ID}/intents`, {
      message: 'add a nameplate saying "Santosh" "Founder"',
      baseRevision: 0,
      context: {
        clipId: 'clip_1234567890ab',
        sampledClipTimeTicks: 2_000 * 1_440,
        point: { x: 0.4, y: 0.7 },
        playheadTicks: 2_000 * 1_440,
        compositionDurationTicks: 8_000 * 1_440,
        compositionWidth: 1280,
        compositionHeight: 720,
      },
    })

    expect(response.status).toBe(200)
    const { outcome } = JSON.parse(new TextDecoder().decode(response.body))
    expect(outcome.kind).toBe('proposal')
    expect(outcome.changeSet.provenance.source).toBe('ai')
    expect(outcome.changeSet.operations[0].primaryText).toBe('Santosh')
    // The whole point: asking changed nothing on disk.
    expect(state.serialized()).toBe(before)
  })

  it('stays on the offline fake even when the environment names a real provider', async () => {
    // Provider configuration is read once, in `main()`, which only runs when
    // server.ts is executed directly. A test importing the module can therefore
    // never be redirected onto a network by a stray environment variable — this
    // asserts that, so "no test called out" is a proved fact and not a habit.
    const previous = process.env.SANVERSE_AI_PROVIDER
    const previousUrl = process.env.SANVERSE_AI_BASE_URL
    process.env.SANVERSE_AI_PROVIDER = 'openai-compatible'
    process.env.SANVERSE_AI_BASE_URL = 'https://example.invalid/v1'
    try {
      const spy = readRepository(mp4())
      const state = savedProjectState()
      const port = await listen(createSanverseServer({
        dataRoot: 'unused',
        maxUploadBytes: 100,
        repository: { ...spy.repository, ...state.repository },
        mediaProbe: stubMediaProbe(),
      }))
      await call(port, { path: `/api/projects/${PROJECT_ID}` })

      const response = await sendJson(port, 'POST', `/api/projects/${PROJECT_ID}/intents`, {
        message: 'add a nameplate saying "Santosh"',
        baseRevision: 0,
        context: {
          clipId: 'clip_1234567890ab',
          sampledClipTimeTicks: 2_000 * 1_440,
          point: { x: 0.4, y: 0.7 },
          playheadTicks: 2_000 * 1_440,
          compositionDurationTicks: 8_000 * 1_440,
          compositionWidth: 1280,
          compositionHeight: 720,
        },
      })

      const { outcome } = JSON.parse(new TextDecoder().decode(response.body))
      // A real call to example.invalid could only have produced a rejection.
      expect(outcome.kind).toBe('proposal')
    } finally {
      if (previous === undefined) delete process.env.SANVERSE_AI_PROVIDER
      else process.env.SANVERSE_AI_PROVIDER = previous
      if (previousUrl === undefined) delete process.env.SANVERSE_AI_BASE_URL
      else process.env.SANVERSE_AI_BASE_URL = previousUrl
    }
  })

  it('refuses an AI proposal built against a revision the project has moved past', async () => {
    const spy = readRepository(mp4())
    const state = savedProjectState()
    const port = await listen(createSanverseServer({
      dataRoot: 'unused',
      maxUploadBytes: 100,
      repository: { ...spy.repository, ...state.repository },
      mediaProbe: stubMediaProbe(),
    }))
    await call(port, { path: `/api/projects/${PROJECT_ID}` })

    const response = await sendJson(port, 'POST', `/api/projects/${PROJECT_ID}/intents`, {
      message: 'add "Santosh"',
      baseRevision: 99,
      context: {
        clipId: 'clip_1234567890ab',
        sampledClipTimeTicks: null,
        point: { x: 0.4, y: 0.7 },
        playheadTicks: 0,
        compositionDurationTicks: 8_000 * 1_440,
        compositionWidth: 1280,
        compositionHeight: 720,
      },
    })

    const { outcome } = JSON.parse(new TextDecoder().decode(response.body))
    expect(outcome.kind).toBe('rejected')
    expect(outcome.code).toBe('STALE_REVISION')
  })

  it('serves the exact font the exporter uses so the preview can match it', async () => {
    const fontDir = await mkdtemp(join(tmpdir(), 'sanverse-font-'))
    const fontPath = join(fontDir, 'font.ttf')
    await writeFile(fontPath, 'font-bytes')
    const spy = readRepository(mp4())
    const port = await listen(createSanverseServer({ dataRoot: 'unused', maxUploadBytes: 100, repository: spy.repository, fontPath }))

    const response = await call(port, { path: '/api/render-assets/nameplate-font' })
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toBe('font/ttf')
    expect(new TextDecoder().decode(response.body)).toBe('font-bytes')
  })
})
