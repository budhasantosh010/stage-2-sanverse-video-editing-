import { validateHistory, type EditHistory } from '@sanverse/edit-domain/history'

import { isImportedProject, type ImportedProject } from '../project-intake/project-intake.ts'

const PROJECT_ID = /^project_[a-z0-9]{16,64}$/
const LIBRARY_ERROR = 'We could not load your local projects. Try again.'
const SAVE_ERROR = 'This edit is open, but it could not be saved locally.'

export type RecentProject = ImportedProject
export type OpenedProject = ImportedProject & { history: EditHistory }

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

export async function loadProject(projectId: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<OpenedProject> {
  validProjectId(projectId)
  try {
    const response = await fetcher(`/api/projects/${projectId}`, { signal })
    if (response.status !== 200) throw new Error('load rejected')
    const value: unknown = await response.json()
    if (typeof value !== 'object' || value === null || !isImportedProject(value) || !('history' in value)) throw new Error('invalid project')
    const history = validateHistory(value.history)
    if (!history.ok || value.id !== projectId) throw new Error('invalid history')
    return Object.freeze({ ...value, history: history.value })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error(LIBRARY_ERROR, { cause: error })
  }
}

export async function saveProjectHistory(
  projectId: string,
  historyInput: unknown,
  fetcher: typeof fetch = fetch,
): Promise<EditHistory> {
  validProjectId(projectId)
  const history = validateHistory(historyInput)
  if (!history.ok) throw new Error(SAVE_ERROR)
  try {
    const response = await fetcher(`/api/projects/${projectId}/history`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ history: history.value }),
    })
    if (response.status !== 200) throw new Error('save rejected')
    const value: unknown = await response.json()
    if (typeof value !== 'object' || value === null || !('history' in value)) throw new Error('invalid save')
    const saved = validateHistory(value.history)
    if (!saved.ok) throw new Error('invalid saved history')
    return saved.value
  } catch (error) {
    throw new Error(SAVE_ERROR, { cause: error })
  }
}
