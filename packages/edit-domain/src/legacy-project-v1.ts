/**
 * The v1 project shape, kept only so saved projects can be read and migrated.
 *
 * Nothing new should be written against this file. It is deleted once no
 * v1 project files remain in the wild.
 */
import type { Result } from './result.ts'
import { validateHistory, type EditHistory, type HistoryValidationError } from './history.ts'

export type EditProjectV1 = {
  readonly schemaVersion: 'sanverse.project/v1'
  readonly projectId: string
  readonly history: EditHistory
}

export type ProjectV1Error =
  | { readonly code: 'PROJECT_ID_REQUIRED' }
  | { readonly code: 'PROJECT_INVALID' }
  | HistoryValidationError

export const createProjectV1 = (
  projectId: unknown,
  history: unknown,
): Result<EditProjectV1, ProjectV1Error> => {
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

export const validateProjectV1 = (input: unknown): Result<EditProjectV1, ProjectV1Error> => {
  if (!isRecord(input)) return { ok: false, error: { code: 'PROJECT_INVALID' } }
  const keys = ['schemaVersion', 'projectId', 'history'] as const
  if (
    Object.keys(input).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(input, key)) ||
    input.schemaVersion !== 'sanverse.project/v1'
  ) {
    return { ok: false, error: { code: 'PROJECT_INVALID' } }
  }
  return createProjectV1(input.projectId, input.history)
}

export const isProjectV1 = (input: unknown): boolean =>
  isRecord(input) && input.schemaVersion === 'sanverse.project/v1'
