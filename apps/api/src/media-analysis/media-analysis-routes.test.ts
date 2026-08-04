import { once } from 'node:events'
import { request } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSanverseServer } from '../server.ts'
import type { ProjectRepository } from '../projects/project-repository.ts'
import { AnalysisError, type AnalysisRequest } from './analysis-request.ts'
import type { MediaAnalysisService } from './media-analysis-service.ts'

/**
 * Gate D — the three addresses the browser asks for preview pictures at.
 *
 * The maker of pictures is replaced here, because what is under test is the
 * ROUTE: what it accepts, what it refuses, what it puts in the headers, and
 * what it never lets out.
 */

const servers: Array<ReturnType<typeof createSanverseServer>> = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))))
})

const PROJECT = 'project_aaaaaaaaaaaaaaaa'
const VALID = 'assetId=asset_aaaaaaaa&assetVersion=aaaaaaaaaaaaaaaa'

const call = (port: number, path: string) =>
  new Promise<{ status: number; headers: Record<string, unknown>; body: Buffer }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method: 'GET', path }, async (res) => {
      const chunks: Buffer[] = []
      for await (const chunk of res) chunks.push(Buffer.from(chunk))
      resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) })
    })
    req.on('error', reject)
    req.end()
  })

const start = async (service: MediaAnalysisService) => {
  const server = createSanverseServer({
    dataRoot: 'unused',
    maxUploadBytes: 1_000,
    repository: {} as unknown as ProjectRepository,
    mediaAnalysisService: service,
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return (server.address() as { port: number }).port
}

const stubService = (
  produce: MediaAnalysisService['produce'],
): MediaAnalysisService => Object.freeze({
  produce,
  diagnostics: () => Object.freeze({ activeFrames: 0, activeWaveforms: 0, queued: 0, sharedJobs: 0 }),
  cache: {} as MediaAnalysisService['cache'],
})

describe('asking for a preview picture', () => {
  it('serves the bytes with the type the maker gave them', async () => {
    const seen: AnalysisRequest[] = []
    const port = await start(stubService(async ({ request: analysisRequest }) => {
      seen.push(analysisRequest)
      return { bytes: Buffer.from('WEBPfake'), contentType: 'image/webp' }
    }))

    const response = await call(port, `/api/projects/${PROJECT}/media-analysis/frame?${VALID}&sourceTicks=1440000&width=64`)
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toBe('image/webp')
    expect(response.body.toString()).toBe('WEBPfake')
    // A user's file is never rendered as a document.
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(seen[0]).toEqual({
      kind: 'filmstrip-frame',
      assetId: 'asset_aaaaaaaa',
      assetVersion: 'aaaaaaaaaaaaaaaa',
      sourceTicks: 1_440_000,
      widthPx: 64,
    })
  })

  it('lets the browser keep it, because the address names the exact bytes', async () => {
    const port = await start(stubService(async () => ({ bytes: Buffer.from('x'), contentType: 'image/webp' })))
    const response = await call(port, `/api/projects/${PROJECT}/media-analysis/frame?${VALID}&sourceTicks=0&width=64`)
    expect(String(response.headers['cache-control'])).toContain('immutable')
    expect(String(response.headers['cache-control'])).toContain('private')
  })

  it('routes the sound shape and the picture to their own kinds', async () => {
    const kinds: string[] = []
    const port = await start(stubService(async ({ request: analysisRequest }) => {
      kinds.push(analysisRequest.kind)
      return { bytes: Buffer.from('{}'), contentType: 'application/json; charset=utf-8' }
    }))
    await call(port, `/api/projects/${PROJECT}/media-analysis/waveform?${VALID}&sourceTicks=0&spanTicks=1440000&peakCount=64`)
    await call(port, `/api/projects/${PROJECT}/media-analysis/image-thumbnail?${VALID}&width=64&height=64`)
    expect(kinds).toEqual(['waveform-block', 'image-thumbnail'])
  })
})

describe('what the route refuses', () => {
  it('refuses a project name that is not a project name, without asking the maker', async () => {
    const produce = vi.fn()
    const port = await start(stubService(produce as unknown as MediaAnalysisService['produce']))
    const response = await call(port, `/api/projects/..%2f..%2fetc/media-analysis/frame?${VALID}&sourceTicks=0&width=64`)
    expect(response.status).toBe(404)
    expect(produce).not.toHaveBeenCalled()
  })

  it('refuses an address carrying a name it does not know', async () => {
    const produce = vi.fn()
    const port = await start(stubService(produce as unknown as MediaAnalysisService['produce']))
    const response = await call(
      port,
      `/api/projects/${PROJECT}/media-analysis/frame?${VALID}&sourceTicks=0&width=64&path=C:%5Cwindows`,
    )
    expect(response.status).toBe(400)
    expect(JSON.parse(response.body.toString()).code).toBe('ANALYSIS_KEY_INVALID')
    expect(produce).not.toHaveBeenCalled()
  })

  it('passes a refusal through with its code and its plain sentence', async () => {
    const port = await start(stubService(async () => {
      throw new AnalysisError('ASSET_MISSING', 'That file is no longer where the project left it.', 410)
    }))
    const response = await call(port, `/api/projects/${PROJECT}/media-analysis/frame?${VALID}&sourceTicks=0&width=64`)
    expect(response.status).toBe(410)
    const body = JSON.parse(response.body.toString())
    expect(body.code).toBe('ASSET_MISSING')
    expect(body.error).toBe('That file is no longer where the project left it.')
  })

  it('never lets a path or a command line out in a refusal', async () => {
    const port = await start(stubService(async () => {
      throw new AnalysisError('DECODER_FAILED', 'That part of the file could not be read.', 502)
    }))
    const response = await call(port, `/api/projects/${PROJECT}/media-analysis/frame?${VALID}&sourceTicks=0&width=64`)
    expect(response.body.toString()).not.toMatch(/ffmpeg|scale=|[A-Za-z]:\\|\/home\/|\/Users\//)
  })

  it('says nothing at all when the browser has already gone away', async () => {
    // 499 means nobody is listening. There is nothing honest to say and nobody
    // to say it to, so the connection is simply dropped.
    const port = await start(stubService(async () => {
      throw new AnalysisError('ANALYSIS_CANCELLED', 'That preview was no longer needed.', 499)
    }))
    await expect(call(port, `/api/projects/${PROJECT}/media-analysis/frame?${VALID}&sourceTicks=0&width=64`))
      .rejects.toThrow()
  })
})

describe('what the machine will admit to', () => {
  it('reports how much decoding is happening, so the bound can be observed', async () => {
    const port = await start(Object.freeze({
      produce: async () => ({ bytes: Buffer.from('x'), contentType: 'image/webp' }),
      diagnostics: () => Object.freeze({ activeFrames: 2, activeWaveforms: 1, queued: 7, sharedJobs: 3 }),
      cache: {} as MediaAnalysisService['cache'],
    }))
    const response = await call(port, '/api/diagnostics')
    expect(JSON.parse(response.body.toString()).mediaAnalysis)
      .toEqual({ activeFrames: 2, activeWaveforms: 1, queued: 7, sharedJobs: 3 })
  })
})
