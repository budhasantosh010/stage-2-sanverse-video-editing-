import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

import { createFilesystemProjectRepository } from './projects/filesystem-project-repository.ts'
import { createProjectIntakeService, EXPORT_ID_PATTERN, PROJECT_ID_PATTERN, ProjectIntakeError, type ProjectRepository } from './projects/project-repository.ts'
import { createFfmpegRenderAdapter } from './render/ffmpeg-render-adapter.ts'
import { createRenderService } from './render/render-service.ts'

type ServerOptions = {
  dataRoot: string
  maxUploadBytes: number
  allowedOrigins?: readonly string[]
  repository?: ProjectRepository
  renderService?: ReturnType<typeof createRenderService>
  exportIdGenerator?: () => string
  fontPath?: string
}

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
    throw new ApiRequestError('REQUEST_TOO_LARGE', 'The export request is too large.')
  }
  const chunks: Buffer[] = []
  let received = 0
  for await (const raw of request) {
    const chunk = Buffer.from(raw)
    received += chunk.byteLength
    if (received > declared || received > MAX_EXPORT_REQUEST_BYTES) throw new ApiRequestError('REQUEST_TOO_LARGE', 'The export request is too large.')
    chunks.push(chunk)
  }
  if (received !== declared) throw new ApiRequestError('INVALID_JSON', 'The export request ended unexpectedly.')
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ApiRequestError('INVALID_JSON', 'The export request is not valid JSON.') }
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

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined
}

export function createSanverseServer(options: ServerOptions) {
  const repository = options.repository ?? createFilesystemProjectRepository(options.dataRoot)
  const intake = createProjectIntakeService({
    repository,
    maxUploadBytes: options.maxUploadBytes,
    idGenerator: () => `project_${randomBytes(16).toString('hex')}`,
  })
  const allowedOrigins = new Set(options.allowedOrigins ?? ['http://127.0.0.1:2000', 'http://localhost:2000'])
  const renderService = options.renderService ?? (options.fontPath ? createRenderService({ renderer: createFfmpegRenderAdapter({ fontPath: options.fontPath }) }) : undefined)
  const generateExportId = options.exportIdGenerator ?? (() => `export_${randomBytes(16).toString('hex')}`)

  return createServer(async (request, response) => {
    const origin = firstHeader(request, 'origin')
    if (origin && !allowedOrigins.has(origin)) {
      request.resume()
      json(response, 403, { error: 'Cross-origin requests are not allowed.' })
      return
    }

    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
    try {
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

      const createExportMatch = /^\/api\/projects\/([^/]+)\/exports$/.exec(requestUrl.pathname)
      if (request.method === 'POST' && createExportMatch) {
        const projectId = createExportMatch[1]
        if (!PROJECT_ID_PATTERN.test(projectId)) { request.resume(); json(response, 404, { error: 'Project was not found.' }); return }
        if (!renderService) { request.resume(); json(response, 503, { error: 'The local renderer is not configured.' }); return }
        const payload = await readJsonBody(request)
        if (typeof payload !== 'object' || payload === null || !('history' in payload)) throw new ApiRequestError('INVALID_JSON', 'Accepted edit history is required.')
        const exportId = generateExportId()
        if (!EXPORT_ID_PATTERN.test(exportId)) throw new Error('exportIdGenerator returned an invalid opaque export ID.')
        const paths = await repository.allocateExport(projectId, exportId)
        const controller = new AbortController()
        const cancelDisconnectedRender = () => { if (!response.writableEnded) controller.abort() }
        request.once('aborted', cancelDisconnectedRender)
        response.once('close', cancelDisconnectedRender)
        try {
          const result = await renderService.exportAccepted({ history: (payload as { history: unknown }).history, ...paths, signal: controller.signal })
          if (resolve(result.outputPath) !== resolve(paths.outputPath)) throw new Error('Renderer returned an unexpected output path.')
          if (controller.signal.aborted || response.destroyed) return
          json(response, 201, {
            id: exportId,
            mediaUrl: `/api/projects/${projectId}/exports/${exportId}/media`,
            sha256: result.sha256,
            width: result.width,
            height: result.height,
            durationMs: result.durationMs,
            hasAudio: result.hasAudio,
          })
        } finally {
          request.off('aborted', cancelDisconnectedRender)
          response.off('close', cancelDisconnectedRender)
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
        response.writeHead(range ? 206 : 200, {
          'content-type': 'video/mp4',
          'content-length': media.end - media.start + 1,
          'accept-ranges': 'bytes',
          ...(range ? { 'content-range': `bytes ${media.start}-${media.end}/${media.size}` } : {}),
          'cache-control': 'private, no-store',
        })
        response.flushHeaders()
        await streamMedia(response, media.body)
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
        response.writeHead(range ? 206 : 200, {
          'content-type': 'video/mp4', 'content-length': media.end - media.start + 1, 'accept-ranges': 'bytes',
          ...(range ? { 'content-range': `bytes ${media.start}-${media.end}/${media.size}` } : {}),
          'cache-control': 'private, no-store',
          'content-disposition': `attachment; filename="sanverse-${exportId}.mp4"`,
        })
        response.flushHeaders()
        await streamMedia(response, media.body)
        return
      }

      json(response, 404, { error: 'Not found.' })
    } catch (error) {
      if (response.headersSent) {
        if (!response.destroyed) response.destroy(error instanceof Error ? error : undefined)
        return
      }
      const code = errorCode(error)
      if (code === 'INVALID_RANGE') {
        response.writeHead(416, { 'content-range': 'bytes */0', 'cache-control': 'no-store' })
        response.end()
        return
      }
      if (code === 'PROJECT_NOT_FOUND' || code === 'INVALID_PROJECT_ID' || code === 'EXPORT_NOT_FOUND' || code === 'INVALID_EXPORT_ID') {
        json(response, 404, { error: 'Project media was not found.' })
        return
      }
      if (error instanceof ApiRequestError) {
        json(response, error.code === 'REQUEST_TOO_LARGE' ? 413 : 400, { error: error.message, code: error.code })
        return
      }
      if (code === 'RENDER_HISTORY_INVALID' || code === 'NOTHING_TO_RENDER' || code === 'RENDER_INPUT_INVALID') {
        json(response, 400, { error: 'The accepted edits cannot be exported.', code })
        return
      }
      if (code === 'RENDER_TOOL_UNAVAILABLE') {
        json(response, 503, { error: 'The local renderer is unavailable.', code })
        return
      }
      if (code === 'RENDER_CANCELLED') {
        if (!response.destroyed) json(response, 408, { error: 'Export was cancelled.', code })
        return
      }
      if (error instanceof ProjectIntakeError) {
        request.resume()
        const status = error.code === 'UPLOAD_TOO_LARGE' ? 413 : error.code === 'PROJECT_COLLISION' ? 409 : 400
        json(response, status, { error: error.message, code: error.code })
        return
      }
      console.error('Local API request failed.', error)
      json(response, 500, { error: 'The local API could not complete the request.' })
    }
  })
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
  const server = createSanverseServer({ dataRoot, maxUploadBytes: parseConfiguredLimit(process.env.SANVERSE_MAX_UPLOAD_BYTES), fontPath })
  server.listen(2001, '127.0.0.1', () => {
    console.log('Sanverse local API listening on http://127.0.0.1:2001')
  })
}
