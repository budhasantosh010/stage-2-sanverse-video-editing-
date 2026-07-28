import { validateProject, type EditProject } from '@sanverse/edit-domain'

import { isImportedProject, type ImportedProject } from '../project-intake/project-intake.ts'

const PROJECT_ID = /^project_[a-z0-9]{16,64}$/
const LIBRARY_ERROR = 'We could not load your local projects. Try again.'
const EDIT_ERROR = 'This edit could not be saved. Nothing was changed.'
const CONFLICT_ERROR = 'This project changed while that edit was being prepared. Reopen it and try again.'

export type RecentProject = ImportedProject
export type OpenedProject = ImportedProject & { project: EditProject }

export class ProjectEditError extends Error {
  readonly code: 'EDIT_REJECTED' | 'REVISION_CONFLICT' | 'NOTHING_TO_UNDO' | 'NOTHING_TO_REDO'

  constructor(code: ProjectEditError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProjectEditError'
    this.code = code
  }
}

function validProjectId(projectId: string): void {
  if (!PROJECT_ID.test(projectId)) throw new Error(LIBRARY_ERROR)
}

export async function listRecentProjects(fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<readonly RecentProject[]> {
  try {
    const response = await fetcher('/api/projects', { signal })
    if (response.status !== 200) throw new Error('list rejected')
    const value: unknown = await response.json()
    if (typeof value !== 'object' || value === null || !('projects' in value) || !Array.isArray(value.projects)) {
      throw new Error('invalid list')
    }
    if (value.projects.length > 1000 || !value.projects.every(isImportedProject)) throw new Error('invalid projects')
    return Object.freeze([...value.projects])
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error(LIBRARY_ERROR, { cause: error })
  }
}

/**
 * Every project the browser receives is validated by the same domain validator
 * the server uses. The browser trusts the shape of nothing it is handed, even
 * from its own API.
 */
export async function loadProject(projectId: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<OpenedProject> {
  validProjectId(projectId)
  try {
    const response = await fetcher(`/api/projects/${projectId}`, { signal })
    if (response.status !== 200) throw new Error('load rejected')
    const value: unknown = await response.json()
    if (typeof value !== 'object' || value === null || !isImportedProject(value) || !('project' in value)) {
      throw new Error('invalid project')
    }
    const project = validateProject((value as { project: unknown }).project)
    if (!project.ok || value.id !== projectId || project.value.projectId !== projectId) {
      throw new Error('invalid project state')
    }
    return Object.freeze({ ...value, project: project.value })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error(LIBRARY_ERROR, { cause: error })
  }
}

async function editRequest(
  projectId: string,
  path: string,
  init: RequestInit,
  expectedStatus: number,
  fetcher: typeof fetch,
): Promise<EditProject> {
  validProjectId(projectId)
  let response: Response
  try {
    response = await fetcher(path, init)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ProjectEditError('EDIT_REJECTED', EDIT_ERROR, { cause: error })
  }

  if (response.status !== expectedStatus) {
    let code: ProjectEditError['code'] = 'EDIT_REJECTED'
    try {
      const failure: unknown = await response.json()
      const failureCode = typeof failure === 'object' && failure !== null ? (failure as { code?: unknown }).code : undefined
      if (failureCode === 'REVISION_CONFLICT') code = 'REVISION_CONFLICT'
      else if (failureCode === 'NOTHING_TO_UNDO') code = 'NOTHING_TO_UNDO'
      else if (failureCode === 'NOTHING_TO_REDO') code = 'NOTHING_TO_REDO'
    } catch {
      // The stable generic message remains the fallback for malformed bodies.
    }
    throw new ProjectEditError(code, code === 'REVISION_CONFLICT' ? CONFLICT_ERROR : EDIT_ERROR)
  }

  const value: unknown = await response.json()
  const project = validateProject(typeof value === 'object' && value !== null ? (value as { project: unknown }).project : undefined)
  if (!project.ok || project.value.projectId !== projectId) {
    throw new ProjectEditError('EDIT_REJECTED', EDIT_ERROR)
  }
  return project.value
}

const jsonInit = (method: string, body: unknown, signal?: AbortSignal): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
  signal,
})

/**
 * Ask the server to apply one change set. The server decides whether it is
 * allowed and what the resulting revision is; the browser only reports what it
 * is told. That is what makes a stale edit impossible to force through.
 */
export async function acceptChangeSet(
  projectId: string,
  changeSet: unknown,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<EditProject> {
  return editRequest(projectId, `/api/projects/${projectId}/change-sets`, jsonInit('POST', { changeSet }, signal), 201, fetcher)
}

/**
 * Send a transcript file and get back the project with captions on it.
 *
 * The file's TEXT is sent, not the file. The browser never decides where lines
 * break or when a caption appears — the server does all of that and returns the
 * result — so the preview cannot disagree with what was saved.
 */
export async function addCaptionsFromTranscript(
  projectId: string,
  transcript: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<EditProject> {
  return editRequest(
    projectId,
    `/api/projects/${projectId}/captions`,
    jsonInit('POST', { transcript }, signal),
    201,
    fetcher,
  )
}

export async function undoProject(projectId: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<EditProject> {
  return editRequest(projectId, `/api/projects/${projectId}/undo`, { method: 'POST', signal }, 200, fetcher)
}

export async function redoProject(projectId: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<EditProject> {
  return editRequest(projectId, `/api/projects/${projectId}/redo`, { method: 'POST', signal }, 200, fetcher)
}

export async function setChangeSetActive(
  projectId: string,
  changeSetId: string,
  active: boolean,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<EditProject> {
  return editRequest(
    projectId,
    `/api/projects/${projectId}/change-sets/${changeSetId}/active`,
    jsonInit('PUT', { active }, signal),
    200,
    fetcher,
  )
}
