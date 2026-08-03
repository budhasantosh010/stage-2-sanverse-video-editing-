import { randomBytes } from 'node:crypto'
import { mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import type { EditProject } from '@sanverse/edit-domain'

export const EXPORT_JOB_ID_PATTERN = /^job_[a-z0-9]{16,64}$/
const EXPORT_ID_PATTERN = /^export_[a-z0-9]{16,64}$/
const PROJECT_ID_PATTERN = /^project_[a-z0-9]{16,64}$/
const IDEMPOTENCY_KEY_PATTERN = /^[a-f0-9]{64}$/

export type ExportJobResult = {
  readonly id: string
  readonly mediaUrl: string
  readonly sha256: string
  readonly width: number
  readonly height: number
  readonly durationMs: number
  readonly hasAudio: boolean
  readonly projectRevision: number
}

export type ExportJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type LocalExportJob = {
  readonly schemaVersion: 'sanverse.local-export-job/v1'
  readonly jobId: string
  readonly projectId: string
  readonly projectRevision: number
  readonly idempotencyKey: string
  readonly exportId: string
  readonly status: ExportJobStatus
  readonly progress: number
  readonly attempts: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly projectSnapshot: EditProject
  readonly result?: ExportJobResult
  readonly error?: { readonly code: string; readonly message: string }
}

/**
 * Progress values that mean something real.
 *
 * The renderer cannot honestly measure how far through an encode it is, so
 * these are not a percentage — they are the two boundaries the renderer
 * genuinely knows it crossed. Keeping the thresholds here, and deriving the
 * phase on the server, means the browser never holds a second copy of these
 * numbers that could drift away from this one.
 */
export const EXPORT_RENDERING_PROGRESS = 0.2
export const EXPORT_VERIFYING_PROGRESS = 0.85

export type ExportJobPhase = 'queued' | 'rendering' | 'verifying' | 'done'

export function exportJobPhase(job: Pick<LocalExportJob, 'status' | 'progress'>): ExportJobPhase {
  if (job.status === 'queued') return 'queued'
  if (job.status !== 'running') return 'done'
  return job.progress >= EXPORT_VERIFYING_PROGRESS ? 'verifying' : 'rendering'
}

export type PublicExportJob = Omit<LocalExportJob, 'projectSnapshot' | 'idempotencyKey'> & {
  readonly phase: ExportJobPhase
}

export type LocalExportJobStore = ReturnType<typeof createLocalExportJobStore>

function publicJob(job: LocalExportJob): PublicExportJob {
  const { projectSnapshot: _snapshot, idempotencyKey: _key, ...safe } = job
  return { ...safe, phase: exportJobPhase(job) }
}

function validateJob(value: unknown): LocalExportJob {
  if (typeof value !== 'object' || value === null) throw new Error('Stored export job is invalid.')
  const job = value as LocalExportJob
  if (
    job.schemaVersion !== 'sanverse.local-export-job/v1' ||
    !EXPORT_JOB_ID_PATTERN.test(job.jobId) ||
    !PROJECT_ID_PATTERN.test(job.projectId) ||
    !EXPORT_ID_PATTERN.test(job.exportId) ||
    !IDEMPOTENCY_KEY_PATTERN.test(job.idempotencyKey) ||
    !Number.isSafeInteger(job.projectRevision) ||
    job.projectRevision < 0 ||
    !['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(job.status) ||
    !Number.isFinite(job.progress) ||
    job.progress < 0 ||
    job.progress > 1 ||
    !Number.isSafeInteger(job.attempts) ||
    job.attempts < 0 ||
    typeof job.projectSnapshot !== 'object' ||
    job.projectSnapshot === null
  ) {
    throw new Error('Stored export job is invalid.')
  }
  return job
}

export function createLocalExportJobStore(dataRoot: string, now: () => Date = () => new Date()) {
  const root = join(resolve(dataRoot), 'jobs')
  let createGate: Promise<void> = Promise.resolve()
  const pathFor = (jobId: string) => {
    if (!EXPORT_JOB_ID_PATTERN.test(jobId)) throw new Error('Export job ID is invalid.')
    return join(root, `${jobId}.json`)
  }

  async function write(job: LocalExportJob): Promise<void> {
    await mkdir(root, { recursive: true })
    const finalPath = pathFor(job.jobId)
    const temporaryPath = join(root, `.job-${randomBytes(12).toString('hex')}.tmp`)
    const handle = await open(temporaryPath, 'wx', 0o600)
    try {
      await handle.writeFile(`${JSON.stringify(job)}\n`, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporaryPath, finalPath)
    const directory = await open(dirname(finalPath), 'r')
    try {
      await directory.sync().catch((error: unknown) => {
        if (process.platform !== 'win32' || typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'EPERM') throw error
      })
    } finally {
      await directory.close()
    }
  }

  async function read(jobId: string): Promise<LocalExportJob | null> {
    try {
      return validateJob(JSON.parse(await readFile(pathFor(jobId), 'utf8')))
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null
      throw error
    }
  }

  async function list(): Promise<readonly LocalExportJob[]> {
    await mkdir(root, { recursive: true })
    const names = await readdir(root)
    const jobs = await Promise.all(names
      .filter((name) => /^job_[a-z0-9]{16,64}\.json$/.test(name))
      .map((name) => read(name.slice(0, -5))))
    return jobs.filter((job): job is LocalExportJob => job !== null)
  }

  async function update(
    jobId: string,
    change: Partial<Omit<LocalExportJob, 'jobId' | 'projectId' | 'projectRevision' | 'idempotencyKey' | 'exportId' | 'createdAt' | 'projectSnapshot'>>,
  ): Promise<LocalExportJob> {
    const current = await read(jobId)
    if (!current) throw new Error('Export job was not found.')
    const next = validateJob({ ...current, ...change, updatedAt: now().toISOString() })
    await write(next)
    return next
  }

  return {
    publicJob,
    async create(input: {
      jobId: string
      project: EditProject
      exportId: string
      idempotencyKey: string
    }): Promise<{ job: LocalExportJob; created: boolean }> {
      let release!: () => void
      const previous = createGate
      createGate = new Promise<void>((resolve) => { release = resolve })
      await previous
      try {
        const existing = (await list()).find((job) =>
          job.projectId === input.project.projectId &&
          job.idempotencyKey === input.idempotencyKey,
        )
        if (existing) return { job: existing, created: false }
        const timestamp = now().toISOString()
        const job = validateJob({
          schemaVersion: 'sanverse.local-export-job/v1',
          jobId: input.jobId,
          projectId: input.project.projectId,
          projectRevision: input.project.revision,
          idempotencyKey: input.idempotencyKey,
          exportId: input.exportId,
          status: 'queued',
          progress: 0,
          attempts: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          projectSnapshot: input.project,
        })
        await write(job)
        return { job, created: true }
      } finally {
        release()
      }
    },
    read,
    list,
    update,
    async recoverRunnable(): Promise<readonly LocalExportJob[]> {
      const runnable: LocalExportJob[] = []
      for (const job of await list()) {
        if (job.status !== 'queued' && job.status !== 'running') continue
        const recovered = job.status === 'running'
          ? await update(job.jobId, { status: 'queued', progress: 0, error: undefined })
          : job
        runnable.push(recovered)
      }
      return runnable
    },
    async remove(jobId: string): Promise<void> {
      await rm(pathFor(jobId), { force: true })
    },
  }
}
