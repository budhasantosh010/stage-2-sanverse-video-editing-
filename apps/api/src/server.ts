import { createHash, randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

import { createFilesystemProjectRepository } from './projects/filesystem-project-repository.ts'
import { createProjectIntakeService, EXPORT_ID_PATTERN, PROJECT_ID_PATTERN, ProjectIntakeError, type ProjectRepository } from './projects/project-repository.ts'
import { createProjectStateService, type ProjectStateService } from './projects/project-state-service.ts'
import { ASSET_SCHEMA_VERSION, NAMEPLATE_COMPONENT_ID } from '@sanverse/edit-domain'
import { RENDER_PLAN_SCHEMA_VERSION } from '@sanverse/render-contract'
import {
  contentTypeFor,
  createFfprobeMediaDescriber,
  createFfprobeMediaProbe,
  type MediaDescriberPort,
  type MediaProbePort,
} from './media/media-probe.ts'
import { describeFailure, errorCode } from './http/failure-response.ts'
import { createFakeIntentAdapter } from './intent/fake-intent-adapter.ts'
import { createIntentProvider, describeIntentProvider, resolveIntentProviderConfig } from './intent/intent-provider-config.ts'
import type { IntentProviderPort } from './intent/intent-port.ts'
import { createIntentService, type IntentService } from './intent/intent-service.ts'
import { buildCaptionsChangeSet } from './transcripts/build-captions.ts'
import { createFfmpegRenderAdapter } from './render/ffmpeg-render-adapter.ts'
import { createRenderService } from './render/render-service.ts'
import { buildLocalDiagnostics } from './diagnostics/local-diagnostics.ts'
import {
  createLocalExportJobStore,
  EXPORT_JOB_ID_PATTERN,
  EXPORT_RENDERING_PROGRESS,
  EXPORT_VERIFYING_PROGRESS,
  type LocalExportJobStore,
} from './jobs/local-export-job-store.ts'
import {
  buildPortableProjectArchive,
  restorePortableProject,
} from './projects/portable-project.ts'

type ServerOptions = {
  dataRoot: string
  maxUploadBytes: number
  allowedOrigins?: readonly string[]
  repository?: ProjectRepository
  renderService?: ReturnType<typeof createRenderService>
  projectStateService?: ProjectStateService
  mediaProbe?: MediaProbePort
  mediaDescriber?: MediaDescriberPort
  exportIdGenerator?: () => string
  exportJobIdGenerator?: () => string
  exportJobStore?: LocalExportJobStore
  fontPath?: string
  /** Swaps only the provider; the safety pipeline around it is unchanged. */
  intentProvider?: IntentProviderPort
  intentService?: IntentService
}

const CHANGE_SET_ID_ROUTE_PATTERN = /^changeset_[a-z0-9]{8,64}$/
const ASSET_ID_PATTERN = /^asset_[a-z0-9]{8,64}$/

const MAX_EXPORT_REQUEST_BYTES = 1024 * 1024

class ApiRequestError extends Error {
  readonly code: 'INVALID_JSON' | 'REQUEST_TOO_LARGE'
  constructor(code: ApiRequestError['code'], message: string) { super(message); this.code = code; this.name = 'ApiRequestError' }
}

function json(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' })
  response.end(body)
}

function firstHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? undefined : value
}

function parseContentLength(value: string | undefined): number | undefined {
  if (value === undefined || !/^(0|[1-9]\d*)$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = (firstHeader(request, 'content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
  const declared = parseContentLength(firstHeader(request, 'content-length'))
  if (contentType !== 'application/json' || declared === undefined || declared <= 0) {
    request.resume()
    throw new ApiRequestError('INVALID_JSON', 'A bounded JSON request is required.')
  }
  if (declared > MAX_EXPORT_REQUEST_BYTES) {
    request.resume()
    throw new ApiRequestError('REQUEST_TOO_LARGE', 'The JSON request is too large.')
  }
  const chunks: Buffer[] = []
  let received = 0
  for await (const raw of request) {
    const chunk = Buffer.from(raw)
    received += chunk.byteLength
    if (received > declared || received > MAX_EXPORT_REQUEST_BYTES) throw new ApiRequestError('REQUEST_TOO_LARGE', 'The JSON request is too large.')
    chunks.push(chunk)
  }
  if (received !== declared) throw new ApiRequestError('INVALID_JSON', 'The JSON request ended unexpectedly.')
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ApiRequestError('INVALID_JSON', 'The request is not valid JSON.') }
}

function parseRange(value: string | undefined, size: number): { start: number; end: number } | undefined {
  if (!value) return undefined
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || (match[1] === '' && match[2] === '')) throw Object.assign(new Error('invalid range'), { code: 'INVALID_RANGE' })
  if (match[1] === '') {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw Object.assign(new Error('invalid range'), { code: 'INVALID_RANGE' })
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(match[1])
  const requestedEnd = match[2] === '' ? size - 1 : Number(match[2])
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= size || requestedEnd < start) {
    throw Object.assign(new Error('invalid range'), { code: 'INVALID_RANGE' })
  }
  const end = Math.min(requestedEnd, size - 1)
  return { start, end }
}

function waitForWritable(response: ServerResponse): Promise<void> {
  return new Promise((resolve, reject) => {
    const onDrain = () => { cleanup(); resolve() }
    const onClose = () => { cleanup(); reject(new Error('Media client closed.')) }
    const onError = (error: Error) => { cleanup(); reject(error) }
    const cleanup = () => {
      response.off('drain', onDrain)
      response.off('close', onClose)
      response.off('error', onError)
    }
    response.once('drain', onDrain)
    response.once('close', onClose)
    response.once('error', onError)
  })
}

async function streamMedia(response: ServerResponse, body: AsyncIterable<Uint8Array>): Promise<void> {
  const iterator = body[Symbol.asyncIterator]()
  let completed = false
  let closed = false
  const cancel = () => {
    if (completed) return
    closed = true
    void iterator.return?.().catch(() => undefined)
  }
  response.once('close', cancel)
  response.once('error', cancel)
  try {
    while (true) {
      const next = await iterator.next()
      if (next.done) {
        completed = true
        break
      }
      if (closed || response.destroyed) throw new Error('Media client closed.')
      if (!response.write(next.value)) await waitForWritable(response)
    }
    if (!closed && !response.destroyed) response.end()
  } finally {
    response.off('close', cancel)
    response.off('error', cancel)
    if (!completed) await iterator.return?.().catch(() => undefined)
  }
}

export function createSanverseServer(options: ServerOptions) {
  const repository = options.repository ?? createFilesystemProjectRepository(options.dataRoot)
  const intake = createProjectIntakeService({
    repository,
    maxUploadBytes: options.maxUploadBytes,
    idGenerator: () => `project_${randomBytes(16).toString('hex')}`,
  })
  const allowedOrigins = new Set(options.allowedOrigins ?? ['http://127.0.0.1:2000', 'http://localhost:2000'])
  const mediaProbe = options.mediaProbe ?? createFfprobeMediaProbe()
  const mediaDescriber = options.mediaDescriber ?? createFfprobeMediaDescriber()
  const projectState = options.projectStateService ?? createProjectStateService({ repository, mediaProbe })
  const renderService = options.renderService ?? (options.fontPath ? createRenderService({ renderer: createFfmpegRenderAdapter({ fontPath: options.fontPath, mediaProbe }) }) : undefined)
  const generateExportId = options.exportIdGenerator ?? (() => `export_${randomBytes(16).toString('hex')}`)
  const generateExportJobId = options.exportJobIdGenerator ?? (() => `job_${randomBytes(16).toString('hex')}`)
  const exportJobs = options.exportJobStore ?? createLocalExportJobStore(options.dataRoot)
  const runningExportJobs = new Map<string, AbortController>()
  // The fake provider is the default on purpose. Nothing leaves this machine
  // until a real provider is deliberately configured and the owner has approved
  // what the outbound allowlist sends.
  const intentProvider = options.intentProvider ?? createFakeIntentAdapter()
  const intentService = options.intentService ?? createIntentService({
    provider: intentProvider,
    loadProject: (projectId) => projectState.load(projectId),
    createOperationId: () => `operation_${randomBytes(16).toString('hex')}`,
  })

  /**
   * Start work for a job this process is not already running.
   *
   * A job recorded as `running` with no live process behind it is an orphan:
   * the previous server was stopped mid-render, or the export route was reached
   * again for the same project revision. Before this, such a job was handed
   * straight back to the browser and never executed, and the browser polled a
   * status that could not change — an export spinner that could never end.
   */
  const startExportJob = async (jobId: string): Promise<void> => {
    if (runningExportJobs.has(jobId) || !renderService) return
    const current = await exportJobs.read(jobId)
    if (!current) return
    if (current.status === 'running') {
      await exportJobs.update(jobId, { status: 'queued', progress: 0, error: undefined })
    } else if (current.status !== 'queued') {
      return
    }
    await executeExportJob(jobId)
  }

  const executeExportJob = async (jobId: string): Promise<void> => {
    if (runningExportJobs.has(jobId) || !renderService) return
    const initial = await exportJobs.read(jobId)
    if (!initial || initial.status !== 'queued') return
    const controller = new AbortController()
    runningExportJobs.set(jobId, controller)
    try {
      const job = await exportJobs.update(jobId, {
        status: 'running',
        progress: 0.05,
        attempts: initial.attempts + 1,
        error: undefined,
      })
      const paths = await repository.allocateExport(job.projectId, job.exportId)
      const extraSourcePaths: Record<string, string> = {}
      for (const asset of job.projectSnapshot.assets) {
        if (asset.storageRef === `project/${job.projectId}/source`) continue
        const path = await repository.resolveAssetPath(job.projectId, asset.assetId).catch(() => null)
        if (path !== null) extraSourcePaths[asset.assetId] = path
      }
      await exportJobs.update(jobId, { progress: 0.15 })
      // Two real boundaries, not an invented percentage. EXPORT_RENDERING_PROGRESS
      // means FFmpeg started; EXPORT_VERIFYING_PROGRESS means FFmpeg exited 0 and
      // the file is being checked. The browser reads these thresholds back to
      // tell the user which half of the export is slow.
      let milestoneWrites: Promise<unknown> = Promise.resolve()
      const result = await renderService.exportProject({
        project: job.projectSnapshot,
        ...paths,
        extraSourcePaths,
        signal: controller.signal,
        onMilestone: (milestone) => {
          const progress = milestone === 'verifying'
            ? EXPORT_VERIFYING_PROGRESS
            : EXPORT_RENDERING_PROGRESS
          milestoneWrites = milestoneWrites
            .then(() => exportJobs.update(jobId, { progress }))
            .catch(() => undefined)
        },
      })
      await milestoneWrites
      if (resolve(result.outputPath) !== resolve(paths.outputPath)) throw new Error('Renderer returned an unexpected output path.')
      const current = await exportJobs.read(jobId)
      if (controller.signal.aborted || current?.status === 'cancelled') return
      await exportJobs.update(jobId, {
        status: 'succeeded',
        progress: 1,
        result: {
          id: job.exportId,
          mediaUrl: `/api/projects/${job.projectId}/exports/${job.exportId}/media`,
          sha256: result.sha256,
          width: result.width,
          height: result.height,
          durationMs: result.durationMs,
          hasAudio: result.hasAudio,
          projectRevision: result.projectRevision,
        },
      })
    } catch (error) {
      const current = await exportJobs.read(jobId).catch(() => null)
      if (current?.status !== 'cancelled') {
        const answer = describeFailure(error)
        await exportJobs.update(jobId, {
          status: controller.signal.aborted ? 'cancelled' : 'failed',
          progress: 1,
          error: controller.signal.aborted
            ? { code: 'RENDER_CANCELLED', message: 'Export was cancelled.' }
            : {
                code: answer?.code ?? errorCode(error) ?? 'EXPORT_FAILED',
                message: answer?.message ?? 'The local renderer could not complete this export.',
              },
        }).catch(() => undefined)
      }
    } finally {
      runningExportJobs.delete(jobId)
    }
  }

  const server = createServer(async (request, response) => {
    const origin = firstHeader(request, 'origin')
    if (origin && !allowedOrigins.has(origin)) {
      request.resume()
      json(response, 403, { error: 'Cross-origin requests are not allowed.' })
      return
    }

    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
    try {
      if (request.method === 'GET' && requestUrl.pathname === '/api/diagnostics') {
        const jobs = await exportJobs.list()
        json(response, 200, buildLocalDiagnostics({
          rendererConfigured: renderService !== undefined,
          intentProviderName: intentProvider.name,
          jobs: {
            queued: jobs.filter((job) => job.status === 'queued').length,
            running: jobs.filter((job) => job.status === 'running').length,
            failed: jobs.filter((job) => job.status === 'failed').length,
          },
        }))
        return
      }
      if (request.method === 'POST' && requestUrl.pathname === '/api/projects') {
        const filename = firstHeader(request, 'x-sanverse-filename')
        if (!filename) {
          request.resume()
          json(response, 400, { error: 'X-Sanverse-Filename is required.' })
          return
        }
        const project = await intake.create({
          filename,
          contentType: firstHeader(request, 'content-type'),
          contentLength: parseContentLength(firstHeader(request, 'content-length')),
          body: request,
        })
        json(response, 201, project)
        return
      }

      if (request.method === 'GET' && requestUrl.pathname === '/api/projects') {
        json(response, 200, { projects: await repository.listProjects() })
        return
      }

      // The exact font the exporter will use, so the browser preview can draw
      // with the same glyphs instead of whatever font the operating system
      // happens to supply.
      if (request.method === 'GET' && requestUrl.pathname === '/api/render-assets/nameplate-font') {
        if (!options.fontPath) { json(response, 503, { error: 'The render font is not configured.' }); return }
        const info = await stat(options.fontPath).catch(() => undefined)
        if (!info?.isFile()) { json(response, 503, { error: 'The render font is not available.' }); return }
        response.writeHead(200, {
          'content-type': 'font/ttf',
          'content-length': info.size,
          'cache-control': 'private, max-age=3600',
        })
        await streamMedia(response, createReadStream(options.fontPath))
        return
      }

      const projectMatch = /^\/api\/projects\/([^/]+)$/.exec(requestUrl.pathname)
      if (request.method === 'GET' && projectMatch) {
        const projectId = projectMatch[1]
        if (!PROJECT_ID_PATTERN.test(projectId)) { json(response, 404, { error: 'Project was not found.' }); return }
        const manifest = await repository.readProject(projectId)
        json(response, 200, { ...manifest, project: await projectState.load(projectId) })
        return
      }

      // Editing routes are server-authoritative: the browser asks for a change
      // and is told the resulting project. It never declares the new state, so
      // a stale or tampered client cannot overwrite work it did not see.
      const changeSetsMatch = /^\/api\/projects\/([^/]+)\/change-sets$/.exec(requestUrl.pathname)
      if (request.method === 'POST' && changeSetsMatch) {
        const projectId = changeSetsMatch[1]
        if (!PROJECT_ID_PATTERN.test(projectId)) { request.resume(); json(response, 404, { error: 'Project was not found.' }); return }
        const payload = await readJsonBody(request)
        if (typeof payload !== 'object' || payload === null || !('changeSet' in payload)) {
          throw new ApiRequestError('INVALID_JSON', 'A change set is required.')
        }
        const project = await projectState.accept(projectId, (payload as { changeSet: unknown }).changeSet)
        json(response, 201, { project })
        return
      }

      // Captions from a transcript file the user already has.
      //
      // Nothing leaves the machine. The file is read, cut into readable lines
      // by fixed arithmetic, and handed to the SAME acceptance the browser uses
      // for every other edit — so captions cannot bypass revision fencing,
      // history, or Undo.
      const captionsMatch = /^\/api\/projects\/([^/]+)\/captions$/.exec(requestUrl.pathname)
      if (request.method === 'POST' && captionsMatch) {
        const projectId = captionsMatch[1]
        if (!PROJECT_ID_PATTERN.test(projectId)) { request.resume(); json(response, 404, { error: 'Project was not found.' }); return }
        const payload = await readJsonBody(request)
        const contents = typeof payload === 'object' && payload !== null
          ? (payload as { transcript?: unknown }).transcript
          : undefined
        if (typeof contents !== 'string' || contents.length === 0) {
          throw new ApiRequestError('INVALID_JSON', 'A transcript file is required.')
        }

        const current = await projectState.load(projectId)
        // Captions describe what is SPOKEN, so they belong to the footage —
        // never to a picture or a piece of music the project also holds.
        const asset = current.assets.find((candidate) => candidate.mediaKind === 'video')
        if (!asset) { json(response, 404, { error: 'Project was not found.' }); return }

        const built = buildCaptionsChangeSet({
          contents,
          asset,
          baseRevision: current.revision,
          ids: {
            transcriptId: `transcript_${randomBytes(16).toString('hex')}`,
            captionSetId: `captions_${randomBytes(16).toString('hex')}`,
            operationId: `operation_${randomBytes(16).toString('hex')}`,
            changeSetId: `changeset_${randomBytes(16).toString('hex')}`,
          },
        })
        if (!built.ok) {
          // A file that cannot be read is the user's problem to fix, not a
          // server fault, so it is a 400 with a sentence they can act on.
          json(response, 400, { error: built.error.message })
          return
        }

        const project = await projectState.accept(projectId, built.value.changeSet)
        // Everything the pipeline had to change is reported back, so the screen
        // can tell the user rather than quietly presenting an adjusted result.
        json(response, 201, {
          project,
          report: {
            cueCount: built.value.cueCount,
            adjustments: built.value.adjustments,
            skipped: built.value.skipped,
            language: built.value.transcript.language,
          },
        })
        return
      }

      // Asking the assistant for an edit. This route NEVER changes the project.
      // It returns a proposal the user has to accept through the ordinary
      // change-set route, which is what keeps "AI proposes, code executes"
      // true by construction rather than by discipline.
      const intentMatch = /^\/api\/projects\/([^/]+)\/intents$/.exec(requestUrl.pathname)
      if (request.method === 'POST' && intentMatch) {
        const projectId = intentMatch[1]
        if (!PROJECT_ID_PATTERN.test(projectId)) { request.resume(); json(response, 404, { error: 'Project was not found.' }); return }
        const payload = await readJsonBody(request)
        if (typeof payload !== 'object' || payload === null) {
          throw new ApiRequestError('INVALID_JSON', 'A request body is required.')
        }
        const body = payload as { message?: unknown; baseRevision?: unknown; context?: unknown; locale?: unknown }
        // The request ID is issued here, not by the browser, so one client
        // cannot replay or forge another's request identity.
        const outcome = await intentService.propose({
          schemaVersion: 'sanverse.intent-request/v1',
          requestId: `request_${randomBytes(16).toString('hex')}`,
          projectId,
          baseRevision: body.baseRevision,
          message: body.message,
          context: body.context,
          capabilityIds: [NAMEPLATE_COMPONENT_ID],
          locale: typeof body.locale === 'string' ? body.locale : 'en',
        })
        // Clarification, unsupported and rejected are ordinary product answers,
        // not transport failures, so they are all 200 with a typed outcome.
        json(response, 200, { outcome })
        return
      }

      const activeMatch = /^\/api\/projects\/([^/]+)\/change-sets\/([^/]+)\/active$/.exec(requestUrl.pathname)
      if (request.method === 'PUT' && activeMatch) {
        const [projectId, changeSetId] = activeMatch.slice(1)
        if (!PROJECT_ID_PATTERN.test(projectId) || !CHANGE_SET_ID_ROUTE_PATTERN.test(changeSetId)) {
          request.resume(); json(response, 404, { error: 'That edit was not found.' }); return
        }
        const payload = await readJsonBody(request)
        const active = typeof payload === 'object' && payload !== null ? (payload as { active?: unknown }).active : undefined
        if (typeof active !== 'boolean') throw new ApiRequestError('INVALID_JSON', 'A boolean "active" value is required.')
        json(response, 200, { project: await projectState.setActive(projectId, changeSetId, active) })
        return
      }

      const undoRedoMatch = /^\/api\/projects\/([^/]+)\/(undo|redo)$/.exec(requestUrl.pathname)
      if (request.method === 'POST' && undoRedoMatch) {
        const [projectId, operation] = undoRedoMatch.slice(1)
        request.resume()
        if (!PROJECT_ID_PATTERN.test(projectId)) { json(response, 404, { error: 'Project was not found.' }); return }
        const project = operation === 'undo'
          ? await projectState.undo(projectId)
          : await projectState.redo(projectId)
        json(response, 200, { project })
        return
      }

      const createExportMatch = /^\/api\/projects\/([^/]+)\/exports$/.exec(requestUrl.pathname)
      if (request.method === 'POST' && createExportMatch) {
        const projectId = createExportMatch[1]
        if (!PROJECT_ID_PATTERN.test(projectId)) { request.resume(); json(response, 404, { error: 'Project was not found.' }); return }
        if (!renderService) { request.resume(); json(response, 503, { error: 'The local renderer is not configured.' }); return }
        request.resume()
        const project = await projectState.load(projectId)
        const exportId = generateExportId()
        const jobId = generateExportJobId()
        if (!EXPORT_ID_PATTERN.test(exportId)) throw new Error('exportIdGenerator returned an invalid opaque export ID.')
        if (!EXPORT_JOB_ID_PATTERN.test(jobId)) throw new Error('exportJobIdGenerator returned an invalid opaque job ID.')
        const idempotencyKey = createHash('sha256')
          .update(`${project.projectId}:${project.revision}:${RENDER_PLAN_SCHEMA_VERSION}`)
          .digest('hex')
        const created = await exportJobs.create({ jobId, project, exportId, idempotencyKey })
        json(response, 202, exportJobs.publicJob(created.job))
        void startExportJob(created.job.jobId)
        return
      }

      const exportJobMatch = /^\/api\/projects\/([^/]+)\/export-jobs\/([^/]+)$/.exec(requestUrl.pathname)
      if (exportJobMatch && (request.method === 'GET' || request.method === 'DELETE')) {
        request.resume()
        const [projectId, jobId] = exportJobMatch.slice(1)
        if (!PROJECT_ID_PATTERN.test(projectId) || !EXPORT_JOB_ID_PATTERN.test(jobId)) {
          json(response, 404, { error: 'Export job was not found.' })
          return
        }
        const job = await exportJobs.read(jobId)
        if (!job || job.projectId !== projectId) {
          json(response, 404, { error: 'Export job was not found.' })
          return
        }
        if (request.method === 'DELETE' && (job.status === 'queued' || job.status === 'running')) {
          runningExportJobs.get(jobId)?.abort()
          const cancelled = await exportJobs.update(jobId, {
            status: 'cancelled',
            progress: 1,
            error: { code: 'RENDER_CANCELLED', message: 'Export was cancelled.' },
          })
          json(response, 200, exportJobs.publicJob(cancelled))
          return
        }
        json(response, 200, exportJobs.publicJob(job))
        return
      }

      const retentionMatch = /^\/api\/projects\/([^/]+)\/retention$/.exec(requestUrl.pathname)
      if (request.method === 'GET' && retentionMatch) {
        const projectId = retentionMatch[1]
        if (!PROJECT_ID_PATTERN.test(projectId)) { json(response, 404, { error: 'Project was not found.' }); return }
        json(response, 200, {
          schemaVersion: 'sanverse.local-retention/v1',
          protected: ['source-media', 'project-state', 'imported-assets'],
          deletable: (await repository.listExports(projectId)).map((item) => ({
            kind: 'export',
            id: item.exportId,
            byteLength: item.size,
            modifiedAt: item.modifiedAt,
          })),
          automaticDeletion: false,
        })
        return
      }

      const portableMatch = /^\/api\/projects\/([^/]+)\/portable-archive$/.exec(requestUrl.pathname)
      if (portableMatch && (request.method === 'GET' || request.method === 'POST')) {
        const projectId = portableMatch[1]
        if (!PROJECT_ID_PATTERN.test(projectId)) { request.resume(); json(response, 404, { error: 'Project was not found.' }); return }
        if (request.method === 'GET') {
          json(response, 200, buildPortableProjectArchive(await projectState.load(projectId)))
          return
        }
        const archive = await readJsonBody(request)
        const restored = restorePortableProject(archive, await projectState.load(projectId))
        json(response, 200, { project: await projectState.restorePortable(projectId, restored) })
        return
      }

      const deleteExportMatch = /^\/api\/projects\/([^/]+)\/exports\/([^/]+)$/.exec(requestUrl.pathname)
      if (request.method === 'DELETE' && deleteExportMatch) {
        request.resume()
        const [projectId, exportId] = deleteExportMatch.slice(1)
        if (!PROJECT_ID_PATTERN.test(projectId) || !EXPORT_ID_PATTERN.test(exportId)) {
          json(response, 404, { error: 'Export was not found.' })
          return
        }
        await repository.deleteExport(projectId, exportId)
        response.writeHead(204, { 'cache-control': 'no-store' })
        response.end()
        return
      }

      // Bringing a second file into a project: B-roll, a picture, or music.
      //
      // This is NOT an edit. It creates no change set and no undo entry — the
      // user has put something on the shelf. What kind of thing it is is
      // decided by LOOKING AT THE FILE, never by trusting the name it arrived
      // with, because a name is something a user typed.
      const addAssetMatch = /^\/api\/projects\/([^/]+)\/assets$/.exec(requestUrl.pathname)
      if (request.method === 'POST' && addAssetMatch) {
        const projectId = addAssetMatch[1]
        if (!PROJECT_ID_PATTERN.test(projectId)) { request.resume(); json(response, 404, { error: 'Project was not found.' }); return }
        const assetId = `asset_${randomBytes(16).toString('hex')}`
        const staged = await repository.stageAsset({ projectId, assetId, body: request })

        let described
        try {
          described = await mediaDescriber.describe({ path: staged.path, cwd: staged.trustedWorkDir })
        } catch {
          json(response, 415, { error: 'That file is not a video, a picture, or a piece of music.' })
          return
        }

        // Every field is filled in for every kind. The ones that do not apply
        // to a kind are null rather than invented, so nothing downstream can
        // trust a number that was never measured.
        const shared = {
          schemaVersion: ASSET_SCHEMA_VERSION,
          assetId,
          storageRef: `project/${projectId}/assets/${assetId}`,
          sha256: staged.sha256,
          byteLength: staged.byteLength,
        }
        const asset = described.mediaKind === 'image'
          ? {
              ...shared,
              mediaKind: 'image' as const,
              duration: null,
              width: described.width,
              height: described.height,
              frameRate: null,
              hasAudio: false,
              durationResidualSeconds: 0,
            }
          : described.mediaKind === 'audio'
            ? {
                ...shared,
                mediaKind: 'audio' as const,
                duration: described.duration,
                width: null,
                height: null,
                frameRate: null,
                hasAudio: true,
                durationResidualSeconds: described.durationResidualSeconds,
              }
            : {
                ...shared,
                mediaKind: 'video' as const,
                duration: described.duration,
                width: described.width,
                height: described.height,
                frameRate: described.frameRate,
                hasAudio: described.hasAudio,
                durationResidualSeconds: described.durationResidualSeconds,
              }

        const project = await projectState.addAsset(projectId, asset)
        json(response, 201, {
          project,
          asset: {
            assetId,
            mediaKind: described.mediaKind,
            mediaUrl: `/api/projects/${projectId}/assets/${assetId}/media`,
          },
        })
        return
      }

      // Serving one of those files back, so the preview can draw the same
      // picture the export will contain.
      const assetMediaMatch = /^\/api\/projects\/([^/]+)\/assets\/([^/]+)\/media$/.exec(requestUrl.pathname)
      if (request.method === 'GET' && assetMediaMatch) {
        const [projectId, assetId] = assetMediaMatch.slice(1)
        if (!PROJECT_ID_PATTERN.test(projectId) || !ASSET_ID_PATTERN.test(assetId)) {
          json(response, 404, { error: 'That file was not found.' }); return
        }
        // The project must know about this file, so a file left on disk by a
        // failed upload can never be served.
        const current = await projectState.load(projectId)
        if (!current.assets.some((candidate) => candidate.assetId === assetId)) {
          json(response, 404, { error: 'That file was not found.' }); return
        }
        const assetPath = await repository.resolveAssetPath(projectId, assetId)
        const { trustedWorkDir } = await repository.resolveMediaPaths(projectId)
        // What to call it is worked out by reading the FILE, never from the
        // request and never from a name a user typed.
        const described = await mediaDescriber.describe({ path: assetPath, cwd: trustedWorkDir })
        const media = await repository.openAsset(projectId, assetId)
        try {
          response.writeHead(200, {
            'content-type': contentTypeFor(described),
            'content-length': media.end - media.start + 1,
            'accept-ranges': 'bytes',
            'cache-control': 'private, no-store',
            // A file the user supplied is never rendered as a document.
            'x-content-type-options': 'nosniff',
            'content-disposition': 'inline',
          })
          response.flushHeaders()
          await streamMedia(response, media.body)
        } finally {
          await media.close()
        }
        return
      }

      const mediaMatch = /^\/api\/projects\/([^/]+)\/media$/.exec(requestUrl.pathname)
      if (request.method === 'GET' && mediaMatch) {
        const projectId = mediaMatch[1]
        if (!PROJECT_ID_PATTERN.test(projectId)) {
          json(response, 404, { error: 'Project media was not found.' })
          return
        }
        const metadata = await repository.inspectMedia(projectId)
        const rangeHeader = firstHeader(request, 'range')
        let range: { start: number; end: number } | undefined
        try {
          range = parseRange(rangeHeader, metadata.size)
        } catch (error) {
          if (errorCode(error) !== 'INVALID_RANGE') throw error
          response.writeHead(416, { 'content-range': `bytes */${metadata.size}`, 'cache-control': 'no-store' })
          response.end()
          return
        }
        const media = await repository.openMedia(projectId, range)
        try {
          response.writeHead(range ? 206 : 200, {
            'content-type': 'video/mp4',
            'content-length': media.end - media.start + 1,
            'accept-ranges': 'bytes',
            ...(range ? { 'content-range': `bytes ${media.start}-${media.end}/${media.size}` } : {}),
            'cache-control': 'private, no-store',
          })
          response.flushHeaders()
          await streamMedia(response, media.body)
        } finally {
          await media.close()
        }
        return
      }

      const exportMediaMatch = /^\/api\/projects\/([^/]+)\/exports\/([^/]+)\/media$/.exec(requestUrl.pathname)
      if (request.method === 'GET' && exportMediaMatch) {
        const [projectId, exportId] = exportMediaMatch.slice(1)
        if (!PROJECT_ID_PATTERN.test(projectId) || !EXPORT_ID_PATTERN.test(exportId)) { json(response, 404, { error: 'Export media was not found.' }); return }
        const metadata = await repository.inspectExport(projectId, exportId)
        let range: { start: number; end: number } | undefined
        try { range = parseRange(firstHeader(request, 'range'), metadata.size) }
        catch {
          response.writeHead(416, { 'content-range': `bytes */${metadata.size}`, 'cache-control': 'no-store' })
          response.end(); return
        }
        const media = await repository.openExport(projectId, exportId, range)
        try {
          response.writeHead(range ? 206 : 200, {
            'content-type': 'video/mp4', 'content-length': media.end - media.start + 1, 'accept-ranges': 'bytes',
            ...(range ? { 'content-range': `bytes ${media.start}-${media.end}/${media.size}` } : {}),
            'cache-control': 'private, no-store',
            'content-disposition': `attachment; filename="sanverse-${exportId}.mp4"`,
          })
          response.flushHeaders()
          await streamMedia(response, media.body)
        } finally {
          await media.close()
        }
        return
      }

      json(response, 404, { error: 'Not found.' })
    } catch (error) {
      // Once bytes have gone out there is no honest way to change the status,
      // so the connection is broken rather than a truncated body being passed
      // off as a complete one.
      if (response.headersSent) {
        if (!response.destroyed) response.destroy(error instanceof Error ? error : undefined)
        return
      }
      // An upload that failed mid-body still has bytes queued behind it.
      if (error instanceof ProjectIntakeError) request.resume()

      const answer = error instanceof ApiRequestError
        ? { status: error.code === 'REQUEST_TOO_LARGE' ? 413 : 400, message: error.message, code: error.code }
        : describeFailure(error)

      if (!answer) {
        console.error('Local API request failed.', error)
        json(response, 500, { error: 'The local API could not complete the request.' })
        return
      }
      if (answer.log) console.error('Local API failed safely.', error)
      if (response.destroyed) return
      if (answer.emptyBody) {
        response.writeHead(answer.status, answer.headers ?? {})
        response.end()
        return
      }
      json(response, answer.status, { error: answer.message, ...(answer.code ? { code: answer.code } : {}) })
    }
  })

  if (renderService) {
    void exportJobs.recoverRunnable()
      .then((jobs) => Promise.all(jobs.map((job) => executeExportJob(job.jobId))))
      .catch((error) => console.error('Local export job recovery failed.', error))
  }
  return server
}

function parseConfiguredLimit(value: string | undefined): number {
  const configured = value === undefined ? 20 * 1024 * 1024 * 1024 : Number(value)
  if (!Number.isSafeInteger(configured) || configured <= 0) throw new Error('SANVERSE_MAX_UPLOAD_BYTES must be a positive safe integer.')
  return configured
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  const dataRoot = process.env.SANVERSE_DATA_DIR ?? fileURLToPath(new URL('../../../.sanverse-data', import.meta.url))
  const fontPath = process.env.SANVERSE_FONT_PATH ?? (process.platform === 'win32' ? 'C:\\Windows\\Fonts\\arial.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
  // Resolved before the server is built, so a broken provider configuration
  // stops startup instead of surfacing as a puzzling failure on the first
  // sentence the user types. It never falls back to the fake silently.
  const intentProviderConfig = resolveIntentProviderConfig(process.env)
  const server = createSanverseServer({
    dataRoot,
    maxUploadBytes: parseConfiguredLimit(process.env.SANVERSE_MAX_UPLOAD_BYTES),
    fontPath,
    intentProvider: createIntentProvider(intentProviderConfig),
  })
  server.listen(2001, '127.0.0.1', () => {
    console.log('Sanverse local API listening on http://127.0.0.1:2001')
    console.log(describeIntentProvider(intentProviderConfig))
  })
}
