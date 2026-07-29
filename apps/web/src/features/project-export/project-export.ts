export type ProjectExportResult = {
  id: string
  mediaUrl: string
  sha256: string
  width: number
  height: number
  durationMs: number
  hasAudio: boolean
}

export type ProjectExportState =
  | { status: 'idle' }
  | { status: 'rendering' }
  | { status: 'ready'; result: ProjectExportResult }
  | { status: 'error'; message: string }

const PROJECT_ID = /^project_[a-z0-9]{16,64}$/
const EXPORT_ID = /^export_[a-z0-9]{16,64}$/
const EXPORT_JOB_ID = /^job_[a-z0-9]{16,64}$/
const EXPORT_ERROR = 'We could not export the video. Your accepted edits are still safe.'
const EXPORT_ERROR_CODES = [
  'RENDER_PROJECT_INVALID',
  'NOTHING_TO_RENDER',
  'RENDER_INPUT_INVALID',
  'RENDER_TOOL_UNAVAILABLE',
  'RENDER_PROCESS_BLOCKED',
  'RENDER_CANCELLED',
  'RENDER_PATH_INVALID',
  'RENDER_FAILED',
  'RENDER_OUTPUT_MISSING',
  'RENDER_OUTPUT_INVALID',
] as const

export type ProjectExportErrorCode = (typeof EXPORT_ERROR_CODES)[number] | 'EXPORT_FAILED'

export class ProjectExportError extends Error {
  readonly code: ProjectExportErrorCode

  constructor(code: ProjectExportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProjectExportError'
    this.code = code
  }
}

function isExportErrorCode(value: unknown): value is Exclude<ProjectExportErrorCode, 'EXPORT_FAILED'> {
  return typeof value === 'string' && (EXPORT_ERROR_CODES as readonly string[]).includes(value)
}

function exportErrorMessage(code: ProjectExportErrorCode): string {
  if (code === 'RENDER_PROCESS_BLOCKED') {
    return 'The renderer was blocked from starting. Restart Sanverse in PowerShell, then retry. Your accepted edits are still safe. Code: RENDER_PROCESS_BLOCKED.'
  }
  if (code === 'RENDER_TOOL_UNAVAILABLE') {
    return 'The local renderer is unavailable. Restart Sanverse after checking FFmpeg, then retry. Your accepted edits are still safe. Code: RENDER_TOOL_UNAVAILABLE.'
  }
  if (code === 'RENDER_INPUT_INVALID' || code === 'RENDER_PROJECT_INVALID' || code === 'NOTHING_TO_RENDER') {
    return `The accepted edit cannot be rendered as requested. Adjust it, then retry. Your accepted edits are still safe. Code: ${code}.`
  }
  if (code === 'RENDER_CANCELLED') {
    return 'The export was cancelled. Retry when you are ready. Your accepted edits are still safe. Code: RENDER_CANCELLED.'
  }
  if (code !== 'EXPORT_FAILED') {
    return `The renderer could not produce a verified MP4. Retry the export. Your accepted edits are still safe. Code: ${code}.`
  }
  return EXPORT_ERROR
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isExportResult(value: unknown, projectId: string): value is ProjectExportResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  return (
    typeof result.id === 'string' && EXPORT_ID.test(result.id) &&
    result.mediaUrl === `/api/projects/${projectId}/exports/${result.id}/media` &&
    typeof result.sha256 === 'string' && /^[a-f0-9]{64}$/.test(result.sha256) &&
    isPositiveInteger(result.width) && isPositiveInteger(result.height) && isPositiveInteger(result.durationMs) &&
    typeof result.hasAudio === 'boolean'
  )
}

type ExportJobResponse = {
  jobId: string
  projectId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  progress: number
  result?: ProjectExportResult
  error?: { code: string; message: string }
}

function isExportJob(value: unknown, projectId: string): value is ExportJobResponse {
  if (typeof value !== 'object' || value === null) return false
  const job = value as Record<string, unknown>
  return (
    typeof job.jobId === 'string' && EXPORT_JOB_ID.test(job.jobId) &&
    job.projectId === projectId &&
    typeof job.status === 'string' &&
    ['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(job.status) &&
    typeof job.progress === 'number' &&
    Number.isFinite(job.progress) &&
    job.progress >= 0 &&
    job.progress <= 1
  )
}

function waitForPoll(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(done, 350)
    function done() {
      signal?.removeEventListener('abort', aborted)
      resolve()
    }
    function aborted() {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', aborted, { once: true })
  })
}

/**
 * Ask the server to export.
 *
 * No edit list is sent. The server compiles what it has stored, so what is
 * exported is always the project the user accepted — a stale or tampered
 * browser cannot cause a different video to be produced.
 */
export async function exportProject(
  projectId: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectExportResult> {
  if (!PROJECT_ID.test(projectId)) throw new Error(EXPORT_ERROR)
  let activeJobId: string | undefined
  try {
    const response = await fetcher(`/api/projects/${projectId}/exports`, {
      method: 'POST',
      signal,
    })
    if (response.status !== 202) {
      let code: ProjectExportErrorCode = 'EXPORT_FAILED'
      try {
        const failure: unknown = await response.json()
        if (typeof failure === 'object' && failure !== null && isExportErrorCode((failure as { code?: unknown }).code)) {
          code = (failure as { code: Exclude<ProjectExportErrorCode, 'EXPORT_FAILED'> }).code
        }
      } catch {
        // The stable generic message remains the fallback for malformed failure bodies.
      }
      throw new ProjectExportError(code, exportErrorMessage(code))
    }
    const created: unknown = await response.json()
    if (!isExportJob(created, projectId)) throw new Error('invalid export job response')
    let job = created
    activeJobId = job.jobId
    while (job.status === 'queued' || job.status === 'running') {
      await waitForPoll(signal)
      const polled = await fetcher(`/api/projects/${projectId}/export-jobs/${job.jobId}`, { signal })
      if (polled.status !== 200) throw new Error('export job unavailable')
      const value: unknown = await polled.json()
      if (!isExportJob(value, projectId)) throw new Error('invalid export job response')
      job = value
    }
    if (job.status === 'succeeded' && isExportResult(job.result, projectId)) return job.result
    const code = isExportErrorCode(job.error?.code) ? job.error.code : 'EXPORT_FAILED'
    throw new ProjectExportError(code, exportErrorMessage(code))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (activeJobId) {
        void fetcher(`/api/projects/${projectId}/export-jobs/${activeJobId}`, { method: 'DELETE' }).catch(() => undefined)
      }
      throw error
    }
    if (error instanceof ProjectExportError) throw error
    throw new ProjectExportError('EXPORT_FAILED', EXPORT_ERROR, { cause: error })
  }
}
