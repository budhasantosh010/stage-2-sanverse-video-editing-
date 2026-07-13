import type { Result } from './actions.ts'
import { validateHistory, type EditHistory, type HistoryValidationError } from './history.ts'

export type EditProject = {
  readonly schemaVersion: 'sanverse.project/v1'
  readonly projectId: string
  readonly history: EditHistory
}

export type ProjectError =
  | { readonly code: 'PROJECT_ID_REQUIRED' }
  | { readonly code: 'PROJECT_INVALID' }
  | HistoryValidationError

export const createProject = (
  projectId: unknown,
  history: unknown,
): Result<EditProject, ProjectError> => {
  if (typeof projectId !== 'string' || projectId.trim().length === 0) {
    return { ok: false, error: { code: 'PROJECT_ID_REQUIRED' } }
  }
  const validatedHistory = validateHistory(history)
  if (!validatedHistory.ok) return validatedHistory
  return {
    ok: true,
    value: Object.freeze({
      schemaVersion: 'sanverse.project/v1',
      projectId,
      history: validatedHistory.value,
    }),
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const validateProject = (input: unknown): Result<EditProject, ProjectError> => {
  if (!isRecord(input)) return { ok: false, error: { code: 'PROJECT_INVALID' } }
  const keys = ['schemaVersion', 'projectId', 'history'] as const
  if (
    Object.keys(input).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(input, key)) ||
    input.schemaVersion !== 'sanverse.project/v1'
  ) {
    return { ok: false, error: { code: 'PROJECT_INVALID' } }
  }
  return createProject(input.projectId, input.history)
}

export const serializeProject = (project: unknown): Result<string, ProjectError> => {
  const validated = validateProject(project)
  if (!validated.ok) return validated
  return { ok: true, value: JSON.stringify(validated.value) }
}

export type { AddNameplateAction, PointTarget, Result } from './actions.ts'
export { proposeAddNameplate, validateAddNameplateAction } from './actions.ts'
export { accept, createHistory, redo, undo, validateHistory } from './history.ts'
