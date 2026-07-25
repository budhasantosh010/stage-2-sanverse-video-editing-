import { validateLocalVideo } from '../local-media/local-media.ts'

export type ImportedProject = {
  id: string
  originalFilename: string
  createdAt: string
  sizeBytes: number
  sha256: string
  mediaUrl: string
}

const IMPORT_ERROR = 'We could not import the video. Try again.'
const PROJECT_ID = /^project_[a-z0-9]{16,64}$/

export function isImportedProject(value: unknown): value is ImportedProject {
  if (typeof value !== 'object' || value === null) return false
  const project = value as Record<string, unknown>
  return (
    typeof project.id === 'string' && PROJECT_ID.test(project.id) &&
    typeof project.originalFilename === 'string' && project.originalFilename.length > 0 &&
    typeof project.createdAt === 'string' && !Number.isNaN(Date.parse(project.createdAt)) &&
    typeof project.sizeBytes === 'number' && Number.isSafeInteger(project.sizeBytes) && project.sizeBytes > 0 &&
    typeof project.sha256 === 'string' && /^[a-f0-9]{64}$/.test(project.sha256) &&
    project.mediaUrl === `/api/projects/${project.id}/media`
  )
}

export async function uploadProject(
  file: File,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ImportedProject> {
  validateLocalVideo(file)
  try {
    const headers: Record<string, string> = {
      'X-Sanverse-Filename': encodeURIComponent(file.name),
    }
    if (file.type) headers['Content-Type'] = file.type
    const response = await fetcher('/api/projects', {
      method: 'POST',
      headers,
      body: file,
      signal,
    })
    if (response.status !== 201) throw new Error('intake rejected')
    const value: unknown = await response.json()
    if (!isImportedProject(value)) throw new Error('invalid response')
    return value
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error(IMPORT_ERROR, { cause: error })
  }
}
