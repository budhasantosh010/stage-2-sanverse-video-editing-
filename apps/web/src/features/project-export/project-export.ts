export type ProjectExportResult = {
  id: string
  mediaUrl: string
  sha256: string
  width: number
  height: number
  durationMs: number
  hasAudio: boolean
}

/**
 * Which half of the export is running, as reported by the server.
 *
 * Derived on the server from real milestones and sent down as `phase`, so the
 * browser never holds its own copy of the thresholds. 'queued' means no work
 * has started; 'rendering' means FFmpeg is encoding; 'verifying' means FFmpeg
 * finished and the file is being checked.
 */
export type ProjectExportPhase = 'queued' | 'rendering' | 'verifying'

export type ProjectExportState =
  | { status: 'idle' }
  | { status: 'rendering'; phase: ProjectExportPhase; jobId: string | null; startedAt: number }
  | { status: 'ready'; result: ProjectExportResult }
  | { status: 'error'; message: string }
  | { status: 'timed-out'; jobId: string; elapsedMs: number; phase: ProjectExportPhase }

/**
 * How long the browser waits before it stops claiming an export is coming.
 *
 * This is NOT a fix for a slow renderer, and raising it is not a fix for a
 * stalled one. It exists because the previous loop polled
 * `while (status === 'queued' || status === 'running')` with no bound at all,
 * so any job the server never finished produced a spinner that could not end
 * and said nothing. Ten minutes is far longer than any observed successful
 * export; passing it means something is wrong and the user must be told.
 */
export const EXPORT_CLIENT_TIMEOUT_MS = 10 * 60_000

/** One plain sentence per phase. Never a percentage the renderer cannot measure. */
export const exportPhaseMessage = (phase: ProjectExportPhase): string => {
  switch (phase) {
    case 'queued':
      return 'Waiting to start…'
    case 'verifying':
      return 'Checking the finished MP4…'
    default:
      return 'Rendering your MP4…'
  }
}

/** Elapsed time as m:ss, so a stalled export is visibly stalled. */
export const formatExportElapsed = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export type ProjectExportProgress = Readonly<{
  jobId: string
  phase: ProjectExportPhase
  elapsedMs: number
}>

/**
 * The browser gave up waiting. The server job is deliberately left alive.
 *
 * Cancelling it here would throw away a render that may be seconds from
 * finishing. Retrying re-posts the same project revision, which the server
 * treats idempotently and re-attaches to this very job.
 */
export class ProjectExportTimeout extends Error {
  readonly jobId: string
  readonly elapsedMs: number
  readonly phase: ProjectExportPhase

  constructor(jobId: string, elapsedMs: number, phase: ProjectExportPhase) {
    super('The export is taking longer than expected.')
    this.name = 'ProjectExportTimeout'
    this.jobId = jobId
    this.elapsedMs = elapsedMs
    this.phase = phase
  }
}

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
  phase: 'queued' | 'rendering' | 'verifying' | 'done'
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
    typeof job.phase === 'string' &&
    ['queued', 'rendering', 'verifying', 'done'].includes(job.phase) &&
    typeof job.progress === 'number' &&
    Number.isFinite(job.progress) &&
    job.progress >= 0 &&
    job.progress <= 1
  )
}

/** The phase to show while a job is still unfinished. */
function activePhase(job: ExportJobResponse): ProjectExportPhase {
  return job.phase === 'done' ? 'rendering' : job.phase
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
export type ExportProjectOptions = Readonly<{
  onProgress?: (progress: ProjectExportProgress) => void
  /** Override only for tests; production uses EXPORT_CLIENT_TIMEOUT_MS. */
  timeoutMs?: number
  now?: () => number
}>

export async function exportProject(
  projectId: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
  options: ExportProjectOptions = {},
): Promise<ProjectExportResult> {
  if (!PROJECT_ID.test(projectId)) throw new Error(EXPORT_ERROR)
  const now = options.now ?? (() => Date.now())
  const timeoutMs = options.timeoutMs ?? EXPORT_CLIENT_TIMEOUT_MS
  const startedAt = now()
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
    /** Only reported while the job is genuinely unfinished. */
    const reportProgress = () => {
      if (job.status !== 'queued' && job.status !== 'running') return
      options.onProgress?.({ jobId: job.jobId, phase: activePhase(job), elapsedMs: now() - startedAt })
    }
    reportProgress()
    while (job.status === 'queued' || job.status === 'running') {
      if (now() - startedAt >= timeoutMs) {
        // Stop waiting, but leave the job running. It may still finish, and its
        // result stays valid and downloadable; what must not continue is a
        // spinner that tells the user something is coming when nothing may be.
        throw new ProjectExportTimeout(job.jobId, now() - startedAt, activePhase(job))
      }
      await waitForPoll(signal)
      const polled = await fetcher(`/api/projects/${projectId}/export-jobs/${job.jobId}`, { signal })
      if (polled.status !== 200) throw new Error('export job unavailable')
      const value: unknown = await polled.json()
      if (!isExportJob(value, projectId)) throw new Error('invalid export job response')
      job = value
      reportProgress()
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
    // Deliberately NOT cancelled: a timed-out job is left to finish.
    if (error instanceof ProjectExportTimeout) throw error
    if (error instanceof ProjectExportError) throw error
    throw new ProjectExportError('EXPORT_FAILED', EXPORT_ERROR, { cause: error })
  }
}
