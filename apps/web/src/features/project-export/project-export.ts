import type { EditHistory } from '@sanverse/edit-domain/history'

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
const EXPORT_ERROR = 'We could not export the video. Your accepted edits are still safe.'

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

export async function exportProject(
  projectId: string,
  history: EditHistory,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectExportResult> {
  if (!PROJECT_ID.test(projectId)) throw new Error(EXPORT_ERROR)
  try {
    const response = await fetcher(`/api/projects/${projectId}/exports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history }),
      signal,
    })
    if (response.status !== 201) throw new Error('export rejected')
    const value: unknown = await response.json()
    if (!isExportResult(value, projectId)) throw new Error('invalid export response')
    return value
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error(EXPORT_ERROR, { cause: error })
  }
}
