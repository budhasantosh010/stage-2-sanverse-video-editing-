import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ChangeSet, EditProject } from '@sanverse/edit-domain'

export const SANVERSE_ROOT = fileURLToPath(new URL('..', import.meta.url))
export const SANVERSE_API_URL = process.env.SANVERSE_API_URL ?? 'http://127.0.0.1:2001'
export const SANVERSE_MCP_PORT = Number(process.env.SANVERSE_MCP_PORT ?? 4876)
export const SANVERSE_MCP_ENDPOINT = `http://127.0.0.1:${SANVERSE_MCP_PORT}/mcp`
export const SANVERSE_MCP_HEALTH = `http://127.0.0.1:${SANVERSE_MCP_PORT}/healthz`
export const SANVERSE_MCP_TOKEN_ENV = 'SANVERSE_MCP_TOKEN'
export const SANVERSE_MCP_TOKEN_PATH = resolve(SANVERSE_ROOT, '.sanverse-data', 'mcp', 'token')

export interface SanverseProjectManifestSummary {
  readonly id: string
  readonly originalFilename?: string
  readonly createdAt?: string
}

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`)
  return await response.json() as T
}

export const apiReady = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${SANVERSE_API_URL}/api/projects`, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

export const listProductionProjects = async (): Promise<readonly SanverseProjectManifestSummary[]> => {
  const payload = await fetchJson<{ projects?: SanverseProjectManifestSummary[] }>(`${SANVERSE_API_URL}/api/projects`)
  return Object.freeze([...(payload.projects ?? [])])
}

export const resolveProductionProjectId = async (): Promise<string> => {
  const configured = process.env.SANVERSE_MCP_PROJECT_ID?.trim()
  if (configured) return configured
  const projects = await listProductionProjects()
  const latest = projects[0]?.id
  if (!latest) throw new Error('No production-backed Sanverse project exists. Import or create a project first, or set SANVERSE_MCP_PROJECT_ID.')
  return latest
}

export const readProductionProject = async (projectId: string): Promise<EditProject> => {
  const payload = await fetchJson<{ project: EditProject }>(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(projectId)}`)
  if (!payload.project || payload.project.projectId !== projectId) throw new Error(`Production API did not return project ${projectId}.`)
  return payload.project
}

export interface ProductionCreativeArtifactRef {
  readonly artifactId: string
  readonly sha256: string
  readonly byteLength: number
}

export const putProductionCreativeArtifact = async (input: Readonly<{ projectId: string; serialized: string }>): Promise<Readonly<{ ref: ProductionCreativeArtifactRef; artifact: unknown }>> => {
  const payload = await fetchJson<{ artifactRef: ProductionCreativeArtifactRef; artifact: unknown }>(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(input.projectId)}/creative-artifacts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ serialized: input.serialized }),
  })
  return Object.freeze({ ref: Object.freeze({ ...payload.artifactRef }), artifact: payload.artifact })
}

export const readProductionCreativeArtifact = async (input: Readonly<{ projectId: string; artifactId: string }>): Promise<Readonly<{ ref: ProductionCreativeArtifactRef; artifact: unknown }>> => {
  const payload = await fetchJson<{ artifactRef: ProductionCreativeArtifactRef; artifact: unknown }>(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(input.projectId)}/creative-artifacts/${encodeURIComponent(input.artifactId)}`)
  return Object.freeze({ ref: Object.freeze({ ...payload.artifactRef }), artifact: payload.artifact })
}

export const acceptProductionChangeSet = async (input: Readonly<{ projectId: string; changeSet: ChangeSet }>): Promise<EditProject> => {
  const payload = await fetchJson<{ project: EditProject }>(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(input.projectId)}/change-sets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ changeSet: input.changeSet }),
  })
  return payload.project
}

export const undoProductionProject = async (projectId: string): Promise<EditProject> => {
  const payload = await fetchJson<{ project: EditProject }>(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(projectId)}/undo`, { method: 'POST' })
  return payload.project
}

export const redoProductionProject = async (projectId: string): Promise<EditProject> => {
  const payload = await fetchJson<{ project: EditProject }>(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(projectId)}/redo`, { method: 'POST' })
  return payload.project
}

export interface ProductionExportJobV1 {
  readonly schemaVersion: 'sanverse.local-export-job/v1'
  readonly jobId: string
  readonly projectId: string
  readonly projectRevision: number
  readonly exportId: string
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  readonly progress: number
  readonly phase: 'queued' | 'rendering' | 'verifying' | 'done'
  readonly attempts: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly result?: Readonly<{
    id: string
    mediaUrl: string
    sha256: string
    width: number
    height: number
    durationMs: number
    hasAudio: boolean
    projectRevision: number
  }>
  readonly error?: Readonly<{ code: string; message: string }>
}

export const createProductionExport = async (projectId: string): Promise<ProductionExportJobV1> =>
  await fetchJson<ProductionExportJobV1>(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(projectId)}/exports`, { method: 'POST' })

export const readProductionExportJob = async (input: Readonly<{ projectId: string; jobId: string }>): Promise<ProductionExportJobV1> =>
  await fetchJson<ProductionExportJobV1>(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(input.projectId)}/export-jobs/${encodeURIComponent(input.jobId)}`)

export const cancelProductionExportJob = async (input: Readonly<{ projectId: string; jobId: string }>): Promise<ProductionExportJobV1> =>
  await fetchJson<ProductionExportJobV1>(`${SANVERSE_API_URL}/api/projects/${encodeURIComponent(input.projectId)}/export-jobs/${encodeURIComponent(input.jobId)}`, { method: 'DELETE' })

export const ensureLocalMcpToken = async (): Promise<string> => {
  try {
    const existing = (await readFile(SANVERSE_MCP_TOKEN_PATH, 'utf8')).trim()
    if (/^[a-f0-9]{64}$/.test(existing)) return existing
  } catch {
    // First run: create a user-local ignored credential below.
  }
  await mkdir(dirname(SANVERSE_MCP_TOKEN_PATH), { recursive: true })
  const token = randomBytes(32).toString('hex')
  await writeFile(SANVERSE_MCP_TOKEN_PATH, `${token}\n`, { encoding: 'utf8', mode: 0o600 })
  await chmod(SANVERSE_MCP_TOKEN_PATH, 0o600).catch(() => undefined)
  return token
}

export const readLocalMcpToken = async (): Promise<string> => {
  const token = (await readFile(SANVERSE_MCP_TOKEN_PATH, 'utf8')).trim()
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error(`Sanverse MCP token is missing or invalid at ${SANVERSE_MCP_TOKEN_PATH}. Run sanverse:mcp:dev first.`)
  return token
}

export const healthSummary = async (toolCount = 0): Promise<Readonly<Record<string, unknown>>> => {
  const api = await apiReady()
  let projectCount = 0
  if (api) {
    try { projectCount = (await listProductionProjects()).length } catch { projectCount = 0 }
  }
  return Object.freeze({
    status: api ? 'ready' : 'degraded',
    mcp: 'ready',
    api: api ? 'ready' : 'unavailable',
    projectConnected: false,
    projectId: null,
    projectCount,
    toolCount,
    zeroProjectReady: api,
    writes: 'sandbox-first-and-owner-gated-production-apply',
    ownerApproval: 'host-authority-only',
  })
}

