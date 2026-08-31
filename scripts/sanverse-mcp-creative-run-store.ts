import { createHash, randomBytes } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { validateCreativeRunV1, type CreativeRunV1 } from '@sanverse/creative-production-adapter'
import { SANVERSE_ROOT } from './sanverse-mcp-shared.ts'

const PROJECT_ID = /^project_[a-z0-9]{16,64}$/u
const RUN_ID = /^run_[a-z0-9]{8,64}$/u
const REVIEW_ID = /^review_[a-z0-9]{8,64}$/u
const ARTIFACT_ID = /^[a-z0-9][a-z0-9._:-]{3,179}$/u
const MAX_RUN_BYTES = 16 * 1024 * 1024
const MAX_REVIEW_ARTIFACT_BYTES = 16 * 1024 * 1024
const projectsRoot = resolve(SANVERSE_ROOT, '.sanverse-data', 'projects')

const samePath = (a: string, b: string): boolean => process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b)
const within = (root: string, candidate: string): boolean => {
  const rootResolved = resolve(root)
  const candidateResolved = resolve(candidate)
  if (samePath(rootResolved, candidateResolved)) return true
  const prefix = rootResolved.endsWith(sep) ? rootResolved : `${rootResolved}${sep}`
  return process.platform === 'win32' ? candidateResolved.toLowerCase().startsWith(prefix.toLowerCase()) : candidateResolved.startsWith(prefix)
}

const assertId = (value: string, pattern: RegExp, label: string): void => {
  if (!pattern.test(value)) throw new Error(`CREATIVE_RUN_STORE_INVALID: ${label} is invalid.`)
}

const ensureRegularDirectory = async (path: string, root: string): Promise<string> => {
  if (!within(root, path)) throw new Error('CREATIVE_RUN_STORE_INVALID: requested path escapes project storage.')
  await mkdir(path, { recursive: true })
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('CREATIVE_RUN_STORE_INVALID: storage directory is not a regular directory.')
  const actual = await realpath(path)
  if (!samePath(actual, path) || !within(root, actual)) throw new Error('CREATIVE_RUN_STORE_INVALID: storage directory resolves through a link or outside project storage.')
  return actual
}

const projectRoot = async (projectId: string): Promise<string> => {
  assertId(projectId, PROJECT_ID, 'projectId')
  await mkdir(projectsRoot, { recursive: true })
  return ensureRegularDirectory(resolve(projectsRoot, projectId), projectsRoot)
}

const runRoot = async (projectId: string, runId: string, create = true): Promise<string> => {
  assertId(runId, RUN_ID, 'runId')
  const project = await projectRoot(projectId)
  const runs = await ensureRegularDirectory(resolve(project, 'creative-runs'), project)
  const target = resolve(runs, runId)
  if (create) return ensureRegularDirectory(target, runs)
  const info = await lstat(target).catch(() => null)
  if (!info?.isDirectory() || info.isSymbolicLink()) throw new Error('CREATIVE_RUN_NOT_FOUND: persisted run does not exist.')
  const actual = await realpath(target)
  if (!samePath(actual, target) || !within(runs, actual)) throw new Error('CREATIVE_RUN_STORE_INVALID: persisted run resolves outside project storage.')
  return actual
}

const atomicWrite = async (path: string, bytes: Uint8Array): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`
  try {
    await writeFile(temp, bytes, { flag: 'wx' })
    await rename(temp, path)
  } finally {
    await rm(temp, { force: true }).catch(() => undefined)
  }
}

export const writeCreativeRunFileV1 = async (run: CreativeRunV1): Promise<void> => {
  const validated = validateCreativeRunV1(run)
  if (!validated.ok) throw new Error(`${validated.code}: ${validated.message}`)
  const root = await runRoot(run.projectId, run.runId, true)
  const bytes = Buffer.from(`${JSON.stringify(validated.value, null, 2)}\n`, 'utf8')
  if (bytes.byteLength > MAX_RUN_BYTES) throw new Error('CREATIVE_RUN_STORE_INVALID: run.json exceeds 16 MiB.')
  await atomicWrite(resolve(root, 'run.json'), bytes)
}

export const readCreativeRunFileV1 = async (input: Readonly<{ projectId: string; runId: string }>): Promise<CreativeRunV1 | null> => {
  const root = await runRoot(input.projectId, input.runId, false).catch((error) => {
    if (error instanceof Error && error.message.startsWith('CREATIVE_RUN_NOT_FOUND:')) return null
    throw error
  })
  if (!root) return null
  const path = resolve(root, 'run.json')
  const info = await lstat(path).catch(() => null)
  if (!info) return null
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_RUN_BYTES) throw new Error('CREATIVE_RUN_REHYDRATION_FAILED: run.json is not a bounded regular file.')
  const actual = await realpath(path)
  if (!samePath(actual, path) || !within(root, actual)) throw new Error('CREATIVE_RUN_REHYDRATION_FAILED: run.json resolves through a link or outside its run directory.')
  const text = await readFile(actual, 'utf8')
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('CREATIVE_RUN_REHYDRATION_FAILED: run.json is invalid JSON.') }
  const validated = validateCreativeRunV1(parsed)
  if (!validated.ok) throw new Error(`${validated.code}: ${validated.message}`)
  if (validated.value.projectId !== input.projectId || validated.value.runId !== input.runId) throw new Error('CREATIVE_RUN_REHYDRATION_FAILED: persisted run identity does not match its storage path.')
  return validated.value
}

export const listCreativeRunFilesV1 = async (projectId: string): Promise<readonly CreativeRunV1[]> => {
  const project = await projectRoot(projectId)
  const runsRoot = await ensureRegularDirectory(resolve(project, 'creative-runs'), project)
  const entries = await readdir(runsRoot, { withFileTypes: true })
  const runs: CreativeRunV1[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !RUN_ID.test(entry.name)) continue
    const run = await readCreativeRunFileV1({ projectId, runId: entry.name }).catch(() => null)
    if (run) runs.push(run)
  }
  return Object.freeze(runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.runId.localeCompare(b.runId)))
}

const artifactPath = async (input: Readonly<{ projectId: string; runId: string; reviewId: string; artifactId: string }>, create = false): Promise<string> => {
  assertId(input.reviewId, REVIEW_ID, 'reviewId')
  assertId(input.artifactId, ARTIFACT_ID, 'artifactId')
  const root = await runRoot(input.projectId, input.runId, create)
  const reviews = create ? await ensureRegularDirectory(resolve(root, 'reviews'), root) : resolve(root, 'reviews')
  const review = create ? await ensureRegularDirectory(resolve(reviews, input.reviewId), reviews) : resolve(reviews, input.reviewId)
  const files = create ? await ensureRegularDirectory(resolve(review, 'artifacts'), review) : resolve(review, 'artifacts')
  const target = resolve(files, input.artifactId)
  if (!within(files, target)) throw new Error('CREATIVE_RUN_STORE_INVALID: review artifact path escapes its review directory.')
  return target
}

export const writeCreativeReviewArtifactV1 = async (input: Readonly<{ projectId: string; runId: string; reviewId: string; artifactId: string; bytes: Uint8Array }>): Promise<Readonly<{ byteLength: number; sha256: string }>> => {
  if (input.bytes.byteLength < 1 || input.bytes.byteLength > MAX_REVIEW_ARTIFACT_BYTES) throw new Error('CREATIVE_REVIEW_ARTIFACT_INVALID: review artifact size is outside the bounded contract.')
  const path = await artifactPath(input, true)
  await atomicWrite(path, input.bytes)
  return Object.freeze({ byteLength: input.bytes.byteLength, sha256: createHash('sha256').update(input.bytes).digest('hex') })
}

export const readCreativeReviewArtifactV1 = async (input: Readonly<{ projectId: string; runId: string; reviewId: string; artifactId: string }>): Promise<Uint8Array> => {
  const path = await artifactPath(input, false)
  const info = await lstat(path).catch(() => null)
  if (!info?.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > MAX_REVIEW_ARTIFACT_BYTES) throw new Error('CREATIVE_REVIEW_ARTIFACT_NOT_FOUND: bounded review artifact is unavailable.')
  const actual = await realpath(path)
  const root = await runRoot(input.projectId, input.runId, false)
  if (!samePath(actual, path) || !within(root, actual)) throw new Error('CREATIVE_REVIEW_ARTIFACT_INVALID: review artifact resolves outside the run directory.')
  return new Uint8Array(await readFile(actual))
}
